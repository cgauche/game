import { useGame } from '../state/store';
import { HitLocation, HIT_LOCATION_LABELS } from '../engine/types';

const LOCS: HitLocation[] = ['tete', 'corps', 'brasD', 'brasG', 'jambeD', 'jambeG'];

/**
 * Modale d'attaque : on choisit la localisation visée (Complexe -10), on clique
 * « Lancer » pour faire le jet, puis on peut dépenser un point de Chance pour
 * relancer avant d'appliquer le résultat (LDB Destin / Combat).
 */
export function RollModal() {
  const pa = useGame((s) => s.pendingAttack);
  const battle = useGame((s) => s.battle);
  const setLocation = useGame((s) => s.attackSetLocation);
  const roll = useGame((s) => s.attackRoll);
  const reroll = useGame((s) => s.attackReroll);
  const confirm = useGame((s) => s.attackConfirm);
  const cancel = useGame((s) => s.attackCancel);
  if (!pa || !battle) return null;
  const attacker = battle.combatants.find((c) => c.id === pa.attackerId);
  const target = battle.combatants.find((c) => c.id === pa.targetId);
  if (!attacker || !target) return null;
  const weapon = attacker.weapons[0];
  const res = pa.result;
  const fortune = attacker.fortune ?? 0;

  return (
    <div className="modal-overlay">
      <div className="modal roll-modal">
        <h3>Attaque</h3>
        <p className="rm-vs">
          <strong>{attacker.name}</strong> <span className="rm-weapon">({weapon?.name ?? 'Mains nues'})</span> →{' '}
          <strong>{target.name}</strong>
        </p>

        {!res ? (
          <>
            <div className="rm-loc">
              <span className="mini-title">Localisation visée {pa.location && <em className="rm-pen">(-10)</em>}</span>
              <div className="rm-loc-grid">
                <button className={`btn small ${pa.location == null ? 'btn-primary' : ''}`} onClick={() => setLocation(null)}>
                  Au hasard
                </button>
                {LOCS.map((l) => (
                  <button
                    key={l}
                    className={`btn small ${pa.location === l ? 'btn-primary' : ''}`}
                    onClick={() => setLocation(l)}
                  >
                    {HIT_LOCATION_LABELS[l]}
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={cancel}>
                Annuler
              </button>
              <button className="btn btn-primary" onClick={roll}>
                🎲 Lancer
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={`test-result ${res.hit ? 'ok' : 'fail'}`}>
              <span className="dice">{res.attackerRoll === 100 ? '00' : String(res.attackerRoll).padStart(2, '0')}</span>
              <span className="verdict">
                {res.hit ? `Touché${res.location ? ` — ${HIT_LOCATION_LABELS[res.location]}` : ''}` : 'Manqué'}
                {res.hit && res.woundsLost ? ` · ${res.woundsLost} Blessure(s)` : ''}
                {res.critical ? ' · CRITIQUE' : ''}
              </span>
            </div>
            <p className="rm-log">{res.log}</p>
            <div className="modal-actions">
              {fortune > 0 && (
                <button className="btn" onClick={reroll} title="Dépense un point de Chance pour relancer le jet">
                  🍀 Chance ({fortune})
                </button>
              )}
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
