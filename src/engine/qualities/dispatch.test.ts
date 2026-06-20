import { describe, it, expect } from 'vitest';
import type { Weapon } from '../types';
import { QUALITIES } from './registry';
import { hasQuality, qualitySum, qualityCritTriggered, parryDRAdjust, isUnbreakable, attackDRAdjust, dangerousNine, reloadDRTarget, magazineSize } from './dispatch';
import { findQualityById } from '../../data';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const w = (qualities: string[], over: Partial<Weapon> = {}): Weapon => ({ name: 'W', type: 'melee', damage: '+BF', qualities, ...over });

describe('dispatch — hasQuality compare par ID de qualité (label/casse/Indice tolérés en entrée)', () => {
  it('hasQuality(porteur, qualityId) reconnaît la qualité quelle que soit la forme stockée', () => {
    expect(hasQuality(w(['Précise']), 'precise')).toBe(true); // label canonique en runtime
    expect(hasQuality(w(['précise']), 'precise')).toBe(true); // casse
    expect(hasQuality(w(['precise']), 'precise')).toBe(true); // id en runtime
    expect(hasQuality(w(['Solide 3']), 'solide')).toBe(true); // ignore l'Indice
    expect(hasQuality(w(['Perforante']), 'precise')).toBe(false);
    expect(hasQuality(undefined, 'precise')).toBe(false);
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

describe('Aux Armes p.89 — qualités de mêlée câblées', () => {
  it('Déséquilibrée : -1 DR à la parade quand c’est l’arme du DÉFENSEUR (sans effet sur l’arme de l’attaquant)', () => {
    expect(parryDRAdjust(w(['Déséquilibrée']), w([]))).toBe(-1);
    expect(parryDRAdjust(w(['Défensive']), w(['Déséquilibrée']))).toBe(1);
  });
  it('Taillade : ajoute un État Hémorragique sur Critique (capabilities.onCritCondition, donnée)', () => {
    expect(findQualityById('taillade')?.capabilities?.onCritCondition).toBe('hemorragique');
  });
  it('Déstabilisante : effet onHit data-driven — choix (2 Av) → Test opposé Force/Athlétisme → À Terre (effects, donnée)', () => {
    const eff = findQualityById('destabilisante')?.effects?.[0];
    expect(eff?.trigger).toBe('onHit');
    expect(eff?.on).toBe('victim');
    // Nœud `choice` opt-in coûtant 2 Avantages (cadence-aware : modale héros / auto IA).
    const choice = eff?.flow;
    expect(choice?.kind).toBe('choice');
    if (choice?.kind !== 'choice') throw new Error('flow doit être un choice');
    expect(choice.cost?.advantage).toBe(2);
    // Branche `yes` = Test OPPOSÉ Force/Athlétisme des deux côtés (défenseur jette F+athletisme,
    // attaquant pré-jeté opposed{F+athletisme}).
    const test = choice.yes;
    expect(test.kind).toBe('test');
    if (test.kind !== 'test') throw new Error('yes doit être un test');
    expect(test.test.characteristic).toBe('F');
    expect(test.test.skill).toBe('athletisme'); // id stable (≠ libellé — multilangue-safe)
    expect(test.test.opposed?.attacker).toBe('F');
    expect(test.test.opposed?.attackerSkill).toBe('athletisme');
    // Défenseur PERD l'opposition (branche `fail`) → l'attaquant l'emporte → cible À Terre.
    expect(test.fail.kind).toBe('do');
    if (test.fail.kind !== 'do' || test.fail.effect.type !== 'ops') throw new Error('fail doit poser un État');
    expect(test.fail.effect.ops[0]).toMatchObject({ op: 'condition', name: 'a-terre' });
  });
});

describe('Aux Armes — qualités d’artillerie câblées', () => {
  it('Arme d’équipe maniée seul : Indice ≥ 3 → Imprécise (-1 DR), Indice ≥ 4 → Dangereuse', () => {
    expect(attackDRAdjust(w(["Arme d'équipe 2"]))).toBe(0);
    expect(attackDRAdjust(w(["Arme d'équipe 3"]))).toBe(-1);
    expect(dangerousNine(w(["Arme d'équipe 4"]), 19, false)).toBe(true); // 19 contient un 9, échec
    expect(dangerousNine(w(["Arme d'équipe 3"]), 19, false)).toBe(false); // Indice 3 : pas Dangereuse
  });
  it('Arme d’équipe : Recharge DOUBLÉE (reloadDRTarget)', () => {
    expect(reloadDRTarget({ qualities: ['Recharge 3'], reload: 3 })).toBe(3);
    expect(reloadDRTarget({ qualities: ['Recharge 3', "Arme d'équipe 2"], reload: 3 })).toBe(6);
  });
  it('Salve : chargeur d’Indice tirs avant rechargement (magazineSize)', () => {
    expect(magazineSize(w(['Salve 7']))).toBe(7);
    expect(magazineSize(w(['Recharge 3']))).toBeUndefined();
  });
  it('Tir de zone : qualité de zone reconnue dans la donnée (capabilities.areaFire)', () => {
    expect(findQualityById('tir-de-zone')?.capabilities?.areaFire).toBe(true);
  });
});

describe('registry — entrées attendues', () => {
  it('contient les qualités d’arme implémentées', () => {
    for (const k of ['Précise', 'Perforante', 'Pointue', 'Empaleuse', 'Défensive', 'À Enroulement', 'Pistolet', 'Incassable', 'Inoffensive', 'Dévastatrice', 'Percutante',
      'Léger', 'Pratique', 'Raffiné', 'Solide', 'Bâclé', 'Laid', 'Peu Fiable', 'Volumineux',
      'Taillade', 'Déséquilibrée', 'Déstabilisante', // Aux Armes p.89 — câblées (onCritCondition / defenderParryDR / effet onHit renversement)
      "Arme d'équipe", 'Salve', 'Tir de zone']) { // Aux Armes p.124/126/89 — artillerie câblée (sous-effectif / chargeur / zone)
      expect(QUALITIES[k]).toBeTruthy();
    }
  });
});

describe('parité — toute qualité d’ARME des données est connue (registre ou allowlist explicite)', () => {
  // Toute NOUVELLE qualité de données doit être soit une entrée QUALITIES, soit ajoutée ici EN
  // CONSCIENCE — c'est le garde-fou anti-empilement. (Vide depuis l'intégration des 10 dernières
  // qualités d'arme : À Répétition, Immobilisante, Perturbante, Piège-lame, Protectrice, Rapide,
  // Dangereuse, Épuisante, Imprécise, Lente.)
  // Vide : toutes les qualités d'arme de qualities.json (Aux Armes incluses) sont désormais câblées
  // au registre. Une NOUVELLE qualité non câblée s'ajouterait ici EN CONSCIENCE (garde-fou anti-empilement).
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
  // Pénalités « % en Discrétion/Perception » : pas des qualités du registre — parsées par
  // wearPenalty.ts directement depuis la donnée d'armure (LDB 63, colonne Pénalités).
  const ARMURE_HORS_REGISTRE = new Set(['% en discretion', '% en perception']);
  it('chaque Atout/Défaut d’ARMURE de qualities.json est dans QUALITIES ou allowlisté', () => {
    const path = fileURLToPath(new URL('../../data/qualities.json', import.meta.url));
    const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown;
    const all = (Array.isArray(raw) ? raw : Object.values(raw as Record<string, unknown>)) as { label: string; subType?: string }[];
    const armures = all.filter((q) => (q.subType ?? '').toLowerCase().startsWith('armure'));
    const known = new Set(Object.keys(QUALITIES));
    const missing = armures.map((q) => q.label).filter((l) => !known.has(l) && !ARMURE_HORS_REGISTRE.has(l));
    expect(missing).toEqual([]);
  });
});
