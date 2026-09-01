// SONDE (lecture seule) — FUITE de `setupFiles` entre worktrees. Rejoue l'ordre d'essai de vitest
// 2.1.9 (chunk `resolveConfig`) pour `setupFiles: ['./src/test-setup.ts']` (`vite.config.ts:65`) :
// la base est `new URL(pathToFileURL(root))` SANS slash final, donc `new URL('./src/…', base)`
// efface le DERNIER segment du chemin — un worktree posé D'UN NIVEAU sous la racine principale
// résout son setup sur l'arbre PRINCIPAL. Les worktrees plus profonds (`.claude/worktrees/x`)
// manquent au premier essai et retombent sur la base à slash, donc sur leur propre arbre.
// COMPTEUR : nombre de worktrees dont le premier essai GAGNANT n'est pas leur propre `src/test-setup.ts`.
// Usage : node scripts/ops/sondes/audit-2026-09-01/probe-url-base.mjs
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { RACINE } from './_socle.mjs';

const SETUP = './src/test-setup.ts';

/** REND les racines de TOUS les worktrees déclarés à git (la principale en tête). */
function racines() {
  let porcelain;
  try {
    porcelain = execFileSync('git', ['worktree', 'list', '--porcelain'], { cwd: RACINE, encoding: 'utf8', maxBuffer: 1e9 });
  } catch {
    return [RACINE];
  }
  return porcelain
    .split(/\r?\n/)
    .filter((l) => l.startsWith('worktree '))
    .map((l) => l.slice(9).replace(/\\/g, '/'))
    .filter((p) => existsSync(p));
}

let fuites = 0;
for (const root of racines()) {
  // Les quatre urls d'essai, dans l'ordre de vitest.
  const base = new URL(pathToFileURL(root).toString());
  const urls = [base, new URL('./', base), new URL(`${base.pathname}/_index.js`, base), new URL('node_modules', base)];
  let gagnant = null;
  const essais = [];
  for (const u of urls) {
    const cible = fileURLToPath(new URL(SETUP, u));
    const hit = existsSync(cible);
    essais.push(`${hit ? 'HIT  ' : 'miss '}${cible}`);
    if (!gagnant && hit) gagnant = cible;
  }
  const attendu = fileURLToPath(pathToFileURL(`${root}/${SETUP.slice(2)}`));
  const fuit = gagnant !== attendu;
  if (fuit) fuites++;
  console.log('root =', root);
  for (const e of essais) console.log('   ', e);
  console.log('    => RETENU :', gagnant ?? '(aucun -> repli resolve(root, path))');
  console.log('    => ATTENDU:', attendu);
  console.log('    => VERDICT:', fuit ? '*** FUITE HORS WORKTREE ***' : 'OK');
  console.log('');
}
console.log("worktrees d'un niveau à setup fuyant :", fuites);
