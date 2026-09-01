import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFieldConsumersMd } from '../../scripts/docs/build-field-consumers.mjs';
import { TARGETS, fieldsOf } from '../../scripts/guards/lib/fieldConsumerTargets.mjs';

/**
 * Garde du rapport « consommateurs par champ » (#903 — `scripts/docs/build-field-consumers.mts`,
 * `docs/consommateurs-de-champs.md`). PAS un cliquet décroissant sur le volume de champs « 0
 * lecteur » : la vérification manuelle des 16 candidats de la première mesure a réfuté 9/16 (56 %,
 * angles morts du détecteur syntaxique — variable de type inféré, accès chaîné, boucle `for…of` sur
 * tableau typé, cf. en-tête de `build-field-consumers.mts`) — verrouiller ce total aurait verrouillé
 * un fait faux. Cette garde se limite à ce qui a été vérifié À LA MAIN : la fraîcheur du doc généré,
 * et le cas FONDATEUR (`TrappingRef.spec`, #903) en CONTRAT POSITIF.
 */
const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Le rapport, régénéré EN PROCESSUS et mémoïsé : un SEUL scan du corpus (~0,9 s) nourrit les deux
 *  assertions — fraîcheur du `.md` et cas fondateur. PARESSEUX : payé au 1ᵉʳ `it` qui le demande,
 *  jamais à la collecte de vitest. */
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
  });
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
  });
});
