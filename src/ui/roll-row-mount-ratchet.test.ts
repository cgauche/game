/**
 * CLIQUET DU MONTAGE DE RANGÉE (#1262 L0) — la marque `BuiltRollRow` reste OPTIONNELLE tant que
 * `RollShell.rows` n'est pas typé `readonly BuiltRollRow[]` (lot terminal) : `tsc` ne mesure donc RIEN
 * de la transition. C'est ce cliquet qui la tient — il compte, PAR FICHIER, les rangées MONTÉES À LA
 * MAIN (littéral `RollRowData` assemblé hors des constructeurs de `rollRowBuild.ts`). Baseline gelée
 * et DÉCROISSANTE : toute hausse échoue (site neuf hors porte), toute baseline devenue trop haute
 * (fichier migré) doit être abaissée. Ce fichier MEURT au lot terminal, quand le requis au type
 * rendra le comptage inutile.
 *
 * MESURE STRUCTURELLE (AST TypeScript, pas un grep) : est un montage manuscrit tout littéral d'objet
 * qui porte une propriété `row` NON-fonction (ce qui écarte les *bundles* de `buildParticipantRows`,
 * dont `row` est une fabrique de présentation), au moins un champ PROPRE à `RollRowData`, et qui
 * n'est pas l'ARGUMENT d'un constructeur de la porte (un site migré ne se compte plus).
 *
 * POPULATION EXACTE — ce que l'instrument voit, et ce qu'il ne voit pas :
 *  · VU : un littéral qui NOMME `row` et au moins un champ de rangée
 *    (`{ key, row: {…}, rolled, onRoll }`, `{ row: r, actor, interactive }`).
 *  · PAS VU : une rangée assemblée par SPREAD (`{ ...base, key: 'x' }`, `{ ...witnessRow, winner }`),
 *    un littéral qui n'apporte que `key`/`interactive` autour d'un appel de constructeur, un
 *    littéral qui n'apporte QUE `row`. Le compte porte sur des RANGÉES NOMMÉES, pas sur des sacs de
 *    propriétés — l'assemblage indirect reste hors radar.
 *
 * DEUX POPULATIONS, toutes deux nécessaires : celle-ci (montages nommés) et celle du lot terminal —
 * les FOURNISSEURS de `rows` (mesure de référence : 44 sites / 33 fichiers au 2026-08-12), que le
 * requis au type fera compiler ou non. Une baseline à 0 ici ne dit donc PAS le chantier fini : le
 * critère terminal est `RollShell.rows: readonly BuiltRollRow[]` requis, pas ce compteur à zéro.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const SRC = fileURLToPath(new URL('..', import.meta.url)); // src/

/** Le module des CONSTRUCTEURS : c'est la porte, pas un site de montage. */
const PORTE = 'ui/rollRowBuild.ts';

/** Les constructeurs de la porte : leur argument n'est pas une rangée manuscrite, c'est une DÉCLARATION. */
const CONSTRUCTEURS = new Set(['buildRollRow', 'participantRow', 'tableRow', 'worldRow', 'witnessRow', 'frozenOpposedRow']);

/** Champs PROPRES à `RollRowData`/`RollRowProps` — leur présence à côté de `row` fait la rangée. */
const CHAMPS_DE_RANGEE = new Set([
  'rolled', 'interactive', 'onRoll', 'rerollable', 'darkPactable', 'forceShow', 'winner', 'flowKey',
  'extendedDr', 'rollLabel', 'separator', 'actor', 'resist', 'reverse', 'declare', 'forcedRoll',
  'fixedMark', 'rollBlocked', 'rollInBar', 'noForcedDie',
]);

function walk(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.tsx?$/.test(e)) acc.push(p);
  }
  return acc;
}
const rel = (abs: string) => abs.slice(SRC.length).split('\\').join('/');

