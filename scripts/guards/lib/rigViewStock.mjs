// STOCK CLIQUETÉ des VUES de part hors slots de corps (#1082) — familles `parts/monster/defs/`
// (parts monstrueuses du bipède : têtes, bras, jambes) et `parts/elements/defs/` (catalogue
// d'apparence : cornes, ailes, oreilles, écailles…). Consommé par
// `src/gameIso/rig/parts/monster/rig-part-views.test.ts`. Frère de `rigPartViewStock.mjs`, qui
// couvre les slots de CORPS (tenues + armures) ; même patron whitelist-en-lib du dépôt.
//
// POURQUOI ces deux familles : elles ne passent pas par `resolveParts`. Leur repli est SILENCIEUX —
// `pickView` (`parts/types.ts`) sert le front tel quel côté monstre ; côté éléments, le filtre
// `if (ov.view && ov.view !== view) continue` (`composeRig.tsx`) émet un overlay SANS `view` à
// l'identique dans les trois vues. Aucun cliquet ne les mesurait.
//
// TROIS dimensions, clé `<famille>:<clé>:<vue>` (`monstre:<slot>:<clé>:<vue>` / `element:<clé>:<vue>`) :
//   - RIG_VIEW_FORMAT_RATCHET    : la vue n'est DÉCLARÉE nulle part (repli sur le front) ;
//   - RIG_VIEW_ALIAS_RATCHET     : vue déclarée, géométrie IDENTIQUE au front (`geometry`, pas la
//     chaîne : un espace, un commentaire, un `<g>` inerte ou un simple recolorage ne s'en échappent pas) ;
//   - RIG_VIEW_TRANSFORM_RATCHET : vue déclarée, géométrie différente, mais contenu du front réutilisé
//     sous une enveloppe `<g transform=…>` (ou inclus en sous-chaîne) — la silhouette est tournée,
//     l'occlusion n'est pas redessinée.
//
// La MESURE vit dans `scripts/guards/lib/partViewAudit.ts` (`auditRigPartViews`), partagée avec la
// garde et le régénérateur `scripts/rig/regen-rig-view-stock.mts` — deux lectures du pipeline
// divergeraient.
//
// CLIQUET, pas absolution : la garde échoue (a) sur toute violation ABSENTE de ces listes ; (b) sur
// toute clé qui ne viole PLUS ; (c) si la TAILLE d'un stock dépasse son plafond — plafonds gelés dans
// la GARDE, jamais ici (un stock qui porte son plafond le relève d'une ligne). Une entrée se solde en
// DESSINANT la vue puis en baissant le plafond, jamais en allongeant la liste.
//
// Ampleur à la pose (2026-08-04) : MONSTRE — 24 defs (20 têtes, 2 bras, 2 jambes), 8 vues non
// déclarées portées par 4 defs front-only (chèvre, fauve, griffe, tentacule = la totalité des slots
// bras+jambe ; les 20 têtes déclarent leurs 3 vues). ÉLÉMENTS — 70 defs dont 65 porteurs d'overlays,
// 115 vues non déclarées sur 130 possibles, + 4 vues déclarées aliasées (cornes de démon, cornes de
// taureau, queue de rat, queue : le `back` du registre APPENDAGES retombe sur le front, cf.
// `parts/appendages/index.ts`). Dimension TRANSFORM : 0 sur les deux familles.

