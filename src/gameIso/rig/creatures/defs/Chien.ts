import type { CreatureDef } from '../types';

export const creature: CreatureDef = {
  name: "Chien",
  plan: 'quadruped',
  // Molosse de guerre (LDB 78 l.29-32 : « élevées pour la guerre ou les combats de chiens ») :
  // trapu, poitrail massif, cou court, grosse tête, oreilles courtes, queue fouet, robe fauve unie.
  quad: {"sl":0.72,"build":"canine","girth":1.05,"bodyLen":0.86,"neckLen":0.46,"neckAngle":-8,"legLen":0.6,"head":"loup","headScale":1.32,"tail":"fouet","tailLen":0.9,"ears":"courtes","foot":"patte","mane":"sans","markings":"sans","stored":{"corps":"#8b6b44","corpsO":"#46311d","corpsH":"#a98a5e","cheveux":"#33261a","cheveuxO":"#1f1710","cuir":"#191410"}},
};
