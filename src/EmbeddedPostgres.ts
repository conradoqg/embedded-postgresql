/* eslint-disable no-inner-declarations */
import { defaultInstallPath, checkInstallation } from './installer';
import fsExtra from 'fs-extra';
import path from 'path';
import child_process, { ChildProcessWithoutNullStreams } from 'child_process';
import logger from './logger';

const isWin = process.platform === 'win32';

/**
 * Object that holds pairs that is used to update postgresql's configuration file `postgresql.conf`.
 */
export interface PostgresConfig {
    /**
     * Pair entry.
     * 
     * Example:
     * ```json
     * {
     *       listen_addresses: '\'127.0.0.1\'', // By default it's commented and a string 'localhost'
     *       max_connections: 200,   // By default it's 100
     *       superuser_reserved_connections: 4 // By default it's commented and a number 3
     *   }
     * ```
     */
    [k: string]: string | number
}

/**
 * Controls the execution of the installed embedded PostgresSQL, allowing it to start, stop, get status and configure.
 */
export default class EmbeddedPostgres {

    private installPath: string;
    private configPath: string;
    /**
     * Set data path.
     */
    dataPath: string;
    /**
     * PostgreSQL' process, set by {@link EmbeddedPostgres.start}.
     */
    process: ChildProcessWithoutNullStreams | null = null;

    private get postgresPath(): string {
        return path.join(this.installPath, 'bin', 'postgres' + (isWin && '.exe'));
    }

    private get pgCTLPath(): string {
        return path.join(this.installPath, 'bin', 'pg_ctl' + (isWin && '.exe'));
    }

    private get initDBPath(): string {
        return path.join(this.installPath, 'bin', 'initdb' + (isWin && '.exe'));
    }

    /**
     * Creates an embedded PostgreSQL instance for a specific data path.
     * @param dataPath Data path.
     */
    constructor(dataPath: string = path.join(__dirname, '..', 'data')) {
        this.dataPath = dataPath;
        this.installPath = defaultInstallPath;
        this.configPath = path.join(dataPath, 'postgresql.conf');

        logger.silly('instance config: ', this);
    }

    /**
     * Checks if the embedded PostgreSQL is installed.
     * @returns `true` if it is installed, otherwise `false`.
     */
    public async isInstalled(): Promise<boolean> {
        return checkInstallation(this.installPath);
    }

    /**
     * Checks if the data path is initialized.
     * @returns  `true` if it is initialized, otherwise `false`.
     */
    public async isInitialized(): Promise<boolean> {
        return fsExtra.pathExists(this.dataPath);
    }

    /**
     * Initializes the data path with a database cluster.
     * 
     * Under the hood it calls postgres's [initdb](https://www.postgresql.org/docs/current/app-initdb.html).
     */
    public async initialize(): Promise<void> {
        if (!await this.isInstalled()) throw new Error('Embedded Postgress in not installed');
        if (await this.isInitialized()) throw new Error('Already initialized');

        const args = ['-A', 'trust', '-U', 'postgres', '-D', this.dataPath, '-E', 'UTF-8'];
        logger.info(`initing postgres using '${this.dataPath}' for data`);
        logger.debug(`calling '${this.initDBPath} ${args.join(' ')}'`);
        child_process.spawnSync(this.initDBPath, args, { shell: false });
    }

    /**
     * Deletes the data path.
     */
    public async delete(): Promise<void> {
        if (!await this.isInitialized()) throw new Error('Embedded Postgress in not initialized');

        logger.debug(`deleting database on '${this.dataPath}'`);
        await fsExtra.remove(this.dataPath);
    }

