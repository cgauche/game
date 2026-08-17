import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ActiveEffect, Combatant, ConditionInstance } from '../engine/types';
import { chipCodex, chipDetail, combatantFlags, summarizeEffects } from '../gameIso/effectIcons';
import { StateChips } from './StateChips';

const cond = (name: string, value = 1): ConditionInstance => ({ id: name, value } as ConditionInstance);

/** Héros minimal, patron `EtatPanel.test.tsx` (mkHero). */
const mkHero = (mut?: (c: Combatant) => void): Combatant => {
  const c = {
    id: 'h', name: 'H', kind: 'hero', species: 'humains-reiklander', career: 'soldat',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 },
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    conditions: [], skills: [], talents: [], movement: 4, items: [],
  } as unknown as Combatant;
  mut?.(c);
  return c;
};

describe('StateChips — pastilles de portrait', () => {
  it('État et buff informent par le MÊME mécanisme Codex que EffectChips', () => {
    const hero = mkHero((c) => {
      c.conditions = [cond('assourdi')];
      c.activeEffects = [{ label: 'Bénédiction de courage', bonus: 10, char: 'capacite-de-combat', duration: { scale: 'rounds', left: 3 }, sourceSpellId: 'benediction-de-courage' } as ActiveEffect];
    });
    const html = renderToStaticMarkup(<StateChips c={hero} />);
    expect(html).not.toContain('title=');
    expect((html.match(/codex-ref/g) ?? []).length).toBe(2);
  });

  it('le drapeau Peur du portrait ouvre SA fiche psychologique (routage par id stable, pas un popover générique)', () => {
    const hero = mkHero((c) => { c.psychState = [{ type: 'peur', indice: 2, calmeDR: 0 }] as Combatant['psychState']; });
    const chip = summarizeEffects([], [], Infinity, combatantFlags(hero)).visible[0];
    expect(chip.flagId).toBe('fear');
    expect(chipCodex(chip)).toMatchObject({ category: 'psychologies', id: 'peur' });
    expect(renderToStaticMarkup(<StateChips c={hero} />)).toContain('codex-ref');
  });

  it('la pastille garde sa classe de compacité `.pt-state` dans la colonne `.ptile-states`', () => {
    const hero = mkHero((c) => { c.conditions = [cond('assourdi')]; });
    const html = renderToStaticMarkup(<StateChips c={hero} />);
    expect(html).toContain('ptile-states');
    expect(html).toContain('pt-state');
  });

  it('le débord « ▾ » reste une pastille du même mécanisme (popover, pas d’infobulle)', () => {
    const hero = mkHero((c) => { c.conditions = [cond('assourdi'), cond('aveugle'), cond('empetre')]; });
    const html = renderToStaticMarkup(<StateChips c={hero} max={1} />);
    expect(html).not.toContain('title=');
    expect(html).toContain('ptile-more');
  });

  it('`reserve` garde l’empreinte stable de la cellule quand aucun effet n’est actif', () => {
    const html = renderToStaticMarkup(<StateChips c={mkHero()} reserve />);
    expect(html).toContain('ptile-states');
    expect(html).not.toContain('pt-state');
  });
});

/**
 * Spec HUD combat §1c-bis (rappel user 2026-08-17, verbatim : « une zone pour mettre les états
 * icônes et leur indice », « dans la barre du haut la même chose à côté de chaque portrait ») : le
 * rack `reserve` dessine SES cases, toujours le même nombre, chacune chiffrée quand elle a un
 * chiffre à dire.
 */
