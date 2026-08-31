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

// Exemptions JUSTIFIÉES par SITE — une entrée = `fichier :: MOTIF`, le motif étant la ligne de code
// du timer telle qu'écrite (trimée). L'ancre est INSENSIBLE au numéro de ligne : déplacer le site ne
// périme rien, mais RÉÉCRIRE la ligne (ou la retirer) fait échouer le CLIQUET ci-dessous — à réviser,
// jamais à re-décaler. Un motif qui deviendrait AMBIGU dans son fichier échoue aussi (2e cliquet).
const ALLOWED_SITES: Record<string, string> = {
  'src/state/projectLibrary.ts :: const timer = setTimeout(() => {':
    "timeout d'ouverture IndexedDB au BOOT (#776) — ne mute ni `battle` ni un flux de scène (rien " +
    "de tel n'existe encore à cet instant), n'est jamais nettoyé par `clearTrackedTimers` (afterEach " +
    "de test) : nature d'infrastructure, hors du périmètre COMBAT/FLUX de `combatTimers.ts`, pas un " +
    'contournement de son suivi.',
  'src/state/traceLayer.ts :: const timer = setTimeout(() => {':
    "timeout d'ouverture IndexedDB au BOOT du calque de référence (#830) — même nature d'infra que " +
    "l'ouverture de la bibliothèque de projets ci-dessus (aucun `battle`/flux de scène en jeu, jamais nettoyé par " +
    '`clearTrackedTimers`), magasin distinct.',
  'src/state/editorAutosave.ts :: const timer = setTimeout(() => {':
    "timeout d'ouverture IndexedDB au BOOT du filet de crash de l'éditeur — même nature d'infra que " +
    'les deux ouvertures IndexedDB ci-dessus (aucun `battle`/flux de scène en jeu, jamais ' +
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

function findingsAcrossFiles(): { site: string; rel: string; line: number; call: string }[] {
  const out: { site: string; rel: string; line: number; call: string }[] = [];
  for (const { abs, rel } of scanFiles()) {
    if (ALLOWED.includes(rel)) continue;
    const lignes = readFileSync(abs, 'utf8').split('\n');
    for (const f of scanNakedTimers(lignes.join('\n'))) out.push({ site: `${rel} :: ${lignes[f.line - 1].trim()}`, rel, line: f.line, call: f.call });
  }
  return out;
}

describe('garde structurelle — setTimeout/setInterval nu sous src/state (#415)', () => {
  it('aucun fichier hors whitelist/exemptions PAR SITE ne porte de timer nu', () => {
    const offenders = findingsAcrossFiles()
      .filter((f) => !(f.site in ALLOWED_SITES))
      .map((f) => `${f.rel}:${f.line} ${f.call}(...) nu`);
    expect(
      offenders,
      '`setTimeout`/`setInterval` nu — router par `scheduleCombatTimer`/`scheduleFlowTimer` (src/state/combatTimers.ts) ou, si vraiment légitime, ajouter une entrée JUSTIFIÉE à ALLOWED_SITES (revue).',
    ).toEqual([]);
  });

  it('CLIQUET : toute exemption dont le site a été réécrit/supprimé doit être RETIRÉE ou re-justifiée', () => {
    const present = new Set(findingsAcrossFiles().map((f) => f.site));
    const stale = Object.keys(ALLOWED_SITES).filter((k) => !present.has(k));
    expect(stale, 'Exemption(s) PÉRIMÉE(s) (site réécrit/assaini) — retirer/re-justifier ces entrées de ALLOWED_SITES :\n' + stale.join('\n')).toEqual([]);
  });

  it('CLIQUET : un motif d’exemption reste NON AMBIGU dans son fichier (une entrée = UN site)', () => {
    const sites = findingsAcrossFiles().map((f) => f.site);
    const doublons = sites.filter((s, i) => sites.indexOf(s) !== i);
    expect(doublons, 'Motif(s) présent(s) PLUSIEURS fois dans le même fichier — une exemption les amnistierait tous : distinguer les lignes :\n' + doublons.join('\n')).toEqual([]);
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
