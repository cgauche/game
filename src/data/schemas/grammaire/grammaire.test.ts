/**
 * Contrats de la GRAMMAIRE de document (#1466 L1a) — ce que les fabriques `document()` et `ref()`
 * garantissent PAR CONSTRUCTION, verrouillé au TYPE et au RUNTIME.
 *
 * Les cas POSITIFS sont bâtis sur des entrées RÉELLES de `src/data/*.json` (jamais un id inventé) :
 * ils prouvent du même coup que le registre généré `_ids.generated.ts` et la donnée s'accordent.
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import skillsJson from '../../skills.json';
import talentsJson from '../../talents.json';
import { document, CLES_ENVELOPPE, type Exposition } from './document';
import { ref, refs, specRef, pick, typedRef, idDe, slots, cibleDe, estSpecialisable, TYPES, type Id, type SignatureById } from './ref';
import { SANS_LIVRE } from './sans-livre';

type EntreeASpecs = { id: string; specs?: { id: string }[]; specsSource?: string };
const UNE_COMPETENCE = skillsJson[0] as { id: string };
const UNE_COMPETENCE_GROUPEE = (skillsJson as EntreeASpecs[]).find((s) => s.specs?.length)!;
const UN_TALENT_A_SPECS = (talentsJson as EntreeASpecs[]).find((t) => t.specs?.length)!;
const declareDesSpecs = (e: EntreeASpecs) => !!(e.specs?.length || e.specsSource);

const SOURCE_REELLE = { book: 'livre-de-base', page: 118 };
const EXPOSITION: Exposition = { codex: { keys: ['talents'] }, edit: { dataset: 'talents.json' } };

describe('document() — enveloppe posée par la fabrique', () => {
  const fiche = document(
    'talent',
    'entite',
    { max: z.number(), tests: z.string().optional() },
    { max: { label: 'Maximum' }, tests: { label: 'Tests', hint: 'Compétences concernées' } },
    EXPOSITION,
  );
  const DOC_COMPLET = { id: 'ambidextre', type: 'talent', label: 'Ambidextre', source: SOURCE_REELLE, max: 2 };

  it('rend un handle FERMÉ (type, famille, méta, exposition) dont le schéma parse un document complet', () => {
    expect(fiche.type).toBe('talent');
    expect(fiche.famille).toBe('entite');
    expect(fiche.meta.max.label).toBe('Maximum');
    expect(fiche.exposition).toEqual(EXPOSITION);
    expect(fiche.variantes).toEqual([]);
    expect(fiche.schema.safeParse(DOC_COMPLET).success).toBe(true);
  });

  it('refuse un champ inconnu (strictObject) et un document sans `source`', () => {
    expect(fiche.schema.safeParse({ id: 'a', type: 'talent', label: 'A', source: SOURCE_REELLE, inconnu: 1 }).success).toBe(false);
    expect(fiche.schema.safeParse({ id: 'a', type: 'talent', label: 'A', max: 2 }).success).toBe(false);
  });

  it('rend `source` optionnelle pour un type de la liste SANS LIVRE, et pour lui seul', () => {
    const [typeSansLivre] = Object.keys(SANS_LIVRE);
    const rendu = document(typeSansLivre, 'config', { valeur: z.number() }, { valeur: { label: 'Valeur' } }, EXPOSITION);
    expect(rendu.schema.safeParse({ id: 'x', type: typeSansLivre, label: 'X', valeur: 1 }).success).toBe(true);
    const typeHorsListe = 'type-jouet-hors-liste';
    expect(SANS_LIVRE[typeHorsListe]).toBeUndefined();
    const exige = document(typeHorsListe, 'config', { valeur: z.number() }, { valeur: { label: 'Valeur' } }, EXPOSITION);
    expect(exige.schema.safeParse({ id: 'x', type: typeHorsListe, label: 'X', valeur: 1 }).success).toBe(false);
    expect(exige.schema.safeParse({ id: 'x', type: typeHorsListe, label: 'X', valeur: 1, source: SOURCE_REELLE }).success).toBe(true);
  });

  it('REFUSE une clé d’enveloppe redéclarée dans `champs`, en la nommant', () => {
    expect(() =>
      // @ts-expect-error — `label` est une clé d'ENVELOPPE : le mapped type l'annule en `never`.
      document('jouet', 'entite', { label: z.string() }, { label: { label: 'Libellé' } }, EXPOSITION),
    ).toThrow(/« label » est une clé d'ENVELOPPE/);
    expect(CLES_ENVELOPPE).toContain('label');
  });

  it('REFUSE un champ sans méta d’édition, et une méta sans champ', () => {
    expect(() =>
      // @ts-expect-error — la méta de `max` manque : `MetaDesChamps` l'exige.
      document('jouet', 'entite', { max: z.number() }, {}, EXPOSITION),
    ).toThrow(/le champ « max » n'a pas de méta/);
    expect(() =>
      // @ts-expect-error — méta orpheline : aucune clé `autre` dans `champs`.
      document('jouet', 'entite', { max: z.number() }, { max: { label: 'Max' }, autre: { label: 'Autre' } }, EXPOSITION),
    ).toThrow(/méta d'édition « autre » sans champ/);
  });

  it('EXIGE une exposition Codex/éditeur déclarée (clés, ou exemption motivée)', () => {
    expect(() =>
      // @ts-expect-error — `codex` vide : ni `keys` ni `exempt`.
      document('jouet', 'entite', { max: z.number() }, { max: { label: 'Max' } }, { codex: {}, edit: { object: 'single' } }),
    ).toThrow(/`codex` exige/);
    expect(() =>
      // @ts-expect-error — `edit` vide : ni `dataset`, ni `object`, ni `none`.
      document('jouet', 'entite', { max: z.number() }, { max: { label: 'Max' } }, { codex: { keys: ['x'] }, edit: {} }),
    ).toThrow(/`edit` exige/);
    const exempte = document(
      'jouet',
      'config',
      { max: z.number() },
      { max: { label: 'Max' } },
      { codex: { exempt: { kind: 'vocabulaire-app-interne', raison: 'vocabulaire du moteur, jamais lu par le joueur' } }, edit: { none: 'dérivé' } },
    );
    expect(exempte.exposition.edit).toEqual({ none: 'dérivé' });
  });

  it('n’expose AUCUN nœud extensible en aval : `.extend` et `.shape` absents AU RUNTIME', () => {
    const nu = fiche.schema as unknown as Record<string, unknown>;
    expect(nu.extend).toBeUndefined();
    expect(nu.shape).toBeUndefined();
    expect(() =>
      // @ts-expect-error — le schéma sort en `z.ZodType` : pas d'`.extend` sur le handle.
      fiche.schema.extend({ ajout: z.string() }),
    ).toThrow();
    const parse: z.infer<typeof fiche.schema> = fiche.schema.parse(DOC_COMPLET);
    expect((parse as { max: number }).max).toBe(2);
    expect(fiche.schema.safeParse({ ...DOC_COMPLET, max: 'deux' }).success).toBe(false);
  });
});

describe('document() — variantes réglées composées par la fabrique', () => {
  const jouet = document(
    'talent',
    'entite',
    { max: z.number(), tests: z.string().optional() },
    { max: { label: 'Maximum' }, tests: { label: 'Tests' } },
    EXPOSITION,
    ['desc', 'source', 'max'],
  );
  const BASE = { id: 'ambidextre', type: 'talent', label: 'Ambidextre', source: SOURCE_REELLE, max: 2 };

  it('accepte un patch PARTIEL des champs déclarés, sous sa garde `when`', () => {
    expect(jouet.variantes).toEqual(['desc', 'source', 'max']);
    expect(jouet.schema.safeParse({ ...BASE, variants: [{ when: { rule: 'aa-group-advantage' }, max: 4 }] }).success).toBe(true);
  });

  it('REFUSE un champ hors liste, et une variante sans `when`', () => {
    expect(jouet.schema.safeParse({ ...BASE, variants: [{ when: { rule: 'r' }, tests: 'Ténacité' }] }).success).toBe(false);
    expect(jouet.schema.safeParse({ ...BASE, variants: [{ max: 4 }] }).success).toBe(false);
  });

  it('REFUSE tout `variants` à un document qui n’en déclare aucun, et un champ republiable inconnu', () => {
    const sansVariante = document('talent', 'entite', { max: z.number() }, { max: { label: 'Max' } }, EXPOSITION);
    expect(sansVariante.schema.safeParse({ ...BASE, variants: [{ when: { rule: 'r' }, max: 4 }] }).success).toBe(false);
    expect(() =>
      document('talent', 'entite', { max: z.number() }, { max: { label: 'Max' } }, EXPOSITION, ['inexistant']),
    ).toThrow(/« inexistant » est déclaré republiable/);
  });
});

describe('ref() — id validé AU PARSE contre le registre généré', () => {
  it('accepte un id RÉEL de son dataset et le brande', () => {
    const noeud = ref('skill');
    expect(noeud.safeParse({ id: UNE_COMPETENCE.id }).success).toBe(true);
    const idParse = idDe('skill').parse(UNE_COMPETENCE.id);
    const attendu: Id<'skill'> = idParse;
    expect(attendu).toBe(UNE_COMPETENCE.id);
  });

  it('REFUSE un id inventé en nommant le type, l’id et le dataset', () => {
    const res = ref('skill').safeParse({ id: 'competence-qui-n-existe-pas' });
    expect(res.success).toBe(false);
    expect(JSON.stringify(res.error?.issues)).toMatch(/ref\('skill'\).*competence-qui-n-existe-pas.*skills\.json/);
  });

  it('compose FERMÉ avec les champs du porteur (`extra`) et refuse le reste', () => {
    const possede = ref('skill', { advances: z.number() });
    expect(possede.safeParse({ id: UNE_COMPETENCE.id, advances: 3 }).success).toBe(true);
    expect(possede.safeParse({ id: UNE_COMPETENCE.id, advances: 3, value: 40 }).success).toBe(false);
  });

  it('`refs()` valide chaque id de la liste, `typedRef()` résout selon le `type` porté', () => {
    expect(refs('skill').safeParse([UNE_COMPETENCE.id]).success).toBe(true);
    expect(refs('skill').safeParse([UNE_COMPETENCE.id, 'inconnu']).success).toBe(false);
    expect(typedRef().safeParse({ type: 'skill', id: UNE_COMPETENCE.id }).success).toBe(true);
    expect(typedRef().safeParse({ type: 'talent', id: UNE_COMPETENCE.id }).success).toBe(false);
  });

  it('`pick()` accepte « n parmi » et le tirage sur table, jamais les deux', () => {
    const p = pick('skill');
    expect(p.safeParse({ pick: 1, of: [{ id: UNE_COMPETENCE.id }] }).success).toBe(true);
    expect(p.safeParse({ pick: 1, of: [{ id: UNE_COMPETENCE.id }], table: { id: 'x' } }).success).toBe(false);
  });

  it('enregistre ses slots (source de l’intégrité référentielle générique)', () => {
    expect(slots().some((s) => s.type === 'skill')).toBe(true);
    expect(cibleDe('skill')).toBe('skills.json');
  });
});

describe('specRef() — spécialisation ouverte vs pool fermé', () => {
  it('Compétence : spécialisation OUVERTE (`LDB 09 l.40`) — une spec créée passe', () => {
    expect(TYPES.skill.specsOpen).toBe(true);
    const r = specRef('skill');
    expect(r.safeParse({ id: UNE_COMPETENCE_GROUPEE.id, spec: 'une-specialisation-creee' }).success).toBe(true);
  });

  it('Talent : pool FERMÉ — une spec déclarée passe, une spec hors pool est nommée', () => {
    expect(TYPES.talent.specsOpen).toBe(false);
    const r = specRef('talent');
    expect(r.safeParse({ id: UN_TALENT_A_SPECS.id, spec: UN_TALENT_A_SPECS.specs![0].id }).success).toBe(true);
    const res = r.safeParse({ id: UN_TALENT_A_SPECS.id, spec: 'spec-hors-pool' });
    expect(res.success).toBe(false);
    expect(JSON.stringify(res.error?.issues)).toMatch(/spec-hors-pool.*talents\.json/);
  });

  it('« spec » XOR « choix » : jamais les deux, jamais aucun', () => {
    const r = specRef('skill');
    expect(r.safeParse({ id: UNE_COMPETENCE_GROUPEE.id, choix: true }).success).toBe(true);
    expect(r.safeParse({ id: UNE_COMPETENCE_GROUPEE.id, spec: 'a', choix: true }).success).toBe(false);
    expect(r.safeParse({ id: UNE_COMPETENCE_GROUPEE.id }).success).toBe(false);
  });

  it('REFUSE « spec » sur une Compétence qui n’est pas Groupée (`LDB 09 l.36-40`)', () => {
    const athletisme = (skillsJson as EntreeASpecs[]).find((s) => s.id === 'athletisme')!;
    expect(declareDesSpecs(athletisme)).toBe(false);
    expect(estSpecialisable('skill', 'athletisme')).toBe(false);
    const res = specRef('skill').safeParse({ id: 'athletisme', spec: 'bidon' });
    expect(res.success).toBe(false);
    expect(JSON.stringify(res.error?.issues)).toMatch(/ne déclare aucune spécialisation/);

    const savoir = (skillsJson as EntreeASpecs[]).find((s) => s.id === 'savoir')!;
    expect(declareDesSpecs(savoir)).toBe(true);
    expect(specRef('skill').safeParse({ id: 'savoir', spec: 'loi' }).success).toBe(true);
  });

  it('REFUSE « choix » quand l’univers de specs de l’entité est VIDE', () => {
    const aleatoire = (talentsJson as EntreeASpecs[]).find((t) => t.id === 'talent-aleatoire')!;
    expect(declareDesSpecs(aleatoire)).toBe(false);
    expect(specRef('talent').safeParse({ id: 'talent-aleatoire', choix: true }).success).toBe(false);
    expect(specRef('talent').safeParse({ id: 'talent-aleatoire', choix: [] }).success).toBe(false);
    expect(specRef('talent').safeParse({ id: 'talent-aleatoire', choix: ['x'] }).success).toBe(false);
  });

  it('un Talent à pool DÉRIVÉ (`specsSource`) est spécialisable et résout ses specs réelles', () => {
    const magie = (talentsJson as EntreeASpecs[]).find((t) => t.id === 'magie-des-arcanes')!;
    expect(magie.specsSource).toBeTruthy();
    expect(magie.specs).toBeUndefined();
    expect(estSpecialisable('talent', 'magie-des-arcanes')).toBe(true);
    expect(specRef('talent').safeParse({ id: 'magie-des-arcanes', spec: 'gueule' }).success).toBe(true);
    expect(specRef('talent').safeParse({ id: 'magie-des-arcanes', spec: 'domaine-inexistant' }).success).toBe(false);
  });
});

describe('byId — le type et l’id doivent s’accorder', () => {
  it('refuse à la COMPILATION un id d’un autre type', () => {
    const byId: SignatureById = (type, id) => `${type}:${String(id)}`;
    const idCompetence = idDe('skill').parse(UNE_COMPETENCE.id);
    expect(byId('skill', idCompetence)).toBe(`skill:${UNE_COMPETENCE.id}`);
    // @ts-expect-error — un `Id<'skill'>` n'est pas un `Id<'talent'>` (`NoInfer` fige le type).
    byId('talent', idCompetence);
  });
});
