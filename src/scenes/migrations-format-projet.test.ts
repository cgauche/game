/**
 * LES MIGRATIONS DE FORMAT DU DOCUMENT DE PROJET, REJOUÉES SUR UN ARBRE JETABLE (#1467 L1b).
 *
 * Sœur de `src/data/migrations-type-enveloppe.test.ts`, MÊME doctrine : on exécute les VRAIS fichiers
 * de `scripts/migrations/` — copiés dans un arbre temporaire pour que leur `new URL('../../')` y
 * résolve — sur des fixtures GELÉES ici (aucun `git show` : un test qui en dépend casse en clone
 * superficiel). L'autre fichier tient la famille `type`→<clé métier> sur `src/data` ; celui-ci tient
 * la famille « bump de FORME » sur `src/scenes/<c>/<c>-projet.json`.
 *
 * TROIS scripts sont tenus ici :
 *  - `…-3i-projet-schema-4.mjs`, RETOUCHÉ par la vague 13 (il fail-fastait sur tout `schema` ∉ {3,4} ;
 *    lexicalement il précède la 13, donc sur l'arbre migré en `schema: 5` le rejeu sortait ROUGE) ;
 *  - `…-13-projet-forme.mjs`, NEUF et sans témoin committé ;
 *  - `…-15b-projet-forme-6.mjs`, le bump 5 → 6 : la clé de libellé des scènes et de la carte prend sa
 *    graphie canonique et les statblocs EMBARQUÉS s'annoncent. Sa fixture d'ENTRÉE est GELÉE au
 *    format 5 ici : l'arbre étant désormais en 6, plus aucun document committé ne la porterait.
 *
 * RETOUCHER UN SCRIPT DÉJÀ JOUÉ est le geste le plus risqué du lot. Chaque élargissement en
 * « ≥ N = déjà migré » fait AVALER EN SILENCE un `schema` FUTUR inconnu ; ce qui rattrape ce trou est
 * TOUJOURS la DERNIÈRE migration de la chaîne, seule à savoir ce qui existe après elle (aujourd'hui la
 * 15b, qui refuse tout `schema` ∉ {5,6}). Cet invariant se DÉPLACE à chaque bump et n'était gardé par
 * RIEN : il l'est ici (cas `t6`).
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const SCRIPT_3I = '2026-08-27-l1b-3i-projet-schema-4.mjs';
const SCRIPT_13 = '2026-08-28-l1b-13-projet-forme.mjs';
const SCRIPT_15B = '2026-08-29-l1b-15b-projet-forme-6.mjs';

/** Sérialiseur des documents de SCÈNE (indentation 1) — les deux scripts l'exigent avant de lire. */
const canonique = (doc: unknown) => `${JSON.stringify(doc, null, 1)}\n`;

/** Document de projet minimal à la forme demandée, GELÉ ici. */
function projet(over: Record<string, unknown>): Record<string, unknown> {
  return {
    schema: 4,
    meta: { id: 'camp', label: 'Campagne', icon: 'scenario/village', version: 3 },
    narratif: { affaires: [], indices: [], presetsPnj: [], objets: [] },
    scenes: [{ id: 's1', nom: 'Une salle', desc: 'Prose.', dimensions: { w: 4, h: 4 } }],
    ...over,
  };
}

