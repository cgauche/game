/**
 * LA FICHE d'un PNJ de scène — projection UNIQUE `SceneEntity` → `Combatant`, partagée par tous les
 * flux qui font JOUER un PNJ hors combat (table de taverne, marchandage, infirmerie payante). Elle
 * vit ici, hors de tout flux, pour qu'aucun d'eux n'en refasse une : un PNJ a UNE fiche, quelle que
 * soit la porte par laquelle la partie le rencontre.
 */
import type { Combatant } from '../engine/types';
import type { Scene } from './scene';
import { spawnEnemy } from './spawn';
import { resolvePresetCreature } from './campaignData';

/**
 * LE PNJ DE SCÈNE derrière un id, dérivé en Combatant — MÊME chemin de résolution que le spawn de
 * rencontre (`combatSlice.ts:2623`) : un PNJ nommé de campagne porte son profil par `presetId`
 * (`resolvePresetCreature` → CreatureData mergée + apparence embarquée), et n'a NI `ref` NI
 * `statblock`. L'ignorer faisait tomber `spawnEnemy` en branche « ref absente » — fiche vide, nom
 * générique : l'adversaire à fiche redevenait l'adversaire nu qu'on venait de supprimer.
 *
 * DETTE DITE (#1279 S4-c, décision d'architecture commissionnée à part) : cette dérivation est
 * ÉPHÉMÈRE. Il n'existe aucun registre de Combatants persistants hors combat (`actorIn` =
 * `battle.combatants ?? party`, `state/combatants.ts`), donc ce que la partie ÉCRIRAIT sur cette
 * fiche — un État d'attrition (`SequenceRoundOps.attrition`, appliqué par `sequenceRoundOps` sur des
 * porteurs résolus par `actorIn`), un mouvement de bourse (`creditBourse`/`debitBourse` écrivent
 * dans `party`) — ne s'y déposerait pas. Le lot S4-b est donc en LECTURE SEULE : le PNJ joue de sa
 * fiche, il n'en subit rien. Aucune simulation ne comble ce trou.
 */
export function sceneNpc(scene: Scene | null | undefined, id: string): Combatant | undefined {
  const ent = scene?.entities.find((e) => e.id === id && e.kind === 'personnage');
  if (!ent) return undefined;
  const preset = ent.presetId ? resolvePresetCreature(ent.presetId) : undefined;
  const c = spawnEnemy(ent.ref, ent.statblock, ent.id, ent.pos, {
    presetCreature: preset?.creature,
    appearance: preset?.apparence ?? ent.appearance,
  });
  // DELTA DE NOM (#1463 S3, premier champ du futur `{base, delta}`) : le label posé sur l'ENTITÉ écrase
  // celui de la fiche spawnée — la fiche donne les valeurs, l'entité donne le nom.
  return ent.label ? { ...c, label: ent.label } : c;
}
