/**
 * SpellSpec — spec STRUCTURÉE d'un sort/prière : ce que le sort FAIT, exprimé en
 * `GameOp` (engine/ops), au lieu d'être deviné par regex sur sa description au
 * moment de l'application (POC du Jalon 0.7).
 *
 * Deux origines :
 *  - CURÉE : entrée du registre `src/data/spellspecs/` (un fichier par famille),
 *    recopiée de la description canon (spells.json / LDB), citée en commentaire.
 *  - REPLI : `fallbackSpec` synthétise une spec depuis la desc avec les parseurs
 *    historiques (parseHealFormula / parseCharBuffs / parseConditionEffect) —
 *    iso-comportement avec le POC pour les sorts non encore curés.
 *
 * La résolution (jet d'incantation, NI, Maladresse, Projectile magique) reste
 * dans engine/magic ; la spec ne décrit que les EFFETS d'un lancement réussi.
 */
import { GameOp, Formula } from './ops';
import {
  SpellLike,
  parseHealFormula,
  parseCharBuffs,
  parseConditionEffect,
  durationRoundsFormula,
} from './magic';

export interface SpellSpec {
  label: string;
  /** Ops appliquées à la cible quand le sort est lancé (référent des formules = LANCEUR). */
  ops: GameOp[];
  /** Durée en Rounds si exprimable (littéral / « (Bonus de X) Rounds » du lanceur) ;
   *  null = Instantané ou durée hors échelle tactique (minutes/heures/jours) —
   *  on n'invente PAS un nombre de rounds (LDB). */
  durationRounds: Formula | null;
  /** Vrai pour une entrée du registre (sinon : repli regex sur la desc). */
  curated: boolean;
  /** Citation source (desc spells.json, LDB chap/ligne) pour les entrées curées. */
  source?: string;
}

/**
 * Spec de REPLI : reconstruit les effets exactement comme le POC les devinait —
 * priorité exclusive soin > modificateurs de caractéristique > État (premier
 * motif reconnu seulement, comportement historique d'applyCast).
 */
export function fallbackSpec(spell: SpellLike): SpellSpec {
  const ops: GameOp[] = [];
  const heal = parseHealFormula(spell.desc);
  const buffs = parseCharBuffs(spell.desc);
  const cond = parseConditionEffect(spell.desc);
  if (heal != null) {
    ops.push({ op: 'heal', amount: heal });
  } else if (buffs.length) {
    for (const b of buffs) ops.push({ op: 'charMod', char: b.char, mod: b.bonus });
  } else if (cond) {
    if (cond.op === 'remove') ops.push({ op: 'removeCondition', name: cond.name, value: cond.value });
    else ops.push({ op: 'condition', name: cond.name!, value: cond.value });
  }
  // Sinon : effet purement narratif — le log d'incantation suffit (rien d'inventé).
  return {
    label: spell.label,
    ops,
    durationRounds: durationRoundsFormula(spell.duration),
    curated: false,
  };
}
