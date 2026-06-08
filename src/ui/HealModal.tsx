import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { healWoundsDelta } from '../engine/healing';
import { surgeryTraumas } from '../engine/trauma';
import { ChanceButtons } from './ChanceButtons';
import { ResilienceButton } from './ResilienceButton';

/**
 * Modale de soin (Guérison, LDB 09-Compétences) : « Lancer » jette le Test (Intermédiaire +0),
 * Chance (relance / +1 DR) et Résilience modulent, « Appliquer » applique. Invariante « un jet = une modale ».
 * La CHIRURGIE est un Test ÉTENDU (LDB 10 l.154 / 12 l.200) : on « Opère » passe par passe (cumul de DR,
 * 1d10 PB + Hémorragie par passe) jusqu'à la cible. Le soigneur peut être un PNJ hors du groupe (médecin
 * payant) : sa Chance/Résilience valent alors 0 — le joueur voit le jet sans pouvoir l'influencer.
 */
export function HealModal() {
  const ph = useGame((s) => s.pendingHeal);
  const battle = useGame((s) => s.battle);
  const party = useGame((s) => s.party);
  const roll = useGame((s) => s.healRoll);
  const reroll = useGame((s) => s.healReroll);
  const bonusSL = useGame((s) => s.healBonusSL);
  const force = useGame((s) => s.healForceSuccess);
  const confirm = useGame((s) => s.healConfirm);
  const cancel = useGame((s) => s.healCancel);
  const setTarget = useGame((s) => s.healSetTarget);
  const surgeryPass = useGame((s) => s.surgeryPass);
  const surgerySetWound = useGame((s) => s.surgerySetWound);
  if (!ph) return null;
  const pool = battle?.combatants ?? party; // même modale en combat (file) et hors combat (groupe)
  const healer = pool.find((c) => c.id === ph.healerId); // peut être absent (PNJ médecin) → Chance/Résilience à 0
  const fortune = healer?.fortune ?? 0;
  const rolled = ph.roll != null;
  // Sélection de la cible (PNJ soigneur) : avant le jet, si plusieurs héros sont éligibles.
  const choices = !rolled && (ph.candidateIds?.length ?? 0) > 1
    ? (ph.candidateIds ?? []).map((id) => party.find((c) => c.id === id)).filter(Boolean) as typeof party
    : [];
  const targetPicker = choices.length > 0 && (
    <div className="heal-target-pick">
      <span className="branch-label">Qui soigner ?</span>
      <div className="modal-actions">
        {choices.map((c) => (
          <button key={c.id} className={`btn small${c.id === ph.targetId ? ' btn-primary' : ''}`} onClick={() => setTarget(c.id)}>
            {c.name} ({c.wounds.current}/{c.wounds.max})
          </button>
        ))}
      </div>
    </div>
  );

  // ── CHIRURGIE : Test ÉTENDU (cumul de DR, passe par passe) ──
  if (ph.mode === 'surgery') {
    const target = pool.find((c) => c.id === ph.targetId);
    const cible = ph.surgeryTargetDR ?? 7;
    const cum = ph.surgeryCumDR ?? 0;
    const started = cum > 0 || rolled;
    const wnds = target ? surgeryTraumas(target) : [];
    return (
      <div className="modal-overlay">
        <div className="modal roll-modal">
          <h3>🔪 Chirurgie — Test étendu de Guérison</h3>
          <p className="rm-vs">
            <strong>{ph.healerName}</strong> opère <strong>{ph.targetName}</strong>{' '}
            <span className="rm-weapon">(cumuler {cible} DR · Intermédiaire +0)</span>
          </p>
          {!started && targetPicker}
          {!started && wnds.length > 1 && (
            <div className="heal-target-pick">
              <span className="branch-label">Quelle Blessure Critique opérer ?</span>
              <div className="modal-actions">
                {wnds.map((t, i) => (
                  <button key={i} className={`btn small${i === (ph.surgeryTraumaIdx ?? 0) ? ' btn-primary' : ''}`} onClick={() => surgerySetWound(i)}>
                    {t.label} ({t.location})
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="test-result">
            <span className="verdict">
              DR cumulé <strong>{cum} / {cible}</strong>
              {rolled && ` — dernière passe : ${ph.sl >= 0 ? '+' : ''}${ph.sl} DR`}
              {target && ` · ${target.name} ${target.wounds.current}/${target.wounds.max} PB`}
            </span>
          </div>
          <p className="rm-note">Chaque passe inflige 1d10 PB + 1 Hémorragie (LDB 10). À 0 PB, l’opération s’interrompt.</p>
          <div className="modal-actions">
            <button className="btn" onClick={cancel}>Arrêter</button>
            <button className="btn btn-primary" onClick={surgeryPass}>🔪 Opérer (une passe)</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Soin de Blessures / Hémorragie / Déchirure : un jet → Appliquer ──
  const rerollable = rolled && canReroll(ph.roll! > ph.target, !!ph.rerolled) && fortune > 0;
  const wounds = ph.mode === 'wounds';
  const trauma = ph.mode === 'trauma';
  const preview = wounds ? healWoundsDelta(ph.intBonus, ph.sl, ph.success) : null;
  return (
    <div className="modal-overlay">
      <div className="modal roll-modal">
        <h3>{wounds ? '🩹 Soigner les Blessures' : trauma ? '🦵 Soigner une déchirure' : '🩸 Arrêter l’Hémorragie'}</h3>
        <p className="rm-vs">
          <strong>{ph.healerName}</strong> soigne <strong>{ph.targetName}</strong>{' '}
          <span className="rm-weapon">(Guérison, Intermédiaire +0)</span>
        </p>
        {targetPicker}
        {!rolled ? (
          <div className="modal-actions">
            <button className="btn" onClick={cancel}>Annuler</button>
            <button className="btn btn-primary" onClick={roll}>🎲 Lancer</button>
          </div>
        ) : (
          <>
            <div className={`test-result ${ph.success ? 'ok' : 'fail'}`}>
              <span className="dice">{ph.roll === 100 ? '00' : String(ph.roll).padStart(2, '0')}</span>
              <span className="verdict">
                {ph.success
                  ? wounds
                    ? `Réussi (+${ph.sl} DR) — +${preview} PB`
                    : trauma
                      ? `Réussi (+${ph.sl} DR) — convalescence raccourcie de ${1 + Math.max(0, ph.sl)} jour(s)`
                      : `Réussi (+${ph.sl} DR) — ${1 + Math.max(0, ph.sl)} pion(s) d'Hémorragie stoppé(s)`
                  : wounds && ph.intBonus + ph.sl < 0
                    ? `Échec — le soin blesse (${ph.intBonus + ph.sl} PB)`
                    : 'Échec — sans effet'}
              </span>
            </div>
            <div className="modal-actions">
              <ChanceButtons fortune={fortune} rerollable={rerollable} onReroll={reroll} onBonusSL={bonusSL} />
              <ResilienceButton resilience={healer?.resilience ?? 0} show={!ph.success} onForce={force} />
              <button className="btn btn-primary" onClick={confirm}>Appliquer</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
