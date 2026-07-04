// Installe la bibliothèque de skills du projet : copie docs/skills/ → .claude/skills/
// (source canonique versionnée → emplacement local découvert par le harnais, gitignoré).
// Idempotent : re-lancer après tout pull qui touche docs/skills/.
//   node scripts/skills/install.mjs
import { cpSync, rmSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = join(root, 'docs', 'skills');
const dst = join(root, '.claude', 'skills');

if (!existsSync(src)) {
  console.error(`Introuvable : ${src}`);
  process.exit(1);
}

const entries = readdirSync(src, { withFileTypes: true }).filter(e => e.isDirectory());
mkdirSync(dst, { recursive: true });
for (const e of entries) {
  const target = join(dst, e.name);
  rmSync(target, { recursive: true, force: true });
  cpSync(join(src, e.name), target, { recursive: true });
}
console.log(`${entries.length} skills installées : docs/skills/ → .claude/skills/`);
console.log(entries.map(e => `  - ${e.name}`).join('\n'));
