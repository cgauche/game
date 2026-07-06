import { describe, it, expect } from 'vitest';
import { CODEX, CODEX_GROUPS, categoriesIn, categoryByKey, codexLookup, codexLookupVersion, invalidateCodexLookup, type CodexItem, type CodexFacet } from './registry';
import { codexMatch, deburr, filterItems, facetValues } from './search';
import { isEditableCategory } from './CodexEdit';
import { creatures, etats, trappings, findTraitById } from '../../data';
import { setDataset } from '../../data/overrides';
import { CHAR_KEYS } from '../../engine/types';

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
      expect(it.statblock!.profile.map((f) => f.label)).toEqual(['M', ...CHAR_KEYS, 'B']);
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
