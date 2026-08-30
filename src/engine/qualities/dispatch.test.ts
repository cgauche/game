import { describe, it, expect } from 'vitest';
import type { Weapon } from '../types';
import { QUALITIES } from './registry';
import { hasQuality, qualitySum, qualityCritTriggered, parryDRAdjust, isUnbreakable, attackDRAdjust, dangerousNine, reloadDRTarget, magazineSize, resolveQualities, qualityArmourBypasses } from './dispatch';
import { craftEncDelta } from './craftEconomy';
import { findQualityById } from '../../data';
import { parseQualityInstance } from './normalize';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Libellés FR (lisibles) → `QualityInstance[]` structurées (parseur d'authoring). */
const q_ = (qs: string[]) => qs.map((s) => parseQualityInstance(s)!);
const w = (qualities: string[], over: Partial<Weapon> = {}): Weapon => ({ label: 'W', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: q_(qualities), ...over });

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

describe('dispatch — durcissement : un porteur au champ `qualities` absent (donnée corrompue / vieux save) ne fait pas tomber la chaîne', () => {
  const malformed = { name: 'X' } as unknown as Weapon; // aucun `qualities`
  it('resolveQualities tolère l’absence de `qualities` (→ liste vide, pas de throw)', () => {
    expect(resolveQualities(malformed)).toEqual([]);
    expect(hasQuality(malformed, 'precise')).toBe(false);
    expect(qualitySum(malformed, 'attackMod')).toBe(0);
  });
  it('craftEncDelta tolère l’absence de `qualities` (→ 0)', () => {
    expect(craftEncDelta(malformed)).toBe(0);
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
  it('attackDRAdjust : Pointue = +1 DR au Test RÉUSSI seulement (LDB 62 l.288)', () => {
    expect(attackDRAdjust(w(['Pointue']), true)).toBe(1);
    expect(attackDRAdjust(w(['Pointue']), false)).toBe(0);
    expect(attackDRAdjust(w([]), true)).toBe(0);
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
  it('Taillade : État Hémorragique sur Critique — canal générique effects:[{trigger:onCrit}] (donnée)', () => {
    const eff = findQualityById('taillade')?.effects?.[0];
    expect(eff?.trigger).toBe('onCrit');
    const ops = (eff?.flow as { effect?: { ops?: { op: string; name?: string }[] } })?.effect?.ops;
    expect(ops?.[0]).toMatchObject({ op: 'condition', id: 'hemorragique' });
    expect(findQualityById('taillade')?.capabilities).toBeUndefined(); // plus de capability bespoke
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
    expect(test.test.characteristic).toBe('force');
    expect(test.test.skill).toEqual({ id: 'athletisme' }); // id stable (≠ libellé — multilangue-safe)
    expect(test.test.opposed?.attacker).toBe('force');
    expect(test.test.opposed?.attackerSkill).toBe('athletisme');
    // Défenseur PERD l'opposition (branche `fail`) → l'attaquant l'emporte → cible À Terre.
    expect(test.fail.kind).toBe('do');
    if (test.fail.kind !== 'do' || test.fail.effect.type !== 'ops') throw new Error('fail doit poser un État');
    expect(test.fail.effect.ops[0]).toMatchObject({ op: 'condition', id: 'a-terre' });
  });
});

describe('Aux Armes — qualités d’artillerie câblées', () => {
  it('Arme d’équipe maniée seul : Indice ≥ 3 → Imprécise (-1 DR), Indice ≥ 4 → Dangereuse', () => {
    expect(attackDRAdjust(w(["Arme d'équipe 2"]), true)).toBe(0);
    expect(attackDRAdjust(w(["Arme d'équipe 3"]), true)).toBe(-1);
    expect(dangerousNine(w(["Arme d'équipe 4"]), 19, false)).toBe(true); // 19 contient un 9, échec
    expect(dangerousNine(w(["Arme d'équipe 3"]), 19, false)).toBe(false); // Indice 3 : pas Dangereuse
  });
  it('Arme d’équipe : Recharge DOUBLÉE (reloadDRTarget)', () => {
    expect(reloadDRTarget({ qualities: q_(['Recharge 3']), reload: 3 })).toBe(3);
    expect(reloadDRTarget({ qualities: q_(['Recharge 3', "Arme d'équipe 2"]), reload: 3 })).toBe(6);
  });
  it('Salve : chargeur d’Indice tirs avant rechargement (magazineSize)', () => {
    expect(magazineSize(w(['Salve 7']))).toBe(7);
    expect(magazineSize(w(['Recharge 3']))).toBeUndefined();
  });
  it('Tir de zone : qualité de zone reconnue dans la donnée (capabilities.areaFire)', () => {
    expect(findQualityById('tir-de-zone')?.capabilities?.areaFire).toBe(true);
  });
});

describe('Poudre imprégnée d’Aqshy (AA 08 l.544) — seuil de Maladresse élargi {8,9}', () => {
  it('Dangereuse seule (LDB 62 l.315) : Maladresse sur 9 (dizaines OU unités), jamais sur 8 seul', () => {
    expect(dangerousNine(w(['Dangereuse']), 91, false)).toBe(true);
    expect(dangerousNine(w(['Dangereuse']), 19, false)).toBe(true);
    expect(dangerousNine(w(['Dangereuse']), 99, false)).toBe(true);
    expect(dangerousNine(w(['Dangereuse']), 84, false)).toBe(false);
  });
  it('Poudre imprégnée d’Aqshy (via weaponWithAmmo) : Maladresse sur 8 OU 9 (AA 08 l.544)', async () => {
    const { weaponWithAmmo } = await import('../items');
    const weapon = w(['Empaleuse']);
    const ammo = { qualities: q_(["Poudre imprégnée d'Aqshy"]), damage: { plusBF: false, flat: 2 } } as unknown as import('../types').ItemInstance;
    const armed = weaponWithAmmo(weapon, ammo);
    expect(dangerousNine(armed, 84, false)).toBe(true); // 8 en dizaines
    expect(dangerousNine(armed, 48, false)).toBe(true); // 8 en unités
    expect(dangerousNine(armed, 91, false)).toBe(true); // 9 toujours couvert
    expect(dangerousNine(armed, 73, false)).toBe(false); // ni 8 ni 9
  });
  it('Test RÉUSSI : jamais de Maladresse, même avec un digit du seuil', async () => {
    const { weaponWithAmmo } = await import('../items');
    const weapon = w(['Empaleuse']);
    const ammo = { qualities: q_(["Poudre imprégnée d'Aqshy"]), damage: { plusBF: false, flat: 2 } } as unknown as import('../types').ItemInstance;
    const armed = weaponWithAmmo(weapon, ammo);
    expect(dangerousNine(armed, 84, true)).toBe(false);
  });
  it('Dangereuse + Poudre d’Aqshy combinées : union des seuils {8,9}', () => {
    expect(dangerousNine(w(['Dangereuse', "Poudre imprégnée d'Aqshy"]), 84, false)).toBe(true);
    expect(dangerousNine(w(['Dangereuse', "Poudre imprégnée d'Aqshy"]), 91, false)).toBe(true);
    expect(dangerousNine(w(['Dangereuse', "Poudre imprégnée d'Aqshy"]), 73, false)).toBe(false);
  });
});

describe('registry — entrées attendues', () => {
  it('contient les qualités d’arme implémentées', () => {
    for (const k of ['Précise', 'Perforante', 'Pointue', 'Empaleuse', 'Défensive', 'À Enroulement', 'Pistolet', 'Incassable', 'Inoffensive', 'Dévastatrice', 'Percutante',
      'Léger', 'Pratique', 'Raffiné', 'Solide', 'Bâclé', 'Laid', 'Peu Fiable', 'Volumineux',
      'Taillade', 'Déséquilibrée', 'Déstabilisante', // Aux Armes p.89 — câblées (effets onCrit/onHit data-driven / defenderParryDR)
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

describe('qualityArmourBypasses — Perforante ignore le non-métal (LDB 62 l.270)', () => {
  it('une arme Perforante déclare le bypass nonMetal', () => {
    expect(qualityArmourBypasses(w(['Perforante']))).toEqual(['nonMetal']);
  });
  it('sans Perforante → aucun bypass', () => {
    expect(qualityArmourBypasses(w(['Précise']))).toEqual([]);
  });
});
