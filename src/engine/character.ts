/**
 * Création de personnage (héros) — Livre de base, chapitres 04/05 « Personnage ».
 *
 * Étapes implémentées :
 *  3) Attributs : Caractéristique = base d'espèce + 2d10 (ou saisie manuelle / répartition de
 *     100 Points — cf. engine/creation.ts) ; 5 Augmentations gratuites réparties sur les
 *     3 Caractéristiques de carrière (l.488) ; Destin/Résilience + points supplémentaires.
 *  4) Compétences/Talents : 3 Compétences d'espèce à +5 et 3 à +3 (l.510) ; Talents d'espèce
 *     (choix « A ou B », fixes, « N Talent aléatoire » sur la table d100) ; 8 Compétences de
 *     carrière, 40 augmentations (max 10), 1 Talent de carrière — qui peut être un talent
 *     d'espèce déjà possédé → times 2 (l.502), dans la limite du Maxi (LDB 10).
 *  5) Possessions : équipement de classe + de carrière (la Richesse initiale est créditée au
 *     groupe par l'appelant — cf. engine/creation.rollInitialWealth).
 *  6) Détails : âge/taille/yeux/cheveux/ambitions (cosmétique).
 *  Blessures (+ Dur à cuire), Mouvement (+ Véloce), Chance/Détermination (Chanceux/Obstiné) et
 *  « +5 Caractéristique de départ » appliqués via engine/talentEffects.
 *
 * Choix et Spécialisations en ids (`ChoixDeCreation`) ; les emplacements de carrière utilisés sont
 * DÉSIGNÉS dans `careerSlotChoices` (cf. engine/careerSlots.ts).
 */
import { RNG, defaultRNG, roll } from './dice';
import { buildInventory, recomputeLoadout, emptyArmour } from './items';
import { groupsFor } from './groups';
import { CharKey, CHAR_KEYS, Characteristics, Combatant, SkillInstance, TalentInstance, HeroDetails } from './types';
import {
  SpeciesData,
  CareerLevelData,
  findSpeciesById,
  findCareerById,
  findClassById,
  firstLevel,
  levelsForCareer,
  byId,
  findTalentById,
  specPoolOf,
  talents as talentTable,
  type TrappingRef,
} from '../data';
import type { RefDesignee, RefASpecialisation } from '../data/schemas/grammaire/ref';
import { refKey, skillSlots, talentSlots, designateSlot, freeSlotFor, statutOuRefus, designationsFor, talentMaxReached, wildcardSpecs } from './careerSlots';
import { resolveTrappingChoices } from './trappingChoices';
import { applyTalentAcquisition, heroMaxWounds, fortuneMax, resolveMax, careerSkillAdditions } from './talentEffects';
import { applyStarOps, pettySpellQuotaFor } from './creation';
import { sizeFromTalents } from './size';

/** Caractéristique d'une Compétence (skills.json) par `id` STABLE — LDB 09 : valeur de Test =
 *  Caractéristique + avances. (≠ re-lookup par libellé — multilangue-safe.) */
export function skillCharacteristicById(id: string): CharKey {
  const data = byId('skill', id);
  return data?.characteristic ?? 'dexterite'; // CharKey stable portée par la donnée (repli prudent)
}

/** Adresse d'un EMPLACEMENT de création — la clé des choix portés par un emplacement (`specChoices`,
 *  `speciesTalentChoices`). Deux emplacements qui désignent la même Compétence restent deux adresses. */
export const adresseDeCreation = {
  especeTalent: (i: number): string => `espece:talents:${i}`,
  carriereCompetence: (i: number): string => `carriere:competences:${i}`,
  ajout: (skillId: string): string => `ajout:${skillId}`,
  signe: (k: number): string => `signe:${k}`,
};

/** Format PERSISTÉ des choix de création (brouillon du roster) : 2 = en ids (#1923). */
export const FORMAT_DES_CHOIX = 2;

/**
 * Les CHOIX de création d'un héros, en ids — la forme commune du brouillon du créateur (`CreatorDraft`),
 * des pré-tirés (`PregenDef`) et des options de `createHero`.
 */
