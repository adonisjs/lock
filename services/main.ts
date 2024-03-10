/*
 * @adonisjs/lock
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import app from '@adonisjs/core/services/app'
import type { LockService } from '../src/types.js'

let lock: LockService

await app.booted(async () => {
  lock = await app.container.make('lock.manager')
})

export { lock as default }
