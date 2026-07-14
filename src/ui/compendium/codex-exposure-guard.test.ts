import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { categoryByKey } from './registry';

/**
 * Garde-fou INVERSÉ « exposition Codex » (demande utilisateur 2026-07-14, verbatim : « On a une
 * guard sur les jsons qui ne sont pas dans le codex ? »). La preuve du trou : `axes.json` (#409)
 * a été créé sans catégorie Codex, invisible pour l'audit #157 (`registry.test.ts:204-236`) — ce
 * dernier ne fait que des assertions POSITIVES sur une liste énumérée à la main, jamais un scan de
 * `src/data/*.json` en entier. Patron des gardes inversées de ce repo : scanner le FILESYSTEM
 * (comme `citation-coverage-guard.test.ts`), pas une liste figée.
 *
 * Chaque `src/data/*.json` doit être :
 *  - SOIT **exposé** : `FILE_TO_CATEGORY_KEYS` le fait correspondre à ≥1 clé de catégorie Codex
 *    RÉELLE (`categoryByKey`, le registre vivant — jamais réimplémenté ici) qui porte des items ;
 *  - SOIT **exempté** : `CODEX_EXPOSURE_EXEMPT` porte SA raison, entrée par entrée. Deux familles
 *    de raison légitimes : vocabulaire app-interne (rendu iso/POV, tooling, catégorisation sans
 *    fiche autonome, authoring) — PERMANENT ; ou dette TICKETÉE #422 (`AUDIT #422 : contenu de jeu
 *    non encore exposé — cliquet décroissant`) — dataset de CONTENU DE JEU réel, retiré de la table
 *    au fur et à mesure des tickets d'exposition (mode cliquet, patron `BASELINES`/`EXEMPT_DATASETS`).
 *
 * `FILE_TO_CATEGORY_KEYS` ne porte JAMAIS de dispense — seulement le mapping fichier→clé(s), utile
 * là où le nom de fichier (kebab-case) diverge de la clé de catégorie (camelCase), ou où un seul
 * fichier NICHE plusieurs tables sœurs (`mass-battle.json` → 5 clés, `criticals.json` → 4, etc. —
 * même patron que `NESTED_ARRAY_FILE` d'`overrides.ts`).
 *
 * Un fichier absent des DEUX tables = RED nominatif (« <fichier> : ni catégorie Codex ni
 * exemption ») — jamais une case oubliée à la fois du filtre positif ET du filtre négatif.
 */

const DATA_DIR = fileURLToPath(new URL('../../data/', import.meta.url));

/** Fichier `src/data/*.json` → clé(s) de catégorie Codex qui l'exposent (`registry.ts::CODEX_SPECS`).
 *  Un seul fichier peut nourrir plusieurs catégories sœurs NICHÉES (mass-battle/criticals/aa-criticals/
 *  ship-criticals/river-criticals/rencontres-edoc/sea-events/crew-morale) — même patron que
 *  `NESTED_ARRAY_FILE` (`data/overrides.ts`). `trappings.json` nourrit aussi `siegeEngines` (sous-vue
 *  filtrée par `siegeRig`, même fichier). Le nom de fichier diverge parfois de la clé (kebab-case vs
 *  camelCase, ou renommage sémantique — `species.json` → `races`, `astrology.json` → `celestialHouses`,
 *  `psychology.json` → `psychologies`) : SEULE raison d'être de cette table (jamais une dispense). */
