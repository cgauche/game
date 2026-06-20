/**
 * Génère `src/data/maneuvers.json` (manœuvres de créature LDB 85 en GameOp AUTHORÉ) et recâble
 * `src/data/traits.json` des traits d'attaque naturelle de `maneuver` (profil en dur) vers
 * `grantsManeuvers` (`Ref[]` vers le nouveau dataset). One-off réutilisable (motif scripts/arene).
 *
 * Source unique de la RECHERCHE (RAW relu, `Source/Warhammer v4 - Livre de base version corrigée/
 * 85 - Traits de créature.md`). Sérialise au format canonique app-owned (JSON.stringify(.,null,2),
 * SANS newline final) — round-trip byte-fidèle (serialize.test).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'data');

// Helpers de construction d'effets onHit (Flow d'ops) — mêmes briques que les sorts.
const ops = (...o) => ({ type: 'ops', on: 'victim', ops: o });
const doOps = (...o) => ({ kind: 'do', effect: ops(...o) });
const seqOps = (...o) => ({ kind: 'seq', steps: o.map((x) => ({ kind: 'do', effect: ops(x) })) });
const onHit = (flow) => [{ trigger: 'onHit', on: 'victim', flow }];

const cond = (name, extra = {}) => ({ op: 'condition', name, ...extra });
/** Nœud de Flow `test` (« Test de X ou onFail ») — un Test imbriqué n'est PAS une op (`op:'test'` SUPPRIMÉE,
 *  Lot 4d) mais un nœud de la STRUCTURE Flow `{kind:'test'}`, résolu cadence-aware (héros = jet influençable,
 *  ennemi = inline) par `resolveFlowTest`. `onFail` = ops appliqués à la victime sur un échec. */
const testNode = (test, onFail) => ({ kind: 'test', test, success: { kind: 'seq', steps: [] }, fail: doOps(...onFail) });
const SRC = (page) => ({ book: 'LDB', page });

// Dégâts « Indice » d'une manœuvre (`{indiceOf}`) ; ignoreTB/ignoreAP pilotent la mitigation.
const indiceWounds = (extra = {}) => ({ op: 'wounds', amount: { indiceOf: true }, ...extra });

/** Les 6 Souffles élémentaires (LDB 85 l.249-269) : portée BE+20 m, zone BF m, jet CT/Esquive, magique.
 *  Un seul trait `Souffle` les octroie TOUS ; `creatureAttacks` choisit par norm(arg) (suffixe d'id). */
const SOUFFLE_BASE = {
  kind: 'souffle', activation: 'free', advantageCost: 2, stat: 'CT', defense: 'esquive',
  targeting: 'zone', range: 'Bonus d’Endurance + 20 mètres', blast: 'Bonus de Force mètres',
  magic: true, source: SRC(85),
};
const souffle = (id, label, effects, desc) => ({ id, label, ...SOUFFLE_BASE, effects, desc });

