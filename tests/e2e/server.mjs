import { rmSync } from 'node:fs';
import { createApp } from '../../apps/api/dist/app.js';

const dbPath = '/tmp/linkvault-e2e.db';
for (const suffix of ['', '-wal', '-shm']) rmSync(dbPath + suffix, { force: true });

const app = await createApp({ dbPath, serveWeb: true });
await app.listen({ host: '127.0.0.1', port: 4417 });
console.log('e2e server ready on http://127.0.0.1:4417');
