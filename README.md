## (WIP) embedded-postgresql

> A npm package that helps installing and managing an embedded PostgreSQL.

### Features

- 📦 Install and uninstall;
- 🔄 Initialize, start, stop and get status;
- ✍️ Update `postgresql.conf`;
- 📘 [Documented](https://conradoqg.github.io/embedded-postgresql/);
- 🧪 [Tested](https://conradoqg.github.io/embedded-postgresql/coverage/lcov-report/);
- 🖥️ Supports Linux, Windows and MacOS (thanks to [postgresql-binaries](https://github.com/theseus-rs/postgresql-binaries));

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
        await install('17.0.0');
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