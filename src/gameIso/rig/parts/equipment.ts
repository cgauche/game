import type { Combatant, Weapon, ItemInstance, HitLocation } from '../../../engine/types';
import type { Slot } from '../bones';
import type { Part } from './types';
import { GENERATED_WEAPONS, GENERATED_ARMOUR } from './generated/weaponsArmour';

/** Contexte d'équipement extrait d'un Combatant (le rendu lit l'engine — direction permise). */
export interface EquipCtx {
  weapons: Weapon[];
  armour: ItemInstance[];           // pièces d'armure ÉQUIPÉES (locs renseignés)
  shield?: Weapon | ItemInstance;
}

export const isShield = (x: { name: string; qualities?: string[] }) =>
  (x.qualities ?? []).some((q) => /bouclier/i.test(q)) || /bouclier/i.test(x.name);

export function equipFromCombatant(c: Combatant): EquipCtx {
  const weapons = c.weapons ?? [];
  const armour = (c.items ?? []).filter((i) => i.kind === 'armor' && i.equipped && (i.locs?.length ?? 0) > 0);
  const shield = weapons.find(isShield) ?? (c.items ?? []).find((i) => i.equipped && isShield(i));
  return { weapons, armour, shield };
}

/** Famille d'arme inférée du nom + type. */
function weaponFamily(w: Weapon): string {
  // Nom normalisé (accents retirés) → patterns sans accent, robustes à l'encodage.
  const n = w.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/pistolet|arquebus|fusil|tromblon|mousquet|poudre|escopette/.test(n)) return 'poudre';
  if (/fronde|fustibale/.test(n)) return 'fronde';
  if (/fouet/.test(n)) return 'fouet';
  if (/bombe|grenade|explos/.test(n)) return 'explosif';
  if (/lasso/.test(n)) return 'lasso';
  if (/bolas/.test(n)) return 'bolas';
  if (/coup.?de.?poing|cestus|poing americain/.test(n)) return 'poing';
  if (/main gauche|brise.?epee|dague de parade|parade/.test(n)) return 'parade';
  if (/arbal/.test(n)) return 'arbalete';
  if (/arc/.test(n)) return 'arc';
  if (/dague|couteau|stylet|poignard/.test(n)) return 'dague';
  if (/hache|pioche|cognee/.test(n)) return 'hache';
  if (/masse|marteau|gourdin|fleau|maillet|matraque/.test(n)) return 'masse';
  if (/lance|hallebarde|pique|epieu|javelot|fleche|flechette|trait/.test(n)) return 'lance';
  if (/baton|canne/.test(n)) return 'baton';
  if (/epee|rapiere|sabre|fleuret|zwei|espadon|estoc|cimeterre/.test(n)) return 'epee';
  return w.type === 'ranged' ? 'arc' : 'epee';
}

/** Parts d'arme (dessinées dans le repère local de l'os `arme`, manche à l'origine). */
const WEAPONS: Record<string, string> = {
  epee: `<rect x="-1.5" y="-2" width="3" height="6" fill="#5a3f24"/><rect x="-1" y="-30" width="2" height="28" fill="url(#g_steel)"/><rect x="-5" y="-2" width="10" height="2.5" fill="#caa64a"/>`,
  hache: `<rect x="-1.5" y="-2" width="3" height="30" fill="#4a2f17"/><path d="M-2 -28 q14 -10 14 12 q-14 -2 -14 -10z" fill="url(#g_axe)" stroke="#2a3038"/>`,
  masse: `<rect x="-1.5" y="-2" width="3" height="28" fill="#4a2f17"/><circle cx="0" cy="-28" r="6" fill="url(#g_steelD)"/>`,
  dague: `<rect x="-1.2" y="-1" width="2.4" height="4" fill="#4a2f17"/><rect x="-1" y="-15" width="2" height="14" fill="url(#g_steel)"/>`,
  lance: `<rect x="-1.2" y="-2" width="2.4" height="44" fill="#6a4a2a"/><path d="M0 -50 L4 -40 L-4 -40Z" fill="url(#g_steel)"/>`,
  baton: `<rect x="-1.6" y="-30" width="3.2" height="60" rx="1.5" fill="#6a4a2a"/><circle cx="0" cy="-30" r="4" fill="url(#g_glow)"/>`,
  arc: `<path d="M0 -26 Q14 0 0 26" stroke="#6a4a2a" stroke-width="2.4" fill="none"/><line x1="0" y1="-26" x2="0" y2="26" stroke="#d8d0c0" stroke-width="0.8"/>`,
  arbalete: `<rect x="-2" y="-4" width="4" height="20" fill="#5a3f24"/><path d="M-12 -4 H12" stroke="#3a2a18" stroke-width="3"/>`,
};
// Familles d'armes dessinées par le workflow d'art (poudre, fronde, fouet, explosif…).
Object.assign(WEAPONS, GENERATED_WEAPONS);

