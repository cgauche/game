import type { CreatureDef } from '../types';

export const creature: CreatureDef = {
  name: "Sanglier",
  plan: 'quadruped',
  aliases: ["laie","marcassin","truie","cochon","porc"],
  // LDB 78 l.58-61 : bête de forêt « défenses aiguisées » (Cornes (Défenses)), 1m50-1m80 DE LONG,
  // Armure (Peau 1) → corps long et bas sur pattes courtes, grosse hure de soies dressées
  // (mane hirsute), tête massive aux défenses lisibles, queue courte, robe brun-noir de forêt.
  quad: {"sl":0.82,"build":"suid","girth":1.26,"bodyLen":1.04,"neckLen":0.3,"neckAngle":-4,"legLen":0.5,"head":"sanglier","headScale":1.22,"tail":"fouet","tailLen":0.75,"ears":"pointues","foot":"patte","mane":"hirsute","stored":{"corps":"#4a3b2c","corpsO":"#2b2118","corpsH":"#5b4a37","cheveux":"#1d1610","cheveuxO":"#0f0b07","cuir":"#191410"}},
};
