import { useGame } from '../state/store';
import { ownsLocally } from '../state/netFlow';
import { testValue } from '../engine/skills';
import { canReroll } from '../engine/fortune';
import { RollShell, type RollRowData, type RollAction } from './RollShell';
import { testBreakdown, testPending } from './breakdown';
import { Icon } from './Icon';

/**
 * Modale « Enfoncer une porte à PLUSIEURS » (EDO Appendice 2) — flux MULTI PARALLÈLE, pendant exact
 * du Contre-sort mais métier = DÉGÂTS sur objet. La porte est un objet (BE / B) ; chaque héros frappe
 * INDÉPENDAMMENT (Test de Corps à corps (Bagarre), dégâts = DR + BF − BE, pas de min 1) avec son
 * propre cycle Chance/+1 DR/Pacte/Résilience. À l'« Appliquer », la somme des dégâts ronge les
 * Blessures ; la porte cède à ≤ 0, sinon un nouveau Round s'ouvre. COOP : chacun ne pilote QUE ses héros.
 */
export function ForceDoorModal() {
  const battle = useGame((s) => s.battle);
  const party = useGame((s) => s.party);
  const net = useGame((s) => s.net);
  const p = useGame((s) => s.pendingForceDoor);
  const roll = useGame((s) => s.forceDoorRoll);
  const reroll = useGame((s) => s.forceDoorReroll);
  const bonusSL = useGame((s) => s.forceDoorBonusSL);
  const darkPact = useGame((s) => s.forceDoorDarkPact);
  const force = useGame((s) => s.forceDoorForceSuccess);
  const confirm = useGame((s) => s.forceDoorConfirm);
  const cancel = useGame((s) => s.forceDoorCancel);
  if (!p) return null;
  const pool = battle?.combatants ?? party;
  const owns = (id: string) => net.mode === 'local' || ownsLocally(useGame.getState(), id);
  const roundDmg = p.participants.reduce((s, x) => s + (x.result?.damage ?? 0), 0);
  const allRolled = p.participants.every((x) => x.result);
  const cede = roundDmg >= p.doorB;

  const rows: RollRowData[] = p.participants.flatMap((part) => {
    const actor = pool.find((c) => c.id === part.id);
    if (!actor) return [];
    const res = part.result;
    const val = testValue(actor, 'corps-a-corps');
    const row = res
      ? { combatant: actor, d: testBreakdown('Bagarre', val, { roll: res.roll, target: res.target, sl: res.sl }) }
      : { combatant: actor, pending: testPending('Bagarre', val) };
    return [{
      key: part.id,
      actor,
      row,
      rolled: !!res,
      interactive: owns(part.id),
      rollLabel: <><Icon id="action/attack" size="sm" /> Frapper</>,
      onRoll: () => roll(part.id),
      rerollable: !!res && canReroll(res.roll > res.target, !!part.rerolled),
      onReroll: () => reroll(part.id),
      onBonusSL: () => bonusSL(part.id),
      darkPactable: actor.kind === 'hero' && !!res && res.roll > res.target,
      onDarkPact: () => darkPact(part.id),
      onForce: () => force(part.id),
      forceShow: !!res,
      extra: res && <div className={`cs-outcome ${res.damage > 0 ? 'ok-text' : 'muted'}`}>{res.damage > 0 ? `−${res.damage} Blessure${res.damage > 1 ? 's' : ''}` : 'Rebondit (0 dégât)'}</div>,
    }];
  });

  const actions: RollAction[] = [
    { key: 'cancel', label: 'Renoncer', kind: 'ghost', onClick: cancel, when: 'always' },
    { key: 'confirm', label: cede ? 'Enfoncer !' : 'Appliquer le Round', kind: 'primary', onClick: confirm, when: 'always' },
  ];

  return (
    <RollShell
      title={<><Icon id="map-tool/door" size="sm" /> Enfoncer la porte</>}
      variant="roll"
      subtitle={<><strong>{p.label}</strong> — Endurance {p.doorBE} · Blessures {p.doorB}/{p.doorBmax}</>}
      instruction="Chacun frappe — Corps à corps (Bagarre), dégâts = DR + Bonus de Force − BE"
      rows={rows}
      rolled={allRolled}
      summary={allRolled ? <>Ce Round : <b>{roundDmg}</b> dégât{roundDmg > 1 ? 's' : ''}{cede ? ' → la porte cède !' : ` (reste ${p.doorB - roundDmg})`}</> : undefined}
      actions={actions}
      onCancel={cancel}
    />
  );
}
