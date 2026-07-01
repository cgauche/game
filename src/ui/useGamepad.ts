/**
 * Couche MANETTE du combat (Gamepad API W3C, mapping « standard »). PRINCIPE : la manette ne crée
 * AUCUN chemin parallèle — elle dispatche EXACTEMENT les mêmes intentions que le clavier. La table
 * d'intentions partagée EST le registre de raccourcis (`runBindingById`) ; la nav de focus des
 * menus/modales réutilise le filtre VISIBLE partagé de `Modal` (`visibleFocusables`). Tout passe par
 * les MÊMES `padDir`/`padButton` exportés ici — le hook (vraie manette) ET le shim DEV (Playwright,
 * sans pad réel) les appellent à l'identique, zéro logique dupliquée.
 */
import { useEffect } from 'react';
import { useGame } from '../state/store';
import { runBindingById } from '../state/keybindings';
import { visibleFocusables } from './Modal';

/** Contexte d'entrée courant (DOM pur, pas d'état React) : une modale ouverte capte tout ; sinon, le
 *  focus dans la barre d'action = navigation de menu ; à défaut = pilotage de la carte (curseur). */
type PadCtx = 'modal' | 'menu' | 'map';
function padContext(): PadCtx {
  if (document.querySelector('[role="dialog"]')) return 'modal';
  const ae = document.activeElement;
  if (ae && ae.closest('.action-bar')) return 'menu';
  return 'map';
}

/** Conteneur ACTIF du contexte focus : la modale du DESSUS (dernier `[role=dialog]`, cohérent avec le
 *  piège Tab de `Modal`) ou la barre d'action. `null` en contexte carte (pas de nav de focus). */
function activeContainer(ctx: PadCtx): HTMLElement | null {
  if (ctx === 'modal') {
    const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]');
    return dialogs[dialogs.length - 1] ?? null;
  }
  if (ctx === 'menu') return document.querySelector<HTMLElement>('.action-bar');
  return null;
}

/** Avance le focus d'un cran dans un conteneur, en boucle. Source de la liste = `visibleFocusables`
 *  (focusables VISIBLES, déjà filtrés `disabled`/invisibles) — on NE réimplémente PAS le filtre. */
function focusStep(container: HTMLElement, dir: -1 | 1): void {
  const els = visibleFocusables(container);
  if (!els.length) return;
  const cur = els.indexOf(document.activeElement as HTMLElement);
  // Aucun focus dans le conteneur (cur < 0) → on entre par le 1er (avant) ou le dernier (arrière).
  const next = cur < 0 ? (dir === 1 ? 0 : els.length - 1) : (cur + dir + els.length) % els.length;
  els[next].focus();
}

export type PadDir = 'up' | 'down' | 'left' | 'right';
export type PadButton = 'A' | 'B' | 'X' | 'Y' | 'LB' | 'RB' | 'LT' | 'RT' | 'Back';

/** POV : croix/stick → intention CAP-RELATIVE (haut/bas = avance/recul, gauche/droite = pivot du regard).
 *  Le pas latéral (strafe) vit sur les gâchettes LB/RB (cf. `padButton`). */
const POV_DIR: Record<PadDir, string> = { up: 'pov-forward', down: 'pov-back', left: 'pov-turn-l', right: 'pov-turn-r' };

/** Direction (croix/stick) : sur la CARTE elle pilote le curseur de combat via le MÊME id de raccourci
 *  que les flèches (`cursor-<dir>`) ; en menu/modale elle déplace le focus DOM (haut/gauche = arrière,
 *  bas/droite = avant). Framework-agnostique (appelée par le hook ET le shim DEV). */
export function padDir(dir: PadDir): void {
  const ctx = padContext();
  if (ctx === 'map') {
    // Carte : combat → curseur de visée ; exploration iso → pas du groupe ; POV → avance/recul + pivot.
    // Les trois `when` sont DISJOINTS (inBattle ⊥ exploration!povActive ⊥ exploringPov) → un seul agit ;
    // même registre, aucun chemin parallèle.
    runBindingById('cursor-' + dir, useGame.getState);
    runBindingById('explore-' + dir, useGame.getState);
    runBindingById(POV_DIR[dir], useGame.getState);
    return;
  }
  const container = activeContainer(ctx);
  if (container) focusStep(container, dir === 'down' || dir === 'right' ? 1 : -1);
}

/** Bouton de manette → intention CONTEXTUELLE (cf. table de la spec). Tout ce qui agit sur le combat
 *  passe par `runBindingById` (garde `when` + action `run` portées une seule fois, côté clavier) ;
 *  l'activation/sortie d'un menu/modale manipule le focus DOM. Aucun nom d'entité codé en dur. */
