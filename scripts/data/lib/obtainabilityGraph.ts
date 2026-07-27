/**
 * Mécanique de la lentille « obtenabilité réelle » (#321 lentille 1) : graphe DONNÉE→DONNÉE pour
 * chaque Talent (talents.json) et chaque Sort (spells.json) — chemins RÉELS de carrière/niveau,
 * espèce, créature-statblock, Table des Talents aléatoires (LDB), Table d'effets (`tables.json`),
 * GameOp `grantTalent` (mutations/étoiles/possessions/sorts/scènes), Effet de scène `learnSpell`, ou
 * achat PX légal (Talent de lanceur + Domaine/Culte atteignable, cf. `engine/grimoire.ts`). Réutilise `specIdsOf`
 * (src/data/index.ts, SOURCE UNIQUE de résolution de spéc) plutôt que ré-implémenter la mécanique
 * des Talents de lanceur. Module PUR — consommé par le CLI (`obtainability-graph.mts`) ET par la
 * garde (`src/data/obtainability-guard.test.ts`).
 *
 * #326 (triage RAW) : un Talent `TalentData.codexOnly` (contenu de référence PNJ/campagne scriptée,
 * jamais un chemin de progression PJ standard) est EXEMPTÉ de `talentNever` ; les Sorts de la famille
 * `chaos`, exclusivement dépendants du Talent `magie-du-chaos` (lui-même `codexOnly`), sont exemptés
 * de `spellNever` pour la même raison — verdicts RAW cités sur les entrées, pas un silence.
 */
import { readFileSync, globSync } from 'node:fs';
import { join } from 'node:path';
import {
  talents, spells, careerLevels, species, creatures, mutations, stars, trappings, gods, effectTables,
  findTalentById, specIdsOf,
  type AdvancementRef, type TalentData,
} from '../../../src/data/index';
import { META_CATALOG_ENTRIES } from '../../guards/lib/entityConsumers.mjs';

export interface CasterInfo { obtainable: boolean; specs: Set<string>; anyUnspecialized: boolean }
export interface SpellVerdict { id: string; label: string; reachable: boolean; via: string[] }
export interface ObtainabilityResult {
  talentSources: Map<string, Set<string>>;
  talentNever: TalentData[];
  casterInfo: Map<string, CasterInfo>;
  spellVerdicts: SpellVerdict[];
  spellNever: SpellVerdict[];
}

function walkNode(node: unknown, onNode: (n: Record<string, unknown>) => void) {
  if (Array.isArray(node)) { for (const x of node) walkNode(x, onNode); return; }
  if (node && typeof node === 'object') {
    const n = node as Record<string, unknown>;
    onNode(n);
    for (const v of Object.values(n)) walkNode(v, onNode);
  }
}

