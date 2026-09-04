// @vitest-environment jsdom
/**
 * #1657 B3-2b-b — l'écran qui rend les STATIONS jouables. Le moteur savait déjà QUI se trouve où
 * (`crewTarget.stations`, B3-2b-a) mais aucune surface ne posait `Combatant.shipStation` : le
 * catalogue était donc inerte en jeu. Ce contrat verrouille les trois choses que l'écran doit tenir :
 *  (1) les 5 stations du catalogue sont OFFERTES (aucune n'est filtrée en silence), le clic ÉPINGLE ;
 *  (2) une station que la coque n'a pas (`requiresTrait` — `MSRC 07 l.94`, `MDG 12 l.303`) reste
 *      VISIBLE, éteinte, et dit POURQUOI (raison atteignable, jamais un bouton muet) ;
 *  (3) aucune station n'est INFÉRÉE : sans épinglage, le héros n'en tient aucune, et rien ne porte le
 *      badge « auto » du roster (le livre demande qui se TROUVE là, pas qui saurait y servir).
 * Rendu jsdom (`createRoot`) : le panneau lit le store, et le repli/dépli est un état React.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, afterEach } from 'vitest';
import { useGame, type BattleState } from '../state/store';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { navalTraitsDe } from '../engine/navalTraits';
import { shipStations } from '../data';
import type { Combatant } from '../engine/types';
import { ShipStationsPanel } from './ShipStationsPanel';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;
afterEach(() => { act(() => root?.unmount()); container?.remove(); root = null; container = null; });

/** Deux héros au groupe — le roster est héros-first (une ligne par héros, sa station au bouton). */
function poserGroupe(): Combatant[] {
  const rng = makeRNG(7);
  const gunnar = { ...createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Gunnar', rng }), id: 'gunnar' };
  const lise = { ...createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Lise', rng }), id: 'lise' };
  // L'équipage vit AUSSI dans la bataille en mer (`setShipStation` patche les deux) : la fixture
  // porte donc une file de combat, sans quoi le contrat ne mesurerait que la moitié de l'action.
  const battle = { combatants: [gunnar, lise], log: [], round: 1, turn: 0 } as unknown as BattleState;
  useGame.setState({ party: [gunnar, lise], battle, massBattle: null, interlude: null, journal: [] });
  return [gunnar, lise];
}

/** Monte le panneau sur la coque d'un véhicule RÉEL (ses Traits navals décident des stations ouvertes). */
function monter(vehicleId: string): HTMLDivElement {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root!.render(<ShipStationsPanel traits={navalTraitsDe(vehicleId, undefined)} />); });
  return container;
}

/** Déplie la grille d'options du héros `n` (0-based) : son bouton de station porte `aria-expanded`. */
function deplier(el: HTMLDivElement, n = 0): void {
  const btns = [...el.querySelectorAll('button[aria-expanded]')] as HTMLButtonElement[];
  act(() => { btns[n].click(); });
}

const optionNommee = (el: HTMLDivElement, label: string): HTMLButtonElement | undefined =>
  ([...el.querySelectorAll('.rm-loc-grid button')] as HTMLButtonElement[]).find((b) => b.textContent?.includes(label));

