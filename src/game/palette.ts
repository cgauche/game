/** Palette des assets procéduraux (générés au runtime dans Phaser). */
import { Terrain } from '../state/scene';

export const TILE = 36;

export const TERRAIN_COLORS: Record<Terrain, number> = {
  sol: 0x6b5d4f,
  herbe: 0x4a7a3a,
  route: 0x9a8358,
  bois: 0x244d1f,
  eau: 0x2f5a8a,
  mur: 0x33312e,
  porte: 0x7a5a3a,
  plancher: 0x9a7a4a,
};

export const TERRAIN_ACCENT: Record<Terrain, number> = {
  sol: 0x5a4d40,
  herbe: 0x3d6830,
  route: 0x86714a,
  bois: 0x163813,
  eau: 0x274d77,
  mur: 0x222019,
  porte: 0x664a2e,
  plancher: 0x86683c,
};

/** Couleurs des tokens du groupe (jusqu'à 4 héros). */
export const HERO_COLORS = [0x3b7dd8, 0x2fae6b, 0xd8a93b, 0xb455c9];

export const ENEMY_COLOR = 0xc0392b;
export const PNJ_COLOR = 0x4aa3df;
export const OBJET_COLOR = 0xf1c40f;
export const PROP_COLOR = 0x7f8c8d;
