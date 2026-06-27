/**
 * IDS STABLES des qualités d'objet — clés de RÈGLES côté moteur (fin des littéraux FR « Flexible »,
 * « Recharge » dispersés). L'`id` est le slug du libellé canonique (= `qualities.json[].id`,
 * = `slugId(QualityDef.key)`) : ce que la DONNÉE et le runtime (`ItemInstance/Weapon.qualities`, des
 * `QualityInstance{id, value?}`) stockent. `hasQuality`/`qualityIndice` comparent désormais par cet id.
 *
 * Source UNIQUE : l'`id` se dérive du registre `QUALITIES` (`slugId(key)`) — aucune table à maintenir
 * à la main. `QUALITY_IDS` expose les ids sous un nom TS lisible pour les sites d'appel moteur.
 */
import { slugId } from '../../data/slug';

/** Id stable d'une qualité depuis sa clé de registre (label FR canonique). */
export const qualityIdOf = (key: string): string => slugId(key);

/** Ids des qualités référencées par le moteur (clés de règles). Valeur = `slugId(label canonique)`. */
export const QUALITY_IDS = {
  Flexible: 'flexible',
  Volumineux: 'volumineux',
  Recharge: 'recharge',
  Solide: 'solide',
  Partielle: 'partielle',
  PointsFaibles: 'points-faibles',
  Impenetrable: 'impenetrable',
  Inoffensive: 'inoffensive',
  Dangereuse: 'dangereuse',
  Empaleuse: 'empaleuse',
  Bacle: 'bacle',
  Infecte: 'infecte',
  Taille: 'taille',
  Salve: 'salve',
  Defensive: 'defensive',
  Protectrice: 'protectrice',
  Assommante: 'assommante',
  Precise: 'precise',
  Pratique: 'pratique',
  PeuFiable: 'peu-fiable',
  Devastatrice: 'devastatrice',
  Percutante: 'percutante',
} as const;
