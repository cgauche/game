/**
 * Effets des Talents qui influencent la création / les attributs (LDB 10 — descriptions
 * verbatim, encodées dans talents.json via `addCharacteristic` / `addSkill`) :
 *
 *  - « Vous gagnez un bonus permanent de +5 à votre Caractéristique X de départ (ne compte pas
 *    comme des Augmentations) » : Guerrier né (CC), Tireur de précision (CT), Très fort (F),
 *    Très résistant (E), Vivacité (I), Réflexes foudroyants (Ag), Doigts de fée (Dex),
 *    Perspicace (Int), Imperturbable (FM), Affable (Soc) — tous Maxi 1.
 *  - Dur à cuire : « autant de Points de Blessure supplémentaires que votre Bonus d'Endurance »
 *    (recalculé si le BE augmente) — par acquisition.
 *  - Chanceux : « maximum de Points de Chance = Points de Destin + nombre de fois Chanceux ».
 *  - Obstiné : « Ajoutez votre niveau d'Obstiné au maximum de votre réserve de Détermination ».
 *  - Véloce : « Vous gagnez +1 à votre Attribut de Mouvement ».
 *  - « Ajoutez la Compétence X à n'importe quelle Carrière que vous entamez. Si la Compétence
 *    est déjà incluse dans votre Carrière, vous pouvez à la place acheter la Compétence pour
 *    5 PX de moins par Augmentation » : Maître artisan (Métier), Oreille absolue
 *    (Divertissement (Chant)), Sorcier ! (Langue (Magick)), Voyageur aguerri (Savoir (Région)),
 *    Artiste (Art).
 *
 * Costaud (Encombrement) est déjà appliqué par items.maxEncumbrance ; Petit/Massif (Taille)
 * par l'espèce. Les autres talents (combat, social…) sont hors périmètre.
 */
import { Combatant, CHAR_BY_LABEL, CharKey } from './types';
import { bonus, maxWounds } from './characteristics';
import { findTalent } from '../data';
import { splitLabel, concreteLabel } from './careerSlots';

/** Caractéristique « +5 de départ » conférée par un talent (clé courte), sinon null. */
export function talentCharBonus(talentLabel: string): CharKey | null {
  const data = findTalent(splitLabel(talentLabel).name);
  if (!data?.addCharacteristic) return null;
  return CHAR_BY_LABEL[data.addCharacteristic] ?? null;
}

/**
 * Applique l'effet d'acquisition d'un Talent (création OU achat PX) — mute le héros.
 * +5 Caractéristique de départ (PAS une Augmentation → charAdvances intacts) ; Véloce : +1
 * Mouvement. Les effets dérivés (Blessures, Chance, Détermination) sont des helpers recalculés
 * par l'appelant (heroMaxWounds / fortuneMax / resolveMax).
 */
export function applyTalentAcquisition(hero: Combatant, talentLabel: string): void {
  const key = talentCharBonus(talentLabel);
  if (key) hero.characteristics[key] += 5;
  if (splitLabel(talentLabel).name === 'Véloce') hero.movement += 1;
}

/** Points de Blessure supplémentaires : Dur à cuire = BE par acquisition (LDB 10). */
export function extraWounds(hero: Combatant): number {
  const times = hero.talents.find((t) => t.name === 'Dur à cuire')?.times ?? 0;
  return times * bonus(hero.characteristics.E);
}

/** Blessures max d'un héros = formule des Attributs (BF+2×BE+BFM × Taille) + Dur à cuire. */
export function heroMaxWounds(hero: Combatant): number {
  return maxWounds(hero.characteristics, hero.size ?? 'moyenne') + extraWounds(hero);
}

/** Maximum de Points de Chance : Destin + niveaux de Chanceux (LDB 10 « Chanceux »). */
export function fortuneMax(hero: Combatant): number {
  const times = hero.talents.find((t) => t.name === 'Chanceux')?.times ?? 0;
  return (hero.fate ?? 0) + times;
}

/** Maximum de Détermination : Résilience + niveaux d'Obstiné (LDB 10 « Obstiné »). */
export function resolveMax(hero: Combatant): number {
  const times = hero.talents.find((t) => t.name === 'Obstiné')?.times ?? 0;
  return (hero.resilience ?? 0) + times;
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
