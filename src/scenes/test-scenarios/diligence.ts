import { makeShowcaseParty } from '../../data/pregens';
import { buildDiligenceScene } from '../diligence/furnished';
import type { TestScenario } from './_shared';

const scene = buildDiligenceScene();

export const scenario: TestScenario = {
  id: 'diligence',
  order: 60,
  category: 'rendu',
  icon: 'scenario/village',
  title: 'La Diligence — exploration',
  tests: 'Exploration libre des deux étages : zones, portes/fenêtres, mobilier et deux escaliers.',
  partyNote: 'Groupe vitrine (Soldat / Tueur / Sorcier / Chasseur) — exploration libre, aucun combat.',
  makeParty: makeShowcaseParty,
  scene,
};
