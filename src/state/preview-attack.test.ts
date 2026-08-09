import { describe, it, expect } from 'vitest';
import { previewAttack, resolveAttack, eligibleAttackTargetIds, outOfSightTargetIds, attackPlan, resolveDualSecond } from './combatFlow';
import { attackModifiers, combatBaseValue, combatValue, combineMods, type ModLine } from '../engine/combat';
import { clampTarget } from '../engine/tests';
import { setRule, resetRule } from '../engine/policy';
import { volatileCharLines } from '../engine/characteristics';
import { traumaById, dechirureFractureFicheId } from '../engine/trauma';
import { inexplique } from './cascadeTestKit';
import { seedBattleRng } from './battleRng';
import type { Combatant } from '../engine/types';
import type { GameState } from './store';
import type { Scene } from './scene';

/**
 * LOT 3 (R4) — `previewAttack` rejoue le MÊME env + modificateurs que la résolution, sans tirer le dé :
 * l'aperçu affiché AVANT « Lancer » ne doit jamais mentir (parité aperçu↔jet).
 */
const combatant = (over: Partial<Combatant>): Combatant =>
  ({
    id: 'A', label: 'A', kind: 'hero',
    characteristics: { 'capacite-de-combat': 50, 'capacite-de-tir': 50, force: 35, endurance: 35, initiative: 30, agilite: 35, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 14, max: 14 }, advantage: 0, conditions: [],
    weapons: [{ label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, reach: 'Moyenne', qualities: [] }],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, bodyShape: 'humanoide', pos: { x: 0, y: 0 },
    ...over,
  }) as unknown as Combatant;

