import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFieldConsumersMd } from '../../scripts/docs/build-field-consumers.mjs';
import { TARGETS, fieldsOf } from '../../scripts/guards/lib/fieldConsumerTargets.mjs';
import { listProdFiles, scanFieldReads, fieldOwnership, groupByField } from '../../scripts/guards/lib/fieldConsumers.mjs';
import { virtualProgram, VIRTUAL_ROOT } from '../../scripts/guards/lib/tsProgram.mjs';
import { retirerPied } from '../../scripts/docs/lib/empreinte-sources.mjs';

/**
 * Garde du rapport « consommateurs par champ » (#903 — `scripts/docs/build-field-consumers.mts`,
 * `docs/consommateurs-de-champs.md`), en cinq blocs : la fraîcheur du doc généré ; le cas FONDATEUR
 * (`TrappingRef.spec`, #903) en CONTRAT POSITIF `fichier:ligne` sur le dépôt RÉEL ; le CONTRAT
 * POSITIF des champs dont le détecteur au `TypeChecker` (#1620) a recouvré les lecteurs, chacun
 * nommé avec son site ; le CLIQUET NOMINATIF des « 0 lecteur », liste écrite champ par champ et
 * comparée à l'identique (un zéro apparu comme un zéro disparu est rouge, et une ligne ne se retire
 * qu'avec le lecteur qui l'annule) ; et la MORSURE du détecteur sur des fixtures en mémoire
 * (dernier `describe`), où chaque verdict REFUSÉ est asserté autant que chaque verdict accordé.
 */
const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Le rapport, régénéré EN PROCESSUS et mémoïsé : un SEUL scan du corpus nourrit les deux
 *  assertions — fraîcheur du `.md` et cas fondateur. Il coûte ~17 s et ~1,3 Go (Program du dépôt,
 *  1 952 fichiers) : d'où le timeout explicite posé sur le `it` qui le paie. PARESSEUX : payé au
 *  1ᵉʳ `it` qui le demande, jamais à la collecte de vitest. */
let _rapport: ReturnType<typeof buildFieldConsumersMd> | null = null;
const rapport = () => (_rapport ??= buildFieldConsumersMd());

/**
 * L'ÉCART entre le rapport régénéré et le fichier committé, en une phrase — vide = à jour. Quatre
 * cas NOMMÉS, mordus ci-dessous sur des textes forgés : fichier ABSENT ; première ligne qui DIVERGE
 * (cherchée sur le PRÉFIXE COMMUN seul — un `findIndex` sur tout le régénéré rendrait « committé :
 * undefined » dès qu'un texte est plus court que l'autre) ; et, quand un texte est le préfixe de
 * l'autre, la première ligne en SURPLUS avec son côté.
 */
export function ecartDoc(regenere: string, committe: string | null): string {
  if (committe === null) return 'docs/consommateurs-de-champs.md est ABSENT du dépôt';
  const attendues = regenere.split('\n');
  const lues = committe.split('\n');
  const commun = Math.min(attendues.length, lues.length);
  for (let k = 0; k < commun; k++) {
    if (attendues[k] !== lues[k]) {
      return `ligne ${k + 1} — committé : ${JSON.stringify(lues[k])} / régénéré : ${JSON.stringify(attendues[k])}`;
    }
  }
  if (attendues.length === lues.length) return '';
  return attendues.length > lues.length
    ? `ligne ${lues.length + 1} MANQUE au committé : ${JSON.stringify(attendues[lues.length])}`
    : `ligne ${attendues.length + 1} EN TROP au committé : ${JSON.stringify(lues[attendues.length])}`;
}

/**
 * APERÇU des divergences, borné : jusqu'à `max` lignes qui diffèrent, chacune des DEUX côtés et
 * tronquée à `LARGEUR` — le rapport porte des paragraphes de plusieurs milliers de caractères, et un
 * message d'échec illisible ne nomme rien. Une ligne présente d'un seul côté se dit `<absente>`.
 */
const LARGEUR = 240;
const borne = (s: string | undefined) =>
  s === undefined ? '<absente>' : JSON.stringify(s.length > LARGEUR ? `${s.slice(0, LARGEUR)}…` : s);

