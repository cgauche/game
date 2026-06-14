import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { RollFlowShell } from './RollFlowShell';
import { MultiRollList } from './MultiRollList';
import type { NightEntry } from '../state/restFlow';
import type { Combatant } from '../engine/types';

/**
 * CASCADE séquentielle influençable (jets de NUIT / VOYAGE) — COMPOSE les deux briques existantes,
 * sans rien réinventer : l'étape COURANTE est un jet standard du flot de base (`RollFlowShell` :
 * Lancer → Chance/+1 DR/Pacte/Résilience → « Valider ») ; les jets DÉJÀ validés s'EMPILENT au-dessus
 * via le BILAN partagé (`MultiRollList`, l'ancien écran de nuit) — portraits, lignes de jet, notes.
 * Une défaillance impacte la suite (escalade d'Exposition, abri → jets).
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
  const cancel = useGame((s) => s.cascadeCancel);

  if (!p) return null;
  const cur = p.participants[p.cursor];
  if (!cur) return null;
  const pool: Combatant[] = battle?.combatants ?? party;
  const actor = cur.actorId ? pool.find((c) => c.id === cur.actorId) : undefined;
  if (!actor) return null;
  const res = cur.result;
  const curRolled = cur.target == null ? true : !!res;
  const failed = !!res && !res.success;
  const isLast = p.cursor + 1 >= p.participants.length;
  const base = cur.base ?? cur.target ?? 0;

  // BILAN des étapes déjà validées + notes d'entretien → entrées du bilan partagé (MultiRollList).
  const done: NightEntry[] = p.log.map((l) => ({ icon: '📆', label: l, tone: 'info' as const }));
  for (const s of p.participants.slice(0, p.cursor)) {
    if (!s.result) continue;
    const b = s.base ?? s.target ?? 0;
    done.push({ actorId: s.actorId, icon: s.icon, label: s.label ?? 'Jet', tone: s.result.success ? 'ok' : 'bad',
      d: { label: s.rollLabel ?? 'Jet', base: b, modifier: (s.target ?? b) - b, target: s.target ?? b, roll: s.result.roll, success: s.result.success, sl: s.result.sl } });
    if (s.outcome?.length) done.push({ actorId: s.actorId, icon: '↳', label: s.outcome.join(' '), tone: s.result.success ? 'ok' : 'bad' });
  }

  return (
    <RollFlowShell
      title={`${p.icon ?? '🎲'} ${p.title}`}
      subtitle={<>{cur.icon ?? '🎲'} {cur.label} · étape {p.cursor + 1} / {p.participants.length}</>}
      extra={done.length ? <MultiRollList entries={done} /> : undefined}
      rolled={curRolled}
      rollLabel="🎲 Lancer"
      onRoll={() => roll(cur.id)}
      onCancel={cancel}
      cancelLabel="Renoncer"
      cancelAfterRoll
      rows={res ? [{ combatant: actor, d: { label: cur.rollLabel ?? 'Jet', base, modifier: (cur.target ?? base) - base, target: cur.target ?? base, roll: res.roll, success: res.success, sl: res.sl } }] : undefined}
      pending={!res && cur.target != null ? { label: cur.rollLabel ?? 'Jet', base, mods: cur.base != null && cur.target !== cur.base ? [{ label: 'difficulté', value: cur.target - cur.base }] : [] } : undefined}
      fortune={actor.fortune ?? 0}
      freeReroll={freeRerollOf(actor)}
      rerollable={!!res && canReroll(failed, !!cur.rerolled)}
      onReroll={() => reroll(cur.id)}
      onBonusSL={() => bonusSL(cur.id)}
      darkPactable={!!res && failed && actor.kind === 'hero'}
      onDarkPact={() => darkPact(cur.id)}
      resilience={actor.resilience ?? 0}
      onForce={() => force(cur.id)}
      forceShow={curRolled}
      confirmLabel={isLast ? '✅ Valider · Terminer' : '✅ Valider →'}
      onConfirm={() => next()}
    />
  );
}
