/**
 * FORME UNIQUE du dé dans la donnée AUTHORÉE (#1463, vague `de`).
 *
 * Le mode de panne fermé ici est la 4ᵉ CLÉ posée sur un descripteur de dé : `miscast.json` a écrit
 * quatre ans durant `{n, sides, sinPlus:true}` — un dé porteur d'un drapeau que seul
 * `engine/miscast.ts` savait lire, invisible au `DiceSpec` du moteur (`src/engine/dice.ts`) comme à
 * `rollDice`/`formatDice`. Un dé authoré n'a que `{n, sides, plus?}` ; ce que le RAW ajoute au dé
 * (« 1d10 + (Points de Péché) », LDB 40 l.58/62/65/68/73/75) est un TERME DE FORMULE
 * (`{sum:[{dice}, {sinPoints:true}]}`), jamais une clé de plus sur le dé.
 *
 * La sonde marche la DONNÉE des 2 racines authorées (`src/data`, `src/scenes`), jamais le code.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const RACINES = ['src/data', 'src/scenes'];
/** Les 3 seules clés d'un `DiceSpec` (`src/engine/dice.ts`). */
const CANON = ['n', 'sides', 'plus'];

function fichiers(): { chemin: string; doc: unknown }[] {
  const out: { chemin: string; doc: unknown }[] = [];
  const marcher = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) marcher(p);
      else if (e.name.endsWith('.json')) out.push({ chemin: path.relative(ROOT, p).replace(/\\/g, '/'), doc: JSON.parse(fs.readFileSync(p, 'utf8')) });
    }
  };
  for (const r of RACINES) marcher(path.join(ROOT, r));
  return out;
}

/** Marche TOUT nœud objet d'un document, en donnant à `visiter` ses clés. */
function marcherObjets(noeud: unknown, visiter: (o: Record<string, unknown>) => void): void {
  if (Array.isArray(noeud)) { for (const e of noeud) marcherObjets(e, visiter); return; }
  if (noeud == null || typeof noeud !== 'object') return;
  visiter(noeud as Record<string, unknown>);
  for (const v of Object.values(noeud)) marcherObjets(v, visiter);
}

const FICHIERS = fichiers();

describe('dé — forme UNIQUE dans la donnée authorée (#1463)', () => {
  it('un descripteur de dé n’a JAMAIS d’autre clé que `n`/`sides`/`plus`', () => {
    const signatures: Record<string, number> = {};
    const offenders: string[] = [];
    for (const { chemin, doc } of FICHIERS) marcherObjets(doc, (o) => {
      const cles = Object.keys(o);
      if (!cles.includes('n') || !cles.includes('sides')) return;
      const sig = [...cles].sort().join(',');
      signatures[sig] = (signatures[sig] ?? 0) + 1;
      if (cles.some((k) => !CANON.includes(k))) offenders.push(`${chemin} {${sig}}`);
    });

    expect(offenders, 'dé(s) portant une clé HORS `DiceSpec` — ce que le RAW ajoute au dé est un terme de formule').toEqual([]);

    // Les SIGNATURES écrites sont les deux formes du `DiceSpec`, et rien d'autre. Aucun compte n'est
    // figé ici : un dé authoré de plus est une donnée neuve, pas une régression — le cardinal, lui,
    // est asserté par la migration (`scripts/migrations/2026-09-01-1463-de-sin-points.mjs`).
    expect(Object.keys(signatures).sort(), 'signatures de dé observées').toEqual(['n,plus,sides', 'n,sides']);
    expect(
      Object.values(signatures).reduce((a, b) => a + b, 0),
      'le corpus de dés a FONDU sous la mesure de référence (134) : la sonde ne mesure plus ce qu’elle croit.',
    ).toBeGreaterThanOrEqual(134);
  });
});
