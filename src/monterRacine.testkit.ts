/**
 * Montage de test d'une racine react-dom, et son démontage COLLECTIF.
 *
 * Un fichier qui monte plusieurs fois dans le même test (ou qui monte hors de son `mount()` local)
 * ne peut pas se contenter d'un porteur `root` unique : la réassignation perd la racine précédente,
 * qui reste inscrite au planificateur react-dom PARTAGÉ par le worker (`test.isolate: false`) et se
 * réveille hors `act()` pendant un fichier suivant — « Should not already be working » chez la
 * victime (#1724), rendu vide (#1619). Ici les montages sont RETENUS : `demonterRacines()` les rend
 * tous, dans l'ordre inverse du montage, et le fichier n'a plus de compte à tenir.
 *
 * Le démontage ne s'enregistre PAS tout seul : sous `isolate: false` le corps de ce module n'est
 * évalué qu'une fois par worker, un `afterEach` posé ici n'appartiendrait qu'au premier fichier
 * importateur. Chaque fichier appelle donc `demonterRacines()` dans SON `afterEach`.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ReactNode } from 'react';

/** Ce qu'un montage de test offre : son conteneur (attaché à `document.body`) et le re-rendu de SA
 *  racine — brut, pour que l'appelant garde la main sur l'`act()` qui l'enveloppe. */
export type MontageTest = { container: HTMLDivElement; rendre(node: ReactNode): void };

const montages: { root: Root; container: HTMLDivElement }[] = [];

/** Monte `node` dans un conteneur neuf attaché à `document.body`, sous `act()`. */
export function monterRacine(node: ReactNode): MontageTest {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  montages.push({ root, container });
  act(() => { root.render(node); });
  return { container, rendre: (n) => root.render(n) };
}

/** Démonte TOUT ce que `monterRacine` a monté depuis le dernier appel, et retire les conteneurs. */
export function demonterRacines(): void {
  for (const { root, container } of montages.splice(0).reverse()) {
    act(() => { root.unmount(); });
    container.remove();
  }
}
