import { describe, it, expect } from 'vitest';
import { areneCampaign, builtinCampaigns, campagneDuJeu, campagneDuPaquet, copieDuJeu, documentDuJeu, type BuiltinCampaign } from './campaign';
import { parseProject } from '../state/worldMap';
import { emptyScene } from '../state/scene';
import { allAxes } from '../data';
import areneProjet from './arene/arene-projet.json';

/**
 * Registre des campagnes BUILT-IN (#211) : « Nouvelle partie → Changer » les liste toutes via
 * `CampaignSelect` (`ui/PartyScreen.tsx`), au MÊME mécanisme que les projets publiés de l'éditeur
 * (`pendingCampaign` + `loadProject`) — jamais un chemin parallèle.
 */
describe('builtinCampaigns — registre des campagnes exposées au picker', () => {
  it('« Le Loup et la Saumure » y est enregistrée, projet valide', () => {
    const loup = builtinCampaigns.find((c) => c.id === 'loup-et-saumure');
    expect(loup).toBeTruthy();
    expect(loup!.scenes.length).toBeGreaterThan(0);
    expect(loup!.startSceneId).toBe(loup!.scenes[0].id);
    expect(loup!.worldMap).toBeTruthy();
  });

  it('chaque campagne BUILT-IN a un id/nom uniques et une scène de départ RÉELLE', () => {
    const ids = builtinCampaigns.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of builtinCampaigns) {
      expect(c.scenes.some((s) => s.id === c.startSceneId), `${c.id} : startSceneId résout une scène`).toBe(true);
    }
  });
});

/** `activeAxes` (#409) suit la campagne du jeu comme une entrée de bibliothèque (`campagneDeLEntree`) :
 *  présent seulement s'il est déclaré. */
describe('activeAxes — porté du paquet à la campagne lancée', () => {
  const axes = allAxes.filter((a) => !a.core).map((a) => a.id);

  it('le registre porte des axes hors socle', () => {
    expect(axes.length).toBeGreaterThan(0);
  });

  it('un paquet qui en déclare : la dérivation les garde', () => {
    const paquet = parseProject({ ...areneProjet, activeAxes: axes });
    expect(campagneDuPaquet(paquet, 'arene-projet.json').activeAxes).toEqual(axes);
  });

  it('un paquet qui n’en déclare pas : aucune clé `activeAxes`', () => {
    expect('activeAxes' in areneCampaign).toBe(false);
    expect('activeAxes' in campagneDuJeu(areneCampaign)).toBe(false);
  });

  it('une campagne du jeu qui en déclare : la fabrique les transmet', () => {
    const c: BuiltinCampaign = { ...areneCampaign, activeAxes: axes };
    expect(campagneDuJeu(c).activeAxes).toEqual(axes);
  });

  it('une campagne du jeu qui en déclare : sa COPIE ouverte à l’éditeur les porte, en copie', () => {
    const c: BuiltinCampaign = { ...areneCampaign, activeAxes: axes };
    const copie = copieDuJeu(c);
    expect(copie.activeAxes).toEqual(axes);
    expect(copie.activeAxes).not.toBe(c.activeAxes);
    expect('activeAxes' in copieDuJeu(areneCampaign)).toBe(false);
  });

  it('une campagne du jeu qui en déclare : son EXPORT les écrit, et le document repasse la porte avec eux', () => {
    const c: BuiltinCampaign = { ...areneCampaign, activeAxes: axes };
    const doc = documentDuJeu(c);
    expect(doc.activeAxes).toEqual(axes);
    expect(parseProject(doc).activeAxes).toEqual(axes);
    expect('activeAxes' in documentDuJeu(areneCampaign)).toBe(false);
  });
});

/** `copieDuJeu` : ce que l'éditeur OUVRE d'une campagne du jeu (#367). */
describe('copieDuJeu — la copie d’une campagne du jeu', () => {
  const scene = (id: string) => ({ ...emptyScene(4, 4), id, label: id });
  const c: BuiltinCampaign = { ...areneCampaign, scenes: [scene('s1'), scene('s2'), scene('s3')], startSceneId: 's2' };

  it('le départ est la scène `startSceneId`, le reste garde son ordre', () => {
    const copie = copieDuJeu(c);
    expect(copie.depart.id).toBe('s2');
    expect(copie.autresScenes.map((s) => s.id)).toEqual(['s1', 's3']);
  });

  it('tout est copié en profondeur : l’édition ne touche jamais la campagne', () => {
    const copie = copieDuJeu(c);
    expect(copie.depart).not.toBe(c.scenes[1]);
    expect(copie.depart).toEqual(c.scenes[1]);
    expect(copie.narratif).not.toBe(c.narratif);
    expect(copie.worldMap).not.toBe(c.worldMap);
    expect(copie.worldMap).toEqual(c.worldMap);
  });

  it('l’identité est entière, sans le `label`', () => {
    const { scenes: _sc, startSceneId: _st, worldMap: _wm, narratif: _na, label: _lb, ...identite } = c;
    expect(copieDuJeu(c).identite).toEqual(identite);
  });

  it('un départ absent des scènes LÈVE', () => {
    expect(() => copieDuJeu({ ...c, startSceneId: 'absente' })).toThrow(/« absente »/);
  });
});