    /**
     * Starts the embedded PostgreSQL process
     * 
     * Under the hood it calls postgres' [server](https://www.postgresql.org/docs/current/app-postgres.html) executable and logs it's output.
     * @param autoStop `true` if it should stop the local postgres' process if it's running, otherwise if there's already an executing process it will throw.
     */
    public async start(autoStop = true): Promise<void> {
        if (!await this.isInstalled()) throw new Error('Embedded Postgress in not installed');
        if (await this.status()) {
            if (autoStop) await this.stop();
            else throw new Error('Already started');
        }

        const args = ['-D', this.dataPath];

        logger.info(`starting postgres using '${this.dataPath} ' for data`);
        logger.debug(`calling '${this.postgresPath} ${args.join(' ')}'`);

        const process = child_process.spawn(this.postgresPath, args, { shell: false });

        function breakLog(data: string): { logLevel: string, message: string }[] {
            const regex = /^.* (?<logLevel>[A-Z]*): {2}(?<message>.*)$/gm;

            let m: RegExpExecArray | null;

            const output: { logLevel: string, message: string }[] = [];

            while ((m = regex.exec(data)) !== null) {
                if (m.index === regex.lastIndex) regex.lastIndex++;
                if (m.groups) output.push({ logLevel: m.groups.logLevel, message: m.groups.message });
            }
            return output;
        }

        this.process = process;

        let promiseSolved = false;

        const childLogger = logger.getChildLogger({ name: 'postgres-output' });

        return new Promise<void>((resolve, reject) => {
            function handleOutput(data: Buffer | null): void {
                if (data == null) return;
                try {
                    const logs = breakLog(data.toString());

                    if (!promiseSolved) {
                        const foundFatal = logs.find(log => log.logLevel == 'FATAL');
                        if (foundFatal) {
                            promiseSolved = true;
                            reject(new Error(`embedded postgress failed with '${foundFatal.message}'`));
                        }
                        const foundReady = logs.find(log => log.message.includes('database system is ready to accept connections'));
                        if (foundReady) {
                            promiseSolved = true;
                            resolve();
                        }
                    }

                    for (const log of logs) {
                        // eslint-disable-next-line @typescript-eslint/ban-types
                        const logLevelMaps: { [k: string]: Function } = {
                            'LOG': childLogger.info,
                            'HINT': childLogger.info,
                            'WARNING': childLogger.warn,
                            'FATAL': childLogger.fatal
                        };
                        logLevelMaps[log.logLevel].apply(childLogger, [log.message]);
                    }
                } catch (ex) {
                    logger.error(ex);
                }
            }
            process.stdout.on('data', handleOutput);
            process.stderr.on('data', handleOutput);

        });
    }

    /**
     * Stops the embedded PostgreSQL process.
     *
     * Under the hood it calls postgres' [pg_ctrl](https://www.postgresql.org/docs/current/app-pg-ctl.html) stop executable.
     */
    public async stop(): Promise<void> {
        if (!await this.isInstalled()) throw new Error('Embedded Postgress in not installed');
        if (!await this.status()) throw new Error('Cannot stop because it is not running');
        if (this.process == null) throw new Error('Cannot stop because it was not created by me');

        const args = ['-D', this.dataPath, 'stop'];

        logger.info(`stopping postgres using '${this.dataPath}' for data`);
        logger.debug(`calling '${this.pgCTLPath} ${args.join(' ')}'`);

        child_process.spawnSync(this.pgCTLPath, args, { shell: false });

        this.process.stdout.removeAllListeners();
        this.process.stderr.removeAllListeners();
        this.process.stdin.removeAllListeners();
        this.process.removeAllListeners();
    }

    /**
     * Gets the running status of the embedded PostgreSQL process.
     * 
     * Under the hood it calls postgres' [pg_ctrl](https://www.postgresql.org/docs/current/app-pg-ctl.html).
     * @returns `true` if it's running, otherwise `false`.
     */
    public async status(): Promise<boolean> {
        if (!await this.isInstalled()) throw new Error('Embedded Postgress in not installed');
        const args = ['-D', this.dataPath, 'status'];

        logger.info(`getting status of postgres using '${this.dataPath}' for data`);
        logger.debug(`calling '${this.pgCTLPath} ${args.join(' ')}'`);
        const result = child_process.spawnSync(this.pgCTLPath, args, { shell: false });

        return result.status == 0;
    }

    /**
     * Updates the `postgresql.conf` of the data path.
     * @param config Object with the configuration entries to be updated.     
     */
    public async updateConfig(config: PostgresConfig): Promise<void> {
        let newPostgresqlConf = await fsExtra.readFile(this.configPath, 'utf-8');

        for (const key in config) {
            const regex = new RegExp(`^(?:#?)(${key}) ?= ?([a-zA-Z0-9!"#$%&'()*+,.\\/:;<=>?@\\[\\] ^_]*)(\\W.*)`, 'gm');
            const subst = `$1 = ${config[key]} $3`;

            newPostgresqlConf = newPostgresqlConf.replace(regex, subst);
        }

        logger.info(`writing config to '${this.configPath}'`);
        logger.debug(`writing config to '${this.configPath}'`, config);

        return fsExtra.writeFileSync(this.configPath, newPostgresqlConf);
    }
}