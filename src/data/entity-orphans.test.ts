import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import {
  loadCategoryIds, buildConsumerCorpus, isConsumed, computeFieldPredicateConsumers, META_CATALOG_ENTRIES,
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

describe('docs/orphelines-donnees.md — le rapport GÉNÉRÉ est à jour', () => {
  it('régénéré en mémoire == committé (sinon : npm run docs:orphelines)', async () => {
    const { execFileSync } = await import('node:child_process');
    const out = execFileSync(process.execPath, ['scripts/docs/build-entity-orphans.mjs', '--check'], { cwd: ROOT, encoding: 'utf8' });
    expect(out).toMatch(/^docs:orphelines — OK/);
  });
});
