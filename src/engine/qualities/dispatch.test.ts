import { describe, it, expect } from 'vitest';
import type { Weapon } from '../types';
import { QUALITIES } from './registry';
import { hasQuality, qualitySum, qualityCritTriggered, parryDRAdjust, isUnbreakable } from './dispatch';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const w = (qualities: string[], over: Partial<Weapon> = {}): Weapon => ({ name: 'W', type: 'melee', damage: '+BF', qualities, ...over });

describe('dispatch — parité avec hasQ (startsWith, insensible casse, ignore Indice)', () => {
  it('hasQuality reconnaît le label exact, la casse et l’Indice', () => {
    expect(hasQuality(w(['Précise']), 'Précise')).toBe(true);
    expect(hasQuality(w(['précise']), 'Précise')).toBe(true);
    expect(hasQuality(w(['Solide 3']), 'Solide')).toBe(true); // ignore l'Indice
    expect(hasQuality(w(['Perforante']), 'Précise')).toBe(false);
    expect(hasQuality(undefined, 'Précise')).toBe(false);
  });
});

describe('dispatch — sommes numériques depuis le registre', () => {
  it('attackMod : Précise = +10', () => {
    expect(qualitySum(w(['Précise']), 'attackMod')).toBe(10);
    expect(qualitySum(w([]), 'attackMod')).toBe(0);
  });
  it('armourReduction : Perforante = 1', () => {
    expect(qualitySum(w(['Perforante']), 'armourReduction')).toBe(1);
  });
  it('damageDR : Pointue = +1', () => {
    expect(qualitySum(w(['Pointue']), 'damageDR')).toBe(1);
  });
});

describe('dispatch — Empaleuse (critTrigger sur multiple de 10)', () => {
  it('déclenche un Critique si le jet est multiple de 10', () => {
    expect(qualityCritTriggered(w(['Empaleuse']), 20)).toBe(true);
    expect(qualityCritTriggered(w(['Empaleuse']), 23)).toBe(false);
    expect(qualityCritTriggered(w([]), 20)).toBe(false);
  });
});

describe('dispatch — parade (Défensive +1 défenseur, À Enroulement -1 attaquant)', () => {
  it('Défensive +1, À Enroulement -1, combinés', () => {
    expect(parryDRAdjust(w(['Défensive']), w([]))).toBe(1);
    expect(parryDRAdjust(w([]), w(['À Enroulement']))).toBe(-1);
    expect(parryDRAdjust(w(['Défensive']), w(['À Enroulement']))).toBe(0);
    expect(parryDRAdjust(undefined, w([]))).toBe(0);
  });
});

describe('dispatch — Incassable', () => {
  it('isUnbreakable vrai seulement avec l’Atout Incassable', () => {
    expect(isUnbreakable(w(['Incassable']))).toBe(true);
    expect(isUnbreakable(w([]))).toBe(false);
  });
});

describe('registry — entrées attendues', () => {
  it('contient les qualités d’arme implémentées', () => {
    for (const k of ['Précise', 'Perforante', 'Pointue', 'Empaleuse', 'Défensive', 'À Enroulement', 'Pistolet', 'Incassable', 'Inoffensive', 'Dévastatrice', 'Percutante',
      'Léger', 'Pratique', 'Raffiné', 'Solide', 'Bâclé', 'Laid', 'Peu Fiable', 'Volumineux']) {
      expect(QUALITIES[k]).toBeTruthy();
    }
  });
});

describe('parité — toute qualité d’ARME des données est connue (registre ou allowlist explicite)', () => {
  // Toute NOUVELLE qualité de données doit être soit une entrée QUALITIES, soit ajoutée ici EN
  // CONSCIENCE — c'est le garde-fou anti-empilement. (Vide depuis l'intégration des 10 dernières
  // qualités d'arme : À Répétition, Immobilisante, Perturbante, Piège-lame, Protectrice, Rapide,
  // Dangereuse, Épuisante, Imprécise, Lente.)
  const NON_DANS_REGISTRE = new Set<string>([]);
  it('chaque Atout/Défaut d’arme de qualities.json est dans QUALITIES ou dans l’allowlist', () => {
    const path = fileURLToPath(new URL('../../data/qualities.json', import.meta.url));
    const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown;
    const all = (Array.isArray(raw) ? raw : Object.values(raw as Record<string, unknown>)) as { label: string; subType?: string }[];
    const armes = all.filter((q) => (q.subType ?? '').toLowerCase().startsWith('arme'));
    const known = new Set(Object.keys(QUALITIES));
    const missing = armes.map((q) => q.label).filter((l) => !known.has(l) && !NON_DANS_REGISTRE.has(l));
    expect(missing).toEqual([]);
  });
});
