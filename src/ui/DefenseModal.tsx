import { useGame } from '../state/store';
import { HIT_LOCATION_LABELS } from '../engine/types';
import { defenseValue } from '../engine/combat';

/**
 * Modale de défense réactive : quand un ennemi (IA) attaque un héros en mêlée, le
 * joueur choisit Parade ou Esquive, clique « Défendre » (le jet de défense se fait
 * à ce moment), voit le résultat du Test opposé, peut dépenser un point de Chance
 * pour relancer SA défense (le jet d'attaque reste figé), puis « Appliquer ».
 * « Subir » = défense passive (aucune réaction). Le tour de l'IA reprend ensuite.
 */
export function DefenseModal() {
  const pd = useGame((s) => s.pendingDefense);
  const battle = useGame((s) => s.battle);
  const setMode = useGame((s) => s.defenseSetMode);
  const roll = useGame((s) => s.defenseRoll);
  const reroll = useGame((s) => s.defenseReroll);
  const confirm = useGame((s) => s.defenseConfirm);
  const subir = useGame((s) => s.defenseCancel);
  if (!pd || !battle) return null;
  const attacker = battle.combatants.find((c) => c.id === pd.attackerId);
  const defender = battle.combatants.find((c) => c.id === pd.defenderId);
  if (!attacker || !defender) return null;
  const res = pd.result;
  const fortune = defender.fortune ?? 0; // Chance DU DÉFENSEUR (le héros)
  const paradeVal = defenseValue(defender, 'parade');
  const esquiveVal = defenseValue(defender, 'esquive');

  return (
    <div className="modal-overlay">
      <div className="modal roll-modal">
        <h3>Défense</h3>
        <p className="rm-vs">
          <strong>{attacker.name}</strong> <span className="rm-weapon">({pd.weapon?.name ?? 'Mains nues'})</span> attaque →{' '}
          <strong>{defender.name}</strong>
        </p>

        {!res ? (
          <>
            <div className="rm-loc">
              <span className="mini-title">Réaction</span>
              <div className="rm-loc-grid">
                <button className={`btn small ${pd.mode === 'parade' ? 'btn-primary' : ''}`} onClick={() => setMode('parade')}>
                  Parade ({paradeVal})
                </button>
                <button className={`btn small ${pd.mode === 'esquive' ? 'btn-primary' : ''}`} onClick={() => setMode('esquive')}>
                  Esquive ({esquiveVal})
                </button>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={subir} title="Subir l'attaque sans te défendre">
                Subir
              </button>
              <button className="btn btn-primary" onClick={roll}>
                🛡️ Défendre
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Défense réussie (res.hit === false) = succès du héros → classe « ok ». */}
            <div className={`test-result ${res.hit ? 'fail' : 'ok'}`}>
              <span className="dice">{pd.def!.roll === 100 ? '00' : String(pd.def!.roll).padStart(2, '0')}</span>
              <span className="verdict">
                {res.hit
                  ? `Touché${res.location ? ` — ${HIT_LOCATION_LABELS[res.location]}` : ''}${res.woundsLost ? ` · ${res.woundsLost} Blessure(s)` : ''}${res.critical ? ' · CRITIQUE' : ''}`
                  : pd.mode === 'parade'
                    ? 'Paré !'
                    : 'Esquivé !'}
              </span>
            </div>
            <p className="rm-log">{res.log}</p>
            <div className="modal-actions">
              {fortune > 0 && (
                <button className="btn" onClick={reroll} title="Dépense un point de Chance pour relancer TA défense">
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
