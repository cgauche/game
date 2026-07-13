/**
 * Mode ATELIER du Compendium — bascule l'affordance d'ÉDITION (éditer/créer une fiche via l'éditeur de
 * données intégré). Défaut OFF, PERSISTANT (localStorage), DÉCOUVRABLE (bouton d'en-tête) : l'édition
 * reste un pilier produit, jamais derrière un flag de build. Source UNIQUE de l'état (module + hook
 * `useSyncExternalStore`, comme la fraîcheur du Codex) : toutes les vues du Compendium restent en phase.
 */
import { useSyncExternalStore } from 'react';

const KEY = 'wfrp4.compendium.atelier.v1';
const listeners = new Set<() => void>();

let atelier: boolean = (() => {
  try {
    return globalThis.localStorage?.getItem(KEY) === '1';
  } catch {
    return false;
  }
})();

export function atelierMode(): boolean {
  return atelier;
}

export function setAtelierMode(on: boolean): void {
  atelier = on;
  try {
    if (on) globalThis.localStorage?.setItem(KEY, '1');
    else globalThis.localStorage?.removeItem(KEY);
  } catch {
    // stockage indisponible : le mode reste effectif pour la session, sans persistance
  }
  for (const l of listeners) l();
}

export function useAtelierMode(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    atelierMode,
    () => false,
  );
}
