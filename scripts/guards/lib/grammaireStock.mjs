// STOCK NOMINATIF DATÉ (2026-08-25) des sites qui RE-TAPENT une forme de la grammaire, ou qui
// ÉTENDENT une de ses portes — le dénominateur de la garde `src/data/grammaire-guard.test.ts`
// (#1466 L1a). Patron whitelist-en-lib du dépôt (`tableConsumerStock.mjs`, `paletteLiteralStock.mjs`).
//
// Clé = `<fichier>:<symbole>[.<champ>]|<motif>|<detail>` — jamais un numéro de ligne : une ligne
// bouge à chaque édition du module et ferait rougir la garde sans qu'aucune forme n'ait changé
// (même raison qu'en tête de `STRUCTURES_REDECLARATIONS`). Les trois motifs :
//   - `redeclaration` : le jeu de clés du littéral EST la signature d'un schéma de la grammaire ;
//   - `alias`         : le littéral porte une GRAPHIE HISTORIQUE de référence (`skillId`, `ref`…) ;
//   - `extend`        : `.extend(` posé sur une porte de la grammaire (zod 4.4.3 y perd registre
//                       et `.meta()`, cf. en-tête de `grammaire/ref.ts`).
//
// ANGLE MORT INVERSE (la garde est plus STRICTE que son en-tête ne le dit) : le `MODULES_GRAMMAIRE`
// de `grammaireGuard.mjs` compte `defs-scenes` comme un module DE GRAMMAIRE — un `.extend` dont le
// récepteur vient de `defs-scenes` serait donc relevé comme extension de porte, alors que
// `defs-scenes` n'est pas la grammaire. ZÉRO site aujourd'hui (aucune entrée `extend` du stock n'en
// vient) : la sur-stricture est INERTE, elle est déclarée ici pour n'être pas découverte au premier
// `.extend` posé dans `defs-scenes`.
//
// COMMENT UNE LIGNE SE SOLDE — jamais en la retirant seule : le site ADOPTE la forme de la
// grammaire (`ref(type)`, `specRef(type)`, `diceSpecSchema`, `cell2Schema`…) dans le LOT porté par
// la ligne, la garde rougit alors sur « entrée sans site », et la ligne part dans le MÊME commit.
// Le contrat est BIDIRECTIONNEL : un site hors stock = rouge (dérive neuve) ; une entrée sans site
// = rouge (entrée périmée). Ce stock ne fait que DÉCROÎTRE.
//
// Les LOTS reprennent ceux du dénominateur L0 (`structuresStock.mjs`, `STRUCTURES_REDECLARATIONS`)
// quand le site y correspond : concept Compétence → `L2 #1463`, Talent/Objet/Créature/Véhicule →
// `L3 #1463`, valeurs (dé, monnaie, cellule) → `L4 #1463`, source → `L1d #1469`, formes possédées
// par la grammaire elle-même → `L1a #1466`.

/** Graphie historique de référence à une COMPÉTENCE (`skill`/`skillId` + `spec`) — meurt quand le
 *  site adopte `specRef('skill')`. */
const L2 = 'L2 #1463';
/** Référence à une entité NOMMÉE autrement (Talent, Trait, Objet, Créature, Véhicule) — meurt quand
 *  le site adopte `ref(type)`/`specRef(type)`. */
const L3 = 'L3 #1463';
/** Forme de VALEUR re-tapée (dé, monnaie, cellule de grille) — meurt quand le site compose le
 *  schéma de `grammaire/valeurs.ts`. */
const L4 = 'L4 #1463';
/** Forme POSSÉDÉE par la grammaire (Formula, apparence d'entité, porte étendue) — lot courant. */
const L1a = 'L1a #1466';
/** Concept SOURCE (`{book, page}` et ses dérivés) — chantier des réfs de source. */
const L1d = 'L1d #1469';
const DATE = '2026-08-25';

/** @param {string} raison @param {string} lot */
const e = (raison, lot) => ({ raison, lot, date: DATE });

