import { makePregens } from '../../data/pregens';
import { creatures, careers, trappings } from '../../data/index';
import { arena } from './_shared';
import type { TestScenario } from './_shared';
import type { SceneEntity, MonsterPartsSel } from '../../state/scene';

/**
 * Galerie EN JEU (exploration, SANS combat) de TOUS les modèles rendus par l'IsoStage :
 * - les 58 créatures du bestiaire (`creatures`) — routées automatiquement vers leur rendu :
 *   rig humanoïde, gabarit quadrupède ou sprite monolithique ;
 * - **toutes les carrières** (`careers`) — un rig humain portant les vêtements de chaque carrière ;
 * - **toutes les armes** (`trappings` mêlée + distance) — un rig humain tenant chaque arme ;
 * - quelques **mutants modulaires** (parts monstrueuses variées).
 * Énuméré dynamiquement depuis la data → toujours complet. On tourne (Q/E) et zoome (molette).
 * Chaque section commence sur une nouvelle ligne (séparée d'une rangée vide).
 */
const COLS = 14;
const GAP = 2; // 1 case de marge entre chaque modèle
const X0 = 2;
const Y0 = 2;

const ents: SceneEntity[] = [];
let idx = 0;
const pos = () => ({ x: X0 + (idx % COLS) * GAP, y: Y0 + Math.floor(idx / COLS) * GAP });
const newSection = () => {
  if (idx % COLS !== 0) idx += COLS - (idx % COLS); // saute à la ligne suivante (rangée vide entre sections)
};

// 1) Bestiaire complet.
for (const c of creatures) {
  ents.push({ id: `cr-${idx}`, kind: 'personnage', pos: pos(), ref: c.label, label: c.label });
  idx++;
}
newSection();
// 2) Toutes les carrières — rig humain + vêtements de la carrière.
for (const c of careers) {
  ents.push({ id: `car-${idx}`, kind: 'personnage', pos: pos(), ref: 'Humain', label: `Carrière — ${c.label}`, appearance: { career: c.label }, weapon: 'Épée bâtarde' });
  idx++;
}
newSection();
// 3) Toutes les armes — rig humain tenant chaque arme (mêlée + distance).
const weapons = trappings.filter((t) => t.type === 'melee' || t.type === 'ranged');
for (const w of weapons) {
  ents.push({ id: `wp-${idx}`, kind: 'personnage', pos: pos(), ref: 'Humain', label: `Arme — ${w.label}`, weapon: w.label });
  idx++;
}
newSection();
// 4) Mutants modulaires (une part monstrueuse par variante).
const MUTANTS: { label: string; monster: MonsterPartsSel }[] = [
  { label: 'tête de chien', monster: { tete: 'chien' } },
  { label: 'tête de lézard', monster: { tete: 'lezard' } },
  { label: 'pattes de chèvre', monster: { jambes: 'chevre' } },
  { label: 'tête en ogive', monster: { tete: 'ogive' } },
  { label: 'bras-tentacule', monster: { brasD: 'tentacule' } },
  { label: 'crétin', monster: { tete: 'minuscule' } },
];
for (const m of MUTANTS) {
  ents.push({ id: `mut-${idx}`, kind: 'personnage', pos: pos(), ref: 'Mutant', label: `Mutant (${m.label})`, appearance: { monster: m.monster } });
  idx++;
}

const W = X0 + COLS * GAP + 1;
const H = Y0 + Math.ceil(idx / COLS) * GAP + 2;

const scene = arena({ id: 'test-galerie', nom: 'Galerie — tous les modèles', w: W, h: H, heroStart: { x: 0, y: 0 } });
scene.startMessage =
  `Galerie : ${creatures.length} créatures · ${careers.length} carrières · ${weapons.length} armes · ${MUTANTS.length} mutants. ` +
  'Tourne (Q/E) et zoome (molette) pour inspecter. Aucun combat.';
scene.entities = [...scene.entities, ...ents]; // conserve le heroStart d'arena

export const scenario: TestScenario = {
  id: 'galerie-modeles',
  order: 7,
  icon: '🖼️',
  title: 'Galerie de modèles',
  tests: `Tous les modèles de l’IsoStage : ${creatures.length} créatures + TOUTES les carrières (${careers.length}) + TOUTES les armes (${weapons.length}) + mutants. Exploration, SANS combat.`,
  partyNote: 'Exploration libre, aucun combat',
  makeParty: () => makePregens().slice(0, 1),
  scene,
  // pas d'autoCombat : pure galerie d'exploration.
};
