import type { Scene, Effect } from './scene';
import { allMusicDefs } from '../audio/music';

export interface Warning {
  level: 'error' | 'warn';
  sceneId: string;
  scope: 'entity' | 'building' | 'trigger' | 'dialogue' | 'encounter' | 'scene';
  /** Id du fautif (pour clic → sélection dans l'éditeur). */
  refId?: string;
  message: string;
}

/** Le Test imbrique onSuccess/onFailure → parcours récursif de tous les Effet. */
function walkEffects(effects: Effect[] | undefined, fn: (e: Effect) => void) {
  for (const e of effects ?? []) {
    fn(e);
    if (e.type === 'test') {
      walkEffects(e.onSuccess, fn);
      walkEffects(e.onFailure, fn);
    }
  }
}

/**
 * Vérifie un PROJET (liste de scènes) avant le runtime : réfs cassées (dialogue / rencontre /
 * scène / scène intérieure / nœud de dialogue), zones hors-carte, ids dupliqués. PUR.
 */
export function validateScene(project: Scene[]): Warning[] {
  const out: Warning[] = [];
  const sceneIds = new Set(project.map((s) => s.id));
  const musicIds = new Set(allMusicDefs().map((d) => d.id));
  for (const s of project) {
    const dlgIds = new Set(s.dialogues.map((d) => d.id));
    const encIds = new Set(s.encounters.map((e) => e.id));
    const { w, h } = s.dimensions;
    const within = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h;
    const add = (level: Warning['level'], scope: Warning['scope'], refId: string | undefined, message: string) =>
      out.push({ level, sceneId: s.id, scope, refId, message });
    const checkEffect = (eff: Effect, refId: string, scope: Warning['scope']) => {
      if (eff.type === 'startDialogue' && !dlgIds.has(eff.dialogue)) add('error', scope, refId, `Effet → dialogue inexistant « ${eff.dialogue} »`);
      if (eff.type === 'startCombat' && !encIds.has(eff.encounter)) add('error', scope, refId, `Effet → rencontre inexistante « ${eff.encounter} »`);
      if (eff.type === 'transition' && !sceneIds.has(eff.scene)) add('error', scope, refId, `Effet → scène inexistante « ${eff.scene} »`);
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

    for (const e of s.entities) {
      if (e.dialogueId && !dlgIds.has(e.dialogueId)) add('error', 'entity', e.id, `${e.label ?? e.id} → dialogue inexistant « ${e.dialogueId} »`);
      if (!within(e.pos.x, e.pos.y)) add('warn', 'entity', e.id, `${e.label ?? e.id} hors carte (${e.pos.x},${e.pos.y})`);
    }
    for (const b of s.buildings ?? []) {
      if (b.interiorScene && !sceneIds.has(b.interiorScene)) add('error', 'building', b.id, `${b.label ?? b.id} → scène intérieure inexistante « ${b.interiorScene} »`);
    }
    for (const t of s.triggers) {
      if (!within(t.rect.x, t.rect.y) || !within(t.rect.x + t.rect.w - 1, t.rect.y + t.rect.h - 1)) add('warn', 'trigger', t.id, `Zone « ${t.id} » déborde de la carte`);
      walkEffects(t.effects, (eff) => checkEffect(eff, t.id, 'trigger'));
    }
    for (const d of s.dialogues) {
      const nodeIds = new Set(d.nodes.map((n) => n.id));
      if (!nodeIds.has(d.start)) add('error', 'dialogue', d.id, `Dialogue « ${d.id} » : départ « ${d.start} » inexistant`);
      for (const n of d.nodes)
        for (const c of n.choices) {
          if (c.next && !nodeIds.has(c.next)) add('error', 'dialogue', d.id, `Dialogue « ${d.id} » : choix → « ${c.next} » inexistant`);
          walkEffects(c.effects, (eff) => checkEffect(eff, d.id, 'dialogue'));
        }
    }
    for (const e of s.encounters) walkEffects(e.onVictory, (eff) => checkEffect(eff, e.id, 'encounter'));
  }
  return out;
}