export function apercuEcart(regenere: string, committe: string | null, max = 10): string {
  if (committe === null) return '';
  const attendues = regenere.split('\n');
  const lues = committe.split('\n');
  const total = Math.max(attendues.length, lues.length);
  const blocs: string[] = [];
  let restantes = 0;
  for (let k = 0; k < total; k++) {
    if (attendues[k] === lues[k]) continue;
    if (blocs.length >= max) {
      restantes++;
      continue;
    }
    blocs.push(`l.${k + 1}\n  committé : ${borne(lues[k])}\n  régénéré : ${borne(attendues[k])}`);
  }
  if (restantes > 0) blocs.push(`… et ${restantes} autre(s) ligne(s) divergente(s)`);
  return blocs.join('\n');
}

describe('docs/consommateurs-de-champs.md — le rapport GÉNÉRÉ est à jour', () => {
  it('régénéré en mémoire == committé (sinon : npm run docs:field-consumers)', () => {
    const chemin = join(ROOT, 'docs/consommateurs-de-champs.md');
    // Le pied « sources-empreinte » est posé APRÈS coup par build-all.mjs (#1679 L1b) : la fraîcheur
    // se juge sur le CORPS, que le générateur est seul à produire.
    const committe = existsSync(chemin) ? retirerPied(readFileSync(chemin, 'utf8')) : null;
    const ecart = ecartDoc(rapport().md, committe);
    // Un rouge doit NOMMER sa cause : le rapporteur tronque la chaîne comparée par un `toBe`, donc
    // le MESSAGE porte lui-même la première divergence et l'aperçu borné des suivantes — constat CI
    // du 2026-09-01 (run 33523707492), où le rouge ne désigne aucune ligne.
    if (ecart !== '') {
      expect.fail(
        'docs/consommateurs-de-champs.md est PÉRIMÉ/ABSENT (les schémas/le code source ont changé)\n' +
          '  → régénérer via `npm run docs:field-consumers` et committer le résultat.\n' +
          `${ecart}\n${apercuEcart(rapport().md, committe)}`,
      );
    }
    // 150 s : le corps est SYNCHRONE (vitest ne pourrait pas l'interrompre — il PASSERAIT sous le
    // `testTimeout` global de 15 s de `vite.config.ts` sans rien dire), et il paie le Program du
    // dépôt : 15,8 à 26,8 s mesurées le 2026-09-01. Marge ≥ 5× la plus lente — le runner CI Linux
    // est plus lent que cette machine. Le chiffre se RÉVISE quand la mesure bouge.
  }, 150_000);
});

describe('MORSURE du diagnostic de fraîcheur — chaque écart se dit en clair', () => {
  const A = 'a\nb\nc';
  it('fichier ABSENT', () => {
    expect(ecartDoc(A, null)).toBe('docs/consommateurs-de-champs.md est ABSENT du dépôt');
  });
  it('textes IDENTIQUES : aucun écart', () => {
    expect(ecartDoc(A, A)).toBe('');
  });
  it('ligne qui DIVERGE : la première, des deux côtés', () => {
    expect(ecartDoc(A, 'a\nX\nc')).toBe('ligne 2 — committé : "X" / régénéré : "b"');
  });
  it('committé PRÉFIXE du régénéré : la première ligne MANQUANTE, jamais « undefined »', () => {
    expect(ecartDoc(A, 'a\nb')).toBe('ligne 3 MANQUE au committé : "c"');
  });
  it('régénéré PRÉFIXE du committé : la première ligne EN TROP, jamais « ligne 0 »', () => {
    expect(ecartDoc('a\nb', A)).toBe('ligne 3 EN TROP au committé : "c"');
  });

  it('APERÇU : les DEUX côtés de chaque ligne divergente, les manquantes dites, le reste compté', () => {
    expect(apercuEcart('a\nb\nc', 'a\nX\nY')).toBe('l.2\n  committé : "X"\n  régénéré : "b"\nl.3\n  committé : "Y"\n  régénéré : "c"');
    expect(apercuEcart('a\nb', 'a')).toBe('l.2\n  committé : <absente>\n  régénéré : "b"');
    expect(apercuEcart('x\nx\nx', 'y\ny\ny', 2)).toBe(
      'l.1\n  committé : "y"\n  régénéré : "x"\nl.2\n  committé : "y"\n  régénéré : "x"\n… et 1 autre(s) ligne(s) divergente(s)',
    );
    expect(apercuEcart(`${'z'.repeat(300)}`, 'a')).toContain(`${'z'.repeat(240)}…`);
    expect(apercuEcart('a', 'a')).toBe('');
  });
});

