import type { Scene, Effect } from './scene';
import { isWalkable } from './scene';
import { type Flow, type Condition, walkFlow, walkConditionTimes, flowHasTest, EMPTY_FLOW } from './flow';
// Registre des effets (réfs de validation `handler.refs`) — importé via le BARIL `combatFlow` (qui
// ré-exporte combatEffects), comme le store : entrer le cycle d'effets/combat par le MÊME nœud
// canonique préserve l'ordre d'évaluation (un import direct de `combatEffects` ici casse la
// liaison vive `fireScheduledEffects` que le store lit du baril sous le bundler).
import { EFFECT_HANDLERS, type EffectHandler, type EffectRefCtx } from './combatFlow';
import type { WorldMap } from './worldMap';
import { allMusicDefs } from '../audio/music';

export interface Warning {
  level: 'error' | 'warn';
  sceneId: string;
  scope: 'entity' | 'building' | 'trigger' | 'dialogue' | 'encounter' | 'scene' | 'worldMap';
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
    for (const p of worldMap.places) if (!sceneIds.has(p.scene)) addWm(p.id, `Lieu « ${p.label} » → scène inexistante « ${p.scene} »`);
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
    dup((s.buildings ?? []).map((b) => b.id), 'building');
    dup(s.triggers.map((t) => t.id), 'trigger');
    dup(s.dialogues.map((d) => d.id), 'dialogue');
    dup(s.encounters.map((e) => e.id), 'encounter');

    const levelZs = new Set(s.levels.map((l) => l.z));
    for (const e of s.entities) {
      if (e.dialogueId && !dlgIds.has(e.dialogueId)) add('error', 'entity', e.id, `${e.label ?? e.id} → dialogue inexistant « ${e.dialogueId} »`);
      if (!within(e.pos.x, e.pos.y)) add('warn', 'entity', e.id, `${e.label ?? e.id} hors carte (${e.pos.x},${e.pos.y})`);
      if (e.z && !levelZs.has(e.z)) add('warn', 'entity', e.id, `${e.label ?? e.id} sur étage ${e.z} inexistant`);
    }
    // Escaliers (franchissements verticaux) : chaque extrémité dans la carte, sur un niveau existant et
    // une case marchable ; relier deux étages DIFFÉRENTS (sinon l'escalier ne sert à rien).
    for (const st of s.stairs ?? []) {
      for (const end of [st.from, st.to]) {
        if (!within(end.x, end.y)) add('warn', 'scene', undefined, `Escalier hors carte (${end.x},${end.y},z${end.z})`);
        else if (!levelZs.has(end.z)) add('warn', 'scene', undefined, `Escalier vers l'étage ${end.z} inexistant`);
        else if (!isWalkable(s, end.x, end.y, end.z)) add('warn', 'scene', undefined, `Escalier sur une case non marchable (${end.x},${end.y},z${end.z})`);
      }
      if (st.from.z === st.to.z) add('warn', 'scene', undefined, `Escalier reliant le même étage (z${st.from.z})`);
    }
    for (const b of s.buildings ?? []) {
      if (b.interiorScene && !sceneIds.has(b.interiorScene)) add('error', 'building', b.id, `${b.label ?? b.id} → scène intérieure inexistante « ${b.interiorScene} »`);
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
     *  effets référencés + bornes des conditions horaires. */
    const checkFlow = (flow: Flow, refId: string, scope: Warning['scope']) =>
      walkFlow(flow, (node) => {
        if (node.kind === 'do') {
          checkEffect(node.effect, refId, scope);
          if (node.effect.type === 'delayedEffect') checkFlow(node.effect.flow, refId, scope);
        } else if (node.kind === 'if') checkCondTimes(node.cond, refId, scope);
      });

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