describe('ShipStationsPanel — le joueur ÉPINGLE une station (#1657 B3-2b-b)', () => {
  it('1. les 5 stations du catalogue sont offertes, et le titre est celui de la maquette', () => {
    poserGroupe();
    const el = monter('barge-fluviale');
    expect(el.textContent).toContain('Stations à bord');
    deplier(el);
    for (const s of shipStations) {
      expect(optionNommee(el, s.label), `${s.id} offerte`).toBeTruthy();
    }
    expect(shipStations.length, 'le catalogue fermé nommé par les livres').toBe(5);
  });

  it('2. aucune station par DÉFAUT : la case est VIDE, SANS MOT, et rien n’est « auto »', () => {
    poserGroupe();
    const el = monter('barge-fluviale');
    const cases = [...el.querySelectorAll('button[aria-expanded]')] as HTMLButtonElement[];
    expect(cases, 'une case par héros').toHaveLength(2);
    for (const b of cases) {
      // Arbitrage user 2026-09-04 : une case vide ne porte AUCUN mot — ni « — choisir — », ni
      // « Libre ». Elle garde son affordance (glyphe) et son nom accessible, pas un libellé.
      expect(b.textContent?.trim(), 'aucun mot dans la case vide').toBe('');
      expect(b.querySelector('svg'), 'l’affordance reste visible (glyphe du pipeline d’icônes)').toBeTruthy();
      expect(b.getAttribute('aria-label'), 'muette à l’écran, jamais dans l’arbre a11y').toMatch(/Stations à bord/);
    }
    // Aucun LIBELLÉ de station n'est affiché : le contrat porte sur l'absence de la valeur, pas sur
    // l'absence d'un texte de remplacement (sonde du juge : une inférence ferait mentir « auto »).
    for (const s of shipStations) expect(cases.some((b) => b.textContent?.includes(s.label)), s.id).toBe(false);
    expect(el.textContent, 'le badge « auto » du roster n’a rien à annoncer ici').not.toContain('(auto)');
  });

  it('2bis. une station INFÉRÉE se dénoncerait par le badge « auto » (sonde de mutation)', () => {
    poserGroupe();
    const el = monter('barge-fluviale');
    // Sain : ni libellé, ni badge. `currentOf` qui déduirait une station sans épinglage ferait
    // apparaître les deux — c'est ce que le contrat 2 interdit, mesuré ici sur la MÊME primitive.
    expect(el.textContent).not.toContain('(auto)');
    expect(el.textContent).not.toContain('Pont');
  });

  it('3. le clic ÉPINGLE la station sur le héros (party ET bataille — `setShipStation`)', () => {
    const [gunnar] = poserGroupe();
    const el = monter('barge-fluviale');
    const dans = (ou: 'party' | 'bataille') => (ou === 'party'
      ? useGame.getState().party
      : useGame.getState().battle!.combatants).find((h) => h.id === gunnar.id)!.shipStation;
    deplier(el, 0);
    act(() => { optionNommee(el, 'Avirons')!.click(); });
    expect(dans('party')).toBe('avirons');
    expect(dans('bataille'), 'l’équipage vit dans la file de combat en mer').toBe('avirons');
    // Re-cliquer la MÊME station détache (sémantique partagée du roster, `nextPinned`).
    deplier(el, 0);
    act(() => { optionNommee(el, 'Avirons')!.click(); });
    expect(dans('party')).toBeUndefined();
    expect(dans('bataille')).toBeUndefined();
  });

  it('4. « Cale » sur une BARQUE (bateau ouvert, MSRC 07 l.70) : offerte, éteinte, et elle DIT pourquoi', () => {
    poserGroupe();
    const el = monter('barque-fluviale');
    deplier(el);
    const cale = optionNommee(el, 'Cale')!;
    expect(cale, 'la station fermée reste VISIBLE — jamais masquée en silence').toBeTruthy();
    expect(cale.getAttribute('aria-disabled'), 'atteignable au clavier/à la manette, mais inerte').toBe('true');
    const raison = el.querySelector(`#${cale.getAttribute('aria-describedby')}`);
    expect(raison?.textContent, 'la raison NOMME le Trait naval manquant (MSRC 07 l.94)').toContain('Cale');
    // Le clic sur une station fermée n'épingle RIEN.
    act(() => { cale.click(); });
    expect(useGame.getState().party.every((h) => h.shipStation === undefined)).toBe(true);
  });

  it('5. « Cale » sur la BARGE commerciale (MSRC 10 l.90) : ouverte, épinglable', () => {
    poserGroupe();
    const el = monter('barge-fluviale');
    deplier(el);
    const cale = optionNommee(el, 'Cale')!;
    expect(cale.getAttribute('aria-disabled'), 'la barge porte le Trait « cale »').toBeNull();
    act(() => { cale.click(); });
    expect(useGame.getState().party[0].shipStation).toBe('cale');
  });

  it('6. « Nid-de-pie » : amélioration payante (MDG 12 l.299) — fermée sur une coque qui ne la porte pas', () => {
    poserGroupe();
    const el = monter('cogue');
    deplier(el);
    expect(optionNommee(el, 'Nid-de-pie')!.getAttribute('aria-disabled')).toBe('true');
    expect(optionNommee(el, 'Pont')!.getAttribute('aria-disabled'), 'toute coque a un pont').toBeNull();
  });
});
