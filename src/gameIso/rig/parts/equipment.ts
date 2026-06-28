import type { Combatant, Weapon, ItemInstance, HitLocation, QualityInstance } from '../../../engine/types';
import { isCapeItem } from '../../../engine/items';
import { QUALITY_IDS } from '../../../engine/qualities/ids';
import type { Slot } from '../bones';
import type { PartArt } from './types';
import { GENERATED_ARMOUR, ARMOUR_PALETTES } from './generated/armour';
import { WEAPON_DEFS } from './weapons/_registry.generated';
import { weaponGroupKey } from './weaponGroup';
import { WEAPON_FORMS, norm as wnorm, formSlug } from './weaponForms';
import { buildTokenMap, applyTokenMap } from '../palette';

/** Épée — front / dos (lame grise mate) / profil (fine). Art directionnel. */
const EPEE_ART: PartArt = {
  front: `<rect x="-1.5" y="-2" width="3" height="6" fill="#5a3f24"/><rect x="-1" y="-30" width="2" height="28" fill="url(#g_steel)"/><rect x="-5" y="-2" width="10" height="2.5" fill="#caa64a"/>`,
  back: `<rect x="-1.5" y="-2" width="3" height="6" fill="#4a3320"/><rect x="-1" y="-30" width="2" height="28" fill="#6a7384"/>`,
  profile: `<rect x="-1.2" y="-2" width="2.4" height="6" fill="#5a3f24"/><rect x="-0.8" y="-30" width="1.6" height="28" fill="url(#g_steel)"/>`,
};

/** Contexte d'équipement extrait d'un Combatant (le rendu lit l'engine — direction permise). */
export interface EquipCtx {
  weapons: Weapon[];
  armour: ItemInstance[];           // pièces d'armure ÉQUIPÉES (locs renseignés), couche VISIBLE d'abord
  shield?: Weapon | ItemInstance;
  cape?: ItemInstance;              // cape/manteau porté (cosmétique — rendu dorsal)
}

export const isShield = (x: { name: string; qualities?: QualityInstance[] }) =>
  (x.qualities ?? []).some((q) => q.id === QUALITY_IDS.Protectrice) || /bouclier/i.test(x.name);

/** Rang d'affichage des matériaux : la couche du DESSUS s'affiche (plaque sur maille sur cuir). */
const MATERIAL_RANK: Record<ReturnType<typeof armourMaterial>, number> = { plaque: 3, maille: 2, cuir: 1, rembourre: 0 };

export function equipFromCombatant(c: Combatant): EquipCtx {
  const weapons = c.weapons ?? [];
  // Pièces TRIÉES par matériau décroissant : par slot, le rendu (resolve.ts) prend la 1re pièce qui
  // le couvre → un héros en cuir + maille montre la maille, la plate par-dessus tout.
  const armour = (c.items ?? [])
    .filter((i) => i.kind === 'armor' && i.equipped && (i.locs?.length ?? 0) > 0)
    .sort((a, b) => MATERIAL_RANK[armourMaterial(b)] - MATERIAL_RANK[armourMaterial(a)]);
  const shield = weapons.find(isShield); // un bouclier tenu est dans le set actif → présent dans c.weapons
  const cape = (c.items ?? []).find((i) => i.equipped && isCapeItem(i));
  return { weapons, armour, shield, cape };
}

/**
 * FORME d'art de l'arme (clé du registre WEAPONS) = 1 silhouette par arme.
 * Dérivée de WEAPON_FORMS (les 48 armes de la donnée → leur slug), plus des SYNONYMES
 * pour les libellés génériques joués HORS-catalogue. Repli ART_BY_GROUP ensuite.
 * Le Groupe canonique (WFRP4) n'encode pas la forme — JAMAIS de parsing flou par sous-chaîne.
 */
const SYNONYMS: Record<string, string> = {
  // épée générique & variantes hors-catalogue
  epee: 'epee', 'epee courte': 'epee', espadon: 'zweihander',
  // contondant hors-catalogue
  masse: 'masse', marteau: 'masse', maillet: 'masse', canne: 'baton',
  // tranchant hors-catalogue
  hache: 'hache', 'hache de main': 'hache', hachette: 'hache', cognee: 'hache',
  poignard: 'dague', stylet: 'dague', epieu: 'lance',
  // prothèse-arme : le crochet est dessiné SUR la main (injuries.ts), pas tenu. Les autres
  // attaques NATURELLES (morsure/griffes/bec/dard/corne/queue/piétinement/crachat/poings/
  // mains nues) sont captées par la regex NATURAL_ATTACK avant ART_BY_LABEL → inutile ici.
  crochet: '',
};
const ART_BY_LABEL: Record<string, string> = { ...SYNONYMS };
for (const f of WEAPON_FORMS) ART_BY_LABEL[wnorm(f.label)] = f.slug;

