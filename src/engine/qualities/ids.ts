/**
 * IDS STABLES des qualités d'objet — clés de RÈGLES côté moteur (fin des littéraux FR « Flexible »,
 * « Recharge » dispersés). L'`id` est le slug du libellé canonique (= `qualities.json[].id`,
 * = `slugId(QualityDef.key)`) : ce que la DONNÉE et le runtime (`ItemInstance/Weapon.qualities`, des
 * `QualityInstance{id, value?}`) stockent. `hasQuality`/`qualityIndice` comparent par cet id.
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
  Perforante: 'perforante',
  ArmeDEquipe: 'arme-d-equipe',
  Leger: 'leger',
  Raffine: 'raffine',
} as const;

/** Atouts de FABRICATION (LDB 60 p.286, « X de qualité ») — les 4 Atouts CHOISISSABLES par le
 *  joueur à la création d'un objet de qualité (#657 Lot 1, moteur fondation ; Lot 2 = l'UI de choix).
 *  Ordre = défaut de résolution sans choix explicite (1re entrée, EN MIROIR de `{choice}`). */
export const FABRICATION_ATOUTS = [QUALITY_IDS.Raffine, QUALITY_IDS.Leger, QUALITY_IDS.Pratique, QUALITY_IDS.Solide] as const;

/** `QualityRef` d'un Atout de Fabrication résolu (choisi/défauté) — pose l'Indice par défaut des Atouts
 *  À VALEUR (Solide « encaisse Indice PdD », LDB 286 : un SEUL Atout → Indice 1) ; les autres
 *  (Léger/Pratique/Raffiné) n'ont pas d'Indice (#657 Lot 1, correctif juge). */
export function fabricationAtoutQuality(id: string): { id: string; value?: number } {
  return id === QUALITY_IDS.Solide ? { id, value: 1 } : { id };
}
