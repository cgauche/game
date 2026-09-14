/**
 * SOCLE QUADRUPÈDE — cliquet de branchement par espèce (#1082, phase P2 : extraction).
 *
 * PÉRIMÈTRE MESURÉ : le SEUL fichier `src/gameIso/rig/quadruped/quadParts.ts`, par les sept motifs
 * énumérés ci-dessous. Aucun autre plan de corps n'entre dans cette mesure : le bipède, les nuées,
 * les navires et les registres de parts (`parts/monster`, `parts/elements`) ont leurs propres gardes
 * (`parts/monster/rig-part-views.test.ts`, `parts/tenues/part-view-format.test.ts`).
 *
 * Deux natures de verdict, jamais mélangées :
 *   - QUATRE ABSENCES — aucun jeton `p.head === '<clé>'`, `p.tail === '<clé>'`, aucune comparaison à
 *     une clé de crinière : le socle ne connaît plus aucune espèce par son nom, les arts vivent dans
 *     `heads/defs/`, `tails/defs/`, `manes/defs/` et se composent par lookup. Le rouge NOMME le site
 *     qui rebranche (`toEqual([])`), il ne rend pas un compte.
 *   - TROIS COMPTES D'INSTRUMENT — l'axe `far`, l'état d'aile, les coordonnées dérivées d'un scalaire
 *     d'espèce. Ils ne sont PAS une dette à entrées : leur seule identité serait la ligne du FICHIER
 *     PORTEUR, que `scripts/guards/lib/stock.mjs:64-65` exclut nommément de toute clé de stock (elle
 *     dérive à chaque édition du fichier), ou son TEXTE, qui ne vaut pas mieux — 4 doublons EXACTS
 *     parmi les 30 lignes `far` ne seraient même pas distinguables entre eux. Ils se tiennent donc
 *     par ÉGALITÉ à la mesure du jour, sur un fichier UNIQUE, et se baissent dans le commit de chaque
 *     extraction — jamais un cran d'accueil au-dessus.
 *
 * NATURE de la mesure : TEXTUELLE, sur les lignes de CODE du fichier (la prose est écartée, cf.
 * `isComment`). Elle relève une seule FORME d'aiguillage — l'égalité littérale `p.head === '<clé>'`.
 * Trois autres formes portent le même branchement sans être vues par ce compte : la négation
 * `p.head !==`, le `switch (p.head)`, et la table indexée `TABLE[p.head]`. Le test « aucune AUTRE
 * forme d'aiguillage » ci-dessous les mesure directement : leur population est 0 au 2026-08-04, et
 * y basculer du branchement pour vider les absences échoue la garde.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { listerDossier } from '../../../../scripts/guards/lib/lister.mjs';
import { QUAD_HEAD_DEFS } from './heads/_registry.generated';
import { QUAD_TAIL_DEFS } from './tails/_registry.generated';
import { QUAD_MANE_DEFS } from './manes/_registry.generated';

const SRC = readFileSync(fileURLToPath(new URL('./quadParts.ts', import.meta.url)), 'utf8');
const LINES = SRC.split(/\r?\n/);
/** Ligne de PROSE (`//`, ouverture ou corps de bloc). Une mention d'`far` dans un commentaire ne
 *  branche rien : la compter FAUSSERAIT la mesure dans les deux sens — rouge sur un compte pourtant
 *  exact dès qu'une phrase est réécrite, vert sur une extraction incomplète dont le code cède la
 *  place à sa propre documentation. 1 ligne concernée au 2026-09-14 (`quadParts.ts:516`). */
const isComment = (l: string) => /^\s*(\/\/|\/\*|\*)/.test(l);
const CODE = LINES.filter((l) => !isComment(l));
const CODE_SRC = CODE.join('\n');

/** COMPTES D'INSTRUMENT, mesurés le 2026-09-14 sur `quadParts.ts` (lignes de commentaire exclues) :
 *  l'axe `far` (profondeur du membre éloigné), l'état d'aile, et les coordonnées calculées depuis un
 *  scalaire d'espèce — ces 8 lignes sont `quadParts.ts:338,343,345,347,348,486,509,510`. Tenus par
 *  ÉGALITÉ (cf. en-tête) : une extraction qui les baisse met le chiffre au réel dans SON commit. */
