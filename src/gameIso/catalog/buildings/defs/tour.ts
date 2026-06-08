import type { BuildingDef } from '../../types';
import { footCorners, groundShadow, FLOORS_ONLY } from '../render-helpers';

const tour: BuildingDef['render'] = (foot, params, ctx) => {
  const c = footCorners(foot, ctx);
  const cx = (c.E[0] + c.O[0]) / 2;
  const cyBase = (c.S[1] + c.N[1]) / 2;
  const rx = Math.max(18, (c.E[0] - c.O[0]) / 2 - 4);
  const ry = Math.max(8, (c.S[1] - c.N[1]) / 2 - 2);
  const H = 60 * (params.floors ?? 2);
  const stone = params.wallColor ?? '#8d8a84';
  const body =
    groundShadow(c) +
    `<path d="M${cx - rx},${cyBase} L${cx - rx},${cyBase - H} A${rx},${ry} 0 0 1 ${cx + rx},${cyBase - H} L${cx + rx},${cyBase} A${rx},${ry} 0 0 1 ${cx - rx},${cyBase} Z" fill="${stone}" stroke="#56524b" stroke-width="2"/>` +
    `<ellipse cx="${cx}" cy="${cyBase - H}" rx="${rx}" ry="${ry}" fill="#a09c95"/>`;
  // meurtrières + porte cintrée + assises de pierre
  let detail = '';
  for (const hy of [0.35, 0.62, 0.85]) detail += `<rect x="${cx - 2.5}" y="${cyBase - H * hy - 9}" width="5" height="14" rx="2" fill="#2c2a26"/>`;
  for (let i = 1; i <= 4; i++) detail += `<line x1="${cx - rx}" y1="${cyBase - (H * i) / 5}" x2="${cx + rx}" y2="${cyBase - (H * i) / 5}" stroke="#6e6a62" stroke-width="1" opacity="0.4"/>`;
  detail += `<path d="M${cx - 9},${cyBase} L${cx - 9},${cyBase - 16} Q${cx},${cyBase - 26} ${cx + 9},${cyBase - 16} L${cx + 9},${cyBase} Z" fill="#3a2a18" stroke="#241a10"/>`;
  // créneaux
  let cren = '';
  for (let i = -2; i <= 2; i++) cren += `<rect x="${cx + i * (rx / 2.5) - 4}" y="${cyBase - H - ry - 8}" width="8" height="12" fill="${stone}" stroke="#56524b"/>`;
  return { walls: body + detail, interior: '', roof: cren };
};

export const building: BuildingDef = {
  id: 'tour',
  label: 'Tour',
  category: 'monument',
  defaultFoot: { w: 2, h: 2 },
  defaultReveal: 'door',
  paramsSchema: FLOORS_ONLY,
  render: tour,
};
