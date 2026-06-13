/**
 * Effets des Talents qui influencent la création / les attributs — PILOTÉS PAR LES DONNÉES :
 * chaque talent de talents.json porte `addCharacteristic` / `addSkill`, posés par l'extraction
 * des livres ; un supplément qui ajoute un talent étiqueté pareil est couvert sans code.
 *
 * Sémantique des `addCharacteristic` (descriptions LDB 10, verbatim) :
 *  - une des 10 Caractéristiques (« Force », « Sociabilité »…) : « Vous gagnez un bonus
 *    permanent de +5 à votre Caractéristique X de départ (ne compte pas comme des
 *    Augmentations) » — Guerrier né, Tireur de précision, Très fort, Très résistant, Vivacité,
 *    Réflexes foudroyants, Doigts de fée, Perspicace, Imperturbable, Affable (tous Maxi 1) ;
 *  - « Blessure » : « autant de Points de Blessure supplémentaires que votre Bonus
 *    d'Endurance » (Dur à cuire) — recalculé si le BE augmente, par acquisition ;
 *  - « Chance » : « maximum de Points de Chance = Points de Destin + nombre de fois » (Chanceux) ;
 *  - « Détermination » : « Ajoutez votre niveau au maximum de votre réserve » (Obstiné) ;
 *  - « Mouvement » : « Vous gagnez +1 à votre Attribut de Mouvement » (Véloce) ;
 *  - « Corruption » (Âme pure) : seuil de Corruption +niveau — câblé dans corruption.ts
 *    (corruptionThresholdExceeded), pas ici.
 *
 * `addSkill` : « Ajoutez la Compétence X à n'importe quelle Carrière que vous entamez. Si la
 * Compétence est déjà incluse dans votre Carrière, vous pouvez à la place acheter la Compétence
 * pour 5 PX de moins par Augmentation » — Maître artisan (Métier), Oreille absolue
 * (Divertissement (Chant)), Sorcier ! (Langue (Magick)), Voyageur aguerri (Savoir (Région)),
 * Artiste (Art).
 *
 * Costaud (Encombrement) est déjà appliqué par items.maxEncumbrance ; Petit/Massif (Taille)
 * par l'espèce. Les autres talents (combat, social…) sont hors périmètre.
 */
import { Combatant, CHAR_BY_LABEL, CharKey } from './types';
import { bonus, maxWounds } from './characteristics';
import { findTalent } from '../data';
import { splitLabel, concreteLabel } from './careerSlots';
import { blessingsOf } from './cults/registry';

/** `addCharacteristic` d'un talent (libellé long des données), sinon null. */
function addCharOf(talentLabel: string): string | null {
  return findTalent(splitLabel(talentLabel).name)?.addCharacteristic ?? null;
}

/** Somme des `times` des talents du héros dont addCharacteristic === attr. */
function timesWithAddChar(hero: Combatant, attr: string): number {
  return hero.talents.reduce((a, t) => a + (addCharOf(t.name) === attr ? t.times : 0), 0);
}

/** Caractéristique « +5 de départ » conférée par un talent (clé courte), sinon null. */
export function talentCharBonus(talentLabel: string): CharKey | null {
  const attr = addCharOf(talentLabel);
  return attr ? CHAR_BY_LABEL[attr] ?? null : null;
}

/**
 * Applique l'effet d'acquisition d'un Talent (création OU achat PX) — mute le héros.
 * +5 Caractéristique de départ (PAS une Augmentation → charAdvances intacts) ; Mouvement : +1.
 * Les effets dérivés (Blessures, Chance, Détermination) sont des helpers recalculés par
 * l'appelant (heroMaxWounds / fortuneMax / resolveMax).
 */
export function applyTalentAcquisition(hero: Combatant, talentLabel: string): void {
  const key = talentCharBonus(talentLabel);
  if (key) hero.characteristics[key] += 5;
  if (addCharOf(talentLabel) === 'Mouvement') hero.movement += 1;
  // Béni (Culte) — LDB 10/41 : « reçoit les SIX Bénédictions de son culte » → octroi AUTOMATIQUE
  // à l'acquisition (création + achat PX), pas un achat à 0 PX par clic. Un « Béni » au culte non
  // résolu (« Au choix ») n'octroie rien — la mémorisation passe alors par l'onglet Avancement.
  const beni = talentLabel.match(/^Béni\s*\(([^)]+)\)\s*$/);
  if (beni && !/au choix/i.test(beni[1])) {
    const six = blessingsOf(beni[1].trim()).filter((b) => !(hero.spells ?? []).includes(b));
    if (six.length) hero.spells = [...(hero.spells ?? []), ...six];
  }
}

/** Points de Blessure supplémentaires : BE par acquisition d'un talent « Blessure » (Dur à cuire). */
export function extraWounds(hero: Combatant): number {
  return timesWithAddChar(hero, 'Blessure') * bonus(hero.characteristics.E);
}

/** Blessures max d'un héros = formule des Attributs (BF+2×BE+BFM × Taille) + talents « Blessure ». */
export function heroMaxWounds(hero: Combatant): number {
  return maxWounds(hero.characteristics, hero.size ?? 'moyenne') + extraWounds(hero);
}

/** Maximum de Points de Chance : Destin + niveaux des talents « Chance » (Chanceux, LDB 10). */
export function fortuneMax(hero: Combatant): number {
  return (hero.fate ?? 0) + timesWithAddChar(hero, 'Chance');
}

/** Maximum de Détermination : Résilience + niveaux des talents « Détermination » (Obstiné). */
export function resolveMax(hero: Combatant): number {
  return (hero.resilience ?? 0) + timesWithAddChar(hero, 'Détermination');
}

/**
 * Compétences ajoutées aux listes de carrière par les talents possédés (« Ajoutez X à n'importe
 * quelle Carrière que vous entamez », LDB 10). La spec choisie à l'acquisition du talent
 * (« Maître artisan (Forgeron) ») se reporte sur la compétence ajoutée (« Métier (Forgeron) ») ;
 * un addSkill « (Au choix) » sans spec sur le talent reste un joker de groupe.
 */
export function careerSkillAdditions(hero: Combatant): string[] {
  const out: string[] = [];
  for (const t of hero.talents) {
    const { name, spec } = splitLabel(t.name);
    const data = findTalent(name);
    if (!data?.addSkill) continue;
    const add = splitLabel(data.addSkill);
    // Le talent porte une spec concrète et la compétence ajoutée est « au choix » → reporter.
    if (spec && add.spec && /au choix/i.test(add.spec)) out.push(concreteLabel(add.name, spec));
    else out.push(data.addSkill);
  }
  return out;
}
