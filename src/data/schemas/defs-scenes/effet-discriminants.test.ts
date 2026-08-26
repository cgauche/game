/**
 * VERROU D'UNION d'`Effect` (#1466 L1a T3bis-a) — jumeau de `condition-discriminants.test.ts`.
 *
 * POURQUOI ce test existe : `effectSchema` est OBLIGÉ de s'annoter `z.ZodType<Effect>` (le `z.lazy`
 * de la récursion mutuelle avec `sceneFlowSchema` empêche l'inférence), et cette annotation est
 * SATISFAITE par une SOUS-union — un schéma qui n'énumère que 55 des 58 variantes reste vert au
 * typecheck ET au test d'infer, tout en REFUSANT au runtime les 3 variantes manquantes. Un effet
 * ajouté à `effets.ts` et à l'union manuscrite, mais oublié dans la liste d'options, ne casse RIEN
 * — jusqu'à ce qu'un document authoré le pose.
 *
 * Le contrat tenu ici est une ÉGALITÉ D'ENSEMBLE, mesurée des DEUX côtés du pont :
 * — côté TYPE : les membres de l'union manuscrite `Effect` (`src/state/scene.ts`), lus à l'AST —
 *   composition mince de `z.infer<typeof xSchema>` + 3 corps manuscrits (`DelayedEffect`,
 *   `PetitePriere`, `EffectOp`). Le discriminant d'un membre `z.infer` est relu à l'AST du schéma
 *   NOMMÉ (`effets.ts`), celui d'un corps manuscrit à l'AST de sa déclaration — jamais une liste
 *   recopiée, qui mourrait au premier ajout ;
 * — côté SCHÉMA : les discriminants réels des options d'`effectSchema`, par INTROSPECTION zod (le
 *   `z.lazy` est déroulé — la seule façon de voir ce que la porte accepte VRAIMENT).
 * Manquants et en-trop sont NOMMÉS dans les deux sens.
 *
 * ANGLES MORTS MESURÉS (2026-08-26) :
 * — le côté TYPE ne sait lire un membre `z.infer<typeof xSchema>` que si `xSchema` est déclaré dans
 *   `effets.ts`. Un schéma d'effet PARFAITEMENT VIVANT mais déclaré ailleurs sortirait
 *   `<symbole introuvable…>` et ferait rougir le verrou À TORT : c'est une contrainte de CROISSANCE
 *   (les schémas d'effet vivent dans `effets.ts`), pas une vérification. La déplacer suppose
 *   d'élargir `litterauxDesSchemas` aux modules concernés ;
 * — `lit ??=` retient le PREMIER `z.literal(…)` porté par une clé `type` rencontré dans le schéma, y
 *   compris IMBRIQUÉ (un `type: z.literal(…)` d'un sous-objet du schéma serait pris pour le
 *   discriminant de l'effet). Aucun schéma d'`effets.ts` n'est dans ce cas aujourd'hui.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { effectSchema } from './effets';

const SCENE = fileURLToPath(new URL('../../../state/scene.ts', import.meta.url));
const EFFETS = fileURLToPath(new URL('./effets.ts', import.meta.url));
const FLOW_CORE = fileURLToPath(new URL('../../../engine/flowCore.ts', import.meta.url));

const source = (f: string): ts.SourceFile => ts.createSourceFile(f, readFileSync(f, 'utf8'), ts.ScriptTarget.ESNext, true);

/** Texte d'un littéral de chaîne d'un nœud de TYPE (`type: 'ops'`), `null` sinon. */
const litDeType = (t: ts.TypeNode | undefined): string | null =>
  t && ts.isLiteralTypeNode(t) && ts.isStringLiteralLike(t.literal) ? t.literal.text : null;

/** Discriminant `type` porté par un corps de type manuscrit (littéral, ou intersection qui en
 *  contient un — `DelayedEffect` = `{ type: 'delayedEffect'; … } & ScheduleSpec`). */
