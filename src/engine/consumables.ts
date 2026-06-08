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
import { removeCondition } from './conditions';

export interface ItemEffect {
  /** Blessures rendues. */
  heal?: number;
  /** Nom de l'État retiré. */
  removeCondition?: string;
  /** Nombre de pions retirés (Bandages : « +1 État Hémorragique », LDB 74 l.70). Absent = tout l'État. */
  removeStacks?: number;
}

/** Applique un effet d'objet à `target` (mutation) : soin de PB et/ou retrait d'État. Renvoie le journal.
 *  Partagé par l'usage EN COMBAT (`battleUseItem`) et HORS COMBAT (`usePartyItem`) — zéro duplication. */
export function applyItemUse(target: Combatant, eff: ItemEffect): string[] {
  const log: string[] = [];
  if (eff.heal != null && eff.heal > 0) {
    const before = target.wounds.current;
    target.wounds.current = Math.min(target.wounds.max, target.wounds.current + eff.heal);
    log.push(`${target.name} regagne ${target.wounds.current - before} Blessure(s).`);
  }
  if (eff.removeCondition === 'Hémorragique') {
    target.woundDressed = true; // un pansement/bandage panse la plaie → pas d'Infection (LDB 18 l.382)
  }
  if (eff.removeCondition) {
    const cond = target.conditions.find((c) => c.name === eff.removeCondition);
    if (cond) {
      const n = eff.removeStacks ?? cond.value; // Bandages : +1 pion ; Potion : tout l'État
      removeCondition(target, eff.removeCondition, n);
      log.push(eff.removeStacks
        ? `${target.name} : ${Math.min(n, cond.value)} pion ${eff.removeCondition} retiré.`
        : `${target.name} n'est plus ${eff.removeCondition}.`);
    } else log.push(`${target.name} n'a pas l'État ${eff.removeCondition}.`);
  }
  return log;
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
  // Retrait d'État : « retire … (tout | +N) État <Nom> ». Une quantité chiffrée (« +1 État Hémorragique »
  // des Bandages) retire ce nombre de pions ; « tout État <Nom> » (Potion de vitalité) retire tout.
  const cond = desc.match(/retire[^.]*?[ÉEée]tat\s+([A-Za-zÀ-ÿ]+)/i);
  if (cond) {
    const qty = desc.match(/\+?\s*(\d+)\s*[ÉEée]tats?\b/i);
    return { removeCondition: cond[1], ...(qty ? { removeStacks: parseInt(qty[1], 10) } : {}) };
  }
  return null;
}
