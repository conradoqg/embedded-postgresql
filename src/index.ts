import EmbeddedPostgreSQL, { PostgresConfig } from './EmbeddedPostgreSQL';
import { install, uninstall, checkInstallation, defaultInstallPath } from './installer';
import logger from './logger';

export { EmbeddedPostgreSQL, PostgresConfig, install, uninstall, checkInstallation, defaultInstallPath };

/**
 * Gets the default logger instance.
 *
 * It uses the [tslog](https://tslog.js.org/) library and you can change its settings by configuring the logger, example:
 * ```
 * logger.setSettings({
 *     minLevel: 'debug',
 *     suppressStdOutput: false
 * }
 * ```
 */
export { logger };