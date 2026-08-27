// Stock NOMINATIF DATÉ des sites de la famille (e) du garde-fou commentaires — #1486, credo règle 1.
// Mécanique du scan : `scanLegacyVocab` (`scripts/guards/lib/commentPoison.mjs`) ; verdict et cliquet :
// `src/comment-poison-guard.test.ts`. Ici ne vit QUE la donnée.
//
// Un site se nomme par FICHIER + ANCRE de texte + MOTIF (jamais un numéro de ligne, qui dérive au
// premier commit voisin) : un commentaire qui porte DEUX motifs compte pour DEUX lignes, et falsifier
// le motif d'une ligne la fait sortir du stock. `lot` = le chantier qui l'éteint, pris dans l'ensemble
// FERMÉ des lots de #1486 (validé par le test) ; `date` = la mesure d'origine. Contrat BIDIRECTIONNEL
// tenu par le test : un site du dépôt absent d'ici est ROUGE, une entrée d'ici qui ne matche plus rien
// est ROUGE (elle se purge). Cette liste DÉCROÎT jusqu'à 0 : chaque lot part avec ses lignes, aucune
// ligne ne s'y ajoute (un site neuf se corrige au geste).
//
// Mesuré le 2026-08-23 sur `src/**` + `scripts/**` (`.ts`, `.tsx`, `.mts`, `.mjs`, hors tests).

/**
 * @typedef {{ fichier: string, motif: string, ancre: string, lot: string, date: string }} SiteVocab
 */

