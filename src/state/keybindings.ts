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

export const KEYBINDINGS: KeyBinding[] = [
  { id: 'cam-left', codes: ['KeyQ'], label: 'Caméra : tourner à gauche', when: () => true, run: (g) => g().rotateCam(-1) },
  { id: 'cam-right', codes: ['KeyE'], label: 'Caméra : tourner à droite', when: () => true, run: (g) => g().rotateCam(1) },
  { id: 'cam-recenter', codes: ['KeyC'], label: 'Caméra : recentrer sur l’actif', when: inBattle, run: (g) => g().resetCamPan() },
  {
    id: 'end-turn', codes: ['Space', 'Enter', 'NumpadEnter'], label: 'Fin du tour', notWhenControlFocused: true,
    when: (s) => inBattle(s) && controlsActive(s) && noModal(s), run: (g) => g().battleEndTurn(),
  },
  {
    id: 'clear-preview', codes: ['Escape'], label: 'Annuler l’aperçu de déplacement',
    when: (s) => !!s.battle?.preview,
    run: (g) => { const s = g(); if (s.battle?.preview) useGame.setState({ battle: { ...s.battle, preview: null } }); },
  },
];

/** Touche(s) EFFECTIVE(s) d'un raccourci : la surcharge utilisateur remplace les codes par défaut. */
export function effectiveCodes(b: KeyBinding, overrides: Record<string, string>): string[] {
  return overrides[b.id] ? [overrides[b.id]] : b.codes;
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
