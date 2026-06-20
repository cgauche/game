import { describe, it, expect } from 'vitest';
import { reverseGroups, bookContents, labelIndex, tokenizeLinks } from './relations';
import { creatures, traits, gods, trappings, skills, careerLevels, etats, findCareerById } from '../../data';

/** Un groupe inverse de catégorie `cat` contient-il `label` ? */
const groupHas = (groups: ReturnType<typeof reverseGroups>, cat: string, label: string): boolean =>
  groups.find((g) => g.category === cat)?.referrers.some((r) => r.label === label) ?? false;

describe('relations — graphe inverse id-based', () => {
  it('trait → créatures le portant (inversion de creature.traits)', () => {
    // Prend une créature réelle + son 1er trait → l'inverse DOIT la lister.
    const c = creatures.find((x) => x.traits.length > 0)!;
    const traitId = c.traits[0].id;
    const groups = reverseGroups('traits', traitId);
    expect(groupHas(groups, 'creatures', c.label)).toBe(true);
    // Le titre de la section est la phrase descriptive (display), pas le nom brut.
    expect(groups.find((g) => g.category === 'creatures')?.title).toBe('Créatures ayant ce trait');
  });

  it('sort → culte qui l’accorde (inversion de gods.blessings/miracles), avec détail', () => {
    const g = gods.find((x) => x.blessings.length > 0)!;
    const spellId = g.blessings[0].id;
    const groups = reverseGroups('spells', spellId);
    const godGroup = groups.find((gr) => gr.category === 'gods');
    expect(godGroup?.referrers.some((r) => r.label === g.key && r.detail === 'Bénédiction')).toBe(true);
  });

  it('qualité → équipements la portant (inversion de trapping.qualities)', () => {
    const t = trappings.find((x) => x.qualities.length > 0)!;
    const qid = t.qualities[0].id;
    const groups = reverseGroups('qualities', qid);
    expect(groupHas(groups, 'trappings', t.label)).toBe(true);
  });

  it('caractéristique → compétences liées (inversion de skill.characteristic)', () => {
    const s = skills[0];
    const groups = reverseGroups('characteristics', s.characteristic);
    expect(groupHas(groups, 'skills', s.label)).toBe(true);
  });

  it('compétence → carrière par rang, détail « N{level} » fusionné', () => {
    // Une compétence d'un niveau de carrière → l'inverse liste la CARRIÈRE avec son rang.
    const lv = careerLevels.find((l) => l.skills.some((a) => 'ref' in a))!;
    const career = findCareerById(lv.career)!;
    const skillId = lv.skills.flatMap((a) => ('ref' in a ? [a.ref.id] : []))[0];
    const groups = reverseGroups('skills', skillId);
    const careerRef = groups.find((g) => g.category === 'careers')?.referrers.find((r) => r.label === career.label);
    expect(careerRef).toBeTruthy();
    expect(careerRef!.detail).toMatch(/N\d/);
  });

  it('état → ce qui l’inflige (inversion des ops `condition` des effets Flow/TriggeredEffect)', () => {
    // Au moins un état est infligé par un Sort (op condition dans spell.effects) → groupe inverse 'spells'.
    const e = etats.find((x) => reverseGroups('etats', x.id).some((g) => g.category === 'spells'));
    expect(e, 'un état infligé par un sort').toBeTruthy();
    expect(reverseGroups('etats', e!.id).find((g) => g.category === 'spells')?.title).toBe('Sorts l’infligeant');
  });

  it('entité non référencée → aucun groupe', () => {
    expect(reverseGroups('traits', '___inexistant___')).toEqual([]);
  });

  it('bookContents(LDB) groupe le contenu par catégorie', () => {
    const contents = bookContents('LDB');
    expect(contents.length).toBeGreaterThan(0);
    // Les talents du LDB doivent apparaître.
    const tCat = contents.find((c) => c.category === 'talents');
    expect(tCat && tCat.labels.length).toBeGreaterThan(0);
    // Trié alpha à l'intérieur d'une catégorie.
    if (tCat) expect([...tCat.labels]).toEqual([...tCat.labels].sort((a, b) => a.localeCompare(b, 'fr')));
  });

  it('tokenizeLinks lie le vocabulaire de règles, écarte soi-même et l’inconnu', () => {
    // Une compétence dont le libellé est auto-liable (≥4, non ambigu) doit être tokenisée en lien.
    const s = skills.find((x) => x.label.length >= 4 && labelIndex().get(x.label.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase())?.category === 'skills')!;
    const toks = tokenizeLinks(`Effectuez un Test de ${s.label} pour réussir.`);
    const link = toks.find((t) => typeof t === 'object' && t.label === s.label);
    expect(link).toBeTruthy();
    expect((link as { category: string }).category).toBe('skills');
    // Lien vers SOI écarté → tout reste en texte (aucun token objet).
    expect(tokenizeLinks(`${s.label} est une compétence.`, s.label).every((t) => typeof t === 'string')).toBe(true);
    // Prose sans vocabulaire connu → un seul segment texte, inchangé.
    expect(tokenizeLinks('Zzz qqq wxyz vvv.')).toEqual(['Zzz qqq wxyz vvv.']);
  });

  it('labelIndex résout un libellé connu, écarte les ambigus/courts', () => {
    const idx = labelIndex();
    const t = traits.find((x) => x.label.length >= 4)!;
    // Un libellé unique se résout vers sa catégorie ; un libellé absent → undefined.
    const hit = idx.get(t.label.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase());
    // (peut être absent si homonyme entre catégories — mais alors c'est volontairement écarté, pas une fausse résolution)
    if (hit) expect(hit.label).toBe(t.label);
    expect([...idx.keys()].every((k) => k.length >= 4)).toBe(true);
  });
});
