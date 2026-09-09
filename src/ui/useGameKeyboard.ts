import { useEffect } from 'react';
import { useGame } from '../state/store';
import { KEYBINDINGS, effectiveCodes, effectiveMods, eventMods, modsMatch, CODE_ECHAP } from '../state/keybindings';
import { resoudreEchap, echapRelachee } from '../state/resoudreEchap';

/** Touches de NAVIGATION : elles ne sont à personne par défaut — un bouton focalisé ne les possède
 *  que s'il est un item d'un conteneur à roving tabindex (`ui/rovingFocus.ts`). */
const CODE_NAVIGATION = /^Arrow(Up|Down|Left|Right)$/;
/** Conteneurs qui pilotent leurs items aux flèches (roving tabindex) : là, la flèche appartient au
 *  contrôle focalisé, jamais au raccourci d'application. */
const CONTENEUR_ROVING = '[role="listbox"],[role="tablist"],[role="menu"],[role="menubar"],[role="radiogroup"],[role="grid"],[role="tree"]';

/**
 * Hook UNIQUE des raccourcis clavier de TOUTE l'application : un seul listener `keydown`, ignore les
 * champs de saisie, et dispatche vers le registre `KEYBINDINGS` selon le contexte (`when`). Monté par
 * `App` — UN SEUL montage, tous écrans confondus : c'est le `when` de chaque raccourci (et lui seul)
 * qui dit sur quel écran il vit. Le focus-trap des modales (`Modal.tsx`) reste à part.
 *
 * Les MODIFICATEURS sont AUTORITAIRES : un raccourci ne répond que si Ctrl/Alt/Maj tenus sont
 * EXACTEMENT ceux qu'il déclare (`mods`) — un raccourci sans `mods` se tait donc sous Alt ou Ctrl,
 * et laisse la combinaison au système ou au raccourci qui la déclare.
 *
 * Le CONTRÔLE FOCALISÉ (`notWhenControlFocused`) ne possède que les touches de SON geste, et ce
 * partage est tranché ICI, une fois : un bouton/lien focalisé possède son ACTIVATION (Espace,
 * Entrée) ; les FLÈCHES ne lui appartiennent que s'il est l'item d'un conteneur à roving tabindex
 * (liste, onglets, menu, radiogroupe). Sinon un focus RÉSIDUEL — le bouton de palette qu'on vient de
 * cliquer — mangerait les flèches de l'application (sélection de l'éditeur, curseur tactique).
 */
export function useGameKeyboard() {
  useEffect(() => {
    /** Raccourci qui répond à cette touche dans l'état courant, ou `undefined`. */
    const trouver = (e: KeyboardEvent, controlFocused: boolean, s = useGame.getState()) => {
      const tenus = eventMods(e);
      return KEYBINDINGS.find(
        (k) =>
          effectiveCodes(k, s.keyOverrides).includes(e.code) &&
          modsMatch(effectiveMods(k, s.keyOverrides), tenus) &&
          (!k.notWhenControlFocused || !controlFocused) &&
          k.when(s),
      );
    };
    const saisieEnCours = (e: KeyboardEvent): { saisie: boolean; controlFocused: boolean } => {
      const ae = document.activeElement as HTMLElement | null;
      const tag = ae?.tagName ?? '';
      return {
        saisie: /^(INPUT|TEXTAREA|SELECT)$/.test(tag) || !!ae?.isContentEditable,
        controlFocused: /^(BUTTON|A)$/.test(tag) && (!CODE_NAVIGATION.test(e.code) || !!ae?.closest(CONTENEUR_ROVING)),
      };
    };
    // UN APPUI, UN RACCOURCI : tant que la touche n'est pas relâchée, elle appartient au raccourci qui
    // l'a prise — la répétition automatique du clavier (l'OS réémet des `keydown` tant qu'on tient) ne la
    // passe jamais à un AUTRE. Sans cette mémoire, Échap désarmait l'intention au 1ᵉʳ `keydown` puis, la
    // condition de `intent-cancel` étant retombée, ouvrait le menu système au suivant (#1411 P0-A).
    const priseParCode = new Map<string, string>();
    const onKey = (e: KeyboardEvent) => {
      const { saisie, controlFocused } = saisieEnCours(e);
      if (saisie) return;
      // ANNULATION : couture unique `resoudreEchap` (pile de couches, puis échelle métier du
      // registre). La porte clavier de la pile la tranche déjà en capture quand une couche existe ;
      // ce chemin-ci est celui de la pile VIDE. La sourdine du dialogue PNJ est une couche bloquante
      // poussée par `DialogueBox`, plus un cas particulier de ce hook.
      if (e.code === CODE_ECHAP) {
        const pris = resoudreEchap(useGame.getState, { controlFocused, repeat: e.repeat, mods: eventMods(e) });
        if (pris !== null) e.preventDefault();
        return;
      }
      if (useGame.getState().dialogue) return; // pas de raccourci pendant un dialogue
      const b = trouver(e, controlFocused);
      if (!b) return;
      e.preventDefault();
      const prise = priseParCode.get(e.code);
      if (e.repeat && prise !== undefined && prise !== b.id) return;
      if (!e.repeat) priseParCode.set(e.code, b.id);
      // Geste MAINTENU (`runUp`) ou d'UNE PRESSION (`unePression`) : la répétition automatique du
      // clavier ne le rejoue pas — la cadence est celle du geste (durée de l'appui, fin d'un pas, un
      // quart de tour), jamais celle de l'auto-repeat de l'OS.
      if (e.repeat && (b.runUp || b.unePression)) return;
      b.run(useGame.getState);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      priseParCode.delete(e.code); // l'appui est fini : la touche est rendue au registre
      if (e.code === CODE_ECHAP) echapRelachee();
      const { saisie, controlFocused } = saisieEnCours(e);
      if (saisie) return;
      const b = trouver(e, controlFocused);
      if (!b?.runUp) return;
      e.preventDefault();
      b.runUp(useGame.getState);
    };
    // PERTE DE FOCUS (Alt-Tab, onglet caché) : le `keyup` de la touche tenue part à la fenêtre qui
    // reçoit le focus, jamais à nous — un geste MAINTENU y resterait en cours indéfiniment. On relâche
    // donc TOUT geste maintenu du registre : `runUp` est idempotent, et un relâchement de trop ne
    // coûte rien face à une caméra qui tourne toute seule pendant qu'on est ailleurs.
    const relacherTout = () => {
      priseParCode.clear();
      echapRelachee();
      for (const b of KEYBINDINGS) b.runUp?.(useGame.getState);
    };
    const onVisibilite = () => { if (document.hidden) relacherTout(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', relacherTout);
    document.addEventListener('visibilitychange', onVisibilite);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', relacherTout);
      document.removeEventListener('visibilitychange', onVisibilite);
    };
  }, []);
}
