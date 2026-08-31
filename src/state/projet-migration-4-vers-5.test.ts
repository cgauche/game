/**
 * GARDE — `PROJECT_MIGRATIONS[4]` : un projet AUTHORÉ AVANT le lot #1467 L1b V-formeProjet se charge
 * encore.
 *
 * QUESTION : l'enveloppe du document de projet est devenue PLATE (la poche `meta` remonte à la
 * racine, `meta.version` devient `versionContenu`). Un `.json` exporté avant ce lot, resté dans une
 * bibliothèque utilisateur, traverse-t-il encore `parseProject` ?
 *
 * FIXTURE GELÉE : le document ci-dessous porte la forme `schema: 4` — poche `meta` incluse. Il est
 * FIGÉ ; le « moderniser » à l'enveloppe plate détruirait ce que la garde mesure.
 */
import { describe, expect, it } from 'vitest';
import { parseProject, CURRENT_PROJECT_SCHEMA } from './worldMap';

/** Document schema 4 — FIGÉ. Ne pas aplatir : c'est le sujet de la mesure. */
const PROJET_FORMAT_4 = {
  schema: 4,
  meta: {
    id: 'campagne-gelee-4',
    label: 'Campagne gelée (format 4)',
    icon: 'scenario/village',
    version: 7,
    desc: 'Prose de campagne, format 4.',
    auteur: 'Une autrice',
  },
  narratif: { affaires: [], indices: [], presetsPnj: [], objets: [] },
  scenes: [
    {
      id: 'quai',
      nom: 'Le quai',
      desc: 'Un quai de chargement, format 4.',
      dimensions: { w: 4, h: 4 },
    },
  ],
};

describe('PROJECT_MIGRATIONS[4] — un projet format 4 se charge à travers la migration (#1467 L1b)', () => {
  it('le document gelé est bien au format ANTÉRIEUR (sans quoi la garde ne mesurerait rien)', () => {
    expect(PROJET_FORMAT_4.schema).toBe(4);
    expect(PROJET_FORMAT_4.schema).toBeLessThan(CURRENT_PROJECT_SCHEMA);
    expect(PROJET_FORMAT_4).toHaveProperty('meta');
  });

  it('il se charge VERT, et l’identité ressort APLATIE à la racine', () => {
    const doc = parseProject(structuredClone(PROJET_FORMAT_4));
    expect(doc.id).toBe('campagne-gelee-4');
    expect(doc.label).toBe('Campagne gelée (format 4)');
    expect(doc.icon).toBe('scenario/village');
    expect(doc.desc).toBe('Prose de campagne, format 4.');
    expect(doc.auteur).toBe('Une autrice');
    expect(doc.scenes[0].desc).toBe('Un quai de chargement, format 4.');
  });

  it('`meta.version` devient `versionContenu` — et la poche `meta` ne survit PAS', () => {
    const doc = parseProject(structuredClone(PROJET_FORMAT_4)) as Record<string, unknown>;
    expect(doc.versionContenu).toBe(7);
    expect('meta' in doc).toBe(false);
    // La clé de TRAVAIL de `migrateDoc` (`worldMap.ts` pose `version: obj.schema`) ne fuit jamais
    // dans le document rendu : c'est ce qui rend le renommage nécessaire, et non cosmétique.
    expect('version' in doc).toBe(false);
  });

  it('un document format 4 SANS poche `meta` est REFUSÉ, et le refus NOMME les champs manquants', () => {
    // Identité REQUISE (#1552 — invariant et verbatim au contrat du schéma,
    // `src/data/schemas/defs-scenes/projet-schema.test.ts` cas (d bis)). Une migration n'invente ni id
    // ni libellé : le document traverse la chaîne tel quel et c'est la PORTE qui le refuse — en
    // nommant ce qui manque.
    const { meta: _sans, ...sansIdentite } = structuredClone(PROJET_FORMAT_4);
    expect(() => parseProject(sansIdentite)).toThrow(/id/);
    expect(() => parseProject(sansIdentite)).toThrow(/label/);
    expect(() => parseProject(sansIdentite)).toThrow(/versionContenu/);
  });

  it('P1 — un `version` RACINE est ÉCRASÉ puis PERDU en SILENCE : c’est ce que le renommage évite', () => {
    // MESURE du danger réel, contre l'intuition « collision → refus ». `parseProject` fait
    // `migrateDoc({ ...obj, version: obj.schema }, …)` : `version` est posé EN DERNIER, il écrase
    // donc celui du document ; puis la clé de travail est PURGÉE avant `validateDocument` et avant
    // le retour. Un numéro de CONTENU nommé `version` ne serait donc ni refusé ni signalé — il
    // DISPARAÎTRAIT à chaque chargement.
    const avecVersionRacine = { ...structuredClone(PROJET_FORMAT_4), version: 4242 };

    // (1) AUCUN refus : le document passe la porte sans lever.
    expect(() => parseProject(avecVersionRacine)).not.toThrow();

    // (2) La valeur 4242 ne ressort NULLE PART — perte totale et muette.
    const doc = parseProject(avecVersionRacine) as Record<string, unknown>;
    expect('version' in doc).toBe(false);
    expect(Object.values(doc)).not.toContain(4242);

    // (3) Ce qui SURVIT est le numéro de contenu, parce qu'il porte un AUTRE nom.
    expect(doc.versionContenu).toBe(7);
  });
});
