import type { BuildingDef } from '../../types';
import { footCorners, groundShadow, wallFaces, openings, floorInterior, hipRoof, roofRise, ROOF_BASE, FLOORS_ONLY } from '../render-helpers';

const chapelle: BuildingDef['render'] = (foot, params, ctx) => {
  const c = footCorners(foot, ctx);
  const H = ROOF_BASE;
  const rise = roofRise(foot, 1.8); // flèche raide d'église (ardoise)
  const walls = groundShadow(c) + wallFaces(c, H, params.wallColor ?? '#b9b2a4', '#6a655c') + openings(c, H, ctx.facing, ctx.night);
  const apex = [(c.N[0] + c.S[0]) / 2, (c.N[1] + c.S[1]) / 2 - (H + rise)]; // sommet du toit — la croix s'y pose
  const cross =
    `<line x1="${apex[0]}" y1="${apex[1]}" x2="${apex[0]}" y2="${apex[1] - 20}" stroke="#d8c27a" stroke-width="3"/>` +
    `<line x1="${apex[0] - 7}" y1="${apex[1] - 14}" x2="${apex[0] + 7}" y2="${apex[1] - 14}" stroke="#d8c27a" stroke-width="3"/>`;
  return { walls, interior: floorInterior(c), roof: hipRoof(c, H, rise, 'ardoise') + cross };
};

export const building: BuildingDef = {
  id: 'chapelle',
  label: 'Chapelle',
  defaultFoot: { w: 4, h: 5 },
  paramsSchema: FLOORS_ONLY,
  render: chapelle,
};
