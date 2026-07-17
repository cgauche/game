/**
 * Renderer JOUEUR de `GameOp[]` → `CodexRow[]` (ref #495, doctrine #295 — affichage = STRUCTURE +
 * renderer, jamais une chaîne de flux). Un `GameOp` dont le payload porte l'ID d'une entité d'une
 * catégorie Codex EXISTANTE devient une chip codex-liée (`{t:'ref', category, id, label, show, badge?}`).
 * Couverture = ANCRES NOMINATIVES (les kinds ci-dessous, à id résoluble dans une catégorie du Codex) +
 * REPLI EXHAUSTIF `humanizeOp` (compile-time, `assertNever` dans humanize.ts) pour tout le reste — un
 * kind SANS id stable (invocation d'arme nommée, marqueur d'atelier…) ou pointant une catégorie hors
 * Codex tombe en `{t:'text'}`. JAMAIS `opSummary` (résumeur d'ATELIER, `editor/GameOpEditor.tsx`).
 */
import type { GameOp } from '../../engine/ops';
import type { CodexRow } from './registry';
import { humanizeOp, humanizeFormula } from './humanize';
import { CHAR_LABELS, HIT_LOCATION_LABELS } from '../../engine/types';
import { formatTrait, traitLabelById } from '../../engine/traits/dispatch';
import { giveTrappingLabel } from '../../engine/items';
import { statName } from '../../engine/statEntry';
import {
  conditionLabel, psychologyLabel, diseaseLabel, symptomLabel, creatureLabel,
  refLabel, findTrappingById,
} from '../../data';

const textRow = (o: GameOp): CodexRow => ({ t: 'text', text: humanizeOp(o) });

/** Une op → SA ligne Codex. Ancre nominative quand un id résout dans une catégorie EXISTANTE, sinon
 *  repli `humanizeOp`. */
