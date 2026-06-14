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
import { DOMAINE_BETE } from './domaine-bete';
import { SORCELLERIE } from './sorcellerie';
import { DEMONOLOGIE } from './demonologie';
import { DOMAINE_MORT } from './domaine-mort';
import { DOMAINE_VIE } from './domaine-vie';
import { MAGIE_NATURELLE } from './magie-naturelle';
import { NECROMANCIE } from './necromancie';
import { MAGIE_MINEURE } from './magie-mineure';
import { ARCANES_COMMUNS } from './arcanes-communs';
import { MIRACLES_SIGMAR } from './miracles-sigmar';
import { MIRACLES_SHALLYA } from './miracles-shallya';
import { MIRACLES_MORR } from './miracles-morr';
import { MIRACLES_MYRMIDIA } from './miracles-myrmidia';
import { MIRACLES_MANANN } from './miracles-manann';
import { MIRACLES_RANALD } from './miracles-ranald';
import { MIRACLES_RHYA } from './miracles-rhya';
import { MIRACLES_TAAL } from './miracles-taal';
import { MIRACLES_ULRIC } from './miracles-ulric';
import { MIRACLES_VERENA } from './miracles-verena';

const ALL: SpellSpec[] = [
  ...BENEDICTIONS, ...DOMAINE_FEU, ...DOMAINE_OMBRES, ...DOMAINE_METAL, ...DOMAINE_LUMIERE,
  ...DOMAINE_CIEUX, ...DOMAINE_GUEULE, ...DOMAINE_BETE, ...SORCELLERIE, ...DEMONOLOGIE,
  ...DOMAINE_MORT, ...DOMAINE_VIE, ...MAGIE_NATURELLE, ...NECROMANCIE,
  ...MAGIE_MINEURE, ...ARCANES_COMMUNS, ...MIRACLES_SIGMAR, ...MIRACLES_SHALLYA, ...MIRACLES_MORR,
  ...MIRACLES_MYRMIDIA, ...MIRACLES_MANANN, ...MIRACLES_RANALD, ...MIRACLES_RHYA, ...MIRACLES_TAAL,
  ...MIRACLES_ULRIC, ...MIRACLES_VERENA,
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
