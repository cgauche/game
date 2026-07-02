import type { ComponentProps } from 'react';
import { useGame } from '../../state/store';
import { FLOWS } from '../../state/rollFlows';
import { defenseValue, defenseModifiers, DEFENSE_LABEL, FREE_ATTACK_LABEL, type DefenseMode } from '../../engine/combat';
import { combatSubstitute } from '../../engine/skillCombatApps';
import { findSkillById } from '../../data/index';
import { isUnarmed } from '../../engine/items';
import { canReroll } from '../../engine/fortune';
import { freeRerollOf } from '../../engine/activeFlags';
import { RollFlowShell } from '../RollFlowShell';
import { OptionChooser } from '../OptionChooser';
import { optionValue } from '../breakdown';
import { RollPanel } from '../RollPanel';
import { VsHeader } from '../VsHeader';
import { DeterminationButton } from '../DeterminationButton';
import { JournalLine } from '../NarratedLine';
import { ev } from '../../state/combatLog';

/**
 * PARAMÉTRAGE de la coquille partagée `RollFlowShell` pour le JET de défense réactive — extrait de
 * `DefenseModal` pour être rendu à l'IDENTIQUE par la séquence de combat (`CascadeModal` rend l'étape-jet
 * `jet:'defense'` via ce hook, sans démonter la coquille → la défense ET son Critique/Maladresse vivent
 * dans UNE seule fenêtre). Renvoie les props de `RollFlowShell`, ou `null` si aucune défense en attente.
 * La ligne de l'ATTAQUANT est FIGÉE ; MA ligne se met à jour selon Parade/Esquive ; « Subir » = passif.
 * AUCUNE mécanique générique (frisson, influence, pickers) réécrite : que du métier de défense.
 */
export function useDefenseJetProps(): ComponentProps<typeof RollFlowShell> | null {
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
  const parryPickable = defender.weapons.filter((w) => !isUnarmed(w) && !!w.uid);
  const chosenParry = pd.parryWeaponUid ? defender.weapons.find((w) => w.uid === pd.parryWeaponUid) : defender.weapons[0];
  // Substitution sociale (LDB 09 l.207/287) : proposée en MÊLÉE quand une Compétence sociale
  // (Intimidation/Dressage `combatSubstitute`) est utilisable en défense — l'attaquant a PEUR du
  // défenseur (gate `fear`). Data-driven : l'option existe parce que la donnée+le gate le disent.
  const sub = pd.weapon.type === 'melee' ? combatSubstitute(defender, attacker, 'defense') : null;
  const socialLabel = sub ? findSkillById(sub.skillId)?.label ?? 'Intimidation' : undefined;
  // Base de la défense sociale (mode 'social') = valeur de Test de la Compétence substituée.
  const socialBase = pd.mode === 'social' ? sub?.value : undefined;
  // MA ligne pré-remplie : valeur + mods de la défense CHOISIE (recalculés à chaque changement).
  const myMods = defenseModifiers(defender, pd.mode, 0, pd.mode === 'parade' ? chosenParry : undefined);
  const myBase = defenseValue(defender, pd.mode, chosenParry, socialBase);
  const myLabel = pd.mode === 'social' ? (socialLabel ?? 'Intimidation') : DEFENSE_LABEL[pd.mode];
  // Valeurs affichées sur le segmented control (chaque option montre SA valeur effective).
  const segVal = (mode: DefenseMode) =>
    optionValue(defenseValue(defender, mode, chosenParry, mode === 'social' ? sub?.value : undefined), defenseModifiers(defender, mode, 0, mode === 'parade' ? chosenParry : undefined));
  const forcedDie = FLOWS.defense.picker?.(pd, defender); // dé choisi (source unique : caps.picker)
  // `pd.modes` (tir) limite les réactions proposées ; absent = mêlée (Parade + Esquive). Filtre seul.
  const allowMode = (m: 'parade' | 'esquive') => !pd.modes || pd.modes.includes(m);

  return {
    title: 'Défense',
    subtitle: null,
    extra: <VsHeader actor={attacker} target={defender} label={pd.weapon?.name ?? 'Mains nues'} verb="attaque →" />,
    rolled: !!res,
    onRoll: roll,
    rollFrisson: true,
    onCancel: subir,
    cancelLabel: 'Subir',
    cancelTitle: 'Subir l’attaque sans te défendre',
    disableEscClose: true,
    setup: (
      <>
        <div className="rm-options">
          {/* Réaction : segmented control PARTAGÉ — chaque option affiche SA valeur effective (mods compris). */}
          <OptionChooser
            layout="seg"
            groupLabel="Réaction"
            options={[
              ...(allowMode('parade') ? [{ key: 'parade', label: 'Parade', value: segVal('parade'), selected: pd.mode === 'parade', title: 'Parer avec son arme (Corps à corps)', onSelect: () => setMode('parade') }] : []),
              ...(allowMode('esquive') ? [{ key: 'esquive', label: 'Esquive', value: segVal('esquive'), selected: pd.mode === 'esquive', title: 'Esquiver (Agilité)', onSelect: () => setMode('esquive') }] : []),
              ...(sub ? [{ key: 'social', label: socialLabel!, value: segVal('social'), selected: pd.mode === 'social', title: `${socialLabel} à la place de Corps à corps : l’attaquant a peur de vous (LDB 09)`, onSelect: () => setMode('social', sub.skillId) }] : []),
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
            { combatant: defender, pending: { label: myLabel, base: myBase, mods: myMods } },
          ]}
        />
      </>
    ),
    preInfluence: <DeterminationButton combatant={defender} onSpend={(name) => spendResolve(defender.id, name)} />,
    rows: res ? [{ combatant: attacker, d: res.attackerDetail }, { combatant: defender, d: res.defenderDetail }] : undefined,
    winnerIndex: res?.defenderDetail ? (res.hit ? 0 : 1) : undefined,
    netSL: res?.defenderDetail ? res.netSL : undefined,
    outcome: res && (
      <JournalLine
        className="rm-journal"
        event={ev(res.critical ? 'crit' : res.hit ? 'damage' : pd.mode === 'parade' ? 'parry' : 'dodge', res.log, attacker.id, defender.id)}
        combatants={battle.combatants}
      />
    ),
    forcedRoll: forcedDie ? { ...forcedDie, onSet: setForcedRoll } : undefined,
    fortune: defender.fortune ?? 0,
    freeReroll: freeRerollOf(defender),
    rerollable,
    onReroll: reroll,
    onBonusSL: bonusSL,
    darkPactable: defender.kind === 'hero' && !pd.def?.success,
    onDarkPact: darkPact,
    resilience: defender.resilience ?? 0,
    onForce: forceSuccess,
    preRollForce: () => { roll(); forceSuccess(); },
    forceShow: !!res && res.hit,
    onConfirm: confirm,
  };
}
