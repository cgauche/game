// STOCK CLIQUETÉ du FORMAT DE PART du rig (#551) — consommé par
// `src/gameIso/rig/parts/tenues/part-view-format.test.ts`. Patron whitelist-en-lib du dépôt
// (`folioRatchetStock.mjs`, `rollSeamWhitelist.mjs`).
//
// FORMAT : un slot de CORPS se fournit en TROIS vues `{front, profile, back}`.
// Le discriminant est celui du PIPELINE lui-même (`hasProfileView`/`hasBackView`, `parts/resolve.ts`) —
// la garde l'importe, elle n'en réplique pas la définition.
//
// PÉRIMÈTRE : les DEUX registres qui alimentent les slots de corps de `resolveParts` — les TENUES
// (clé `<tenueId>:<slot>`) et les ARMURES (clé `armure:<materiau>:<slot>`). L'armure PRIME sur la
// tenue (`resolve.ts`, `armed ?? tenuePart`) : hors périmètre, elle laissait le format vert sur une
// tenue conforme pendant qu'un personnage en plaque recevait un bras de face plaqué.
//
// --- PART_VIEW_RATCHET : slots fournis en `string` FRONT-ONLY ---
// Corps du Set GÉNÉRÉ par `npx tsx scripts/rig/regen-part-view-stock.mts` (DÉCROISSANT-SEULEMENT :
// il refuse d'écrire un stock plus grand). Toute prose posée ENTRE les clés est mangée à la
// régénération — l'explication vit dans cet en-tête. Le générateur rabaisse aussi `MAX_FORMAT`.
// Le commentaire de fin de ligne porte le dégât MESURÉ par `resolveParts` (le chemin réel), pas supposé.
// Deux mécanismes distincts, selon le slot :
//   - `bras` (78 clés) : `resolve.ts` ne substitue RIEN sur ce slot — `pickView` retombe sur `front`,
//     donc l'art de FACE est servi VERBATIM de profil et de dos (« FRONT PLAQUE »).
//   - `torse`/`jambes`/`tete` (89 clés) : `resolve.ts` invente une silhouette générique
//     (`PROFILE_TORSE`/`BACK_JAMBE`…) teintée par `dominantCloth` — l'art de la tenue est IGNORÉ.
//
// --- PART_VIEW_ALIAS_RATCHET : vues DÉCLARÉES mais ALIASÉES sur le front ---
// Une vue dont le DESSIN est celui du front satisfait le format tout en produisant EXACTEMENT le
// défaut que le format vise à tuer (art de face plaqué). Sans ce second cliquet, la vague d'art
// solderait le stock ci-dessus en aliasant — garde verte, rendu inchangé. Clé `<porteur>:<slot>:<vue>`.
// La comparaison porte sur la GÉOMÉTRIE (`geometry`, dans la garde), pas sur la chaîne servie : une
// égalité de chaînes se contourne par un espace, un commentaire ou un `<g>` inerte, et rate le front
// simplement RECOLORÉ (cf. `nonne:jambes:back`, trouvé par le passage à la géométrie).
//
// CLIQUET, pas absolution : la garde échoue (a) sur toute violation ABSENTE de ces listes — une
// tenue neuve fournit ses 3 vues ; (b) sur toute clé qui ne viole PLUS ; (c) si la TAILLE d'un stock
// dépasse son plafond — `MAX_FORMAT`/`MAX_ALIAS`, gelés dans la GARDE (`part-view-format.test.ts`)
// et non ici : un stock qui porte son propre plafond le relève d'une ligne. Un slot se solde en
// DESSINANT la vue puis en BAISSANT le plafond, jamais en allongeant la liste.
//
// Ampleur à la pose (2026-07-17) : 171 slots front-only / 426 fournis (40,1 %) sur 121 porteurs
// (117 tenues + 4 armures). Tenues : 167/410 (40,7 %) ; 93 des 117 defs (79,5 %) portent au moins un
// slot au stock — bras 78/101 (77,2 %), jambes 72/117 (61,5 %), torse 13/117 (11,1 %), tete 4/75
// (5,3 %). Armures : 4/16 — les 4 matériaux (cuir/maille/plaque/rembourre) servent leurs 3 vues sur
// tete/torse/jambes et sont front-only sur le SEUL slot `bras`. Ces 171 slots sont TOUS des strings
// pures : aucun def ne fournit une vue partielle (profil sans dos ou l'inverse) — population bimodale.
// Clé = `<id de tenue>:<slot>` (id STABLE `slugId(def.name)`, jamais le libellé) ou
// `armure:<materiau>:<slot>` ; le libellé est en commentaire.

