/**
 * Effets des Talents qui influencent la création / les attributs — PILOTÉS PAR LES DONNÉES :
 * chaque talent de talents.json porte `passive: GameOp[]` (charMod/moveMod/attrMod/grantCareerSkill/
 * grantCareerTalent…), posés par l'extraction des livres ; un supplément qui ajoute un talent étiqueté
 * pareil est couvert sans code. Plus AUCUN champ bespoke (`addCharacteristic`/`addSkill`/`addTalent`
 * ont été éliminés au profit du vocabulaire `GameOp` unifié).
 *
 * Sémantique des passifs de Caractéristique (clés STABLES, ≠ libellés — multilangue ; descriptions LDB 10) :
 *  - `charMod{char,mod:5}` : « Vous gagnez un bonus permanent de +5 à votre Caractéristique X de
 *    départ (ne compte pas comme des Augmentations) » — Guerrier né, Tireur de précision, Très fort,
 *    Très résistant, Vivacité, Réflexes foudroyants, Doigts de fée, Perspicace, Imperturbable, Affable ;
 *  - `attrMod{attr:'wounds',mod:{bonusOf:'E'}}` (Dur à cuire) : « autant de Points de Blessure
 *    supplémentaires que votre Bonus d'Endurance » — recalculé si le BE augmente, par acquisition ;
 *  - `attrMod{attr:'fortune',mod:1}` (Chanceux) : « maximum de Points de Chance = Points de Destin + niveaux » ;
 *  - `attrMod{attr:'resolve',mod:1}` (Obstiné) : « Ajoutez votre niveau au maximum de votre réserve » ;
 *  - `moveMod{mod:1}` (Véloce) : « Vous gagnez +1 à votre Attribut de Mouvement » ;
 *  - Âme pure (seuil de Corruption +niveau) : via `combat.corruptionThreshold` (combatFeatures/dispatch,
 *    `talentCorruptionThreshold`), PAS un `addCharacteristic`. → plus AUCUN talent ne porte `addCharacteristic`.
 *
 * `grantCareerSkill` (op) : « Ajoutez la Compétence X à n'importe quelle Carrière que vous entamez.
 * Si la Compétence est déjà incluse dans votre Carrière, vous pouvez à la place acheter la Compétence
 * pour 5 PX de moins par Augmentation » — Maître artisan (Métier), Oreille absolue
 * (Divertissement (Chant)), Sorcier ! (Langue (Magick)), Voyageur aguerri (Savoir (Région)),
 * Artiste (Art). Son analogue `grantCareerTalent` ajoute un TALENT à toute carrière (Flagellant → Frénésie).
 *
 * Costaud (Encombrement) est déjà appliqué par items.maxEncumbrance ; Petit/Massif (Taille)
 * par l'espèce. Les autres talents (combat, social…) sont hors périmètre.
 */
import { Combatant, CHAR_KEYS, CharKey } from './types';
import { bonus, maxWounds } from './characteristics';
import { findTalent, findTalentById, blessingsOf } from '../data';
import { splitLabel } from './careerSlots';
import type { PassiveMod } from './ops';

/**
 * Valeur « base + bonus permanents de talents » pour une CharKey, SANS les modificateurs
 * de mutations/traumas/sorts/maladies. Utilisé par les lecteurs BRUTS hors-combat
 * (affichage de fiche, calcul PX, Blessures max initiales) qui ont besoin du « vrai départ »
 * incluant les +5 de talent (désormais passifs, plus cuits dans `characteristics`).
 * On ne peut PAS importer `passiveCharSum`/`characteristics` ici (cycle) → lecture LOCALE.
 */
export function baseWithTalents(c: Combatant, key: CharKey): number {
  let val = c.characteristics[key] ?? 0;
  for (const t of c.talents ?? []) {
    for (const op of findTalentById(t.talentId)?.passive ?? []) {
      if (op.op === 'charMod' && op.char === key) val += op.mod * (t.times ?? 1);
    }
  }
  return val;
}