/**
 * CONTRAT POSITIF sur le PÉRIMÈTRE lui-même. `fieldsOf` rend `[]` — sans lever — pour un nœud qui
 * n'expose ni `.shape` ni `.options` : un export de schéma renommé/supprimé laisse la cible pointer
 * `undefined`, le rapport perd le type EN SILENCE et le test de fraîcheur reste VERT (le doc régénéré
 * et le doc committé s'accordent sur la même table vide). Mesuré le 2026-08-31 sur `AdvancementRef`,
 * dont la cible visait un `advancementRefSchema` disparu au profit d'`avancement(type)`.
 */
describe('périmètre de TARGETS — aucune cible ne rend zéro champ', () => {
  it('chaque cible expose au moins un champ (une cible muette = un type perdu du rapport)', () => {
    const cibles = TARGETS as readonly { schema?: unknown; cles?: readonly string[]; type: string }[];
    const muettes = cibles.filter((t) => fieldsOf(t.schema ?? t.cles).length === 0).map((t) => t.type);
    expect(
      muettes,
      'cible(s) sans champ : le schéma visé a disparu/changé de forme, ou le nœud est scellé (fournir `cles:`)',
    ).toEqual([]);
  });

  it('la garde n’est pas vacante — une cible au schéma disparu est DÉTECTÉE (contre-épreuve)', () => {
    expect(fieldsOf(undefined)).toEqual([]);
  });
});

describe('cas fondateur #903 — qui lit TrappingRef.spec ?', () => {
  /**
   * `TrappingRef.spec` a DEUX lecteurs directs, un par ROLE : `resolveOne`
   * (`src/engine/trappingChoices.ts`) qui reconduit la spec en résolvant un emplacement `{choice}`/
   * `qualityChoice`, et `itemFromTrappingRef` (`src/engine/items.ts`) qui la MATÉRIALISE sur
   * l'`ItemInstance` — sans quoi la spécialisation se perd entre la dotation et le sac (#1463
   * L-ref-1). Le RENDU, lui, n'en est pas un : « base (spec) » passe par `refConcrete`
   * (`src/data/index.ts`), SOURCE UNIQUE partagée par toute `Ref` dont le paramètre est un `Ref` —
   * un lecteur mesuré dans `data/index.ts` signalerait une SECONDE définition du rendu, et c'est ce
   * que cette garde refuse. La preuve d'AFFICHAGE vit sur la donnée réelle
   * (`src/data/dotations-catalogue.test.ts`, `src/engine/integration-creation.test.ts`).
   */
  it('`TrappingRef.spec` : DEUX lecteurs, résolution et matérialisation — aucun dans le rendu', () => {
    const target = TARGETS.find((t) => t.type === 'TrappingRef');
    expect(target, 'TrappingRef absent de TARGETS — le cas fondateur a perdu sa surface').toBeTruthy();
    const byField = rapport().byType.get('TrappingRef');
    expect(byField, 'TrappingRef absent du rapport mesuré').toBeTruthy();
    // `fichier:LIGNE` : le fichier seul resterait vert si le lecteur déménageait dans une AUTRE
    // fonction du même module — ce que le rapport, lui, publie site par site.
    const specSites = [...new Set((byField!.get('spec') ?? []).map((h: { file: string; line: number }) => `${h.file}:${h.line}`))];
    const specReaders = [...new Set(specSites.map((s) => s.slice(0, s.lastIndexOf(':'))))];
    expect(
      specSites.sort(),
      'TrappingRef.spec devrait avoir EXACTEMENT 2 sites lecteurs : la résolution de choix et la matérialisation',
    ).toEqual(['src/engine/items.ts:309', 'src/engine/trappingChoices.ts:36']);
    expect(
      specReaders.some((s: string) => s.includes('data/index.ts')),
      'un lecteur de spec dans `data/index.ts` = une seconde définition du rendu « base (spec) », qui appartient à `refConcrete`',
    ).toBe(false);
    // Même Program du dépôt que la fraîcheur ci-dessus (mémoïsé) — mais ce `it` le paie SEUL si on
    // le lance à part (`-t`) : même mesure, donc même marge.
  }, 150_000);
});

