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
import { CHAR_LABELS, CharKey } from '../../engine/types';
import { SizeCategory, SIZE_LABEL } from '../../engine/size';
import { etats } from '../../data';
import { closeDetails } from './EffectList';
import { JsonField } from './JsonField';

const SIZES = Object.keys(SIZE_LABEL) as SizeCategory[];

const CHARS = Object.keys(CHAR_LABELS) as CharKey[];

// ---------------------------------------------------------------------------
// Vocabulaire COMPLET — libellé + menu groupé par intention
// ---------------------------------------------------------------------------

/** Libellé court (avec icône) de CHAQUE op du vocabulaire `GameOp`. */
const OP_LABEL: Record<GameOp['op'], string> = {
  wounds: '💥 Blessures (ignore BE/PA)',
  heal: '❤️ Soin (Blessures rendues)',
  healCaster: '❤️ Soin au lanceur',
  condition: '🌀 Poser un État',
  removeCondition: '🌬️ Retirer un État',
  charMod: '📊 Modif. de caractéristique',
  apAll: '🛡️ +PA à toutes les Localisations',
  testMod: '📉 Modif. à tous les Tests',
  ignoreStatePenalties: '🚫 Ignore les pénalités d’État',
  freeReroll: '🔁 Relance gratuite (prochain échec)',
  critTwice: '🎯 Deux lancers de Critique (meilleur)',
  gainResource: '🍀 Points de Chance / Destin',
  corruption: '🧬 Points de Corruption',
  test: '🎲 Test imbriqué (succès/échec)',
  castPenalty: '🔮 Contrecoup d’incantation',
  castWard: '🔮 Aura anti-Sort (−20 Langue)',
  arrowWard: '🏹 Bouclier anti-projectiles',
  domeWard: '🛡️ Dôme protecteur',
  attackWardFM: '🛡️ Attaquer exige un Test de FM',
  conjureWeapon: '🐾 Invoquer une arme magique',
  grantNaturalWeapon: '🐾 Accorder une arme naturelle',
  grantTrait: '🐾 Accorder un Trait',
  grantTalent: '🐾 Accorder un Talent',
  enchantWeapon: '🗡️ Enchanter l’arme',
  cureDisease: '🩹 Guérir des maladies',
  reduceDiseaseDays: '🩹 Raccourcir une maladie',
  preventInfection: '🩹 Empêcher l’infection',
  cureCriticalWound: '🩹 Guérir une Blessure critique',
  suppressPsych: '🌫️ Apaiser les Traits psychologiques',
  suffocate: '🌫️ Suffocation',
  noBreath: '🌫️ Plus besoin de respirer',
  noHunger: '🌫️ Plus besoin de manger',
  weatherWard: '🌫️ Immunité aux intempéries',
  damageArmour: '🌫️ Pourrir le cuir (−1 PA)',
  reduceToZero: '🌫️ Réduire les Blessures à 0',
  martyr: '🌫️ Martyr (recevoir les Dégâts)',
  giveTrapping: '🎒 Donner un objet',
  perRound: '🔄 Effet récurrent (chaque Round)',
  summon: '🐺 Invoquer une créature',
  zone: '🌐 Zone persistante (mur / disque)',
  polymorph: '🦌 Métamorphose en créature',
  lifeSteal: '🩸 Vol de vie (drain de Blessures)',
  skillMod: '🎯 Modif. d’une Compétence',
  moveScale: '🦵 Échelle de Mouvement (×n/d)',
  moveMod: '🦵 Modif. de Mouvement (±N)',
  maxWeaponHands: '✋ Plafond de mains d’arme',
  senseLoss: '👁️ Perte sensorielle (œil/oreille)',
  loseTurn: '⏭️ Perdre Action + Mouvement',
  rollThreshold: '🎲 Jet à paliers (un dé → ops par seuil)',
  narrative: '📝 Effet narratif (texte libre)',
};

