import { install } from './installer';
import logger from './logger';

async function main() {
    try {
        await install('13.2.0');
    } catch (ex) {
        logger.fatal(ex);
        process.exit(1);
    }
}

main();