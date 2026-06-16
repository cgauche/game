/**
 * Couche `describe` du Codex — projette les données MÉCANIQUES d'une fiche (modificateurs passifs,
 * profil de manœuvre, effets déclenchés) en `CodexSection` lisibles. SOURCE UNIQUE réutilisée par
 * toutes les catégories porteuses (traits, mutations, qualités…) : enrichir une fiche = composer ces
 * sections, pas réécrire un rendu. Réutilise `opSummary` (le formateur d'ops de l'éditeur) et
 * `ATTACK_LABEL` (libellés de manœuvre) — aucun vocabulaire dupliqué.
 */
import type { CodexRow, CodexSection } from './registry';
import { opSummary } from '../editor/GameOpEditor';
import type { GameOp } from '../../engine/ops';
import type { TriggeredEffect, EffectTrigger } from '../../state/flow';

const TRIGGER_LABEL: Record<EffectTrigger, string> = {
  onHit: 'À la touche',
  onWoundLoss: 'En perdant des PB',
  onRoundStart: 'Au début du Round',
  onStartled: 'Surpris (magie / bruit)',
  onKill: 'En tuant un adversaire',
};
const ON_LABEL: Record<TriggeredEffect['on'], string> = {
  self: 'soi-même',
  victim: 'la victime',
  engaged: 'les adversaires engagés',
};

/** Modificateurs PASSIFS continus (`GameOp[]`) → section lisible (« +5 F », « −20 aux Tests de Soc »…). */
export function passiveSection(ops: GameOp[] | undefined, title = 'Modificateurs passifs'): CodexSection | null {
  if (!ops?.length) return null;
  return { title, layout: 'list', rows: ops.map((o) => ({ t: 'text', text: opSummary(o) }) as CodexRow) };
}

/** Effets DÉCLENCHÉS (`TriggeredEffect[]`) → lignes déclencheur → cible (le détail du Flow reste au desc). */
const effectRows = (effects: TriggeredEffect[] | undefined): CodexRow[] =>
  (effects ?? []).map((e) => ({ t: 'text', text: `${TRIGGER_LABEL[e.trigger]} → ${ON_LABEL[e.on]}` }) as CodexRow);

export function effectsSection(effects: TriggeredEffect[] | undefined, title = 'Effets déclenchés'): CodexSection | null {
  const rows = effectRows(effects);
  return rows.length ? { title, layout: 'list', rows } : null;
}
