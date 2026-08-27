import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseProject, routesFrom } from '../../state/worldMap';
import { validateScene, type Warning } from '../../state/validateScene';
import type { Scene } from '../../state/scene';
import { findCreatureById, findVehicleById, findNavalTrait, findCrewRoleById } from '../../data';
import { findManannFactor } from '../../engine/seaVoyage';
import { MERCHANTS } from '../../state/merchants';
import type { Effect } from '../../state/scene';

/**
 * « Le Loup et la Saumure » — projet de données pures GÉNÉRÉ par `scripts/loup-et-saumure/generate.mjs`
 * (source canonique = le générateur, comme `scripts/arene/generate.mjs` → `arene-projet.json`) : ce test
 * verrouille que le JSON produit est VALIDE (transitions/dialogues/ids/carte du monde) et que chaque
 * combattant référence une vraie créature OU un vrai navire (`vehicles.json`) du catalogue — la campagne
 * navale enrôle des COQUES (`ref` de `vehicles.json`), absentes du bestiaire par construction.
 */
const doc = parseProject(JSON.parse(readFileSync(join(__dirname, 'loup-et-saumure-projet.json'), 'utf8')));
const project: Scene[] = doc.scenes;

/** Toutes les entités ENRÔLÉES dans une rencontre (celles référencées par `EncounterDef.members`). */
function enrolledEntities(scene: Scene) {
  const byId = new Map(scene.entities.map((e) => [e.id, e] as const));
  return scene.encounters.flatMap((enc) => (enc.members ?? []).map((m) => byId.get(m.entityId)!));
}