export function padButton(name: PadButton): void {
  const ctx = padContext();
  const get = useGame.getState;
  const ae = document.activeElement as HTMLElement | null;
  switch (name) {
    case 'A': // valider : carte = commencer le Round (si pause) PUIS commit du curseur ; menu/modale = activer le focus.
      if (ctx === 'map') { runBindingById('round-start', get); runBindingById('cursor-commit', get); } // gardés par `when` → un seul agit
      else ae?.click();
      break;
    case 'B': // annuler : carte = annuler le curseur ; menu = ressortir (blur) ; modale = Échap
      if (ctx === 'map') runBindingById('cursor-cancel', get);
      else if (ctx === 'menu') ae?.blur();
      else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      break;
    case 'X': // carte : combat = focus la barre d'action ; exploration (pas de barre) = bascule le POV. menu = revenir carte.
      if (ctx === 'map') {
        const bar = document.querySelector<HTMLElement>('.action-bar');
        if (bar) visibleFocusables(bar)[0]?.focus();
        else runBindingById('toggle-pov', get); // exploration : X commute la vue subjective
      } else if (ctx === 'menu') ae?.blur();
      break;
    case 'Y': // fin du tour (carte et menu ; inerte en modale)
      if (ctx !== 'modal') runBindingById('end-turn', get);
      break;
    case 'LB': // carte : cible précédente (combat) / pas latéral gauche (POV) — gardes `when` disjointes
      if (ctx === 'map') { runBindingById('target-prev', get); runBindingById('pov-strafe-l', get); }
      break;
    case 'RB': // carte : cible suivante (combat) / pas latéral droit (POV)
      if (ctx === 'map') { runBindingById('target-next', get); runBindingById('pov-strafe-r', get); }
      break;
    case 'LT': // caméra : tourner à gauche (carte et menu)
      if (ctx !== 'modal') runBindingById('cam-left', get);
      break;
    case 'RT': // caméra : tourner à droite (carte et menu)
      if (ctx !== 'modal') runBindingById('cam-right', get);
      break;
    case 'Back': // caméra : recentrer (carte et menu)
      if (ctx !== 'modal') runBindingById('cam-recenter', get);
      break;
  }
}

// ── Mapping « standard » W3C (https://w3c.github.io/gamepad/#remapping) ──────────────────────────
const BUTTON_MAP: Record<number, PadButton> = { 0: 'A', 1: 'B', 2: 'X', 3: 'Y', 4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT', 8: 'Back' };
const DPAD_INDEX: Record<PadDir, number> = { up: 12, down: 13, left: 14, right: 15 };
const DIRS: PadDir[] = ['up', 'down', 'left', 'right'];
const DEAD = 0.5; // zone morte du stick analogique
const REPEAT_DELAY = 250; // 1er auto-repeat (après le déclenchement immédiat)
const REPEAT_RATE = 110; // cadence d'auto-repeat ensuite

/** Direction active ce frame : croix directionnelle OU stick au-delà de la zone morte (axe 0 = X,
 *  axe 1 = Y, Y vers le bas). Les deux sources alimentent la MÊME direction. */
function dirActive(gp: Gamepad, dir: PadDir): boolean {
  if (gp.buttons[DPAD_INDEX[dir]]?.pressed) return true;
  const ax = dir === 'left' || dir === 'right' ? gp.axes[0] ?? 0 : gp.axes[1] ?? 0;
  return dir === 'right' || dir === 'down' ? ax > DEAD : ax < -DEAD;
}

/**
 * Monte la boucle de lecture de la manette + le shim DEV. La boucle `requestAnimationFrame` démarre au
 * `gamepadconnected` (ou si un pad est déjà branché au montage) et s'arrête au cleanup / quand le dernier
 * pad est débranché. Elle lit `navigator.getGamepads()[0]`, détecte les FRONTS MONTANTS des boutons
 * (→ `padButton`) et la répétition douce des directions (immédiat, puis 250 ms, puis 110 ms → `padDir`).
 * `performance.now()` est OK ici : runtime navigateur, pas un workflow.
 */
export function useGamepad(): void {
  useEffect(() => {
    let raf = 0;
    let running = false;
    const prev: boolean[] = []; // état précédent de chaque bouton (détection de front montant)
    const repeatAt: Partial<Record<PadDir, number>> = {}; // prochain instant de répétition par direction

    const frame = () => {
      const pads = navigator.getGamepads?.();
      const gp = pads && pads[0];
      if (gp) {
        const now = performance.now();
        // Boutons : fronts montants uniquement (pas de répétition tant que maintenu).
        for (const k in BUTTON_MAP) {
          const i = Number(k);
          const pressed = !!gp.buttons[i]?.pressed;
          if (pressed && !prev[i]) padButton(BUTTON_MAP[i]);
          prev[i] = pressed;
        }
        // Directions (croix + stick) : 1er pas immédiat, puis auto-repeat doux ; relâché = remis à zéro.
        for (const dir of DIRS) {
          if (dirActive(gp, dir)) {
            const due = repeatAt[dir];
            if (due == null) { padDir(dir); repeatAt[dir] = now + REPEAT_DELAY; }
            else if (now >= due) { padDir(dir); repeatAt[dir] = now + REPEAT_RATE; }
          } else delete repeatAt[dir];
        }
      }
      raf = requestAnimationFrame(frame);
    };

    const start = () => { if (!running) { running = true; raf = requestAnimationFrame(frame); } };
    const stop = () => { running = false; cancelAnimationFrame(raf); };
    const onDisconnect = () => { if (!navigator.getGamepads?.().some((g) => g)) stop(); };

    window.addEventListener('gamepadconnected', start);
    window.addEventListener('gamepaddisconnected', onDisconnect);
    if (navigator.getGamepads?.().some((g) => g)) start(); // pad déjà présent au montage

    return () => {
      window.removeEventListener('gamepadconnected', start);
      window.removeEventListener('gamepaddisconnected', onDisconnect);
      stop();
    };
  }, []);

  // Shim DEV (même pattern que `__wfrpSetHover` dans IsoStage) : expose padDir/padButton sur window pour
  // piloter la manette SANS pad réel (Playwright n'a pas l'API Gamepad). MÊMES fonctions que la boucle.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __wfrpPad?: (name: PadButton) => void; __wfrpPadDir?: (dir: PadDir) => void };
    w.__wfrpPad = (name) => padButton(name);
    w.__wfrpPadDir = (dir) => padDir(dir);
    return () => { delete w.__wfrpPad; delete w.__wfrpPadDir; };
  }, []);
}
