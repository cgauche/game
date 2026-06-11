import type { CreatureDef } from '../types';

export const creature: CreatureDef = {
  name: "Cheval",
  plan: 'quadruped',
  aliases: ["chevaux","destrier","poney","jument","etalon","monture","palefroi"],
  quad: {"sl":0.9,"build":"equine","girth":0.96,"bodyLen":1.05,"neckLen":1.12,"neckAngle":-50,"legLen":1.2,"head":"cheval","tail":"crin","ears":"courtes","foot":"sabot","markings":"balzanes","stored":{"corps":"#7a5436","corpsO":"#523521","corpsH":"#9a6f46","cheveux":"#2e2014","cheveuxO":"#1c130b","cuir":"#2b2620"}},
};