export function computeObtainability(root: string): ObtainabilityResult {
  const talentSources = new Map<string, Set<string>>();
  const addTalentSource = (id: string, src: string) => {
    if (!talentSources.has(id)) talentSources.set(id, new Set());
    talentSources.get(id)!.add(src);
  };

  let sawRandomEntry = false;
  const walkAdvancement = (entries: AdvancementRef[], srcTag: string) => {
    for (const e of entries) {
      if ('choice' in e) walkAdvancement(e.choice, srcTag);
      else if ('random' in e) sawRandomEntry = true;
      else if ('ref' in e) addTalentSource(e.ref.id, srcTag);
      else if ('wildcard' in e) addTalentSource(e.wildcard.id, srcTag);
    }
  };
  for (const sp of species) walkAdvancement(sp.talents, `espece:${sp.id}`);
  for (const cl of careerLevels) walkAdvancement(cl.talents, `carriere:${cl.career}#${cl.level}`);
  for (const cr of creatures) for (const t of cr.talents ?? []) addTalentSource(t.id, `creature:${cr.id}`);

  for (const m of mutations) walkNode(m, (n) => { if (n.op === 'grantTalent') addTalentSource(n.talentId as string, `mutation:${m.id}`); });
  for (const s of stars) walkNode(s, (n) => { if (n.op === 'grantTalent') addTalentSource(n.talentId as string, `etoile:${s.id}`); });
  for (const tr of trappings) walkNode(tr, (n) => { if (n.op === 'grantTalent') addTalentSource(n.talentId as string, `possession:${tr.id}`); });
  for (const sp of spells) walkNode(sp, (n) => { if (n.op === 'grantTalent') addTalentSource(n.talentId as string, `sort:${sp.id}`); });
  for (const t of effectTables) walkNode(t, (n) => { if (n.op === 'grantTalent') addTalentSource(n.talentId as string, `table:${t.id}`); });

  if (sawRandomEntry) for (const t of talents) if (t.rand != null) addTalentSource(t.id, 'table-talents-aleatoires');

  const learnSpellIds = new Set<string>();
  for (const f of globSync('src/scenes/**/*.json', { cwd: root })) {
    const text = readFileSync(join(root, f), 'utf8');
    if (!text.includes('"grantTalent"') && !text.includes('"learnSpell"')) continue;
    let json: unknown;
    try { json = JSON.parse(text); } catch { continue; }
    walkNode(json, (n) => {
      if (n.op === 'grantTalent') addTalentSource(n.talentId as string, `scene:${f}`);
      if (n.type === 'learnSpell' && typeof n.spell === 'string') learnSpellIds.add(n.spell);
    });
  }

  // #326 : un Talent `codexOnly` (contenu de référence PNJ/campagne, cf. `TalentData.codexOnly`) est
  // EXPLIQUÉ par sa donnée — jamais compté comme une dette d'obtenabilité oubliée. Un Talent listé dans
  // `META_CATALOG_ENTRIES` (`scripts/guards/lib/entityConsumers.mjs`, SOURCE UNIQUE partagée avec
  // `src/data/entity-orphans.test.ts`) est une entrée MÉTA (ligne de table RAW, jamais un Talent
  // possédable) — même exemption, jamais re-déclarée ici.
  const talentNever = talents.filter((t) => !talentSources.has(t.id) && !t.codexOnly && !META_CATALOG_ENTRIES.has(`talents:${t.id}`));

  const CASTER_TALENT_IDS = ['magie-mineure', 'magie-des-arcanes', 'invocation', 'beni', 'magie-du-chaos'] as const;

  function reachableSpecs(talentId: string): CasterInfo {
    const specs = new Set<string>();
    let anyUnspecialized = false;
    const scanAdvancement = (entries: AdvancementRef[]) => {
      for (const e of entries) {
        if ('choice' in e) scanAdvancement(e.choice);
        else if ('ref' in e && e.ref.id === talentId) { if (e.ref.spec) specs.add(e.ref.spec); else anyUnspecialized = true; }
        else if ('wildcard' in e && e.wildcard.id === talentId) {
          if (e.specOptions?.length) for (const s of e.specOptions) specs.add(s);
          else anyUnspecialized = true;
        }
      }
    };
    for (const sp of species) scanAdvancement(sp.talents);
    for (const cl of careerLevels) scanAdvancement(cl.talents);
    for (const cr of creatures) for (const t of cr.talents ?? []) {
      if (t.id === talentId) { if (t.spec) specs.add(t.spec); else anyUnspecialized = true; }
    }
    if (anyUnspecialized) {
      const def = findTalentById(talentId);
      if (def) for (const s of specIdsOf(def)) specs.add(s);
    }
    return { specs, anyUnspecialized, obtainable: true };
  }

  const casterInfo = new Map<string, CasterInfo>();
  for (const id of CASTER_TALENT_IDS) {
    const obtainable = talentSources.has(id);
    casterInfo.set(id, obtainable ? reachableSpecs(id) : { obtainable: false, specs: new Set(), anyUnspecialized: false });
  }

  const godById = new Map(gods.map((g) => [g.id, g]));

  const spellVerdicts: SpellVerdict[] = [];
  for (const sp of spells) {
    const via: string[] = [];
    if (learnSpellIds.has(sp.id)) via.push('scene:learnSpell');
    const fam = sp.family;
    if (fam === 'mineure' && casterInfo.get('magie-mineure')!.obtainable) via.push('talent:magie-mineure');
    if (fam === 'arcane') {
      const c = casterInfo.get('magie-des-arcanes')!;
      if (c.obtainable) {
        if (sp.domainId == null) via.push('talent:magie-des-arcanes(commun)');
        else if (c.anyUnspecialized) via.push('talent:magie-des-arcanes(non-spécialisé, matche tout Domaine)');
        else if (c.specs.has(sp.domainId)) via.push(`talent:magie-des-arcanes(${sp.domainId})`);
      }
    }
    const godPools: Array<['invocation' | 'beni' | 'magie-du-chaos', 'miracles' | 'blessings' | 'chaosSpells']> = [
      ['invocation', 'miracles'], ['beni', 'blessings'], ['magie-du-chaos', 'chaosSpells'],
    ];
    for (const [talentId, field] of godPools) {
      const famMatch = (talentId === 'invocation' && fam === 'invocation') || (talentId === 'beni' && fam === 'beni') || (talentId === 'magie-du-chaos' && fam === 'chaos');
      if (!famMatch) continue;
      const c = casterInfo.get(talentId)!;
      if (!c.obtainable) continue;
      if (c.anyUnspecialized) { via.push(`talent:${talentId}(non-spécialisé)`); continue; }
      for (const godId of c.specs) {
        const g = godById.get(godId);
        const list = (g?.[field] as { id: string }[] | undefined) ?? [];
        if (list.some((r) => r.id === sp.id)) via.push(`talent:${talentId}(${godId})`);
      }
    }
    spellVerdicts.push({ id: sp.id, label: sp.label, reachable: via.length > 0, via });
  }
  // #326 : les Sorts de la famille `chaos` ne dépendent que du Talent `magie-du-chaos` — s'il est
  // `codexOnly` (référence PNJ, cf. TalentData.codexOnly), leur inaccessibilité PJ est déjà EXPLIQUÉE
  // par cette donnée, pas une dette distincte à re-signaler par Sort.
  const chaosCasterCodexOnly = findTalentById('magie-du-chaos')?.codexOnly === true;
  const familyById = new Map(spells.map((sp) => [sp.id, sp.family]));
  const spellNever = spellVerdicts.filter((v) => {
    if (v.reachable) return false;
    if (chaosCasterCodexOnly && familyById.get(v.id) === 'chaos') return false;
    return true;
  });

  return { talentSources, talentNever, casterInfo, spellVerdicts, spellNever };
}
