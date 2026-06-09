import { Fragment } from 'react';
import type { Money } from '../engine/money';

/**
 * Affichage COLORÉ de la monnaie impériale (LDB 57) — or en couleur or, pistole d'argent en argent,
 * sou de cuivre en cuivre. Miroir JSX de `formatMoney` (MÊMES règles canon : couronne d'or `N CO`,
 * pistoles+sous en notation `S/C` « 6/8 », sous seuls `N sc`) ; `formatMoney` reste la source unique
 * pour les contextes texte (titres, journal). Utiliser <Coins> partout où un prix s'AFFICHE.
 */
export function Coins({ money }: { money: Money }) {
  const parts: JSX.Element[] = [];
  if (money.gold) parts.push(<span key="g" className="coin-gold">{money.gold} CO</span>);
  if (money.silver) {
    // Notation canon « S/C » : pistoles d'argent / sous de cuivre.
    parts.push(
      <Fragment key="s">
        <span className="coin-silver">{money.silver}</span>
        <span className="coin-sep">/</span>
        <span className="coin-copper">{money.brass || '–'}</span>
      </Fragment>,
    );
  } else if (money.brass) {
    parts.push(<span key="b" className="coin-copper">{money.brass} sc</span>);
  }
  if (!parts.length) parts.push(<span key="0" className="coin-copper">0 sc</span>);
  return (
    <span className="coins">
      {parts.map((p, i) => (
        <Fragment key={i}>
          {i > 0 ? ' ' : ''}
          {p}
        </Fragment>
      ))}
    </span>
  );
}
