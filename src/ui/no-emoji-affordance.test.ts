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

/** EXCEPTIONS — fichiers PAS ENCORE migrés (état réel au 2026-07-02, LOT 4 en cours).
 *  Chaque groupe est justifié ; retirer les entrées au fil des migrations (LOT 5+). */
const EXCEPTIONS = new Set<string>([
  // Donnée JSON en cours de migration par la session parallèle (moitié engine du LOT 4).
  'src/data/etats.json',
  'src/data/psychology.json',
  'src/data/qualities.json',
  'src/data/talents.json',
  // Outillage console DEV (sortie texte de recette Playwright, jamais rendue dans l'UI).
  'src/state/devtools.ts',
  // Journaux/narration côté state : préfixes d'événements de log non migrés (LOT suivant).
  'src/state/combat/roundHooks.ts',
  'src/state/combat/triggeredTest.ts',
  'src/state/combat/turnHooks.ts',
  'src/state/combatEffects.ts',
  'src/state/combatFlow.ts', // session parallèle (ne pas toucher)
  'src/state/combatSlice.ts',
  'src/state/encounterPsychFlow.ts',
  'src/state/interludeFlow.ts',
  'src/state/netOwnership.ts',
  'src/state/pendings.ts',
  'src/state/portFlow.ts',
  'src/state/restFlow.ts', // session parallèle (ne pas toucher)
  'src/state/riverVoyageFlow.ts', // journaux de navigation fluviale (même LOT que seaVoyageFlow)
  'src/state/rollFlows.ts',
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
  'src/state/upkeep.ts', // session parallèle (ne pas toucher)
  // Rendu iso : commentaires ⚠ + libellés d'overlays non migrés.
  'src/gameIso/rig/anim/creatureAttackPoses.ts',
  'src/gameIso/rig/anim/handling.ts',
  'src/gameIso/rig/anim/weaponClips.ts',
  'src/gameIso/rig/parts/tenues/defs/Guerrier-du-chaos.ts',
  'src/gameIso/stage/AimOverlay.tsx',
  'src/gameIso/stage/CrewTooltip.tsx',
  'src/gameIso/stage/DebugOverlay.tsx',
  'src/gameIso/stage/useHoverTargeting.ts',
  'src/gameIso/usePlanAnim.ts',
  // Scénarios de test : descriptions narratives (agent parallèle test-scenarios).
  'src/scenes/test-scenarios/bestiaire.ts',
  'src/scenes/test-scenarios/magie.ts',
  'src/scenes/test-scenarios/voyage.ts',
  // Modales de jet & écrans de campagne non migrés (LOT 5 — un fichier = une passe).
  'src/ui/ActiveModal.tsx',
  'src/ui/AppearancePanel.tsx',
  'src/ui/ApproachModal.tsx',
  'src/ui/AuContactModal.tsx',
  'src/ui/AudioControls.tsx',
  'src/ui/BackgroundPanel.tsx',
  'src/ui/CampaignView.tsx',
  'src/ui/CascadeModal.tsx',
  'src/ui/CastModal.tsx',
  'src/ui/ChanceButtons.tsx',
  'src/ui/CharacterSheet.tsx',
  'src/ui/CoopPanels.tsx',
  'src/ui/CorruptionModal.tsx',
  'src/ui/CrewTestModal.tsx',
  'src/ui/DeterminationButton.tsx',
  'src/ui/DisengageModal.tsx',
  'src/ui/DispelModal.tsx',
  'src/ui/EquipmentPanel.tsx',
  'src/ui/FateSaveModal.tsx',
  'src/ui/FocusModal.tsx',
  'src/ui/ForceDoorModal.tsx',
  'src/ui/ForcedRollPicker.tsx',
  'src/ui/FrenzyModal.tsx',
  'src/ui/GameMenu.tsx',
  'src/ui/GearAssignList.tsx',
  'src/ui/GrappleModal.tsx',
  'src/ui/HealModal.tsx',
  'src/ui/HouseRulesModal.tsx',
  'src/ui/LootModal.tsx',
  'src/ui/MediaSelect.tsx',
  'src/ui/MedicModal.tsx',
  'src/ui/MerchantPanel.tsx',
  'src/ui/MountTargetModal.tsx',
  'src/ui/PortView.tsx',
  'src/ui/PortraitPicker.tsx',
  'src/ui/PortraitTile.tsx',
  'src/ui/RenounceModal.tsx',
  'src/ui/ResilienceButton.tsx',
  'src/ui/ResistButton.tsx',
  'src/ui/RestModal.tsx',
  'src/ui/RollLine.tsx',
  'src/ui/RollPanel.tsx',
  'src/ui/RollRow.tsx',
  'src/ui/RunModal.tsx',
  'src/ui/SeaActivitiesModal.tsx',
  'src/ui/ShantyModal.tsx',
  'src/ui/ShipBatteryModal.tsx',
  'src/ui/ShipManeuverModal.tsx',
  'src/ui/ShipSheet.tsx',
  'src/ui/TrampleModal.tsx',
  'src/ui/TravelRecapModal.tsx',
  'src/ui/VictoryScreen.tsx',
  'src/ui/ViewControls.tsx',
  'src/ui/WardModal.tsx',
  'src/ui/WorldMapView.tsx',
  'src/ui/compendium/CodexEdit.tsx',
  'src/ui/compendium/CodexRef.tsx',
  'src/ui/compendium/CompendiumScreen.tsx',
  'src/ui/jetProps/useAttackJetProps.tsx',
  'src/ui/jetProps/useExtendedTestJetProps.tsx',
  'src/ui/jetProps/useFumbleJetProps.tsx',
  // Éditeur : outillage sans icône sémantique au registre (hors ⚑, migré) — dessiner les
  // icônes manquantes avant de migrer ces rails/labels.
  'src/ui/editor/DialogueDetail.tsx',
  'src/ui/editor/Editor.tsx',
  'src/ui/editor/EditorCanvas.tsx',
  'src/ui/editor/EditorToolbar.tsx',
  'src/ui/editor/EffectList.tsx',
  'src/ui/editor/FlowEditor.tsx',
  'src/ui/editor/GameOpEditor.tsx', // session parallèle (ne pas toucher)
  'src/ui/editor/Inspector.tsx',
  'src/ui/editor/LogicDock.tsx',
  'src/ui/editor/Palette.tsx',
  'src/ui/editor/StatblockEditor.tsx',
  'src/ui/editor/StatusBar.tsx',
  'src/ui/editor/ValidationPanel.tsx',
  'src/ui/editor/WorldMapEditor.tsx',
  // Registre d'icônes : commentaires « remplace ❤️/🍀/… » documentant la correspondance.
  'src/ui/icons/defs/resource.ts',
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
