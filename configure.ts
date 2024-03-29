/*
 * @adonisjs/lock
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import string from '@adonisjs/core/helpers/string'
import type Configure from '@adonisjs/core/commands/configure'

import { stubsRoot } from './stubs/main.js'

/**
 * Available stores for selection
 */
const KNOWN_STORES = ['database', 'redis', 'dynamodb']

export async function configure(command: Configure) {
  /**
   * Read store from the "--store" CLI flag
   */
  let selectedStore: string | undefined = command.parsedFlags.store

  /**
   * Display prompts when no store have been selected
   * via the CLI flag
   */
  if (!selectedStore) {
    selectedStore = await command.prompt.choice(
      'Select the storage layer you want to use',
      KNOWN_STORES,
      {
        validate(value) {
          return !value ? 'Please select a store' : true
        },
      }
    )
  }

  /**
   * Ensure the select store is valid
   */
  if (!KNOWN_STORES.includes(selectedStore!)) {
    command.exitCode = 1
    command.logger.logError(
      `Invalid lock store "${selectedStore}". Supported stores are: ${string.sentence(
        KNOWN_STORES
      )}`
    )
    return
  }

  const codemods = await command.createCodemods()

  /**
   * Publish config file
   */
  await codemods.makeUsingStub(stubsRoot, 'config/lock.stub', {
    store: selectedStore,
  })

  /**
   * Publish provider
   */
  await codemods.updateRcFile((rcFile) => {
    rcFile.addProvider('@adonisjs/lock/lock_provider')
  })

  /**
   * Publish migration when using database store
   */
  if (selectedStore === 'database') {
    await codemods.makeUsingStub(stubsRoot, 'make/migration/locks.stub', {
      entity: command.app.generators.createEntity('locks'),
      migration: {
        folder: 'database/migrations',
        fileName: `${new Date().getTime()}_create_locks_table.ts`,
      },
    })
  }

  /**
   * Define env variables for the selected store
   */
  await codemods.defineEnvVariables({
    LOCK_STORE: selectedStore!,
  })

  /**
   * Define env variables validation for the selected store
   */
  await codemods.defineEnvValidations({
    leadingComment: 'Variables for configuring the lock package',
    variables: {
      LOCK_STORE: `Env.schema.enum(['${selectedStore}', 'memory'] as const)`,
    },
  })
}
