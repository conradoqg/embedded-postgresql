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
    listen_addresses: '\'127.0.0.1\'', // By default it's commented and a string 'localhost'
    max_connections: 200,   // By default it's 100
    superuser_reserved_connections: 4 // By default it's commented and a number 3
});

await embeddedPostgreSQL.start();

await embeddedPostgreSQL.stop();
```

For more examples check the [specs](./src) source-code.

### Documentation

[API Reference](./docs/index.html).

### Contributing

### License