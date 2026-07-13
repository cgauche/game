import type { ReactNode } from 'react';

/**
 * Rose des vents décorative (carte ancienne) — 4 branches cardinales bicolores + N. Primitive de chrome
 * de carte PARTAGÉE : la carte du monde (`WorldMapView`) et les petits plans (`planChrome`) la posent,
 * `scale` ajustant sa taille à la surface. Tokens `--wm-*` de `base.css` (aucun littéral de couleur).
 */
export function CompassRose({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  const ink = 'var(--wm-ink)', faint = 'var(--wm-compass-faint)';
  const ray = (rot: number, long: boolean) => {
    const r = long ? 5.4 : 3.2;
    return (
      <g key={rot} transform={`rotate(${rot})`}>
        <path d={`M 0 0 L 0.9 -${r * 0.5} L 0 -${r} Z`} fill={ink} />
        <path d={`M 0 0 L -0.9 -${r * 0.5} L 0 -${r} Z`} fill={faint} />
      </g>
    );
  };
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} opacity="0.85" aria-hidden>
      <circle r="6" fill="none" stroke={faint} strokeWidth="0.25" />
      <circle r="4.4" fill="none" stroke={faint} strokeWidth="0.2" />
      {[45, 135, 225, 315].map((d) => ray(d, false))}
      {[0, 90, 180, 270].map((d) => ray(d, true))}
      <circle r="0.7" fill={ink} />
      <text y="-6.6" textAnchor="middle" fontSize="2.4" fill={ink} fontWeight={700}>N</text>
    </g>
  );
}

/** Équerre d'angle dorée (une par coin) — ornement de plaque d'atlas, en tokens `--wm-*`. */
function CornerBracket({ x, y, sx, sy }: { x: number; y: number; sx: number; sy: number }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${sx} ${sy})`}
      d="M0 5.2 L0 0 L5.2 0"
      fill="none"
      stroke="var(--wm-frame-gold)"
      strokeWidth="0.45"
      opacity="0.85"
    />
  );
}

/**
 * Habillage des petits plans SVG (`MapCanvas`, #345 phase 5 · enrichi #371) : onglet Plan du hub de ville
 * et aperçu de placement d'un POI dans l'éditeur. Plaque d'atlas ancien — parchemin + taches d'âge, cadre
 * à double filet (brun épais / or fin) + équerres d'angle, cartouche de titre portant le NOM du lieu
 * (`title`), rose des vents discrète et trame suggérée (cours d'eau + voies, génériques, sans donnée) : une
 * carte, pas un devis vide. Mêmes tokens `--wm-*` de `base.css` (AUCUN littéral de couleur, aucun nouveau
 * thème). `title` optionnel : les aperçus d'éditeur au niveau MONDE le passent vide (pas de cartouche).
 */
export function planChrome(title?: string): ReactNode {
  const tw = title ? Math.max(26, title.length * 2.1 + 10) : 0;
  return (
    <>
      {/* Parchemin plat + taches d'âge (mêmes tokens que le monde, positions distinctes). */}
      <rect x="0" y="0" width="100" height="64" rx="2.5" fill="var(--wm-badge-bg)" stroke="var(--wm-frame-dark)" strokeWidth="0.6" />
      <ellipse cx="18" cy="46" rx="9" ry="5" fill="var(--wm-age-spot)" opacity="0.05" />
      <ellipse cx="82" cy="16" rx="8" ry="4.4" fill="var(--wm-age-spot)" opacity="0.045" />
      <ellipse cx="58" cy="55" rx="6" ry="3.4" fill="var(--wm-age-spot)" opacity="0.04" />
      {/* Trame SUGGÉRÉE (générique, sans donnée) : un cours d'eau sinueux + deux voies, très pâles —
          lecture d'atlas plutôt que fond nu. Décoratives, sous les marqueurs (le chrome est en arrière). */}
      <path d="M6 41 C 24 31, 34 51, 52 43 S 82 31, 95 45" fill="none" stroke="var(--wm-frame-dark)" strokeWidth="0.5" opacity="0.06" aria-hidden />
      <path d="M22 11 L 39 57" fill="none" stroke="var(--wm-frame-dark)" strokeWidth="0.32" opacity="0.05" aria-hidden />
      <path d="M76 9 L 61 59" fill="none" stroke="var(--wm-frame-dark)" strokeWidth="0.32" opacity="0.05" aria-hidden />
      {/* Cadre à double filet + hachure d'époque + équerres d'angle. */}
      <rect x="1.4" y="1.4" width="97.2" height="61.2" rx="2" fill="none" stroke="var(--wm-frame-dark)" strokeWidth="1.1" />
      <rect x="3.1" y="3.1" width="93.8" height="57.8" rx="1.4" fill="none" stroke="var(--wm-frame-gold)" strokeWidth="0.35" />
      <rect x="4.6" y="4.6" width="90.8" height="54.8" rx="1" fill="none" stroke="var(--wm-frame-gold)" strokeWidth="0.2" strokeDasharray="0.9 1.4" opacity="0.5" />
      <CornerBracket x={5} y={5} sx={1} sy={1} />
      <CornerBracket x={95} y={5} sx={-1} sy={1} />
      <CornerBracket x={5} y={59} sx={1} sy={-1} />
      <CornerBracket x={95} y={59} sx={-1} sy={-1} />
      <CompassRose x={89} y={51} scale={0.62} />
      {/* Cartouche de titre (nom du lieu) — décor redondant avec le titre de l'écran, donc aria-hidden. */}
      {title && (
        <g transform="translate(50 7.4)" aria-hidden>
          <rect x={-tw / 2} y="-3.6" width={tw} height="7.2" rx="1.5" fill="var(--wm-cartouche-bg)" opacity="0.92" stroke="var(--wm-frame-gold)" strokeWidth="0.3" />
          <text y="1.1" textAnchor="middle" fontSize="3.5" fontWeight={700} fill="var(--wm-cartouche-fg)" letterSpacing="0.25">{title}</text>
        </g>
      )}
    </>
  );
}