const FILE_TO_CATEGORY_KEYS: Record<string, string[]> = {
  'aa-criticals.json': ['aaCriticalsTete', 'aaCriticalsBras', 'aaCriticalsCorps', 'aaCriticalsJambe'],
  'activities.json': ['activities'],
  'astrology.json': ['celestialHouses'],
  'axes.json': ['axes'],
  'books.json': ['books'],
  'calendarIntercalary.json': ['calendarIntercalary'],
  'calendarMonths.json': ['calendarMonths'],
  'calendarPhases.json': ['calendarPhases'],
  'calendarWeekdays.json': ['calendarWeekdays'],
  'careerLevels.json': ['careerLevels'],
  'careers.json': ['careers'],
  'characteristics.json': ['characteristics'],
  'classes.json': ['classes'],
  'creatures.json': ['creatures'],
  'crew-morale.json': ['crewMoraleFactors', 'crewMoraleBands'],
  'crew-roles.json': ['crewRoles'],
  'crew-test-types.json': ['crewTestTypes'],
  'criticals.json': ['criticalsTete', 'criticalsBras', 'criticalsCorps', 'criticalsJambe'],
  'details.json': ['details'],
  'domains.json': ['domains'],
  'etats.json': ['etats'],
  'eyes.json': ['eyes'],
  'gods.json': ['gods'],
  'groups.json': ['groups'],
  'hairs.json': ['hairs'],
  'incidents-monture.json': ['incidentsMonture'],
  'interludeEvents.json': ['interludeEvents'],
  'land-cargo.json': ['landCargo'],
  'locations.json': ['locations'],
  'maladies.json': ['maladies'],
  'maneuvers.json': ['maneuvers'],
  'mass-battle.json': ['massBattlePowerEstimate', 'massBattleMightModifiers', 'massBattleWarMachines', 'massBattleStructures', 'massBattleHazards'],
  'montures.json': ['montures'],
  'mutations.json': ['mutations'],
  'mutationTables.json': ['mutationTables'],
  'names.json': ['names'],
  'naval-traits.json': ['navalTraits'],
  'obsessions.json': ['obsessions'],
  'oups.json': ['oups'],
  'peripeties.json': ['peripeties'],
  'pregens.json': ['pregens'],
  'problemes-vehicule.json': ['problemesVehicule'],
  'psychology.json': ['psychologies'],
  'qualities.json': ['qualities'],
  'raceAppearance.json': ['raceAppearance'],
  'regles.json': ['regles'],
  'rencontres-edoc.json': ['rencontresPositives', 'rencontresFortuites', 'rencontresDangereuses'],
  'river-criticals.json': ['riverCriticalsGreement', 'riverCriticalsAvirons', 'riverCriticalsGouvernail', 'riverCriticalsCoque', 'riverCriticalsSuperstructure'],
  'river-perils.json': ['riverPerils'],
  'sea-cargo.json': ['seaCargo'],
  'sea-events.json': ['seaManannFactors', 'seaBoardEvents', 'seaPortEvents'],
  'sea-shanties.json': ['seaShanties'],
  'ship-criticals.json': ['shipCriticalsCargaison', 'shipCriticalsGreement', 'shipCriticalsCoque', 'shipCriticalsAvirons', 'shipCriticalsEquipements'],
  'skills.json': ['skills'],
  'species.json': ['races'],
  'spells.json': ['spells'],
  'stars.json': ['stars'],
  'steam-breakdown.json': ['steamBreakdowns'],
  'structure-criticals.json': ['structureCriticals'],
  'structures.json': ['structures'],
  'symptoms.json': ['symptoms'],
  'talents.json': ['talents'],
  'tavernGames.json': ['tavernGames'],
  'traits.json': ['traits'],
  'trappings.json': ['trappings', 'siegeEngines'],
  'traumas.json': ['traumas'],
  'vehicles.json': ['vehicles'],
  'water-exposure.json': ['waterExposure'],
  'weaponGroups.json': ['weaponGroups'],
  'weather.json': ['weather'],
};

/**
 * Fichier `src/data/*.json` sans catégorie Codex → sa raison, ENTRÉE PAR ENTRÉE (jamais un motif
 * générique — patron `EXEMPT_DATASETS`, `citationCoverage.mjs`).
 *
 * Deux familles :
 *  - vocabulaire app-interne (rendu iso/POV, tooling, catégorisation sans fiche autonome, tables de
 *    résolution d'authoring) — exemption PERMANENTE, aucune mécanique RAW narrative à exposer ;
 *  - `AUDIT : à exposer -> ticket` — dette TICKETÉE #422 (« AUDIT #422 : contenu de jeu non encore
 *    exposé — cliquet décroissant ») : dataset de CONTENU DE JEU réel (tables RAW chiffrées) trouvé
 *    par ce garde (#410 audit initial 2026-07-14) ; à RETIRER de cette table au fur et à mesure des
 *    tickets d'exposition (mode cliquet — un dataset qui gagne sa catégorie doit aussi quitter cette
 *    liste, sous peine de doublon silencieux avec `FILE_TO_CATEGORY_KEYS`).
 */
