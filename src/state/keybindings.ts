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
import { SEUIL_MAINTIEN_MS, arreterLacet, demarrerLacet, pasYaw } from './stageYaw';
import { clearTrackedTimer, scheduleFlowTimer } from './combatTimers';
import { t, type MsgKey } from '../i18n';

/** Section d'affichage de l'écran Options (remap) — REGROUPE les raccourcis par contexte de jeu.
 *  Purement présentationnel (le `when` de chaque binding reste l'unique arbitre d'exécution). */
export type KeyBindingSection = 'pov' | 'camera' | 'combat' | 'curseur' | 'hotbar' | 'exploration' | 'systeme';
const KEY_SECTION_KEY: Record<KeyBindingSection, MsgKey> = {
  pov: 'key.section.pov',
  camera: 'key.section.camera',
  combat: 'key.section.combat',
  curseur: 'key.section.curseur',
  hotbar: 'key.section.hotbar',
  exploration: 'key.section.exploration',
  systeme: 'key.section.systeme',
};

/** Libellé d'une section de l'écran Options, résolu À L'APPEL (la carte ci-dessus porte des clés). */
export const keySectionLabel = (s: KeyBindingSection): string => t(KEY_SECTION_KEY[s]);

export interface KeyBinding {
  id: string;
  /** Touche(s) par DÉFAUT, par POSITION physique (event.code), jamais le caractère. */
  codes: string[];
  /** Clé de libellé pour l'écran Options (remap) — résolue à l'affichage (`bindingLabel`), jamais au
   *  chargement : ce tableau est construit à l'évaluation du module. */
  labelKey: MsgKey;
  /** Paramètres du patron de libellé (slot de barre d'action : son numéro). */
  labelParams?: Record<string, string | number>;
  /** Section de regroupement de l'écran Options (remap) — voir `keySectionLabel`. */
  section: KeyBindingSection;
  /** Contexte d'application (lit l'état du jeu). */
  when: (s: GameState) => boolean;
  /** Action : reçoit l'accès au store (`get`) pour appeler ses actions. */
  run: (get: () => GameState) => void;
  /** La touche appartient au CONTRÔLE focalisé (bouton/lien), pas au raccourci : activation
   *  (Espace/Entrée) comme navigation propre au contrôle (flèches d'un menu, d'un popover, d'une
   *  liste à roving tabindex). */
  notWhenControlFocused?: boolean;
  /** RELÂCHEMENT de la touche. Un raccourci qui en porte un est un geste MAINTENU : il agit à
   *  l'enfoncement, dure tant que la touche est tenue, et se termine ici. La répétition automatique du
   *  clavier ne le rejoue pas (`useGameKeyboard`) — la durée est mesurée par le geste, pas par l'OS. */
  runUp?: (get: () => GameState) => void;
}

const inBattle = (s: GameState) => s.mode === 'battle' && !!s.battle && !s.battle.over;
/** Aucune modale de combat ouverte (sinon Espace/Entrée doivent rester à la modale). Garde des
 *  gestes qui ENGAGENT ou QUITTENT le tour (fin de tour, barre d'action, menu système). */
const noModal = (s: GameState) => pickActiveModalKey(s as Parameters<typeof pickActiveModalKey>[0]) == null;
/** La CARTE accepte-t-elle un geste de ciblage ? MÊME verdict que la souris (`modalBlocksMapHover`,
 *  arbitre) : une modale PILOTÉE PAR LA CARTE (désignation de cibles d'un sort) laisse la scène
 *  vivante — la souris y cible, le curseur clavier/manette doit pouvoir en faire autant. */
