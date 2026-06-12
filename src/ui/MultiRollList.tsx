import { useGame } from '../state/store';
import { CharFrame } from './CharFrame';
import { RollLine } from './RollLine';
import type { NightEntry } from '../state/restFlow';

/**
 * Brique MULTI-JETS : globalise une CASCADE de jets subis en UN écran — une ligne compacte par
 * jet (tuile du concerné + RollLine) ou par note. Lecture seule (jets d'entretien, sans Chance).
 * Née pour le bilan de nuit (modale de Repos) ; pensée pour resservir (fins de Round, etc.).
 */
export function MultiRollList({ entries }: { entries: NightEntry[] }) {
  const party = useGame((s) => s.party);
  if (!entries.length) return <p className="rm-note">Une nuit sans histoire.</p>;
  return (
    <div className="mrl">
      {entries.map((e, i) => {
        const actor = e.actorId ? party.find((h) => h.id === e.actorId) : undefined;
        return (
          <div key={i} className={`mrl-row ${e.tone ?? ''}`}>
            <span className="mrl-port">{actor && <CharFrame c={actor} variant="identity" size="xs" />}</span>
            <span className="mrl-ic">{e.icon}</span>
            {e.d ? (
              <div className="mrl-roll">
                <span className="mrl-label">{e.label}</span>
                <RollLine d={e.d} />
              </div>
            ) : (
              <span className="mrl-text"><b>{e.label}</b>{e.text ? ` — ${e.text}` : ''}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
