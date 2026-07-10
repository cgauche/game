/**
 * ÉDITEUR D'OPS MÉCANIQUES — `GameOp[]` (engine/ops), le vocabulaire PARTAGÉ par les sorts (effets
 * dans le Compendium), les pièges (EffectOp de scène) et les contrecoups. COMPLET : il LIT, MODIFIE et
 * AJOUTE n'importe quelle op du vocabulaire — éditeurs DÉDIÉS pour les ops courantes, repli JSON
 * (`JsonField`) pour tout le reste (round-trip SANS PERTE, champs inconnus préservés).
 *
 * Les quantités à `Formula` (littéral / Bonus de Carac / Valeur de Carac / Dés) passent par
 * `FormulaField` — JAMAIS de coercition en nombre (la régression historique : un `wounds {dice}` lu
 * « 0 » puis écrasé). Un nouveau type d'op = 1 entrée dans `OP_GROUPS` + 1 défaut dans `newOp`.
 */
import { Formula, GameOp } from '../../engine/ops';
import { CHAOS_ALIGN_LABELS, ChaosAlign, EXPOSURE_LABELS, ExposureLevel } from '../../engine/corruption';
import { CHAR_LABELS, CharKey } from '../../engine/types';
import { SizeCategory, SIZE_LABEL } from '../../engine/size';
import { etats, talentConcrete, findTalent, qualityRefLabel, refLabel, findCrewTestTypeById, CHAR_ABR } from '../../data';
import { RefField } from '../compendium/RefField';
import { slugId } from '../../data/slug';
import { splitLabel } from '../../engine/statEntry';
import { giveTrappingLabel } from '../../engine/items';
import { parseTraitInstance, formatTrait } from '../../engine/traits/dispatch';
import { closeDetails } from './EffectList';
import { JsonField } from './JsonField';
import { Icon } from '../Icon';
import type { IconIdInput } from '../icons';

const SIZES = Object.keys(SIZE_LABEL) as SizeCategory[];

const CHARS = Object.keys(CHAR_LABELS) as CharKey[];
/** Liste de Groupes saisie en CSV (« Criminel, Mort-vivant ») ↔ tableau (undefined si vide). */
const csv = (s: string): string[] => s.split(',').map((x) => x.trim()).filter(Boolean);

// ---------------------------------------------------------------------------
// Vocabulaire COMPLET — libellé + menu groupé par intention
// ---------------------------------------------------------------------------

/** Libellé court (texte SEUL, sert aussi de `<option>` natif) de CHAQUE op du vocabulaire `GameOp`. */
const OP_LABEL: Record<GameOp['op'], string> = {
  wounds: 'Blessures (ignore BE/PA)',
  heal: 'Soin (Blessures rendues)',
  healCaster: 'Soin au lanceur',
  condition: 'Poser un État',
  removeCondition: 'Retirer un État',
  charMod: 'Modif. de caractéristique',
  ap: '+PA (Localisation ou toutes)',
  testMod: 'Modif. à tous les Tests',
  skillDRBonus: '+DR à une Compétence',
  charDRBonus: '+DR aux Tests d’une Caractéristique',
  offTerrainMod: 'Hors de son terrain (M imposé, ±DR)',
  crewTestMod: 'Modif. aux Tests individuels d’un Test d’équipage',
  incomingAttackMod: 'Modif. au toucher de l’attaquant',
  incomingAdvantage: 'Avantage donné à l’attaquant (mêlée)',
  sbBonus: '+Bonus de Force aux Dégâts',
  endPsych: 'Fin d’un état psychologique',
  exposeDisease: 'Exposer à une Maladie (Test post-combat)',
  contractDisease: 'Contracter une Maladie (immédiat)',
  removeShipPoste: 'Retirer un poste de navire (Canon perdu)',
  teamCommander: 'Diriger l’équipe (score de Projectiles du commandant)', // posé par l'action « Diriger l'équipe » ; hors palette d'auteur (commanderId interne)
  attackKeyword: 'Mot-clé d’attaque (ex. magique)',
  mitigateIncoming: 'Mitige les Dégâts entrants (Éthéré)',
  ignoreStatePenalties: 'Ignore les pénalités d’État',
  freeReroll: 'Relance gratuite (prochain échec)',
  critTwice: 'Deux lancers de Critique (meilleur)',
  gainResource: 'Points de Chance / Destin',
  gainAdvantage: 'Porter l’Avantage à (min)',
  attrMod: 'Modif. d’attribut secondaire',
  corruption: 'Points de Corruption',
  sinMod: 'Points de Péché (±)',
  corruptionExposure: 'Exposition corruptrice (Test différé)',
  castPenalty: 'Contrecoup d’incantation',
  castWard: 'Aura anti-Sort (−20 Langue)',
  arrowWard: 'Bouclier anti-projectiles',
  domeWard: 'Dôme protecteur',
  attackWardFM: 'Attaquer exige un Test de FM',
  grantWeapon: 'Invoquer une arme magique',
  grantNaturalWeapon: 'Accorder une arme naturelle',
  grantFreeAttack: 'Accorder une attaque gratuite',
  interruptFocus: 'Interrompre la Focalisation', // marqueur combat-interne (branche d’échec du Test de Calme) — non author-pickable
  breakBlade: 'Désarmer / briser la lame', // marqueur combat-interne (victoire du Test de Piège-lame) — non author-pickable
  push: 'Poussée (repousser de N m)',
  teleport: 'Téléportation du lanceur',
  chain: 'Attaques en chaîne (rebond)',

  grantTrait: 'Accorder un Trait',
  grantPsychTrait: 'Accorder un Trait psychologique',
  removePsychTrait: 'Retirer un Trait psychologique',
  grantTalent: 'Accorder un Talent',
  grantCareerSkill: 'Compétence ajoutée aux carrières',
  grantCareerTalent: 'Talent ajouté aux carrières',
  augmentWeapon: 'Enchanter l’arme',
  cureDisease: 'Guérir des maladies',
  reduceDiseaseDays: 'Raccourcir une maladie',
  preventInfection: 'Empêcher l’infection',
  cureCriticalWound: 'Guérir une Blessure critique',
  diseaseTestMod: 'Modif. aux Tests d’une maladie',
  suppressSymptom: 'Suspendre un symptôme',
  actGate: 'Test par Round pour agir (drogue)',
  delayed: 'Ops différées (échéance d’horloge)',
  suppressPsych: 'Apaiser les Traits psychologiques',
  suffocate: 'Suffocation',
  noBreath: 'Plus besoin de respirer',
  noHunger: 'Plus besoin de manger',
  ignoreAnimosity: 'Ignore Préjugés/Animosités',
  weatherWard: 'Immunité aux intempéries',
  damageArmour: 'Pourrir le cuir (−1 PA)',
  reduceToZero: 'Réduire les Blessures à 0',
  banish: 'Bannir (retirer du jeu)',
  martyr: 'Martyr (recevoir les Dégâts)',
  giveTrapping: 'Donner un objet',
  perRound: 'Effet récurrent (chaque Round)',
  summon: 'Invoquer une créature',
  scheduleRespawn: 'Reconstitution différée (à la mort)', // marqueur de DONNÉE (op onSlain, non author-pickable)
  zone: 'Zone persistante (mur / disque)',
  polymorph: 'Métamorphose en créature',
  transform: 'Transformation durable (réversible)',
  endTransform: 'Fin de transformation',
  lifeSteal: 'Vol de vie (drain de Blessures)',
  light: 'Émettre de la lumière (rayon)',
  skillMod: 'Modif. d’une Compétence',
  moveScale: 'Échelle de Mouvement (×n/d)',
  moveMod: 'Modif. de Mouvement (±N)',
  maxWeaponHands: 'Plafond de mains d’arme',
  disarm: 'Lâcher l’objet tenu (main)',
  handGate: 'Main ensanglantée (Test par Action)',
  senseLoss: 'Perte sensorielle (œil/oreille)',
  loseTurn: 'Perdre Action + Mouvement',
  weaponRollMod: 'Atout d’arme — modif. de jet (passif)',
  weaponDamageMod: 'Atout d’arme — modif. de Dégâts (passif)',
  armourPierce: 'Atout d’arme — Perforante (passif)',
  critOnRoll: 'Atout d’arme — Critique sur jet (passif)',
  spendAdvantage: 'Dépenser de l’Avantage',
  rollThreshold: 'Jet à paliers (un dé → ops par seuil)',
  intoxicate: 'Boisson alcoolisée (échec de Résistance à l’alcool)',
  narrative: 'Effet narratif (texte libre)',
};

