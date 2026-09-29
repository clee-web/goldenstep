import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * A single JSON file with crash-safe writes and serialised mutations.
 *
 * Two properties matter here:
 *
 *  - **Atomic.** Write to a temp file then rename, so a process death mid-write
 *    leaves the previous good file intact rather than a truncated one.
 *  - **Serialised.** Every mutation runs behind one promise chain, so two
 *    concurrent requests cannot interleave a read-modify-write and silently
 *    drop one of the updates.
 */
export class JsonFile<T> {
  private readonly filePath: string;
  private readonly createDefault: () => T;
  /** Coerces unknown parsed JSON back into shape, dropping anything invalid. */
  private readonly revive: (raw: unknown) => T;
  private queue: Promise<unknown> = Promise.resolve();

  // Written as explicit fields rather than constructor parameter properties:
  // Node's type-stripping loader rejects `private readonly` parameters.
  constructor(
    filePath: string,
    createDefault: () => T,
    revive: (raw: unknown) => T,
  ) {
    this.filePath = filePath;
    this.createDefault = createDefault;
    this.revive = revive;
  }

  get path(): string {
    return this.filePath;
  }

  async read(): Promise<T> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      return this.revive(JSON.parse(raw));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return this.createDefault();
      if (error instanceof SyntaxError) {
        // A hand-edited or truncated file should not take the site down; fall
        // back to defaults rather than 500 on every request.
        console.warn(`[golden-steps] ${path.basename(this.filePath)} is not valid JSON, using defaults`);
        return this.createDefault();
      }
      throw error;
    }
  }

  private async persist(value: T): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await rename(tmp, this.filePath);
  }

  /**
   * Applies `mutate` to the current value and persists the result. Reads and
   * writes are queued together, so callers never observe a stale value.
   */
  async update<R>(mutate: (current: T) => R | Promise<R>): Promise<R> {
    const task = this.queue.then(async () => {
      const current = await this.read();
      const result = await mutate(current);
      await this.persist(current);
      return result;
    });

    this.queue = task.catch(() => undefined);
    return task;
  }
}
