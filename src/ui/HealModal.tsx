import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { healWoundsDelta } from '../engine/healing';
import { RollFlowShell } from './RollFlowShell';
import { testBreakdown, testPending } from './breakdown';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';
import { ModalSubject } from './ModalSubject';

/**
 * Flux de jet d'un SOIN (Guérison, LDB 09-Compétences) : « Lancer » → Chance (relance / +1 DR) →
 * Résilience → « Appliquer ». Invariante « un jet = une modale ». Sert DEUX hôtes :
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
  if (!ph) return null;
  const pool = battle?.combatants ?? party; // même flux en combat (file) et hors combat (groupe)
  const healer = pool.find((c) => c.id === ph.healerId); // absent (PNJ médecin) → Chance/Résilience à 0
  const fortune = healer?.fortune ?? 0;
  const target = pool.find((c) => c.id === ph.targetId);
  const rolled = ph.roll != null;

  const wounds = ph.mode === 'wounds';
  const trauma = ph.mode === 'trauma';
  const preview = wounds ? healWoundsDelta(ph.intBonus, ph.sl, ph.success) : null;
  const outcomeText = ph.success
    ? wounds
      ? `${ph.targetName} récupère ${preview} PB.`
      : trauma
        ? `Convalescence de ${ph.targetName} raccourcie de ${1 + Math.max(0, ph.sl)} jour(s).`
        : `${1 + Math.max(0, ph.sl)} pion(s) d'Hémorragie stoppé(s) sur ${ph.targetName}.`
    : wounds && ph.intBonus + ph.sl < 0
      ? `Le soin blesse ${ph.targetName} (${ph.intBonus + ph.sl} PB).`
      : `Le soin de ${ph.targetName} reste sans effet.`;
  return (
    <RollFlowShell
      embedded={embedded}
      title={wounds ? '🩹 Soigner les Blessures' : trauma ? '🦵 Soigner une déchirure' : '🩸 Arrêter l’Hémorragie'}
      subtitle={
        <>
          <strong>{ph.healerName}</strong> soigne <strong>{ph.targetName}</strong>{' '}
          <span className="rm-weapon">(Guérison, Intermédiaire +0)</span>
        </>
      }
      extra={!embedded && target ? <ModalSubject c={target} variant="full" /> : undefined}
      rolled={rolled}
      onRoll={roll}
      onCancel={cancel}
      cancelFirst
      breakdown={rolled ? testBreakdown('Guérison', ph.skillValue, { roll: ph.roll!, target: ph.target, sl: ph.sl, success: ph.success }, ph.difficulty) : undefined}
      pending={testPending('Guérison', ph.skillValue, ph.target, ph.difficulty)}
      outcome={rolled && <JournalLine className="rm-journal" event={ev('heal', outcomeText, ph.healerId, ph.targetId)} combatants={pool} />}
      fortune={fortune}
      freeReroll={freeRerollOf(healer)}
      rerollable={rolled && canReroll(ph.roll! > ph.target, !!ph.rerolled) && (fortune > 0 || freeRerollOf(healer))}
      onReroll={reroll}
      onBonusSL={bonusSL}
      darkPactable={rolled && ph.roll! > ph.target && healer?.kind === 'hero'}
      onDarkPact={darkPact}
      resilience={healer?.resilience ?? 0}
      onForce={force}
      forceShow={!ph.success}
      onConfirm={confirm}
    />
  );
}

/** Modale de soin autonome — COMBAT seulement (hors combat, l'infirmerie embarque le flux). */
export function HealModal() {
  return <HealRollFlow />;
}
