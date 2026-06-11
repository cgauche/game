// Guerrier du Chaos : humanoïde massif en armure de plates du Chaos — TENUE DÉDIÉE
// « Guerrier du Chaos » (careerTenues MANUAL : cuirasse à étoile du Chaos, épaulières à
// pointes, heaume intégral cornu, 3 vues). Fini l'ex-bricolage « tenue Soldat recolorée +
// plastron plaqué en overlay » (retour utilisateur : le Vampire a sa tenue, lui aussi).
import type { RaceDef } from '../types';
export const race: RaceDef = {
  id: 'Guerrier du Chaos',
  gabarit: 'trapu-massif',
  career: 'Guerrier du Chaos',
  palette: { peau: '#b7a596', peauO: '#8c7b6e', peauH: '#cdbcab', cheveux: '#1a1410', cheveuxO: '#0a0806', cheveuxH: '#2c2620' },
  colors: { vet1: '#2a2230', vet2: '#6a5420', cuir: '#140f12', metal: '#3a3a46' }, // plates sombres + garnitures laiton
  pose: { torse: 6, cou: 5, tete: -3 },          // léger surplomb menaçant
};