/** @type {SiteVocab[]} */
export const LEGACY_VOCAB_SITES = [
  {
    fichier: "scripts/data/html-to-md.mjs",
    motif: "legacy",
    ancre: "(`src/data/*.json`) qui contient encore du HTML (legacy : `<br><br>`, `<b>`, `<i>`, `<ul><li>`…).",
    lot: "L1b #1467",
    date: "2026-08-23",
  },
  {
    fichier: "scripts/data/html-to-md.mjs",
    motif: "legacy",
    ancre: "// `<br>` legacy = séparateur de paragraphe (turndown collapse les `\\n` adjacents → un `<br>` simple",
    lot: "L1b #1467",
    date: "2026-08-23",
  },
  {
    fichier: "scripts/guards/lib/gameOpRefFk.mjs",
    motif: "legacy",
    ancre: "- `{ registry, legacy: N }` — référence dure assortie d'un CLIQUET : `N` valeurs ne résolvent pas",
    lot: "L1c #1468 / #1473",
    date: "2026-08-23",
  },
  {
    fichier: "src/engine/ops.ts",
    motif: "rétro-compat",
    ancre: "jamais forcé), borné à `overcastDurationSteps`. Absent = tous les pas alloués (défaut, IA/rétrocompat). */",
    lot: "L1c #1468",
    date: "2026-08-23",
  },
  {
    fichier: "src/engine/provisions.ts",
    motif: "rétro-compat",
    ancre: "de cale (le port avitaille les deux). Absent = seuls les héros comptent (rétro-compat). */",
    lot: "L4",
    date: "2026-08-23",
  },
  {
    fichier: "src/engine/trauma.ts",
    motif: "legacy",
    ancre: "Omis (tests/legacy) ⇒ pas de décompte (séquelle permanente jusqu'à traitement explicite). */",
    lot: "L5",
    date: "2026-08-23",
  },
  {
    fichier: "src/engine/trauma.ts",
    motif: "obsolète",
    ancre: "obsolète, elle, est refusée à la lecture) — sortirait sinon de la somme additive pour le pool",
    lot: "L5",
    date: "2026-08-23",
  },
  {
    fichier: "src/engine/types.ts",
    motif: "legacy",
    ancre: "à 0 le trauma (et ses pénalités) disparaît. Absent = trauma legacy/permanent (pas de décompte). */",
    lot: "L5",
    date: "2026-08-23",
  },
  {
    fichier: "src/gameIso/builders/types.ts",
    motif: "legacy",
    ancre: "/** Relations stables d'une façade architecturale authorée. Absentes sur les murs legacy. */",
    lot: "L1b #1467",
    date: "2026-08-23",
  },
  {
    fichier: "src/gameIso/rig/bodyPlan.ts",
    motif: "legacy",
    ancre: "déclare son `id`). Le monolithique n'est PAS un BodyPlan (fallback legacy hors registre). */",
    lot: "chantier rig",
    date: "2026-08-23",
  },
  {
    fichier: "src/gameIso/rig/parts/derive.ts",
    motif: "shim",
    ancre: "tenue sans art dédié. Un def qui déclare ses vraies vues les garde (le shim ne dérive que l'absent).",
    lot: "chantier rig",
    date: "2026-08-23",
  },
  {
    fichier: "src/gameIso/rig/parts/derive.ts",
    motif: "shim",
    ancre: "FRONT (cf. `dominantCloth`). Une tenue qui fournit `profile` prime (le shim ne dérive que l'absent).",
    lot: "chantier rig",
    date: "2026-08-23",
  },
  {
    fichier: "src/gameIso/rig/parts/derive.ts",
    motif: "legacy",
    ancre: "matérialisé dans un def qui déclare ses vues, appelé par le shim `toViewSet` pour l'art legacy. */",
    lot: "chantier rig",
    date: "2026-08-23",
  },
  {
    fichier: "src/gameIso/rig/parts/derive.ts",
    motif: "shim",
    ancre: "matérialisé dans un def qui déclare ses vues, appelé par le shim `toViewSet` pour l'art legacy. */",
    lot: "chantier rig",
    date: "2026-08-23",
  },
  {
    fichier: "src/gameIso/rig/parts/derive.ts",
    motif: "legacy",
    ancre: "`PartArt` legacy (string front-only, ou objet à vues partielles). `toViewSet` l'enrobe en `ViewSet`",
    lot: "chantier rig",
    date: "2026-08-23",
  },
  {
    fichier: "src/gameIso/rig/parts/derive.ts",
    motif: "shim",
    ancre: "// SHIM P1 (retiré P3) : les registres de corps (tenue/armure/générique/override) stockent encore un",
    lot: "chantier rig",
    date: "2026-08-23",
  },
  {
    fichier: "src/gameIso/rig/parts/resolve.ts",
    motif: "legacy",
    ancre: "legacy, ENROBÉ en `ViewSet` TOTAL par le shim `toViewSet` (P1), qui matérialise les vues absentes",
    lot: "chantier rig",
    date: "2026-08-23",
  },
  {
    fichier: "src/gameIso/rig/parts/resolve.ts",
    motif: "shim",
    ancre: "legacy, ENROBÉ en `ViewSet` TOTAL par le shim `toViewSet` (P1), qui matérialise les vues absentes",
    lot: "chantier rig",
    date: "2026-08-23",
  },
  {
    fichier: "src/gameIso/rig/parts/types.ts",
    motif: "shim",
    ancre: "une vue manquante est une erreur de compile). Produit à l'ingestion par le shim `toViewSet`",
    lot: "chantier rig",
    date: "2026-08-23",
  },
  {
    fichier: "src/gameIso/rig/parts/types.ts",
    motif: "shim",
    ancre: "`string` = front-only (le shim `toViewSet` DÉRIVE alors la vue absente). Consommé par la garde de",
    lot: "chantier rig",
    date: "2026-08-23",
  },
  {
    fichier: "src/gameIso/stage/GameStage3D.tsx",
    motif: "déprécié",
    ancre: "// `PCFSoftShadowMap` est DÉPRÉCIÉ depuis three 0.185 : le moteur le remplace lui-même par",
    lot: "lot rendu",
    date: "2026-08-23",
  },
  {
    fichier: "src/state/combatEndBands.ts",
    motif: "legacy",
    ancre: "tient les étapes LEGACY d'une sauvegarde, qui ne portent aucun discriminant d'entrée.",
    lot: "L5",
    date: "2026-08-23",
  },
  {
    fichier: "src/state/combatEndBands.ts",
    motif: "legacy",
    ancre: "Degré d'exposition à la Corruption. Une étape LEGACY (sauvegarde d'avant L4) n'a pas d'`entry` :",
    lot: "L5",
    date: "2026-08-23",
  },
  {
    fichier: "src/state/combatFlow.ts",
    motif: "rétro-compat",
    ancre: "(un fallback id→libellé = rétro-compatibilité, proscrite). Les libellés restent au seul niveau AUTHORING. */",
    lot: "L1c #1468 / #1474",
    date: "2026-08-23",
  },
  {
    fichier: "src/state/combatFlow.ts",
    motif: "rétro-compat",
    ancre: "`target` (optionnel — rétro-compat) sert le combat « au contact » (LDB 62 l.176) : une arme plus longue",
    lot: "#1474",
    date: "2026-08-23",
  },
  {
    fichier: "src/state/combatFlow.ts",
    motif: "rétro-compat",
    ancre: "DÉCLINABLE (l.276 « vous pouvez ») : `chosenTableRolls` (absent = tous les pas, IA/rétrocompat).",
    lot: "L1c #1468",
    date: "2026-08-23",
  },
  {
    fichier: "src/state/projectLibrary.ts",
    motif: "legacy",
    ancre: "de projet, jamais un littéral `schema`/champs dupliqués), mais RELÂCHÉE pour le stock legacy : un",
    lot: "L1b #1467",
    date: "2026-08-23",
  },
  {
    fichier: "src/state/saves.ts",
    motif: "legacy",
    ancre: "SEULE dans le contenu (`SaveGame.version`). `LEGACY_KEY` ne sert plus qu'à NETTOYER les clés",
    lot: "L5",
    date: "2026-08-23",
  },
  {
    fichier: "src/state/saves.ts",
    motif: "ne sert plus qu’à",
    ancre: "SEULE dans le contenu (`SaveGame.version`). `LEGACY_KEY` ne sert plus qu'à NETTOYER les clés",
    lot: "L5",
    date: "2026-08-23",
  },
  {
    fichier: "src/data/schemas/defs-scenes/effets.ts",
    motif: "legacy",
    ancre: "= ½ prix mais nourriture à risque (Courante galopante 10 %, ch.66 l.51). LEGACY : sans",
    lot: "L1b #1467 / L5",
    date: "2026-08-23",
  },
  {
    fichier: "src/state/shipwreck.ts",
    motif: "legacy",
    ancre: "MDG 13 l.674 « corps et biens ») ; sans correspondance, la purge legacy `vessel:null` ci-dessus reste",
    lot: "L1b #1467 / L5",
    date: "2026-08-23",
  },
  {
    fichier: "src/state/store.ts",
    motif: "legacy",
    ancre: "les scènes + re-dérive `campaignNarratif` au chargement d'une save. null = chemin Arène / save legacy. */",
    lot: "L1b #1467 / L5",
    date: "2026-08-23",
  },
  {
    fichier: "src/ui/editor/Editor.tsx",
    motif: "legacy",
    ancre: "/** Identité de campagne (#765/#766) — préservée au round-trip, absente d'un projet legacy sans identité. */",
    lot: "L1b #1467 / L5",
    date: "2026-08-23",
  },
  {
    fichier: "src/ui/HeroSheet.tsx",
    motif: "rétro-compat",
    ancre: "/** Champs de la rubrique `derived` — TOUS par défaut (rétro-compatible). Un appelant qui porte déjà",
    lot: "L6",
    date: "2026-08-23",
  },
  {
    fichier: "src/ui/HeroSheet.tsx",
    motif: "rétro-compat",
    ancre: "/** Rubriques rendues — TOUTES par défaut (rétro-compatible). Un appelant qui porte déjà une partie",
    lot: "L6",
    date: "2026-08-23",
  },
];
