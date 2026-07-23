import { readdir, readFile, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildExpectedOutputs, collectDiffs } from './compat-core.mjs';

async function snapshot(root) {
  const files = new Map();
  async function visit(rel) {
    const abs = join(root, rel);
    for (const entry of await readdir(abs, { withFileTypes: true }).catch(() => [])) {
      const child = join(rel, entry.name);
      if (entry.isDirectory()) await visit(child);
      else files.set(child.replaceAll('\\', '/'), await readFile(join(root, child)));
    }
  }
  for (const rel of ['CLAUDE.md', 'AGENTS.md']) {
    const data = await readFile(join(root, rel)).catch(() => null);
    if (data) files.set(rel, data);
  }
  return files;
}

async function atomicWrite(root, rel, data) {
  const destination = join(root, rel);
  const temporary = `${destination}.agents-sync-${process.pid}`;
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(temporary, data);
  await rename(temporary, destination).catch(async (error) => {
    await rm(temporary, { force: true });
    throw error;
  });
}

export async function runCompat({ root, mode }) {
  if (!['sync', 'check'].includes(mode)) throw new Error(`mode invalide: ${mode}`);
  const actual = await snapshot(root);
  const expected = buildExpectedOutputs(actual);
  const diagnostics = collectDiffs(expected, actual);
  if (mode === 'sync') {
    const unsafe = diagnostics.filter((item) => item.safe === false || item.type.startsWith('unsafe-'));
    if (unsafe.length) return diagnostics;
    for (const item of diagnostics.filter((entry) => entry.safe)) {
      const data = expected.files.get(item.destination);
      if (data) await atomicWrite(root, item.destination, data);
    }
    return collectDiffs(expected, await snapshot(root));
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
