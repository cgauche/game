/**
 * LES KEYFRAMES DU STAGE SONT BRANCHÉES — `gameIso/anim.css` porte les animations que les surcouches
 * du monde RÉCLAMENT par leur `className` : projectiles et halos de FX (`.proj`), fourmis du gabarit
 * de zone d'effet (`.zde-ants`), pastilles d'état des jetons (`.token-endmark`/`.es-*`), faune et
 * ambiance (`.fly`, `.sway`, `.smoke`, `.glow`, `.breathe`, `.warm`). Une feuille de style
 * n'entre dans le bundle que si un module l'IMPORTE : personne ne l'important, toutes ces classes
 * restent des noms morts, sans une seule erreur — les projectiles cessent de voler en silence.
 *
 * Ce que ce banc tient : (1) `anim.css` est importée par l'HÔTE du monde (`stage/MondeDeCampagne`),
 * qui vit tant que l'écran de campagne vit — pas par une surcouche, qui se démonte au changement de
 * regard ; (2) toute classe ANIMÉE référencée par un composant de `gameIso/` a bien sa règle dans ce
 * fichier ; (3) la BOÎTE du plateau, `.iso-stage`, a sa feuille à elle (`stage/iso-stage.css`), et
 * tout module de `src/` qui rend un élément de cette classe l'importe — le canevas (`GameStage3D`,
 * que montent la campagne et l'éditeur) comme le SVG posé dessus (`SurcoucheIso`).
 *
 * PÉRIMÈTRE ET ANGLE MORT, énoncés. Le scan est TEXTUEL et STATIQUE : il lit les sources, jamais un
 * DOM. jsdom n'exécute NI les keyframes NI la cascade CSS — aucun test de rendu ne pourrait dire ici
 * qu'une animation « tourne ». Une classe construite dynamiquement (`\u0060es-${kind}\u0060`) n'est vue que par sa
 * RACINE ; une règle supprimée du CSS pendant que son nom survit dans un template littéral échappe
 * donc au volet (2) — c'est assumé : le cliquet garde le BRANCHEMENT (volet 1), qui est ce qui a
 * cassé, et le motif courant du dépôt pour le reste.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCorpus } from '../../../scripts/guards/lib/sourceCorpus.mjs';

const GAMEISO = fileURLToPath(new URL('../', import.meta.url)); // …/stage/ → …/gameIso/
const SOUS_GAMEISO = 'src/gameIso/';
const CSS = join(GAMEISO, 'anim.css');
/** L'HÔTE du monde : il ne se démonte qu'avec l'écran de campagne. */
const HOTE = join(GAMEISO, 'stage/MondeDeCampagne.tsx');
const FEUILLE_PLATEAU = join(GAMEISO, 'stage/iso-stage.css');

/** Le module IMPORTE-t-il la feuille ? Lecture LIGNE À LIGNE, commentaires écartés : un import mis en
 *  commentaire ne branche rien, et une regex posée sur le fichier entier le prendrait pour un import. */
const SAUT = String.fromCharCode(10);

export function importeFeuille(src: string, feuille: string): boolean {
  const rx = new RegExp(`^import\\s+['"](?:[^'"]*/)?${feuille.replace('.', '\\.')}['"]\\s*;?`);
  return src.split(SAUT).some((l) => {
    const t = l.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return false;
    return rx.test(t);
  });
}

/** Les classes du CSS qui portent une ANIMATION (les seules dont l'absence se voit à l'écran). */
export function classesAnimees(css: string): string[] {
  const out = new Set<string>();
  const bloc = /\.([\w-]+)(?:[^{}]*)\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = bloc.exec(css))) {
    if (/\banimation\s*:/.test(m[2])) out.add(m[1]);
  }
  return [...out];
}

/** Les sources de `gameIso/`, hors tests — chemin DEPUIS `gameIso/`, la forme que porte le rapport. */
function sources(): { chemin: string; code: string }[] {
  return readCorpus([SOUS_GAMEISO]).map(({ rel, text }) => ({
    chemin: rel.slice(SOUS_GAMEISO.length),
    code: text,
  }));
}

/** Les classes du CSS qu'un source RÉCLAME — dans un `className`/`class` littéral ou un template. */
export function classesReclamees(src: string, connues: readonly string[]): string[] {
  const out = new Set<string>();
  for (const c of connues) {
    // La classe est réclamée si son nom apparaît dans une valeur de classe : littéral (`"proj"`,
    // `'fly crow'`) ou template (`` `es-${k}` ``). On exige une frontière de mot pour ne pas
    // confondre `.fly` avec `.flyover`.
    const rx = new RegExp(`class(?:Name)?\\s*=\\s*(?:["'\`{][^"'\`]*)?\\b${c}\\b`);
    if (rx.test(src)) out.add(c);
  }
  return [...out];
}