export interface ChoixDeCreation {
  /** Talent de carrière ; peut être un talent d'espèce déjà possédé (LDB 05 l.502). Défaut : 1re entrée
   *  du Niveau 1 dont le Maxi n'est pas atteint. */
  careerTalent?: RefDesignee;
  /** Spécialisation choisie (id) par ADRESSE d'emplacement (`adresseDeCreation`). */
  specChoices?: Record<string, string>;
  /** Option retenue (index dans `of`) par adresse d'une entrée « A ou B » des Talents d'espèce. */
  speciesTalentChoices?: Record<string, number>;
  /** Spécialisation (id) d'un Talent aléatoire tiré, par id de Talent. */
  randomSpecPicks?: Record<string, string>;
  /** Répartition des 40 Augmentations de carrière (LDB 05 l.535), par Compétence : `refKey(id, spec)`
   *  (`cleDeCompetence`). Défaut : +5 sur les 8 entrées du Niveau. */
  skillAdvances?: Record<string, number>;
  /** Compétences d'espèce recevant +5/+3 (LDB 05 l.484). Défaut : 3 premières / 3 suivantes. */
  speciesSkillAdvances?: { plus5: RefDesignee[]; plus3: RefDesignee[] };
  /** Talents d'espèce DÉJÀ résolus (tirages figés inclus) — court-circuite `resolveSpeciesTalents`. */
  speciesTalentsResolved?: RefDesignee[];
  /** Emplacements `{choice}`/`{wildcard}` des dotations, cf. `resolveTrappingChoices`. */
  trappingChoices?: Record<string, string>;
  /** Sorts de Magie mineure choisis (ids de `spells.json`), dans la limite du quota (LDB 10 l.714). */
  pettySpells?: string[];
}

/** Clé d'allocation d'une Compétence de carrière : l'identité de la Compétence désignée, `refKey(id,
 *  spec)` ; un joker non désigné se keye par son id seul. */
export function cleDeCompetence(r: RefDesignee): string {
  return refKey(r.id, r.spec);
}

/** Pool de spécialisations (ids) d'un emplacement joker. */
export function poolDuJoker(kind: 'skill' | 'talent', ref: RefASpecialisation): string[] {
  return wildcardSpecs({ optionId: ref.id, ...(Array.isArray(ref.choix) ? { specOptions: ref.choix } : {}) }, kind);
}

/** Désignation d'un emplacement : sa spécialisation fixe, la spécialisation `choisie`, sinon (joker) la
 *  1re du pool qui satisfait `libre`, sinon la 1re du pool. */
export function designer(kind: 'skill' | 'talent', ref: RefASpecialisation, choisie?: string, libre: (spec: string) => boolean = () => true): RefDesignee {
  if (ref.choix == null) return ref.spec ? { id: ref.id, spec: ref.spec } : { id: ref.id };
  if (choisie) return { id: ref.id, spec: choisie };
  const pool = poolDuJoker(kind, ref);
  const spec = pool.find(libre) ?? pool[0];
  return spec ? { id: ref.id, spec } : { id: ref.id };
}

/** Un emplacement de Compétence de carrière de départ : le Niveau 1 ou un ajout de Talent (LDB 10). */
export interface CompetenceDeCarriere {
  adresse: string;
  ref: RefASpecialisation;
  /** La Compétence désignée — `null` pour un joker sans spécialisation choisie. */
  designee: RefDesignee | null;
  /** `cleDeCompetence` de la désignée (id seul pour un joker non désigné). */
  cle: string;
  /** Ajout d'un Talent (`grantCareerSkill`) — reçoit 0 Augmentation par défaut. */
  ajout: boolean;
}

/** Les Compétences de carrière de départ (LDB 05 l.535) : les 8 du Niveau 1 puis les ajouts des Talents
 *  (LDB 10), UNE par Compétence (`cle`). */
