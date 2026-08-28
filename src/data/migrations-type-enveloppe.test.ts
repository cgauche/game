/**
 * LES MIGRATIONS DÉJÀ JOUÉES ET RETOUCHÉES, REJOUÉES SUR UN ARBRE JETABLE (#1467 L1b V-FLIP-ENTITE).
 *
 * `2026-08-28-l1b-6a` a renommé `type`→`polarite` (qualities), `6c` `type`→`nature`
 * (characteristics), `6b` `type`→`acces` (skills), `6d` `type`→`categorie` (trappings) et `6e`
 * `type`→`ecole` (spells). L'adoption de `document()` a ensuite posé une clé d'ENVELOPPE `type` — le
 * NOM DU DOCUMENT — sur ces mêmes entrées, que ces scripts lisaient comme l'ancien scalaire
 * ressuscité (« arbitrage requis » sur toutes les entrées, rejeu ROUGE). Ils distinguent désormais
 * les deux par `typeAncien()` — 6a/6c à la vague 11b, 6b à la vague 12a, 6d/6e à la vague 12b.
 * CINQ scripts sont donc tenus ici ; ajouter une retouche sans ajouter son cas laisserait le geste le
 * plus risqué du lot sans témoin. Ce fichier tient la famille `type`→<clé métier> sur `src/data` ; la
 * famille « bump de FORME » du document de projet (`src/scenes/<c>/<c>-projet.json`) est tenue par sa
 * sœur `src/scenes/migrations-format-projet.test.ts`, même doctrine, `Cas` incompatible (ni `type`,
 * ni cardinal, ni la même indentation de sérialiseur).
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
  /**
   * Fichier ANNEXE que le script lit AUSSI et dont il exige le cardinal (`6d` : `merchantFamilies`,
   * 7 entrées, où il renomme `match.trappingType`→`match.categorie`). Il est écrit À SON ÉTAT DÉJÀ
   * MIGRÉ : les quatre cas ci-dessous portent sur le fichier PRINCIPAL, l'annexe ne doit jamais être
   * ce qui fait rougir — sans quoi le cas C mesurerait la mauvaise cause.
   */
  readonly annexe?: { readonly fichier: string; readonly contenu: readonly Record<string, unknown>[] };
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
  {
    script: '2026-08-28-l1b-6b-skills-acces.mjs',
    fichier: 'skills.json',
    typeEnveloppe: 'skills',
    cleNeuve: 'acces',
    cardinal: 48,
    // La graphie accentuée `avancée` que 6b NORMALISE est absente d'ici à dessein : le cas A compare
    // la valeur rendue à la valeur d'entrée, il ne mesurerait pas le renommage mais la normalisation
    // (couverte, elle, par la preuve post-écriture du script lui-même).
    valeurs: ['base', 'avancee'],
  },
  {
    script: '2026-08-28-l1b-6d-trappings-categorie.mjs',
    fichier: 'trappings.json',
    typeEnveloppe: 'trappings',
    cleNeuve: 'categorie',
    cardinal: 440,
    valeurs: ['melee', 'ranged', 'ammunition', 'armor', 'trapping'],
    annexe: {
      fichier: 'merchantFamilies.json',
      contenu: Array.from({ length: 7 }, (_, i) => ({ id: `f-${i}`, match: { categorie: 'trapping' } })),
    },
  },
  {
    script: '2026-08-28-l1b-6e-spells-ecole.mjs',
    fichier: 'spells.json',
    typeEnveloppe: 'spells',
    cleNeuve: 'ecole',
    cardinal: 576,
    // `6e` n'a PAS de vocabulaire fermé (l'école est un libellé hérité, 18 valeurs) : il exige une
    // chaîne NON VIDE. Le cas C ci-dessous en tient compte — cf. `collisionne`.
    valeurs: ['Magie mineure', 'Magie Mineure', 'Petite Magie'],
  },
];

/**
 * Ce qu'une valeur de `type` doit valoir pour que le script REFUSE de trancher. Deux régimes réels :
 * un vocabulaire FERMÉ (6a/6b/6c/6d) où toute valeur étrangère mord, et 6e qui n'exige qu'une chaîne
 * NON VIDE — sa seule valeur refusable est donc `''`. Sans cette distinction, le cas C serait VERT
 * sur 6e en croyant tester un fail-fast.
 */
