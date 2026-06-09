import { useState } from 'react';
import { useGame } from '../state/store';
import { HIT_LOCATION_LABELS } from '../engine/types';
import { defenseValue } from '../engine/combat';
import { RollLine } from './RollModal';
import { canReroll } from '../engine/fortune';
import { ChanceButtons } from './ChanceButtons';
import { ResilienceButton } from './ResilienceButton';
import { CombatantBadge } from './CombatantBadge';

/** Libellé FR de la nature d'une attaque gratuite de créature (freeKind) pour le contexte de défense. */
const FREE_LABEL: Record<string, string> = {
  morsure: 'Morsure', caudale: 'Attaque caudale', cornes: 'Cornes (charge)', pietinement: 'Piétinement',
  langue: 'Langue', hurlement: 'Hurlement',
};

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
  const bonusSL = useGame((s) => s.defenseBonusSL);
  const forceSuccess = useGame((s) => s.defenseForceSuccess);
  const confirm = useGame((s) => s.defenseConfirm);
  const subir = useGame((s) => s.defenseCancel);
  const [rolling, setRolling] = useState(false); // frisson du dé (R3), cosmétique
  if (!pd || !battle) return null;
  const attacker = battle.combatants.find((c) => c.id === pd.attackerId);
  const defender = battle.combatants.find((c) => c.id === pd.defenderId);
  if (!attacker || !defender) return null;
  const res = pd.result;
  const fortune = defender.fortune ?? 0; // Chance DU DÉFENSEUR (le héros)
  const rerollable = !!res && canReroll(!pd.def?.success, !!pd.rerolled);
  const paradeVal = defenseValue(defender, 'parade');
  const esquiveVal = defenseValue(defender, 'esquive');
  const reduceMotion = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const doRoll = () => {
    if (reduceMotion) return roll();
    setRolling(true);
    window.setTimeout(() => { setRolling(false); roll(); }, 480); // le jet (seeded) n'a lieu qu'à la fin du frisson
  };

  return (
    <div className="modal-overlay">
      <div className="modal roll-modal">
        <h3>Défense</h3>
        <div className="rm-vs">
          <CombatantBadge combatant={attacker} />
          <span className="rm-vs-arrow"><span className="rm-weapon">{pd.weapon?.name ?? 'Mains nues'}</span><br />attaque →</span>
          <CombatantBadge combatant={defender} />
        </div>

        {!res ? (
          <>
            {/* Contexte de l'attaque entrante (R10) : on défendait sans savoir ce qui arrivait. On montre
                la NATURE (attaque gratuite de créature) et la FORCE (DR de l'attaquant figé) → à battre. */}
            <div className="rm-threat">
              ⚔️ Attaque entrante{pd.freeKind ? ` · ${FREE_LABEL[pd.freeKind] ?? 'gratuite'}` : ''} : a obtenu <b>+{pd.atk.sl} DR</b>
              {' '}— il faut faire mieux en {pd.mode === 'parade' ? 'Parade' : 'Esquive'}.
            </div>
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
            {rolling ? (
              <div className="rm-rolling"><span className="rm-die">🎲</span></div>
            ) : (
              <div className="modal-actions">
                <button className="btn" onClick={subir} title="Subir l'attaque sans te défendre">
                  Subir
                </button>
                <button className="btn btn-primary" onClick={doRoll}>
                  🛡️ Défendre
                </button>
                {/* Résilience AVANT le jet (LDB 17 l.73) : force la réussite (sans frisson). */}
                <ResilienceButton resilience={defender.resilience ?? 0} show={(defender.resilience ?? 0) > 0} onForce={() => { roll(); forceSuccess(); }} />
              </div>
            )}
          </>
        ) : (
          <>
            {/* Test opposé : on montre le jet de l'attaquant ET celui du défenseur. */}
            <div className="rm-rolls">
              {res.attackerDetail && <RollLine d={res.attackerDetail} />}
              {res.defenderDetail && <RollLine d={res.defenderDetail} />}
            </div>
            {/* Défense réussie (res.hit === false) = succès du héros → classe « ok ». */}
            <div className={`rm-verdict ${res.hit ? 'fail' : 'ok'}`}>
              {res.hit
                ? `Touché${res.location ? ` — ${HIT_LOCATION_LABELS[res.location]}` : ''}${res.woundsLost ? ` · ${res.woundsLost} Blessure(s)` : ''}${res.critical ? ' · CRITIQUE' : ''}`
                : pd.mode === 'parade'
                  ? 'Paré !'
                  : 'Esquivé !'}
            </div>
            <p className="rm-log">{res.log}</p>
            <div className="modal-actions">
              <ChanceButtons fortune={fortune} rerollable={rerollable} onReroll={reroll} onBonusSL={bonusSL} />
              <ResilienceButton resilience={defender.resilience ?? 0} show={!!res && res.hit} onForce={forceSuccess} />
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
