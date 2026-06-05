/** Construit hairstyles.ts (pool de coiffures) depuis public/qc/hairstyles-raw.json (workflow).
 *  Lancer : node scripts/_build-hairstyles.mjs */
import { readFileSync, writeFileSync } from 'node:fs';

// Calotte (cuir chevelu) derrière la coiffure : dôme couleur cheveux collé au crâne, pour
// que les coiffures dessinées trop haut/volumineuses ne « flottent » pas au-dessus de la tête.
// Sautée pour les coupes dégarnies/chauves (le crâne nu est volontaire).
const SCALP = '<path d="M-9.4 7 Q-10.4 -9 0 -9.6 Q10.4 -9 9.4 7 Q9 -1 6 -2.4 Q0 -4 -6 -2.4 Q-9 -1 -9.4 7Z" fill="@cheveuxO"/>';

const raw = JSON.parse(readFileSync('public/qc/hairstyles-raw.json', 'utf8'));
const bySex = { M: [], F: [] };
for (const h of raw) {
  let svg = h.svg.replace(/<!--scalp-->/g, '').trim();
  const bald = /d[ée]garni|calvitie|chauve|ras[ée]/i.test(h.style);
  if (!bald) svg = SCALP + svg; // colle la coiffure au crâne
  (bySex[h.sex] ??= []).push({ name: h.style, svg });
}
const emit = (list) => list.map((h) => `    { name: ${JSON.stringify(h.name)}, svg: ${JSON.stringify(h.svg)} }`).join(',\n');
const file = `/**
 * Coiffures additionnelles (slot « cheveux »), pool PARTAGÉ par sexe — GÉNÉRÉ par le
 * workflow generate-hairstyles puis scripts/_build-hairstyles.mjs. NE PAS éditer à la main.
 *
 * Couleurs en tokens @cheveux/@cheveuxO/@cheveuxH (recoloriables). Pour une tête, les options
 * de coiffure = [défaut espèce, ...HAIRSTYLES[sex]] ; l'index (pins.cheveux / seed) choisit.
 */
export interface Hairstyle {
  name: string;
  svg: string;
}

export const HAIRSTYLES: Record<'M' | 'F', Hairstyle[]> = {
  M: [
${emit(bySex.M)}
  ],
  F: [
${emit(bySex.F)}
  ],
};
`;
writeFileSync('src/gameIso/rig/parts/generated/hairstyles.ts', file);
console.log(`OK — hairstyles.ts : M=${bySex.M.length}, F=${bySex.F.length}`);