/**
 * DÉTERMINISME du rapport à travers les MACHINES : il est committé depuis un poste Windows (NTFS,
 * `readdirSync` trie sans tenir compte de la casse) et rejoué par la CI sous Linux (ext4 rend l'ordre
 * d'un hash). Tout ce que le rapport publie doit donc naître d'un ORDRE TOTAL calculé, jamais de
 * l'ordre du système de fichiers : la liste des racines (`listProdFiles`) et les sites d'un champ
 * (`scanFieldReads`, triés par fichier puis ligne). Les deux `it` prennent les deux bouts : la
 * PROPRIÉTÉ (la liste est triée) et l'EFFET (le même `.md`, corpus à l'envers).
 */
describe('DÉTERMINISME cross-OS — le rapport ne dépend pas du système de fichiers', () => {
  const corpus = () => listProdFiles(join(ROOT, 'src')).map((p: string) => p.replace(/\\/g, '/'));

  it('`listProdFiles` rend un ORDRE TOTAL, chemins strictement croissants en unités de code', () => {
    const fichiers = corpus();
    expect(fichiers.length, 'corpus vide : la sonde ne mesurerait rien').toBeGreaterThan(1000);
    expect(
      fichiers.filter((p, i) => i > 0 && !(fichiers[i - 1] < p)),
      'chemins non strictement croissants — l’ordre du système de fichiers a fui dans la liste',
    ).toEqual([]);
  });

  it('le `.md` bâti sur le corpus en ordre INVERSÉ est BYTE-IDENTIQUE', () => {
    const inverse = [...listProdFiles(join(ROOT, 'src'))].reverse();
    const ecart = ecartDoc(buildFieldConsumersMd(inverse).md, rapport().md);
    if (ecart !== '') expect.fail(`l'ordre des racines a fui dans le rendu — ${ecart}`);
    // 300 s : DEUX Programs complets du dépôt (le mémoïsé + celui du corpus inversé). Mesures du
    // 2026-09-01 : 24,6 s ici, 52,3 s sur la machine du juge — marge ≥ 5× la plus lente, parce que
    // le runner CI Linux est plus lent encore et que cette garde est précisément née de son rouge.
  }, 300_000);
});

/**
 * CONTRAT POSITIF des champs RECOUVRÉS par le détecteur au `TypeChecker` (#1620) : chacun est nommé
 * avec le `fichier:ligne` de son lecteur. Un « 0/16 faux négatifs » ne prouverait rien (une mesure
 * qui rend zéro partout le satisfait) ; ici, chaque ligne exige une lecture RÉELLE à un site précis,
 * et la disparition du site est rouge sous le nom du champ. `TraitInstance.hidden` y figure parce que
 * `hiddenGroupsOf` ANNOTE `TraitInstance[]` : c'est cette annotation qui rend sa lecture mesurable.
 */
const RECOUVRES: readonly (readonly [string, string, string])[] = [
  ['DetailRecipe', 'tintVar', 'src/gameIso/authoring/detailSvg.ts:177'],
  ['EntityAppearance', 'armurePortee', 'src/state/spawn.ts:427'],
  ['CritEscalation', 'onRepeat', 'src/engine/critical.ts:312'],
  ['Amputation', 'timing', 'src/engine/critical.ts:327, src/ui/compendium/registry.ts:719'],
  ['FlowTest', 'opposed', 'src/state/combat/triggeredTest.ts:294'],
  ['CountSpec', 'fixed', 'src/data/index.ts:3487'],
  ['CountSpec', 'roll', 'src/data/index.ts:3487'],
  ['TrappingRef', 'label', 'src/engine/possessionGrants.ts:25'],
  ['FlowTest', 'argDifficulty', 'src/state/triggeredEffects.ts:74'],
  ['TravelTableEntry', 'stageOutcome', 'src/state/travelPostes.ts:363'],
  ['TraitInstance', 'hidden', 'src/engine/groups.ts:57'],
];