/** SITE UNIQUE de la mesure — appliqué au disque comme aux sources synthétiques de la sonde. */
export function compteRangeesManuscrites(nom: string, src: string): number {
  const sf = ts.createSourceFile(nom, src, ts.ScriptTarget.Latest, true, nom.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const declares = new Set<ts.Node>();
  let n = 0;
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && CONSTRUCTEURS.has(node.expression.text)) {
      for (const a of node.arguments) if (ts.isObjectLiteralExpression(a)) declares.add(a);
    }
    if (ts.isObjectLiteralExpression(node) && !declares.has(node)) {
      const noms = new Set<string>();
      let valeurDeRow: ts.Node | 'shorthand' | null = null;
      for (const p of node.properties) {
        const nom = p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? p.name.text : null;
        if (nom) noms.add(nom);
        if (nom === 'row') valeurDeRow = ts.isPropertyAssignment(p) ? p.initializer : (ts.isShorthandPropertyAssignment(p) ? 'shorthand' : null);
      }
      const rowEstUneFabrique = valeurDeRow != null && valeurDeRow !== 'shorthand'
        && (ts.isArrowFunction(valeurDeRow) || ts.isFunctionExpression(valeurDeRow));
      if (noms.has('row') && !rowEstUneFabrique && [...noms].some((x) => CHAMPS_DE_RANGEE.has(x))) n++;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return n;
}

/** Stock recensé au L0 (base f7b2104a). Les TESTS sont dans la population : sinon le requis terminal
 *  au type leur casserait dessus en bloc. */
const BASELINE: Record<string, number> = {
  // ── PROD ──
  'ui/ActivityModal.tsx': 3,
  'ui/jetProps/useAttackJetProps.tsx': 3,
  'ui/StateRecoveryModal.tsx': 2,
  'ui/AppraiseModal.tsx': 1,
  'ui/ApproachModal.tsx': 1,
  'ui/AuContactModal.tsx': 1,
  'ui/BargainModal.tsx': 1,
  'ui/BattementModal.tsx': 1,
  'ui/CastModal.tsx': 1,
  'ui/CorruptionModal.tsx': 1,
  'ui/DisengageModal.tsx': 1,
  'ui/DispelModal.tsx': 1,
  'ui/DistraireModal.tsx': 1,
  'ui/FallModal.tsx': 1,
  'ui/FocusModal.tsx': 1,
  'ui/FrenzyModal.tsx': 1,
  'ui/GrappleModal.tsx': 1,
  'ui/HandGateModal.tsx': 1,
  'ui/HealModal.tsx': 1,
  'ui/jetProps/useDefenseJetProps.tsx': 1,
  'ui/jetProps/useExtendedTestJetProps.tsx': 1,
  'ui/jetProps/useFumbleJetProps.tsx': 1,
  'ui/jetProps/useTestJetProps.tsx': 1,
  'ui/jetProps/useTrampleJetProps.tsx': 1,
  'ui/ManeuverModal.tsx': 1,
  'ui/MedicModal.tsx': 1,
  'ui/opposedFrozen.ts': 1, // `maskOpposedRow` RECONSTRUIT la rangée qu'on lui donne (masque) : il n'en mint pas
  'ui/ReloadModal.tsx': 1,
  'ui/RunModal.tsx': 1,
  'ui/ShantyModal.tsx': 1,
  'ui/SteamSaveModal.tsx': 1,
  'ui/WardModal.tsx': 1,
  // ── TESTS ──
  'ui/rollRowBuild.test.ts': 1, // le contrôle NÉGATIF du test de marque : une rangée manuscrite, exprès
  'ui/forcedDieRow.pre-roll.test.tsx': 4,
  'ui/opposed-mask.test.tsx': 3,
  'ui/RollShell.test.tsx': 3,
  'ui/roll-display-contract.test.tsx': 2,
  'ui/buildParticipantRows.test.tsx': 1,
  'ui/HandGateModal.test.tsx': 1,
  'ui/issue-tone-authored.test.tsx': 1,
  'ui/roll-focus-rescue.test.tsx': 1,
  'ui/RollLine-codex-chips.test.tsx': 1,
  'ui/RollLine-etat-chips.test.tsx': 1,
};

describe('#1262 L0 — cliquet des rangées MONTÉES À LA MAIN (gelé, décroissant)', () => {
  it('aucune hausse par fichier ; aucune baseline périmée', () => {
    const counts: Record<string, number> = {};
    for (const f of walk(SRC)) {
      if (rel(f) === PORTE) continue;
      const n = compteRangeesManuscrites(f, readFileSync(f, 'utf8'));
      if (n > 0) counts[rel(f)] = n;
    }
    const hausses: string[] = [];
    for (const [f, n] of Object.entries(counts)) {
      const b = BASELINE[f] ?? 0;
      if (n > b) hausses.push(`${f} : ${n} (baseline ${b})`);
    }
    expect(hausses, `Rangée montée à la main hors de la porte — passer par un constructeur de \`rollRowBuild.ts\` (participantRow/tableRow/worldRow/witnessRow/frozenOpposedRow), ou ABAISSER une baseline migrée :\n${hausses.join('\n')}`).toEqual([]);
    const perimees: string[] = [];
    for (const [f, b] of Object.entries(BASELINE)) {
      const n = counts[f] ?? 0;
      if (n < b) perimees.push(`${f} : baseline ${b}, réel ${n}`);
    }
    expect(perimees, `Baseline(s) PÉRIMÉE(s) — abaisser (la population doit DÉCROÎTRE) :\n${perimees.join('\n')}`).toEqual([]);
  });

  it('le détecteur MORD, et sur les BONNES formes (rangée oui, bundle et déclaration non)', () => {
    const c = (code: string) => compteRangeesManuscrites('sonde.ts', code);
    expect(c('export const a = { key: "k", row: { combatant: x }, rolled: false, onRoll: f };'), 'rangée manuscrite').toBe(1);
    expect(c('export const b = build(p, pool, { onRoll: f, row: (part, actor) => ({ combatant: actor }) });'), 'bundle : `row` est une fabrique de présentation').toBe(0);
    expect(c('export const d = participantRow({ key: "k", row: r, actor: a });'), 'site MIGRÉ : la déclaration passée à la porte ne se compte plus').toBe(0);
    expect(c('export const e = { ...participantRow({ key: "k", row: r, actor: a }), flowKey: "flee" };'), 'post-traitement par spread : rien de manuscrit').toBe(0);
  });
});
