import temp from 'temp';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import unzipper from 'unzipper';
import decompress from 'decompress';
import os from 'os';
import fsExtra from 'fs-extra';
import decompressTarxz from 'decompress-tarxz';
import logger from './logger';

temp.track();

const urlTemplate = (platform: string, arch: string, version: string): string => `https://repo1.maven.org/maven2/io/zonky/test/postgres/embedded-postgres-binaries-${platform}-${arch}/${version}/embedded-postgres-binaries-${platform}-${arch}-${version}.jar`;
const jarFileTemplate = (platform: string, arch: string, version: string): string => `embedded-postgres-binaries-${platform}-${arch}-${version}.jar`;
const txzFileTemplate = (platform: string, arch: string, version: string): string => `embedded-postgres-binaries-${platform}-${arch}-${version}.txz`;

export const installPath = path.join(__dirname, '..', 'postgres');

// https://github.com/zonkyio/embedded-postgres-binaries#postgres-version
export async function install(version: string): Promise<string> {

    logger.info('installing portable postgres');

    const temporaryDirPath = await temp.mkdir();

    await fsExtra.mkdirp(installPath);

    const detectedPar = detectPAR();

    const downloadedJarPath = await download(detectedPar, version, urlTemplate(detectedPar.platform, detectedPar.arch, version), temporaryDirPath);

    const extractedTxzPath = await extractJar(detectedPar, version, downloadedJarPath, temporaryDirPath);

    const extractedDirPath = await extractTxz(detectedPar, version, extractedTxzPath, installPath);

    await fsExtra.writeJSON(path.join(installPath, 'par.json'), { ...detectedPar, version });

    logger.info(`postgres installed on '${installPath}' with PAR: `, { ...detectedPar, version });

    return extractedDirPath;
}

interface EmbeddedPostgresPAR {
    platform: string,
    arch: string,
    release: string | null
}

function detectPAR(): EmbeddedPostgresPAR {

    const availablePARs: EmbeddedPostgresPAR[] = [
        { platform: 'linux', arch: 'amd64', release: null, },
        { platform: 'linux', arch: 'amd64', release: 'alpine' },
        { platform: 'linux', arch: 'ppc64le', release: 'alpine-lite' },
        { platform: 'linux', arch: 'arm64v8', release: null },
        { platform: 'linux', arch: 'arm64v8', release: 'alpine' },
        { platform: 'linux', arch: 'ppc64le', release: null },
        { platform: 'linux', arch: 'arm64v8', release: 'alpine-lite' },
        { platform: 'linux', arch: 'arm32v6', release: null },
        { platform: 'linux', arch: 'i386', release: null },
        { platform: 'linux', arch: 'ppc64le', release: 'alpine' },
        { platform: 'linux', arch: 'i386', release: 'alpine-lite' },
        { platform: 'linux', arch: 'i386', release: 'alpine' },
        { platform: 'linux', arch: 'arm32v6', release: 'alpine' },
        { platform: 'linux', arch: 'arm32v6', release: 'alpine-lite' },
        { platform: 'linux', arch: 'arm32v7', release: null },
        { platform: 'linux', arch: 'amd64', release: 'alpine-lite' },
        { platform: 'windows', arch: 'i386', release: null },
        { platform: 'windows', arch: 'amd64', release: null },
        { platform: 'darwin', arch: 'amd64', release: null }
    ];

    const nodeXEmbeddedPostgresPlatformMap = [
        { node: 'darwin', embeddedPostgres: 'darwin' },
        { node: 'linux', embeddedPostgres: 'linux' },
        { node: 'win32', embeddedPostgres: 'windows' }
    ];

    const nodeXEmbeddedPostgresArchMap = [
        { node: 'arm', embeddedPostgres: 'arm32v6' },
        { node: 'arm64', embeddedPostgres: 'arm64v8' },
        { node: 'ppc64', embeddedPostgres: 'ppc64le' },
        { node: 'x32', embeddedPostgres: 'i386' },
        { node: 'x64', embeddedPostgres: 'amd64' }
    ];


    const localPAR = {
        platform: os.platform(),
        arch: os.arch(),
        release: os.release(),
    };

    const foundEmbeddedPlatform = (nodeXEmbeddedPostgresPlatformMap.find(mapItem => mapItem.node == localPAR.platform));
    const foundEmbeddedArch = (nodeXEmbeddedPostgresArchMap.find(mapItem => mapItem.node == localPAR.arch));

    if (!foundEmbeddedPlatform) throw new Error(`There is not an embedded-postgres available for the '${localPAR.platform}' platform`);
    if (!foundEmbeddedArch) throw new Error(`There is not an embedded-postgres available for the '${localPAR.arch}' arch`);

    const candidatePAR = {
        plaform: foundEmbeddedPlatform.embeddedPostgres,
        arch: foundEmbeddedArch.embeddedPostgres,
        release: null
    };

    const foundAvailablePar = availablePARs.find(item => item.platform == candidatePAR.plaform && item.arch == candidatePAR.arch && item.release == candidatePAR.release);

    if (!foundAvailablePar) throw new Error(`There is not an embedded-postgres avaliable for the combination of the '${candidatePAR.plaform}' platform, '${candidatePAR.arch}' arch, and '${candidatePAR.release}' release`);

    logger.debug('detected PAR:', foundAvailablePar);

    return foundAvailablePar;
}

async function download(par: EmbeddedPostgresPAR, version: string, downloadURL: string, destinationPath: string): Promise<string> {
    const temporaryFile = path.join(destinationPath, jarFileTemplate(par.platform, par.arch, version));

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

async function extractJar(par: EmbeddedPostgresPAR, version: string, jarPath: string, destinationPath: string): Promise<string> {
    const temporaryFile = path.join(destinationPath, txzFileTemplate(par.platform, par.arch, version));

    logger.debug(`extracting JAR contents from '${jarPath}' to '${temporaryFile}'`);

    return new Promise<string>((resolve, reject) => {
        const destWriter = fs.createWriteStream(temporaryFile);
        destWriter.on('close', () => {
            resolve(temporaryFile);
        });
        destWriter.on('error', (error) => {
            reject(error);
        });
        fs.createReadStream(jarPath)
            .pipe(unzipper.ParseOne(/postgres.*/i))
            .pipe(destWriter);
    });
}

async function extractTxz(par: EmbeddedPostgresPAR, version: string, txzPath: string, destinationPath: string): Promise<string> {

    logger.debug(`extracting TXZ contents from '${txzPath}' to '${destinationPath}'`);

    await decompress(txzPath, destinationPath, {
        plugins: [
            decompressTarxz()
        ]
    });

    return destinationPath;
}