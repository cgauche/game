import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * GARDE — aucune NOUVELLE déclaration de champ `name` dans src/** (doctrine utilisateur 2026-07-19,
 * verbatim) : « .name doit être juste interdit, indépendamment de l'utilisation de label pour autre
 * chose que de l'affichage et authoring » — « J'aime pas avoir label ou name pour désigner le nom
 * d'un objet. Choisi l'un ou l'autre, mais un seul vocabulaire. » Les porteurs
 * Combatant/Weapon/ItemInstance/ConditionInstance/Disease/GameOp sont DÉJÀ migrés (name→label|id) ; ce
 * garde verrouille l'ACQUIS et référence NOMMÉMENT le work-list résiduel (4 sites de rig), au même
 * patron que `src/engine/effect-rule-anchor.test.ts` : BASELINE qui ne peut que DÉCROÎTRE, aucune
 * NOUVELLE déclaration hors BASELINE/ALLOWLIST.
 *
 * MÉCANIQUE — parseur AST réel (`typescript`, déjà une dépendance), pas un suivi de pile fait main :
 * `ts.createSourceFile` + walk `ts.forEachChild`. Un champ `name` compte SEULEMENT si :
 *   - `ts.PropertySignature` (membre d'`interface`/`TypeLiteral`, où qu'il apparaisse — membre direct,
 *     type de retour, annotation de variable, type de propriété imbriqué) ;
 *   - `ts.PropertyDeclaration` d'une `class` ;
 *   - `ts.PropertyAssignment` d'un `ObjectLiteralExpression` dont la valeur est un appel `z.*` (schéma
 *     zod, ex. `name: z.string()`) OU qui est un membre direct de l'argument de `z.object(`/
 *     `z.strictObject(`.
 * EXCLUS PAR CONSTRUCTION (l'AST les distingue nativement, aucune heuristique fragile) :
 *   - `ts.Parameter` — un paramètre nommé `name` d'une signature de fonction/fonction-type
 *     (`(name: string) => T`) n'est jamais un champ ;
 *   - un `PropertyAssignment` `name` d'un littéral d'appel/i18n ordinaire (`{ name: x.label }`,
 *     `t('k', { name })`) — sa valeur n'est pas un appel `z.*`, il n'ouvre donc aucun cadre TYPE.
 * L'AST ignore nativement JSX/génériques imbriqués (contrairement à un suivi de pile fait main) : plus
 * aucun angle mort de ce type — `src/ui/gallery/registry.tsx` (3 sites, dont l'interface locale
 * `GallerySpecimen` que l'ancienne version à pile ratait) est désormais couvert.
 */

const SRC = fileURLToPath(new URL('.', import.meta.url));
const SELF = 'name-field-guard.test.ts';

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...tsFiles(p));
    else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) && e.name !== SELF) out.push(p);
  }
  return out;
}

/** La valeur d'un `PropertyAssignment` désigne-t-elle un appel de schéma zod (`z.string()`,
 *  `z.string().optional()`, `z.object({...})`…) — en remontant la chaîne d'appels/accès jusqu'à
 *  l'identifiant racine `z` ? */
function zodRoot(node: ts.Node): boolean {
  if (ts.isIdentifier(node)) return node.text === 'z';
  if (ts.isPropertyAccessExpression(node)) return zodRoot(node.expression);
  if (ts.isCallExpression(node)) return zodRoot(node.expression);
  return false;
}

/** `call` est-il exactement `z.object(...)`/`z.strictObject(...)` ? */
function isZodObjectCall(call: ts.Node): boolean {
  if (!ts.isCallExpression(call)) return false;
  if (!ts.isPropertyAccessExpression(call.expression)) return false;
  const method = call.expression.name.text;
  if (method !== 'object' && method !== 'strictObject') return false;
  return zodRoot(call.expression.expression);
}

/** Lignes portant une déclaration de champ `name`/`name?` — `PropertySignature`/`PropertyDeclaration`
 *  toujours, `PropertyAssignment` seulement dans un schéma zod (jamais un littéral d'appel/i18n). */
