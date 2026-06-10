import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { CIBLE_TYPES, calmeValue } from '../engine/psychology';
import { RollFlowShell } from './RollFlowShell';
import { TeamPortrait } from './CombatantBadge';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';
import { CIBLE_LABEL, calmeBreakdown } from './psychLabels';

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

  const outcomeText = !r
    ? ''
    : isCible
      ? r.success ? `${hero.name} maîtrise son ${cl?.label.toLowerCase() ?? pe.kind}.` : `${hero.name} est en proie à son ${cl?.label.toLowerCase() ?? pe.kind}.`
      : isTerreur
        ? r.success ? `${hero.name} garde son sang-froid.` : `${hero.name} est terrifié par ${pe.sourceName} : ${r.brise} État(s) Brisé.`
        : r.success ? `${hero.name} surmonte sa peur de ${pe.sourceName}.` : `${hero.name} a peur de ${pe.sourceName}.`;

  return (
    <RollFlowShell
      title={cl ? `${cl.emoji} ${cl.label}${pe.cible ? ` (${pe.cible})` : ''}` : `${isTerreur ? '😱 Terreur' : '😨 Peur'} ${pe.indice}`}
      subtitle={<>{hero.name} doit garder son sang-froid face à <strong>{pe.sourceName}</strong>.</>}
      extra={
        <div className="modal-vs">
          <span className="mv-side"><TeamPortrait combatant={hero} size={40} /><strong>{hero.name}</strong></span>
        </div>
      }
      rolled={!!r}
      rollLabel="🎲 Test de Calme"
      onRoll={roll}
      breakdown={r ? calmeBreakdown(calmeValue(hero), r) : undefined}
      outcome={r ? <JournalLine className="rm-journal" event={ev('fear', outcomeText, hero.id, pe.sourceId)} combatants={lite} /> : undefined}
      determination={{ resolve: hero.resolve ?? 0, onResolve: determine }}
      fortune={hero.fortune ?? 0}
      freeReroll={freeRerollOf(hero)}
      rerollable={!!r && canReroll(!ok, !!pe.rerolled)}
      onReroll={reroll}
      /* Hors combat = Test SIMPLE binaire → relance simple, pas de « +1 DR ». */
      resilience={hero.resilience ?? 0}
      onForce={force}
      forceShow={!ok}
      onConfirm={confirm}
    />
  );
}