const MANEUVERS = [
  {
    id: 'arme', label: 'Arme / griffes', kind: 'arme', activation: 'action', advantageCost: 0,
    stat: 'CC', defense: 'auto', targeting: 'melee', effects: [],
    desc: 'Arme de Corps à corps (dents/griffes). Action normale. Dégâts = Indice (= 4 + Bonus de Force). LDB 85 l.338.',
    source: SRC(85),
  },
  {
    id: 'morsure', label: 'Morsure', kind: 'morsure', activation: 'free', advantageCost: 1,
    stat: 'CC', defense: 'auto', targeting: 'melee', effects: [],
    desc: 'Attaque gratuite en dépensant 1 Avantage. Dégâts = arme naturelle (Indice). LDB 85 l.171.',
    source: SRC(85),
  },
  {
    id: 'caudale', label: 'Attaque caudale', kind: 'caudale', activation: 'free', advantageCost: 1,
    stat: 'CC', defense: 'auto', targeting: 'melee',
    // Cible de TAILLE INFÉRIEURE qui perd des PB → À Terre (compare Taille acteur-vs-acteur).
    effects: onHit({
      kind: 'if',
      cond: { kind: 'compare', subject: { who: 'target', field: 'size' }, op: '<', value: { who: 'caster', field: 'size' } },
      then: doOps(cond('a-terre', { unlessCondition: 'a-terre' })),
    }),
    desc: 'Attaque gratuite (1 Avantage). Une cible plus petite qui perd des PB subit À Terre. LDB 85 l.38.',
    source: SRC(85),
  },
  {
    id: 'cornes', label: 'Cornes', kind: 'cornes', activation: 'charge', advantageCost: 0,
    stat: 'CC', defense: 'auto', targeting: 'melee', effects: [],
    desc: 'Attaque gratuite gagnée en CHARGEANT (pas de coût d’Avantage). Dégâts = Indice. LDB 85 l.65.',
    source: SRC(85),
  },
  {
    id: 'tentacules', label: 'Tentacules', kind: 'tentacules', activation: 'free', advantageCost: 0,
    stat: 'CC', defense: 'auto', targeting: 'melee',
    // Une Action d'Attaque gratuite PAR tentacule (coût 0) ; sur Dégâts → Empêtré (Force d'évasion = F).
    effects: onHit(doOps(cond('empetre', { escapeStrength: { charOf: 'F' }, unlessCondition: 'empetre' }))),
    desc: 'Une Attaque gratuite par tentacule (coût 0). Sur Dégâts → Empêtré (Force d’évasion = Force). LDB 85 l.355.',
    source: SRC(85),
  },
  {
    id: 'langue-prehensile', label: 'Langue préhensile', kind: 'langue', activation: 'free', advantageCost: 1,
    stat: 'CT', defense: 'esquive', targeting: 'ranged', range: 'Bonus d’Endurance mètres',
    // À distance : Dégâts Indice (mitigés BE+PA) puis Empêtré.
    effects: onHit(seqOps(
      indiceWounds({ ignoreTB: false, ignoreAP: false }),
      cond('empetre', { escapeStrength: { charOf: 'F' } }),
    )),
    desc: 'Attaque gratuite à distance (1 Avantage). Dégâts Indice + Empêtré. LDB 85 l.186/188.',
    source: SRC(85),
  },
  {
    id: 'etreinte-glaciale', label: 'Étreinte glaciale', kind: 'etreinte', activation: 'action', advantageCost: 2,
    stat: 'CC', defense: 'auto', targeting: 'melee', magic: true,
    // 1d10 + DR Blessures ignorant BE ET PA (attaque magique, coûte l'Action).
    effects: onHit(doOps(
      { op: 'wounds', amount: { dice: { n: 1, sides: 10 } }, perSL: { every: 1, amount: 1 }, ignoreTB: true, ignoreAP: true },
    )),
    desc: '2 Avantages + l’Action. Succès → 1d10 + DR Blessures ignorant BE et PA. Magique. LDB 85 l.112.',
    source: SRC(85),
  },
  {
    id: 'regard-petrifiant', label: 'Regard pétrifiant', kind: 'regard', activation: 'action', advantageCost: 1,
    stat: 'CT', defense: 'init', targeting: 'ranged', advantageMode: 'variable',
    // Marge ≥ 6 DR → Pétrifié + 0 PB ; sinon ≥ 2 DR → Sonné échelonné (1 par 2 DR). ctx.sl = marge.
    effects: onHit({
      kind: 'if',
      cond: { kind: 'slThreshold', op: '>=', value: 6 },
      then: seqOps({ op: 'condition', name: 'petrifie' }, { op: 'reduceToZero' }),
      else: {
        kind: 'if',
        cond: { kind: 'slThreshold', op: '>=', value: 2 },
        then: doOps({ op: 'condition', name: 'sonne', value: 0, valuePerSL: { every: 2, amount: 1 } }),
      },
    }),
    desc: 'Action, +1 DR par Avantage. Marge ≥ 6 DR → Pétrifié (0 PB) ; ≥ 2 DR → Sonné (1 par 2 DR). LDB 85 l.238.',
    source: SRC(85),
  },
  souffle('souffle-feu', 'Souffle (Feu)',
    onHit(seqOps(indiceWounds({ ignoreTB: false, ignoreAP: true }), cond('en-flammes'))),
    'Zone, jet CT/Esquive. Dégâts Indice (ignore PA) + En flammes. LDB 85 l.249-269.'),
  souffle('souffle-froid', 'Souffle (Froid)',
    // NOTE RAW: "1 Sonné par 5 PB" non exprimable (pas de condition mise à l'échelle par PB) → Sonné forfaitaire.
    onHit(seqOps(indiceWounds({ ignoreTB: false, ignoreAP: false }), cond('sonne'))),
    'Zone, jet CT/Esquive. Dégâts Indice + Sonné (RAW : 1 Sonné/5 PB → forfaitaire). LDB 85 l.249-269.'),
  souffle('souffle-corrosif', 'Souffle (Corrosif)',
    // Corrosion via damageArmour=cuir seul. NOTE RAW: corrosion toute matière non modélisée.
    onHit(seqOps(indiceWounds({ ignoreTB: false, ignoreAP: false }), cond('sonne'), { op: 'damageArmour', material: 'cuir' })),
    'Zone, jet CT/Esquive. Dégâts Indice + Sonné + corrosion (cuir seul, RAW : toute matière). LDB 85 l.249-269.'),
  souffle('souffle-electrique', 'Souffle (Électrique)',
    onHit(seqOps(indiceWounds({ ignoreTB: false, ignoreAP: true }), cond('sonne'))),
    'Zone, jet CT/Esquive. Dégâts Indice (ignore PA) + Sonné. LDB 85 l.249-269.'),
  souffle('souffle-poison', 'Souffle (Poison)',
    onHit(seqOps(indiceWounds({ ignoreTB: false, ignoreAP: true }), cond('empoisonne'))),
    'Zone, jet CT/Esquive. Dégâts Indice (ignore PA) + Empoisonné. LDB 85 l.249-269.'),
  souffle('souffle-fumee', 'Souffle (Fumée)',
    // La zone de fumée (blocksLoS, BE Rounds) RESTE géométrie moteur (pas un GameOp).
    [],
    'Zone : la fumée bloque les Lignes de vue pendant Bonus d’Endurance Rounds (géométrie moteur). LDB 85 l.249-269.'),
  {
    id: 'vomissement', label: 'Vomissement', kind: 'vomi', activation: 'free', advantageCost: 3,
    stat: 'CT', defense: 'esquive', targeting: 'zone', range: 'Bonus d’Endurance mètres', blast: '2 mètres',
    // Dégâts = BE + 4 + Sonné + corrosion (cuir). Facile (+40) à courte distance — porté par le résolveur.
    effects: onHit(seqOps(
      { op: 'wounds', amount: { bonusOf: 'E' }, ignoreTB: false, ignoreAP: false },
      { op: 'wounds', amount: 4, ignoreTB: false, ignoreAP: false },
      cond('sonne'),
      { op: 'damageArmour', material: 'cuir' },
    )),
    desc: 'Zone (3 Avantages). Dégâts BE+4 + Sonné + corrosion (cuir). LDB 85 l.374-378.',
    source: SRC(85),
  },
  {
    id: 'hurlement-fantomatique', label: 'Hurlement fantomatique', kind: 'hurlement', activation: 'free', advantageCost: 2,
    targeting: 'allFoes', defense: 'resist', advantageMode: 'all',
    // PAS de jet d'attaquant : chaque cible vivante (≠ Mort-vivant, filtré moteur) subit 1d10 ignore BE+PA,
    // un Test de Résistance (nœud Flow `test` cadence-aware) ou Brisé, + 3 Assourdi. Le Test est un nœud de
    // STRUCTURE Flow `{kind:'test'}` (plus une op `test` — supprimée Lot 4d) → `seq[ do{wounds}, test, do{assourdi} ]`.
    effects: onHit({
      kind: 'seq',
      steps: [
        doOps({ op: 'wounds', amount: { dice: { n: 1, sides: 10 } }, ignoreTB: true, ignoreAP: true }),
        testNode({ skill: 'resistance', difficulty: 'accessible' }, [cond('brise')]),
        doOps(cond('assourdi', { value: 3 })),
      ],
    }),
    desc: 'Tous les ennemis vivants à Initiative mètres : 1d10 (ignore BE+PA) + Test de Résistance ou Brisé + 3 Assourdi. LDB 85 l.136.',
    source: SRC(85),
  },
];

