import type { CreatureDef } from '../types';

// Varghulf — « grandes bêtes aux allures de chauve-souris » (LDB 82 l.21-24) : vampire
// bestial, cruel et sauvage. Lecture CHAUVE-SOURIS (pas chien/ours ailé) : museau camus à
// truffe charnue (tête 'rat' — œil sombre, pas de blanc cartoon), oreilles POINTUES
// dressées cohérentes profil/face, ailes membraneuses DOMINANTES pliées sur le dos,
// échine arquée gonflée (« bloated ») tapie sur des membres courts, serres griffues
// (fini les pieds-godets), moignon de queue, fourrure hérissée + épines dorsales —
// peau charbon aux reflets de chair livide, serres couleur corne. `aliases` couvre
// « Chauve-souris vampire ».
export const creature: CreatureDef = {
  name: 'Varghulf',
  plan: 'winged',
  aliases: ['chauve-souris', 'chauve souris', 'chauve.?souris'],
  quad: {
    sl: 1.1, build: 'rodent', girth: 1.25, bodyLen: 1.0, neckLen: 0.5, neckAngle: 16, legLen: 0.72,
    head: 'rat', headScale: 1.35, tail: 'courte', tailLen: 0.8, ears: 'pointues',
    foot: 'serre', wings: 'membrane', wingSpan: 1.5,
    mane: 'hirsute', ridge: 'epines', markings: 'sans',
    stored: { corps: '#3e3643', corpsO: '#1c1620', corpsH: '#8d6f7a', cheveux: '#16111a', cheveuxO: '#0b0810', cuir: '#8a7a64' },
  },
};
