import { Logger, TLogLevelName } from 'tslog';

const minLevel = process.env.LOG_LEVEL || 'debug';

function setupLogger(): Logger {
    return new Logger({
        minLevel: minLevel as TLogLevelName
    });
}

export default setupLogger();