/** Icône de CHAQUE op (rendue à côté du libellé partout SAUF dans le `<select>`/`<optgroup>` natif,
 *  qui ne peut afficher que du texte) — vocabulaire LARGE : plusieurs ops apparentées partagent
 *  la même icône (cf. defs/mechanic.ts, « pas une métaphore par op individuelle »). */
const OP_ICON: Record<GameOp['op'], IconIdInput> = {
  wounds: 'journal/damage', heal: 'journal/heal', healCaster: 'journal/heal',
  condition: 'magic/area', removeCondition: 'magic/gust',
  charMod: 'mechanic/stat-mod', ap: 'mechanic/ward', testMod: 'mechanic/stat-mod',
  skillDRBonus: 'mechanic/stat-mod', charDRBonus: 'mechanic/stat-mod', offTerrainMod: 'mechanic/stat-mod',
  crewTestMod: 'travel/anchor', incomingAttackMod: 'mechanic/ward', incomingAdvantage: 'flag/focus',
  sbBonus: 'char/f', endPsych: 'mechanic/mind', exposeDisease: 'medical/infection', contractDisease: 'medical/infection',
  removeShipPoste: 'travel/anchor', teamCommander: 'action/lead', attackKeyword: 'item/weapon',
  mitigateIncoming: 'mechanic/ward', ignoreStatePenalties: 'ui/done', freeReroll: 'resource/fortune',
  critTwice: 'journal/critical', gainResource: 'resource/fortune', gainAdvantage: 'flag/focus',
  attrMod: 'resource/fortune', corruption: 'nav/mutation', sinMod: 'ui/balance', corruptionExposure: 'nav/mutation',
  castPenalty: 'mechanic/ward', castWard: 'mechanic/ward', arrowWard: 'mechanic/ward', domeWard: 'mechanic/ward',
  attackWardFM: 'mechanic/ward', grantWeapon: 'mechanic/invoke', grantNaturalWeapon: 'mechanic/invoke',
  grantFreeAttack: 'action/free-attack', interruptFocus: 'mechanic/mind', breakBlade: 'item/weapon',
  push: 'mechanic/chain', teleport: 'mechanic/chain', chain: 'mechanic/chain',
  grantTrait: 'mechanic/invoke', grantPsychTrait: 'mechanic/mind', removePsychTrait: 'mechanic/mind',
  grantTalent: 'mechanic/invoke', grantCareerSkill: 'mechanic/invoke', grantCareerTalent: 'mechanic/invoke',
  augmentWeapon: 'item/weapon', cureDisease: 'medical/infection', reduceDiseaseDays: 'medical/infection',
  preventInfection: 'medical/infection', cureCriticalWound: 'medical/crutch', diseaseTestMod: 'medical/infection',
  suppressSymptom: 'medical/infection', actGate: 'ui/wait', delayed: 'ui/wait', suppressPsych: 'mechanic/mind',
  suffocate: 'mechanic/ward', noBreath: 'mechanic/ward', noHunger: 'mechanic/ward', ignoreAnimosity: 'mechanic/ward', weatherWard: 'mechanic/ward',
  damageArmour: 'item/armour', reduceToZero: 'journal/damage', banish: 'magic/area', martyr: 'action/defend',
  giveTrapping: 'item/misc', perRound: 'ui/wait', summon: 'mechanic/invoke', scheduleRespawn: 'ui/wait',
  zone: 'scenario/trap', polymorph: 'mechanic/invoke', transform: 'mechanic/invoke', endTransform: 'ui/wait',
  lifeSteal: 'condition/bleeding', light: 'fire/flame', skillMod: 'mechanic/stat-mod',
  moveScale: 'resource/movement', moveMod: 'resource/movement', maxWeaponHands: 'item/weapon', disarm: 'item/weapon', handGate: 'condition/bleeding',
  senseLoss: 'ui/eye', loseTurn: 'ui/wait', weaponRollMod: 'item/weapon', weaponDamageMod: 'item/weapon',
  armourPierce: 'item/weapon', critOnRoll: 'journal/critical', spendAdvantage: 'flag/focus', rollThreshold: 'nav/dice',
  intoxicate: 'item/consumable', narrative: 'journal/detail',
};

/** Menu « + op » : TOUTES les op du vocabulaire, groupées par intention d'auteur. Libellé de groupe =
 *  texte SEUL (sert aussi d'`<optgroup label>` natif, qui ne peut afficher que du texte). */
