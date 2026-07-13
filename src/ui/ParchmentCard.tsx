import type { ReactNode } from 'react';

/**
 * Carte-parchemin narrative (#371 LOT « moisson n°4 ») — texture `.tx-parchment` (ornaments.css)
 * + sceau de cire optionnel (tirage d100) posé sur le bord + un titre en font-display, pour tout
 * récit ponctuel adossé à un tirage : événement d'interlude, événement de bord en mer, révélation
 * d'entrée de scène. Étalon = `InterludeScreen` (chronique des Événements, #257) — les autres
 * consommateurs COMPOSENT cette même primitive plutôt que de recopier `.tx-parchment` + un sceau.
 */
export function ParchmentCard({ seal, title, tone, children }: {
  /** Médaillon d100 (cire rouge) — absent = pas de tirage à montrer (ex. révélation de scène). */
  seal?: { label?: string; roll: number };
  title?: ReactNode;
  tone?: 'ok' | 'bad' | 'info';
  children: ReactNode;
}) {
  return (
    <article className={`parchment-card tx-parchment${tone ? ` ${tone}` : ''}`}>
      {seal && (
        <div className="parchment-seal" title={`Tirage : ${seal.roll}${seal.label ? ` ${seal.label}` : ''}`}>
          <span className="parchment-seal-roll">{seal.roll}</span>
          {seal.label && <span className="parchment-seal-label">{seal.label}</span>}
        </div>
      )}
      <div className="parchment-card-body">
        {title && <h3 className="parchment-card-title">{title}</h3>}
        {children}
      </div>
    </article>
  );
}
