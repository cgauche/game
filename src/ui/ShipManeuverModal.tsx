import { useGame } from '../state/store';
import { ownsLocally } from '../state/netFlow';
import { canReroll } from '../engine/fortune';
import { findCrewRoleById } from '../data';
import { crewRoleValue } from '../engine/crewMorale';
import { maneuverCrewTotal, deriveManeuverFromCrew } from '../state/shipManeuver';
import { MultiRollShell } from './MultiRollShell';
import { ParticipantRow } from './ParticipantRow';
import { OptionChooser, type RollOption } from './OptionChooser';

/** Virages proposés (MDG ch.13 — angle abstrait, choix d'UX) : crans d'octant signés (±1 = 45°, ±2 = 90°). */
const TURN_OPTIONS: { key: string; label: string; steps: number }[] = [
  { key: 'b90', label: '⟲ Bâbord 90°', steps: -2 },
  { key: 'b45', label: '↰ Bâbord 45°', steps: -1 },
  { key: 'straight', label: '⬆ Tout droit', steps: 0 },
  { key: 't45', label: '↱ Tribord 45°', steps: 1 },
  { key: 't90', label: '⟳ Tribord 90°', steps: 2 },
];

/**
 * Modale de MANŒUVRE navale = TEST D'ÉQUIPAGE (MDG ch.13-14) — flux MULTI, patron `ForceDoorModal`. Pré-jet : choix
 * du virage (`OptionChooser` → `shipManeuverSetTurn`, ⟂ jet). Chaque rôle tenu = une `ParticipantRow` : un PJ lance
 * SON Test (Chance/+1 DR/Pacte/Résilience sur SON jet, gated `ownsLocally`) ; un marin PNJ est un TÉMOIN auto-roulé.
 * Le bandeau somme les DR (essentiel ×2) + Moral → DR final ; « Manœuvrer » vire le cap + avance (`…Confirm`).
 */
export function ShipManeuverModal() {
  const p = useGame((s) => s.pendingShipManeuver);
  const battle = useGame((s) => s.battle);
  const net = useGame((s) => s.net);
  const setTurn = useGame((s) => s.shipManeuverSetTurn);
  const roll = useGame((s) => s.shipManeuverRoll);
  const reroll = useGame((s) => s.shipManeuverReroll);
  const bonus = useGame((s) => s.shipManeuverBonusSL);
  const darkPact = useGame((s) => s.shipManeuverDarkPact);
  const force = useGame((s) => s.shipManeuverForceSuccess);
  const confirm = useGame((s) => s.shipManeuverConfirm);
  const cancel = useGame((s) => s.shipManeuverCancel);
  if (!p || !battle) return null;
  const ship = battle.combatants.find((c) => c.id === p.shipId);
  if (!ship) return null;
  const owns = (id: string) => net.mode === 'local' || ownsLocally(useGame.getState(), id);

  const allRolled = p.participants.every((x) => x.result);
  const unrolled = p.participants.filter((x) => x.interactive && !x.result && owns(x.id));
  const total = maneuverCrewTotal(p.participants, p.essentialRoleId, p.moraleScore, p.undercrew);
  const result = allRolled ? deriveManeuverFromCrew(ship, total) : null;
  const turnOptions: RollOption[] = TURN_OPTIONS.map((o) => ({
    key: o.key, label: o.label, selected: p.turnSteps === o.steps, primary: p.turnSteps === o.steps,
    onSelect: () => setTurn(o.steps),
  }));
  const plural = (n: number) => (n > 1 ? 's' : '');

  return (
    <MultiRollShell
      title="🧭 Manœuvre — Test d’équipage"
      variant="test"
      subtitle={<><strong>{ship.name}</strong> — {p.participants.length} rôle{plural(p.participants.length)} à la manœuvre (DR sommés, MDG ch.14)</>}
      extra={<OptionChooser layout="grid" groupLabel="Virage" options={turnOptions} />}
      summary={allRolled && result
        ? <>DR d’équipage <b>{total}</b> → DR final <b>{result.dr}</b> : {result.success
            ? `cap viré, ${ship.name} avance de ${result.movement} case${plural(result.movement)}.`
            : `manœuvre ratée — le cap tient ; avance de ${result.movement} case${plural(result.movement)}.`}</>
        : undefined}
      onRollAll={unrolled.length >= 2 ? () => unrolled.forEach((x) => roll(x.id)) : undefined}
      onCancel={cancel}
      onConfirm={confirm}
      confirmLabel="Manœuvrer"
      confirmDisabled={!allRolled}
    >
      {p.participants.map((part) => {
        const actor = battle.combatants.find((c) => c.id === part.id);
        if (!actor) return null;
        const res = part.result;
        const role = findCrewRoleById(part.roleId);
        const val = role ? crewRoleValue(actor, role).value : 0;
        const label = `${role?.label ?? part.roleId}${part.essential ? ' ★' : ''}`;
        const row = res
          ? { combatant: actor, d: { label, base: val, modifier: 0, target: res.target, roll: res.roll, success: res.roll <= res.target, sl: res.sl } }
          : { combatant: actor, pending: { label, base: val, mods: [] } };
        return (
          <ParticipantRow
            key={part.id}
            actor={actor}
            row={row}
            rolled={!!res}
            interactive={part.interactive && owns(part.id)}
            onRoll={() => roll(part.id)}
            rerollable={!!res && canReroll(res.roll > res.target, !!part.rerolled)}
            onReroll={() => reroll(part.id)}
            onBonusSL={() => bonus(part.id)}
            darkPactable={actor.kind === 'hero' && !!res && res.roll > res.target}
            onDarkPact={() => darkPact(part.id)}
            onForce={() => force(part.id)}
            forceShow={!!res}
            extra={res && <div className="cs-outcome ok-text">{part.essential ? `${res.sl >= 0 ? '+' : ''}${res.sl} DR ×2` : `${res.sl >= 0 ? '+' : ''}${res.sl} DR`}</div>}
          />
        );
      })}
    </MultiRollShell>
  );
}
