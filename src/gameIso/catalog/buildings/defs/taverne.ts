import type { BuildingDef } from '../../types';
import { footCorners, colombage, mid, HOUSE_SCHEMA } from '../render-helpers';

const taverne: BuildingDef['render'] = (foot, params, ctx) => {
  const c = footCorners(foot, ctx);
  const H = 40 * (params.floors ?? 2);
  const base = colombage(foot, params, ctx); // colombage applique déjà floors ?? 2
  // enseigne suspendue qui se balance (à mi-hauteur du mur droit)
  const m = mid(c.S, c.E);
  const sign =
    `<g class="sway" style="transform-box:fill-box;transform-origin:${m[0]}px ${m[1] - H * 0.6}px">` +
    `<line x1="${m[0]}" y1="${m[1] - H * 0.62}" x2="${m[0]}" y2="${m[1] - H * 0.42}" stroke="#2a1c10" stroke-width="2"/>` +
    `<rect x="${m[0] - 11}" y="${m[1] - H * 0.42}" width="22" height="16" rx="2" fill="#6e3b1e" stroke="#d8a93b" stroke-width="1.5"/>` +
    `</g>`;
  return { ...base, walls: base.walls + sign };
};

export const building: BuildingDef = {
  id: 'taverne',
  label: 'Taverne',
  category: 'petit',
  defaultFoot: { w: 4, h: 3 },
  defaultReveal: 'cutaway',
  paramsSchema: HOUSE_SCHEMA,
  render: taverne,
};
