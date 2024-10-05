import temp from 'temp';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import os from 'os';
import fsExtra from 'fs-extra';
import logger from './logger';
import { createReadStream } from 'fs';
import { createGunzip } from 'zlib';
import { extract } from 'tar';

temp.track();

const urlTemplate = (platform: string, arch: string, release: string | null, version: string): string => `https://github.com/theseus-rs/postgresql-binaries/releases/download/${version}/postgresql-${version}-${arch}-${platform}${release && '-'}${release ?? ''}.tar.gz`;
const tarGzFileTemplate = (platform: string, arch: string, version: string): string => `embedded-postgres-binaries-${platform}-${arch}-${version}.tar.gz`;

/**
 * The default path installation.
 */
export const defaultInstallPath = path.join(__dirname, '..', 'postgres');

interface EmbeddedPostgresPAR {
    platform: string,
    arch: string,
    release: string | null
}

/**
 * Installs an embedded PostgreSQL on the destination path.
 * 
 * The installer utilizes binaries distributed by the [postgresql-binaries](https://github.com/theseus-rs/postgresql-binaries) project and the available versions, platforms and archs can be see in this [list](https://github.com/theseus-rs/postgresql-binaries/releases).
 * 
 * @param version PostgreSQL version.
 * @param installPath Installation path. Defaults to `path.join(__dirname, '..', 'postgres')`
 * @returns The path of installation. 
 * @throws `Already installed`, if there is already an embedded PostgreSQL installed on the destination path.
 */
export async function install(version: string, installPath: string = defaultInstallPath): Promise<string> {

    if (await checkInstallation(installPath)) throw new Error('Already installed');

    logger.info('installing portable postgres');

    const temporaryDirPath = await temp.mkdir();

    await fsExtra.mkdirp(installPath);

    try {
        const detectedPar = detectPAR();

        const downloadedTarGzPath = await download(detectedPar, version, urlTemplate(detectedPar.platform, detectedPar.arch, detectedPar.release, version), temporaryDirPath);

        const extractedDirPath = await extractTgz(detectedPar, version, downloadedTarGzPath, installPath);

        await fsExtra.writeJSON(path.join(installPath, 'par.json'), { ...detectedPar, version });

        logger.info(`postgres installed on '${installPath}' with PAR: `, { ...detectedPar, version });

        return extractedDirPath;
    } catch (ex) {
        await fsExtra.remove(installPath);
        logger.error('installation aborted, removing installation path');
        throw ex;
    }
}

/**
 * Uninstalls an installed embedded PostgreSQL.
 * @param installPath Installation path. Defaults to `path.join(__dirname, '..', 'postgres')`
 * @returns 
 * @throws `Not installed`, if there is not an embedded PostgreSQL installed on the destination path.
 */
export async function uninstall(installPath: string = defaultInstallPath): Promise<void> {
    if (!await checkInstallation(installPath)) throw new Error('Not installed');

    return fsExtra.remove(installPath);
}

/**
 * Check if there is an installed embedded PostgreSQL on the specified path.
 * @param installPath Installation path. Defaults to `path.join(__dirname, '..', 'postgres')`
 * @returns `true`, if there is an installtion on the specified path, otherwise `false`.
 */
export async function checkInstallation(installPath: string = defaultInstallPath): Promise<boolean> {
    if (await fsExtra.pathExists(installPath)) {
        const installedPAR = await fsExtra.readJSON(path.join(installPath, 'par.json'));
        logger.info('installed postgres PAR: ', installedPAR);
        return true;
    }
    return false;
}

