import { describe, it, expect } from 'vitest';
import { CODEX, CODEX_GROUPS, categoriesIn, categoryByKey, codexLookup, codexLookupVersion, invalidateCodexLookup, type CodexItem, type CodexFacet } from './registry';
import { codexMatch, deburr, filterItems, facetValues } from './search';
import { isEditableCategory } from './CodexEdit';
import { creatures, etats, trappings, findTraitById, WATER_EXPOSURE } from '../../data';
import { setDataset } from '../../data/overrides';
import { CHAR_KEYS } from '../../engine/types';
import { CHAR_ABR } from '../../data';

/** Toutes les lignes 'ref' (cross-réf) d'une fiche, sections + onglets confondus. */
const refLabelsOf = (item: CodexItem): string[] =>
  [...(item.sections ?? []), ...(item.tabs ?? []).flatMap((t) => t.sections)]
    .flatMap((s) => s.rows)
    .flatMap((r) => (r.t === 'ref' ? [r.label] : r.t === 'choice' ? r.options.map((o) => o.label) : []));

describe('Codex registry', () => {
  it('a des catégories, toutes peuplées, à clés uniques', () => {
    expect(CODEX.length).toBeGreaterThan(0);
    const keys = CODEX.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const c of CODEX) expect(c.items.length).toBeGreaterThan(0);
  });

  it('chaque catégorie appartient à un groupe connu', () => {
    for (const c of CODEX) expect(CODEX_GROUPS).toContain(c.group);
  });

  it('categoriesIn / categoryByKey cohérents', () => {
    for (const g of CODEX_GROUPS) {
      for (const c of categoriesIn(g)) {
        expect(c.group).toBe(g);
        expect(categoryByKey(c.key)).toBe(c);
      }
    }
    expect(categoryByKey('inexistant')).toBeUndefined();
  });

  it('les entrées portent un libellé et, le plus souvent, une source', () => {
    for (const c of CODEX) for (const it of c.items) expect(it.label).toBeTruthy();
    const races = categoryByKey('races')!;
    expect(races.items.every((i) => i.source?.book)).toBe(true);
  });

  it('codexLookup résout exact + casse ignorée, undefined sinon', () => {
    const first = categoryByKey('etats')!.items[0];
    expect(codexLookup('etats', first.label)).toBe(first);
    expect(codexLookup('etats', first.label.toUpperCase())).toBe(first);
    expect(codexLookup('etats', 'libellé inexistant')).toBeUndefined();
    expect(codexLookup('categorie-inexistante', first.label)).toBeUndefined();
  });

  it('FRAÎCHEUR après persist : setDataset (mutation en place) + invalidate → items re-projetés + lookup à jour', () => {
    // Simule le VRAI chemin de `CodexEdit.save` : le dataset source est muté EN PLACE
    // (`overrides.ts::setDataset`), puis `invalidateCodexLookup()` — index figé AVANT, frais APRÈS.
    const cat = categoryByKey('etats')!;
    const before = [...etats]; // snapshot (références d'origine) pour restauration
    const original = etats[0];
    const renamed = `${original.label} (renommé-test)`;
    try {
      expect(codexLookup('etats', renamed)).toBeUndefined(); // construit l'index de la catégorie
      setDataset('etats', etats.map((e, i) => (i === 0 ? { ...e, label: renamed } : e)));
      // Comportement défensif conservé : index ET projection figés tant que non invalidés.
      expect(codexLookup('etats', renamed)).toBeUndefined();
      const v0 = codexLookupVersion();
      invalidateCodexLookup();
      expect(codexLookupVersion()).toBe(v0 + 1);
      // Re-projection : la catégorie reflète le nouveau libellé, le lookup le résout.
      expect(cat.items.some((i) => i.label === renamed)).toBe(true);
      expect(codexLookup('etats', renamed)?.label).toBe(renamed);
      expect(codexLookup('etats', original.label)).toBeUndefined(); // l'ancien libellé a disparu
    } finally {
      setDataset('etats', before);
      invalidateCodexLookup();
    }
  });
});

