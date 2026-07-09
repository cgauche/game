import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { combatValue } from '../engine/combat';
import { creatureAttacks, ATTACK_LABEL } from '../engine/creatureAttacks';
import { MANEUVER_ICON } from '../state/combatFlow';
import { RollShell, type RollAction, type RollRowData } from './RollShell';
import { Icon } from './Icon';
import { OptionChooser, type RollOption } from './OptionChooser';
import { testBreakdown, testPending } from './breakdown';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';

/**
 * Modale de MANŒUVRE de créature (Souffle/Vomi/Langue/Regard/Étreinte — LDB 85 - Traits de
 * créature.md) qu'un héros active (mutation/polymorphie). La modale influence le SEUL jet de
 * l'ATTAQUANT (CC ou CT) ; « Appliquer » roule les défenseurs et résout l'opposition au feed.
 * Regard pétrifiant (l.238) : Avantage variable → un sélecteur
 * (pré-jet) fixe le DR ajouté. (Le Hurlement n'ouvre PAS de modale — pas de jet d'attaquant.)
 */
export function ManeuverModal() {
  const pm = useGame((s) => s.pendingManeuver);
  const battle = useGame((s) => s.battle);
  const roll = useGame((s) => s.maneuverRoll);
  const reroll = useGame((s) => s.maneuverReroll);
  const bonusSL = useGame((s) => s.maneuverBonusSL);
  const darkPact = useGame((s) => s.maneuverDarkPact);
  const force = useGame((s) => s.maneuverForceSuccess);
  const setAvantage = useGame((s) => s.maneuverSetAvantage);
  const confirm = useGame((s) => s.maneuverConfirm);
  const cancel = useGame((s) => s.maneuverCancel);
  if (!pm || !battle) return null;
  const attacker = battle.combatants.find((c) => c.id === pm.attackerId);
  if (!attacker) return null;
  const a = creatureAttacks(attacker.traits ?? []).find((x) => x.kind === pm.kind);
  if (!a) return null;
  const r = pm.result;
  const rolled = !!r;
  // Jet d'attaquant : CC (mêlée) ou CT (distance/zone) ; Vomi → Facile (+40) à courte distance (l.376).
  const stat = a.stat ?? 'CT';
  const base = combatValue(attacker, stat === 'CC' ? 'melee' : 'ranged');
  const label = stat === 'CC' ? 'Capacité de Combat' : 'Capacité de Tir';
  const difficulty = pm.kind === 'vomi' ? 'facile' : 'intermediaire'; // Vomi : +40 à courte distance (l.376)
  // Regard (Avantage variable, l.238) : sélecteur PRÉ-JET 1..Avantage → +N DR sur la marge.
  const variable = a.advantageMode === 'variable';
  const avOptions: RollOption[] = variable
    ? Array.from({ length: Math.max(1, attacker.advantage) }, (_, i) => i + 1).map((n) => ({
        key: String(n), label: `+${n} DR`, selected: pm.avantageSpent === n, onSelect: () => setAvantage(n),
      }))
    : [];

  const actorRow: RollRowData = {
    actor: attacker,
    row: {
      combatant: attacker,
      d: r ? testBreakdown(label, base, { roll: r.roll, target: r.target, sl: r.sl, success: r.success }, difficulty) : undefined,
      pending: testPending(label, base, undefined, difficulty),
    },
    rolled,
    freeReroll: freeRerollOf(attacker),
    onRoll: roll,
    rerollable: !!r && !r.success && canReroll(true, !!pm.rerolled),
    onReroll: reroll,
    onBonusSL: bonusSL,
    darkPactable: !!r && !r.success && attacker.kind === 'hero',
    onDarkPact: darkPact,
    onForce: force,
    forceShow: !!r && !r.success,
    // LDB 17 l.73 : réussite forcée = dé PAR DÉFAUT (DR max). PAS de choix du dé : le jet d'attaquant
    // ne nourrit que le DR de l'opposition (`resolveManeuver`), aucun Coup Critique n'y dépend du dé.
  };

  const actions: RollAction[] = [
    { key: 'cancel', label: 'Annuler', kind: 'ghost', onClick: cancel, when: 'always' },
    { key: 'confirm', label: 'Appliquer', kind: 'primary', onClick: confirm, when: 'post' },
  ];

  return (
    <RollShell
      flowKey="maneuver"
      title={<><Icon id={MANEUVER_ICON[pm.kind]} /> {ATTACK_LABEL[pm.kind]}</>}
      subtitle={
        <>
          <strong>{attacker.name}</strong> déclenche {ATTACK_LABEL[pm.kind]}
          {variable ? <> ({pm.avantageSpent} Avantage)</> : a.avantage > 0 ? <> (coûte {a.avantage} Avantage)</> : null}
        </>
      }
      /* Regard : choix de l'Avantage AVANT le jet (fixe le DR). Masqué une fois lancé. */
      setup={variable ? <OptionChooser layout="seg" groupLabel="Avantage" options={avOptions} /> : undefined}
      rows={[actorRow]}
      rolled={rolled}
      outcome={r && <JournalLine className="rm-journal" event={ev('attack', `${attacker.name} : jet ${r.success ? 'réussi' : 'raté'} (DR ${r.sl}).`, attacker.id)} combatants={battle.combatants} />}
      actions={actions}
      onCancel={cancel}
    />
  );
}