function detectPAR(): EmbeddedPostgresPAR {

    const availablePARs = [
        { arch: 'aarch64', platform: 'apple-darwin', release: null },
        { arch: 'aarch64', platform: 'unknown-linux', release: 'gnu' },
        { arch: 'aarch64', platform: 'unknown-linux', release: 'musl' },
        { arch: 'arm', platform: 'unknown-linux', release: 'gnueabi' },
        { arch: 'arm', platform: 'unknown-linux', release: 'gnueabihf' },
        { arch: 'arm', platform: 'unknown-linux', release: 'musleabi' },
        { arch: 'arm', platform: 'unknown-linux', release: 'musleabihf' },
        { arch: 'armv5te', platform: 'unknown-linux', release: 'gnueabi' },
        { arch: 'armv7', platform: 'unknown-linux', release: 'gnueabihf' },
        { arch: 'armv7', platform: 'unknown-linux', release: 'musleabihf' },
        { arch: 'i586', platform: 'unknown-linux', release: 'gnu' },
        { arch: 'i586', platform: 'unknown-linux', release: 'musl' },
        { arch: 'i686', platform: 'unknown-linux', release: 'gnu' },
        { arch: 'i686', platform: 'unknown-linux', release: 'musl' },
        { arch: 'mips64', platform: 'unknown-linux', release: 'gnuabi64' },
        { arch: 'powerpc64le', platform: 'unknown-linux', release: 'gnu' },
        { arch: 'powerpc64le', platform: 'unknown-linux', release: 'musl' },
        { arch: 's390x', platform: 'unknown-linux', release: 'gnu' },
        { arch: 's390x', platform: 'unknown-linux', release: 'musl' },
        { arch: 'x86_64', platform: 'apple-darwin', release: null },
        { arch: 'x86_64', platform: 'pc-windows', release: 'msvc' },
        { arch: 'x86_64', platform: 'unknown-linux', release: 'gnu' },
        { arch: 'x86_64', platform: 'unknown-linux', release: 'musl' },

    ];

    const nodeXEmbeddedPostgresPlatformMap = [
        { node: 'darwin', embeddedPostgres: 'apple-darwin' },
        { node: 'linux', embeddedPostgres: 'unknown-linux' },
        { node: 'win32', embeddedPostgres: 'pc-windows' }
    ];

    const nodeXEmbeddedPostgresArchMap = [
        { node: 'aarch64', embeddedPostgres: 'aarch64' },
        { node: 'arm', embeddedPostgres: 'arm' },
        { node: 'armv5te', embeddedPostgres: 'armv5te' },
        { node: 'armv7', embeddedPostgres: 'armv7' },
        { node: 'i586', embeddedPostgres: 'i586' },
        { node: 'i686', embeddedPostgres: 'i686' },
        { node: 'mips64', embeddedPostgres: 'mips64' },
        { node: 'powerpc64le', embeddedPostgres: 'powerpc64le' },
        { node: 's390x', embeddedPostgres: 's390x' },
        { node: 'x64', embeddedPostgres: 'x86_64' }
    ];


    const localPAR = {
        platform: os.platform(),
        arch: os.arch(),
        release: os.release(),
    };

    const foundEmbeddedPlatform = (nodeXEmbeddedPostgresPlatformMap.find(mapItem => mapItem.node == localPAR.platform));
    const foundEmbeddedArch = (nodeXEmbeddedPostgresArchMap.find(mapItem => mapItem.node == localPAR.arch));

    if (!foundEmbeddedPlatform) throw new Error(`There is not an embedded-postgres-binaries available for the '${localPAR.platform}' platform`);
    if (!foundEmbeddedArch) throw new Error(`There is not an embedded-postgres-binaries available for the '${localPAR.arch}' arch`);

    const candidatePAR = {
        plaform: foundEmbeddedPlatform.embeddedPostgres,
        arch: foundEmbeddedArch.embeddedPostgres,
        release: null
    };

    const foundAvailablePar = availablePARs.find(item => item.platform == candidatePAR.plaform && item.arch == candidatePAR.arch);

    if (!foundAvailablePar) throw new Error(`There is not an embedded-postgres-binaries avaliable for the combination of the '${candidatePAR.plaform}' platform, '${candidatePAR.arch}' arch, and '${candidatePAR.release}' release`);

    logger.debug('detected PAR:', foundAvailablePar);

    return foundAvailablePar;
}

async function download(par: EmbeddedPostgresPAR, version: string, downloadURL: string, destinationPath: string): Promise<string> {
    const temporaryFile = path.join(destinationPath, tarGzFileTemplate(par.platform, par.arch, version));

    logger.debug(`downloading portable postgres from '${downloadURL}' to '${temporaryFile}'`);
    const fetchResult = await fetch(downloadURL);

    return new Promise<string>((resolve, reject) => {
        const destWriter = fs.createWriteStream(temporaryFile);
        destWriter.on('close', () => {
            resolve(temporaryFile);
        });
        destWriter.on('error', (error) => {
            reject(error);
        });
        fetchResult.body.pipe(destWriter);
    });
}

async function extractTgz(par: EmbeddedPostgresPAR, version: string, tgzPath: string, destinationPath: string): Promise<string> {
    logger.debug(`extracting TGZ contents from '${tgzPath}' to '${destinationPath}'`);

    return new Promise((resolve, reject) => {
        createReadStream(tgzPath)
            .pipe(createGunzip())
            .pipe(extract({ cwd: destinationPath, strip: 1 }))
            .on('finish', () => resolve(destinationPath))
            .on('error', reject);
    });
}