export function competencesDeCarriere(level: CareerLevelData | undefined, hero: Combatant, specChoices: Record<string, string> = {}): CompetenceDeCarriere[] {
  const out: CompetenceDeCarriere[] = [];
  const pousser = (adresse: string, ref: RefASpecialisation, ajout: boolean) => {
    const choisie = specChoices[adresse];
    const designee = ref.choix == null || choisie ? designer('skill', ref, choisie) : null;
    const cle = designee ? cleDeCompetence(designee) : ref.id;
    if (!out.some((c) => c.cle === cle)) out.push({ adresse, ref, designee, cle, ajout });
  };
  (level?.skills ?? []).forEach((ref, i) => {
    if ('id' in ref) pousser(adresseDeCreation.carriereCompetence(i), ref, false);
  });
  for (const add of careerSkillAdditions(hero)) pousser(adresseDeCreation.ajout(add.id), add, true);
  return out;
}

/** Compétences d'espèce retenues à +5/+3 par défaut (LDB 05 l.484) : les 3 premières / 3 suivantes. */
export function speciesSkillDefaults(sp: SpeciesData): { plus5: RefDesignee[]; plus3: RefDesignee[] } {
  const designees = sp.skills.flatMap((a) => ('id' in a ? [designer('skill', a)] : []));
  return { plus5: designees.slice(0, 3), plus3: designees.slice(3, 6) };
}

/** Tableau des Talents aléatoires (Livre de base) : talents avec borne d100, triés. */
function randomTalentTable() {
  return talentTable.filter((t) => t.rand != null).sort((a, b) => (a.rand as number) - (b.rand as number));
}

/**
 * Tire un Talent sur le Tableau des Talents aléatoires (1d100). Le tirage est FIGÉ : si le
 * talent tiré est groupé (« un au choix » — Sens aiguisé, Résistance, Maître artisan, Artiste),
 * on CHOISIT une Spécialisation non possédée (via `pickSpec`, défaut : la première libre) au
 * lieu de relancer ; on ne relance que si le talent est déjà possédé sur toutes ses specs
 * (Livre de base l.510 : « vous pouvez relancer »).
 */
export function rollRandomTalent(
  rng: RNG,
  /** Talents déjà possédés, keyés par `refKey(talentId, specId)`. */
  owned: Set<string>,
  pickSpec?: (talentId: string, options: string[]) => string | null,
): RefDesignee | null {
  const table = randomTalentTable();
  if (!table.length) return null;
  for (let attempt = 0; attempt < 100; attempt++) {
    const r = roll(1, 100, rng);
    const entry = table.find((t) => r <= (t.rand as number));
    if (!entry) continue;
    const specs = specPoolOf(entry); // tirage JOUEUR : ce que le Talent PROPOSE
    if (specs.length) {
      const free = specs.filter((s) => !owned.has(refKey(entry.id, s)));
      if (!free.length) continue; // toutes les specs possédées → relance
      return { id: entry.id, spec: pickSpec?.(entry.id, free) ?? free[0] };
    }
    if (!owned.has(refKey(entry.id))) return { id: entry.id };
  }
  return null;
}

/**
 * Résout les Talents d'espèce (LDB 05 l.510) : une entrée « A ou B » (`pick`) → l'option retenue
 * (`choices`, par adresse ; défaut : la 1re) ; un Talent fixe tel quel ; `{random: n}` → n tirages
 * FIGÉS sur le Tableau des Talents aléatoires, y compris comme option d'un choix. Un joker prend la
 * spécialisation choisie (`specChoices`, par adresse), sinon la 1re non possédée.
 */
export function resolveSpeciesTalents(sp: SpeciesData, opts: OptionsDeResolution = {}): RefDesignee[] {
  return resolveSpeciesTalentsDetail(sp, opts).map((t) => t.ref);
}

interface OptionsDeResolution {
  rng?: RNG;
  choices?: Record<string, number>;
  specChoices?: Record<string, string>;
  pickSpec?: (talentId: string, options: string[]) => string | null;
}

