import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFieldConsumersMd } from '../../scripts/docs/build-field-consumers.mjs';
import { TARGETS, fieldsOf } from '../../scripts/guards/lib/fieldConsumerTargets.mjs';
import { scanFieldReads, fieldOwnership, groupByField } from '../../scripts/guards/lib/fieldConsumers.mjs';
import { virtualProgram, VIRTUAL_ROOT } from '../../scripts/guards/lib/tsProgram.mjs';

/**
 * Garde du rapport « consommateurs par champ » (#903 — `scripts/docs/build-field-consumers.mts`,
 * `docs/consommateurs-de-champs.md`). PAS un cliquet décroissant sur le volume de champs « 0
 * lecteur » : le détecteur travaille au `TypeChecker` (#1620) et il RESTE un faux négatif nommé
 * (`TraitInstance.hidden`, redéclaration structurelle de `src/engine/groups.ts`) — verrouiller ce
 * total verrouillerait encore un fait faux. Cette garde tient donc trois choses : la fraîcheur du
 * doc généré, le cas FONDATEUR (`TrappingRef.spec`, #903) en CONTRAT POSITIF sur le dépôt RÉEL, et
 * la MORSURE du détecteur sur des fixtures en mémoire (dernier `describe`).
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

describe('docs/consommateurs-de-champs.md — le rapport GÉNÉRÉ est à jour', () => {
  it('régénéré en mémoire == committé (sinon : npm run docs:field-consumers)', () => {
    const chemin = join(ROOT, 'docs/consommateurs-de-champs.md');
    const ecart = ecartDoc(rapport().md, existsSync(chemin) ? readFileSync(chemin, 'utf8') : null);
    expect(
      ecart,
      'docs/consommateurs-de-champs.md est PÉRIMÉ/ABSENT (les schémas/le code source ont changé)\n' +
        '  → régénérer via `npm run docs:field-consumers` et committer le résultat.',
    ).toBe('');
    // 60 s : le corps est SYNCHRONE (vitest ne pourrait pas l'interrompre — il PASSERAIT sous le
    // `testTimeout` global de 15 s de `vite.config.ts` sans rien dire), et il paie le Program du
    // dépôt : 15,8 à 20,2 s mesurées sur cinq exécutions du 2026-09-01. Le chiffre est ici pour
    // être RÉVISÉ quand la mesure bouge, pas pour donner une marge muette.
  }, 60_000);
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
    const specReaders = [...new Set((byField!.get('spec') ?? []).map((h: { file: string; line: number }) => h.file))];
    expect(
      specReaders.sort(),
      'TrappingRef.spec devrait avoir EXACTEMENT 2 fichiers lecteurs : la résolution de choix et la matérialisation',
    ).toEqual(['src/engine/items.ts', 'src/engine/trappingChoices.ts']);
    expect(
      specReaders.some((s: string) => s.includes('data/index.ts')),
      'un lecteur de spec dans `data/index.ts` = une seconde définition du rendu « base (spec) », qui appartient à `refConcrete`',
    ).toBe(false);
    // Même Program du dépôt que la fraîcheur ci-dessus (mémoïsé) — mais ce `it` le paie SEUL si on
    // le lance à part (`-t`) : 60 s pour la même mesure.
  }, 60_000);
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
      'src/lecteurs.ts:3',
      'src/lecteurs.ts:5',
      'src/lecteurs.ts:7',
      'src/lecteurs.ts:9',
      'src/lecteurs.ts:11',
      'src/lecteurs.ts:13',
      'src/lecteurs.ts:15',
    ]);
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
