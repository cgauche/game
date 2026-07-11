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
  'editor/WorldMapEditor.tsx': 6,
  'WorldMapView.tsx': 13,
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
});