const scene = (): Scene =>
  ({ id: 's', name: 's', dimensions: { w: 8, h: 8 }, ambiance: 'jour', layers: [{ z: 0, tiles: new Array(64).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [] }) as unknown as Scene;

// Mode local : l'actif héros est piloté à la main (`controlsCombatant` → surfaçage des cibles éligibles).
const NET_LOCAL = { mode: 'local', mySeat: 0, ownership: {}, slots: [0, 0, 0, 0] };
const mkGet = (combatants: Combatant[]): (() => GameState) =>
  (() => ({ scene: scene(), battle: { combatants, movementUsed: 0 }, facing: {}, gameTime: 0, log: () => {}, net: NET_LOCAL })) as unknown as () => GameState;

describe('previewAttack — parité aperçu ↔ résolution (R4)', () => {
  it('la valeur de toucher prévue == la cible du jet réellement résolu', () => {
    const a = combatant({ id: 'A', advantage: 1 });
    const b = combatant({ id: 'B', kind: 'enemy', pos: { x: 1, y: 0 } });
    const get = mkGet([a, b]);
    const preview = previewAttack(get, a, b);
    expect(preview.inRange).toBe(true);
    seedBattleRng(1);
    const r = resolveAttack(get, a, b);
    expect(r).not.toBeNull();
    expect(preview.target).toBe(r!.res.attackerDetail!.target); // l'aperçu ne ment pas
  });

  it('estimation de dégâts : dmg = arme + Force, soak = Endurance + PA', () => {
    const a = combatant({ id: 'A' }); // F 35 → BF 3 ; Épée +BF+4 → 7
    const b = combatant({ id: 'B', kind: 'enemy', pos: { x: 1, y: 0 }, armour: { tete: 0, brasG: 0, brasD: 0, corps: 2, jambeG: 0, jambeD: 0 } as never }); // E 35 → BE 3, PA corps 2
    const p = previewAttack(mkGet([a, b]), a, b, 'corps');
    expect(p.dmg).toBe(7);
    expect(p.soak).toBe(5); // BE 3 + PA 2
  });

  it('mêlée hors de portée (au-delà de l’Allonge) → inRange false', () => {
    const a = combatant({ id: 'A', pos: { x: 0, y: 0 } });
    const b = combatant({ id: 'B', kind: 'enemy', pos: { x: 5, y: 0 } });
    expect(previewAttack(mkGet([a, b]), a, b).inRange).toBe(false);
  });

  it('le surnombre (2 contre 1) augmente la valeur de toucher prévue de +20 (LDB 14 l.92)', () => {
    const a = combatant({ id: 'A', pos: { x: 0, y: 0 } });
    const b = combatant({ id: 'B', kind: 'enemy', pos: { x: 1, y: 0 } });
    const ally = combatant({ id: 'A2', pos: { x: 1, y: 1 } }); // 2e attaquant au contact de B
    const solo = previewAttack(mkGet([a, b]), a, b).target;
    const duo = previewAttack(mkGet([a, ally, b]), a, b).target;
    expect(duo - solo).toBe(20);
  });

  it('choix d’arme : previewAttack(weaponUid) prend l’arme choisie + applique le -20 main secondaire, parité résolution', () => {
    const a = combatant({ id: 'A', pos: { x: 0, y: 0 }, weapons: [
      { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, reach: 'Moyenne', qualities: [], hand: 'main', hands: 1, uid: 'm' },
      { label: 'Dague', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, reach: 'Très courte', qualities: [], hand: 'off', hands: 1, uid: 'o' },
    ] as never });
    const b = combatant({ id: 'B', kind: 'enemy', pos: { x: 1, y: 0 } });
    const get = mkGet([a, b]);
    const main = previewAttack(get, a, b); // auto → Épée (main), aucune pénalité
    expect(main.weapon.label).toBe('Épée');
    expect(main.mods.some((m) => m.label === 'Main secondaire')).toBe(false);
    const off = previewAttack(get, a, b, undefined, { weaponUid: 'o' }); // Dague (main secondaire) → -20
    expect(off.weapon.label).toBe('Dague');
    expect(off.mods.find((m) => m.label === 'Main secondaire')?.value).toBe(-20);
    seedBattleRng(2);
    const r = resolveAttack(get, a, b, undefined, undefined, undefined, undefined, 'o');
    expect(r!.weapon.label).toBe('Dague'); // parité : la résolution utilise la même arme choisie
  });

  it('eligibleAttackTargetIds : seuls les ennemis vivants à portée sont éligibles', () => {
    const a = combatant({ id: 'A', pos: { x: 0, y: 0 } }); // épée, Allonge Moyenne = 1 case
    const near = combatant({ id: 'E1', kind: 'enemy', pos: { x: 1, y: 0 } }); // adjacent → éligible
    const far = combatant({ id: 'E2', kind: 'enemy', pos: { x: 5, y: 0 } }); // hors de portée → non
    const dead = combatant({ id: 'E3', kind: 'enemy', pos: { x: 1, y: 1 }, wounds: { current: 0, max: 10 } as never }); // mort → non
    const get = (() => ({ scene: scene(), battle: { combatants: [a, near, far, dead], order: ['A', 'E1', 'E2', 'E3'], turn: 0, movementUsed: 0 }, facing: {}, gameTime: 0, log: () => {}, net: NET_LOCAL })) as unknown as () => GameState;
    const ids = eligibleAttackTargetIds(get);
    expect(ids.has('E1')).toBe(true);
    expect(ids.has('E2')).toBe(false);
    expect(ids.has('E3')).toBe(false);
  });

  it('tir sans Ligne de Vue → blocked', () => {
    const a = combatant({ id: 'A', pos: { x: 0, y: 0 }, weapons: [{ label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 8 }, range: 60, qualities: [] }] as never });
    const b = combatant({ id: 'B', kind: 'enemy', pos: { x: 6, y: 0 } });
    const s = scene();
    (s.layers[0].tiles as string[])[3] = 'mur'; // mur intercalé sur la ligne (x=3,y=0)
    const get = (() => ({ scene: s, battle: { combatants: [a, b], movementUsed: 0 }, facing: {}, gameTime: 0, log: () => {} })) as unknown as () => GameState;
    expect(previewAttack(get, a, b).blocked).toBe(true);
  });

  it('outOfSightTargetIds (grisage hors-LdV) : ennemi derrière un mur grisé au tir, pas en mêlée, pas les morts', () => {
    const s = scene();
    (s.layers[0].tiles as string[])[3] = 'mur'; // mur sur la ligne y=0 entre x=0 et x=6
    const archer = combatant({ id: 'A', pos: { x: 0, y: 0 }, weapons: [{ label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 8 }, range: 60, qualities: [] }] as never });
    const hidden = combatant({ id: 'E1', kind: 'enemy', pos: { x: 6, y: 0 } }); // derrière le mur
    const seen = combatant({ id: 'E2', kind: 'enemy', pos: { x: 0, y: 5 } }); // ligne dégagée
    const deadHidden = combatant({ id: 'E3', kind: 'enemy', pos: { x: 6, y: 1 }, wounds: { current: 0, max: 10 } as never });
    const mk = (cs: Combatant[], order: string[]) =>
      (() => ({ scene: s, battle: { combatants: cs, order, turn: 0, movementUsed: 0 }, facing: {}, gameTime: 0, log: () => {}, net: NET_LOCAL })) as unknown as () => GameState;
    const ids = outOfSightTargetIds(mk([archer, hidden, seen, deadHidden], ['A', 'E1', 'E2', 'E3']));
    expect(ids.has('E1')).toBe(true);
    expect(ids.has('E2')).toBe(false);
    expect(ids.has('E3')).toBe(false);
    // En mêlée la LdV ne bloque pas le ciblage → aucun grisage.
    const swordsman = combatant({ id: 'A', pos: { x: 0, y: 0 } });
    expect(outOfSightTargetIds(mk([swordsman, hidden, seen], ['A', 'E1', 'E2'])).size).toBe(0);
  });

  it('décomposition : target = base NUE + Σ mods (somme BRUTE — le plafond a sa propre ligne)', () => {
    const a = combatant({ id: 'A', advantage: 1 });
    const b = combatant({ id: 'B', kind: 'enemy', pos: { x: 1, y: 0 } });
    const p = previewAttack(mkGet([a, b]), a, b);
    // La somme est BRUTE depuis #1153 L3a : re-combiner (`combineMods`) amputerait la ligne de plafond
    // que l'aperçu vient d'émettre. C'est `inexplique === 0` qui juge, comme partout ailleurs.
    expect(inexplique({ base: p.base, mods: p.mods, target: p.target, difficulty: p.difficulty })).toBe(0);
    expect(p.base, 'base = valeur de combat NUE').toBe(combatBaseValue(a, 'melee', p.weapon));
    expect(p.base).toBe(50); // CC 50, pas de Spé
  });

  it('issue #202 — buff de Caractéristique (Bénédiction de Bataille +10 CC) : target INCHANGÉ, base amputé, ligne étiquetée uncapped', () => {
    const a = combatant({ id: 'A', activeEffects: [{ label: 'Bénédiction de Bataille', char: 'capacite-de-combat', bonus: 10 }] as never });
    const b = combatant({ id: 'B', kind: 'enemy', pos: { x: 1, y: 0 } });
    const withoutBuff = previewAttack(mkGet([combatant({ id: 'A' }), b]), combatant({ id: 'A' }), b);
    const withBuff = previewAttack(mkGet([a, b]), a, b);
    expect(withBuff.target).toBe(withoutBuff.target + 10); // le buff reste bien PORTÉ au jet (byte-identique à l'avant-split)
    expect(withBuff.base).toBe(withoutBuff.base); // le +10 est sorti de `base` vers une ModLine
    expect(inexplique({ base: withBuff.base, mods: withBuff.mods, target: withBuff.target, difficulty: withBuff.difficulty })).toBe(0);
    const line = withBuff.mods.find((m) => m.label === 'Bénédiction de Bataille');
    expect(line).toEqual({ label: 'Bénédiction de Bataille', value: 10, uncapped: true });
  });
});

