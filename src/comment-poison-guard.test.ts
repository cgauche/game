import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Garde-fou commentaires (#136) — l'app détecte elle-même le poison de commentaires (CLAUDE.md règle 6).
 * Deux familles scannées, dans les COMMENTAIRES de src/**\/*.ts(x) seulement (jamais les chaînes ni le
 * texte de scénario) :
 *   1. PIERRE TOMBALE (règle 6c) — rappelle un état de code qui n'existe plus. Tolérance ZÉRO, aucune
 *      liste d'exception : un cas légitime se reformule plutôt que d'être toléré.
 *   2. Commentaire-EXCUSE (règle 6b) — justifie une exception ou une déviation sans validation
 *      traçable. Seul un tag `[entériné AAAA-MM-JJ]` porté par le MÊME commentaire la neutralise.
 * Patron repris de combat-hardcode-guard.test.ts / no-emoji-affordance.test.ts (scan fs + regex).
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url)); // racine du projet (src/ → ..)
const SRC_DIR = join(ROOT, 'src');

interface Comment {
  /** Texte du commentaire, délimiteurs inclus (`// …` ou `/* … *​/`). Les lignes `//` consécutives sur
   *  des lignes sources adjacentes sont FUSIONNÉES en un seul commentaire logique (un tag porté sur la
   *  ligne suivante neutralise l'excuse de la ligne précédente, comme le lirait un humain). */
  text: string;
  /** Ligne de départ (1-based) dans le fichier source. */
  line: number;
}

/** Extrait tous les commentaires `//` et `/* *​/` d'un source TS/TSX, en ignorant le contenu des
 *  chaînes ('…', "…", `…`) — une occurrence dans une chaîne ou un littéral de scénario n'est PAS un
 *  commentaire. Heuristique volontairement simple (comme les gardes voisines) : suffisante pour du
 *  TypeScript/TSX standard, pas un vrai lexer. */
function extractComments(src: string): Comment[] {
  type Raw = { kind: 'line' | 'block'; text: string; line: number };
  const raw: Raw[] = [];
  let i = 0;
  let line = 1;
  const n = src.length;
  while (i < n) {
    const ch = src[i];
    if (ch === '\n') {
      line++;
      i++;
      continue;
    }
    if (ch === '/' && src[i + 1] === '/') {
      const startLine = line;
      let j = i + 2;
      while (j < n && src[j] !== '\n') j++;
      raw.push({ kind: 'line', text: src.slice(i, j), line: startLine });
      i = j;
      continue;
    }
    if (ch === '/' && src[i + 1] === '*') {
      const startLine = line;
      let j = i + 2;
      while (j < n && !(src[j] === '*' && src[j + 1] === '/')) {
        if (src[j] === '\n') line++;
        j++;
      }
      j = Math.min(j + 2, n);
      raw.push({ kind: 'block', text: src.slice(i, j), line: startLine });
      i = j;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      let j = i + 1;
      while (j < n && src[j] !== quote) {
        if (src[j] === '\\') {
          j++;
          if (src[j] === '\n') line++;
          j++;
          continue;
        }
        if (src[j] === '\n') line++;
        j++;
      }
      i = Math.min(j + 1, n);
      continue;
    }
    i++;
  }

  // Fusion des `//` consécutifs (lignes sources adjacentes, sans code entre eux) : un seul commentaire
  // logique — sinon un tag `[entériné …]` posé sur la ligne suivante ne « couvrirait » jamais l'excuse
  // énoncée sur la ligne précédente.
  const merged: Comment[] = [];
  let k = 0;
  while (k < raw.length) {
    const cur = raw[k];
    if (cur.kind === 'line') {
      let text = cur.text;
      let endLine = cur.line;
      let m = k + 1;
      while (m < raw.length && raw[m].kind === 'line' && raw[m].line === endLine + 1) {
        text += '\n' + raw[m].text;
        endLine = raw[m].line;
        m++;
      }
      merged.push({ text, line: cur.line });
      k = m;
    } else {
      merged.push({ text: cur.text, line: cur.line });
      k++;
    }
  }
  return merged;
}

/** Ligne absolue (1-based) d'un index de match DANS `comment.text`. */
function matchLine(comment: Comment, matchIndex: number): number {
  return comment.line + comment.text.slice(0, matchIndex).split('\n').length - 1;
}

/** Extrait de contexte lisible autour d'un match (une ligne, tronquée). */
function excerptAt(comment: Comment, matchIndex: number): string {
  const lineStart = comment.text.lastIndexOf('\n', matchIndex) + 1;
  let lineEnd = comment.text.indexOf('\n', matchIndex);
  if (lineEnd < 0) lineEnd = comment.text.length;
  return comment.text.slice(lineStart, lineEnd).trim().slice(0, 140);
}

function scanSrcFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(e)) files.push(p);
    }
  };
  walk(SRC_DIR);
  return files;
}

// ---------------------------------------------------------------------------------------------
// Famille 1 — PIERRE TOMBALE (CLAUDE.md règle 6c). Tolérance ZÉRO, pas d'exception.
// ---------------------------------------------------------------------------------------------

