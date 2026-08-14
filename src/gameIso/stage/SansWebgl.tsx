import { useSyncExternalStore } from 'react';
import { subscribeWebglRefusé, webglRefusé } from './webglSupport';

/**
 * LE MONDE NE PEUT PAS ÊTRE PEINT (#1176, P3-4, commit C5a) — ce que le joueur voit quand la machine
 * refuse le contexte volumique (GPU sur liste noire, machine virtuelle, budget de contextes épuisé).
 * Il n'y a plus qu'un moteur de monde : l'échec ne se replie plus en silence sur un second peintre, il
 * se DIT. Un écran nu et muet était la seule autre issue.
 *
 * `compact` : la variante posée DANS un panneau (plan de station), qui n'occupe que la boîte de son
 * hôte et laisse la surcouche de marqueurs par-dessus.
 */
export function SansWebgl({ compact }: { compact?: boolean } = {}) {
  return (
    <div className={compact ? 'panel sans-webgl compact' : 'panel sans-webgl'} role="alert">
      <strong>Le monde ne peut pas être affiché</strong>
      <p className="muted">
        Ce jeu dessine ses décors avec WebGL 2. Votre navigateur ou votre machine vient de le refuser.
      </p>
      {!compact && (
        <p className="muted">
          Activez l’accélération matérielle dans les réglages du navigateur, mettez à jour vos pilotes
          graphiques, puis rechargez la page.
        </p>
      )}
    </div>
  );
}

/** Le verdict, à l'usage des hôtes de monde : `true` = monter `SansWebgl` au lieu du canevas. */
export function useWebglRefusé(): boolean {
  return useSyncExternalStore(subscribeWebglRefusé, webglRefusé, webglRefusé);
}
