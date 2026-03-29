import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env from repo root even if `node server/index.js` is run from another cwd
const serverDir = dirname(fileURLToPath(import.meta.url));
config({ path: join(serverDir, '..', '.env') });
