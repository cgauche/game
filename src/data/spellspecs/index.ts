/**
 * Registre des specs de sorts CURÉES (cf. engine/spellspec) : une entrée = les
 * effets structurés d'un sort, recopiés de sa description canon. Les sorts sans
 * entrée passent par `fallbackSpec` (parseurs regex historiques) — la curation
 * est incrémentale, famille par famille, sans régression.
 */
import { SpellSpec, fallbackSpec } from '../../engine/spellspec';
import { SpellLike } from '../../engine/magic';
import { BENEDICTIONS } from './benedictions';

const ALL: SpellSpec[] = [...BENEDICTIONS];

const BY_LABEL = new Map(ALL.map((s) => [s.label, s]));

/** Spec curée d'un sort, si elle existe. */
export function curatedSpec(label: string): SpellSpec | undefined {
  return BY_LABEL.get(label);
}

/** Spec d'un sort : curée si présente au registre, sinon repli (desc → regex). */
export function spellSpecFor(spell: SpellLike): SpellSpec {
  return BY_LABEL.get(spell.label) ?? fallbackSpec(spell);
}
