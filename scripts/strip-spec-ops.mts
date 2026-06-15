/**
 * CODEMOD (jetable) — retire les propriétés `ops` / `casterOps` des objets `SpellSpec` des fichiers
 * `src/data/spellspecs/*.ts`. Les EFFETS ont migré vers `SpellData.effects` (Flow, donnée app-owned) ;
 * la spec ne garde QUE les métadonnées de résolution (durée/zone/opposition/invocation/métamorphose…).
 * Source UNIQUE : plus aucun `ops` côté engine.
 *
 * Précis (AST TypeScript) : ne supprime QUE les propriétés `ops`/`casterOps` de PREMIER niveau d'un
 * objet-littéral qui ressemble à une SpellSpec (porte `label` OU `durationRounds`/`curated`) — JAMAIS
 * un `ops` imbriqué (onFail/onFailHard/perRound/test). Préserve le reste byte-pour-byte. Les helpers
 * (`plus10`, `N`) qui construisent `ops` depuis leurs params sont neutralisés au cas par cas APRÈS
 * (commentaire de la propriété → param devenu inutile traité à la main / par le typecheck).
 *
 * Lancer :  npx tsx scripts/strip-spec-ops.mts
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import ts from 'typescript';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = resolve(HERE, '../src/data/spellspecs');

/** L'objet-littéral est-il (probablement) une SpellSpec / un retour de helper de SpellSpec ? */
function isSpecLike(obj: ts.ObjectLiteralExpression): boolean {
  const names = obj.properties
    .filter((p): p is ts.PropertyAssignment | ts.ShorthandPropertyAssignment => ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p))
    .map((p) => (p.name && ts.isIdentifier(p.name) ? p.name.text : ''));
  // SpellSpec : porte toujours `label` + (`durationRounds`|`curated`). Les helpers retournent un objet
  // avec `label`+`durationRounds`+`curated` aussi → couverts.
  return names.includes('label') && (names.includes('durationRounds') || names.includes('curated'));
}

/** Étend une plage [start,end) de propriété pour absorber la virgule suivante et le blanc/ligne. */
function rangeWithComma(text: string, start: number, end: number): [number, number] {
  let e = end;
  // absorbe espaces puis une virgule
  while (e < text.length && (text[e] === ' ' || text[e] === '\t')) e++;
  if (text[e] === ',') e++;
  // absorbe le reste de la ligne (incluant un commentaire trailing) jusqu'au \n inclus
  while (e < text.length && text[e] !== '\n') {
    if (text[e] !== ' ' && text[e] !== '\t' && text[e] !== '\r') break; // garde si du code suit
    e++;
  }
  if (text[e] === '\n') e++;
  // recule le start au début de sa ligne (absorbe l'indentation)
  let s = start;
  while (s > 0 && (text[s - 1] === ' ' || text[s - 1] === '\t')) s--;
  return [s, e];
}

function strip(file: string): { removed: number } {
  const path = join(DIR, file);
  const text = readFileSync(path, 'utf8');
  const sf = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const cuts: [number, number][] = [];

  const visit = (node: ts.Node) => {
    if (ts.isObjectLiteralExpression(node) && isSpecLike(node)) {
      for (const p of node.properties) {
        if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && (p.name.text === 'ops' || p.name.text === 'casterOps')) {
          // plage de la propriété, COMMENTAIRES de tête inclus (les lignes // au-dessus expliquent l'op)
          const start = p.getFullStart() + (p.getLeadingTriviaWidth(sf));
          // on garde les commentaires (ils documentent le sort) — on ne supprime QUE la propriété.
          cuts.push(rangeWithComma(text, start, p.getEnd()));
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  if (!cuts.length) return { removed: 0 };
  // applique les coupes de la fin vers le début (offsets stables)
  cuts.sort((a, b) => b[0] - a[0]);
  let out = text;
  for (const [s, e] of cuts) out = out.slice(0, s) + out.slice(e);
  writeFileSync(path, out, 'utf8');
  return { removed: cuts.length };
}

let total = 0;
for (const f of readdirSync(DIR).filter((f) => f.endsWith('.ts') && f !== 'index.ts')) {
  const { removed } = strip(f);
  if (removed) { console.log(`${f}: −${removed} propriété(s) ops/casterOps`); total += removed; }
}
console.log(`Total : ${total} propriétés retirées.`);
