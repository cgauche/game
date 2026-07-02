import { narrateEvent } from '../gameIso/combatNarration';
import type { CombatEvent } from '../state/combatLog';
import { Icon } from './Icon';

/** Forme minimale d'un combattant pour colorer les noms par camp (id/name/kind). */
interface ComLite { id: string; name: string; kind: string; }

/** Icône + texte coloré par camp d'un événement narré — cœur partagé (journal, bandeau, modales). */
export function NarratedSegments({ event, combatants }: { event: CombatEvent; combatants?: ComLite[] }) {
  const n = narrateEvent(event, combatants ?? []);
  return (
    <>
      <span className="jr-ic"><Icon id={n.icon} size="sm" /></span>
      <span className="jr-tx">
        {n.segments.map((s, j) =>
          s.team ? (
            <b key={j} className={s.team === 'ally' ? 'nm-ally' : 'nm-foe'}>{s.text}</b>
          ) : (
            <span key={j}>{s.text}</span>
          ),
        )}
      </span>
    </>
  );
}

/** Une ligne de journal d'événement (icône + noms colorés) — réutilisée dans les modales pour
 *  afficher l'issue d'un jet « dans le style du journal » plutôt qu'un verdict brut. */
export function JournalLine({ event, combatants, className = '' }: { event: CombatEvent; combatants?: ComLite[]; className?: string }) {
  return (
    <p className={`jr-line ${className}`}>
      <NarratedSegments event={event} combatants={combatants} />
    </p>
  );
}