/** Menu « + op » : TOUTES les op du vocabulaire, groupées par intention d'auteur. */
const OP_GROUPS: [string, GameOp['op'][]][] = [
  ['💥 Dégâts & soin', ['wounds', 'heal', 'healCaster', 'lifeSteal', 'reduceToZero']],
  ['🌀 États', ['condition', 'removeCondition']],
  ['📊 Buffs & caractéristiques', ['charMod', 'apAll', 'testMod', 'ignoreStatePenalties', 'freeReroll', 'critTwice']],
  ['✨ Ressources', ['gainResource', 'corruption']],
  ['🔮 Incantation & contrecoup', ['castPenalty', 'castWard', 'arrowWard', 'domeWard', 'attackWardFM']],
  ['🐾 Invocation & armes', ['summon', 'polymorph', 'conjureWeapon', 'grantNaturalWeapon', 'grantTrait', 'grantTalent', 'enchantWeapon']],
  ['🌐 Zones', ['zone']],
  ['🩹 Soin avancé', ['cureDisease', 'reduceDiseaseDays', 'preventInfection', 'cureCriticalWound']],
  ['🌫️ Divers', ['suppressPsych', 'suffocate', 'noBreath', 'noHunger', 'weatherWard', 'damageArmour', 'martyr', 'giveTrapping', 'perRound', 'loseTurn']],
  ['🩼 Séquelles & mobilité', ['skillMod', 'moveScale', 'moveMod', 'maxWeaponHands', 'senseLoss']],
  ['🎲 Contrôle', ['test', 'rollThreshold']],
  ['📝 Narration', ['narrative']],
];

// ---------------------------------------------------------------------------
// Formules
// ---------------------------------------------------------------------------

export type FormulaShape = 'lit' | 'bonus' | 'char' | 'dice' | 'rolled';
export const shapeOf = (f: Formula | undefined): FormulaShape =>
  typeof f === 'number' || f == null ? 'lit' : 'bonusOf' in f ? 'bonus' : 'charOf' in f ? 'char' : 'rolled' in f ? 'rolled' : 'dice';

/** Formule par défaut d'une forme — utilisée au CHANGEMENT de forme. Préserve le littéral courant
 *  quand on bascule vers « Nombre » ; ne touche JAMAIS une formule dont la forme est déjà la bonne. */
export function formulaForShape(s: FormulaShape, current: Formula | undefined): Formula {
  if (s === shapeOf(current)) return current as Formula; // déjà la bonne forme → inchangée (pas de clobber)
  if (s === 'lit') return typeof current === 'number' ? current : 1;
  if (s === 'bonus') return { bonusOf: 'F' };
  if (s === 'char') return { charOf: 'F' };
  if (s === 'rolled') return { rolled: true };
  return { dice: { n: 1, sides: 10 } };
}

/** CharKey portée par une Formula de carac. (Bonus/Valeur) — défaut F pour le sélecteur. */
const charOfFormula = (f: Formula | undefined): CharKey =>
  f && typeof f === 'object' ? ('bonusOf' in f ? f.bonusOf : 'charOf' in f ? f.charOf : 'F') : 'F';

/** Résumé court d'une Formula (lecture sans perte dans les résumés d'op). */
export function formulaSummary(f: Formula | undefined): string {
  if (f == null) return '0';
  if (typeof f === 'number') return String(f);
  if ('bonusOf' in f) return `B${f.bonusOf}`;
  if ('charOf' in f) return f.charOf;
  if ('rolled' in f) return 'dé';
  return `${f.dice.n}d${f.dice.sides}${f.dice.plus ? `+${f.dice.plus}` : ''}`;
}

/** Éditeur RÉUTILISABLE d'une `Formula` : sélecteur de FORME + champs adaptés. AUCUNE forme
 *  existante n'est dégradée — un littéral reste littéral, un `{dice}`/`{charOf}` est édité tel quel. */