function typeDuCorps(n: ts.TypeNode | ts.InterfaceDeclaration): string | null {
  const membres: ts.NodeArray<ts.TypeElement> | ts.TypeElement[] = ts.isInterfaceDeclaration(n)
    ? n.members
    : ts.isTypeLiteralNode(n)
      ? n.members
      : [];
  for (const m of membres) if (ts.isPropertySignature(m) && m.name.getText() === 'type') return litDeType(m.type);
  if (!ts.isInterfaceDeclaration(n) && ts.isIntersectionTypeNode(n))
    for (const t of n.types) {
      const trouve = typeDuCorps(t);
      if (trouve) return trouve;
    }
  return null;
}

/** Discriminants des corps MANUSCRITS (`type: 'x'`) déclarés dans un fichier, par nom de type. */
function corpsManuscrits(f: string): Map<string, string | null> {
  const out = new Map<string, string | null>();
  source(f).forEachChild((n) => {
    if (ts.isTypeAliasDeclaration(n)) out.set(n.name.text, typeDuCorps(n.type));
    else if (ts.isInterfaceDeclaration(n)) out.set(n.name.text, typeDuCorps(n));
  });
  return out;
}

/** Discriminants des SCHÉMAS d'effet, lus à l'AST d'`effets.ts` : `export const xSchema =
 *  z.strictObject({ type: z.literal('x'), … })`. */
function litterauxDesSchemas(): Map<string, string | null> {
  const out = new Map<string, string | null>();
  source(EFFETS).forEachChild((n) => {
    if (!ts.isVariableStatement(n)) return;
    for (const d of n.declarationList.declarations) {
      if (!ts.isIdentifier(d.name) || !d.initializer) continue;
      let lit: string | null = null;
      const chercher = (x: ts.Node): void => {
        if (
          ts.isPropertyAssignment(x) &&
          x.name.getText() === 'type' &&
          ts.isCallExpression(x.initializer) &&
          ts.isPropertyAccessExpression(x.initializer.expression) &&
          x.initializer.expression.name.text === 'literal' &&
          ts.isStringLiteralLike(x.initializer.arguments[0])
        ) {
          lit ??= (x.initializer.arguments[0] as ts.StringLiteral).text;
          return;
        }
        ts.forEachChild(x, chercher);
      };
      chercher(d.initializer);
      out.set(d.name.text, lit);
    }
  });
  return out;
}

/** Les `type` de l'union manuscrite `Effect`, lus à l'AST. Un membre non résolu sort sous une clé
 *  `<…>` PARLANTE : il ferait rougir l'égalité au lieu de disparaître en silence. */
function typesDuType(texteScene?: string): string[] {
  const schemas = litterauxDesSchemas();
  const manuscrits = new Map([...corpsManuscrits(SCENE), ...corpsManuscrits(FLOW_CORE)]);
  const sf = texteScene ? ts.createSourceFile(SCENE, texteScene, ts.ScriptTarget.ESNext, true) : source(SCENE);
  const types: string[] = [];
  sf.forEachChild((n) => {
    if (!ts.isTypeAliasDeclaration(n) || n.name.text !== 'Effect') return;
    const membres = ts.isUnionTypeNode(n.type) ? n.type.types : [n.type];
    for (const m of membres) {
      if (!ts.isTypeReferenceNode(m)) {
        types.push(`<non-référence: ${m.getText().slice(0, 40)}>`);
        continue;
      }
      // `z.infer<typeof xSchema>` — le membre COMPOSE un schéma nommé de `effets.ts`.
      const arg = m.typeArguments?.[0];
      if (arg && ts.isTypeQueryNode(arg) && ts.isIdentifier(arg.exprName)) {
        const nom = arg.exprName.text;
        // DEUX causes distinctes, deux libellés : le schéma n'existe pas dans `effets.ts`, ou il y
        // existe mais ne porte aucun `type: z.literal(…)`. Les confondre enverrait chercher un
        // discriminant manquant là où c'est le SYMBOLE qui est introuvable.
        if (!schemas.has(nom)) {
          types.push(`<symbole introuvable dans effets.ts: ${nom}>`);
          continue;
        }
        types.push(schemas.get(nom) ?? `<schéma sans littéral \`type\`: ${nom}>`);
        continue;
      }
      const nom = m.typeName.getText();
      types.push(manuscrits.get(nom) ?? `<corps manuscrit introuvable: ${nom}>`);
    }
  });
  return types;
}