describe('Codex registry — références INVERSES (relations.ts → fiches)', () => {
  it('la fiche d’un trait liste « Créatures ayant ce trait » (inversion bout-en-bout)', () => {
    // Donnée → attendu : une créature réelle + son 1er trait → la fiche du trait DOIT la lister.
    const c = creatures.find((x) => x.traits.length > 0 && findTraitById(x.traits[0].id))!;
    const trait = findTraitById(c.traits[0].id)!;
    const item = codexLookup('traits', trait.label);
    expect(item, trait.label).toBeTruthy();
    const sec = item!.sections?.find((s) => s.title === 'Créatures ayant ce trait');
    expect(sec, `${trait.label} → section inverse`).toBeTruthy();
    expect(sec!.rows.some((r) => r.t === 'ref' && r.label === c.label)).toBe(true);
  });

  it('la fiche d’une compétence porte des sections inverses (cross-réf cliquables)', () => {
    // Une compétence très référencée (carac la cite toujours) → au moins une cross-réf inverse.
    const skills = categoryByKey('skills')!.items;
    expect(skills.some((s) => refLabelsOf(s).length > 0)).toBe(true);
  });

  it('la fiche d’une Table de Corruption rend le tirage d100 → Mutation (cross-réf + badge de plage)', () => {
    const tables = categoryByKey('mutationTables')!.items;
    const t = tables[0];
    const sec = t.sections?.find((s) => /Tirage/.test(s.title));
    expect(sec, 'section de tirage').toBeTruthy();
    const refRow = sec!.rows.find((r) => r.t === 'ref');
    expect(refRow && refRow.t === 'ref' && refRow.category).toBe('mutations');
    expect(refRow && refRow.t === 'ref' && /\d+–\d+/.test(refRow.badge ?? '')).toBe(true);
  });

  it('la fiche d’un Lieu-parent liste ses Sous-lieux (inversion location.parent)', () => {
    const locs = categoryByKey('locations')!.items;
    const parent = locs.find((l) => locs.some((c) => c.sub === l.label)); // un lieu dont le label est le parent d'un autre
    expect(parent, 'un lieu-parent').toBeTruthy();
    expect(parent!.sections?.some((s) => s.title === 'Sous-lieux' && s.rows.some((r) => r.t === 'ref'))).toBe(true);
  });

  it('la fiche d’un Livre liste son contenu PAR TYPE (bookContents câblé, cross-réf cliquables)', () => {
    const books = categoryByKey('books')!.items;
    const withContent = books.find((b) => (b.sections?.length ?? 0) > 0);
    expect(withContent, 'au moins un livre a du contenu').toBeTruthy();
    expect(withContent!.sections!.some((s) => s.rows.some((r) => r.t === 'ref'))).toBe(true);
  });

  it('catégorie « Psychologie » = filtre data-driven des traits à capacité psy, groupée par type', () => {
    const psy = categoryByKey('psychologie');
    expect(psy?.group).toBe('Effets');
    expect(psy!.items.length).toBeGreaterThan(0);
    // Peur DOIT en faire partie, groupée « Peur ».
    const peur = psy!.items.find((i) => i.label.toLowerCase() === 'peur');
    expect(peur, 'Peur dans Psychologie').toBeTruthy();
    expect(peur!.group).toBe('Peur');
    // C'est un VIEW de traits (pas un dataset) → l'édition DEV passe par « Traits », pas ici.
    expect(isEditableCategory('psychologie')).toBe(false);
  });
});

