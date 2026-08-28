/**
 * LES DEUX MIGRATIONS DÉJÀ JOUÉES, REJOUÉES SUR UN ARBRE JETABLE (#1467 L1b V-FLIP-ENTITE-b).
 *
 * `2026-08-28-l1b-6a` a renommé `type`→`polarite` (qualities) et `6c` `type`→`nature`
 * (characteristics). L'adoption de `document()` a ensuite posé une clé d'ENVELOPPE `type` — le NOM DU
 * DOCUMENT — sur ces mêmes entrées, que les deux scripts lisaient comme l'ancien scalaire ressuscité
 * (59 + 19 « arbitrage requis », rejeu ROUGE). Ils distinguent désormais les deux par `typeAncien()`.
 *
 * RETOUCHER UN SCRIPT DÉJÀ JOUÉ est le geste le plus risqué du lot : ce test le tient. Il exécute les
 * VRAIS fichiers de `scripts/migrations/` — copiés dans un arbre temporaire pour que leur
 * `new URL('../../')` y résolve — sur des fixtures GELÉES ici (aucun `git show` : un test qui en
 * dépend casse en clone superficiel).
 *
 * Quatre cas par script :
 *  A. donnée HISTORIQUE, dont le `type` porte encore la valeur métier → migrée, valeur conservée ;
 *  B. donnée ACTUELLE (`type` d'enveloppe + clé neuve) → NO-OP, fichier byte-identique ;
 *  C. COLLISION forcée : un `type` hors vocabulaire, que rien ne permet de trancher → fail-fast
 *     BRUYANT, exit 1, rien d'écrit ;
 *  D. ARBITRAGE « porte À LA FOIS » : `type` métier ET clé neuve sur la même entrée → mord toujours.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));

interface Cas {
  readonly script: string;
  readonly fichier: string;
  /** Nom du document posé par `document()` — le `type` d'ENVELOPPE. */
  readonly typeEnveloppe: string;
  /** Clé NEUVE que la migration a introduite (`polarite`/`nature`). */
  readonly cleNeuve: string;
  /** Cardinal EXIGÉ par le script (constante `ATTENDU`). */
  readonly cardinal: number;
  /** Valeurs historiques du scalaire `type`, cyclées pour peupler la fixture. */
  readonly valeurs: readonly string[];
}

const CAS: readonly Cas[] = [
  {
    script: '2026-08-28-l1b-6a-qualities-polarite.mjs',
    fichier: 'qualities.json',
    typeEnveloppe: 'qualities',
    cleNeuve: 'polarite',
    cardinal: 59,
    valeurs: ['atout', 'defaut'],
  },
  {
    script: '2026-08-28-l1b-6c-characteristics-nature.mjs',
    fichier: 'characteristics.json',
    typeEnveloppe: 'characteristics',
    cleNeuve: 'nature',
    cardinal: 19,
    valeurs: ['roll', 'wounds', 'extra', 'mv', 'points', 'compteur'],
  },
];

/** Écrit `data` à la forme CANONIQUE que les deux scripts exigent avant de lire. */
const canonique = (data: unknown) => JSON.stringify(data, null, 2);

/** Arbre jetable : `<tmp>/scripts/migrations/<script>` + `<tmp>/src/data/<fichier>`. */
function arbre(cas: Cas, entrees: Record<string, unknown>[]): { dir: string; cible: string; script: string } {
  const dir = mkdtempSync(join(tmpdir(), 'mig-11b-'));
  mkdirSync(join(dir, 'scripts', 'migrations'), { recursive: true });
  mkdirSync(join(dir, 'src', 'data'), { recursive: true });
  const script = join(dir, 'scripts', 'migrations', cas.script);
  copyFileSync(join(RACINE, 'scripts', 'migrations', cas.script), script);
  const cible = join(dir, 'src', 'data', cas.fichier);
  writeFileSync(cible, canonique(entrees), 'utf8');
  return { dir, cible, script };
}

/** Joue le script ; rend le code de sortie et le contenu du fichier APRÈS. */
function joue(cas: Cas, entrees: Record<string, unknown>[]): { code: number; apres: string; avant: string } {
  const { dir, cible, script } = arbre(cas, entrees);
  const avant = readFileSync(cible, 'utf8');
  let code = 0;
  try {
    execFileSync(process.execPath, [script], { encoding: 'utf8', stdio: 'pipe' });
  } catch (e) {
    code = (e as { status?: number }).status ?? 1;
  }
  const apres = readFileSync(cible, 'utf8');
  rmSync(dirname(dirname(dirname(cible))), { recursive: true, force: true });
  void dir;
  return { code, apres, avant };
}

/** Fixture HISTORIQUE : l'ancien scalaire `type`, aucune clé neuve, aucune enveloppe. */
const historique = (cas: Cas) =>
  Array.from({ length: cas.cardinal }, (_, i) => ({ id: `e-${i}`, type: cas.valeurs[i % cas.valeurs.length], label: `E${i}` }));

/** Fixture ACTUELLE : l'enveloppe `type` + la clé neuve — l'état de l'arbre après 11b. */
const actuelle = (cas: Cas) =>
  Array.from({ length: cas.cardinal }, (_, i) => ({
    id: `e-${i}`,
    type: cas.typeEnveloppe,
    label: `E${i}`,
    [cas.cleNeuve]: cas.valeurs[i % cas.valeurs.length],
  }));

describe.each(CAS)('migration $script — retouchée pour le `type` d’ENVELOPPE', (cas) => {
  it('A. donnée HISTORIQUE : le renommage joue, et la valeur est CONSERVÉE entrée par entrée', () => {
    const entrees = historique(cas);
    const { code, apres } = joue(cas, entrees);
    expect(code, 'la migration doit réussir sur la donnée historique').toBe(0);
    const attendu = entrees.map((e) => ({ id: e.id, [cas.cleNeuve]: e.type, label: e.label }));
    expect(apres).toBe(canonique(attendu));
  });

  it('B. donnée ACTUELLE (`type` d’enveloppe + clé neuve) : NO-OP, fichier byte-identique', () => {
    const { code, apres, avant } = joue(cas, actuelle(cas));
    expect(code, 'l’état actuel de l’arbre doit être reconnu « déjà migré »').toBe(0);
    expect(apres).toBe(avant);
  });

  it('C. COLLISION : une entrée dont le `type` n’est NI l’enveloppe NI une valeur connue → fail-fast, rien d’écrit', () => {
    const entrees = historique(cas);
    entrees[0] = { id: 'e-0', type: 'valeur-inconnue', label: 'E0' };
    const { code, apres, avant } = joue(cas, entrees);
    expect(code, 'une valeur hors vocabulaire doit ARRÊTER la migration').toBe(1);
    expect(apres, 'aucune écriture avant arbitrage').toBe(avant);
  });

  it('D. ARBITRAGE : ancien `type` ET clé neuve sur la même entrée → mord toujours, rien d’écrit', () => {
    const entrees = historique(cas);
    entrees[0] = { id: 'e-0', type: cas.valeurs[0], label: 'E0', [cas.cleNeuve]: cas.valeurs[0] };
    const { code, apres, avant } = joue(cas, entrees);
    expect(code, 'la double graphie reste un arbitrage, jamais un choix silencieux').toBe(1);
    expect(apres, 'aucune écriture avant arbitrage').toBe(avant);
  });
});
