import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { effectTables, findEffectTableById, mutationTables } from './index';
import { TABLE_ORPHAN_RATCHET } from '../../scripts/guards/lib/tableConsumerStock.mjs';

/**
 * Intégrité de `tables.json` (tables d'effets référençables) + BIEN-FORMATION des ops `rollTable`/
 * `rollMutation` dans TOUS les `src/data/*.json` : `gameOpSchema` est LOOSE (seul `op` validé), donc les
 * contraintes XOR (`rows` ⊕ `tableId`) et la résolution des refs (`tableId` → tables.json ; `table` →
 * mutationTables.json) vivent ICI (jamais un tirage vers une table fantôme au runtime).
 */
const DIR = fileURLToPath(new URL('.', import.meta.url));
const files = readdirSync(DIR).filter((f) => f.endsWith('.json') && !f.startsWith('_'));
const effectIds = new Set(effectTables.map((t) => t.id));
const mutationTableIds = new Set(mutationTables.map((t) => t.id));

/** Collecte toutes les ops d'un `op` donné, en profondeur, de tous les datasets. */
function collectOps(op: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const walk = (n: unknown): void => {
    if (Array.isArray(n)) return void n.forEach(walk);
    if (!n || typeof n !== 'object') return;
    const o = n as Record<string, unknown>;
    if (o.op === op && !('kind' in o)) out.push(o);
    for (const v of Object.values(o)) walk(v);
  };
  for (const f of files) walk(JSON.parse(readFileSync(join(DIR, f), 'utf8')));
  return out;
}

describe('tables.json — tables d’effets référençables', () => {
  it('chaque table : id unique, die valide, rangées non vides, source citée', () => {
    const seen = new Set<string>();
    for (const t of effectTables) {
      expect(seen.has(t.id), `id dupliqué : ${t.id}`).toBe(false);
      seen.add(t.id);
      expect(['d10', 'd100']).toContain(t.die);
      expect(t.rows.length).toBeGreaterThan(0);
      expect(t.source?.book, `${t.id} sans source`).toBeTruthy();
      for (const r of t.rows) expect(r.min).toBeLessThanOrEqual(r.max);
    }
  });

  it('les 4 colonnes du Tableau des aspects démoniaques (EDOC 13) existent, 10 rangées chacune', () => {
    for (const dom of ['nurgle', 'slaanesh', 'tzeentch', 'indivisible']) {
      const t = findEffectTableById(`allure-demoniaque-${dom}`);
      expect(t.rows).toHaveLength(10);
      expect(t.die).toBe('d10');
    }
  });

  it('findEffectTableById fail-fast sur un id inconnu', () => {
    expect(() => findEffectTableById('inexistante')).toThrow(/introuvable/i);
  });
});

describe('bien-formation des ops rollTable / rollMutation (tous les datasets)', () => {
  it('rollTable : EXACTEMENT un de `rows` ⊕ `tableId`', () => {
    const bad = collectOps('rollTable').filter((o) => ('rows' in o) === ('tableId' in o));
    expect(bad, `rollTable doit porter rows OU tableId (jamais les deux, jamais aucun) :\n${JSON.stringify(bad)}`).toEqual([]);
  });

  it('rollTable.tableId résout dans tables.json', () => {
    const bad = collectOps('rollTable').filter((o) => 'tableId' in o && !effectIds.has(o.tableId as string));
    expect(bad, `tableId introuvable :\n${JSON.stringify(bad)}`).toEqual([]);
  });

  it('rollMutation.table résout dans mutationTables.json', () => {
    const bad = collectOps('rollMutation').filter((o) => !mutationTableIds.has(o.table as string));
    expect(bad, `table de mutation introuvable :\n${JSON.stringify(bad)}`).toEqual([]);
  });
});

describe('cliquet — toute table d’effets a un CONSOMMATEUR (donnée écrite, non tirée = dette)', () => {
  const MAX_TABLE_ORPHAN = 2;

  /** Corpus des consommateurs : `tables.json` privé de ses seules DÉCLARATIONS d'id (pour que les
   *  `tableId` d'une table vers une autre comptent), les autres données `src/data/*.json`, + le code
   *  de prod `src/**` (hors tests, COMMENTAIRES retirés — sinon un id cité en commentaire « solde »
   *  une orpheline sans câblage réel). */
  function consumerCorpus(): string {
    let corpus = '';
    for (const f of files) {
      const raw = readFileSync(join(DIR, f), 'utf8');
      corpus += f === 'tables.json' ? raw.replace(/"id":\s*"[^"]*"\s*,\s*(?="label")/g, '') : raw;
    }
    const stripComments = (src: string): string =>
      src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const walk = (d: string): void => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name)) corpus += stripComments(readFileSync(p, 'utf8'));
      }
    };
    walk(join(DIR, '..'));
    return corpus;
  }

  /** Un id compte comme consommé s'il apparaît comme jeton de chaîne CITÉ complet (`"<id>"` ou
   *  `'<id>'`) — jamais une sous-chaîne nue (prose, id plus long, mention non citée). */
  const isConsumed = (corpus: string, id: string): boolean =>
    corpus.includes(`"${id}"`) || corpus.includes(`'${id}'`);

  it('chaque table est portée par une donnée ou le code de prod — les orphelines vivent dans le stock, qui ne gonfle jamais', () => {
    const corpus = consumerCorpus();
    const orphans = effectTables.map((t) => t.id).filter((id) => !isConsumed(corpus, id));
    const neuves = orphans.filter((id) => !TABLE_ORPHAN_RATCHET.has(id));
    expect(neuves, `table(s) NEUVE(s) sans consommateur — câbler, jamais stocker :\n${neuves.join('\n')}`).toEqual([]);
    const soldees = [...TABLE_ORPHAN_RATCHET].filter((id) => !orphans.includes(id));
    expect(soldees, `id(s) du stock désormais consommés — retirer leur ligne de tableConsumerStock.mjs :\n${soldees.join('\n')}`).toEqual([]);
    expect(TABLE_ORPHAN_RATCHET.size, `TABLE_ORPHAN_RATCHET a GONFLÉ (${TABLE_ORPHAN_RATCHET.size} > ${MAX_TABLE_ORPHAN}) — une orpheline neuve se câble, jamais ne se stocke.`).toBeLessThanOrEqual(MAX_TABLE_ORPHAN);
  });
});
