/**
 * GARDE dérivée des INSTANCES — anti-dérive du SCHÉMA d'argument des Traits (filet exhaustif).
 *
 * Balaie CHAQUE instance de trait de la donnée et vérifie que la DÉCLARATION de schéma du trait
 * (`TraitData` : `indice` / `specsSource` / `specsOpen` / `specsMulti`, cf. `index.ts`) COUVRE ce que
 * l'instance porte. Deux INVARIANTS stricts, sans tolérance ad hoc ni baseline de dette (aucun élément
 * différé) — même esprit que la GARDE EXHAUSTIVE de `refs-migrated.test.ts` (walk + offenders + `expect([])`) :
 *   1. `value` numérique ⟹ le trait déclare `indice` (le sens de la valeur).            → « missing-indice »
 *   2. `arg` d'une source FERMÉE (`specsSource` sans `specsOpen`) RÉSOUT dans son registre. → « label-as-id »
 * Un `arg` sur un trait SANS `specsSource` est un descripteur TEXTE LIBRE (« Arme (Épée) », « Armure
 * (Cuir 2) ») — légitime, non contraint (même convention que `refs-migrated` : hors catalogue = verbatim).
 *
 * ── PÉRIMÈTRE ─────────────────────────────────────────────────────────────────────────────────────
 * Les instances vivent dans `creatures.json` sous deux formes :
 *   - `traits[]`    : id-based `{ id, value?, arg?, range?, count? }` — la donnée MIGRÉE. L'invariant #2
 *                     (résolution des args fermés) s'applique ICI (résolution par id).
 *   - `optionals[]` : label-based `{ key: <libellé>, value?, arg? }` — menu Codex encore en forme LEGACY
 *                     (ses `arg` sont des libellés FR, pas des ids). Résolue par libellé ; l'invariant #1
 *                     s'y applique, mais la résolution des args fermés attend la migration label→id de
 *                     cette liste (chantier de donnée distinct, cf. rapport). Non couvert ⇒ non prétendu.
 * Les instances CONSTRUITES par op (`grantTrait { traitId, arg? }`, dans spells/mutations/miscast…) ne
 * sont pas balayées ici (portée à `creatures.json`, comme permis) : l'une porte un `arg` fermé non résolu
 * (`haine (Religion)` dans une mutation) — signalé au rapport, pas masqué.
 *
 * Toute dérive FUTURE (un `value` sans `indice`, un `arg` fermé pris pour un libellé) fait échouer la
 * garde en LISTANT les fautifs.
 */
import { describe, it, expect } from 'vitest';
import { traits, creatures, SPEC_SOURCES, type SpecsSource, type TraitData } from './index';

/** Forme BRUTE d'une instance (les deux formes coexistent — cf. périmètre). Typage local : le type
 *  `TraitInstance` public n'a que `id` ; `optionals[]` porte `key` (libellé) → accès via ce shape. */
type RawTraitInstance = { id?: string; key?: string; value?: unknown; arg?: unknown; range?: unknown; count?: unknown };

const byId = new Map(traits.map((t) => [t.id, t] as const));
const byLabel = new Map(traits.map((t) => [t.label, t] as const));

/** Sentinelle joker d'un statbloc RAW (« Animosité (un au choix) », « Peur (Au choix) ») — tolérée. */
const WILDCARD = /^(un |une |deux )?au choix$/i;

interface Row { inst: RawTraitInstance; def: TraitData | undefined; where: string; idBased: boolean; }
/** Toutes les instances de trait (les DEUX listes), avec la def résolue (id → `traits[]`, libellé →
 *  `optionals[]`) et un marqueur `idBased` (la résolution des args fermés ne concerne que la liste migrée). */
function* eachInstance(): Generator<Row> {
  for (const c of creatures) {
    for (const inst of c.traits as unknown as RawTraitInstance[])
      yield { inst, def: inst.id ? byId.get(inst.id) : undefined, where: `${c.label}.traits[${String(inst.id)}]`, idBased: true };
    for (const inst of c.optionals as unknown as RawTraitInstance[])
      yield { inst, def: inst.key ? byLabel.get(inst.key) : undefined, where: `${c.label}.optionals[${String(inst.key)}]`, idBased: false };
  }
}

/** Parts d'un `arg` : liste séparée par virgules si `specsMulti`, sinon l'arg entier. */
const argParts = (arg: string, multi: boolean): string[] =>
  (multi ? arg.split(',').map((s) => s.trim()) : [arg.trim()]).filter(Boolean);

describe('schéma d\'argument des traits — chaque instance est COUVERTE par la déclaration de son trait', () => {
  it('value numérique ⟹ le trait déclare `indice` (sens de la valeur) — les deux listes', () => {
    const offenders: string[] = [];
    for (const { inst, def, where } of eachInstance()) {
      if (!def || typeof inst.value !== 'number') continue; // def non résolue = concern d'id-résolution (autre garde)
      if (!def.indice) offenders.push(`${where} value=${inst.value} (aucun \`indice\` déclaré)`);
    }
    expect(offenders, `value numérique sans \`indice\` déclaré :\n${offenders.join('\n')}`).toEqual([]);
  });

  it('arg d\'une source FERMÉE (specsSource sans specsOpen) RÉSOUT dans le registre — jamais un libellé/id fantôme', () => {
    const offenders: string[] = [];
    for (const { inst, def, where, idBased } of eachInstance()) {
      // optionals[] = libellés FR legacy (non migrés aux id) → hors résolution fermée (cf. périmètre).
      if (!idBased || !def || typeof inst.arg !== 'string') continue;
      const src: SpecsSource | undefined = def.specsSource;
      if (!src || def.specsOpen) continue; // ouvert / sans source = descripteur texte libre (légitime, non contraint)
      if (WILDCARD.test(inst.arg.trim())) continue; // sentinelle « au choix » sur l'arg entier
      for (const part of argParts(inst.arg, !!def.specsMulti)) {
        if (WILDCARD.test(part)) continue; // part joker « un au choix »
        if (!SPEC_SOURCES[src].resolves(part)) offenders.push(`${where} → ${src}: ${JSON.stringify(part)} (id inconnu du registre)`);
      }
    }
    expect(offenders, `arg fermé non résolu (libellé pris pour un id ?) :\n${offenders.join('\n')}`).toEqual([]);
  });
});
