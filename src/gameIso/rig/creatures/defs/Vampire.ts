import type { CreatureDef } from '../types';

export const creature: CreatureDef = {
  name: "Vampire",
  plan: 'biped',
  matchPriority: 26,
  aliases: ["vampire","comte sanguin","comtesse sanguine"],
  biped: {"career":"Vampire","monster":{"cape":true},"sex":"M","parts":{"cheveux":1,"visage":0},"colors":{"vet1":"#241018","vet2":"#6a0e18","cuir":"#1a0e12","metal":"#8a8f9e"}},
};
