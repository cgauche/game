// Une migration DATÉE jouée dans un DÉPÔT JETABLE : elle y est COPIÉE, puis lancée dans son propre
// processus. Une migration lit sa racine depuis `import.meta.url` — c'est l'emplacement de la copie
// qui la fait travailler sur le dépôt jetable, jamais sur l'arbre réel.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const MIGRATIONS = fileURLToPath(new URL('../', import.meta.url));

/** La migration jouée dans le dépôt jetable `racine`, copiée s'il ne la porte pas déjà.
 *  REND `{ code, stdout, stderr, sortie }` — `sortie` : les deux flux mis bout à bout. */
export function joue(racine, migration) {
  const cible = path.join(racine, 'scripts/migrations', migration);
  if (!fs.existsSync(cible)) {
    fs.mkdirSync(path.dirname(cible), { recursive: true });
    fs.copyFileSync(path.join(MIGRATIONS, migration), cible);
  }
  const r = spawnSync(process.execPath, [cible], { encoding: 'utf8' });
  const stdout = r.stdout ?? '';
  const stderr = r.stderr ?? '';
  return { code: r.status, stdout, stderr, sortie: `${stdout}${stderr}` };
}
