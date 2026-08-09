/**
 * Jalon 5 — Sauvegarde/chargement de partie : snapshot zéro-maintenance (clés de données de
 * getInitialState), localStorage 3 slots, export/import JSON, refus en combat.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { useGame } from './store';
import { readSlot, deleteSlot, exportSave, importSave, listSaves, saveToSlot, migrateSave, readFutureBackup, MIGRATIONS, SAVE_VERSION, type SaveGame } from './saves';
import { migrateDoc } from './migrateDoc';
import { rule, setRule, loadRuleOverrides } from '../engine/policy';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { testScene } from '../scenes/test-fixture';

/** Fake Storage minimal — l'environnement de test est `node` (pas de localStorage). */
function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  } as Storage;
}

describe('Sauvegarde / chargement (Jalon 5)', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
    vi.useFakeTimers();
    vi.clearAllTimers();
    deleteSlot(1); deleteSlot(2); deleteSlot(3);
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Sauvé', rng: makeRNG(4) });
    useGame.setState({ party: [hero], battle: null });
    useGame.getState().startScene(testScene);
    vi.clearAllTimers();
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); deleteSlot(1); deleteSlot(2); deleteSlot(3); loadRuleOverrides({}); });

  it('saveGame → slot rempli avec métadonnées (scène, horloge) ; listSaves le voit', () => {
    useGame.setState({ flags: { ...useGame.getState().flags, 'drapeau-test': true } });
    expect(useGame.getState().saveGame(1)).toBe(true);
    const s = readSlot(1)!;
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.sceneLabel).toBe(testScene.nom); // le NOM de la scène, pas son id
    expect(s.sceneLabel.length).toBeGreaterThan(0);
    expect((s.data.flags as Record<string, unknown>)['drapeau-test']).toBe(true);
    const metas = listSaves();
    expect(metas[0]?.slot).toBe(1);
    expect(metas[1]).toBeNull();
  });

  it('round-trip : muter → sauver → réinitialiser → charger restaure données + actions vivantes', () => {
    useGame.setState({ flags: { ...useGame.getState().flags, 'quete-x': true }, gameTime: 12345, journal: ['ligne de test'] });
    useGame.getState().party[0].wounds.current = 3;
    expect(useGame.getState().saveGame(2)).toBe(true);
    // « Nouvelle partie » : tout est réinitialisé.
    useGame.setState({ party: [], flags: {}, gameTime: 0, journal: [], scene: null, screen: 'menu' });
    expect(useGame.getState().loadGame(2)).toBe(true);
    const after = useGame.getState();
    expect(after.flags['quete-x']).toBe(true);
    expect(after.gameTime).toBe(12345);
    expect(after.party[0]?.label).toBe('Sauvé');
    expect(after.party[0]?.wounds.current).toBe(3);
    expect(after.scene?.id).toBe(testScene.id);
    expect(after.screen).toBe('campaign');
    after.log('le store répond'); // les actions n'ont pas été écrasées par le merge
    const j = useGame.getState().journal;
    expect(j[j.length - 1]).toBe('le store répond');
  });

  it('MIGRATION v1→v2 : une save d’AVANT la carte de campagne (worldMap vide) ne l’écrase pas au chargement', () => {
    // Recette « la map n’apparaît pas » : l’ancienne campagne sauvait worldMap {places: []} ;
    // au chargement, cette carte vide écrasait celle du projet courant → plus de bouton 🗺️.
    // Écrit une save v1 BRUTE (avant migration) dans le slot — simule une vraie relecture localStorage.
    expect(useGame.getState().saveGame(2)).toBe(true);
    const v2 = readSlot(2)!;
    const v1 = { ...v2, version: 1, data: { ...v2.data, worldMap: { id: 'campagne-carte', nom: 'Carte du monde', places: [], routes: [] } } };
    saveToSlot(2, v1 as unknown as SaveGame); // save v1 BRUTE (avant migration), telle qu'écrite en localStorage
    expect(useGame.getState().loadGame(2)).toBe(true);
    const wm = useGame.getState().worldMap!;
    expect(wm.places.length).toBeGreaterThan(0); // la carte de CAMPAGNE est conservée
    // … et une save v1 SANS worldMap du tout (clé absente) garde aussi la carte de base.
    const v1NoMap = { ...v1, data: { ...v1.data } };
    delete (v1NoMap.data as Record<string, unknown>).worldMap;
    saveToSlot(2, v1NoMap as unknown as SaveGame);
    expect(useGame.getState().loadGame(2)).toBe(true);
    expect(useGame.getState().worldMap?.places.length).toBeGreaterThan(0);
  });

  it('règles maison : la save porte les surcharges et les restaure au chargement (portabilité)', () => {
    const id = 'test-critiques-doubles'; // un flag optionnel quelconque
    loadRuleOverrides({}); // baseline propre
    const def = rule(id) as boolean; // défaut RAW du registre
    setRule(id, !def); // l'utilisateur active la règle maison
    expect(useGame.getState().saveGame(1)).toBe(true);
    expect(readSlot(1)!.rules?.[id]).toBe(!def); // la surcharge voyage DANS la save
    loadRuleOverrides({}); // « autre machine » : aucune règle maison locale → défaut
    expect(rule(id)).toBe(def);
    expect(useGame.getState().loadGame(1)).toBe(true);
    expect(rule(id)).toBe(!def); // … restaurée par le chargement
  });

  it('en combat : sauvegarde refusée, le slot reste vide', () => {
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    expect(useGame.getState().saveGame(1)).toBe(false);
    expect(readSlot(1)).toBeNull();
  });

  it('export / import : round-trip JSON validé ; version inconnue rejetée', () => {
    expect(useGame.getState().saveGame(3)).toBe(true);
    const json = exportSave(readSlot(3)!);
    const re = importSave(json);
    expect(re?.sceneLabel).toBe(readSlot(3)!.sceneLabel);
    expect(importSave('{pas du json')).toBeNull();
    expect(importSave(JSON.stringify({ version: 999, savedAt: 'x', data: {} }))).toBeNull();
    // importGame applique la save importée à l'état.
    useGame.setState({ flags: {}, scene: null, screen: 'menu' });
    expect(useGame.getState().importGame(json)).toBe(true);
    expect(useGame.getState().scene?.id).toBe(testScene.id);
  });
});

