import { useState } from 'react';
import { useGame } from '../state/store';
import { bus, EVT } from '../state/bus';
import { defenseValue, defenseModifiers, combineMods, DEFENSE_LABEL } from '../engine/combat';
import { HIT_LOCATION_LABELS } from '../engine/types';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { InfluenceRow } from './InfluenceRow';
import { ForcedRollPicker } from './ForcedRollPicker';
import { ResilienceButton } from './ResilienceButton';
import { DeterminationButton } from './DeterminationButton';
import { RollPanel } from './RollPanel';
import { VsHeader } from './VsHeader';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';
import { Modal } from './Modal';

/** Libellé FR de la nature d'une attaque gratuite de créature (freeKind) pour le contexte de défense. */
const FREE_LABEL: Record<string, string> = {
  morsure: 'Morsure', caudale: 'Attaque caudale', cornes: 'Cornes (charge)', pietinement: 'Piétinement',
  langue: 'Langue', hurlement: 'Hurlement',
};

/**
 * Modale de défense réactive — même panneau de jet unique que l'Attaque : la ligne de l'ATTAQUANT
 * est FIGÉE et remplie (son jet a eu lieu : portrait · arme · DR obtenu), MA ligne est pré-remplie
 * (score + bonus/malus — c'est MON perso, je vois tout) et se met à jour selon le choix
 * Parade/Esquive (segmented control). « Subir » = défense passive (aucune réaction).
 * Post-jet : vainqueur accentué + DR net + issue courte. Le tour de l'IA reprend ensuite.
 */