/** `resolveSpeciesTalents`, chaque Talent marqué `tire` s'il sort du Tableau des Talents aléatoires. */
export function resolveSpeciesTalentsDetail(sp: SpeciesData, opts: OptionsDeResolution = {}): { ref: RefDesignee; tire: boolean }[] {
  const rng = opts.rng ?? defaultRNG;
  const owned = new Set<string>();
  const result: { ref: RefDesignee; tire: boolean }[] = [];
  const add = (ref: RefDesignee, tire: boolean) => {
    result.push({ ref, tire });
    owned.add(refKey(ref.id, ref.spec));
  };
  const rollN = (n: number) => {
    for (let i = 0; i < n; i++) {
      const t = rollRandomTalent(rng, owned, opts.pickSpec);
      if (t) add(t, true);
    }
  };
  sp.talents.forEach((ref, i) => {
    const adresse = adresseDeCreation.especeTalent(i);
    const option = 'pick' in ref ? ref.of[opts.choices?.[adresse] ?? 0] ?? ref.of[0] : ref;
    if ('random' in option) rollN(option.random);
    else if ('id' in option) add(designer('talent', option, opts.specChoices?.[adresse], (s) => !owned.has(refKey(option.id, s))), false);
  });
  return result;
}

export interface CreateHeroOptions extends ChoixDeCreation {
  /** `id` STABLE de l'espèce (`SpeciesData.id`) — ≠ libellé. */
  speciesId: string;
  /** `id` STABLE de la carrière (`CareerData.id`) — ≠ libellé. */
  careerId: string;
  label: string;
  /** Caractéristiques saisies manuellement (sinon tirage base + 2d10). */
  manualChars?: Partial<Characteristics>;
  /** Signe astral choisi (ADE II) — `id` STABLE (≠ libellé) ; son `effect` (charMod / grantTalent) est
   *  appliqué aux attributs de départ via applyStarOps. Absent = pas de signe. */
  starId?: string;
  /** Les 5 Augmentations gratuites réparties sur les 3 Caractéristiques de carrière (LDB 05
   * l.488). Défaut : 2/2/1 sur les 3 Caractéristiques du Niveau 1. */
  charAdvancesAlloc?: Partial<Record<CharKey, number>>;
  /** Répartition des points supplémentaires Destin/Résilience. */
  fateSplit?: { fate: number; resilience: number };
  /** PX bonus gagnés pendant la création (choix aléatoires acceptés, LDB 04/05). */
  xpBonus?: number;
  details?: HeroDetails;
  motivation?: string;
  rng?: RNG;
  id?: string;
}

let heroCounter = 0;

export function rollCharacteristics(sp: SpeciesData, rng: RNG = defaultRNG): Characteristics {
  const chars = {} as Characteristics;
  for (const k of CHAR_KEYS) {
    const base = sp.baseChar[k] ?? 20;
    chars[k] = base + roll(2, 10, rng);
  }
  return chars;
}

/** Une Compétence d'espèce désignée sans spécialisation alors que son emplacement est un joker reçoit la
 *  1re du pool de cet emplacement. */
function completerCompetenceDEspece(sp: SpeciesData, r: RefDesignee): RefDesignee {
  if (r.spec != null) return r;
  const slot = sp.skills.find((a): a is Extract<typeof a, { id: string }> => 'id' in a && a.id === r.id && a.choix != null);
  return slot ? designer('skill', slot) : r;
}

