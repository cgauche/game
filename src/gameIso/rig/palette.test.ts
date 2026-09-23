import { describe, it, expect } from 'vitest';
import { buildTokenMap, applyTokenMap } from './palette';
import { CLES, COUCHE_DEFAUT, defautDe, propagerSuiveuses } from './clesDePalette';
import { couchesDuRig } from './parts/career';

describe('palette — buildTokenMap', () => {
  it('clé non surchargée : rend l’ombre et la lumière EXACTES déclarées (rendu par défaut sans perte)', () => {
    const declaree = { vet1: '#82724f', vet1O: '#112233', vet1H: '#ffeedd' };
    const m = buildTokenMap([declaree], {});
    expect(m.vet1).toBe('#82724f');
    expect(m.vet1O).toBe('#112233'); // ombre exacte déclarée, PAS dérivée
    expect(m.vet1H).toBe('#ffeedd');
  });

  it('clé sans ombre déclarée : dérive O/H de la base déclarée', () => {
    const m = buildTokenMap([{ vet1: '#646464' }], {}); // 100,100,100
    expect(m.vet1).toBe('#646464');
    expect(m.vet1O).toBe('#4e4e4e'); // 100*0.78 = 78 = 0x4e
    expect(m.vet1H).toBe('#767676'); // 100*1.18 = 118 = 0x76
  });

  it('clé surchargée par le joueur : TOUTE la gamme dérive du choix (ignore les ombres déclarées)', () => {
    const declaree = { vet1: '#82724f', vet1O: '#112233', vet1H: '#ffeedd' };
    const m = buildTokenMap([declaree], { vet1: '#646464' });
    expect(m.vet1).toBe('#646464');
    expect(m.vet1O).toBe('#4e4e4e');
    expect(m.vet1H).toBe('#767676');
  });

  it('clé déclarée nulle part : la couche défaut de la table la donne', () => {
    const m = buildTokenMap([], {});
    expect(m.peau).toBe(defautDe('peau'));
    expect(m.metal).toBe(defautDe('metal'));
  });

  it('toute clé de la table est résolue, gamme comprise, sans déclaration', () => {
    const m = buildTokenMap([], {});
    const defaut = propagerSuiveuses(COUCHE_DEFAUT);
    for (const k of CLES) {
      expect(m[k], k).toBe(defaut[k]);
      expect(m[`${k}O`], `${k}O`).toMatch(/^#[0-9a-f]{6}$/);
      expect(m[`${k}H`], `${k}H`).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('couches : l’ombre d’une couche basse ne sert JAMAIS sous une base venue d’une couche plus haute', () => {
    const m = buildTokenMap([{ vet1: '#82724f', vet1O: '#112233', vet1H: '#ffeedd' }, { vet1: '#646464' }], {});
    expect(m.vet1).toBe('#646464');
    expect(m.vet1O).toBe('#4e4e4e');
    expect(m.vet1H).toBe('#767676');
  });

  it('couche défaut : l’ombre de la table sert sous sa base, jamais sous une base déclarée', () => {
    expect(buildTokenMap([], {}).botteO).toBe(COUCHE_DEFAUT.botteO);
    expect(buildTokenMap([{ botte: '#646464' }], {}).botteO).toBe('#4e4e4e');
  });

  it('rig `cultiste` : `botteO` ET `botteDosO` dérivés de sa botte, l’ombre dorsale de la table ne survit pas', () => {
    const m = buildTokenMap(couchesDuRig(undefined, 'cultiste'), {});
    expect(m.botte).toBe('#4a3a28');
    expect(m.botteO).toBe('#3a2d1f');
    expect(m.botteDos).toBe('#4a3a28');
    expect(m.botteDosO).toBe('#3a2d1f');
  });

  it('clé suiveuse : une couche qui donne la suivie sans la suiveuse lui donne sa gamme DÉCLARÉE', () => {
    const m = buildTokenMap([{ corps: '#646464', corpsO: '#112233' }], {});
    expect(m.aile).toBe('#646464');
    expect(m.aileO).toBe('#112233');
    expect(m.aileH).toBe('#767676');
    expect(buildTokenMap([{ botte: '#646464' }], {}).semelle).toBe('#646464');
  });

  it('clé suiveuse sous surcharge de la suivie : elle suit, sauf si la couche qui donne sa base la déclare', () => {
    expect(buildTokenMap([{ corps: '#646464' }], { corps: '#ff0000' }).aile).toBe('#ff0000');
    expect(buildTokenMap([{ corps: '#646464', aile: '#00ff00' }], { corps: '#ff0000' }).aile).toBe('#00ff00');
    expect(buildTokenMap([{ aile: '#806030' }, { corps: '#ffffff' }], { corps: '#ff0000' }).aile).toBe('#ff0000');
  });

  it('applyTokenMap : substitue les jetons connus, laisse les inconnus', () => {
    const m = buildTokenMap([{ vet1: '#abcdef' }], {});
    expect(applyTokenMap('<path fill="@vet1"/>', m)).toBe('<path fill="#abcdef"/>');
    expect(applyTokenMap('<path fill="@inconnu"/>', m)).toBe('<path fill="@inconnu"/>');
    expect(applyTokenMap('<path fill="#123456"/>', m)).toBe('<path fill="#123456"/>'); // hex en dur intact
  });

  it('clés hors table déclarées par un def (ex. navire) : base + ombre/lumière dérivées, table intacte', () => {
    const m = buildTokenMap([{ coque: '#6b4a2b', voile: '#e8e0cc' }], {});
    expect(m.coque).toBe('#6b4a2b');
    expect(m.coqueO).toBeDefined();
    expect(m.coqueH).toBeDefined();
    expect(m.voile).toBe('#e8e0cc');
    expect(m.peau).toBe(defautDe('peau'));
    expect(applyTokenMap('<path fill="@coque" stroke="@coqueO"/><rect fill="@voile"/>', m)).not.toContain('@');
  });
});
