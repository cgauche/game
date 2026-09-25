// Banc du résolveur de renvois (#1393) sur le CRB RÉEL (`core-rulebook-5e`), lu par le lecteur fs.
// Chaque cas se désigne par son CHAPITRE et un fragment de sa PHRASE, jamais par un numéro de ligne.
import { describe, it, expect } from 'vitest';
// @ts-expect-error - lecteur ESM JS (pas de types) — même convention que `vite.config.ts`
import { chapitresParses } from '../../../scripts/source/lecteur-fs.mjs';
import { parseChapitre, resoudreAdresse } from './decoupe.ts';
import { indexerLivre, renvoisDe, renvoisDuLivre, resoudreRenvoi, type RenvoiDuLivre } from './renvoi.ts';

const CRB = 'core-rulebook-5e';
const livre = indexerLivre(CRB, 'VO', chapitresParses(CRB));
const tous = renvoisDuLivre(livre);

/** LE renvoi du chapitre `ch` vers `folio` dont la phrase contient `fragment`. */
function site(ch: string, folio: number, fragment: string): RenvoiDuLivre {
  const hits = tous.filter((r) => r.fichier.startsWith(`${ch} - `) && r.renvoi.folio === folio && r.renvoi.phrase.includes(fragment));
  expect(hits, `${ch} p.${folio} « ${fragment} »`).toHaveLength(1);
  return hits[0];
}

/** Chapitre et section visés par une résolution, et preuve que l'adresse se RÉSOUT au texte. */
function cible(r: RenvoiDuLivre): { ch: string; sec: string; secOcc: number } {
  const ref = r.resolution.cible;
  expect(ref, `${r.fichier} p.${r.renvoi.folio} : ${r.resolution.niveau}`).not.toBeNull();
  const chapitre = livre.chapitres.get([...livre.chapitres.keys()].find((f) => f.startsWith(`${ref!.ch} - `))!)!;
  expect(resoudreAdresse(chapitre, ref!)).not.toHaveProperty('error');
  const [frag] = ref!.parts;
  return { ch: ref!.ch, sec: frag.sec, secOcc: frag.secOcc };
}

describe('renvoisDe — motifs VO', () => {
  it('rend le folio, la fin de plage, la clause et la phrase', () => {
    const [r] = renvoisDe('After attacking, you may spend Momentum (page 168) to attack again.', 'VO');
    expect(r).toMatchObject({ folio: 168, fin: null, clause: 'After attacking, you may spend Momentum ' });
    expect(r.phrase).toBe('After attacking, you may spend Momentum (page 168) to attack again.');
  });

  it('lit les quatre formes de plage : demi-cadratin, trait d’union, « and », « to »', () => {
    const fins = (t: string) => renvoisDe(t, 'VO').map((r) => [r.folio, r.fin]);
    expect(fins('Traits (see pages 356–361)')).toEqual([[356, 361]]);
    expect(fins('Traits (see pages 356-361)')).toEqual([[356, 361]]);
    expect(fins('Animosity (see page 183 and 356)')).toEqual([[183, 356]]);
    expect(fins('rules on pages 12 to 14')).toEqual([[12, 14]]);
  });

  it('borne la clause au renvoi précédent et à la parenthèse close qui le précède', () => {
    const [a, b] = renvoisDe('under *Advance Career* (page 196) and *Change Career* (page 197) Endeavours', 'VO');
    expect(a.clause).toBe('under *Advance Career* ');
    expect(b.clause).toBe(' and *Change Career* ');
    const [c] = renvoisDe('Toughness Bonus (doubled), and the *Hardy* Talent (see page 40).', 'VO');
    expect(c.clause).toBe(', and the *Hardy* Talent ');
  });

  it('une LISTE de pages rend un renvoi par page, liaison après la virgule comprise', () => {
    const pages = (t: string) => renvoisDe(t, 'VO').map((r) => [r.folio, r.fin]);
    expect(pages('- **Weapons:** Page 301, 303')).toEqual([[301, null], [303, null]]);
    expect(pages('For more on Movement, see page 156, and 162 for moving in comabt.')).toEqual([[156, null], [162, null]]);
    const [a, b] = renvoisDe('- **Weapons:** Page 301, 303', 'VO');
    expect(b.clause).toBe(a.clause);
  });

  it('une cellule de table borne la clause', () => {
    expect(renvoisDe('| 95–98 | Dwarf (page 30)    |', 'VO')[0].clause).toBe(' Dwarf ');
  });

  it('une langue sans motifs est une erreur, jamais un texte sans renvoi', () => {
    expect(() => renvoisDe('voir page 12', 'VF')).toThrow(/VF/);
  });
});

