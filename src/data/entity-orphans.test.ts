import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import {
  loadCategoryIds, buildConsumerCorpus, isConsumed, computeFieldPredicateConsumers, META_CATALOG_ENTRIES,
  sceneConsumerCorpus, EXCLUDED_CATEGORY_FILES,
} from '../../scripts/guards/lib/entityConsumers.mjs';
import { ENTITY_ORPHAN_RATCHET } from '../../scripts/guards/lib/entityOrphanStock.mjs';

/**
 * Cliquet décroissant des entités de catalogue SANS CONSOMMATEUR (généralise `tables.json`/#734 à
 * `traits`/`talents`/`qualities`/`maneuvers`/`skills`/`props`/`vehicles` — périmètre retenu/écarté,
 * définition d'un consommateur, angles morts déclarés : cf. l'en-tête de
 * `scripts/docs/build-entity-orphans.mjs`). Rapport généré : `docs/orphelines-donnees.md`.
 */
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DATA_DIR = `${ROOT}src/data`;
const SRC_DIR = `${ROOT}src`;

/** Plafond du stock cliqueté (même patron que `MANUAL_DOCS_MAX`, `src/data/manual-docs-ratchet.test.ts`) :
 *  vit ICI, dans le test, jamais dans `entityOrphanStock.mjs` — sans lui, le chemin le plus court
 *  pour « solder » une orpheline neuve resterait d'ajouter une ligne au stock, CI verte. */
const MAX_ENTITY_ORPHANS = 15;

describe('cliquet — toute entité de catalogue retenu a un CONSOMMATEUR (curée, non atteinte = dette)', () => {
  const corpus = buildConsumerCorpus(DATA_DIR, SRC_DIR);
  const ids = loadCategoryIds(DATA_DIR);
  const { consumed: fieldConsumed } = computeFieldPredicateConsumers(DATA_DIR, SRC_DIR);
  const isEntityConsumed = (cat: string, id: string) =>
    isConsumed(corpus, id) || fieldConsumed.get(cat)?.has(id) || META_CATALOG_ENTRIES.has(`${cat}:${id}`);

  const orphans: string[] = [];
  for (const [cat, catIds] of Object.entries(ids)) {
    for (const id of catIds) {
      if (!isEntityConsumed(cat, id)) orphans.push(`${cat}:${id}`);
    }
  }

  it('aucune entité NEUVE sans consommateur hors du stock — câbler, jamais stocker', () => {
    const neuves = orphans.filter((key) => !ENTITY_ORPHAN_RATCHET.has(key));
    expect(neuves, `entité(s) NEUVE(s) sans consommateur — câbler (donnée qui la référence, ou code) :\n${neuves.join('\n')}`).toEqual([]);
  });

  it('le stock cliqueté ne peut que DÉCROÎTRE — toute entrée désormais consommée en sort', () => {
    const soldees = [...ENTITY_ORPHAN_RATCHET].filter((key) => !orphans.includes(key));
    expect(soldees, `entrée(s) du stock désormais consommée(s) — retirer leur ligne de entityOrphanStock.mjs :\n${soldees.join('\n')}`).toEqual([]);
  });

  it('le stock cliqueté ne GROSSIT pas — sa taille est plafonnée par le test', () => {
    expect(
      ENTITY_ORPHAN_RATCHET.size,
      `ENTITY_ORPHAN_RATCHET a GONFLÉ (${ENTITY_ORPHAN_RATCHET.size} > ${MAX_ENTITY_ORPHANS}) — une orpheline neuve se câble, jamais ne se stocke.`,
    ).toBeLessThanOrEqual(MAX_ENTITY_ORPHANS);
  });
});

describe('corpus des SCÈNES — le contenu joué CONSOMME, ce qu\'il pose ne consomme pas', () => {
  const sceneCorpus = sceneConsumerCorpus(SRC_DIR);
  // Corpus dans la configuration des catalogues ÉCARTÉS : c'est la seule où un `trapping` est privé de
  // sa PROPRE déclaration (sinon `trappings.json` se cite lui-même et tout témoin serait vicié).
  const withScenes = buildConsumerCorpus(DATA_DIR, SRC_DIR, EXCLUDED_CATEGORY_FILES);
  const withoutScenes = withScenes.replace(sceneCorpus, '');

  it('une entité citée UNIQUEMENT par une scène est CONSOMMÉE — les documents de projet sont dans le corpus', () => {
    // `bonnet-de-fou` est octroyé par un `effect.trappingId` de `arene-projet.json` et n'apparaît
    // nulle part ailleurs : c'est l'un des 15 gains mesurés du corpus élargi (#1553 L2).
    expect(isConsumed(withoutScenes, 'bonnet-de-fou'), 'témoin VICIÉ : cet id est aussi cité hors des scènes — en choisir un autre parmi les gains mesurés').toBe(false);
    expect(isConsumed(withScenes, 'bonnet-de-fou'), "cité par une scène mais absent du corpus partagé — `buildConsumerCorpus` n'agrège plus `sceneConsumerCorpus`").toBe(true);
  });

  it("l'id PROPRE d'une entité posée ne consomme RIEN — poser n'est pas citer", () => {
    // Témoin réel et HOMONYME : `arene-projet.json` pose un PERSONNAGE d'id `chaland` (un badaud,
    // sans `ref`) ; `chaland` est par ailleurs une entrée de `vehicles.json` (une embarcation).
    const arene = JSON.parse(readFileSync(`${ROOT}src/scenes/arene/arene-projet.json`, 'utf8'));
    const pose = arene.scenes.flatMap((s: { entities?: { id: string; ref?: string }[] }) => s.entities ?? [])
      .find((e: { id: string }) => e.id === 'chaland');
    expect(pose, 'témoin VIDE : plus aucune entité posée ne porte l\'id `chaland` — rebaser le témoin sur une autre identité propre').toBeTruthy();
    expect(pose.ref, 'témoin VICIÉ : cette entité porte désormais un `ref`, qui est une vraie citation').toBeUndefined();
    expect(isConsumed(sceneCorpus, 'chaland')).toBe(false);
  });
});

describe('docs/orphelines-donnees.md — le rapport GÉNÉRÉ est à jour', () => {
  it('régénéré en mémoire == committé (sinon : npm run docs:orphelines)', async () => {
    const { execFileSync } = await import('node:child_process');
    const out = execFileSync(process.execPath, ['scripts/docs/build-entity-orphans.mjs', '--check'], { cwd: ROOT, encoding: 'utf8' });
    expect(out).toMatch(/^docs:orphelines — OK/);
  });
});
