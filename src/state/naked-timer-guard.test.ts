import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanNakedTimers, SCAN_DIR, ALLOWED } from '../../scripts/guards/lib/nakedTimerScan.mjs';

/**
 * Garde STRUCTURELLE #415 : un `setTimeout`/`setInterval` NU sous `src/state` (hors le wrapper
 * `combatTimers.ts`) est INEXPRIMABLE — tout timer réel qui mute l'état passe par
 * `scheduleCombatTimer`/`scheduleFlowTimer`. Exemption PAR SITE (`ALLOWED_SITES`, #776 LOT 6) —
 * jamais par fichier entier : une whitelist de fichier amnistierait tout futur timer nu ajouté
 * ailleurs dans ce même fichier (défaut mesuré, patron repris de `RATCHET_EXCEPTIONS` du garde-fou
 * label-logic + CLIQUET de péremption, même mécanique que `label-logic-guard.test.ts`).
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const DIR = join(ROOT, SCAN_DIR);

// Exemptions JUSTIFIÉES par SITE — une entrée = `fichier:ligne` EXACT (ligne rapportée par
// `scanNakedTimers`, sur contenu POST-retrait des commentaires). Toute dérive de ligne ou
// assainissement du site fait échouer le CLIQUET ci-dessous (à réviser, pas à re-décaler).
const ALLOWED_SITES: Record<string, string> = {
  'src/state/projectLibrary.ts:82':
    "timeout d'ouverture IndexedDB au BOOT (#776) — ne mute ni `battle` ni un flux de scène (rien " +
    "de tel n'existe encore à cet instant), n'est jamais nettoyé par `clearTrackedTimers` (afterEach " +
    "de test) : nature d'infrastructure, hors du périmètre COMBAT/FLUX de `combatTimers.ts`, pas un " +
    'contournement de son suivi.',
  'src/state/traceLayer.ts:76':
    "timeout d'ouverture IndexedDB au BOOT du calque de référence (#830) — même nature d'infra que " +
    "projectLibrary.ts:82 ci-dessus (aucun `battle`/flux de scène en jeu, jamais nettoyé par " +
    '`clearTrackedTimers`), magasin distinct.',
  'src/state/editorAutosave.ts:45':
    "timeout d'ouverture IndexedDB au BOOT du filet de crash de l'éditeur — même nature d'infra que " +
    'projectLibrary.ts:82/traceLayer.ts:76 ci-dessus (aucun `battle`/flux de scène en jeu, jamais ' +
    'nettoyé par `clearTrackedTimers`), magasin distinct.',
};

function scanFiles(): { abs: string; rel: string }[] {
  const out: { abs: string; rel: string }[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.[mc]?tsx?$/.test(e.name) && !/\.test\.[mc]?tsx?$/.test(e.name)) out.push({ abs: p, rel: relative(ROOT, p).split('\\').join('/') });
    }
  };
  walk(DIR);
  return out;
}

function findingsAcrossFiles(): { rel: string; line: number; call: string }[] {
  const out: { rel: string; line: number; call: string }[] = [];
  for (const { abs, rel } of scanFiles()) {
    if (ALLOWED.includes(rel)) continue;
    for (const f of scanNakedTimers(readFileSync(abs, 'utf8'))) out.push({ rel, line: f.line, call: f.call });
  }
  return out;
}

describe('garde structurelle — setTimeout/setInterval nu sous src/state (#415)', () => {
  it('aucun fichier hors whitelist/exemptions PAR SITE ne porte de timer nu', () => {
    const offenders = findingsAcrossFiles()
      .filter((f) => !(`${f.rel}:${f.line}` in ALLOWED_SITES))
      .map((f) => `${f.rel}:${f.line} ${f.call}(...) nu`);
    expect(
      offenders,
      '`setTimeout`/`setInterval` nu — router par `scheduleCombatTimer`/`scheduleFlowTimer` (src/state/combatTimers.ts) ou, si vraiment légitime, ajouter une entrée JUSTIFIÉE à ALLOWED_SITES (revue).',
    ).toEqual([]);
  });

  it('CLIQUET : toute exemption dont le site a bougé/disparu doit être RETIRÉE ou re-justifiée', () => {
    const present = new Set(findingsAcrossFiles().map((f) => `${f.rel}:${f.line}`));
    const stale = Object.keys(ALLOWED_SITES).filter((k) => !present.has(k));
    expect(stale, 'Exemption(s) PÉRIMÉE(s) (site déplacé/assaini) — retirer/re-pointer ces entrées de ALLOWED_SITES :\n' + stale.join('\n')).toEqual([]);
  });

  it('FAIL-CLOSED : le scanner détecte un appel nu ou global, ignore commentaires/propriété-tierce/type/clear*', () => {
    expect(scanNakedTimers('setTimeout(fn, 0);')).toHaveLength(1);
    expect(scanNakedTimers('window.setTimeout(fn, 0);')).toHaveLength(1);
    expect(scanNakedTimers('globalThis.setTimeout(fn, 0);')).toHaveLength(1);
    expect(scanNakedTimers('foo.setTimeout(fn, 0);')).toHaveLength(0);
    expect(scanNakedTimers('const t: ReturnType<typeof setTimeout> = x;')).toHaveLength(0);
    expect(scanNakedTimers('// un setTimeout(0) en commentaire')).toHaveLength(0);
    expect(scanNakedTimers('clearTimeout(id);')).toHaveLength(0);
  });
});
