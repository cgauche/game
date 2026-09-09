// @vitest-environment jsdom
/**
 * MODIFICATEURS AUTORITAIRES (#1687 lot 0) — mesuré sur le VRAI hook et de vrais `KeyboardEvent`.
 *
 * Un raccourci ne répond que si Ctrl/Alt/Maj tenus sont EXACTEMENT ceux qu'il déclare (`mods`) :
 *  • sans `mods`, il se TAIT sous un modificateur (Alt+D ne fait pas un pas d'exploration) ;
 *  • `Ctrl+KeyZ` déclenche l'annulation de l'éditeur, et `KeyZ` seul ne la déclenche pas.
 * L'éditeur passe par le PONT (`state/editeurBridge`) : pont vide (éditeur démonté), la touche ne
 * fait rien et ne jette pas.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { emptyScene } from '../state/scene';
import { resetStageWalk } from '../state/stageWalk';
import { publierEditeur } from '../state/editeurBridge';
import { useGameKeyboard } from './useGameKeyboard';
import { KEYBINDINGS, modsMatch, type KeyMod } from '../state/keybindings';

/** Raccourcis du registre que cette touche (code + modificateurs tenus) désigne — la SONDE du juge. */
const candidats = (code: string, tenus: KeyMod[]): string[] =>
  KEYBINDINGS.filter((k) => k.codes.includes(code) && modsMatch(k.mods ?? [], tenus)).map((k) => k.id);

function Harness() {
  useGameKeyboard();
  return null;
}

type Mods = { ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean; metaKey?: boolean };
const frapper = (type: 'keydown' | 'keyup', code: string, mods: Mods = {}) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true, cancelable: true, ...mods }));
  });

