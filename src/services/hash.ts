import { createHash } from 'crypto';
import { readFile } from 'node:fs/promises';

export async function hashFile(path: string): Promise<string> {
  const buffer = await readFile(path);
  const hash = createHash('sha256');
  hash.update(buffer);
  return hash.digest('hex');
}

export function hashBuffer(buffer: Buffer): string {
  const hash = createHash('sha256');
  hash.update(buffer);
  return hash.digest('hex');
}