/**
 * #1153 L3a — l'aperçu affiche la cible que `rollTest` jettera. Deux grandeurs y sont confrontées :
 * la cible NON ÉCRÊTÉE (`combatValue + combineMods(mods)`, la somme combinée seule) et la cible
 * RENDUE — leur écart est l'amputation du plafond des Difficultés, portée par sa propre ligne, plus
 * la borne `targetMax` de `clampTarget`.
 */
const cibleNonEcretee = (a: Combatant, kind: 'melee' | 'ranged', w: Combatant['weapons'][number], mods: ModLine[]): number =>
  combatValue(a, kind, w) + combineMods(mods);

describe('previewAttack — plafond des Difficultés NOMMÉ et cible écrêtée (#1153 L3a)', () => {
  const foe = () => combatant({ id: 'B', kind: 'enemy', pos: { x: 1, y: 0 } });
  const hors = (p: { mods: ModLine[] }) => p.mods.filter((m) => m.label !== 'plafond Difficultés');

  it('NOMINAL (aucun plafond, aucune borne) : la cible rendue EST la cible non écrêtée', () => {
    const a = combatant({ id: 'A', advantage: 1 });
    const b = foe();
    const p = previewAttack(mkGet([a, b]), a, b);
    expect(p.target).toBe(cibleNonEcretee(a, 'melee', p.weapon, hors(p)));
    expect(p.mods.some((m) => m.label === 'plafond Difficultés')).toBe(false);
    expect(p.clamped).toBeUndefined();
  });

  it('MALUS mordant : cible INCHANGÉE, mais l’amputation cesse d’être un résidu muet', () => {
    // Deux sources INDÉPENDANTES : l'État Aveuglé (−20 ; le pool d'États est non-cumul, LDB 16 l.20)
    // et la Maladresse du Round précédent (−20). Σ = −40 → plafonné à −30.
    const a = combatant({ id: 'A', conditions: [{ id: 'aveugle', value: 2 }] as never, nextActionPenalty: 20 } as never);
    const b = foe();
    const p = previewAttack(mkGet([a, b]), a, b);
    const chips = hors(p);
    const somme = chips.reduce((s, m) => s + m.value, 0);
    const combine = combineMods(chips);
    expect(combine, 'la fixture doit VRAIMENT franchir le plafond des malus').not.toBe(somme);

    expect(p.target, 'la cible ne bouge pas d’un point').toBe(cibleNonEcretee(a, 'melee', p.weapon, chips));
    // Sans la ligne de plafond, l'écart base→cible reste inexpliqué de tout le montant amputé —
    // c'est exactement ce que `RollLine` avouerait en chip « autres ».
    expect(inexplique({ base: p.base, mods: chips, target: p.target, difficulty: p.difficulty })).toBe(combine - somme);
    expect(p.mods.find((m) => m.label === 'plafond Difficultés')?.value).toBe(combine - somme);
    expect(inexplique({ base: p.base, mods: p.mods, target: p.target, difficulty: p.difficulty })).toBe(0);
  });

  it('BORNE : l’Avantage hors plafond ne promet plus une cible > 99 que le jet n’atteindra jamais', () => {
    const a = combatant({ id: 'A', advantage: 6 }); // CC 50 + 60 hors plafond = 110
    const b = foe();
    const p = previewAttack(mkGet([a, b]), a, b);
    const nonEcretee = cibleNonEcretee(a, 'melee', p.weapon, hors(p));
    expect(nonEcretee, 'la fixture doit franchir la borne — sinon le test ne mesure rien').toBe(110);
    expect(p.target).toBe(clampTarget(nonEcretee).target);
    expect(p.target).toBe(99);
    expect(p.clamped, 'écrêtage MESURÉ → la chip « plafond 99 » devient nommable').toBe(-11);
    expect(inexplique({ base: p.base, mods: p.mods, target: p.target, difficulty: p.difficulty, clamped: p.clamped })).toBe(0);
  });

  it('la BORNE suit la POLICY : « Tests supérieurs à 100 % » (LDB 12 l.73-77) active ⇒ cible 110, aucun écrêtage', () => {
    // La borne n'est pas un nombre en dur du monteur : `clampTarget` lit `targetMax`, que la règle
    // optionnelle `test-over-100` porte à 999 (`engine/testPolicy.ts`). Le même aperçu rend alors la
    // cible entière, et le DR gagne ses tranches au-delà de 100 (LDB 12 l.77).
    const a = combatant({ id: 'A', advantage: 6 });
    const b = foe();
    setRule('test-over-100', true);
    try {
      const p = previewAttack(mkGet([a, b]), a, b);
      expect(p.target).toBe(110);
      expect(p.clamped).toBeUndefined();
      expect(inexplique({ base: p.base, mods: p.mods, target: p.target, difficulty: p.difficulty })).toBe(0);
    } finally {
      resetRule('test-over-100');
    }
  });

  /**
   * SONDE PROMUE (#1153 L3a) — les DEUX lignes volatiles de Caractéristique du pool non-cumul
   * (meilleur bonus ET pire pénalité, `volatileCharLines`) sur un vrai `Combatant` : un buff magique
   * et une SÉQUELLE réelle (`traumaById`), sur une arme à Résolution ALTERNATIVE (`resolveChar`,
   * ADE II 8 l.233) pour que la carac du jet soit celle que la séquelle frappe. Elles vivent DANS
   * `combatBaseValue` (via `effectiveChar`) : les afficher sans les retirer de la base doublerait le
   * compte, et leur ligne doit porter le nom de SON octroyeur, jamais un libellé de famille partagé.
   */
  it('POOL non-cumul : buff ET séquelle sortent de la base en lignes DISTINCTES, cible intacte', () => {
    const trauma = traumaById(dechirureFractureFicheId('fracture', 'majeur', 'corps'), undefined, 'corps');
    const belier = { label: 'Bélier', type: 'melee', damage: { plusBF: true, flat: 4 }, reach: 'Moyenne', qualities: [], resolveChar: 'force' } as never;
    const a = combatant({
      id: 'A', weapons: [belier], traumas: [trauma] as never,
      activeEffects: [{ label: 'Bénédiction de Bataille', char: 'force', bonus: 10 }] as never,
    } as never);
    const b = foe();
    const lignes = volatileCharLines(a, 'force');
    expect(lignes.map((l) => l.value), 'la fixture doit produire LES DEUX lignes du pool').toEqual([10, -30]);

    const p = previewAttack(mkGet([a, b]), a, b);
    expect(p.weapon.label, 'l’aperçu doit bien tirer l’arme à Résolution alternative').toBe('Bélier');
    expect(p.base, 'les deux lignes sont SORTIES de la base').toBe(combatBaseValue(a, 'melee', belier) + 20);
    // La ligne REBASÉE se recolle à la grandeur du moteur : valeur de combat FONDUE (les volatiles
    // dedans) + les seuls modificateurs SITUATIONNELS combinés. Les lignes du pool ne sont donc
    // comptées qu'une fois — les verser dans `combineMods` les compterait deux.
    const noms = new Set(lignes.map((l) => l.label));
    const situationnels = p.mods.filter((m) => !noms.has(m.label) && m.label !== 'plafond Difficultés');
    expect(p.base + p.mods.reduce((s, m) => s + m.value, 0))
      .toBe(combatValue(a, 'melee', belier) + combineMods(situationnels));
    const labels = p.mods.map((m) => m.label);
    expect(new Set(labels).size, 'aucun libellé dupliqué : chaque composante nomme SON octroyeur').toBe(labels.length);
    expect(labels).toContain('Bénédiction de Bataille');
    expect(labels).toContain(trauma.label);
    expect(inexplique({ base: p.base, mods: p.mods, target: p.target, difficulty: p.difficulty })).toBe(0);
  });
});