const mapLive = (s: GameState) => !modalBlocksMapHover(s as Parameters<typeof modalBlocksMapHover>[0]);
/** Minuterie qui transforme l'appui en MAINTIEN — une seule, le geste de rotation est unique. */
let minuterieMaintien: ReturnType<typeof setTimeout> | null = null;
/** APPUI de rotation caméra — SOURCE UNIQUE du geste, partagée par le clavier (Q/E) et par les
 *  boutons d'orientation de l'écran de jeu (`ui/ViewControls`, dont les libellés annoncent Q et E).
 *  Le lacet est LIBRE (#1176) : la caméra accepte n'importe quel angle, et le geste a DEUX régimes,
 *  distingués par la seule durée de l'appui — un appui bref pousse d'un PAS FIN (`pasYaw`), et
 *  au-delà de `SEUIL_MAINTIEN_MS` la caméra part en rotation continue jusqu'au relâchement
 *  (`relacherCamera`). Le pas agit dès l'enfoncement : le geste bref ne se paie aucune attente.
 *  Le régime par CRAN du store (`rotateCam`) ne sert plus l'écran de jeu depuis la mort de la voie
 *  affine (#1176, P3-4 commit C5a) : il reste la rotation de l'ÉDITEUR et des bancs. */
export const tournerCamera = (_g: () => GameState, dir: 1 | -1): void => {
  pasYaw(dir);
  if (minuterieMaintien) clearTrackedTimer(minuterieMaintien);
  // Timer TRACÉ (`state/combatTimers.ts`) : un `setTimeout` nu sous `src/state` est inexprimable
  // (garde structurelle #415, `naked-timer-guard.test.ts`), et le registre annule les timers en vol
  // au teardown de test. Ce geste d'ENTRÉE n'est ni un beat de combat ni une cascade de flux : les
  // deux exports du registre sont le MÊME `track`, et le renommer relève d'un lot transverse.
  minuterieMaintien = scheduleFlowTimer(() => {
    minuterieMaintien = null;
    demarrerLacet(dir);
  }, SEUIL_MAINTIEN_MS);
};
/** RELÂCHEMENT du geste de rotation : désarme le maintien à venir, et arrête celui qui court. */
export const relacherCamera = (): void => {
  if (minuterieMaintien) {
    clearTrackedTimer(minuterieMaintien);
    minuterieMaintien = null;
  }
  arreterLacet();
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
const EXPLORE_STEP: { code: string; dir: ScreenDir; labelKey: MsgKey }[] = [
  { code: 'KeyW', dir: 'up', labelKey: 'key.exploreUp' },
  { code: 'KeyS', dir: 'down', labelKey: 'key.exploreDown' },
  { code: 'KeyA', dir: 'left', labelKey: 'key.exploreLeft' },
  { code: 'KeyD', dir: 'right', labelKey: 'key.exploreRight' },
];

export const KEYBINDINGS: KeyBinding[] = [
  // ── Vue SUBJECTIVE (POV) — AVANT les cam-*/pas-iso (mêmes codes physiques) : find = 1er `when` vrai, donc
  //    tant que `povActive`, ces raccourcis GAGNENT (ZQSD cap-relatif, A/E pivotent le regard) ; hors POV
  //    `exploringPov` est faux → cam-* et pas-iso reprennent la main. `toggle-pov` (F) commute la vue. ──
  { id: 'pov-forward', codes: ['KeyW'], labelKey: 'key.povForward', section: 'pov', when: exploringPov, run: (g) => g().stepPartyRelative('forward') },
  { id: 'pov-back', codes: ['KeyS'], labelKey: 'key.povBack', section: 'pov', when: exploringPov, run: (g) => g().stepPartyRelative('back') },
  { id: 'pov-strafe-l', codes: ['KeyA'], labelKey: 'key.povStrafeL', section: 'pov', when: exploringPov, run: (g) => g().stepPartyRelative('left') },
  { id: 'pov-strafe-r', codes: ['KeyD'], labelKey: 'key.povStrafeR', section: 'pov', when: exploringPov, run: (g) => g().stepPartyRelative('right') },
  { id: 'pov-turn-l', codes: ['KeyQ'], labelKey: 'key.povTurnL', section: 'pov', when: exploringPov, run: (g) => g().pivotParty(-1) },
  { id: 'pov-turn-r', codes: ['KeyE'], labelKey: 'key.povTurnR', section: 'pov', when: exploringPov, run: (g) => g().pivotParty(1) },
  { id: 'toggle-pov', codes: ['KeyF'], labelKey: 'key.togglePov', section: 'pov', when: exploring, run: (g) => g().togglePov() },
  { id: 'cam-left', codes: ['KeyQ'], labelKey: 'key.camLeft', section: 'camera', when: () => true, run: (g) => tournerCamera(g, -1), runUp: () => relacherCamera() },
  { id: 'cam-right', codes: ['KeyE'], labelKey: 'key.camRight', section: 'camera', when: () => true, run: (g) => tournerCamera(g, 1), runUp: () => relacherCamera() },
  { id: 'cam-recenter', codes: ['KeyC'], labelKey: 'key.camRecenter', section: 'camera', when: inBattle, run: (g) => g().resetCamPan() },
  // Pause d'initiative de début de Round (LDB 17 l.27) : Espace/Entrée = « Commencer le round » (le SEUL
  // geste possible) → passage de Round jouable SANS souris. AVANT les bindings curseur/fin-de-tour (mêmes
  // touches) : sa garde `pendingRoundStart` arbitre. notWhenControlFocused : si le bouton « Commencer » est
  // focalisé, son activation native suffit (pas de double appel). Solo = confirmRoundStart ; coop = ready du siège.
  {
    id: 'round-start', codes: ['Space', 'Enter', 'NumpadEnter'], labelKey: 'key.roundStart', section: 'combat', notWhenControlFocused: true,
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
    id: 'preempt-arm', codes: ['KeyT'], labelKey: 'key.preemptArm', section: 'combat',
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
  { id: 'cursor-up', codes: ['ArrowUp'], labelKey: 'key.cursorUp', section: 'curseur', notWhenControlFocused: true, when: curOrPreempt, run: (g) => g().moveCursor('up') },
  { id: 'cursor-down', codes: ['ArrowDown'], labelKey: 'key.cursorDown', section: 'curseur', notWhenControlFocused: true, when: curOrPreempt, run: (g) => g().moveCursor('down') },
  { id: 'cursor-left', codes: ['ArrowLeft'], labelKey: 'key.cursorLeft', section: 'curseur', notWhenControlFocused: true, when: curOrPreempt, run: (g) => g().moveCursor('left') },
  { id: 'cursor-right', codes: ['ArrowRight'], labelKey: 'key.cursorRight', section: 'curseur', notWhenControlFocused: true, when: curOrPreempt, run: (g) => g().moveCursor('right') },
  // Tab : aimante le curseur sur la cible valide suivante (cycle proche→loin) ; gardé sur ≥1 cible
  // (sinon Tab garde sa nav normale). `²/~` = cible précédente (le registre ignore les modificateurs).
  {
    id: 'target-next', codes: ['Tab'], labelKey: 'key.targetNext', section: 'curseur',
    when: (s) => curOrPreempt(s) && validTargets(() => s).length > 0,
    run: (g) => g().snapCursorToTarget(1),
  },
  {
    id: 'target-prev', codes: ['Backquote'], labelKey: 'key.targetPrev', section: 'curseur',
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
    id: 'cursor-commit', codes: ['Enter', 'NumpadEnter'], labelKey: 'key.cursorCommit', section: 'curseur',
    when: (s) => curOrPreempt(s) && !!s.combatCursor,
    run: (g) => g().commitCursor(),
  },
  {
    id: 'cursor-cancel', codes: ['Escape'], labelKey: 'key.cursorCancel', section: 'curseur',
    when: (s) => !!s.combatCursor || preemptCur(s), // armé sans cible en vue : Échap désarme quand même le Tir rapide
    run: (g) => { if (g().preemptAiming) g().armPreempt(null); g().clearCursor(); const s = g(); if (s.battle?.preview) useGame.setState({ battle: { ...s.battle, preview: null } }); },
  },
  {
    id: 'end-turn', codes: ['Space', 'Enter', 'NumpadEnter'], labelKey: 'key.endTurn', section: 'combat', notWhenControlFocused: true,
    when: (s) => cur(s), run: (g) => g().battleEndTurn(),
  },
  {
    id: 'clear-preview', codes: ['Escape'], labelKey: 'key.clearPreview', section: 'combat',
    when: (s) => !!s.battle?.preview,
    run: (g) => { const s = g(); if (s.battle?.preview) useGame.setState({ battle: { ...s.battle, preview: null } }); },
  },
  // Capacités de la barre d'action : 1-9 = n-ième slot VISIBLE (positionnel, rien en dur), via le pont
  // `hotbar` publié par l'ActionBar. Inactif hors de son tour / pendant une modale.
  ...Array.from({ length: 9 }, (_, i): KeyBinding => ({
    id: `hotbar-${i + 1}`, codes: [`Digit${i + 1}`], labelKey: 'key.hotbarSlot', labelParams: { n: i + 1 }, section: 'hotbar',
    when: (s) => inBattle(s) && controlsActive(s) && noModal(s),
    run: () => { const sl = hotbar.slots[i]; if (sl && !sl.disabled) sl.run(); },
  })),
  // ── Pas clavier d'EXPLORATION ISO (ZQSD) : un pas du groupe vers la surface voisine CONNECTÉE dans le
  //    sens écran poussé (rampes/tabliers via exploreStepDest) → le multi-couche, injouable au clic
  //    (l'emprise d'un pont vise la couche du dessous), devient jouable. Garde `!povActive` : en POV, les
  //    mêmes ZQSD sont cap-relatifs (bindings pov-* ci-dessus, résolus AVANT). Les flèches restent au SEUL
  //    curseur de combat (garde `cur`) — plus de partage de codes avec l'exploration.
  ...EXPLORE_STEP.map(({ code, dir, labelKey }): KeyBinding => ({
    id: `explore-${dir}`, codes: [code], labelKey, section: 'exploration', when: (s) => exploring(s) && !s.povActive, run: (g) => g().stepPartyDir(dir),
  })),
  // Menu système PLEIN ÉCRAN (pause) : Échap l'OUVRE quand rien d'autre ne réclame la touche. Placé
  // EN DERNIER → cursor-cancel/clear-preview (mêmes codes, gardes propres) gagnent d'abord en combat.
  // N'OUVRE que si aucune modale de combat n'est active (`noModal`) et que le menu est fermé — le menu
  // OUVERT (`gameMenuOpen`) rend la main à son propre focus-trap (Modal.a11y : Échap = Retour/Fermer,
  // qui stoppe la propagation avant ce hook). Les écrans/modales plein-champ (role=dialog) consomment
  // déjà Échap et coupent la propagation → ils ne rouvrent jamais ce menu par mégarde.
  {
    id: 'toggle-menu', codes: ['Escape'], labelKey: 'key.toggleMenu', section: 'systeme',
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

/** Libellé d'un raccourci pour l'écran Options, résolu À L'APPEL depuis sa clé (+ ses paramètres). */
export const bindingLabel = (b: KeyBinding): string => t(b.labelKey, b.labelParams);

/** Touches dont le nom lisible EST un texte (traduisible) — les autres sont des SYMBOLES (`NAMED_SYMBOLS`). */
const NAMED_KEY_KEY: Record<string, MsgKey> = {
  Space: 'key.named.space', Enter: 'key.named.enter', NumpadEnter: 'key.named.numpadEnter', Escape: 'key.named.escape',
};
/** Glyphes de touche : aucun texte de langue (le nom `Tab` est celui gravé sur la touche). */
const NAMED_SYMBOLS: Record<string, string> = {
  Tab: 'Tab',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Backquote: '²/~', Minus: '-', Equal: '=',
};

/** Libellé lisible d'un `event.code` pour l'UI de remap (KeyC→C, Digit1→1, Space→Espace…). NB : on
 *  affiche la lettre QWERTY de la position (le clavier AZERTY de l'utilisateur étiquette parfois
 *  autrement la MÊME position physique — c'est la position qui compte pour le binding).
 *  Les touches NOMMÉES sont résolues AVANT le préfixe `Numpad` : `NumpadEnter` rend « Entrée (pavé) »
 *  (son entrée nommée était inatteignable derrière le préfixe, qui en faisait « Pavé Enter »). */
export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const named = NAMED_KEY_KEY[code];
  if (named) return t(named);
  if (code.startsWith('Numpad')) return t('key.named.numpad', { n: code.slice(6) });
  return NAMED_SYMBOLS[code] ?? code;
}