/** Σ des `attrMod{attr}` (mod NUMÉRIQUE) portés par les talents du héros, × `times` — Chance (Chanceux),
 *  Détermination (Obstiné). DATA-DRIVEN : lit `TalentData.passive`, jamais un libellé. (Les mod-FORMULE,
 *  ex. Dur à cuire +BE, sont résolus par leur lecteur dédié — pas ici.) */
function talentAttrSum(hero: Combatant, attr: 'fortune' | 'resolve'): number {
  let n = 0;
  for (const t of hero.talents ?? []) {
    for (const op of findTalentById(t.talentId)?.passive ?? []) {
      if (op.op === 'attrMod' && op.attr === attr && typeof op.mod === 'number') n += op.mod * (t.times ?? 1);
    }
  }
  return n;
}

/**
 * Caractéristique « +5 de départ » conférée par un talent (clé courte), sinon null, par `id`.
 * Lit le premier `charMod{char, mod}` dont `char` est une CharKey dans `passive` du talent.
 */
export function talentCharBonusById(talentId: string): CharKey | null {
  for (const op of findTalentById(talentId)?.passive ?? []) {
    if (op.op === 'charMod' && (CHAR_KEYS as readonly string[]).includes(op.char)) return op.char as CharKey;
  }
  return null;
}

/** Idem par LIBELLÉ — bord UI (créateur) / tests ; résout l'id puis délègue. */
export function talentCharBonus(talentLabel: string): CharKey | null {
  const id = findTalent(splitLabel(talentLabel).name)?.id;
  return id ? talentCharBonusById(id) : null;
}

/**
 * Applique l'effet d'acquisition d'un Talent (création OU achat PX) — mute le héros. Référence
 * STRUCTURÉE : `talentId` STABLE + `spec` concret (cult de « Béni » : « Sigmar »…).
 * Le +5 Caractéristique et le +1 Mouvement sont désormais des PASSIFS CONTINUS dans `passive: GameOp[]`
 * (charMod/moveMod), lus par le collecteur `passiveMods` — plus cuits dans `characteristics`/`movement`.
 * Les effets dérivés (Blessures, Chance, Détermination) sont des helpers recalculés par
 * l'appelant (heroMaxWounds / fortuneMax / resolveMax).
 */
export function applyTalentAcquisition(hero: Combatant, talentId: string, spec?: string): void {
  // Béni (Culte) — LDB 10/41 : « reçoit les SIX Bénédictions de son culte » → octroi AUTOMATIQUE
  // à l'acquisition (création + achat PX), pas un achat à 0 PX par clic. Un « Béni » au culte non
  // résolu (« Au choix ») n'octroie rien. Le signal vient du REGISTRE (grantsCultBlessings), plus de name-match.
  if (findTalentById(talentId)?.combat?.grantsCultBlessings && spec && !/au choix/i.test(spec)) {
    const six = blessingsOf(spec).filter((b) => !(hero.spells ?? []).includes(b));
    if (six.length) hero.spells = [...(hero.spells ?? []), ...six];
  }
}

/** Points de Blessure supplémentaires : BE par acquisition d'un talent « Blessure » (Dur à cuire).
 *  Le BE utilisé est `baseWithTalents(hero,'E')` pour inclure un éventuel +5 E de « Très résistant ». */
export function extraWounds(hero: Combatant): number {
  let n = 0;
  for (const t of hero.talents ?? []) {
    for (const op of findTalentById(t.talentId)?.passive ?? []) {
      if (op.op === 'attrMod' && op.attr === 'wounds') {
        // Dur à cuire = +Bonus d'Endurance par acquisition : mod-formule `{bonusOf:'E'}` résolu sur
        // baseWithTalents (inclut le +5 E de Très résistant si possédé), pas sur la valeur brute.
        const per = typeof op.mod === 'number' ? op.mod : 'bonusOf' in op.mod ? bonus(baseWithTalents(hero, op.mod.bonusOf)) : 0;
        n += per * (t.times ?? 1);
      }
    }
  }
  return n;
}

