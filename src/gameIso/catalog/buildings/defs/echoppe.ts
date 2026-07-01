import type { BuildingDef } from '../../types';
import { footCorners, groundShadow, wallFaces, openings, upXY, pt, floorInterior, buildingRoof, ROOF_BASE, HOUSE_SCHEMA } from '../render-helpers';

const echoppe: BuildingDef['render'] = (foot, params, ctx) => {
  const c = footCorners(foot, ctx);
  const H = ROOF_BASE;
  const walls = groundShadow(c) + wallFaces(c, H, params.wallColor ?? '#cdbd98', params.timberColor ?? '#5a3f24') + openings(c, H, ctx.facing, ctx.night);
  // auvent rayé en façade (au-dessus de O→S)
  const a = upXY(c.O, H * 0.5);
  const b = upXY(c.S, H * 0.5);
  const awning = `<path d="M${pt(a)} L${pt(b)} L${b[0]},${b[1] + 16} L${a[0]},${a[1] + 16} Z" fill="#a8423a" opacity="0.85"/>`;
  return { walls: walls + awning, interior: floorInterior(c), roof: buildingRoof(c, foot, params.roofMaterial ?? 'tuile') };
};

export const building: BuildingDef = {
  id: 'echoppe',
  label: 'Échoppe',
  defaultFoot: { w: 2, h: 2 },
  paramsSchema: HOUSE_SCHEMA,
  render: echoppe,
};