const OP_GROUPS: [string, GameOp['op'][]][] = [
  ['Dégâts & soin', ['wounds', 'heal', 'healCaster', 'lifeSteal', 'reduceToZero', 'banish']],
  ['États', ['condition', 'removeCondition']],
  ['Buffs & caractéristiques', ['charMod', 'ap', 'testMod', 'skillDRBonus', 'charDRBonus', 'crewTestMod', 'ignoreStatePenalties', 'freeReroll', 'critTwice']],
  ['Ressources', ['gainResource', 'corruption', 'sinMod', 'corruptionExposure']],
  ['Incantation & contrecoup', ['castPenalty', 'castWard', 'arrowWard', 'domeWard', 'attackWardFM']],
  ['Invocation & armes', ['summon', 'polymorph', 'transform', 'endTransform', 'grantWeapon', 'grantNaturalWeapon', 'grantFreeAttack', 'grantTrait', 'grantPsychTrait', 'removePsychTrait', 'grantTalent', 'augmentWeapon']],
  ['Zones', ['zone']],
  ['Projection & téléportation', ['push', 'teleport', 'chain']],
  ['Soin avancé', ['cureDisease', 'reduceDiseaseDays', 'preventInfection', 'cureCriticalWound', 'diseaseTestMod', 'suppressSymptom']],
  ['Divers', ['suppressPsych', 'suffocate', 'noBreath', 'noHunger', 'weatherWard', 'damageArmour', 'martyr', 'giveTrapping', 'perRound', 'delayed', 'loseTurn', 'actGate', 'removeShipPoste', 'light']],
  ['Séquelles & mobilité', ['skillMod', 'moveScale', 'moveMod', 'offTerrainMod', 'maxWeaponHands', 'disarm', 'handGate', 'senseLoss']],
  ['Atouts/Défauts d’arme (passifs)', ['weaponRollMod', 'weaponDamageMod', 'armourPierce', 'critOnRoll']],
  ['Contrôle', ['rollThreshold', 'spendAdvantage']],
  ['Création de personnage (Talents)', ['attrMod', 'grantCareerSkill', 'grantCareerTalent']],
  ['Narration', ['narrative']],
];

// ---------------------------------------------------------------------------
// Formules
// ---------------------------------------------------------------------------

export type FormulaShape = 'lit' | 'bonus' | 'char' | 'dice' | 'rolled' | 'times';
export const shapeOf = (f: Formula | undefined): FormulaShape =>
  typeof f === 'number' || f == null ? 'lit' : 'bonusOf' in f ? 'bonus' : 'charOf' in f ? 'char' : 'rolled' in f ? 'rolled' : 'times' in f ? 'times' : 'dice';

/** Formule par défaut d'une forme — utilisée au CHANGEMENT de forme. Préserve le littéral courant
 *  quand on bascule vers « Nombre » ; ne touche JAMAIS une formule dont la forme est déjà la bonne. */
export function formulaForShape(s: FormulaShape, current: Formula | undefined): Formula {
  if (s === shapeOf(current)) return current as Formula; // déjà la bonne forme → inchangée (pas de clobber)
  if (s === 'lit') return typeof current === 'number' ? current : 1;
  if (s === 'bonus') return { bonusOf: 'force' };
  if (s === 'char') return { charOf: 'force' };
  if (s === 'rolled') return { rolled: true };
  if (s === 'times') return { times: { of: { dice: { n: 1, sides: 10 } }, factor: 10 } }; // « 1d10 × 10 » (LDB 71)
  return { dice: { n: 1, sides: 10 } };
}

/** CharKey portée par une Formula de carac. (Bonus/Valeur) — défaut F pour le sélecteur. */
const charOfFormula = (f: Formula | undefined): CharKey =>
  f && typeof f === 'object' ? ('bonusOf' in f ? f.bonusOf : 'charOf' in f ? f.charOf : 'force') : 'force';

/** Résumé court d'une Formula (lecture sans perte dans les résumés d'op). */
export function formulaSummary(f: Formula | undefined): string {
  if (f == null) return '0';
  if (typeof f === 'number') return String(f);
  if ('bonusOf' in f) return `B${CHAR_ABR[f.bonusOf]}`;
  if ('charOf' in f) return CHAR_ABR[f.charOf];
  if ('rolled' in f) return 'dé';
  if ('indiceOf' in f) return 'Indice';
  if ('stacks' in f) return 'pions';
  if ('engagedAdvantageGap' in f) return 'écart d’Avantage';
  if ('woundsDealt' in f) return 'PB infligés';
  if ('sum' in f) return f.sum.map(formulaSummary).join(' + ');
  if ('times' in f) return `${formulaSummary(f.times.of)} × ${f.times.factor}`;
  return `${f.dice.n}d${f.dice.sides}${f.dice.plus ? `+${f.dice.plus}` : ''}`;
}

/** Éditeur RÉUTILISABLE d'une `Formula` : sélecteur de FORME + champs adaptés. AUCUNE forme
 *  existante n'est dégradée — un littéral reste littéral, un `{dice}`/`{charOf}` est édité tel quel.
 *  EXPORTÉ : réutilisé par les éditeurs de champs Formula hors-op (durée d'un consommable, CodexEdit). */
