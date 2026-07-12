import type { ReactNode } from 'react';

/**
 * Habillage SOBRE partagé des petits plans SVG (`MapCanvas`, #345 phase 5) : onglet Plan du hub de
 * ville et aperçu de placement d'un POI dans l'éditeur — parchemin + taches d'âge discrètes, mêmes
 * tokens `--wm-*` de `base.css` (AUCUN nouveau thème). La carte du MONDE (`WorldMapView`) garde son
 * propre habillage riche (grain/vignette/rose des vents/fleurons) : ce chrome reste volontairement
 * SANS rose des vents ni fleurons, ces plans étant de petites surfaces secondaires (#360).
 */
export function planChrome(): ReactNode {
  return (
    <>
      {/* Parchemin plat (fond `--wm-badge-bg`) + taches d'âge discrètes (mêmes tokens que le monde,
       *  positions distinctes pour ne pas cloner `WorldMapView`) + cadre à double filet. */}
      <rect x="0" y="0" width="100" height="64" rx="2" fill="var(--wm-badge-bg)" stroke="var(--wm-frame-dark)" strokeWidth="0.6" />
      <ellipse cx="18" cy="46" rx="9" ry="5" fill="var(--wm-age-spot)" opacity="0.05" />
      <ellipse cx="82" cy="16" rx="8" ry="4.4" fill="var(--wm-age-spot)" opacity="0.045" />
      <rect x="1.2" y="1.2" width="97.6" height="61.6" rx="1.4" fill="none" stroke="var(--wm-frame-gold)" strokeWidth="0.3" />
    </>
  );
}
