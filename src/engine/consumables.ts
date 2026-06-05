/**
 * Objets consommables (« Herbes et potions », Livre de base p.307). L'effet est PARSÉ du `desc`
 * du trapping — rien d'inventé. Deux effets modélisés (les seuls consommables de la base) :
 *  - soin : « Bonus de <Carac> » (Potion de guérison = Bonus d'Endurance) ou « N Points de Blessure »
 *  - retrait d'État : « retire … tout État <Nom> » (Potion de vitalité = Exténué)
 *
 * Réservé aux objets `misc` : une arme/armure dont le `desc` mentionne « Bonus de Force » (Dégâts)
 * ou « Blessure » ne doit pas être prise pour un consommable.
 */
import { Combatant, ItemInstance, CHAR_BY_LABEL } from './types';
import { bonus, effectiveChar } from './characteristics';

export interface ItemEffect {
  /** Blessures rendues. */
  heal?: number;
  /** Nom de l'État retiré. */
  removeCondition?: string;
}

/** Effet d'usage d'un consommable pour un buveur donné, ou `null` si l'objet n'est pas utilisable. */
export function itemUse(item: ItemInstance, user: Combatant): ItemEffect | null {
  if (item.kind !== 'misc') return null;
  const desc = item.desc ?? '';
  // Soin : « Bonus de <Carac> » (valeur dépendante du buveur) ou « N Points de Blessure » littéral.
  if (/Blessure/i.test(desc)) {
    const byBonus = desc.match(/Bonus d[e'’]\s*([A-Za-zÀ-ÿ]+)/i);
    if (byBonus) {
      const key = CHAR_BY_LABEL[byBonus[1]];
      if (key) return { heal: bonus(effectiveChar(user, key)) };
    }
    const lit = desc.match(/(\d+)\s*Points?\s+de\s+Blessure/i);
    if (lit) return { heal: parseInt(lit[1], 10) };
  }
  // Retrait d'État : « retire … tout État <Nom> ».
  const cond = desc.match(/retire[^.]*?[ÉEée]tat\s+([A-Za-zÀ-ÿ]+)/i);
  if (cond) return { removeCondition: cond[1] };
  return null;
}
