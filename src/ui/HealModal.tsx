import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { RollShell, type RollAction, type RollRowData } from './RollShell';
import { OptionChooser } from './OptionChooser';
import { testBreakdown, testPending } from './breakdown';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';
import { describeHeal } from '../state/flowOutcomes';
import { ModalSubject } from './ModalSubject';
import { combatHealModes } from '../engine/healing';
import { Icon } from './Icon';

/**
 * Flux de jet d'un SOIN (Guérison, LDB 09-Compétences) : « Lancer » → Chance (relance / +1 DR) →
 * Résilience → « Appliquer ». Sert DEUX hôtes :
 *  - en COMBAT : modale autonome (HealModal, via l'ActionBar — un acte = une Action) ;
 *  - hors combat : zone EMBARQUÉE de l'infirmerie (MedicModal, `embedded`) — la modale persistante
 *    reste ouverte après « Appliquer ».
 * Le soigneur peut être un PNJ payant : sa Chance/Résilience valent 0 (boutons inertes), et
 * « Annuler » avant le jet rembourse l'acte (healCancel).
 */
export function HealRollFlow({ embedded = false }: { embedded?: boolean }) {
  const ph = useGame((s) => s.pendingHeal);
  const battle = useGame((s) => s.battle);
  const party = useGame((s) => s.party);
  const roll = useGame((s) => s.healRoll);
  const reroll = useGame((s) => s.healReroll);
  const bonusSL = useGame((s) => s.healBonusSL);
  const darkPact = useGame((s) => s.healDarkPact);
  const force = useGame((s) => s.healForceSuccess);
  const confirm = useGame((s) => s.healConfirm);
  const cancel = useGame((s) => s.healCancel);
  const setMode = useGame((s) => s.healSetMode);
  if (!ph) return null;
  const pool = battle?.combatants ?? party; // même flux en combat (file) et hors combat (groupe)
  const healer = pool.find((c) => c.id === ph.healerId); // absent (PNJ médecin) → Chance/Résilience à 0
  const fortune = healer?.fortune ?? 0;
  const target = pool.find((c) => c.id === ph.targetId);
  const rolled = ph.roll != null;

  const wounds = ph.mode === 'wounds';
  const trauma = ph.mode === 'trauma';
  // Surface UNIQUE du soin en combat : on a ciblé l'allié sur la carte (mode par défaut) ; si plusieurs
  // soins s'appliquent à lui (Blessures ET Hémorragie), on choisit ICI, avant le jet. L'infirmerie
  // (embedded) garde son propre choix d'acte → pas de seg.
  const combatModes = !embedded && !rolled && target
    ? combatHealModes(target)
    : [];
  const bleed = target?.conditions.find((x) => x.name === 'hemorragique')?.value ?? 0;

  const freeReroll = freeRerollOf(healer);
  const actorRow: RollRowData = {
    actor: healer,
    row: {
      combatant: healer,
      d: rolled ? testBreakdown('Guérison', ph.skillValue, { roll: ph.roll!, target: ph.target, sl: ph.sl, success: ph.success }, ph.difficulty) : undefined,
      pending: testPending('Guérison', ph.skillValue, ph.target, ph.difficulty),
    },
    rolled,
    fortune,
    freeReroll,
    rerollable: rolled && canReroll(ph.roll! > ph.target, !!ph.rerolled) && (fortune > 0 || freeReroll),
    onRoll: roll,
    onReroll: reroll,
    onBonusSL: bonusSL,
    darkPactable: rolled && ph.roll! > ph.target && healer?.kind === 'hero',
    onDarkPact: darkPact,
    resilience: healer?.resilience ?? 0,
    onForce: force,
    forceShow: !ph.success,
  };

  const actions: RollAction[] = [
    { key: 'cancel', label: 'Annuler', onClick: cancel, when: 'pre' },
    { key: 'confirm', label: 'Appliquer', onClick: confirm, when: 'post' },
  ];

  return (
    <RollShell
      flowKey="heal"
      embedded={embedded}
      title={wounds ? <><Icon id="journal/heal" size="sm" /> Soigner les Blessures</> : trauma ? <><Icon id="medical/tear" size="sm" /> Soigner une déchirure</> : <><Icon id="condition/bleeding" size="sm" /> Arrêter l’Hémorragie</>}
      subtitle={
        <>
          <strong>{ph.healerName}</strong> soigne <strong>{ph.targetName}</strong>{' '}
          <span className="rm-weapon">(Guérison, Intermédiaire +0)</span>
        </>
      }
      extra={!embedded && target ? <ModalSubject c={target} variant="full" /> : undefined}
      setup={combatModes.length > 1 ? (
        <OptionChooser
          layout="seg"
          groupLabel="Soin"
          options={combatModes.map((m) => ({
            key: m,
            label: m === 'wounds' ? <><Icon id="journal/heal" size="sm" /> Blessures</> : <><Icon id="condition/bleeding" size="sm" /> Hémorragie ×{bleed}</>,
            selected: ph.mode === m,
            onSelect: () => setMode(m),
          }))}
        />
      ) : undefined}
      rows={[actorRow]}
      rolled={rolled}
      outcome={rolled && <JournalLine className="rm-journal" event={ev('heal', describeHeal(ph), ph.healerId, ph.targetId)} combatants={pool} />}
      actions={actions}
      onCancel={rolled ? undefined : cancel}
    />
  );
}

/** Modale de soin autonome — COMBAT seulement (hors combat, l'infirmerie embarque le flux). */
export function HealModal() {
  return <HealRollFlow />;
}
