/**
 * Roue céleste (arbitrage user 2026-07-13) — sélecteur cérémoniel du Signe astral (ADE2 ch.03) en
 * remplacement du `<select>` nu jugé « catastrophe de densité ». Les signes sont posés en cercle
 * (astrolabe sobre : deux anneaux + un point par signe) ; le signe tiré/choisi est mis en évidence
 * (rayon tracé vers le centre, point agrandi) et son nom s'affiche au moyeu.
 *
 * SVG sobre en tokens : couleurs via `var(--…)`, aucune palette littérale. Radiogroup a11y : roving
 * tabindex + flèches/Home/End (selection-follows-focus, patron `<Tabs>`/`GroupedPickGrid`). Une seule
 * classe de domaine `.celestial-wheel` ; les nœuds sont stylés par sélecteurs structurels descendants
 * (anneaux = `circle` enfant direct du `svg`, points = `g circle`) — zéro classe supplémentaire.
 */
import { useRef, type KeyboardEvent } from 'react';

export interface WheelSign {
  id: string;
  label: string;
}

export function CelestialWheel({ signs, selectedId, onSelect }: {
  signs: WheelSign[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const n = signs.length;
  const cx = 110;
  const cy = 110;
  const r = 90;
  const activeIdx = Math.max(0, signs.findIndex((s) => s.id === selectedId));
  const svgRef = useRef<SVGSVGElement>(null);
  const selected = signs.find((s) => s.id === selectedId);

  const focusNode = (idx: number) => {
    onSelect(signs[idx].id); // selection-follows-focus (patron Tabs)
    svgRef.current?.querySelectorAll<SVGGElement>('[role="radio"]')[idx]?.focus();
  };
  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key) || !n) return;
    e.preventDefault();
    const delta = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : 0;
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : (activeIdx + delta + n) % n;
    focusNode(next);
  };

  return (
    <div className="celestial-wheel">
      <svg ref={svgRef} viewBox="0 0 220 220" role="radiogroup" aria-label="Roue céleste — signe astral" onKeyDown={onKeyDown}>
        <circle cx={cx} cy={cy} r={r + 14} />
        <circle cx={cx} cy={cy} r={r - 10} />
        {signs.map((s, i) => {
          const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
          const x = cx + r * Math.cos(a);
          const y = cy + r * Math.sin(a);
          const sel = s.id === selectedId;
          return (
            <g
              key={s.id}
              role="radio"
              aria-checked={sel}
              aria-label={s.label}
              tabIndex={i === activeIdx ? 0 : -1}
              onClick={() => onSelect(s.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(s.id);
                }
              }}
            >
              {sel && <line x1={cx} y1={cy} x2={x} y2={y} />}
              <circle cx={x} cy={y} r={sel ? 6.5 : 3} />
              <title>{s.label}</title>
            </g>
          );
        })}
      </svg>
      <div aria-hidden>{selected ? <strong>{selected.label}</strong> : <span>Tirez ou choisissez votre signe</span>}</div>
    </div>
  );
}