const collisionne = (cas: Cas): string => (cas.script.includes('-6e-') ? '' : 'valeur-inconnue');

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
  if (cas.annexe) writeFileSync(join(dir, 'src', 'data', cas.annexe.fichier), canonique(cas.annexe.contenu), 'utf8');
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
    entrees[0] = { id: 'e-0', type: collisionne(cas), label: 'E0' };
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

/**
 * FIDÉLITÉ DE LA VAGUE 12b — la migration `type` n'ajoute QUE `type`, sur les 1730 entrées des 12
 * derniers datasets `entite`, et retire la SEULE `desc: ""` qu'elle DÉCLARE (`species › humains-tileens`).
 *
 * La migration porte déjà cette preuve en post-écriture, mais elle ne la porte QUE le jour où elle
 * écrit : rejouée sur l'état final, elle sort en no-op sans rien comparer. Ce test-ci la tient au
 * PRÉSENT, sur l'arbre committé — un `type` retiré, une charge utile modifiée ou une purge non
 * déclarée le fait rougir, sans dépendre d'un rejeu.
 */
describe('vague 12b — la donnée porte son `type` et RIEN d’autre n’a bougé', () => {
  /** `<fichier>` → `type`, recopié de la table `TYPES` de la migration. */
  const TYPES_12B: Readonly<Record<string, string>> = {
    'actions.json': 'actions',
    'activities.json': 'activities',
    'creatures.json': 'creatures',
    'night-stakes.json': 'night-stakes',
    'psychology.json': 'psychology',
    'raceAppearance.json': 'raceAppearance',
    'roofMaterials.json': 'roofMaterials',
    'species.json': 'species',
    'spells.json': 'spells',
    'structureAppearance.json': 'structureAppearance',
    'tavernGames.json': 'tavernGames',
    'trappings.json': 'trappings',
  };
  const TOTAL_ATTENDU = 1730;

  const lu = (f: string) => JSON.parse(readFileSync(join(RACINE, 'src', 'data', f), 'utf8')) as Record<string, unknown>[];

  it('les 12 datasets totalisent 1730 entrées, `type` en 2ᵉ position et ACCORDÉ à son document', () => {
    const fautes: string[] = [];
    let total = 0;
    for (const [f, type] of Object.entries(TYPES_12B)) {
      const data = lu(f);
      total += data.length;
      for (const e of data) {
        const cles = Object.keys(e);
        if (cles[0] !== 'id' || cles[1] !== 'type') fautes.push(`${f} ${String(e.id)} : tête ${cles.slice(0, 2).join(',')} ≠ id,type`);
        if (e.type !== type) fautes.push(`${f} ${String(e.id)} : type ${JSON.stringify(e.type)} ≠ ${JSON.stringify(type)}`);
      }
    }
    expect(fautes, `entrée(s) hors contrat :\n${fautes.slice(0, 10).join('\n')}`).toEqual([]);
    expect(total).toBe(TOTAL_ATTENDU);
  });

  it('AUCUNE `desc` vide ne subsiste, et `species › humains-tileens` n’en porte plus du tout', () => {
    const vides: string[] = [];
    for (const f of Object.keys(TYPES_12B)) {
      for (const e of lu(f)) if (e.desc === '') vides.push(`${f} ${String(e.id)}`);
    }
    expect(vides, 'la chaîne vide est un TROISIÈME état — absente plutôt que vide').toEqual([]);
    const tileens = lu('species.json').find((e) => e.id === 'humains-tileens');
    expect(tileens, '`humains-tileens` a disparu de species.json').toBeDefined();
    expect('desc' in tileens!, 'la purge DÉCLARÉE de la vague 12b retire la clé, elle ne la vide pas').toBe(false);
  });

  it('`creatures › group` est MORT de la donnée, et `title` y SURVIT (53 porteurs réels, #1541)', () => {
    const creatures = lu('creatures.json');
    expect(creatures.filter((e) => 'group' in e), '`group` est soldé : 0 porteur, 0 consommateur').toEqual([]);
    // Le contre-témoin : la même vague qui tue `group` ne touche PAS `title`, dont 53 entrées portent
    // un qualificatif de statbloc recopié du livre (règle 5 — on ne détruit pas de la donnée sourcée).
    const porteurs = creatures.filter((e) => 'title' in e);
    expect(porteurs.length, '`title` est REQUIS (nullable ≠ optional) : toutes les entrées le portent').toBe(creatures.length);
    expect(porteurs.filter((e) => e.title !== null).length).toBe(53);
  });
});
