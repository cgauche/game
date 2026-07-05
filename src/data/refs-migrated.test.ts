/**
 * Garde-fou INVARIANT (multilangue) : les champs de référence migrés ne contiennent QUE des refs
 * STRUCTURÉES (par id), jamais de libellé brut, et les ids de catalogue résolvent. Toute régression
 * (un libellé qui se faufile, un id fantôme) casse ici. Cf. [[game-ids-internes-libelles-display-multilangue]].
 */
import { describe, it, expect } from 'vitest';
import {
  trappings, qualities, spells, creatures, classes, careers, careerLevels, species, gods, etats, maladies, weaponGroups,
  traits, stars, talents, maneuvers, skills, domains, crewRoles,
  findSkillById, findTalentById, findTrappingById, findQualityById, findSpellById,
  findCareerById, findClassById, findSpeciesById, findConditionById, findDiseaseById, findWeaponGroupById, findSymptomById,
  specLabel, refLabel, specEntryId,
} from './index';
import { itemFromTrappingById } from '../engine/items';
import { COND } from '../engine/conditions';
import { DISEASES } from '../engine/disease';
import pregensJson from './pregens.json';
import interludeEventsJson from './interludeEvents.json';
import tavernGamesJson from './tavernGames.json';
import seaWeatherJson from './sea-weather.json';
import areneProject from '../scenes/arene/arene-projet.json';
import { CHAR_KEYS } from '../engine/types';

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x != null;