function nameFieldLines(path: string, raw: string): number[] {
  const sourceFile = ts.createSourceFile(
    path, raw, ts.ScriptTarget.Latest, true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const found: number[] = [];
  const lineOf = (node: ts.Node) => sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;

  function isNameId(name: ts.PropertyName | undefined): name is ts.Identifier {
    return !!name && ts.isIdentifier(name) && name.text === 'name';
  }

  function visit(node: ts.Node) {
    if (ts.isPropertySignature(node) && isNameId(node.name)) {
      found.push(lineOf(node));
    } else if (ts.isPropertyDeclaration(node) && isNameId(node.name)) {
      found.push(lineOf(node));
    } else if (ts.isPropertyAssignment(node) && isNameId(node.name)) {
      let isZodField = zodRoot(node.initializer);
      if (!isZodField) {
        const objLit = node.parent;
        if (ts.isObjectLiteralExpression(objLit) && objLit.parent) {
          isZodField = isZodObjectCall(objLit.parent);
        }
      }
      if (isZodField) found.push(lineOf(node));
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return found;
}

function nameFieldSites(): string[] {
  const out: string[] = [];
  for (const f of tsFiles(SRC)) {
    const rel = 'src/' + f.slice(SRC.length).replace(/\\/g, '/');
    const raw = readFileSync(f, 'utf8');
    for (const line of nameFieldLines(f, raw)) out.push(`${rel}:${line}`);
  }
  return out;
}

/**
 * Deux porteurs SEULS exemptés — jamais un porteur de donnée, toujours une STRUCTURE DE PARSING :
 *  - `StatEntry.name` (`src/engine/statEntry.ts`) : sortie du parseur de ligne de statbloc, jamais
 *    persistée, jamais affichée telle quelle (le champ existant AVANT toute doctrine id/label).
 *  - `splitLabel` (même fichier) : SOURCE UNIQUE du split nom↔spécialisation, son retour `{ name,
 *    spec? }` est un couple de parsing interne, pas une identité d'objet.
 */
const ALLOWLIST: string[] = [
  'src/engine/statEntry.ts:16', // StatEntry — sortie de PARSEUR runtime, jamais persistée
  'src/engine/statEntry.ts:149', // splitLabel — couple de parsing { name, spec? }, jamais un porteur
];

/**
 * RÉSIDU au 2026-07-20 (post #608 Lot C, ref #603 — GameOp `condition`/`removeCondition`/`grantWeapon`/
 * `grantNaturalWeapon` migrés `name` → `id`/`label`) — 4 sites de rig restants, déclarations de champ
 * `name` PRÉEXISTANTES à la doctrine (ce garde n'en migre AUCUN). La liste ne peut que DÉCROÎTRE (test
 * ci-dessous) : migrer un site impose de l'ôter d'ici.
 */
const BASELINE: string[] = [
  // état (store/flows) — cible LABEL sauf mention contraire ; Lot 5 (#608) a migré les sites
  // runtime NON sérialisés (ai.ts:97→`id`, combatFlow.ts:5468 AiTurnRec, merchants/types.ts:6→`id`,
  // scenes/test-scenarios/magie.ts:78, ui/PlaqueRow.tsx:35→`content`) — ôtés d'ici. Lot 6 (#608) a migré
  // les porteurs de libellé SÉRIALISÉS dans une save (CampaignVessel, CustomStatblock, MedicNpc,
  // ScheduledRespawn.caster, PendingVictory.defeated, PendingTest.candidates, MassBattleArmy,
  // combatFlow.ts:4819 couplé) via `SAVE_VERSION` 9→10 (`remapNameToLabelDeep` étendu) + `projectLibrary.ts`
  // (repli idempotent dédié, localStorage sans chaîne `MIGRATIONS`) — tous ôtés d'ici. Lot B (#608) a migré
  // les 4 DERNIERS porteurs SÉRIALISÉS résiduels — `SceneOp` `setVessel`/`adjustVessel` (`scene.ts:377/389`),
  // `pendingCampaign` (`store.ts:552`, `SAVE_VERSION` 10→11) et `CreatorDraft.name` (`draft.ts:129`, repli
  // idempotent `remapNameToLabelDeep` de `roster.ts` étendu du bearer `isDraftLike`) — tous ôtés d'ici.
  // `sceneEdit.ts:232` (`placeEntry`) ôté SANS migration : c'est un ID d'entrée (clé de `entryPoints`,
  // référencée par les transitions), pas un libellé — renommé `id`, hors du vocabulaire `name`/`label`.

  // rig (tenues/creatures/armure/coiffes) — cible LABEL, defs authorées
  'src/gameIso/rig/creatures/types.ts:54',
  'src/gameIso/rig/parts/armour/types.ts:15',
  'src/gameIso/rig/parts/hairstyles/types.ts:27',
  'src/gameIso/rig/parts/tenues/types.ts:46',
];

describe('garde-fou champ `name` (doctrine 2026-07-19)', () => {
  it('cas planté : un membre `name: string;` dans une interface est DÉTECTÉ (preuve TDD)', () => {
    const src = `
interface Foo {
  id: string;
  name: string;
}
`;
    expect(nameFieldLines('x.ts', src)).toEqual([4]);
  });

  it('cas planté : `name?: string` (optionnel), `z.object({ name: z.string() })` et une annotation de '
    + 'type inline `(opts: { name: string }) => void` sont DÉTECTÉS (preuve TDD)', () => {
    expect(nameFieldLines('x.ts', 'interface X { name?: string; }')).toEqual([1]);
    expect(nameFieldLines('x.ts', "const S = z.object({ id: z.string(), name: z.string() });")).toEqual([1]);
    expect(nameFieldLines('x.ts', 'function f(opts: { name: string }): void {}')).toEqual([1]);
  });

  it('faux positif écarté : une clé de littéral `{ name: x.label }` (paramètre i18n/appel, PAS un '
    + 'schéma zod) n\'est JAMAIS détectée (preuve TDD — distingue déclaration de type et littéral)', () => {
    expect(nameFieldLines('x.ts', "t('op.testRoll', { name: x.label, what });")).toEqual([]);
    expect(nameFieldLines('x.ts', 'const row = { id: "a", name: entry.name };')).toEqual([]);
    expect(nameFieldLines('x.ts', "giveTrapping(char, { name: 'Corde' });")).toEqual([]);
  });

  it('faux positif écarté : un paramètre `name` d\'une fonction-type membre d\'une interface n\'est '
    + 'PAS un champ (preuve TDD — `netHostStart: (name: string) => Promise<boolean>`, `ts.Parameter` '
    + 'exclu par construction)', () => {
    expect(nameFieldLines('x.ts', 'interface X { netHostStart: (name: string) => Promise<boolean>; }')).toEqual([]);
  });

  it('un champ `name` niché derrière du JSX/générique imbriqué est DÉTECTÉ (preuve TDD — l\'AST ne '
    + 'perd JAMAIS le fil, contrairement à un suivi de pile fait main sur `.tsx` : cas réel '
    + '`src/ui/gallery/registry.tsx`, une interface locale APRÈS un composant JSX générique)', () => {
    const tsx = `
import type { ReactNode } from 'react';
function Demo<T extends { id: string }>({ items, render }: { items: T[]; render: (x: T) => ReactNode }) {
  return <div className="stack">{items.map((it) => <span key={it.id}>{render(it)}</span>)}</div>;
}
function Inner() {
  interface Row { id: string; name: string; }
  const rows: Row[] = [{ id: 'r1', name: 'Exemple' }];
  return <Demo items={rows} render={(r) => <>{r.name}</>} />;
}
`;
    expect(nameFieldLines('x.tsx', tsx)).toEqual([7]);
  });

  it('aucune NOUVELLE déclaration de champ `name` hors BASELINE/ALLOWLIST (CLAUDE.md, doctrine '
    + '2026-07-19 — un porteur nouveau utilise `label`/`id`, jamais `name`)', () => {
    const nouveaux = nameFieldSites().filter((at) => !BASELINE.includes(at) && !ALLOWLIST.includes(at));
    expect(
      nouveaux,
      `Nouvelle(s) déclaration(s) de champ \`name\` — renommer en \`label\` (affichage) ou \`id\` '
        + '(logique), jamais \`name\` :\n${nouveaux.join('\n')}`,
    ).toEqual([]);
  });

  it('la baseline DÉCROÎT : aucun site listé n\'a été migré sans être ôté de la liste', () => {
    const restants = new Set(nameFieldSites());
    const perimes = BASELINE.filter((at) => !restants.has(at));
    expect(perimes, 'ces sites ne portent plus (ou plus au même endroit) de champ `name` : ôter de BASELINE').toEqual([]);
  });
});
