/**
 * Registre des specs de sorts CURÉES (cf. engine/spellspec) : une entrée = les
 * effets structurés d'un sort, recopiés de sa description canon. Les sorts sans
 * entrée passent par `fallbackSpec` (parseurs regex historiques) — la curation
 * est incrémentale, famille par famille, sans régression.
 */
import { SpellSpec, fallbackSpec } from '../../engine/spellspec';
import { SpellLike } from '../../engine/magic';
import { BENEDICTIONS } from './benedictions';
import { DOMAINE_FEU } from './domaine-feu';
import { DOMAINE_OMBRES } from './domaine-ombres';
import { DOMAINE_METAL } from './domaine-metal';
import { DOMAINE_LUMIERE } from './domaine-lumiere';
import { DOMAINE_CIEUX } from './domaine-cieux';
import { DOMAINE_GUEULE } from './domaine-gueule';
import { MAGIE_MINEURE } from './magie-mineure';
import { ARCANES_COMMUNS } from './arcanes-communs';
import { MIRACLES_SIGMAR } from './miracles-sigmar';
import { MIRACLES_SHALLYA } from './miracles-shallya';

const ALL: SpellSpec[] = [
  ...BENEDICTIONS, ...DOMAINE_FEU, ...DOMAINE_OMBRES, ...DOMAINE_METAL, ...DOMAINE_LUMIERE,
  ...DOMAINE_CIEUX, ...DOMAINE_GUEULE, ...MAGIE_MINEURE, ...ARCANES_COMMUNS,
  ...MIRACLES_SIGMAR, ...MIRACLES_SHALLYA,
];

/** Spec curée d'un sort, si elle existe (type optionnel pour les labels en double). */
export function curatedSpec(label: string, type?: string): SpellSpec | undefined {
  const candidates = ALL.filter((s) => s.label === label);
  return candidates.find((s) => s.type != null && s.type === type) ?? candidates.find((s) => s.type == null);
}

/** Spec d'un sort : curée si présente au registre, sinon repli (desc → regex). */
export function spellSpecFor(spell: SpellLike): SpellSpec {
  return curatedSpec(spell.label, spell.type) ?? fallbackSpec(spell);
}
