import type { BuildingDef } from '../../types';
import { footCorners, groundShadow, wallFaces, openings, upXY, floorInterior, hipRoof, HOUSE_SCHEMA } from '../render-helpers';

const forge: BuildingDef['render'] = (foot, params, ctx) => {
  const c = footCorners(foot, ctx);
  const H = 38 * (params.floors ?? 1);
  const walls = groundShadow(c) + wallFaces(c, H, params.wallColor ?? '#8a8378', '#4d4a44') + openings(c, H, ctx.facing, ctx.night);
  // cheminée + fumée animée (coin E)
  const e = upXY(c.E, H);
  const ch = [e[0] - 10, e[1] - 6];
  const chimney =
    `<rect x="${ch[0] - 6}" y="${ch[1] - 26}" width="14" height="30" fill="#5a5048" stroke="#2e2a25"/>` +
    `<g class="smoke" style="transform-box:fill-box;transform-origin:${ch[0]}px ${ch[1] - 26}px">` +
    `<circle cx="${ch[0]}" cy="${ch[1] - 30}" r="7" fill="#cfc8bf" opacity="0.5"/>` +
    `<circle cx="${ch[0] + 4}" cy="${ch[1] - 40}" r="9" fill="#bcb4a9" opacity="0.4"/></g>`;
  return { walls: walls + chimney, interior: floorInterior(c), roof: hipRoof(c, H, 22, 'ardoise') };
};

export const building: BuildingDef = {
  id: 'forge',
  label: 'Forge',
  category: 'petit',
  defaultFoot: { w: 3, h: 2 },
  defaultReveal: 'cutaway',
  paramsSchema: HOUSE_SCHEMA,
  render: forge,
};
