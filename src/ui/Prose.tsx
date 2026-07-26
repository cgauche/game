/**
 * Prose — primitive UNIQUE de rendu des descriptions (champs de prose des données, en **Markdown**).
 *
 * Règle 5 du projet : une description est un copié/collé VERBATIM de la source (Markdown), jamais du
 * HTML. Cette primitive rend ce Markdown en React via `react-markdown` (+ GFM) — le HTML brut N'EST
 * PAS interprété (pas de `rehype-raw`) → sûr sur du contenu éditable au Codex, pas de
 * `dangerouslySetInnerHTML`.
 *
 * Auto-liage : les mentions du vocabulaire de RÈGLES (carac/compétences/talents/états/manœuvres/
 * traits/qualités/domaines) deviennent des `CodexRef` cliquables (façon dev.html), via le plugin
 * rehype ci-dessous qui réutilise le tokeniseur PUR `tokenizeLinks` (source unique) — aucune logique
 * de liage dupliquée, ni HTML brut injecté (`dangerouslySetInnerHTML` proscrit ici).
 */
import { useMemo, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodexRef } from './compendium/CodexRef';
import { tokenizeLinks } from './compendium/relations';

/** Nœud HAST minimal (sous-ensemble manipulé par le plugin d'auto-liage). */
interface HastNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

/** Sous-arbres dont le texte n'est PAS auto-lié (liens existants, code). */
const NO_LINK_TAGS = new Set(['a', 'code', 'pre']);

/** Plugin rehype : remplace dans chaque nœud texte les mentions de règles par un élément `coderef`
 *  (mappé plus bas sur `CodexRef`). `tokenizeLinks` reste la SOURCE unique du matcher. */
function autolink(tree: HastNode, selfLabel?: string, selfCategory?: string, selfId?: string): void {
  const walk = (node: HastNode): void => {
    if (!node.children?.length || (node.tagName && NO_LINK_TAGS.has(node.tagName))) return;
    const next: HastNode[] = [];
    for (const child of node.children) {
      if (child.type === 'text' && typeof child.value === 'string') {
        const tokens = tokenizeLinks(child.value, selfLabel, selfCategory, selfId);
        if (tokens.length === 1 && typeof tokens[0] === 'string') {
          next.push(child);
        } else {
          for (const t of tokens) {
            if (typeof t === 'string') next.push({ type: 'text', value: t });
            else
              next.push({
                type: 'element',
                tagName: 'coderef',
                // `instance` = texte verbatim absorbant la spécialisation entre parenthèses (« Art
                // (Écriture) ») — la fiche ouverte reste le libellé de base (`reflabel`) ; `instance`
                // n'affecte que l'affichage du popover (cf. `CodexRef`), la fiche ne se paramètre pas.
                properties: { category: t.category, refid: t.id, reflabel: t.label, instance: t.spec ? t.text : undefined },
                children: [{ type: 'text', value: t.text }],
              });
          }
        }
      } else {
        walk(child);
        next.push(child);
      }
    }
    node.children = next;
  };
  walk(tree);
}

const COMPONENTS = {
  // Élément synthétique injecté par `autolink` → notre popover/lien de Codex.
  coderef: ({ node, children }: { node?: HastNode; children?: ReactNode }) => {
    const props = (node?.properties ?? {}) as { category?: string; refid?: string; reflabel?: string; instance?: string };
    return (
      <CodexRef category={String(props.category ?? '')} id={props.refid} label={String(props.reflabel ?? '')} instance={props.instance} inline>
        {children}
      </CodexRef>
    );
  },
} as Components;

/** Rend une description Markdown (verbatim de la source) en React, avec auto-liage des règles.
 *  `selfCategory` (catégorie de la fiche affichante) tranche les homonymes de vocabulaire — cf.
 *  `tokenizeLinks`/`PRIORITY_CAT_ORDER` (`relations.ts`). `selfId` (connu du Codex, `CodexItem.id`)
 *  affine l'anti-auto-lien ; sans lui, résolu depuis `selfLabel` (repli des appelants non migrés). */
export function Prose({ md, selfLabel, selfCategory, selfId }: { md: string; selfLabel?: string; selfCategory?: string; selfId?: string }) {
  const rehypePlugins = useMemo(() => [() => (tree: HastNode) => autolink(tree, selfLabel, selfCategory, selfId)], [selfLabel, selfCategory, selfId]);
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={rehypePlugins} components={COMPONENTS}>
      {md}
    </ReactMarkdown>
  );
}

/** Markdown → texte brut (tooltips/blurbs où l'on ne peut pas rendre de React). Approximatif (suffisant
 *  pour un aperçu tronqué) : retire la syntaxe d'emphase/listes/liens/titres et normalise les espaces. */
export function mdToText(md: string): string {
  return md
    .replace(/`{1,3}([^`]*)`{1,3}/g, '$1')        // code inline/fence
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')          // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')       // liens → texte
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')            // titres
    .replace(/^\s{0,3}>\s?/gm, '')                 // citations
    .replace(/^\s*[-*+]\s+/gm, '')                 // puces
    .replace(/^\s*\d+\.\s+/gm, '')                 // listes ordonnées
    .replace(/(\*\*|__)(.*?)\1/g, '$2')            // gras
    .replace(/(\*|_)(.*?)\1/g, '$2')               // italique
    .replace(/~~(.*?)~~/g, '$1')                   // barré
    .replace(/\s+/g, ' ')
    .trim();
}
