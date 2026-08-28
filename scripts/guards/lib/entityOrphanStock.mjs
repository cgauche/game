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
// `deroutante` restent DUES : `state/interludeFlow.ts:1069` (`falseQualities()`) les sélectionne par
// champ mais ne les exploite QUE par LABEL (rumeurs de Particularité fausses, ADE II — jamais la
// qualité elle-même) — MODE 2 les rejette (résultat non exploité par id). Descendu à 15 (2026-07-27) :
// la grammaire MODE 2 étendue à la véracité de champ (`x.champ`)/sa négation (`!x.champ`, cf. en-tête
// `entityConsumers.mjs`) fait sortir `vehicles:petite-litiere`/`grande-litiere` — `vehicles.filter((v)
// => v.purchase && !v.ship).map((v) => v.id)` (`state/merchantFlow.ts:130`, `unitIdsOfKind`) est un
// chemin d'achat réel au stock du Maquignon (`merchants.json` `unitKinds:['vehicule-terrestre']`).
//
// Clé = `catégorie:id` (les ids peuvent collisionner entre catégories, cf. `id-collisions.test.ts`).
// Une entrée se solde en CÂBLANT l'entité (citation dans une donnée qui l'utilise réellement, ou
// dans le code de prod) puis en retirant sa ligne ici — jamais en la laissant traîner.

/** @type {ReadonlySet<string>} */
export const ENTITY_ORPHAN_RATCHET = new Set([
  'traits:marque-de-tzeentch', // bloqué par #676 : porteur attendu = carrière « Magus du Culte de Tzeentch », absente de careers.json (EDOC 9)
  'traits:absorption', // bloqué par #921 (cause A) : mécanique `effects` COMPLÈTE, aucune créature EDO ne porte le Trait
  'traits:amorphe', // bloqué par #921 (cause B) : prose seule, vocabulaire moteur absent (réduction de Blessures par type de dégâts, immunité aux Critiques)
  'traits:contagieux', // bloqué par #921 (cause A) : mécanique `effects` COMPLÈTE et testée (`src/state/contagieux.test.ts`), aucune créature EDO ne porte le Trait
  'traits:decerebre', // bloqué par #921 (cause B) : prose seule, vocabulaire moteur absent (« joue toujours en dernier », substitution BF/BFM)
  'traits:voleur-de-chair', // bloqué par #921 (cause B) : prose seule, vocabulaire moteur absent (possession de cadavre, prérequis Trait Démoniaque)
  'traits:aura-de-mort', // bloqué par #920 : vocabulaire d'aura sans paramètre de domaine de sort + porteur « Colosse Necrofex » absent de creatures.json
  'talents:benediction-de-tzeentch', // bloqué par #676 : porteur attendu = carrière « Magus du Culte de Tzeentch », absente de careers.json (EDOC 9)
  'talents:disciple-du-changement', // bloqué par #676 : porteur attendu = carrière « Magus du Culte de Tzeentch », absente de careers.json (EDOC 9)
  'talents:double-vie', // bloqué par #676 : porteur attendu = carrière « Magus du Culte de Tzeentch », absente de careers.json (EDOC 9)
  'talents:empreint-de-la-magie', // bloqué par #676 : porteur attendu = carrière « Magus du Culte de Tzeentch », absente de careers.json (EDOC 9)
  'talents:sang-neuf', // bloqué par #744 : lignage éonir toriour absent de species.json (`grep -i eonir src/data/species.json` → 0 match)
  'qualities:filet-barbele', // Filet barbelé — qualité d'ARME (subType 'arme') ; aucun trapping ne la porte, cf. `assommante`/`defensive` sur les armes de base
  'qualities:deroutante', // Déroutante — qualité d'ARME (subType 'arme') ; aucun trapping ne la porte, cf. `assommante`/`defensive` sur les armes de base
  'skills:hypnotisme', // bloqué par #915 : le RAW ouvre 9 Carrières sans fixer de niveau ; `CareerLevelData` n'a aucun champ pour une Compétence optionnelle de supplément
])
