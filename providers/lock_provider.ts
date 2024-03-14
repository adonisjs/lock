/*
 * @adonisjs/lock
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { ApplicationService } from '@adonisjs/core/types'

import type { defineConfig } from '../index.js'
import type { LockService, StoreFactory } from '../src/types.js'

/**
 * Add lock manager type to the container bindings
 */
declare module '@adonisjs/core/types' {
  export interface ContainerBindings {
    'lock.manager': LockService
  }
}

export default class LockProvider {
  constructor(protected app: ApplicationService) {}

  /**
   * Registers the lock manager in the application container
   */
  register() {
    this.app.container.singleton('lock.manager', async () => {
      const { Verrou } = await import('@verrou/core')
      const config = this.app.config.get<ReturnType<typeof defineConfig>>('lock', {})
      const stores = Object.entries(config.stores).map(async ([name, store]) => {
        /**
         * Resolve the store wether it's a simple factory function
         * or a factory wrapped in a ConfigProvider
         */
        let resolvedStore: StoreFactory
        if ('resolver' in store) {
          resolvedStore = await store.resolver(this.app)
        } else {
          resolvedStore = store
        }

        return [name, resolvedStore]
      })

      return new Verrou({
        default: config.default,
        stores: Object.fromEntries(await Promise.all(stores)),
      })
    })
  }
}
