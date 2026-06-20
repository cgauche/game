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

/** Résumé LISIBLE d'un Flow d'effet (conditions `if` + ops `do`, jet `test`) — réutilise `condSummary`/
 *  `opSummary`. Le Test (SIMPLE ou OPPOSÉ) n'est PLUS une op : c'est un nœud de STRUCTURE Flow
 *  (`{kind:'test'}`) décrit ci-dessous (zéro vocabulaire dupliqué). */
function flowSummary(f: Flow): string {
  switch (f.kind) {
    case 'do': return f.effect.type === 'ops' ? f.effect.ops.map(opSummary).join(', ') : f.effect.type;
    case 'seq': return f.steps.map(flowSummary).filter(Boolean).join(' ; ');
    case 'if': return `si ${condSummary(f.cond)} → ${flowSummary(f.then)}${f.else ? ` (sinon ${flowSummary(f.else)})` : ''}`;
    case 'test': {
      const who = f.test.skill ? refLabel('skills', { id: f.test.skill, spec: f.test.spec }) : (f.test.characteristic ?? '');
      const opp = f.test.opposed ? ` opposé (${f.test.opposed.attackerLabel ?? f.test.opposed.attacker})` : '';
      return `jet${opp} ${who} → réussite : ${flowSummary(f.success)} / échec : ${flowSummary(f.fail)}`;
    }
    case 'choice':
      return `choix${f.cost ? ` (${f.cost.advantage} Av)` : ''} « ${f.prompt} » → oui : ${flowSummary(f.yes)}${f.no ? ` / non : ${flowSummary(f.no)}` : ''}`;
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
