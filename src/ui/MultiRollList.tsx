import { useGame } from '../state/store';
import { CharFrame } from './CharFrame';
import { RollRow } from './RollRow';
import { Icon } from './Icon';
import type { NightEntry } from '../state/restFlow';
import { resultLine, freeCons } from '../state/rollSeam';

/** Une ligne du PV est-elle un jet de HÉROS RATÉ, à conséquence recalculable et encore relançable
 *  (LDB 12 l.40 : une relance max) ? Seules ces lignes portent l'influence après coup. */
export function ledgerRerollable(e: NightEntry): boolean {
  return !!e.reKind && !!e.id && !!e.d && !e.d.success && !e.rerolled;
}

/**
 * PROCÈS-VERBAL (brique multi-jets) : globalise en UN écran une CASCADE de jets de ROUTINE résolus en
 * lot — une ligne compacte par jet (tuile du concerné + rangée de jet CANONIQUE `RollRow`) ou par note.
 * L'anatomie du jet (valeur/cible/DR/issue) est celle du reste des modales (`RollRow` → `RollPanel` →
 * `RollLine`) : une SEULE anatomie de jet à l'écran. Lecture seule (recap de voyage, jets de PNJ, bilan
 * de nuit) ; né pour le bilan de nuit, pensé pour resservir (PV du jour de mer, #232).
 */
export function MultiRollList({ entries }: { entries: NightEntry[] }) {
  const party = useGame((s) => s.party);
  if (!entries.length) return <p className="rm-note">Une nuit sans histoire.</p>;
  return (
    <div className="mrl">
      {entries.map((e, i) => {
        const actor = e.actorId ? party.find((h) => h.id === e.actorId) : undefined;
        return (
          <div key={e.id ?? i} className={`mrl-row ${e.tone ?? ''}`}>
            <span className="mrl-port">{actor && <CharFrame c={actor} variant="identity" size="xs" />}</span>
            <div className="mrl-roll">
              {/* Libellé (catégorie du jet) AU-DESSUS de la rangée. */}
              <span className="mrl-label">{e.icon && <Icon id={e.icon} size="sm" />} {e.label}</span>
              {e.d
                ? <RollRow actor={actor} row={{ d: e.d, note: e.text ? resultLine(freeCons([e.text])) : e.text }} rolled interactive={false} />
                : (e.text ? <span className="mrl-text">{resultLine(freeCons([e.text]))}</span> : null)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
