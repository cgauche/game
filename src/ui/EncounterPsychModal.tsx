import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { CIBLE_TYPES, calmeValue } from '../engine/psychology';
import { RollFlowShell } from './RollFlowShell';
import { VsHeader } from './VsHeader';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';
import { describeEncounterPsych } from '../state/flowOutcomes';
import { CIBLE_LABEL, calmeBreakdown, calmePending } from './psychLabels';

/**
 * Modale de Psychologie À LA RENCONTRE, hors combat (couture C, LDB 21). Depuis le retour playtest :
 * Peur/Terreur sont COMBAT seulement → ici, uniquement les Traits ciblés sociaux (Animosité/Haine/…).
 * Même coquille de jet que le combat (RollLine + issue style journal + Détermination 1ʳᵉ classe) — plus
 * aucun rendu « custom ». Test SIMPLE binaire. Auto-chaînée héros par héros par le flux.
 */
export function EncounterPsychModal() {
  const pe = useGame((s) => s.pendingEncounterPsych);
  const party = useGame((s) => s.party);
  const roll = useGame((s) => s.encounterPsychRoll);
  const reroll = useGame((s) => s.encounterPsychReroll);
  const darkPact = useGame((s) => s.encounterPsychDarkPact);
  const force = useGame((s) => s.encounterPsychForceSuccess);
  const determine = useGame((s) => s.encounterPsychResolve);
  const confirm = useGame((s) => s.encounterPsychConfirm);
  if (!pe) return null;
  const hero = party.find((h) => h.id === pe.heroId);
  if (!hero) return null;
  const r = pe.result;
  const isTerreur = pe.kind === 'terreur';
  const isCible = CIBLE_TYPES.has(pe.kind);
  const ok = r ? !!r.success : false;
  const cl = isCible ? CIBLE_LABEL[pe.kind] : null;

  // Combattants pour colorer les noms : héros (allié) + la source nommée (ennemi).
  const lite = [...party.map((h) => ({ id: h.id, name: h.name, kind: 'hero' })), { id: pe.sourceId, name: pe.sourceName, kind: 'enemy' }];

  return (
    <RollFlowShell
      title={cl ? `${cl.emoji} ${cl.label}${pe.cible ? ` (${pe.cible})` : ''}` : `${isTerreur ? '😱 Terreur' : '😨 Peur'} ${pe.indice}`}
      subtitle={<>{hero.name} doit garder son sang-froid face à <strong>{pe.sourceName}</strong>.</>}
      extra={<VsHeader actor={hero} />}
      rolled={!!r}
      rollLabel="🎲 Test de Calme"
      onRoll={roll}
      breakdown={r ? calmeBreakdown(calmeValue(hero), r) : undefined}
      pending={calmePending(calmeValue(hero))}
      outcome={r ? <JournalLine className="rm-journal" event={ev('fear', describeEncounterPsych(pe, hero.name), hero.id, pe.sourceId)} combatants={lite} /> : undefined}
      determination={{ resolve: hero.resolve ?? 0, onResolve: determine }}
      fortune={hero.fortune ?? 0}
      freeReroll={freeRerollOf(hero)}
      rerollable={!!r && canReroll(!ok, !!pe.rerolled)}
      onReroll={reroll}
      darkPactable={!!r && !ok}
      onDarkPact={darkPact}
      /* Hors combat = Test SIMPLE binaire → relance simple, pas de « +1 DR ». */
      resilience={hero.resilience ?? 0}
      onForce={force}
      forceShow={!ok}
      onConfirm={confirm}
    />
  );
}