describe('Codex registry — dégâts CONDITIONNELS d’une arme à capacité de qualité (#135)', () => {
  it('une pièce à Atout Siège (RÉELLE, ex. Catapulte) affiche le fait « Dégâts » + la note ×2 structure — pas juste le total imprimé', () => {
    // Requête sur la DONNÉE (zéro id en dur) : toute Possession du catalogue portant la qualité `siege`
    // fait foi — dégâts effectifs contre une structure = double du total imprimé (ADE II ch.08 l.292),
    // le Codex ne doit plus l'occulter.
    const siegeTrapping = trappings.find((t) => t.qualities.some((q) => q.id === 'siege'))!;
    expect(siegeTrapping, 'aucune pièce à Atout Siège dans le catalogue').toBeTruthy();
    const item = categoryByKey('trappings')!.items.find((i) => i.label === siegeTrapping.label)!;
    const damageFact = item.meta?.find((f) => f.label === 'Dégâts');
    expect(damageFact, `${siegeTrapping.label} : fait Dégâts`).toBeTruthy();
    expect(damageFact!.value).toContain('×2 contre une structure');
  });

  it('une arme normale (sans ram/siège) garde son fait « Dégâts » INCHANGÉ — juste le total imprimé', () => {
    const sword = trappings.find((t) => t.id === 'arme-simple')!;
    const item = categoryByKey('trappings')!.items.find((i) => i.label === sword.label)!;
    const damageFact = item.meta?.find((f) => f.label === 'Dégâts');
    expect(damageFact!.value).toBe('+BF+4');
    expect(damageFact!.value).not.toMatch(/structure|porte|Effets/);
  });
});

describe('Codex registry — statbloc bestiaire compact', () => {
  it('chaque créature porte un statbloc (M + 10 caracs + Blessures, traits en chips cross-réf)', () => {
    const items = categoryByKey('creatures')!.items;
    for (const it of items) {
      expect(it.statblock, it.label).toBeTruthy();
      expect(it.statblock!.profile.map((f) => f.label)).toEqual(['M', ...CHAR_KEYS.map((k) => CHAR_ABR[k]), 'B']);
      for (const f of it.statblock!.profile) expect(f.value, `${it.label} ${f.label}`).toBeTruthy();
    }
    const withTraits = items.find((i) => i.statblock!.traits.length > 0)!;
    expect(withTraits.statblock!.traits.every((r) => r.t === 'ref' && r.category === 'traits')).toBe(true);
  });
});

describe('Codex registry — Bataille de masse (ADE II ch.8, #148)', () => {
  it('les 5 sections de mass-battle.json sont exposées, peuplées et ÉDITABLES au Codex', () => {
    const keys = ['massBattlePowerEstimate', 'massBattleMightModifiers', 'massBattleWarMachines', 'massBattleStructures', 'massBattleHazards'];
    for (const key of keys) {
      const cat = categoryByKey(key);
      expect(cat, key).toBeTruthy();
      expect(cat!.items.length, key).toBeGreaterThan(0);
      expect(isEditableCategory(key), key).toBe(true);
    }
  });

  it('les machines de guerre (dont le Bélier, déjà présent en donnée — pas dupliqué) apparaissent au catalogue', () => {
    const items = categoryByKey('massBattleWarMachines')!.items;
    expect(items.map((i) => i.label)).toContain('Bélier');
    const belier = items.find((i) => i.label === 'Bélier')!;
    expect(belier.meta?.find((f) => f.label === 'Équipe')?.value).toBe('6');
    expect(belier.meta?.find((f) => f.label === 'Atouts')?.value).toBe('Siège');
    // Une seule occurrence (pas de doublon introduit ailleurs, ex. trappings.json — cf. incident #148).
    expect(items.filter((i) => i.label === 'Bélier')).toHaveLength(1);
  });

  it('les structures (cibles de siège) et les aléas de bataille sont peuplés avec leurs faits', () => {
    const structures = categoryByKey('massBattleStructures')!.items;
    const porte = structures.find((i) => i.label === 'Porte de ville')!;
    expect(porte.meta?.find((f) => f.label === 'BE')?.value).toBe('10');
    expect(porte.meta?.find((f) => f.label === 'Blessures')?.value).toBe('30');
    const hazards = categoryByKey('massBattleHazards')!.items;
    expect(hazards.map((i) => i.label)).toContain('Tempête');
    expect(hazards.find((i) => i.label === 'Tempête')!.desc).toMatch(/tempête se lève/);
  });
});

