/**
 * L'EXPLORÉ DU PAS COURANT — la dérivation que partagent les DEUX hôtes du monde (`IsoStage`,
 * `pov/PovStage`) : ce que le store a retenu, PLUS ce que le groupe voit à l'instant.
 *
 * Deux raisons, et elles vivent ensemble ici pour qu'aucun hôte n'en applique qu'une :
 *  - l'UNION : un pas découvre des cases, et l'accumulation persistante (`markExplored`) ne fait que
 *    les confirmer au commit SUIVANT. Sans elle, un pas passe DEUX champs de teinte — un au calcul de
 *    `visible`, un au retour du store — donc deux fois toute la cascade qui en descend (#1396) ;
 *  - la RÉFÉRENCE STABLE AU CONTENU : le commit de confirmation rend un ensemble ÉGAL, et la teinte
 *    qui en descend (`visibilityField`) ne doit pas s'y reforger.
 */
import { useMemo, useRef } from 'react';

/** L'exploré du store pour cette scène, uni aux cases vues à l'instant — référence stable au CONTENU. */
export function useExploreCourant(
  explored: Record<string, string[]>,
  sceneId: string | undefined,
  visible: ReadonlySet<string>,
): Set<string> {
  const retenu = useRef<Set<string> | null>(null);
  return useMemo(() => {
    const set = new Set(explored[sceneId ?? ''] ?? []);
    for (const k of visible) set.add(k);
    const précédent = retenu.current;
    if (précédent && précédent.size === set.size) {
      let identique = true;
      for (const k of set) if (!précédent.has(k)) { identique = false; break; }
      if (identique) return précédent;
    }
    retenu.current = set;
    return set;
  }, [explored, sceneId, visible]);
}