const CODEX_EXPOSURE_EXEMPT: Record<string, string> = {
  // ── Vocabulaire app-interne (permanent) ──────────────────────────────────────────────────────
  'ambiance.json': 'config de rendu (éclairage iso/POV), pas une fiche de contenu.',
  'decorPalette.json': 'palette de couleurs de rendu (hex), pas une fiche de contenu.',
  'reliefMaterials.json': 'catalogue de matériaux de relief (rendu iso), pas une fiche de contenu.',
  'roofMaterials.json': 'catalogue de matériaux de toiture (rendu iso), pas une fiche de contenu.',
  'structureAppearance.json': "presets d'apparence de structure (rendu iso), pas une fiche de contenu.",
  'props.json': 'catalogue de props de décor (rendu iso), pas une fiche de contenu.',
  'lightLevels.json': 'niveaux de lumière (rendu iso/vision), vocabulaire moteur — la RÈGLE de vision est ailleurs, sourcée et exposée via `regles`/`etats`.',
  'breath-types.json': 'vocabulaire de catégorisation (id+label uniquement) — aucune fiche autonome, la RÈGLE (souffle de créature) vit sur la créature elle-même.',
  'damage-types.json': 'vocabulaire de catégorisation (id+label uniquement) — aucune fiche autonome.',
  'qualityTypes.json': 'vocabulaire de catégorisation des Qualités/Défauts (Atout/Défaut) — consommé par `qualityTypeLabel`, pas une fiche autonome.',
  'qualitySubtypes.json': 'vocabulaire de catégorisation des Qualités/Défauts (Arme/Armure/Objet) — consommé par `qualitySubtypeLabel`, pas une fiche autonome.',
  'localisation.json': 'table de dé inversé (résultat→zone de touche) — vocabulaire structurel du moteur ; les zones sont déjà exposées via les Critiques par Localisation (`criticalsTete`/…).',
  'sizes.json': 'un seul champ `rangedMod` (barème par Taille) — vocabulaire structurel, pas une fiche narrative.',
  'speciesRace.json': "table de résolution race→défauts d'authoring (`_doc`/`default`/`rules`), pas une fiche de contenu.",
  'lieux-services.json': "vocabulaire de routage d'écran (icône/service de lieu — auberge/temple/forgeron…), pas une fiche de contenu.",
  'primitives.manifest.json': 'manifeste TOOLING (#298) des primitives partagées du code — vocabulaire app-interne.',
  'systemes.manifest.json': 'manifeste TOOLING (#298) éditorial des systèmes implémentés — vocabulaire app-interne.',
  // ── AUDIT #422 : contenu de jeu non encore exposé — cliquet décroissant (trouvé 2026-07-14) ──
  'advancementCosts.json': 'AUDIT : à exposer -> ticket — Tableau de Coût des Augmentations (LDB 07 l.45-62), consommé par `engine/advancement.ts`, aucune catégorie Codex.',
  'disponibilite.json': "AUDIT : à exposer -> ticket — % de Disponibilité + ratios de troc (LDB 59 « Faire son marché »), consommé par `engine/disponibilite.ts`, aucune catégorie Codex.",
  'driving-mishap.json': "AUDIT : à exposer -> ticket — Tableau des accidents de Conduite d'attelage (LDB 09 l.140-149), consommé par `engine/drivingMishap.ts`, aucune catégorie Codex.",
  'drunkenness.json': "AUDIT : à exposer -> ticket — Tableau d'Ivresse (LDB 09 l.471-487), consommé par `engine/drunkenness.ts`, aucune catégorie Codex.",
  'encumbranceTiers.json': 'AUDIT : à exposer -> ticket — Table Surchargé par palier (LDB 61 l.35-40), consommée par `engine/encumbrance.ts`, aucune catégorie Codex.',
  'grapple.json': "AUDIT : à exposer -> ticket — mécanique d'Empoignade en GameOp (LDB 14 l.155-169), consommée par `state/pendings.ts`, aucune catégorie Codex (la fiche narrative `empoignade` de `regles.json` est exposée, pas cette mécanique GameOp).",
  'miscast.json': "AUDIT : à exposer -> ticket — Tableaux d'Incantations Imparfaites (LDB 46) + Colère des dieux (LDB 40), consommés par `engine/miscast.ts`, aucune catégorie Codex.",
  'naval-ports.json': 'AUDIT : à exposer -> ticket — Index des ports de la Mer des Griffes (MDG ch.15 l.439-506), consommé par `state/worldMap.ts`, aucune catégorie Codex.',
  'naval-progression.json': 'AUDIT : à exposer -> ticket — table Progression de navire (MDG ch.13 l.68-75), consommée par `engine/shipNavigation.ts`, aucune catégorie Codex.',
  'night-stakes.json': "AUDIT : à exposer -> ticket — enjeux VERBATIM de la cascade de nuit, consommés par `state/restFlow.ts`, aucune catégorie Codex.",
  'river-navigation.json': "AUDIT : à exposer -> ticket — table de vent/navigation fluviale (T2C ch.5 l.11-41), consommée par `engine/riverNavigation.ts`, aucune catégorie Codex.",
  'sea-navigation.json': 'AUDIT : à exposer -> ticket — Périodes de travail/Vitesses/Salissures/Orientation (MDG ch.13/15), consommées par `engine/seaNavigation.ts`, aucune catégorie Codex.',
  'sea-perils.json': 'AUDIT : à exposer -> ticket — Périls en mer (MDG ch.13 l.423-564), consommés par `engine/seaPerils.ts`, aucune catégorie Codex.',
  'sea-weather.json': 'AUDIT : à exposer -> ticket — Météo de la Mer des Griffes (MDG ch.13 l.162-306), consommée par `engine/seaWeather.ts`, aucune catégorie Codex.',
  'ship-construction.json': 'AUDIT : à exposer -> ticket — Construction/Améliorations de navire (MDG ch.12), consommée par `engine/shipBuild.ts`, aucune catégorie Codex.',
};