describe('resoudreRenvoi — cas canoniques du CRB', () => {
  it('036 « spend Momentum (page 168) » → section-adjacente MOMENTUM de 037 (folio partagé avec 036)', () => {
    const r = site('036', 168, 'you may spend Momentum');
    expect(r.resolution.niveau).toBe('section-adjacente');
    expect(cible(r)).toEqual({ ch: '037', sec: 'momentum', secOcc: 1 });
  });

  it('070 « read from a grimoire (see page 237) » → Grimoires, le pluriel en « s » toléré', () => {
    const r = site('070', 237, 'read from a grimoire');
    expect(r.resolution.niveau).toBe('section-adjacente');
    expect(cible(r)).toEqual({ ch: '070', sec: 'grimoires', secOcc: 1 });
  });

  it('018 « Skill Advance XP Costs table (page 191) » → ambigu : une table nommée ne tombe jamais en page', () => {
    const r = site('018', 191, 'Skill Advance XP Costs');
    expect(r.resolution).toMatchObject({ niveau: 'ambigu', cible: null, candidats: [] });
    expect(r.resolution.table).toMatch(/characteristic and skill advance xp costs$/);
  });

  it('070 « Hit Locations table (page 164) » → ambigu : l’en-tête de colonne n’est pas un titre', () => {
    const r = site('070', 164, 'Hit Locations');
    expect(r.resolution.niveau).toBe('ambigu');
    expect(r.resolution.table).toMatch(/hit locations$/);
  });

  it('070 « Minor Miscast Table (page 238) » → table, la section de ce titre', () => {
    const r = site('070', 238, 'Minor Miscast Table');
    expect(r.resolution.niveau).toBe('table');
    expect(cible(r)).toEqual({ ch: '070', sec: 'minor-miscast-table', secOcc: 1 });
  });

  it('020 « See page 168 for rules on fighting mounted » → ambigu, candidats listés', () => {
    const r = site('020', 168, 'fighting from the back of a mount');
    expect(r.resolution.niveau).toBe('ambigu');
    expect(r.resolution.candidats).toContain('036 - Attacking.md § Mounted Combat');
  });

  it('« Bestial: … see page 356 » → la section Bestial de 115, pour chacun des 14 profils', () => {
    const bestial = tous.filter((r) => r.renvoi.folio === 356 && r.renvoi.phrase.startsWith('**Bestial:**'));
    expect(bestial).toHaveLength(14);
    for (const r of bestial) {
      expect(r.resolution.niveau).toBe('section-adjacente');
      expect(cible(r)).toEqual({ ch: '115', sec: 'bestial', secOcc: 1 });
    }
  });

  it('p.197 : 018 et la plage double de 045 atteignent Change Career, 045 atteint aussi Advance Career', () => {
    expect(cible(site('018', 197, 'change Career'))).toEqual({ ch: '048', sec: 'change-career', secOcc: 1 });
    expect(cible(site('045', 197, '*Change Career* (page 197)'))).toEqual({ ch: '048', sec: 'change-career', secOcc: 1 });
    expect(cible(site('045', 196, '*Advance Career* (page 196)'))).toEqual({ ch: '048', sec: 'advance-career', secOcc: 1 });
  });

  it('p.187 : 007 atteint Corruption and Mutation, 033 atteint Surprised', () => {
    expect(cible(site('007', 187, 'leads to Corruption and Mutation'))).toEqual({ ch: '043', sec: 'corruption-and-mutation', secOcc: 1 });
    expect(cible(site('033', 187, '*Surprised* Condition'))).toEqual({ ch: '042', sec: 'surprised', secOcc: 1 });
  });

  it('page à fichier unique, clause sans titre ni table → page : la cible EST la page, aucune section', () => {
    const r = site('007', 36, 'Your occupation');
    expect(r.resolution).toMatchObject({ niveau: 'page', page: { book: CRB, page: 36 }, fin: null, cible: null });
  });

  it('niveau page : p.169 (032, 071) et « pages 177–179 » (039) rendent la page, jamais sa 1re section', () => {
    for (const r of [site('032', 169, 'A fall'), site('071', 169, 'suffocate')]) {
      expect(r.resolution).toMatchObject({ niveau: 'page', page: { book: CRB, page: 169 }, fin: null, cible: null });
    }
    expect(site('039', 177, 'Amputation').resolution)
      .toMatchObject({ niveau: 'page', page: { book: CRB, page: 177 }, fin: 179, cible: null });
  });

  it('toute résolution porte la page que le livre dit ; une `DescRef` n’existe qu’aux niveaux section et table', () => {
    for (const r of tous) {
      expect(r.resolution.page).toEqual({ book: CRB, page: r.renvoi.folio });
      const prouve = ['table', 'section-adjacente', 'section-phrase'].includes(r.resolution.niveau);
      expect(r.resolution.cible == null, `${r.fichier} p.${r.renvoi.folio} ${r.resolution.niveau}`).toBe(!prouve);
    }
  });

  it('titre à paramètre : « cause *Fear* (see page 183) » atteint Fear (Rating)', () => {
    const r = site('071', 183, 'Lore of Beasts');
    expect(r.resolution.niveau).toBe('section-adjacente');
    expect(cible(r)).toEqual({ ch: '041', sec: 'fear-rating', secOcc: 1 });
  });

  it('liste de pages : 081 « Weapons: Page 301, 303 » atteint les deux pages', () => {
    expect(site('081', 301, 'Weapons:').resolution).toMatchObject({ niveau: 'page', page: { book: CRB, page: 301 } });
    expect(site('081', 303, 'Weapons:').resolution).toMatchObject({ niveau: 'page', page: { book: CRB, page: 303 } });
  });

  it('même titre deux fois dans un fichier (titre et intitulé de sa table) → la première, l’englobante', () => {
    const r = site('081', 308, 'Packs and Containers');
    expect(r.resolution.niveau).toBe('section-adjacente');
    expect(cible(r)).toEqual({ ch: '088', sec: 'packs-and-containers', secOcc: 1 });
  });

  it('un titre DANS l’étendue d’un autre n’est pas nommé : 007 « Fate and Fortune » → FATE AND FORTUNE, pas Fate', () => {
    const r = site('007', 133, 'Help you succeed and survive');
    expect(r.resolution.niveau).toBe('section-adjacente');
    expect(cible(r)).toEqual({ ch: '025', sec: 'fate-and-fortune', secOcc: 1 });
  });

  it('un titre de section porte aussi ses renvois (119 « Ablaze (page 185) »)', () => {
    expect(cible(site('119', 185, 'Ablaze'))).toEqual({ ch: '042', sec: 'ablaze', secOcc: 1 });
  });
});