/** @type {ReadonlySet<string>} */
export const RIG_VIEW_FORMAT_RATCHET = new Set([
  'monstre:bras:griffe:back', // Pince (griffe de crabe)
  'monstre:bras:griffe:profile', // Pince (griffe de crabe)
  'monstre:bras:tentacule:back', // Tentacule
  'monstre:bras:tentacule:profile', // Tentacule
  'monstre:jambe:chevre:back', // Pattes de chèvre
  'monstre:jambe:chevre:profile', // Pattes de chèvre
  'monstre:jambe:fauve:back', // Pattes de lion (fauve)
  'monstre:jambe:fauve:profile', // Pattes de lion (fauve)
  'element:articulation-supplementaire-aux-jambes:back', // Articulation supplémentaire aux jambes
  'element:articulation-supplementaire-aux-jambes:profile', // Articulation supplémentaire aux jambes
  'element:barbe-naine:back', // Barbe naine
  'element:beaute-surnaturelle:back', // Beauté surnaturelle
  'element:beaute-surnaturelle:profile', // Beauté surnaturelle
  'element:bec:back', // Bec
  'element:bec:profile', // Bec
  'element:bicephale:back', // Bicéphale
  'element:bicephale:profile', // Bicéphale
  'element:bouche-supplementaire:back', // Bouche supplémentaire
  'element:bouche-supplementaire:profile', // Bouche supplémentaire
  'element:branchies:back', // Branchies
  'element:branchies:profile', // Branchies
  'element:bras-elastiques:back', // Bras élastiques
  'element:bras-elastiques:profile', // Bras élastiques
  'element:bras-multiples:back', // Bras multiples
  'element:bras-multiples:profile', // Bras multiples
  'element:cornes-asymetriques:back', // Cornes asymétriques
  'element:cornes-asymetriques:profile', // Cornes asymétriques
  'element:crane-pointu:back', // Crâne pointu
  'element:crane-pointu:profile', // Crâne pointu
  'element:crete-sur-la-tete:back', // Crête sur la tête
  'element:crete-sur-la-tete:profile', // Crête sur la tête
  'element:crocs:back', // Crocs
  'element:crocs:profile', // Crocs
  'element:doigts-distendus:back', // Doigts distendus
  'element:doigts-distendus:profile', // Doigts distendus
  'element:ecailles-epineuses:back', // Écailles épineuses
  'element:ecailles-epineuses:profile', // Écailles épineuses
  'element:ecailles:back', // Écailles
  'element:ecailles:profile', // Écailles
  'element:exophtalmie:back', // Exophtalmie
  'element:exophtalmie:profile', // Exophtalmie
  'element:extremites-armees:back', // Extrémités armées
  'element:extremites-armees:profile', // Extrémités armées
  'element:griffes:back', // Griffes
  'element:griffes:profile', // Griffes
  'element:groin-poilu:back', // Groin poilu
  'element:groin-poilu:profile', // Groin poilu
  'element:jambes-multiples:back', // Jambes multiples
  'element:jambes-multiples:profile', // Jambes multiples
  'element:langue-pendante:back', // Langue pendante
  'element:langue-pendante:profile', // Langue pendante
  'element:long-cou:back', // Long cou
  'element:long-cou:profile', // Long cou
  'element:longs-bras:back', // Longs bras
  'element:longs-bras:profile', // Longs bras
  'element:mains-et-pieds-a-ventouses:back', // Mains et pieds à ventouses
  'element:mains-et-pieds-a-ventouses:profile', // Mains et pieds à ventouses
  'element:mauvais-oeil:back', // Mauvais œil
  'element:mauvais-oeil:profile', // Mauvais œil
  'element:membres-rouges:back', // Membres rouges (démon)
  'element:membres-rouges:profile', // Membres rouges (démon)
  'element:muscles-torse:back', // Musculature marquée
  'element:muscles-torse:profile', // Musculature marquée
  'element:museau-chien:back', // Tête de chien
  'element:museau-chien:profile', // Tête de chien
  'element:nuage-de-mouches:back', // Nuage de mouches
  'element:nuage-de-mouches:profile', // Nuage de mouches
  'element:oeil-pedoncule:back', // Œil pédonculé
  'element:oeil-pedoncule:profile', // Œil pédonculé
  'element:oeil-unique:back', // Œil unique
  'element:oeil-unique:profile', // Œil unique
  'element:pattes-d-oiseau:back', // Pattes d’oiseau
  'element:pattes-d-oiseau:profile', // Pattes d’oiseau
  'element:pattes-danimaux:back', // Pattes d’animaux
  'element:pattes-danimaux:profile', // Pattes d’animaux
  'element:peau-ardente:back', // Peau ardente
  'element:peau-ardente:profile', // Peau ardente
  'element:peau-brillante:back', // Peau brillante
  'element:peau-brillante:profile', // Peau brillante
  'element:peau-herissee-de-pointes:back', // Peau hérissée de pointes
  'element:peau-herissee-de-pointes:profile', // Peau hérissée de pointes
  'element:pelage-massif:back', // Pelage massif
  'element:pelage-massif:profile', // Pelage massif
  'element:pelage:back', // Pelage
  'element:pelage:profile', // Pelage
  'element:pieds-palmes:back', // Pieds palmés
  'element:pieds-palmes:profile', // Pieds palmés
  'element:plaie:back', // Plaie ouverte
  'element:plaie:profile', // Plaie ouverte
  'element:plumage:back', // Peau de plumes
  'element:plumage:profile', // Peau de plumes
  'element:plumes-eparses:back', // Plumes éparses
  'element:plumes-eparses:profile', // Plumes éparses
  'element:sans-tete:back', // Sans tête
  'element:sans-tete:profile', // Sans tête
  'element:suintement-de-pus:back', // Suintement de pus
  'element:suintement-de-pus:profile', // Suintement de pus
  'element:tentacule-epais:back', // Tentacule épais
  'element:tentacule-epais:profile', // Tentacule épais
  'element:tete-bestiale-aigle:back', // Tête bestiale (Aigle)
  'element:tete-bestiale-aigle:profile', // Tête bestiale (Aigle)
  'element:tete-bestiale-araignee-geante:back', // Tête bestiale (Araignée géante)
  'element:tete-bestiale-araignee-geante:profile', // Tête bestiale (Araignée géante)
  'element:tete-bestiale-chevre:back', // Tête bestiale (Chèvre)
  'element:tete-bestiale-chevre:profile', // Tête bestiale (Chèvre)
  'element:tete-bestiale-ours:back', // Tête bestiale (Ours)
  'element:tete-bestiale-ours:profile', // Tête bestiale (Ours)
  'element:tete-bestiale-rat:back', // Tête bestiale (Rat)
  'element:tete-bestiale-rat:profile', // Tête bestiale (Rat)
  'element:tete-bestiale-sanglier:back', // Tête bestiale (Sanglier)
  'element:tete-bestiale-sanglier:profile', // Tête bestiale (Sanglier)
  'element:tete-bestiale-serpent:back', // Tête bestiale (Serpent)
  'element:tete-bestiale-serpent:profile', // Tête bestiale (Serpent)
  'element:tete-de-mort:back', // Tête de mort
  'element:tete-de-mort:profile', // Tête de mort
  'element:trois-yeux:back', // Trois yeux
  'element:trois-yeux:profile', // Trois yeux
  'element:verrues:back', // Verrues
  'element:verrues:profile', // Verrues
  'element:visage-difforme:back', // Visage difforme
  'element:visage-difforme:profile', // Visage difforme
  'element:visage-sans-traits:back', // Visage sans traits
  'element:visage-sans-traits:profile', // Visage sans traits
])

/** @type {ReadonlySet<string>} */
export const RIG_VIEW_ALIAS_RATCHET = new Set([
  'element:cornes-demon:back', // Cornes de démon
  'element:cornes-taureau:back', // Cornes de taureau
  'element:queue-rat:back', // Queue de rat
  'element:queue:back', // Queue
])

/** @type {ReadonlySet<string>} */
export const RIG_VIEW_TRANSFORM_RATCHET = new Set([

])
