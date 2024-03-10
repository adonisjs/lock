/*
 * @adonisjs/lock
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { join } from 'node:path'
import { configDotenv } from 'dotenv'
import { getActiveTest } from '@japa/runner'
import { Emitter } from '@adonisjs/core/events'
import { Database } from '@adonisjs/lucid/database'
import { AppFactory } from '@adonisjs/core/factories/app'
import { RedisConnection, RedisManager } from '@adonisjs/redis'
import { LoggerFactory } from '@adonisjs/core/factories/logger'
import { IgnitorFactory } from '@adonisjs/core/factories/core/ignitor'

configDotenv()

export const BASE_URL = new URL('./tmp/', import.meta.url)
export const IMPORTER = (filePath: string) => {
  if (filePath.startsWith('./') || filePath.startsWith('../')) {
    return import(new URL(filePath, BASE_URL).href)
  }
  return import(filePath)
}

/**
 * Setup an AdonisJS app for testing
 */
export async function setupApp(parameters: Parameters<IgnitorFactory['merge']>[0] = {}) {
  const ignitor = new IgnitorFactory()
    .withCoreProviders()
    .withCoreConfig()
    .merge(parameters)
    .create(BASE_URL, { importer: IMPORTER })

  const app = ignitor.createApp('web')
  await app.init().then(() => app.boot())

  return { app }
}

declare module '@adonisjs/redis/types' {
  interface RedisConnections {
    main: RedisConnection
  }
}

/**
 * Creates an instance of the database class for making queries
 */
export function createDatabase({ autoClose = true }: { autoClose?: boolean } = {}) {
  const test = getActiveTest()
  if (!test) {
    throw new Error('Cannot use "createDatabase" outside of a Japa test')
  }

  const app = new AppFactory().create(test.context.fs.baseUrl, () => {})
  const logger = new LoggerFactory().create()
  const emitter = new Emitter(app)
  const db = new Database(
    {
      connection: process.env.DB || 'pg',
      connections: {
        sqlite: {
          client: 'better-sqlite3',
          connection: {
            filename: join(test.context.fs.basePath, 'db.sqlite3'),
          },
        },
        pg: {
          client: 'pg',
          connection: {
            host: process.env.PG_HOST as string,
            port: Number(process.env.PG_PORT),
            database: process.env.PG_DATABASE as string,
            user: process.env.PG_USER as string,
            password: process.env.PG_PASSWORD as string,
          },
        },
        mysql: {
          client: 'mysql2',
          connection: {
            host: process.env.MYSQL_HOST as string,
            port: Number(process.env.MYSQL_PORT),
            database: process.env.MYSQL_DATABASE as string,
            user: process.env.MYSQL_USER as string,
            password: process.env.MYSQL_PASSWORD as string,
          },
        },
      },
    },
    logger,
    emitter
  )

  if (autoClose) {
    test.cleanup(() => db.manager.closeAll())
  }

  return db
}

/**
 * Creates redis manager instance to execute redis
 * commands
 */
export function createRedis(keysToClear?: string[]) {
  const test = getActiveTest()
  if (!test) {
    throw new Error('Cannot use "createDatabase" outside of a Japa test')
  }

  const logger = new LoggerFactory().create()
  const redis = new RedisManager(
    {
      connection: 'main',
      connections: {
        main: {
          host: process.env.REDIS_HOST || '0.0.0.0',
          port: process.env.REDIS_PORT || 6379,
        },
      },
    },
    logger
  )

  test.cleanup(async () => {
    if (keysToClear) {
      await redis.del(...keysToClear)
    }

    await redis.disconnectAll()
  })
  return redis
}

/**
 * Creates needed database tables
 */
export async function createTables(db: Database) {
  const test = getActiveTest()
  if (!test) throw new Error('Cannot use "createTables" outside of a Japa test')

  test.cleanup(async () => {
    await db.connection().schema.dropTable('locks')
  })

  await db.connection().schema.createTable('locks', (table) => {
    table.string('key', 255).notNullable().primary()
    table.string('owner').notNullable()
    table.bigint('expiration').unsigned().nullable()
  })
}
