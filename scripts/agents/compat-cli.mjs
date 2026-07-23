import { readFile, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildExpectedOutputs, collectDiffs } from './compat-core.mjs';

async function snapshot(root) {
  const files = new Map();
  for (const rel of ['CLAUDE.md', 'AGENTS.md']) {
    const data = await readFile(join(root, rel)).catch(() => null);
    if (data) files.set(rel, data);
  }
  return files;
}

const sleep = (milliseconds) => new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));

export async function atomicWrite(root, rel, data, io = {}) {
  const operations = { mkdir, writeFile, rename, rm, randomUUID, sleep, ...io };
  const destination = join(root, rel);
  const temporary = `${destination}.agents-sync-${operations.randomUUID()}`;
  await operations.mkdir(dirname(destination), { recursive: true });
  await operations.writeFile(temporary, data);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await operations.rename(temporary, destination);
      return;
    } catch (error) {
      if (!['EPERM', 'EBUSY'].includes(error.code) || attempt === 2) {
        await operations.rm(temporary, { force: true });
        throw error;
      }
      await operations.sleep(10 * (attempt + 1));
    }
  }
}

export async function runCompat({ root, mode }, dependencies = {}) {
  if (!['sync', 'check'].includes(mode)) throw new Error(`mode invalide: ${mode}`);
  const takeSnapshot = dependencies.snapshot ?? snapshot;
  const writeAtomically = dependencies.atomicWrite ?? atomicWrite;
  const actual = await takeSnapshot(root);
  const expected = buildExpectedOutputs(actual);
  const diagnostics = collectDiffs(expected, actual);
  if (mode === 'sync') {
    const unsafe = diagnostics.filter((item) => item.safe === false || item.type.startsWith('unsafe-'));
    if (unsafe.length) return diagnostics;
    for (const item of diagnostics.filter((entry) => entry.safe)) {
      const data = expected.files.get(item.destination);
      if (data) await writeAtomically(root, item.destination, data);
    }
    const refreshed = await takeSnapshot(root);
    return collectDiffs(buildExpectedOutputs(refreshed), refreshed);
  }
  return diagnostics;
}

const invoked = resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url);
if (invoked) {
  const mode = process.argv[2];
  const root = resolve(process.argv[3] ?? join(dirname(fileURLToPath(import.meta.url)), '..', '..'));
  const diagnostics = await runCompat({ root, mode });
  if (diagnostics.length) {
    process.stderr.write(`${diagnostics.map((d) => `${d.family}:${d.type}:${d.destination}: ${d.message}`).join('\n')}\n`);
    process.exitCode = 1;
  }
}