describe('migrateSave — point d’upgrade unique (un bump de version ne jette plus les saves)', () => {
  const cur = { version: SAVE_VERSION, savedAt: '2026', sceneLabel: 's', gameTime: 0, data: {} };
  it('save à la version courante : passe telle quelle (aucune migration à appliquer)', () => {
    expect(migrateSave(cur)).toEqual(cur);
  });
  it('version FUTURE (plus récente que l’app) → null : on ne devine pas une structure inconnue', () => {
    expect(migrateSave({ ...cur, version: SAVE_VERSION + 1 })).toBeNull();
  });
  it('version antérieure sans migrateur → null (refus net plutôt que corruption silencieuse)', () => {
    expect(migrateSave({ ...cur, version: 0 })).toBeNull();
  });
  it('objet malformé / version absente → null', () => {
    expect(migrateSave(null)).toBeNull();
    expect(migrateSave('pas un objet')).toBeNull();
    expect(migrateSave({ savedAt: 'x', data: {} })).toBeNull(); // version absente
  });
});

describe('Golden saves — fixtures réelles (__fixtures__/saves/) + cliquet de migration', () => {
  const FIXTURES_DIR = new URL('./__fixtures__/saves/', import.meta.url);
  const fixtureFiles = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.json'));

  it('au moins une fixture existe (le cliquet ne peut pas passer trivialement)', () => {
    expect(fixtureFiles.length).toBeGreaterThan(0);
  });

  for (const file of fixtureFiles) {
    it(`fixture ${file} : migre via migrateDoc puis charge (applyLoadedSave) sans erreur`, () => {
      const raw = JSON.parse(readFileSync(new URL(file, FIXTURES_DIR), 'utf-8')) as unknown;
      const migrated = migrateSave(raw);
      expect(migrated).not.toBeNull();
      expect(migrated!.version).toBe(SAVE_VERSION);
      useGame.setState({ party: [], flags: {}, gameTime: 0, journal: [], scene: null, screen: 'menu' });
      expect(useGame.getState().loadGame instanceof Function).toBe(true);
      // Charge la save déjà migrée directement dans le slot (contourne l'écriture disque, exerce
      // le MÊME chemin `readSlot` → `migrateSave` → `applyLoadedSave` que loadGame(slot)).
      expect(saveToSlot(1, migrated!)).toBe(true);
      expect(useGame.getState().loadGame(1)).toBe(true);
      // La preuve motivant la migration v1→v2 : le worldMap vide de la fixture v1 (format pré-migration,
      // conservée pour le cliquet) ne subsiste pas — la carte de campagne (non vide) de la base est restaurée.
      expect(useGame.getState().worldMap?.places.length).toBeGreaterThan(0);
    });
  }

  // #598 — MIGRATIONS[7] : le renommage `name`→`id` des instances keyées par id. La fixture v7 porte
  // 2 États et 1 maladie au FORMAT v7 ; sans le migrateur ils se rechargeraient avec `id: undefined`
  // (l'État/la maladie disparaîtrait SILENCIEUSEMENT). On l'assère sur la DONNÉE migrée, pas sur un
  // simple « ça charge » — le test générique ci-dessus resterait vert avec un migrateur vide.
  it('MIGRATIONS[7] (#598) : conditions[].name et diseases[].name deviennent .id, valeur conservée', () => {
    const raw = JSON.parse(readFileSync(new URL('v7-etats-condition-name.json', FIXTURES_DIR), 'utf-8')) as unknown;
    const migrated = migrateSave(raw);
    expect(migrated).not.toBeNull();
    const hero = (migrated!.data as { party: Record<string, unknown>[] }).party[0];
    const conds = hero.conditions as Record<string, unknown>[];
    const dzs = hero.diseases as Record<string, unknown>[];
    expect(conds.map((c) => c.id)).toEqual(['sonne', 'empetre']);
    expect(conds.map((c) => c.value)).toEqual([2, 1]);
    expect(conds.some((c) => 'name' in c)).toBe(false);
    expect(dzs.map((d) => d.id)).toEqual(['crampes-abdominales']);
    expect(dzs.some((d) => 'name' in d)).toBe(false);
  });

  // #608 Lot 6 — MIGRATIONS[9] : renommage `name`→`label` des porteurs de LIBELLÉ SÉRIALISÉS restants
  // (CampaignVessel, CustomStatblock, MedicNpc, ScheduledRespawn.caster, PendingVictory.defeated[],
  // PendingTest.candidates[], MassBattleArmy). Assertion sur la DONNÉE migrée (comme MIGRATIONS[7]
  // ci-dessus) : un migrateur vide laisserait le test générique `fixture ${file}` vert quand même.
  it('MIGRATIONS[9] (#608) : name→label sur vessel/statblock/medic/respawn/victoire/candidats/armées, name absent partout', () => {
    const raw = JSON.parse(readFileSync(new URL('v9-lot6-noms-name-label.json', FIXTURES_DIR), 'utf-8')) as unknown;
    const migrated = migrateSave(raw);
    expect(migrated).not.toBeNull();
    expect(migrated!.version).toBe(SAVE_VERSION);
    const data = migrated!.data as Record<string, unknown>;

    const vessel = data.vessel as Record<string, unknown>;
    expect(vessel.label).toBe('Le Cormoran');
    expect('name' in vessel).toBe(false);

    const medic = data.medic as { npc: Record<string, unknown> };
    expect(medic.npc.label).toBe('Reinholt le Ranger');
    expect('name' in medic.npc).toBe(false);

    const massBattle = data.massBattle as { ally: Record<string, unknown>; enemy: Record<string, unknown> };
    expect(massBattle.ally.label).toBe('Ost du Reikland');
    expect(massBattle.enemy.label).toBe('Horde de Khorne');
    expect('name' in massBattle.ally).toBe(false);
    expect('name' in massBattle.enemy).toBe(false);

    const pendingVictory = data.pendingVictory as { defeated: Record<string, unknown>[] };
    expect(pendingVictory.defeated[0].label).toBe('Maraudeur du Chaos');
    expect('name' in pendingVictory.defeated[0]).toBe(false);

    const pendingTest = data.pendingTest as { candidates: Record<string, unknown>[] };
    expect(pendingTest.candidates[0].label).toBe('Gunnar Fils-de-Ranulf');
    expect('name' in pendingTest.candidates[0]).toBe(false);

    const scheduled = data.scheduledEffects as { respawn: { caster: Record<string, unknown> } }[];
    expect(scheduled[0].respawn.caster.label).toBe('Gardien éternel');
    expect('name' in scheduled[0].respawn.caster).toBe(false);

    const scene = data.scene as { entities: { statblock: Record<string, unknown> }[] };
    expect(scene.entities[0].statblock.label).toBe('Sorcier mutant');
    expect('name' in scene.entities[0].statblock).toBe(false);
  });

  // #608 Lot B — MIGRATIONS[10] : renommage `name`→`label` des 2 DERNIERS porteurs de LIBELLÉ
  // SÉRIALISÉS — `pendingCampaign` (campagne choisie au menu) et le `SceneOp` `setVessel` d'un
  // dialogue ENCORE non déclenché de la scène vivante. Assertion sur la DONNÉE migrée (comme
  // MIGRATIONS[7]/[9] ci-dessus).
  it('MIGRATIONS[10] (#608 Lot B) : name→label sur pendingCampaign et SceneOp setVessel, name absent partout', () => {
    const raw = JSON.parse(readFileSync(new URL('v10-lot-b-noms-name-label.json', FIXTURES_DIR), 'utf-8')) as unknown;
    const migrated = migrateSave(raw);
    expect(migrated).not.toBeNull();
    expect(migrated!.version).toBe(SAVE_VERSION);
    const data = migrated!.data as Record<string, unknown>;

    const pendingCampaign = data.pendingCampaign as Record<string, unknown>;
    expect(pendingCampaign.label).toBe('Le Loup et la Saumure');
    expect('name' in pendingCampaign).toBe(false);

    const scene = data.scene as { dialogues: { nodes: { choices: { flow: { steps: { effect: Record<string, unknown> }[] } }[] }[] }[] };
    const effect = scene.dialogues[0].nodes[0].choices[0].flow.steps[0].effect;
    expect(effect.label).toBe('Le Grimm');
    expect('name' in effect).toBe(false);
  });

  // #608 (ref #603) — MIGRATIONS[11] : renommage du `name` d'un `GameOp` SÉRIALISÉ — `id` pour
  // `condition`/`removeCondition` (index d'État), `label` pour `grantWeapon`/`grantNaturalWeapon`
  // (nom de l'arme invoquée). La fixture v11 porte les DEUX vocabulaires dans `activeEffects[].
  // opsPerRound` — sans le migrateur, un État « En flammes » cesserait de se ré-appliquer et l'arme
  // invoquée perdrait son nom, en silence.
  it('MIGRATIONS[11] (#608) : GameOp condition/grantWeapon.name devient .id/.label, name absent partout', () => {
    const raw = JSON.parse(readFileSync(new URL('v11-gameop-name-id-label.json', FIXTURES_DIR), 'utf-8')) as unknown;
    const migrated = migrateSave(raw);
    expect(migrated).not.toBeNull();
    expect(migrated!.version).toBe(SAVE_VERSION);
    const hero = (migrated!.data as { party: Record<string, unknown>[] }).party[0];
    const effects = hero.activeEffects as { opsPerRound: Record<string, unknown>[] }[];
    const condOp = effects[0].opsPerRound[0];
    expect(condOp.id).toBe('en-flammes');
    expect('name' in condOp).toBe(false);
    const weaponOp = effects[1].opsPerRound[0];
    expect(weaponOp.label).toBe('Arme aethyrique');
    expect('name' in weaponOp).toBe(false);
  });

  // #531 SOCLE POSSESSIONS §8 — MIGRATIONS[12] : la Bourse de GROUPE (`money` top-level) devient une
  // Bourse PERSONNELLE (`ItemInstance.money` de l'instance `bourse`) rehébergée sur le DOYEN (1er héros).
  // Assertion sur la DONNÉE migrée (comme MIGRATIONS[7]/[9]/[11]) : un migrateur vide laisserait le test
  // générique `fixture ${file}` vert quand même.
  it('MIGRATIONS[12] (#531) : money de groupe rehébergé sur la Bourse du doyen, clé money absente', () => {
    const raw = JSON.parse(readFileSync(new URL('v12-bourse-groupe-doyen.json', FIXTURES_DIR), 'utf-8')) as unknown;
    const migrated = migrateSave(raw);
    expect(migrated).not.toBeNull();
    expect(migrated!.version).toBe(SAVE_VERSION);
    const data = migrated!.data as Record<string, unknown>;
    expect('money' in data).toBe(false);
    const party = data.party as { id: string; items: { trappingId?: string; money?: { gold: number; silver: number; brass: number } }[] }[];
    const doyenBourse = party[0].items.find((i) => i.trappingId === 'bourse');
    expect(doyenBourse?.money).toEqual({ gold: 2, silver: 3, brass: 4 });
    const cadetBourse = party[1].items.find((i) => i.trappingId === 'bourse');
    expect(cadetBourse).toBeUndefined();
  });

  // #668 — MIGRATIONS[13] : `Objective.deadline` (compte à rebours) est ADDITIF-optionnel, aucun
  // objectif existant à transformer — la fixture v13 porte un objectif v13 réel (SANS deadline) qui
  // doit migrer/charger sans erreur, `deadline` restant `undefined`.
  it('MIGRATIONS[13] (#668) : objectif sans échéance migre tel quel, deadline reste undefined', () => {
    const raw = JSON.parse(readFileSync(new URL('v13-objectif-sans-echeance.json', FIXTURES_DIR), 'utf-8')) as unknown;
    const migrated = migrateSave(raw);
    expect(migrated).not.toBeNull();
    expect(migrated!.version).toBe(SAVE_VERSION);
    const data = migrated!.data as Record<string, unknown>;
    const objectives = data.objectives as { id: string; text: string; deadline?: number }[];
    expect(objectives).toEqual([{ id: 'obj-quete', text: 'Retrouver le Grimm' }]);
    expect(objectives[0].deadline).toBeUndefined();
  });

  // #766 — MIGRATIONS[14] : `campaignDoc` (snapshot du paquet de campagne) est ADDITIF ; une save v14
  // legacy n'en a pas → la migration l'injecte à `null` (comportement pré-#766 : aucune re-registration).
  it('MIGRATIONS[14] (#766) : save legacy sans campaignDoc migre → campaignDoc = null', () => {
    const raw = JSON.parse(readFileSync(new URL('v14-legacy-sans-campaigndoc.json', FIXTURES_DIR), 'utf-8')) as unknown;
    expect((raw as { data: Record<string, unknown> }).data).not.toHaveProperty('campaignDoc'); // la fixture v14 n'a PAS le champ
    const migrated = migrateSave(raw);
    expect(migrated).not.toBeNull();
    expect(migrated!.version).toBe(SAVE_VERSION);
    expect((migrated!.data as Record<string, unknown>).campaignDoc).toBeNull();
  });

  // #766 — golden v15 : une save de campagne multi-scènes porte un `campaignDoc` peuplé qui survit
  // au round-trip de sérialisation (scènes + carte + narratif embarqués).
  it('golden v15 : campaignDoc peuplé survit au round-trip (scènes + narratif embarqués)', () => {
    const raw = JSON.parse(readFileSync(new URL('v15-campagne-snapshot.json', FIXTURES_DIR), 'utf-8')) as unknown;
    const migrated = migrateSave(raw);
    expect(migrated).not.toBeNull();
    const doc = (migrated!.data as Record<string, unknown>).campaignDoc as { scenes: { id: string }[]; narratif: { objets: { id: string }[] }; startSceneId: string } | null;
    expect(doc).not.toBeNull();
    expect(doc!.scenes.map((s) => s.id)).toEqual(['scene-a', 'scene-b']);
    expect(doc!.startSceneId).toBe('scene-a');
    expect(doc!.narratif.objets.map((o) => o.id)).toContain('snap-lame-maudite');
  });

  // #942 L8 — MIGRATIONS[15] : la file `pendingReveals` d'une save v15 REDEVIENT des étapes
  // d'affichage de la cascade. Sans le migrateur, `snapshotSave` (qui itère les clés de l'état
  // courant, sans la file) ferait DISPARAÎTRE la révélation en attente au chargement, en silence.
  // Assertion sur la DONNÉE migrée PUIS sur l'état CHARGÉ (chemin réel `loadGame`).
  it('MIGRATIONS[15] (#942 L8) : une révélation en file devient une étape de cascade affichable', () => {
    const raw = JSON.parse(readFileSync(new URL('v15-revelations-en-file.json', FIXTURES_DIR), 'utf-8')) as unknown;
    expect(((raw as { data: Record<string, unknown> }).data.pendingReveals as unknown[]).length).toBe(1); // la fixture v15 porte bien la file
    const migrated = migrateSave(raw);
    expect(migrated).not.toBeNull();
    expect(migrated!.version).toBe(SAVE_VERSION);
    const data = migrated!.data as Record<string, unknown>;
    expect('pendingReveals' in data).toBe(false); // la file n'existe plus dans le modèle
    const cascade = data.pendingCascade as { purpose: string; cursor: number; participants: Record<string, unknown>[] };
    expect(cascade.purpose).toBe('affichage');
    expect(cascade.cursor).toBe(0);
    expect(cascade.participants).toHaveLength(1);
    const step = cascade.participants[0] as { kind: string; actorId?: string; autoCloseMs?: number; reveal?: { title: string } };
    expect(step.kind).toBe('mutation');
    expect(step.reveal?.title).toBe('Mutation — Écailles');
    expect(step.actorId).toBe('pregen-101'); // le CONCERNÉ pilote la modale (et porte son portrait)
    expect(step.autoCloseMs).toBe(9000); // gravité 'grave' → cadence de fermeture longue
    // Chemin RÉEL : la save migrée se charge et l'étape est celle que la fenêtre affichera.
    expect(saveToSlot(1, migrated!)).toBe(true);
    expect(useGame.getState().loadGame(1)).toBe(true);
    expect(useGame.getState().pendingCascade!.participants[0].reveal?.title).toBe('Mutation — Écailles');
  });

  // #1117 L1/L2 — MIGRATIONS[16] : la Psychologie n'est plus une étape PAR HÉROS mais une BANDE dont
  // les héros sont les RANGÉES. Les appliers `encounterPsych`/`combatPsych` exigent `step.participants`
  // et renoncent sans lui : une save v16 prise EN PLEINE cascade psy rechargerait une étape MONO dont le
  // Test se lance et la cascade avance, la Peur n'étant JAMAIS posée ni journalisée.
  it('MIGRATIONS[16] (#1117) : une étape psy MONO en vol devient une bande d’UNE rangée (jet descendu, champs mono retirés)', () => {
    const raw = JSON.parse(readFileSync(new URL('v16-cascade-psy-mono.json', FIXTURES_DIR), 'utf-8')) as unknown;
    const legacyStep = ((raw as { data: Record<string, unknown> }).data.pendingCascade as { participants: Record<string, unknown>[] }).participants[0];
    expect(legacyStep.actorId).toBe('h1'); // la fixture v16 porte bien la forme MONO…
    expect(legacyStep.participants).toBeUndefined(); // … sans aucune rangée
    const migrated = migrateSave(raw);
    expect(migrated).not.toBeNull();
    expect(migrated!.version).toBe(SAVE_VERSION);
    const cascade = (migrated!.data as Record<string, unknown>).pendingCascade as { participants: Record<string, unknown>[] };
    const band = cascade.participants[0];
    expect(band.kind).toBe('encounterPsych');
    expect(band.aggregate).toBe('none');
    expect((band.encounterPsych as { kind: string; indice: number }).kind).toBe('peur');
    // Le jet vit sur la RANGÉE ; l'étape n'en porte plus rien (contrat de bande).
    for (const mono of ['actorId', 'rollLabel', 'base', 'target', 'result']) expect(mono in band).toBe(false);
    const rows = band.participants as Record<string, unknown>[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 'h1', interactive: true, label: 'Calme', base: 29, target: 29, result: null });
  });

  it('MIGRATIONS[16] (#1117) : la rangée migrée RÉSOUT — le Test de Calme raté POSE la Peur (l’applier ne renonce plus)', () => {
    const raw = JSON.parse(readFileSync(new URL('v16-cascade-psy-mono.json', FIXTURES_DIR), 'utf-8')) as unknown;
    const migrated = migrateSave(raw)!;
    expect(saveToSlot(1, migrated)).toBe(true);
    expect(useGame.getState().loadGame(1)).toBe(true);
    const pc = useGame.getState().pendingCascade!;
    const band = pc.participants[0];
    // Jet POSÉ (déterministe) : Calme raté d'un échec normal.
    const rows = (band.participants ?? []).map((p) => ({ ...p, result: { roll: 95, target: p.target, sl: -2, success: false } }));
    useGame.setState({ pendingCascade: { ...pc, participants: [{ ...band, participants: rows }] } });
    useGame.getState().cascadeNext();
    const hero = useGame.getState().party.find((h) => h.id === 'h1')!;
    const peur = (hero.psychState ?? []).find((p) => p.type === 'peur' && p.sourceId === 'scripted:Un spectre hurlant');
    expect(peur?.indice).toBe(2);
    expect(peur?.calmeDR).toBe(0); // Test raté : la Peur n'est pas surmontée
    expect(useGame.getState().journal.some((l) => l.includes('Timoré'))).toBe(true); // conséquence journalisée
    expect(useGame.getState().pendingCascade).toBeNull();
  });

  // MIGRATIONS[16] — l'AUTRE porteur d'étapes psy sérialisé par `snapshotSave` : la pile des cascades
  // SUSPENDUES. Et la charge de RANGÉE de la Psychologie de COMBAT (Test étendu de Peur) : le DR déjà
  // cumulé et l'allègement « Sans Peur » quittent la déclaration d'étape pour le `meta` de la rangée,
  // la barre de DR cumulé quitte le `meta` d'étape pour la rangée.
  it('MIGRATIONS[16] : les cascades SUSPENDUES sont migrées aussi ; prevDR/sansPeur et extendedDr* descendent sur la rangée', () => {
    const raw = {
      version: 16, savedAt: '2026', sceneLabel: 's', gameTime: 0,
      data: {
        pendingCascade: null,
        suspendedCascades: [{
          title: 'Sang-froid', purpose: 'combat', cursor: 0, log: [],
          participants: [{
            id: 'psych-h1', kind: 'combatPsych', actorId: 'h1', rollLabel: 'Calme', base: 35, target: 55,
            label: 'Peur 3 · Sans Peur (+20)', immune: true,
            combatPsych: { kind: 'peur', sourceId: 'e1', sourceName: 'Bête', indice: 3, prevDR: 1, sansPeur: true },
            meta: { extendedDrTarget: 3, extendedDrDone: 1 },
          }],
        }],
      },
    };
    const migrated = migrateSave(raw);
    expect(migrated!.version).toBe(SAVE_VERSION);
    const band = ((migrated!.data as Record<string, unknown>).suspendedCascades as { participants: Record<string, unknown>[] }[])[0].participants[0];
    expect(band.combatPsych).toEqual({ kind: 'peur', sourceId: 'e1', sourceName: 'Bête', indice: 3 });
    expect('meta' in band).toBe(false); // le `meta` d'étape ne portait QUE la barre de DR de la rangée
    const row = (band.participants as Record<string, unknown>[])[0];
    expect(row).toMatchObject({ id: 'h1', base: 35, target: 55, immune: true, meta: { prevDR: 1, sansPeur: true }, extendedDrTarget: 3, extendedDrDone: 1 });
    expect('immune' in band).toBe(false); // la Détermination est jouée PAR RANGÉE
  });

  // MIGRATIONS[16] — trois propriétés qu'aucun des tests ci-dessus ne mesure : une save ANCIENNE traverse
  // TOUTE la chaîne (v13→v17) avec sa cascade psy en vol ; une étape SUR-CHARGÉE (jet posé, influences
  // dépensées, `meta` mixte) ne perd RIEN au passage — chaque champ atterrit sur l'étape, la rangée ou
  // le `meta` de rangée ; et le migrateur est IDEMPOTENT (une étape déjà en bande n'est jamais re-bandifiée).
  it('MIGRATIONS[16] : chaîne v13→v17 sur une étape SUR-CHARGÉE — rien de perdu, no-op sans actorId, idempotent', () => {
    const legacyStep = () => ({
      id: 'psych-h1', kind: 'combatPsych', actorId: 'h1', icon: 'flag/fear', rollLabel: 'Calme',
      base: 35, target: 55, label: 'Peur 3 · Sans Peur (+20)', menace: 'Peur', committed: true,
      mods: [{ label: 'Brisé', value: -10 }], clamped: 99, difficulty: 'accessible',
      result: { roll: 12, target: 55, sl: 4, success: true },
      rerolled: true, forced: true, fixed: true, immune: true, outcome: [{ text: 'ligne' }],
      combatPsych: { kind: 'peur', sourceId: 'e1', sourceName: 'Bête', indice: 3, prevDR: 1, sansPeur: true },
      stake: { key: { dataset: 'combat', kind: 'combatPsych', entryId: 'peur' }, values: { indice: 3 } },
      meta: { extendedDrTarget: 3, extendedDrDone: 1, sourceKind: 'trait', sourceEntityId: 'peur' },
    });
    const doc = (version: number, participants: unknown[]) => ({
      version, savedAt: '2026', sceneLabel: 's', gameTime: 0,
      data: { pendingCascade: { title: 'T', purpose: 'combat', cursor: 0, log: [], participants }, suspendedCascades: [] },
    });

    // CHAÎNE COMPLÈTE : une save v13 traverse MIGRATIONS[13..16] (`migrateSave`), pas seulement [16].
    const migrated = migrateSave(doc(13, [legacyStep()]))!;
    expect(migrated.version).toBe(SAVE_VERSION);
    const step = (migrated.data.pendingCascade as { participants: Record<string, unknown>[] }).participants[0];
    const row = (step.participants as Record<string, unknown>[])[0];
    expect(row.id).toBe('h1'); // `actorId` d'étape → porteur de la RANGÉE
    expect(row.label).toBe('Calme'); // `rollLabel` d'étape → libellé de ligne de la RANGÉE
    // Aucun champ ABANDONNÉ : tout ce que portait l'étape mono se retrouve sur l'étape, la rangée, ou son `meta`.
    const logés = new Set([...Object.keys(step), ...Object.keys(row), ...Object.keys(row.meta as object), 'actorId', 'rollLabel']);
    expect(Object.keys(legacyStep()).filter((k) => !logés.has(k))).toEqual([]);
    // Ce qui reste à l'ÉTAPE = ce qui est COMMUN à la bande (identité, présentation, enjeu, déclaration) ;
    // le `meta` d'étape garde ses clés NON-rangée (source de l'effet), délestées de la barre de DR.
    expect(Object.keys(step).sort()).toEqual(['aggregate', 'combatPsych', 'committed', 'icon', 'id', 'interactive', 'kind', 'label', 'menace', 'meta', 'participants', 'stake']);
    expect(step.meta).toEqual({ sourceKind: 'trait', sourceEntityId: 'peur' });
    expect(row).toMatchObject({ result: { roll: 12, sl: 4, success: true }, rerolled: true, forced: true, fixed: true, immune: true, clamped: 99, difficulty: 'accessible' });

    // NO-OP défensif : sans `actorId`, aucune rangée n'est constructible — l'étape est laissée INTACTE
    // (patron tolérant `adoptLegacyReveals`), jamais mutilée à moitié.
    const sansActeur: Record<string, unknown> = legacyStep();
    delete sansActeur.actorId;
    const intacte = (MIGRATIONS[16](doc(16, [sansActeur])).data as { pendingCascade: { participants: Record<string, unknown>[] } }).pendingCascade.participants[0];
    expect(intacte.participants).toBeUndefined();
    expect(intacte).toMatchObject({ base: 35, target: 55, rollLabel: 'Calme' });

    // IDEMPOTENT : une étape DÉJÀ en bande retraverse le migrateur sans bouger (un `participants` présent
    // suffit à l'écarter — aucune rangée fantôme n'est ajoutée).
    const rejoué = (MIGRATIONS[16](doc(16, [JSON.parse(JSON.stringify(step))])).data as { pendingCascade: { participants: unknown[] } }).pendingCascade.participants[0];
    expect(rejoué).toEqual(step);
  });

  it('CLIQUET : chaque version 1..SAVE_VERSION-1 a AU MOINS une fixture ET une entrée MIGRATIONS — bump sans les deux = suite rouge', () => {
    for (let v = 1; v < SAVE_VERSION; v++) {
      expect(MIGRATIONS[v], `MIGRATIONS[${v}] manquante — un bump de SAVE_VERSION exige son migrateur`).toBeTypeOf('function');
      const hasFixture = fixtureFiles.some((f) => f.startsWith(`v${v}-`));
      expect(hasFixture, `aucune fixture v${v}-*.json — un bump de SAVE_VERSION exige sa fixture golden`).toBe(true);
    }
  });

  it('migrateDoc (primitive générique) réexpose EXACTEMENT la sémantique de migrateSave sur une fixture', () => {
    const raw = JSON.parse(readFileSync(new URL(fixtureFiles[0], FIXTURES_DIR), 'utf-8')) as unknown;
    const viaPrimitive = migrateDoc(raw, SAVE_VERSION, MIGRATIONS);
    const viaSaves = migrateSave(raw);
    expect(viaPrimitive).toEqual(viaSaves);
  });

  // Le filet de #311 (migration CharKey→slugs) : les 2 fixtures ci-dessous sont générées par le
  // VRAI chemin de sérialisation (`saveGame`, cf. `_generate.test.ts`) — un futur renommage de champ
  // sans migrateur les casse ici, avant de casser une vraie save de joueur.
  function loadFixture(name: string): SaveGame {
    const raw = JSON.parse(readFileSync(new URL(name, FIXTURES_DIR), 'utf-8')) as unknown;
    const migrated = migrateSave(raw);
    expect(migrated, `${name} : migration/validation refusée`).not.toBeNull();
    useGame.setState({ party: [], flags: {}, gameTime: 0, journal: [], scene: null, screen: 'menu' });
    expect(saveToSlot(1, migrated!)).toBe(true);
    expect(useGame.getState().loadGame(1)).toBe(true);
    return migrated!;
  }

  it('fixture voyage maritime : party jouable + vessel/plan cohérents + scène présente', () => {
    loadFixture('v2-voyage-maritime.json');
    const s = useGame.getState();
    expect(s.party.length).toBeGreaterThan(0);
    for (const hero of s.party) expect(hero.wounds.current).toBeGreaterThanOrEqual(0);
    expect(s.vessel).not.toBeNull();
    expect(s.vessel!.wounds!.current).toBeGreaterThan(0);
    expect(s.travelPlan).not.toBeNull();
    expect(s.travelPlan!.vehicle!.wounds.current).toBe(s.vessel!.wounds!.current); // #296 non-divergence
    expect(s.scene).not.toBeNull();
    expect(s.worldMap?.places.length).toBeGreaterThan(0);
  });

  it('fixture post-combat : roster complet jouable + scène/campagne présentes', () => {
    loadFixture('v2-post-combat-roster.json');
    const s = useGame.getState();
    expect(s.party.length).toBe(4);
    for (const hero of s.party) {
      expect(hero.wounds.current).toBeGreaterThan(0); // jouable, pas Hors combat
      expect(hero.wounds.current).toBeLessThanOrEqual(hero.wounds.max);
    }
    expect(s.battle).toBeNull(); // post-combat : plus de bataille suspendue
    expect(s.scene).not.toBeNull();
    expect(s.scene?.id).toBe('test-fixture');
  });

  // #275 Ronde 2 cran 3 — MIGRATIONS[3] (v3→v4) : voyage maritime EN VOL sous l'ancien mécanisme
  // (`sea.step` FSM + `pendingCrewTest.voyage`) — arbitrage SIMPLE accepté (décision e) : la migration
  // DROPPE l'état en vol (jamais ne le corrompt/duplique) plutôt que de reconstruire le point de reprise
  // exact — la journée reprend PROPREMENT au prochain `runSeaDay` (Test de Progression du jour).
  it('fixture v3 EN VOL (Test d’équipage de voyage ouvert, jour mi-parcours) : pendingCrewTest droppé, jour remis à son état de départ', () => {
    const migrated = loadFixture('v3-voyage-maritime-en-vol.json');
    const s = useGame.getState();
    expect(migrated.version).toBe(SAVE_VERSION);
    expect(s.pendingCrewTest).toBeNull(); // ancien Test de voyage — jamais réinjecté en combat
    const sea = s.travelPlan!.sea! as unknown as Record<string, unknown>;
    expect(sea.step).toBeUndefined(); // FSM mort — aucune trace du point de reprise périmé
    expect(sea.milesToday).toBe(0);
    expect(sea.sailsDown).toBe(false);
    expect(sea.lighthouseDR).toBe(0);
    expect(sea.entries).toEqual([]);
    // La traversée reste JOUABLE : un nouveau jour peut démarrer proprement depuis cet état.
    expect(s.travelPlan!.vehicle).toBeTruthy();
    expect(s.vessel).not.toBeNull();
  });

  // #327 lot C — MIGRATIONS[4] (v4→v5) : le convoi abstrait `caravanCargo` est MATÉRIALISÉ sur un porteur
  // réel (ici la bête de bât du groupe, encore un `ItemInstance` à cette version) et la clé disparaît —
  // plus de vrac de groupe hors porteur. La bascule bête/véhicule → `Possession` du registre (#615/#617/
  // #618) n'est PAS une migration de save (décision utilisateur, #617/#618 Lot 2 : « saves cassées OK ») —
  // la chaîne s'arrête à `SAVE_VERSION` (13), la mule reste un item de héros.
  it('fixture v4 convoi terrestre : caravanCargo rehébergé sur la mule (item de héros), pas de migration vers Possession', () => {
    loadFixture('v4-convoi-terrestre.json');
    const s = useGame.getState();
    expect((s as unknown as Record<string, unknown>).caravanCargo).toBeUndefined(); // champ retiré du modèle
    expect(s.possessions).toEqual([]); // aucune bascule vers le registre (#617/#618 Lot 2 : pas de migration)
    const mule = (s.party[0].items as unknown as { trappingId?: string; cargo?: unknown }[])[0];
    expect(mule?.trappingId).toBe('mule');
    expect(mule?.cargo).toEqual([{ cargoId: 'vin', enc: 20, basePriceGold: 5 }]);
  });

  // #349 — MIGRATIONS[5] (v5→v6) : les `lines: string[]` d'un `TravelRecapDay` deviennent des
  // `RecapLine[]` structurées ({text,icon,tone,phase}) — normalisées aux QUATRE emplacements
  // sérialisables (`normalizeTravelRecapLines`). Cette fixture couvre `pendingRest.travelDay` et
  // `travelPlan.log[]`.
  it('fixture v5 lignes de récap de voyage : chaînes brutes migrées en {text} aux emplacements sérialisés', () => {
    loadFixture('v5-travel-recap-lines.json');
    const s = useGame.getState();
    expect(s.pendingRest?.travelDay?.lines).toEqual([
      { text: 'Journée de route — Étape ensoleillée.' },
      { text: 'Péripétie : Un colporteur partage la route.' },
    ]);
    expect(s.travelPlan?.log?.[0]?.lines).toEqual([{ text: 'Départ, vent portant.' }]);
  });

  // #371 lot B — MIGRATIONS[6] (v6→v7) : le focus Codex passe de `{category,label}` à `{category,id}`.
  // La résolution label→id vit dans `src/ui` (interdit à `state`, règle 3) : un focus label-only (toute
  // save v6) est donc ramené à `null` (Codex clos = sain, sans navigation fantôme). Réel = null partout.
  it('fixture v6 focus Codex : compendiumFocus label-only ramené à null (résolution id hors couche state)', () => {
    loadFixture('v6-codex-focus-label.json');
    const s = useGame.getState();
    expect(s.compendiumFocus).toBeNull();
    expect(s.codexOverlay).toBeNull();
  });

  it('MIGRATIONS[6] : un focus DÉJÀ id-based (défensif) est conservé', () => {
    const raw = { version: 6, savedAt: '2026', sceneLabel: 's', gameTime: 0, data: { compendiumFocus: { category: 'talents', id: 'sixieme-sens', label: 'Sixième sens' }, codexOverlay: null } };
    const migrated = migrateSave(raw);
    expect(migrated!.version).toBe(SAVE_VERSION);
    expect((migrated!.data as Record<string, unknown>).compendiumFocus).toEqual({ category: 'talents', id: 'sixieme-sens', label: 'Sixième sens' });
  });
});