describe('resolveDualSecond — la 2ᵉ frappe vise la cible que le moteur jetterait (#1153 L3a)', () => {
  it('BORNE : la cible de la 2ᵉ frappe est écrêtée à 99 comme tout autre jet (`rollTest`)', () => {
    const a = combatant({ id: 'A', advantage: 6, weapons: [
      { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, reach: 'Moyenne', qualities: [], hand: 'main', hands: 1, uid: 'm' },
      { label: 'Dague', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, reach: 'Très courte', qualities: [], hand: 'main', hands: 1, uid: 'o' },
    ] as never });
    const b = combatant({ id: 'B', kind: 'enemy', pos: { x: 1, y: 0 }, weapons: [] as never });
    const off = a.weapons[1];
    seedBattleRng(7);
    const res = resolveDualSecond(mkGet([a, b]), a, b, off, 50, { critValue: 30 });
    const avant = cibleNonEcretee(a, 'melee', off, attackModifiers(a, b, off, { kind: 'melee' }));
    expect(avant, 'la fixture franchit la borne').toBe(110);
    expect(res.attackerDetail!.target, 'la 2ᵉ frappe est bornée comme les autres jets').toBe(99);
  });

  it('PLAFOND : la 2ᵉ frappe subit −30 (combinés), jamais la somme brute −40', () => {
    const a = combatant({ id: 'A', conditions: [{ id: 'aveugle', value: 2 }] as never, nextActionPenalty: 20, weapons: [
      { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, reach: 'Moyenne', qualities: [], hand: 'main', hands: 1, uid: 'm' },
      { label: 'Dague', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, reach: 'Très courte', qualities: [], hand: 'main', hands: 1, uid: 'o' },
    ] as never } as never);
    const b = combatant({ id: 'B', kind: 'enemy', pos: { x: 1, y: 0 }, weapons: [] as never });
    const off = a.weapons[1];
    const mods = attackModifiers(a, b, off, { kind: 'melee' });
    const somme = mods.reduce((s, m) => s + m.value, 0);
    expect(somme, 'les deux sources somment −40 brut').toBe(-40);
    expect(combineMods(mods), 'le plafond des malus les ramène à −30').toBe(-30);

    seedBattleRng(7);
    const res = resolveDualSecond(mkGet([a, b]), a, b, off, 50, { critValue: 30 });
    expect(res.attackerDetail!.target).toBe(combatValue(a, 'melee', off) - 30);
  });
});