/** Blessures max d'un héros = formule des Attributs (BF+2×BE+BFM × Taille) + talents « Blessure ».
 *  Les +5 de talents (Très fort → F, Très résistant → E, Imperturbable → FM) sont des PASSIFS :
 *  on passe `baseWithTalents` pour chaque carac impliquée afin de ne pas les perdre. */
export function heroMaxWounds(hero: Combatant): number {
  const chars = {
    ...hero.characteristics,
    F: baseWithTalents(hero, 'F'),
    E: baseWithTalents(hero, 'E'),
    FM: baseWithTalents(hero, 'FM'),
  };
  return maxWounds(chars, hero.size ?? 'moyenne') + extraWounds(hero);
}

/** Σ des `attrMods{attr}` d'effets ACTIFS (op `attrMod` exécutée — buff temporaire, ext. consommables) —
 *  s'ajoute aux passifs de talent dans les maxima dérivés, expire avec l'effet porteur. */
function activeAttrSum(hero: Combatant, attr: 'fortune' | 'resolve'): number {
  return (hero.activeEffects ?? []).reduce((s, e) => s + (e.attrMods?.[attr] ?? 0), 0);
}

/** Maximum de Points de Chance : Destin + niveaux des talents « Chance » (Chanceux, LDB 10) + effets actifs. */
export function fortuneMax(hero: Combatant): number {
  return (hero.fate ?? 0) + talentAttrSum(hero, 'fortune') + activeAttrSum(hero, 'fortune');
}

/** Maximum de Détermination : Résilience + niveaux des talents « Détermination » (Obstiné) + effets actifs. */
export function resolveMax(hero: Combatant): number {
  return (hero.resilience ?? 0) + talentAttrSum(hero, 'resolve') + activeAttrSum(hero, 'resolve');
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
    for (const op of findTalentById(t.talentId)?.passive ?? []) {
      if (op.op !== 'grantCareerSkill') continue;
      const base = refLabel('skills', { id: op.skillId }); // id → libellé de base (sans spec)
      // Spec « Au choix » de l'op reportée sur la spec concrète choisie du talent (Maître artisan (Forgeron)).
      if (t.spec && op.spec && /au choix/i.test(op.spec)) out.push(concreteLabel(base, t.spec));
      else out.push(refLabel('skills', { id: op.skillId, spec: op.spec }));
    }
  }
  return out;
}

/**
 * Talents ajoutés aux listes de carrière par les talents possédés (« Le Talent X est ajouté à la
 * liste des Talents de n'importe laquelle de vos Carrières », LDB 10 — Flagellant → Frénésie).
 * Analogue Talent de `careerSkillAdditions` : lit l'op `grantCareerTalent` (data-driven, par id).
 */
export function careerTalentAdditions(hero: Combatant): string[] {
  const out: string[] = [];
  for (const t of hero.talents) {
    for (const op of findTalentById(t.talentId)?.passive ?? []) {
      if (op.op !== 'grantCareerTalent') continue;
      out.push(refLabel('talents', { id: op.talentId, spec: op.spec }));
    }
  }
  return out;
}

/** Modificateurs PASSIFS continus des talents POSSÉDÉS (`TalentData.passive` : Coup puissant, Dur à cuire…,
 *  ou Frénésie → `grantFreeAttack`) en `GameOp[]`, émis kind `intrinsèque` et RÉPÉTÉS par niveau (`t.times`).
 *  Lus par le collecteur `passiveMods` (trauma) EXACTEMENT comme `traitPassiveMods` pour les traits — le
 *  talent (instance = id seul) est résolu par `findTalentById`. Disjoint des traits → zéro double-comptage. */
export function talentPassiveMods(c: Combatant): PassiveMod[] {
  const out: PassiveMod[] = [];
  for (const t of c.talents ?? []) {
    const ops = findTalentById(t.talentId)?.passive;
    if (ops) for (let i = 0; i < (t.times ?? 1); i++) for (const op of ops) out.push({ op, kind: 'intrinsèque' });
  }
  return out;
}
