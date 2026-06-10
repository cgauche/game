import { useState } from 'react';
import { useGame } from '../state/store';
import { defenseValue } from '../engine/combat';
import { RollLine } from './RollLine';
import { canReroll } from '../engine/fortune';
import { ChanceButtons } from './ChanceButtons';
import { ResilienceButton } from './ResilienceButton';
import { CombatantBadge, TeamPortrait } from './CombatantBadge';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';
import { Modal } from './Modal';

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
  const setParry = useGame((s) => s.defenseSetParryWeapon);
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
  // Armes pouvant parer (hors Mains nues) ; arme de parade choisie (défaut = main principale).
  const parryPickable = defender.weapons.filter((w) => w.name !== 'Mains nues' && !!w.uid);
  const chosenParry = pd.parryWeaponUid ? defender.weapons.find((w) => w.uid === pd.parryWeaponUid) : defender.weapons[0];
  const paradeVal = defenseValue(defender, 'parade', chosenParry); // valeur affichée = arme de parade choisie
  const esquiveVal = defenseValue(defender, 'esquive');
  const reduceMotion = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const doRoll = () => {
    if (reduceMotion) return roll();
    setRolling(true);
    window.setTimeout(() => { setRolling(false); roll(); }, 480); // le jet (seeded) n'a lieu qu'à la fin du frisson
  };

  return (
    <Modal title="Défense">
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
              {pd.mode === 'parade' && parryPickable.length >= 2 && (
                <div className="rm-loc-inline" style={{ marginTop: 6 }}>
                  <span className="mini-title">Parer avec</span>
                  <select
                    className="rm-loc-select"
                    value={pd.parryWeaponUid ?? chosenParry?.uid ?? ''}
                    onChange={(e) => setParry(e.target.value || null)}
                    title="Avec quelle arme parer ? La main secondaire subit -20 (sauf Corps à corps (Parade) + arme Défensive)."
                  >
                    {parryPickable.map((w) => (
                      <option key={w.uid} value={w.uid}>{w.name}{w.hand === 'off' ? ' (2nde)' : ''}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            {rolling ? (
              <div className="rm-rolling"><span className="rm-die">🎲</span></div>
            ) : (
              <div className="modal-actions">
                <button className="btn" onClick={subir} title="Subir l'attaque sans te défendre">
                  Subir
                </button>
                <button className="btn btn-primary" onClick={doRoll}>
                  🎲 Lancer
                </button>
                {/* Résilience AVANT le jet (LDB 17 l.73) : force la réussite (sans frisson). */}
                <ResilienceButton resilience={defender.resilience ?? 0} show={(defender.resilience ?? 0) > 0} onForce={() => { roll(); forceSuccess(); }} />
              </div>
            )}
          </>
        ) : (
          <>
            {/* Test opposé : portrait à côté de chaque jet (attaquant ET défenseur) pour savoir qui est qui (R10). */}
            <div className="rm-rolls">
              {res.attackerDetail && <div className="rm-roll-row"><TeamPortrait combatant={attacker} size={28} /><RollLine d={res.attackerDetail} /></div>}
              {res.defenderDetail && <div className="rm-roll-row"><TeamPortrait combatant={defender} size={28} /><RollLine d={res.defenderDetail} /></div>}
            </div>
            {/* Une seule ligne d'issue, style journal (la verdict dupliquait le log) : icône par nature. */}
            <JournalLine
              className="rm-journal"
              event={ev(res.critical ? 'crit' : res.hit ? 'damage' : pd.mode === 'parade' ? 'parry' : 'dodge', res.log, attacker.id, defender.id)}
              combatants={battle.combatants}
            />
            <div className="modal-actions">
              <ChanceButtons fortune={fortune} rerollable={rerollable} onReroll={reroll} onBonusSL={bonusSL} />
              <ResilienceButton resilience={defender.resilience ?? 0} show={!!res && res.hit} onForce={forceSuccess} />
              <button className="btn btn-primary" onClick={confirm}>
                Appliquer
              </button>
            </div>
          </>
        )}
    </Modal>
  );
}
