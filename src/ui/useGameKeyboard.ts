import { useEffect } from 'react';
import { useGame } from '../state/store';
import { KEYBINDINGS, effectiveCodes } from '../state/keybindings';

/**
 * Hook UNIQUE des raccourcis clavier de JEU : un seul listener `keydown`, ignore les champs de saisie,
 * et dispatche vers le registre `KEYBINDINGS` selon le contexte (`when`). Monté par `CampaignView`
 * (l'écran de jeu) → inactif au menu/éditeur. Le focus-trap des modales (`Modal.tsx`) reste à part.
 */
export function useGameKeyboard() {
  useEffect(() => {
    /** Raccourci qui répond à cette touche dans l'état courant, ou `undefined`. */
    const trouver = (e: KeyboardEvent, controlFocused: boolean, s = useGame.getState()) =>
      KEYBINDINGS.find(
        (k) => effectiveCodes(k, s.keyOverrides).includes(e.code) && (!k.notWhenControlFocused || !controlFocused) && k.when(s),
      );
    const saisieEnCours = (): { saisie: boolean; controlFocused: boolean } => {
      const ae = document.activeElement as HTMLElement | null;
      const tag = ae?.tagName ?? '';
      return {
        saisie: /^(INPUT|TEXTAREA|SELECT)$/.test(tag) || !!ae?.isContentEditable,
        controlFocused: /^(BUTTON|A)$/.test(tag), // Espace/Entrée doivent activer ce contrôle, pas le raccourci
      };
    };
    const onKey = (e: KeyboardEvent) => {
      const { saisie, controlFocused } = saisieEnCours();
      if (saisie) return;
      if (useGame.getState().dialogue) return; // pas de raccourci pendant un dialogue
      const b = trouver(e, controlFocused);
      if (!b) return;
      e.preventDefault();
      // Geste MAINTENU (`runUp`) ou d'UNE PRESSION (`unePression`) : la répétition automatique du
      // clavier ne le rejoue pas — la cadence est celle du geste (durée de l'appui, fin d'un pas, un
      // quart de tour), jamais celle de l'auto-repeat de l'OS.
      if (e.repeat && (b.runUp || b.unePression)) return;
      b.run(useGame.getState);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const { saisie, controlFocused } = saisieEnCours();
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
