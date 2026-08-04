/**
 * SOCLE QUADRUPÈDE — cliquet de branchement par espèce (#1082, phase P2 : extraction).
 *
 * PÉRIMÈTRE MESURÉ : le SEUL fichier `src/gameIso/rig/quadruped/quadParts.ts`, par les quatre regex
 * énumérées ci-dessous. Aucun autre plan de corps n'entre dans cette mesure : le bipède, les nuées,
 * les navires et les registres de parts (`parts/monster`, `parts/elements`) ont leurs propres gardes
 * (`parts/monster/rig-part-views.test.ts`, `parts/tenues/part-view-format.test.ts`).
 *
 * Les quatre comptes décrivent le degré de branchement du socle : les jetons `p.head === '<clé>'`
 * (aiguillage par espèce), les lignes portant l'axe `far` (profondeur du membre éloigné), les lignes
 * d'état d'aile, et les lignes de coordonnées calculées depuis un scalaire d'espèce. Ils DÉCROISSENT
 * au fil de l'extraction ; le cliquet échoue si l'un DÉPASSE son plafond. Baissés à chaque
 * extraction ; jamais relevés.
 *
 * NATURE de la mesure : TEXTUELLE, sur les lignes de CODE du fichier (la prose est écartée, cf.
 * `isComment`). Elle relève une seule FORME d'aiguillage — l'égalité littérale `p.head === '<clé>'`.
 * Trois autres formes portent le même branchement sans être vues par ce compte : la négation
 * `p.head !==`, le `switch (p.head)`, et la table indexée `TABLE[p.head]`. Le test « aucune AUTRE
 * forme d'aiguillage » ci-dessous les mesure directement : leur population est 0 au 2026-08-04, et
 * y basculer du branchement pour faire baisser les plafonds échoue la garde.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SRC = readFileSync(fileURLToPath(new URL('./quadParts.ts', import.meta.url)), 'utf8');
const LINES = SRC.split(/\r?\n/);
/** Ligne de PROSE (`//`, ouverture ou corps de bloc). Une mention d'`far` dans un commentaire ne
 *  branche rien : la compter donne du mou au plafond, qu'une extraction pourrait « solder » en
 *  réécrivant une phrase. 3 lignes concernées au 2026-08-04 (`quadParts.ts:292,318,988`). */
const isComment = (l: string) => /^\s*(\/\/|\/\*|\*)/.test(l);
const CODE = LINES.filter((l) => !isComment(l));
const CODE_SRC = CODE.join('\n');

/** PLAFONDS gelés (mesurés le 2026-08-04 sur l'arbre du Lot A-bis, lignes de commentaire exclues). */
const MAX_HEAD_KEYS = 14;
const MAX_HEAD_SITES = 51;
const MAX_FAR_LINES = 43;
const MAX_WING_STATE_LINES = 3;
const MAX_SPECIES_SCALAR_LINES = 16;

const headSites = [...CODE_SRC.matchAll(/p\.head === '([a-z-]+)'/g)].map((m) => m[1]);
const linesMatching = (re: RegExp) => CODE.filter((l) => re.test(l)).length;

describe('socle quadrupède : le branchement par espèce ne peut que DÉCROÎTRE (#1082)', () => {
  it('jetons `p.head === <clé>` : clés distinctes et sites', () => {
    const keys = new Set(headSites);
    expect(keys.size, `clés d'espèce testées dans quadParts.ts : ${[...keys].sort().join(', ')}`)
      .toBeLessThanOrEqual(MAX_HEAD_KEYS);
    expect(headSites.length).toBeLessThanOrEqual(MAX_HEAD_SITES);
  });

  it('aucune AUTRE forme d\'aiguillage par espèce : le compte textuel resterait aveugle', () => {
    const compte = (re: RegExp) => (CODE_SRC.match(re) ?? []).length;
    expect(compte(/p\.head !==/g), 'négation `p.head !==` : branchement invisible au compte des jetons').toBe(0);
    expect(compte(/switch\s*\(\s*p\.head\s*\)/g), '`switch (p.head)` : branchement invisible au compte des jetons').toBe(0);
    expect(compte(/\[\s*p\.head\s*\]/g), 'table indexée par `p.head` : branchement invisible au compte des jetons').toBe(0);
  });

  it('lignes portant l\'axe `far`', () => {
    expect(linesMatching(/\bfar\b/)).toBeLessThanOrEqual(MAX_FAR_LINES);
  });

  it('lignes d\'état d\'aile', () => {
    expect(linesMatching(/wings === 'spread'|wings: 'folded'/)).toBeLessThanOrEqual(MAX_WING_STATE_LINES);
  });

  it('lignes de coordonnées calculées depuis un scalaire d\'espèce', () => {
    expect(linesMatching(/\$\{-?L ?\*|\* p\.(bodyLen|neckLen|girth|tailLen|wingSpan|headScale)/))
      .toBeLessThanOrEqual(MAX_SPECIES_SCALAR_LINES);
  });

  it('les plafonds mesurent bien quelque chose : chaque compte est non nul', () => {
    expect(headSites.length).toBeGreaterThan(0);
    expect(linesMatching(/\bfar\b/)).toBeGreaterThan(0);
    expect(linesMatching(/wings === 'spread'|wings: 'folded'/)).toBeGreaterThan(0);
    expect(linesMatching(/\$\{-?L ?\*|\* p\.(bodyLen|neckLen|girth|tailLen|wingSpan|headScale)/)).toBeGreaterThan(0);
  });
});