/** Forme par défaut d'un Groupe canonique (quand le libellé n'est pas dans la table). */
const ART_BY_GROUP: Record<string, string> = {
  base: 'epee', escrime: 'rapiere', deuxmains: 'epee_batarde',
  cavalerie: 'lance_cavalerie', hast: 'lance', fleau: 'fleau', parade: 'main_gauche', bagarre: '',
  arc: 'arc', arbalete: 'arbalete', poudre: 'pistolet', ingenierie: 'pistolet_rep',
  fronde: 'fronde', lancer: 'javelot', entraves: 'fouet', explosifs: 'bombe',
};

/** Attaques NATURELLES (corps) : aucune arme tenue n'est dessinée (la part du corps fait foi). */
const NATURAL_ATTACK = /^(morsure|griffes?|serres?|tentacules?|bec|dard|cornes?|queue|pi[ée]tinement|crachat|poings?|mains nues)\b/i;

export function weaponFamily(w: Weapon): string {
  // Attaque NATURELLE (corps) : pas d'objet en main (Morsure/Griffe accordées par un Sort) —
  // SAUF si le nom EST un libellé catalogué (ex. « Griffes de Tigre », arme de Bagarre tenue),
  // qui prime sur l'heuristique de préfixe.
  if (NATURAL_ATTACK.test(w.name) && !formSlug(w.name)) return '';
  // Silhouette de rendu forcée (arme invoquée nommée « Arme aethyrique » mais dessinée comme la
  // forme choisie) : un libellé catalogue → son slug de forme. Prioritaire sur le nom.
  if (w.form) {
    const f = wnorm(w.form);
    if (f in ART_BY_LABEL) return ART_BY_LABEL[f];
  }
  const n = wnorm(w.name);
  if (n in ART_BY_LABEL) return ART_BY_LABEL[n];
  return ART_BY_GROUP[weaponGroupKey(w)] ?? (w.type === 'ranged' ? 'arc' : 'epee');
}

/**
 * Parts d'arme (repère local de l'os `arme`, manche à l'origine).
 * ART DES FORMES = registre auto-chargé `weapons/defs/` (1 arme = 1 fichier ; les réécritures
 * lisibilité de l'audit aveugle sont déjà bakées dans chaque def). On y ajoute seulement les
 * FALLBACKS HORS-FORME (synonymes/groupes joués sans silhouette dédiée : épée générique,
 * hache, masse) — eux restent dessinés ici.
 */
// Art des formes RÉSOLU @défaut (palette `stored` du def). `applyTokenMap` est un no-op tant
// que l'art ne contient pas de `@tokens` (armes non encore tokenisées) → sûr avant/après.
const FORM_ART: Record<string, PartArt> = Object.fromEntries(
  WEAPON_DEFS.map((d) => [d.slug, applyTokenMap(d.art, buildTokenMap(d.palette ?? {}))]),
);
const FORM_DEF = new Map(WEAPON_DEFS.map((d) => [d.slug, d]));
const WEAPONS: Record<string, PartArt> = {
  epee: EPEE_ART, // épée générique : front/back/profile
  hache: `<rect x="-1.7" y="-30" width="3.4" height="36" rx="1.4" fill="#4a2f17"/><path d="M-1 -33 Q17 -35 14 -19 Q17 -4 -1 -9 Z" fill="url(#g_axe)" stroke="#2a3038" stroke-width="0.6"/><path d="M-1 -31 Q-8 -32 -8 -24 Q-8 -16 -1 -17 Z" fill="url(#g_axe)" stroke="#2a3038" stroke-width="0.5" opacity="0.9"/>`,
  masse: `<rect x="-1.7" y="-26" width="3.4" height="32" rx="1.4" fill="#4a2f17"/><circle cx="0" cy="-28" r="6" fill="url(#g_steelD)" stroke="#2a3038" stroke-width="0.5"/><path d="M0 -37 l2.6 3.5 -5.2 0 z M0 -19 l2.6 -3.5 -5.2 0 z M-9.5 -28 l3.5 2.6 0 -5.2 z M9.5 -28 l-3.5 2.6 0 -5.2 z" fill="#aab2bd" stroke="#2a3038" stroke-width="0.3"/>`,
  ...FORM_ART,
};

