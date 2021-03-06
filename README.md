## (WIP) embedded-postgresql

> A npm package that helps installing and managing an embedded PostgreSQL.

### Features

- ๐ฆ Install and uninstall;
- ๐ Initialize, start, stop and get status;
- โ๏ธ Update `postgresql.conf`;
- ๐ [Documented](https://conradoqg.github.io/embedded-postgresql/);
- ๐งช [Tested](https://conradoqg.github.io/embedded-postgresql/coverage/lcov-report/);
- ๐ฅ๏ธ Supports Linux, Windows and MacOS (thanks to [embedded-postgres-binaries](https://github.com/zonkyio/embedded-postgres-binaries));

### Install

```bash
npm install --save embedded-postgresql
```

### Quick start

Installing an embedded PostgreSQL:
```typescript
import { checkInstallation, install, uninstall } from 'embedded-postgresql';

async function main() {
    if (!await checkInstallation())
        await install('13.2.0');
}
main();
```

Creating an instance with user `postgres`, update its configuration, start and stop:
```typescript
import { EmbeddedPostgreSQL } from 'embedded-postgresql';

async function main() {
    const embeddedPostgreSQL = new EmbeddedPostgreSQL(testDataPath);

    if (!await embeddedPostgreSQL.isInitialized())
        await embeddedPostgreSQL.initialize();

    await embeddedPostgreSQL.updateConfig({
        wal_level: 'minimal',
        max_worker_processes: 1,
        max_parallel_workers: 1
    });

    await embeddedPostgreSQL.start();

    await embeddedPostgreSQL.stop();
}
main();
```

Creating an instance with user `postgres`, password from a file, and connect to it using [`node-postgres`](https://node-postgres.com/):
```typescript
import { EmbeddedPostgreSQL } from 'embedded-postgresql';
import pg from 'pg'; // install it with npm install pg

async function main() {
    const password = 'secretpassword';

    await fsExtra.writeFile('./password.txt', password);
    
    if (!await embeddedPostgreSQL.isInitialized())
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
    
    await client.end();
}
main();
```

Enabling log:
```typescript
import { EmbeddedPostgreSQL, logger } from 'embedded-postgresql';

if (process.env.NODE_ENV == 'development') {
    logger.setSettings({
        minLevel: 'debug',
        suppressStdOutput: false
    });
}

async function main() {
    const embeddedPostgreSQL = new EmbeddedPostgreSQL(testDataPath);

    await embeddedPostgreSQL.start();

    await embeddedPostgreSQL.stop();
}
main();
```

For more examples check the [tests](./test).

### Contributing

Make sure that you:

1. Created tests for your changes;
2. Run `npm run contribution:check` and all tasks passed;