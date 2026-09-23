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
 *
 * Chaque liste rendue est un `Set` MÉMORISÉ par (fichier, version) : la version vient de la source
 * (`SourceDIdsVivants.version`), seul témoin d'une écriture au seam — un binding muté en place garde
 * son identité. Poser une source vide le mémo.
 */

/** Ce que la couche donnée fournit : les entrées VIVES d'un document, sa version, et son champ discriminant. */
export interface SourceDIdsVivants {
  /** Entrées en mémoire d'un document, par nom de fichier (`materials.json`) — `undefined` si ce
   *  document n'a pas de binding mutable (il n'a alors rien qui puisse diverger du fichier généré). */
  readonly entrees: (fichier: string) => readonly Record<string, unknown>[] | undefined;
  /** Version des entrées d'un document : change à chaque écriture au seam, jamais entre deux. */
  readonly version: (fichier: string) => number;
  /** Champ DISCRIMINANT déclaré par le def de ce document, ou `undefined` s'il n'en déclare pas. */
  readonly discriminantDe: (fichier: string) => string | undefined;
}

let source: SourceDIdsVivants | undefined;

/** Mémo des listes vives : clé de liste → (version du document, ids). */
const memo = new Map<string, { readonly version: number; readonly ids: ReadonlySet<string> }>();

/** Pose la source vivante — appelée UNE fois par la couche donnée au chargement de ses bindings — et
 *  REND la source précédente (`undefined` = aucune) : c'est la couture par laquelle un test repose
 *  celle qu'il a trouvée au lieu de muter le registre généré. */
export function poserSourceDIdsVivants(s: SourceDIdsVivants | undefined): SourceDIdsVivants | undefined {
  const precedente = source;
  source = s;
  memo.clear();
  return precedente;
}

/** Ids des entrées du document `fichier` que `retenue` admet, sous la clé de mémo `cle`. */
function memorise(fichier: string, cle: string, retenue: (e: Record<string, unknown>) => boolean): ReadonlySet<string> | undefined {
  if (!source) return undefined;
  const version = source.version(fichier);
  const connu = memo.get(cle);
  if (connu && connu.version === version) return connu.ids;
  const entrees = source.entrees(fichier);
  if (!entrees) return undefined;
  const ids = new Set<string>();
  for (const e of entrees) if (retenue(e)) ids.add(String(e.id));
  memo.set(cle, { version, ids });
  return ids;
}

/** Ids d'un document tels que la MÉMOIRE les porte — `undefined` si aucune source n'est posée ou si
 *  ce document n'a pas de binding mutable : l'appelant lit alors le registre généré. */
export function idsVivants(fichier: string): ReadonlySet<string> | undefined {
  return memorise(fichier, fichier, () => true);
}

/** Ids d'une SOUS-LISTE discriminée telle que la mémoire la porte (`materials.json` × `domain`) —
 *  `undefined` si aucune source, aucun binding mutable, ou aucun discriminant déclaré. */
export function idsVivantsDuDiscriminant(fichier: string, valeur: string): ReadonlySet<string> | undefined {
  const champ = source?.discriminantDe(fichier);
  if (champ === undefined) return undefined;
  return memorise(fichier, `${fichier}\u0000=${valeur}`, (e) => e[champ] === valeur);
}

/** Ids d'une SOUS-LISTE MARQUÉE telle que la mémoire la porte : les entrées qui portent le champ
 *  `marqueur` (`props.json` × `volume`) — `undefined` si aucune source ou aucun binding mutable. */
export function idsVivantsDuMarqueur(fichier: string, marqueur: string): ReadonlySet<string> | undefined {
  return memorise(fichier, `${fichier}\u0000?${marqueur}`, (e) => e[marqueur] !== undefined);
}
