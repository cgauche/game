/**
 * Réticule de ciblage PARTAGÉ (télégraphe ennemi + visée du joueur) : cercles + croix sur la
 * cible, ligne buste-à-buste optionnelle — POINTILLÉE pour tir/sort, PLEINE pour mêlée/mouvement.
 * Entrées en pixels écran (tileCenter déjà appliqué) ; offset « buste » −34 px. Pur SVG, sans état.
 * Défaut de la LIGNE : le repère ennemi du catalogue (`highlightTints.ENEMY_CUE_TINT`), dont le
 * télégraphe d'IA est justement l'usage nommé.
 */
import { ENEMY_CUE_TINT } from './highlightTints';

export function TargetReticle({
  from,
  to,
  line,
  lineColor = ENEMY_CUE_TINT,
  color = '#ffd34d',
}: {
  from?: { cx: number; cy: number } | null;
  to: { cx: number; cy: number };
  line?: 'dashed' | 'solid' | null;
  lineColor?: string;
  color?: string;
}) {
  const ty = to.cy - 34; // viser le buste, pas les pieds
  return (
    <g pointerEvents="none">
      {from && line && (
        <line
          x1={from.cx}
          y1={from.cy - 34}
          x2={to.cx}
          y2={ty}
          stroke={lineColor}
          strokeWidth={2.5}
          strokeDasharray={line === 'dashed' ? '7 6' : undefined}
          opacity={0.85}
        />
      )}
      <g transform={`translate(${to.cx},${ty})`}>
        <circle r={20} fill="none" stroke={color} strokeWidth={2} />
        <circle r={13} fill="none" stroke={color} strokeWidth={1} opacity={0.6} />
        <line x1={0} y1={-26} x2={0} y2={-14} stroke={color} strokeWidth={2} />
        <line x1={0} y1={14} x2={0} y2={26} stroke={color} strokeWidth={2} />
        <line x1={-26} y1={0} x2={-14} y2={0} stroke={color} strokeWidth={2} />
        <line x1={14} y1={0} x2={26} y2={0} stroke={color} strokeWidth={2} />
      </g>
    </g>
  );
}
