/**
 * Registre UNIQUE des raccourcis clavier de JEU. Source de vérité du hook `useGameKeyboard` ET du
 * remap de l'écran Options — zéro handler éparpillé (la rotation caméra + Échap vivent ICI :
 * remappables comme le reste).
 *
 * 100 % `e.code` = POSITION physique de la touche, pas le caractère → AZERTY-safe d'office (la touche
 * au même ENDROIT que Q/E/C sur QWERTY est A/Z/E/C sur AZERTY). Les handlers LOCAUX corrects restent
 * scoppés (focus-trap des modales `Modal.tsx`, éditeur).
 */
import type { GameState } from './store';
import { useGame } from './store';
import { controlsActive } from './netOwnership';
import { pickActiveModalKey, modalBlocksMapHover } from './modalArbiter';
import { hotbar } from './hotbarBridge';
import { validTargets, preemptShooterIds } from './targeting';
import type { ScreenDir } from './combatCursor';
import { snapStageYawToCran } from './stageYaw';

/** Section d'affichage de l'écran Options (remap) — REGROUPE les raccourcis par contexte de jeu.
 *  Purement présentationnel (le `when` de chaque binding reste l'unique arbitre d'exécution). */
export type KeyBindingSection = 'pov' | 'camera' | 'combat' | 'curseur' | 'hotbar' | 'exploration' | 'systeme';
export const KEY_SECTION_LABEL: Record<KeyBindingSection, string> = {
  pov: 'Vue subjective (POV)',
  camera: 'Caméra',
  combat: 'Combat',
  curseur: 'Curseur de combat',
  hotbar: "Barre d'action",
  exploration: 'Exploration',
  systeme: 'Système',
};

export interface KeyBinding {
  id: string;
  /** Touche(s) par DÉFAUT, par POSITION physique (event.code), jamais le caractère. */
  codes: string[];
  /** Libellé pour l'écran Options (remap). */
  label: string;
  /** Section de regroupement de l'écran Options (remap) — voir `KEY_SECTION_LABEL`. */
  section: KeyBindingSection;
  /** Contexte d'application (lit l'état du jeu). */
  when: (s: GameState) => boolean;
  /** Action : reçoit l'accès au store (`get`) pour appeler ses actions. */
  run: (get: () => GameState) => void;
  /** La touche appartient au CONTRÔLE focalisé (bouton/lien), pas au raccourci : activation
   *  (Espace/Entrée) comme navigation propre au contrôle (flèches d'un menu, d'un popover, d'une
   *  liste à roving tabindex). */
  notWhenControlFocused?: boolean;
}

const inBattle = (s: GameState) => s.mode === 'battle' && !!s.battle && !s.battle.over;
/** Aucune modale de combat ouverte (sinon Espace/Entrée doivent rester à la modale). Garde des
 *  gestes qui ENGAGENT ou QUITTENT le tour (fin de tour, barre d'action, menu système). */
const noModal = (s: GameState) => pickActiveModalKey(s as Parameters<typeof pickActiveModalKey>[0]) == null;
/** La CARTE accepte-t-elle un geste de ciblage ? MÊME verdict que la souris (`modalBlocksMapHover`,
 *  arbitre) : une modale PILOTÉE PAR LA CARTE (désignation de cibles d'un sort) laisse la scène
 *  vivante — la souris y cible, le curseur clavier/manette doit pouvoir en faire autant. */
const mapLive = (s: GameState) => !modalBlocksMapHover(s as Parameters<typeof modalBlocksMapHover>[0]);
/** UNE poussée de rotation caméra — SOURCE UNIQUE du geste, partagée par le clavier (Q/E) et par les
 *  boutons d'orientation de l'écran de jeu (`ui/ViewControls`, dont les libellés annoncent Q et E).
 *  La caméra de JEU ne connaît que les QUATRE vues DIAGONALES (#1289) : de face, la grille s'aligne
 *  sur l'écran et le plateau perd sa lecture en volume. Le lacet est CONTINU (#1176, P2-7) — la caméra
 *  COURT vers le cran visé (`state/stageYaw.ts`) et maintenir la touche fait tourner sans à-coup —,
 *  mais la cible est AIMANTÉE au cran (`snapStageYawToCran`) : une addition depuis un lacet en vol
 *  poserait la vue entre deux crans.
 *  Le régime par CRAN du store (`rotateCam`) ne sert plus l'écran de jeu depuis la mort de la voie
 *  affine (#1176, P3-4 commit C5a) : il reste la rotation de l'ÉDITEUR et des bancs. */
export const tournerCamera = (_g: () => GameState, dir: 1 | -1): void => {
  snapStageYawToCran(dir);
};
/** Contexte de PILOTAGE du combat (fin de tour, barre d'action) : en combat, c'est bien ton tour
 *  (coop), aucune modale ouverte. */
