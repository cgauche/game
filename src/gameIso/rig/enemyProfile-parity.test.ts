import { describe, it, expect } from 'vitest';
import { enemyRigProfile, entityRigProfile } from './enemyProfile';
import { eyesArtFromKeys } from './parts/eyes';
import type { Combatant, Weapon, ArmourPoints } from '../../engine/types';

/**
 * CARACTÉRISATION (golden) du MERGE d'apparence rig — capture la sortie ACTUELLE de `enemyRigProfile`
 * et `entityRigProfile` sur une matrice couvrant chaque chemin de précédence (base / record créature /
 * override d'instance / tenue). But : prouver que l'unification du merge (un seul `rigAppearance`) reste
 * BYTE-À-BYTE identique. On snapshote `appearance` + `tenue` seulement (l'équipement n'est PAS refactoré
 * et porte des uid aléatoires). Si un champ bouge après refactor, le diff vitest le pointe.
 */
const noArmour: ArmourPoints = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };
function mk(id: string, name: string, over: Partial<Combatant> = {}): Combatant {
  return {
    id, name, kind: 'enemy', characteristics: {} as Combatant['characteristics'],
    wounds: { current: 10, max: 10 }, advantage: 0, conditions: [],
    weapons: [{ name: 'Épée', type: 'melee', damage: '+4', qualities: [] } as Weapon],
    armour: { ...noArmour }, skills: [], talents: [], movement: 4, ...over,
  } as Combatant;
}
const artEyes = eyesArtFromKeys({ G: 'reptilien', D: 'noir' }); // yeux RÉSOLUS (comme `c.appearance` au spawn)

const ENEMY_CASES: [string, Combatant][] = [
  ['humain-nu', mk('en1', 'Soldat')],
  ['species-orc', mk('en2', 'x', { species: 'Orc' })],
  ['species-gobelin', mk('en3', 'x', { species: 'Gobelin' })],
  ['species-skaven', mk('en4', 'x', { species: 'Guerrier des clans' })],
  ['override-sex-build', mk('en5', 'Soldat', { appearance: { sex: 'F', build: 0.7 } as never })],
  ['override-monster', mk('en6', 'Soldat', { appearance: { monster: { tete: 'lezard' } } as never })],
  ['override-colors-parts', mk('en7', 'Soldat', { appearance: { colors: { peau: '#112233' }, parts: { hair: 3 } } as never })],
  ['override-eyes', mk('en8', 'Soldat', { appearance: { eyes: artEyes } as never })],
  ['override-gabarit', mk('en9', 'Soldat', { appearance: { gabarit: 'brute-bras-longs' } as never })],
  ['career-tenue', mk('en10', 'Cultiste', { career: 'Flagellant' })],
];

const ENTITY_CASES: [string, string, number, Record<string, unknown> | undefined][] = [
  ['humain-nu', 'Soldat', 42, undefined],
  ['species-orc', 'x', 42, { species: 'Orc' }],
  ['species-gobelin', 'x', 42, { species: 'Gobelin' }],
  ['species-skaven', 'x', 42, { species: 'Guerrier des clans' }],
  ['override-sex-build', 'Soldat', 42, { sex: 'F', build: 0.7 }],
  ['override-monster', 'Soldat', 42, { monster: { tete: 'lezard' } }],
  ['override-colors-parts', 'Soldat', 42, { colors: { peau: '#112233' }, parts: { hair: 3 } }],
  ['override-eyes', 'Soldat', 42, { eyes: { G: 'reptilien', D: 'noir' } }],
  ['override-features', 'Soldat', 42, { features: ['barbe'] }],
  ['tenue', 'Villageois', 42, { tenue: 'Mendiant' }],
];

// On teste la parité des VALEURS, pas la forme de l'objet : l'ORDRE des clés (diffère entre builders) et
// la PRÉSENCE d'une clé à `undefined` (`monster`/`features` que l'ancien combat omettait) sont
// sémantiquement NEUTRES — le rig lit par nom, `appearance.x` vaut `undefined` clé présente ou absente.
const byKey = (o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)));

describe('CARACTÉRISATION — apparence rig (parité avant/après unification du merge)', () => {
  for (const [label, c] of ENEMY_CASES) {
    it(`enemyRigProfile · ${label}`, () => {
      const p = enemyRigProfile(c)!;
      expect({ appearance: byKey(p.appearance as never), tenue: p.tenue }).toMatchSnapshot();
    });
  }
  for (const [label, name, seed, opts] of ENTITY_CASES) {
    it(`entityRigProfile · ${label}`, () => {
      const p = entityRigProfile(name, seed, opts as never)!;
      expect({ appearance: byKey(p.appearance as never), tenue: p.tenue }).toMatchSnapshot();
    });
  }
});
