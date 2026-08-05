import { useGame } from '../state/store';
import { CharFrame } from './CharFrame';
import { RollRow } from './RollRow';
import { Icon } from './Icon';
import { Band } from './Band';
import type { NightEntry } from '../state/restFlow';
import { resultLine, freeCons } from '../state/rollSeam';

/**
 * PROCÈS-VERBAL (brique multi-jets) : globalise en UN écran une CASCADE de jets de ROUTINE résolus en
 * lot — une ligne compacte par jet (tuile du concerné + rangée de jet CANONIQUE `RollRow`) ou par note.
 * L'anatomie du jet (valeur/cible/DR/issue) est celle du reste des modales (`RollRow` → `RollPanel` →
 * `RollLine`) : une SEULE anatomie de jet à l'écran. Lecture seule (recap de voyage, jets de PNJ, bilan
 * de nuit) ; né pour le bilan de nuit, pensé pour resservir (PV du jour de mer, #232).
 * Les lignes CONSÉCUTIVES d'une même rubrique (`entry.group` — les contributeurs d'un même Test
 * d'équipage) se rendent sous UNE bande titrée (primitive `Band`) : l'en-tête ne se répète plus.
 */
export function MultiRollList({ entries }: { entries: NightEntry[] }) {
  const party = useGame((s) => s.party);
  if (!entries.length) return <p className="rm-note">Une nuit sans histoire.</p>;
  // Regroupement par rubrique CONSÉCUTIVE (l'ordre du PV est celui de la journée — jamais retrié).
  const groups: { group?: string; items: NightEntry[] }[] = [];
  for (const e of entries) {
    const last = groups[groups.length - 1];
    if (last && last.group != null && last.group === e.group) last.items.push(e);
    else groups.push({ group: e.group, items: [e] });
  }
  const row = (e: NightEntry, i: number) => {
    const actor = e.actorId ? party.find((h) => h.id === e.actorId) : undefined;
    return (
      <div key={e.id ?? i} className={`mrl-row ${e.tone ?? ''}`}>
        <span className="mrl-port">{actor && <CharFrame c={actor} variant="identity" size="xs" />}</span>
        <div className="mrl-roll">
          {/* Libellé (provenance du jet : rôle tenu, catégorie) AU-DESSUS de la rangée. */}
          <span className="mrl-label">{e.icon && <Icon id={e.icon} size="sm" />} {e.label}</span>
          {e.d
            ? <RollRow actor={actor} row={{ d: e.d, note: e.text ? resultLine(freeCons([e.text])) : e.text }} rolled interactive={false} />
            : (e.text ? <span className="mrl-text">{resultLine(freeCons([e.text]))}</span> : null)}
        </div>
      </div>
    );
  };
  return (
    <div className="mrl">
      {groups.map((g, gi) => (g.group
        ? <Band key={`g-${gi}`} title={g.group}>{g.items.map(row)}</Band>
        : <div key={`g-${gi}`}>{g.items.map(row)}</div>))}
    </div>
  );
}
