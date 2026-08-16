/**
 * Garde d'authoring des scripts de galerie/QC : un id de garde-robe qui ne résout pas doit
 * ARRÊTER le script, jamais déshabiller la planche en silence (repli Nu de `tenueFor`, #1338).
 * Source unique de l'invariant : les scripts appellent, ils ne recodent pas le `if`.
 */
import { resolveWardrobeId } from '../src/gameIso/rig/parts/career';

/**
 * Id de garde-robe utilisé comme ENTRÉE (mannequin, carrière, classe, tenue) : il doit résoudre
 * vers une garde-robe habillée. Rend l'id tel quel.
 * @param script tag du script, affiché entre crochets dans le message (ex. `qc-species`).
 */
export function assertWardrobeId(id: string, script: string): string {
  if (resolveWardrobeId(id) === 'nu')
    throw new Error(`[${script}] id de garde-robe « ${id} » non résolu par resolveWardrobeId — catalogue incohérent.`);
  return id;
}

/**
 * Id d'une entrée du CATALOGUE de tenues : forme forte, la résolution doit être l'IDENTITÉ
 * (une entrée qui résout vers autre chose est une faute d'authoring). Rend l'id tel quel.
 */
export function assertTenueCatalogId(id: string, script: string): string {
  if (resolveWardrobeId(id) !== id)
    throw new Error(`[${script}] id de tenue « ${id} » non résolu par resolveWardrobeId — catalogue incohérent.`);
  return id;
}
