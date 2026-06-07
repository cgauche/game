import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { ResilienceButton } from './ResilienceButton';

/**
 * Modale d'entrée en Frénésie (LDB 21 l.32) : « Lancer » jette le Test de Force Mentale,
 * « Relancer »/« Réussite garantie » dépensent Chance/Résilience, « Appliquer » fige le résultat
 * (entre en Frénésie sur succès). Test binaire (pas de DR) → pas de « +1 DR ». Invariante « un jet = une modale ».
 */
export function FrenzyModal() {
  const pf = useGame((s) => s.pendingFrenzy);
  const battle = useGame((s) => s.battle);
  const roll = useGame((s) => s.frenzyRoll);
  const reroll = useGame((s) => s.frenzyReroll);
  const force = useGame((s) => s.frenzyForceSuccess);
  const confirm = useGame((s) => s.frenzyConfirm);
  const cancel = useGame((s) => s.frenzyCancel);
  if (!pf || !battle) return null;
  const c = battle.combatants.find((x) => x.id === pf.combatantId);
  if (!c) return null;
  const r = pf.result;
  const fortune = c.fortune ?? 0;
  const rerollable = !!r && !r.success && canReroll(true, !!pf.rerolled) && fortune > 0;

  return (
    <div className="modal-overlay">
      <div className="modal roll-modal">
        <h3>🐗 Frénésie</h3>
        <p className="rm-vs">
          <strong>{c.name}</strong> tente d'entrer en Frénésie (Test de Force Mentale)
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
            <div className={`test-result ${r.success ? 'ok' : 'fail'}`}>
              <span className="dice">{r.roll === 100 ? '00' : String(r.roll).padStart(2, '0')}</span>
              <span className="verdict">{r.success ? 'Frénésie ! (+1 BF, immunité psy, attaque obligatoire)' : 'Échec — pas de Frénésie ce tour'}</span>
            </div>
            <div className="modal-actions">
              {rerollable && (
                <button className="btn" onClick={reroll} title="Dépense un point de Chance pour relancer le Test (LDB Destin)">
                  🍀 Relancer ({fortune})
                </button>
              )}
              <ResilienceButton resilience={c.resilience ?? 0} show={!r.success} onForce={force} />
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