function FormulaField({ label, value, onChange, min }: {
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
    case 'condition': return { op: 'condition', name: etats[0]?.label ?? 'Sonné', value: 1 };
    case 'removeCondition': return { op: 'removeCondition' };
    case 'charMod': return { op: 'charMod', char: 'F', mod: -10 };
    case 'apAll': return { op: 'apAll', amount: 1 };
    case 'testMod': return { op: 'testMod', amount: -10 };
    case 'ignoreStatePenalties': return { op: 'ignoreStatePenalties' };
    case 'freeReroll': return { op: 'freeReroll' };
    case 'critTwice': return { op: 'critTwice' };
    case 'gainResource': return { op: 'gainResource', resource: 'fortune', amount: 1 };
    case 'corruption': return { op: 'corruption', amount: 1 };
    case 'test': return { op: 'test', skill: 'Résistance', difficulty: 'intermediaire', onFail: [], onSuccess: [] };
    case 'castPenalty': return { op: 'castPenalty', skill: 'all', mod: -10 };
    case 'castWard': return { op: 'castWard', radius: 5 };
    case 'arrowWard': return { op: 'arrowWard', radius: 5 };
    case 'domeWard': return { op: 'domeWard', radius: 5 };
    case 'attackWardFM': return { op: 'attackWardFM' };
    case 'conjureWeapon': return { op: 'conjureWeapon', name: 'Arme aethyrique', damage: { bonusOf: 'FM' } };
    case 'grantNaturalWeapon': return { op: 'grantNaturalWeapon', name: 'Griffes', damage: 3 };
    case 'grantTrait': return { op: 'grantTrait', trait: 'Armure' };
    case 'grantTalent': return { op: 'grantTalent', talent: 'Sang-froid' };
    case 'enchantWeapon': return { op: 'enchantWeapon', addQualities: ['Magique'] };
    case 'cureDisease': return { op: 'cureDisease', count: 1 };
    case 'reduceDiseaseDays': return { op: 'reduceDiseaseDays', days: 1 };
    case 'preventInfection': return { op: 'preventInfection' };
    case 'cureCriticalWound': return { op: 'cureCriticalWound', count: 1 };
    case 'suppressPsych': return { op: 'suppressPsych' };
    case 'suffocate': return { op: 'suffocate' };
    case 'noBreath': return { op: 'noBreath' };
    case 'noHunger': return { op: 'noHunger' };
    case 'weatherWard': return { op: 'weatherWard' };
    case 'damageArmour': return { op: 'damageArmour', material: 'cuir' };
    case 'reduceToZero': return { op: 'reduceToZero' };
    case 'martyr': return { op: 'martyr' };
    case 'giveTrapping': return { op: 'giveTrapping', trapping: 'Ration' };
    case 'perRound': return { op: 'perRound', ops: [] };
    case 'summon': return { op: 'summon', ref: 'Loup', count: 1, allyOfCaster: true };
    case 'zone': return { op: 'zone', shape: 'disc', radiusMeters: { bonusOf: 'FM' } };
    case 'polymorph': return { op: 'polymorph', ref: 'Ours' };
    case 'lifeSteal': return { op: 'lifeSteal', num: 1, den: 2, round: 'floor' };
    case 'skillMod': return { op: 'skillMod', skill: 'Esquive', mod: -10 };
    case 'moveScale': return { op: 'moveScale', num: 1, den: 2 };
    case 'moveMod': return { op: 'moveMod', mod: -1 };
    case 'maxWeaponHands': return { op: 'maxWeaponHands', hands: 1 };
    case 'senseLoss': return { op: 'senseLoss', sense: 'vue' };
    case 'loseTurn': return { op: 'loseTurn' };
    case 'rollThreshold': return { op: 'rollThreshold', sides: 10, thresholds: [] };
    case 'narrative': return { op: 'narrative', text: '' };
    default: return { op: 'wounds', amount: 5 };
  }
}

// ---------------------------------------------------------------------------
// Résumé
// ---------------------------------------------------------------------------