/**
 * CLIQUET des « 0 lecteur » : la liste des champs PROPRES sans aucun lecteur, écrite NOMINATIVEMENT
 * et comparée à l'identique. Il ne DESCEND que par le retrait d'une ligne, et ce retrait exige le
 * lecteur qui l'annule ; un zéro NOUVEAU (champ dont le dernier lecteur disparaît) est rouge sous
 * son nom, jamais avalé par un plafond. Ne sont ici ni les champs HÉRITÉS (leur « 0 » est
 * tautologique) ni les champs ABSENTS du type TS — ce ne sont pas des mesures de lecture.
 */
const ZEROS = [
  'CastingNumberMod.desc',
  'CastingNumberMod.maison',
  'CastingNumberMod.source',
  'PropData.label',
  'PropData.type',
  'SourceRef.note',
];

describe('contrat POSITIF des champs recouvrés + cliquet des « 0 lecteur »', () => {
  it('chaque champ recouvré a son lecteur MESURÉ au site nommé', () => {
    const mesure = (type: string, champ: string) =>
      [...new Set((rapport().byType.get(type)?.get(champ) ?? []).map((h: { file: string; line: number }) => `${h.file}:${h.line}`))];
    const constate = RECOUVRES.map(([type, champ, site]) => {
      const sites = mesure(type, champ);
      return `${type}.${champ} → ${sites.includes(site) ? site : sites.join(', ') || 'AUCUN LECTEUR'}`;
    });
    expect(
      constate,
      'un champ recouvré a perdu son lecteur au site nommé (déplacement de ligne = mettre à jour le site ; disparition = régression)',
    ).toEqual(RECOUVRES.map(([type, champ, site]) => `${type}.${champ} → ${site}`));
  }, 150_000);

  it('les « 0 lecteur » sont EXACTEMENT ceux de la liste — cliquet nominatif', () => {
    expect(
      [...rapport().zeros].sort(),
      'zéro apparu (régression : un champ a perdu son dernier lecteur) ou zéro disparu (retirer sa ligne de ZEROS)',
    ).toEqual(ZEROS);
    // RECOUPEMENT : le cardinal RENDU dans la Synthèse — ce qu'un humain lit — contre la liste
    // nommée. (`totalUnread` et `zeros` sont incrémentés côte à côte dans le générateur : les
    // comparer l'un à l'autre ne mesurerait rien.)
    const rendu = /\*\*(\d+) avec « 0 lecteur » mesuré\*\*/.exec(rapport().md);
    expect(
      rendu?.[1],
      'la Synthèse du rapport ne publie plus son cardinal « 0 lecteur » sous la forme attendue',
    ).toBe(String(ZEROS.length));
  }, 150_000);
});

/**
 * MORSURE du détecteur, sur des sources EN MÉMOIRE (`virtualProgram`, `scripts/guards/lib/
 * tsProgram.mjs` — le patron de la garde #841). Le rapport du dépôt ne PROUVE rien tout seul : il
 * dit ce que le code contient aujourd'hui, jamais ce que le détecteur REFUSE. Ici, chaque site est
 * écrit pour un verdict, et le verdict est asserté.
 *
 * `virtualProgram` ne sert que ses propres sources plus le répertoire `lib` de TypeScript : `zod`
 * n'y est pas résoluble — SONDÉ le 2026-09-01, un `import { z } from 'zod'` y rend le diagnostic
 * « Cannot find module 'zod' or its corresponding type declarations », le porteur se résout à
 * `z.infer<any>` et la propriété lue n'a AUCUN symbole. Le triplet zod est donc reproduit par un module
 * `src/z.ts` qui porte le SEUL trait qui compte pour le détecteur : un alias
 * `type X = Infer<typeof S>` dont les propriétés pointent les `PropertyAssignment` du shape. Le cas
 * zod RÉEL est couvert par la mesure du dépôt (`SourceRef` ← `sourceRefSchema`, `docs/
 * consommateurs-de-champs.md`).
 */