describe('StateChips — rack d’alvéoles RÉSERVÉES (mode `reserve`)', () => {
  const alveoles = (html: string) => (html.match(/pt-state|pt-void/g) ?? []).length;

  it('dessine EXACTEMENT `max` alvéoles, États ou pas — la carte ne change pas de taille', () => {
    const vide = renderToStaticMarkup(<StateChips c={mkHero()} max={6} reserve />);
    const un = renderToStaticMarkup(<StateChips c={mkHero((c) => { c.conditions = [cond('assourdi')]; })} max={6} reserve />);
    const trois = renderToStaticMarkup(<StateChips c={mkHero((c) => { c.conditions = [cond('assourdi'), cond('aveugle'), cond('empetre')]; })} max={6} reserve />);
    expect(alveoles(vide)).toBe(6);
    expect(alveoles(un)).toBe(6);
    expect(alveoles(trois)).toBe(6);
    // Les cases non remplies sont DESSINÉES (vides), pas absentes.
    expect((vide.match(/pt-void/g) ?? []).length).toBe(6);
    expect((trois.match(/pt-void/g) ?? []).length).toBe(3);
  });

  it('le débord prend la DERNIÈRE alvéole : 8 États tiennent encore en 6 cases', () => {
    const huit = ['assourdi', 'aveugle', 'empetre', 'a-terre', 'hemorragique', 'sonne', 'extenue', 'empoisonne'].map((id) => cond(id));
    const html = renderToStaticMarkup(<StateChips c={mkHero((c) => { c.conditions = huit; })} max={6} reserve />);
    expect(alveoles(html)).toBe(6);
    expect(html).toContain('ptile-more');
  });

  it('chaque alvéole porte son CHIFFRE : pions de l’État, DR de Focalisation, Indice de Peur', () => {
    const hero = mkHero((c) => {
      c.conditions = [cond('hemorragique', 3)];
      c.psychState = [{ type: 'peur', indice: 2, calmeDR: 0 }] as Combatant['psychState'];
      c.focus = { dr: 4 } as Combatant['focus'];
    });
    const html = renderToStaticMarkup(<StateChips c={hero} max={6} reserve />);
    const chiffres = [...html.matchAll(/<b class="pt-n">(\d+)<\/b>/g)].map((m) => m[1]);
    // Ordre de `summarizeEffects` : malus (par sévérité) → états-drapeaux → buffs.
    expect(chiffres).toEqual(['3', '4', '2']);
  });

  it('un État à 1 pion dit « 1 » (l’icône seule ne disait pas combien)', () => {
    const html = renderToStaticMarkup(<StateChips c={mkHero((c) => { c.conditions = [cond('assourdi')]; })} max={6} reserve />);
    expect(html).toContain('<b class="pt-n">1</b>');
  });

  // Spec HUD combat §1c-bis/§1c : les États de SITUATION de l'arche (Assailli ×N, Cloué, Renfort)
  // ne vivent pas sur le Combatant — ils entrent dans le MÊME rack par `extra`, jamais dans une
  // seconde rangée de chips.
  it('`extra` entre dans le MÊME rack, chiffre compris, sans ajouter d’alvéole', () => {
    const assailli = { key: 'a-assailli', icon: 'action/attack', label: 'Assailli', kind: 'state', severity: 58, indice: 3 } as const;
    const html = renderToStaticMarkup(
      <StateChips c={mkHero((c) => { c.conditions = [cond('assourdi')]; })} max={4} reserve extra={[{ ...assailli }]} />,
    );
    expect(alveoles(html)).toBe(4);
    expect((html.match(/pt-state/g) ?? []).length).toBe(2);
    expect(html).toContain('<b class="pt-n">3</b>');
  });

  it('une pastille `extra` SANS règle résolue reste nue (aucun `CodexRef`, aucune infobulle)', () => {
    const html = renderToStaticMarkup(
      <StateChips c={mkHero()} max={4} reserve extra={[{ key: 'a-assailli', icon: 'action/attack', label: 'Assailli', kind: 'state', severity: 58, indice: 2 }]} />,
    );
    expect(html).not.toContain('codex-ref');
    expect(html).not.toContain('title=');
  });
});

/**
 * #1117 (recette 2) — clé React DUPLIQUÉE (`b-exposition-froid`, 30 occurrences console). CAUSE
 * MESURÉE : l'Exposition pose un `ActiveEffect` PAR CARACTÉRISTIQUE (LDB 18 l.334 : −10 CT/Agilité/
 * Dextérité au 1ᵉʳ échec, toutes les autres au 2ᵉ) — jusqu'à 10 effets partageant `effectId`. Les
 * DEUX paliers sont légitimes et cumulatifs (aucune double application) : c'est l'AFFICHAGE qui doit
 * les rendre en UNE pastille comptée.
 */
