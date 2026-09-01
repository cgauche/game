// SONDE (lecture seule) — vers QUEL `node_modules` se résolvent les runners depuis chaque worktree.
// Un worktree sans `node_modules` propre laisse la résolution ascendante de Node remonter jusqu'à
// l'arbre PRINCIPAL : `vitest`/`vite`/`typescript`/`tsx` y sont alors ceux d'un AUTRE arbre.
// Mesuré par `createRequire` ancré dans chaque worktree — la même mécanique que Node à l'import.
// « node_modules VIDE » se mesure au RÉSULTAT, jamais au cardinal du dossier : un worktree peut
// porter un `node_modules` d'une ou deux entrées (restes de cache) sans une seule dépendance.
// COMPTEUR : worktrees à `node_modules` vide dont les runners FUIENT vers un autre arbre ; puis
// ceux dont aucune résolution n'aboutit ; puis leur total.
// Usage : node scripts/ops/sondes/audit-2026-09-01/probe-resolve.mjs
import { existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { RACINE } from './_socle.mjs';

const PAQUETS = ['vitest', 'vite', 'typescript', 'tsx', '@vitejs/plugin-react'];

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

let fuyants = 0;
let sansResolution = 0;
for (const root of racines()) {
  const nm = path.join(root, 'node_modules');
  const compte = existsSync(nm) ? readdirSync(nm).length : -1;
  console.log(`root = ${root}   node_modules : ${compte < 0 ? 'ABSENT' : `${compte} entrées`}`);
  const req = createRequire(path.join(root, 'sonde.cjs'));
  let fuite = false;
  let introuvable = false;
  for (const pkg of PAQUETS) {
    let r;
    try {
      r = req.resolve(`${pkg}/package.json`);
    } catch {
      try {
        r = req.resolve(pkg);
      } catch (e) {
        r = `INTROUVABLE: ${e.code}`;
      }
    }
    let chez = '  [propre]';
    if (r.startsWith('INTROUVABLE')) {
      chez = '';
      introuvable = true;
    } else if (!r.replace(/\\/g, '/').startsWith(`${root}/`)) {
      chez = '  *** AUTRE ARBRE ***';
      fuite = true;
    }
    console.log(`    ${pkg.padEnd(22)} -> ${r}${chez}`);
  }
  if (fuite) fuyants++;
  else if (introuvable) sansResolution++;
  console.log('');
}
console.log('worktrees à node_modules vide dont les runners fuient vers un autre arbre :', fuyants);
console.log('worktrees à node_modules vide sans aucune résolution :', sansResolution);
console.log('worktrees à node_modules vide :', fuyants + sansResolution);