describe('MORSURE du détecteur — fixtures en mémoire', () => {
  const FIXTURES: Record<string, string> = {
    'src/types.ts': `export interface Ref { id: string; spec?: string }
export type TrappingRef = Ref & { qty?: number };
export type U = Ref & { x?: number };
`,
    'src/lecteurs.ts': `import type { Ref, TrappingRef, U } from './types';
// OUI l.3 — porteur ANNOTÉ du type cible
export const direct = (r: TrappingRef) => r.spec;
// OUI l.5 — variable au type INFÉRÉ depuis un porteur du type cible
export function parVariable(r: TrappingRef) { const s = r; return s.spec; }
// NON l.7 — \`U\` compose \`Ref\` comme \`TrappingRef\`, sans être \`TrappingRef\`
export const surU = (u: U) => u.spec;
// NON l.9 — porteur déclaré \`Ref\` : la lecture compte sous le DÉCLARANT
export const surRef = (r: Ref) => r.spec;
// OUI l.11 — opérateur de type appliqué à la cible (l'alias est PERDU, l'annotation le nomme)
export const parExtract = (r: Extract<TrappingRef, { id: string }>) => r.spec;
// OUI l.13 — élément inféré d'un tableau annoté du type cible
export const parTableau = (rs: TrappingRef[]) => rs.map((r) => r.spec);
// OUI l.15 — déstructuration directe
export const parDestructuration = ({ spec }: TrappingRef) => spec;
`,
    'src/autre.ts': `// Homonyme STRICT : même nom \`Ref\`, autre module, autre DÉCLARATION.
export interface Ref { id: string; spec?: string }
export const surAutreRef = (r: Ref) => r.spec;
`,
    'src/z.ts': `export interface Schema<T> { readonly _sortie: T }
export declare function objet<T extends object>(shape: T): Schema<T>;
export declare function texte(): string;
export type Infer<S> = S extends Schema<infer T> ? T : never;
`,
    'src/a.ts': `import { objet, texte } from './z';
export const boxSchema = objet({ note: texte(), taille: texte() });
`,
    'src/c.ts': `import type { Infer } from './z';
import { boxSchema } from './a';
export type Carton = Infer<typeof boxSchema>;
export const surCarton = (c: Carton) => c.note;
`,
    'src/d.ts': `import type { Carton } from './c';
export interface Box extends Carton {}
export const surBoxPure = (b: Box) => b.note;
`,
    'src/anon.ts': `import type { Ref } from './types';
// NON l.3 — type ANONYME de MÊME FORME que \`Ref\` : il porte SES propres déclarations
export const surAnonyme = (r: { id: string; spec?: string }) => r.spec;
// OUI l.5 — témoin : le MÊME fichier crédite bien quand le porteur est annoté \`Ref\`
export const surRefIci = (r: Ref) => r.spec;
`,
  };
  const FICHIERS = Object.keys(FIXTURES).map((rel) => join(VIRTUAL_ROOT, rel));

  /** Sites mesurés d'un champ sur une cible, sur le programme des fixtures. */
  const sites = (type: string, home: string, champ: string): string[] => {
    const programme = virtualProgram(FIXTURES);
    const hits = scanFieldReads({ type, home }, [champ], FICHIERS, VIRTUAL_ROOT, new Map(), programme);
    return [...new Set(groupByField([champ], hits).get(champ)!.map((h) => `${h.file}:${h.line}`))];
  };

  it('CONJONCTION (1)∧(2) — le porteur doit être du type, la propriété doit être la sienne', () => {
    expect(sites('TrappingRef', 'src/types.ts', 'spec')).toEqual([
      'src/lecteurs.ts:3',
      'src/lecteurs.ts:5',
      'src/lecteurs.ts:11',
      'src/lecteurs.ts:13',
      'src/lecteurs.ts:15',
    ]);
  });

  it('le DÉCLARANT compte toutes les lectures de la propriété qu’il déclare (c’est son renommage qui les casse)', () => {
    expect(sites('Ref', 'src/types.ts', 'spec')).toEqual([
      'src/anon.ts:5',
      'src/lecteurs.ts:3',
      'src/lecteurs.ts:5',
      'src/lecteurs.ts:7',
      'src/lecteurs.ts:9',
      'src/lecteurs.ts:11',
      'src/lecteurs.ts:13',
      'src/lecteurs.ts:15',
    ]);
  });

  it('FORME identique, DÉCLARATIONS distinctes : un type ANONYME ne crédite RIEN (pas de faux positif structurel)', () => {
    // `src/anon.ts` porte les deux versants dans le MÊME fichier : le paramètre annoté d'un littéral
    // de même forme que `Ref` (l.3) et un porteur annoté `Ref` (l.5). Le second est crédité — donc le
    // fichier EST scanné et l'absence du premier n'est pas une non-mesure.
    const declarant = sites('Ref', 'src/types.ts', 'spec');
    expect(declarant).toContain('src/anon.ts:5');
    expect(declarant).not.toContain('src/anon.ts:3');
    expect(sites('TrappingRef', 'src/types.ts', 'spec')).not.toContain('src/anon.ts:3');
  });

  it('un `home` qui ne DÉCLARE pas le type est une ERREUR nommée, jamais une table muette', () => {
    // `src/autre.ts` déclare son propre `Ref`, jamais `TrappingRef` : une cible mal domiciliée
    // rendrait zéro lecteur EN SILENCE, et le rapport publierait une absence fabriquée.
    expect(() => sites('TrappingRef', 'src/autre.ts', 'spec')).toThrowError(
      'fieldConsumers : type `TrappingRef` introuvable dans src/autre.ts — cible non résoluble',
    );
  });

  it('un même `cache` porté par DEUX Programs rend DEUX contextes — le premier ne se rejoue pas', () => {
    // Le contexte (Program, index des accès) est clé par SON Program : sans cela, le second appel
    // relirait l'index du premier corpus et rendrait ses sites sous le nom du second.
    const AUTRE: Record<string, string> = {
      'src/types.ts': FIXTURES['src/types.ts'],
      'src/second.ts': `import type { Ref } from './types';
export const ici = (r: Ref) => r.spec;
`,
    };
    const partage = new Map();
    const mesure = (fixtures: Record<string, string>) => {
      const fichiers = Object.keys(fixtures).map((rel) => join(VIRTUAL_ROOT, rel));
      const hits = scanFieldReads({ type: 'Ref', home: 'src/types.ts' }, ['spec'], fichiers, VIRTUAL_ROOT, partage, virtualProgram(fixtures));
      return [...new Set(hits.map((h) => `${h.file}:${h.line}`))];
    };
    expect(mesure(FIXTURES)).toContain('src/lecteurs.ts:3');
    expect(mesure(AUTRE)).toEqual(['src/second.ts:2']);
  });

  it('HOMONYMIE : deux `Ref` de modules différents ne se croisent jamais', () => {
    expect(sites('Ref', 'src/types.ts', 'spec')).not.toContain('src/autre.ts:3');
    expect(sites('Ref', 'src/autre.ts', 'spec')).toEqual(['src/autre.ts:3']);
  });

  it('shape → type inféré : le DÉCLARANT est reconnu par SYMBOLE du schéma, pas par son nom', () => {
    // `Carton` DÉCLARE `note` (par le shape de `boxSchema`, dont son `typeof` donne le symbole) :
    // ses deux lectures lui reviennent. Un lien par NOM fabriqué (`boxSchema` → « Box ») ne le
    // reconnaîtrait PAS et lui retirerait la lecture faite sur un porteur `Box`.
    expect(sites('Carton', 'src/c.ts', 'note')).toEqual(['src/c.ts:4', 'src/d.ts:3']);
  });

  it('shape → type inféré : un type qui COMPOSE le corps inféré ne capte pas les lecteurs du déclarant', () => {
    // `Box` compose `Carton` sans rien déclarer : il ne compte QUE ses propres porteurs. Un lien par
    // NOM (`boxSchema` → « Box » = la cible) lui attribuerait `src/c.ts:4`, dont le porteur est un
    // `Carton` — l'exacte confusion `Ref`/`TrappingRef` que la condition (2) interdit.
    expect(sites('Box', 'src/d.ts', 'note')).toEqual(['src/d.ts:3']);
    expect(sites('Box', 'src/d.ts', 'note')).not.toContain('src/c.ts:4');
  });

  it('ÉTATS d’un champ : propre / hérité / absent du type TS', () => {
    const programme = virtualProgram(FIXTURES);
    const etats = fieldOwnership(
      { type: 'TrappingRef', home: 'src/types.ts' },
      ['spec', 'qty', 'fantome'],
      FICHIERS,
      VIRTUAL_ROOT,
      new Map(),
      programme,
    );
    expect(etats.get('spec')).toEqual({ etat: 'herite', declarant: 'Ref' });
    expect(etats.get('qty')?.etat).toBe('propre');
    expect(etats.get('fantome')).toEqual({ etat: 'absent' });
  });
});
