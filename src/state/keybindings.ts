/**
 * Registre UNIQUE des raccourcis clavier de JEU. Source de vérité du hook `useGameKeyboard` ET du
 * remap de l'écran Options — zéro handler éparpillé (la rotation caméra + Échap, jadis dans le keydown
 * d'IsoStage, vivent désormais ICI : remappables comme le reste).
 *
 * 100 % `e.code` = POSITION physique de la touche, pas le caractère → AZERTY-safe d'office (la touche
 * au même ENDROIT que Q/E/C sur QWERTY est A/Z/E/C sur AZERTY). Les handlers LOCAUX corrects restent
 * scoppés (focus-trap des modales `Modal.tsx`, éditeur).
 */
import type { GameState } from './store';
import { useGame } from './store';
import { controlsActive } from './netOwnership';
import { pickActiveModalKey } from './modalArbiter';
import { hotbar } from './hotbarBridge';
import { validTargets } from './targeting';
import type { ScreenDir } from './combatCursor';

export interface KeyBinding {
  id: string;
  /** Touche(s) par DÉFAUT, par POSITION physique (event.code), jamais le caractère. */
  codes: string[];
  /** Libellé pour l'écran Options (remap). */
  label: string;
  /** Contexte d'application (lit l'état du jeu). */
  when: (s: GameState) => boolean;
  /** Action : reçoit l'accès au store (`get`) pour appeler ses actions. */
  run: (get: () => GameState) => void;
  /** Touche d'ACTIVATION (Espace/Entrée) : ne pas voler le clic d'un bouton/lien focalisé. */
  notWhenControlFocused?: boolean;
}

const inBattle = (s: GameState) => s.mode === 'battle' && !!s.battle && !s.battle.over;
/** Aucune modale de combat ouverte (sinon Espace/Entrée doivent rester à la modale). */
const noModal = (s: GameState) => pickActiveModalKey(s as Parameters<typeof pickActiveModalKey>[0]) == null;
/** Contexte de PILOTAGE du combat (carte) : en combat, c'est bien ton tour (coop), aucune modale ouverte. */
const cur = (s: GameState) => inBattle(s) && controlsActive(s) && noModal(s);
/** Contexte d'EXPLORATION (carte hors combat) : écran de jeu, mode exploration, hors dialogue. */
const exploring = (s: GameState) => s.screen === 'campaign' && s.mode === 'exploration' && !s.dialogue;
/** Pas clavier d'exploration (flèches) : code physique → direction ÉCRAN. */
const EXPLORE_STEP: { code: string; dir: ScreenDir; label: string }[] = [
  { code: 'ArrowUp', dir: 'up', label: 'Exploration : pas vers le haut' },
  { code: 'ArrowDown', dir: 'down', label: 'Exploration : pas vers le bas' },
  { code: 'ArrowLeft', dir: 'left', label: 'Exploration : pas vers la gauche' },
  { code: 'ArrowRight', dir: 'right', label: 'Exploration : pas vers la droite' },
];

