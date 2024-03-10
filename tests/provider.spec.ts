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
import { RedisService } from '@adonisjs/redis/types'
import { Database } from '@adonisjs/lucid/database'

import { defineConfig, stores } from '../index.js'
import { createDatabase, createRedis, setupApp } from './helpers.js'

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

  test('close all connections on shutdown', async ({ assert }) => {
    const database = createDatabase({ autoClose: false }) as unknown as Database
    const { app } = await setupApp({
      rcFileContents: {
        providers: [() => import('../providers/lock_provider.js')],
      },
      config: {
        lock: defineConfig({
          default: 'database',
          stores: {
            database: stores.database({ connectionName: 'pg' }),
          },
        }),
      },
    })

    app.container.singleton('lucid.db', () => database)

    const lock = await app.container.make('lock.manager')
    await lock.createLock('foo:1').run(async () => assert.isTrue(true))

    await app.terminate()
  })
})
