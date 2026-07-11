import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRIGGER_LABEL } from '../ui/compendium/triggerLabels';
import type { EffectTrigger } from './flow';

/**
 * GARDE DE COMPLÉTUDE (nouvelle classe, #316) : « zéro trigger d'authoring sans point d'émission ».
 * Chaque valeur d'`EffectTrigger` OFFERTE au schéma d'authoring (donc éditable au Compendium) doit
 * avoir ≥1 SITE D'ÉMISSION en production — sinon un effet authoré dessus est une AFFORDANCE MORTE
 * (se pose dans l'éditeur, ne se déclenche JAMAIS). La taxonomie est DÉRIVÉE de `TRIGGER_LABEL`
 * (`Record<EffectTrigger,…>`, exhaustif AU COMPILATEUR) — pas une liste maintenue à la main.
 *
 * Un site d'émission = `emitCombatEvent('<trigger>'` (l'unique porte) OU, pour les événements de
 * CYCLE, la boucle `fireTriggers`/`fireTurnEdgeTriggers` interne aux modules BUS-OWNED
 * (roundHooks/turnHooks) — la machinerie du bus, whitelistée par la quarantaine d'import.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const BUS_OWNED = ['src/state/combat/roundHooks.ts', 'src/state/combat/turnHooks.ts'];

const isTest = (rel: string) => /\.test\.[tj]sx?$/.test(rel);

function tsFiles(): { rel: string; src: string }[] {
  const out: { rel: string; src: string }[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e)) {
        const rel = relative(ROOT, p).split('\\').join('/');
        if (!isTest(rel)) out.push({ rel, src: readFileSync(p, 'utf8') });
      }
    }
  };
  walk(join(ROOT, 'src'));
  return out;
}

/** Ensemble des triggers ayant ≥1 émission de production. */
function emittedTriggers(): Set<string> {
  const emitted = new Set<string>();
  const files = tsFiles();
  // (a) `emitCombatEvent('<trigger>'` — n'importe où (l'unique porte).
  for (const { src } of files) {
    for (const m of src.matchAll(/emitCombatEvent\(\s*'(\w+)'/g)) emitted.add(m[1]);
  }
  // (b) boucles de cycle bus-owned : `fireTriggers(…, '<trigger>'` / `fireTurnEdgeTriggers(…, '<trigger>'`.
  for (const { rel, src } of files) {
    if (!BUS_OWNED.includes(rel)) continue;
    for (const m of src.matchAll(/(?:fireTriggers|fireTurnEdgeTriggers)\([^;)]*?'(\w+)'/g)) emitted.add(m[1]);
  }
  return emitted;
}

describe('couverture d’émission du bus — chaque trigger d’authoring a un point d’émission (#316)', () => {
  it('aucun trigger de la taxonomie n’est une affordance morte (émission manquante)', () => {
    const taxonomy = Object.keys(TRIGGER_LABEL) as EffectTrigger[];
    const emitted = emittedTriggers();
    const orphans = taxonomy.filter((t) => !emitted.has(t));
    expect(
      orphans,
      'Trigger(s) d’authoring SANS point d’émission (affordance morte) — câbler un ' +
        `emitCombatEvent('<trigger>') à leur site naturel, ou retirer le trigger de la taxonomie :\n${orphans.join('\n')}`,
    ).toEqual([]);
  });
});
