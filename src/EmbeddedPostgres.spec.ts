import EmbeddedPostgres from './EmbeddedPostgres';
import { install } from './installer';
import path from 'path';
import fsExtra from 'fs-extra';

const testInstallPath = path.join(__dirname, '..', 'postgresTest');
const testDataPath = path.join(__dirname, '..', 'dataTest');

function getEmbeddedPostgresTestInstance(): EmbeddedPostgres {
    const embeddedPostgres = new EmbeddedPostgres(testDataPath);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    embeddedPostgres.installPath = testInstallPath;
    return embeddedPostgres;
}

describe('EmbeddedPostgres', () => {
    beforeAll(async () => {
        await Promise.all([fsExtra.remove(testDataPath), fsExtra.remove(testInstallPath)]);
    });

    afterAll(async () => {
        await Promise.all([fsExtra.remove(testDataPath), fsExtra.remove(testInstallPath)]);
    });

    test('is expected to not initialize, start, stop or status because is not installed', async () => {
        const embeddedPostgres = getEmbeddedPostgresTestInstance();

        expect(embeddedPostgres.initialize()).rejects.toThrowError('Embedded Postgress in not installed');
        expect(embeddedPostgres.start()).rejects.toThrowError('Embedded Postgress in not installed');
        expect(embeddedPostgres.stop()).rejects.toThrowError('Embedded Postgress in not installed');
        expect(embeddedPostgres.status()).rejects.toThrowError('Embedded Postgress in not installed');
    });

    test('install for the rest of tests', async () => {
        await install('13.2.0', testInstallPath);
    }, 1000 * 60 * 3);

    test('is expected to throw if it tries to delete a not initialized instance', async () => {
        const embeddedPostgres = getEmbeddedPostgresTestInstance();
        await expect(embeddedPostgres.delete()).rejects.toThrow('Embedded Postgress in not initialized');
    });

    test('is expected to initialize', async () => {
        const embeddedPostgres = getEmbeddedPostgresTestInstance();
        await embeddedPostgres.initialize();
        expect(await embeddedPostgres.isInitialized()).toBeTruthy();
    }, 1000 * 60);

    test('is expected to not initialize if it is already initialized', async () => {
        const embeddedPostgres = getEmbeddedPostgresTestInstance();
        await expect(embeddedPostgres.initialize()).rejects.toThrow('Already initialized');
    }, 1000 * 60);

    test('is expected to start, get the correct status and stop', async () => {
        const embeddedPostgres = getEmbeddedPostgresTestInstance();
        try {
            await embeddedPostgres.start();
            expect(await embeddedPostgres.status()).toBeTruthy();
        } finally {
            await embeddedPostgres.stop();
        }
    });

    test('is expected to start, get the correct status, start again and stop', async () => {
        const embeddedPostgres = getEmbeddedPostgresTestInstance();
        try {
            await embeddedPostgres.start();
            expect(await embeddedPostgres.status()).toBeTruthy();
            await embeddedPostgres.start();
            expect(await embeddedPostgres.status()).toBeTruthy();
        } finally {
            await embeddedPostgres.stop();
        }
    });

    test('is expected to start, get the correct status, and throw when started again', async () => {
        const embeddedPostgres = getEmbeddedPostgresTestInstance();
        try {
            await embeddedPostgres.start();
            expect(await embeddedPostgres.status()).toBeTruthy();
            await expect(embeddedPostgres.start(false)).rejects.toThrowError('Already started');
        } finally {
            await embeddedPostgres.stop();
        }
    });

    test('is expected to throw when stopping a not started instance', async () => {
        const embeddedPostgres = getEmbeddedPostgresTestInstance();

        await expect(embeddedPostgres.stop()).rejects.toThrowError('Cannot stop because it is not running');
    });

    test('is expected to throw when stopping an instance not started by it', async () => {
        const embeddedPostgres1 = getEmbeddedPostgresTestInstance();
        const embeddedPostgres2 = getEmbeddedPostgresTestInstance();

        try {
            await embeddedPostgres1.start();
            await expect(embeddedPostgres2.stop()).rejects.toThrowError('Cannot stop because it was not created by me');
        } finally {
            await embeddedPostgres1.stop();
        }
    });

    test('is expected to update the postgresql.conf', async () => {
        let writedPath = null;
        let writedValue = null;

        const spy = jest.spyOn(fsExtra, 'writeFileSync').mockImplementation((path, content) => (writedPath = path, writedValue = content));

        const embeddedPostgres = getEmbeddedPostgresTestInstance();

        await embeddedPostgres.updateConfig({
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

        const embeddedPostgres = getEmbeddedPostgresTestInstance();

        await embeddedPostgres.updateConfig({
            listen_addresses: '\'unknown\'',
        });

        try {
            await expect(embeddedPostgres.start()).rejects.toThrow('embedded postgress failed with');
        } finally {
            await embeddedPostgres.updateConfig({
                listen_addresses: '\'localhost\'',
            });
        }
    });

    test('is expected to delete data path', async () => {
        const embeddedPostgres = getEmbeddedPostgresTestInstance();

        await embeddedPostgres.delete();
        expect(await embeddedPostgres.isInitialized()).toBeFalsy();
    });
});
