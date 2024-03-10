/*
 * @adonisjs/lock
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { StoreFactory } from '@verrou/core/types'
import type { ConfigProvider } from '@adonisjs/core/types'
import { InvalidArgumentsException } from '@adonisjs/core/exceptions'

/**
 * Define lock configuration
 */
export function defineConfig<
  KnownStores extends Record<string, ConfigProvider<StoreFactory>>,
>(config: { default: keyof KnownStores; stores: KnownStores }) {
  if (!config.stores) {
    throw new InvalidArgumentsException('Missing "stores" property in lock config')
  }

  if (!config.default) {
    throw new InvalidArgumentsException('Missing "default" store in lock config')
  }

  if (!config.stores[config.default]) {
    throw new InvalidArgumentsException(
      `Missing "stores.${config.default.toString()}" in lock config. It is referenced by the "default" property`
    )
  }

  return config
}