describe('Codex registry — #157 (audit d’exposition : datasets de contenu manquants au Codex)', () => {
  it('les nouveaux catalogues de contenu sont exposés, peuplés et ÉDITABLES au Codex', () => {
    const keys = [
      'structures', 'vehicles', 'celestialHouses', 'groups', 'psychologies', 'seaShanties', 'crewRoles', 'crewTestTypes', 'navalTraits',
      'traumas', 'criticalsTete', 'criticalsBras', 'criticalsCorps', 'criticalsJambe',
      'aaCriticalsTete', 'aaCriticalsBras', 'aaCriticalsCorps', 'aaCriticalsJambe',
      'incidentsMonture', 'problemesVehicule', 'montures', 'tavernGames', 'obsessions', 'structureCriticals',
      'landCargo', 'seaCargo', 'riverPerils', 'crewMoraleFactors', 'crewMoraleBands', 'steamBreakdowns',
    ];
    for (const key of keys) {
      const cat = categoryByKey(key);
      expect(cat, key).toBeTruthy();
      expect(cat!.items.length, key).toBeGreaterThan(0);
      expect(isEditableCategory(key), key).toBe(true);
    }
  });

  it('un Critique LDB (Tête) porte son effet immédiat (ops) en section + ses Traumatismes engendrés en cross-réf', () => {
    const items = categoryByKey('criticalsTete')!.items;
    const withOps = items.find((i) => i.sections?.some((s) => s.title === 'Effet immédiat'));
    expect(withOps, 'au moins un Critique Tête porte un effet immédiat').toBeTruthy();
    const withTrauma = items.find((i) => i.sections?.some((s) => s.title === 'Traumatismes engendrés'));
    expect(withTrauma, 'au moins un Critique Tête engendre un Traumatisme référencé').toBeTruthy();
    const traumaSec = withTrauma!.sections!.find((s) => s.title === 'Traumatismes engendrés')!;
    expect(traumaSec.rows.every((r) => r.t === 'ref' && r.category === 'traumas')).toBe(true);
  });

  it('un dataset SANS `label` (Moral d’équipage — Effets, keyé par `id`) reste identifiable (entryKey = label projeté)', () => {
    const items = categoryByKey('crewMoraleBands')!.items;
    expect(items.length).toBeGreaterThan(0);
    for (const it of items) expect(it.label).toBeTruthy();
  });
});