export const GRAMMAIRE_STOCK = {
  // ── Graphies historiques de COMPÉTENCE (`skill`, `skillId`) ──────────────────────────────────
  'src/data/schemas/defs/aa-criticals.ts:aaEntrySchema.resist|alias|skill': e('Test de résistance d’une blessure critique authoré par LIBELLÉ de Compétence sous `skill`.', L2),
  'src/data/schemas/defs/activities.ts:skillRefSchema|alias|skillId': e('Réf de Compétence d’une Activité en `{skillId, spec}` — la graphie que `specRef(\'skill\')` remplace.', L2),
  // #1467 L1b V-FLIP-ENTITE-b : la ligne REVIT sous le binding `doc` — l'adoption de `document()`
  // l'avait fait sortir du scan (l'argument `champs` n'était pas visité), pas de la déclaration.
  // Le champ `skill` est toujours là, la donnée n'a pas bougé.
  'src/data/schemas/defs/advancementCosts.ts:doc|alias|skill': e('Table des coûts d’avancement keyée par colonne `skill` (Compétence vs Caractéristique).', L2),
  'src/data/schemas/defs/axes.ts:skillRefSchema|alias|skillId': e('Réf de Compétence d’un axe de profil en `{skillId, spec}` (`STRUCTURES_REDECLARATIONS` axes.ts, même lot).', L2),
  'src/data/schemas/defs/creatures.ts:swapGrantSchema|alias|skillId': e('Échange de dotation de bestiaire désignant sa Compétence par `skillId`.', L2),
  'src/data/schemas/defs/crew-roles.ts:doc.skills|alias|skillId': e('Compétences d’un rôle d’équipage en `{skillId, spec}` (`STRUCTURES_REDECLARATIONS` crew-roles.ts, même lot).', L2),
  'src/data/schemas/defs/etats.ts:recoverSchema|alias|skill': e('Test de récupération d’un État désignant sa Compétence par `skill`.', L2),
  'src/data/schemas/defs/miscast.ts:jsonOpSchema|alias|skill': e('Op de maléfice portant un test par `skill` (le champ moteur `TestSpec.skill`, non migré).', L2),
  'src/data/schemas/defs/miscast.ts:jsonNestedTestSchema|alias|skill': e('Test IMBRIQUÉ d’un maléfice, même graphie `skill` que l’op porteuse.', L2),
  'src/data/schemas/defs/psychology.ts:schema.test|alias|skill': e('Test de Psychologie désignant sa Compétence par `skill` (`STRUCTURES_REDECLARATIONS` psychology.ts).', L2),
  'src/data/schemas/defs/sea-cargo.ts:doc.opportunite.test|alias|skillId': e('Test d’opportunité de cargaison maritime en `{skillId, …}` (`STRUCTURES_REDECLARATIONS` sea-cargo.ts).', L2),
  'src/data/schemas/defs/sea-perils.ts:seaHazardDef.freeTest|alias|skillId': e('Test gratuit d’un péril maritime en `{skillId, …}` (`STRUCTURES_REDECLARATIONS` sea-perils.ts).', L2),
  'src/data/schemas/defs/sea-perils.ts:champs.tourbillonSwim|alias|skillId': e('Test de Natation du tourbillon en `{skillId, …}` (`STRUCTURES_REDECLARATIONS` sea-perils.ts).', L2),
  'src/data/schemas/defs/spells.ts:spellEntrySchema.opposed|alias|skill': e('Jet OPPOSÉ d’un sort désignant les deux Compétences par `skill`.', L2),
  'src/data/schemas/defs/steam-breakdown.ts:doc.restart|alias|skillId': e('Test de redémarrage d’une machine à vapeur en `{skillId, …}` (`STRUCTURES_REDECLARATIONS` steam-breakdown.ts).', L2),
  'src/data/schemas/defs/talents.ts:testMatchSchema|alias|skill': e('Filtre de test d’un Talent (à quel jet il s’applique) désignant la Compétence par `skill`.', L2),
  'src/data/schemas/defs/tavernGames.ts:schema|alias|skill': e('Jeu de taverne : Compétence du jeu par `skill` (`STRUCTURES_REDECLARATIONS` tavernGames.ts, champ `options`).', L2),
  'src/data/schemas/defs/tavernGames.ts:schema.fastSkill|alias|skill': e('Variante RAPIDE d’un jeu de taverne, même graphie `skill`.', L2),
  'src/data/schemas/defs/tavernGames.ts:schema.options|alias|skill': e('Options de jeu de taverne, même graphie `skill`.', L2),
  'src/data/schemas/defs/tavernGames.ts:schema.combined.second|alias|skill': e('Second volet d’un test COMBINÉ de jeu de taverne, même graphie `skill`.', L2),
  'src/data/schemas/defs/tavernGames.ts:schema.throwerPenalty.test|alias|skill': e('Malus du lanceur d’un jeu de taverne, même graphie `skill`.', L2),
  'src/data/schemas/defs/water-exposure.ts:doc.test|alias|skillId': e('Test d’exposition à l’eau en `{difficulty, skillId}` (`STRUCTURES_REDECLARATIONS` water-exposure.ts).', L2),
  'src/data/schemas/defs-scenes/effets.ts:pursuitFoeSchema|alias|skill': e('Poursuivant d’une Poursuite désignant sa Compétence de course par `skill`.', L2),
  'src/data/schemas/defs-scenes/effets.ts:extendedTestSchema|alias|skill': e('Effet `extendedTest` (test étendu de scène) désignant sa Compétence par `skill`.', L2),
  'src/data/schemas/defs-scenes/effets.ts:medicalAidSchema|alias|skill': e('Effet `medicalAid` (Soins) désignant sa Compétence par `skill`.', L2),
  'src/data/schemas/defs-scenes/effets.ts:corruptionExposureSchema|alias|skill': e('Effet `corruptionExposure` désignant la Compétence du jet de résistance par `skill`.', L2),
  'src/data/schemas/defs-scenes/effets.ts:startPursuitSchema|alias|skill': e('Effet `startPursuit` désignant la Compétence de course par `skill`.', L2),
  'src/data/schemas/defs-scenes/scene.ts:skillRefSchema|redeclaration|qualityRefSchema|trappingRefSchema {id,spec,value}': e('Réf de Compétence de scène re-tapée `{id, spec, value}` — la signature de `qualityRefSchema`, pour un tout autre concept.', L2),

  // ── Graphies historiques de RÉFÉRENCE à une autre entité (`ref`, `talentId`, `trappingId`) ────
  'src/data/schemas/defs/axes.ts:talentRefSchema|alias|talentId': e('Réf de Talent d’un axe de profil en `{talentId, spec}`.', L3),
  'src/data/schemas/defs/reglesOptionnelles.ts:doc|alias|ref': e('Règle optionnelle désignant l’entité concernée par une enveloppe `ref`.', L3),
  'src/data/schemas/defs/river-perils.ts:doc.perils|alias|ref': e('Péril fluvial désignant son entité (créature/structure) par une enveloppe `ref`.', L3),
  'src/data/schemas/defs/traumas.ts:rigSchema.byProsthesis|alias|trappingId': e('Rig de trauma keyé par `trappingId` (prothèse) — graphie d’objet de catalogue.', L3),
  'src/data/schemas/defs/traumas.ts:doc.prosthesis|alias|trappingId': e('Prothèse d’un trauma désignée par `trappingId`.', L3),
  'src/data/schemas/defs-scenes/effets.ts:giveTrappingSchema|alias|trappingId': e('Effet `giveTrapping` désignant l’objet donné par `trappingId` (migration de LIBELLÉ soldée en T3-b, la graphie reste).', L3),
  'src/data/schemas/defs-scenes/effets.ts:givePossessionSchema|alias|ref': e('Effet `givePossession` désignant la possession par une enveloppe `ref`.', L3),
  'src/data/schemas/defs-scenes/scene.ts:sceneEntitySchema|alias|ref': e('Entité de scène désignant son modèle (créature/prop) par une enveloppe `ref`.', L3),
  'src/data/schemas/defs-scenes/worldmap.ts:portProfileSchema|alias|ref': e('Profil de port désignant son entité par une enveloppe `ref`.', L3),
  'src/data/schemas/defs/creatures.ts:skillRefSchema|redeclaration|qualityRefSchema|trappingRefSchema {id,spec,value}': e('Réf de bestiaire re-tapée `{id, spec, value}` (`STRUCTURES_REDECLARATIONS` creatures.ts, signature `id,spec,value`).', L3),
  'src/data/schemas/defs/trappings.ts:qualityRefSchema|redeclaration|qualityRefSchema|trappingRefSchema {id,spec,value}': e('`qualityRefSchema` re-déclaré localement dans le catalogue des dotations — la vue commune vit dans `grammaire/reference.ts`.', L3),
  'src/data/schemas/defs/domains.ts:doc.windModifiers.cancelledBy.requiresSkill|redeclaration|advancementRefSchema|refSchema {id,spec}': e('Réf `{id, spec}` re-tapée sous `requiresSkill` (`STRUCTURES_REDECLARATIONS` domains.ts, statut `cible`, commun `refSchema`).', L3),

  // ── Formes de VALEUR re-tapées (monnaie, dé, cellule de grille) ───────────────────────────────
  'src/data/schemas/defs/creatures.ts:moneySchema|alias|bronze': e('Monnaie `{gold, silver, bronze}` re-tapée dans le bestiaire (`STRUCTURES_REDECLARATIONS` creatures.ts, concept monnaie).', L4),
  'src/data/schemas/defs/crew-roles.ts:money|alias|bronze': e('Monnaie re-tapée pour la solde d’équipage (`STRUCTURES_REDECLARATIONS` crew-roles.ts).', L4),
  'src/data/schemas/defs/trappings.ts:moneySchema|alias|bronze': e('Monnaie re-tapée dans le catalogue des dotations (`STRUCTURES_REDECLARATIONS` trappings.ts).', L4),
  'src/data/schemas/defs/vehicles.ts:moneySchema|alias|bronze': e('Monnaie re-tapée dans le catalogue des véhicules (`STRUCTURES_REDECLARATIONS` vehicles.ts).', L4),
  'src/data/schemas/defs/maladies.ts:diceSpecSchema|redeclaration|countSpecSchema|diceSpecSchema|formulaSchema|trappingRefSchema {n,plus,sides}': e('`diceSpecSchema` re-déclaré localement (`STRUCTURES_REDECLARATIONS` maladies.ts, statut `cible`, commun `diceSpecSchema`).', L4),
  'src/data/schemas/defs/miscast.ts:engineFormulaSchema.dice|redeclaration|countSpecSchema|diceSpecSchema|formulaSchema|trappingRefSchema {n,plus,sides}': e('Dé d’une Formula de maléfice re-tapé (`STRUCTURES_REDECLARATIONS` miscast.ts champ `dice`, commun `diceSpecSchema`).', L4),
  'src/data/schemas/defs-scenes/effets.ts:zoneBlastSchema.center|redeclaration|cell2Schema {x,y}': e('Centre d’une zone d’effet re-tapé `{x, y}` — la cellule de grille est `cell2Schema`.', L4),
  'src/data/schemas/defs-scenes/scene.ts:sceneEntitySchema.pos|redeclaration|cell2Schema {x,y}': e('Position d’une entité de scène re-tapée `{x, y}`.', L4),
  'src/data/schemas/defs-scenes/worldmap.ts:placePoiSchema.pos|redeclaration|cell2Schema {x,y}': e('Position d’un point d’intérêt : point CONTINU PLAN-LOCAL 0-100 (worldmap.ts:84), forme propre au worldMap — PAS une cell2 (la cellule de grille est un indice DISCRET). À REQUALIFIER au lot L4 valeurs : « composer `cell2Schema` » y serait sémantiquement FAUX, il faut une forme de point normalisé à la grammaire.', L4),
  'src/data/schemas/defs-scenes/worldmap.ts:mapPlaceSchema.pos|redeclaration|cell2Schema {x,y}': e('Position d’un lieu de la carte du monde : point en % du CANEVAS, forme propre au worldMap — PAS une cell2. MÊME requalification que `placePoiSchema.pos` au lot L4 valeurs.', L4),

  // ── Formes POSSÉDÉES par la grammaire, re-tapées ou étendues ─────────────────────────────────
  'src/data/schemas/defs/miscast.ts:engineFormulaSchema.times|redeclaration|formulaSchema {factor,of}': e('Produit `{of, factor}` d’une Formula re-tapé (`STRUCTURES_REDECLARATIONS` miscast.ts champ `times`, commun `formulaSchema`).', L1a),
  'src/data/schemas/defs/raceAppearance.ts:schema.parts|redeclaration|entityAppearanceSchema {cheveux,visage}': e('`parts` d’apparence re-tapé (`STRUCTURES_REDECLARATIONS` raceAppearance.ts, commun `entityAppearanceSchema`).', L1a),
  'src/data/schemas/defs/raceAppearance.ts:schema.eyes|redeclaration|entityAppearanceSchema {D,G}': e('`eyes` d’apparence re-tapé (`STRUCTURES_REDECLARATIONS` raceAppearance.ts, commun `entityAppearanceSchema`).', L1a),
  'src/data/schemas/grammaire/reference.ts:trappingRefSchema|extend|refSchema.extend(…)': e('Branche `{id, spec, count, qualities, qualityChoice}` de `TrappingRef` construite en ÉTENDANT `refSchema` — meurt avec l’adoption de `ref(\'trapping\')` par les dotations.', L3),
  'src/data/schemas/grammaire/valeurs.ts:secondarySourceRefSchema|extend|sourceRefSchema.extend(…)': e('Réf de source SECONDAIRE construite en ÉTENDANT `sourceRefSchema` — meurt avec la refonte du concept source.', L1d),
};