export function DefenseModal() {
  const pd = useGame((s) => s.pendingDefense);
  const battle = useGame((s) => s.battle);
  const setMode = useGame((s) => s.defenseSetMode);
  const setParry = useGame((s) => s.defenseSetParryWeapon);
  const roll = useGame((s) => s.defenseRoll);
  const reroll = useGame((s) => s.defenseReroll);
  const bonusSL = useGame((s) => s.defenseBonusSL);
  const darkPact = useGame((s) => s.defenseDarkPact);
  const forceSuccess = useGame((s) => s.defenseForceSuccess);
  const setForcedRoll = useGame((s) => s.defenseSetForcedRoll);
  const confirm = useGame((s) => s.defenseConfirm);
  const subir = useGame((s) => s.defenseCancel);
  const spendResolve = useGame((s) => s.spendResolveCondition);
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
  const reduceMotion = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const doRoll = () => {
    bus.emit(EVT.DICE_ROLL);
    if (reduceMotion) return roll();
    setRolling(true);
    window.setTimeout(() => { setRolling(false); roll(); }, 480); // le jet (seeded) n'a lieu qu'à la fin du frisson
  };
  // MA ligne pré-remplie : valeur + mods de la défense CHOISIE (recalculés à chaque changement).
  const myMods = defenseModifiers(defender, pd.mode, 0, pd.mode === 'parade' ? chosenParry : undefined);
  const myBase = defenseValue(defender, pd.mode, chosenParry);
  // Valeurs affichées sur le segmented control (chaque option montre SA valeur effective).
  const segVal = (mode: 'parade' | 'esquive') =>
    defenseValue(defender, mode, chosenParry) + combineMods(defenseModifiers(defender, mode, 0, mode === 'parade' ? chosenParry : undefined));
  // Issue courte (1 ligne) — les noms vivent déjà dans les lignes du panneau.
  const outcome = res
    ? res.critical
      ? `Coup Critique subi${res.location ? ` — ${HIT_LOCATION_LABELS[res.location]}` : ''}${res.woundsLost ? ` · ${res.woundsLost} Blessure${res.woundsLost > 1 ? 's' : ''}` : ''}`
      : res.hit
        ? `Touché${res.location ? ` — ${HIT_LOCATION_LABELS[res.location]}` : ''}${res.woundsLost != null ? ` · ${res.woundsLost} Blessure${(res.woundsLost ?? 0) > 1 ? 's' : ''}` : ''}`
        : pd.mode === 'parade'
          ? 'Coup paré !'
          : 'Coup esquivé !'
    : '';

  return (
    <Modal title="Défense">
      <VsHeader actor={attacker} target={defender} label={pd.weapon?.name ?? 'Mains nues'} verb="attaque →" />

      {!res ? (
        <>
          <div className="rm-options">
            {/* Réaction : segmented control — chaque option affiche SA valeur effective (mods compris). */}
            <div className="rm-loc-inline">
              <span className="mini-title">Réaction</span>
              <div className="seg">
                <button className={pd.mode === 'parade' ? 'on' : ''} onClick={() => setMode('parade')} title="Parer avec son arme (Corps à corps)">
                  Parade {segVal('parade')}
                </button>
                <button className={pd.mode === 'esquive' ? 'on' : ''} onClick={() => setMode('esquive')} title="Esquiver (Agilité)">
                  Esquive {segVal('esquive')}
                </button>
              </div>
            </div>
            {pd.mode === 'parade' && parryPickable.length >= 2 && (
              <div className="rm-loc-inline">
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
          {/* Le panneau pré-rempli : ligne attaquant FIGÉE (jet déjà eu lieu), ma ligne en attente. */}
          <RollPanel
            rows={[
              {
                combatant: attacker,
                d: {
                  label: pd.freeKind ? FREE_LABEL[pd.freeKind] ?? 'Attaque gratuite' : 'Attaque',
                  base: pd.atk.target,
                  modifier: 0,
                  target: pd.atk.target,
                  roll: pd.atk.roll,
                  success: pd.atk.success,
                  sl: pd.atk.sl,
                },
              },
              { combatant: defender, pending: { label: DEFENSE_LABEL[pd.mode], base: myBase, mods: myMods } },
            ]}
          />
          {rolling ? (
            <div className="rm-rolling"><span className="rm-die">🎲</span></div>
          ) : (
            <>
              <div className="rm-influence">
                {/* Résilience AVANT le jet (LDB 17 l.73) : force la réussite (sans frisson). */}
                <ResilienceButton resilience={defender.resilience ?? 0} show={(defender.resilience ?? 0) > 0} onForce={() => { roll(); forceSuccess(); }} />
                {/* Détermination (LDB 17 l.66) : retirer À Terre/Sonné… AVANT de défendre — ma ligne recalcule. */}
                <DeterminationButton combatant={defender} onSpend={(name) => spendResolve(defender.id, name)} />
              </div>
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={subir} title="Subir l'attaque sans te défendre">
                  Subir
                </button>
                <button className="btn btn-primary" onClick={doRoll}>
                  🎲 Lancer
                </button>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          {/* Test opposé : mêmes lignes, remplies — vainqueur accentué + DR net. */}
          <RollPanel
            rows={[
              { combatant: attacker, d: res.attackerDetail },
              { combatant: defender, d: res.defenderDetail },
            ]}
            winnerIndex={res.defenderDetail ? (res.hit ? 0 : 1) : undefined}
            netSL={res.defenderDetail ? res.netSL : undefined}
          />
          <JournalLine
            className="rm-journal"
            event={ev(res.critical ? 'crit' : res.hit ? 'damage' : pd.mode === 'parade' ? 'parry' : 'dodge', outcome, attacker.id, defender.id)}
            combatants={battle.combatants}
          />
          {/* LDB 17 l.73 « vous choisissez le résultat » : 01 = DR max ; 11 = double le plus bas
              du défenseur (le moteur en tire les conséquences du Test opposé). */}
          {pd.forced && pd.def && (
            <ForcedRollPicker roll={pd.def.roll} target={pd.def.target} onSet={setForcedRoll} />
          )}
          <InfluenceRow
            actor={defender}
            rerollable={rerollable}
            onReroll={reroll}
            onBonusSL={bonusSL}
            darkPactable={defender.kind === 'hero' && !pd.def?.success}
            onDarkPact={darkPact}
            onForce={forceSuccess}
            forceShow={!!res && res.hit}
          />
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={confirm}>
              Appliquer
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
