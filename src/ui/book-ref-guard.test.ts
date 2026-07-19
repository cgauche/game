import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Garde-fou « réf de livre hors surface Codex » (#601, même classe que #596).
 *
 * Une référence de livre (`LDB 23 l.141`, `MDG 12`…) est une information d'AUTEUR : elle a sa place
 * dans un commentaire (CLAUDE.md règle 6 : la réf NUE y fait foi), dans la donnée (`source: {book,
 * page}`), et sur les surfaces qui CITENT leur source — le Codex/Compendium, où `CodexRef` la rend
 * lui-même en pied de popover. Elle n'a AUCUNE place sur une surface de JEU : le joueur n'ouvre pas
 * le livre, et une chips/infobulle « n'a de sens que si elle est reliée à une règle » (arbitrage
 * utilisateur #492) — c'est-à-dire via `CodexRef` vers une entrée RÉELLE, jamais un ref en dur.
 *
 * STRUCTURELLE, pas un grep : on lit l'AST TypeScript et on n'inspecte que les nœuds RENDUS
 * (littéraux de chaîne, texte JSX, morceaux de gabarit). Les commentaires sont de la trivia — ils
 * ne sont jamais visités, donc jamais faussement accusés.
 *
 * Les deux répertoires d'AUTORING sont dispensés (voir `AUTHORING_DIRS`) — pas une liste
 * d'exception à vider : une décision de PÉRIMÈTRE, stable.
 */

const UI_DIR = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(UI_DIR, '../..');

/** Sigles des livres autorisés (§ Sources VF) suivis d'un numéro de chapitre/fiche. */
const BOOK_REF = /\b(LDB|MDG|EDOC|EDO|ADE2?|ACE|T2C|NADAJ|ZI|AA)\s+\d+/;

/**
 * Surfaces d'AUTORING, dispensées au MÊME titre que le Codex — tranché sous #601.
 *
 * `src/ui/compendium/**` : le Codex EST la surface de citation ; `CodexRef` y rend `source.book
 * p.page` par construction, et l'éditeur de fiche (`CodexEdit`) sert à SAISIR cette source.
 *
 * `src/ui/editor/**` : l'éditeur de scène/statblock a pour utilisateur un AUTEUR, jamais un joueur.
 * Sa raison d'être est de produire de la donnée conforme au RAW, chaque entrée taguée à sa `source`
 * (CLAUDE.md règles 1 et 5) : un champ « Caractéristiques aléatoires (LDB 77 l.108) » dit à l'auteur
 * QUEL passage il implémente — c'est le même service que rend la réf en commentaire au codeur. La
 * retirer appauvrirait l'outil sans rien protéger, puisque aucune de ces vues n'est atteignable en
 * jouant.
 *
 * Cette frontière n'est pas posée ici : elle est DÉJÀ celle du dépôt.
 * `editor-quarantine-guard.test.ts` (#495) oppose l'« ATELIER » (`src/ui/editor/**`, vocabulaire
 * technique d'auteur) à la « surface JOUEUR », et range `compendium/CodexEdit.tsx`/`StructFields.tsx`
 * parmi les « surfaces d'atelier assumées ». Même partition, appliquée ici à la réf de livre.
 */
const AUTHORING_DIRS = ['src/ui/compendium/', 'src/ui/editor/'];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

/** Nœuds RENDUS uniquement — les commentaires (trivia) ne sont jamais visités. */
function renderedBookRefs(file: string): { line: number; text: string }[] {
  const src = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const hits: { line: number; text: string }[] = [];
  const visit = (node: ts.Node): void => {
    let text: string | null = null;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) text = node.text;
    else if (ts.isJsxText(node)) text = node.text;
    else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) text = node.text;
    if (text && BOOK_REF.test(text)) {
      hits.push({ line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, text: text.trim().slice(0, 120) });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return hits;
}

const posix = (p: string): string => relative(ROOT, p).replace(/\\/g, '/');

describe('réfs de livre — réservées au Codex et aux surfaces d’authoring (#601)', () => {
  it('aucune surface de JEU de src/ui ne rend une référence de livre', () => {
    const offenders: string[] = [];
    for (const file of walk(UI_DIR)) {
      const rel = posix(file);
      if (AUTHORING_DIRS.some((d) => rel.startsWith(d))) continue;
      for (const h of renderedBookRefs(file)) offenders.push(`${rel}:${h.line} — « ${h.text} »`);
    }
    expect(offenders, `Réf de livre rendue hors Codex (retirer la réf ; si la glose porte une RÈGLE, la relier par <CodexRef> à son entrée réelle) :\n${offenders.join('\n')}`).toEqual([]);
  });

  it('le détecteur voit RÉELLEMENT une réf rendue (et ignore les commentaires)', () => {
    // Preuve que la garde échoue sur la classe — sinon elle ne mesure que son angle mort.
    const probe = join(UI_DIR, '__probe.tsx');
    const sf = ts.createSourceFile(
      probe,
      ['// glose en commentaire (LDB 23 l.141) — tolérée', 'export const a = "Refuser la Faveur (LDB 23 l.141)";'].join('\n'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const hits: number[] = [];
    const visit = (n: ts.Node): void => {
      if (ts.isStringLiteral(n) && BOOK_REF.test(n.text)) hits.push(sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1);
      ts.forEachChild(n, visit);
    };
    visit(sf);
    expect(hits).toEqual([2]);
  });
});
