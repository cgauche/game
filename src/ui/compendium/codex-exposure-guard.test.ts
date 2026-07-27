import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { categoryByKey, CODEX } from './registry';
import { useGame } from '../../state/store';
import type { NarratifBlock } from '../../state/campaignNarratif';

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
  'advancementCosts.json': ['advancementCosts'],
  'arcane-phenomena.json': ['arcanePhenomena'],
  'artillery-misfire.json': ['artilleryMisfire'],
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
  'disponibilite.json': ['disponibilite'],
  'domains.json': ['domains'],
  'driving-mishap.json': ['drivingMishap'],
  'drunkenness.json': ['drunkenness'],
  'encumbranceTiers.json': ['encumbranceTiers'],
  'etats.json': ['etats'],
  'eyes.json': ['eyes'],
  'gods.json': ['gods'],
  'grapple.json': ['grapple'],
  'groups.json': ['groups'],
  'hairs.json': ['hairs'],
  'incidents-monture.json': ['incidentsMonture'],
  'interludeEvents.json': ['interludeEvents'],
  'land-cargo.json': ['landCargo'],
  'locations.json': ['locations'],
  'maladies.json': ['maladies'],
  'maneuvers.json': ['maneuvers'],
  'mass-battle.json': ['massBattlePowerEstimate', 'massBattleMightModifiers', 'massBattleWarMachines', 'massBattleStructures', 'massBattleHazards'],
  'miscast.json': ['miscastMinor', 'miscastMajor', 'miscastWrath'],
  'montures.json': ['montures'],
  'mutations.json': ['mutations'],
  'mutationTables.json': ['mutationTables'],
  'names.json': ['names'],
  'naval-ports.json': ['navalPorts'],
  'naval-progression.json': ['navalProgression'],
  'naval-traits.json': ['navalTraits'],
  'night-stakes.json': ['nightStakes'],
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
  'river-navigation.json': ['riverNavigation'],
  'river-perils.json': ['riverPerils'],
  'sea-cargo.json': ['seaCargo'],
  'sea-events.json': ['seaManannFactors', 'seaBoardEvents', 'seaPortEvents'],
  'sea-navigation.json': ['seaNavigation'],
  'sea-perils.json': ['seaPerils'],
  'sea-shanties.json': ['seaShanties'],
  'sea-weather.json': ['seaWeather'],
  'ship-construction.json': ['shipHullSizes', 'shipSpeedTraits', 'shipConstructionTraits'],
  'ship-criticals.json': ['shipCriticalsCargaison', 'shipCriticalsGreement', 'shipCriticalsCoque', 'shipCriticalsAvirons', 'shipCriticalsEquipements'],
  'skills.json': ['skills'],
  'species.json': ['races'],
  'spells.json': ['spells'],
  'stars.json': ['stars'],
  'steam-breakdown.json': ['steamBreakdowns'],
  'structure-criticals.json': ['structureCriticals'],
  'structures.json': ['structures'],
  'tables.json': ['effectTables'],
  'symptoms.json': ['symptoms'],
  'talents.json': ['talents'],
  'tavernGames.json': ['tavernGames'],
  'traits.json': ['traits'],
  'trappings.json': ['trappings', 'siegeEngines'],
  'traumas.json': ['traumas'],
  'vehicles.json': ['vehicles'],
  'vents-tourbillonnants.json': ['ventsTourbillonnants'],
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
  'raw.manifest.json': "manifeste TOOLING (#487) éditorial du champ Implémente de l'Atlas RAW (topic/ticket/bloque) — vocabulaire app-interne.",
  // #422 (LOT 1+2+3, 2026-07-14) a exposé toutes les entrées « AUDIT : à exposer » historiques.
  // #747 rouvre UN cas : merchants.json (archétypes migrés du CODE en donnée) reste à exposer au Codex.
  'merchants.json': "exposition Codex (catégorie + formulaire CodexEdit d'archétypes) = lot UI séparé -> #747 ; migré du CODE en donnée hand-éditable (schéma zod validé) en attendant.",
  'merchantFamilies.json': "config de PRÉSENTATION du stock marchand (familles d'onglets, colonnes) — vocabulaire app-interne, pas une fiche de contenu.",
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

/**
 * Anti-spoiler STRUCTUREL de la couche de campagne (#767). Le Compendium ne lit QUE les arrays GLOBAUX
 * (`src/data`) — jamais `useGame.getState().campaignNarratif` — donc la couche narrative d'une campagne
 * (affaires/indices/presets/objets de `narratif`) lui est disjointe PAR CONSTRUCTION. Ce test le
 * VERROUILLE : même campagne chargée (slot runtime peuplé), AUCUN id narratif n'entre dans l'index
 * Compendium (`CODEX`, le registre vivant). Une régression qui câblerait `campaignNarratif` dans un
 * `build()` de catégorie ferait apparaître ces ids → ROUGE ici.
 */
describe('anti-spoiler : la couche de campagne n’entre jamais dans l’index Compendium (#767)', () => {
  const narratif: NarratifBlock = {
    affaires: [{ id: 'aff-corbeau-noir', titre: 'Le Corbeau noir' }],
    indices: [{ id: 'ind-lettre-scellee', affaireId: 'aff-corbeau-noir', kind: 'indice', titre: 'Lettre scellée', stades: [{ id: 's1', prose: 'Une lettre.' }] }],
    presetsPnj: [{ id: 'pnj-baron-spoiler' }],
    objets: [{ id: 'obj-relique-cachee', label: 'Relique cachée', type: 'misc' } as NarratifBlock['objets'][number]],
  };

  /** Tous les ids RÉELLEMENT exposés par le Compendium — chaque item de chaque catégorie du registre. */
  function exposedCodexIds(): Set<string> {
    const ids = new Set<string>();
    for (const cat of CODEX) for (const item of cat.items) ids.add(item.id);
    return ids;
  }

  it('aucun id narratif (affaires/indices/presets/objets) n’appartient à l’index Compendium, campagne chargée', () => {
    useGame.setState({ campaignNarratif: narratif });
    try {
      const exposed = exposedCodexIds();
      const narratifIds = [
        ...narratif.affaires.map((a) => a.id),
        ...narratif.indices.map((i) => i.id),
        ...narratif.presetsPnj.map((p) => p.id),
        ...narratif.objets.map((o) => o.id),
      ];
      const leaked = narratifIds.filter((id) => exposed.has(id));
      expect(leaked, `Id(s) narratif(s) exposé(s) au Compendium (fuite anti-spoiler) :\n${leaked.join('\n')}`).toEqual([]);
    } finally {
      useGame.setState({ campaignNarratif: null });
    }
  });
});
