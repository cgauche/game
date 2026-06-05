import { makePregens } from '../../data/pregens';
import { creatures } from '../../data/index';
import { arena } from './_shared';
import type { TestScenario } from './_shared';
import type { SceneEntity, MonsterPartsSel } from '../../state/scene';

/**
 * Galerie EN JEU (exploration, SANS combat) de tous les modèles rendus par l'IsoStage :
 * - les 58 créatures du bestiaire (`creatures`) — chacune routée automatiquement par l'IsoStage
 *   vers son rendu : rig humanoïde (Orc, Mutant, espèces jouables…), gabarit quadrupède (Loup,
 *   Ours, Cheval…) ou sprite monolithique (Dragon, Hydre, Griffon…) ;
 * - une rangée de **rigs de carrières** de héros (vêtements + arme propres à la carrière) ;
 * - quelques **mutants modulaires** (parts monstrueuses variées : tête de chien, pattes de chèvre…).
 * On tourne (Q/E) et on zoome (molette) pour les inspecter ; rien n'attaque.
 */
const COLS = 12;
const GAP = 2; // 1 case de marge entre chaque modèle
const X0 = 2;
const Y0 = 2;
const cell = (i: number) => ({ x: X0 + (i % COLS) * GAP, y: Y0 + Math.floor(i / COLS) * GAP });

// Carrières montrées (rigs héros distincts) — les 8 carrières des pré-tirés.
const CAREERS = ['Soldat', 'Tueur', 'Sorcier', 'Prêtre', 'Chasseur', 'Apothicaire', 'Voleur', 'Répurgateur'];
// Mutants modulaires : une part monstrueuse par variante.
const MUTANTS: { label: string; monster: MonsterPartsSel }[] = [
  { label: 'tête de chien', monster: { tete: 'chien' } },
  { label: 'tête de lézard', monster: { tete: 'lezard' } },
  { label: 'pattes de chèvre', monster: { jambes: 'chevre' } },
  { label: 'tête en ogive', monster: { tete: 'ogive' } },
  { label: 'bras-tentacule', monster: { brasD: 'tentacule' } },
  { label: 'crétin', monster: { tete: 'minuscule' } },
];

const ents: SceneEntity[] = [];
let i = 0;
for (const c of creatures) ents.push({ id: `cr-${i}`, kind: 'personnage', pos: cell(i++), ref: c.label, label: c.label });
for (const car of CAREERS) ents.push({ id: `car-${i}`, kind: 'personnage', pos: cell(i++), ref: car, label: `Héros — ${car}`, appearance: { career: car }, weapon: 'Épée' });
for (const m of MUTANTS) ents.push({ id: `mut-${i}`, kind: 'personnage', pos: cell(i++), ref: 'Mutant', label: `Mutant (${m.label})`, appearance: { monster: m.monster } });

const rows = Math.ceil(i / COLS);
const W = X0 + COLS * GAP + 1;
const H = Y0 + rows * GAP + 2;

const scene = arena({ id: 'test-galerie', nom: 'Galerie — tous les modèles', w: W, h: H, heroStart: { x: 0, y: 0 } });
scene.startMessage = 'Galerie de modèles : bestiaire complet + rigs de carrières + mutants. Tourne (Q/E) et zoome (molette) pour inspecter. Aucun combat.';
scene.entities = [...scene.entities, ...ents]; // conserve le heroStart d'arena

export const scenario: TestScenario = {
  id: 'galerie-modeles',
  order: 7,
  icon: '🖼️',
  title: 'Galerie de modèles',
  tests: 'Affiche tous les modèles de l’IsoStage : 58 créatures du bestiaire (rig/quadrupède/monolithe) + rigs de carrières + mutants modulaires. Exploration, SANS combat.',
  partyNote: 'Exploration libre, aucun combat',
  makeParty: () => makePregens().slice(0, 1), // 1 héros (leader) pour explorer
  scene,
  // pas d'autoCombat : pure galerie d'exploration.
};
