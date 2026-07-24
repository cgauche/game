import type { Scene, Effect } from './scene';
import { CHAR_KEYS } from '../engine/types';
import { type Flow, type Condition, walkFlow, walkConditionTimes, flowHasTest, EMPTY_FLOW } from './flow';
// Registre des effets (réfs de validation `handler.refs`) — importé via le BARIL `combatFlow` (qui
// ré-exporte combatEffects), comme le store : entrer le cycle d'effets/combat par le MÊME nœud
// canonique préserve l'ordre d'évaluation (un import direct de `combatEffects` ici casse la
// liaison vive `fireScheduledEffects` que le store lit du baril sous le bundler).
import { EFFECT_HANDLERS, type EffectHandler, type EffectRefCtx } from './combatFlow';
import { placeServices, type WorldMap } from './worldMap';
import { allMusicDefs } from '../audio/music';

/** Clés valides de `CustomStatblock.char` : les 10 `CharKey` (slugs pleins, #311) ∪ `M`/`B`
 *  (Mouvement/Blessures, hors `CharKey` — cf. `CustomStatblock` dans `./scene`). */
const VALID_STATBLOCK_CHAR_KEYS = new Set<string>([...CHAR_KEYS, 'M', 'B']);

export interface Warning {
  level: 'error' | 'warn';
  sceneId: string;
  scope: 'architecture' | 'entity' | 'roof' | 'trigger' | 'dialogue' | 'encounter' | 'scene' | 'worldMap';
  /** Id du fautif (pour clic → sélection dans l'éditeur). */
  refId?: string;
  message: string;
}

/**
 * Vérifie un PROJET (liste de scènes + carte du monde optionnelle) avant le runtime : réfs cassées
 * (dialogue / rencontre / scène / scène intérieure / nœud de dialogue / lieu et route de la carte),
 * zones hors-carte, ids dupliqués. PUR.
 */