describe('refs migrées — refs structurées par id, zéro libellé résiduel', () => {
  it('trappings.qualities = QualityRef[] {id} qui résout (id stable)', () => {
    for (const t of trappings) for (const q of t.qualities) {
      expect(isObj(q)).toBe(true);
      expect(findQualityById(q.id)).toBeTruthy();
    }
  });

  it('trappings.subType = weaponGroupId qui résout (jamais un libellé brut)', () => {
    const groupIds = new Set(weaponGroups.map((g) => g.id));
    for (const t of trappings) {
      if (t.subType == null) continue;
      expect(groupIds.has(t.subType), `${t.label} → ${t.subType}`).toBe(true);
      expect(findWeaponGroupById(t.subType)).toBeTruthy();
    }
  });

  it('weaponGroups portent un id stable + kind valide', () => {
    const kinds = new Set(['weapon', 'ammo', 'armour', 'inventory']);
    for (const g of weaponGroups) { expect(typeof g.id).toBe('string'); expect(kinds.has(g.kind), g.kind).toBe(true); }
  });

  it('itemFromTrappingById pose un trappingId qui pointe le catalogue', () => {
    for (const id of ['arbalete', 'epee-batarde', 'chemise-de-mailles', 'mains-nues']) {
      const it = itemFromTrappingById(id);
      expect(it, id).toBeTruthy();
      expect(it!.trappingId).toBe(id);
    }
  });

  it('classes.trappings + careerLevels.trappings = TrappingRef ({id} résout, ou {text} narratif)', () => {
    const all = [...classes.flatMap((c) => c.trappings), ...careerLevels.flatMap((l) => l.trappings)];
    for (const tr of all) {
      expect(isObj(tr)).toBe(true);
      if ('id' in tr) expect(itemFromTrappingById(tr.id as string)).toBeTruthy(); // résolution unifiée (trappings → vehicles)
      else expect(typeof (tr as { text: string }).text).toBe('string');
    }
  });

  it('creatures : spells (Ref) résolvent ; skills/talents/optionals/trappings structurés (zéro chaîne)', () => {
    for (const c of creatures) {
      for (const s of c.spells) { expect(isObj(s)).toBe(true); expect(findSpellById(s.id)).toBeTruthy(); }
      for (const sk of c.skills) expect(isObj(sk) && typeof sk.id === 'string').toBe(true);
      for (const t of c.talents) expect(isObj(t) && typeof t.id === 'string').toBe(true);
      for (const o of c.optionals) expect(isObj(o)).toBe(true); // TraitInstance (clé de registre)
      for (const tr of c.trappings) { expect(isObj(tr)).toBe(true); if ('id' in tr) expect(itemFromTrappingById(tr.id as string)).toBeTruthy(); }
    }
  });

  it('gods.blessings/miracles = Ref[] {id} de sort qui résout', () => {
    for (const g of gods) for (const r of [...g.blessings, ...g.miracles]) expect(findSpellById(r.id)).toBeTruthy();
  });

  it('species/careerLevels skills+talents = AdvancementRef[] structuré ; characteristics = CharKey', () => {
    const advLists = [
      ...species.flatMap((s) => [s.skills, s.talents]),
      ...careerLevels.flatMap((l) => [l.skills, l.talents]),
    ];
    for (const list of advLists) for (const a of list) expect(isObj(a)).toBe(true);
    for (const l of careerLevels) for (const k of l.characteristics) expect(CHAR_KEYS as readonly string[]).toContain(k);
  });

  it('careers/classes/species portent un id ; careers.class = classId qui résout', () => {
    for (const c of careers) { expect(typeof c.id).toBe('string'); expect(findClassById(c.class), c.label).toBeTruthy(); }
    for (const cl of classes) expect(typeof cl.id).toBe('string');
    for (const s of species) expect(typeof s.id).toBe('string');
  });

  it('etats portent un id ; la constante moteur COND est synchrone avec etats.json', () => {
    for (const e of etats) expect(typeof e.id).toBe('string');
    const ids = new Set(etats.map((e) => e.id));
    for (const id of Object.values(COND)) expect(ids.has(id), id).toBe(true); // chaque État canonique existe dans le dataset
    expect(Object.values(COND).length).toBe(12); // les 12 États LDB 16
  });

  it('findConditionById résout les ids canoniques', () => {
    for (const id of Object.values(COND)) expect(findConditionById(id), id).toBeTruthy();
  });

  it('maladies portent un id ; la constante moteur DISEASES est synchrone avec maladies.json', () => {
    for (const m of maladies) expect(typeof m.id).toBe('string');
    const ids = new Set(maladies.map((m) => m.id));
    for (const id of Object.values(DISEASES)) { expect(ids.has(id), id).toBe(true); expect(findDiseaseById(id), id).toBeTruthy(); }
    expect(Object.values(DISEASES).length).toBe(9); // les 9 maladies LDB 20 câblées
  });

  it('chaque maladie.symptoms.symptomId résout dans symptoms.json (catalogue éditable)', () => {
    for (const m of maladies) for (const s of m.symptoms) expect(findSymptomById(s.symptomId), `${m.id}:${s.symptomId}`).toBeTruthy();
  });

  it('careerLevels.career = careerId qui résout', () => {
    for (const l of careerLevels) expect(findCareerById(l.career), l.label).toBeTruthy();
  });

  it('pregens.species/career = ids qui résolvent', () => {
    for (const p of pregensJson as { name: string; species: string; career: string }[]) {
      expect(findSpeciesById(p.species), p.name).toBeTruthy();
      expect(findCareerById(p.career), p.name).toBeTruthy();
    }
  });

  it('interludeEvents.fx.revenue(Blocked)Classes = classId qui résout (ou « * »)', () => {
    for (const e of interludeEventsJson as { fx?: { revenueClasses?: string[]; revenueBlockedClasses?: string[] } }[]) {
      for (const c of [...(e.fx?.revenueClasses ?? []), ...(e.fx?.revenueBlockedClasses ?? [])]) {
        if (c === '*') continue;
        expect(findClassById(c), c).toBeTruthy();
      }
    }
  });

  it('refs d’avancement explicites pointent un id de Compétence/Talent réel', () => {
    const ck = (cat: 'skills' | 'talents', a: unknown): void => {
      if (!isObj(a)) return;
      if ('ref' in a) { const r = a.ref as { id: string }; expect((cat === 'skills' ? findSkillById : findTalentById)(r.id)).toBeTruthy(); }
      if ('choice' in a) for (const o of a.choice as unknown[]) ck(cat, o);
    };
    for (const s of species) { s.skills.forEach((a) => ck('skills', a)); s.talents.forEach((a) => ck('talents', a)); }
    for (const l of careerLevels) { l.skills.forEach((a) => ck('skills', a)); l.talents.forEach((a) => ck('talents', a)); }
  });

  // ── Phase F — ops de Flow & champs de talent : qualité/talent par id, jamais un libellé ──
  /** Visite récursive de chaque nœud-objet d'une arborescence de données (Flow/effets imbriqués). */
  const walk = (node: unknown, fn: (o: Record<string, unknown>) => void): void => {
    if (Array.isArray(node)) { node.forEach((x) => walk(x, fn)); return; }
    if (!isObj(node)) return;
    fn(node);
    for (const v of Object.values(node)) walk(v, fn);
  };
  /** Tous les datasets porteurs de `GameOp` (Flow de sorts/traits/etc. + effet de signe). */
  const opDatasets: unknown[] = [...spells, ...traits, ...creatures, ...qualities, ...stars];

  it('ops grantTalent → { talentId } qui résout (jamais un libellé « talent »)', () => {
    walk(opDatasets, (o) => {
      if (o.op !== 'grantTalent') return;
      expect('talent' in o, `grantTalent legacy { talent } résiduel : ${JSON.stringify(o)}`).toBe(false);
      expect(typeof o.talentId, JSON.stringify(o)).toBe('string');
      expect(findTalentById(o.talentId as string), String(o.talentId)).toBeTruthy();
    });
  });

  it('ops addQualities / grantWeapon.qualities = id de Qualité qui résout', () => {
    walk(opDatasets, (o) => {
      const lists: unknown[] = [];
      if (o.op === 'augmentWeapon' && Array.isArray(o.addQualities)) lists.push(o.addQualities);
      if ((o.op === 'grantWeapon' || o.op === 'grantNaturalWeapon') && Array.isArray(o.qualities)) lists.push(o.qualities);
      for (const q of lists.flat()) {
        expect(typeof q, JSON.stringify(o)).toBe('string'); // id de Qualité, pas un objet/libellé brut
        expect(findQualityById(q as string), String(q)).toBeTruthy();
      }
    });
  });

  it('ops grantCareerSkill/grantCareerTalent (talent → carrière) = réf par id qui résout (jamais un libellé)', () => {
    for (const t of talents) {
      for (const op of t.passive ?? []) {
        if (op.op === 'grantCareerSkill') expect(findSkillById(op.skillId), `${t.label}.grantCareerSkill`).toBeTruthy();
        if (op.op === 'grantCareerTalent') expect(findTalentById(op.talentId), `${t.label}.grantCareerTalent`).toBeTruthy();
      }
    }
  });

  // ── Spine des Tests : aucune compétence résolue par LIBELLÉ (multilangue) ──
  // Un Test déclenché authoré est désormais un nœud de STRUCTURE Flow (`{kind:'test', test:FlowTest}`) ;
  // ses Compétences (côté défenseur `test.skill`, côté attaquant OPPOSÉ `test.opposed.attackerSkill`)
  // sont des skillId stables. L'op `test` SUBSISTE pour les tables d'Imparfaites/Colère (miscast, code).
  // Les ops `test`/`skillMod`/`skillDRBonus` portent aussi un skillId. Tous doivent RÉSOUDRE.
  it('FlowTest.skill / FlowTest.opposed.attackerSkill / ops test·skillMod·skillDRBonus → skillId qui résout (jamais un libellé)', () => {
    const skillCarrying = [...spells, ...traits, ...maneuvers, ...qualities, ...creatures, ...stars];
    walk(skillCarrying, (o) => {
      const ids: unknown[] = [];
      if ((o.op === 'test' || o.op === 'skillMod' || o.op === 'skillDRBonus') && o.skill != null) ids.push(o.skill);
      if (o.kind === 'test' && isObj(o.test)) {
        const t = o.test as Record<string, unknown>;
        if (t.skill != null) ids.push(t.skill);
        if (isObj(t.opposed) && (t.opposed as Record<string, unknown>).attackerSkill != null) ids.push((t.opposed as Record<string, unknown>).attackerSkill);
      }
      for (const s of ids) {
        expect(typeof s, JSON.stringify(o)).toBe('string');
        expect(findSkillById(s as string), `${JSON.stringify(o)} → ${String(s)}`).toBeTruthy();
      }
    });
  });

  it('scènes : FlowTest.skill / extendedTest.skill = skillId qui résout ; corruptionExposure.skill ∈ {resistance,calme}', () => {
    walk(areneProject, (o) => {
      if (o.kind === 'test' && isObj(o.test)) {
        const s = (o.test as Record<string, unknown>).skill;
        if (s != null) expect(findSkillById(s as string), `FlowTest → ${String(s)}`).toBeTruthy();
        const hs = (o.test as Record<string, unknown>).easierIf;
        if (isObj(hs) && isObj((hs as Record<string, unknown>).hasSkill)) {
          expect(findSkillById(((hs as Record<string, unknown>).hasSkill as { id: string }).id)).toBeTruthy();
        }
      }
      if (o.type === 'extendedTest' && o.skill != null) expect(findSkillById(o.skill as string), `extendedTest → ${String(o.skill)}`).toBeTruthy();
      if (o.type === 'corruptionExposure' && o.skill != null) expect(['resistance', 'calme'], String(o.skill)).toContain(o.skill);
    });
  });

  it('skills.characteristic = CharKey stable (jamais un libellé inter-table)', () => {
    for (const s of skills) expect(CHAR_KEYS as readonly string[], `${s.label} → ${s.characteristic}`).toContain(s.characteristic);
  });

  it('talents.addCharacteristic = CharKey ou clé d\'attribut dérivé stable (jamais un libellé)', () => {
    const ok = new Set<string>([...CHAR_KEYS, 'wounds', 'fortune', 'resolve', 'move', 'corruption']);
    for (const t of talents) {
      const a = (t as { addCharacteristic?: string }).addCharacteristic;
      if (a != null) expect(ok.has(a), `${t.label} → ${a}`).toBe(true);
    }
  });

  it('domains.castBonus.perCondition = id d\'État qui résout (jamais un libellé inter-table)', () => {
    for (const d of domains) {
      const pc = (d as { castBonus?: { perCondition?: string } }).castBonus?.perCondition;
      if (pc) expect(findConditionById(pc), `${d.label} → ${pc}`).toBeTruthy();
    }
  });

  // ── Phase 3 sous-commit 1 — Spés de Corps à corps/Projectiles = id de weaponGroups.json (jamais un
  // libellé FR). skills.json/careerLevels.json/species.json/tavernGames.json/crew-roles.json/talents.json
  // sont des catalogues PC-FACING : chaque instance DOIT résoudre. `creatures.json` mélange en revanche de
  // VRAIES Spés de Groupe (armes tenues) et des DESCRIPTEURS narratifs d'attaque NATURELLE (griffes, souffle…
  // — jamais posés en `weaponGroup`/`subType` par `grantNaturalWeapon`, donc jamais comparés à rien) : la
  // liste `CREATURE_NATURAL_SPEC_WHITELIST` ci-dessous est EXHAUSTIVE (prouvée par énumération du fichier) —
  // toute nouvelle spec hors catalogue ET hors liste casse ce test (force une triage consciente).
  describe('Spés de Groupe d\'arme (Corps à corps/Projectiles) = id weaponGroups.json (Phase 3)', () => {
    const weaponSkillIds = new Set(['corps-a-corps', 'projectiles']);
    const isWeaponGroupId = (spec: string): boolean => !!findWeaponGroupById(spec) && weaponGroups.some((g) => g.id === spec);

    it('skills.json : specsSource weaponGroups → specs[] = ids connus', () => {
      for (const s of skills) {
        if (s.specsSource !== 'weaponGroups') continue;
        expect(weaponSkillIds.has(s.id), s.id).toBe(true);
        for (const spec of s.specs) { const specId = specEntryId(spec); expect(isWeaponGroupId(specId), `${s.id}.specs → ${specId}`).toBe(true); }
      }
    });

    it('careerLevels.json + species.json : refs/specOptions de corps-a-corps/projectiles = ids connus', () => {
      const walk = (node: unknown): void => {
        if (Array.isArray(node)) { node.forEach(walk); return; }
        if (!isObj(node)) return;
        const refId = (node.ref as { id?: string } | undefined)?.id;
        const refSpec = (node.ref as { spec?: string } | undefined)?.spec;
        if (refId && weaponSkillIds.has(refId) && typeof refSpec === 'string') {
          expect(isWeaponGroupId(refSpec), `ref{${refId}} → ${refSpec}`).toBe(true);
        }
        const wcId = (node.wildcard as { id?: string } | undefined)?.id;
        if (wcId && weaponSkillIds.has(wcId) && Array.isArray(node.specOptions)) {
          for (const so of node.specOptions as unknown[]) expect(isWeaponGroupId(so as string), `wildcard{${wcId}} → ${so}`).toBe(true);
        }
        for (const v of Object.values(node)) walk(v);
      };
      walk(careerLevels);
      walk(species);
    });

    it('tavernGames.json : {skill,spec} de corps-a-corps/projectiles = id connu', () => {
      for (const g of tavernGamesJson as { id: string; skill?: string; spec?: string }[]) {
        if (g.skill && weaponSkillIds.has(g.skill) && typeof g.spec === 'string') {
          expect(isWeaponGroupId(g.spec), `${g.id} → ${g.spec}`).toBe(true);
        }
      }
    });

    it('crew-roles.json : skills[].spec de corps-a-corps/projectiles = id connu', () => {
      for (const role of crewRoles) {
        for (const s of role.skills) {
          if (weaponSkillIds.has(s.skillId) && typeof s.spec === 'string') {
            expect(isWeaponGroupId(s.spec), `${role.id}.${s.skillId} → ${s.spec}`).toBe(true);
          }
        }
      }
    });

    it('talents.json : test.matches[].spec de corps-a-corps/projectiles = id connu', () => {
      for (const t of talents) {
        for (const m of t.test?.matches ?? []) {
          if (m.skill && weaponSkillIds.has(m.skill) && typeof m.spec === 'string') {
            expect(isWeaponGroupId(m.spec), `${t.id} → ${m.spec}`).toBe(true);
          }
        }
      }
    });

    it('sea-weather.json : skillMods[].spec (map skillId→spec) de projectiles = id connu', () => {
      const walk = (node: unknown): void => {
        if (Array.isArray(node)) { node.forEach(walk); return; }
        if (!isObj(node)) return;
        if (isObj(node.spec)) {
          for (const [k, v] of Object.entries(node.spec)) {
            if (weaponSkillIds.has(k) && typeof v === 'string') expect(isWeaponGroupId(v), `spec.${k} → ${v}`).toBe(true);
          }
        }
        for (const v of Object.values(node)) walk(v);
      };
      walk(seaWeatherJson);
    });

    // Descripteurs d'attaque NATURELLE (bestiaire) — PAS des Spés de Groupe (`grantNaturalWeapon` ne pose
    // jamais de `subType`, donc jamais comparés à `acceptableSpecs`). Liste EXHAUSTIVE (cf. commentaire ci-dessus).
    // Les specs d'ARMES RÉELLES mal-orthographiées (Filet/Javelot/Couteau de lancer/Shurikens/Bâton…) ont été
    // migrées vers leur id `weaponGroups` (lancer/entraves/ingenierie/poudre-noire/armes-d-hast) — cf. Source
    // frenchy.bzh (Habitants & Créatures du Vieux-Monde) + précédents trappings.json (canon-ratling=ingenierie,
    // pistolet-patte-de-griffon=poudre-noire, baton-de-combat=armes-d-hast).
    const CREATURE_NATURAL_SPEC_WHITELIST = new Set([
      'Bois', 'Cornes nasales', 'Crocs', 'Dents', 'Griffes', 'Griffes incurvées', 'Griffes recourbées',
      'Griffes recouvertes de gromril', 'Griffes semblables à des racines', 'Pinces', 'Souffle', 'Toile',
      'sans spécialisation',
    ]);

    it('creatures.json : skills[].spec de corps-a-corps/projectiles = id connu OU descripteur naturel documenté', () => {
      for (const c of creatures) {
        for (const s of c.skills) {
          if (!weaponSkillIds.has(s.id) || typeof s.spec !== 'string') continue;
          const ok = isWeaponGroupId(s.spec) || CREATURE_NATURAL_SPEC_WHITELIST.has(s.spec);
          expect(ok, `${c.id}.${s.id} → ${JSON.stringify(s.spec)} (ni id weaponGroups, ni whitelist naturelle)`).toBe(true);
        }
      }
    });
  });

  describe('specLabel/refLabel — résolution par domaine (Phase 3), FR verbatim inchangé pour le reste', () => {
    it('refLabel résout une Spé de Groupe d\'arme (weaponGroups) via son id', () => {
      expect(refLabel('skills', { id: 'corps-a-corps', spec: 'deux-mains' })).toBe('Corps à corps (Deux-mains)');
      expect(specLabel('skills', 'corps-a-corps', 'poudre-noire')).toBe(findWeaponGroupById('poudre-noire')!.label);
    });
    it('une spec NON-migrée (savoir…) reste verbatim (comportement inchangé)', () => {
      expect(specLabel('skills', 'savoir', 'Reikland')).toBe('Reikland');
      expect(refLabel('skills', { id: 'savoir', spec: 'Reikland' })).toBe('Savoir (Reikland)');
    });
    it('une spec MIGRÉE (langue/chevaucher/discretion, talent resistance) résout son id → label FR', () => {
      expect(specLabel('skills', 'langue', 'reikspiel')).toBe('Reikspiel');
      expect(refLabel('skills', { id: 'langue', spec: 'reikspiel' })).toBe('Langue (Reikspiel)');
      expect(refLabel('skills', { id: 'chevaucher', spec: 'cheval' })).toBe('Chevaucher (Cheval)');
      expect(refLabel('skills', { id: 'discretion', spec: 'urbaine' })).toBe('Discrétion (Urbaine)');
      expect(refLabel('talents', { id: 'resistance', spec: 'chaos' })).toBe('Résistance (Chaos)');
    });
  });

  // ── Phase 3 sous-commit 2 — Specs FERMÉES inline (langue/chevaucher/discretion/art, talent resistance)
  // = {id,label} ; toute instance DOIT référencer un id de sa liste fermée. `creatures.json` porte
  // quelques valeurs PRÉ-EXISTANTES non résolues (hors sources FR autorisées, ou structurellement pas un
  // id unique) — `KNOWN_UNRESOLVED` ci-dessous est EXHAUSTIVE (prouvée par énumération, cf. rapport
  // phase3-closed-specs) : toute NOUVELLE valeur hors catalogue ET hors cette liste casse ce test.
  describe('Specs FERMÉES id-based (langue/chevaucher/discretion/art, talent resistance) — Phase 3 sous-commit 2', () => {
    const CLOSED_SKILL_IDS = new Set(['langue', 'chevaucher', 'discretion', 'art']);
    const CLOSED_TALENT_ID = 'resistance';
    const isSentinel = (spec: string): boolean => spec.trim().toLowerCase() === 'au choix';
    const isKnownSpecId = (defId: string, spec: string): boolean => {
      const def = defId === CLOSED_TALENT_ID ? findTalentById(defId) : findSkillById(defId);
      return !!def?.specs?.some((s) => (typeof s === 'string' ? s : s.id) === spec);
    };
    // Non résolues (laissées verbatim par le codemod — cf. rapport pour la justification par entrée) :
    // langues hors sources FR autorisées (Arabien/Arabyan/Nehekhara/Noir Parler), montures hors sources
    // FR autorisées ou composées (Sanglier/Rat-Ogre/Rats/« Loup ou Squig »), discretion hors sources
    // autorisées ou artefact de donnée (Tous/« +6 DR grâce à Furtif »), art hors sources FR (Rédaction).
    const KNOWN_UNRESOLVED = new Set([
      'Arabien', 'Arabyan', 'Nehekhara', 'Noir Parler',
      'Sanglier', 'Rat-Ogre', 'Rats', 'Loup ou Squig',
      'Tous', '+6 DR grâce à Furtif',
      'Rédaction',
    ]);

    it('skills.json/talents.json : specs[] fermées = {id,label}, specsOpen absent', () => {
      for (const id of CLOSED_SKILL_IDS) {
        const s = findSkillById(id)!;
        expect(s.specsOpen, id).toBeFalsy();
        expect(s.specs.length > 0, id).toBe(true);
        for (const entry of s.specs) expect(isObj(entry) && typeof entry.id === 'string' && typeof entry.label === 'string', `${id} → ${JSON.stringify(entry)}`).toBe(true);
      }
      const resistance = findTalentById(CLOSED_TALENT_ID)!;
      expect(resistance.specsOpen).toBeFalsy();
      for (const entry of resistance.specs ?? []) expect(isObj(entry) && typeof (entry as { id: unknown }).id === 'string', JSON.stringify(entry)).toBe(true);
    });

    it('creatures/careerLevels/species/stars/talents : chaque spec de langue/chevaucher/discretion/art/resistance = un id de sa specs[] (sentinelle "(Au choix)" et exceptions documentées exclues)', () => {
      const check = (defId: string | undefined, spec: unknown, where: string): void => {
        if (!defId || typeof spec !== 'string') return;
        if (!CLOSED_SKILL_IDS.has(defId) && defId !== CLOSED_TALENT_ID) return;
        if (isSentinel(spec) || KNOWN_UNRESOLVED.has(spec)) return;
        expect(isKnownSpecId(defId, spec), `${where}{${defId}} → ${JSON.stringify(spec)}`).toBe(true);
      };
      const visit = (node: unknown): void => {
        if (Array.isArray(node)) { node.forEach(visit); return; }
        if (!isObj(node)) return;
        check(node.id as string | undefined, node.spec, 'id');
        check(node.skillId as string | undefined, node.spec, 'skillId');
        check(node.talentId as string | undefined, node.spec, 'talentId');
        check(node.skill as string | undefined, node.spec, 'skill');
        const wcId = (node.wildcard as { id?: string } | undefined)?.id;
        if (wcId && Array.isArray(node.specOptions)) for (const so of node.specOptions as unknown[]) check(wcId, so, 'wildcard.specOptions');
        for (const v of Object.values(node)) visit(v);
      };
      visit(creatures); visit(careerLevels); visit(species); visit(stars); visit(talents);
    });
  });
});
