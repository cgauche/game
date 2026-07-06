import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Garde-fou anti-emoji (LOT 4) : les AFFORDANCES de l'UI passent par le registre d'icônes
 * (`src/ui/icons/` + `<Icon id>` / `<IconG id>`), plus jamais par un emoji dans le code ou la
 * donnée. Ce test de BUILD scanne les sources (fs) : tout emoji hors de la liste d'exceptions
 * ci-dessous fait échouer la suite. MIGRER un fichier = le retirer des exceptions (une exception
 * devenue propre est inoffensive — elle ne force rien).
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url)); // racine du projet (src/ui/ → ../../)
const SCAN_DIRS = ['src/ui', 'src/state', 'src/gameIso', 'src/scenes'];

/** Plages Unicode d'emoji (présentation emoji) — volontairement SANS les blocs typographiques
 *  (flèches 2190-21FF, formes géométriques 25xx, ⌊⌋⌈⌉ math du bloc technique). */
const EMOJI_RANGES: [number, number][] = [
  [0x1f000, 0x1faff], // Mahjong → Symbols & Pictographs Extended (émoticônes, transport, suppléments…)
  [0x2600, 0x27bf], // Miscellaneous Symbols + Dingbats
  [0x2b00, 0x2bff], // Misc Symbols and Arrows (⬆ ⭐ …)
  [0x231a, 0x231b], // ⌚ ⌛
  [0x23e9, 0x23f3], // ⏩ … ⏳ (timers/lecteur)
  [0x23f8, 0x23fa], // ⏸ ⏹ ⏺
  [0x2139, 0x2139], // ℹ
  [0xfe0f, 0xfe0f], // sélecteur de variation emoji
];

/** Glyphes TEXTE tolérés partout (typographie monochrome, pas des affordances emoji) :
 *  coches/croix de résultat (✓ ✗ ✔ ✘), fermeture ✕, marqueur essentiel ★ (ShipSheet/équipages),
 *  ornement ⚜ (Ornaments), burger ☰ (GameMenu), sexes ♂ ♀ (compendium), étoiles FX ✦ ✸
 *  (particules dessinées en <text> SVG). */
const ALLOWED_CHARS = new Set(['✓', '✗', '✔', '✘', '✕', '★', '⚜', '☰', '♂', '♀', '✦', '✸']);

/** Fichiers exclus par NATURE (pas par état de migration) :
 *  - `*.test.*` : les tests portent les emojis de leurs composants non migrés et sont réécrits
 *    AVEC leur composant (ils ne rendent rien à l'utilisateur) ;
 *  - `_registry.generated.ts` : en-tête « ⚠ généré » émis par scripts/gen-registry.mjs. */
const EXCLUDED = (rel: string) => /\.test\.[tj]sx?$/.test(rel) || rel.endsWith('_registry.generated.ts');

/** EXCEPTIONS — fichiers hors périmètre du garde d'AFFORDANCE (état #139, passe 2026-07-06 : la
 *  famille A — 47 fichiers UI/éditeur, ~90 emoji, ~17 familles d'icônes créées — est ENTIÈREMENT
 *  migrée). Ce qui reste ici est la famille (B) : emoji hors affordance — préfixes de LOG/journal
 *  côté `src/state`, `desc`/prose de donnée `src/data/*.json`, descriptions narratives de scénarios
 *  de test — jamais rendus comme icône UI, donc jamais migrés vers `<Icon>`. Un emoji de LOG n'est
 *  PAS une affordance (bouton/badge/pastille) : c'est du texte de journal, au même titre qu'une
 *  description JSON. Chaque entrée reste justifiée ; retirer si un fichier devient propre. */