export function validateScene(project: Scene[], worldMap?: WorldMap | null): Warning[] {
  const out: Warning[] = [];
  const sceneIds = new Set(project.map((s) => s.id));
  if (worldMap) {
    const addWm = (refId: string, message: string) =>
      out.push({ level: 'error', sceneId: worldMap.id, scope: 'worldMap', refId, message });
    const placeIds = new Set(worldMap.places.map((p) => p.id));
    const poiIds = new Set<string>();
    for (const p of worldMap.places) {
      if (!sceneIds.has(p.scene)) addWm(p.id, `Lieu « ${p.label} » → scène inexistante « ${p.scene} »`);
      // Cible RÉSOLUE via `placeServices` (source unique, `state/worldMap.ts`) — pas le seul catalogue
      // `lieux-services.json` : un POI peut aussi cibler le port/marché AUTOMATIQUES du lieu (`id`
      // `'port'`/`'marche'`), exactement ce que `CityHubScreen` résout à l'affichage (#360).
      const resolvedServiceIds = new Set(placeServices(p).map((s) => s.id));
      for (const poi of p.poi ?? []) {
        if (poiIds.has(poi.id)) addWm(poi.id, `POI « ${poi.id} » du lieu « ${p.label} » : id dupliqué`);
        poiIds.add(poi.id);
        const hasScene = poi.sceneId != null, hasService = poi.serviceKind != null;
        if (hasScene === hasService) addWm(poi.id, `POI « ${poi.label} » (lieu « ${p.label} ») : cible EXCLUSIVE scène XOR service requise`);
        if (hasScene && !sceneIds.has(poi.sceneId!)) addWm(poi.id, `POI « ${poi.label} » → scène inexistante « ${poi.sceneId} »`);
        if (hasService && !resolvedServiceIds.has(poi.serviceKind!)) addWm(poi.id, `POI « ${poi.label} » → service inconnu « ${poi.serviceKind} »`);
      }
    }
    for (const r of worldMap.routes) {
      for (const end of [r.a, r.b] as const) if (!placeIds.has(end)) addWm(r.id, `Route « ${r.id} » → lieu inexistant « ${end} »`);
      const amb = r.ambush;
      if (amb) {
        const target = project.find((s) => s.id === amb.scene);
        if (!target) addWm(r.id, `Route « ${r.id} » → scène d'embuscade inexistante « ${amb.scene} »`);
        else if (!target.encounters.some((e) => e.id === amb.encounter))
          addWm(r.id, `Route « ${r.id} » → rencontre d'embuscade inexistante « ${amb.encounter} » dans « ${amb.scene} »`);
      }
    }
  }
  const musicIds = new Set(allMusicDefs().map((d) => d.id));
  for (const s of project) {
    const dlgIds = new Set(s.dialogues.map((d) => d.id));
    const encIds = new Set(s.encounters.map((e) => e.id));
    const { w, h } = s.dimensions;
    const within = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h;
    const add = (level: Warning['level'], scope: Warning['scope'], refId: string | undefined, message: string) =>
      out.push({ level, sceneId: s.id, scope, refId, message });
    // Contexte de réfs PARTAGÉ pour cette scène : les `refs?` des handlers (state/combatEffects) le lisent
    // pour valider leurs réfs cassées (dialogue/rencontre/scène) et valeurs invalides (souffle de zone).
    const refCtx: EffectRefCtx = { sceneIds, dialogueIds: dlgIds, encounterIds: encIds, within };
    const checkEffect = (eff: Effect, refId: string, scope: Warning['scope']) => {
      const refs = (EFFECT_HANDLERS[eff.type] as EffectHandler).refs;
      if (refs) for (const issue of refs(eff, refCtx)) add(issue.level, scope, refId, issue.message);
    };
    const dup = (ids: string[], scope: Warning['scope']) => {
      const seen = new Set<string>();
      for (const id of ids) {
        if (seen.has(id)) add('error', scope, id, `Id dupliqué « ${id} »`);
        seen.add(id);
      }
    };

    for (const [slot, v] of Object.entries(s.music ?? {}))
      if (typeof v === 'string' && !musicIds.has(v)) add('warn', 'scene', undefined, `Musique (${slot === 'ambient' ? 'ambiance' : 'combat'}) inconnue au registre « ${v} »`);

    dup(s.entities.map((e) => e.id), 'entity');
    dup(s.triggers.map((t) => t.id), 'trigger');
    dup(s.dialogues.map((d) => d.id), 'dialogue');
    dup(s.encounters.map((e) => e.id), 'encounter');

    // Couches (`Scene.layers`) : ids d'étage valides pour rattacher les entités posées en hauteur.
    const layerZs = new Set(s.layers.map((l) => l.z));
    for (const e of s.entities) {
      if (e.dialogueId && !dlgIds.has(e.dialogueId)) add('error', 'entity', e.id, `${e.label ?? e.id} → dialogue inexistant « ${e.dialogueId} »`);
      if (!within(e.pos.x, e.pos.y)) add('warn', 'entity', e.id, `${e.label ?? e.id} hors carte (${e.pos.x},${e.pos.y})`);
      if (e.z && !layerZs.has(e.z)) add('warn', 'entity', e.id, `${e.label ?? e.id} sur étage ${e.z} inexistant`);
      if (e.statblock?.char)
        for (const k of Object.keys(e.statblock.char))
          if (!VALID_STATBLOCK_CHAR_KEYS.has(k)) add('error', 'entity', e.id, `${e.label ?? e.id} : statblock.char porte une clé étrangère « ${k} » (format canonique = CharKey slug plein, cf. #311)`);
    }
    // Toits (`Scene.roofs`) : leur couche couverte doit exister (cohérence du cutaway de rendu). L'avertissement
    // pointe le toit fautif (`scope: 'roof'`, refId) → clic = sélection dans l'éditeur (`selectWarning`).
    for (const r of s.roofs ?? [])
      if ((r.z ?? 0) !== 0 && !layerZs.has(r.z ?? 0)) add('warn', 'roof', r.id, `Toit « ${r.label ?? r.id} » sur étage ${r.z} inexistant`);
    const validRect = (rect: { x: number; y: number; w: number; h: number }) =>
      Number.isInteger(rect.x) && Number.isInteger(rect.y) && Number.isInteger(rect.w) && Number.isInteger(rect.h)
      && rect.w > 0 && rect.h > 0 && within(rect.x, rect.y) && within(rect.x + rect.w - 1, rect.y + rect.h - 1);
    const zoneAt = (id: string, z: number) => s.effectZones?.find((zone) => zone.id === id && (zone.z ?? 0) === z && zone.presentation === 'interior');
    const checkZoneRefs = (ids: string[], z: number, refId: string) => {
      for (const id of ids)
        if (!zoneAt(id, z)) add('error', 'architecture', refId, `Architecture « ${refId} » → zone intérieure « ${id} » inexistante à l’étage ${z}`);
    };
    const checkEdge = (edge: { x: number; y: number; side: string; z?: number }, z: number, refId: string) => {
      if (edge.side !== 'N' && edge.side !== 'E') add('error', 'architecture', refId, `Architecture « ${refId} » : arête non canonique « ${edge.side} »`);
      if (!Number.isInteger(edge.x) || !Number.isInteger(edge.y) || !within(edge.x, edge.y)) add('error', 'architecture', refId, `Architecture « ${refId} » : arête hors carte`);
      if (edge.z !== undefined && edge.z !== z) add('error', 'architecture', refId, `Architecture « ${refId} » : arête sur étage ${edge.z} différent de la section ${z}`);
    };
    dup((s.architecture ?? []).map((body) => body.id), 'architecture');
    for (const body of s.architecture ?? []) {
      dup(body.storeys.map((storey) => storey.id), 'architecture');
      dup(body.facades.map((facade) => facade.id), 'architecture');
      dup(body.roofs.map((roof) => roof.id), 'architecture');
      for (const storey of body.storeys) {
        if (storey.z !== 0 && !layerZs.has(storey.z)) add('error', 'architecture', storey.id, `Étage ${storey.z} inexistant`);
        dup(storey.parts.map((part) => part.id), 'architecture');
        for (const part of storey.parts)
          if (!validRect(part.foot)) add('error', 'architecture', part.id, `Partie « ${part.id} » hors carte ou d’emprise invalide`);
        checkZoneRefs(storey.roomZoneIds, storey.z, storey.id);
      }
      for (const facade of body.facades) {
        if (facade.z !== 0 && !layerZs.has(facade.z)) add('error', 'architecture', facade.id, `Étage ${facade.z} inexistant`);
        for (const edge of facade.edges) checkEdge(edge, facade.z, facade.id);
        checkZoneRefs(facade.roomZoneIds ?? [], facade.z, facade.id);
        dup((facade.features ?? []).map((feature) => feature.id), 'architecture');
        for (const feature of facade.features ?? []) checkEdge(feature.edge, facade.z, feature.id);
      }
      for (const roof of body.roofs) {
        if (roof.z !== 0 && !layerZs.has(roof.z)) add('error', 'architecture', roof.id, `Étage ${roof.z} inexistant`);
        if (!validRect(roof.foot)) add('error', 'architecture', roof.id, `Toiture « ${roof.id} » hors carte ou d’emprise invalide`);
        if (!['gable', 'hip', 'shed', 'flat'].includes(roof.profile)) add('error', 'architecture', roof.id, `Toiture « ${roof.id} » : profil invalide`);
        if (roof.ridge !== 'x' && roof.ridge !== 'y') add('error', 'architecture', roof.id, `Toiture « ${roof.id} » : faîtage invalide`);
        if (!['tuile', 'chaume', 'ardoise'].includes(roof.material)) add('error', 'architecture', roof.id, `Toiture « ${roof.id} » : matériau invalide`);
        if (!Number.isFinite(roof.eaveHeightM) || roof.eaveHeightM < 0 || !Number.isFinite(roof.pitch) || roof.pitch <= 0) add('error', 'architecture', roof.id, `Toiture « ${roof.id} » : hauteur ou pente invalide`);
        checkZoneRefs(roof.roomZoneIds, roof.z, roof.id);
      }
    }
    /** Bornes des fenêtres horaires d'une Condition (trigger `when`, choix `when`, nœud `si`). */
    const checkCondTimes = (cond: Condition, refId: string, scope: Warning['scope']) =>
      walkConditionTimes(cond, (tc) => {
        for (const [k, v] of [['afterHour', tc.afterHour], ['beforeHour', tc.beforeHour]] as const)
          if (v != null && (v < 0 || v > 23)) add('error', scope, refId, `Fenêtre horaire « ${refId} » : ${k} ${v} hors 0-23`);
        for (const [k, v] of [['afterMinute', tc.afterMinute], ['beforeMinute', tc.beforeMinute]] as const)
          if (v != null && (v < 0 || v > 59)) add('error', scope, refId, `Fenêtre horaire « ${refId} » : ${k} ${v} hors 0-59`);
      });
    /** Parcours RÉCURSIF d'un Flow (branches `if`/`test`, et le `flow` imbriqué d'un `delayedEffect`) :
     *  effets référencés + bornes des conditions horaires. ENVELOPPÉ : un Flow corrompu (nœud manquant/
     *  réf pendante — document ANCIEN qu'un `normalizeScene` ne peut pas tout réparer sans inventer de
     *  donnée) rapporte un Warning `error` au lieu de faire tomber la validation de TOUTE la scène —
     *  chaque flow est indépendant, un flow cassé ne masque pas les autres. */
    const checkFlow = (flow: Flow, refId: string, scope: Warning['scope']) => {
      try {
        walkFlow(flow, (node) => {
          if (node.kind === 'do') {
            checkEffect(node.effect, refId, scope);
            if (node.effect.type === 'delayedEffect') checkFlow(node.effect.flow, refId, scope);
          } else if (node.kind === 'if') checkCondTimes(node.cond, refId, scope);
        });
      } catch {
        add('error', scope, refId, `Flow « ${refId} » corrompu (nœud invalide/réf pendante)`);
      }
    };

    for (const t of s.triggers) {
      if (!within(t.rect.x, t.rect.y) || !within(t.rect.x + t.rect.w - 1, t.rect.y + t.rect.h - 1)) add('warn', 'trigger', t.id, `Zone « ${t.id} » déborde de la carte`);
      if (t.when) checkCondTimes(t.when, t.id, 'trigger');
      checkFlow(t.flow, t.id, 'trigger');
    }
    for (const d of s.dialogues) {
      const nodeIds = new Set(d.nodes.map((n) => n.id));
      if (!nodeIds.has(d.start)) add('error', 'dialogue', d.id, `Dialogue « ${d.id} » : départ « ${d.start} » inexistant`);
      for (const n of d.nodes)
        for (const c of n.choices) {
          if (c.next && !nodeIds.has(c.next)) add('error', 'dialogue', d.id, `Dialogue « ${d.id} » : choix → « ${c.next} » inexistant`);
          if (c.when) checkCondTimes(c.when, d.id, 'dialogue');
          if (c.flow) checkFlow(c.flow, d.id, 'dialogue');
        }
    }
    const entIds = new Set(s.entities.map((e) => e.id));
    for (const e of s.encounters) {
      checkFlow(e.onVictory ?? EMPTY_FLOW, e.id, 'encounter'); // onVictory est déjà un Flow (delayedEffect.flow récursé)
      // onVictory est APPLIQUÉ À PLAT à la victoire (finishVictory → flattenFlow), pour préserver la
      // déférence transition/dialogue → « Continuer ». flattenFlow lève sur un nœud interactif → on
      // l'interdit ici (les `if` conditionnels restent permis, eux, car flattenFlow les évalue).
      if (e.onVictory && flowHasTest(e.onVictory)) add('error', 'encounter', e.id, `Rencontre « ${e.id} » : onVictory ne peut pas contenir de jet interactif (Test/Choix) — il est appliqué à plat à la victoire`);
      for (const m of e.members ?? []) {
        if (!entIds.has(m.entityId)) add('error', 'encounter', e.id, `Rencontre « ${e.id} » → membre inexistant « ${m.entityId} »`);
        if (m.ridesEntityId && !entIds.has(m.ridesEntityId)) add('error', 'encounter', e.id, `Rencontre « ${e.id} » → monture inexistante « ${m.ridesEntityId} »`);
      }
    }
  }
  return out;
}