export function createHero(opts: CreateHeroOptions): Combatant {
  const rng = opts.rng ?? defaultRNG;
  const sp = findSpeciesById(opts.speciesId);
  if (!sp) throw new Error(`Espèce inconnue : ${opts.speciesId}`);
  const levels = levelsForCareer(opts.careerId);
  const level = levels.find((l) => l.level === 1) ?? firstLevel(opts.careerId);
  const specChoices = opts.specChoices ?? {};

  // 3) Attributs : base d'espèce + 2d10, ou saisie manuelle (réassignation / 100 Points).
  const chars = rollCharacteristics(sp, rng);
  if (opts.manualChars) for (const k of CHAR_KEYS) if (opts.manualChars[k] != null) chars[k] = opts.manualChars[k]!;

  // 3b) 5 Augmentations gratuites sur les 3 Caractéristiques de carrière (LDB 05 l.459).
  const careerCharKeys: CharKey[] = level?.characteristics ?? []; // déjà des CharKey (donnée)
  const alloc: Partial<Record<CharKey, number>> = opts.charAdvancesAlloc ?? autoCharAlloc(careerCharKeys);
  const charAdvances: Partial<Record<CharKey, number>> = {};
  for (const [k, n] of Object.entries(alloc) as [CharKey, number][]) {
    if (!n) continue;
    charAdvances[k] = n;
    chars[k] += n; // l'Augmentation s'ajoute à la valeur initiale (LDB 05 l.463)
  }

  // 4a) Talents : Talents d'espèce + 1 Talent de carrière (LDB 05 l.502, Maxi respecté).
  const speciesTalents = opts.speciesTalentsResolved
    ?? resolveSpeciesTalents(sp, { rng, choices: opts.speciesTalentChoices, specChoices, pickSpec: (id, free) => (opts.randomSpecPicks?.[id] && free.includes(opts.randomSpecPicks[id]) ? opts.randomSpecPicks[id] : null) });
  const talents: TalentInstance[] = [];
  const addTalentRef = ({ id, spec }: RefDesignee) => {
    const existing = talents.find((t) => t.talentId === id && (t.spec ?? '') === (spec ?? ''));
    if (existing) existing.times += 1;
    else talents.push({ talentId: id, spec, times: 1 });
  };
  for (const t of speciesTalents) addTalentRef(t);

  let chosenTalent = opts.careerTalent;
  if (!chosenTalent) {
    // Défaut : 1re entrée du Niveau dont le Maxi n'est pas atteint (les Maxi 1 déjà possédés
    // via l'espèce sont sautés — cas Nain Lire/Écrire + Agitateur).
    for (const ref of level?.talents ?? []) {
      if (!('id' in ref)) continue;
      const candidate = designer('talent', ref);
      const probe: Combatant = { characteristics: chars, talents } as Combatant;
      if (!talentMaxReached(probe, candidate.id, candidate.spec)) {
        chosenTalent = candidate;
        break;
      }
    }
  }
  if (chosenTalent) addTalentRef(chosenTalent);

  // Signe astral (ADE II 3) : effet appliqué AUX ATTRIBUTS DE DÉPART (±carac) + Talents octroyés,
  // AVANT heroSoFar (careerSkillAdditions voit un « Maître artisan » du signe) et avant les effets
  // d'acquisition des Talents.
  if (opts.starId) applyStarOps(opts.starId, chars, (ref, k) => addTalentRef(designer('talent', ref, specChoices[adresseDeCreation.signe(k)])));

  // 4b) Compétences de carrière : 40 Augmentations (+5 par défaut sur les 8 entrées du Niveau), UNE
  // part par Compétence (LDB 05 l.535), ajouts des Talents compris (LDB 10).
  const heroSoFar: Combatant = { characteristics: chars, talents } as Combatant;
  const skills: SkillInstance[] = [];
  const addSkill = ({ id, spec }: RefDesignee, adv: number) => {
    const existing = skills.find((s) => s.id === id && (s.spec ?? '') === (spec ?? ''));
    if (existing) existing.advances += adv; // même (id, spec) = même Compétence (LDB 09 l.42)
    else skills.push({ id, spec, characteristic: skillCharacteristicById(id), advances: adv });
  };
  const carriere = competencesDeCarriere(level, heroSoFar, specChoices);
  const allouees: { adresse: string; designee: RefDesignee }[] = [];
  for (const c of carriere) {
    const adv = opts.skillAdvances?.[c.cle] ?? (c.ajout ? 0 : 5);
    const designee = c.designee ?? designer('skill', c.ref);
    addSkill(designee, adv);
    if (adv > 0) allouees.push({ adresse: c.adresse, designee });
  }

  // 4c) Compétences d'espèce (LDB 05 l.484) : 3 à +5, 3 à +3 ; cumul si même (id, spec) qu'une
  // Compétence de carrière, Compétence séparée sinon.
  const espece = opts.speciesSkillAdvances ?? speciesSkillDefaults(sp);
  for (const r of espece.plus5) addSkill(completerCompetenceDEspece(sp, r), 5);
  for (const r of espece.plus3) addSkill(completerCompetenceDEspece(sp, r), 3);

  // 5) Possessions : classe + carrière → inventaire à stats, armes/armures équipées. Les refs `{id}`
  //    (catalogue) deviennent des objets ; les refs `{text}` (« Arme (Base) », flavor) n'ont pas de
  //    stats → ignorées par buildInventory (un libellé non catalogué n'est pas trouvé). Résolution des
  //    emplacements `{choice}`/`{wildcard}` (construct de choix d'équipement, Lot 1/2/3) via
  //    `opts.trappingChoices` AVANT `buildInventory`.
  const rawTrappings = resolveTrappingChoices(dotationRefsForHero(opts.careerId, 1), opts.trappingChoices ?? {});
  const items = buildInventory(rawTrappings);

  // Trait RACIAL de l'espèce (#572) — Ogre `{id:'ogre'}` (encombrance/consommation ×2, ADE2 « Ogres
  // et Mutations » l.708 « Un Lourd Fardeau ») : posé sur `Combatant.traits` (MÊME forme/lecture que
  // le spawn de créature bestiaire, #513).
  const speciesTraits: import('./statEntry').TraitList = sp.traits ?? [];

  // Taille (LDB 85 l.344-354) — portée par `TalentData.size` (DATA-DRIVEN, jamais un id de talent
  // nommé dans le moteur, #572) : la plus grande catégorie parmi les talents résolus (espèce +
  // carrière + signe astral) ci-dessus, sinon Moyenne.
  const size = sizeFromTalents(talents.map((tt) => tt.talentId), (id) => findTalentById(id)?.size);

  // Destin / Résilience
  const fateBase = sp.fate;
  const split = opts.fateSplit ?? autoFateSplit(fateBase.extra);
  const fate = fateBase.fate + split.fate;
  const resilience = fateBase.resilience + split.resilience;

  heroCounter += 1;
  const hero: Combatant = {
    id: opts.id ?? `hero-${heroCounter}`,
    label: opts.label,
    kind: 'hero',
    species: opts.speciesId,
    career: opts.careerId,
    groups: groupsFor({ speciesId: sp.id, careerId: opts.careerId, traits: speciesTraits, talents }), // Groupes déclarés par l'espèce, la carrière/classe et le culte du Talent de Prière (LDB 21, P3)
    size,
    characteristics: chars,
    wounds: { current: 0, max: 0, base: 0 }, // posé après les effets de talents (Dur à cuire)
    advantage: 0,
    conditions: [],
    weapons: [],
    armour: emptyArmour(),
    items,
    skills,
    talents,
    traits: speciesTraits.length ? speciesTraits : undefined, // Trait racial d'espèce (#572) — Ogre : encombrance/consommation ×2 + Taille
    movement: sp.movement,
    fate,
    fortune: fate,
    resilience,
    resolve: resilience,
    motivation: opts.motivation,
    details: opts.details,
    // Avancement : les 5 Augmentations gratuites de la création (l.488) sont comptées dans
    // charAdvances ; les PX bonus des choix aléatoires (LDB 04/05) restent à dépenser.
    xp: opts.xpBonus ?? 0,
    charAdvances,
    careerLevel: 1,
  };

  // Effets d'acquisition des Talents (+5 Caractéristique de départ, Véloce) — une fois par
  // acquisition —, puis attributs dérivés (Blessures + Dur à cuire, Chance, Détermination).
  for (const t of hero.talents) for (let i = 0; i < t.times; i++) applyTalentAcquisition(hero, t.talentId, t.spec);
  const wmax = heroMaxWounds(hero);
  hero.wounds = { current: wmax, max: wmax, base: wmax };
  hero.fortune = fortuneMax(hero);
  hero.resolve = resolveMax(hero);

  // Désignations des emplacements de carrière utilisés à la création (cf. careerSlots) :
  // compétences « (Au choix) » ayant reçu des augmentations + talent de carrière à choix.
  const sSlots = skillSlots(levels, 1);
  const tSlots = talentSlots(levels, 1);
  const slotsDuNiveau = sSlots.filter((s) => s.level === 1);
  for (const { adresse, designee } of allouees) {
    const i = (level?.skills ?? []).findIndex((_, j) => adresseDeCreation.carriereCompetence(j) === adresse);
    const slot = slotsDuNiveau[i];
    if (slot?.needsChoice) designateSlot(hero, opts.careerId, slot, designee.id, designee.spec, sSlots);
  }
  if (chosenTalent) {
    const { id: talentId, spec } = chosenTalent;
    const all = [...sSlots, ...tSlots];
    const designations = designationsFor(hero, opts.careerId);
    const statut = statutOuRefus(tSlots, designations, talentId, spec, all);
    const quoi = `Talent de carrière « ${refKey(talentId, spec)} »`;
    switch (statut) {
      case 'free': designateSlot(hero, opts.careerId, freeSlotFor(tSlots, designations, talentId, spec)!, talentId, spec, all); break;
      case 'explicit': case 'designated': break;
      case 'absent': throw new Error(`${quoi} : absent du Niveau 1 de « ${opts.careerId} » (LDB 05 l.535).`);
      case 'sansSpec': throw new Error(`${quoi} : l'emplacement « (Au choix) » du Niveau 1 de « ${opts.careerId} » exige une spécialisation (LDB 10 l.17).`);
      case 'nonCouvert': throw new Error(`${quoi} : aucun emplacement libre du Niveau 1 de « ${opts.careerId} » ne couvre cette spécialisation.`);
    }
  }

  // Sorts de Magie mineure (LDB 10 l.714), après les Bénédictions déjà octroyées par
  // `applyTalentAcquisition`.
  const quota = pettySpellQuotaFor(hero);
  if (quota && opts.pettySpells?.length) {
    const appris = opts.pettySpells.slice(0, quota).filter((id) => !(hero.spells ?? []).includes(id));
    hero.spells = [...(hero.spells ?? []), ...appris];
  }

  recomputeLoadout(hero); // dérive weapons/armure/encombrement ; auto-génère le loadout par défaut (Mêlée/Distance)
  return hero;
}