describe('StateChips — effets posés par Caractéristique : UNE pastille comptée (#1117)', () => {
  const expo = (char: string): ActiveEffect =>
    ({ label: 'Exposition (froid)', effectId: 'exposition-froid', char, bonus: -10, duration: { scale: 'permanent' } } as ActiveEffect);

  /** Les deux paliers du froid, tels que `applyExposureFailure` les pose (3 puis 7 caracs). */
  const deuxPaliers = ['capacite-de-tir', 'agilite', 'dexterite', 'capacite-de-combat', 'force', 'endurance', 'initiative', 'intelligence', 'force-mentale', 'sociabilite'].map(expo);

  it('la pastille groupée ne dit QUE des faits : jamais la carac du PREMIER effet pour tout le groupe', () => {
    // Sonde du juge (#1117) promue : 10 effets sur 10 caracs DIFFÉRENTES. « −10 Capacité de Tir ×10 »
    // se lisait −100 CT — mensonge. La pastille dit la PORTÉE réelle du bonus uniforme.
    const chip = summarizeEffects([], deuxPaliers, Infinity, combatantFlags(mkHero())).visible
      .find((v) => v.effectId === 'exposition-froid')!;
    expect(chip.char, 'aucune carac unique pour un groupe hétérogène').toBeUndefined();
    expect(chip.count, 'aucun ×N ambigu (il se lirait comme un cumul sur UNE carac)').toBeUndefined();
    expect(chip.charCount).toBe(10);
    expect(chipDetail(chip)).toBe('-10 sur 10 Caractéristiques');
    expect(chipDetail(chip)).not.toContain('Capacité de Tir');
    expect(chipDetail(chip)).not.toContain('×');
  });

  it('groupe HOMOGÈNE (même carac, même bonus) : le ×N reste honnête', () => {
    const memeCarac = [expo('agilite'), expo('agilite'), expo('agilite')];
    const chip = summarizeEffects([], memeCarac, Infinity, combatantFlags(mkHero())).visible
      .find((v) => v.effectId === 'exposition-froid')!;
    expect(chip.char).toBe('agilite');
    expect(chip.count).toBe(3);
    expect(chipDetail(chip)).toBe('-10 Agilité · ×3');
  });

  it('IVRESSE (malus multi-caracs, même `effectId`) : même forme honnête', () => {
    const ivre = (char: string, bonus: number) =>
      ({ label: 'Ivresse', effectId: 'ivresse', char, bonus, duration: { scale: 'permanent' } } as ActiveEffect);
    const chip = summarizeEffects([], [ivre('agilite', -10), ivre('intelligence', -10), ivre('dexterite', -10)], Infinity, combatantFlags(mkHero())).visible
      .find((v) => v.effectId === 'ivresse')!;
    expect(chip.char).toBeUndefined();
    expect(chipDetail(chip)).toBe('-10 sur 3 Caractéristiques');
  });

  it('bonus NON uniforme dans le groupe : aucun chiffre — l’identité seule (le détail vit au clic)', () => {
    const mixte = [
      { label: 'Ivresse', effectId: 'ivresse', char: 'agilite', bonus: -10, duration: { scale: 'permanent' } } as ActiveEffect,
      { label: 'Ivresse', effectId: 'ivresse', char: 'sociabilite', bonus: 10, duration: { scale: 'permanent' } } as ActiveEffect,
    ];
    const chip = summarizeEffects([], mixte, Infinity, combatantFlags(mkHero())).visible
      .find((v) => v.effectId === 'ivresse')!;
    expect(chip.bonus).toBeUndefined();
    expect(chip.char).toBeUndefined();
    expect(chipDetail(chip)).toBe('');
  });

  it('les 10 effets d’Exposition donnent UNE seule pastille (clés uniques, aucun doublon)', () => {
    const chips = summarizeEffects([], deuxPaliers, Infinity, combatantFlags(mkHero())).visible;
    const expoChips = chips.filter((v) => v.effectId === 'exposition-froid');
    expect(expoChips).toHaveLength(1);
    expect(expoChips[0].charCount, 'la pastille porte la PORTÉE du groupe').toBe(10);
    const keys = chips.map((v) => v.key);
    expect(new Set(keys).size, 'aucune clé dupliquée (l’avertissement React venait de là)').toBe(keys.length);
  });

  it('deux effets DISTINCTS gardent chacun leur pastille (le regroupement ne fusionne pas tout)', () => {
    const autre = { label: 'Bénédiction', effectId: 'benediction-bataille', char: 'capacite-de-combat', bonus: 10, duration: { scale: 'permanent' } } as ActiveEffect;
    const chips = summarizeEffects([], [...deuxPaliers, autre], Infinity, combatantFlags(mkHero())).visible;
    expect(chips.filter((v) => v.effectId === 'exposition-froid')).toHaveLength(1);
    expect(chips.filter((v) => v.effectId === 'benediction-bataille')).toHaveLength(1);
  });

  it('le rendu ne répète plus la même identité d’affichage', () => {
    const hero = mkHero((c) => { c.activeEffects = deuxPaliers; });
    const html = renderToStaticMarkup(<StateChips c={hero} max={4} />);
    expect(html.match(/pt-state/g) ?? [], 'une seule pastille pour les 10 effets').toHaveLength(1);
  });
});
