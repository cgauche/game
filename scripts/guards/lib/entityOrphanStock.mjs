// STOCK CLIQUETÉ des entités de catalogue SANS CONSOMMATEUR (« curée, jamais atteinte = dette ») —
// consommé par `src/data/entity-orphans.test.ts`. Patron whitelist-en-lib du dépôt
// (`tableConsumerStock.mjs`, `manualDocsStock.mjs`).
//
// Une entrée de `traits.json`/`talents.json`/`qualities.json`/`maneuvers.json`/`skills.json`/
// `props.json`/`vehicles.json`/`creatures.json` (périmètre retenu, cf. `build-entity-orphans.mjs`) dont
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
//
// DEUX CONTRATS depuis l'entrée de `creatures` au périmètre (#1553 L3) :
//  — NOMINATIF (`ENTITY_ORPHAN_RATCHET`, ci-dessous) : ensemble EXACT, dans les deux sens — une
//    orpheline hors stock échoue, une ligne de stock qui n'est plus orpheline échoue.
//  — PAR FAMILLE (`ENTITY_ORPHAN_FAMILIES`) : un PRÉDICAT `(catégorie, source.book)` + un COMPTE
//    plafond décroissant. Réservé aux masses où le manque n'est PAS entité par entité mais
//    LIVRE par LIVRE : un supplement entier curé dont aucune scène n'existe encore. 333 des 351
//    orphelines de `creatures` sont dans ce cas (2026-09) ; les énumérer une à une ferait 333 lignes
//    de bruit qui camoufleraient les 18 vraies dettes nominatives.
//
// FAIL-OPEN ASSUMÉ du contrat de famille, et son ATTÉNUATION : un plafond à 244 laisse passer la
// SUBSTITUTION (une orpheline câblée, une autre créée — compte inchangé, garde verte). Elle n'est pas
// invisible pour autant : `docs/orphelines-donnees.md` reste NOMINATIF entrée par entrée sur TOUT le
// périmètre (familles comprises) et il est gardé à jour par `--check` — toute substitution apparaît
// au DIFF du doc généré, dans le même commit. C'est le doc, pas le plafond, qui porte la nominativité.

/** Familles d'orphelines PAR LIVRE — prédicat `(category, book)` + plafond DÉCROISSANT. Une famille
 *  VIDÉE (compte 0) voit sa LIGNE SUPPRIMÉE, jamais laissée à zéro (garde : `entity-orphans.test.ts`).
 *  `note` = la disposition, avec le COMPTE, 3 ids d'exemple et le ticket de câblage qui la bloque.
 * @type {ReadonlyArray<{ category: string, book: string, max: number, note: string }>} */