export function opSummary(o: GameOp): string {
  const L = OP_LABEL[o.op]?.split(' ')[0] ?? '⚙️';
  switch (o.op) {
    case 'wounds': return `${L} ${formulaSummary(o.amount)} Blessure(s)`;
    case 'heal': return `${L} +${formulaSummary(o.amount)} PB`;
    case 'healCaster': return `${L} +${formulaSummary(o.amount)} PB au lanceur`;
    case 'condition': return `${L} ${o.name}${o.value && o.value !== 1 ? ` ×${formulaSummary(o.value)}` : ''}${o.perRound ? '/Round' : ''}`;
    case 'removeCondition': return `${L} ${o.name ?? '(au choix)'}`;
    case 'charMod': return `${L} ${o.mod >= 0 ? '+' : ''}${o.mod} ${CHAR_LABELS[o.char] ?? o.char}`;
    case 'skillMod': return `${L} ${o.mod >= 0 ? '+' : ''}${o.mod} ${o.skill}`;
    case 'moveMod': return `${L} ${o.mod >= 0 ? '+' : ''}${o.mod} Mouvement`;
    case 'apAll': return `${L} +${formulaSummary(o.amount)} PA`;
    case 'testMod': return `${L} ${o.amount >= 0 ? '+' : ''}${o.amount} aux Tests${o.char ? ` de ${CHAR_LABELS[o.char] ?? o.char}` : ''}`;
    case 'ignoreStatePenalties': return `${L} ignore les pénalités d’État`;
    case 'freeReroll': return `${L} relance gratuite`;
    case 'critTwice': return `${L} deux lancers de Critique`;
    case 'gainResource': return `${L} +${o.amount} ${o.resource === 'fate' ? 'Destin' : 'Chance'}${o.temporary ? ' (temp.)' : ''}`;
    case 'corruption': return `${L} ${o.amount >= 0 ? '+' : ''}${o.amount}`;
    case 'test': return `${L} ${o.skill} → ${o.onSuccess?.length ?? 0} si réussite / ${o.onFail.length} si échec`;
    case 'castPenalty': return `${L} ${o.blocked ? 'magie interdite' : o.maxZeroDR ? 'Prière plafonnée' : `${o.mod ?? 0} ${o.skill}`}`;
    case 'castWard': return `${L} −20 Langue, rayon ${formulaSummary(o.radius)} m`;
    case 'arrowWard': return `${L} rayon ${formulaSummary(o.radius)} m`;
    case 'domeWard': return `${L} rayon ${formulaSummary(o.radius)} m`;
    case 'attackWardFM': return `${L} l’attaquer exige un Test de FM`;
    case 'conjureWeapon': return `${L} ${o.name} (Dégâts ${o.plusBF ? 'BF+' : ''}${formulaSummary(o.damage)})`;
    case 'grantNaturalWeapon': return `${L} ${o.name} (${o.plusBF !== false ? 'BF+' : ''}${formulaSummary(o.damage)})`;
    case 'grantTrait': return `${L} ${o.trait}${o.indice != null ? ` ${formulaSummary(o.indice)}` : ''}`;
    case 'grantTalent': return `${L} ${o.talent}`;
    case 'enchantWeapon': return `${L} ${[...(o.addQualities ?? []), o.damageBonus != null ? `+${formulaSummary(o.damageBonus)} Dégâts` : ''].filter(Boolean).join(', ') || '(vide)'}`;
    case 'cureDisease': return `${L} ${o.count ?? 1} maladie(s)`;
    case 'reduceDiseaseDays': return `${L} −${o.days ?? 1} jour(s)`;
    case 'preventInfection': return `${L} pas d’infection`;
    case 'cureCriticalWound': return `${L} ${o.count ?? 1} critique(s)`;
    case 'suppressPsych': return `${L} Traits psy. apaisés`;
    case 'suffocate': return `${L} suffocation`;
    case 'noBreath': return `${L} plus besoin de respirer`;
    case 'noHunger': return `${L} plus besoin de manger`;
    case 'weatherWard': return `${L} immunité aux intempéries`;
    case 'damageArmour': return `${L} cuir −1 PA`;
    case 'reduceToZero': return `${L} Blessures à 0 (Inconscient)`;
    case 'martyr': return `${L} reçoit les Dégâts`;
    case 'giveTrapping': return `${L} ${o.count && o.count > 1 ? `${o.count}× ` : ''}${o.trapping}`;
    case 'perRound': return `${L} ${o.ops.length} op(s) chaque Round`;
    case 'summon': return `${L} ${formulaSummary(o.count)}× ${o.ref}${o.allyOfCaster === false ? ' (hostile)' : ''}`;
    case 'zone': return `${L} ${o.shape === 'wall' ? `mur ${formulaSummary(o.lengthMeters ?? 2)} m` : `disque ${formulaSummary(o.radiusMeters ?? 2)} m`}`;
    case 'polymorph': return `${L} ${o.ref}`;
    case 'lifeSteal': return `${L} ${o.num}/${o.den} des Dégâts`;
    case 'loseTurn': return `${L} saute le tour`;
    case 'rollThreshold': return `${L} 1d${o.sides} → ${o.thresholds.length} palier(s)`;
    case 'narrative': return `${L} ${o.text ? `« ${o.text.length > 40 ? `${o.text.slice(0, 39)}…` : o.text}` + ' »' : '(vide)'}`;
    default: return `⚙️ ${(o as GameOp).op}`;
  }
}

