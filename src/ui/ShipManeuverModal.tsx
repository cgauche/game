import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { testValue } from '../engine/skills';
import { refLabel, findVehicleById } from '../data';
import { RollFlowShell } from './RollFlowShell';
import { OptionChooser, type RollOption } from './OptionChooser';
import { testBreakdown, testPending } from './breakdown';

/** Virages proposés (MDG ch.13 — angle abstrait, choix d'UX) : crans d'octant signés (±1 = 45°, ±2 = 90°). */
const TURN_OPTIONS: { key: string; label: string; steps: number }[] = [
  { key: 'b90', label: '⟲ Bâbord 90°', steps: -2 },
  { key: 'b45', label: '↰ Bâbord 45°', steps: -1 },
  { key: 'straight', label: '⬆ Tout droit', steps: 0 },
  { key: 't45', label: '↱ Tribord 45°', steps: 1 },
  { key: 't90', label: '⟳ Tribord 90°', steps: 2 },
];

/**
 * Modale de MANŒUVRE navale (MDG ch.13). Pré-jet : choix du virage (`OptionChooser` à 5 options →
 * `shipManeuverSetTurn`) — orthogonal au jet (le Test de Navigation ne dépend pas du sens). « Lancer »
 * jette le Test du barreur ; rangée d'influence COMPLÈTE (Chance relance / +1 DR / Pacte / Résilience —
 * le DR nourrit la Progression + l'Indice de Collision) ; « Appliquer » vire le cap + avance (`…Confirm`).
 * Paramètre la coquille partagée `RollFlowShell` — aucune mécanique de jet réécrite.
 */
export function ShipManeuverModal() {
  const p = useGame((s) => s.pendingShipManeuver);
  const battle = useGame((s) => s.battle);
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
  const helm = battle.combatants.find((c) => c.id === p.helmsmanId);
  if (!ship || !helm) return null;
  const r = p.result;
  const sail = !!(ship.creatureId ? findVehicleById(ship.creatureId)?.ship?.sail : undefined);
  const skillId = sail ? 'voile' : 'ramer'; // à voile → Voile ; aux avirons → Ramer (MDG ch.13)
  const skillLabel = refLabel('skills', { id: skillId });
  const value = testValue(helm, skillId);

  const turnOptions: RollOption[] = TURN_OPTIONS.map((o) => ({
    key: o.key, label: o.label, selected: p.turnSteps === o.steps, primary: p.turnSteps === o.steps,
    onSelect: () => setTurn(o.steps),
  }));
  const plural = (n: number) => (n > 1 ? 's' : '');

  return (
    <RollFlowShell
      variant="test"
      title="🧭 Manœuvre"
      subtitle={<><strong>{ship.name}</strong> — {helm.name} à la barre (Test de {sail ? 'Voile' : 'Ramer'} +0)</>}
      actor={helm}
      rolled={!!r}
      onRoll={roll}
      onCancel={cancel}
      cancelAfterRoll
      setup={<OptionChooser layout="grid" groupLabel="Virage" options={turnOptions} />}
      breakdown={r ? testBreakdown(skillLabel, value, { roll: r.roll ?? 0, target: r.target, sl: r.navDR }, 'intermediaire') : undefined}
      pending={testPending(skillLabel, value, undefined, 'intermediaire')}
      outcome={r && (
        <p className="rm-journal">
          {r.success
            ? `Cap viré (DR ${r.dr}) — ${ship.name} avance de ${r.movement} case${plural(r.movement)}.`
            : `Manœuvre ratée (DR ${r.dr}) — le cap tient ; ${ship.name} avance de ${r.movement} case${plural(r.movement)}.`}
        </p>
      )}
      fortune={helm.fortune ?? 0}
      freeReroll={freeRerollOf(helm)}
      rerollable={!!r && !r.success && canReroll(true, !!p.rerolled)}
      onReroll={reroll}
      onBonusSL={bonus}
      darkPactable={!!r && !r.success && helm.kind === 'hero'}
      onDarkPact={darkPact}
      resilience={helm.resilience ?? 0}
      onForce={force}
      forceShow={!r?.success}
      onConfirm={confirm}
    />
  );
}
