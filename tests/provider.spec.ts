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
})
