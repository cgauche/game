import type { CreatureDef } from '../types';

export const creature: CreatureDef = {
  name: "Skaven",
  plan: 'biped',
  matchPriority: 18,
  match: "skaven|homme.?rat|\\brat\\b|vermine|guerrier des clans|rat ogre",
};
