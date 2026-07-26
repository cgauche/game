import pkg from '../../package.json';

/** Une erreur playtest capturée — contexte suffisant pour la recoller dans une issue sans rejouer
 *  la soirée (#304). */
export interface ErrorEntry {
  message: string;
  stack: string;
  scene: string | null;
  seed: number | null;
  version: string;
  at: string;
}

const MAX_ENTRIES = 50;
const STACK_LIMIT = 2000;
const buffer: ErrorEntry[] = [];
const listeners = new Set<() => void>();

export type ErrorContext = { scene: string | null; seed: number | null };

let contextProvider: () => ErrorContext = () => ({ scene: null, seed: null });

/** Branche la source du contexte (scène courante, seed RNG) — appelé une fois depuis `main.tsx`
 *  (le collecteur reste indépendant du store, seul `main.tsx` connaît les deux). */
export function setErrorContextProvider(fn: () => ErrorContext): void {
  contextProvider = fn;
}

/** Notifie les abonnés (bandeau DEV) en microtâche : `recordError` est appelé DEPUIS
 *  `componentDidCatch` (phase de commit React, cf. `SceneErrorBoundary`) — notifier `setState` de
 *  façon SYNCHRONE y déclenche « Cannot update a component while rendering a different component »
 *  (React refuse un `setState` pendant que l'arbre d'un autre composant est en cours de rendu).
 *  Différer d'une microtâche laisse ce rendu se terminer avant que le bandeau ne se mette à jour. */
function notifyListeners(): void {
  queueMicrotask(() => listeners.forEach((l) => l()));
}

/** Enregistre une entrée dans le buffer borné (FIFO au-delà de `MAX_ENTRIES`). Appelée par
 *  `installErrorCollector` (window.onerror/unhandledrejection) ET par les `ErrorBoundary` React
 *  (`componentDidCatch`) — seul point d'écriture du buffer. */
export function recordError(message: string, stack?: string | null): ErrorEntry {
  const ctx = contextProvider();
  const entry: ErrorEntry = {
    message: message || '(erreur sans message)',
    stack: (stack ?? '').slice(0, STACK_LIMIT),
    scene: ctx.scene,
    seed: ctx.seed,
    version: pkg.version,
    at: new Date().toISOString(),
  };
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) buffer.shift();
  notifyListeners();
  return entry;
}

export function errorEntries(): ErrorEntry[] {
  return [...buffer];
}

export function clearErrors(): void {
  buffer.length = 0;
  notifyListeners();
}

export function exportErrorsJson(): string {
  return JSON.stringify(errorEntries(), null, 2);
}

/** Abonnement (bandeau DEV) — notifié à chaque `recordError`/`clearErrors`. Retourne le désabonnement. */
export function subscribeErrors(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** API exposée sur `window.__wfrp` — DEV et PROD (contrairement à `buildApi()` de `devtools.ts`,
 *  DEV uniquement). `main.tsx` la fusionne dans `window.__wfrp` APRÈS l'installation DEV des autres
 *  helpers, pour ne pas être écrasée par `installDevtools` (qui réassigne `window.__wfrp` en bloc). */
export const wfrpErrorsApi = {
  errors: errorEntries,
  exportErrors: exportErrorsJson,
};

/** Capteurs globaux zéro-réseau (#304) : `window.onerror` + `unhandledrejection`. Idempotent au
 *  niveau applicatif (appelé une fois depuis `main.tsx`) ; no-op hors navigateur (tests Node). */
export function installErrorCollector(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('error', (ev) => {
    recordError(ev.message, ev.error instanceof Error ? (ev.error.stack ?? null) : null);
  });
  window.addEventListener('unhandledrejection', (ev) => {
    const reason = ev.reason as unknown;
    recordError(
      reason instanceof Error ? reason.message : String(reason),
      reason instanceof Error ? (reason.stack ?? null) : null,
    );
  });
  const w = window as unknown as { __wfrp?: Record<string, unknown> };
  w.__wfrp = { ...w.__wfrp, ...wfrpErrorsApi };
}
