import { Scene, Effect, isWalkable, heightAt } from './scene';
import { type Flow, EMPTY_FLOW, flowFromEffects, testFlow } from './flow';
import type { Pt } from './path';
import { jumpNeedsTest } from '../engine/movement';
import { combatStakeRef } from '../data';

export type JumpPlan = { kind: 'free' } | { kind: 'test'; flow: Flow };

/**
 * Traduit un pas de SAUT (`takeoff`→`landing`, en cases cardinales) en plan jouable, SANS flux dédié :
 *  - dans la portée libre (Saut LDB 15 l.114) → franchissement d'office (`free`) ;
 *  - au-delà → l'Effet `test` existant (Athlétisme, label « Saut ») dont l'ÉCHEC déclenche `fall` dans
 *    le gouffre (1er niveau marchable sous le décollage, sinon le sol).
 * `runUpCases` = élan en ligne droite avant décollage : ≥ ceil(M/2) cases ⇒ Test Accessible (+20),
 * sinon Intermédiaire (LDB 15 l.115 : « course d'élan au moins équivalente à votre Mouvement en mètres »).
 */
export function planJump(scene: Scene, takeoff: Pt, landing: Pt, movement: number, runUpCases: number): JumpPlan {
  const tz = takeoff.z ?? 0;
  const dist = Math.max(Math.abs(landing.x - takeoff.x), Math.abs(landing.y - takeoff.y));
  if (!jumpNeedsTest(movement, dist)) return { kind: 'free' };
  const dx = Math.sign(landing.x - takeoff.x), dy = Math.sign(landing.y - takeoff.y);
  const gap = { x: takeoff.x + dx, y: takeoff.y + dy }; // 1re case du gouffre franchi
  let belowZ = 0; // niveau d'atterrissage en cas d'échec : 1er niveau marchable SOUS le décollage, sinon le sol
  for (let z = tz - 1; z >= 0; z--) if (isWalkable(scene, gap.x, gap.y, z)) { belowZ = z; break; }
  // Chute = vraie hauteur métrique (relief) entre la surface de décollage et celle d'atterrissage en
  // contrebas (LDB 15 l.78-84 : 3 Dégâts/m) — plus de forfait par niveau, la hauteur du décor fait foi.
  const metres = Math.abs(heightAt(scene, takeoff.x, takeoff.y, tz) - heightAt(scene, gap.x, gap.y, belowZ));
  const difficulty = runUpCases >= Math.ceil(movement / 2) ? 'accessible' : 'intermediaire';
  const fall: Effect = { type: 'fall', target: 'party', metres, to: { x: gap.x, y: gap.y, z: belowZ } };
  // Test d'Athlétisme « Saut » : la réussite ne fait rien (on a déjà franchi, optimiste) ; l'échec
  // déclenche `fall` dans le gouffre.
  const stake = combatStakeRef('jumpTest', { values: { metres } });
  return { kind: 'test', flow: testFlow({ skill: 'Athlétisme', difficulty, label: 'Saut', stake }, EMPTY_FLOW, flowFromEffects([fall])) };
}