describe('Le Loup et la Saumure — projet de données (naval, zéro code applicatif)', () => {
  it('5 scènes dans l’ordre des actes : quai de départ, cogue, escale, Olg, épilogue', () => {
    expect(project.map((s) => s.id)).toEqual([
      'ls-quai-salzenmund',
      'ls-abordage-cogue',
      'ls-quai-erengrad',
      'ls-abordage-olg',
      'ls-epilogue-salzenmund',
    ]);
  });

  it('CARTE DU MONDE : Salzenmund ⇄ Erengrad, DEUX routes maritimes à SENS UNIQUE (aller/retour), chacune avec son embuscade', () => {
    const wm = doc.worldMap!;
    expect(wm.places.map((p) => p.id)).toEqual(['salzenmund', 'erengrad']);
    for (const p of wm.places) {
      expect(p.port, `port de ${p.id}`).toBeTruthy();
      // #217 — le lieu porte une réf de catalogue (naval-ports.json) ; parseProject/resolvePortRef a
      // fait couler Taille/Richesse RAW depuis le catalogue (l'authoring JSON est sparse : { ref }).
      expect(p.port!.ref, `réf de port de ${p.id}`).toBe(p.id);
      expect(p.port!.taille).toBe(4);
      expect(p.port!.richesse).toBe(4);
    }
    expect(wm.routes).toHaveLength(2);
    expect(wm.routes.every((r) => r.sea)).toBe(true);
    expect(wm.routes.every((r) => r.km === 550)).toBe(true); // 550 milles RAW (synopsis de référence)
    // Les deux routes sont DISCERNABLES par le SENS (`from`) : depuis chaque port une seule est offerte au
    // clic (`routesFrom`), donc l'embuscade tirée est DÉTERMINISTE — aller = Dent de Manann, retour = Olg.
    const aller = wm.routes.find((r) => r.from === 'salzenmund')!;
    const retour = wm.routes.find((r) => r.from === 'erengrad')!;
    expect(aller?.ambush?.scene).toBe('ls-abordage-cogue');
    expect(aller?.ambush?.encounter).toBe('enc-cogue');
    expect(retour?.ambush?.scene).toBe('ls-abordage-olg');
    expect(retour?.ambush?.encounter).toBe('enc-olg');
  });

  it('ROUTAGE DÉTERMINISTE (#237) : depuis chaque port, `routesFrom` n’offre que la route de CE sens (zéro hasard de clic)', () => {
    const wm = doc.worldMap!;
    const fromSalz = routesFrom(wm, 'salzenmund');
    const fromEren = routesFrom(wm, 'erengrad');
    expect(fromSalz.map((r) => r.ambush?.encounter)).toEqual(['enc-cogue']); // aller → la Dent de Manann, JAMAIS Olg
    expect(fromEren.map((r) => r.ambush?.encounter)).toEqual(['enc-olg']);   // retour → Olg, JAMAIS la cogue
  });

  it('validateScene(projet + carte du monde) ne lève AUCUNE erreur', () => {
    const errors = validateScene(project, doc.worldMap).filter((w: Warning) => w.level === 'error');
    expect(errors).toEqual([]);
  });

  it('chaque combattant enrôlé référence une vraie CRÉATURE ou un vrai NAVIRE (vehicles.json)', () => {
    const missing: string[] = [];
    for (const sc of project)
      for (const e of enrolledEntities(sc))
        if (e.ref && !findCreatureById(e.ref) && !findVehicleById(e.ref)?.hull) missing.push(`${sc.id}:${e.ref}`);
    expect(missing).toEqual([]);
  });

  it('chaque CustomStatblock d’auteur porte son label (spawn.ts:322 lit sb.label sans repli)', () => {
    const missing: string[] = [];
    for (const sc of project)
      for (const e of sc.entities)
        if (e.statblock && !e.statblock.label) missing.push(`${sc.id}:${e.id}`);
    expect(missing).toEqual([]);
  });

  it('les DEUX combats navals enrôlent une coque ALLIÉE (le Grimm) et une coque ENNEMIE, chacune avec des postes servables', () => {
    for (const [sceneId, allyId, enemyId] of [
      ['ls-abordage-cogue', 'grimm', 'cogue'],
      ['ls-abordage-olg', 'grimm2', 'serpent-de-sel'],
    ] as const) {
      const sc = project.find((s) => s.id === sceneId)!;
      const ally = sc.entities.find((e) => e.id === allyId)!;
      const enemy = sc.entities.find((e) => e.id === enemyId)!;
      expect(findVehicleById(ally.ref!)?.hull, `${allyId} est une coque`).toBeTruthy();
      expect(findVehicleById(enemy.ref!)?.hull, `${enemyId} est une coque`).toBeTruthy();
      // Postes SANS chef pré-assigné (servables en jeu par les héros — cf. `state/shipPostes.ts`
      // servablePostes/serveAtPoste) : aucun id de héros n'est connu à l'authoring de campagne.
      expect((ally.postes ?? []).length).toBeGreaterThan(0);
      for (const p of ally.postes ?? []) expect(p.crewIds).toEqual([]);
    }
  });

  it('DOTATION DE BORD (#241) : chaque poste du Grimm porte un coffre à munitions (ammo qty>0) et une sélection (ammoUid) valide', () => {
    for (const [sceneId, allyId] of [['ls-abordage-cogue', 'grimm'], ['ls-abordage-olg', 'grimm2']] as const) {
      const sc = project.find((s) => s.id === sceneId)!;
      const ally = sc.entities.find((e) => e.id === allyId)!;
      for (const p of ally.postes ?? []) {
        expect(p.ammo, `${sceneId}/${p.trappingId} : coffre à munitions posé`).toBeTruthy();
        expect(p.ammo!.length).toBeGreaterThan(0);
        for (const a of p.ammo!) {
          expect(a.kind).toBe('ammo');
          expect(a.qty ?? 0).toBeGreaterThan(0);
        }
        // La sélection persistante pointe une munition RÉELLEMENT en soute (selectedAmmo la trouvera).
        expect(p.ammo!.some((a) => a.uid === p.ammoUid), `${sceneId}/${p.trappingId} : ammoUid dans le stock`).toBe(true);
      }
    }
  });

  it('la commission de Köhler MENTIONNE la dotation de bord (soutes garnies) — le joueur sait qu’il appareille armé', () => {
    const sc = project.find((s) => s.id === 'ls-quai-salzenmund')!;
    const k1 = sc.dialogues.find((d) => d.id === 'dlg-kohler')!.nodes.find((n) => n.id === 'k1')!;
    expect(/poudre et de boulets/i.test(k1.desc)).toBe(true);
  });

  it('la Dent de Manann (cogue) porte son équipage exposé (crewIds) référencé par de vraies entités', () => {
    const sc = project.find((s) => s.id === 'ls-abordage-cogue')!;
    const cogue = sc.entities.find((e) => e.id === 'cogue')!;
    expect(cogue.crewIds!.length).toBeGreaterThan(0);
    const entIds = new Set(sc.entities.map((e) => e.id));
    for (const id of cogue.crewIds!) expect(entIds.has(id), `équipage exposé ${id}`).toBe(true);
  });

  it('Olg Blóðsalt (référence exacte du bestiaire, MDG 07) est bien le boss de l’abordage final', () => {
    const sc = project.find((s) => s.id === 'ls-abordage-olg')!;
    const olg = sc.entities.find((e) => e.id === 'olg')!;
    expect(olg.ref).toBe('olg-blodsalt');
    expect(findCreatureById('olg-blodsalt')).toBeTruthy();
    const enc = sc.encounters.find((e) => e.id === 'enc-olg')!;
    expect(enc.members!.some((m) => m.entityId === 'olg' && m.side === 'enemy')).toBe(true);
  });

  it('la commission de Köhler est la PRÉMISSE assumée : accepter donne l’avance ET le Grimm (setVessel)', () => {
    const sc = project.find((s) => s.id === 'ls-quai-salzenmund')!;
    const dlg = sc.dialogues.find((d) => d.id === 'dlg-kohler')!;
    const accept = dlg.nodes.flatMap((n) => n.choices).find((c) => /Accepter la commission/.test(c.label))!;
    const steps = accept.flow!.kind === 'seq' ? accept.flow!.steps : [];
    const types = steps.map((s) => (s.kind === 'do' ? s.effect.type : s.kind));
    expect(types).toEqual(expect.arrayContaining(['giveMoney', 'setVessel', 'setFlag', 'journal']));
  });

  it('VITRINE : un Test (Intuition) et un Test ÉTENDU (réparation de coque) sont bien mis en scène', () => {
    const erengrad = project.find((s) => s.id === 'ls-quai-erengrad')!;
    const salzenmund = project.find((s) => s.id === 'ls-quai-salzenmund')!;
    const hasTest = (scene: Scene) => scene.dialogues.some((d) => d.nodes.some((n) => n.choices.some((c) => c.flow?.kind === 'test')));
    expect(hasTest(salzenmund) || hasTest(erengrad)).toBe(true);
    const reparation = erengrad.dialogues.find((d) => d.id === 'dlg-reparation')!;
    const choice = reparation.nodes[0].choices.find((c) => c.flow?.kind === 'seq' && c.flow.steps.some((s) => s.kind === 'do' && s.effect.type === 'extendedTest'));
    expect(choice, 'extendedTest présent').toBeTruthy();
  });

  /** Marche UN Flow (feuille `do`, `seq`, `if`, `test`) et collecte ses `Effect`. Le nœud `test`
   *  porte ses branches en `success`/`fail` (Flows `flowOf`), PAS `onSuccess`/`onFailure`. */
  function walkFlow(flow: any, out: Effect[]) {
    if (!flow) return;
    if (flow.kind === 'do') out.push(flow.effect);
    else if (flow.kind === 'seq') for (const s of flow.steps) walkFlow(s, out);
    else if (flow.kind === 'if') { walkFlow(flow.then, out); walkFlow(flow.else, out); }
    else if (flow.kind === 'test') { walkFlow(flow.success, out); walkFlow(flow.fail, out); }
  }

  /** Tous les `Effect` posés dans un `flow` de la campagne — choix de dialogue, triggers, onVictory des
   *  rencontres, et interactions de décor (`entities[].interact`) — toutes scènes confondues. */
  function allEffects(): Effect[] {
    const out: Effect[] = [];
    for (const sc of project) {
      for (const d of sc.dialogues) for (const n of d.nodes) for (const c of n.choices) walkFlow(c.flow, out);
      for (const t of sc.triggers) walkFlow(t.flow, out);
      for (const enc of sc.encounters) walkFlow(enc.onVictory, out);
      for (const e of sc.entities) if (e.interact?.flow) walkFlow(e.interact.flow, out);
    }
    return out;
  }

  it('la bénédiction/le sacrifice d’Aldo posent un Effect adjustManann avec un factorId RÉEL (MANANN_FACTORS)', () => {
    const manannEffects = allEffects().filter((e): e is Extract<Effect, { type: 'adjustManann' }> => e.type === 'adjustManann');
    expect(manannEffects.length).toBeGreaterThan(0);
    for (const e of manannEffects) {
      expect(e.factorId, 'factorId posé (pas un delta brut)').toBeTruthy();
      expect(findManannFactor(e.factorId!), `facteur Manann « ${e.factorId} » existe`).toBeTruthy();
    }
  });

  it('le setVessel de la commission porte saboteurDR dans [-5,0] (sabotage discret de Kramer, MDG 14 l.45-47)', () => {
    const setVesselEffects = allEffects().filter((e): e is Extract<Effect, { type: 'setVessel' }> => e.type === 'setVessel');
    const commission = setVesselEffects.find((e) => e.vehicleId === 'loup-imperial');
    expect(commission, 'setVessel du Loup impérial posé').toBeTruthy();
    expect(commission!.saboteurDR).toBeDefined();
    expect(commission!.saboteurDR!).toBeGreaterThanOrEqual(-5);
    expect(commission!.saboteurDR!).toBeLessThanOrEqual(0);
  });

  it('le setVessel de la commission porte le NOM d’instance « Le Grimm » (#230) et un roster SALARIÉ valide (#216)', () => {
    const setVesselEffects = allEffects().filter((e): e is Extract<Effect, { type: 'setVessel' }> => e.type === 'setVessel');
    const commission = setVesselEffects.find((e) => e.vehicleId === 'loup-imperial')!;
    expect(commission.label).toBe('Le Grimm');
    expect(commission.crew, 'roster salarié posé').toBeTruthy();
    expect(commission.crew!.length).toBeGreaterThan(0);
    for (const hire of commission.crew!) {
      expect(hire.count).toBeGreaterThan(0);
      expect(findCrewRoleById(hire.roleId), `rôle d’équipage « ${hire.roleId} » existe (crew-roles.json)`).toBeTruthy();
    }
  });

  it('la coque du Serpent-de-Sel porte la Proue-idole de Stromfels en amélioration d’INSTANCE (#221)', () => {
    const sc = project.find((s) => s.id === 'ls-abordage-olg')!;
    const serpent = sc.entities.find((e) => e.id === 'serpent-de-sel')!;
    expect(serpent.upgrades, 'améliorations d’instance posées').toBeTruthy();
    expect(serpent.upgrades!.some((u) => u.id === 'proue-idole-de-stromfels')).toBe(true);
    for (const u of serpent.upgrades!) expect(findNavalTrait(u.id), `amélioration navale « ${u.id} » existe`).toBeTruthy();
  });

  it('l’équipage norse d’Olg référence la créature maraudeur-du-chaos (#221)', () => {
    const sc = project.find((s) => s.id === 'ls-abordage-olg')!;
    for (const id of ['norse-1', 'norse-2']) {
      const norse = sc.entities.find((e) => e.id === id)!;
      expect(norse.ref).toBe('maraudeur-du-chaos');
    }
    expect(findCreatureById('maraudeur-du-chaos')).toBeTruthy();
  });

  it('l’avitailleur du quai référence un archétype marchand RÉEL du registre (#220)', () => {
    const sc = project.find((s) => s.id === 'ls-quai-salzenmund')!;
    const av = sc.entities.find((e) => e.id === 'avitailleur')!;
    expect(av.merchant?.archetype).toBe('avitailleur');
    expect(MERCHANTS[av.merchant!.archetype!], 'archétype « avitailleur » au registre').toBeTruthy();
  });

  it('ZÉRO jargon technique dans les textes joueur (dialogues, journal, modales document, objectifs)', () => {
    const jargonPattern = /`|INEXPRIMABLE|CONTOURN|\bstate\.|\bvessel\.|\bTODO\b|seaVoyageFlow|op:'testMod'|engine\/ops\.ts|adjustManann|adjustVessel|setVessel|setObjective|saboteurDR|factorId|woundsThreshold|MDG \d+ l\.\d/;
    const bad: string[] = [];
    for (const sc of project)
      for (const d of sc.dialogues)
        for (const n of d.nodes) {
          if (jargonPattern.test(n.desc)) bad.push(`${sc.id}/${d.id}/${n.id}: node.desc`);
          for (const c of n.choices) if (jargonPattern.test(c.label)) bad.push(`${sc.id}/${d.id}/${n.id}: choice "${c.label}"`);
        }
    for (const e of allEffects()) {
      if (e.type === 'journal' && jargonPattern.test(e.desc)) bad.push(`journal: "${e.desc}"`);
      if (e.type === 'document' && (jargonPattern.test(e.title) || jargonPattern.test(e.desc))) bad.push(`document: "${e.title}"`);
      if (e.type === 'setObjective' && jargonPattern.test(e.desc)) bad.push(`objectif: "${e.desc}"`);
    }
    expect(bad).toEqual([]);
  });

  it('OBJECTIFS d’acte (#238) : posés/mis à jour aux bascules (id STABLE unique), vidés à l’épilogue', () => {
    const objTexts = allEffects().filter((e): e is Extract<Effect, { type: 'setObjective' }> => e.type === 'setObjective');
    // Tous keyés par le MÊME id stable (une pile d’objectif qui ÉVOLUE, doc §10).
    expect(objTexts.length).toBeGreaterThanOrEqual(4);
    for (const o of objTexts) expect(o.id).toBe('ls-mission');
    // Bascule 1 : la commission de Köhler pose l’objectif d’aller.
    const salzenmund = project.find((s) => s.id === 'ls-quai-salzenmund')!;
    const accept = salzenmund.dialogues.find((d) => d.id === 'dlg-kohler')!.nodes.flatMap((n) => n.choices).find((c) => /Accepter la commission/.test(c.label))!;
    const acceptEffects: Effect[] = [];
    walkFlow(accept.flow, acceptEffects);
    expect(acceptEffects.some((e) => e.type === 'setObjective')).toBe(true);
    // Bascule 2 : la victoire sur la cogue met l’objectif à jour.
    const cogue = project.find((s) => s.id === 'ls-abordage-cogue')!;
    const cogueOnVictory: Effect[] = [];
    walkFlow(cogue.encounters[0].onVictory, cogueOnVictory);
    expect(cogueOnVictory.some((e) => e.type === 'setObjective')).toBe(true);
    // Bascule 3 : l’arrivée à Erengrad (trigger) pose l’objectif d’escale.
    const erengrad = project.find((s) => s.id === 'ls-quai-erengrad')!;
    const trigEffects: Effect[] = [];
    for (const t of erengrad.triggers) walkFlow(t.flow, trigEffects);
    expect(trigEffects.some((e) => e.type === 'setObjective')).toBe(true);
    // Bascule 4 : reprendre la mer vers Salzenmund pose l’objectif de retour.
    const depart = erengrad.entities.find((e) => e.interact?.flow && /Reprendre la mer/.test(e.label ?? ''))!;
    const departEffects: Effect[] = [];
    walkFlow(depart.interact!.flow, departEffects);
    expect(departEffects.some((e) => e.type === 'setObjective')).toBe(true);
    // Épilogue : la pile est VIDÉE (clearObjective sans id).
    const clears = allEffects().filter((e): e is Extract<Effect, { type: 'clearObjective' }> => e.type === 'clearObjective');
    expect(clears.length).toBeGreaterThan(0);
    expect(clears.some((e) => e.id == null)).toBe(true);
  });

  it('REDDITION (#215) : enc-cogue porte woundsThreshold sur la coque « cogue » à mi-Blessures', () => {
    const cogue = project.find((s) => s.id === 'ls-abordage-cogue')!;
    const vc = cogue.encounters.find((e) => e.id === 'enc-cogue')!.victoryCondition;
    expect(vc, 'victoryCondition câblée sur enc-cogue').toBeTruthy();
    expect(vc).toEqual({ type: 'woundsThreshold', targetId: 'cogue', belowPercent: 50 });
    // targetId référence une VRAIE entité-coque de la scène.
    expect(cogue.entities.some((e) => e.id === 'cogue')).toBe(true);
  });

  it('REDDITION (#215/#237) : enc-olg porte woundsThreshold sur la coque « serpent-de-sel » — le texte de pavillon devient VRAI', () => {
    const olg = project.find((s) => s.id === 'ls-abordage-olg')!;
    const vc = olg.encounters.find((e) => e.id === 'enc-olg')!.victoryCondition;
    expect(vc, 'victoryCondition câblée sur enc-olg (le trou du #237)').toBeTruthy();
    expect(vc).toEqual({ type: 'woundsThreshold', targetId: 'serpent-de-sel', belowPercent: 50 });
    expect(olg.entities.some((e) => e.id === 'serpent-de-sel')).toBe(true);
  });

  it('ROUTAGE (#237) : les DEUX embuscades RENDENT AU VOYAGE (aucune transition en dur dans leur onVictory)', () => {
    for (const [sceneId, encId] of [['ls-abordage-cogue', 'enc-cogue'], ['ls-abordage-olg', 'enc-olg']] as const) {
      const enc = project.find((s) => s.id === sceneId)!.encounters.find((e) => e.id === encId)!;
      const eff: Effect[] = [];
      walkFlow(enc.onVictory, eff);
      // Une transition en dur court-circuiterait le sens du voyage (bug #237 : Olg → épilogue à l'aller).
      expect(eff.some((e) => e.type === 'transition'), `${encId} ne doit pas transitionner en dur`).toBe(false);
    }
  });

  it('ÉPILOGUE (#237) : joué à l’ARRIVÉE de RETOUR à Salzenmund, gaté par la livraison du fret (ls_fret_livre)', () => {
    // Le fret est LIVRÉ en atteignant Erengrad (trigger d'arrivée pose ls_fret_livre).
    const erengrad = project.find((s) => s.id === 'ls-quai-erengrad')!;
    const setsFret = erengrad.triggers.some((t) => {
      const eff: Effect[] = []; walkFlow(t.flow, eff);
      return eff.some((e) => e.type === 'setFlag' && e.flag === 'ls_fret_livre');
    });
    expect(setsFret, 'l’arrivée à Erengrad pose ls_fret_livre').toBe(true);
    // Au quai de Salzenmund, un trigger d'arrivée GATÉ par ls_fret_livre bascule vers l'épilogue — au DÉPART
    // (flag absent) il ne se déclenche pas : le même quai sert l'ouverture et la clôture.
    const salz = project.find((s) => s.id === 'ls-quai-salzenmund')!;
    const epilogueTrig = salz.triggers.find((t) => {
      const eff: Effect[] = []; walkFlow(t.flow, eff);
      return eff.some((e) => e.type === 'transition' && e.scene === 'ls-epilogue-salzenmund');
    });
    expect(epilogueTrig, 'trigger d’épilogue sur le quai de Salzenmund').toBeTruthy();
    expect(epilogueTrig!.when).toEqual({ kind: 'flag', expr: 'ls_fret_livre' });
    expect(epilogueTrig!.once).toBe(true);
  });

  it('DÉMASQUAGE de Kramer (#233) : la réussite d’Intuition à la nuit du chat lève le sabotage (adjustVessel saboteurDR 0)', () => {
    const erengrad = project.find((s) => s.id === 'ls-quai-erengrad')!;
    const nc = erengrad.dialogues.find((d) => d.id === 'dlg-kramer-nuit-du-chat')!;
    const intuition = nc.nodes[0].choices.find((c) => c.flow?.kind === 'test')!;
    const succ: Effect[] = [];
    walkFlow((intuition.flow as any).success, succ);
    const patch = succ.find((e): e is Extract<Effect, { type: 'adjustVessel' }> => e.type === 'adjustVessel');
    expect(patch, 'adjustVessel posé sur la branche de réussite').toBeTruthy();
    expect(patch!.saboteurDR).toBe(0);
    // Le dénouement est VISIBLE au moment (modale document), pas seulement au journal.
    expect(succ.some((e) => e.type === 'document')).toBe(true);
  });

  it('les DEUX instances de Kramer partagent la MÊME apparence (même personnage, id STABLE)', () => {
    const quai = project.find((s) => s.id === 'ls-quai-salzenmund')!.entities.find((e) => e.id === 'kramer')!;
    const erengrad = project.find((s) => s.id === 'ls-quai-erengrad')!.entities.find((e) => e.id === 'kramer-erengrad')!;
    expect(quai.appearance).toBeTruthy();
    expect(quai.appearance).toEqual(erengrad.appearance);
    expect(quai.appearance!.tenue).toBe('marchand');
    expect(quai.appearance!.species).toBe('humains-reiklander');
  });

  it('chaque combat enrôlé spawn sur une case MARCHABLE de la carte (footprint des coques compris)', () => {
    const bad: string[] = [];
    for (const sc of project)
      for (const e of enrolledEntities(sc)) {
        const { x, y } = e.pos;
        const inBounds = x >= 0 && y >= 0 && x < sc.dimensions.w && y < sc.dimensions.h;
        if (!inBounds) bad.push(`${sc.id}:${e.id}@(${x},${y})`);
      }
    expect(bad).toEqual([]);
  });
});
