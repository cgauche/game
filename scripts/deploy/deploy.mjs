/**
 * Déploiement du jeu vers la PROD (GitHub Pages : cgauche/cgauche.github.io).
 * Le jeu est buildé (Vite, base relative './') puis copié dans
 *   <PhpstormProjects>/cgauche.github.io/jeu/   →  https://cgauche.github.io/jeu/
 *
 * Usage :
 *   node scripts/deploy/deploy.mjs            # build (Vite) + copie
 *   node scripts/deploy/deploy.mjs --no-build # copie le dist/ existant seulement
 *   node scripts/deploy/deploy.mjs --push     # + git add/commit/push le repo prod
 *   node scripts/deploy/deploy.mjs --allow-dirty # ignore l'arbre sale (WIP assumé, #299)
 *
 * Prérequis : le repo prod doit être un sibling de Foundry
 *   (PhpstormProjects/cgauche.github.io) avec un remote en écriture.
 *
 * `deploy.mjs` lit le WORKING TREE (pas Git) — le build embarque tout fichier présent sur
 * disque, y compris le WIP non commité d'une autre session (piège documenté CLAUDE.md). Par
 * défaut : arbre sale → ÉCHEC avec la liste des fichiers ; `--allow-dirty` passe outre.
 */
import { execSync } from 'node:child_process';
import { cpSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative, sep } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const gameRoot = resolve(here, '..', '..');                         // Foundry/Game
const prodRepo = resolve(gameRoot, '..', '..', 'cgauche.github.io'); // PhpstormProjects/cgauche.github.io
const SUBDIR = 'jeu';
const target = join(prodRepo, SUBDIR);
const dist = join(gameRoot, 'dist');
const args = process.argv.slice(2);

/** Liste les fichiers sales (modifiés/untracked/staged) de `gameRoot` — `git status --porcelain`. */
export function dirtyFiles(cwd) {
  const out = execSync('git status --porcelain', { cwd, encoding: 'utf8' });
  return out.split('\n').filter((l) => l.trim().length > 0);
}

if (!existsSync(prodRepo)) {
  console.error(`✗ Repo prod introuvable : ${prodRepo}`);
  process.exit(1);
}

if (!args.includes('--allow-dirty')) {
  const dirty = dirtyFiles(gameRoot);
  if (dirty.length) {
    console.error(`✗ Arbre de travail sale (${dirty.length} fichier(s)) — deploy.mjs publie le WORKING TREE, pas Git :`);
    for (const l of dirty) console.error(`  ${l}`);
    console.error('  → commit/stash ces fichiers, ou relance avec --allow-dirty si c\'est assumé.');
    process.exit(1);
  }
}

if (!args.includes('--no-build')) {
  console.log('▶ npm run build …');
  execSync('npm run build', { cwd: gameRoot, stdio: 'inherit' });
}
if (!existsSync(dist)) {
  console.error('✗ dist/ absent — lance le build (sans --no-build).');
  process.exit(1);
}

console.log(`▶ Copie dist/ → ${target} (hors qc/ : scratch QC non publié)`);
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
// Exclut le dossier qc/ (planches de rendu QC, non destinées à la prod). rmSync ci-dessus
// purge l'ancien jeu/qc/ déjà publié ; le filtre l'empêche de revenir.
const isQc = (src) => {
  const rel = relative(dist, src);
  return rel === 'qc' || rel.startsWith('qc' + sep);
};
cpSync(dist, target, { recursive: true, filter: (src) => !isQc(src) });
console.log(`✓ Copié dans ${target}`);

if (args.includes('--push')) {
  console.log('▶ Publication (git) du repo prod …');
  execSync(`git add "${SUBDIR}"`, { cwd: prodRepo, stdio: 'inherit' });
  try {
    execSync(`git commit -m "deploy: jeu WFRP (build ${new Date().toISOString().slice(0, 16)})"`, { cwd: prodRepo, stdio: 'inherit' });
    execSync('git push', { cwd: prodRepo, stdio: 'inherit' });
    console.log('✓ Poussé en prod.');
  } catch {
    console.log('· Rien à committer (ou push à faire à la main).');
  }
}

console.log('\n  🌐 URL : https://cgauche.github.io/jeu/');
if (!args.includes('--push')) {
  console.log('  Pour publier : node scripts/deploy/deploy.mjs --no-build --push');
}
