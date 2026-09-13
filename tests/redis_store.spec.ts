/*
 * @adonisjs/lock
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { LockFactory } from '@verrou/core'
import { type RedisService } from '@adonisjs/redis/types'
import { AppFactory } from '@adonisjs/core/factories/app'
import { type ApplicationService } from '@adonisjs/core/types'

import { errors, stores } from '../index.ts'
import { createRedis } from './helpers.ts'

/**
 * Creates a lock factory using the "stores.redis" config provider, so
 * that the lock commands are issued against the "ioConnection" of
 * the @adonisjs/redis connection
 */
async function createRedisLocks(key: string) {
  const redis = createRedis([key]) as unknown as RedisService
  const app = new AppFactory().create(new URL('./', import.meta.url)) as ApplicationService
  await app.init()

  app.container.singleton('redis', () => redis)

  const storeFactory = await stores.redis({ connectionName: 'main' }).resolver(app)
  return { redis, locks: new LockFactory(storeFactory.driver.factory()) }
}

test.group('Redis store', () => {
  test('acquire and release a lock', async ({ assert }) => {
    const { redis, locks } = await createRedisLocks('lock_acquire')

    const lock = locks.createLock('lock_acquire', 10_000)
    assert.isTrue(await lock.acquireImmediately())
    assert.equal(await redis.get('lock_acquire'), lock.getOwner())
    assert.isAbove(await redis.pttl('lock_acquire'), 0)
    assert.isTrue(await lock.isLocked())

    await lock.release()
    assert.isNull(await redis.get('lock_acquire'))
    assert.isFalse(await lock.isLocked())
  })

  test('do not acquire a lock owned by someone else', async ({ assert }) => {
    const { locks } = await createRedisLocks('lock_contention')

    assert.isTrue(await locks.createLock('lock_contention', 10_000).acquireImmediately())
    assert.isFalse(await locks.createLock('lock_contention', 10_000).acquireImmediately())
  })

  test('extend the lock expiration', async ({ assert }) => {
    const { redis, locks } = await createRedisLocks('lock_extend')

    const lock = locks.createLock('lock_extend', 10_000)
    await lock.acquireImmediately()
    await lock.extend(30_000)

    assert.isAbove(await redis.pttl('lock_extend'), 10_000)
  })

  test('throw when releasing a lock owned by someone else', async ({ assert }) => {
    const { locks } = await createRedisLocks('lock_not_owned')

    const lock = locks.createLock('lock_not_owned', 10_000)
    await lock.acquireImmediately()

    const otherLock = locks.createLock('lock_not_owned', 10_000)
    await assert.rejects(() => otherLock.release(), errors.E_LOCK_NOT_OWNED)
    assert.isTrue(await lock.isLocked())

    await otherLock.forceRelease()
    assert.isFalse(await lock.isLocked())
  })
})
