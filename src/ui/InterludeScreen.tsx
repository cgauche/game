import { useGame } from '../state/store';
import { interludeEventFor } from '../data/interludeEvents';

/**
 * Écran « Entre deux aventures » (LDB 22-23, Jalon 5) — V1 : événements tirés par héros +
 * compteur d'Activités + clôture (Argent à gaspiller). Les cartes d'Activités jouables (Revenus,
 * Artisanat, banque…) arrivent en P2 (plan 2026-06-11) — les actions store se branchent ici.
 */
export function InterludeScreen() {
  const interlude = useGame((s) => s.interlude);
  const party = useGame((s) => s.party);
  const money = useGame((s) => s.money);
  const end = useGame((s) => s.interludeEnd);
  if (!interlude) return null;
  return (
    <div className="menu">
      <div className="menu-card interlude-card">
        <h1 className="title">Entre deux aventures</h1>
        <p className="subtitle">
          {interlude.weeks} semaine{interlude.weeks > 1 ? 's' : ''} s'écoule{interlude.weeks > 1 ? 'nt' : ''} — chaque héros dispose d'Activités (LDB 23).
        </p>
        <div className="interlude-heroes">
          {party.filter((h) => !h.dead).map((h) => {
            const st = interlude.perHero[h.id];
            if (!st) return null;
            const ev = interludeEventFor(st.eventRoll);
            return (
              <section className="interlude-hero" key={h.id}>
                <h3>{h.name} <span className="interlude-left">{st.left} Activité{st.left > 1 ? 's' : ''} restante{st.left > 1 ? 's' : ''}</span></h3>
                <p className="interlude-event"><strong>🎲 {st.eventRoll} — {ev.label}.</strong> {ev.text}</p>
              </section>
            );
          })}
        </div>
        <p className="interlude-warning">
          À la clôture, l'argent du groupe ({`${money.gold} CO ${money.silver}/${money.brass}`}) sera dépensé en totalité
          (« Argent à gaspiller », LDB 23) — seuls les dépôts bancaires et les Revenus survivent.
        </p>
        <div className="menu-buttons">
          <button className="btn btn-primary" onClick={end}>Clore l'interlude</button>
        </div>
      </div>
    </div>
  );
}
