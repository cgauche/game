import type { CreatureDef } from '../types';

export const creature: CreatureDef = {
  name: "Dragon",
  plan: 'winged',
  aliases: ["wyverne","vouivre","drake"],
  // LDB 79 l.42-50 : « immenses », Taille (Énorme), Vol 80 (grandes ailes), Attaque caudale (queue massive)
  quad: {"sl":1.25,"build":"draconic","girth":1.12,"bodyLen":1.2,"neckLen":1.18,"neckAngle":-40,"legLen":0.95,"head":"dragon","headScale":1.08,"tail":"reptile","tailLen":1.35,"ears":"pointues","foot":"serre","wings":"membrane","wingSpan":1.3,"ridge":"epines","stored":{"corps":"#4c7340","corpsO":"#27411f","corpsH":"#7fae5e","cheveux":"#26351a","cheveuxO":"#141d0c","cuir":"#a8915c"}},
};
