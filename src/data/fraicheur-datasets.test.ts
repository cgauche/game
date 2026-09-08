/**
 * CONTRAT DE FRAÎCHEUR (#1692) — une écriture au seam est vue par les LECTEURS, sans rechargement.
 *
 * Ces cas ÉCHOUAIENT avant le lot : les accesseurs lisaient un index construit une fois à l'import,
 * si bien qu'après une édition au Codex (`setDataset`, la porte de `CodexEdit.save`) l'entrée éditée
 * gardait son ancien libellé et une entrée NEUVE n'existait pour personne. Ils ne sont pas
 * théoriques : `traits`, `trappings`, `characteristics` et `props` sont tous édités par l'atelier
 * (`exposition.edit` de leur def).
 *
 * Restauration `afterEach` par le seam lui-même : aucun test ne touche un dataset autrement.
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  traits, trappings, characteristics, props, etats,
  findTraitById, findTrappingById, findPropById, charAbr, traitIdByLabel,
} from './index';
import { setDataset } from './overrides';
import { knownTraitId, traitLabelById } from '../engine/traits/dispatch';
import { weaponGroupFromText } from '../engine/weaponGroup';
import { conditionIdInText, conditionSeverity } from '../engine/conditions';
import { versionDuDataset } from './versionDataset';
import { emptyScene, sceneMetresPerTile } from '../state/scene';
import { worldBakeDeps } from '../gameIso/backends/webgl/sceneMeshes';

const TRAITS_LIVRES = [...traits];
const POSSESSIONS_LIVREES = [...trappings];
const CARACS_LIVREES = [...characteristics];
const DECORS_LIVRES = [...props];
const ETATS_LIVRES = [...etats];

afterEach(() => {
  setDataset('traits', TRAITS_LIVRES);
  setDataset('trappings', POSSESSIONS_LIVREES);
  setDataset('characteristics', CARACS_LIVREES);
  setDataset('props', DECORS_LIVRES);
  setDataset('etats', ETATS_LIVRES);
});

describe('#1692 — une édition au seam est SERVIE aux lecteurs', () => {
  it('un Trait RENOMMÉ : `findTraitById`, `traitLabelById` et `knownTraitId` servent le NOUVEAU libellé', () => {
    const avant = findTraitById('venin')!;
    expect(avant.label).toBe('Venin');
    setDataset('traits', traits.map((t) => (t.id === 'venin' ? { ...t, label: 'Venin des marais' } : t)));
    expect(findTraitById('venin')!.label).toBe('Venin des marais');
    expect(traitLabelById('venin')).toBe('Venin des marais');
    // L'`id` est STABLE : un renommage ne le déplace pas — c'est le LIBELLÉ reconnu qui change (le
    // texte d'un statbloc « Venin des marais » résout l'id `venin`, « Venin » ne nomme plus rien).
    expect(knownTraitId('Venin des marais')).toBe('venin');
    expect(knownTraitId('Venin')).toBeUndefined();
    expect(traitIdByLabel('venin des marais')).toBe('venin');
  });

  it('une Possession NEUVE est résolue par `findTrappingById` dès son ajout', () => {
    expect(findTrappingById('sonde-1692')).toBeUndefined();
    setDataset('trappings', [...trappings, { ...trappings[0], id: 'sonde-1692', label: 'Sonde 1692' }]);
    expect(findTrappingById('sonde-1692')!.label).toBe('Sonde 1692');
  });

  it('une Caractéristique dont l’ABRÉVIATION change : l’écran la lit à la donnée', () => {
    expect(charAbr('capacite-de-combat')).toBe('CC');
    setDataset('characteristics', characteristics.map((c) => (c.id === 'capacite-de-combat' ? { ...c, abr: 'ZZ' } : c)));
    expect(charAbr('capacite-de-combat')).toBe('ZZ');
  });

  it('un décor ÉDITÉ : `findPropById` rend la NOUVELLE entrée ET le READ-SET du bake porte une dep NEUVE', () => {
    // La scène pose un décor VOLUMIQUE : `worldBakeDeps` y lit sa RECETTE (`propRecipeDeps`), donc la
    // fraîcheur se MESURE sur la dep elle-même — pas seulement sur l'identité rendue par l'accesseur.
    // L'édition porte donc sur ce qui CUIT (la recette) : un libellé seul ne recuit rien, par dessein.
    const scene = emptyScene(6, 6);
    scene.entities = [{ id: 'p1', kind: 'prop', ref: 'tonneau', pos: { x: 2, y: 2 } } as (typeof scene.entities)[number]];
    const mpt = sceneMetresPerTile(scene);
    const depsAvant = worldBakeDeps(scene, mpt);
    const avant = findPropById('tonneau')!;
    expect(depsAvant).toContain(avant.volume); // la recette du tonneau EST une dep du bake

    setDataset('props', props.map((p) => (p.id === 'tonneau' ? { ...p, label: 'Tonneau ébréché', volume: { ...p.volume! } } : p)));
    const apres = findPropById('tonneau')!;
    expect(apres.label).toBe('Tonneau ébréché');
    expect(apres).not.toBe(avant);

    const depsApres = worldBakeDeps(scene, mpt);
    expect(depsApres.length).toBe(depsAvant.length);
    expect(depsApres.some((d, i) => d !== depsAvant[i]), 'aucune dep du bake n’a bougé : le monde resterait cuit sur l’ancien décor').toBe(true);
    expect(depsApres).toContain(apres.volume);
  });

  it('ISOLANT : un décor édité HORS de sa recette ne fait bouger AUCUNE dep du bake', () => {
    // Contrepartie du cas précédent : il assère qu'une dep CHANGE, ce qui ne vaut que si toute
    // édition ne les fait pas toutes changer. Ici l'édition ne touche QUE le libellé — la recette
    // (`volume`) garde son identité —, et le read-set doit être identique élément par élément.
    const scene = emptyScene(6, 6);
    scene.entities = [{ id: 'p1', kind: 'prop', ref: 'tonneau', pos: { x: 2, y: 2 } } as (typeof scene.entities)[number]];
    const mpt = sceneMetresPerTile(scene);
    const depsAvant = worldBakeDeps(scene, mpt);

    setDataset('props', props.map((p) => (p.id === 'tonneau' ? { ...p, label: 'Tonneau signé' } : p)));
    expect(findPropById('tonneau')!.label).toBe('Tonneau signé');

    const depsApres = worldBakeDeps(scene, mpt);
    expect(depsApres.length).toBe(depsAvant.length);
    expect(depsApres.filter((d, i) => d !== depsAvant[i]), 'le bake se déclencherait sur une édition qui ne cuit rien').toEqual([]);
  });

  it('une arme RENOMMÉE : le Groupe se résout sur le NOUVEAU libellé (couture déléguée à `src/data`)', () => {
    expect(weaponGroupFromText('Hallebarde')).toBe('armes-d-hast');
    setDataset('trappings', trappings.map((t) => (t.id === 'hallebarde' ? { ...t, label: 'Vouge' } : t)));
    expect(weaponGroupFromText('Vouge')).toBe('armes-d-hast');
    expect(weaponGroupFromText('Hallebarde')).toBeNull();
  });

  it('un État RENOMMÉ : le journal reconnaît le NOUVEAU libellé, et son importance suit l’id', () => {
    expect(conditionIdInText('Grim est Sonné')).toBe('sonne');
    setDataset('etats', etats.map((e) => (e.id === 'sonne' ? { ...e, label: 'Assommé' } : e)));
    expect(conditionIdInText('Grim est Assommé')).toBe('sonne');
    expect(conditionIdInText('Grim est Sonné')).toBeUndefined();
    // Ce que le journal en fait (`state/combatLog.isImportantEvent`) : la sévérité se lit sur l’ID rendu,
    // 80 pour `sonne` — le libellé n’a servi qu’à le reconnaître dans un texte français.
    expect(conditionSeverity(conditionIdInText('Grim est Assommé')!)).toBe(80);
  });

  it('un marqueur NARRATIF hors catalogue (Pétrifié, LDB 85) reste reconnu par le même scan', () => {
    expect(conditionIdInText('La statue : Ulrika est Pétrifié')).toBe('petrifie');
    expect(conditionSeverity('petrifie')).toBe(95);
  });

  it('la VERSION du dataset est le témoin : elle avance à chaque écriture, et à elle seule', () => {
    const v = versionDuDataset('traits');
    const vAutre = versionDuDataset('trappings');
    setDataset('traits', [...traits]);
    expect(versionDuDataset('traits')).toBe(v + 1);
    expect(versionDuDataset('trappings')).toBe(vAutre);
  });
});