// Bâti via String.fromCharCode (pas un caractère back-tick littéral dans CE fichier) : le lexeur
// maison du scanner ci-dessous (extractComments) ne comprend pas les littéraux regex — un back-tick
// littéral ici serait lu comme le début d'un template string de CODE et désynchroniserait tout le
// reste du fichier (les commentaires/chaînes suivants seraient mal découpés).
const BT = String.fromCharCode(96);
const CODE_TOMBSTONE_RETIRE_RX = new RegExp(
  '(ancien\\w*|' + BT + '[^' + BT + ']+' + BT + '|«[^»]+»)[\\s\\S]{0,200}?a été (retiré|supprimé|renommé)',
  'i',
);

const TOMBSTONE_FAMILIES: { rx: RegExp; label: string }[] = [
  // NB : l'accord féminin/pluriel du participe passé est couvert par les suffixes optionnels
  // (« e »/« s »), sinon la famille ne matcherait jamais la forme la plus courante.
  //
  // Affinage #136 (post-scan agent, 51 offenders triés à la main) : la famille brute matchait aussi un
  // déplacement PHYSIQUE en jeu/UI, jamais suivi d'un article en vrai tombstone de code (qui cible
  // toujours un module ou un chemin, jamais précédé d'un déterminant). Le lookahead négatif écarte
  // l'article ; cf. tests plantés ci-dessous (cas positif ET faux positif écarté) pour la preuve.
  { rx: /déplacée?s? (vers|dans) (?!la\b|le\b|un\b|une\b|les\b)/i, label: 'déplacé(e)(s) vers/dans (code)' },
  { rx: /anciennement/i, label: 'anciennement' },
  { rx: /\bex-[A-Z]/, label: 'ex-Nom' },
  { rx: /désormais (dans|via|par)/i, label: 'désormais dans/via/par' },
  // Affinage #136 : la famille brute matchait aussi le vocabulaire de JEU (un pion d'armure ou une
  // provision quittant l'inventaire EN JEU, pas du code quittant le dépôt). Une vraie pierre tombale de
  // code NOMME l'artefact : le mot "ancien", un identifiant entre back-ticks (`, en échappement
  // Unicode ci-dessous — un back-tick LITTÉRAL dans CE fichier casse le lexeur maison de ce garde-fou,
  // qui ne distingue pas un back-tick de template string d'un back-tick de regex), ou un nom entre
  // guillemets — on exige l'un des trois à proximité. Cf. tests plantés ci-dessous (cas positif ET
  // faux positif écarté) pour la preuve.
  {
    rx: CODE_TOMBSTONE_RETIRE_RX,
    label: 'a été retiré/supprimé/renommé (code)',
  },
  // Affinage #136 : « avant : » nu matchait aussi le vocabulaire de RENDU/JEU (façade, direction, ou un
  // état de PERSONNAGE antérieur à un entraînement). Une vraie pierre tombale de code compare
  // EXPLICITEMENT à l'ancien comportement via une locution dédiée, ou cite la valeur/le message
  // d'avant entre guillemets. Cf. tests plantés ci-dessous (cas positif ET faux positif écarté).
  { rx: /(comme avant\s*:|avant\s*:\s*«)/i, label: 'avant : (comparaison au code)' },
];

function tombstonesIn(text: string): string[] {
  return TOMBSTONE_FAMILIES.filter((f) => f.rx.test(text)).map((f) => f.label);
}

