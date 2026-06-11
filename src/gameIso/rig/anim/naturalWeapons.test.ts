import { describe, it, expect } from 'vitest';
import { handlingClass } from './handling';
import { weaponAttackClip, weaponParryClip, weaponRest } from './weaponClips';
import type { Weapon } from '../../../engine/types';

const w = (name: string): Weapon => ({ name, type: 'melee', damage: '+BF', qualities: [] });

describe('maniement des armes naturelles (mutations/traits)', () => {
  it('Tentacule → classe fouet (entraves) ; Cornes → coup de tête (cornes)', () => {
    expect(handlingClass(w('Tentacule'))).toBe('entraves');
    expect(handlingClass(w('Cornes'))).toBe('cornes');
    expect(handlingClass(w('Fouet'))).toBe('entraves'); // l'arme Fouet inchangée
  });

  it('le geste se joue sur LE BRAS QUI TIENT L’ARME : tentacule et main gauche → miroité', () => {
    const lash = weaponAttackClip(w('Tentacule'));
    const all = lash.steps.flatMap((s) => Object.keys(s.pose));
    expect(all).toContain('epauleG');
    expect(all).not.toContain('epauleD'); // pas le bras d'arme droit
    expect(all).not.toContain('arme'); // rien en main
    // L'arme Fouet (main directrice), elle, fouette du bras droit.
    expect(weaponAttackClip(w('Fouet')).steps.flatMap((s) => Object.keys(s.pose))).toContain('epauleD');
    // 2e frappe du Maniement de deux armes : la dague en MAIN GAUCHE frappe du bras gauche.
    const off = weaponAttackClip({ ...w('Dague'), hand: 'off' });
    const offBones = off.steps.flatMap((s) => Object.keys(s.pose));
    expect(offBones).toContain('epauleG');
    expect(offBones).not.toContain('epauleD');
  });

  it('Cornes : coup de TÊTE (tête/cou/torse), pas un coup de bras ; parade = se couvrir', () => {
    const butt = weaponAttackClip(w('Cornes'));
    const strike = butt.steps[1].pose;
    expect(strike.tete).toBeGreaterThan(0);
    expect(strike.torse).toBeGreaterThan(0);
    expect(weaponRest(w('Cornes'))).toEqual({});
    expect(weaponParryClip(w('Cornes'))).toBe(weaponParryClip(w('Mains nues'))); // BARE_BLOCK
  });
});
