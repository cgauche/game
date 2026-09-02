/**
 * Jalon 5 — Sauvegarde/chargement de partie : snapshot zéro-maintenance (clés de données de
 * getInitialState), localStorage 3 slots, export/import JSON, refus en combat.
 *
 * Plus la POLITIQUE DE VERSION (arbitrage utilisateur 2026-08-17) : une save dont la version diffère
 * de `SAVE_VERSION` est REJETÉE et RETIRÉE du stockage, avec un témoin de message pour le joueur.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useGame } from './store';
import { readSlot, deleteSlot, exportSave, importSave, listSaves, saveToSlot, parseSave, snapshotSave, takeObsoleteNotice, SAVE_VERSION, type SaveGame } from './saves';
import { rule, setRule, loadRuleOverrides } from '../engine/policy';
import { talents, careerLevels, specResolves, combatStakeRef } from '../data/index';
import { talentSlots, slotCovers } from '../engine/careerSlots';
import { createHero } from '../engine/character';
import { testValue } from '../engine/skills';
import { makeRNG } from '../engine/dice';
import { stampCriticalEscalation } from '../engine/trauma';
import { CRITIQUE_DOCS } from '../data/criticals';
import type { Combatant, Trauma } from '../engine/types';
import { testScene } from '../scenes/test-fixture';
import { emptyScene } from './scene';
import { pruneSeatAssignments } from './seating';
import { entityBlockedAt } from './sceneRules';
import { findPropById, findSpellById } from '../data/index';
import { spellEffectOps } from './flow';
import { applyOps } from '../engine/ops';

/** Porteur minimal du motif de bump 38 → 39 : `stampCriticalEscalation` ne lit que ses séquelles. */
const hero38 = (): Combatant => ({ id: 'h', label: 'H', kind: 'hero', conditions: [], skills: [], traumas: [] } as unknown as Combatant);

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
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); deleteSlot(1); deleteSlot(2); deleteSlot(3); loadRuleOverrides({}); takeObsoleteNotice(); });

  it('saveGame → slot rempli avec métadonnées (scène, horloge) ; listSaves le voit', () => {
    useGame.setState({ flags: { ...useGame.getState().flags, 'drapeau-test': true } });
    expect(useGame.getState().saveGame(1)).toBe(true);
    const s = readSlot(1)!;
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.sceneLabel).toBe(testScene.label); // le NOM de la scène, pas son id
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
    expect(importSave(JSON.stringify({ version: SAVE_VERSION - 1, savedAt: 'x', data: {} }))).toBeNull();
    // importGame applique la save importée à l'état.
    useGame.setState({ flags: {}, scene: null, screen: 'menu' });
    expect(useGame.getState().importGame(json)).toBe(true);
    expect(useGame.getState().scene?.id).toBe(testScene.id);
  });
});

