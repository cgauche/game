import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { ChanceButtons } from './ChanceButtons';
import { ResilienceButton } from './ResilienceButton';

/**
 * Modale de Test de Psychologie (Calme) du héros (LDB 21) : Peur (Test ÉTENDU — cumuler le DR vers
 * l'Indice) ou Terreur (1ʳᵉ rencontre → Brisé). « Lancer » → « Chance » → « Appliquer ». Le Test est
 * obligatoire (pas d'Annuler). Invariante « un jet = une modale ».
 */
export function PsychModal() {
  const pp = useGame((s) => s.pendingPsych);
  const battle = useGame((s) => s.battle);
  const roll = useGame((s) => s.psychRoll);
  const reroll = useGame((s) => s.psychReroll);
  const bonusSL = useGame((s) => s.psychBonusSL);
  const force = useGame((s) => s.psychForceSuccess);
  const confirm = useGame((s) => s.psychConfirm);
  if (!pp || !battle) return null;
  const c = battle.combatants.find((x) => x.id === pp.combatantId);
  const source = battle.combatants.find((x) => x.id === pp.sourceId);
  if (!c) return null;
  const r = pp.result;
  const fortune = c.fortune ?? 0;
  const isTerreur = pp.kind === 'terreur';
  const failed = r ? (isTerreur ? !r.success : (r.dr ?? 0) === 0) : false;
  const rerollable = !!r && canReroll(failed, !!pp.rerolled);
  const ok = r ? (isTerreur ? !!r.success : !!r.vaincue) : false;

  return (
    <div className="modal-overlay">
      <div className="modal roll-modal">
        <h3>{isTerreur ? '😱 Terreur' : '😨 Peur'} {pp.indice}</h3>
        <p className="rm-vs">
          <strong>{c.name}</strong> doit garder son sang-froid face à <strong>{source?.name ?? '?'}</strong>
          {!isTerreur && ` (${pp.prevDR}/${pp.indice} DR)`}
        </p>
        {!r ? (
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={roll}>
              🎲 Test de Calme
            </button>
          </div>
        ) : (
          <>
            <div className={`test-result ${ok ? 'ok' : 'fail'}`}>
              <span className="dice">{r.roll === 100 ? '00' : String(r.roll).padStart(2, '0')}</span>
              <span className="verdict">
                {isTerreur
                  ? r.success
                    ? 'Sang-froid gardé.'
                    : `Terrifié : ${r.brise} État(s) Brisé, puis Peur ${pp.indice}.`
                  : r.vaincue
                    ? `Peur surmontée ! (${r.calmeDR}/${pp.indice} DR)`
                    : `Toujours apeuré (${r.calmeDR}/${pp.indice} DR).`}
              </span>
            </div>
            <div className="modal-actions">
              <ChanceButtons fortune={fortune} rerollable={rerollable} onReroll={reroll} onBonusSL={bonusSL} />
              <ResilienceButton resilience={c.resilience ?? 0} show={!ok} onForce={force} />
              <button className="btn btn-primary" onClick={confirm}>
                Appliquer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