// #898 — la clé de stockage n'embarque plus SAVE_VERSION : un bump ne doit plus rendre une save
// existante invisible. `migrateLegacyKey` (saves.ts) balaie les anciennes clés `wfrp4.save.vN.slot`,
// migre la plus récente vers la clé stable `wfrp4.save.slot`, et ne supprime l'ancienne qu'après
// confirmation de l'écriture.
describe('Migration clé stable (#898) — un bump de SAVE_VERSION ne rend plus une save invisible', () => {
  /** Storage dont `setItem` échoue pour toute clé satisfaisant `failOn` (simule quota plein / accès
   *  refusé) — sert à prouver qu'aucune suppression ne précède une écriture réussie. */
  function fakeStorageFailingWrite(failOn: (key: string) => boolean): Storage {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (failOn(k)) throw new Error('quota exceeded (simulation)');
        m.set(k, String(v));
      },
      removeItem: (k: string) => void m.delete(k),
      clear: () => m.clear(),
      key: (i: number) => [...m.keys()][i] ?? null,
      get length() { return m.size; },
    } as Storage;
  }

  const FIXTURES_DIR = new URL('./__fixtures__/saves/', import.meta.url);
  const legacyKey = (v: number, slot: number) => `wfrp4.save.v${v}.${slot}`;
  const stableKey = (slot: number) => `wfrp4.save.${slot}`;

  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
  });

  it('SONDE #898 — save écrite à v14 (AVANT le bump), le code courant (SAVE_VERSION=15) la retrouve et la migre', () => {
    const raw = readFileSync(new URL('v14-legacy-sans-campaigndoc.json', FIXTURES_DIR), 'utf-8');
    const ls = (globalThis as { localStorage: Storage }).localStorage;
    // Reproduit le point de départ du ticket #898 : seule la clé versionnée v14 existe (écrite par
    // un ancien build), aucune clé stable — c'est l'AVANT-migration au sens du ticket (le bug était
    // que `KEY` embarquait `SAVE_VERSION` : une clé `wfrp4.save.v14.1` sondée sous `wfrp4.save.v15.1`
    // ne matchait jamais). Le code COURANT (celui de ce commit) la retrouve et la migre au premier
    // accès, PREUVE que le bump n'a plus cet effet.
    ls.setItem(legacyKey(14, 1), raw);
    expect(ls.getItem(stableKey(1))).toBeNull();

    // Le code retrouve la save ET la migration s'est appliquée (campaignDoc, MIGRATIONS[14], absent
    // en v14 → null en v15).
    const found = readSlot(1);
    expect(found).not.toBeNull();
    expect(found!.version).toBe(SAVE_VERSION);
    expect((found!.data as Record<string, unknown>).campaignDoc).toBeNull();
    const metas = listSaves();
    expect(metas[0]?.slot).toBe(1);
    expect(metas[0]?.sceneLabel).toBe('Clairière des Mutants');

    // La clé stable porte désormais la save migrée ; la clé legacy a disparu (écriture confirmée).
    expect(ls.getItem(stableKey(1))).not.toBeNull();
    expect(ls.getItem(legacyKey(14, 1))).toBeNull();
  });

  it('deux clés pour le même emplacement (reprise interrompue) : la clé STABLE gagne, jamais réécrasée par le balayage', () => {
    const ls = (globalThis as { localStorage: Storage }).localStorage;
    const stableSave = { version: SAVE_VERSION, savedAt: '2026-07-27', sceneLabel: 'Stable', gameTime: 1, data: {} };
    ls.setItem(stableKey(1), JSON.stringify(stableSave));
    // Clé legacy résiduelle (delete jamais aboutie d'une reprise précédente) — contenu DIFFÉRENT,
    // pour distinguer sans ambiguïté laquelle a été lue.
    ls.setItem(legacyKey(14, 1), readFileSync(new URL('v14-legacy-sans-campaigndoc.json', FIXTURES_DIR), 'utf-8'));
    const found = readSlot(1);
    expect(found?.sceneLabel).toBe('Stable'); // la clé stable est la source de vérité, jamais réécrasée
    expect(ls.getItem(legacyKey(14, 1))).not.toBeNull(); // le balayage ne supprime pas une clé legacy qu'il n'a pas eu besoin de migrer
  });

  it('aucune suppression avant écriture réussie : setItem de la clé stable échoue → la clé legacy SURVIT', () => {
    const raw = readFileSync(new URL('v14-legacy-sans-campaigndoc.json', FIXTURES_DIR), 'utf-8');
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorageFailingWrite((k) => k === stableKey(1));
    const ls = (globalThis as { localStorage: Storage }).localStorage;
    ls.setItem(legacyKey(14, 1), raw);
    expect(readSlot(1)).toBeNull(); // l'écriture de la clé stable échoue → readSlot ne peut pas migrer
    expect(ls.getItem(legacyKey(14, 1))).not.toBeNull(); // JAMAIS supprimée sans écriture réussie
    expect(ls.getItem(stableKey(1))).toBeNull(); // et rien n'a été écrit à moitié
  });

  it('cas limites : stockage vide, clé illisible, contenu corrompu → refusés sans crash', () => {
    expect(readSlot(1)).toBeNull(); // stockage vide
    const ls = (globalThis as { localStorage: Storage }).localStorage;
    ls.setItem(legacyKey(14, 1), 'pas du json'); // clé illisible
    expect(readSlot(1)).toBeNull();
    ls.clear();
    ls.setItem(legacyKey(14, 1), JSON.stringify({ foo: 'bar' })); // contenu corrompu (version absente)
    expect(readSlot(1)).toBeNull();
    expect(ls.getItem(legacyKey(14, 1))).not.toBeNull(); // conservée : rien n'a été supprimé en silence
  });

  it('sauvegarde PLUS RÉCENTE que le code : refusée (null), jamais chargée à moitié ni écrasée', () => {
    const ls = (globalThis as { localStorage: Storage }).localStorage;
    const future = { version: SAVE_VERSION + 1, savedAt: '2027', sceneLabel: 'Futur', gameTime: 0, data: { x: 1 } };
    ls.setItem(stableKey(1), JSON.stringify(future));
    expect(readSlot(1)).toBeNull();
    expect(listSaves()[0]).toBeNull();
    // la save future reste intacte sur disque (aucune tentative de migration ne l'a altérée).
    expect(JSON.parse(ls.getItem(stableKey(1))!)).toEqual(future);
  });

  // Audit adversarial — récursion mutuelle non bornée `saveToSlot` ↔ `readSlot` ↔ `migrateLegacyKey` :
  // l'ancienne confirmation d'écriture de `saveToSlot` rappelait `readSlot` (donc `migrateLegacyKey`,
  // qui rappelait `saveToSlot` pour la clé migrée) — un `setItem` qui échoue SANS lever (no-op silencieux,
  // quota/iframe capricieux) laissait la clé stable perpétuellement absente : boucle infinie jusqu'à
  // débordement de pile, AVALÉ par le `catch` de `readSlot`. La confirmation lit désormais `getItem`
  // directement (aucun rappel à `readSlot`) : `saveToSlot` ne peut plus réentrer `migrateLegacyKey`.
  it('SONDE récursion : setItem no-op silencieux (échec sans exception) ne produit ni récursion ni gel', () => {
    const raw = readFileSync(new URL('v14-legacy-sans-campaigndoc.json', FIXTURES_DIR), 'utf-8');
    const m = new Map<string, string>();
    let setItemCalls = 0;
    const noopStorage: Storage = {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (_k: string, _v: string) => { setItemCalls++; /* no-op : n'écrit jamais, ne lève jamais */ },
      removeItem: (k: string) => void m.delete(k),
      clear: () => m.clear(),
      key: (i: number) => [...m.keys()][i] ?? null,
      get length() { return m.size; },
    } as Storage;
    (globalThis as { localStorage?: Storage }).localStorage = noopStorage;
    m.set(legacyKey(14, 1), raw); // une clé legacy candidate à la migration à chaque relecture
    const start = performance.now();
    expect(() => readSlot(1)).not.toThrow(); // aucun RangeError avalé
    expect(performance.now() - start).toBeLessThan(50); // pas de gel (audit : ~368 ms avant correctif)
    expect(setItemCalls).toBeLessThanOrEqual(1); // pas de rappel imbriqué (audit : 2406 avant correctif)
    expect(readSlot(1)).toBeNull(); // écriture jamais confirmée : lecture refusée proprement, clé legacy relue à chaque fois
  });

  // Audit adversarial — perte de données : une save PLUS RÉCENTE que le code (retour à un build
  // antérieur) écrasée par `saveToSlot` disparaissait DÉFINITIVEMENT. `quarantineFutureSave` la met
  // de côté sous une clé distincte avant l'écrasement — récupérable via `readFutureBackup`.
  it('sauvegarde future écrasée par saveToSlot : mise à l’écart avant écrasement, récupérable', () => {
    const ls = (globalThis as { localStorage: Storage }).localStorage;
    const future = { version: SAVE_VERSION + 1, savedAt: '2027-01-01', sceneLabel: 'Futur', gameTime: 99, data: { x: 1 } };
    ls.setItem(stableKey(1), JSON.stringify(future));
    expect(readFutureBackup(1)).toBeNull(); // rien de mis à l'écart avant la première écrasement

    const overwrite = { version: SAVE_VERSION, savedAt: '2026-07-27', sceneLabel: 'Nouveau', gameTime: 0, data: {} } as SaveGame;
    expect(saveToSlot(1, overwrite)).toBe(true);
    expect(readSlot(1)?.sceneLabel).toBe('Nouveau'); // l'emplacement porte la nouvelle save

    const backup = readFutureBackup(1);
    expect(backup).not.toBeNull(); // la save v16 n'a pas disparu, elle est en quarantaine
    expect(backup!.version).toBe(SAVE_VERSION + 1);
    expect(backup!.savedAt).toBe('2027-01-01');
  });

  it('écrasement d’une save NON future (version ≤ SAVE_VERSION) : rien mis en quarantaine', () => {
    const ls = (globalThis as { localStorage: Storage }).localStorage;
    const olderSave = { version: SAVE_VERSION, savedAt: '2026-01-01', sceneLabel: 'Ancienne', gameTime: 5, data: {} };
    ls.setItem(stableKey(1), JSON.stringify(olderSave));
    const overwrite = { version: SAVE_VERSION, savedAt: '2026-07-27', sceneLabel: 'Nouveau', gameTime: 0, data: {} } as SaveGame;
    expect(saveToSlot(1, overwrite)).toBe(true);
    expect(readFutureBackup(1)).toBeNull();
  });
});