describe('garde-fou commentaires — pierres tombales (#136, CLAUDE.md règle 6c)', () => {
  it('cas planté : un rappel d\'ancien emplacement est détecté (preuve TDD)', () => {
    const planted = "// Cette logique vit ici anciennement dans un autre module.";
    expect(tombstonesIn(planted)).toContain('anciennement');
  });

  it('cas planté : "déplacé(e) vers/dans" est détecté même au féminin/pluriel (preuve TDD)', () => {
    expect(tombstonesIn('// Fonction déplacée vers state/foo.ts').length).toBeGreaterThan(0);
    expect(tombstonesIn('// Fonctions déplacées dans state/foo.ts').length).toBeGreaterThan(0);
  });

  it('faux positif écarté : "déplacé dans la boîte" (a11y, pas du code — affinage #136)', () => {
    expect(tombstonesIn('// focus déplacé dans la boîte à l\'ouverture.')).toEqual([]);
  });

  it('cas planté : "l\'ancien X a été supprimé" est détecté (preuve TDD affinage #136)', () => {
    expect(tombstonesIn("// L'ancien registre `FOO_BY_LABEL` a été supprimé.").length).toBeGreaterThan(0);
    expect(tombstonesIn('// Le marqueur `(2M)` a été supprimé.').length).toBeGreaterThan(0);
  });

  it('faux positif écarté : "une PA/ration a été retirée" (vocabulaire de jeu — affinage #136)', () => {
    expect(tombstonesIn('// RETOURNE true si une PA a été retirée.')).toEqual([]);
    expect(tombstonesIn("// Une ration a été retirée de l'inventaire.")).toEqual([]);
  });

  it('cas planté : "comme avant :" et "avant : «X»" sont détectés (preuve TDD affinage #136)', () => {
    expect(tombstonesIn('// ignorées (comme avant : un libellé non catalogué n\'était pas trouvé).').length).toBeGreaterThan(0);
    expect(tombstonesIn('// doit ouvrir la modale (avant : « hors de portée »)').length).toBeGreaterThan(0);
  });

  it('faux positif écarté : "avant" de façade/rendu/entraînement (affinage #136)', () => {
    expect(tombstonesIn("// Cadre d'avant : ARC VU DE CHANT.")).toEqual([]);
    expect(tombstonesIn("// vue de dos (plan avant : couvre le dos, plis)")).toEqual([]);
    expect(tombstonesIn("// qui pointe vers l'avant : sinon de profil la jambe est un poteau nu.")).toEqual([]);
    expect(tombstonesIn('// Espèces mises en avant : celles du Livre de base.')).toEqual([]);
    expect(tombstonesIn('// avant : Esquive pénalisée')).toEqual([]);
    expect(tombstonesIn("// avant : pas d'arme à 2 mains")).toEqual([]);
  });

  it('cas planté : un commentaire neutre ne matche aucune famille (contrôle négatif)', () => {
    expect(tombstonesIn('// Calcule le total des dégâts appliqués à la cible.')).toEqual([]);
  });

  it('aucun commentaire de src/**/*.ts(x) ne porte une pierre tombale (tolérance ZÉRO, pas d’exception)', () => {
    const offenders: string[] = [];
    for (const f of scanSrcFiles()) {
      const rel = relative(ROOT, f).split('\\').join('/');
      const text = readFileSync(f, 'utf8');
      for (const c of extractComments(text)) {
        for (const fam of TOMBSTONE_FAMILIES) {
          const m = fam.rx.exec(c.text);
          if (m) offenders.push(`${rel}:${matchLine(c, m.index)} [${fam.label}] ${excerptAt(c, m.index)}`);
        }
      }
    }
    expect(
      offenders,
      `Pierre(s) tombale(s) détectée(s) — à PURGER (jamais à taguer en exception, CLAUDE.md règle 6c) :\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// Famille 2 — commentaire-EXCUSE (CLAUDE.md règle 6b). Un tag `[entériné AAAA-MM-JJ]` dans le MÊME
// commentaire neutralise la détection (décision utilisateur traçable).
// ---------------------------------------------------------------------------------------------

const EXCUSE_RX = /(assume|épargn[ée]|pour l'instant|pas encore|temporairement)/i;
const ENTERINE_TAG_RX = /\[entériné \d{4}-\d{2}-\d{2}\]/;

function untaggedExcuseMatch(text: string): RegExpExecArray | null {
  if (ENTERINE_TAG_RX.test(text)) return null;
  return EXCUSE_RX.exec(text);
}

/** Activation différée (#136) : le scan réel ci-dessous recense les excuses sans tag sur l'arbre actuel
 *  (rapport agent 2026-07-06) — bascule à `true` une fois le tri utilisateur fait (tag `[entériné …]`
 *  ou reformulation de chaque entrée listée). */
const EXCUSE_GUARD_ACTIVE = false;

describe('garde-fou commentaires — excuses non tracées (#136, CLAUDE.md règle 6b)', () => {
  it('cas planté : une justification sans tag est détectée (preuve TDD)', () => {
    expect(untaggedExcuseMatch("// on garde X pour l'instant")).not.toBeNull();
  });

  it('cas planté : le tag [entériné AAAA-MM-JJ] neutralise la détection (preuve TDD)', () => {
    expect(untaggedExcuseMatch("// on garde X pour l'instant [entériné 2026-07-06]")).toBeNull();
  });

  it('cas planté : un commentaire neutre ne matche pas (contrôle négatif)', () => {
    expect(untaggedExcuseMatch('// Calcule le total des dégâts appliqués à la cible.')).toBeNull();
  });

  (EXCUSE_GUARD_ACTIVE ? it : it.skip)(
    'aucune excuse de src/**/*.ts(x) sans tag [entériné AAAA-MM-JJ] (désactivée — cf. rapport agent)',
    () => {
      const offenders: string[] = [];
      for (const f of scanSrcFiles()) {
        const rel = relative(ROOT, f).split('\\').join('/');
        const text = readFileSync(f, 'utf8');
        for (const c of extractComments(text)) {
          const m = untaggedExcuseMatch(c.text);
          if (m) offenders.push(`${rel}:${matchLine(c, m.index)} ${excerptAt(c, m.index)}`);
        }
      }
      expect(
        offenders,
        `Excuse(s) sans tag \`[entériné AAAA-MM-JJ]\` (CLAUDE.md règle 6b) :\n${offenders.join('\n')}`,
      ).toEqual([]);
    },
  );
});
