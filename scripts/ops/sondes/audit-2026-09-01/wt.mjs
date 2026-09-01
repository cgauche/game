// SONDE (lecture seule) — parc de worktrees : pour chaque worktree déclaré à git, sa branche, son
// état MERGED/UNMERGED dans `main`, son nombre de fichiers WIP et son avance en commits sur `main` ;
// puis les dossiers de `.claude/worktrees/` ABSENTS de `git worktree list` (orphelins) et leur taille.
// Usage : node scripts/ops/sondes/audit-2026-09-01/wt.mjs
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { RACINE } from './_socle.mjs';

/** LANCE une commande git et REND sa sortie, ou `null` si elle échoue (worktree cassé, branche absente). */
const git = (args, cwd = RACINE) => {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1e9 });
  } catch {
    return null;
  }
};

const porcelain = git(['worktree', 'list', '--porcelain']) ?? '';
const worktrees = [];
let courant = null;
for (const ligne of porcelain.split(/\r?\n/)) {
  if (ligne.startsWith('worktree ')) {
    courant = { chemin: ligne.slice(9).replace(/\\/g, '/'), branche: null, detache: false };
    worktrees.push(courant);
  } else if (courant && ligne.startsWith('branch ')) {
    courant.branche = ligne.slice(7).replace(/^refs\/heads\//, '');
  } else if (courant && ligne === 'detached') {
    courant.detache = true;
  }
}

const fusionnees = new Set(
  (git(['branch', '--merged', 'main', '--format=%(refname:short)']) ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean),
);

/** REND la taille cumulée d'un dossier, en octets. */
const octets = (dir) => {
  let total = 0;
  const pile = [dir];
  while (pile.length) {
    const d = pile.pop();
    let entrees;
    try {
      entrees = readdirSync(d, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entrees) {
      const p = join(d, e.name);
      if (e.isDirectory()) pile.push(p);
      else if (e.isFile()) {
        try {
          total += statSync(p).size;
        } catch {
          /* fichier disparu entre le listage et la mesure */
        }
      }
    }
  }
  return total;
};

const col = (v, n) => String(v).padEnd(n);
console.log(`WORKTREES DÉCLARÉS À GIT : ${worktrees.length}`);
console.log(col('branche', 44) + col('fusion', 10) + col('WIP', 6) + col('ahead', 7) + 'chemin');
const declares = new Set();
for (const w of worktrees) {
  declares.add(w.chemin);
  const branche = w.branche ?? (w.detache ? '(détachée)' : '(inconnue)');
  const fusion = w.branche ? (fusionnees.has(w.branche) ? 'MERGED' : 'UNMERGED') : '—';
  const wip = (git(['status', '--short'], w.chemin) ?? '').split(/\r?\n/).filter(Boolean).length;
  const ahead = w.branche ? (git(['rev-list', '--count', `main..${w.branche}`]) ?? '?').trim() : '—';
  console.log(col(branche, 44) + col(fusion, 10) + col(wip, 6) + col(ahead, 7) + w.chemin);
}

// le parc vit dans l'arbre PRINCIPAL (premier worktree listé), jamais dans le worktree courant
const principal = worktrees[0]?.chemin ?? RACINE;
const parc = join(principal, '.claude', 'worktrees');
const orphelins = existsSync(parc)
  ? readdirSync(parc, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => join(parc, e.name).replace(/\\/g, '/'))
      .filter((p) => !declares.has(p))
  : [];
console.log(`\nDOSSIERS DE .claude/worktrees/ ABSENTS DE git worktree list : ${orphelins.length}`);
let totalOrphelins = 0;
for (const p of orphelins) {
  const o = octets(p);
  totalOrphelins += o;
  console.log(col((o / 1e6).toFixed(1) + ' Mo', 12) + p);
}
console.log(`total orphelins : ${(totalOrphelins / 1e6).toFixed(1)} Mo`);
