/*
 * @adonisjs/lock
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { Database } from '@adonisjs/lucid/database'
import { RedisService } from '@adonisjs/redis/types'
import { RedisStore } from '@verrou/core/drivers/redis'
import { ApplicationService } from '@adonisjs/core/types'
import { MemoryStore } from '@verrou/core/drivers/memory'
import { AppFactory } from '@adonisjs/core/factories/app'
import { DatabaseStore } from '@verrou/core/drivers/database'

import { defineConfig, stores } from '../index.js'
import { createDatabase, createRedis, createTables } from './helpers.js'

test.group('Define Config', () => {
  test('redis store', async ({ assert }) => {
    const redis = createRedis() as unknown as RedisService
    const app = new AppFactory().create(new URL('./', import.meta.url)) as ApplicationService
    await app.init()

    app.container.singleton('redis', () => redis)

    const redisProvider = stores.redis({ connectionName: 'main' })
    const storeFactory = await redisProvider.resolver(app)
    const store = storeFactory.driver.factory()

    assert.instanceOf(store, RedisStore)
    assert.isFalse(await store.exists('foo'))
  })

  test('database store', async ({ assert }) => {
    const database = createDatabase() as unknown as Database
    const app = new AppFactory().create(new URL('./', import.meta.url)) as ApplicationService
    await app.init()

    app.container.singleton('lucid.db', () => database)

    const databaseProvider = stores.database({ connectionName: 'pg' })
    const storeFactory = await databaseProvider.resolver(app)
    const store = storeFactory.driver.factory()

    assert.instanceOf(store, DatabaseStore)
    assert.isFalse(await store.exists('foo'))
  })

  test('use default database when no explicit database is configured', async ({ assert }) => {
    const database = createDatabase()
    await createTables(database)

    const app = new AppFactory().create(new URL('./', import.meta.url)) as ApplicationService
    await app.init()

    app.container.singleton('lucid.db', () => database)
    const dbProvider = stores.database({ tableName: 'locks' })
    const storeFactory = await dbProvider.resolver(app)
    const store = storeFactory.driver.factory()

    assert.instanceOf(store, DatabaseStore)
    assert.isFalse(await store.exists('foo'))
  })

  test('throw error when unregistered db connection is used', async () => {
    const database = createDatabase()
    await createTables(database)

    const app = new AppFactory().create(new URL('./', import.meta.url)) as ApplicationService
    await app.init()

    app.container.singleton('lucid.db', () => database)
    const dbProvider = stores.database({ connectionName: 'foo' })

    await dbProvider.resolver(app)
  }).throws(
    'Invalid connection name "foo" referenced by "config/lock.ts" file. First register the connection inside "config/database.ts" file'
  )

  test('memory store', async ({ assert }) => {
    const app = new AppFactory().create(new URL('./', import.meta.url)) as ApplicationService
    await app.init()

    const storeProvider = stores.memory()
    const storeFactory = await storeProvider.resolver(app)
    const store = storeFactory.driver.factory()

    assert.instanceOf(store, MemoryStore)
  })

  test('throw error when config is invalid', async ({ assert }) => {
    const redis = createRedis() as unknown as RedisService
    const database = createDatabase()
    await createTables(database)

    const app = new AppFactory().create(new URL('./', import.meta.url)) as ApplicationService
    await app.init()

    app.container.singleton('redis', () => redis)
    app.container.singleton('lucid.db', () => database)

    assert.throws(
      () =>
        defineConfig({
          // @ts-expect-error
          default: 'redis',
          stores: {},
        }),
      'Missing "stores.redis" in lock config. It is referenced by the "default" property'
    )

    assert.throws(
      // @ts-expect-error
      () => defineConfig({}),
      'Missing "stores" property in lock config'
    )

    assert.throws(
      // @ts-expect-error
      () => defineConfig({ stores: {} }),
      'Missing "default" store in lock config'
    )
  })
})
