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
    const onKey = (e: KeyboardEvent) => {
      const ae = document.activeElement as HTMLElement | null;
      const tag = ae?.tagName ?? '';
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || ae?.isContentEditable) return; // saisie en cours
      const s = useGame.getState();
      if (s.dialogue) return; // pas de raccourci pendant un dialogue
      const controlFocused = /^(BUTTON|A)$/.test(tag); // Espace/Entrée doivent activer ce contrôle, pas le raccourci
      const b = KEYBINDINGS.find(
        (k) => effectiveCodes(k, s.keyOverrides).includes(e.code) && (!k.notWhenControlFocused || !controlFocused) && k.when(s),
      );
      if (!b) return;
      e.preventDefault();
      b.run(useGame.getState);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
