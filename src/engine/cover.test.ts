/**
 * BIJECTION couvert ⇄ Difficulté (`engine/cover.ts`). Le canon dit la même chose deux fois : la table
 * de difficulté du combat nomme le couvert par un ÉTALON d'objet (`LDB 14 l.72/81/86`), le « Tableau
 * des Structures Courantes » par la DIFFICULTÉ qu'un assaillant subit (`AA 10 l.23`, colonne l.28-51).
 * Ce fichier verrouille que les deux graphies sont la MÊME échelle : quatre rangs, un pour un, et le
 * même modificateur de chaque côté (`coverModifier` ⇄ `DIFFICULTY_MODIFIERS`) — l'égalité des barèmes
 * EST la réciproque, aucune fonction de retour n'a besoin d'exister pour l'affirmer.
 */
import { describe, it, expect } from 'vitest';
import { couvertDepuisDifficulte, coverModifier, couvertLePlusProtecteur, cranDeCouvertEnMoins } from './cover';
import { COUVERT_DIFFICULTES, DIFFICULTY_MODIFIERS, type CoverClass } from './types';

/** Les quatre classes, dans le même ordre croissant que `COUVERT_DIFFICULTES`. */
const CLASSES: readonly CoverClass[] = ['none', 'imparfaite', 'moyenne', 'totale'];

describe('couvert ⇄ Difficulté — bijection sur les 4 rangs', () => {
  it('Difficulté → couvert : les 4 rangs, un pour un', () => {
    expect(COUVERT_DIFFICULTES.map(couvertDepuisDifficulte)).toEqual([...CLASSES]);
  });

  it('INJECTIVE : quatre Difficultés distinctes rendent quatre classes distinctes', () => {
    expect(new Set(COUVERT_DIFFICULTES.map(couvertDepuisDifficulte)).size).toBe(COUVERT_DIFFICULTES.length);
  });

  it('le MODIFICATEUR est le même des deux côtés — c’est ce qui fait des deux graphies une seule échelle', () => {
    expect(CLASSES.map(coverModifier)).toEqual(COUVERT_DIFFICULTES.map((d) => DIFFICULTY_MODIFIERS[d]));
    expect(CLASSES.map(coverModifier)).toEqual([0, -10, -20, -30]); // LDB 14 l.72/81/86 + Intermédiaire
  });
});

describe('fusion et dégradation', () => {
  it('`couvertLePlusProtecteur` retient le meilleur pour la cible (modificateur le plus bas)', () => {
    expect(couvertLePlusProtecteur('none', 'imparfaite')).toBe('imparfaite');
    expect(couvertLePlusProtecteur('totale', 'moyenne')).toBe('totale');
    expect(couvertLePlusProtecteur('moyenne', 'moyenne')).toBe('moyenne');
  });

  it('`cranDeCouvertEnMoins` descend d’EXACTEMENT un rang, et `none` est le plancher (AA 10 l.122)', () => {
    expect(CLASSES.map(cranDeCouvertEnMoins)).toEqual(['none', 'none', 'imparfaite', 'moyenne']);
    // Le cas que le canon IMPRIME : Complexe (–10) devient Intermédiaire (+0).
    expect(cranDeCouvertEnMoins(couvertDepuisDifficulte('complexe'))).toBe(couvertDepuisDifficulte('intermediaire'));
  });
});
