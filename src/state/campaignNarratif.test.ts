/**
 * Paquet de campagne schema 3 (#765) — le bloc NARRATIF parse et VALIDE au bon format, et
 * `parseProject` LÈVE fail-fast sur chaque violation d'invariant (collision id narratif ↔ règle
 * globale, référence par id morte, id interne dupliqué) — invariants portés par `narratifSchema`
 * (`src/data/schemas/defs-scenes/narratif.ts`), qui NOMME le chemin fautif dans le message. Contrat
 * POSITIF : un doc minimal valide restitue son narratif.
 */
import { describe, it, expect } from 'vitest';
import { parseProject } from './worldMap';
import { emptyNarratif, type NarratifBlock } from './campaignNarratif';

// ids RÉELS de la règle globale (`src/data`) — base de preset valide + cible de collision.
const GLOBAL_CREATURE = 'humain';

const scene = { id: 's1', nom: 'Le quai', dimensions: { w: 3, h: 3 } };

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

  it('(c) LÈVE si preset.base ne résout aucune créature globale (FK `creatures.json`)', () => {
    const n = validNarratif();
    n.presetsPnj[0].base = 'creature-inexistante';
    expect(() => parseProject(doc(n))).toThrow(/id « creature-inexistante » absent de creatures\.json/);
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

  it('(f) LÈVE (message clair NOMMANT le champ, pas TypeError) si un doc schema 3 natif n\'a pas de bloc narratif', () => {
    expect(() => parseProject({ schema: 3, scenes: [scene] })).toThrow(/narratif: Invalid input: expected object/);
  });

  it('(g) LÈVE si un registre du narratif n\'est pas un tableau', () => {
    expect(() => parseProject({ schema: 3, scenes: [scene], narratif: { affaires: [], indices: [] } })).toThrow(/narratif\.presetsPnj: Invalid input: expected array/);
  });

  it('(h) doc schema 3 avec un meta valide parse et restitue meta.id', () => {
    const res = parseProject(doc(emptyNarratif(), { id: 'camp-x', label: 'Campagne X', version: 1 }));
    expect(res.meta?.id).toBe('camp-x');
  });

  it('(i) LÈVE si meta est malformé (id vide)', () => {
    expect(() => parseProject(doc(emptyNarratif(), { id: '', label: 'X', version: 1 }))).toThrow(/meta/i);
  });

  // ── #1342 L3 : la référence PAR ID va jusqu'à la spécialisation d'une Compétence de profil.
  const presetSkill = (spec: string) => {
    const n = validNarratif();
    n.presetsPnj.push({ id: 'pnj-savant', base: GLOBAL_CREATURE, profil: { skills: [{ id: 'savoir', spec, value: 40 }] } as NarratifBlock['presetsPnj'][number]['profil'] });
    return n;
  };

  it('(j) preset PNJ : une spec VALIDE passe, y compris HORS pool (statbloc-only, `pool: false`)', () => {
    expect(parseProject(doc(presetSkill('local'))).narratif.presetsPnj.length).toBe(2);
    expect(parseProject(doc(presetSkill('reikland'))).narratif.presetsPnj.length).toBe(2);
  });

  it('(k) preset PNJ : LÈVE sur une spec qui ne résout pas ; la sentinelle « Au choix » reste admise', () => {
    expect(() => parseProject(doc(presetSkill('Rivières')))).toThrow(/spécialisation inconnue « Rivières »/);
    expect(parseProject(doc(presetSkill('Au choix'))).narratif.presetsPnj.length).toBe(2);
  });

  const presetTalent = (spec: string) => {
    const n = validNarratif();
    n.presetsPnj.push({ id: 'pnj-mondain', base: GLOBAL_CREATURE, profil: { talents: [{ id: 'savoir-vivre', spec }] } as NarratifBlock['presetsPnj'][number]['profil'] });
    return n;
  };

  it('(l) preset PNJ : la spec d’un TALENT est validée au même titre', () => {
    expect(() => parseProject(doc(presetTalent('PAS-UN-ID')))).toThrow(/spécialisation inconnue « PAS-UN-ID » pour le Talent/);
    expect(parseProject(doc(presetTalent('Au choix'))).narratif.presetsPnj.length).toBe(2);
  });
});
