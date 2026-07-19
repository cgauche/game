import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { testValue } from '../engine/skills';
import { RollShell, type RollAction, type RollRowData } from './RollShell';
import { ChoiceButtons } from './OptionChooser';
import { testBreakdown, testPending } from './breakdown';
import { Icon } from './Icon';

/**
 * Modale de Chute VOLONTAIRE (LDB 15 l.82) : le pré-jet est le CHOIX RAW « vous pouvez tenter un Test
 * d'Athlétisme » — `ChoiceButtons` (Sauter directement / Tenter le Test), patron `ShantyModal` (menu
 * pré-jet). Choisir « Sauter » résout IMMÉDIATEMENT (`fallChoose(false)`, hors modale) ; choisir
 * « Tenter » ouvre le jet (Lancer → Chance/Pacte/Résilience → Appliquer, patron `RunModal`).
 */
export function FallModal() {
  const p = useGame((s) => s.pendingFall);
  const battle = useGame((s) => s.battle);
  const party = useGame((s) => s.party);
  const roll = useGame((s) => s.fallRoll);
  const reroll = useGame((s) => s.fallReroll);
  const bonusSL = useGame((s) => s.fallBonusSL);
  const darkPact = useGame((s) => s.fallDarkPact);
  const force = useGame((s) => s.fallForceSuccess);
  const confirm = useGame((s) => s.fallConfirm);
  const cancel = useGame((s) => s.fallCancel);
  const choose = useGame((s) => s.fallChoose);
  if (!p) return null;
  const c = (battle?.combatants ?? party).find((x) => x.id === p.combatantId);
  if (!c) return null;

  if (p.attempt === null) {
    return (
      <RollShell
        flowKey="fall"
        title={<><Icon id="melee/flee" size="sm" /> Chute volontaire</>}
        subtitle={<><strong>{c.label}</strong> se tient au bord d'un dénivelé de {p.metres} m</>}
        rows={[]}
        rolled={false}
        setup={
          <ChoiceButtons
            options={[
              { key: 'jump', label: `Sauter (chute pleine, ${p.metres} m)`, onSelect: () => choose(false) },
              { key: 'attempt', label: "Tenter un Test d'Athlétisme", primary: true, onSelect: () => choose(true) },
            ]}
          />
        }
        actions={[{ key: 'cancel', label: 'Annuler', onClick: cancel, when: 'pre' }]}
        onCancel={cancel}
      />
    );
  }

  const r = p.result;
  const rolled = !!r;
  const actorRow: RollRowData = {
    actor: c,
    row: {
      combatant: c,
      d: r ? testBreakdown('Athlétisme', testValue(c, 'athletisme'), { roll: r.roll, target: r.target, sl: r.dr, success: r.success }, 'accessible') : undefined,
      pending: testPending('Athlétisme', testValue(c, 'athletisme'), undefined, 'accessible'),
    },
    rolled,
    freeReroll: freeRerollOf(c),
    onRoll: roll,
    rerollable: !!r && !r.success && canReroll(true, !!p.rerolled),
    onReroll: reroll,
    onBonusSL: bonusSL,
    darkPactable: !!r && !r.success && c.kind === 'hero',
    onDarkPact: darkPact,
    onForce: force,
    forceShow: !r?.success,
  };

  const actions: RollAction[] = [
    { key: 'cancel', label: 'Annuler', onClick: cancel, when: 'pre' },
    { key: 'confirm', label: 'Appliquer', onClick: confirm, when: 'post' },
  ];

  return (
    <RollShell
      flowKey="fall"
      title={<><Icon id="melee/flee" size="sm" /> Chute volontaire</>}
      subtitle={<><strong>{c.label}</strong> amortit sa chute (Test d'Athlétisme +20, {p.metres} m)</>}
      rows={[actorRow]}
      rolled={rolled}
      outcome={r && (
        <div className="rm-journal">
          {r.effectiveMetres <= 0
            ? <>La chute est amortie : aucun Dégât.</>
            : <>{r.effectiveMetres} m de chute (réduite de {Math.max(0, p.metres - r.effectiveMetres)} m).</>}
        </div>
      )}
      actions={actions}
      onCancel={rolled ? undefined : cancel}
    />
  );
}