export const KEYBINDINGS: KeyBinding[] = [
  { id: 'cam-left', codes: ['KeyQ'], label: 'Caméra : tourner à gauche', when: () => true, run: (g) => g().rotateCam(-1) },
  { id: 'cam-right', codes: ['KeyE'], label: 'Caméra : tourner à droite', when: () => true, run: (g) => g().rotateCam(1) },
  { id: 'cam-recenter', codes: ['KeyC'], label: 'Caméra : recentrer sur l’actif', when: inBattle, run: (g) => g().resetCamPan() },
  // Pause d'initiative de début de Round (LDB ch.17 l.27) : Espace/Entrée = « Commencer le round » (le SEUL
  // geste possible) → passage de Round jouable SANS souris. AVANT les bindings curseur/fin-de-tour (mêmes
  // touches) : sa garde `pendingRoundStart` arbitre. notWhenControlFocused : si le bouton « Commencer » est
  // focalisé, son activation native suffit (pas de double appel). Solo = confirmRoundStart ; coop = ready du siège.
  {
    id: 'round-start', codes: ['Space', 'Enter', 'NumpadEnter'], label: 'Commencer le round', notWhenControlFocused: true,
    when: (s) => inBattle(s) && !!s.pendingRoundStart,
    run: (g) => {
      const s = g();
      if (s.net.mode === 'local') { s.confirmRoundStart(); return; }
      if (!s.pendingRoundStart?.readyBySeat?.[s.net.mySeat]) s.roundStartReady(s.net.mySeat);
    },
  },
  // ── Curseur de combat (flèches) — la MANETTE réutilise ces mêmes ids via runBindingById. Le curseur
  //    « suit les yeux » (direction écran). Le 1er appui le pose sur le combattant actif. ──
  { id: 'cursor-up', codes: ['ArrowUp'], label: 'Curseur : haut', when: cur, run: (g) => g().moveCursor('up') },
  { id: 'cursor-down', codes: ['ArrowDown'], label: 'Curseur : bas', when: cur, run: (g) => g().moveCursor('down') },
  { id: 'cursor-left', codes: ['ArrowLeft'], label: 'Curseur : gauche', when: cur, run: (g) => g().moveCursor('left') },
  { id: 'cursor-right', codes: ['ArrowRight'], label: 'Curseur : droite', when: cur, run: (g) => g().moveCursor('right') },
  // Tab : aimante le curseur sur la cible valide suivante (cycle proche→loin) ; gardé sur ≥1 cible
  // (sinon Tab garde sa nav normale). `²/~` = cible précédente (le registre ignore les modificateurs).
  {
    id: 'target-next', codes: ['Tab'], label: 'Cibler la cible valide suivante',
    when: (s) => cur(s) && validTargets(() => s).length > 0,
    run: (g) => g().snapCursorToTarget(1),
  },
  {
    id: 'target-prev', codes: ['Backquote'], label: 'Cibler la cible valide précédente',
    when: (s) => cur(s) && validTargets(() => s).length > 0,
    run: (g) => g().snapCursorToTarget(-1),
  },
  // Valider/annuler le curseur — AVANT end-turn/clear-preview : avec un curseur posé, Entrée commet
  // et Échap désélectionne ; sans curseur, Entrée finit le tour et Échap purge l'aperçu (1er match).
  {
    id: 'cursor-commit', codes: ['Enter', 'NumpadEnter'], label: 'Curseur : valider', notWhenControlFocused: true,
    when: (s) => cur(s) && !!s.combatCursor,
    run: (g) => g().commitCursor(),
  },
  {
    id: 'cursor-cancel', codes: ['Escape'], label: 'Curseur : annuler',
    when: (s) => !!s.combatCursor,
    run: (g) => { g().clearCursor(); const s = g(); if (s.battle?.preview) useGame.setState({ battle: { ...s.battle, preview: null } }); },
  },
  {
    id: 'end-turn', codes: ['Space', 'Enter', 'NumpadEnter'], label: 'Fin du tour', notWhenControlFocused: true,
    when: (s) => cur(s), run: (g) => g().battleEndTurn(),
  },
  {
    id: 'clear-preview', codes: ['Escape'], label: 'Annuler l’aperçu de déplacement',
    when: (s) => !!s.battle?.preview,
    run: (g) => { const s = g(); if (s.battle?.preview) useGame.setState({ battle: { ...s.battle, preview: null } }); },
  },
  // Capacités de la barre d'action : 1-9 = n-ième slot VISIBLE (positionnel, rien en dur), via le pont
  // `hotbar` publié par l'ActionBar. Inactif hors de son tour / pendant une modale.
  ...Array.from({ length: 9 }, (_, i): KeyBinding => ({
    id: `hotbar-${i + 1}`, codes: [`Digit${i + 1}`], label: `Capacité ${i + 1} de la barre d’action`,
    when: (s) => inBattle(s) && controlsActive(s) && noModal(s),
    run: () => { const sl = hotbar.slots[i]; if (sl && !sl.disabled) sl.run(); },
  })),
  // ── Pas clavier d'EXPLORATION (flèches) : un pas du groupe vers la surface voisine CONNECTÉE dans le
  //    sens écran poussé (rampes/tabliers via exploreStepDest) → le multi-couche, injouable au clic
  //    (l'emprise d'un pont vise la couche du dessous), devient jouable. Garde DISJOINTE du curseur de
  //    combat (exploration ≠ inBattle), donc partage des codes ArrowX sans conflit (find = 1er `when` vrai).
  ...EXPLORE_STEP.map(({ code, dir, label }): KeyBinding => ({
    id: `explore-${dir}`, codes: [code], label, when: exploring, run: (g) => g().stepPartyDir(dir),
  })),
];

/** Touche(s) EFFECTIVE(s) d'un raccourci : la surcharge utilisateur remplace les codes par défaut. */
export function effectiveCodes(b: KeyBinding, overrides: Record<string, string>): string[] {
  return overrides[b.id] ? [overrides[b.id]] : b.codes;
}

/** Exécute un raccourci par son `id` (s'il s'applique au contexte courant) — table d'intentions PARTAGÉE
 *  par le clavier ET la manette : un seul endroit porte la garde `when` + l'action `run`. */
export function runBindingById(id: string, get: () => GameState): void {
  const b = KEYBINDINGS.find((k) => k.id === id);
  if (b && b.when(get())) b.run(get);
}

const NAMED_KEYS: Record<string, string> = {
  Space: 'Espace', Enter: 'Entrée', NumpadEnter: 'Entrée (pavé)', Escape: 'Échap', Tab: 'Tab',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Backquote: '²/~', Minus: '-', Equal: '=',
};

/** Libellé lisible d'un `event.code` pour l'UI de remap (KeyC→C, Digit1→1, Space→Espace…). NB : on
 *  affiche la lettre QWERTY de la position (le clavier AZERTY de l'utilisateur étiquette parfois
 *  autrement la MÊME position physique — c'est la position qui compte pour le binding). */
export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Pavé ${code.slice(6)}`;
  return NAMED_KEYS[code] ?? code;
}