describe('Codex registry — #157 (suite) : 5 derniers catalogues de CONTENU (Critiques de coque, Rencontres, Longs voyages en mer, Exposition hydrique)', () => {
  it('les 16 nouvelles catégories tableaux sont exposées, peuplées et ÉDITABLES au Codex', () => {
    const keys = [
      'shipCriticalsCargaison', 'shipCriticalsGreement', 'shipCriticalsCoque', 'shipCriticalsAvirons', 'shipCriticalsEquipements',
      'riverCriticalsGreement', 'riverCriticalsAvirons', 'riverCriticalsGouvernail', 'riverCriticalsCoque', 'riverCriticalsSuperstructure',
      'rencontresPositives', 'rencontresFortuites', 'rencontresDangereuses',
      'seaManannFactors', 'seaBoardEvents', 'seaPortEvents',
    ];
    for (const key of keys) {
      const cat = categoryByKey(key);
      expect(cat, key).toBeTruthy();
      expect(cat!.items.length, key).toBeGreaterThan(0);
      expect(isEditableCategory(key), key).toBe(true);
    }
  });

  it('un Critique de navire (Coque) porte son effet immédiat (ops) ET son Test d’équipage (échec) en sections', () => {
    const items = categoryByKey('shipCriticalsCoque')!.items;
    const barreAbimee = items.find((i) => i.label === 'Barre abîmée');
    expect(barreAbimee, 'Barre abîmée (coque, MDG ch.13)').toBeTruthy();
    expect(barreAbimee!.sub).toBe('d10 2–2');
    const coqueDegradee = items.find((i) => i.label === 'Coque dégradée')!;
    expect(coqueDegradee.meta?.find((f) => f.label === 'Éclats (Indice)')?.value).toBe('4');
  });

  it('un Critique fluvial (Gréement) porte son effet immédiat + son Test d’équipage (Compétence/Difficulté/Cible/Conséquence)', () => {
    const items = categoryByKey('riverCriticalsGreement')!.items;
    const g = items.find((i) => i.label === 'Gréement')!;
    expect(g, 'Gréement (fluvial, T2C ch.5)').toBeTruthy();
    expect(g.sections?.some((s) => s.title === 'Effet immédiat')).toBe(true);
    const testSec = g.sections?.find((s) => s.title === 'Test d’équipage');
    expect(testSec, 'section Test d’équipage').toBeTruthy();
    expect(testSec!.rows.some((r) => r.t === 'kv' && r.k === 'Cible' && r.v === 'Toute personne sur le pont')).toBe(true);
    expect(g.sections?.some((s) => s.title === 'Conséquence (échec du Test)')).toBe(true);
  });

  it('un Critique SANS Test d’équipage (Coque fluviale, dégâts purement automatiques) omet la section Test', () => {
    const items = categoryByKey('riverCriticalsCoque')!.items;
    const coque = items.find((i) => i.label === 'Coque')!;
    expect(coque.sections?.some((s) => s.title === 'Test d’équipage')).toBe(false);
    expect(coque.sections?.some((s) => s.title === 'Effet immédiat')).toBe(true);
  });

  it('une Rencontre de voyage (EDOC ch.5) porte sa plage d100 + son texte verbatim', () => {
    const items = categoryByKey('rencontresPositives')!.items;
    expect(items.length).toBeGreaterThan(0);
    for (const it of items) { expect(it.sub).toMatch(/^d100 \d+–\d+$/); expect(it.desc).toBeTruthy(); }
  });

  it('un Facteur d’Humeur de Manann (MDG ch.15) affiche son effet signé (Nd10 + constante)', () => {
    const items = categoryByKey('seaManannFactors')!.items;
    const f = items.find((i) => i.label === 'Vaincre ou contrer des suivants de Stromfels')!;
    expect(f, 'facteur Stromfels').toBeTruthy();
    expect(f.meta?.find((x) => x.label === 'Effet sur l’Humeur de Manann')?.value).toBe('+3d10');
  });

  it('un Événement de bord (MDG ch.15) porte sa plage de jet + son texte verbatim', () => {
    const items = categoryByKey('seaBoardEvents')!.items;
    const triton = items.find((i) => i.label === 'Triton !')!;
    expect(triton, 'événement Triton').toBeTruthy();
    expect(triton.sub).toBe('-9999–-65');
    expect(triton.desc).toMatch(/Manann ne supporte plus/);
  });

  it('la fiche « Exposition à l’eau » (dataset-OBJET, T2C ch.14) est éditable et projette Test + Modificateurs + Maladies (cross-réf)', () => {
    const cat = categoryByKey('waterExposure')!;
    expect(isEditableCategory('waterExposure')).toBe(true);
    expect(cat.items).toHaveLength(1); // dataset-objet UNIQUE (mode 'single', comme `details`)
    const item = cat.items[0];
    expect(item.label).toBe(WATER_EXPOSURE.label);
    expect(item.source?.book).toBeTruthy();
    expect(item.meta?.find((f) => f.label === 'Test')?.value).toMatch(/Résistance/);
    const modSec = item.sections?.find((s) => s.title === 'Modificateurs');
    expect(modSec, 'section Modificateurs').toBeTruthy();
    expect(modSec!.rows.some((r) => r.t === 'sub')).toBe(true); // groupé par table (Source d’eau / Blessures et États)
    const diseaseSec = item.sections?.find((s) => /Maladies/.test(s.title));
    expect(diseaseSec, 'section Maladies').toBeTruthy();
    expect(diseaseSec!.rows.every((r) => r.t === 'ref' && r.category === 'maladies')).toBe(true);
    expect(diseaseSec!.rows.some((r) => r.t === 'ref' && r.label !== undefined && r.label.length > 0)).toBe(true);
  });
});