const EXCEPTIONS = new Set<string>([
  // Donnée JSON — emoji dans des `desc`/prose (famille B), pas des affordances.
  'src/data/etats.json',
  'src/data/psychology.json',
  'src/data/qualities.json',
  'src/data/talents.json',
  // Outillage console DEV (sortie texte de recette Playwright, jamais rendue dans l'UI).
  'src/state/devtools.ts',
  // Journaux/narration côté state : préfixes d'événements de log (famille B, autre chantier).
  'src/state/combat/roundHooks.ts',
  'src/state/combat/triggeredTest.ts',
  'src/state/combat/turnHooks.ts',
  'src/state/combatEffects.ts',
  'src/state/combatFlow.ts',
  'src/state/combatSlice.ts',
  'src/state/encounterPsychFlow.ts',
  'src/state/interludeFlow.ts',
  'src/state/netOwnership.ts',
  'src/state/pendings.ts',
  'src/state/portFlow.ts',
  'src/state/restFlow.ts',
  'src/state/riverVoyageFlow.ts',
  'src/state/rollFlowSpecs.ts',
  'src/state/scene.ts',
  'src/state/sceneEdit.ts',
  'src/state/seaActivities.ts',
  'src/state/seaVoyageFlow.ts',
  'src/state/shipCrew.ts',
  'src/state/shipPostes.ts',
  'src/state/store.ts',
  'src/state/targeting.ts',
  'src/state/targetingModes.ts',
  'src/state/travelFlow.ts',
  'src/state/travelPostes.ts',
  'src/state/upkeep.ts',
  // Scénarios de test : descriptions narratives (famille B).
  'src/scenes/test-scenarios/bestiaire.ts',
  'src/scenes/test-scenarios/magie.ts',
  'src/scenes/test-scenarios/voyage.ts',
]);

const isEmoji = (cp: number) => EMOJI_RANGES.some(([a, b]) => cp >= a && cp <= b);

function emojisIn(text: string): string[] {
  const found = new Set<string>();
  let prev = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    // FE0F collé à un glyphe toléré (✔️ …) : fait partie de la séquence tolérée.
    if (cp === 0xfe0f && ALLOWED_CHARS.has(prev)) { prev = ch; continue; }
    if (isEmoji(cp) && !ALLOWED_CHARS.has(ch)) found.add(ch);
    prev = ch;
  }
  return [...found];
}

function scanFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(e)) files.push(p);
    }
  };
  for (const d of SCAN_DIRS) walk(join(ROOT, d));
  for (const e of readdirSync(join(ROOT, 'src/data'))) if (e.endsWith('.json')) files.push(join(ROOT, 'src/data', e));
  return files;
}

describe('garde-fou anti-emoji (affordances → registre d’icônes)', () => {
  it('aucun emoji hors exceptions dans src/ui, src/state, src/gameIso, src/scenes et src/data/*.json', () => {
    const offenders: string[] = [];
    for (const f of scanFiles()) {
      const rel = relative(ROOT, f).split('\\').join('/');
      if (EXCLUDED(rel) || EXCEPTIONS.has(rel)) continue;
      const hits = emojisIn(readFileSync(f, 'utf8'));
      if (hits.length) offenders.push(`${rel} → ${hits.join(' ')}`);
    }
    expect(offenders, 'Emoji d’affordance détecté — utiliser <Icon id> (src/ui/icons/) ou ajouter une exception JUSTIFIÉE').toEqual([]);
  });

  it('CLIQUET : toute exception dont le fichier est devenu propre (ou a disparu) doit être RETIRÉE', () => {
    // Sans ce resserrage, la liste ne fond jamais : une exception nettoyée par un lot suivant resterait
    // inerte. Ici elle devient rouge → la dette se rembourse mécaniquement au fil des migrations.
    const stale: string[] = [];
    for (const rel of EXCEPTIONS) {
      let text: string;
      try { text = readFileSync(join(ROOT, rel), 'utf8'); }
      catch { stale.push(`${rel} → fichier disparu`); continue; }
      if (emojisIn(text).length === 0) stale.push(`${rel} → plus aucun emoji`);
    }
    expect(stale, 'Exception(s) PÉRIMÉE(s) — retirer ces entrées de EXCEPTIONS').toEqual([]);
  });
});