// ── Octrois par trait (un trait d'attaque naturelle → ses manœuvres). Souffle octroie les 6 élémentaires.
const SOUFFLE_IDS = ['souffle-feu', 'souffle-froid', 'souffle-corrosif', 'souffle-electrique', 'souffle-poison', 'souffle-fumee'];
const GRANTS = {
  Arme: ['arme'],
  Morsure: ['morsure'],
  'Attaque caudale': ['caudale'],
  Cornes: ['cornes'],
  Tentacules: ['tentacules'],
  'Langue préhensile': ['langue-prehensile'],
  'Étreinte glaciale': ['etreinte-glaciale'],
  'Regard pétrifiant': ['regard-petrifiant'],
  Souffle: SOUFFLE_IDS,
  Vomissement: ['vomissement'],
  'Hurlement fantomatique': ['hurlement-fantomatique'],
};

function serialize(value) {
  return JSON.stringify(value, null, 2);
}

// 1) maneuvers.json
writeFileSync(join(DATA, 'maneuvers.json'), serialize(MANEUVERS));

// 2) traits.json : maneuver → grantsManeuvers (ordre des clés : on supprime `maneuver`, on ajoute grants).
const traits = JSON.parse(readFileSync(join(DATA, 'traits.json'), 'utf8'));
let migrated = 0;
for (const t of traits) {
  if (!('maneuver' in t)) continue;
  delete t.maneuver;
  const grants = GRANTS[t.label];
  if (grants) { t.grantsManeuvers = grants.map((id) => ({ id })); migrated++; }
}
writeFileSync(join(DATA, 'traits.json'), serialize(traits));

console.log(`maneuvers.json : ${MANEUVERS.length} manœuvres`);
console.log(`traits.json : ${migrated} traits migrés maneuver→grantsManeuvers`);
