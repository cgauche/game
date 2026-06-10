import type { Combatant } from '../types';

/** Contexte lecture seule d'un hook de capacité (level = times du talent / Indice du trait). */
export interface CombatFeatureCtx {
  combatant: Combatant;
  level: number;
}

/**
 * Une capacité de combat (talent ou trait de créature). Hooks optionnels, consommés par dispatch.ts.
 * Ce chantier câble `modifyOffHandPenalty` (Ambidextre). Hooks FUTURS, ajoutés avec leur 1er
 * consommateur (pas de dispatcher mort) : `attackModes` (Maniement de deux armes), `onWonDefense`
 * (Riposte/Champion), `attackMods`/`defenseMods`.
 */
export interface CombatFeature {
  /** Nom FR canonique (Ambidextre, Maniement de deux armes, Riposte, Champion…). */
  key: string;
  kind: 'talent' | 'trait';
  /** Transforme la pénalité de main secondaire (Ambidextre : -20 → -10/0). */
  modifyOffHandPenalty?: (penalty: number, ctx: CombatFeatureCtx) => number;
  /** Modes d'attaque ajoutés par la capacité (Maniement de deux armes → 'dual-wield'). */
  attackModes?: (ctx: CombatFeatureCtx) => string[];
}
