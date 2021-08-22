## (WIP) embedded-postgresql

> A npm package that helps installing and managing a standalone PostgreSQL.

### Features

- Start, stop and get status;
- Initialize;
- Update `postgresql.conf`;
- [Documented](./docs/index.html);
- [Tested](./src/);

### Install

```bash
npm install --save embedded-postgresql
```

### Examples

Installing an embedded PostgreSQL:
```typescript
import { checkInstallation, install, uninstall } from 'embedded-postgresql';

async function main() {
    await install('13.2.0');
}
```

Update config, start and stop the embedded PostgreSQL:
```typescript
import EmbeddedPostgreSQL from 'embedded-postgresql';

const embeddedPostgreSQL = new EmbeddedPostgreSQL(testDataPath);

await embeddedPostgreSQL.initialize();

await embeddedPostgreSQL.updateConfig({
    wal_level: 'minimal',
    max_worker_processes: 1,
    max_parallel_workers: 1
});

await embeddedPostgreSQL.start();

await embeddedPostgreSQL.stop();
```

For more examples check the [specs](./src) source-code.

### Documentation

[API Reference](https://rawgit.com/conradoqg/embedded-postgresql/master/docs/index.html).

### Contributing

### License