// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { EffectList, newEffect, EFFECT_MENU_GROUPS } from './EffectList';
import { convertTo } from './AddMenu';
import type { Effect } from '../../state/scene';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

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

describe('changer le type d’un effet CONVERTIT — un seul vocabulaire, un seul geste', () => {
  it('les champs que le type visé connaît aussi gardent leur valeur (fonction pure)', () => {
    const memoire = { type: 'journal', desc: 'Le plancher gemit' };
    expect(convertTo(newEffect('document'), memoire, 'type')).toEqual({
      type: 'document', title: '', desc: 'Le plancher gemit',
    });
  });

  it('ajouter et changer le type proposent EXACTEMENT le même vocabulaire', () => {
    // Un seul registre publié (`EFFECT_MENU_GROUPS`) : les deux menus le consomment tel quel.
    const rubriques = EFFECT_MENU_GROUPS.length;
    const types = EFFECT_MENU_GROUPS.reduce((n, groupe) => n + groupe.items.length, 0);
    expect(rubriques).toBeGreaterThan(0);
    expect(types).toBeGreaterThan(0);
    const html = renderToStaticMarkup(
      <EffectList effects={[{ type: 'journal', desc: 'Le plancher gemit' }]} onChange={() => {}} ctx={ctx} />,
    );
    // Le choix du type passe par le MÊME menu que l'ajout — plus aucun `<select>` de type.
    expect(html).toContain('Type : Journal');
    expect(html).not.toContain('eff-type');
  });

  it('le texte saisi SURVIT au changement de type, et à l’aller-retour Journal → Flag → Journal', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    let dernier: Effect[] = [];
    function ListeControlee() {
      const [effects, setEffects] = useState<Effect[]>([{ type: 'journal', desc: 'Le plancher gemit' }]);
      return <EffectList effects={effects} ctx={ctx} onChange={(next) => { dernier = next; setEffects(next); }} />;
    }
    await act(async () => {
      root.render(<ListeControlee />);
    });
    /** Rangée du menu de TYPE de l'effet (pas du menu d'ajout, qui vit hors de la rangée). */
    const choisirType = async (libelle: string) => {
      const menu = Array.from(container.querySelectorAll('.eff-row .eff-add')).find(
        (details) => details.querySelector('summary')?.textContent?.startsWith('Type :'),
      )!;
      const rangee = Array.from(menu.querySelectorAll('.listrow')).find(
        (row) => row.textContent?.trim() === libelle,
      ) as HTMLButtonElement;
      await act(async () => {
        rangee.click();
      });
    };

    await choisirType('Document (handout)');
    expect(dernier[0]).toEqual({ type: 'document', title: '', desc: 'Le plancher gemit' });

    await choisirType('Définir un flag');
    expect(dernier[0].type).toBe('setFlag');
    expect(dernier[0]).not.toHaveProperty('desc'); // le document ne porte que les champs de SON type

    await choisirType('Journal');
    expect(dernier[0]).toEqual({ type: 'journal', desc: 'Le plancher gemit' });

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});

describe('#1318 E1 — les bornes des rangées d’atelier sont TENUES à la saisie (cale de NumberField)', () => {
  it('startPursuit : la distance de départ reste dans 1–9 et le seuil d’évasion au-dessus de 2', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    let dernier: Effect[] = [];
    function ListeControlee() {
      const [effects, setEffects] = useState<Effect[]>([
        { type: 'startPursuit', distance: 4, escapeAt: 10 } as unknown as Effect,
      ]);
      return <EffectList effects={effects} ctx={ctx} onChange={(next) => { dernier = next; setEffects(next); }} />;
    }
    await act(async () => { root.render(<ListeControlee />); });

    const champ = (nom: string): HTMLInputElement => {
      const el = container.querySelector(`input[aria-label="${nom}"]`);
      if (!el) throw new Error(`champ « ${nom} » introuvable`);
      return el as HTMLInputElement;
    };
    const saisir = async (el: HTMLInputElement, valeur: string) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      await act(async () => {
        setter.call(el, valeur);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });
    };

    // La borne haute est VIVANTE : le moteur borne la distance à `escapeAt - 1` (pursuitFlow.ts l.234).
    await saisir(champ('Distance de départ'), '99');
    expect((dernier[0] as unknown as { distance: number }).distance).toBe(9);
    await saisir(champ('Distance de départ'), '0');
    expect((dernier[0] as unknown as { distance: number }).distance).toBe(1);

    await saisir(champ("Seuil d'évasion"), '6');
    expect((dernier[0] as unknown as { escapeAt: number }).escapeAt).toBe(6);
    await saisir(champ('Distance de départ'), '99');
    expect((dernier[0] as unknown as { distance: number }).distance).toBe(5);

    await saisir(champ("Seuil d'évasion"), '1');
    expect((dernier[0] as unknown as { escapeAt: number }).escapeAt).toBe(2);

    await act(async () => { root.unmount(); });
    container.remove();
  });

  it('giveMoney : chaque champ écrit SA clé de `Money` DANS l’enveloppe `montant` (pistole = silver, sou = brass, money.ts l.9)', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    let dernier: Effect[] = [];
    function ListeControlee() {
      const [effects, setEffects] = useState<Effect[]>([{ type: 'giveMoney', montant: { gold: 0, silver: 0, brass: 0 } } as unknown as Effect]);
      return <EffectList effects={effects} ctx={ctx} onChange={(next) => { dernier = next; setEffects(next); }} />;
    }
    await act(async () => { root.render(<ListeControlee />); });
    const champ = (nom: string): HTMLInputElement => {
      const el = container.querySelector(`input[aria-label="${nom}"]`);
      if (!el) throw new Error(`champ « ${nom} » introuvable`);
      return el as HTMLInputElement;
    };
    const saisir = async (el: HTMLInputElement, valeur: string) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      await act(async () => {
        setter.call(el, valeur);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });
    };
    await saisir(champ('Sous de cuivre'), '7');
    expect(dernier[0]).toMatchObject({ montant: { brass: 7, silver: 0, gold: 0 } });
    await saisir(champ('Pistoles d’argent'), '3');
    expect(dernier[0]).toMatchObject({ montant: { silver: 3, brass: 7 } });
    await saisir(champ('Couronnes d’or'), '2');
    expect(dernier[0]).toMatchObject({ montant: { gold: 2, silver: 3, brass: 7 } });
    // Le libellé VISIBLE suit la même clé (notation LDB 57 : CO / pa / sc).
    const rangee = container.querySelector('.money-fields')!;
    expect([...rangee.querySelectorAll('label')].map((l) => l.textContent?.trim())).toEqual(['CO', 'pa', 'sc']);

    await act(async () => { root.unmount(); });
    container.remove();
  });
});
