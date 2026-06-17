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
 * `key` côté appelant (ex. `key={item.label}`) réinitialise l'onglet actif quand on change d'entité.
 */
export function TabbedEntry({
  figure,
  title,
  aside,
  blurb,
  meta,
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
  tabs: EntryTab[];
}) {
  const [active, setActive] = useState(tabs[0]?.id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];
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
      {tabs.length > 1 && (
        <div className="zone-tabs">
          {tabs.map((t) => (
            <button key={t.id} className={`zone-tab ${current?.id === t.id ? 'active' : ''}`} onClick={() => setActive(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      )}
      {current?.content}
    </>
  );
}
