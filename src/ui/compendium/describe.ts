/**
 * Couche `describe` du Codex — projette les données MÉCANIQUES d'une fiche (modificateurs passifs,
 * profil de manœuvre, effets déclenchés) en `CodexSection` lisibles. SOURCE UNIQUE réutilisée par
 * toutes les catégories porteuses (traits, mutations, qualités…) : enrichir une fiche = composer ces
 * sections, pas réécrire un rendu. Réutilise `opRows` (ref #495, renderer JOUEUR — chips codex-liées,
 * jamais le résumeur d'atelier `opSummary`), `humanizeCondition` (ref #495, renderer JOUEUR — jamais
 * le résumeur d'atelier `condSummary`) et `ATTACK_LABEL` (libellés de manœuvre).
 */
import type { CodexRow, CodexSection } from './registry';
import { opRows } from './opRows';
import type { GameOp } from '../../engine/ops';
import type { Flow, TriggeredEffect } from '../../state/flow';
import { refLabel } from '../../data';
import { statName } from '../../engine/statEntry';
import { TRIGGER_LABEL, onLabel } from './triggerLabels';
import { humanizeFlowSentence, humanizeOp, humanizeCondition } from './humanize';

/** Octrois de carrière (`grantCareerSkill`/`grantCareerTalent`) — affichés à part (cross-réf cliquable),
 *  jamais comme « modificateur continu ». Filtrés ici pour ne pas doublonner avec `careerGrantSection`. */
const CAREER_GRANT_OPS = new Set<GameOp['op']>(['grantCareerSkill', 'grantCareerTalent']);

/** Modificateurs PASSIFS continus (`GameOp[]`) → section lisible (« +5 F », « −20 aux Tests de Soc »…).
 *  Les octrois de carrière (compétence/talent ajouté à toute carrière) sont EXCLUS → `careerGrantSection`. */
export function passiveSection(ops: GameOp[] | undefined, title = 'Modificateurs passifs'): CodexSection | null {
  const mods = (ops ?? []).filter((o) => !CAREER_GRANT_OPS.has(o.op));
  if (!mods.length) return null;
  return { title, layout: 'list', rows: opRows(mods) };
}

/** Compétence/Talent ajouté à « n'importe quelle Carrière » (LDB 10, ops `grantCareerSkill`/
 *  `grantCareerTalent`) → chips CROSS-RÉF cliquables (id → libellé ; le lookup ignore la spec « Au choix »
 *  via `statName`). Source unique de la projection des octrois de carrière (talents Maître artisan, Flagellant…). */
export function careerGrantSection(ops: GameOp[] | undefined, title = 'Ajouté à vos carrières'): CodexSection | null {
  const rows: CodexRow[] = (ops ?? []).flatMap((o): CodexRow[] => {
    if (o.op === 'grantCareerSkill') { const l = refLabel('skills', { id: o.skillId, spec: o.spec }); return [{ t: 'ref', category: 'skills', id: o.skillId, label: statName(l), show: l }]; }
    if (o.op === 'grantCareerTalent') { const l = refLabel('talents', { id: o.talentId, spec: o.spec }); return [{ t: 'ref', category: 'talents', id: o.talentId, label: statName(l), show: l }]; }
    return [];
  });
  return rows.length ? { title, layout: 'chips', rows } : null;
}

/** Résumé LISIBLE d'un Flow d'effet (conditions `if` + ops `do`, jet `test`) — réutilise
 *  `humanizeCondition`/`humanizeOp` (registre JOUEUR). Le Test (SIMPLE ou OPPOSÉ) n'est PLUS une op :
 *  c'est un nœud de STRUCTURE Flow (`{kind:'test'}`) décrit ci-dessous (zéro vocabulaire dupliqué). */
function flowSummary(f: Flow): string {
  switch (f.kind) {
    case 'do': return f.effect.type === 'ops' ? f.effect.ops.map(humanizeOp).join(', ') : f.effect.type;
    case 'seq': return f.steps.map(flowSummary).filter(Boolean).join(' ; ');
    case 'if': return `si ${humanizeCondition(f.cond)} → ${flowSummary(f.then)}${f.else ? ` (sinon ${flowSummary(f.else)})` : ''}`;
    case 'test': {
      const who = f.test.skill ? refLabel('skills', { id: f.test.skill, spec: f.test.spec }) : (f.test.characteristic ?? '');
      const opp = f.test.opposed ? ` opposé (${f.test.opposed.attackerLabel ?? f.test.opposed.attacker})` : '';
      return `jet${opp} ${who} → réussite : ${flowSummary(f.success)} / échec : ${flowSummary(f.fail)}`;
    }
    case 'choice':
      return `choix${f.cost ? ` (${f.cost.advantage} Av)` : ''} « ${f.prompt} » → oui : ${flowSummary(f.yes)}${f.no ? ` / non : ${flowSummary(f.no)}` : ''}`;
  }
}

/** Effets DÉCLENCHÉS (`TriggeredEffect[]`) → déclencheur + cible, PUIS la phrase JOUEUR (`humanize`) de ce
 *  que l'effet fait, avec la forme TECHNIQUE d'atelier (`flowSummary`) repliée dans « Détail technique ». */
const effectRows = (effects: TriggeredEffect[] | undefined): CodexRow[] =>
  (effects ?? []).flatMap((e) => {
    const head = `${TRIGGER_LABEL[e.trigger]} — ${onLabel(e.on)}`;
    const human = humanizeFlowSentence(e.flow);
    const tech = flowSummary(e.flow);
    const rows: CodexRow[] = [
      { t: 'sub', label: head },
      { t: 'text', text: human || '(aucun effet)' },
    ];
    if (tech) rows.push({ t: 'fold', summary: 'Détail technique', text: tech });
    return rows;
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
  const human = humanizeFlowSentence(flow);
  const tech = flowSummary(flow);
  const rows: CodexRow[] = [];
  if (human) rows.push({ t: 'text', text: human });
  if (tech) rows.push({ t: 'fold', summary: 'Détail technique', text: tech });
  return rows.length ? { title, layout: 'list', rows } : null;
}
