import { useState, type ReactNode } from 'react';

/** Un onglet d'une fiche d'entité. `content` est rendu paresseusement (seul l'onglet actif s'affiche). */
export interface EntryTab {
  id: string;
  label: string;
  content: ReactNode;
}

/**
 * Présentation PARTAGÉE d'une fiche d'entité « riche » : en-tête (figurine + titre + accroche) puis
 * ONGLETS internes (Profil / Description / …) qui répartissent le contenu — donc tout se voit SANS
 * scroller un long pavé. SOURCE UNIQUE de la page d'espèce du créateur ET de la fiche du Codex
 * (réutilise les classes globales `.main-head`/`.zone-tabs`/`.zone-tab` de `creator.css`).
 *
 * L'onglet actif est mémorisé PAR NOM : au changement de fiche (les `tabs` changent), si un onglet
 * du même nom existe on y reste (feuilleter les créatures garde « Caractéristiques » ouvert),
 * sinon on retombe sur le 1er. Ne PAS remonter le composant via `key` côté appelant.
 */
export function TabbedEntry({
  figure,
  title,
  aside,
  blurb,
  meta,
  band,
  tabs,
}: {
  /** Figurine/aperçu à gauche du titre (rig, illustration…). */
  figure?: ReactNode;
  title: ReactNode;
  /** Élément à droite du titre (badge source, sous-titre…). */
  aside?: ReactNode;
  /** Accroche courte sous le titre. */
  blurb?: ReactNode;
  /** Faits-clés TOUJOURS visibles dans l'en-tête (jamais cachés dans un onglet). */
  meta?: ReactNode;
  /** Bande PLEINE LARGEUR entre l'en-tête et les onglets (statbloc compact d'une créature…). */
  band?: ReactNode;
  tabs: EntryTab[];
}) {
  const [active, setActive] = useState(tabs[0]?.label);
  const current = tabs.find((t) => t.label === active) ?? tabs[0];
  return (
    <>
      <div className="main-head">
        {figure}
        <div>
          <h2>
            {title}
            {aside}
          </h2>
          {blurb && <p className="hint">{blurb}</p>}
          {meta}
        </div>
      </div>
      {band}
      {tabs.length > 1 && (
        <div className="zone-tabs">
          {tabs.map((t) => (
            <button key={t.id} className={`zone-tab ${current?.id === t.id ? 'active' : ''}`} onClick={() => setActive(t.label)}>
              {t.label}
            </button>
          ))}
        </div>
      )}
      {current?.content}
    </>
  );
}
