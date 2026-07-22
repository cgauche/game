/**
 * Paquet de campagne schema 3 (#765) — le bloc NARRATIF parse et VALIDE au bon format, et
 * `parseProject` LÈVE fail-fast sur chaque violation d'invariant (collision id narratif ↔ règle
 * globale, référence par id morte, id interne dupliqué). Contrat POSITIF : un doc minimal valide
 * restitue son narratif.
 */
import { describe, it, expect } from 'vitest';
import { parseProject } from './worldMap';
import { emptyNarratif, type NarratifBlock } from './campaignNarratif';

// ids RÉELS de la règle globale (`src/data`) — base de preset valide + cible de collision.
const GLOBAL_CREATURE = 'humain';

const scene = { id: 's1' };

function doc(narratif: NarratifBlock, meta?: unknown) {
  return { schema: 3, scenes: [scene], narratif, ...(meta !== undefined ? { meta } : {}) };
}

const validNarratif = (): NarratifBlock => ({
  affaires: [{ id: 'af-sel', titre: 'L\'affaire du sel' }],
  indices: [
    { id: 'in-quai', affaireId: 'af-sel', kind: 'indice', titre: 'Le quai désert', stades: [{ id: 'st1', prose: 'Un quai vide.' }] },
    { id: 'ru-taverne', affaireId: 'af-sel', kind: 'rumeur', titre: 'On chuchote', stades: [{ id: 'st1', prose: 'Une rumeur.' }], refs: ['in-quai'] },
  ],
  presetsPnj: [{ id: 'pnj-marin', base: GLOBAL_CREATURE }],
  objets: [{ id: 'obj-lettre', label: 'Lettre cachetée', type: 'divers', subType: null } as NarratifBlock['objets'][number]],
});

describe('paquet de campagne schema 3 — bloc narratif', () => {
  it('doc schema 3 minimal (narratif vide) parse et restitue son narratif', () => {
    const res = parseProject(doc(emptyNarratif()));
    expect(res.scenes.map((s) => s.id)).toEqual(['s1']);
    expect(res.narratif).toEqual(emptyNarratif());
  });

  it('doc schema 3 peuplé valide restitue son narratif', () => {
    const res = parseProject(doc(validNarratif()));
    expect(res.narratif.affaires.map((a) => a.id)).toEqual(['af-sel']);
    expect(res.narratif.presetsPnj[0].base).toBe(GLOBAL_CREATURE);
  });

  it('projet schema 2 legacy migre en injectant un narratif vide', () => {
    const res = parseProject({ schema: 2, scenes: [scene] });
    expect(res.narratif).toEqual(emptyNarratif());
  });

  it('(a) LÈVE si un id narratif collisionne avec un id de la règle globale', () => {
    const n = validNarratif();
    n.affaires.push({ id: GLOBAL_CREATURE, titre: 'Collision' });
    expect(() => parseProject(doc(n))).toThrow(/collisionne avec un id de la règle globale/);
  });

  it('(b) LÈVE si indice.affaireId ne résout aucune affaire', () => {
    const n = validNarratif();
    n.indices[0].affaireId = 'af-fantome';
    expect(() => parseProject(doc(n))).toThrow(/référence une affaire inconnue/);
  });

  it('(c) LÈVE si preset.base ne résout aucune créature globale', () => {
    const n = validNarratif();
    n.presetsPnj[0].base = 'creature-inexistante';
    expect(() => parseProject(doc(n))).toThrow(/base inconnue/);
  });

  it('(c2) LÈVE si un preset PNJ sans base a un profil sans « char »', () => {
    const n = validNarratif();
    n.presetsPnj.push({ id: 'pnj-adhoc', profil: { label: 'Sans base' } as NarratifBlock['presetsPnj'][number]['profil'] });
    expect(() => parseProject(doc(n))).toThrow(/sans base et sans « char »/);
  });

  it('(c3) LÈVE si un preset PNJ n\'a ni base ni profil', () => {
    const n = validNarratif();
    n.presetsPnj.push({ id: 'pnj-vide' });
    expect(() => parseProject(doc(n))).toThrow(/n'a ni base ni profil/);
  });

  it('(d) LÈVE si indice.refs pointe un indice inconnu', () => {
    const n = validNarratif();
    n.indices[1].refs = ['in-fantome'];
    expect(() => parseProject(doc(n))).toThrow(/référence un indice inconnu/);
  });

  it('(e) LÈVE si deux entrées du narratif partagent le même id', () => {
    const n = validNarratif();
    n.affaires.push({ id: 'af-sel', titre: 'Doublon' });
    expect(() => parseProject(doc(n))).toThrow(/id d'affaire dupliqué/);
  });

  it('(f) LÈVE (message clair, pas TypeError) si un doc schema 3 natif n\'a pas de bloc narratif', () => {
    expect(() => parseProject({ schema: 3, scenes: [scene] })).toThrow(/bloc absent ou mal formé/);
  });

  it('(g) LÈVE si un registre du narratif n\'est pas un tableau', () => {
    expect(() => parseProject({ schema: 3, scenes: [scene], narratif: { affaires: [], indices: [] } })).toThrow(/doit être un tableau/);
  });

  it('(h) doc schema 3 avec un meta valide parse et restitue meta.id', () => {
    const res = parseProject(doc(emptyNarratif(), { id: 'camp-x', label: 'Campagne X', version: 1 }));
    expect(res.meta?.id).toBe('camp-x');
  });

  it('(i) LÈVE si meta est malformé (id vide)', () => {
    expect(() => parseProject(doc(emptyNarratif(), { id: '', label: 'X', version: 1 }))).toThrow(/meta/i);
  });
});
