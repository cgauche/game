import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { EffectList, newEffect } from './EffectList';
import type { Effect } from '../../state/scene';

const ctx = { encounters: [], dialogues: [] };

describe('EffectList — Effet setTime (jour/nuit via trigger, #T1c)', () => {
  it('newEffect("setTime") crée un défaut phase nuit', () => {
    expect(newEffect('setTime')).toEqual({ type: 'setTime', phase: 'nuit' });
  });
  it('un Effet setTime rend un sélecteur de phase (les 7 phases)', () => {
    const effects: Effect[] = [{ type: 'setTime', phase: 'nuit' } as Effect];
    const html = renderToStaticMarkup(<EffectList effects={effects} onChange={() => {}} ctx={ctx} />);
    expect(html).toMatch(/Régler l’heure sur/);
    expect(html).toContain('Nuit');
    expect(html).toContain('Aube');
  });
});

describe('selects guidés (audit M9) — fini les ids à taper', () => {
  it('learnSpell : sorts de la base en optgroups (plus de « libellé exact »)', () => {
    const html = renderToStaticMarkup(
      <EffectList effects={[{ type: 'learnSpell', spell: '', heroId: '' }]} onChange={() => {}} ctx={{ encounters: [], dialogues: [] }} />,
    );
    expect(html).toContain('<optgroup');
    expect(html).toContain('Fléchette');
    expect(html).not.toContain('Libellé exact');
  });

  it('transition : scènes du projet + points d’entrée quand le contexte les fournit', () => {
    const ctx = {
      encounters: [], dialogues: [],
      scenes: [
        { id: 'sc-a', nom: 'Village', entries: [] },
        { id: 'sc-b', nom: 'Taverne', entries: ['porte', 'cave'] },
      ],
    };
    const html = renderToStaticMarkup(
      <EffectList effects={[{ type: 'transition', scene: 'sc-b', entry: '' }]} onChange={() => {}} ctx={ctx} />,
    );
    expect(html).toContain('Village (sc-a)');
    expect(html).toContain('Taverne (sc-b)');
    expect(html).toContain('porte'); // points d'entrée de la scène choisie
    expect(html).not.toContain('id de la scène cible');
  });

  it('openMerchant : entités marchandes de la scène (ou explication si aucune)', () => {
    const withM = renderToStaticMarkup(
      <EffectList effects={[{ type: 'openMerchant', entityId: '' }]} onChange={() => {}}
        ctx={{ encounters: [], dialogues: [], merchants: [{ id: 'armurier', label: 'Maître armurier' }] }} />,
    );
    expect(withM).toContain('Maître armurier (armurier)');
    const without = renderToStaticMarkup(
      <EffectList effects={[{ type: 'openMerchant', entityId: '' }]} onChange={() => {}}
        ctx={{ encounters: [], dialogues: [], merchants: [] }} />,
    );
    expect(without).toContain('Aucune entité marchande');
  });
});

describe('#94 — Effets santé éditables (ambitionLost/inflictThirst/inflictPsychology)', () => {
  it('ambitionLost : champ héros rendu (modèle inflictNightmares)', () => {
    const html = renderToStaticMarkup(
      <EffectList effects={[{ type: 'ambitionLost', heroId: '' }]} onChange={() => {}} ctx={ctx} />,
    );
    expect(html).toMatch(/id du héros/);
  });

  it('inflictThirst : cible + jours (modèle inflictHunger)', () => {
    const html = renderToStaticMarkup(
      <EffectList effects={[{ type: 'inflictThirst', days: 2, target: 'party' }]} onChange={() => {}} ctx={ctx} />,
    );
    expect(html).toMatch(/Jours assoiffés/);
    expect(html).toContain('Tout le groupe');
  });

  it('inflictPsychology : kind/indice/label/cible rendus', () => {
    const html = renderToStaticMarkup(
      <EffectList effects={[{ type: 'inflictPsychology', kind: 'terreur', indice: 2, label: 'Un spectre hurlant', target: 'party' }]} onChange={() => {}} ctx={ctx} />,
    );
    expect(html).toContain('Terreur');
    expect(html).toMatch(/Indice/);
  });

  it('openPort : fallback texte quand le contexte ne fournit pas de carte du monde', () => {
    const html = renderToStaticMarkup(
      <EffectList effects={[{ type: 'openPort', placeId: '' }]} onChange={() => {}} ctx={ctx} />,
    );
    expect(html).toMatch(/id du lieu/);
  });

  it('openPort : lieux de la carte du monde (ou explication si aucun)', () => {
    const withP = renderToStaticMarkup(
      <EffectList effects={[{ type: 'openPort', placeId: '' }]} onChange={() => {}}
        ctx={{ encounters: [], dialogues: [], places: [{ id: 'port-marienburg', label: 'Marienburg' }] }} />,
    );
    expect(withP).toContain('Marienburg (port-marienburg)');
    expect(withP).not.toMatch(/id du lieu/);
    const without = renderToStaticMarkup(
      <EffectList effects={[{ type: 'openPort', placeId: '' }]} onChange={() => {}}
        ctx={{ encounters: [], dialogues: [], places: [] }} />,
    );
    expect(without).toContain('Aucun lieu sur la carte du monde');
  });
});
