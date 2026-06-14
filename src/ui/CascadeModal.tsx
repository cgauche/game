import { useEffect } from 'react';
import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { Modal } from './Modal';
import { ParticipantRow } from './ParticipantRow';

/**
 * CASCADE séquentielle influençable (jets de NUIT / VOYAGE) — pendant UI du flux `cascade`. On
 * présente UNE étape à la fois (`participants[cursor]`) : son jet est AUTO-lancé (le sommeil/la route
 * arrivent au héros — il ne « choisit » pas de lancer, seulement d'INFLUENCER), puis Chance/+1 DR/
 * Pacte/Résilience, et « Étape suivante → » valide la conséquence et enchaîne (`cascadeNext`). Le
 * journal de la cascade s'accumule sous l'étape. Régime SÉQUENTIEL choisi par l'utilisateur (vs bilan
 * parallèle) — cf. docs/superpowers/specs/2026-06-14-multi-roll-modal-design.md, Étape 3.
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

  const cur = p?.participants[p.cursor];
  const hasRoll = !!cur && cur.target != null;
  const curId = cur?.id;
  const rolled = !cur ? false : hasRoll ? !!cur.result : true;
  // Le jet d'une étape subie est AUTO-lancé (le héros n'a qu'à l'influencer ensuite).
  useEffect(() => {
    if (cur && hasRoll && !cur.result) roll(cur.id);
  }, [curId, cur?.result, hasRoll, roll, cur]);

  if (!p || !cur) return null;
  const pool = battle?.combatants ?? party;
  const actor = cur.actorId ? pool.find((c) => c.id === cur.actorId) : undefined;
  const res = cur.result;
  const stepLabel = cur.rollLabel ?? cur.label ?? 'Jet';
  const row = res
    ? { combatant: actor!, d: { label: stepLabel, base: cur.base ?? cur.target!, modifier: cur.target! - (cur.base ?? cur.target!), target: cur.target!, roll: res.roll, success: res.success, sl: res.sl } }
    : { combatant: actor!, pending: { label: stepLabel, base: cur.base ?? cur.target ?? 0, mods: cur.target != null && cur.base != null ? [{ label: 'difficulté', value: cur.target - cur.base }] : [] } };

  return (
    <Modal title={`${p.icon ?? '🎲'} ${p.title}`} variant="roll" onClose={cancel}>
      <p className="rm-vs">
        <strong>{cur.label ?? actor?.name ?? '—'}</strong> · étape {p.cursor + 1} / {p.participants.length}
      </p>
      {actor && hasRoll ? (
        <ParticipantRow
          actor={actor}
          row={row}
          rolled={rolled}
          onRoll={() => roll(cur.id)}
          rerollable={rolled && !!res && canReroll(!res.success, !!cur.rerolled)}
          onReroll={() => reroll(cur.id)}
          onBonusSL={() => bonusSL(cur.id)}
          darkPactable={actor.kind === 'hero' && rolled && !!res && !res.success}
          onDarkPact={() => darkPact(cur.id)}
          onForce={() => force(cur.id)}
          forceShow={rolled}
          extra={res && (
            <div className={`cs-outcome ${res.success ? 'ok-text' : 'muted'}`}>
              {res.success ? `réussite (+${res.sl} DR)` : `échec (${res.sl} DR)`}
            </div>
          )}
        />
      ) : (
        <p className="cascade-note">{cur.icon ?? '•'} {cur.label}{cur.text ? ` — ${cur.text}` : ''}</p>
      )}
      {p.log.length > 0 && (
        <ul className="cascade-log">
          {p.log.slice(-6).map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      )}
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={cancel}>Renoncer</button>
        <button className="btn btn-primary" onClick={() => next()} disabled={!rolled}>
          {p.cursor + 1 >= p.participants.length ? '✅ Terminer' : 'Étape suivante →'}
        </button>
      </div>
    </Modal>
  );
}
