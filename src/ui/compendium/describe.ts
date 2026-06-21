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
import { statName } from '../../engine/statEntry';

const TRIGGER_LABEL: Record<EffectTrigger, string> = {
  onHit: 'À la touche',
  onWoundLoss: 'En perdant des PB',
  onRoundStart: 'Au début du Round',
  onStartled: 'Surpris (magie / bruit)',
  onKill: 'En tuant un adversaire',
  onCharged: 'Quand Chargé',
  onGainCondition: 'En gagnant un État',
  onCombatStart: 'Au début du combat',
  onCombatEnd: 'À la fin du combat',
  onRoundEnd: 'À la fin du Round',
  onTurnStart: 'Au début de son tour',
  onTurnEnd: 'À la fin de son tour',
};
const ON_LABEL: Record<'self' | 'victim' | 'engaged', string> = {
  self: 'soi-même',
  victim: 'la victime',
  engaged: 'les adversaires engagés',
};
/** Libellé de la CIBLE d'un effet déclenché — chaîne simple OU géométrie (`{near, radiusMeters}`). */
const onLabel = (on: TriggeredEffect['on']): string =>
  typeof on === 'object' ? `les cibles à ≤ ${on.radiusMeters} m de ${on.near === 'self' ? 'soi' : 'la victime'}` : ON_LABEL[on];

/** Octrois de carrière (`grantCareerSkill`/`grantCareerTalent`) — affichés à part (cross-réf cliquable),
 *  jamais comme « modificateur continu ». Filtrés ici pour ne pas doublonner avec `careerGrantSection`. */
const CAREER_GRANT_OPS = new Set<GameOp['op']>(['grantCareerSkill', 'grantCareerTalent']);

/** Modificateurs PASSIFS continus (`GameOp[]`) → section lisible (« +5 F », « −20 aux Tests de Soc »…).
 *  Les octrois de carrière (compétence/talent ajouté à toute carrière) sont EXCLUS → `careerGrantSection`. */
export function passiveSection(ops: GameOp[] | undefined, title = 'Modificateurs passifs'): CodexSection | null {
  const mods = (ops ?? []).filter((o) => !CAREER_GRANT_OPS.has(o.op));
  if (!mods.length) return null;
  return { title, layout: 'list', rows: mods.map((o) => ({ t: 'text', text: opSummary(o) }) as CodexRow) };
}

/** Compétence/Talent ajouté à « n'importe quelle Carrière » (LDB 10, ops `grantCareerSkill`/
 *  `grantCareerTalent`) → chips CROSS-RÉF cliquables (id → libellé ; le lookup ignore la spec « Au choix »
 *  via `statName`). Source unique de la projection des octrois de carrière (talents Maître artisan, Flagellant…). */
export function careerGrantSection(ops: GameOp[] | undefined, title = 'Ajouté à vos carrières'): CodexSection | null {
  const rows: CodexRow[] = (ops ?? []).flatMap((o): CodexRow[] => {
    if (o.op === 'grantCareerSkill') { const l = refLabel('skills', { id: o.skillId, spec: o.spec }); return [{ t: 'ref', category: 'skills', label: statName(l), show: l }]; }
    if (o.op === 'grantCareerTalent') { const l = refLabel('talents', { id: o.talentId, spec: o.spec }); return [{ t: 'ref', category: 'talents', label: statName(l), show: l }]; }
    return [];
  });
  return rows.length ? { title, layout: 'chips', rows } : null;
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

/** Capacités-marqueurs IRRÉDUCTIBLES (TraitCapabilities/QualityCapabilities — flags booléens lus par
 *  le moteur) → section lisible. Le mapping flag→libellé (display) est fourni par l'appelant ; l'ordre
 *  suit le mapping. Ignore les non-booléens (Indices, encDelta…) — surfacés ailleurs s'il le faut. */
export function capabilitySection(caps: Record<string, unknown> | undefined, labels: Record<string, string>, title = 'Capacités'): CodexSection | null {
  if (!caps) return null;
  const present = Object.keys(labels).filter((k) => caps[k] === true).map((k) => labels[k]);
  return present.length ? { title, layout: 'list', rows: [{ t: 'text', text: present.join(' · ') }] } : null;
}

/** Effet MÉCANIQUE d'un Sort (`Flow` éditable : do/if/test) → section lisible (réutilise `flowSummary`).
 *  Source unique de la projection des effets de sort au Codex (≠ desc narrative). Vide → null. */
export function spellFlowSection(flow: Flow | undefined, title = 'Effet mécanique'): CodexSection | null {
  if (!flow) return null;
  const text = flowSummary(flow);
  return text ? { title, layout: 'list', rows: [{ t: 'text', text }] } : null;
}
