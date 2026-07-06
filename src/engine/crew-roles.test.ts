import { describe, it, expect } from 'vitest';
import { resolveCrewTestByRoles, crewRoleValue, undercrewPenalty } from './crewMorale';
import { crewRoles, crewTestTypes, findCrewRoleById } from '../data';
import { traumaById } from './trauma';
import type { Combatant, SkillInstance } from './types';
import type { RNG } from './dice';

/** Combattant d'équipage minimal : caractéristiques + compétences possédées (carac d'instance = Dex pour
 *  un score prévisible : valeur = Dex + avances). Calqué sur le `mk` de skills.test.ts. */
const mk = (chars: Partial<Record<string, number>>, skills: { skillId: string; advances: number; spec?: string }[] = []): Combatant =>
  ({
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30, ...chars },
    skills: skills.map((s) => ({ ...s, characteristic: 'Dex' }) as SkillInstance),
    conditions: [], talents: [],
  }) as unknown as Combatant;

/** RNG déterministe : renvoie la séquence de d100 fournie. */
const seq = (values: number[]): RNG => { let i = 0; return { int: () => values[i++] }; };

describe('Catalogue des rôles d’équipage + types de Test (MDG ch.14) — données verbatim', () => {
  it('9 rôles, chacun {id,label,skills≥1,desc}', () => {
    expect(crewRoles).toHaveLength(9);
    for (const r of crewRoles) {
      expect(r.id && r.label && r.desc).toBeTruthy();
      expect(r.skills.length).toBeGreaterThanOrEqual(1);
    }
    // Mousse = Voile OU Ramer (le RAW donne deux compétences pour ce rôle).
    expect(findCrewRoleById('mousse')!.skills.map((s) => s.skillId)).toEqual(['voile', 'ramer']);
  });

  it('chaque type de Test référence des rôles existants, dont son rôle ESSENTIEL', () => {
    for (const tt of crewTestTypes) {
      expect(tt.roles).toContain(tt.essential);
      for (const roleId of tt.roles) expect(findCrewRoleById(roleId)).toBeDefined();
    }
    // Tir de batterie → Artilleur essentiel (MDG ch.14).
    const batt = crewTestTypes.find((t) => t.id === 'batterie')!;
    expect(batt.essential).toBe('artilleur');
  });
});

describe('crewRoleValue — lit la VRAIE valeur de Compétence du membre (meilleure pour Mousse)', () => {
  it('Artilleur → Projectiles (Poudre noire) ; Mousse → meilleure de Voile/Ramer', () => {
    const artilleur = mk({ Dex: 60 }, [{ skillId: 'projectiles', advances: 20, spec: 'poudre-noire' }]);
    expect(crewRoleValue(artilleur, findCrewRoleById('artilleur')!).value).toBe(80);
    const mousse = mk({ Dex: 30 }, [{ skillId: 'voile', advances: 25 }]); // Voile 55 > Ramer (repli 30)
    expect(crewRoleValue(mousse, findCrewRoleById('mousse')!).value).toBe(55);
  });
});

describe('crewRoleValue — sens transmis au Test (Surdité, LDB 18 : « Tests de Perception basés sur l’ouïe » seulement)', () => {
  it('sense "vue" (voir la lumière d’un phare, MDG 13 l.337) : la Surdité NE pénalise PAS la Vigie', () => {
    const deaf = { ...mk({ Dex: 40 }, [{ skillId: 'perception', advances: 0 }]), traumas: [traumaById('surdite', undefined, 'tete')] } as Combatant;
    const vigie = findCrewRoleById('vigie')!;
    expect(crewRoleValue(deaf, vigie).value).toBe(20); // sans sens précisé : pénalité par défaut (conservateur)
    expect(crewRoleValue(deaf, vigie, 'ouie').value).toBe(20); // sens auditif explicite : pénalisé
    expect(crewRoleValue(deaf, vigie, 'vue').value).toBe(40); // sens visuel : la Surdité ne vise QUE l’ouïe
  });
});

