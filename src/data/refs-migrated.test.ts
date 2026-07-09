/**
 * Garde-fou INVARIANT (multilangue) : les champs de référence migrés ne contiennent QUE des refs
 * STRUCTURÉES (par id), jamais de libellé brut, et les ids de catalogue résolvent. Toute régression
 * (un libellé qui se faufile, un id fantôme) casse ici. Cf. [[game-ids-internes-libelles-display-multilangue]].
 */
import { describe, it, expect } from 'vitest';
import {
  trappings, qualities, spells, creatures, classes, careers, careerLevels, species, gods, etats, maladies, weaponGroups,
  traits, stars, talents, maneuvers, skills, domains, crewRoles,
  findSkillById, findTalentById, findTrappingById, findTrappingByLabel, findQualityById, findSpellById, findSeaShantyById,
  findCareerById, findClassById, findSpeciesById, findConditionById, findDiseaseById, findWeaponGroupById, findSymptomById,
  findCreatureById, findVehicleById,
  specLabel, refLabel, specEntryId, specEntryLabel, SPEC_SOURCES, type SpecsSource,
} from './index';
import { itemFromTrappingById } from '../engine/items';
import { COND } from '../engine/conditions';
import { DISEASES } from '../engine/disease';
import pregensJson from './pregens.json';
import { makePregens } from './pregens';
import interludeEventsJson from './interludeEvents.json';
import tavernGamesJson from './tavernGames.json';
import seaWeatherJson from './sea-weather.json';
import areneProject from '../scenes/arene/arene-projet.json';
import loupProject from '../scenes/loup-et-saumure/loup-et-saumure-projet.json';
import { SCENARIOS } from '../scenes/test-scenarios/_registry.generated';
import { creatureSpeciesOptions } from '../gameIso/rig/creatures';
import { wardrobeKeyResolves } from '../gameIso/rig/parts/career';
import { CHAR_KEYS } from '../engine/types';

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x != null;

