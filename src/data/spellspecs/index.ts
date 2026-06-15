/**
 * Registre des specs de sorts CURÉES (cf. engine/spellspec) : une entrée = les effets structurés
 * d'un sort, recopiés de sa description canon. Les 243 sorts de la base sont curés (cf. le test
 * « TOUS les sorts sont curés ») ; `spellSpecFor` n'a donc plus de repli regex — si un sort INÉDIT
 * était ajouté sans entrée, il retombe sur une spec narrative minimale (sa desc journalisée).
 */
import { SpellSpec } from '../../engine/spellspec';
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
import { MAGIE_CHAOS } from './magie-chaos';
import { MAGIE_TZEENTCH } from './magie-tzeentch';
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
import { CREATURES_ZI } from './creatures-zi';

const ALL: SpellSpec[] = [
  ...CREATURES_ZI,
  ...BENEDICTIONS, ...DOMAINE_FEU, ...DOMAINE_OMBRES, ...DOMAINE_METAL, ...DOMAINE_LUMIERE,
  ...DOMAINE_CIEUX, ...DOMAINE_GUEULE, ...DOMAINE_BETE, ...SORCELLERIE, ...DEMONOLOGIE,
  ...DOMAINE_MORT, ...DOMAINE_VIE, ...MAGIE_NATURELLE, ...NECROMANCIE, ...MAGIE_CHAOS, ...MAGIE_TZEENTCH,
  ...MAGIE_MINEURE, ...ARCANES_COMMUNS, ...MIRACLES_SIGMAR, ...MIRACLES_SHALLYA, ...MIRACLES_MORR,
  ...MIRACLES_MYRMIDIA, ...MIRACLES_MANANN, ...MIRACLES_RANALD, ...MIRACLES_RHYA, ...MIRACLES_TAAL,
  ...MIRACLES_ULRIC, ...MIRACLES_VERENA,
];

/** Toutes les specs curées de la base (preuve de complétude du système Flow/EffectOp, badges UI). */
export const ALL_SPELL_SPECS: SpellSpec[] = ALL;

/** Spec curée d'un sort, si elle existe (type optionnel pour les labels en double). */
export function curatedSpec(label: string, type?: string): SpellSpec | undefined {
  const candidates = ALL.filter((s) => s.label === label);
  return candidates.find((s) => s.type != null && s.type === type) ?? candidates.find((s) => s.type == null);
}

/** Spec d'un sort : curée si présente au registre, sinon (sort inédit hors base) une spec narrative
 *  minimale — sa description est journalisée verbatim, rien n'est deviné par regex. */
export function spellSpecFor(spell: SpellLike): SpellSpec {
  return curatedSpec(spell.label, spell.type)
    ?? { label: spell.label, durationRounds: null, curated: false };
}
