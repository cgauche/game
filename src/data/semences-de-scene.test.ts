/**
 * GARDE — le SCHÉMA des semences de scène (#1716) refuse une semence qui poserait le faux défaut sur
 * CHAQUE scène créée ensuite.
 *
 * Trois portes, chacune tenue par la grammaire partagée et non par un contrôle local : un TERRAIN
 * hors du registre (`idDe('terrain')`), un ÉCLAIRAGE qui n'est ni `auto` ni un palier réel
 * (`idDe('lightLevel')` — plus strict que `Scene.ambientLight`, chaîne libre), une PENTE hors de
 * `PENTE_TOIT_DEG` (`sceneRoofDefaultsSchema`, le schéma de la scène lui-même, jamais une copie).
 *
 * Le document LIVRÉ est validé en premier : sans lui, les trois refus ne prouveraient rien (un
 * schéma qui refuse tout refuse aussi le faux).
 */
import { describe, expect, it } from 'vitest';
import { validateDataset } from './schemas/validate';
import { semencesDeScene } from './index';

const FICHIER = 'semences-de-scene.json';
/** Le document livré, tel qu'il est sur disque (enveloppe comprise) — base de chaque mutation. */
const LIVRE = {
  id: 'semences-de-scene', type: 'semencesDeScene', label: 'Semences de scène',
  maison: 'fixture de test — la raison réelle vit au dataset',
  ambiance: semencesDeScene.ambiance,
  metresPerTile: semencesDeScene.metresPerTile,
  ambientLight: semencesDeScene.ambientLight,
  terrain: semencesDeScene.terrain,
  reliefDefaults: { ...semencesDeScene.reliefDefaults },
  roofDefaults: { ...semencesDeScene.roofDefaults },
};

describe('semences-de-scene.json — le schéma refuse une semence qui mentirait à toutes les scènes (#1716)', () => {
  it('le document LIVRÉ parse (sans quoi les refus ci-dessous ne mesureraient rien)', () => {
    expect(validateDataset(FICHIER, LIVRE)).toBeNull();
  });

  it('un TERRAIN hors du registre des sols est refusé, nommément', () => {
    const erreur = validateDataset(FICHIER, { ...LIVRE, terrain: 'lave-de-nulle-part' });
    expect(erreur).toContain('terrain');
    expect(erreur).toContain('lave-de-nulle-part');
  });

  it('un ÉCLAIRAGE qui n’est ni `auto` ni un palier de `lightLevels.json` est refusé', () => {
    expect(validateDataset(FICHIER, { ...LIVRE, ambientLight: 'plein-jour-inconnu' })).toContain('ambientLight');
    // `auto` (l'éclairage suit l'horloge) et un palier RÉEL passent tous les deux.
    expect(validateDataset(FICHIER, { ...LIVRE, ambientLight: 'auto' })).toBeNull();
    expect(validateDataset(FICHIER, { ...LIVRE, ambientLight: 'nuit' })).toBeNull();
  });

  it('une PENTE de toiture hors de la plage du schéma de scène est refusée', () => {
    const erreur = validateDataset(FICHIER, { ...LIVRE, roofDefaults: { ...LIVRE.roofDefaults, pitchDeg: 80 } });
    expect(erreur).toContain('pitchDeg');
  });

  it('une MATIÈRE de relief hors de la sous-liste `relief` est refusée', () => {
    const erreur = validateDataset(FICHIER, { ...LIVRE, reliefDefaults: { ...LIVRE.reliefDefaults, cliff: 'toit-ardoise' } });
    expect(erreur).toContain('cliff');
  });

  it('une AMBIANCE hors du vocabulaire de la scène est refusée (même énumération que `Scene.ambiance`)', () => {
    expect(validateDataset(FICHIER, { ...LIVRE, ambiance: 'souterrain' })).toContain('ambiance');
  });
});