const FAR_LINES = 30;
const WING_STATE_LINES = 3;
const SPECIES_SCALAR_LINES = 8;

/** La mesure porte sur le BRANCHEMENT par clé (`=== '<clé>'`), jamais sur la LECTURE de l'axe : les
 *  3 sites de crinière (encolure, fraise de poitrail, touffe de croupe) lisent `mane` et composent
 *  par lookup `quadManeDef` — un compte qui ne distinguerait pas la composition de l'aiguillage
 *  rougirait sur eux. Les lectures restantes sont donc mesurées séparément ci-dessous : chacune doit
 *  être un lookup, jamais une lecture nue. */
const BRANCHE_CRINIERE = /=== '(crin|hirsute)'/;

const headSites = [...CODE_SRC.matchAll(/p\.head === '([a-z-]+)'/g)].map((m) => m[1]);
/** Les lignes de CODE qui portent un motif, NOMMÉES `quadParts.ts:<ligne> — <texte>` : un cliquet à
 *  zéro doit rendre le SITE qui rebranche, pas un compte que le lecteur devra retrouver. */
const sitesMatching = (re: RegExp) =>
  LINES.map((l, i) => ({ n: i + 1, l }))
    .filter(({ l }) => !isComment(l) && re.test(l))
    .map(({ n, l }) => `quadParts.ts:${n} — ${l.trim()}`);
const linesMatching = (re: RegExp) => CODE.filter((l) => re.test(l)).length;

