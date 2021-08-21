import EmbeddedPostgres from './EmbeddedPostgres';
import path from 'path';
import fsExtra from 'fs-extra';

describe('test database control', () => {
    jest.setTimeout(1000000);

    beforeAll(async () => {
        return Promise.all([fsExtra.remove('data'), fsExtra.remove('postgres')]);
    });

    test('database complete cycle', async () => {
        const embeddedPostgres = new EmbeddedPostgres('13.2.0', path.join(__dirname, '..', 'data'));

        await embeddedPostgres.setup();

        expect(await embeddedPostgres.status()).toBeFalsy();

        await embeddedPostgres.start();

        expect(await embeddedPostgres.status()).toBeTruthy();

        await embeddedPostgres.stop();

        expect(await embeddedPostgres.status()).toBeFalsy();
    });

    test('database start an already started database', async () => {
        const embeddedPostgres = new EmbeddedPostgres('13.2.0', path.join(__dirname, '..', 'data'));

        await embeddedPostgres.setup();

        await embeddedPostgres.start();
        await embeddedPostgres.start();

        await embeddedPostgres.stop();
    });

    test('database cannot stop because its not running', async () => {
        const embeddedPostgres = new EmbeddedPostgres('13.2.0', path.join(__dirname, '..', 'data'));

        await embeddedPostgres.setup();

        await expect(embeddedPostgres.stop()).rejects.toThrow('Cannot stop because it is not running');
    });

    test('database should not start twice using the same data', async () => {
        const embeddedPostgres1 = new EmbeddedPostgres('13.2.0', path.join(__dirname, '..', 'data'));

        await embeddedPostgres1.setup();

        await embeddedPostgres1.start();

        const embeddedPostgres2 = new EmbeddedPostgres('13.2.0', path.join(__dirname, '..', 'data'));

        await embeddedPostgres2.setup();

        await expect(embeddedPostgres2.start()).rejects.toThrow('Cannot stop because it was not created by me');

        await embeddedPostgres1.stop();
    });

    test('database configuration should update with test conf', async () => {
        const dataPath = path.join(__dirname, '..', 'data');

        let writedPath = null;
        let writedValue = null;

        const spy = jest.spyOn(fsExtra, 'writeFileSync').mockImplementation((path, content) => (writedPath = path, writedValue = content));

        const embeddedPostgres1 = new EmbeddedPostgres('13.2.0', dataPath, {
            listen_addresses: '\'localhosta\'', // By default it's commented and a string 'localhost'
            max_connections: 200,   // By default it's 100
            superuser_reserved_connections: 4 // By default it's commented and a number 3
        });

        await embeddedPostgres1.setup();

        expect(writedPath).toEqual(path.join(dataPath, 'postgresql.conf'));
        expect(writedValue).toMatch(/^listen_addresses = 'localhosta'/gm);
        expect(writedValue).toMatch(/^max_connections = 200/gm);
        expect(writedValue).toMatch(/^superuser_reserved_connections = 4/gm);
        expect(spy).toHaveBeenCalledTimes(1);

        spy.mockRestore();
    });
});
