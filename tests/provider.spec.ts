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
import { LockStore } from '@verrou/core/types'
import { RedisService } from '@adonisjs/redis/types'

import { defineConfig, stores } from '../index.js'
import { createRedis, setupApp } from './helpers.js'

test.group('Provider', () => {
  test('register lock provider', async ({ assert }) => {
    const redis = createRedis() as unknown as RedisService

    const { app } = await setupApp({
      rcFileContents: {
        providers: [() => import('../providers/lock_provider.js')],
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
