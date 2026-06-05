import type { Combatant, Weapon, ItemInstance, HitLocation } from '../../../engine/types';
import type { Slot } from '../bones';
import type { PartArt } from './types';
import { GENERATED_WEAPONS, GENERATED_ARMOUR } from './generated/weaponsArmour';
import { weaponGroupKey } from './weaponGroup';

/** Épée — front / dos (lame grise mate) / profil (fine). Art directionnel. */
const EPEE_ART: PartArt = {
  front: `<rect x="-1.5" y="-2" width="3" height="6" fill="#5a3f24"/><rect x="-1" y="-30" width="2" height="28" fill="url(#g_steel)"/><rect x="-5" y="-2" width="10" height="2.5" fill="#caa64a"/>`,
  back: `<rect x="-1.5" y="-2" width="3" height="6" fill="#4a3320"/><rect x="-1" y="-30" width="2" height="28" fill="#6a7384"/>`,
  profile: `<rect x="-1.2" y="-2" width="2.4" height="6" fill="#5a3f24"/><rect x="-0.8" y="-30" width="1.6" height="28" fill="url(#g_steel)"/>`,
};

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

/**
 * FORME d'art de l'arme (clé du registre WEAPONS). Le Groupe canonique (WFRP4)
 * n'encode pas la forme (épée/hache/masse sont tous « Base ») : table EXPLICITE par
 * libellé exact (canon + libellés génériques joués), repli sur la forme par défaut
 * du Groupe — JAMAIS de parsing flou par sous-chaîne.
 */
const ART_BY_LABEL: Record<string, string> = {
  dague: 'dague', couteau: 'dague', 'couteau de lancer': 'dague', flechette: 'dague', stylet: 'dague', poignard: 'dague',
  epee: 'epee', 'epee courte': 'epee', 'epee batarde': 'epee', zweihander: 'epee', rapiere: 'epee', fleuret: 'epee', sabre: 'epee', espadon: 'epee',
  hache: 'hache', 'hache de main': 'hache', hachette: 'hache', 'grande hache': 'hache', 'hache de lancer': 'hache', 'pioche a deux mains': 'hache', pioche: 'hache', cognee: 'hache',
  masse: 'masse', massue: 'masse', gourdin: 'masse', marteau: 'masse', 'marteau de guerre': 'masse', 'marteau a bec-de-corbin': 'masse', rocher: 'masse', maillet: 'masse',
  lance: 'lance', 'lance de cavalerie': 'lance', pique: 'lance', hallebarde: 'lance', javelot: 'lance', epieu: 'lance',
  baton: 'baton', 'baton de combat': 'baton', canne: 'baton',
  arc: 'arc', 'arc court': 'arc', 'arc long': 'arc', 'arc elfique': 'arc',
  arbalete: 'arbalete', 'arbalete de poing': 'arbalete', 'arbalete lourde': 'arbalete',
  fronde: 'fronde', fouet: 'fouet', lasso: 'fouet',
  bombe: 'explosif', 'bombe incendiaire': 'explosif',
  'mains nues': '', 'coup-de-poing': '', // poings : aucune arme dessinée
  // Attaques NATURELLES (traits) : aucune arme tenue — la part du corps fait foi.
  poings: '', morsure: '', griffes: '', griffe: '', tentacule: '', tentacules: '',
  bec: '', dard: '', corne: '', cornes: '', queue: '', pietinement: '', crachat: '',
};

/** Forme par défaut d'un Groupe canonique (quand le libellé n'est pas dans la table). */
const ART_BY_GROUP: Record<string, string> = {
  base: 'epee', escrime: 'epee', deuxmains: 'epee',
  cavalerie: 'lance', hast: 'lance', fleau: 'masse', parade: 'parade', bagarre: '',
  arc: 'arc', arbalete: 'arbalete', poudre: 'poudre', ingenierie: 'poudre',
  fronde: 'fronde', lancer: 'dague', entraves: 'fouet', explosifs: 'explosif',
};

export function weaponFamily(w: Weapon): string {
  const n = w.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  if (n in ART_BY_LABEL) return ART_BY_LABEL[n];
  return ART_BY_GROUP[weaponGroupKey(w)] ?? (w.type === 'ranged' ? 'arc' : 'epee');
}

