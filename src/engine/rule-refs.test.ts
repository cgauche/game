/**
 * RULE_REF (#1078 LOT B3a) — deux gardes.
 *
 * 1. INTÉGRITÉ : chaque entrée pointe une fiche Codex qui EXISTE, par id stable. Re-pointer une
 *    entrée ailleurs (ou renommer l'entrée de donnée) échoue ici.
 * 2. CLIQUET NOMINATIF : le stock des producteurs de `ModLine` SANS `ref` est ÉNUMÉRÉ,
 *    `fichier:label` par `fichier:label`. Lier une règle de plus retire sa ligne du stock (la liste
 *    DÉCROÎT) ; en pousser une nouvelle SANS `ref` échoue immédiatement.
 *
 * PÉRIMÈTRE (#1117 L5a) — TOUT `src/**` hors `*.test.*`, jamais une liste de fichiers producteurs :
 * une `ModLine` naît aussi bien dans une modale (`ui/FocusModal.tsx`) que dans le moteur, et un
 * périmètre par fichiers ne mesurait qu'une PART du stock (13 sur 30 au moment de l'élargissement).
 * MÉCANIQUE — parseur AST réel (`typescript`, même patron que `src/name-field-guard.test.ts`), pas
 * une regex de texte : les libellés en gabarit (`` `Météo : ${…}` ``) et les littéraux multi-lignes
 * échappaient à la forme textuelle. Un littéral compte comme `ModLine` quand :
 *   - c'est un `ObjectLiteralExpression` portant `label` ET `value` ;
 *   - toutes ses clés appartiennent à `ModLine` (`label`/`value`/`uncapped`/`ref`/`by`) — le contrôle
 *     de propriétés excédentaires de TypeScript garantit qu'une VRAIE `ModLine` n'en porte pas
 *     d'autre, si bien qu'un littéral à clé étrangère (`kref` d'un `CodexFact`, `id` d'un axe,
 *     `tone` d'une zone de fiche) est d'une AUTRE forme ;
 *   - sa `value` n'est pas syntaxiquement une chaîne (`'x'`, gabarit, `String(x)`) — `ModLine.value`
 *     est un nombre, un littéral à valeur-chaîne est un fait de Codex.
 * Aucune exemption par fichier : la discrimination porte sur la FORME, à tous les sites.
 */
import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULE_REF, type RuleId } from './ruleRefs';
import { weatherRef, type Weather } from './travelStages';
import { windsModLine, windsModFromRoll } from './windsOfMagic';
import { codexLookupById } from '../ui/compendium/registry';

describe('RULE_REF — la référence pointe une fiche Codex réelle', () => {
  it('chaque règle référencée existe au catalogue, par id STABLE', () => {
    for (const [rule, ref] of Object.entries(RULE_REF) as [RuleId, { category: string; id: string }][]) {
      expect(codexLookupById(ref.category, ref.id), `RULE_REF['${rule}'] → ${ref.category}/${ref.id} introuvable au Codex`).toBeTruthy();
    }
  });

  /**
   * Angle mort de la garde ci-dessus : une `ref` PRODUITE (catégorie hors `RULE_REF`, id calculé de
   * la donnée) n'y figure pas — une catégorie mal orthographiée ou un id absent rendrait la chip
   * muette à l'écran sans qu'aucun test ne bronche. Chaque producteur dynamique est donc énuméré
   * sur son DOMAINE COMPLET.
   */
  it('les refs PRODUITES résolvent au Codex — météo : les 6 conditions, force des Vents : les 10 faces du d10', () => {
    const meteos: Weather[] = ['sec', 'beau', 'pluie', 'pluie-diluvienne', 'neige', 'blizzard'];
    for (const w of meteos) {
      const ref = weatherRef(w);
      expect(codexLookupById(ref.category, ref.id), `weatherRef('${w}') → ${ref.category}/${ref.id} introuvable au Codex`).toBeTruthy();
    }
    for (let roll = 1; roll <= 10; roll++) {
      const mod = windsModFromRoll(roll);
      const line = windsModLine({ roll, mod });
      if (mod === 0) {
        // Vents stables : aucune ligne à afficher (rien à référencer).
        expect(line, `windsModLine(d10=${roll}) — force neutre, aucune ligne`).toBeNull();
        continue;
      }
      const ref = line!.ref!;
      expect(codexLookupById(ref.category, ref.id), `windsModLine(d10=${roll}) → ${ref.category}/${ref.id} introuvable au Codex`).toBeTruthy();
      expect(line!.label, `windsModLine(d10=${roll}) NOMME la ligne du Tableau, jamais un libellé maison`)
        .toBe(codexLookupById(ref.category, ref.id)!.label);
    }
    // Aucun Vent tiré (option inactive / hors combat) : aucune ligne — jamais une chip sans référence.
    expect(windsModLine(undefined)).toBeNull();
    expect(windsModLine(null)).toBeNull();
  });
});

