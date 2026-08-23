/**
 * APPUI LONG — primitive PARTAGÉE du geste secondaire au doigt (spec HUD combat, geste secondaire
 * d'une alvéole : clic droit à la souris, appui long au tactile, touche Menu au clavier).
 *
 * Le geste s'ARME au `pointerdown` du BOUTON PRINCIPAL, se DÉCLENCHE au bout de `delai`, et s'ANNULE au relâchement
 * comme au mouvement au-delà de `TOLERANCE` (un glissement n'est pas un appui). L'appui qui a
 * déclenché AVALE la salve d'événements natifs qui le suit (`consomme`, lu par `click` ET par
 * `contextmenu`) : sans quoi le doigt lèverait le geste secondaire PUIS l'action primaire de
 * l'alvéole, et le `contextmenu` que le navigateur dérive de l'appui long rappellerait le geste.
 */
import { useCallback, useEffect, useRef } from 'react';

/** Seuil d'immobilité, en pixels : au-delà, le doigt glisse (défilement, visée), il n'appuie plus. */
const TOLERANCE = 10;
/** Seuil de durée par défaut, en ms — au-delà d'un clic ordinaire, en deçà d'une attente ressentie. */
export const DELAI_APPUI_LONG = 450;
/** Durée pendant laquelle l'appui long déclenché AVALE les événements natifs qui le suivent (au doigt,
 *  le navigateur émet `contextmenu` PUIS `click` après le lever) : chacun d'eux consulte le même
 *  verdict, et la fenêtre expire d'elle-même — une activation clavier ultérieure n'est pas avalée. */
export const FENETRE_AVALEMENT = 700;

export interface LongPress {
  handlers: {
    onPointerDown: (e: { clientX: number; clientY: number; button?: number }) => void;
    onPointerMove: (e: { clientX: number; clientY: number }) => void;
    onPointerUp: () => void;
    onPointerLeave: () => void;
    onPointerCancel: () => void;
  };
  /** L'événement en cours suit-il un appui long DÉJÀ déclenché ? Lisible par CHACUN des événements
   *  natifs de la salve (`contextmenu` PUIS `click` au doigt) : la réponse tient `FENETRE_AVALEMENT`
   *  ms après le déclenchement, et le `pointerdown` suivant la remet à zéro. */
  consomme: () => boolean;
}

export function useLongPress(action: (() => void) | undefined, delai = DELAI_APPUI_LONG): LongPress {
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const depart = useRef<{ x: number; y: number } | null>(null);
  const declenche = useRef(0);
  const geste = useRef(action);
  geste.current = action;

  const annuler = useCallback(() => {
    if (minuteur.current) clearTimeout(minuteur.current);
    minuteur.current = null;
    depart.current = null;
  }, []);

  useEffect(() => annuler, [annuler]);

  const onPointerDown = useCallback(
    (e: { clientX: number; clientY: number; button?: number }) => {
      if (!geste.current) return;
      // BOUTON PRINCIPAL seulement. Là où le `contextmenu` naît À L'APPUI (macOS, Linux), un clic
      // droit maintenu déclencherait le geste une 2ᵉ fois au bout du délai — à N≥2, le panneau que
      // le clic droit vient d'ouvrir se refermerait tout seul.
      if ((e.button ?? 0) !== 0) return;
      annuler();
      declenche.current = 0;
      depart.current = { x: e.clientX, y: e.clientY };
      minuteur.current = setTimeout(() => {
        minuteur.current = null;
        declenche.current = Date.now();
        geste.current?.();
      }, delai);
    },
    [annuler, delai],
  );

  const onPointerMove = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const d = depart.current;
      if (!d) return;
      if (Math.abs(e.clientX - d.x) > TOLERANCE || Math.abs(e.clientY - d.y) > TOLERANCE) annuler();
    },
    [annuler],
  );

  const consomme = useCallback(() => declenche.current > 0 && Date.now() - declenche.current < FENETRE_AVALEMENT, []);

  return {
    handlers: { onPointerDown, onPointerMove, onPointerUp: annuler, onPointerLeave: annuler, onPointerCancel: annuler },
    consomme,
  };
}
