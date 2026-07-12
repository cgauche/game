import type { ReactNode } from 'react';

/**
 * Habillage SOBRE partagé des petits plans SVG (`MapCanvas`, #345 phase 5) : onglet Plan du hub de
 * ville et aperçu de placement d'un POI dans l'éditeur — un parchemin discret, réutilisant les
 * tokens `--wm-*` de `base.css` (AUCUN nouveau thème). La carte du MONDE (`WorldMapView`) garde son
 * propre habillage riche (grain/vignette/rose des vents) : ce chrome reste volontairement nu, ces
 * plans étant de petites surfaces secondaires.
 */
export function planChrome(): ReactNode {
  return (
    <>
      <rect x="0" y="0" width="100" height="64" rx="2" fill="var(--wm-badge-bg)" stroke="var(--wm-frame-dark)" strokeWidth="0.6" />
      <rect x="1.2" y="1.2" width="97.6" height="61.6" rx="1.4" fill="none" stroke="var(--wm-frame-gold)" strokeWidth="0.3" />
    </>
  );
}