export function weaponPart(w: Weapon): Part {
  return { svg: WEAPONS[weaponFamily(w)] ?? WEAPONS.epee };
}

export function shieldPart(_x: Weapon | ItemInstance): Part {
  return { svg: `<ellipse cx="0" cy="6" rx="11" ry="15" fill="url(#g_steelD)" stroke="#3a2a18" stroke-width="1.5"/><ellipse cx="0" cy="6" rx="3" ry="3" fill="#caa64a"/>` };
}

/** Matériau inféré du nom (sinon palier de PA). Cuir AVANT plaque (« Plastron de cuir »). */
export function armourMaterial(item: ItemInstance): 'rembourre' | 'cuir' | 'maille' | 'plaque' {
  const n = item.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/cuir|jaque/.test(n)) return 'cuir';
  if (/maille|cotte|haubert/.test(n)) return 'maille';
  if (/plaque|plastron|harnois|heaume|brassard|acier|gantelet|greve/.test(n)) return 'plaque';
  if (/rembourr|gambison|matelass/.test(n)) return 'rembourre';
  const pa = item.pa ?? 0;
  return pa >= 4 ? 'plaque' : pa >= 2 ? 'maille' : pa >= 1 ? 'cuir' : 'rembourre';
}

const MATERIAL_FILL: Record<string, string> = {
  rembourre: '#9a8a6a', cuir: '#6a4a2a', maille: 'url(#g_steelD)', plaque: 'url(#g_steel)',
};

/** Slot de corps couvert par cet item (via ses locs WFRP4) — false si pas ce slot. */
function coversSlot(item: ItemInstance, slot: Slot): boolean {
  const map: Partial<Record<Slot, HitLocation[]>> = {
    tete: ['tete'], torse: ['corps'], bras: ['brasG', 'brasD'], jambes: ['jambeG', 'jambeD'],
  };
  const locs = map[slot];
  return !!locs && (item.locs ?? []).some((l) => locs.includes(l));
}

export function armourPart(item: ItemInstance, slot: Slot): Part | null {
  if (!coversSlot(item, slot)) return null;
  const mat = armourMaterial(item);
  // Art dessiné par le workflow (matériau × emplacement) en priorité.
  const gen = GENERATED_ARMOUR[mat]?.[slot as 'tete' | 'torse' | 'bras' | 'jambes'];
  if (gen) return { svg: gen };
  const fill = MATERIAL_FILL[mat];
  switch (slot) {
    case 'tete':   return { svg: `<path d="M-9 -2 Q0 -16 9 -2 L9 4 Q0 8 -9 4Z" fill="${fill}" stroke="#2a3038"/>` };
    case 'torse':  return { svg: `<path d="M-14 -28 Q0 -33 14 -28 L13 4 L11 34 Q0 38 -11 34 L-13 4 Z" fill="${fill}" stroke="#2a3038" stroke-width="0.8"/>` };
    case 'bras':   return { svg: `<rect x="-3.7" y="-2" width="7.4" height="30" rx="3" fill="${fill}"/>` };
    case 'jambes': return { svg: `<rect x="-4.5" y="0" width="9" height="46" rx="3" fill="${fill}"/>` };
    default:       return null;
  }
}
