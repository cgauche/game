/**
 * Couche `describe` du Codex — projette les données MÉCANIQUES d'une fiche (modificateurs passifs,
 * profil de manœuvre, effets déclenchés) en `CodexSection` lisibles. SOURCE UNIQUE réutilisée par
 * toutes les catégories porteuses (traits, mutations, qualités…) : enrichir une fiche = composer ces
 * sections, pas réécrire un rendu. Réutilise `opSummary` (le formateur d'ops de l'éditeur) et
 * `ATTACK_LABEL` (libellés de manœuvre) — aucun vocabulaire dupliqué.
 */
import type { CodexRow, CodexSection } from './registry';
import { opSummary } from '../editor/GameOpEditor';
import { condSummary } from '../editor/ConditionEditor';
import type { GameOp } from '../../engine/ops';
import type { Flow, TriggeredEffect, EffectTrigger } from '../../state/flow';
import { refLabel } from '../../data';

const TRIGGER_LABEL: Record<EffectTrigger, string> = {
  onHit: 'À la touche',
  onWoundLoss: 'En perdant des PB',
  onRoundStart: 'Au début du Round',
  onStartled: 'Surpris (magie / bruit)',
  onKill: 'En tuant un adversaire',
  onCharged: 'Quand Chargé',
  onGainCondition: 'En gagnant un État',
};
const ON_LABEL: Record<'self' | 'victim' | 'engaged', string> = {
  self: 'soi-même',
  victim: 'la victime',
  engaged: 'les adversaires engagés',
};
/** Libellé de la CIBLE d'un effet déclenché — chaîne simple OU géométrie (`{near, radiusMeters}`). */
const onLabel = (on: TriggeredEffect['on']): string =>
  typeof on === 'object' ? `les cibles à ≤ ${on.radiusMeters} m de ${on.near === 'self' ? 'soi' : 'la victime'}` : ON_LABEL[on];

/** Modificateurs PASSIFS continus (`GameOp[]`) → section lisible (« +5 F », « −20 aux Tests de Soc »…). */
export function passiveSection(ops: GameOp[] | undefined, title = 'Modificateurs passifs'): CodexSection | null {
  if (!ops?.length) return null;
  return { title, layout: 'list', rows: ops.map((o) => ({ t: 'text', text: opSummary(o) }) as CodexRow) };
}

/** Décrit UNE op en clair — RÉCURSIF pour les ops à sous-ops (Test/Test opposé), avec leur gating, en
 *  réutilisant `opSummary` pour les ops simples (zéro vocabulaire dupliqué). */
function describeOp(o: GameOp): string {
  if (o.op === 'test') {
    const what = o.skill ?? (o.characteristic ? o.characteristic : '?');
    const gate = [
      o.argDifficulty ? 'difficulté de l’arg' : null,
      o.onlyGroups?.length ? `groupe ${o.onlyGroups.join('/')}` : null,
      o.exceptGroups?.length ? `hors ${o.exceptGroups.join('/')}` : null,
      o.unlessImmune ? `sauf immunité ${o.unlessImmune}` : null,
    ].filter(Boolean).join(', ');
    const fail = (o.onFail ?? []).map(describeOp).join(', ') || '—';
    const succ = o.onSuccess?.length ? ` · réussite : ${o.onSuccess.map(describeOp).join(', ')}` : '';
    return `Test de ${what}${gate ? ` (${gate})` : ''} → échec : ${fail}${succ}`;
  }
  if (o.op === 'opposedTest') {
    const win = (o.onWin ?? []).map(describeOp).join(', ') || '—';
    const lose = o.onLose?.length ? ` · sinon : ${o.onLose.map(describeOp).join(', ')}` : '';
    return `Test opposé ${o.attacker}${o.attackerSkill ? `/${o.attackerSkill}` : ''} vs ${o.defender}${o.defenderSkill ? `/${o.defenderSkill}` : ''} → ${win}${lose}`;
  }
  return opSummary(o);
}

/** Résumé LISIBLE d'un Flow d'effet (conditions `if` + ops `do`) — réutilise `condSummary`/`describeOp`. */
function flowSummary(f: Flow): string {
  switch (f.kind) {
    case 'do': return f.effect.type === 'ops' ? f.effect.ops.map(describeOp).join(', ') : f.effect.type;
    case 'seq': return f.steps.map(flowSummary).filter(Boolean).join(' ; ');
    case 'if': return `si ${condSummary(f.cond)} → ${flowSummary(f.then)}${f.else ? ` (sinon ${flowSummary(f.else)})` : ''}`;
    case 'test': return `jet ${f.test.skill ? refLabel('skills', { id: f.test.skill, spec: f.test.spec }) : (f.test.characteristic ?? '')} → réussite : ${flowSummary(f.success)} / échec : ${flowSummary(f.fail)}`;
  }
}

/** Effets DÉCLENCHÉS (`TriggeredEffect[]`) → déclencheur → cible PUIS le contenu mécanique du Flow
 *  (conditions de gating + ops), pour que la fiche décrive VRAIMENT ce que l'effet fait. */
const effectRows = (effects: TriggeredEffect[] | undefined): CodexRow[] =>
  (effects ?? []).flatMap((e) => {
    const head = `${TRIGGER_LABEL[e.trigger]} → ${onLabel(e.on)}`;
    const body = flowSummary(e.flow);
    return [
      { t: 'sub', label: head } as CodexRow,
      { t: 'text', text: body || '(aucun effet)' } as CodexRow,
    ];
  });

export function effectsSection(effects: TriggeredEffect[] | undefined, title = 'Effets déclenchés'): CodexSection | null {
  const rows = effectRows(effects);
  return rows.length ? { title, layout: 'list', rows } : null;
}
