import { useGame } from '../state/store';
import { HitLocation, HIT_LOCATION_LABELS } from '../engine/types';
import { RollBreakdown } from '../engine/combat';
import { canReroll } from '../engine/fortune';
import { ChanceButtons } from './ChanceButtons';

const LOCS: HitLocation[] = ['tete', 'corps', 'brasD', 'brasG', 'jambeD', 'jambeG'];

/** Une ligne de jet : base + modificateurs = cible · d100 · DR (✓/✗). */
export function RollLine({ d }: { d: RollBreakdown }) {
  const roll = d.roll === 100 ? '00' : String(d.roll).padStart(2, '0');
  const mod = d.modifier === 0 ? '' : ` ${d.modifier > 0 ? '+' : '−'}${Math.abs(d.modifier)}`;
  return (
    <div className={`rm-roll ${d.success ? 'ok' : 'fail'}`}>
      <span className="rm-roll-label">{d.label}</span>
      <span className="rm-roll-calc" title="Compétence de base + modificateurs (Avantage, viser, États…) = cible à ne pas dépasser">
        {d.base}
        {mod} = <b>{d.target}</b>
      </span>
      <span className="rm-roll-dice">
        🎲 <b>{roll}</b>
      </span>
      <span className="rm-roll-sl">
        {d.success ? '✓' : '✗'} {d.sl >= 0 ? '+' : '−'}
        {Math.abs(d.sl)} DR
      </span>
    </div>
  );
}

/**
 * Modale d'attaque : on choisit la localisation visée (Complexe -10), on clique
 * « Lancer » pour faire le jet, puis on peut dépenser un point de Chance pour
 * relancer avant d'appliquer le résultat (LDB Destin / Combat).
 *
 * La mêlée est un TEST OPPOSÉ : on affiche donc les DEUX jets (attaquant ET défenseur),
 * leur cible (base + modificateurs) et leur DR — c'est le DR net qui décide.
 */
export function RollModal() {
  const pa = useGame((s) => s.pendingAttack);
  const battle = useGame((s) => s.battle);
  const setLocation = useGame((s) => s.attackSetLocation);
  const roll = useGame((s) => s.attackRoll);
  const reroll = useGame((s) => s.attackReroll);
  const bonusSL = useGame((s) => s.attackBonusSL);
  const confirm = useGame((s) => s.attackConfirm);
  const cancel = useGame((s) => s.attackCancel);
  if (!pa || !battle) return null;
  const attacker = battle.combatants.find((c) => c.id === pa.attackerId);
  const target = battle.combatants.find((c) => c.id === pa.targetId);
  if (!attacker || !target) return null;
  const weapon = attacker.weapons[0];
  const res = pa.result;
  const fortune = attacker.fortune ?? 0;
  const rerollable = !!res && canReroll(!res.attackerDetail?.success, !!pa.rerolled);

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
                  <button key={l} className={`btn small ${pa.location === l ? 'btn-primary' : ''}`} onClick={() => setLocation(l)}>
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
            <div className="rm-rolls">
              {res.attackerDetail && <RollLine d={res.attackerDetail} />}
              {res.defenderDetail && <RollLine d={res.defenderDetail} />}
            </div>
            <div className={`rm-verdict ${res.hit ? 'ok' : 'fail'}`}>
              {res.hit ? (
                <>
                  Touché{res.location ? ` — ${HIT_LOCATION_LABELS[res.location]}` : ''}
                  {res.woundsLost ? ` · ${res.woundsLost} Blessure(s)` : ''}
                  {res.defenderDetail ? ` · DR net +${res.netSL}` : ''}
                  {res.critical ? ' · CRITIQUE' : ''}
                </>
              ) : res.defenderDetail ? (
                'Défense réussie — coup paré / esquivé'
              ) : (
                'Manqué'
              )}
            </div>
            <p className="rm-log">{res.log}</p>
            <div className="modal-actions">
              <ChanceButtons fortune={fortune} rerollable={rerollable} onReroll={reroll} onBonusSL={bonusSL} />
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
