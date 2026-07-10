import { useGame } from '../state/store';
import { ownsLocally } from '../state/netFlow';
import { canReroll } from '../engine/fortune';
import { easeDifficulty } from '../engine/tests';
import { findCrewRoleById } from '../data';
import { crewRoleValue } from '../engine/crewMorale';
import { maneuverCrewTotal } from '../state/shipManeuver';
import { RollShell, type RollRowData, type RollAction } from './RollShell';
import { Icon } from './Icon';
import { testBreakdown, testPending } from './breakdown';

/**
 * Modale du TIR DE BATTERIE (« bordée », MDG ch.14 l.128) — JUMEAU de `ShipManeuverModal` (flux MULTI,
 * `RollShell` + `RollRow`). Chaque Artilleur tenu = une rangée (PJ influençable / marin témoin) ;
 * le bandeau somme les DR (essentiel ×2) + Moral → le **DR PARTAGÉ** qui s'applique à TOUTES les pièces du bord
 * (l.128). Pas de virage : `extra` montre la cible + les pièces qui tirent. « Feu ! » résout la volée (`shipBatteryConfirm`).
 */
export function ShipBatteryModal() {
  const p = useGame((s) => s.pendingShipBattery);
  const battle = useGame((s) => s.battle);
  const net = useGame((s) => s.net);
  const roll = useGame((s) => s.shipBatteryRoll);
  const reroll = useGame((s) => s.shipBatteryReroll);
  const bonus = useGame((s) => s.shipBatteryBonusSL);
  const darkPact = useGame((s) => s.shipBatteryDarkPact);
  const force = useGame((s) => s.shipBatteryForceSuccess);
  const confirm = useGame((s) => s.shipBatteryConfirm);
  const cancel = useGame((s) => s.shipBatteryCancel);
  if (!p || !battle) return null;
  const ship = battle.combatants.find((c) => c.id === p.shipId);
  const target = battle.combatants.find((c) => c.id === p.targetId);
  if (!ship || !target) return null;
  const owns = (id: string) => net.mode === 'local' || ownsLocally(useGame.getState(), id);

  const allRolled = p.participants.every((x) => x.result);
  const unrolled = p.participants.filter((x) => x.interactive && !x.result && owns(x.id));
  const dr = maneuverCrewTotal(p.participants, p.essentialRoleId, p.moraleScore, p.undercrew, p.extraDR); // DR PARTAGÉ (essentiel ×2 + Moral + Manque de bras + sabotage)
  const postes = (ship.postes ?? []).filter((pp) => pp.side === p.side);
  const plural = (n: number) => (n > 1 ? 's' : '');
  const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

  const rows: RollRowData[] = p.participants.flatMap((part) => {
    const actor = battle.combatants.find((c) => c.id === part.id);
    if (!actor) return [];
    const res = part.result;
    const role = findCrewRoleById(part.roleId);
    const val = role ? crewRoleValue(actor, role).value : 0;
    const label = `${role?.label ?? part.roleId}${part.essential ? ' ★' : ''}`;
    // Manque de bras (MDG ch.14 l.53) : marin déjà engagé ce Round → +2 crans de Difficulté (−20), itemisé.
    const difficulty = part.cumul ? easeDifficulty('intermediaire', -2) : undefined;
    const row = res
      ? { combatant: actor, d: testBreakdown(label, val, { roll: res.roll, target: res.target, sl: res.sl }, difficulty) }
      : { combatant: actor, pending: testPending(label, val, undefined, difficulty) };
    return [{
      key: part.id,
      actor,
      row,
      rolled: !!res,
      interactive: part.interactive && owns(part.id),
      onRoll: () => roll(part.id),
      rerollable: !!res && canReroll(res.roll > res.target, !!part.rerolled),
      onReroll: () => reroll(part.id),
      onBonusSL: () => bonus(part.id),
      darkPactable: actor.kind === 'hero' && !!res && res.roll > res.target,
      onDarkPact: () => darkPact(part.id),
      onForce: () => force(part.id),
      forceShow: !!res,
      extra: res && <div className="cs-outcome ok-text">{part.essential ? `${sign(res.sl)} DR ×2` : `${sign(res.sl)} DR`}</div>,
    }];
  });

  const actions: RollAction[] = [
    { key: 'cancel', label: 'Annuler', onClick: cancel, when: 'always' },
    ...(unrolled.length >= 2 ? [{ key: 'rollAll', label: <><Icon id="nav/dice" size="sm" /> Tout lancer</>, onClick: () => unrolled.forEach((x) => roll(x.id)), when: 'pre' as const }] : []),
    { key: 'confirm', label: <><Icon id="fire/flame" size="sm" /> Feu !</>, onClick: confirm, when: 'always', disabled: !allRolled },
  ];

  return (
    <RollShell
      flowKey="shipBattery"
      title={<><Icon id="action/aim" size="sm" /> Tir de batterie — Test d’équipage</>}
      variant="test"
      subtitle={<><strong>{ship.name}</strong> — bordée {p.side} sur <strong>{target.name}</strong> ({postes.length} pièce{plural(postes.length)}, MDG ch.14)</>}
      extra={
        <div className="rm-threat">
          <Icon id="action/aim" size="sm" /> {target.name} — Coque {target.wounds.current}/{target.wounds.max}. {postes.length} pièce{plural(postes.length)} : {postes.map((pp) => pp.item.name).join(' · ')}.
        </div>
      }
      rows={rows}
      rolled={allRolled}
      summary={allRolled
        ? <>DR PARTAGÉ <b>{sign(dr)}</b> → chaque pièce inflige (Dégâts {sign(dr)}) ; volée de {postes.length} pièce{plural(postes.length)} (l.128).</>
        : undefined}
      actions={actions}
      onCancel={cancel}
    />
  );
}