describe('attackPlan — gate PRÉ-clic du tir (parité avec le refus de sort)', () => {
  // Arc de Portée 4 m : bande Extrême ≤ ×3 = 12 m = 6 cases (1 case = 2 m).
  const archer = (over: Partial<Combatant> = {}) =>
    combatant({ id: 'A', pos: { x: 0, y: 0 }, weapons: [{ label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 8 }, range: 4, qualities: [] }] as never, ...over });

  it('cible sans Ligne de Vue → blocked (la modale ne s’ouvre jamais)', () => {
    const a = archer();
    const b = combatant({ id: 'B', kind: 'enemy', pos: { x: 6, y: 0 } });
    const s = scene();
    (s.layers[0].tiles as string[])[3] = 'mur';
    const get = (() => ({ scene: s, battle: { combatants: [a, b], movementUsed: 0 }, facing: {}, gameTime: 0, log: () => {} })) as unknown as () => GameState;
    const plan = attackPlan(get, a, b);
    expect(plan.kind).toBe('blocked');
    expect((plan as { reason: string }).reason).toMatch(/ligne de vue/i);
  });

  it('au-delà de Portée ×3 → blocked « hors de portée » ; à exactement ×3 → attack', () => {
    const a = archer();
    const far = combatant({ id: 'B', kind: 'enemy', pos: { x: 7, y: 0 } }); // 14 m > 12 m
    const edge = combatant({ id: 'C', kind: 'enemy', pos: { x: 6, y: 0 } }); // 12 m = Extrême
    const get = mkGet([a, far, edge]);
    const out = attackPlan(get, a, far);
    expect(out.kind).toBe('blocked');
    expect((out as { reason: string }).reason).toMatch(/hors de portée/i);
    expect(attackPlan(get, a, edge).kind).toBe('attack');
  });
});