describe('Codex — facettes', () => {
  it('filterItems : ET entre facettes, OU à l’intérieur, item sans valeur écarté par une facette active', () => {
    const items: CodexItem[] = [
      { label: 'Averland', source: { book: 'LDB', page: 1 }, group: 'G1' },
      { label: 'Barak', source: { book: 'ADE', page: 2 }, group: 'G1' },
      { label: 'Carroburg', source: { book: 'LDB', page: 3 }, group: 'G2' },
      { label: 'Dötern' },
    ];
    const facets: CodexFacet[] = [
      { key: 'book', label: 'Livre', valueOf: (i) => i.source?.book },
      { key: 'group', label: 'Groupe', valueOf: (i) => i.group },
    ];
    expect(filterItems(items, '', facets, {})).toHaveLength(4); // aucune facette active = tout passe
    expect(filterItems(items, '', facets, { book: ['LDB'] }).map((i) => i.label)).toEqual(['Averland', 'Carroburg']);
    expect(filterItems(items, '', facets, { book: ['LDB', 'ADE'] })).toHaveLength(3); // OU interne ; Dötern sans livre écarté
    expect(filterItems(items, '', facets, { book: ['LDB'], group: ['G1'] }).map((i) => i.label)).toEqual(['Averland']); // ET entre facettes
    expect(filterItems(items, 'carro', facets, { book: ['LDB'] }).map((i) => i.label)).toEqual(['Carroburg']); // recherche + facette
  });

  it('facetValues dérive les valeurs des items (comptées, triées FR)', () => {
    const facet: CodexFacet = { key: 'book', label: 'Livre', valueOf: (i) => i.source?.book };
    const items: CodexItem[] = [
      { label: 'A', source: { book: 'LDB', page: 1 } },
      { label: 'B', source: { book: 'ADE', page: 1 } },
      { label: 'C', source: { book: 'LDB', page: 2 } },
      { label: 'D' },
    ];
    expect(facetValues(items, facet)).toEqual([
      { value: 'ADE', count: 1 },
      { value: 'LDB', count: 2 },
    ]);
  });

  it('chaque catégorie déclare ses facettes sur la donnée RÉELLE (livre / groupe ssi porté par des items)', () => {
    for (const c of CODEX) {
      const hasBook = c.items.some((i) => i.source?.book);
      const hasGroup = c.items.some((i) => i.group);
      expect(!!c.facets?.some((f) => f.key === 'book'), `${c.key} facette livre`).toBe(hasBook);
      expect(!!c.facets?.some((f) => f.key === 'group'), `${c.key} facette groupe`).toBe(hasGroup);
    }
  });
});

describe('Codex search', () => {
  it('deburr retire accents + casse', () => {
    expect(deburr('Bénédiction')).toBe('benediction');
    expect(deburr('À Terre')).toBe('a terre');
  });

  it('terme vide = tout passe', () => {
    expect(codexMatch({ label: 'X' }, '')).toBe(true);
    expect(codexMatch({ label: 'X' }, '   ')).toBe(true);
  });

  it('match insensible casse/accents sur label, sub et desc', () => {
    const it = { label: 'Bénédiction de Chance', sub: 'Béni', desc: 'relancer un Test' };
    expect(codexMatch(it, 'benediction')).toBe(true);
    expect(codexMatch(it, 'CHANCE')).toBe(true);
    expect(codexMatch(it, 'beni')).toBe(true);
    expect(codexMatch(it, 'relancer')).toBe(true);
    expect(codexMatch(it, 'dragon')).toBe(false);
  });
});
