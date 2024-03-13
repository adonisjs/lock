/*
 * @adonisjs/lock
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/// <reference types="@adonisjs/redis/redis_provider" />
/// <reference types="@adonisjs/lucid/database_provider" />

import { configProvider } from '@adonisjs/core'
import type { RedisConnection } from '@adonisjs/redis'
import type { ConfigProvider } from '@adonisjs/core/types'
import { RuntimeException } from '@adonisjs/core/exceptions'
import type { RedisConnections } from '@adonisjs/redis/types'
import type { DynamoDbOptions, StoreFactory } from '@verrou/core/types'

/**
 * Different stores supported by the lock module
 */
export const stores: {
  memory: () => ConfigProvider<StoreFactory>
  redis: (config: { connectionName?: keyof RedisConnections }) => ConfigProvider<StoreFactory>
  database: (config?: {
    connectionName?: string
    tableName?: string
  }) => ConfigProvider<StoreFactory>
  dynamodb: (config: DynamoDbOptions) => ConfigProvider<StoreFactory>
} = {
  /**
   * Redis store
   * You must install @adonisjs/redis to use this driver
   */
  redis(config) {
    return configProvider.create(async (app) => {
      const redis = await app.container.make('redis')
      const { redisStore } = await import('@verrou/core/drivers/redis')

      const redisConnection = redis.connection(config.connectionName) as any as RedisConnection
      const store = redisStore({ connection: redisConnection.ioConnection })

      return { driver: store }
    })
  },

  /**
   * Memory store
   */
  memory() {
    return configProvider.create(async () => {
      const { memoryStore } = await import('@verrou/core/drivers/memory')
      return { driver: memoryStore() }
    })
  },

  /**
   * Database store
   * You must install @adonisjs/lucid to use this driver
   */
  database(config) {
    return configProvider.create(async (app) => {
      const db = await app.container.make('lucid.db')
      const connectionName = config?.connectionName || db.primaryConnectionName
      const connection = db.manager.get(connectionName)

      /**
       * Throw error when mentioned connection is not specified
       * in the database file
       */
      if (!connection) {
        throw new RuntimeException(
          `Invalid connection name "${connectionName}" referenced by "config/lock.ts" file. First register the connection inside "config/database.ts" file`
        )
      }

      const dialect = db.connection(connectionName).dialect.name

      /**
       * We only support pg, mysql, better-sqlite3 and sqlite3 dialects for now
       */
      const supportedDialects = ['postgres', 'mysql', 'better-sqlite3', 'sqlite3']
      if (!supportedDialects.includes(dialect)) {
        throw new Error(`Unsupported dialect "${dialect}"`)
      }

      /**
       * Get the knex connection for the given connection name
       */
      const rawConnection = db.getRawConnection(connectionName)
      if (!rawConnection?.connection?.client) {
        throw new Error(`Unable to get raw connection for "${connectionName}"`)
      }

      /**
       * Create the driver
       */
      const { knexStore } = await import('@verrou/core/drivers/knex')
      const store = knexStore({
        connection: rawConnection.connection.client,
        tableName: config?.tableName,
        autoCreateTable: false,
      })

      return { driver: store }
    })
  },

  /**
   * DynamoDB store
   * You must install @aws-sdk/client-dynamodb to use this driver
   */
  dynamodb(config) {
    return configProvider.create(async () => {
      const { dynamodbStore } = await import('@verrou/core/drivers/dynamodb')
      return { driver: dynamodbStore(config) }
    })
  },
}