const cur = (s: GameState) => inBattle(s) && controlsActive(s) && noModal(s);
/** Contexte du CURSEUR de combat (viser / valider SUR LA CARTE) : ton tour et carte vivante — le
 *  ciblage clavier survit donc à une modale pilotée par la carte, comme la souris. */
const curMap = (s: GameState) => inBattle(s) && controlsActive(s) && mapLive(s);
/** Contexte de VISÉE Tir rapide (pause de début de Round, LDB 11 l.97-103) : une visée est ARMÉE (`preemptAiming`),
 *  carte vivante — le curseur/Tab/Entrée pilotent le tir d'interruption HORS TOUR comme un ciblage normal. */
const preemptCur = (s: GameState) => inBattle(s) && !!s.preemptAiming && mapLive(s);
/** Curseur de combat actif : tour normal OU visée Tir rapide armée (le même curseur pilote les deux). */
const curOrPreempt = (s: GameState) => curMap(s) || preemptCur(s);
/** Contexte d'EXPLORATION (carte hors combat) : écran de jeu, mode exploration, hors dialogue. */
const exploring = (s: GameState) => s.screen === 'campaign' && s.mode === 'exploration' && !s.dialogue;
/** Contexte d'exploration en vue SUBJECTIVE (POV) : les ZQSD deviennent cap-relatifs et A/E pivotent le
 *  regard → shadow des raccourcis caméra/pas-iso (mêmes touches) tant que le POV est actif. */
const exploringPov = (s: GameState) => exploring(s) && s.povActive;
/** Pas clavier d'exploration ISO (ZQSD) : code physique → direction ÉCRAN. Réservé à la vue iso (hors POV,
 *  où ces mêmes touches sont cap-relatives — cf. `exploringPov` ci-dessus, résolu AVANT par ordre de tableau). */
const EXPLORE_STEP: { code: string; dir: ScreenDir; label: string }[] = [
  { code: 'KeyW', dir: 'up', label: 'Exploration : pas vers le haut' },
  { code: 'KeyS', dir: 'down', label: 'Exploration : pas vers le bas' },
  { code: 'KeyA', dir: 'left', label: 'Exploration : pas vers la gauche' },
  { code: 'KeyD', dir: 'right', label: 'Exploration : pas vers la droite' },
];