/** Joue `script` sur un arbre jetable portant `doc` ; rend le code de sortie et l'état APRÈS. */
function joue(script: string, doc: Record<string, unknown>): { code: number; err: string; avant: string; apres: string } {
  const dir = mkdtempSync(join(tmpdir(), 'mig-projet-'));
  try {
    mkdirSync(join(dir, 'scripts', 'migrations'), { recursive: true });
    mkdirSync(join(dir, 'src', 'scenes', 'camp'), { recursive: true });
    const cible = join(dir, 'src', 'scenes', 'camp', 'camp-projet.json');
    copyFileSync(join(RACINE, 'scripts', 'migrations', script), join(dir, 'scripts', 'migrations', script));
    writeFileSync(cible, canonique(doc), 'utf8');
    const avant = readFileSync(cible, 'utf8');
    let code = 0;
    let err = '';
    try {
      execFileSync(process.execPath, [join(dir, 'scripts', 'migrations', script)], { encoding: 'utf8', stdio: 'pipe' });
    } catch (e) {
      code = (e as { status?: number }).status ?? 1;
      // Le MOTIF du refus, pas seulement son code : deux refus distincts sortent tous deux 1.
      err = String((e as { stderr?: string; stdout?: string }).stderr ?? '') + String((e as { stdout?: string }).stdout ?? '');
    }
    return { code, err, avant, apres: readFileSync(cible, 'utf8') };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe(`${SCRIPT_13} — le bump de forme 4 → 5 (aplatissement de la poche \`meta\`)`, () => {
  it('t1. schema 4 : la poche est APLATIE à sa place, `version` devient `versionContenu`', () => {
    const { code, apres } = joue(SCRIPT_13, projet({}));
    expect(code).toBe(0);
    const doc = JSON.parse(apres) as Record<string, unknown>;
    expect(doc.schema).toBe(5);
    expect('meta' in doc).toBe(false);
    expect(doc.versionContenu).toBe(3);
    // L'ORDRE des clés est celui de l'artefact généré : l'identité prend la place de `meta`.
    expect(Object.keys(doc)).toEqual(['schema', 'id', 'label', 'icon', 'versionContenu', 'narratif', 'scenes']);
    // La charge utile ne bouge pas.
    expect(doc.scenes).toEqual([{ id: 's1', nom: 'Une salle', desc: 'Prose.', dimensions: { w: 4, h: 4 } }]);
  });

  it('t2. schema 5 (état de l’arbre) : NO-OP, fichier byte-identique', () => {
    const deja = { schema: 5, id: 'camp', label: 'Campagne', icon: 'scenario/village', versionContenu: 3, narratif: { affaires: [], indices: [], presetsPnj: [], objets: [] }, scenes: [] };
    const { code, avant, apres } = joue(SCRIPT_13, deja);
    expect(code).toBe(0);
    expect(apres).toBe(avant);
  });

  it('t3. schema 3 (non encore bumpé par 3i) → fail-fast, rien d’écrit', () => {
    const { code, avant, apres } = joue(SCRIPT_13, projet({ schema: 3 }));
    expect(code).toBe(1);
    expect(apres).toBe(avant);
  });

  it('t4. forme HYBRIDE (schema 4 mais identité déjà à plat) → fail-fast, rien d’écrit', () => {
    const hybride = { schema: 4, id: 'camp', versionContenu: 3, narratif: { affaires: [], indices: [], presetsPnj: [], objets: [] }, scenes: [] };
    const { code, avant, apres } = joue(SCRIPT_13, hybride);
    expect(code).toBe(1);
    expect(apres).toBe(avant);
  });

  it('t5. `meta` présent mais non-objet → fail-fast, rien d’écrit', () => {
    const { code, avant, apres } = joue(SCRIPT_13, projet({ meta: 'camp' }));
    expect(code).toBe(1);
    expect(apres).toBe(avant);
  });

  it('t6. RATTRAPAGE : un `schema` FUTUR (7), avalé par `3i` ET par la 13, est REFUSÉ par la DERNIÈRE de la chaîne', () => {
    const futur = { schema: 7, narratif: { affaires: [], indices: [], presetsPnj: [], objets: [] }, scenes: [] };
    // Les migrations AMONT ont une borne ouverte vers le haut : chacune a été élargie quand la vague
    // suivante a bumpé le même document. Elles avalent donc l'inconnu — c'est le trou.
    expect(joue(SCRIPT_3I, futur).code, '3i avale le futur en silence').toBe(0);
    expect(joue(SCRIPT_13, futur).code, 'la 13 avale le futur en silence').toBe(0);
    // La 15b, DERNIÈRE dans l'ordre lexical, le NOMME : le rejeu sort rouge, pas muet. C'est l'invariant
    // de la chaîne — il se DÉPLACE à chaque bump, il ne disparaît jamais.
    const { code, avant, apres } = joue(SCRIPT_15B, futur);
    expect(code, 'la dernière migration doit refuser un schema hors {5,6}').toBe(1);
    expect(apres).toBe(avant);
  });
});

describe(`${SCRIPT_3I} — RETOUCHÉ : son contrat de sortie par \`schema\``, () => {
  const narratif = { affaires: [], indices: [], presetsPnj: [], objets: [] };

  it('schema 2 (antérieur à sa borne) → fail-fast, rien d’écrit', () => {
    const { code, avant, apres } = joue(SCRIPT_3I, { schema: 2, narratif, scenes: [] });
    expect(code).toBe(1);
    expect(apres).toBe(avant);
  });

  it('schema 3 → bumpé à 4, charge utile INTACTE', () => {
    const doc = projet({ schema: 3 });
    const { code, apres } = joue(SCRIPT_3I, doc);
    expect(code).toBe(0);
    const apresDoc = JSON.parse(apres) as Record<string, unknown>;
    expect(apresDoc.schema).toBe(4);
    const { schema: _a, ...resteApres } = apresDoc;
    const { schema: _b, ...resteAvant } = doc;
    expect(resteApres).toEqual(resteAvant);
  });

  it('schema 4, 5 ET 6 → NO-OP byte-identique (la retouche : sans elle, l’arbre bumpé sortait ROUGE au rejeu)', () => {
    for (const schema of [4, 5, 6]) {
      const { code, avant, apres } = joue(SCRIPT_3I, { schema, narratif, scenes: [] });
      expect(code, `schema ${schema} doit être reconnu « déjà migré »`).toBe(0);
      expect(apres, `schema ${schema} doit rester byte-identique`).toBe(avant);
    }
  });

  it('`schema` non numérique → fail-fast NOMMÉ (jamais absorbé par la borne « ≥ 4 »)', () => {
    const { code, avant, apres } = joue(SCRIPT_3I, { schema: 'quatre', narratif, scenes: [] });
    expect(code).toBe(1);
    expect(apres).toBe(avant);
  });
});

describe(`${SCRIPT_15B} — le bump 5 → 6 (\`label\` de scène/carte, statblocs annoncés)`, () => {
  const narratif = { affaires: [], indices: [], presetsPnj: [], objets: [] };

  /** Document au format 5 GELÉ ICI : la forme d'ENTRÉE ne bouge plus quoi qu'il arrive à l'arbre. */
  function projet5(over: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      schema: 5,
      id: 'camp',
      label: 'Campagne',
      icon: 'scenario/village',
      versionContenu: 3,
      narratif,
      scenes: [{
        id: 's1',
        nom: 'Une salle',
        desc: 'Prose.',
        dimensions: { w: 4, h: 4 },
        entities: [
          { id: 'e1', kind: 'personnage', pos: { x: 1, y: 1 }, statblock: { label: 'Rat géant', char: { B: 5 } } },
          { id: 'e2', kind: 'prop', pos: { x: 2, y: 2 }, ref: 'tonneau' },
        ],
      }],
      worldMap: { id: 'w1', nom: 'La carte', places: [], routes: [] },
      ...over,
    };
  }

  it('t1. schema 5 : `nom` devient `label` À SA POSITION (scène ET carte), le statbloc s’annonce', () => {
    const { code, apres } = joue(SCRIPT_15B, projet5());
    expect(code).toBe(0);
    const doc = JSON.parse(apres) as Record<string, unknown>;
    expect(doc.schema).toBe(6);
    const scene = (doc.scenes as Record<string, unknown>[])[0];
    // POSITION : `label` occupe la place qu'occupait la clé de libellé, pas la fin de l'objet.
    expect(Object.keys(scene)).toEqual(['id', 'label', 'desc', 'dimensions', 'entities']);
    expect(scene.label).toBe('Une salle');
    expect(Object.keys(doc.worldMap as object)).toEqual(['id', 'label', 'places', 'routes']);
    expect((doc.worldMap as { label: string }).label).toBe('La carte');
    // `type` en 1ʳᵉ clé du profil, le reste du statbloc intact.
    const ents = scene.entities as Record<string, unknown>[];
    expect(Object.keys(ents[0].statblock as object)).toEqual(['type', 'label', 'char']);
    expect(ents[0].statblock).toEqual({ type: 'statblock', label: 'Rat géant', char: { B: 5 } });
    // Une entité SANS statbloc traverse INTACTE (témoin positif : rien n'est posé au hasard).
    expect(ents[1]).toEqual({ id: 'e2', kind: 'prop', pos: { x: 2, y: 2 }, ref: 'tonneau' });
    // Le reste du document ne bouge pas.
    expect(doc.id).toBe('camp');
    expect(doc.versionContenu).toBe(3);
    expect(doc.narratif).toEqual(narratif);
  });

  it('t2. schema 6 (état de l’arbre) : NO-OP, fichier byte-identique', () => {
    const deja = { schema: 6, id: 'camp', versionContenu: 3, narratif, scenes: [{ id: 's1', label: 'Une salle', dimensions: { w: 1, h: 1 } }] };
    const { code, avant, apres } = joue(SCRIPT_15B, deja);
    expect(code).toBe(0);
    expect(apres).toBe(avant);
  });

  it('t3. schema 4 (non encore bumpé par la 13) → fail-fast, rien d’écrit', () => {
    const { code, avant, apres } = joue(SCRIPT_15B, projet5({ schema: 4 }));
    expect(code).toBe(1);
    expect(apres).toBe(avant);
  });

  it('t4. une scène portant À LA FOIS `nom` et `label` → fail-fast, rien d’écrit', () => {
    const hybride = projet5({ scenes: [{ id: 's1', nom: 'A', label: 'B', dimensions: { w: 1, h: 1 } }] });
    const { code, avant, apres } = joue(SCRIPT_15B, hybride);
    expect(code).toBe(1);
    expect(apres).toBe(avant);
  });

  it('t5. un statbloc portant DÉJÀ un `type` étranger → fail-fast (la migration ne l’écrase pas)', () => {
    const etranger = projet5({
      scenes: [{ id: 's1', nom: 'A', dimensions: { w: 1, h: 1 }, entities: [{ id: 'e1', statblock: { type: 'creature', label: 'X', char: {} } }] }],
    });
    const { code, avant, apres } = joue(SCRIPT_15B, etranger);
    expect(code).toBe(1);
    expect(apres).toBe(avant);
  });

  it('t6. une scène SANS libellé (ni `nom` ni `label`) → fail-fast, rien d’écrit', () => {
    const muette = projet5({ scenes: [{ id: 's1', dimensions: { w: 1, h: 1 } }] });
    const { code, avant, apres } = joue(SCRIPT_15B, muette);
    expect(code).toBe(1);
    expect(apres).toBe(avant);
  });

  /**
   * S4 — L'ORDRE LEXICAL EST PORTEUR pour les trois migrations de FORME : elles écrivent les MÊMES
   * fichiers et composent une CHAÎNE (3→4, 4→5, 5→6). La prose de `scripts/migrations/replay.mjs`
   * affirme que le tri des noms coïncide avec l'ordre des bumps ; sans ce test, cette affirmation ne
   * serait qu'une intention — un nom de migration mal choisi la casserait EN SILENCE au rejeu.
   */
  it('S4. jouée HORS ORDRE (15b la première sur un `schema: 3`), la chaîne REFUSE — l’ordre lexical est porteur', () => {
    const brut3 = { schema: 3, meta: { id: 'camp', version: 1 }, narratif, scenes: [{ id: 's1', nom: 'Une salle', dimensions: { w: 1, h: 1 } }] };
    // Hors ordre : la dernière du tri ne sait pas lire l'entrée de la première.
    const horsOrdre = joue(SCRIPT_15B, brut3);
    expect(horsOrdre.code, 'la 15b doit REFUSER un schema 3 (elle n’accepte que 5 ou 6)').toBe(1);
    // Le refus se NOMME : sans cette assertion, une 15b qui « avale » le 3 puis échoue à sa
    // vérification post-écriture sortirait AUSSI 1, et le test resterait vert sur un contrat rompu.
    expect(horsOrdre.err, 'le refus doit NOMMER le `schema` inattendu').toMatch(/`schema` inattendu 3/);
    expect(horsOrdre.apres, 'rien ne doit être écrit sur un refus').toBe(horsOrdre.avant);
    // DANS l'ordre : 3i puis 13 puis 15b amènent le MÊME document au format courant.
    expect(joue(SCRIPT_3I, brut3).code).toBe(0);
    const apres3i = JSON.parse(joue(SCRIPT_3I, brut3).apres) as Record<string, unknown>;
    expect(apres3i.schema).toBe(4);
    const apres13 = JSON.parse(joue(SCRIPT_13, apres3i).apres) as Record<string, unknown>;
    expect(apres13.schema).toBe(5);
    const apres15b = JSON.parse(joue(SCRIPT_15B, apres13).apres) as Record<string, unknown>;
    expect(apres15b.schema).toBe(6);
    expect((apres15b.scenes as Record<string, unknown>[])[0].label).toBe('Une salle');
    // La CONDITION que la prose énonce : le tri des NOMS suit l'ordre des bumps.
    expect([SCRIPT_3I, SCRIPT_13, SCRIPT_15B].slice().sort()).toEqual([SCRIPT_3I, SCRIPT_13, SCRIPT_15B]);
  });
});