export const ENTITY_ORPHAN_FAMILIES = [
  // bloqué par #1636 — bestiaire du supplément maison `frenchy-bzh` (gardes de ville,
  // gardes de village, milices…), entièrement curé : aucune scène ni rencontre ne le convoque.
  // Ex. `jeune-recrue-du-guet`, `homme-du-guet`, `sergent-du-guet`.
  { category: 'creatures', book: 'frenchy-bzh', max: 243, note: 'bestiaire frenchy-bzh curé, aucune scène porteuse — bloqué par #1636' },
  // bloqué par #1637 — bestiaire de Middenheim, curé sans scène middenheimoise.
  // Ex. `spectre-middenheim`, `loup-blanc`, `babrakkos`.
  { category: 'creatures', book: 'middenheim', max: 37, note: 'bestiaire Middenheim curé, aucune scène porteuse — bloqué par #1637' },
  // bloqué par #1638 — Zoo Impérial : bestiaire de référence curé, sans rencontre ni scène.
  // Ex. `l-ombre-du-fleuve`, `arachnarok`, `gobelin-des-forets`.
  { category: 'creatures', book: 'zoo-imperial', max: 37, note: 'bestiaire Zoo Impérial curé, aucune scène porteuse — bloqué par #1638' },
  // bloqué par #1639 — faune marine MdG : le voyage en mer existe (`sea-events.json` en
  // cite 4), ces 15-là n'y sont pas. Ex. `baudroye`, `crabe-boxeur`, `elementaire-de-mer`.
  { category: 'creatures', book: 'mer-des-griffes', max: 15, note: 'faune MdG curée hors des événements de mer — bloqué par #1639' },
]

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
  // --- `creatures`, entrées au périmètre #1553 L3 (2026-09) : les 18 orphelines HORS des 4 familles
  // par livre ci-dessus. Sept d'entre elles sont des PNJ `named: true` (un personnage de scénario
  // n'a de chemin que par la scène qui le pose) ; les onze autres sont du bestiaire isolé.
  'creatures:elfe-haut-et-sylvain', // LDB p.311 — profil de peuple (`folder: 'Les peuples du Reikland'`) ; `speciesRace.json` cite 16 créatures, pas celle-ci
  'creatures:pol-dankels', // LDB p.313 — PNJ `named` (`tenue: 'sorcier'`), aucune scène ne le pose
  'creatures:hyppogriffe', // LDB p.321 — bête monstrueuse, `appearance.species: 'hippogriffe'` ; ni `montures.json` (11 créatures citées) ni une rencontre ne la convoque
  'creatures:chauve-souris-vampire-varghulf', // LDB p.327 — mort-vivant à `grantGroups`, aucune scène ni `groups.json` (8 créatures citées) ne l'appelle
  'creatures:demigriffon-adulte', // AA p.109 — `folder: 'Montures de guerre'` ; absente de `montures.json`, donc jamais montable
  'creatures:brochet-du-stir-fluvial', // MSR-C p.88 — HOMONYME de `creatures:brochet-du-stir` (ZI p.36, MÊME `label`, consommée et rigguée `gameIso/rig/creatures/defs/BrochetDuStir.ts`) : un doublon de libellé dont seul l'exemplaire ZI a un chemin
  'creatures:sangsue-geante', // MSR-C p.86 — `folder: 'Bestiaire fluvial'` ; le voyage fluvial ne tire aucune rencontre de ce dossier
  'creatures:sangsue-des-arbres', // MSR-C p.86 — idem `sangsue-geante` (même dossier, même absence de tirage)
  'creatures:naiade', // MSR-C p.87 — `folder: 'Bestiaire fluvial'`, aucune rencontre fluviale ne la cite
  'creatures:isrogdal-lempresse', // ADE II p.14 — PNJ `named` du dossier « Ogres (ADE II) », aucune scène ne le pose
  'creatures:ugrik-legaree', // ADE II p.14 — PNJ `named` du dossier « Ogres (ADE II) », aucune scène ne le pose
  'creatures:nazzaalta-affabule', // ADE II p.26 — PNJ `named` du dossier « Ogres (ADE II) », aucune scène ne le pose
  'creatures:artur-piedmarteau', // ADE II p.26 — PNJ `named` du dossier « Ogres (ADE II) », aucune scène ne le pose
  'creatures:familier-de-combat', // VDM p.181 — dossier « Créatures magiques » ; SANS `appearance` (aucun rig), et aucun Talent/sort de `spells.json`/`talents.json` ne cite son id
  'creatures:familier-de-pouvoir', // VDM p.182 — idem `familier-de-combat` (sans `appearance`, jamais citée)
  'creatures:familier-de-sorts', // VDM p.182 — idem `familier-de-combat` (sans `appearance`, jamais citée)
  'creatures:p-tarix-celui-qui-ecrit', // VDM p.212 — PNJ `named` du dossier « Némésis magiques », aucune scène ne le pose
  'creatures:xirat-p-celui-qui-lit', // VDM p.213 — PNJ `named` du dossier « Némésis magiques », aucune scène ne le pose
])
