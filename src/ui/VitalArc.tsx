/**
 * VitalArc — arc de vie gravé SOUS la boîte-figurine (#492 lot « colonne présence », verdict user
 * 2026-07-17 : « mieux intégrer la barre de vie » — remplace la plaque « Blessures N/M » qui MEURT,
 * l'arc EST la jauge). Valeurs reprises du mock `docs/plans/2026-07-17-planche-etat-chevet.html`
 * (`.lifearc`) : tracé `viewBox 0 0 170 46`, rayon 120, corde 142 (`ARC_LEN` = longueur du tracé,
 * `2·R·asin(demi-corde/R)`). Teinte CONTINUE du plein (`--gold2`) au critique (`--danger`) par le
 * ratio courant/max — pas de seuils arbitraires, `color-mix` interpole les DEUX tokens existants.
 */
export interface VitalArcProps {
  current: number;
  max: number;
}

const ARC_PATH = 'M14 40 A 120 120 0 0 1 156 40';
const ARC_LEN = 2 * 120 * Math.asin(71 / 120);

export function VitalArc({ current, max }: VitalArcProps) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
  const visible = ratio * ARC_LEN;
  const tone = `color-mix(in srgb, var(--gold2) ${Math.round(ratio * 100)}%, var(--danger))`;
  return (
    <div className="vital-arc">
      <svg viewBox="0 0 170 46" width="170" height="46" role="img" aria-label={`Arc de vie : ${current} Blessures sur ${max}`}>
        <path className="vital-arc-shadow" d={ARC_PATH} transform="translate(0 1.5)" />
        <path className="vital-arc-groove" d={ARC_PATH} />
        <path
          className="vital-arc-fill"
          d={ARC_PATH}
          style={{ stroke: tone, strokeDasharray: `${visible.toFixed(1)} ${ARC_LEN.toFixed(1)}` }}
        />
      </svg>
      <span className="vital-arc-cap">
        <b style={{ color: tone }}>{current}</b> / {max} Blessures
      </span>
    </div>
  );
}
