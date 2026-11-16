/*
 * @adonisjs/lock
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { Verrou } from '@verrou/core'
import { type LockStore } from '@verrou/core/types'
import { type RedisService } from '@adonisjs/redis/types'

import { defineConfig, stores } from '../index.ts'
import { createRedis, setupApp } from './helpers.ts'

test.group('Provider', () => {
  test('register lock provider', async ({ assert }) => {
    const redis = createRedis() as unknown as RedisService

    const { app } = await setupApp({
      rcFileContents: {
        providers: [() => import('../providers/lock_provider.ts')],
      },
      config: {
        lock: defineConfig({
          default: 'redis',
          stores: {
            redis: stores.redis({
              connectionName: 'main',
            }),
          },
        }),
      },
    })

    app.container.singleton('redis', () => redis)

    assert.instanceOf(await app.container.make('lock.manager'), Verrou)
  })

  test('create store even if they are not wrapped within a ConfigProvider', async ({ assert }) => {
    assert.plan(2)

    class NoopStore implements LockStore {
      save = async () => {
        assert.isTrue(true)
        return false
      }
      delete = async () => {}
      forceDelete = async () => {}
      exists = async () => false
      extend = async () => {}
    }

    function noopStore() {
      return { driver: { factory: () => new NoopStore() } }
    }

    const { app } = await setupApp({
      rcFileContents: {
        providers: [() => import('../providers/lock_provider.js')],
      },
      config: {
        lock: defineConfig({
          default: 'noop',
          stores: {
            noop: noopStore(),
          },
        }),
      },
    })

    const verrou = await app.container.make('lock.manager')
    const acquired = await verrou.use('noop').createLock('foo').acquireImmediately()

    assert.deepEqual(acquired, false)
  })
})

test.group('Provider | Redis store', () => {
  /**
   * Boots an app with the lock provider and a single Redis store
   */
  async function setupRedisApp(keysToClear?: string[]) {
    const redis = createRedis(keysToClear) as unknown as RedisService

    const { app } = await setupApp({
      rcFileContents: {
        providers: [() => import('../providers/lock_provider.ts')],
      },
      config: {
        lock: defineConfig({
          default: 'redis',
          stores: {
            redis: stores.redis({
              connectionName: 'main',
            }),
          },
        }),
      },
    })

    app.container.singleton('redis', () => redis)
    return { app, redis }
  }

  test('do not open a Redis connection when creating the lock manager', async ({ assert }) => {
    const { app, redis } = await setupRedisApp()

    await app.container.make('lock.manager')
    assert.equal(redis.activeConnectionsCount, 0)
  })

  test('open the Redis connection on the first lock of the store', async ({ assert }) => {
    const { app, redis } = await setupRedisApp(['lazy_first_lock'])

    const verrou = await app.container.make('lock.manager')
    assert.equal(redis.activeConnectionsCount, 0)

    const lock = verrou.createLock('lazy_first_lock', 10_000)
    assert.isTrue(await lock.acquireImmediately())

    assert.equal(redis.activeConnectionsCount, 1)
    assert.equal(await redis.get('lazy_first_lock'), lock.getOwner())

    await lock.release()
    assert.isNull(await redis.get('lazy_first_lock'))
  })

  test('re-use the Redis connection for the next locks of the store', async ({ assert }) => {
    const { app, redis } = await setupRedisApp(['lazy_lock_1', 'lazy_lock_2'])

    const verrou = await app.container.make('lock.manager')

    const firstLock = verrou.createLock('lazy_lock_1', 10_000)
    assert.isTrue(await firstLock.acquireImmediately())
    const activeConnections = redis.activeConnections as Record<string, unknown>
    const connection = activeConnections.main

    const secondLock = verrou.use('redis').createLock('lazy_lock_2', 10_000)
    assert.isTrue(await secondLock.acquireImmediately())

    assert.equal(redis.activeConnectionsCount, 1)
    assert.strictEqual(activeConnections.main, connection)
    assert.equal(await redis.get('lazy_lock_2'), secondLock.getOwner())
  })
})