export function opRow(o: GameOp): CodexRow {
  switch (o.op) {
    case 'charMod':
      return { t: 'ref', category: 'characteristics', id: o.char, label: CHAR_LABELS[o.char], show: CHAR_LABELS[o.char], badge: `${o.mod >= 0 ? '+' : ''}${o.mod}` };
    case 'charDRBonus':
      return { t: 'ref', category: 'characteristics', id: o.char, label: CHAR_LABELS[o.char], show: CHAR_LABELS[o.char], badge: `+${humanizeFormula(o.bonus)} DR` };
    // Mouvement voyage par sa propre famille d'ops (`moveMod`/`moveScale`, hors `CharKey`) mais
    // s'affiche COMME une Caractéristique (même entrée codex `characteristics/mouvement`, arbitrage
    // user 2026-07-17) — la sémantique moteur ne change pas, seul l'affichage converge.
    case 'moveMod':
      return { t: 'ref', category: 'characteristics', id: 'mouvement', label: 'Mouvement', show: 'Mouvement', badge: `${o.mod >= 0 ? '+' : ''}${o.mod}` };
    case 'moveScale':
      return { t: 'ref', category: 'characteristics', id: 'mouvement', label: 'Mouvement', show: 'Mouvement', badge: o.num === 1 && o.den === 2 ? '½' : `×${o.num}/${o.den}` };
    case 'wounds': {
      const badge = [
        o.ignoreAP === false ? undefined : 'ignore les PA',
        o.bypassArmour === 'metal' ? 'perce armure métallique' : o.bypassArmour === 'nonMagic' ? 'perce armure non magique' : undefined,
      ].filter((s): s is string => !!s).join(' · ') || undefined;
      return { t: 'ref', category: 'characteristics', id: 'blessure', label: 'Blessure', show: `${humanizeFormula(o.amount)} Blessure(s)`, badge };
    }
    // PA (Points d'Armure) : aucune entrée Codex glossaire dédiée — repli texte SEC (jamais de lien inventé).
    case 'ap':
      return { t: 'text', text: `+${humanizeFormula(o.amount)} PA${o.loc ? ` (${HIT_LOCATION_LABELS[o.loc]})` : ' (toutes Localisations)'}` };
    case 'grantTalent':
      return { t: 'ref', category: 'talents', id: o.talentId, label: statName(refLabel('talents', { id: o.talentId, spec: o.spec })), show: refLabel('talents', { id: o.talentId, spec: o.spec }) };
    case 'grantCareerTalent': {
      const l = refLabel('talents', { id: o.talentId, spec: o.spec });
      return { t: 'ref', category: 'talents', id: o.talentId, label: statName(l), show: l };
    }
    case 'grantCareerSkill': {
      const l = refLabel('skills', { id: o.skillId, spec: o.spec });
      return { t: 'ref', category: 'skills', id: o.skillId, label: statName(l), show: l };
    }
    case 'skillMod': {
      const l = refLabel('skills', { id: o.skill });
      return { t: 'ref', category: 'skills', id: o.skill, label: statName(l), show: l, badge: `${o.mod >= 0 ? '+' : ''}${o.mod}` };
    }
    case 'skillDRBonus': {
      if (!o.skill) return textRow(o); // ancré sur un `testType` naval (hors catégorie Codex) → repli
      const l = refLabel('skills', { id: o.skill, spec: o.spec });
      return { t: 'ref', category: 'skills', id: o.skill, label: statName(l), show: l, badge: `+${humanizeFormula(o.bonus)} DR` };
    }
    case 'grantTrait': {
      const label = traitLabelById(o.traitId);
      return { t: 'ref', category: 'traits', id: o.traitId, label, show: formatTrait({ id: o.traitId, arg: o.arg }), badge: o.indice != null ? humanizeFormula(o.indice) : undefined };
    }
    case 'grantPsychTrait': {
      const label = psychologyLabel(o.psychType);
      return { t: 'ref', category: 'psychologies', id: o.psychType, label, show: label, badge: o.cible };
    }
    case 'removePsychTrait': {
      if (!o.psychType) return textRow(o); // « au choix » : pas d'ancre
      const label = psychologyLabel(o.psychType);
      return { t: 'ref', category: 'psychologies', id: o.psychType, label, show: label };
    }
    case 'endPsych': {
      const label = psychologyLabel(o.type);
      return { t: 'ref', category: 'psychologies', id: o.type, label, show: label };
    }
    case 'condition': {
      const label = conditionLabel(o.name);
      const show = o.value != null && o.value !== 1 ? `${humanizeFormula(o.value)} × ${label}` : label;
      const badge = o.durationRounds != null ? `${humanizeFormula(o.durationRounds)} Round(s)` : o.perRound ? 'par Round' : undefined;
      return { t: 'ref', category: 'etats', id: o.name, label, show, badge };
    }
    case 'removeCondition': {
      if (!o.name) return textRow(o); // « au choix » : pas d'ancre
      const label = conditionLabel(o.name);
      return { t: 'ref', category: 'etats', id: o.name, label, show: label };
    }
    case 'giveTrapping': {
      if (!o.trappingId) return textRow(o); // objet CUSTOM (misc) sans id de catalogue → repli
      const label = findTrappingById(o.trappingId)?.label ?? o.trappingId;
      return { t: 'ref', category: 'trappings', id: o.trappingId, label, show: giveTrappingLabel(o), badge: o.count && o.count > 1 ? `×${o.count}` : undefined };
    }
    case 'contractDisease': {
      const label = diseaseLabel(o.disease);
      return { t: 'ref', category: 'maladies', id: o.disease, label, show: label };
    }
    case 'exposeDisease': {
      const label = diseaseLabel(o.disease);
      return { t: 'ref', category: 'maladies', id: o.disease, label, show: label };
    }
    case 'reduceDiseaseDays': {
      if (!o.disease) return textRow(o); // « une maladie » au choix : pas d'ancre
      const label = diseaseLabel(o.disease);
      const days = o.dice ? `${o.dice.n}d${o.dice.sides}` : String(o.days ?? 1);
      return { t: 'ref', category: 'maladies', id: o.disease, label, show: label, badge: `−${days} j` };
    }
    case 'suppressSymptom': {
      const label = symptomLabel(o.symptomId);
      return { t: 'ref', category: 'symptoms', id: o.symptomId, label, show: label };
    }
    case 'summon': {
      const label = creatureLabel(o.ref);
      return { t: 'ref', category: 'creatures', id: o.ref, label, show: label, badge: `×${humanizeFormula(o.count)}${o.allyOfCaster === false ? ' (hostile)' : ''}` };
    }
    case 'scheduleRespawn': {
      const label = creatureLabel(o.ref);
      return { t: 'ref', category: 'creatures', id: o.ref, label, show: label, badge: `${humanizeFormula(o.delayDays)} j` };
    }
    case 'polymorph': {
      const label = creatureLabel(o.ref);
      return { t: 'ref', category: 'creatures', id: o.ref, label, show: label };
    }
    case 'transform': {
      if (!o.morphRef) return textRow(o); // deltas purs sans forme visuelle référencée
      const label = creatureLabel(o.morphRef);
      return { t: 'ref', category: 'creatures', id: o.morphRef, label, show: label, badge: o.tag };
    }
    default:
      return textRow(o);
  }
}

/** Une liste d'ops → SES lignes Codex, dans l'ordre. */
export function opRows(ops: GameOp[]): CodexRow[] {
  return ops.map(opRow);
}