describe('resolveCrewTestByRoles — Test d’équipage piloté par rôles (MDG ch.14)', () => {
  it('le rôle ESSENTIEL (Artilleur pour Tir de batterie) voit son DR compté DOUBLE', () => {
    const artilleur = mk({ Dex: 70 }, [{ skillId: 'projectiles', advances: 10, spec: 'poudre-noire' }]); // 80
    const mousse = mk({ Dex: 50 }, [{ skillId: 'voile', advances: 0 }]); // 50
    const r = resolveCrewTestByRoles(
      [{ crew: artilleur, roleId: 'artilleur' }, { crew: mousse, roleId: 'mousse' }],
      'batterie', 'intermediaire', 80, seq([30, 30]),
    );
    expect(r.contributions[0].label).toBe('Artilleur');
    expect(r.contributions[0].essential).toBe(true);
    expect(r.contributions[0].counted).toBe(r.contributions[0].sl * 2);
    expect(r.contributions[1].essential).toBe(false);
    expect(r.contributions[1].counted).toBe(r.contributions[1].sl);
    expect(r.baseTotal).toBe(r.contributions[0].counted + r.contributions[1].counted);
  });

  it('double-rôle (MDG ch.14 l.53) : le même jet est +2 crans plus DUR → DR plus faible', () => {
    const x = mk({ Dex: 50 }, [{ skillId: 'orientation', advances: 0 }]); // Navigateur 50
    const normal = resolveCrewTestByRoles([{ crew: x, roleId: 'navigateur' }], 'manoeuvre', 'intermediaire', 80, seq([30]));
    const doubled = resolveCrewTestByRoles([{ crew: x, roleId: 'navigateur', doubleRole: true }], 'manoeuvre', 'intermediaire', 80, seq([30]));
    expect(doubled.contributions[0].sl).toBeLessThan(normal.contributions[0].sl);
  });

  it('Manque de bras (MDG ch.14 l.55) : −2 DR ET jamais meilleur qu’un Succès Minime (DR total ≤ 0)', () => {
    const cap = mk({ Dex: 80 }, [{ skillId: 'voile', advances: 0 }]); // Timonier 80
    const moussse = mk({ Dex: 80 }, [{ skillId: 'voile', advances: 0 }]); // Mousse 80
    const crew = [{ crew: cap, roleId: 'timonier' }, { crew: moussse, roleId: 'mousse' }];
    const full = resolveCrewTestByRoles(crew, 'manoeuvre', 'intermediaire', 80, seq([10, 10]));
    expect(full.total).toBeGreaterThan(0); // équipage complet : net positif
    const short = resolveCrewTestByRoles(crew, 'manoeuvre', 'intermediaire', 80, seq([10, 10]), { understaffed: true });
    expect(short.total).toBe(0); // plafonné au Succès Minime
    expect(short.lines.some((l) => /Manque de bras|Succès Minime/.test(l))).toBe(true);
  });
});

describe('undercrewPenalty — Manque de bras GLOBAL d’un grand vaisseau (MDG ch.14 l.55)', () => {
  it('équipage complet → aucune pénalité', () => {
    expect(undercrewPenalty(50, 50)).toEqual({ tranches: 0, dr: 0, capSuccesMinime: false });
    expect(undercrewPenalty(50, 52)).toEqual({ tranches: 0, dr: 0, capSuccesMinime: false }); // surnuméraire
  });

  it('moins de 10 % manquant → 0 tranche, pas de malus (le modificateur s’applique PAR tranche de 10 %)', () => {
    expect(undercrewPenalty(50, 46)).toEqual({ tranches: 0, dr: 0, capSuccesMinime: false }); // 8 % manquant
  });

  it('10 % manquant → 1 tranche : −2 DR + plafond Succès Minime', () => {
    expect(undercrewPenalty(50, 45)).toEqual({ tranches: 1, dr: -2, capSuccesMinime: true }); // 5/50 = 10 %
  });

  it('pertes lourdes → malus cumulatif par tranche de 10 %', () => {
    expect(undercrewPenalty(50, 35)).toEqual({ tranches: 3, dr: -6, capSuccesMinime: true }); // 30 % manquant
    expect(undercrewPenalty(50, 20)).toEqual({ tranches: 6, dr: -12, capSuccesMinime: true }); // 60 % manquant
  });

  it('nominal inconnu (0) → pas de pénalité (défensif)', () => {
    expect(undercrewPenalty(0, 0)).toEqual({ tranches: 0, dr: 0, capSuccesMinime: false });
  });
});
