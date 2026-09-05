/**
 * IDS VIVANTS (#1686 lot 3a-2) — le SECOND régime du registre d'ids, celui de la MÉMOIRE.
 *
 * `_ids.generated.ts` déclare deux régimes : le fichier figé au commit (`npm run gen`), et le
 * recalcul depuis les datasets EN MÉMOIRE, seul régime juste dès qu'une entité est créée ou renommée
 * à l'atelier — sans lui, une entité neuve est invalide pour toute donnée qui la référence tant que
 * le générateur n'a pas tourné.
 *
 * Ce module est une FEUILLE : il n'importe RIEN. C'est ce qui le rend consommable par `ref.ts`, que
 * le registre généré ne peut pas atteindre (`_registry.generated.ts` importe les defs, qui appellent
 * `idDe` à l'initialisation — lire le registre depuis `ref.ts` fermerait le cycle). La couche DONNÉE
 * (`src/data/overrides.ts`, propriétaire des bindings mutés en place) POSE sa source ici ; sans
 * source posée (scripts, gardes, `npm run gen` : aucun état d'application), tout rend `undefined` et
 * l'appelant retombe sur le fichier généré.
 */

/** Ce que la couche donnée fournit : les entrées VIVES d'un document, et son champ discriminant. */
export interface SourceDIdsVivants {
  /** Entrées en mémoire d'un document, par nom de fichier (`materials.json`) — `undefined` si ce
   *  document n'a pas de binding mutable (il n'a alors rien qui puisse diverger du fichier généré). */
  readonly entrees: (fichier: string) => readonly Record<string, unknown>[] | undefined;
  /** Champ DISCRIMINANT déclaré par le def de ce document, ou `undefined` s'il n'en déclare pas. */
  readonly discriminantDe: (fichier: string) => string | undefined;
}

let source: SourceDIdsVivants | undefined;

/** Pose la source vivante — appelée UNE fois par la couche donnée au chargement de ses bindings. */
export function poserSourceDIdsVivants(s: SourceDIdsVivants): void {
  source = s;
}

/** Ids d'un document tels que la MÉMOIRE les porte — `undefined` si aucune source n'est posée ou si
 *  ce document n'a pas de binding mutable : l'appelant lit alors le registre généré. */
export function idsVivants(fichier: string): readonly string[] | undefined {
  const entrees = source?.entrees(fichier);
  if (!entrees) return undefined;
  return entrees.map((e) => String(e.id));
}

/** Ids d'une SOUS-LISTE discriminée telle que la mémoire la porte (`materials.json` × `domain`) —
 *  `undefined` si aucune source, aucun binding mutable, ou aucun discriminant déclaré. */
export function idsVivantsDuDiscriminant(fichier: string, valeur: string): readonly string[] | undefined {
  const entrees = source?.entrees(fichier);
  const champ = source?.discriminantDe(fichier);
  if (!entrees || !champ) return undefined;
  return entrees.filter((e) => e[champ] === valeur).map((e) => String(e.id));
}