describe('refs migrées — refs structurées par id, zéro libellé résiduel', () => {
  it('trappings.qualities = QualityRef[] {id} qui résout (id stable)', () => {
    for (const t of trappings) for (const q of t.qualities) {
      expect(isObj(q)).toBe(true);
      expect(findQualityById(q.id)).toBeTruthy();
    }
  });

  it('trappings.subType = weaponGroupId qui résout (jamais un libellé brut) — y compris derivedWeapon.subType imbriqué', () => {
    const groupIds = new Set(weaponGroups.map((g) => g.id));
    for (const t of trappings) {
      if (t.subType != null) {
        expect(groupIds.has(t.subType), `${t.label} → ${t.subType}`).toBe(true);
        expect(findWeaponGroupById(t.subType)).toBeTruthy();
      }
      // derivedWeapon (prothèse-arme, ex. Crochet) PORTE SON PROPRE subType — un libellé y échappait
      // au garde-fou ci-dessus (Crochet.derivedWeapon.subType: "Base" au lieu de l'id "base").
      const dwSubType = t.derivedWeapon?.subType;
      if (dwSubType != null) {
        expect(groupIds.has(dwSubType), `${t.label}.derivedWeapon → ${dwSubType}`).toBe(true);
      }
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
      for (const o of c.optionals) expect(isObj(o)).toBe(true); // OptionalEntry : TraitInstance OU note composée (#174)
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

  // ── Phase 3 — sanité de CATALOGUE (structure des defs skills.json/talents.json) : ces quelques
  // `it` fixent des exemples représentatifs de chaque MÉCANISME de specsSource/specsOpen. La
  // RÉSOLUTION EXHAUSTIVE de toutes les INSTANCES (creatures/careerLevels/species/…) est déléguée à
  // LA GARDE UNIQUE ci-dessous (§ Phase 3 complétude) — plus de liste de domaines à maintenir ici.
  describe('sanité de catalogue — specsSource déclaré, specs[] bien formées (Phase 3)', () => {
    it('skills.json/talents.json : specsSource migré → pool DÉRIVÉ (aucun specs[] inline), ids connus du registre', () => {
      const WEAPON_GROUP_IDS = new Set(weaponGroups.map((g) => g.id));
      const DOMAIN_IDS = new Set(domains.map((d) => d.id));
      const GOD_IDS = new Set(gods.map((g) => g.id));
      const cases: [ 'skills' | 'talents', string, SpecsSource, (id: string) => boolean ][] = [
        ['skills', 'corps-a-corps', 'weaponGroupsMelee', (id) => WEAPON_GROUP_IDS.has(id)],
        ['skills', 'projectiles', 'weaponGroupsRanged', (id) => WEAPON_GROUP_IDS.has(id)],
        ['skills', 'focalisation', 'winds', (id) => DOMAIN_IDS.has(id)],
        ['talents', 'magie-des-arcanes', 'arcaneDomains', (id) => DOMAIN_IDS.has(id)],
        ['talents', 'invocation', 'cultMiracles', (id) => GOD_IDS.has(id)],
        ['talents', 'magie-du-chaos', 'cultChaos', (id) => GOD_IDS.has(id)],
        ['talents', 'beni', 'cultBlessings', (id) => GOD_IDS.has(id)],
        ['talents', 'chanson-de-marin', 'seaShanties', (id) => !!findSeaShantyById(id)],
      ];
      for (const [cat, id, source, ok] of cases) {
        const def = cat === 'skills' ? findSkillById(id) : findTalentById(id);
        expect(def, id).toBeTruthy();
        expect(def!.specsSource, id).toBe(source);
        // Le pool DÉRIVE du registre (SPEC_SOURCES) : plus aucune liste `specs[]` maintenue à la main.
        expect(def!.specs, `${id} ne doit PAS porter de specs[] inline`).toBeUndefined();
        const pool = SPEC_SOURCES[source].pool();
        expect(pool.length, `${id} : pool vide`).toBeGreaterThan(0);
        for (const specId of pool) expect(ok(specId), `${id} → ${specId} inconnu du registre`).toBe(true);
      }
    });

    it('domaines FERMÉS inline (ex. langue/chevaucher/discretion/art/musicien/voile, talents resistance/sens-aiguise) : specs[] = {id,label}, specsOpen absent', () => {
      for (const id of ['langue', 'chevaucher', 'discretion', 'art', 'musicien', 'voile']) {
        const s = findSkillById(id)!;
        expect(s.specsOpen, id).toBeFalsy();
        expect((s.specs?.length ?? 0) > 0, id).toBe(true);
        for (const entry of s.specs ?? []) expect(isObj(entry) && typeof entry.id === 'string' && typeof entry.label === 'string', `${id} → ${JSON.stringify(entry)}`).toBe(true);
      }
      for (const id of ['resistance', 'sens-aiguise', 'artiste']) {
        const t = findTalentById(id)!;
        expect(t.specsOpen, id).toBeFalsy();
        for (const entry of t.specs ?? []) expect(isObj(entry) && typeof (entry as { id: unknown }).id === 'string', `${id} → ${JSON.stringify(entry)}`).toBe(true);
      }
    });

    it('domaines OUVERTS (ex. savoir/metier/divertissement/signes-secrets) : specsOpen:true, specs[] = {id,label}[]', () => {
      for (const id of ['savoir', 'metier', 'divertissement', 'dressage', 'representation', 'signes-secrets']) {
        const s = findSkillById(id)!;
        expect(s.specsOpen, id).toBe(true);
        expect((s.specs?.length ?? 0) > 0, id).toBe(true);
        for (const entry of s.specs ?? []) expect(isObj(entry) && typeof entry.id === 'string' && typeof entry.label === 'string', `${id} → ${JSON.stringify(entry)}`).toBe(true);
      }
      for (const id of ['bon-marcheur', 'haine', 'maitre-artisan', 'sans-peur', 'savant', 'savoir-vivre', 'travailleur-qualifie', 'vice']) {
        const t = findTalentById(id)!;
        expect(t.specsOpen, id).toBe(true);
        for (const entry of t.specs ?? []) expect(isObj(entry) && typeof (entry as { id: unknown }).id === 'string', `${id} → ${JSON.stringify(entry)}`).toBe(true);
      }
    });
  });

  describe('specLabel/refLabel — résolution par domaine (Phase 3), FR verbatim inchangé pour le reste', () => {
    it('refLabel résout une Spé de Groupe d\'arme (weaponGroups) via son id', () => {
      expect(refLabel('skills', { id: 'corps-a-corps', spec: 'deux-mains' })).toBe('Corps à corps (Deux-mains)');
      expect(specLabel('skills', 'corps-a-corps', 'poudre-noire')).toBe(findWeaponGroupById('poudre-noire')!.label);
    });
    it('une spec ouverte hors catalogue (savoir…) reste verbatim (texte libre toléré)', () => {
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
    it('une spec de domaine Phase 3 complétude (musicien/sens-aiguise/chanson-de-marin) résout son id → label FR', () => {
      expect(specLabel('skills', 'musicien', 'tambour')).toBe('Tambour');
      expect(refLabel('talents', { id: 'sens-aiguise', spec: 'gout' })).toBe('Sens aiguisé (Goût)');
      expect(refLabel('talents', { id: 'chanson-de-marin', spec: 'jacques-bret-a-rencontre-notre-acier' }))
        .toBe('Chanson de marin (Jacques Bret a rencontré notre acier sur les mers !)');
    });
  });

  // ── GARDE EXHAUSTIVE (Phase 3 complétude) — remplace TOUTES les gardes par-domaine ci-dessus/passées.
  // Construit AUTOMATIQUEMENT, à partir de skills.json/talents.json eux-mêmes, l'ensemble des ids valides
  // de CHAQUE def à `specs` non vide (`specEntryId` — id inline OU id mirroré d'un `specsSource`) ; parcourt
  // ENSUITE toutes les données (y compris skills.json/talents.json EUX-MÊMES pour les auto-références —
  // passive/test.matches d'un talent vers un AUTRE domaine, ex. Oreille absolue → Divertissement) et les
  // pré-tirés RUNTIME (`makePregens()`, via import). AUCUNE exception silencieuse :
  //  - domaine FERMÉ (`specsOpen` absent/falsy) : toute instance DOIT résoudre à un id connu (ou la
  //    sentinelle « (Au choix) », ou — SEUL report explicite conservé — un descripteur d'attaque NATURELLE
  //    du bestiaire pour corps-a-corps/projectiles, cf. whitelist historique) ; sinon le test ÉCHOUE.
  //  - domaine OUVERT (`specsOpen:true`) : une instance DOIT être soit un id connu, soit un texte
  //    GENUINEMENT hors catalogue (texte libre toléré) — mais SI son normalisé correspond à un libellé
  //    FR CONNU de sa `specs[]`, c'est une RÉGRESSION de migration (devrait être l'id) → le test ÉCHOUE.
  // Ajouter un domaine à `specs[]` = automatiquement couvert ici ; plus JAMAIS besoin d'étendre une liste.
  describe('GARDE EXHAUSTIVE — toute compétence/talent à specs[] non vide (Phase 3 complétude)', () => {
    const norm = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    const isSentinel = (s: string): boolean => norm(s) === 'au choix';

    const ALL_SPEC_DEFS = [...skills, ...talents].filter((d) => d.specsSource || (Array.isArray(d.specs) && d.specs.length > 0));
    const CLOSED = new Map<string, Set<string>>();
    const OPEN = new Map<string, { ids: Set<string>; byLabel: Map<string, string> }>();
    // Def à `specsSource` : la VALIDITÉ d'une spéc = `SPEC_SOURCES[src].resolves(id)` (l'id existe dans le
    // registre sous-jacent), un sur-ensemble du pool joueur `pool()` — un statbloc RAW peut porter une spéc
    // réelle hors du pool choisissable (Triton). Séparé de CLOSED (specs[] inline énuméré).
    const SOURCE_OF = new Map<string, keyof typeof SPEC_SOURCES>();
    for (const def of ALL_SPEC_DEFS) {
      if (def.specsSource) { SOURCE_OF.set(def.id, def.specsSource); continue; }
      const ids = new Set(def.specs!.map((e) => specEntryId(e)));
      if (def.specsOpen) OPEN.set(def.id, { ids, byLabel: new Map(def.specs!.map((e) => [norm(specEntryLabel(e)), specEntryId(e)])) });
      else CLOSED.set(def.id, ids);
    }

    // Descripteurs d'attaque NATURELLE du bestiaire (corps-a-corps/projectiles) — PAS des Spés de Groupe
    // (`grantNaturalWeapon` ne pose jamais de `subType`/`weaponGroup`, donc jamais comparés à rien).
    // Liste EXHAUSTIVE (prouvée par énumération de creatures.json) — cf. historique Phase 3 sous-commit 1.
    const CREATURE_NATURAL_SPEC_WHITELIST = new Set([
      'Bois', 'Cornes nasales', 'Crocs', 'Dents', 'Griffes', 'Griffes incurvées', 'Griffes recourbées',
      'Griffes recouvertes de gromril', 'Griffes semblables à des racines', 'Pinces', 'Souffle', 'Toile',
      'sans spécialisation',
    ]);
    const NATURAL_WEAPON_SKILLS = new Set(['corps-a-corps', 'projectiles']);

    const unresolved: string[] = [];
    function checkSpec(defId: string, spec: unknown, where: string, inCreatures: boolean): void {
      if (typeof spec !== 'string' || isSentinel(spec)) return;
      const source = SOURCE_OF.get(defId);
      if (source) {
        // VALIDITÉ = l'id résout dans le REGISTRE de la source (⊇ pool joueur) : couvre les statblocs RAW hors
        // pool (le Triton FOCALISE « magie-des-mers-de-triton », un domaine RÉEL non choisissable par un PC).
        // Data-driven, plus aucune exception au cas par cas.
        if (SPEC_SOURCES[source].resolves(spec)) return;
        // Descripteurs d'attaque naturelle (Crocs/Griffes…) posés en `spec` de corps-a-corps/projectiles : pas
        // des Groupes d'arme (`grantNaturalWeapon` ne les compare jamais) → tolérés.
        if (inCreatures && NATURAL_WEAPON_SKILLS.has(defId) && CREATURE_NATURAL_SPEC_WHITELIST.has(spec)) return;
        unresolved.push(`${where} : ${defId} → ${JSON.stringify(spec)} (specsSource ${source}, id inconnu du registre)`);
        return;
      }
      const closedIds = CLOSED.get(defId);
      if (closedIds) {
        if (closedIds.has(spec)) return;
        unresolved.push(`${where} : ${defId} → ${JSON.stringify(spec)} (FERMÉ, id inconnu de specs[])`);
        return;
      }
      const open = OPEN.get(defId);
      if (open) {
        if (open.ids.has(spec)) return; // déjà un id
        const knownId = open.byLabel.get(norm(spec));
        if (knownId) unresolved.push(`${where} : ${defId} → ${JSON.stringify(spec)} (OUVERT, libellé FR CONNU non migré — devrait être « ${knownId} »)`);
        // sinon texte libre GENUINEMENT hors catalogue — toléré (domaine OUVERT).
      }
    }
    function walk(node: unknown, where: string, inCreatures: boolean): void {
      if (Array.isArray(node)) { node.forEach((x) => walk(x, where, inCreatures)); return; }
      if (!isObj(node)) return;
      const idLike = (node.id ?? node.skillId ?? node.talentId ?? node.skill) as string | undefined;
      if (typeof idLike === 'string') {
        if (isObj(node.spec)) { for (const [k, v] of Object.entries(node.spec)) checkSpec(k, v, `${where}.spec{${k}}`, inCreatures); }
        else checkSpec(idLike, node.spec, where, inCreatures);
      }
      const wcId = (node.wildcard as { id?: string } | undefined)?.id;
      if (wcId && Array.isArray(node.specOptions)) for (const so of node.specOptions as unknown[]) checkSpec(wcId, so, `${where}.wildcard{${wcId}}.specOptions`, inCreatures);
      for (const v of Object.values(node)) walk(v, where, inCreatures);
    }

    it('creatures/careerLevels/species/stars/traits/trappings/talents/skills/crewRoles/tavernGames/seaWeather/pregens(runtime) : toute spec resout (fermé) ou id/texte-libre valide (ouvert)', () => {
      walk(creatures, 'creatures', true);
      walk(careerLevels, 'careerLevels', false);
      walk(species, 'species', false);
      walk(stars, 'stars', false);
      walk(traits, 'traits', false);
      walk(trappings, 'trappings', false);
      walk(talents, 'talents(self-réf)', false); // ex. Oreille absolue.passive → Divertissement (Chant)
      walk(skills, 'skills(self-réf)', false);
      walk(crewRoles, 'crewRoles', false);
      walk(tavernGamesJson, 'tavernGames', false);
      walk(seaWeatherJson, 'seaWeather', false);
      walk(makePregens(), 'pregens(runtime — makePregens)', false); // composition réelle career/species → Combatant
      expect(unresolved, unresolved.join('\n')).toEqual([]);
    });
  });
});

// ── GARDE DE CLASSE — `appearance.species` = id STABLE, jamais un LIBELLÉ. Le champ route (1) le PLAN de
// rig par lookup EXACT `defById` dans DEF_BY_ID et (2) la RACE par `baseSpeciesOf` : un libellé n'y résout
// dans aucun registre exact et vit d'un défaut silencieux. Vocabulaire CANONIQUE = ids de species.json
// (espèces jouables) ∪ ids de def rig (creatureSpeciesOptions). `species` absent = OK (défaut Humain
// documenté). Cf. [[game-ids-internes-libelles-display-multilangue]].
describe('appearance.species — id stable (species.json ∪ defs rig), jamais un libellé', () => {
  const VALID_SPECIES = new Set<string>([...species.map((s) => s.id), ...creatureSpeciesOptions().map((o) => o.id)]);
  function collect(node: unknown, where: string, out: string[]): void {
    if (Array.isArray(node)) { node.forEach((x, i) => collect(x, `${where}[${i}]`, out)); return; }
    if (!isObj(node)) return;
    const app = node.appearance;
    if (isObj(app) && typeof app.species === 'string' && !VALID_SPECIES.has(app.species))
      out.push(`${where}.appearance.species = ${JSON.stringify(app.species)}`);
    for (const [k, v] of Object.entries(node)) collect(v, `${where}.${k}`, out);
  }

  it('projets Arène + Loup-et-Saumure : tout appearance.species est une clé exacte de species.json ∪ defs rig', () => {
    const bad: string[] = [];
    collect(areneProject, 'arene-projet.json', bad);
    collect(loupProject, 'loup-et-saumure-projet.json', bad);
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('scénarios de test (scene + extraScenes + party) : tout appearance.species résout dans le vocabulaire', () => {
    const bad: string[] = [];
    for (const s of SCENARIOS) {
      collect(s.scene, `${s.id}.scene`, bad);
      if (s.extraScenes) collect(s.extraScenes, `${s.id}.extraScenes`, bad);
      collect(s.makeParty(), `${s.id}.party`, bad);
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });
});

// ── SWEEP DE RÉFÉRENCES DE SCÈNE (#223, même walk que la garde species) — chaque `SceneEntity` d'un
// projet/scénario doit avoir des refs qui RÉSOLVENT au chargement, sinon repli silencieux/bruyant :
//  - `personnage`.ref → créature ∪ véhicule (coque) ∪ engin de siège (trapping siegeRig), les 3 familles
//    légitimes du spawn (`spawnEnemy`) ; `undefined` (statbloc/générique) toléré.
//  - `weapon` (libellé d'authoring) → `findTrappingByLabel` (arme du catalogue).
//  - `appearance.tenue` (garde-robe authorée) → carrière ∪ classe ∪ tenue (`wardrobeKeyResolves`).
// `appearance.career` n'existe PAS au schéma `EntityAppearance` (champ mort, ignoré au rendu) : signalé
// à part (report d'authoring, corrigé par le passage campagne) — pas de garde dure sur de la donnée hors
// périmètre. Toute violation ci-dessus = `fichier/entité/valeur`.
describe('refs de scène — ref/weapon/tenue résolvent au catalogue (#223)', () => {
  const refResolves = (ref: string): boolean =>
    !!findCreatureById(ref) || !!findVehicleById(ref)?.hull || !!findTrappingById(ref)?.siegeRig;
  const ENTITY_KINDS = new Set(['heroStart', 'personnage', 'prop']);
  function sweep(node: unknown, where: string, out: string[]): void {
    if (Array.isArray(node)) { node.forEach((x, i) => sweep(x, `${where}[${i}]`, out)); return; }
    if (!isObj(node)) return;
    if (typeof node.kind === 'string' && ENTITY_KINDS.has(node.kind) && isObj(node.pos)) {
      const who = `${where}(${node.id ?? node.label ?? node.kind})`;
      if (node.kind === 'personnage' && typeof node.ref === 'string' && !refResolves(node.ref))
        out.push(`${who}.ref = ${JSON.stringify(node.ref)} (ni créature ∪ véhicule ∪ engin de siège)`);
      if (typeof node.weapon === 'string' && !findTrappingByLabel(node.weapon))
        out.push(`${who}.weapon = ${JSON.stringify(node.weapon)} (hors catalogue d'armes)`);
      const app = node.appearance;
      if (isObj(app) && typeof app.tenue === 'string' && !wardrobeKeyResolves(app.tenue))
        out.push(`${who}.appearance.tenue = ${JSON.stringify(app.tenue)} (ni carrière ∪ classe ∪ tenue)`);
    }
    for (const [k, v] of Object.entries(node)) sweep(v, `${where}.${k}`, out);
  }

  // Projets de campagne : SWEEP-et-REPORT (bruyant) — la donnée d'authoring de campagne est hors
  // périmètre moteur (corrigée par le passage campagne). On la parcourt et on HURLE toute violation en
  // console, sans garde dure (un projet en dette ne bloque pas le tronc ; la dette est visible + listée).
  it('projets Arène + Loup-et-Saumure : ref/weapon/tenue swept, violations reportées en console', () => {
    const bad: string[] = [];
    sweep(areneProject, 'arene-projet.json', bad);
    sweep(loupProject, 'loup-et-saumure-projet.json', bad);
    for (const v of bad) console.warn(`[sweep #223] ${v}`);
  });

  it('scénarios de test (scene + extraScenes + party) : ref/weapon/tenue de chaque entité résolvent', () => {
    const bad: string[] = [];
    for (const s of SCENARIOS) {
      sweep(s.scene, `${s.id}.scene`, bad);
      if (s.extraScenes) sweep(s.extraScenes, `${s.id}.extraScenes`, bad);
      sweep(s.makeParty(), `${s.id}.party`, bad);
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });
});

// ── GARDE DE CLASSE (#222) — anti-copie-périmée des POSTES d'artillerie. Un `ShipPoste` AUTHORÉ ne porte que
// sa RÉF catalogue (`trappingId`) ; la base (Dégâts/Qualités/Enc/Portée) est HYDRATÉE au spawn (`hydratePoste`
// → `itemFromTrappingById`), JAMAIS matérialisée dans la donnée de scène (qui dériverait du catalogue).
//  - INVARIANT DUR (toutes scènes) : un poste NEUF (`trappingId` au niveau du poste) NE porte AUCUNE base
//    copiée (`item`/`damage`/`qualities`/`enc`…) et sa réf RÉSOUT au catalogue.
//  - REPORT (projets de campagne, précédent #223) : un poste en forme ANCIENNE (`item` complet copié) est une
//    DETTE de pré-migration — HURLÉE en console (le passage campagne régénère) mais reste HYDRATABLE.
describe('postes d’artillerie — réf catalogue hydratée, jamais une base copiée (#222)', () => {
  const BASE_FIELDS = ['item', 'damage', 'qualities', 'enc', 'range', 'reach', 'pa'] as const;
  const walkPostes = (node: unknown, where: string, visit: (poste: Record<string, unknown>, where: string) => void): void => {
    if (Array.isArray(node)) { node.forEach((x, i) => walkPostes(x, `${where}[${i}]`, visit)); return; }
    if (!isObj(node)) return;
    if (Array.isArray(node.postes)) node.postes.forEach((p, i) => { if (isObj(p)) visit(p, `${where}.postes[${i}]`); });
    for (const [k, v] of Object.entries(node)) walkPostes(v, `${where}.${k}`, visit);
  };

  it('INVARIANT DUR — tout poste NEUF (`trappingId`) résout au catalogue et NE matérialise aucune base', () => {
    const bad: string[] = [];
    const hard = (p: Record<string, unknown>, where: string): void => {
      if (typeof p.trappingId !== 'string') return; // forme ancienne (item) → report ci-dessous
      if (!findTrappingById(p.trappingId)) bad.push(`${where} : trappingId « ${p.trappingId} » inconnu du catalogue`);
      for (const f of BASE_FIELDS) if (f in p) bad.push(`${where} : « ${f} » copié alors qu'hydratable de « ${p.trappingId} » (base interdite en donnée, #222)`);
    };
    walkPostes(areneProject, 'arene-projet.json', hard);
    walkPostes(loupProject, 'loup-et-saumure-projet.json', hard);
    for (const s of SCENARIOS) {
      walkPostes(s.scene, `${s.id}.scene`, hard);
      if (s.extraScenes) walkPostes(s.extraScenes, `${s.id}.extraScenes`, hard);
      walkPostes(s.makeParty(), `${s.id}.party`, hard);
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('REPORT #223 — postes en forme ANCIENNE (item copié) des projets : dette hurlée, réf HYDRATABLE au spawn', () => {
    const stale: string[] = [];
    walkPostes(areneProject, 'arene-projet.json', (p, where) => { if (typeof p.trappingId !== 'string' && isObj(p.item)) stale.push(where); });
    walkPostes(loupProject, 'loup-et-saumure-projet.json', (p, where) => { if (typeof p.trappingId !== 'string' && isObj(p.item)) stale.push(where); });
    for (const v of stale) console.warn(`[garde #222] ${v} : base copiée (item complet) — migrée par hydratePoste au spawn`);
    const check = (p: Record<string, unknown>, where: string): void => {
      if (typeof p.trappingId === 'string' || !isObj(p.item)) return;
      const nested = (p.item as Record<string, unknown>).trappingId;
      expect(typeof nested === 'string' && !!itemFromTrappingById(nested), `${where} : réf ancienne « ${String(nested)} » non hydratable`).toBe(true);
    };
    walkPostes(areneProject, 'arene-projet.json', check);
    walkPostes(loupProject, 'loup-et-saumure-projet.json', check);
  });
});
