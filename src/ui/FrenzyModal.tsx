import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { effectiveChar } from '../engine/characteristics';
import { RollShell, type RollAction, type RollRowData } from './RollShell';
import { testBreakdown, testPending } from './breakdown';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';
import { describeFrenzy } from '../state/flowOutcomes';
import { Icon } from './Icon';

/**
 * Modale d'entrée en Frénésie (LDB 21 l.32) : « Lancer » jette le Test de Force Mentale,
 * « Relancer »/« Réussite garantie » dépensent Chance/Résilience, « Appliquer » fige le résultat
 * (entre en Frénésie sur succès). Test binaire (pas de DR) → pas de « +1 DR ».
 */
export function FrenzyModal() {
  const pf = useGame((s) => s.pendingFrenzy);
  const battle = useGame((s) => s.battle);
  const roll = useGame((s) => s.frenzyRoll);
  const reroll = useGame((s) => s.frenzyReroll);
  const darkPact = useGame((s) => s.frenzyDarkPact);
  const force = useGame((s) => s.frenzyForceSuccess);
  const confirm = useGame((s) => s.frenzyConfirm);
  const cancel = useGame((s) => s.frenzyCancel);
  if (!pf || !battle) return null;
  const c = battle.combatants.find((x) => x.id === pf.combatantId);
  if (!c) return null;
  const r = pf.result;
  const rolled = !!r;

  const actorRow: RollRowData = {
    actor: c,
    row: {
      combatant: c,
      d: r ? testBreakdown('Force Mentale', effectiveChar(c, 'force-mentale'), { roll: r.roll, target: r.target, sl: r.sl, success: r.success }) : undefined,
      pending: testPending('Force Mentale', effectiveChar(c, 'force-mentale')),
    },
    rolled,
    fortune: c.fortune ?? 0,
    freeReroll: freeRerollOf(c),
    rerollable: !!r && !r.success && canReroll(true, !!pf.rerolled),
    onRoll: roll,
    onReroll: reroll,
    darkPactable: !!r && !r.success && c.kind === 'hero',
    onDarkPact: darkPact,
    resilience: c.resilience ?? 0,
    onForce: force,
    forceShow: !r?.success,
  };

  const actions: RollAction[] = [
    { key: 'cancel', label: 'Annuler', onClick: cancel, when: 'pre' },
    { key: 'confirm', label: 'Appliquer', onClick: confirm, when: 'post' },
  ];

  return (
    <RollShell
      flowKey="frenzy"
      title={<><Icon id="flag/frenzy" size="sm" /> Frénésie</>}
      subtitle={
        <>
          <strong>{c.name}</strong> tente d'entrer en Frénésie (Test de Force Mentale)
        </>
      }
      rows={[actorRow]}
      rolled={rolled}
      outcome={r && (
        <JournalLine
          className="rm-journal"
          event={ev('frenzy', describeFrenzy(pf, c.name), c.id)}
          combatants={battle.combatants}
        />
      )}
      actions={actions}
      onCancel={rolled ? undefined : cancel}
    />
  );
}
