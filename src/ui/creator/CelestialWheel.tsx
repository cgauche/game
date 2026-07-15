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
  const cx = 150;
  const cy = 150;
  const r = 110;
  const labelR = r + 22;
  const activeIdx = Math.max(0, signs.findIndex((s) => s.id === selectedId));
  const svgRef = useRef<SVGSVGElement>(null);
  const selected = signs.find((s) => s.id === selectedId);
  // Télescopage à 23 signes (juge vision, lot P3) : la roue ne montre le nom EN CLAIR que pour le
  // signe élu et ses deux voisins immédiats (le focus clavier suit le même patron) — les autres
  // restent un tiret. Identification/activation intactes pour TOUS (title + aria-label inconditionnels,
  // clic/Entrée/Espace sur le point). Alterner le rayon des tirets brise l'alignement radial strict
  // pour aérer visuellement l'anneau sans dépendre de la longueur du libellé.
  const isExpanded = (i: number) => i === activeIdx || i === (activeIdx - 1 + n) % n || i === (activeIdx + 1) % n;

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
      <svg ref={svgRef} viewBox="-15 -8 330 316" role="radiogroup" aria-label="Roue céleste — signe astral" onKeyDown={onKeyDown}>
        <circle cx={cx} cy={cy} r={r + 14} />
        <circle cx={cx} cy={cy} r={r - 10} />
        {signs.map((s, i) => {
          const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
          const x = cx + r * Math.cos(a);
          const y = cy + r * Math.sin(a);
          const sel = s.id === selectedId;
          const expanded = isExpanded(i);
          // Tirets en 2 rayons alternés : casse l'alignement radial strict, aère l'anneau serré.
          const lr = expanded ? labelR + 6 : labelR + (i % 2 ? 8 : 0);
          const dx = Math.cos(a);
          const lx = cx + lr * dx;
          const ly = cy + lr * Math.sin(a);
          // Zéro troncature (juge vision, lot P3 suite) : un label ÉTENDU (souvent long) ancré au
          // centre déborde côté droit/gauche de la roue — ancrage par QUADRANT (`end` = le texte
          // s'étend VERS le centre depuis un point de droite, `start` l'inverse à gauche) ; les tirets
          // (1 caractère) restent centrés, aucun risque de débord.
          const anchor: 'start' | 'middle' | 'end' = !expanded ? 'middle' : dx > 0.25 ? 'end' : dx < -0.25 ? 'start' : 'middle';
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
              <text
                x={lx}
                y={ly}
                textAnchor={anchor}
                dominantBaseline="middle"
                className={expanded ? 'cw-label cw-label-full' : 'cw-label cw-label-dash'}
              >
                {expanded ? s.label : '–'}
              </text>
              <title>{s.label}</title>
            </g>
          );
        })}
      </svg>
      <div aria-hidden>{selected ? <strong>{selected.label}</strong> : <span>Tirez ou choisissez votre signe</span>}</div>
    </div>
  );
}
