/**
 * SAVE LEGACY × `PassiveKind` (#1318 V8c₅) — la tranche finale a renommé DEUX valeurs du type
 * (`mobilité`→`mobilite`, `intrinsèque`→`intrinseque`) pour aligner la famille sur l'ASCII (`etat`,
 * `douleur`…). Ce `kind` est PERSISTÉ (`Trauma.passiveKind`, `engine/types.ts`) : une save antérieure
 * en porte l'ancienne forme, et la table `PASSIVE_CANCELLERS` (TOTALE sur l'union courante) rendait
 * alors `undefined` → le collecteur passif LEVAIT sur son `for…of`, au premier calcul de
 * Caractéristique effective d'un héros portant une cicatrice de Critique guéri.
 *
 * Ce fichier verrouille les DEUX étages :
 *  1. la MIGRATION de save (`MIGRATIONS[24]`, `passiveKindMigration.ts`) — la donnée remonte à la forme
 *     courante, en PROFONDEUR ;
 *  2. le FILET au site (`normalizePassiveKind`, `engine/ops.ts`) — une valeur ancienne qui arriverait
 *     par une autre porte (roster importé, document réécrit) ne fait NI crasher NI dériver : le
 *     `charMod` d'un kind `intrinsèque` doit rester ADDITIF (somme dans la base), pas basculer dans le
 *     pool non-cumul en silence.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { migrateSave, SAVE_VERSION } from './saves';
import { remapPassiveKindDeep } from './passiveKindMigration';
import { remapPerRoundDeep } from './perRoundMigration';
import { tickTraumaEscalation } from '../engine/trauma';
import { normalizePassiveKind } from '../engine/ops';
import { passiveMods, passiveSkillSum } from '../engine/trauma';
import { effectiveChar } from '../engine/characteristics';
import type { Combatant, SkillInstance, Trauma } from '../engine/types';

const FIXTURE = new URL('./__fixtures__/saves/v24-passivekind-accentue.json', import.meta.url);
const FIXTURE_PER_ROUND = new URL('./__fixtures__/saves/v26-fingerlossperround.json', import.meta.url);

/** Vue typée minimale d'une save de traumas (les seuls champs que ces tests lisent). */
type PlaieSerialisee = { label: string; location: string; awaitingMedicalAid?: boolean; perRound?: { versTraumaId: string; unites?: number }; fingerLossPerRound?: boolean };
type DocPerRound = { data: { party: { traumas: PlaieSerialisee[] }[]; battle: { combatants: { traumas: PlaieSerialisee[] }[] } } };

/** Cobaye nu porteur de séquelles données telles quelles (formes ANCIENNES incluses) — même fixture
 *  minimale que `engine/test-value-parts.test.ts` (aucun tirage, aucune dépendance de création). */
function heroWithTraumas(traumas: unknown[]): Combatant {
  return {
    id: 'h', label: 'Sigrid', kind: 'hero', speciesId: 'humains-reiklander',
    characteristics: { sociabilite: 40, agilite: 40, dexterite: 40, intelligence: 40 } as Combatant['characteristics'],
    skills: [{ skillId: 'charme', advances: 0 }] as SkillInstance[],
    talents: [], items: [], conditions: [], advantage: 0,
    traumas: traumas as Trauma[],
  } as unknown as Combatant;
}

describe('#1318 V8c₅ — une save au `passiveKind` ACCENTUÉ reste chargeable et juste', () => {
  it('MIGRATIONS[24] : les deux ids persistés remontent à la forme ASCII, en profondeur', () => {
    const raw = JSON.parse(readFileSync(FIXTURE, 'utf-8')) as unknown;
    expect((raw as { version: number }).version).toBe(24);
    const migrated = migrateSave(raw);
    expect(migrated).not.toBeNull();
    expect(migrated!.version).toBe(SAVE_VERSION);
    const hero = (migrated!.data as { party: { traumas: { passiveKind: string }[] }[] }).party[0];
    expect(hero.traumas.map((t) => t.passiveKind)).toEqual(['intrinseque', 'mobilite']);
  });

  it('CONTRE-PREUVE : la fixture porte bien l’ANCIENNE forme (sans quoi le migrateur ne prouverait rien)', () => {
    const raw = JSON.parse(readFileSync(FIXTURE, 'utf-8')) as { data: { party: { traumas: { passiveKind: string }[] }[] } };
    expect(raw.data.party[0].traumas.map((t) => t.passiveKind)).toEqual(['intrinsèque', 'mobilité']);
  });

  it('le remap ne touche QUE les valeurs reconnues (un `kind` d’une autre famille sort intact)', () => {
    const doc = { mutations: [{ id: 'x', kind: 'physique' }], party: [{ kind: 'hero', traumas: [{ passiveKind: 'mobilité' }] }] };
    expect(remapPassiveKindDeep(doc)).toEqual({
      mutations: [{ id: 'x', kind: 'physique' }],
      party: [{ kind: 'hero', traumas: [{ passiveKind: 'mobilite' }] }],
    });
  });

  it('FILET : le collecteur passif ne LÈVE pas sur un kind ancien non migré (porte annexe)', () => {
    const c = heroWithTraumas([{ label: 'Jambe raide', ops: [{ op: 'moveScale', factor: 0.5 }], passiveKind: 'mobilité' }]);
    expect(() => passiveMods(c)).not.toThrow();
    expect(() => effectiveChar(c, 'agilite')).not.toThrow();
    // …et le kind PROPAGÉ est déjà la forme courante (aucun id ancien ne ressort du collecteur).
    expect(passiveMods(c).map((m) => m.kind)).toContain('mobilite');
  });

  it('FILET : un `charMod` de kind `intrinsèque` (ancien id) reste ADDITIF — pas de dérive silencieuse', () => {
    const ancien = heroWithTraumas([{ label: 'Trait de corps', ops: [{ op: 'skillMod', skill: 'charme', mod: 10 }], passiveKind: 'intrinsèque' }]);
    const courant = heroWithTraumas([{ label: 'Trait de corps', ops: [{ op: 'skillMod', skill: 'charme', mod: 10 }], passiveKind: 'intrinseque' }]);
    // `passiveSkillSum` ne somme QUE les kinds additifs : l'ancien id doit compter comme le nouveau.
    expect(passiveSkillSum(ancien, 'charme')).toBe(passiveSkillSum(courant, 'charme'));
    expect(passiveSkillSum(ancien, 'charme')).toBe(10);
  });

  it('`normalizePassiveKind` : ancien → courant, courant → lui-même, absent → undefined', () => {
    expect(normalizePassiveKind('mobilité')).toBe('mobilite');
    expect(normalizePassiveKind('intrinsèque')).toBe('intrinseque');
    expect(normalizePassiveKind('douleur')).toBe('douleur');
    expect(normalizePassiveKind(undefined)).toBeUndefined();
  });
});