export function FormulaField({ label, value, onChange, min }: {
  label: string;
  value: Formula | undefined;
  onChange: (f: Formula) => void;
  min?: number;
}) {
  const shape = shapeOf(value);
  const setShape = (s: FormulaShape) => { if (s !== shape) onChange(formulaForShape(s, value)); };
  return (
    <label className="dr fml-field">
      {label}
      <span className="fml-row">
        <select className="fml-shape" value={shape} onChange={(e) => setShape(e.target.value as FormulaShape)}>
          <option value="lit">Nombre</option>
          <option value="bonus">Bonus de carac.</option>
          <option value="char">Valeur de carac.</option>
          <option value="dice">Dés</option>
          <option value="times">Dés × facteur</option>
          <option value="rolled">Dé du jet (paliers)</option>
        </select>
        {shape === 'lit' && (
          <input type="number" min={min} value={typeof value === 'number' ? value : 0}
            onChange={(e) => onChange(Number(e.target.value))} />
        )}
        {(shape === 'bonus' || shape === 'char') && (
          <select value={charOfFormula(value)}
            onChange={(e) => onChange(shape === 'bonus' ? { bonusOf: e.target.value as CharKey } : { charOf: e.target.value as CharKey })}>
            {CHARS.map((c) => <option key={c} value={c}>{CHAR_LABELS[c]}</option>)}
          </select>
        )}
        {shape === 'dice' && typeof value === 'object' && value != null && 'dice' in value && (
          <span className="fml-dice">
            <input type="number" min={1} title="nombre de dés" value={value.dice.n}
              onChange={(e) => onChange({ dice: { ...value.dice, n: Math.max(1, Number(e.target.value) || 1) } })} />
            d
            <input type="number" min={1} title="faces" value={value.dice.sides}
              onChange={(e) => onChange({ dice: { ...value.dice, sides: Math.max(1, Number(e.target.value) || 1) } })} />
            +
            <input type="number" title="offset" value={value.dice.plus ?? 0}
              onChange={(e) => { const p = Number(e.target.value) || 0; onChange({ dice: { ...value.dice, plus: p || undefined } }); }} />
          </span>
        )}
        {shape === 'times' && typeof value === 'object' && value != null && 'times' in value && (() => {
          const inner = value.times.of;
          const dice = typeof inner === 'object' && inner != null && 'dice' in inner ? inner.dice : { n: 1, sides: 10 };
          return (
            <span className="fml-dice">
              <input type="number" min={1} title="nombre de dés" value={dice.n}
                onChange={(e) => onChange({ times: { of: { dice: { ...dice, n: Math.max(1, Number(e.target.value) || 1) } }, factor: value.times.factor } })} />
              d
              <input type="number" min={1} title="faces" value={dice.sides}
                onChange={(e) => onChange({ times: { of: { dice: { ...dice, sides: Math.max(1, Number(e.target.value) || 1) } }, factor: value.times.factor } })} />
              ×
              <input type="number" title="facteur" value={value.times.factor}
                onChange={(e) => onChange({ times: { of: value.times.of, factor: Number(e.target.value) || 1 } })} />
            </span>
          );
        })()}
      </span>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Défauts — une op MINIMALE VALIDE par type
// ---------------------------------------------------------------------------

export function newOp(op: GameOp['op'] | string): GameOp {
  switch (op as GameOp['op']) {
    case 'wounds': return { op: 'wounds', amount: 5 };
    case 'heal': return { op: 'heal', amount: 3 };
    case 'healCaster': return { op: 'healCaster', amount: 1 };
    case 'condition': return { op: 'condition', name: etats[0]?.label ?? 'sonne', value: 1 };
    case 'removeCondition': return { op: 'removeCondition' };
    case 'endPsych': return { op: 'endPsych', type: 'frenesie' };
    case 'sbBonus': return { op: 'sbBonus', amount: 1 };
    case 'charMod': return { op: 'charMod', char: 'force', mod: -10 };
    case 'ap': return { op: 'ap', amount: 1 };
    case 'testMod': return { op: 'testMod', amount: -10 };
    case 'ignoreStatePenalties': return { op: 'ignoreStatePenalties' };
    case 'freeReroll': return { op: 'freeReroll' };
    case 'critTwice': return { op: 'critTwice' };
    case 'gainResource': return { op: 'gainResource', resource: 'fortune', amount: 1 };
    case 'corruption': return { op: 'corruption', amount: 1 };
    case 'sinMod': return { op: 'sinMod', amount: 1 };
    case 'corruptionExposure': return { op: 'corruptionExposure', level: 'mineure' };
    case 'castPenalty': return { op: 'castPenalty', skill: 'all', mod: -10 };
    case 'castWard': return { op: 'castWard', radius: 5 };
    case 'arrowWard': return { op: 'arrowWard', radius: 5 };
    case 'domeWard': return { op: 'domeWard', radius: 5 };
    case 'attackWardFM': return { op: 'attackWardFM' };
    case 'grantWeapon': return { op: 'grantWeapon', name: 'Arme aethyrique', damage: { bonusOf: 'force-mentale' } };
    case 'grantNaturalWeapon': return { op: 'grantNaturalWeapon', name: 'Griffes', damage: 3 };
    case 'grantFreeAttack': return { op: 'grantFreeAttack', weapon: 'held', when: 'immediate', cost: { advantageOrMovement: true } };
    case 'grantTrait': return { op: 'grantTrait', traitId: 'armure' };
    case 'grantPsychTrait': return { op: 'grantPsychTrait', psychType: 'frenesie' };
    case 'removePsychTrait': return { op: 'removePsychTrait' };
    case 'grantTalent': return { op: 'grantTalent', talentId: 'sang-froid' };
    case 'grantCareerSkill': return { op: 'grantCareerSkill', skillId: 'metier', spec: 'Au choix' };
    case 'grantCareerTalent': return { op: 'grantCareerTalent', talentId: 'frenesie' };
    case 'augmentWeapon': return { op: 'augmentWeapon', addQualities: ['magique'] };
    case 'cureDisease': return { op: 'cureDisease', count: 1 };
    case 'reduceDiseaseDays': return { op: 'reduceDiseaseDays', days: 1 };
    case 'diseaseTestMod': return { op: 'diseaseTestMod', amount: 10 };
    case 'suppressSymptom': return { op: 'suppressSymptom', symptomId: 'bubons' };
    case 'actGate': return { op: 'actGate', char: 'force-mentale' };
    case 'delayed': return { op: 'delayed', afterHours: 1, ops: [] };
    case 'preventInfection': return { op: 'preventInfection' };
    case 'cureCriticalWound': return { op: 'cureCriticalWound', count: 1 };
    case 'suppressPsych': return { op: 'suppressPsych' };
    case 'suffocate': return { op: 'suffocate' };
    case 'noBreath': return { op: 'noBreath' };
    case 'noHunger': return { op: 'noHunger' };
    case 'weatherWard': return { op: 'weatherWard' };
    case 'damageArmour': return { op: 'damageArmour', material: 'cuir' };
    case 'reduceToZero': return { op: 'reduceToZero' };
    case 'banish': return { op: 'banish' };
    case 'martyr': return { op: 'martyr' };
    case 'giveTrapping': return { op: 'giveTrapping', custom: 'Ration' };
    case 'perRound': return { op: 'perRound', ops: [] };
    case 'summon': return { op: 'summon', ref: 'Loup', count: 1, allyOfCaster: true };
    case 'zone': return { op: 'zone', shape: 'disc', radiusMeters: { bonusOf: 'force-mentale' } };
    case 'push': return { op: 'push', meters: { bonusOf: 'force-mentale' } };
    case 'teleport': return { op: 'teleport', meters: { bonusOf: 'force-mentale' } };
    case 'chain': return { op: 'chain', maxBounces: { bonusOf: 'force-mentale' }, hopMeters: { bonusOf: 'force-mentale' } };
    case 'polymorph': return { op: 'polymorph', ref: 'Ours' };
    case 'transform': return { op: 'transform', tag: 'forme', ops: [] };
    case 'endTransform': return { op: 'endTransform', tag: 'forme' };
    case 'lifeSteal': return { op: 'lifeSteal', num: 1, den: 2, round: 'floor' };
    case 'light': return { op: 'light', radiusTiles: 5 };
    case 'skillMod': return { op: 'skillMod', skill: 'esquive', mod: -10 };
    case 'skillDRBonus': return { op: 'skillDRBonus', skill: 'calme', bonus: 1 };
    case 'charDRBonus': return { op: 'charDRBonus', char: 'sociabilite', bonus: 1 };
    case 'crewTestMod': return { op: 'crewTestMod', mod: 10 };
    case 'moveScale': return { op: 'moveScale', num: 1, den: 2 };
    case 'moveMod': return { op: 'moveMod', mod: -1 };
    case 'offTerrainMod': return { op: 'offTerrainMod', terrain: 'eau', mSet: 1, testDR: -2 };
    case 'attrMod': return { op: 'attrMod', attr: 'fortune', mod: 1 };
    case 'maxWeaponHands': return { op: 'maxWeaponHands', hands: 1 };
    case 'disarm': return { op: 'disarm' };
    case 'handGate': return { op: 'handGate' };
    case 'senseLoss': return { op: 'senseLoss', sense: 'vue' };
    case 'loseTurn': return { op: 'loseTurn' };
    case 'removeShipPoste': return { op: 'removeShipPoste' };
    case 'weaponRollMod': return { op: 'weaponRollMod', phase: 'attack', drMod: -1 };
    case 'weaponDamageMod': return { op: 'weaponDamageMod', dr: 1 };
    case 'armourPierce': return { op: 'armourPierce', amount: 1 };
    case 'critOnRoll': return { op: 'critOnRoll', mod: 10, equals: 0 };
    case 'spendAdvantage': return { op: 'spendAdvantage', amount: 1 };
    case 'rollThreshold': return { op: 'rollThreshold', sides: 10, thresholds: [] };
    case 'narrative': return { op: 'narrative', text: '' };
    default: return { op: 'wounds', amount: 5 };
  }
}

// ---------------------------------------------------------------------------
// Résumé
// ---------------------------------------------------------------------------

export function opSummary(o: GameOp): string {
  switch (o.op) {
    case 'wounds': return `${formulaSummary(o.amount)} Blessure(s)`;
    case 'heal': return `+${formulaSummary(o.amount)} PB`;
    case 'healCaster': return `+${formulaSummary(o.amount)} PB au lanceur`;
    case 'condition': return `${o.name}${o.value && o.value !== 1 ? ` ×${formulaSummary(o.value)}` : ''}${o.perRound ? '/Round' : ''}`;
    case 'removeCondition': return `${o.name ?? '(au choix)'}`;
    case 'endPsych': return `${o.type}`;
    case 'sbBonus': return `+${o.amount} BF aux Dégâts`;
    case 'charMod': return `${o.mod >= 0 ? '+' : ''}${o.mod} ${CHAR_LABELS[o.char] ?? o.char}`;
    case 'skillMod': return `${o.mod >= 0 ? '+' : ''}${o.mod} ${refLabel('skills', { id: o.skill })}`;
    case 'skillDRBonus': return `+${formulaSummary(o.bonus)} DR ${o.skill ? refLabel('skills', { id: o.skill }) : (findCrewTestTypeById(o.testType ?? '')?.label ?? o.testType)}${o.spec ? ` (${o.spec})` : ''}`;
    case 'charDRBonus': return `+${formulaSummary(o.bonus)} DR ${CHAR_LABELS[o.char] ?? o.char}`;
    case 'crewTestMod': return `${o.mod >= 0 ? '+' : ''}${o.mod} (Tests d’équipage)`;
    case 'moveMod': return `${o.mod >= 0 ? '+' : ''}${o.mod} Mouvement`;
    case 'offTerrainMod': return `hors ${o.terrain}${o.mSet != null ? ` : M ${o.mSet}` : ''}${o.testDR ? `, ${o.testDR} DR aux Tests` : ''}`;
    case 'attrMod': return `+${formulaSummary(o.mod)} ${({ wounds: 'Blessures', fortune: 'Chance', resolve: 'Détermination', fate: 'Destin', resilience: 'Résilience' } as const)[o.attr]}`;
    case 'ap': return `+${formulaSummary(o.amount)} PA${o.loc ? ` (${o.loc})` : ''}`;
    case 'testMod': return `${o.amount >= 0 ? '+' : ''}${o.amount} aux Tests${o.char ? ` de ${CHAR_LABELS[o.char] ?? o.char}` : ''}`;
    case 'ignoreStatePenalties': return 'ignore les pénalités d’État';
    case 'freeReroll': return 'relance gratuite';
    case 'critTwice': return 'deux lancers de Critique';
    case 'gainResource': return `+${o.amount} ${o.resource === 'fate' ? 'Destin' : 'Chance'}${o.temporary ? ' (temp.)' : ''}`;
    case 'corruption': return `${o.amount >= 0 ? '+' : ''}${o.amount}${o.align ? ` (${CHAOS_ALIGN_LABELS[o.align as ChaosAlign]})` : ''}`;
    case 'sinMod': return `${o.amount >= 0 ? '+' : ''}${o.amount}`;
    case 'corruptionExposure': return `${EXPOSURE_LABELS[o.level as ExposureLevel] ?? o.level}${o.skill ? ` (${refLabel('skills', { id: o.skill })})` : ''}`;
    case 'castPenalty': return `${o.blocked ? 'magie interdite' : o.maxZeroDR ? 'Prière plafonnée' : `${o.mod ?? 0} ${o.skill}`}`;
    case 'castWard': return `−20 Langue, rayon ${formulaSummary(o.radius)} m`;
    case 'arrowWard': return `rayon ${formulaSummary(o.radius)} m`;
    case 'domeWard': return `rayon ${formulaSummary(o.radius)} m`;
    case 'attackWardFM': return 'l’attaquer exige un Test de FM';
    case 'grantWeapon': return `${o.name} (Dégâts ${o.plusBF ? 'BF+' : ''}${formulaSummary(o.damage)})`;
    case 'grantNaturalWeapon': return `${o.name} (${o.plusBF !== false ? 'BF+' : ''}${formulaSummary(o.damage)})`;
    case 'grantTrait': return `${formatTrait({ id: o.traitId, arg: o.arg })}${o.indice != null ? ` ${formulaSummary(o.indice)}` : ''}`;
    case 'grantPsychTrait': return `${o.psychType}${o.cible ? ` (${o.cible})` : ''}`;
    case 'grantTalent': return `${talentConcrete(o)}`;
    case 'grantCareerSkill': return `${refLabel('skills', { id: o.skillId, spec: o.spec })}`;
    case 'grantCareerTalent': return `${refLabel('talents', { id: o.talentId, spec: o.spec })}`;
    case 'augmentWeapon': return `${[...(o.addQualities ?? []).map((id) => qualityRefLabel({ id })), o.damageBonus != null ? `+${formulaSummary(o.damageBonus)} Dégâts` : ''].filter(Boolean).join(', ') || '(vide)'}`;
    case 'cureDisease': return `${o.count ?? 1} maladie(s)`;
    case 'reduceDiseaseDays': return `−${o.dice ? `${o.dice.n}d${o.dice.sides}` : (o.days ?? 1)} jour(s)${o.disease ? ` (${refLabel('maladies', { id: o.disease })})` : ''}`;
    case 'diseaseTestMod': return `${o.amount >= 0 ? '+' : ''}${o.amount} aux Tests de maladie${o.diseases?.length ? ` (${o.diseases.map((d) => refLabel('maladies', { id: d })).join(', ')})` : ''}`;
    case 'suppressSymptom': return `${refLabel('symptoms', { id: o.symptomId })} suspendu`;
    case 'actGate': return `Test de ${CHAR_LABELS[o.char] ?? o.char} chaque Round pour agir`;
    case 'delayed': return `${o.ops.length} op(s) différée(s)${o.afterDuration ? ' (à la dissipation)' : ''}`;
    case 'preventInfection': return 'pas d’infection';
    case 'cureCriticalWound': return `${o.count ?? 1} critique(s)`;
    case 'suppressPsych': return 'Traits psy. apaisés';
    case 'suffocate': return 'suffocation';
    case 'noBreath': return 'plus besoin de respirer';
    case 'noHunger': return 'plus besoin de manger';
    case 'weatherWard': return 'immunité aux intempéries';
    case 'damageArmour': return 'cuir −1 PA';
    case 'reduceToZero': return 'Blessures à 0';
    case 'banish': return 'retirée du jeu';
    case 'martyr': return 'reçoit les Dégâts';
    case 'giveTrapping': return `${o.count && o.count > 1 ? `${o.count}× ` : ''}${giveTrappingLabel(o)}`;
    case 'perRound': return `${o.ops.length} op(s) chaque Round`;
    case 'summon': return `${formulaSummary(o.count)}× ${o.ref}${o.allyOfCaster === false ? ' (hostile)' : ''}`;
    case 'scheduleRespawn': return `${o.ref} dans ${formulaSummary(o.delayDays)} j${o.cancelFlag ? ` (sauf « ${o.cancelFlag} »)` : ''}`;
    case 'zone': return `${o.shape === 'wall' ? `mur ${formulaSummary(o.lengthMeters ?? 2)} m` : `disque ${formulaSummary(o.radiusMeters ?? 2)} m`}`;
    case 'push': return `${formulaSummary(o.meters)} m`;
    case 'teleport': return `${formulaSummary(o.meters)} m${o.perSL ? ` (+${formulaSummary(o.perSL.metersFormula)}/${o.perSL.every} DR)` : ''}`;
    case 'chain': return `${formulaSummary(o.maxBounces)} rebond(s), saut ${formulaSummary(o.hopMeters)} m`;
    case 'polymorph': return `${o.ref}`;
    case 'transform': return `« ${o.tag} » (${o.ops.length} effet(s)${o.morphRef ? `, apparence ${o.morphRef}` : ''})`;
    case 'endTransform': return `« ${o.tag} »`;
    case 'lifeSteal': return `${o.num}/${o.den} des Dégâts`;
    case 'loseTurn': return 'saute le tour';
    case 'removeShipPoste': return 'retire un poste de navire';
    case 'rollThreshold': return `1d${o.sides} → ${o.thresholds.length} palier(s)`;
    case 'narrative': return `${o.text ? `« ${o.text.length > 40 ? `${o.text.slice(0, 39)}…` : o.text}` + ' »' : '(vide)'}`;
    default: return `${(o as GameOp).op}`;
  }
}

// ---------------------------------------------------------------------------
// Champs d'édition
// ---------------------------------------------------------------------------

/** Ops avec un éditeur DÉDIÉ ; toute autre op tombe sur le repli JSON (lisible/modifiable sans perte). */
const DEDICATED: ReadonlySet<GameOp['op']> = new Set([
  'wounds', 'heal', 'healCaster', 'condition', 'removeCondition', 'charMod', 'skillMod', 'moveMod', 'ap', 'testMod',
  'corruption', 'sinMod', 'corruptionExposure', 'gainResource', 'grantTrait', 'grantTalent', 'grantNaturalWeapon', 'narrative',
  'summon', 'polymorph', 'lifeSteal', 'push', 'teleport', 'chain',
]);

function OpFields({ op, onChange }: { op: GameOp; onChange: (o: GameOp) => void }) {
  const o = op as any;
  const upd = (patch: any) => onChange({ ...o, ...patch });
  return (
    <div className="eff-body">
      <select className="eff-type" value={op.op} onChange={(e) => onChange(newOp(e.target.value as GameOp['op']))}>
        {OP_GROUPS.map(([g, keys]) => (
          <optgroup key={g} label={g}>
            {keys.map((k) => <option key={k} value={k}>{OP_LABEL[k]}</option>)}
          </optgroup>
        ))}
      </select>
      <div className="tf-row">
        {(op.op === 'wounds' || op.op === 'heal' || op.op === 'healCaster' || op.op === 'ap') && (
          <FormulaField label="Quantité" value={o.amount} min={0} onChange={(amount) => upd({ amount })} />
        )}
        {op.op === 'sinMod' && (
          <label className="dr">Péché ±<input type="number" value={o.amount ?? 1} onChange={(e) => upd({ amount: Number(e.target.value) || 0 })} /></label>
        )}
        {op.op === 'corruptionExposure' && (
          <>
            <select value={o.level ?? 'mineure'} onChange={(e) => upd({ level: e.target.value as ExposureLevel })}>
              {(Object.keys(EXPOSURE_LABELS) as ExposureLevel[]).map((k) => (
                <option key={k} value={k}>Exposition {EXPOSURE_LABELS[k]}</option>
              ))}
            </select>
            <select value={o.skill ?? ''} onChange={(e) => upd({ skill: (e.target.value || undefined) as 'resistance' | 'calme' | undefined })}>
              <option value="">Compétence : au choix du joueur</option>
              <option value="resistance">{refLabel('skills', { id: 'resistance' })} (Influence physique)</option>
              <option value="calme">{refLabel('skills', { id: 'calme' })} (Influence spirituelle)</option>
            </select>
          </>
        )}
        {op.op === 'corruption' && (
          <>
            <label className="dr">Points<input type="number" value={o.amount ?? 1} onChange={(e) => upd({ amount: Number(e.target.value) || 0 })} /></label>
            <select value={o.align ?? ''} onChange={(e) => upd({ align: (e.target.value || undefined) as ChaosAlign | undefined })}>
              <option value="">Mutation : règle globale</option>
              {(Object.keys(CHAOS_ALIGN_LABELS) as ChaosAlign[]).map((k) => (
                <option key={k} value={k}>Table EDOC : {CHAOS_ALIGN_LABELS[k]}</option>
              ))}
            </select>
          </>
        )}
        {op.op === 'gainResource' && (
          <>
            <select value={o.resource ?? 'fortune'} onChange={(e) => upd({ resource: e.target.value })}>
              <option value="fortune">Chance</option>
              <option value="fate">Destin</option>
            </select>
            <label className="dr">Points<input type="number" min={1} value={o.amount ?? 1} onChange={(e) => upd({ amount: Math.max(1, Number(e.target.value) || 1) })} /></label>
            <label className="dr"><input type="checkbox" checked={!!o.temporary} onChange={(e) => upd({ temporary: e.target.checked || undefined })} /> le temps du Sort</label>
          </>
        )}
        {op.op === 'sbBonus' && (
          <label className="dr">+BF<input type="number" value={o.amount ?? 0} onChange={(e) => upd({ amount: Number(e.target.value) || 0 })} /></label>
        )}
        {op.op === 'endPsych' && (
          <label className="dr">Type psy<input value={o.type ?? ''} onChange={(e) => upd({ type: e.target.value })} /></label>
        )}
        {op.op === 'testMod' && (
          <>
            <label className="dr">Modif.<input type="number" value={o.amount ?? 0} onChange={(e) => upd({ amount: Number(e.target.value) || 0 })} /></label>
            <label className="dr">Carac.
              <select value={o.char ?? ''} onChange={(e) => upd({ char: (e.target.value || undefined) as CharKey | undefined })}>
                <option value="">— tous les Tests —</option>
                {CHARS.map((c) => <option key={c} value={c}>{CHAR_LABELS[c]}</option>)}
              </select>
            </label>
          </>
        )}
        {(op.op === 'condition' || op.op === 'removeCondition') && (
          <>
            <select value={o.name ?? ''} onChange={(e) => upd({ name: e.target.value || undefined })}>
              {op.op === 'removeCondition' && <option value="">— au choix (1er État) —</option>}
              {etats.map((s) => <option key={s.label} value={s.label}>{s.label}</option>)}
            </select>
            <FormulaField label="Intensité" value={o.value ?? 1} min={0} onChange={(value) => upd({ value })} />
            {op.op === 'condition' && (
              <>
                <label className="dr"><input type="checkbox" checked={!!o.perRound} onChange={(e) => upd({ perRound: e.target.checked || undefined })} /> chaque Round</label>
                <label className="dr"><input type="checkbox" checked={o.valuePerSL != null} onChange={(e) => upd({ valuePerSL: e.target.checked ? { every: 1, amount: 1 } : undefined })} /> par DR</label>
                {o.valuePerSL != null && (
                  <>
                    <label className="dr">tous les<input type="number" min={1} title="DR" value={o.valuePerSL.every ?? 1} onChange={(e) => upd({ valuePerSL: { ...o.valuePerSL, every: Math.max(1, Number(e.target.value) || 1) } })} /> DR</label>
                    <label className="dr">+<input type="number" title="quantité par palier" value={o.valuePerSL.amount ?? 1} onChange={(e) => upd({ valuePerSL: { ...o.valuePerSL, amount: Number(e.target.value) || 0 } })} /></label>
                    <label className="dr"><input type="checkbox" checked={!!o.valuePerSL.onFailure} onChange={(e) => upd({ valuePerSL: { ...o.valuePerSL, onFailure: e.target.checked || undefined } })} /> sur l'échec (niveau d'échec)</label>
                  </>
                )}
                {/* Se libérer (LDB 16 l.61 / Filets, Zoo Impérial p.29) — escapeStrength (Test opposé) et
                    escapeThreshold (Test à seuil) sont MUTUELLEMENT EXCLUSIFS (cf. resolveRecoverTest). */}
                <label className="dr"><input type="checkbox" checked={o.escapeStrength != null} onChange={(e) => upd({ escapeStrength: e.target.checked ? { charOf: 'force' } : undefined, escapeThreshold: e.target.checked ? undefined : o.escapeThreshold })} /> Force d'évasion (opposée)</label>
                {o.escapeStrength != null && <FormulaField label="Force" value={o.escapeStrength} min={0} onChange={(escapeStrength) => upd({ escapeStrength, escapeThreshold: undefined })} />}
                <label className="dr"><input type="checkbox" checked={o.escapeThreshold != null} onChange={(e) => upd({ escapeThreshold: e.target.checked ? 3 : undefined, escapeStrength: e.target.checked ? undefined : o.escapeStrength })} /> Seuil de DR (Test non opposé)</label>
                {o.escapeThreshold != null && <FormulaField label="Seuil (DR)" value={o.escapeThreshold} min={0} onChange={(escapeThreshold) => upd({ escapeThreshold, escapeStrength: undefined })} />}
                <label className="dr"><input type="checkbox" checked={!!o.entangleOnFail} onChange={(e) => upd({ entangleOnFail: e.target.checked || undefined })} /> échec → +1 État (Filets, ZI p.29)</label>
                <label className="dr"><input type="checkbox" checked={o.struggleDamage != null} onChange={(e) => upd({ struggleDamage: e.target.checked ? 1 : undefined })} /> Dégâts par tentative (ignore armure)</label>
                {o.struggleDamage != null && <FormulaField label="Dégâts" value={o.struggleDamage} min={0} onChange={(struggleDamage) => upd({ struggleDamage })} />}
              </>
            )}
          </>
        )}
        {op.op === 'charMod' && (
          <>
            <select value={o.char} onChange={(e) => upd({ char: e.target.value as CharKey })}>
              {CHARS.map((c) => <option key={c} value={c}>{CHAR_LABELS[c]}</option>)}
            </select>
            <label className="dr">Modif.<input type="number" value={o.mod} onChange={(e) => upd({ mod: Number(e.target.value) || 0 })} /></label>
            <label className="dr">Rounds<input type="number" min={1} placeholder="durée" value={typeof o.durationRounds === 'number' ? o.durationRounds : ''} onChange={(e) => upd({ durationRounds: e.target.value === '' ? undefined : Math.max(1, Number(e.target.value)) })} /></label>
          </>
        )}
        {op.op === 'skillMod' && (
          <>
            <RefField cfg={{ ds: 'skills', single: true }} fieldKey="Compétence" value={o.skill} onChange={(v) => upd({ skill: (v as string) ?? '' })} />
            <label className="dr">Modif.<input type="number" value={o.mod ?? 0} onChange={(e) => upd({ mod: Number(e.target.value) || 0 })} /></label>
            <label className="dr">Sens{/* Surdité, LDB 18 : restreint au Test de Perception basé sur ce sens */}
              <select value={o.sense ?? ''} onChange={(e) => upd({ sense: (e.target.value || undefined) as 'vue' | 'ouie' | undefined })}>
                <option value="">— tous les Tests —</option>
                <option value="vue">Vue</option>
                <option value="ouie">Ouïe</option>
              </select>
            </label>
          </>
        )}
        {op.op === 'moveMod' && (
          <label className="dr">Mouvement (±)<input type="number" value={o.mod ?? 0} onChange={(e) => upd({ mod: Number(e.target.value) || 0 })} /></label>
        )}
        {op.op === 'grantTrait' && (
          <>
            <input
              placeholder="Trait (ex. Peur, Armure, Haine (Skavens))"
              value={formatTrait({ id: o.traitId, arg: o.arg })}
              onChange={(e) => { const p = parseTraitInstance(e.target.value); upd({ traitId: p.id, arg: p.arg }); }}
            />
            <label className="dr"><input type="checkbox" checked={o.indice != null} onChange={(e) => upd({ indice: e.target.checked ? 1 : undefined })} /> Indice</label>
            {o.indice != null && <FormulaField label="Valeur" value={o.indice} min={0} onChange={(indice) => upd({ indice })} />}
          </>
        )}
        {op.op === 'grantTalent' && (
          <input
            placeholder="Talent (ex. Sang-froid, Magie des Arcanes (Ghur))"
            value={talentConcrete(o)}
            onChange={(e) => { const p = splitLabel(e.target.value); const id = findTalent(p.name)?.id ?? slugId(p.name); upd({ talentId: id, spec: p.spec }); }}
          />
        )}
        {op.op === 'grantNaturalWeapon' && (
          <>
            <input placeholder="Arme (ex. Morsure, Griffes)" value={o.name ?? ''} onChange={(e) => upd({ name: e.target.value })} />
            <FormulaField label="Dégâts" value={o.damage} min={0} onChange={(damage) => upd({ damage })} />
            <label className="dr"><input type="checkbox" checked={o.plusBF !== false} onChange={(e) => upd({ plusBF: e.target.checked })} /> BF+</label>
            <input placeholder="Qualités (Magique…)" value={(o.qualities ?? []).join(', ')}
              onChange={(e) => { const a = e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean); upd({ qualities: a.length ? a : undefined }); }} />
          </>
        )}
        {op.op === 'summon' && (
          <>
            <input placeholder="Créature (nom du bestiaire)" value={o.ref ?? ''} onChange={(e) => upd({ ref: e.target.value })} />
            <FormulaField label="Nombre" value={o.count ?? 1} min={1} onChange={(count) => upd({ count })} />
            <label className="dr">Taille
              <select value={o.size ?? ''} onChange={(e) => upd({ size: e.target.value || undefined })}>
                <option value="">— d’origine —</option>
                {SIZES.map((s) => <option key={s} value={s}>{SIZE_LABEL[s]}</option>)}
              </select>
            </label>
            <input placeholder="Traits ajoutés (ex. Frénésie, Magique)" value={(o.addTraits ?? []).map(formatTrait).join(', ')}
              onChange={(e) => { const a = e.target.value.split(',').map((t: string) => t.trim()).filter(Boolean).map(parseTraitInstance); upd({ addTraits: a.length ? a : undefined }); }} />
            <label className="dr"><input type="checkbox" checked={o.allyOfCaster !== false} onChange={(e) => upd({ allyOfCaster: e.target.checked ? true : false })} /> alliée du lanceur</label>
            <label className="dr"><input type="checkbox" checked={!!o.despawnIfCasterDown} onChange={(e) => upd({ despawnIfCasterDown: e.target.checked || undefined })} /> se dissipe si le lanceur tombe</label>
          </>
        )}
        {op.op === 'polymorph' && (
          <input placeholder="Forme — créature du bestiaire (ex. Ours, Loup, Aigle)" value={o.ref ?? ''} onChange={(e) => upd({ ref: e.target.value })} />
        )}
        {op.op === 'lifeSteal' && (
          <>
            <label className="dr">Fraction
              <input type="number" min={1} title="numérateur" value={o.num ?? 1} onChange={(e) => upd({ num: Math.max(1, Number(e.target.value) || 1) })} />
              /
              <input type="number" min={1} title="dénominateur" value={o.den ?? 2} onChange={(e) => upd({ den: Math.max(1, Number(e.target.value) || 1) })} />
            </label>
            <label className="dr">Arrondi
              <select value={o.round ?? 'floor'} onChange={(e) => upd({ round: e.target.value })}>
                <option value="floor">inférieur</option>
                <option value="ceil">supérieur</option>
              </select>
            </label>
          </>
        )}
        {op.op === 'push' && (
          <FormulaField label="Distance (m)" value={o.meters} min={0} onChange={(meters) => upd({ meters })} />
        )}
        {op.op === 'chain' && (
          <>
            <FormulaField label="Rebonds max" value={o.maxBounces} min={0} onChange={(maxBounces) => upd({ maxBounces })} />
            <FormulaField label="Saut (m)" value={o.hopMeters} min={0} onChange={(hopMeters) => upd({ hopMeters })} />
          </>
        )}
        {op.op === 'teleport' && (
          <>
            <FormulaField label="Distance (m)" value={o.meters} min={0} onChange={(meters) => upd({ meters })} />
            <label className="dr"><input type="checkbox" checked={o.perSL != null} onChange={(e) => upd({ perSL: e.target.checked ? { every: 2, metersFormula: { bonusOf: 'force-mentale' } } : undefined })} /> bonus par DR</label>
            {o.perSL != null && (
              <>
                <label className="dr">tous les<input type="number" min={1} title="DR" value={o.perSL.every ?? 2} onChange={(e) => upd({ perSL: { ...o.perSL, every: Math.max(1, Number(e.target.value) || 1) } })} /> DR</label>
                <FormulaField label="Bonus (m)" value={o.perSL.metersFormula} min={0} onChange={(metersFormula) => upd({ perSL: { ...o.perSL, metersFormula } })} />
              </>
            )}
          </>
        )}
        {op.op === 'narrative' && (
          <textarea placeholder="Texte journalisé (arbitrage MJ)" value={o.text ?? ''} onChange={(e) => upd({ text: e.target.value })} />
        )}
        {/* Un Test imbriqué n'est PLUS une op (`{op:'test'}` supprimé, Lot 4d) mais un nœud de la STRUCTURE
            Flow `{kind:'test'}` (édité par le FlowEditor, succès/échec cadence-aware). */}
        {/* Repli JSON pour toute op sans éditeur dédié — paramètres TOUJOURS lisibles/modifiables sans perte. */}
        {!DEDICATED.has(op.op) && (
          <JsonField label="paramètres de l’op" value={o} rows={6} onChange={(v) => onChange(v as GameOp)} />
        )}
      </div>
    </div>
  );
}

