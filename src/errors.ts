/*
 * @adonisjs/lock
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/**
 * Re-exporting verrou errors
 */
export {
  E_LOCK_TIMEOUT,
  E_LOCK_NOT_OWNED,
  E_LOCK_STORAGE_ERROR,
  E_LOCK_ALREADY_ACQUIRED,
} from '@verrou/core'