/** Parts d'arme (dessinées dans le repère local de l'os `arme`, manche à l'origine). */
const WEAPONS: Record<string, PartArt> = {
  epee: `<rect x="-1.7" y="-2" width="3.4" height="7" rx="1" fill="#5a3f24"/><rect x="-5.5" y="-3.5" width="11" height="2.8" rx="1" fill="#caa64a"/><path d="M-2.3 -3 L2.3 -3 L2 -30 L0 -35 L-2 -30 Z" fill="url(#g_steel)" stroke="#2a3038" stroke-width="0.4"/>`,
  hache: `<rect x="-1.7" y="-30" width="3.4" height="36" rx="1.4" fill="#4a2f17"/><path d="M-1 -33 Q17 -35 14 -19 Q17 -4 -1 -9 Z" fill="url(#g_axe)" stroke="#2a3038" stroke-width="0.6"/><path d="M-1 -31 Q-8 -32 -8 -24 Q-8 -16 -1 -17 Z" fill="url(#g_axe)" stroke="#2a3038" stroke-width="0.5" opacity="0.9"/>`,
  masse: `<rect x="-1.7" y="-26" width="3.4" height="32" rx="1.4" fill="#4a2f17"/><circle cx="0" cy="-28" r="6" fill="url(#g_steelD)" stroke="#2a3038" stroke-width="0.5"/><path d="M0 -37 l2.6 3.5 -5.2 0 z M0 -19 l2.6 -3.5 -5.2 0 z M-9.5 -28 l3.5 2.6 0 -5.2 z M9.5 -28 l-3.5 2.6 0 -5.2 z" fill="#aab2bd" stroke="#2a3038" stroke-width="0.3"/>`,
  dague: `<rect x="-1.4" y="-1" width="2.8" height="6" rx="0.9" fill="#4a2f17"/><rect x="-4" y="-2" width="8" height="2" rx="0.9" fill="#6a5238"/><path d="M-1.9 -2 L1.9 -2 L1.6 -16 L0 -20 L-1.6 -16 Z" fill="url(#g_steel)" stroke="#2a3038" stroke-width="0.3"/>`,
  lance: `<rect x="-1.7" y="-30" width="3.4" height="40" rx="1.5" fill="#6a4a2a"/><path d="M0 -50 L5.5 -37 L2 -29 L-2 -29 L-5.5 -37 Z" fill="url(#g_steel)" stroke="#2a3038" stroke-width="0.5"/>`,
  baton: `<rect x="-1.6" y="-30" width="3.2" height="60" rx="1.5" fill="#6a4a2a"/><circle cx="0" cy="-30" r="4" fill="url(#g_glow)"/>`,
  arc: `<path d="M0 -26 Q14 0 0 26" stroke="#6a4a2a" stroke-width="2.4" fill="none"/><line x1="0" y1="-26" x2="0" y2="26" stroke="#d8d0c0" stroke-width="0.8"/>`,
  arbalete: `<rect x="-2" y="-4" width="4" height="20" fill="#5a3f24"/><path d="M-12 -4 H12" stroke="#3a2a18" stroke-width="3"/>`,
};
// Familles d'armes dessinées par le workflow d'art (poudre, fronde, fouet, explosif…).
Object.assign(WEAPONS, GENERATED_WEAPONS);
WEAPONS.epee = EPEE_ART; // épée : front/back/profile
// Réécritures lisibilité (audit aveugle) — formes reconnaissables au 1er coup d'œil.
WEAPONS.arc = `<path d="M3 -28 Q-13 0 3 28" stroke="#6a4a2a" stroke-width="3" fill="none"/><line x1="3" y1="-28" x2="3" y2="28" stroke="#e8e0d0" stroke-width="1"/><line x1="3" y1="0" x2="-15" y2="0" stroke="#caa882" stroke-width="1.6"/><path d="M-15 0 l5 -2.5 v5 z" fill="#caa882"/>`;
WEAPONS.arbalete = `<rect x="-1.6" y="-30" width="3.2" height="34" rx="1" fill="#5a3f24"/><path d="M-13 -23 Q0 -19 13 -23" stroke="#3a2a18" stroke-width="2.6" fill="none"/><line x1="-13" y1="-23" x2="13" y2="-23" stroke="#d8d0c0" stroke-width="0.8"/><rect x="-1" y="-32" width="2" height="11" fill="#caa882"/><path d="M0 -34 l1.6 4 -3.2 0 z" fill="#caa882"/>`;
WEAPONS.poudre = `<rect x="-2" y="-30" width="4.2" height="22" rx="1" fill="url(#g_steelD)" stroke="#2a2018" stroke-width="0.4"/><circle cx="0" cy="-31" r="2.6" fill="#2a2a30"/><path d="M-2 -12 q-2 9 -7 13 q-3 2 -4 -1 q-1 -3 2 -6 l5 -8 z" fill="#5a3f24" stroke="#33241a" stroke-width="0.4"/><path d="M2.2 -16 q4 0 4 4" stroke="#caa64a" stroke-width="1.3" fill="none"/>`;
WEAPONS.fronde = `<path d="M-5 -28 Q-2 -12 0 -2" stroke="#6a4a2a" stroke-width="1.3" fill="none"/><path d="M5 -28 Q2 -12 0 -2" stroke="#6a4a2a" stroke-width="1.3" fill="none"/><path d="M-4 -3 Q0 5 4 -3 Q0 0 -4 -3 z" fill="#7a5a3a" stroke="#4a3525" stroke-width="0.4"/><circle cx="0" cy="-2" r="2.6" fill="#8a929c" stroke="#3a4048" stroke-width="0.4"/>`;
WEAPONS.fouet = `<rect x="-1.6" y="-3" width="3.2" height="11" rx="1.3" fill="#3a2a1a"/><path d="M0 -3 q11 -5 7 -16 q-3 -8 -11 -5 q-6 2 -3 8" stroke="#6a4a2a" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
WEAPONS.explosif = `<circle cx="0" cy="-7" r="8" fill="#2b2b30" stroke="#141418" stroke-width="0.6"/><ellipse cx="-2.6" cy="-9.6" rx="2.4" ry="1.6" fill="#54545f"/><path d="M5 -13 q4 -3 3 -8" stroke="#3a2a1a" stroke-width="1.6" fill="none"/><circle cx="8" cy="-22" r="2.4" fill="url(#g_glow)"/><circle cx="8" cy="-22" r="1.1" fill="#ffd34d"/>`;

export function weaponPart(w: Weapon): PartArt {
  const f = weaponFamily(w);
  if (f === '') return ''; // mains nues : pas d'arme
  return WEAPONS[f] ?? WEAPONS.epee;
}

export function shieldPart(_x: Weapon | ItemInstance): PartArt {
  return `<ellipse cx="0" cy="6" rx="11" ry="15" fill="url(#g_steelD)" stroke="#3a2a18" stroke-width="1.5"/><ellipse cx="0" cy="6" rx="3" ry="3" fill="#caa64a"/>`;
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

export function armourPart(item: ItemInstance, slot: Slot): PartArt | null {
  if (!coversSlot(item, slot)) return null;
  const mat = armourMaterial(item);
  // Art dessiné par le workflow (matériau × emplacement) en priorité.
  const gen = GENERATED_ARMOUR[mat]?.[slot as 'tete' | 'torse' | 'bras' | 'jambes'];
  if (gen) return gen;
  const fill = MATERIAL_FILL[mat];
  switch (slot) {
    case 'tete':   return `<path d="M-9 -2 Q0 -16 9 -2 L9 4 Q0 8 -9 4Z" fill="${fill}" stroke="#2a3038"/>`;
    case 'torse':  return `<path d="M-14 -28 Q0 -33 14 -28 L13 4 L11 34 Q0 38 -11 34 L-13 4 Z" fill="${fill}" stroke="#2a3038" stroke-width="0.8"/>`;
    case 'bras':   return `<rect x="-3.7" y="-2" width="7.4" height="30" rx="3" fill="${fill}"/>`;
    case 'jambes': return `<rect x="-4.5" y="0" width="9" height="46" rx="3" fill="${fill}"/>`;
    default:       return null;
  }
}
