import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

/**
 * ANTI-DÉRIVE DU SYSTÈME DE JET — « tout passe par notre système » (fabrique + atomes PARTAGÉS).
 *
 * Les verbes d'influence sont des règles GLOBALES (LDB 17 l.68/83-84), applicables à N'IMPORTE quel
 * Test, donc implémentées UNE SEULE FOIS et réutilisées par TOUS les flux :
 *   • Chance « +1 DR » (LDB 17 l.26/84) → `bumpSL(tr)` (ajoute un Degré, `success` INTACT) ;
 *   • Résilience « Je ne faillirai pas ! » (l.68/73) → `bestForcedRoll(cible)` (dé forcé DR-MAX
 *     SELON la policy : standard → 01, mais Fast DR (LDB 12 l.128) → dé le plus HAUT valide) + `forcedTR` ;
 *   • dé CHOISI (picker) → `evaluateTest(forced.roll, cible)` ; Résistance → `resist`.
 * La fabrique `makeRollFlow` compose ces verbes ; un flux ne fournit que sa FORME (`resolve`/`lens`/
 * `bonus`/`caps`) — il ne doit JAMAIS RE-CODER la mécanique dans son closure.
 *
 * Ce garde SCANNE TOUT le code de résolution (src/state + src/engine, hors tests) et CASSE si une
 * signature de RE-CODAGE réapparaît. Il est né de dérives RÉELLES : une session parallèle a dé-lentillé
 * `activity` en recodant le dé forcé à `01` en dur (`evaluateTest(1, cible)` → DR MINIMAL en Fast DR)
 * et un `+1 DR` forçant `success:true` (transforme un échec en réussite, interdit LDB 17 l.84) ; le même
 * `evaluateTest(1, …)` dormait aussi dans `shipManeuver.forceCrewRole` ET `combatSlice.cascadeDetermine`
 * — d'où le scan LARGE (le recodage ne vit pas que dans rollFlowSpecs.ts).
 *
 * Portée assumée (comme `roll-modal-invariant.test.ts`) : scan statique — n'attrape pas une obfuscation
 * par variable. Le filet BEHAVIORAL exhaustif (piloter chaque `*ForceSuccess` sous Fast DR et exiger le
 * DR MAX) reste le complément à ajouter.
 */
const STATE_DIR = fileURLToPath(new URL('.', import.meta.url)); // src/state
const ENGINE_DIR = fileURLToPath(new URL('../engine', import.meta.url)); // src/engine

function tsFiles(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) tsFiles(full, acc);
    else if (e.name.endsWith('.ts') && !e.name.includes('.test.')) acc.push(full);
  }
  return acc;
}
const FILES = [...tsFiles(STATE_DIR), ...tsFiles(ENGINE_DIR)];
const rel = (f: string) => f.slice(Math.max(0, f.indexOf('src'))).replace(/\\/g, '/');

/** Toutes les occurrences `chemin:ligne` d'un motif dans le code de résolution (hors tests). */
function scan(re: RegExp): string[] {
  const out: string[] = [];
  for (const f of FILES) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(re)) out.push(`${rel(f)}:${src.slice(0, m.index!).split('\n').length}`);
  }
  return out;
}

describe('Anti-dérive du système de jet — tout passe par la fabrique + les atomes partagés', () => {
  it('Résilience : le dé forcé PAR DÉFAUT passe par bestForcedRoll (jamais evaluateTest(1, …) en dur)', () => {
    // Le dé qui MAXIMISE le DR d'une réussite forcée DÉPEND de la policy (Fast DR → 01 = DR MINIMAL).
    // `bestForcedRoll(cible)` porte ce choix ; un `evaluateTest(1, …)` dans un résolveur forcé le recode
    // en dur = bug Fast DR. Le dé CHOISI par le joueur reste `evaluateTest(forced.roll, …)` (autorisé).
    const hits = scan(/evaluateTest\(\s*0?1\s*,/g);
    expect(
      hits,
      `Dé forcé « 01 » codé en dur (${hits.join(', ')}) — route par bestForcedRoll(cible) (policy-aware, LDB 17 l.68 + Fast DR LDB 12 l.128).`,
    ).toEqual([]);
  });

  it('Chance « +1 DR » ne force JAMAIS success (LDB 17 l.84) — bumpSL ou success recalculé', () => {
    // +1 Degré ne transforme PAS un `roll > cible` en réussite. `bumpSL(tr)` garde `success` ; un
    // `bonus.derive` qui écrit `sl: …+1, success: true` travestit la règle (bug maneuver/battement).
    const hits = scan(/\.sl\s*\+\s*1\s*,\s*success:\s*true/g);
    expect(
      hits,
      `« +1 DR » forçant success:true (${hits.join(', ')}) — utilise bumpSL(tr) ou recalcule success (roll ≤ cible).`,
    ).toEqual([]);
  });

  it('les atomes partagés du système sont bien la source (bumpSL / bestForcedRoll présents dans rollFlowSpecs)', () => {
    // Preuve POSITIVE minimale : les atomes du système sont présents dans le registre des flux. Si un
    // refactor les retire au profit d'un recodage local, ce test tombe (avec les 2 gardes ci-dessus).
    // `forcedTR` REJOINDRA cette liste quand le balayage « zéro copie » aura remplacé les littéraux
    // TestResult inline des flux opposés (attack/defense/cast/trample) par l'atome partagé.
    const specs = readFileSync(join(STATE_DIR, 'rollFlowSpecs.ts'), 'utf8');
    for (const atom of ['bumpSL', 'bestForcedRoll']) {
      expect(specs.includes(atom), `atome partagé « ${atom} » absent de rollFlowSpecs.ts — le système de jet a-t-il été contourné ?`).toBe(true);
    }
  });
});