describe('resoudreRenvoi — garde d’étendue', () => {
  const md = [
    '# <span id="page-9-0" data-folio="10"></span>**FATE AND FORTUNE**', '', 'Fate and Fortune Points.', '',
    '# **Fate**', '', 'Fate Points.', '',
    '# **MINOR MISCAST TABLE**', '', '| d100 | Result |', '|---|---|', '| 01 | Witchsign |', '',
    '# **MISCAST TABLE**', '', '| d100 | Result |', '|---|---|', '| 01 | Ague |',
  ].join('\n');
  const fixture = indexerLivre('fixture', 'VO', [{ fichier: '01 - Fixture.md', parse: parseChapitre(md) }]);
  const resoudre = (t: string) => resoudreRenvoi(fixture, renvoisDe(t, 'VO')[0]);

  it('section-phrase : « Fate » dans « Fate and Fortune » n’est pas nommé', () => {
    const r = resoudre('See page 10 for Fate and Fortune.');
    expect(r.niveau).toBe('section-phrase');
    expect(r.cible!.parts[0].sec).toBe('fate-and-fortune');
  });

  it('table : « Miscast » dans « Minor Miscast » n’est pas nommé', () => {
    const r = resoudre('Roll on the Minor Miscast Table (page 10).');
    expect(r.niveau).toBe('table');
    expect(r.cible!.parts[0].sec).toBe('minor-miscast-table');
  });

  it('un titre nommé HORS de toute autre étendue reste nommé', () => {
    const r = resoudre('Roll on the Miscast Table (page 10).');
    expect(r.cible!.parts[0].sec).toBe('miscast-table');
  });
});
