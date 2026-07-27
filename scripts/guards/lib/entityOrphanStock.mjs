// STOCK CLIQUETÉ des entités de catalogue SANS CONSOMMATEUR (« curée, jamais atteinte = dette ») —
// consommé par `src/data/entity-orphans.test.ts`. Patron whitelist-en-lib du dépôt
// (`tableConsumerStock.mjs`, `manualDocsStock.mjs`).
//
// Une entrée de `traits.json`/`talents.json`/`qualities.json`/`maneuvers.json`/`skills.json`/
// `props.json`/`vehicles.json` (périmètre retenu, cf. `scripts/docs/build-entity-orphans.mjs`) dont
// NI un AUTRE `src/data/*.json`, NI le code de prod (`src/**/*.ts(x)` hors tests, hors commentaires,
// citation littérale OU sélection par prédicat de champ — MODE 1/MODE 2, cf. en-tête de
// `entityConsumers.mjs`), NI une entrée `META_CATALOG_ENTRIES` ne couvre — est un ornement : la
// mécanique est juste, aucun chemin ne mène à elle. Mesuré, ce n'est PAS un artefact de repli par
// LABEL (`findTalent(name)?.id ?? slugId(name)`, `findSkill`, `canonTraitId`…) : pour les entrées
// ci-dessous, ni l'id ni le LABEL n'apparaissent ailleurs que dans leur propre déclaration (vérifié à
// la main avant bootstrap, #entity-orphans).
//
// Bootstrap = état MESURÉ au moment de l'ajout de la garde (`node scripts/docs/build-entity-orphans.mjs`),
// 19 entrées. Descendu à 17 (2026-07) : `qualities:laid` est couverte par MODE 2 (sélection par
// prédicat de champ `type`/`subType`, résultat exploité PAR ID — `ui/InterludeScreen.tsx:52-53`) ;
// `talents:talent-aleatoire` par `META_CATALOG_ENTRIES` (entrée MÉTA structurelle, jamais un Talent
// possédable — même source que `src/data/obtainability-guard.test.ts`). `qualities:filet-barbele`/
// `deroutante` restent DUES : `state/interludeFlow.ts:910` (`falseQualities()`) les sélectionne par
// champ mais ne les exploite QUE par LABEL (rumeurs de Particularité fausses, ADE II — jamais la
// qualité elle-même) — MODE 2 les rejette (résultat non exploité par id).
//
// Clé = `catégorie:id` (les ids peuvent collisionner entre catégories, cf. `id-collisions.test.ts`).
// Une entrée se solde en CÂBLANT l'entité (citation dans une donnée qui l'utilise réellement, ou
// dans le code de prod) puis en retirant sa ligne ici — jamais en la laissant traîner.

/** @type {ReadonlySet<string>} */
export const ENTITY_ORPHAN_RATCHET = new Set([
  'traits:marque-de-tzeentch', // Marque de Tzeentch
  'traits:absorption', // Absorption
  'traits:amorphe', // Amorphe
  'traits:contagieux', // Contagieux
  'traits:decerebre', // Décérébré
  'traits:voleur-de-chair', // Voleur de chair
  'traits:aura-de-mort', // Aura de Mort
  'talents:benediction-de-tzeentch', // Bénédiction de Tzeentch
  'talents:disciple-du-changement', // Disciple du changement
  'talents:double-vie', // Double vie
  'talents:empreint-de-la-magie', // Empreint de la Magie
  'talents:sang-neuf', // Sang Neuf
  'qualities:filet-barbele', // Filet barbelé — qualité d'ARME (subType 'arme') ; aucun trapping ne la porte, cf. `assommante`/`defensive` sur les armes de base
  'qualities:deroutante', // Déroutante — qualité d'ARME (subType 'arme') ; aucun trapping ne la porte, cf. `assommante`/`defensive` sur les armes de base
  'skills:hypnotisme', // Hypnotisme
  'vehicles:petite-litiere', // Petite litière
  'vehicles:grande-litiere', // Grande litière
])
