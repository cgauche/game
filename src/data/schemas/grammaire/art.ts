/**
 * Ids d'ART écrits par l'auteur, jugés par le schéma contre la projection GÉNÉRÉE des registres de
 * rendu (`_art.generated.ts`, option `projection` de `scripts/gen-registry.mjs`) : les `defs/` du rig
 * possèdent la déclaration, la donnée en reçoit la projection sans importer le rendu. Le rendu importe
 * ces prédicats (sens permis) : UNE computation du domaine, pour le schéma comme pour `resolveRender`.
 */
import { idDe } from './ref';
import { ESPECES_DE_CREATURE, FORMES_DE_NUEE, SEXE_DE_COIFFURE } from '../_art.generated';

/** Espèces que le CODE déclare : defs de créature et formes de nuée. */
const ESPECES_RIG_CODE: ReadonlySet<string> = new Set([...ESPECES_DE_CREATURE, ...FORMES_DE_NUEE]);
const FORMES: ReadonlySet<string> = new Set(FORMES_DE_NUEE);
/** Porte des espèces JOUABLES (`species.json`), lue vivante (entité créée au Compendium comprise). */
const especeJouable = idDe('species');

/** Domaine de SAISIE de `appearance.species` : espèce jouable ∪ espèce déclarée par le code. */
export function estEspeceDAuteur(id: string): boolean {
  return ESPECES_RIG_CODE.has(id) || especeJouable.safeParse(id).success;
}

/** L'espèce est une FORME DE NUÉE (`swarm/defs`) : elle ne se rend que par le trait Nuée. */
export function estFormeDeNuee(id: string): boolean {
  return FORMES.has(id);
}

/** Sexe d'une coiffure du rig (`hairstyles/defs`), `undefined` pour un id inconnu. */
export function sexeDeCoiffure(id: string): 'M' | 'F' | undefined {
  return Object.prototype.hasOwnProperty.call(SEXE_DE_COIFFURE, id) ? SEXE_DE_COIFFURE[id] : undefined;
}

/** Faute de la coiffure imposée `hairstyle` au regard du `sex` posé dans le MÊME objet, `null` sinon. */
export function fauteDeCoiffure(hairstyle: string, sex: 'M' | 'F' | undefined): string | null {
  const sexe = sexeDeCoiffure(hairstyle);
  if (!sexe) return `coiffure « ${hairstyle} » absente du catalogue des coiffures du rig.`;
  if (!sex) return `coiffure « ${hairstyle} » (sexe ${sexe}) imposée sans sexe posé — poser le sexe ${sexe}, ou retirer la coiffure.`;
  if (sex !== sexe) return `coiffure « ${hairstyle} » (sexe ${sexe}) imposée sur le sexe ${sex}.`;
  return null;
}
