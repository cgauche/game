import { useRef, type ReactNode } from 'react';
import { useModalA11y } from './Modal';
import { ScreenMeta } from './ScreenMeta';
import { SceneBackdrop } from './SceneBackdrop';
import type { Money } from '../engine/money';

/**
 * ScreenShell — LA coquille UNIQUE des écrans plein-champ (carte du monde, port/escale, marché,
 * dossier de navire, négoce…). Extraite du patron de facto `.worldmap-overlay` : voile plein écran
 * (z-index 90, sous les modales) + en-tête (titre à gauche, méta + actions + fermeture à droite) + corps.
 * Comme `<Modal>`, elle porte l'a11y de dialogue (`role="dialog"`, focus initial + piège Tab, Échap =
 * `onClose`) via `useModalA11y` — plus AUCUN écran ne recode `.worldmap-overlay`/`.worldmap-head`.
 *
 * Fermeture (#362) : `closeLabel` par défaut « ✕ Fermer » — SEULE exception tolérée un vrai autre
 * VERBE d'action (ex. « Réduire » pour un panneau qui se replie sans fermer le flux), jamais une
 * simple synonymie du même geste (« Quitter »).
 *
 * Méta d'en-tête (#362) : slot `meta` STANDARD `{ time?, money? }` — date/bourse rendues dans
 * `.worldmap-head-actions` (JAMAIS dans `.screen-toolbar`, qui reste aux `<Tabs>`/filtres et casse
 * sur deux lignes avec un contenu large). Barre d'outils : slot `tabs` OPTIONNEL rendu dans
 * `.screen-toolbar`, sous l'en-tête — l'écran y pose la primitive `<Tabs>` (onglets réels) et/ou du
 * contenu libre, tel quel. `className` ajoute des classes au voile (ex. `port-overlay`, `ship-dossier`).
 *
 * Habillage générique (#371 lot 2) : `body` bascule le traitement du CORPS — `'full'` (défaut, INCHANGÉ)
 * pour un écran-canevas (carte, plan) qui doit remplir tout le cadre ; `'centered'` borne et centre le
 * corps (`.screen-body`, patron ex-manuel `.port-body`/`.city-hub-master`, ~960px) — le réflexe pour un
 * écran de PANNEAUX/LECTURE (marché, dossier, hub) sans quoi le contenu colle à gauche avec un océan vide
 * à droite en large (famille « vide non habité » du juge, #371) ; `'centered-wide'` (politique grand écran,
 * docs/charte-ui.md) — même bornage/centrage mais plafond relevé (`.screen-body-wide`, ~1400px au-delà de
 * 1440px) pour un écran-GRILLE/catalogue (tables de négoce…) qui profite de plus de colonnes utiles.
 * `backdrop` pose la bande d'ambiance (`SceneBackdrop`, lot 1) sous l'en-tête/barre d'outils, au-dessus du
 * corps — absente du prop = pas de bande (zéro régression) ; fournie (même id inconnu) = toujours un rendu
 * (repli élégant géré par `SceneBackdrop`, jamais un trou).
 */
export function ScreenShell({
  title,
  onClose,
  closeLabel = '✕ Fermer',
  meta,
  actions,
  tabs,
  backdrop,
  body = 'full',
  className,
  children,
}: {
  title: ReactNode;
  /** Échap / bouton de fermeture. */
  onClose: () => void;
  /** Libellé du bouton de fermeture (défaut « ✕ Fermer »). */
  closeLabel?: ReactNode;
  /** Slot d'en-tête STANDARD date/bourse (opt-in) — `time` = instant de campagne, `money` = bourse du groupe. */
  meta?: { time?: number; money?: Money };
  /** Boutons d'en-tête AVANT la fermeture (rendus à droite, à côté du bouton Fermer). */
  actions?: ReactNode;
  /** Barre d'outils OPTIONNELLE (`.screen-toolbar`) : `<Tabs>` et/ou badges de l'écran, tels quels. */
  tabs?: ReactNode;
  /** Bande d'ambiance (id du registre `src/ui/backdrops`) — opt-in, rendue sous l'en-tête/barre d'outils. */
  backdrop?: string;
  /** Traitement du corps : `'full'` (défaut) laisse l'écran remplir le cadre ; `'centered'` borne/centre
   *  le corps (`.screen-body`, ~960px) au patron des écrans de panneaux/lecture ; `'centered-wide'` idem
   *  avec un plafond relevé (`.screen-body-wide`, ~1400px≥1440px) pour un écran-grille/catalogue. */
  body?: 'centered' | 'centered-wide' | 'full';
  /** Classes ajoutées au voile plein écran (`port-overlay`, `ship-dossier`…). */
  className?: string;
  children: ReactNode;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  useModalA11y(boxRef, onClose);
  return (
    <div ref={boxRef} role="dialog" aria-modal="true" className={`worldmap-overlay${className ? ` ${className}` : ''}`}>
      <div className="worldmap-head">
        <h2>{title}</h2>
        <div className="worldmap-head-actions">
          <ScreenMeta meta={meta} />
          {actions}
          <button type="button" className="btn small" onClick={onClose}>{closeLabel}</button>
        </div>
      </div>
      {tabs != null && <div className="screen-toolbar">{tabs}</div>}
      {backdrop !== undefined && <SceneBackdrop backdropId={backdrop} />}
      {body === 'centered' ? <div className="screen-body">{children}</div>
        : body === 'centered-wide' ? <div className="screen-body screen-body-wide">{children}</div>
        : children}
    </div>
  );
}
