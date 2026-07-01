import type { BuildingDef } from '../../types';
import { footCorners, groundShadow, wallFaces, up, openings, floorInterior, buildingRoof, ROOF_BASE, HOUSE_SCHEMA } from '../render-helpers';

const manoir: BuildingDef['render'] = (foot, params, ctx) => {
  const c = footCorners(foot, ctx);
  const H = ROOF_BASE;
  const timber = params.timberColor ?? '#3a2c1e';
  const walls =
    groundShadow(c) +
    wallFaces(c, H, params.wallColor ?? '#cfc3a6', timber) +
    `<path d="M${up(c.O, H * 0.5)} L${up(c.S, H * 0.5)} L${up(c.E, H * 0.5)}" stroke="${timber}" stroke-width="2.5" fill="none" opacity="0.55"/>` +
    openings(c, H, ctx.facing, ctx.night);
  return { walls, interior: floorInterior(c), roof: buildingRoof(c, foot, 'ardoise', 1.4) }; // toit d'ardoise ample
};

export const building: BuildingDef = {
  id: 'manoir',
  label: 'Manoir',
  defaultFoot: { w: 5, h: 4 },
  paramsSchema: HOUSE_SCHEMA,
  render: manoir,
};
