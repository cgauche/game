/**
 * WaxSeal — sceau de cire TÊTE DE MORT (SVG dessiné, tracés copiés au pixel du kit ratifié
 * « Atelier du scribe », #412 — pas d'emoji). `SealedPlaque` compose ce sceau en médaillon posé
 * sur une plaque (candidature/carrière élue) — motif `.cs-tcard` du kit.
 */
export function WaxSeal({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={`wax-seal${className ? ` ${className}` : ''}`} aria-hidden="true">
      <defs>
        <radialGradient id="waxSealGradient" cx="35%" cy="30%">
          <stop offset="0" stopColor="#c8503a" />
          <stop offset=".55" stopColor="#8f1f14" />
          <stop offset="1" stopColor="#5a120a" />
        </radialGradient>
      </defs>
      <path
        fill="url(#waxSealGradient)"
        d="M33 3 C44 2 55 8 59 18 C63 27 61 37 56 45 C58 50 56 54 51 56 C45 61 36 63 28 60 C24 62 19 61 16 57 C9 53 3 45 3 36 C2 26 8 15 16 9 C21 5 27 4 33 3 Z"
      />
      <path fill="var(--atelier-wax-fold)" d="M56 45 C60 47 63 51 61 54 C59 56 55 55 54 52 C53 49 54 46 56 45 Z" />
      <circle cx="32" cy="32" r="20" fill="none" stroke="var(--atelier-wax-ring)" strokeWidth="2.4" opacity=".85" />
      <circle cx="32" cy="33.4" r="20" fill="none" stroke="var(--atelier-wax-ring-light)" strokeWidth=".9" opacity=".38" />
      <path
        fill="var(--atelier-wax-ring)"
        d="M32 15 C42 15 47 22 47 29.5 C47 35 44 38.5 40.5 40 L40.5 44 Q32 47.5 23.5 44 L23.5 40 C20 38.5 17 35 17 29.5 C17 22 22 15 32 15 Z"
      />
      <g fill="var(--atelier-wax-shadow)">
        <ellipse cx="26.3" cy="29" rx="3.7" ry="4.5" />
        <ellipse cx="37.7" cy="29" rx="3.7" ry="4.5" />
        <path d="M32 33.2 L34.5 38 L29.5 38 Z" />
        <rect x="27.4" y="40.2" width="1.5" height="4.8" rx=".7" />
        <rect x="31.25" y="40.8" width="1.5" height="5.4" rx=".7" />
        <rect x="35.1" y="40.2" width="1.5" height="4.8" rx=".7" />
      </g>
      <path fill="var(--atelier-wax-ring-light)" opacity=".3" d="M23.5 44 Q32 47.5 40.5 44 L40.5 45.3 Q32 48.8 23.5 45.3 Z" />
    </svg>
  );
}

/**
 * SealedPlaque — plaque d'élu scellée (motif `.cs-tcard` du kit) : sceau de cire en médaillon +
 * titre + description, état `.sel` (élu). Composée par tout écran de sélection cérémonielle
 * (créateur : espèce/carrière/candidat).
 */
export function SealedPlaque({ title, desc, selected, onClick }: {
  title: string;
  desc?: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`sealed-plaque${selected ? ' sel' : ''}`}
      onClick={onClick}
      aria-pressed={onClick ? selected : undefined}
    >
      <WaxSeal size={22} className="sealed-plaque-seal" />
      <span className="sealed-plaque-title">{title}</span>
      {desc && <span className="sealed-plaque-desc">{desc}</span>}
    </Tag>
  );
}