export function GameOpEditor({ ops, onChange }: { ops: GameOp[]; onChange: (ops: GameOp[]) => void }) {
  const swap = (i: number, j: number) => {
    if (j < 0 || j >= ops.length) return;
    const next = [...ops];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="eff-list">
      {ops.map((o, i) => (
        <details className="eff-row" key={i}>
          <summary>
            <span className="eff-summary"><Icon id={OP_ICON[o.op] ?? 'journal/detail'} size="sm" /> {opSummary(o)}</span>
            <span className="eff-actions" onClick={(e) => e.preventDefault()}>
              <button className="btn small" title="Monter" disabled={i === 0} onClick={() => swap(i, i - 1)}>↑</button>
              <button className="btn small" title="Descendre" disabled={i === ops.length - 1} onClick={() => swap(i, i + 1)}>↓</button>
              <button className="btn small danger" title="Supprimer l'op" onClick={() => onChange(ops.filter((_, j) => j !== i))}>✕</button>
            </span>
          </summary>
          <OpFields op={o} onChange={(no) => onChange(ops.map((x, j) => (j === i ? no : x)))} />
        </details>
      ))}
      <details className="eff-add">
        <summary className="btn small">+ Op mécanique</summary>
        <div className="eff-add-menu panel">
          {OP_GROUPS.map(([g, keys]) => (
            <div key={g} className="eff-add-group">
              <div className="mini-title">{g}</div>
              {keys.map((k) => (
                <button key={k} className="eff-add-item" onClick={(e) => { onChange([...ops, newOp(k)]); closeDetails(e.currentTarget); }}>
                  <Icon id={OP_ICON[k]} size="sm" /> {OP_LABEL[k]}
                </button>
              ))}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
