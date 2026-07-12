import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Cliquets d'hygiène UI (#236) — même patron que `combat-hardcode-guard`/`no-emoji-affordance` : une
 * BASELINE gèle, PAR FICHIER, la dette tolérée au recensement ; toute HAUSSE échoue (régression) et
 * toute baseline devenue trop haute (fichier assaini) doit être ABAISSÉE. On ne PURGE pas la dette
 * ici — on interdit sa croissance et on impose la décrue.
 */

const UI = fileURLToPath(new URL('.', import.meta.url)); // src/ui/

function walk(dir: string, test: (f: string) => boolean, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, test, acc);
    else if (test(e)) acc.push(p);
  }
  return acc;
}
const rel = (abs: string) => abs.slice(UI.length).split('\\').join('/');

function assertRatchet(counts: Record<string, number>, baseline: Record<string, number>, what: string) {
  const over: string[] = [];
  for (const [f, n] of Object.entries(counts)) {
    const b = baseline[f] ?? 0;
    if (n > b) over.push(`${f} : ${n} (baseline ${b})`);
  }
  expect(over, `Régression ${what} — utiliser le token/la primitive, ou ABAISSER une baseline assainie :\n${over.join('\n')}`).toEqual([]);
  const stale: string[] = [];
  for (const [f, b] of Object.entries(baseline)) {
    const n = counts[f] ?? 0;
    if (n < b) stale.push(`${f} : baseline ${b}, réel ${n}`);
  }
  expect(stale, `Baseline(s) PÉRIMÉE(s) ${what} — abaisser :\n${stale.join('\n')}`).toEqual([]);
}

// ── (iv) Couleurs hex hors tokens `:root` : la palette vit dans `base.css` (§charte-ui). Tout hex
//    dans un AUTRE module CSS est de la dette gelée — le cliquet interdit sa hausse, impose la décrue.
//    Purge #310 : les 12 modules audités sont à ZÉRO — baseline vide, tolérance zéro. ──
const HEX_BASELINE: Record<string, number> = {};

// ── (v) Prix affichés ⇒ `<Coins>`/`formatMoney` : une valeur monétaire interpolée suivie d'une unité
//    nue (` CO`/` PA`/` CA`) dans le JSX est de la dette (illisible, non i18n). `Coins.tsx` définit
//    l'unité (exclu). Migré au #310 (ConditionEditor/EffectList/PortView → formatMoney/<Coins>) : la
//    dette réelle est retombée à zéro — heuristique fail-closed, sans baseline. Les 4 faux positifs
//    restants (CharacterSheet/CharacterCreator/GameOpEditor/EquipmentPanel) ne sont PAS de la monnaie
//    (« PA » = Points d'Armure, LDB) : exemption nominative gelée en dur ci-dessous plutôt qu'en
//    baseline (aucun de ces sites n'est censé approcher zéro un jour).
const PRICE_PA_ARMOR_EXEMPT = new Set([
  'CharacterSheet.tsx',
  'creator/CharacterCreator.tsx',
  'editor/GameOpEditor.tsx',
  'EquipmentPanel.tsx',
]);
const PRICE_BASELINE: Record<string, number> = {};

// ── (vii) `flex-wrap: wrap` hors `components.css` : le motif « rangée qui s'enroule » vit dans
//    `.bar`/primitives partagées de `components.css` (§charte-ui). Un `flex-wrap` codé en dur dans un
//    AUTRE module CSS est de la dette gelée (#287) — le cliquet interdit sa hausse, impose la décrue. ──
const FLEX_WRAP_BASELINE: Record<string, number> = {
  'styles/base.css': 5,
  'styles/codex-edit.css': 1,
  'styles/combat-modals.css': 7,
  'styles/combat-ui.css': 7,
  'styles/compendium.css': 3,
  'styles/creator.css': 8,
  'styles/editor.css': 10,
  'styles/gauges.css': 1,
  'styles/hud.css': 5,
  'styles/mass-battle.css': 2,
  'styles/merchant.css': 2,
  'styles/sheet.css': 2,
  'styles/world-meta.css': 22,
};

// ── (viii) Couleurs `fill=`/`stroke=` LITTÉRALES dans le JSX de `src/ui` : un fill/stroke codé en dur
//    (hex/rgb/hsl) hors token `var(--…)` est de la dette — hors thème, illisible quand la surface change
//    de fond (bug « texte noir sur noir » du hub de voyage, user 2026-07-11). BASELINE = surfaces d'ART /
//    de CARTE existantes (aperçu de personnage, canevas de l'éditeur, carte du monde parcheminée) gelées
//    nominativement ; tout NOUVEAU .tsx reste à ZÉRO. Les defs d'art de `gameIso` sont hors périmètre
//    (scan borné aux `.tsx` de `src/ui`). `fill="none"`/`url(#…)`/`currentColor` ne sont pas des littéraux.
const FILL_LITERAL_BASELINE: Record<string, number> = {
  'AppearancePanel.tsx': 1,
  'EquipmentPanel.tsx': 1,
  'editor/EditorCanvas.tsx': 9,
  'editor/Inspector.tsx': 1,
};