describe('socle quadrupède : le branchement par espèce ne peut que DÉCROÎTRE (#1082)', () => {
  it('aucun jeton `p.head === <clé>` : le socle ne nomme aucune espèce', () => {
    expect(
      sitesMatching(/p\.head === '[a-z-]+'/),
      `aiguillage par espèce dans le socle — l'art de la tête vit dans \`heads/defs/<clé>.ts\` et se
       compose par lookup (\`quadHeadDef\`) ; clés rebranchées : ${[...new Set(headSites)].sort().join(', ')}`,
    ).toEqual([]);
  });

  it('aucune AUTRE forme d\'aiguillage par espèce : le compte textuel resterait aveugle', () => {
    const compte = (re: RegExp) => (CODE_SRC.match(re) ?? []).length;
    expect(compte(/p\.head !==/g), 'négation `p.head !==` : branchement invisible au compte des jetons').toBe(0);
    expect(compte(/switch\s*\(\s*p\.head\s*\)/g), '`switch (p.head)` : branchement invisible au compte des jetons').toBe(0);
    expect(compte(/\[\s*p\.head\s*\]/g), 'table indexée par `p.head` : branchement invisible au compte des jetons').toBe(0);
  });

  it('lignes portant l\'axe `far` : ÉGALITÉ à la mesure du jour', () => {
    expect(linesMatching(/\bfar\b/), 'compte d\'instrument : une extraction le BAISSE dans son commit').toBe(FAR_LINES);
  });

  it('lignes d\'état d\'aile : ÉGALITÉ à la mesure du jour', () => {
    expect(linesMatching(/wings === 'spread'|wings: 'folded'/), 'compte d\'instrument').toBe(WING_STATE_LINES);
  });

  it('lignes de coordonnées calculées depuis un scalaire d\'espèce : ÉGALITÉ à la mesure du jour', () => {
    expect(
      linesMatching(/\$\{-?L ?\*|\* p\.(bodyLen|neckLen|girth|tailLen|wingSpan|headScale)/),
      'compte d\'instrument : les 8 lignes sont nommées en tête',
    ).toBe(SPECIES_SCALAR_LINES);
  });

  it('le détecteur de jetons n\'est pas mort avec son stock : il voit encore la forme qu\'il compte', () => {
    // Une absence dont la sonde ne détecterait plus rien serait un cliquet FANTÔME : on éprouve la
    // regex sur un témoin — la forme exacte que le socle ne doit plus porter.
    const temoin = "  if (p.head === 'hydre') return '';";
    expect([...temoin.matchAll(/p\.head === '([a-z-]+)'/g)].map((m) => m[1])).toEqual(['hydre']);
  });

  it('le stock des têtes a MIGRÉ, il n\'a pas disparu : 14 defs enregistrées', () => {
    // Le pendant de l'ABSENCE : les 14 clés d'espèce vivent dans le registre
    // `src/gameIso/rig/quadruped/heads/defs/<clé>.ts`, une par fichier. Blanchir le socle en
    // SUPPRIMANT des têtes échoue ici.
    expect(QUAD_HEAD_DEFS.length).toBeGreaterThanOrEqual(14);
    expect(new Set(QUAD_HEAD_DEFS.map((d) => d.key)).size).toBe(QUAD_HEAD_DEFS.length);
  });

  it('aucun jeton `p.tail === <clé>` : les arts de queue vivent dans `tails/defs/`', () => {
    expect(
      sitesMatching(/p\.tail === '[a-z-]+'/),
      'aiguillage par clé de QUEUE dans le socle — composer par lookup du registre des queues',
    ).toEqual([]);
    expect((CODE_SRC.match(/p\.tail !==|switch\s*\(\s*p\.tail\s*\)|\[\s*p\.tail\s*\]/g) ?? []).length,
      'forme d\'aiguillage par queue invisible au compte des jetons').toBe(0);
    expect([...":p.tail === 'crin'".matchAll(/p\.tail === '[a-z-]+'/g)].length, 'détecteur mort').toBe(1);
  });

  it('aucun branchement par clé de CRINIÈRE : les 3 sites composent par lookup `quadManeDef`', () => {
    // `sans` est hors motif : c'est AUSSI une valeur de `ridge` (`ridgeArt`), la mesure y serait
    // aveugle à ce qu'elle juge. Les deux clés du motif couvrent les sites d'aiguillage.
    expect(
      sitesMatching(BRANCHE_CRINIERE),
      'comparaison à une clé de crinière dans quadParts.ts — composer par lookup `quadManeDef`',
    ).toEqual([]);
    expect(BRANCHE_CRINIERE.test("  const ruff = maneOf(p) === 'hirsute'"), 'détecteur mort').toBe(true);
  });

  it('toute lecture restante de `mane` est un LOOKUP de def, jamais une lecture nue', () => {
    const lectures = CODE.filter((l) => /\bp\.mane\b|maneOf\(/.test(l));
    expect(lectures.length, 'les 3 sites de crinière du socle').toBe(3);
    for (const l of lectures)
      expect(l, 'lecture de `mane` hors lookup `quadManeDef`').toMatch(/quadManeDef\(p\.mane\)/);
  });

  it('les trois registres de parts sont ÉTANCHES : aucune def n\'importe le registre d\'une autre part', () => {
    // Une def qui lit le registre d'une AUTRE part décide pour sa voisine (une queue qui interroge
    // les têtes pour savoir si la crête se prolonge, une tête qui porte l'art d'une queue). Ce qui
    // traverse une frontière de part est un AXE de la bête (`QuadProps`), lu par la part qui le peint.
    const PARTS = ['heads', 'tails', 'manes'] as const;
    const fautes: string[] = [];
    for (const part of PARTS) {
      const dir = fileURLToPath(new URL(`./${part}/defs`, import.meta.url));
      for (const f of listerDossier(dir)) {
        const src = readFileSync(`${dir}/${f}`, 'utf8');
        for (const autre of PARTS)
          if (autre !== part && new RegExp(`from '\\.\\./\\.\\./${autre}`).test(src))
            fautes.push(`${part}/defs/${f} importe le registre « ${autre} »`);
      }
    }
    expect(fautes).toEqual([]);
    expect(listerDossier(fileURLToPath(new URL('./tails/defs', import.meta.url))).length).toBeGreaterThan(1);
  });

  it('le stock des crinières a MIGRÉ : 3 defs enregistrées', () => {
    expect(QUAD_MANE_DEFS.length).toBeGreaterThanOrEqual(3);
    expect(new Set(QUAD_MANE_DEFS.map((d) => d.key)).size).toBe(QUAD_MANE_DEFS.length);
  });

  it('le stock des queues a MIGRÉ : 11 defs enregistrées', () => {
    expect(QUAD_TAIL_DEFS.length).toBeGreaterThanOrEqual(11);
    expect(new Set(QUAD_TAIL_DEFS.map((d) => d.key)).size).toBe(QUAD_TAIL_DEFS.length);
  });
});