const SRC = fileURLToPath(new URL('..', import.meta.url));

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...tsFiles(p));
    else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

/** Les clés de `ModLine` (`engine/combat.ts`) — un littéral qui en porte une autre est d'une autre forme. */
const MODLINE_KEYS = new Set(['label', 'value', 'uncapped', 'ref', 'by']);

/** L'expression est-elle syntaxiquement une CHAÎNE ? (`ModLine.value` est un nombre.) */
function isStringExpr(e: ts.Expression): boolean {
  return ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e) || ts.isTemplateExpression(e)
    || (ts.isCallExpression(e) && ts.isIdentifier(e.expression) && e.expression.text === 'String');
}

export interface ModLiteral {
  line: number;
  /** Texte SOURCE du libellé (`'Rapide'`, `sc.label`, `` `Météo : ${…}` ``) — l'identité de la ligne. */
  label: string;
  hasRef: boolean;
}

/** Les littéraux de `ModLine` d'un fichier, `ref` présente ou non. */
export function modLineLiterals(path: string, raw: string): ModLiteral[] {
  const sf = ts.createSourceFile(
    path, raw, ts.ScriptTarget.Latest, true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const found: ModLiteral[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isObjectLiteralExpression(node)) {
      const names = node.properties.map((p) => (p.name && ts.isIdentifier(p.name) ? p.name.text : null));
      const onlyModLineKeys = node.properties.every((p, i) => ts.isSpreadAssignment(p) || (!!names[i] && MODLINE_KEYS.has(names[i]!)));
      if (onlyModLineKeys && names.includes('label') && names.includes('value')) {
        const prop = (k: string) => node.properties.find((_, i) => names[i] === k);
        const value = prop('value');
        const stringValued = !!value && ts.isPropertyAssignment(value) && isStringExpr(value.initializer);
        if (!stringValued) {
          const label = prop('label');
          found.push({
            line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
            label: label && ts.isPropertyAssignment(label) ? label.initializer.getText(sf).replace(/\s+/g, ' ') : 'label',
            hasRef: names.includes('ref'),
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

/** TOUS les sites de `ModLine` de `src/**` (hors tests), `fichier · label`, avec l'état de leur `ref`. */
function modLineSites(): { at: string; hasRef: boolean }[] {
  const out: { at: string; hasRef: boolean }[] = [];
  for (const f of tsFiles(SRC)) {
    const rel = 'src/' + f.slice(SRC.length).replace(/\\/g, '/');
    for (const m of modLineLiterals(f, readFileSync(f, 'utf8'))) out.push({ at: `${rel} · ${m.label}`, hasRef: m.hasRef });
  }
  return out;
}

/** Le stock MESURÉ des producteurs SANS `ref`, un par `fichier:label` (source de vérité du cliquet). */
function refLessProducers(): string[] {
  return modLineSites().filter((s) => !s.hasRef).map((s) => s.at).sort();
}

/**
 * CLIQUET — stock des `ModLine` SANS `ref`. Les pools d'octroyeurs ont TOUS été levés (#1117 L4) :
 * `PassiveMod` porte l'identité Codex de sa source (`src`), et chaque site rend UNE ligne par
 * composante réelle, à son nom — pénalités d'État (`combatTestPenaltyParts`), bonus à l'attaquant
 * (`meleeAttackerBonusLines`), aura anti-Sort (`castWardLine`). Ce qui reste est MESURÉ, par famille :
 *  - RENVOIS légitimes — la ligne PORTE déjà l'identité de sa donnée dans son libellé : les quatre
 *    lignes volatiles de Caractéristique (`characteristics.ts` — la carac EST la fiche du libellé)
 *    et les deux modificateurs d'AMBIANCE de scène (`sc.label`, poussés par `state/combatFlow.ts` :
 *    la donnée de scène ne porte aucune identité Codex à ce jour, seule la branche `sc.concealed`
 *    en a une, celle de la Cible dissimulée).
 *  - lignes dont la RÈGLE n'a pas encore de fiche au catalogue (`regles.json`) : couvert de tir,
 *    allure forcée d'attelage, « Rounds tenus » de la bataille de masse, écrêtage « Combiner les
 *    Difficultés ». Leur dotation attend la fiche, elle ne s'invente pas au site.
 *  - lignes AGRÉGÉES qui doivent d'abord se DÉPLIER par source, comme les pools de L4 : « Contrecoup »
 *    (somme de `castPenalties`), « autres » (résidu de réconciliation), le modificateur d'Activité
 *    (`pa.modLabel`, porté par la donnée de flux) et la météo MARITIME (`pt.envLabel`, dont la
 *    référence devrait naître au producteur `seaWeatherTestMod`).
 */
const RATCHET = [
  "src/engine/combat.ts · 'Neige épaisse'",
  "src/state/combatFlow.ts · tr('cf.coverLabel', { cover })",
  'src/state/combatFlow.ts · sc.label',
  'src/state/combatFlow.ts · sc.label',
  "src/state/combatFlow.ts · 'Contrecoup'",
  "src/state/travelFlow.ts · 'pas de course'",
  'src/state/travelFlow.ts · `Km déjà au pas de course (${galloped})`',
  "src/ui/ActivityModal.tsx · pa.modLabel ?? 'Modificateur'",
  "src/ui/ActivityModal.tsx · 'Rounds tenus'",
  "src/ui/jetProps/useTestJetProps.tsx · pt.envLabel ?? 'Météo'",
  "src/ui/RollLine.tsx · `${cut < 0 ? 'plafond' : 'plancher'} ${target}`",
  "src/ui/RollLine.tsx · 'autres'",
].sort();

describe('Cliquet — les ModLine SANS règle liée sont ÉNUMÉRÉES et décroissent (#1078)', () => {
  it('le stock mesuré est EXACTEMENT le stock déclaré (lier une règle = retirer sa ligne)', () => {
    const measured = refLessProducers();
    const added = measured.filter((x) => !RATCHET.includes(x));
    const removed = RATCHET.filter((x) => !measured.includes(x));
    expect(added, 'NOUVELLE ModLine sans `ref` : donne-lui son entrée RULE_REF (ou son id d’entité)').toEqual([]);
    expect(removed, 'règle désormais liée : retire sa ligne du cliquet (il ne fait que décroître)').toEqual([]);
  });

  it('le stock ne peut que DÉCROÎTRE (plafond collé)', () => {
    expect(refLessProducers().length).toBeLessThanOrEqual(RATCHET.length);
  });

  it('le périmètre est TOUT src/** : des sites d’UI (.tsx) sont mesurés, pas seulement moteur/état', () => {
    const sites = modLineSites().map((s) => s.at);
    expect(sites.some((at) => at.startsWith('src/ui/') && at.includes('.tsx')), 'aucun site .tsx mesuré : le scan est retombé sur une liste de producteurs').toBe(true);
  });

  it('cas planté : un libellé en GABARIT est DÉTECTÉ (preuve TDD — la forme textuelle des `${…}` était aveugle)', () => {
    const src = 'const m = [{ label: `Météo : ${LABEL[w]}`, value: v }];';
    expect(modLineLiterals('x.ts', src)).toEqual([{ line: 1, label: '`Météo : ${LABEL[w]}`', hasRef: false }]);
  });

  it('cas planté : un littéral multi-ligne, et la présence d’une `ref`, sont lus sur la STRUCTURE (preuve TDD)', () => {
    const src = 'const m = {\n  label: "Viser",\n  value: 10,\n  ref: RULE_REF.viser,\n};';
    expect(modLineLiterals('x.ts', src)).toEqual([{ line: 1, label: '"Viser"', hasRef: true }]);
  });

  it('faux positif écarté : un fait de Codex (`value` CHAÎNE, clé `kref`) n’est PAS une ModLine (preuve TDD — forme, jamais fichier)', () => {
    expect(modLineLiterals('x.ts', 'const f = { label, value: String(v) };')).toEqual([]);
    expect(modLineLiterals('x.ts', "const f = { label: 'B', value: n, kref: { category: 'c', id: 'i', label: 'L' } };")).toEqual([]);
    expect(modLineLiterals('x.ts', "const a = { id: 'force', label: a.label, value: 3 };")).toEqual([]);
  });
});