// ── (ix) Redéfinition de `.panel` hors `components.css` : la primitive canonique (#306) n'a qu'UNE
//    définition — un module qui la redéclare la rend inerte EN SILENCE (override, seul l'ORDRE d'@import
//    décide à spécificité égale ; à spécificité SUPÉRIEURE le composé écrase toujours, @media du canon
//    compris). C'était le piège de la règle MORTE `base.css` `@media 700px .panel{padding}` (base.css
//    @import AVANT components.css → jamais appliquée), ET l'angle mort des composés `.interlude-hero.panel`
//    (0,2,0) que l'ancre `^\s*\.panel` ne voyait pas (le sélecteur ne COMMENCE pas par `.panel`). Le cliquet
//    couvre donc TOUT `.panel` porté par le MÊME élément : bare en tête de sélecteur (`^\s*\.panel`), OU
//    composé à une autre classe (`X.panel`, ex. `.interlude-hero.panel`), modificateurs `.mod`/`:pseudo`/
//    `[attr]` inclus jusqu'à la fin du sélecteur (`\s*[,{]`). EXCLUS : les DESCENDANTS/enfants (`.panel h3`,
//    `.panel-grid > .panel`) — `.panel` n'y est pas compound sur le même élément, ils scopent sans remplacer
//    la surface — et la classe distincte `.panel-grid` (`.panel` suivi de `-`). La densité mobile du canon
//    vit DANS components.css, APRÈS la base, pour gagner la cascade.
// BASELINE nominative : les 3 spécialisations LÉGITIMES de l'interlude (world-meta.css) — carte d'Activité
//    à liseré d'or (`.interlude-hero.panel`, densité resserrée assumée), son état actif, et le bandeau de
//    bataille à liseré rouge (`.interlude-battle-banner.panel`). Densité CONSTANTE voulue (déjà compacte
//    ≤700px) — plus jamais INVISIBLES au cliquet. Tout NOUVEAU composé `.panel` reste à ZÉRO.
const PANEL_REDEFINE_BASELINE: Record<string, number> = {
  'styles/world-meta.css': 3,
};

describe('#236 — cliquets d’hygiène UI', () => {
  it('(iv) hex hors tokens : aucune hausse par module CSS (base.css exclu)', () => {
    const files = walk(UI, (e) => e.endsWith('.css') && e !== 'base.css');
    const counts: Record<string, number> = {};
    for (const f of files) {
      // Commentaires exclus du scan : un « #304 » de réf de ticket n'est pas une couleur.
      const css = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      const n = (css.match(/#[0-9a-fA-F]{3,8}\b/g) || []).length;
      if (n > 0) counts[rel(f)] = n;
    }
    assertRatchet(counts, HEX_BASELINE, 'hex hors tokens');
  });

  it('(v) prix ⇒ <Coins> : aucune composition manuelle de monnaie (fail-closed, exemptions PA nominatives)', () => {
    const files = walk(UI, (e) => /\.tsx$/.test(e) && !/\.test\./.test(e))
      .filter((f) => !f.endsWith('Coins.tsx'))
      .filter((f) => !PRICE_PA_ARMOR_EXEMPT.has(rel(f)));
    const counts: Record<string, number> = {};
    for (const f of files) {
      const n = (readFileSync(f, 'utf8').match(/\}[^<>{}]{0,4} (?:CO|PA|CA)\b/g) || []).length;
      if (n > 0) counts[rel(f)] = n;
    }
    assertRatchet(counts, PRICE_BASELINE, 'prix sans <Coins>');
  });

  it('(vii) flex-wrap: wrap hors components.css : aucune hausse par module CSS', () => {
    const files = walk(UI, (e) => e.endsWith('.css') && e !== 'components.css');
    const counts: Record<string, number> = {};
    for (const f of files) {
      const n = (readFileSync(f, 'utf8').match(/flex-wrap:\s*wrap/g) || []).length;
      if (n > 0) counts[rel(f)] = n;
    }
    assertRatchet(counts, FLEX_WRAP_BASELINE, 'flex-wrap hors components.css');
  });

  it('(viii) fill/stroke littéraux hors token var(--…) : aucune hausse par fichier .tsx', () => {
    const files = walk(UI, (e) => /\.tsx$/.test(e) && !/\.test\./.test(e));
    const counts: Record<string, number> = {};
    for (const f of files) {
      const n = (readFileSync(f, 'utf8').match(/(?:fill|stroke)=("|')(?:#|rgb|hsl)/g) || []).length;
      if (n > 0) counts[rel(f)] = n;
    }
    assertRatchet(counts, FILL_LITERAL_BASELINE, 'fill/stroke littéral hors token');
  });

  it('(ix) .panel non redéfini hors components.css (#306)', () => {
    const files = walk(UI, (e) => e.endsWith('.css') && e !== 'components.css');
    const counts: Record<string, number> = {};
    for (const f of files) {
      const css = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      // `.panel` porté par le MÊME élément : soit en TÊTE de sélecteur (`^\s*\.panel`, capture aussi les
      // redéfinitions indentées d'un `@media` — le piège #306), soit COMPOSÉ à une autre classe (`X.panel`,
      // ex. `.interlude-hero.panel` — l'angle mort de l'ancre seule). Les modificateurs du même élément
      // (`.mod`/`:pseudo`/`[attr]`) sont tolérés jusqu'à la FIN du sélecteur (`\s*[,{]`) ; les descendants
      // (`.panel h3`, `.panel-grid > .panel`) et la classe distincte `.panel-grid` (suivi de `-`) sont exclus.
      const n = (css.match(/(?:^\s*|[a-z0-9-])\.panel(?:[.:][\w-]+|\[[^\]]*\])*\s*[,{]/gm) || []).length;
      if (n > 0) counts[rel(f)] = n;
    }
    assertRatchet(counts, PANEL_REDEFINE_BASELINE, '.panel redéfini hors components.css');
  });
});
