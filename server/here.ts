import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * This file's own directory, resolved in a way that works on Node 18.
 *
 * `import.meta.dirname` is the direct way to ask this, but it only exists from
 * Node 20.11. Shared hosting frequently pins an older runtime, and the compiled
 * server has to start wherever the host puts it — a line that throws
 * `TypeError: The "path" argument must be of type string` on an otherwise
 * healthy install is exactly the kind of failure that wastes an afternoon.
 */
export const here = path.dirname(fileURLToPath(import.meta.url));
