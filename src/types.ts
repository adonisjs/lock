/*
 * @adonisjs/lock
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { Verrou } from '@verrou/core'
import type { StoreFactory } from '@verrou/core/types'
import type { ConfigProvider } from '@adonisjs/core/types'

/**
 * A list of known lock stores inferred from the user config
 */
export interface LockStoresList extends Record<string, StoreFactory> {}

/**
 * Helper method to resolve configured lock stores
 * inside user app
 */
export type InferLockStores<T extends { stores: Record<string, ConfigProvider<StoreFactory>> }> = {
  [K in keyof T['stores']]: Awaited<ReturnType<T['stores'][K]['resolver']>>
}

/**
 * Lock service is a singleton instance of Verrou
 * configured using user app's config
 */
export interface LockService extends Verrou<LockStoresList> {}

/**
 * Re-exporting types from Verrou
 */
export * from '@verrou/core/types'
