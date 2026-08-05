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
import { QUAD_HEAD_DEFS } from './heads/_registry.generated';
import { QUAD_TAIL_DEFS } from './tails/_registry.generated';

const SRC = readFileSync(fileURLToPath(new URL('./quadParts.ts', import.meta.url)), 'utf8');
const LINES = SRC.split(/\r?\n/);
/** Ligne de PROSE (`//`, ouverture ou corps de bloc). Une mention d'`far` dans un commentaire ne
 *  branche rien : la compter donne du mou au plafond, qu'une extraction pourrait « solder » en
 *  réécrivant une phrase. 3 lignes concernées au 2026-08-04 (`quadParts.ts:292,318,988`). */
const isComment = (l: string) => /^\s*(\/\/|\/\*|\*)/.test(l);
const CODE = LINES.filter((l) => !isComment(l));
const CODE_SRC = CODE.join('\n');

/**
 * PLAFONDS (mesurés le 2026-08-04 sur l'arbre du Lot A-bis, lignes de commentaire exclues), abaissés
 * le 2026-08-05 par l'extraction des TÊTES en part-defs (#1082 P2) :
 *   - têtes 14 clés / 51 sites → 0/0 : les 14 arts vivent dans `heads/defs/<clé>.ts`, le socle compose
 *     par lookup (`quadHeadDef`) ; la population n'a pas disparu, elle a CHANGÉ DE PORTEUR (cf. le test
 *     « le stock des têtes a MIGRÉ » ci-dessous, qui compte les defs du registre).
 *   - `far` 43 → 30 : les 13 lignes emportées sont celles des têtes-satellites des clusters
 *     (hydre/déchiqueteur, rang proche/lointain), parties dans `heads/kit.ts`.
 *   - scalaires 16 → 13 : les 3 lignes emportées sont les arts paramétrés par `neckLen` (les 3 clusters),
 *     devenus des arts-FONCTION à axes déclarés dans leur def.
 * Jamais relevés.
 */
const MAX_HEAD_KEYS = 0;
const MAX_HEAD_SITES = 0;
const MAX_FAR_LINES = 30;
const MAX_WING_STATE_LINES = 3;
const MAX_SPECIES_SCALAR_LINES = 13;
const MAX_TAIL_SITES = 0; // 20 sites avant l'extraction des QUEUES en defs (2026-08-05)

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

  it('les plafonds encore peuplés mesurent bien quelque chose : chaque compte est non nul', () => {
    expect(linesMatching(/\bfar\b/)).toBeGreaterThan(0);
    expect(linesMatching(/wings === 'spread'|wings: 'folded'/)).toBeGreaterThan(0);
    expect(linesMatching(/\$\{-?L ?\*|\* p\.(bodyLen|neckLen|girth|tailLen|wingSpan|headScale)/)).toBeGreaterThan(0);
  });

  it('le détecteur de jetons n\'est pas mort avec son stock : il voit encore la forme qu\'il compte', () => {
    // Un plafond à 0 dont la sonde ne détecterait plus rien serait un cliquet FANTÔME : on éprouve
    // la regex sur un témoin (la forme exacte que l'extraction a supprimée du socle).
    const temoin = "  if (p.head === 'hydre') return '';";
    expect([...temoin.matchAll(/p\.head === '([a-z-]+)'/g)].map((m) => m[1])).toEqual(['hydre']);
  });

  it('le stock des têtes a MIGRÉ, il n\'a pas disparu : 14 defs enregistrées', () => {
    // Le pendant du plafond à 0 : les 14 clés d'espèce autrefois branchées dans le socle sont
    // désormais des fichiers du registre. Blanchir le socle en SUPPRIMANT des têtes échoue ici.
    expect(QUAD_HEAD_DEFS.length).toBeGreaterThanOrEqual(14);
    expect(new Set(QUAD_HEAD_DEFS.map((d) => d.key)).size).toBe(QUAD_HEAD_DEFS.length);
  });

  it('jetons `p.tail === <clé>` : 20 sites avant l\'extraction des queues, 0 après', () => {
    expect((CODE_SRC.match(/p\.tail === '[a-z-]+'/g) ?? []).length).toBeLessThanOrEqual(MAX_TAIL_SITES);
    expect((CODE_SRC.match(/p\.tail !==|switch\s*\(\s*p\.tail\s*\)|\[\s*p\.tail\s*\]/g) ?? []).length,
      'forme d\'aiguillage par queue invisible au compte des jetons').toBe(0);
    expect([...":p.tail === 'crin'".matchAll(/p\.tail === '[a-z-]+'/g)].length, 'détecteur mort').toBe(1);
  });

  it('le stock des queues a MIGRÉ : 11 defs enregistrées', () => {
    expect(QUAD_TAIL_DEFS.length).toBeGreaterThanOrEqual(11);
    expect(new Set(QUAD_TAIL_DEFS.map((d) => d.key)).size).toBe(QUAD_TAIL_DEFS.length);
  });
});