/** @type {ReadonlySet<string>} */
export const PART_VIEW_RATCHET = new Set([
  'apothicaire:jambes', // Apothicaire — manque profile+back ; servi : silhouette generique
  'artiste:jambes', // Artiste — manque profile+back ; servi : silhouette generique
  'bailli:jambes', // Bailli — manque profile+back ; servi : silhouette generique
  'boucher-ogre:bras', // Boucher Ogre — manque profile+back ; servi : FRONT PLAQUE
  'cavalier:jambes', // Cavalier — manque profile+back ; servi : silhouette generique
  'chamane-bray:jambes', // Chamane-Bray — manque profile+back ; servi : silhouette generique
  'charlatan:jambes', // Charlatan — manque profile+back ; servi : silhouette generique
  'chasseur-de-primes:jambes', // Chasseur de primes — manque profile+back ; servi : silhouette generique
  'chasseur:jambes', // Chasseur — manque profile+back ; servi : silhouette generique
  'chevalier:jambes', // Chevalier — manque profile+back ; servi : silhouette generique
  'chevaucheur-de-blaireau:bras', // Chevaucheur de blaireau — manque profile+back ; servi : FRONT PLAQUE
  'citadins:jambes', // Citadins — manque profile+back ; servi : silhouette generique
  'citadins:torse', // Citadins — manque profile+back ; servi : silhouette generique
  'cocher:jambes', // Cocher — manque profile+back ; servi : silhouette generique
  'colporteur:jambes', // Colporteur — manque profile+back ; servi : silhouette generique
  'conseiller:jambes', // Conseiller — manque profile+back ; servi : silhouette generique
  'contrebandier:jambes', // Contrebandier — manque profile+back ; servi : silhouette generique
  'coureur-d-egout:jambes', // Coureur d'égout — manque profile+back ; servi : silhouette generique
  'coureur-d-egout:tete', // Coureur d'égout — manque profile+back ; servi : silhouette generique
  'coureur-d-egout:torse', // Coureur d'égout — manque profile+back ; servi : silhouette generique
  'courtisans:jambes', // Courtisans — manque profile+back ; servi : silhouette generique
  'courtisans:torse', // Courtisans — manque profile+back ; servi : silhouette generique
  'debardeur:jambes', // Débardeur — manque profile+back ; servi : silhouette generique
  'demonette:jambes', // Démonette — manque profile+back ; servi : silhouette generique
  'duelliste:jambes', // Duelliste — manque profile+back ; servi : silhouette generique
  'eclaireur:jambes', // Éclaireur — manque profile+back ; servi : silhouette generique
  'emissaire:jambes', // Émissaire — manque profile+back ; servi : silhouette generique
  'enqueteur:jambes', // Enquêteur — manque profile+back ; servi : silhouette generique
  'entremetteur:jambes', // Entremetteur — manque profile+back ; servi : silhouette generique
  'erudit:jambes', // Érudit — manque profile+back ; servi : silhouette generique
  'esclave-skaven:jambes', // Esclave skaven — manque profile+back ; servi : silhouette generique
  'esclave-skaven:torse', // Esclave skaven — manque profile+back ; servi : silhouette generique
  'espion:jambes', // Espion — manque profile+back ; servi : silhouette generique
  'femme-du-fleuve:jambes', // Femme du fleuve — manque profile+back ; servi : silhouette generique
  'garde:jambes', // Garde — manque profile+back ; servi : silhouette generique
  'gardien-de-troupeaux-de-rhinox:bras', // Gardien de troupeaux de rhinox — manque profile+back ; servi : FRONT PLAQUE
  'geant:jambes', // Géant — manque profile+back ; servi : silhouette generique
  'gladiateur:jambes', // Gladiateur — manque profile+back ; servi : silhouette generique
  'guerriers:jambes', // Guerriers — manque profile+back ; servi : silhouette generique
  'guerriers:torse', // Guerriers — manque profile+back ; servi : silhouette generique
  'herboriste:jambes', // Herboriste — manque profile+back ; servi : silhouette generique
  'hors-la-loi:jambes', // Hors-la-loi — manque profile+back ; servi : silhouette generique
  'ingenieur:jambes', // Ingénieur — manque profile+back ; servi : silhouette generique
  'intendant:jambes', // Intendant — manque profile+back ; servi : silhouette generique
  'itinerants:jambes', // Itinérants — manque profile+back ; servi : silhouette generique
  'itinerants:torse', // Itinérants — manque profile+back ; servi : silhouette generique
  'juriste:jambes', // Juriste — manque profile+back ; servi : silhouette generique
  'lettres:jambes', // Lettrés — manque profile+back ; servi : silhouette generique
  'lettres:tete', // Lettrés — manque profile+back ; servi : silhouette generique
  'lettres:torse', // Lettrés — manque profile+back ; servi : silhouette generique
  'mangeur-d-hommes:bras', // Mangeur d'hommes — manque profile+back ; servi : FRONT PLAQUE
  'marchand:jambes', // Marchand — manque profile+back ; servi : silhouette generique
  'marin:jambes', // Marin — manque profile+back ; servi : silhouette generique
  'medecin:jambes', // Médecin — manque profile+back ; servi : silhouette generique
  'messager:jambes', // Messager — manque profile+back ; servi : silhouette generique
  'milicien:jambes', // Milicien — manque profile+back ; servi : silhouette generique
  'mineur:jambes', // Mineur — manque profile+back ; servi : silhouette generique
  'mystique:jambes', // Mystique — manque profile+back ; servi : silhouette generique
  'naufrageur:jambes', // Naufrageur — manque profile+back ; servi : silhouette generique
  'nautonier:jambes', // Nautonier — manque profile+back ; servi : silhouette generique
  'nu:jambes', // Nu — manque profile+back ; servi : silhouette generique
  'nu:torse', // Nu — manque profile+back ; servi : silhouette generique
  'ogre:bras', // Ogre — manque profile+back ; servi : FRONT PLAQUE
  'patrouilleur-fluvial:bras', // Patrouilleur fluvial — manque profile+back ; servi : FRONT PLAQUE
  'patrouilleur-fluvial:jambes', // Patrouilleur fluvial — manque profile+back ; servi : silhouette generique
  'patrouilleur-routier:bras', // Patrouilleur routier — manque profile+back ; servi : FRONT PLAQUE
  'patrouilleur-routier:jambes', // Patrouilleur routier — manque profile+back ; servi : silhouette generique
  'pilleur-de-tombes:bras', // Pilleur de tombes — manque profile+back ; servi : FRONT PLAQUE
  'pilleur-de-tombes:jambes', // Pilleur de tombes — manque profile+back ; servi : silhouette generique
  'pretre-guerrier:jambes', // Prêtre guerrier — manque profile+back ; servi : silhouette generique
  'pretre:jambes', // Prêtre — manque profile+back ; servi : silhouette generique
  'prophete-gris:bras', // Prophète gris — manque profile+back ; servi : FRONT PLAQUE
  'prophete-gris:jambes', // Prophète gris — manque profile+back ; servi : silhouette generique
  'prophete-gris:torse', // Prophète gris — manque profile+back ; servi : silhouette generique
  'ranconneur:jambes', // Rançonneur — manque profile+back ; servi : silhouette generique
  'rat-ogre:jambes', // Rat ogre — manque profile+back ; servi : silhouette generique
  'ratier:bras', // Ratier — manque profile+back ; servi : FRONT PLAQUE
  'ratier:jambes', // Ratier — manque profile+back ; servi : silhouette generique
  'receleur:jambes', // Receleur — manque profile+back ; servi : silhouette generique
  'repurgateur:jambes', // Répurgateur — manque profile+back ; servi : silhouette generique
  'riverains:jambes', // Riverains — manque profile+back ; servi : silhouette generique
  'riverains:torse', // Riverains — manque profile+back ; servi : silhouette generique
  'rodeur-fantome:bras', // Rôdeur fantôme — manque profile+back ; servi : FRONT PLAQUE
  'roublards:jambes', // Roublards — manque profile+back ; servi : silhouette generique
  'roublards:torse', // Roublards — manque profile+back ; servi : silhouette generique
  'ruraux:jambes', // Ruraux — manque profile+back ; servi : silhouette generique
  'ruraux:torse', // Ruraux — manque profile+back ; servi : silhouette generique
  'saltimbanque:jambes', // Saltimbanque — manque profile+back ; servi : silhouette generique
  'sanguinaire:jambes', // Sanguinaire — manque profile+back ; servi : silhouette generique
  'serviteur:jambes', // Serviteur — manque profile+back ; servi : silhouette generique
  'sorcier-de-village:jambes', // Sorcier de village — manque profile+back ; servi : silhouette generique
  'sorcier-dissident:jambes', // Sorcier dissident — manque profile+back ; servi : silhouette generique
  'spadassin:jambes', // Spadassin — manque profile+back ; servi : silhouette generique
  'tueur:jambes', // Tueur — manque profile+back ; servi : silhouette generique
  'vermine-de-choc:bras', // Vermine de choc — manque profile+back ; servi : FRONT PLAQUE
  'vermine-de-choc:jambes', // Vermine de choc — manque profile+back ; servi : silhouette generique
  'vermine-de-choc:tete', // Vermine de choc — manque profile+back ; servi : silhouette generique
  'vermine-de-choc:torse', // Vermine de choc — manque profile+back ; servi : silhouette generique
  'villageois:jambes', // Villageois — manque profile+back ; servi : silhouette generique
  'armure:cuir:bras', // Cuir — manque profile+back ; servi : FRONT PLAQUE
  'armure:maille:bras', // Maille — manque profile+back ; servi : FRONT PLAQUE
  'armure:plaque:bras', // Plaque — manque profile+back ; servi : FRONT PLAQUE
  'armure:rembourre:bras', // Rembourre — manque profile+back ; servi : FRONT PLAQUE
])

/** @type {ReadonlySet<string>} */
export const PART_VIEW_ALIAS_RATCHET = new Set([
  // L'ogre a reçu ses 3 vues de jambe au fix des jambes olive (`394f2b29`, #538) : le MÊME fragment
  // `JAMBE` est servi aux 3 vues. La chair cesse d'être olive (le défaut visé est bien mort), mais le
  // profil garde la largeur et la lanière de la vue de face — genou et botte de côté restent à dessiner.
  'ogre:jambes:profile', // Ogre
  'ogre:jambes:back', // Ogre
  // Le dos de la Nonne est son art de FACE au trait près, repeint `@cuir` -> `@cuirO` (assombri) :
  // géométrie identique (paths byte-pour-byte), seul le remplissage change. La comparaison de
  // CHAÎNES le tenait pour un vrai dos ; la géométrie le voit. Genou/talon de dos restent à dessiner.
  'nonne:jambes:back', // Nonne
])
