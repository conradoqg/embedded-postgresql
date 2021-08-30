import { Logger, TLogLevelName } from 'tslog';

const minLevel = process.env.EMBEDDED_POSTGRESQL_LOG_LEVEL || null;

/**
 * Setup the default log instance. 
 * 
 * @returns Default logger instance
 */
function setupLogger(): Logger {
    return new Logger({
        suppressStdOutput: minLevel == null,
        minLevel: minLevel as TLogLevelName
    });
}

export default setupLogger();