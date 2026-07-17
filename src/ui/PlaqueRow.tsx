/**
 * Rangée-plaque « Atelier du scribe » — LA plaque sombre à rivets d'or de la planche ratifiée
 * (`docs/plans/2026-07-14-maquettes-createur/planche-creator-FINALE.html` : matière `.c-plate`,
 * états de tirage `.ck-cell` de l'étape 3), consacrée en primitive par le lot « ossature enforcée »
 * #393 (user 2026-07-15, verbatim : « c'est sensé etre des primitives ces éléments »). Stylée UNE
 * fois aux valeurs de la planche (`styles/plaque-row.css`) — un écran COMPOSE cette rangée
 * (caractéristiques de l'étape 3, rangées d'allocation : même meuble), il ne la redessine pas.
 */
import { useEffect, useRef, type ReactNode } from 'react';

export function PlaqueRow({
  prefix,
  label,
  name,
  sub,
  meta,
  fx,
  value,
  selected,
  rolling,
  attention,
  onClick,
  title,
  className,
}: {
  /** Préfixe : abréviation codex-liée ou icône, colonne fixe en tête de plaque. */
  prefix?: ReactNode;
  /** Libellé du champ porté par la plaque, colonne gravée en petites capitales (`.idf .lb` de la
   *  planche, étape Détails) — les valeurs d'une même `PlaqueGrid` s'alignent sur sa largeur. */
  label?: ReactNode;
  /** Nom en `--font-display` (chips de méta admises à sa suite) — ou le contrôle qui porte la
   *  valeur quand la plaque est ÉDITABLE (`<input>` : la plume écrit sur le trait pointillé
   *  `.idf .vl`). */
  name: ReactNode;
  /** Rubrique GRAVÉE sous le nom (`.rf` de la planche, portée à l'identique par `.ck-cell` ET
   *  `.cs-row` : la caractéristique liée et sa valeur vivante). Le nom cesse alors de s'élider —
   *  l'identité de la plaque s'empile sur deux lignes, comme la planche la pose. */
  sub?: ReactNode;
  /** Méta centrale : base, dés (`.rm-die`), steppers, select — calée à droite du nom. */
  meta?: ReactNode;
  /** Chips d'effet NET (registre État, #492 « chevet ») — rendues SOUS le nom/la sous-ligne, jamais
   *  à côté (`meta` reste la colonne latérale des autres écrans, ex. badges Possessions). Enroulent
   *  en rangée (`GameOpChips`/`EntityRef` — jamais la prose, qui vit au popover Codex). */
  fx?: ReactNode;
  /** Valeur de droite (total, résultat). */
  value?: ReactNode;
  /** État ÉLU — plaque chaude (`.c-plate.sel` de la planche). */
  selected?: boolean;
  /** État ROULANT — liseré or le temps du tirage (`.ck-cell.rolling` de la planche). */
  rolling?: boolean;
  /** Signal ponctuel « ramène-moi en vue » posé par l'ÉCRAN appelant (#535 DoD : première rangée
   *  d'allocation NON SOLDÉE à la fin d'un tirage/à l'arrivée sur un volet) — MÊME mécanisme de
   *  scroll que `rolling` (front montant unique), aucun style dédié : `rolling` porte déjà le liseré
   *  visuel de « rangée à regarder », `attention` n'ajoute qu'un DEUXIÈME déclencheur au même geste. */
  attention?: boolean;
  /** Plaque CLIQUABLE (`.c-plate{cursor:pointer}` de la planche : la plaque d'action de la bande
   *  d'ossature) — rend un VRAI bouton, jamais un `div` piégé au clic. */
  onClick?: () => void;
  title?: string;
  className?: string;
}) {
  const cls = ['plaque-row', selected ? 'sel' : '', rolling ? 'rolling' : '', className ?? ''].filter(Boolean).join(' ');
  // La rangée ACTIVE (celle qui roule) se ramène dans le viewport du rail scrollable (#535) — un
  // écran à dix rangées (Caractéristiques) fait défiler la cérémonie hors champ sans ce recentrage.
  // `'nearest'` : ne bouge rien si la rangée est déjà visible, jamais un saut agressif en haut de rail.
  const ref = useRef<HTMLButtonElement & HTMLDivElement>(null);
  const bringIntoView = rolling || attention;
  useEffect(() => {
    // `scrollIntoView` est absent en jsdom (galerie/tests de fumée) : optional chaining sur la
    // MÉTHODE, pas seulement sur `ref.current` (sinon TypeError "is not a function"). Un seul
    // déclenchement par FRONT MONTANT (`rolling`/`attention` false→true), jamais à chaque render.
    if (bringIntoView) ref.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [bringIntoView]);
  const inner = (
    <>
      {prefix != null && <span className="plaque-prefix">{prefix}</span>}
      {label != null && <span className="plaque-label">{label}</span>}
      <span className="plaque-name">
        {name}
        {sub != null && <small>{sub}</small>}
        {fx != null && <span className="plaque-fx">{fx}</span>}
      </span>
      {meta != null && <span className="plaque-meta">{meta}</span>}
      {value != null && <b className="plaque-value">{value}</b>}
    </>
  );
  return onClick ? (
    <button ref={ref} type="button" className={cls} title={title} onClick={onClick}>
      {inner}
    </button>
  ) : (
    <div ref={ref} className={cls} title={title}>
      {inner}
    </div>
  );
}

/** Grille canonique de rangées-plaques : 2 colonnes, une seule ≤700px (`.ck-grid` de la planche). */
export function PlaqueGrid({ children }: { children: ReactNode }) {
  return <div className="plaque-grid">{children}</div>;
}