/** Répartition automatique des 5 Augmentations gratuites (2/2/1) sur les Caractéristiques de
 *  carrière — utilisée quand l'appelant (pré-tirés) ne fournit pas de répartition. */
function autoCharAlloc(careerChars: CharKey[]): Partial<Record<CharKey, number>> {
  const out: Partial<Record<CharKey, number>> = {};
  const parts = [2, 2, 1];
  careerChars.slice(0, 3).forEach((k, i) => {
    out[k] = parts[i] ?? 0;
  });
  return out;
}

function autoFateSplit(extra: number): { fate: number; resilience: number } {
  const fate = Math.ceil(extra / 2);
  return { fate, resilience: extra - fate };
}

function classForCareer(careerId: string) {
  // careerLevels n'a pas la classe ; on la retrouve via la carrière (par id stable).
  return findClassById(findCareerById(careerId)?.class);
}

/** Dotations de Classe + Niveau de carrière (`TrappingRef[]`) — PUR, réutilisé par `createHero`
 *  (5, sac de départ) ET par le seam de semis de Possessions au démarrage d'une partie neuve
 *  (#617/#618 Lot 1, `state/possessionsFlow.ts`). `careerLevel` défaut 1 (création). */
export function dotationRefsForHero(careerId: string, careerLevel: number = 1): TrappingRef[] {
  const levels = levelsForCareer(careerId);
  const level = levels.find((l) => l.level === careerLevel) ?? firstLevel(careerId);
  return [...(classForCareer(careerId)?.trappings ?? []), ...(level?.trappings ?? [])];
}

