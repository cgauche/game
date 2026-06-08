import { describe, it, expect } from 'vitest';
import { Combatant, ItemInstance } from './types';
import { itemUse } from './consumables';

const user = (E = 35): Combatant =>
  ({
    characteristics: { CC: 30, CT: 30, F: 30, E, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    activeEffects: [],
  }) as unknown as Combatant;

const item = (over: Partial<ItemInstance>): ItemInstance =>
  ({ uid: 'i', name: 'X', kind: 'misc', qualities: [], enc: 0, equipped: false, ...over }) as ItemInstance;

// Descriptions VERBATIM du Livre de base p.307.
const HEAL = item({
  name: 'Potion de guérison',
  desc: "Si vous avez plus de 0 Blessure, récupérez immédiatement un nombre de Points de Blessure égal à votre Bonus d'Endurance. Dose: 1 par rencontre.",
});
const VITAL = item({ name: 'Potion de vitalité', desc: 'Boire cette décoction retire instantanément tout État Exténué.' });
const BANDAGE = item({ name: 'Bandages', desc: 'Un Test de Guérison ou de Dextérité réussi retire +1 État Hémorragique supplémentaire.' });
const SWORD = item({ name: 'Épée', kind: 'melee', desc: 'Une lame tranchante.' });

describe('itemUse — consommables (LDB p.307, sourcé du desc)', () => {
  it('Potion de guérison : soin = Bonus d’Endurance du buveur', () => {
    expect(itemUse(HEAL, user(35))).toEqual({ heal: 3 }); // BE(35) = 3
    expect(itemUse(HEAL, user(28))).toEqual({ heal: 2 }); // BE(28) = 2
  });
  it('soin littéral « N Points de Blessure »', () => {
    expect(itemUse(item({ desc: 'Récupérez 4 Points de Blessure.' }), user())).toEqual({ heal: 4 });
  });
  it('Potion de vitalité : retire TOUT l’État Exténué (pas de quantité chiffrée)', () => {
    expect(itemUse(VITAL, user())).toEqual({ removeCondition: 'Exténué' });
  });
  it('Bandages : retire +1 pion Hémorragique (quantité chiffrée, LDB 74 l.70)', () => {
    expect(itemUse(BANDAGE, user())).toEqual({ removeCondition: 'Hémorragique', removeStacks: 1 });
  });
  it('objet non consommable (arme, bibelot) → null', () => {
    expect(itemUse(SWORD, user())).toBeNull();
    expect(itemUse(item({ desc: 'Un simple bibelot sans effet.' }), user())).toBeNull();
  });
});
