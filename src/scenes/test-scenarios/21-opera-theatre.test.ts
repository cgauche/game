import { flowEffects } from '../../state/flow';
import { describe, it, expect, beforeEach } from 'vitest';
import { validateScene } from '../../state/validateScene';
import { isWalkable, type Effect } from '../../state/scene';
import { pathTo } from '../../state/path';
import { useGame } from '../../state/store';
import { applyEffects } from '../../state/combatEffects';
import { createHero } from '../../engine/character';
import { makeRNG } from '../../engine/dice';
import { scenario } from './21-opera-theatre';

/**
 * Le théâtre multi-niveaux est du CONTENU pur (données éditeur). Ce gate vérifie qu'il est
 * structurellement cohérent et passe `validateScene` sans erreur — pas de loge orpheline, pas de
 * prop hors carte, pas d'entité sur un étage inexistant. C'est la preuve « zéro hardcode » : la
 * salle est assemblée avec `levels`/`SceneEntity.z`/props et reste éditable + valide.
 */
describe('Scénario « Opéra — Théâtre » : salle multi-niveaux valide', () => {
  const scene = scenario.scene;

  it('passe validateScene sans erreur (avertissements tolérés)', () => {
    const errors = validateScene([scene]).filter((w) => w.level === 'error');
    expect(errors).toEqual([]);
  });

  it('est bien multi-niveaux : parterre (z0) + galerie de loges (z1)', () => {
    expect(scene.levels.map((l) => l.z).sort()).toEqual([0, 1]);
    // la loge royale (galerie, z1) est marchable
    expect(isWalkable(scene, 10, 13, 1)).toBe(true);
    // le parterre est marchable au sol
    expect(isWalkable(scene, 10, 8, 0)).toBe(true);
    // une case « vide » d'étage (au-dessus du parterre central) reste infranchissable
    expect(isWalkable(scene, 10, 8, 1)).toBe(false);
  });

  it('le mobilier et les PNJ sont posés à leur étage (entités z=1 présentes)', () => {
    const upper = scene.entities.filter((e) => (e.z ?? 0) === 1);
    expect(upper.length).toBeGreaterThan(5);
    // la Comtesse siège dans la loge royale (z1)
    const comtesse = scene.entities.find((e) => e.id === 'comtesse')!;
    expect(comtesse.z).toBe(1);
    expect(comtesse.kind).toBe('personnage');
    // tout prop/PNJ d'étage référence un niveau existant
    const zs = new Set(scene.levels.map((l) => l.z));
    for (const e of scene.entities) expect(zs.has(e.z ?? 0)).toBe(true);
  });

  it('la loge royale est ATTEIGNABLE depuis l’entrée par l’escalier (pathfinding 3D)', () => {
    const start = scene.entities.find((e) => e.kind === 'heroStart')!.pos;
    // depuis le vestibule, on doit traverser le hall, monter un escalier (z change) et gagner la loge royale
    const path = pathTo(scene, { x: start.x, y: start.y, z: 0 }, { x: 10, y: 13, z: 1 }, new Set<string>());
    expect(path).not.toBeNull();
    expect(path!.some((p) => (p.z ?? 0) === 1)).toBe(true);
  });

  it('la scène est accessible depuis le parterre (plan connexe au sol)', () => {
    const start = scene.entities.find((e) => e.kind === 'heroStart')!.pos;
    expect(pathTo(scene, { x: start.x, y: start.y }, { x: 10, y: 3 }, new Set<string>())).not.toBeNull();
  });
});

