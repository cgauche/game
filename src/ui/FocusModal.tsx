import { useGame } from '../state/store';
import { findSpell } from '../data/index';
import { canReroll } from '../engine/fortune';
import { ChanceButtons } from './ChanceButtons';
import { ResilienceButton } from './ResilienceButton';

/**
 * Modale de Focalisation (LDB — Test étendu de Focalisation) : « Lancer » accumule du DR vers le NI,
 * « Chance » rejoue/ajoute, « Appliquer » fige l'accumulation. Invariante « un jet = une modale ».
 */
export function FocusModal() {
  const pf = useGame((s) => s.pendingFocus);
  const battle = useGame((s) => s.battle);
  const party = useGame((s) => s.party);
  const roll = useGame((s) => s.focusRoll);
  const reroll = useGame((s) => s.focusReroll);
  const bonusSL = useGame((s) => s.focusBonusSL);
  const force = useGame((s) => s.focusForceSuccess);
  const confirm = useGame((s) => s.focusConfirm);
  const cancel = useGame((s) => s.focusCancel);
  if (!pf) return null;
  const caster = (battle?.combatants ?? party).find((c) => c.id === pf.casterId); // combat (file) ou hors combat (groupe)
  if (!caster) return null;
  const spell = findSpell(pf.spellLabel);
  const ni = spell?.cn ?? 0;
  const prev = caster.focus?.spell === pf.spellLabel ? caster.focus.dr : 0;
  const r = pf.result;
  const fortune = caster.fortune ?? 0;
  const rerollable = !!r && canReroll(r.dr === 0, !!pf.rerolled);

  return (
    <div className="modal-overlay">
      <div className="modal roll-modal">
        <h3>✨ Focalisation</h3>
        <p className="rm-vs">
          <strong>{caster.name}</strong> focalise <strong>{spell?.label ?? pf.spellLabel}</strong> ({prev}/{ni} DR)
        </p>
        {!r ? (
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={roll}>
              🎲 Lancer
            </button>
            <button className="btn" onClick={cancel}>
              Annuler
            </button>
          </div>
        ) : (
          <>
            <div className={`test-result ${r.dr > 0 ? 'ok' : 'fail'}`}>
              <span className="dice">{r.roll === 100 ? '00' : String(r.roll).padStart(2, '0')}</span>
              <span className="verdict">
                {r.log} → {prev + r.dr}/{ni} DR{prev + r.dr >= ni ? ' (NI 0 atteint !)' : ''}
              </span>
            </div>
            <div className="modal-actions">
              <ChanceButtons fortune={fortune} rerollable={rerollable} onReroll={reroll} onBonusSL={bonusSL} />
              <ResilienceButton resilience={caster.resilience ?? 0} show={r.dr === 0} onForce={force} />
              <button className="btn btn-primary" onClick={confirm}>
                Appliquer
              </button>
              <button className="btn" onClick={cancel}>
                Annuler
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
