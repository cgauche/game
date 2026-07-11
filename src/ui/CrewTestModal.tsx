import { useGame, type BattleState } from '../state/store';
import { ownsLocally } from '../state/netFlow';
import { canReroll } from '../engine/fortune';
import { easeDifficulty } from '../engine/tests';
import { findCrewRoleById, findCrewTestTypeById } from '../data';
import { crewRoleValue, rudeEpreuveMoraleDelta } from '../engine/crewMorale';
import { maneuverCrewTotal } from '../state/shipManeuver';
import type { PendingCrewTest } from '../state/pendings';
import type { Combatant } from '../engine/types';
import { RollShell, type RollRowData, type RollAction } from './RollShell';
import { Icon } from './Icon';
import { testBreakdown, testPending } from './breakdown';

/**
 * Modale du TEST D'ÉQUIPAGE GÉNÉRIQUE en COMBAT (MDG ch.14, « Types de Test d'équipage ») — JUMEAU de
 * `ShipBatteryModal`/`ShipManeuverModal` (flux MULTI, `RollShell` + `RollRow`), paramétrée par le
 * TYPE (`pendingCrewTest.testTypeId`). Chaque rôle tenu = une rangée ; le bandeau somme les DR (essentiel ×2)
 * + Moral + Manque de bras + sabotage. **Rude épreuve** (l.106-114) : un total NÉGATIF réduit le Moral d'autant
 * (l.110) — la perte est prévisualisée dans le bandeau avant « Appliquer ». Les Tests d'équipage de VOYAGE
 * (hors combat) sont désormais des étapes de la cascade du jour (#275 Ronde 2 cran 3, `CascadeModal`) —
 * CETTE modale ne sert plus qu'au combat.
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
  const owns = (id: string) => net.mode === 'local' || ownsLocally(useGame.getState(), id);
  return (
    <CrewTestModalView
      p={p} battle={battle} party={party} owns={owns}
      roll={roll} reroll={reroll} bonus={bonus} darkPact={darkPact} force={force}
      confirm={confirm} cancel={cancel}
    />
  );
}

/** Corps PUR (props) — testable en rendu statique sans mocker le store (l'environnement de test est
 *  `node`, sans DOM : les sélecteurs de store ne s'hydratent pas sous `renderToStaticMarkup`). */
export function CrewTestModalView({ p, battle, party, owns, roll, reroll, bonus, darkPact, force, confirm, cancel }: {
  p: PendingCrewTest;
  battle: BattleState | null;
  party: Combatant[];
  owns: (id: string) => boolean;
  roll: (id: string) => void;
  reroll: (id: string) => void;
  bonus: (id: string) => void;
  darkPact: (id: string) => void;
  force: (id: string) => void;
  confirm: () => void;
  cancel: () => void;
}) {
  const pool = battle?.combatants ?? party;
  const ship = battle?.combatants.find((c) => c.id === p.shipId);
  const testType = findCrewTestTypeById(p.testTypeId);
  if (!ship || !testType) return null;

  const allRolled = p.participants.every((x) => x.result);
  const unrolled = p.participants.filter((x) => x.interactive && !x.result && owns(x.id));
  const total = maneuverCrewTotal(p.participants, p.essentialRoleId, p.moraleScore, p.undercrew, p.extraDR);
  const moraleLoss = p.testTypeId === 'rude-epreuve' ? rudeEpreuveMoraleDelta(total) : 0;
  const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

  const rows: RollRowData[] = p.participants.flatMap((part) => {
    const actor = pool.find((c) => c.id === part.id);
    if (!actor) return [];
    const res = part.result;
    const role = findCrewRoleById(part.roleId);
    const val = role ? crewRoleValue(actor, role, part.sense).value : 0;
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
    { key: 'confirm', label: 'Appliquer', onClick: confirm, when: 'always', disabled: !allRolled },
  ];

  return (
    <RollShell
      flowKey="crewTest"
      title={<><Icon id="travel/anchor" size="sm" /> {testType.label} — Test d’équipage</>}
      variant="test"
      subtitle={<><strong>{ship.name}</strong> — Moral {p.moraleScore}{p.extraDR ? ` · sabotage ${sign(p.extraDR)} DR` : ''} (MDG ch.14)</>}
      extra={p.extraDR
        ? <div className="rm-threat"><Icon id="ui/warning" size="sm" /> Le Test d’équipage est perturbé : {sign(p.extraDR)} DR (sabotage, MDG ch.14).</div>
        : undefined}
      rows={rows}
      rolled={allRolled}
      summary={allRolled
        ? <>DR total <b>{sign(total)}</b> — {total >= 1 ? 'succès' : 'échec'} (l.13).{moraleLoss ? <> Rude épreuve : <b>{moraleLoss}</b> Moral (l.110).</> : null}</>
        : undefined}
      actions={actions}
      onCancel={cancel}
    />
  );
}
