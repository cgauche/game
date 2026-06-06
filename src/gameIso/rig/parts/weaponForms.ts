/**
 * SOURCE DE VÉRITÉ des FORMES d'arme : 1 silhouette par arme de la donnée (52).
 * `slug` = clé d'art dans le registre WEAPONS (equipment.ts). `target` = cible
 * silhouette-first (FR) consommée par les workflows d'art via `args`. L'ANIMATION
 * reste pilotée par le groupe canonique (weaponGroup.ts) — ceci ne touche QUE la forme.
 */
export interface WeaponForm { label: string; slug: string; type: 'melee' | 'ranged'; group: string; target: string; }
export interface ShieldForm { label: string; slug: string; target: string; }

export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

export const WEAPON_FORMS: WeaponForm[] = [
  { label: 'Bâton de combat', slug: 'baton', type: 'melee', group: "Armes d'hast", target: 'long bâton/quarterstaff en bois, deux bouts' },
  { label: 'Hallebarde', slug: 'hallebarde', type: 'melee', group: "Armes d'hast", target: 'hampe + tête combinée : large fer de hache + pointe + croc' },
  { label: 'Lance', slug: 'lance', type: 'melee', group: "Armes d'hast", target: 'hampe + fer de lance foliacé' },
  { label: 'Pique', slug: 'pique', type: 'melee', group: "Armes d'hast", target: "hampe TRÈS longue, petite pointe d'infanterie" },
  { label: 'Coup-de-poing', slug: 'poing', type: 'melee', group: 'Bagarre', target: 'coup-de-poing/cestes sur le poing fermé' },
  { label: 'Arme improvisée', slug: 'improvisee', type: 'melee', group: 'Base', target: 'objet de fortune (planche/tabouret/bouteille cassée)' },
  { label: 'Arme simple', slug: 'gourdin', type: 'melee', group: 'Base', target: 'gourdin/trique de bois simple' },
  { label: 'Couteau', slug: 'couteau', type: 'melee', group: 'Base', target: 'couteau à lame courte, rustique, sans vraie garde' },
  { label: 'Dague', slug: 'dague', type: 'melee', group: 'Base', target: 'dague à garde croisée' },
  { label: 'Lance de cavalerie', slug: 'lance_cavalerie', type: 'melee', group: 'Cavalerie', target: 'longue lance de charge, parfois fanion' },
  { label: 'Marteau à bec-de-corbin', slug: 'bec_de_corbin', type: 'melee', group: 'Cavalerie', target: 'bec-de-corbin : pic recourbé + contre-marteau sur manche' },
  { label: 'Épée bâtarde', slug: 'epee_batarde', type: 'melee', group: 'Deux-mains', target: 'épée longue à une main et demie, longue poignée' },
  { label: 'Grande hache', slug: 'grande_hache', type: 'melee', group: 'Deux-mains', target: 'grande hache à deux mains, fer large' },
  { label: 'Marteau de guerre', slug: 'marteau_guerre', type: 'melee', group: 'Deux-mains', target: 'marteau de guerre 2 mains : tête massive + pic au dos' },
  { label: 'Pioche à deux mains', slug: 'pioche_2m', type: 'melee', group: 'Deux-mains', target: 'pic/pioche de guerre à deux mains, longue pointe courbe' },
  { label: 'Zweihänder', slug: 'zweihander', type: 'melee', group: 'Deux-mains', target: 'espadon géant, très longue lame, parierhaken (ergots)' },
  { label: 'Fleuret', slug: 'fleuret', type: 'melee', group: 'Escrime', target: 'lame très fine et droite, garde simple en croix' },
  { label: 'Rapière', slug: 'rapiere', type: 'melee', group: 'Escrime', target: 'rapière à garde en coquille/panier ouvragé, lame fine' },
  { label: 'Fléau', slug: 'fleau', type: 'melee', group: 'Fléau', target: 'manche + chaîne courte + tête/boule au bout' },
  { label: 'Fléau à grain', slug: 'fleau_grain', type: 'melee', group: 'Fléau', target: 'fléau agricole : battant de bois relié au manche par une lanière' },
  { label: "Fléau d'armes", slug: 'fleau_armes', type: 'melee', group: 'Fléau', target: 'fléau militaire : manche + chaîne + boule à pointes' },
  { label: 'Brise-épée', slug: 'brise_epee', type: 'melee', group: 'Parade', target: 'lame courte large à crans/dents (sword-breaker), forte garde' },
  { label: 'Main Gauche', slug: 'main_gauche', type: 'melee', group: 'Parade', target: 'dague de main-gauche : longs quillons droits, anneau de garde' },
  { label: 'Arbalète', slug: 'arbalete', type: 'ranged', group: 'Arbalète', target: 'arbalète : arc transversal + fût + étrier' },
  { label: 'Arbalète de poing', slug: 'arbalete_poing', type: 'ranged', group: 'Arbalète', target: 'petite arbalète tenue à une main' },
  { label: 'Arbalète lourde', slug: 'arbalete_lourde', type: 'ranged', group: 'Arbalète', target: 'grosse arbalète de siège à treuil/cranequin' },
  { label: 'Arc', slug: 'arc', type: 'ranged', group: 'Arc', target: 'arc simple en D, corde tendue' },
  { label: 'Arc court', slug: 'arc_court', type: 'ranged', group: 'Arc', target: "arc court compact (plus petit que l'avant-bras du tireur)" },
  { label: 'Arc elfique', slug: 'arc_elfique', type: 'ranged', group: 'Arc', target: 'arc elfique gracile à double courbure, embouts ornés' },
  { label: 'Arc long', slug: 'arc_long', type: 'ranged', group: 'Arc', target: "grand arc long (≈ hauteur de l'archer)" },
  { label: 'Fouet', slug: 'fouet', type: 'ranged', group: 'Entraves', target: 'manche court + longue lanière de cuir qui ondule' },
  { label: 'Lasso', slug: 'lasso', type: 'ranged', group: 'Entraves', target: 'grande boucle de corde ouverte (nœud coulant)' },
  { label: 'Bombe', slug: 'bombe', type: 'ranged', group: 'Explosifs', target: 'sphère noire de fonte + mèche allumée (étincelle)' },
  { label: 'Bombe incendiaire', slug: 'bombe_incendiaire', type: 'ranged', group: 'Explosifs', target: 'pot/bombe à feu, flamme et huile qui dégoulinent' },
  { label: 'Fronde', slug: 'fronde', type: 'ranged', group: 'Fronde', target: '2 lanières + poche de cuir + galet' },
  { label: 'Fustibale', slug: 'fustibale', type: 'ranged', group: 'Fronde', target: "fronde à bâton : poche au bout d'une lanière fixée à un manche" },
  { label: 'Bolas', slug: 'bolas', type: 'ranged', group: 'Lancer', target: '3 lanières reliées, lestées de boules aux extrémités' },
  { label: 'Couteau de lancer', slug: 'couteau_lancer', type: 'ranged', group: 'Lancer', target: 'couteau de jet fin et équilibré, sans garde' },
  { label: 'Fléchette', slug: 'flechette', type: 'ranged', group: 'Lancer', target: 'dard/fléchette empennée à lancer, petite' },
  { label: 'Hache de lancer', slug: 'hache_lancer', type: 'ranged', group: 'Lancer', target: 'hachette de jet (francisque), manche court' },
  { label: 'Javelot', slug: 'javelot', type: 'ranged', group: 'Lancer', target: 'javelot : lance légère et fine de jet' },
  { label: 'Rocher', slug: 'rocher', type: 'ranged', group: 'Lancer', target: 'grosse pierre / rocher irrégulier à jeter' },
  { label: 'Arquebus à répétition', slug: 'arquebus_rep', type: 'ranged', group: 'Ingénierie', target: 'long canon + magasin/mécanisme à répétition au-dessus' },
  { label: 'Pistolet à répétition', slug: 'pistolet_rep', type: 'ranged', group: 'Ingénierie', target: 'pistolet court + barillet/magasin de répétition' },
  { label: 'Arquebuse', slug: 'arquebuse', type: 'ranged', group: 'Poudre noire', target: 'arquebuse : long canon + crosse en bois + platine à mèche' },
  { label: "Long fusil d'Hochland", slug: 'hochland', type: 'ranged', group: 'Poudre noire', target: 'très long canon de précision + lunette de visée + crosse' },
  { label: 'Pistolet', slug: 'pistolet', type: 'ranged', group: 'Poudre noire', target: 'pistolet à poudre court, crosse recourbée, chien/platine' },
  { label: 'Tromblon', slug: 'tromblon', type: 'ranged', group: 'Poudre noire', target: 'tromblon : canon court évasé en pavillon (blunderbuss)' },
];

export const SHIELD_FORMS: ShieldForm[] = [
  { label: 'Bouclier', slug: 'rond', target: 'rondache ronde à umbo central + rivets' },
  { label: 'Bouclier (Grand)', slug: 'grand', target: 'grand écu haut (kite/pavois), pointe vers le bas' },
  { label: 'Bouclier (Targe)', slug: 'targe', target: 'petite targe ronde bombée à umbo' },
];

const BY_LABEL = new Map(WEAPON_FORMS.map((f) => [norm(f.label), f.slug]));
/** slug de forme pour un libellé d'arme catalogué (sinon undefined). */
export const formSlug = (label: string): string | undefined => BY_LABEL.get(norm(label));
