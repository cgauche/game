import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { RollFlowShell } from './RollFlowShell';
import { RollPanel, type RollRowData } from './RollPanel';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';
import type { CascadeStep, CascadeRoll } from '../state/pendings';
import type { Combatant } from '../engine/types';

/**
 * CASCADE de jets SÉQUENTIELS (nuit / voyage) — c'est LA coquille de jet partagée `RollFlowShell`,
 * paramétrée comme `DefenseModal` : plusieurs LIGNES de jet avec portraits (`RollPanel rows`), les
 * étapes déjà validées FIGÉES, l'étape COURANTE active (pending → résultat) avec son cycle Chance/
 * +1 DR/Pacte/Résilience. « Continuer » enchaîne sur le jet suivant. Aucun affichage différent d'une
 * autre modale. Nuit SUBIE → pas d'« Annuler » (comme TestModal/CorruptionModal).
 */
export function CascadeModal() {
  const battle = useGame((s) => s.battle);
  const party = useGame((s) => s.party);
  const p = useGame((s) => s.pendingCascade);
  const roll = useGame((s) => s.cascadeRoll);
  const reroll = useGame((s) => s.cascadeReroll);
  const bonusSL = useGame((s) => s.cascadeBonusSL);
  const darkPact = useGame((s) => s.cascadeDarkPact);
  const force = useGame((s) => s.cascadeForceSuccess);
  const next = useGame((s) => s.cascadeNext);

  if (!p) return null;
  const cur = p.participants[p.cursor];
  if (!cur) return null;
  const pool: Combatant[] = battle?.combatants ?? party;
  const actorOf = (s: CascadeStep) => (s.actorId ? pool.find((c) => c.id === s.actorId) : undefined);
  const actor = actorOf(cur);
  if (!actor) return null;
  const res = cur.result;
  const rolled = cur.target == null ? true : !!res;
  const failed = !!res && !res.success;
  const isLast = p.cursor + 1 >= p.participants.length;

  const breakdown = (s: CascadeStep, r: CascadeRoll) => {
    const b = s.base ?? s.target ?? 0;
    return { label: s.label ?? s.rollLabel ?? 'Jet', base: b, modifier: (s.target ?? b) - b, target: s.target ?? b, roll: r.roll, success: r.success, sl: r.sl };
  };
  const pendingOf = (s: CascadeStep) => {
    const b = s.base ?? s.target ?? 0;
    return { label: s.label ?? s.rollLabel ?? 'Jet', base: b, mods: s.base != null && s.target != null && s.target !== s.base ? [{ label: 'difficulté', value: s.target - s.base }] : [] };
  };
  // Lignes des étapes DÉJÀ validées (figées), avec portrait — comme la ligne attaquant de Défense.
  const doneRows: RollRowData[] = p.participants.slice(0, p.cursor)
    .map((s): RollRowData | null => { const a = actorOf(s); return a && s.result ? { combatant: a, d: breakdown(s, s.result) } : null; })
    .filter((r): r is RollRowData => r !== null);
  const curPending: RollRowData = { combatant: actor, pending: pendingOf(cur) };
  const outcomeText = res ? (res.success ? `${actor.name} réussit.` : `${actor.name} échoue.`) : '';

  return (
    <RollFlowShell
      title={`${p.icon ?? '🎲'} ${p.title}`}
      subtitle={<><strong>{cur.icon ?? '🎲'} {cur.label}</strong>{p.participants.length > 1 ? ` · jet ${p.cursor + 1}/${p.participants.length}` : ''}</>}
      rolled={rolled}
      onRoll={() => roll(cur.id)}
      /* Pré-jet : panneau multi-lignes (validées figées + courante en attente) — comme Défense. */
      setup={<RollPanel rows={[...doneRows, curPending]} />}
      /* Post-jet : mêmes lignes, la courante désormais lancée (vainqueur non pertinent ici). */
      rows={res ? [...doneRows, { combatant: actor, d: breakdown(cur, res) }] : undefined}
      outcome={res ? <JournalLine className="rm-journal" event={ev('info', outcomeText, actor.id)} combatants={pool} /> : undefined}
      fortune={actor.fortune ?? 0}
      freeReroll={freeRerollOf(actor)}
      rerollable={!!res && canReroll(failed, !!cur.rerolled)}
      onReroll={() => reroll(cur.id)}
      onBonusSL={() => bonusSL(cur.id)}
      darkPactable={!!res && failed && actor.kind === 'hero'}
      onDarkPact={() => darkPact(cur.id)}
      resilience={actor.resilience ?? 0}
      onForce={() => force(cur.id)}
      forceShow={rolled && !res?.success}
      confirmLabel={isLast ? 'Terminer' : 'Continuer'}
      onConfirm={() => next()}
    />
  );
}
