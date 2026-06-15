/**
 * SEED (jetable, ré-exécutable) — migration des EFFETS des sorts depuis les specs engine-curées
 * (`src/data/spellspecs/`) vers la donnée app-owned `src/data/spells.json` + `frenchy-spells.json`,
 * sous forme d'un champ `effects: Flow` ÉDITABLE (CodexEdit → FlowEditor).
 *
 * Pour CHAQUE sort, `effects` = le Flow dérivé de sa spec curée :
 *   { kind:'seq', steps:[
 *       {kind:'do', effect:{type:'ops', on:'target', ops:<spec.ops>}},         // si ops non vides
 *       {kind:'do', effect:{type:'ops', on:'caster', ops:<spec.casterOps>}},   // si casterOps présents
 *   ] }
 * Sort sans spec curée OU `ops:[]` (et pas de casterOps) → `effects` = { kind:'seq', steps:[] }.
 *
 * Rejoue le format de `serializeDataset` (JSON.stringify indent 2, pas de newline final). `effects`
 * est inséré JUSTE APRÈS `desc` (ordre de l'interface SpellData) pour un diff stable.
 *
 * Lancer :  npx tsx scripts/migrate-spell-effects.mts
 *
 * ⚠️ ONE-SHOT HISTORIQUE : après la migration, les specs `data/spellspecs/` NE portent PLUS `ops`
 * (retirées par `strip-spec-ops.mts`). Re-lancer ce script viderait alors tous les `effects` — il
 * REFUSE donc de tourner s'il détecte que les specs n'ont plus d'ops (garde-fou ci-dessous).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { ALL_SPELL_SPECS } from '../src/data/spellspecs/index.ts';
import type { SpellSpec } from '../src/engine/spellspec.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = resolve(HERE, '../src/data');

type Flow = { kind: 'seq'; steps: { kind: 'do'; effect: { type: 'ops'; on: 'target' | 'caster'; ops: unknown[] } }[] };
type Spell = { label: string; type?: string; desc?: string; effects?: Flow; [k: string]: unknown };

/** Flow dérivé d'une spec : ops sur la cible + casterOps sur le lanceur (feuilles `do` EffectOp). */
function flowOf(spec: SpellSpec | undefined): Flow {
  const steps: Flow['steps'] = [];
  if (spec?.ops?.length) steps.push({ kind: 'do', effect: { type: 'ops', on: 'target', ops: spec.ops } });
  if (spec?.casterOps?.length) steps.push({ kind: 'do', effect: { type: 'ops', on: 'caster', ops: spec.casterOps } });
  return { kind: 'seq', steps };
}

/** Spec curée pour un sort (désambiguïsation par type comme `curatedSpec`). */
function specFor(label: string, type?: string): SpellSpec | undefined {
  const cands = ALL_SPELL_SPECS.filter((s) => s.label === label);
  return cands.find((s) => s.type != null && s.type === type) ?? cands.find((s) => s.type == null) ?? cands[0];
}

/** Réinsère `effects` JUSTE APRÈS `desc`, en préservant l'ordre des autres clés. */
function withEffects(spell: Spell, effects: Flow): Spell {
  const out: Spell = {};
  for (const [k, v] of Object.entries(spell)) {
    if (k === 'effects') continue; // on repositionne / réécrit
    out[k] = v as never;
    if (k === 'desc') out.effects = effects;
  }
  if (!('effects' in out)) out.effects = effects; // pas de desc (rare) → en fin
  return out;
}

function migrate(file: string): { total: number; mech: number } {
  const path = resolve(DATA, file);
  const arr = JSON.parse(readFileSync(path, 'utf8')) as Spell[];
  let mech = 0;
  const next = arr.map((sp) => {
    const eff = flowOf(specFor(sp.label, sp.type));
    if (eff.steps.length) mech++;
    return withEffects(sp, eff);
  });
  writeFileSync(path, JSON.stringify(next, null, 2), 'utf8');
  return { total: next.length, mech };
}

// Garde-fou : si AUCUNE spec ne porte plus d'ops, la migration a déjà eu lieu (strip effectué) →
// re-jouer viderait les `effects`. On REFUSE (re-générer le seed nécessite de restaurer les specs).
const stillHasOps = ALL_SPELL_SPECS.some((s) => (s as { ops?: unknown[] }).ops?.length || (s as { casterOps?: unknown[] }).casterOps?.length);
if (!stillHasOps) {
  console.error('ABORT : les specs ne portent plus d\'ops (migration déjà appliquée). Restaurer data/spellspecs/ avant de re-seed.');
  process.exit(1);
}

for (const file of ['spells.json', 'frenchy-spells.json']) {
  const { total, mech } = migrate(file);
  console.log(`${file}: ${total} sorts, ${mech} avec effets mécaniques (steps non vides).`);
}
console.log('Seed terminé.');
