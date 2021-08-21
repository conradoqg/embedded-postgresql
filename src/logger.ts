import { Logger } from 'tslog';

function setupLogger(): Logger {
    return new Logger({
        // minLevel: 'error'
    });
}

export default setupLogger();