describe('raccourcis — les modificateurs font partie de la touche', () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    vi.useFakeTimers();
    resetStageWalk();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    const sc = emptyScene(12, 12);
    sc.id = 'raccourcis-mods';
    sc.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 6, y: 6 } });
    useGame.getState().startScene(sc);
    useGame.setState({
      screen: 'campaign', mode: 'exploration', partyPos: { x: 6, y: 6 },
      camRot: 0, camEdge: false, viewMode: undefined, povActive: false,
      dialogue: null, gameMenuOpen: false, merchant: null, worldMapOpen: false, battle: null,
      keyOverrides: {},
    } as never);
    act(() => root.render(<Harness />));
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    resetStageWalk();
    vi.useRealTimers();
  });

  it('un raccourci SANS `mods` se tait quand Alt ou Ctrl est tenu, et répond seul', () => {
    const depart = { ...useGame.getState().partyPos };
    frapper('keydown', 'KeyD', { altKey: true });
    frapper('keyup', 'KeyD', { altKey: true });
    expect(useGame.getState().partyPos, 'Alt+D a déclenché le pas d’exploration de D').toEqual(depart);
    frapper('keydown', 'KeyD', { ctrlKey: true });
    frapper('keyup', 'KeyD', { ctrlKey: true });
    expect(useGame.getState().partyPos, 'Ctrl+D a déclenché le pas d’exploration de D').toEqual(depart);
    // Référence positive : la même touche NUE agit bien (la garde n'est pas devenue muette).
    frapper('keydown', 'KeyD');
    frapper('keyup', 'KeyD');
    expect(useGame.getState().partyPos).not.toEqual(depart);
  });

  it('l’écran de jeu ne répond PAS aux touches déclarées de l’éditeur, et réciproquement', () => {
    const annuler = vi.fn();
    const retirer = publierEditeur({ annuler });
    frapper('keydown', 'KeyZ', { ctrlKey: true }); // écran de jeu : l'éditeur n'a pas la main
    expect(annuler, 'un raccourci d’éditeur a mordu sur l’écran de jeu').not.toHaveBeenCalled();
    useGame.setState({ screen: 'editor' } as never);
    frapper('keydown', 'KeyZ'); // sans Ctrl : ce n'est pas la touche déclarée
    expect(annuler, 'Z seul a déclenché l’annulation').not.toHaveBeenCalled();
    frapper('keydown', 'KeyZ', { ctrlKey: true });
    expect(annuler).toHaveBeenCalledOnce();
    retirer();
  });

  it('Ctrl+Maj+Z rétablit, et ce n’est PAS la touche de Ctrl+Z', () => {
    const annuler = vi.fn();
    const retablir = vi.fn();
    useGame.setState({ screen: 'editor' } as never);
    const retirer = publierEditeur({ annuler, retablir });
    frapper('keydown', 'KeyZ', { ctrlKey: true, shiftKey: true });
    expect(retablir, 'Ctrl+Maj+Z n’a pas rétabli').toHaveBeenCalledOnce();
    expect(annuler, 'Ctrl+Maj+Z a annulé (les modificateurs ne font pas partie de la touche)').not.toHaveBeenCalled();
    frapper('keyup', 'KeyZ', { ctrlKey: true, shiftKey: true });
    frapper('keydown', 'KeyZ', { ctrlKey: true });
    expect(annuler).toHaveBeenCalledOnce();
    expect(retablir, 'Ctrl+Z a rétabli').toHaveBeenCalledOnce();
    retirer();
  });

  it('touche NUE = POSITION physique quelle que soit la COUCHE : Maj+1 reste la case 1, Alt+1 non', () => {
    // Sur AZERTY, la rangée de chiffres EST la couche Maj : « 1 » se frappe Maj+`Digit1`. Une touche
    // nue qui refuserait Maj rendrait les cases 1-8 de la grille de capacités injouables.
    expect(candidats('Digit1', ['shift'])).toContain('hotbar-1');
    expect(candidats('Digit1', [])).toContain('hotbar-1');
    expect(candidats('Digit1', ['alt'])).not.toContain('hotbar-1');
    expect(candidats('Digit1', ['ctrl'])).not.toContain('hotbar-1');
    expect(candidats('Digit1', ['ctrl', 'alt']), 'AltGr COMPOSE un caractère, il ne frappe pas un raccourci').not.toContain('hotbar-1');
    // Ctrl+Z reste EXACT : Ctrl+Maj+Z est une autre touche, celle du rétablissement.
    expect(candidats('KeyZ', ['ctrl'])).toEqual(['editeur-annuler']);
    expect(candidats('KeyZ', ['ctrl', 'shift'])).toEqual(['editeur-retablir-maj']);
  });

  it('la couche Maj sur une touche NUE agit AUSSI dans le vrai hook (Maj+D = pas d’exploration)', () => {
    const depart = { ...useGame.getState().partyPos };
    frapper('keydown', 'KeyD', { shiftKey: true });
    frapper('keyup', 'KeyD', { shiftKey: true });
    expect(useGame.getState().partyPos, 'Maj+D n’a pas fait le pas d’exploration de D').not.toEqual(depart);
  });

  it('focus RÉSIDUEL d’un bouton : la flèche reste à l’application, l’item d’une liste la garde', () => {
    const deplacer = vi.fn();
    useGame.setState({ screen: 'editor' } as never);
    const retirer = publierEditeur({ deplacer });
    const bouton = document.createElement('button');
    document.body.appendChild(bouton);
    try {
      bouton.focus();
      expect(document.activeElement).toBe(bouton);
      frapper('keydown', 'ArrowRight');
      expect(deplacer, 'un bouton de palette encore focalisé mange la flèche de l’éditeur').toHaveBeenCalledWith(1, 0);
      // Le MÊME bouton, item d'une liste à roving tabindex : la flèche est à la liste, pas à l'éditeur.
      const liste = document.createElement('div');
      liste.setAttribute('role', 'listbox');
      document.body.appendChild(liste);
      liste.appendChild(bouton);
      bouton.focus();
      frapper('keyup', 'ArrowRight');
      frapper('keydown', 'ArrowRight');
      expect(deplacer, 'la flèche d’une liste à roving tabindex a AUSSI déplacé la sélection').toHaveBeenCalledOnce();
      liste.remove();
    } finally {
      bouton.remove();
      retirer();
    }
  });

  it('pont VIDE (éditeur démonté) : la touche ne fait rien et ne jette pas', () => {
    useGame.setState({ screen: 'editor' } as never);
    expect(() => {
      frapper('keydown', 'KeyZ', { ctrlKey: true });
      frapper('keydown', 'Escape');
      frapper('keydown', 'Space');
      frapper('keyup', 'Space');
    }).not.toThrow();
  });

  it('Échap de l’éditeur : la PRÉSENCE de `fermerMenuFichier` lui donne la touche, sinon désélection', () => {
    const fermerMenuFichier = vi.fn();
    const deselectionner = vi.fn();
    useGame.setState({ screen: 'editor' } as never);
    const retirerTout = publierEditeur({ deselectionner });
    const retirerMenu = publierEditeur({ fermerMenuFichier });
    frapper('keydown', 'Escape');
    expect(fermerMenuFichier).toHaveBeenCalledOnce();
    expect(deselectionner, 'le menu ouvert devait prendre la touche seul').not.toHaveBeenCalled();
    retirerMenu(); // le menu se ferme : la touche revient à la désélection
    frapper('keyup', 'Escape');
    frapper('keydown', 'Escape');
    expect(deselectionner).toHaveBeenCalledOnce();
    retirerTout();
  });
});