/** Les discriminants des options d'`effectSchema` — le `z.lazy` est déroulé pour atteindre la
 *  `discriminatedUnion` réellement servie à la porte. */
function typesDuSchema(): string[] {
  const anyS = effectSchema as unknown as { def: { type: string; getter?: () => unknown } };
  const inner = (anyS.def.type === 'lazy' ? anyS.def.getter!() : anyS) as { def: { options: unknown[] } };
  return inner.def.options.map((o) => {
    const opt = o as { def?: { shape?: Record<string, unknown> }; shape?: Record<string, unknown> };
    const lit = (opt.def?.shape ?? opt.shape)!.type as { def: { values?: Iterable<string>; value?: unknown } };
    return lit.def.values ? [...lit.def.values][0] : String(lit.def.value);
  });
}

describe('`effectSchema` — verrou d\'union : les discriminants du SCHÉMA == ceux du TYPE', () => {
  const typesType = typesDuType();
  const typesSchema = typesDuSchema();
  const duType = new Set(typesType);
  const duSchema = new Set(typesSchema);

  it('les deux extractions VOIENT leur union (une lecture muette rendrait l\'égalité vacueuse)', () => {
    expect(typesType.length).toBeGreaterThan(50);
    expect(typesSchema.length).toBeGreaterThan(50);
    expect(
      typesType.filter((k) => k.startsWith('<')),
      `Membre(s) d'\`Effect\` dont le discriminant n'a pas été résolu :\n${typesType.filter((k) => k.startsWith('<')).join('\n')}`,
    ).toEqual([]);
    expect(typesSchema.length, 'discriminant DUPLIQUÉ dans les options du schéma.').toBe(duSchema.size);
    expect(typesType.length, 'membre DUPLIQUÉ dans l\'union manuscrite `Effect`.').toBe(duType.size);
  });

  it('AUCUNE variante du type ne MANQUE au schéma — la porte refuserait un effet que le moteur exécute', () => {
    const manquants = [...duType].filter((k) => !duSchema.has(k));
    expect(manquants, `Variante(s) d'\`Effect\` absente(s) des options d'\`effectSchema\` (refusées au runtime) :\n${manquants.join('\n')}`).toEqual([]);
  });

  it('AUCUNE variante EN TROP au schéma — la porte accepterait un effet que le moteur ne sait pas exécuter', () => {
    const enTrop = [...duSchema].filter((k) => !duType.has(k));
    expect(enTrop, `Option(s) d'\`effectSchema\` sans membre correspondant dans \`Effect\` :\n${enTrop.join('\n')}`).toEqual([]);
  });

  it('un membre dont le SCHÉMA n’est plus résolu sort NOMMÉ, jamais en silence (preuve de câblage)', () => {
    const brut = readFileSync(SCENE, 'utf8');
    // La sonde vise un membre de l'UNION `Effect` : `state/scene.ts` compose aussi les FORMES de la
    // scène en `z.infer` (`defs-scenes/scene.ts`), qui ne sont pas des effets et que ce verrou ne
    // mesure pas. Le premier `z.infer` du fichier n'est donc pas forcément un membre d'`Effect`.
    const bloc = /export type Effect =[\s\S]*?;\n/.exec(brut);
    expect(bloc, 'union `Effect` introuvable dans `state/scene.ts` : la sonde ne mesure plus rien.').not.toBeNull();
    const premier = /z\.infer<typeof (\w+)>/.exec(bloc![0]);
    expect(premier, 'aucun membre `z.infer<typeof …>` dans `Effect` : la sonde ne mesure plus rien.').not.toBeNull();

    const nom = premier![1];
    const mute = brut.replace(`z.infer<typeof ${nom}>`, `z.infer<typeof ${nom}Ailleurs>`);
    expect(mute, 'la mutation n’a rien changé — la sonde serait vacueuse.').not.toBe(brut);

    // Un symbole de schéma qui disparaît ne doit PAS s'évaporer de l'union (le verrou deviendrait
    // vert en mesurant une union amputée) : il sort sous sa clé `<…>` et fait rougir l'égalité.
    expect(typesDuType(mute).filter((k) => k.startsWith('<'))).toEqual([
      `<symbole introuvable dans effets.ts: ${nom}Ailleurs>`,
    ]);
  });
});