describe('Opéra — Théâtre : intrigue n°1 (la bombe de la loge royale)', () => {
  const arm = scenario.scene.triggers.find((t) => t.id === 'armer-bombe')!;
  const plante = scenario.scene.entities.find((e) => e.id === 'plante-bombe')!;
  const detect = plante.interact!.effects[0] as Extract<Effect, { type: 'test' }>;

  beforeEach(() => useGame.setState({ battle: null, flags: {}, scheduledEffects: [], gameTime: 20 * 60, partyPos: { x: 10, y: 14, z: 1 } }));
  function lonePartyAt(wounds: number) {
    const h = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(1) });
    h.wounds = { current: wounds, max: wounds };
    useGame.setState({ party: [h] });
    return h;
  }

  it('la plante piégée est posée dans la loge royale (z1) et se détecte mieux avec la Poudre noire', () => {
    expect(plante.z).toBe(1);
    expect(detect.easierIf?.hasSkill).toBe('Projectiles (Poudre noire)');
  });

  it('entrer dans l’auditorium baisse les lumières et programme la soirée (pétards + mèche)', () => {
    lonePartyAt(35);
    applyEffects(useGame.getState, useGame.setState, flowEffects(arm.flow));
    expect(useGame.getState().lightLevel).toBe(0.35); // les lumières baissent (mise en scène)
    expect(useGame.getState().scheduledEffects).toHaveLength(3); // pétards (10), retour lumière (11), bombe (60)
  });

  it('retirer le détonateur empêche l’explosion finale', () => {
    const before = lonePartyAt(35).wounds.current;
    applyEffects(useGame.getState, useGame.setState, flowEffects(arm.flow));
    applyEffects(useGame.getState, useGame.setState, detect.onSuccess!); // désamorçage
    useGame.getState().advanceTime(120);
    expect(useGame.getState().party[0].wounds.current).toBe(before); // intacte (pétards à l'écart, bombe annulée)
  });

  it('les pétards (intrigue n°2) éclatent à 20h30 : flash puis pénombre rétablie', () => {
    lonePartyAt(35);
    applyEffects(useGame.getState, useGame.setState, flowEffects(arm.flow));
    useGame.getState().advanceTime(10); // 20h30 : la mèche éclaire, les pétards éclatent
    expect(useGame.getState().lightLevel).toBe(0.8); // flash
    useGame.getState().advanceTime(1); // la salle se rassoit
    expect(useGame.getState().lightLevel).toBe(0.35);
  });

  it('le spot-check Glimbrin (intrigue n°2) a ses deux issues (clés sauves / volées)', () => {
    const petards = flowEffects(arm.flow).find((e): e is Extract<Effect, { type: 'delayedEffect' }> => e.type === 'delayedEffect' && e.afterMinutes === 10)!;
    const spot = petards.effects.find((e): e is Extract<Effect, { type: 'test' }> => e.type === 'test')!;
    expect(spot.skill).toBe('Perception');
    lonePartyAt(35);
    applyEffects(useGame.getState, useGame.setState, spot.onFailure!);
    expect(useGame.getState().flags.clesVolees).toBe(true);
    applyEffects(useGame.getState, useGame.setState, spot.onSuccess!);
    expect(useGame.getState().flags.glimbrinDejoue).toBe(true);
  });

  it('la Comtesse remercie si la bombe a été déjouée (branche gatée par flag)', () => {
    const dlg = scenario.scene.dialogues.find((d) => d.id === 'dlg-comtesse')!;
    const grateful = dlg.nodes.find((n) => n.id === 'n0')!.choices.find((c) => c.condition === 'bombeDesamorcee');
    expect(grateful?.next).toBe('merci');
    const merci = dlg.nodes.find((n) => n.id === 'merci')!;
    expect(merci.choices[0].effects?.some((e) => e.type === 'giveMoney')).toBe(true);
  });

  it('chaque intrigue résolue récompense les PX canoniques (50 / 15 / 10)', () => {
    const xpIn = (effs: Effect[] | undefined) =>
      (effs ?? []).filter((e): e is Extract<Effect, { type: 'giveXp' }> => e.type === 'giveXp').reduce((n, e) => n + e.amount, 0);
    expect(xpIn(detect.onSuccess)).toBe(50); // bombe déjouée (l.275)
    const petards = flowEffects(arm.flow).find((e): e is Extract<Effect, { type: 'delayedEffect' }> => e.type === 'delayedEffect' && e.afterMinutes === 10)!;
    const spot = petards.effects.find((e): e is Extract<Effect, { type: 'test' }> => e.type === 'test')!;
    expect(xpIn(spot.onSuccess)).toBe(15); // vol de clés empêché (l.297)
    expect(xpIn(scenario.scene.encounters.find((e) => e.id === 'enc-etudiants')!.onVictory)).toBe(10); // étudiants arrêtés (l.277)
  });

  it('confronter les étudiants offre un combat optionnel (les arrêter)', () => {
    const enc = scenario.scene.encounters.find((e) => e.id === 'enc-etudiants')!;
    expect(enc.members?.map((m) => m.entityId)).toEqual(['etudiant-1', 'etudiant-2']);
    const dlg = scenario.scene.dialogues.find((d) => d.id === 'dlg-etudiants')!;
    const fight = dlg.nodes.flatMap((n) => n.choices).flatMap((c) => c.effects ?? []);
    expect(fight.some((e) => e.type === 'startCombat' && e.encounter === 'enc-etudiants')).toBe(true);
  });

  it('sans désamorçage, l’explosion frappe l’antichambre au bout de la mèche', () => {
    const before = lonePartyAt(35).wounds.current;
    applyEffects(useGame.getState, useGame.setState, flowEffects(arm.flow));
    useGame.getState().advanceTime(60);
    expect(useGame.getState().party[0].wounds.current).toBeLessThanOrEqual(before - 15);
  });
});
