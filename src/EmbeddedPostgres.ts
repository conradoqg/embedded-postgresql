/* eslint-disable no-inner-declarations */
import { install, installPath } from './installer';
import fsExtra from 'fs-extra';
import path from 'path';
import child_process, { ChildProcessWithoutNullStreams } from 'child_process';
import logger from './logger';

export interface PostgresConfig {
    [k: string]: unknown
}

export default class EmbeddedPostgres {

    static async checkInstallation(): Promise<boolean> {
        if (await fsExtra.pathExists(installPath)) {
            const installedPAR = await fsExtra.readJSON(path.join(installPath, 'par.json'));
            logger.info('installed postgres PAR: ', installedPAR);
            return true;
        }
        return false;
    }

    static async ensureInstallation(version: string): Promise<void> {
        if (!await this.checkInstallation()) {
            await install(version);
        }
    }

    version: string;
    dataPath: string;
    postgresPath: string;
    pgCTLPath: string;
    initDBPath: string;
    configPath: string;
    process: ChildProcessWithoutNullStreams | null = null;
    config: PostgresConfig | null;

    constructor(version: string, dataPath: string, config: PostgresConfig | null = null) {
        const isWin = process.platform === 'win32';

        this.version = version;
        this.dataPath = dataPath;
        this.postgresPath = path.join(installPath, 'bin', 'postgres' + (isWin && '.exe'));
        this.pgCTLPath = path.join(installPath, 'bin', 'pg_ctl' + (isWin && '.exe'));
        this.initDBPath = path.join(installPath, 'bin', 'initdb' + (isWin && '.exe'));
        this.configPath = path.join(dataPath, 'postgresql.conf');
        this.config = config;

        logger.silly('instance config: ', this);
    }

    async setup(): Promise<void> {
        await EmbeddedPostgres.ensureInstallation(this.version);
        if (!await fsExtra.pathExists(this.dataPath))
            this.init();
        await this.updateConfig();
    }

    async init(): Promise<void> {
        const args = ['-A', 'trust', '-U', 'postgres', '-D', this.dataPath, '-E', 'UTF-8'];
        logger.info(`initing postgres using '${this.dataPath}' for data`);
        logger.debug(`calling '${this.initDBPath} ${args.join(' ')}'`);
        child_process.spawnSync(this.initDBPath, args, { shell: false });
    }

    async delete(): Promise<void> {
        logger.debug(`deleting database on '${this.dataPath}'`);
        await fsExtra.rmdir(this.dataPath);
    }

    async start(): Promise<void> {
        if (await this.status()) await this.stop();

        await this.updateConfig();

        const args = ['-D', this.dataPath];

        logger.info(`starting postgres using '${this.dataPath}' for data`);
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

    async stop(): Promise<void> {
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

    async status(): Promise<boolean> {
        const args = ['-D', this.dataPath, 'status'];

        logger.info(`getting status of postgres using '${this.dataPath}' for data`);
        logger.debug(`calling '${this.pgCTLPath} ${args.join(' ')}'`);
        const result = child_process.spawnSync(this.pgCTLPath, args, { shell: false });

        return result.status == 0;
    }

    private async updateConfig(): Promise<void> {
        if (this.config) {
            let newPostgresqlConf = await fsExtra.readFile(this.configPath, 'utf-8');

            for (const key in this.config) {
                const regex = new RegExp(`^(?:#?)(${key}) ?= ?([a-zA-Z0-9!"#$%&'()*+,.\\/:;<=>?@\\[\\] ^_]*)(\\W.*)`, 'gm');
                const subst = `$1 = ${this.config[key]} $3`;

                newPostgresqlConf = newPostgresqlConf.replace(regex, subst);
            }

            logger.info(`writing config to '${this.configPath}'`);
            logger.debug(`writing config to '${this.configPath}'`, this.config);

            return fsExtra.writeFileSync(this.configPath, newPostgresqlConf);
        }
    }
}