export function weaponPart(w: Weapon): PartArt {
  const f = weaponFamily(w);
  if (f === '') return ''; // mains nues : pas d'arme
  // SKIN d'objet légendaire : re-résout l'art du def contre SA palette + l'override d'instance
  // (≠ tenues qui suivent la palette du PORTEUR). Sans skin → art @défaut précalculé.
  const def = w.skin ? FORM_DEF.get(f) : undefined;
  if (def) return applyTokenMap(def.art, buildTokenMap(def.palette ?? {}, w.skin));
  return WEAPONS[f] ?? WEAPONS.epee;
}

/** Silhouette de bouclier par nom (rondache / grand écu / targe). Os `bouclier`, main G. */
const SHIELDS: Record<'rond' | 'grand' | 'targe', string> = {
  rond: `<circle cx="0" cy="6" r="13" fill="url(#g_steelD)" stroke="#3a2a18" stroke-width="1.6"/><circle cx="0" cy="6" r="13" fill="none" stroke="#6a4a2a" stroke-width="0.8"/><circle cx="0" cy="6" r="3.4" fill="#caa64a" stroke="#7a5a18" stroke-width="0.6"/><g fill="#9aa2ac"><circle cx="0" cy="-5" r="0.9"/><circle cx="0" cy="17" r="0.9"/><circle cx="-11" cy="6" r="0.9"/><circle cx="11" cy="6" r="0.9"/></g>`,
  grand: `<path d="M-11 -10 Q0 -13 11 -10 L11 8 Q11 20 0 28 Q-11 20 -11 8 Z" fill="url(#g_steelD)" stroke="#3a2a18" stroke-width="1.6"/><path d="M0 -12 L0 27" stroke="#6a4a2a" stroke-width="1.1"/><path d="M-11 1 Q0 4 11 1" fill="none" stroke="#6a4a2a" stroke-width="1.1"/><circle cx="0" cy="3" r="2.4" fill="#caa64a" stroke="#7a5a18" stroke-width="0.5"/>`,
  targe: `<circle cx="0" cy="6" r="9.5" fill="url(#g_steel)" stroke="#3a2a18" stroke-width="1.4"/><circle cx="0" cy="6" r="9.5" fill="none" stroke="#cfd8e6" stroke-width="0.5" opacity="0.7"/><circle cx="0" cy="6" r="3.2" fill="url(#g_steelD)" stroke="#2a3038" stroke-width="0.6"/>`,
};
export function shieldPart(x: Weapon | ItemInstance): PartArt {
  const n = (x.name ?? '').toLowerCase();
  const key = /grand/.test(n) ? 'grand' : /targe/.test(n) ? 'targe' : 'rond';
  return SHIELDS[key];
}

/** Matériau inféré du nom (sinon palier de PA). Cuir AVANT plaque (« Plastron de cuir »). */
export function armourMaterial(item: ItemInstance): 'rembourre' | 'cuir' | 'maille' | 'plaque' {
  const n = wnorm(item.name);
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
  // Art dessiné par le workflow (matériau × emplacement) en priorité, COULEUR résolue contre la
  // palette du matériau (défaut sans perte) + le SKIN de l'objet (override par-objet, légendaire).
  const gen = GENERATED_ARMOUR[mat]?.[slot as 'tete' | 'torse' | 'bras' | 'jambes'];
  if (gen) return applyTokenMap(gen, buildTokenMap(ARMOUR_PALETTES[mat] ?? {}, item.skin as Record<string, string> | undefined));
  const fill = MATERIAL_FILL[mat];
  switch (slot) {
    case 'tete':   return `<path d="M-9 -2 Q0 -16 9 -2 L9 4 Q0 8 -9 4Z" fill="${fill}" stroke="#2a3038"/>`;
    case 'torse':  return `<path d="M-14 -28 Q0 -33 14 -28 L13 4 L11 34 Q0 38 -11 34 L-13 4 Z" fill="${fill}" stroke="#2a3038" stroke-width="0.8"/>`;
    case 'bras':   return `<rect x="-3.7" y="-2" width="7.4" height="30" rx="3" fill="${fill}"/>`;
    case 'jambes': return `<rect x="-4.5" y="0" width="9" height="46" rx="3" fill="${fill}"/>`;
    default:       return null;
  }
}
