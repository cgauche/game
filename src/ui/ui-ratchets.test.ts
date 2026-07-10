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
//    dans un AUTRE module CSS est de la dette gelée — le cliquet interdit sa hausse, impose la décrue. ──
const HEX_BASELINE: Record<string, number> = {
  'styles/codex-edit.css': 10,
  'styles/combat-modals.css': 11,
  'styles/combat-ui.css': 24,
  'styles/compendium.css': 1,
  'styles/components.css': 1,
  'styles/editor.css': 6,
  'styles/gauges.css': 1,
  'styles/house-rules.css': 3,
  'styles/hud.css': 23,
  'styles/mass-battle.css': 3,
  'styles/merchant.css': 3,
  'styles/sheet.css': 6,
  'styles/tavern.css': 1,
  'styles/world-meta.css': 7,
};

// ── (v) Prix affichés ⇒ `<Coins>`/`formatMoney` : une valeur monétaire interpolée suivie d'une unité
//    nue (` CO`/` PA`/` CA`) dans le JSX est de la dette (illisible, non i18n). `Coins.tsx` définit
//    l'unité (exclu). Baseline gelée au recensement — on migre vers `<Coins>`, on n'en ajoute pas. ──
const PRICE_BASELINE: Record<string, number> = {
  'CharacterSheet.tsx': 1,
  'creator/CharacterCreator.tsx': 1,
  'editor/ConditionEditor.tsx': 1,
  'editor/EffectList.tsx': 1,
  'editor/GameOpEditor.tsx': 1,
  'EquipmentPanel.tsx': 1,
  'PortView.tsx': 4,
};

// ── (vii) `flex-wrap: wrap` hors `components.css` : le motif « rangée qui s'enroule » vit dans
//    `.bar`/primitives partagées de `components.css` (§charte-ui). Un `flex-wrap` codé en dur dans un
//    AUTRE module CSS est de la dette gelée (#287) — le cliquet interdit sa hausse, impose la décrue. ──
const FLEX_WRAP_BASELINE: Record<string, number> = {
  'styles/base.css': 5,
  'styles/codex-edit.css': 1,
  'styles/combat-modals.css': 7,
  'styles/combat-ui.css': 7,
  'styles/compendium.css': 3,
  'styles/creator.css': 9,
  'styles/editor.css': 10,
  'styles/gauges.css': 1,
  'styles/hud.css': 5,
  'styles/mass-battle.css': 2,
  'styles/merchant.css': 3,
  'styles/sheet.css': 3,
  'styles/world-meta.css': 22,
};

describe('#236 — cliquets d’hygiène UI', () => {
  it('(iv) hex hors tokens : aucune hausse par module CSS (base.css exclu)', () => {
    const files = walk(UI, (e) => e.endsWith('.css') && e !== 'base.css');
    const counts: Record<string, number> = {};
    for (const f of files) {
      const n = (readFileSync(f, 'utf8').match(/#[0-9a-fA-F]{3,8}\b/g) || []).length;
      if (n > 0) counts[rel(f)] = n;
    }
    assertRatchet(counts, HEX_BASELINE, 'hex hors tokens');
  });

  it('(v) prix ⇒ <Coins> : aucune hausse d’unité monétaire nue accolée à une interpolation', () => {
    const files = walk(UI, (e) => /\.tsx$/.test(e) && !/\.test\./.test(e)).filter((f) => !f.endsWith('Coins.tsx'));
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
});
