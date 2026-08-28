/**
 * LES MIGRATIONS DE FORMAT DU DOCUMENT DE PROJET, REJOUÉES SUR UN ARBRE JETABLE (#1467 L1b).
 *
 * Sœur de `src/data/migrations-type-enveloppe.test.ts`, MÊME doctrine : on exécute les VRAIS fichiers
 * de `scripts/migrations/` — copiés dans un arbre temporaire pour que leur `new URL('../../')` y
 * résolve — sur des fixtures GELÉES ici (aucun `git show` : un test qui en dépend casse en clone
 * superficiel). L'autre fichier tient la famille `type`→<clé métier> sur `src/data` ; celui-ci tient
 * la famille « bump de FORME » sur `src/scenes/<c>/<c>-projet.json`.
 *
 * DEUX scripts sont tenus ici :
 *  - `…-3i-projet-schema-4.mjs`, RETOUCHÉ par la vague 13 (il fail-fastait sur tout `schema` ∉ {3,4} ;
 *    lexicalement il précède la 13, donc sur l'arbre migré en `schema: 5` le rejeu sortait ROUGE) ;
 *  - `…-13-projet-forme.mjs`, NEUF et sans témoin committé.
 *
 * RETOUCHER UN SCRIPT DÉJÀ JOUÉ est le geste le plus risqué du lot. L'élargissement de `3i` en
 * « ≥ 4 = déjà migré » lui fait AVALER EN SILENCE un `schema` FUTUR inconnu ; ce qui rattrape ce trou
 * est la 13, qui refuse tout `schema` ∉ {4,5} en aval. Ce rattrapage n'était gardé par RIEN : il
 * l'est ici (cas `t6`).
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
function joue(script: string, doc: Record<string, unknown>): { code: number; avant: string; apres: string } {
  const dir = mkdtempSync(join(tmpdir(), 'mig-projet-'));
  try {
    mkdirSync(join(dir, 'scripts', 'migrations'), { recursive: true });
    mkdirSync(join(dir, 'src', 'scenes', 'camp'), { recursive: true });
    const cible = join(dir, 'src', 'scenes', 'camp', 'camp-projet.json');
    copyFileSync(join(RACINE, 'scripts', 'migrations', script), join(dir, 'scripts', 'migrations', script));
    writeFileSync(cible, canonique(doc), 'utf8');
    const avant = readFileSync(cible, 'utf8');
    let code = 0;
    try {
      execFileSync(process.execPath, [join(dir, 'scripts', 'migrations', script)], { encoding: 'utf8', stdio: 'pipe' });
    } catch (e) {
      code = (e as { status?: number }).status ?? 1;
    }
    return { code, avant, apres: readFileSync(cible, 'utf8') };
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

  it('t6. RATTRAPAGE : un `schema` FUTUR (6), avalé en silence par `3i`, est REFUSÉ par la 13', () => {
    const futur = { schema: 6, narratif: { affaires: [], indices: [], presetsPnj: [], objets: [] }, scenes: [] };
    // `3i` élargi le laisse passer (« ≥ 4 = déjà migré ») — c'est le trou.
    expect(joue(SCRIPT_3I, futur).code, '3i avale le futur en silence').toBe(0);
    // La 13, en aval dans l'ordre lexical, le NOMME : le rejeu sort rouge, pas muet.
    const { code, avant, apres } = joue(SCRIPT_13, futur);
    expect(code, 'la 13 doit refuser un schema hors {4,5}').toBe(1);
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

  it('schema 4 ET 5 → NO-OP byte-identique (la retouche : sans elle, 5 sortait ROUGE au rejeu)', () => {
    for (const schema of [4, 5]) {
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