// ---------------------------------------------------------------------------
// Champs d'édition
// ---------------------------------------------------------------------------

/** Ops avec un éditeur DÉDIÉ ; toute autre op tombe sur le repli JSON (lisible/modifiable sans perte). */
const DEDICATED: ReadonlySet<GameOp['op']> = new Set([
  'wounds', 'heal', 'healCaster', 'condition', 'removeCondition', 'charMod', 'apAll', 'testMod',
  'corruption', 'gainResource', 'grantTrait', 'grantTalent', 'narrative',
  'summon', 'polymorph', 'lifeSteal',
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
        {(op.op === 'wounds' || op.op === 'heal' || op.op === 'healCaster' || op.op === 'apAll') && (
          <FormulaField label="Quantité" value={o.amount} min={0} onChange={(amount) => upd({ amount })} />
        )}
        {op.op === 'corruption' && (
          <label className="dr">Points<input type="number" value={o.amount ?? 1} onChange={(e) => upd({ amount: Number(e.target.value) || 0 })} /></label>
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
        {op.op === 'testMod' && (
          <label className="dr">Modif.<input type="number" value={o.amount ?? 0} onChange={(e) => upd({ amount: Number(e.target.value) || 0 })} /></label>
        )}
        {(op.op === 'condition' || op.op === 'removeCondition') && (
          <>
            <select value={o.name ?? ''} onChange={(e) => upd({ name: e.target.value || undefined })}>
              {op.op === 'removeCondition' && <option value="">— au choix (1er État) —</option>}
              {etats.map((s) => <option key={s.label} value={s.label}>{s.label}</option>)}
            </select>
            <FormulaField label="Intensité" value={o.value ?? 1} min={1} onChange={(value) => upd({ value })} />
            {op.op === 'condition' && (
              <label className="dr"><input type="checkbox" checked={!!o.perRound} onChange={(e) => upd({ perRound: e.target.checked || undefined })} /> chaque Round</label>
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
        {op.op === 'grantTrait' && (
          <>
            <input placeholder="Trait (ex. Peur, Armure)" value={o.trait ?? ''} onChange={(e) => upd({ trait: e.target.value })} />
            <label className="dr"><input type="checkbox" checked={o.indice != null} onChange={(e) => upd({ indice: e.target.checked ? 1 : undefined })} /> Indice</label>
            {o.indice != null && <FormulaField label="Valeur" value={o.indice} min={0} onChange={(indice) => upd({ indice })} />}
          </>
        )}
        {op.op === 'grantTalent' && (
          <input placeholder="Talent (ex. Sang-froid)" value={o.talent ?? ''} onChange={(e) => upd({ talent: e.target.value })} />
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
            <input placeholder="Traits ajoutés (ex. Frénésie, Magique)" value={(o.addTraits ?? []).join(', ')}
              onChange={(e) => { const a = e.target.value.split(',').map((t: string) => t.trim()).filter(Boolean); upd({ addTraits: a.length ? a : undefined }); }} />
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
        {op.op === 'narrative' && (
          <textarea placeholder="Texte journalisé (arbitrage MJ)" value={o.text ?? ''} onChange={(e) => upd({ text: e.target.value })} />
        )}
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
            <span className="eff-summary">{opSummary(o)}</span>
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
                  {OP_LABEL[k]}
                </button>
              ))}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
