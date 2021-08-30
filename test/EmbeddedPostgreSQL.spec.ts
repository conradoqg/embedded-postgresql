import logger from '../src/logger';
import EmbeddedPostgreSQL from '../src/EmbeddedPostgreSQL';
import { install } from '../src/installer';
import path from 'path';
import fsExtra from 'fs-extra';
import pg from 'pg';

const testInstallPath = path.join(__dirname, '..', 'postgresTestEmbeddedPostgreSQL');
const testDataPath = path.join(__dirname, '..', 'dataTestEmbeddedPostgreSQL');

if (process.env.NODE_ENV == 'development') {
    logger.setSettings({
        minLevel: 'debug',
        suppressStdOutput: false
    });
}

function getEmbeddedPostgresTestInstance(): EmbeddedPostgreSQL {
    const embeddedPostgreSQL = new EmbeddedPostgreSQL(testDataPath);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    embeddedPostgreSQL.installPath = testInstallPath;
    return embeddedPostgreSQL;
}

describe('EmbeddedPostgres', () => {
    beforeAll(async () => {
        await Promise.all([fsExtra.remove(testDataPath), fsExtra.remove(testInstallPath)]);
    });

    afterAll(async () => {
        await Promise.all([fsExtra.remove(testDataPath), fsExtra.remove(testInstallPath)]);
    });

    test('is expected to not initialize, start, stop or status because is not installed', async () => {
        const embeddedPostgreSQL = getEmbeddedPostgresTestInstance();

        expect(embeddedPostgreSQL.initialize(['-A', 'trust', '-U', 'postgres'])).rejects.toThrowError('Embedded Postgress in not installed');
        expect(embeddedPostgreSQL.start()).rejects.toThrowError('Embedded Postgress in not installed');
        expect(embeddedPostgreSQL.stop()).rejects.toThrowError('Embedded Postgress in not installed');
        expect(embeddedPostgreSQL.status()).rejects.toThrowError('Embedded Postgress in not installed');
    });

    test('install for the rest of tests', async () => {
        await install('13.2.0', testInstallPath);
    }, 1000 * 60 * 3);

    test('is expected to throw if it tries to delete a not initialized instance', async () => {
        const embeddedPostgreSQL = getEmbeddedPostgresTestInstance();
        await expect(embeddedPostgreSQL.delete()).rejects.toThrow('Embedded Postgress in not initialized');
    });

    test('is expected to initialize', async () => {
        const embeddedPostgreSQL = getEmbeddedPostgresTestInstance();
        await embeddedPostgreSQL.initialize(['-A', 'trust', '-U', 'postgres']);
        expect(await embeddedPostgreSQL.isInitialized()).toBeTruthy();
    }, 1000 * 60);

    test('is expected to not initialize if it is already initialized', async () => {
        const embeddedPostgreSQL = getEmbeddedPostgresTestInstance();
        await expect(embeddedPostgreSQL.initialize(['-A', 'trust', '-U', 'postgres'])).rejects.toThrow('Already initialized');
    }, 1000 * 60);

    test('is expected to start, get the correct status and stop', async () => {
        const embeddedPostgreSQL = getEmbeddedPostgresTestInstance();
        try {
            await embeddedPostgreSQL.start();
            expect(await embeddedPostgreSQL.status()).toBeTruthy();
        } finally {
            await embeddedPostgreSQL.stop();
        }
    });

    test('is expected to work with a test connection', async () => {
        const embeddedPostgreSQL = getEmbeddedPostgresTestInstance();
        try {
            await embeddedPostgreSQL.start();

            const client = new pg.Client({
                host: 'localhost',
                port: 5432,
                user: 'postgres',
                database: 'postgres'
            });
            await client.connect();
            const res = await client.query('SELECT $1::text as message', ['Hello world!']);
            expect(res.rows[0].message).toEqual('Hello world!');
            await client.end();

        } finally {
            await embeddedPostgreSQL.stop();
        }
    });

    test('is expected to start, get the correct status, start again and stop', async () => {
        const embeddedPostgreSQL = getEmbeddedPostgresTestInstance();
        try {
            await embeddedPostgreSQL.start();
            expect(await embeddedPostgreSQL.status()).toBeTruthy();
            await embeddedPostgreSQL.start();
            expect(await embeddedPostgreSQL.status()).toBeTruthy();
        } finally {
            await embeddedPostgreSQL.stop();
        }
    });

    test('is expected to start, get the correct status, and throw when started again', async () => {
        const embeddedPostgreSQL = getEmbeddedPostgresTestInstance();
        try {
            await embeddedPostgreSQL.start();
            expect(await embeddedPostgreSQL.status()).toBeTruthy();
            await expect(embeddedPostgreSQL.start(false)).rejects.toThrowError('Already started');
        } finally {
            await embeddedPostgreSQL.stop();
        }
    });

    test('is expected to throw when stopping a not started instance', async () => {
        const embeddedPostgreSQL = getEmbeddedPostgresTestInstance();

        await expect(embeddedPostgreSQL.stop()).rejects.toThrowError('Cannot stop because it is not running');
    });

    test('is expected to throw when stopping an instance not started by it', async () => {
        const embeddedPostgreSQL1 = getEmbeddedPostgresTestInstance();
        const embeddedPostgreSQL2 = getEmbeddedPostgresTestInstance();

        try {
            await embeddedPostgreSQL1.start();
            await expect(embeddedPostgreSQL2.stop()).rejects.toThrowError('Cannot stop because it was not created by me');
        } finally {
            await embeddedPostgreSQL1.stop();
        }
    });

    test('is expected to update the postgresql.conf', async () => {
        let writedPath = null;
        let writedValue = null;

        const spy = jest.spyOn(fsExtra, 'writeFileSync').mockImplementation((path, content) => (writedPath = path, writedValue = content));

        const embeddedPostgreSQL = getEmbeddedPostgresTestInstance();

        await embeddedPostgreSQL.updateConfig({
            listen_addresses: '\'localhosta\'', // By default it's commented and a string 'localhost'
            max_connections: 200,   // By default it's 100
            superuser_reserved_connections: 4 // By default it's commented and a number 3
        });

        expect(writedPath).toEqual(path.join(testDataPath, 'postgresql.conf'));
        expect(writedValue).toMatch(/^listen_addresses = 'localhosta'/gm);
        expect(writedValue).toMatch(/^max_connections = 200/gm);
        expect(writedValue).toMatch(/^superuser_reserved_connections = 4/gm);
        expect(spy).toHaveBeenCalledTimes(1);

        spy.mockRestore();
    });

    test('is expected to throw due incorrect configuration', async () => {

        const embeddedPostgreSQL = getEmbeddedPostgresTestInstance();

        await embeddedPostgreSQL.updateConfig({
            listen_addresses: '\'unknown\'',
        });

        try {
            await expect(embeddedPostgreSQL.start()).rejects.toThrow('embedded postgress failed with');
        } finally {
            await embeddedPostgreSQL.updateConfig({
                listen_addresses: '\'localhost\'',
            });
        }
    });

    test('is expected to delete data path', async () => {
        const embeddedPostgreSQL = getEmbeddedPostgresTestInstance();

        await embeddedPostgreSQL.delete();
        expect(await embeddedPostgreSQL.isInitialized()).toBeFalsy();
    });

    test('is expected to create an instance with an username and password and work with a test connection', async () => {
        const embeddedPostgreSQL = getEmbeddedPostgresTestInstance();

        try {
            const password = 'secretpassword';

            await fsExtra.writeFile('./password.txt', password);

            await embeddedPostgreSQL.initialize(['-U', 'postgres', '-A', 'md5', '--pwfile', './password.txt']);

            await fsExtra.remove('./password.txt');

            await embeddedPostgreSQL.start();

            const client = new pg.Client({
                host: 'localhost',
                port: 5432,
                user: 'postgres',
                password: password,
                database: 'postgres'
            });
            await client.connect();
            const res = await client.query('SELECT $1::text as message', ['Hello world!']);

            expect(res.rows[0].message).toEqual('Hello world!');

            await client.end();
        } finally {
            await embeddedPostgreSQL.stop();
        }
    }, 1000 * 60);
});