/**
 * SAVE LEGACY × escalade PÉRIODIQUE (#1318 E4/C-γ) — `Trauma.fingerLossPerRound` (booléen qui NOMMAIT
 * la séquelle ajoutée) est devenu `Trauma.perRound` (axe qui la DÉCLARE). Le champ est PERSISTÉ : sans
 * `MIGRATIONS[26]`, une save prise pendant une « Main ouverte » recharge une plaie que
 * `tickTraumaEscalation` ne voit plus — l'aggravation s'arrête en silence (AA 07 l.127 / LDB 18 l.251).
 */
describe('#1318 E4/C-γ — une save portant `fingerLossPerRound` reste chargeable ET continue d’escalader', () => {
  const lire = () => JSON.parse(readFileSync(FIXTURE_PER_ROUND, 'utf-8')) as DocPerRound & { version: number };

  it('CONTRE-PREUVE : la fixture porte bien l’ANCIENNE forme (booléen), en groupe ET en combat', () => {
    const raw = lire();
    expect(raw.version).toBe(26);
    expect(raw.data.party[0].traumas[0].fingerLossPerRound).toBe(true);
    expect(raw.data.party[1].traumas[0].fingerLossPerRound).toBe(false);
    expect(raw.data.battle.combatants[0].traumas[0].fingerLossPerRound).toBe(true);
    expect(raw.data.party[0].traumas[0]).not.toHaveProperty('perRound');
  });

  it('MIGRATIONS[26] : le booléen devient l’escalade DÉCLARÉE, en profondeur (party ET battle.combatants)', () => {
    const migrated = migrateSave(lire())!;
    expect(migrated.version).toBe(SAVE_VERSION);
    const data = (migrated as unknown as DocPerRound).data;
    const plaie = data.party[0].traumas[0];
    expect(plaie.perRound).toEqual({ versTraumaId: 'doigt-ampute', unites: 1 });
    expect(plaie).not.toHaveProperty('fingerLossPerRound'); // la clé ancienne ne survit pas
    expect(plaie.awaitingMedicalAid).toBe(true); // AUCUN autre champ touché : le gate de soin reste
    expect(data.battle.combatants[0].traumas[0].perRound).toEqual({ versTraumaId: 'doigt-ampute', unites: 1 });
    // `false` → la clé disparaît sans rien poser (aucune escalade n'était en cours).
    expect(data.party[1].traumas[0]).not.toHaveProperty('perRound');
    expect(data.party[1].traumas[0]).not.toHaveProperty('fingerLossPerRound');
  });

  it('COMPORTEMENT : la plaie CHARGÉE escalade encore d’un doigt au Round suivant (la sonde du bug)', () => {
    const migrated = migrateSave(lire())!;
    const hero = (migrated as unknown as DocPerRound).data.party[0] as unknown as Combatant;
    tickTraumaEscalation(hero);
    const doigts = (hero.traumas ?? []).find((t) => t.traumaId === 'doigt-ampute');
    expect(doigts?.count).toBe(1);
  });

  it('le remap ne touche QUE `fingerLossPerRound` (délai d’amputation et voisins sortent intacts)', () => {
    const doc = { party: [{ traumas: [{ label: 'A', awaitingMedicalAid: true, amputateAfterDays: 3, amputateSequel: 'membre-inferieur-ampute', fingerLossPerRound: true }] }] };
    expect(remapPerRoundDeep(doc)).toEqual({
      party: [{ traumas: [{ label: 'A', awaitingMedicalAid: true, amputateAfterDays: 3, amputateSequel: 'membre-inferieur-ampute', perRound: { versTraumaId: 'doigt-ampute', unites: 1 } }] }],
    });
  });

  it('IDEMPOTENT : un document DÉJÀ migré ressort inchangé', () => {
    const deja = { party: [{ traumas: [{ label: 'A', perRound: { versTraumaId: 'doigt-ampute', unites: 1 } }] }] };
    expect(remapPerRoundDeep(deja)).toEqual(deja);
  });
});
