import type { BuildingDef } from '../../types';
import { footCorners, groundShadow, wallFaces, up, openings, floorInterior, hipRoof, HOUSE_SCHEMA } from '../render-helpers';

const manoir: BuildingDef['render'] = (foot, params, ctx) => {
  const c = footCorners(foot, ctx);
  const H = 56 * (params.floors ?? 2);
  const timber = params.timberColor ?? '#3a2c1e';
  const walls =
    groundShadow(c) +
    wallFaces(c, H, params.wallColor ?? '#cfc3a6', timber) +
    `<path d="M${up(c.O, H * 0.5)} L${up(c.S, H * 0.5)} L${up(c.E, H * 0.5)}" stroke="${timber}" stroke-width="2.5" fill="none" opacity="0.55"/>` +
    openings(c, H, ctx.facing, ctx.night);
  return { walls, interior: floorInterior(c), roof: hipRoof(c, H, 44, 'ardoise') };
};

export const building: BuildingDef = {
  id: 'manoir',
  label: 'Manoir',
  category: 'monument',
  defaultFoot: { w: 5, h: 4 },
  defaultReveal: 'door',
  paramsSchema: HOUSE_SCHEMA,
  render: manoir,
};
