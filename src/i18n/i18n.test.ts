import { describe, it, expect } from 'vitest';
import { t, interpolate, getLocale } from './index';
import { fr } from './messages/fr';
import { CHAR_LABELS, DIFFICULTY_LABELS, HIT_LOCATION_LABELS, BODY_SHAPE_LOC_LABELS } from '../engine/types';
import { DEFENSE_LABEL, FREE_ATTACK_LABEL } from '../engine/combat';
import { CIBLE_LABEL } from '../engine/psychology';
import { psychologyLabel } from '../data';

describe('i18n — primitive t() + catalogue FR (seam, docs/i18n-seam.md)', () => {
  it('résout une clé en texte FR', () => {
    expect(t('char.CC')).toBe('Capacité de Combat');
    expect(t('difficulty.difficile')).toBe('Difficile (−20)');
  });

  it('interpolate remplace {param} et laisse {x} intact si absent', () => {
    expect(interpolate('{actor} réussit (DR {sl}).', { actor: 'Bob', sl: 2 })).toBe('Bob réussit (DR 2).');
    expect(interpolate('{a} et {b}', { a: 'X' })).toBe('X et {b}');
    expect(interpolate('aucun param')).toBe('aucun param');
  });

  it('locale par défaut = fr', () => {
    expect(getLocale()).toBe('fr');
  });

  it('les maps de labels DÉRIVENT du catalogue (source unique, parité verbatim)', () => {
    expect(CHAR_LABELS.CC).toBe(t('char.CC'));
    expect(CHAR_LABELS.Soc).toBe('Sociabilité');
    expect(DIFFICULTY_LABELS.tresFacile).toBe(t('difficulty.tresFacile'));
    expect(DIFFICULTY_LABELS.intermediaire).toBe('Intermédiaire (+0)');
    // Difficultés extrêmes EDO (App.2) : labels dérivés du catalogue comme les autres.
    expect(DIFFICULTY_LABELS.presqueImpossible).toBe(t('difficulty.presqueImpossible'));
    expect(DIFFICULTY_LABELS.impossible).toBe('Impossible (−50)');
    expect(HIT_LOCATION_LABELS.tete).toBe(t('hitloc.tete'));
    expect(HIT_LOCATION_LABELS.jambeD).toBe('Jambe droite');
    expect(DEFENSE_LABEL.parade).toBe('Parade');
    expect(FREE_ATTACK_LABEL.morsure).toBe(t('freeAttack.morsure'));
    expect(FREE_ATTACK_LABEL.caudale).toBe('Attaque caudale');
    expect(BODY_SHAPE_LOC_LABELS.quadrupede.brasG).toBe('Membre antérieur gauche');
    expect(BODY_SHAPE_LOC_LABELS.oiseau.brasG).toBe(t('hitloc.oiseau.brasG'));
    // CIBLE_LABEL DÉRIVE désormais de psychology.json (donnée app-owned, comme etats.json), pas du catalogue t().
    expect(CIBLE_LABEL.animosite.label).toBe(psychologyLabel('animosite'));
    expect(CIBLE_LABEL.haine.icon).toBe('flag/anger'); // icône du registre <Icon>, portée par la donnée
  });

  it('garde `out.*` : aucune clé ne re-imprime le jet (roll/sl/drow, ou {target} en paire avec {roll}) — #295 Lot 0 Décision 1b/ceinture', () => {
    const offenders = Object.entries(fr)
      .filter(([k]) => k.startsWith('out.'))
      .filter(([, v]) => /\{(roll|sl|drow)\}/.test(v) || (/\{target\}/.test(v) && /\{roll\}/.test(v)));
    expect(offenders).toEqual([]);
  });
});
