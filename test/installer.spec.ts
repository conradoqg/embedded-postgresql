import { checkInstallation, install, uninstall } from '../src/installer';
import path from 'path';
import os from 'os';
import fsExtra from 'fs-extra';

const testInstallPath = path.join(__dirname, '..', 'postgresTestInstaller');

describe('installer', () => {
    beforeAll(async () => {
        await Promise.all([fsExtra.remove(testInstallPath)]);
    });

    afterAll(async () => {
        await Promise.all([fsExtra.remove(testInstallPath)]);
    });

    test('is expected to throw if the platform is not supported', async () => {
        const spy = jest.spyOn(os, 'platform').mockImplementation(() => 'haiku');
        await expect(install('13.2.0', testInstallPath)).rejects.toThrow('There is not an embedded-postgres-binaries available for');
        spy.mockRestore();
    });

    test('is expected to throw if the arch is not supported', async () => {
        const spy = jest.spyOn(os, 'arch').mockImplementation(() => 'unknown');
        await expect(install('13.2.0', testInstallPath)).rejects.toThrow('There is not an embedded-postgres-binaries available for');
        spy.mockRestore();
    });

    test('is expected to throw if the platform and arch combination is not supported', async () => {
        const platformSpy = jest.spyOn(os, 'platform').mockImplementation(() => 'darwin');
        const archSpy = jest.spyOn(os, 'arch').mockImplementation(() => 'x32');
        await expect(install('13.2.0', testInstallPath)).rejects.toThrow('There is not an embedded-postgres-binaries avaliable for the combination of');
        platformSpy.mockRestore();
        archSpy.mockRestore();
    });

    test('is expected to install the embedded postgres', async () => {
        await install('13.2.0', testInstallPath);
    }, 1000 * 60 * 3);

    test('is expected to throw if an installation already exists', async () => {
        await expect(install('13.2.0', testInstallPath)).rejects.toThrow('Already installed');
    });

    test('is expected to not uninstall if the installation path do not exist', async () => {
        await expect(uninstall(path.join(__dirname, '..', 'fake'))).rejects.toThrow('Not installed');
    });

    test('is expected to uninstall', async () => {
        await uninstall(testInstallPath);
        expect(await checkInstallation(testInstallPath)).toBeFalsy();
    });
});