export const KEYBINDINGS: KeyBinding[] = [
  // ── Vue SUBJECTIVE (POV) — AVANT les cam-*/pas-iso (mêmes codes physiques) : find = 1er `when` vrai, donc
  //    tant que `povActive`, ces raccourcis GAGNENT (ZQSD cap-relatif, A/E pivotent le regard) ; hors POV
  //    `exploringPov` est faux → cam-* et pas-iso reprennent la main. `toggle-pov` (F) commute la vue. ──
  { id: 'pov-forward', codes: ['KeyW'], label: 'POV : avancer', section: 'pov', when: exploringPov, run: (g) => g().stepPartyRelative('forward') },
  { id: 'pov-back', codes: ['KeyS'], label: 'POV : reculer', section: 'pov', when: exploringPov, run: (g) => g().stepPartyRelative('back') },
  { id: 'pov-strafe-l', codes: ['KeyA'], label: 'POV : pas de côté à gauche', section: 'pov', when: exploringPov, run: (g) => g().stepPartyRelative('left') },
  { id: 'pov-strafe-r', codes: ['KeyD'], label: 'POV : pas de côté à droite', section: 'pov', when: exploringPov, run: (g) => g().stepPartyRelative('right') },
  { id: 'pov-turn-l', codes: ['KeyQ'], label: 'POV : pivoter le regard à gauche', section: 'pov', when: exploringPov, run: (g) => g().pivotParty(-1) },
  { id: 'pov-turn-r', codes: ['KeyE'], label: 'POV : pivoter le regard à droite', section: 'pov', when: exploringPov, run: (g) => g().pivotParty(1) },
  { id: 'toggle-pov', codes: ['KeyF'], label: 'Basculer la vue subjective (POV)', section: 'pov', when: exploring, run: (g) => g().togglePov() },
  { id: 'cam-left', codes: ['KeyQ'], label: 'Caméra : tourner à gauche', section: 'camera', when: () => true, run: (g) => tournerCamera(g, -1) },
  { id: 'cam-right', codes: ['KeyE'], label: 'Caméra : tourner à droite', section: 'camera', when: () => true, run: (g) => tournerCamera(g, 1) },
  { id: 'cam-recenter', codes: ['KeyC'], label: 'Caméra : recentrer sur l’actif', section: 'camera', when: inBattle, run: (g) => g().resetCamPan() },
  // Pause d'initiative de début de Round (LDB 17 l.27) : Espace/Entrée = « Commencer le round » (le SEUL
  // geste possible) → passage de Round jouable SANS souris. AVANT les bindings curseur/fin-de-tour (mêmes
  // touches) : sa garde `pendingRoundStart` arbitre. notWhenControlFocused : si le bouton « Commencer » est
  // focalisé, son activation native suffit (pas de double appel). Solo = confirmRoundStart ; coop = ready du siège.
  {
    id: 'round-start', codes: ['Space', 'Enter', 'NumpadEnter'], label: 'Commencer le round', section: 'combat', notWhenControlFocused: true,
    when: (s) => inBattle(s) && !!s.pendingRoundStart && !s.preemptAiming, // visée Tir rapide armée → Entrée TIRE (curseur), pas « commencer »
    run: (g) => {
      const s = g();
      if (s.net.mode === 'local') { s.confirmRoundStart(); return; }
      if (!s.pendingRoundStart?.readyBySeat?.[s.net.mySeat]) s.roundStartReady(s.net.mySeat);
    },
  },
  // Tir rapide (talent, LDB 11 l.97-103) au CLAVIER : pendant la pause, `T` arme la visée d'interruption du 1ᵉʳ tireur
  // éligible (puis cycle les suivants, puis désarme) et pose le curseur sur la cible la plus proche → flèches/Tab
  // visent, Entrée TIRE, Échap annule. Réutilise le curseur de combat existant (aucun chemin parallèle).
  {
    id: 'preempt-arm', codes: ['KeyT'], label: 'Tir rapide : viser (interruption de début de Round)', section: 'combat',
    when: (s) => inBattle(s) && !!s.pendingRoundStart && preemptShooterIds(() => s).length > 0,
    run: (g) => {
      const shooters = preemptShooterIds(g);
      const i = g().preemptAiming ? shooters.indexOf(g().preemptAiming!) : -1;
      const next = i + 1 < shooters.length ? shooters[i + 1] : null; // tireur suivant, puis désarme après le dernier
      g().armPreempt(next);
      if (next) g().snapCursorToTarget(1); else g().clearCursor(); // pose le curseur sur la cible la plus proche
    },
  },
  // ── Curseur de combat (flèches) — la MANETTE réutilise ces mêmes ids via runBindingById. Le curseur
  //    « suit les yeux » (direction écran). Le 1er appui le pose sur le combattant actif.
  //    `notWhenControlFocused` : un CONTRÔLE focalisé possède ses propres flèches (menu, popover de
  //    règle d'un bouton de pool, liste à roving tabindex). Sans cette garde, le curseur tactique
  //    court AVEC lui sur la même touche — le ↓ qui devait ouvrir la porte de la fiche déplaçait
  //    aussi la visée (recette B3a, capture 04). Même doctrine que `round-start`/`end-turn` pour
  //    Espace/Entrée, étendue aux flèches : la touche appartient au contrôle qui a le focus.
  { id: 'cursor-up', codes: ['ArrowUp'], label: 'Curseur : haut', section: 'curseur', notWhenControlFocused: true, when: curOrPreempt, run: (g) => g().moveCursor('up') },
  { id: 'cursor-down', codes: ['ArrowDown'], label: 'Curseur : bas', section: 'curseur', notWhenControlFocused: true, when: curOrPreempt, run: (g) => g().moveCursor('down') },
  { id: 'cursor-left', codes: ['ArrowLeft'], label: 'Curseur : gauche', section: 'curseur', notWhenControlFocused: true, when: curOrPreempt, run: (g) => g().moveCursor('left') },
  { id: 'cursor-right', codes: ['ArrowRight'], label: 'Curseur : droite', section: 'curseur', notWhenControlFocused: true, when: curOrPreempt, run: (g) => g().moveCursor('right') },
  // Tab : aimante le curseur sur la cible valide suivante (cycle proche→loin) ; gardé sur ≥1 cible
  // (sinon Tab garde sa nav normale). `²/~` = cible précédente (le registre ignore les modificateurs).
  {
    id: 'target-next', codes: ['Tab'], label: 'Cibler la cible valide suivante', section: 'curseur',
    when: (s) => curOrPreempt(s) && validTargets(() => s).length > 0,
    run: (g) => g().snapCursorToTarget(1),
  },
  {
    id: 'target-prev', codes: ['Backquote'], label: 'Cibler la cible valide précédente', section: 'curseur',
    when: (s) => curOrPreempt(s) && validTargets(() => s).length > 0,
    run: (g) => g().snapCursorToTarget(-1),
  },
  // Valider/annuler le curseur — AVANT end-turn/clear-preview : avec un curseur posé, Entrée commet
  // et Échap désélectionne ; sans curseur, Entrée finit le tour et Échap purge l'aperçu (1er match).
  // PAS `notWhenControlFocused` (#199) : un `combatCursor` n'existe QUE si une flèche a déjà été
  // pressée (bindings `cursor-*`, gardés par `curOrPreempt`) — on est donc DÉJÀ dans un flux clavier,
  // jamais dans le cas « Tab a posé le focus sur un bouton, Entrée doit l'activer » que la garde protège
  // ailleurs. Sans ce retrait, le focus RÉSIDUEL d'un bouton de barre d'action cliqué à la souris (ex.
  // « Pousser ») pour ENTRER dans le mode-CASE masquait `cursor-commit` : Entrée retombait sur
  // l'activation native du bouton encore focalisé (qui ferme le mode, aucune poussée commise).
  {
    id: 'cursor-commit', codes: ['Enter', 'NumpadEnter'], label: 'Curseur : valider', section: 'curseur',
    when: (s) => curOrPreempt(s) && !!s.combatCursor,
    run: (g) => g().commitCursor(),
  },
  {
    id: 'cursor-cancel', codes: ['Escape'], label: 'Curseur : annuler', section: 'curseur',
    when: (s) => !!s.combatCursor || preemptCur(s), // armé sans cible en vue : Échap désarme quand même le Tir rapide
    run: (g) => { if (g().preemptAiming) g().armPreempt(null); g().clearCursor(); const s = g(); if (s.battle?.preview) useGame.setState({ battle: { ...s.battle, preview: null } }); },
  },
  {
    id: 'end-turn', codes: ['Space', 'Enter', 'NumpadEnter'], label: 'Fin du tour', section: 'combat', notWhenControlFocused: true,
    when: (s) => cur(s), run: (g) => g().battleEndTurn(),
  },
  {
    id: 'clear-preview', codes: ['Escape'], label: 'Annuler l’aperçu de déplacement', section: 'combat',
    when: (s) => !!s.battle?.preview,
    run: (g) => { const s = g(); if (s.battle?.preview) useGame.setState({ battle: { ...s.battle, preview: null } }); },
  },
  // Capacités de la barre d'action : 1-9 = n-ième slot VISIBLE (positionnel, rien en dur), via le pont
  // `hotbar` publié par l'ActionBar. Inactif hors de son tour / pendant une modale.
  ...Array.from({ length: 9 }, (_, i): KeyBinding => ({
    id: `hotbar-${i + 1}`, codes: [`Digit${i + 1}`], label: `Capacité ${i + 1} de la barre d’action`, section: 'hotbar',
    when: (s) => inBattle(s) && controlsActive(s) && noModal(s),
    run: () => { const sl = hotbar.slots[i]; if (sl && !sl.disabled) sl.run(); },
  })),
  // ── Pas clavier d'EXPLORATION ISO (ZQSD) : un pas du groupe vers la surface voisine CONNECTÉE dans le
  //    sens écran poussé (rampes/tabliers via exploreStepDest) → le multi-couche, injouable au clic
  //    (l'emprise d'un pont vise la couche du dessous), devient jouable. Garde `!povActive` : en POV, les
  //    mêmes ZQSD sont cap-relatifs (bindings pov-* ci-dessus, résolus AVANT). Les flèches restent au SEUL
  //    curseur de combat (garde `cur`) — plus de partage de codes avec l'exploration.
  ...EXPLORE_STEP.map(({ code, dir, label }): KeyBinding => ({
    id: `explore-${dir}`, codes: [code], label, section: 'exploration', when: (s) => exploring(s) && !s.povActive, run: (g) => g().stepPartyDir(dir),
  })),
  // Menu système PLEIN ÉCRAN (pause) : Échap l'OUVRE quand rien d'autre ne réclame la touche. Placé
  // EN DERNIER → cursor-cancel/clear-preview (mêmes codes, gardes propres) gagnent d'abord en combat.
  // N'OUVRE que si aucune modale de combat n'est active (`noModal`) et que le menu est fermé — le menu
  // OUVERT (`gameMenuOpen`) rend la main à son propre focus-trap (Modal.a11y : Échap = Retour/Fermer,
  // qui stoppe la propagation avant ce hook). Les écrans/modales plein-champ (role=dialog) consomment
  // déjà Échap et coupent la propagation → ils ne rouvrent jamais ce menu par mégarde.
  {
    id: 'toggle-menu', codes: ['Escape'], label: 'Ouvrir le menu système', section: 'systeme',
    when: (s) => s.screen === 'campaign' && !s.gameMenuOpen && noModal(s),
    run: (g) => g().setGameMenu(true),
  },
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
