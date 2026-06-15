import { useGame } from '../state/store';
import { FLOWS } from '../state/rollFlows';
import { defenseValue, defenseModifiers, DEFENSE_LABEL, FREE_ATTACK_LABEL } from '../engine/combat';
import { HIT_LOCATION_LABELS } from '../engine/types';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { RollFlowShell } from './RollFlowShell';
import { OptionChooser } from './OptionChooser';
import { optionValue } from './breakdown';
import { RollPanel } from './RollPanel';
import { VsHeader } from './VsHeader';
import { DeterminationButton } from './DeterminationButton';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';

/**
 * Modale de défense réactive — paramétrage de la coquille PARTAGÉE `RollFlowShell` (comme
 * Psych/Trample) : la ligne de l'ATTAQUANT est FIGÉE et remplie (son jet a eu lieu), MA ligne est
 * pré-remplie (score + bonus/malus) et se met à jour selon le choix Parade/Esquive. « Subir » =
 * défense passive (aucune réaction). Post-jet : Test opposé (vainqueur accentué + DR net). Aucune
 * mécanique générique (frisson, rangée d'influence, pickers, pied de page) n'est réécrite ici.
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
  if (!pd || !battle) return null;
  const attacker = battle.combatants.find((c) => c.id === pd.attackerId);
  const defender = battle.combatants.find((c) => c.id === pd.defenderId);
  if (!attacker || !defender) return null;
  const res = pd.result;
  const rerollable = !!res && canReroll(!pd.def?.success, !!pd.rerolled);
  // Armes pouvant parer (hors Mains nues) ; arme de parade choisie (défaut = main principale).
  const parryPickable = defender.weapons.filter((w) => w.name !== 'Mains nues' && !!w.uid);
  const chosenParry = pd.parryWeaponUid ? defender.weapons.find((w) => w.uid === pd.parryWeaponUid) : defender.weapons[0];
  // MA ligne pré-remplie : valeur + mods de la défense CHOISIE (recalculés à chaque changement).
  const myMods = defenseModifiers(defender, pd.mode, 0, pd.mode === 'parade' ? chosenParry : undefined);
  const myBase = defenseValue(defender, pd.mode, chosenParry);
  // Valeurs affichées sur le segmented control (chaque option montre SA valeur effective).
  const segVal = (mode: 'parade' | 'esquive') =>
    optionValue(defenseValue(defender, mode, chosenParry), defenseModifiers(defender, mode, 0, mode === 'parade' ? chosenParry : undefined));
  const forcedDie = FLOWS.defense.picker?.(pd, defender); // dé choisi (source unique : caps.picker)
  // `pd.modes` (tir) limite les réactions proposées ; absent = mêlée (Parade + Esquive). Filtre seul.
  const allowMode = (m: 'parade' | 'esquive') => !pd.modes || pd.modes.includes(m);
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
    <RollFlowShell
      title="Défense"
      subtitle={null}
      extra={<VsHeader actor={attacker} target={defender} label={pd.weapon?.name ?? 'Mains nues'} verb="attaque →" />}
      rolled={!!res}
      onRoll={roll}
      rollFrisson
      onCancel={subir}
      cancelLabel="Subir"
      cancelTitle="Subir l'attaque sans te défendre"
      disableEscClose
      setup={
        <>
          <div className="rm-options">
            {/* Réaction : segmented control PARTAGÉ — chaque option affiche SA valeur effective (mods compris). */}
            <OptionChooser
              layout="seg"
              groupLabel="Réaction"
              options={[
                ...(allowMode('parade') ? [{ key: 'parade', label: 'Parade', value: segVal('parade'), selected: pd.mode === 'parade', title: 'Parer avec son arme (Corps à corps)', onSelect: () => setMode('parade') }] : []),
                ...(allowMode('esquive') ? [{ key: 'esquive', label: 'Esquive', value: segVal('esquive'), selected: pd.mode === 'esquive', title: 'Esquiver (Agilité)', onSelect: () => setMode('esquive') }] : []),
              ]}
            />
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
                  label: pd.freeKind ? FREE_ATTACK_LABEL[pd.freeKind] ?? 'Attaque gratuite' : 'Attaque',
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
        </>
      }
      preInfluence={<DeterminationButton combatant={defender} onSpend={(name) => spendResolve(defender.id, name)} />}
      rows={res ? [{ combatant: attacker, d: res.attackerDetail }, { combatant: defender, d: res.defenderDetail }] : undefined}
      winnerIndex={res?.defenderDetail ? (res.hit ? 0 : 1) : undefined}
      netSL={res?.defenderDetail ? res.netSL : undefined}
      outcome={res && (
        <JournalLine
          className="rm-journal"
          event={ev(res.critical ? 'crit' : res.hit ? 'damage' : pd.mode === 'parade' ? 'parry' : 'dodge', outcome, attacker.id, defender.id)}
          combatants={battle.combatants}
        />
      )}
      forcedRoll={forcedDie ? { ...forcedDie, onSet: setForcedRoll } : undefined}
      fortune={defender.fortune ?? 0}
      freeReroll={freeRerollOf(defender)}
      rerollable={rerollable}
      onReroll={reroll}
      onBonusSL={bonusSL}
      darkPactable={defender.kind === 'hero' && !pd.def?.success}
      onDarkPact={darkPact}
      resilience={defender.resilience ?? 0}
      onForce={forceSuccess}
      preRollForce={() => { roll(); forceSuccess(); }}
      forceShow={!!res && res.hit}
      onConfirm={confirm}
    />
  );
}
