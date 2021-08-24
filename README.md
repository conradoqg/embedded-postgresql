## (WIP) embedded-postgresql

> A npm package that helps installing and managing an embedded PostgreSQL.

### Features

- 📦 Install and uninstall;
- 🔄 Initialize, start, stop and get status;
- ✍️ Update `postgresql.conf`;
- 📘 [Documented](https://conradoqg.github.io/embedded-postgresql/);
- 🧪 [Tested](https://conradoqg.github.io/embedded-postgresql/coverage/lcov-report/);
- 🖥️ Supports Linux, Windows and MacOS;

### Install

```bash
npm install --save embedded-postgresql
```

### Quick start

Installing an embedded PostgreSQL:
```typescript
import { checkInstallation, install, uninstall } from 'embedded-postgresql';

async function main() {
    await install('13.2.0');
}
main();
```

Update config, start and stop the embedded PostgreSQL:
```typescript
import EmbeddedPostgreSQL from 'embedded-postgresql';

async function main() {
    const embeddedPostgreSQL = new EmbeddedPostgreSQL(testDataPath);

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

For more examples check the [tests](./test).

### Contributing

Make sure that you:

1. Added tests to your change;
2. Ran `npm run contribution:check`;