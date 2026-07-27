/**
 * ÉTAGE — source UNIQUE du contrôle et du vocabulaire d'étage de l'éditeur.
 *
 * Un étage se choisit TOUJOURS parmi ceux qui EXISTENT : la scène en porte la liste
 * (`scene.layers`), un corps d'architecture porte celle de ses étages. Le domaine est cette liste,
 * jamais un entier libre — un z hors liste pose l'élément sur une couche que rien ne dessine et que
 * plus rien ne peut re-sélectionner.
 *
 * Muet quand il n'y a qu'un étage : il n'y a rien à choisir.
 */

/** Nom d'un étage — le SEUL mot de l'éditeur pour le dire, contrôles et rangées de liste compris. */
export function layerLabel(z: number): string {
  return z === 0 ? 'Rez' : `Étage ${z}`;
}

/** Contrôle d'ÉTAGE d'un élément : le choix se fait dans `layers` (les étages qui EXISTENT). */
export function LayerField({
  z,
  layers,
  onChange,
  label = 'Étage',
}: {
  /** Étage courant de l'élément (absent = rez). */
  z: number | undefined;
  /** Étages où l'élément peut vivre, dans l'ordre — `scene.layers` ou les étages d'un corps. */
  layers: number[];
  onChange: (z: number) => void;
  /** Intitulé quand l'étage a un RÔLE particulier (« Étage sommet » d'une masse de toiture). */
  label?: string;
}) {
  // Le domaine est un ENSEMBLE d'étages : deux corps peuvent poser deux étages au même z, et un
  // étage ne s'y propose qu'une fois.
  const zs = [...new Set(layers)].sort((a, b) => a - b);
  if (zs.length < 2) return null;
  return (
    <label className="ed-field">
      {label}
      <select value={z ?? 0} onChange={(e) => onChange(Number(e.target.value))}>
        {zs.map((n) => (
          <option key={n} value={n}>
            {layerLabel(n)}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Étage d'une RANGÉE de liste — même vocabulaire que le contrôle, muet sur un plan d'un seul étage. */
export function LayerChip({ z, layers }: { z: number | undefined; layers: number[] }) {
  if (layers.length < 2) return null;
  return <span className="chip">{layerLabel(z ?? 0)}</span>;
}

/** Étages d'une SCÈNE, triés — domaine de tout élément posé sur le plan. */
export function sceneLayerZs(scene: { layers: { z: number }[] }): number[] {
  return scene.layers.map((l) => l.z).sort((a, b) => a - b);
}
