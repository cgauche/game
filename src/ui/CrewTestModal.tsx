import { useGame } from '../state/store';
import { ownsLocally } from '../state/netFlow';
import { canReroll } from '../engine/fortune';
import { findCrewRoleById, findCrewTestTypeById } from '../data';
import { crewRoleValue, rudeEpreuveMoraleDelta } from '../engine/crewMorale';
import { maneuverCrewTotal } from '../state/shipManeuver';
import { MultiRollShell } from './MultiRollShell';
import { ParticipantRow } from './ParticipantRow';

/**
 * Modale du TEST D'ÉQUIPAGE GÉNÉRIQUE (MDG ch.14, « Types de Test d'équipage ») — JUMEAU de
 * `ShipBatteryModal`/`ShipManeuverModal` (flux MULTI, `MultiRollShell` + `ParticipantRow`), paramétrée par le
 * TYPE (`pendingCrewTest.testTypeId`). Chaque rôle tenu = une rangée ; le bandeau somme les DR (essentiel ×2)
 * + Moral + Manque de bras + sabotage. **Rude épreuve** (l.106-114) : un total NÉGATIF réduit le Moral d'autant
 * (l.110) — la perte est prévisualisée dans le bandeau avant « Appliquer ».
 */
export function CrewTestModal() {
  const p = useGame((s) => s.pendingCrewTest);
  const battle = useGame((s) => s.battle);
  const party = useGame((s) => s.party);
  const net = useGame((s) => s.net);
  const roll = useGame((s) => s.crewTestRoll);
  const reroll = useGame((s) => s.crewTestReroll);
  const bonus = useGame((s) => s.crewTestBonusSL);
  const darkPact = useGame((s) => s.crewTestDarkPact);
  const force = useGame((s) => s.crewTestForceSuccess);
  const confirm = useGame((s) => s.crewTestConfirm);
  const cancel = useGame((s) => s.crewTestCancel);
  if (!p) return null;
  // En VOYAGE (7b, hors combat), l'équipage = le groupe et la coque vit dans le plan de traversée —
  // le nom voyage sur le pending (`voyage.shipName`) ; en combat, le pool est la bataille.
  const pool = battle?.combatants ?? party;
  const ship = battle?.combatants.find((c) => c.id === p.shipId) ?? (p.voyage ? { name: p.voyage.shipName } : undefined);
  const testType = findCrewTestTypeById(p.testTypeId);
  if (!ship || !testType) return null;
  const owns = (id: string) => net.mode === 'local' || ownsLocally(useGame.getState(), id);

  const allRolled = p.participants.every((x) => x.result);
  const unrolled = p.participants.filter((x) => x.interactive && !x.result && owns(x.id));
  const total = maneuverCrewTotal(p.participants, p.essentialRoleId, p.moraleScore, p.undercrew, p.extraDR);
  const moraleLoss = p.testTypeId === 'rude-epreuve' ? rudeEpreuveMoraleDelta(total) : 0;
  const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

  return (
    <MultiRollShell
      title={`⚓ ${testType.label} — Test d’équipage`}
      variant="test"
      subtitle={<><strong>{ship.name}</strong> — Moral {p.moraleScore}{p.extraDR ? ` · sabotage ${sign(p.extraDR)} DR` : ''} (MDG ch.14)</>}
      extra={p.extraDR
        ? <div className="rm-threat">⚠ Le Test d’équipage est perturbé : {sign(p.extraDR)} DR (sabotage, MDG ch.14).</div>
        : undefined}
      summary={allRolled
        ? <>DR total <b>{sign(total)}</b> — {total >= 1 ? 'succès' : 'échec'} (l.13).{moraleLoss ? <> Rude épreuve : <b>{moraleLoss}</b> Moral (l.110).</> : null}</>
        : undefined}
      onRollAll={unrolled.length >= 2 ? () => unrolled.forEach((x) => roll(x.id)) : undefined}
      onCancel={cancel}
      onConfirm={confirm}
      confirmLabel="Appliquer"
      confirmDisabled={!allRolled}
    >
      {p.participants.map((part) => {
        const actor = pool.find((c) => c.id === part.id);
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
            extra={res && <div className="cs-outcome ok-text">{part.essential ? `${sign(res.sl)} DR ×2` : `${sign(res.sl)} DR`}</div>}
          />
        );
      })}
    </MultiRollShell>
  );
}
