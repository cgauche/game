/**
 * Registre UNIQUE des raccourcis clavier de JEU. Source de vérité du hook `useGameKeyboard` ET (à
 * venir) du remap de l'écran Options — zéro handler éparpillé pour ce qu'il couvre.
 *
 * 100 % `e.code` = POSITION physique de la touche, pas le caractère → AZERTY-safe d'office (la touche
 * au même ENDROIT que C sur QWERTY est C sur AZERTY ; KeyW=Z, etc.). Les handlers LOCAUX corrects
 * restent scoppés (focus-trap des modales `Modal.tsx`, éditeur).
 *
 * PHASAGE assumé : la rotation caméra Q/E + Échap (purge d'aperçu) vivent encore dans le keydown
 * d'`IsoStage` (déjà en `e.code`, AZERTY-OK) ; elles migreront ICI quand on bâtira le remap Options
 * (un seul edit d'IsoStage à ce moment-là, hors refactor concurrent). Pas de double-handling : les
 * touches ci-dessous (C / Espace / Entrée) sont disjointes de celles d'IsoStage (Q / E / Échap).
 */
import type { GameState } from './store';
import { controlsActive } from './netOwnership';
import { pickActiveModalKey } from './modalArbiter';

export interface KeyBinding {
  id: string;
  /** Touche(s) par POSITION physique (event.code), jamais le caractère. */
  codes: string[];
  /** Libellé pour l'écran Options (remap à venir). */
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
  { id: 'cam-recenter', codes: ['KeyC'], label: 'Caméra : recentrer sur l’actif', when: inBattle, run: (g) => g().resetCamPan() },
  {
    id: 'end-turn', codes: ['Space', 'Enter', 'NumpadEnter'], label: 'Fin du tour', notWhenControlFocused: true,
    when: (s) => inBattle(s) && controlsActive(s) && noModal(s), run: (g) => g().battleEndTurn(),
  },
];
