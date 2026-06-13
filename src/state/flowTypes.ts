/**
 * Types canoniques de la plomberie des flux du store : tout module `state/*` qui reçoit le
 * couple (get, set) de Zustand les importe d'ici — fini les alias `Get`/`Set` redéclarés par
 * fichier (et les `set: any`). `Set` accepte l'objet partiel ET la forme à updater fonctionnel,
 * comme le `set` de Zustand. Import de TYPE seulement (pas de cycle d'exécution avec le store).
 */
import type { GameState } from './store';

export type Get = () => GameState;
export type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