describe('parseSave — la version DOIT être la courante', () => {
  const cur = { version: SAVE_VERSION, savedAt: '2026', sceneLabel: 's', gameTime: 0, data: {} };
  it('save à la version courante : acceptée telle quelle', () => {
    expect(parseSave(cur)).toEqual(cur);
  });
  it('version FUTURE (plus récente que l’app) → null', () => {
    expect(parseSave({ ...cur, version: SAVE_VERSION + 1 })).toBeNull();
  });
  it('version ANTÉRIEURE → null (aucune migration : la save se jette)', () => {
    expect(parseSave({ ...cur, version: SAVE_VERSION - 1 })).toBeNull();
    expect(parseSave({ ...cur, version: 1 })).toBeNull();
  });
  it('la forme persistée nomme `id` le champ d’identité d’une `SkillInstance` (L2 #1548, bump 36) : 35 se jette', () => {
    // MESURE du motif : une instance à la graphie de 35 n'est appariée par AUCUN Test — le moteur
    // apparie sur `id`, donc la valeur retombe sur la Caractéristique nue, Augmentations perdues.
    const nu = { ...createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Sonde', rng: makeRNG(1) }), skills: [] };
    const avecAncienneGraphie = { ...nu, skills: [{ skillId: 'resistance', characteristic: 'endurance', advances: 20 }] } as unknown as typeof nu;
    const avecGraphieCourante = { ...nu, skills: [{ id: 'resistance', characteristic: 'endurance', advances: 20 }] } as unknown as typeof nu;
    expect(testValue(avecAncienneGraphie, 'resistance')).toBe(testValue(nu, 'resistance'));
    expect(testValue(avecGraphieCourante, 'resistance')).toBe(testValue(nu, 'resistance') + 20);
    expect(parseSave({ ...cur, version: 35 })).toBeNull();
  });
  it('MESURE du motif de bump 36 → 37 (#717) : le CADRE DE CAMPAGNE entre au snapshot', () => {
    // Sans la borne ni l'archive, une save rouverte ferait compter les PX du chapitre depuis le néant
    // et raconterait un chapitre vide : la forme persistée change, la save de 36 se jette.
    expect(parseSave({ ...cur, version: 36 })).toBeNull();
    const initial = useGame.getInitialState() as unknown as Record<string, unknown>;
    const data = snapshotSave(initial, initial, '2026-08-31T00:00:00.000Z').data;
    expect(Object.keys(data)).toEqual(expect.arrayContaining(['chapitreDepuis', 'objectifsSoldes', 'pendingOuverture', 'pendingChapterRecap']));
  });
  it('MESURE du motif de bump 37 → 38 (#1552) : la SCÈNE persistée s’annonce', () => {
    // `snapshotSave` recopie l'ÉTAT entier, `state.scene` comprise : la forme persistée change avec
    // celle du document de scène. Une save de 37 rouvrirait sur une scène muette, que le seam
    // `parseProject` refuserait au prochain export de son projet.
    expect(parseSave({ ...cur, version: 37 })).toBeNull();
    const initial = useGame.getInitialState() as unknown as Record<string, unknown>;
    const data = snapshotSave({ ...initial, scene: testScene }, initial, '2026-08-31T00:00:00.000Z').data;
    expect(testScene.type, 'une scène du dépôt s’annonce').toBe('scene');
    expect((data.scene as { type?: string }).type, 'la scène persistée doit porter son `type`').toBe('scene');
  });
  it('MESURE du motif de bump 38 → 39 (#1680) : le vocabulaire des ids de PLACE persisté change', () => {
    // `state.scene.seatAssignments` est keyée `propId → slotId` et voyage ENTIÈRE dans la save. Les
    // ids de place ne portent plus un côté mais un RANG : une save de 38 rouvrirait avec des clés
    // que le catalogue ne connaît plus, et `pruneSeatAssignments` les élaguerait SANS un mot — les
    // assis se relèvent en silence. C'est la VERSION qui doit l'arrêter, pas l'élagage.
    expect(SAVE_VERSION, 'le bump 38 → 39 de #1680 est acquis (les bumps suivants s’y ajoutent)').toBeGreaterThanOrEqual(39);
    expect(parseSave({ ...cur, version: 38 }), 'une save de 38 ne se charge plus').toBeNull();
    // Le catalogue ne connaît QUE des rangs — la source du vocabulaire.
    const places = findPropById('table-ronde-4-tabourets')!.seatSlots!.map((s) => s.id);
    expect(places).toEqual(['place-1', 'place-2', 'place-3', 'place-4']);

    // LE DÉFAUT, mesuré sur le chemin réel : ce que ferait le chargement si la version laissait passer.
    const scene = emptyScene(12, 12);
    scene.entities = [
      { id: 'table-1', kind: 'prop', ref: 'table-ronde-4-tabourets', pos: { x: 5, y: 5 } },
      { id: 'pnj-1', kind: 'personnage', pos: { x: 5, y: 6 } },
    ] as typeof scene.entities;
    const ancien = { 'table-1': { 'place-nord': { kind: 'entity' as const, entityId: 'pnj-1' } } };
    expect(pruneSeatAssignments({ ...scene, seatAssignments: ancien }, 4), 'l’élagage est MUET').toEqual({});
    // La MÊME assise, dite au vocabulaire courant, SURVIT : c'est bien l'id, et rien d'autre, qui
    // décide — sans cette moitié, le contrat ci-dessus passerait aussi sur une scène mal formée.
    const courant = { 'table-1': { 'place-1': { kind: 'entity' as const, entityId: 'pnj-1' } } };
    expect(pruneSeatAssignments({ ...scene, seatAssignments: courant }, 4)).toEqual(courant);
  });
  it('MESURE du motif de bump 41 → 42 (#1509) : l’empreinte d’un décor à recette TOURNE avec son cap', () => {
    // La scène ÉDITÉE du joueur est PERSISTÉE telle quelle (`snapshotSave` recopie `state.scene`). Rien
    // n'y empêche un `table-2x1` au cap E : le schéma ne refuse que la diagonale. Une save de 41
    // rouvrirait avec une empreinte figée sur l'axe x, donc une autre marchabilité — un héros posé sur
    // (x, y+1) se retrouverait DANS le meuble. D'où le REJET.
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(42);
    expect(parseSave({ ...cur, version: 41 })).toBeNull();
    // LE DÉFAUT, mesuré sur le chemin réel : les deux caps ne bloquent pas les mêmes cases.
    const scene = emptyScene(12, 12);
    scene.entities = [{ id: 'table-1', kind: 'prop', ref: 'table-2x1', pos: { x: 5, y: 5 }, facing: 'E' }] as typeof scene.entities;
    expect(entityBlockedAt(scene, 5, 6, 0), 'au cap E la table occupe la case au SUD').toBe(true);
    expect(entityBlockedAt(scene, 6, 5, 0), 'au cap E la case à l’EST est libre').toBe(false);
    const auSud = { ...scene, entities: [{ ...scene.entities[0], facing: 'S' }] as typeof scene.entities };
    expect(entityBlockedAt(auSud, 6, 5, 0), 'au cap S la table occupe la case à l’EST').toBe(true);
    expect(entityBlockedAt(auSud, 5, 6, 0), 'au cap S la case au SUD est libre').toBe(false);
  });

  it('MESURE du motif de bump 40 → 41 (#1507) : les rayons de lumière PERSISTÉS sont en MÈTRES', () => {
    // Deux formes persistées portent un rayon de source : `SceneEntity.light` (override d'instance,
    // recopié avec `state.scene` par `snapshotSave`) et `ActiveEffect.light` (posé sur un héros par
    // l'op `light` du sort Lumière). Toutes deux passent de `radiusTiles` (cases, valeur RAW
    // pré-divisée par 2) à `radiusM` (mètres, la valeur du folio telle quelle). Une save de 40
    // rouvrirait avec `radiusM === undefined` : `rayonEnCases` rendrait `NaN`, et la lampe du héros
    // s'éteindrait en silence — d'où le REJET plutôt que l'élagage.
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(41);
    expect(parseSave({ ...cur, version: 40 })).toBeNull();
    const lumiere = spellEffectOps(findSpellById('lumiere')!.effects).find((o) => o.op === 'light')!;
    expect((lumiere as unknown as Record<string, unknown>).radiusTiles, 'graphie en cases ressuscitée').toBeUndefined();
    const porteur = hero38();
    applyOps(porteur, [lumiere], { label: 'Lumière' });
    const effet = (porteur.activeEffects ?? []).find((e) => e.light)!;
    expect(effet.light!.radiusM, 'la forme PERSISTÉE porte les mètres du folio (LDB 74 l.58)').toBe(20);
    expect((effet.light as unknown as Record<string, unknown>).radiusTiles).toBeUndefined();
  });
  it('MESURE du motif de bump 42 → 43 (#1657 B3-1) : le `critTrigger` persisté porte son ENJEU', () => {
    // `Trauma.critTrigger` (« Commotion cérébrale », LDB 18 l.74) est PERSISTÉ sur la séquelle du
    // héros. Son nœud `test` ne s'auto-résout plus au moteur : il part par la porte, dont le mint
    // d'étape REFUSE un enjeu muet (`monoStep`) — une save de 42 rouvrirait avec un nœud sans
    // `stake`, et le critique suivant se verrait refuser sa fenêtre au lieu d'ouvrir le Test.
    expect(SAVE_VERSION).toBe(43);
    expect(parseSave({ ...cur, version: 42 })).toBeNull();
    const commotion = CRITIQUE_DOCS.flatMap((d) => d.entries).find((e) => e.id === 'commotion-cerebrale')!;
    const arme = commotion.escalation!.onNextCritWhileCondition!;
    expect(arme.test.kind, 'la donnée doit porter le nœud, pas la graphie `resist`').toBe('test');
    expect(arme.test.test.stake, 'la DONNÉE ne porte pas d’enjeu : il est posé à l’armement').toBeUndefined();
    const traumas: Trauma[] = [];
    const enjeu = combatStakeRef('critRowTest', { entryId: 'commotion-cerebrale', entryCategory: 'criticalsTete' });
    stampCriticalEscalation(traumas, commotion.escalation!, 'tete', hero38(), makeRNG(1), [], enjeu);
    const pose = traumas.find((t) => t.critTrigger)!.critTrigger!.test;
    expect(pose.test.stake, 'le nœud PERSISTÉ doit porter l’enjeu de la rangée qui l’a armé').toEqual(enjeu);
    expect({ ...pose, test: { ...pose.test, stake: undefined } })
      .toEqual({ ...arme.test, test: { ...arme.test.test, stake: undefined } }); // rien d’autre n’a bougé
  });
  it('MESURE du motif de bump 33 → 34 : la spéc en LIBELLÉ ne couvre plus son emplacement', () => {
    const sv = talents.find((t) => t.id === 'savoir-vivre')!;
    expect(specResolves(sv, 'Érudit'), 'valeur PERSISTÉE par un héros de 33').toBe(false);
    expect(specResolves(sv, 'erudits')).toBe(true);
    const slots = talentSlots(careerLevels.filter((l) => l.career === 'apothicaire'), 1);
    const slot = slots.find((s) => s.options.some((o) => o.optionId === 'savoir-vivre'))!;
    expect(slotCovers(slot, 'savoir-vivre', 'Érudit')).toBe(false);
    expect(slotCovers(slot, 'savoir-vivre', 'erudits')).toBe(true);
  });

  /**
   * TÉMOIN d'une couture que le TYPECHECK NE VOIT PAS : `snapshotSave` reçoit un `Record` opaque, donc
   * l'accès au libellé de scène passe par un cast — un champ renommé y dégraderait la vignette vers
   * l'id EN SILENCE, sans une seule erreur de compilation. Ce test mesure le RÉSULTAT (un libellé, pas
   * l'id) : il rougit dès que la couture se débranche.
   */
  it('la vignette porte le LIBELLÉ de la scène (jamais son id), et la scène voyage ENTIÈRE dans `data`', () => {
    const initial = useGame.getState() as unknown as Record<string, unknown>;
    const scene = { id: 'scene-id-a-ne-pas-afficher', label: 'La Salle du Trône', dimensions: { w: 2, h: 2 } };
    const save = snapshotSave({ ...initial, scene }, initial, '2026-08-29T00:00:00.000Z');
    expect(save.sceneLabel).toBe('La Salle du Trône');
    expect((save.data.scene as { label?: string })?.label).toBe('La Salle du Trône');
    // Sans scène, la vignette le DIT — elle ne rend pas une chaîne vide.
    expect(snapshotSave({ ...initial, scene: null }, initial, '2026').sceneLabel).toBe('Sans scène');
  });
  it('objet malformé / version absente → null', () => {
    expect(parseSave(null)).toBeNull();
    expect(parseSave('pas un objet')).toBeNull();
    expect(parseSave({ savedAt: 'x', data: {} })).toBeNull(); // version absente
  });
});

// Arbitrage utilisateur 2026-08-17 : un changement de forme persistée bump `SAVE_VERSION` et RIEN
// d'autre. Une save d'une autre version ne se migre pas — elle se JETTE, message au joueur.
describe('POLITIQUE DE VERSION — une save d’une autre version est jetée, jamais migrée', () => {
  const legacyKey = (v: number, slot: number) => `wfrp4.save.v${v}.${slot}`;
  const futureKey = (slot: number) => `wfrp4.save.future.${slot}`;
  const stableKey = (slot: number) => `wfrp4.save.${slot}`;
  const save = (version: number, sceneLabel = 'Ancienne') => ({ version, savedAt: '2026-08-17', sceneLabel, gameTime: 3, data: { flags: { 'drapeau-x': true } } });
  const ls = () => (globalThis as { localStorage: Storage }).localStorage;

  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
    takeObsoleteNotice(); // témoin remis à zéro entre les cas
  });

  it('save v26 (version antérieure) : REJETÉE, RETIRÉE du stockage, témoin « anterieure » posé', () => {
    ls().setItem(stableKey(1), JSON.stringify(save(SAVE_VERSION - 1)));
    expect(readSlot(1)).toBeNull();
    expect(ls().getItem(stableKey(1))).toBeNull(); // la donnée est SUPPRIMÉE, pas laissée à pourrir
    expect(takeObsoleteNotice()).toBe('anterieure');
    expect(takeObsoleteNotice()).toBeNull(); // témoin à usage unique
  });

  it('save v27 (version courante) : chargée normalement, rien de jeté, aucun message', () => {
    ls().setItem(stableKey(2), JSON.stringify(save(SAVE_VERSION, 'Courante')));
    expect(readSlot(2)?.sceneLabel).toBe('Courante');
    expect(ls().getItem(stableKey(2))).not.toBeNull();
    expect(takeObsoleteNotice()).toBeNull();
  });

  it('loadGame sur une save v26 : refusé, l’état courant INTACT, l’emplacement vidé', () => {
    useGame.setState({ flags: { 'drapeau-vivant': true } });
    ls().setItem(stableKey(1), JSON.stringify(save(SAVE_VERSION - 1)));
    expect(useGame.getState().loadGame(1)).toBe(false);
    expect(useGame.getState().flags['drapeau-vivant']).toBe(true);
    expect(useGame.getState().flags['drapeau-x']).toBeUndefined();
    expect(listSaves()[0]).toBeNull();
    expect(takeObsoleteNotice()).toBe('anterieure');
  });

  it('clé VERSIONNÉE historique (#898) : jetée elle aussi — aucune n’a jamais porté la version courante', () => {
    ls().setItem(legacyKey(14, 1), JSON.stringify(save(14)));
    expect(readSlot(1)).toBeNull();
    expect(ls().getItem(legacyKey(14, 1))).toBeNull();
    expect(takeObsoleteNotice()).toBe('anterieure');
  });

  // La clé de QUARANTAINE `wfrp4.save.future.N` était écrite par le code d'AVANT l'arbitrage (une save
  // plus récente y était mise de côté avant écrasement). Personne ne l'écrit plus : elle se JETTE
  // comme le reste, sans quoi la donnée que l'arbitrage ordonne de supprimer survivrait indéfiniment.
  it('clé de QUARANTAINE historique : purgée à la lecture, témoin « future »', () => {
    ls().setItem(futureKey(1), JSON.stringify(save(SAVE_VERSION + 1, 'Futur')));
    expect(readSlot(1)).toBeNull();
    expect(ls().getItem(futureKey(1))).toBeNull();
    expect(takeObsoleteNotice()).toBe('future');
  });

  it('clé de QUARANTAINE à côté d’une save COURANTE : la save se charge, la clé résiduelle est nettoyée', () => {
    ls().setItem(stableKey(1), JSON.stringify(save(SAVE_VERSION, 'Courante')));
    ls().setItem(futureKey(1), JSON.stringify(save(SAVE_VERSION + 1, 'Futur')));
    expect(readSlot(1)?.sceneLabel).toBe('Courante');
    expect(ls().getItem(futureKey(1))).toBeNull();
  });

  it('save FUTURE (plus récente que le code) : jetée aussi, témoin « future » (le message ne ment pas)', () => {
    ls().setItem(stableKey(3), JSON.stringify(save(SAVE_VERSION + 1, 'Futur')));
    expect(readSlot(3)).toBeNull();
    expect(ls().getItem(stableKey(3))).toBeNull();
    expect(takeObsoleteNotice()).toBe('future');
  });

  it('contenu illisible / forme sans version : jeté, témoin « illisible » — jamais un crash', () => {
    ls().setItem(stableKey(1), 'pas du json');
    expect(readSlot(1)).toBeNull();
    expect(ls().getItem(stableKey(1))).toBeNull();
    expect(takeObsoleteNotice()).toBe('illisible');

    ls().setItem(stableKey(1), JSON.stringify({ foo: 'bar' }));
    expect(readSlot(1)).toBeNull();
    expect(ls().getItem(stableKey(1))).toBeNull();
    expect(takeObsoleteNotice()).toBe('illisible');
  });

  it('emplacement VIDE : ni message ni bruit', () => {
    expect(readSlot(1)).toBeNull();
    expect(listSaves()).toEqual([null, null, null]);
    expect(takeObsoleteNotice()).toBeNull();
  });

  it('saveToSlot écrase une save d’une autre version, sans quarantaine', () => {
    ls().setItem(stableKey(1), JSON.stringify(save(SAVE_VERSION + 1, 'Futur')));
    const neuve = { version: SAVE_VERSION, savedAt: '2026-08-17', sceneLabel: 'Nouveau', gameTime: 0, data: {} } as SaveGame;
    expect(saveToSlot(1, neuve)).toBe(true);
    expect(readSlot(1)?.sceneLabel).toBe('Nouveau');
    expect(ls().getItem(futureKey(1))).toBeNull(); // rien n'est mis de côté : la save future est perdue, comme ordonné
  });

  it('deleteSlot nettoie la clé stable, la clé de quarantaine ET les clés versionnées historiques', () => {
    ls().setItem(stableKey(1), JSON.stringify(save(SAVE_VERSION)));
    ls().setItem(legacyKey(14, 1), JSON.stringify(save(14)));
    ls().setItem(futureKey(1), JSON.stringify(save(SAVE_VERSION + 1)));
    deleteSlot(1);
    expect(ls().getItem(stableKey(1))).toBeNull();
    expect(ls().getItem(legacyKey(14, 1))).toBeNull();
    expect(ls().getItem(futureKey(1))).toBeNull();
  });
});