describe('keyframes du stage — la feuille est BRANCHÉE, et sur l’hôte du monde', () => {
  it('`anim.css` est importée par l’hôte du monde (jamais par une surcouche, qui se démonte)', () => {
    const hote = readFileSync(HOTE, 'utf8');
    expect(
      importeFeuille(hote, 'anim.css'),
      '`stage/MondeDeCampagne` n’importe plus `gameIso/anim.css` : toutes les animations du stage sont mortes',
    ).toBe(true);
  });

  it('AUCUN autre module ne l’importe : une feuille globale a UN propriétaire', () => {
    const importeurs = sources()
      .filter(({ code }) => importeFeuille(code, 'anim.css'))
      .map(({ chemin }) => chemin);
    expect(importeurs, `deux propriétaires pour une même feuille :\n${importeurs.join('\n')}`)
      .toEqual(['stage/MondeDeCampagne.tsx']);
  });

  it('toute classe ANIMÉE réclamée par un composant de `gameIso/` a sa règle dans la feuille', () => {
    const animees = classesAnimees(readFileSync(CSS, 'utf8'));
    // PRÉMISSE — sans classes animées, tout ce qui suit serait vrai du vide.
    expect(animees.length, 'la feuille ne déclare aucune animation : la mesure porterait sur rien')
      .toBeGreaterThan(5);
    const reclamees = new Set<string>();
    for (const { code } of sources()) {
      for (const c of classesReclamees(code, animees)) reclamees.add(c);
    }
    // PRÉMISSE — le scan MORD : des composants réclament bien ces classes.
    expect(reclamees.size, 'aucune classe animée réclamée : le scan ne voit rien').toBeGreaterThan(3);
    const orphelines = [...reclamees].filter((c) => !animees.includes(c));
    expect(orphelines, `classes réclamées sans règle : ${orphelines.join(', ')}`).toEqual([]);
  });

  it('la BOÎTE du plateau : tout module de `src/` qui rend un élément `.iso-stage` importe `iso-stage.css`', () => {
    expect(
      /^\.iso-stage\s*\{/m.test(readFileSync(FEUILLE_PLATEAU, 'utf8')),
      '`stage/iso-stage.css` ne porte plus la règle `.iso-stage` : le plateau retombe à 300×150',
    ).toBe(true);
    const rendeurs = readCorpus(['src/'])
      .filter(({ text }) => classesReclamees(text, ['iso-stage']).length > 0);
    // PRÉMISSE — le scan MORD : le canevas et le SVG du plateau rendent bien la classe.
    expect(rendeurs.map(({ rel }) => rel), 'aucun rendeur de `.iso-stage` : le scan ne voit rien')
      .toEqual(expect.arrayContaining(['src/gameIso/stage/GameStage3D.tsx', 'src/gameIso/SurcoucheIso.tsx']));
    const sansFeuille = rendeurs.filter(({ text }) => !importeFeuille(text, 'iso-stage.css')).map(({ rel }) => rel);
    expect(sansFeuille, `rendent \`.iso-stage\` sans importer sa feuille :\n${sansFeuille.join('\n')}`).toEqual([]);
  });

  it('fail-closed : le scanner voit une déclaration et une réclamation SYNTHÉTIQUES', () => {
    expect(classesAnimees('.tourne { animation: tourne 2s linear infinite; }')).toEqual(['tourne']);
    expect(classesAnimees('.plate { color: red; }')).toEqual([]);
    expect(classesReclamees('<g className="proj tourne" />', ['tourne'])).toEqual(['tourne']);
    expect(classesReclamees('<g className={`es-${k}`} />', ['es-mort'])).toEqual([]);
    expect(classesReclamees('<g className="tournevis" />', ['tourne'])).toEqual([]);
    // …et un import MIS EN COMMENTAIRE ne branche rien (c'est exactement la panne mesurée).
    expect(importeFeuille("import '../anim.css';", 'anim.css')).toBe(true);
    expect(importeFeuille("// import '../anim.css';", 'anim.css')).toBe(false);
    expect(importeFeuille(" * import '../anim.css';", 'anim.css')).toBe(false);
    expect(importeFeuille("import './stage/iso-stage.css';", 'iso-stage.css')).toBe(true);
    expect(importeFeuille("import './iso-stage.css';", 'iso-stage.css')).toBe(true);
    expect(importeFeuille("import './faux-iso-stage.css';", 'iso-stage.css')).toBe(false);
    expect(classesReclamees('<svg className="iso-stage" />', ['iso-stage'])).toEqual(['iso-stage']);
  });
});