/** Offenses réelles : chaque `.json` de `src/data` doit être exposé (mapping résolu via le VRAI
 *  registre `categoryByKey`) OU exempté. Retourne les messages RED, `[]` si tout est couvert. */
function computeOffenders(files: string[], mapping: Record<string, string[]>, exempt: Record<string, string>): string[] {
  const offenders: string[] = [];
  for (const f of files) {
    if (exempt[f] != null) continue;
    const keys = mapping[f];
    if (!keys || keys.length === 0) {
      offenders.push(`${f} : ni catégorie Codex ni exemption`);
      continue;
    }
    for (const k of keys) {
      const cat = categoryByKey(k);
      if (!cat || cat.items.length === 0) offenders.push(`${f} : clé Codex « ${k} » introuvable ou vide (mapping périmé)`);
    }
  }
  return offenders;
}

describe('garde-fou « exposition Codex » — chaque src/data/*.json exposé OU exempté (#410)', () => {
  it('aucun dataset réel ne manque à la fois de catégorie Codex et d’exemption', () => {
    const files = readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));
    const offenders = computeOffenders(files, FILE_TO_CATEGORY_KEYS, CODEX_EXPOSURE_EXEMPT);
    expect(
      offenders,
      `Dataset(s) invisible(s) du Codex — exposer via une catégorie (FILE_TO_CATEGORY_KEYS) ou exempter avec raison (CODEX_EXPOSURE_EXEMPT) :\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('aucun fichier n’est à la fois mappé (exposé) ET exempté — les deux tables restent disjointes', () => {
    const dupes = Object.keys(FILE_TO_CATEGORY_KEYS).filter((f) => CODEX_EXPOSURE_EXEMPT[f] != null);
    expect(dupes, `Fichier(s) présent(s) dans les DEUX tables (retirer le doublon) :\n${dupes.join('\n')}`).toEqual([]);
  });

  it('FILE_TO_CATEGORY_KEYS et CODEX_EXPOSURE_EXEMPT ne ciblent que des fichiers réellement présents (pas d’entrée fantôme)', () => {
    const files = new Set(readdirSync(DATA_DIR).filter((f) => f.endsWith('.json')));
    const danglingMap = Object.keys(FILE_TO_CATEGORY_KEYS).filter((f) => !files.has(f));
    const danglingExempt = Object.keys(CODEX_EXPOSURE_EXEMPT).filter((f) => !files.has(f));
    expect(danglingMap, `Mapping(s) fantôme(s) (fichier absent) — nettoyer FILE_TO_CATEGORY_KEYS :\n${danglingMap.join('\n')}`).toEqual([]);
    expect(danglingExempt, `Exemption(s) fantôme(s) (fichier absent) — nettoyer CODEX_EXPOSURE_EXEMPT :\n${danglingExempt.join('\n')}`).toEqual([]);
  });

  it('CODEX_EXPOSURE_EXEMPT porte une raison EXPLICITE non vide sur chaque entrée', () => {
    const blank = Object.entries(CODEX_EXPOSURE_EXEMPT).filter(([, reason]) => !reason || reason.trim().length < 10);
    expect(blank.map(([f]) => f), 'Exemption(s) sans raison explicite').toEqual([]);
  });

  it('fail-closed : un dataset fictif absent des DEUX tables fait ROUGE — retiré (mappé ou exempté), redevient vert', () => {
    const files = ['skills.json', 'axes-fictif.json'];
    const red = computeOffenders(files, FILE_TO_CATEGORY_KEYS, CODEX_EXPOSURE_EXEMPT);
    expect(red).toEqual(['axes-fictif.json : ni catégorie Codex ni exemption']);

    const greenViaExposure = computeOffenders(files, { ...FILE_TO_CATEGORY_KEYS, 'axes-fictif.json': ['skills'] }, CODEX_EXPOSURE_EXEMPT);
    expect(greenViaExposure).toEqual([]);

    const greenViaExemption = computeOffenders(files, FILE_TO_CATEGORY_KEYS, { ...CODEX_EXPOSURE_EXEMPT, 'axes-fictif.json': 'preuve fail-closed du garde (#410), fichier fictif.' });
    expect(greenViaExemption).toEqual([]);
  });

  it('un mapping vers une clé Codex qui n’existe pas (ou plus) fait ROUGE — mapping périmé détecté', () => {
    const red = computeOffenders(['skills.json'], { 'skills.json': ['clef-qui-n-existe-pas'] }, CODEX_EXPOSURE_EXEMPT);
    expect(red).toEqual(['skills.json : clé Codex « clef-qui-n-existe-pas » introuvable ou vide (mapping périmé)']);
  });
});
