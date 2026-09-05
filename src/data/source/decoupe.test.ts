// Tests de la bibliothèque de DÉCOUPE (`decoupe.ts`) : recollage des paragraphes coupés par un
// saut de folio, folio COURANT, occurrences de titres dupliqués, adresse de CELLULE de table,
// contrôle d'empreinte, montage d'adresse et chargement SOUS NODE NU. Ces tests lisent le VRAI
// `Source/` (aucune fixture inventée) — les cas de recette sont cités par `fichier:ligne`.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  type ChapitreParse, type Fragment, type FragmentBlocs, type FragmentCellule, type Resolu,
  blocsPlats, empreinteDe, estErreur, findCells, normText, parseChapitre, resoudreAdresse,
  resoudreFragment, sumOf,
} from './decoupe.ts';

const RACINE = fileURLToPath(new URL('../../../', import.meta.url));
const LIVRES: { id: string; dir?: string }[] = JSON.parse(
  readFileSync(join(RACINE, 'src/data/books.json'), 'utf8'),
);
const LDB = 'livre-de-base';

const _cache = new Map<string, ChapitreParse>();

/** Chemin du fichier de chapitre `NN` d'un livre. */
function cheminChapitre(bookId: string, ch: string): string {
  const dir = LIVRES.find((b) => b.id === bookId)?.dir;
  if (!dir) throw new Error(`livre sans dir : ${bookId}`);
  const abs = join(RACINE, dir);
  const f = readdirSync(abs).find((x) => x.startsWith(`${ch} - `) && x.endsWith('.md'));
  if (!f) throw new Error(`chapitre introuvable : ${bookId} ch.${ch}`);
  return join(abs, f);
}

/** Chapitre `NN` d'un livre, lu au disque (CRLF-robuste) et parsé, avec cache. */
function chapitreDe(bookId: string, ch: string): ChapitreParse {
  const cle = `${bookId}|${ch}`;
  const memo = _cache.get(cle);
  if (memo) return memo;
  const parse = parseChapitre(readFileSync(cheminChapitre(bookId, ch), 'utf8').replace(/\r\n|\r/g, '\n'));
  _cache.set(cle, parse);
  return parse;
}

const sectionOf = (ch: string, slug: string, occ = 1) =>
  chapitreDe(LDB, ch).sections.find((s) => s.slug === slug && s.occ === occ)!;

/** Fragment estampillé de son empreinte RÉELLE (ce que fait un producteur d'adresse). */
function estampille<T extends Fragment>(chapitre: ChapitreParse, frag: Omit<T, 'sum'>): T {
  const brouillon = { ...frag, sum: '' } as T;
  const sum = empreinteDe(chapitre, brouillon);
  return { ...brouillon, sum: typeof sum === 'string' ? sum : '' };
}

/** Résout un fragment de blocs du LDB, empreinte posée à la volée. */
function blocs(ch: string, sec: string, b0: number, b1: number, opts: { secOcc?: number; sum?: string } = {}) {
  const chapitre = chapitreDe(LDB, ch);
  const frag = estampille<FragmentBlocs>(chapitre, { kind: 'blocs', sec, secOcc: opts.secOcc ?? 1, b0, b1 });
  return resoudreFragment(chapitre, opts.sum === undefined ? frag : { ...frag, sum: opts.sum });
}

/** `19 - Corruption.md:118` : `| 01–05 | Pattes d'animaux | +1 Mouvement | | |` */
const CELL = { kind: 'cellule' as const, sec: 'tableau-de-corruption-physique', secOcc: 1, row: "Pattes d'animaux", col: 'Effet' };

/** Résout un fragment de cellule du ch.19, empreinte posée à la volée. */
function cellule(over: Partial<Omit<FragmentCellule, 'kind'>> = {}, sum?: string) {
  const chapitre = chapitreDe(LDB, '19');
  const frag = estampille<FragmentCellule>(chapitre, { ...CELL, ...over });
  return resoudreFragment(chapitre, sum === undefined ? frag : { ...frag, sum });
}

describe('parseChapitre — blocs, folios, sections', () => {
  // `21 - Psychologie.md:45-48` : le folio coupe la phrase mi-mot (« … comme les » / « « ostlanders » … »).
  it('recollage : Préjugé (Cible) rend un paragraphe d\'un seul tenant', () => {
    const sec = sectionOf('21', 'prejuge-cible');
    expect(sec.blocks.length).toBe(2);
    expect(sec.blocks[0].md).toMatch(/comme les « ostlanders », les « elfes »/);
  });

  // `05 - _gjdgxs.md:438-441` : le bloc précédent finit par `…protéger une autre.*` (ponctuation
  // masquée sous l'emphase) et le suivant OUVRE sur `**Exemple :**` — deux paragraphes logiques.
  it('D1 : pas de recollage quand la ponctuation finale est sous l\'emphase et que le suivant ouvre sur `**`', () => {
    const sec = sectionOf('05', 'choisir-la-motivation');
    const clotilda = sec.blocks.findIndex((b) => b.md.includes('Clotilda'));
    expect(clotilda).toBeGreaterThanOrEqual(0);
    expect(sec.blocks[clotilda].md.endsWith('protéger une autre.*')).toBe(true);
    expect(sec.blocks[clotilda].md.includes('Ebba')).toBe(false);
    expect(sec.blocks[clotilda + 1].md.startsWith('**Exemple :** *Ebba')).toBe(true);
  });

  // `09 - Compétences.md:26-30` : discrimine la SEULE règle de ponctuation sous habillage — le bloc
  // suivant est de la prose nue, seul un `…l'Agilité.*` vu comme terminé empêche la soudure.
  it('D1 : ponctuation terminale sous emphase — coupe même quand le suivant est de la prose nue', () => {
    const sec = sectionOf('09', 'competences-de-base-et-avancees');
    const sigrid = sec.blocks.findIndex((b) => b.md.includes('Sigrid'));
    expect(sec.blocks[sigrid].md.endsWith("l'Agilité.*")).toBe(true);
    expect(sec.blocks[sigrid + 1].md.startsWith('Les Compétences Avancées')).toBe(true);
  });

  // `08 - Statut.md:262-265` : discrimine la SEULE règle d'ouverture — le bloc précédent
  // (« **Possessions :** … vêtement de qualité ») ne finit sur AUCUNE ponctuation.
  it('D1 : un bloc suivant ouvert par une emphase reste un paragraphe distinct', () => {
    const sec = sectionOf('08', 'maitre-de-guilde-or-1');
    const poss = sec.blocks.findIndex((b) => b.md.startsWith('**Possessions :**'));
    expect(poss).toBeGreaterThanOrEqual(0);
    expect(/[.!?»”:;]$/.test(sec.blocks[poss].md)).toBe(false);
    expect(sec.blocks[poss + 1].md.startsWith('*Ambitieux et socialement mobile')).toBe(true);
  });

  // `19 - Corruption.md:140` : le marqueur `data-folio="185"` ouvre la section, aucun span n'est
  // INTERNE aux blocs de la table qui suit — sans folio courant, l'adresse rendrait `folios: []`.
  it('B : folio courant — une adresse sans span interne rend tout de même son folio', () => {
    const sec = sectionOf('19', 'tableau-de-corruption-mentale');
    const last = sec.blocks.length - 1;
    expect(sec.blocks[last].folios).toEqual([]);
    const res = blocs('19', 'tableau-de-corruption-mentale', last, last);
    expect((res as Resolu).folios).toEqual([185]);
  });

  it('B : le folio courant roule d\'une section à l\'autre du chapitre', () => {
    const terreur = sectionOf('21', 'terreur-indice');
    expect(terreur.folio).toBe(191);
    expect((blocs('21', 'terreur-indice', 0, 0) as Resolu).folios).toEqual([191]);
  });

  // `08 - Statut.md` répète « Évolution de Carrière » ×31 : `secOcc` est la seule chose qui distingue.
  it('titres dupliqués : occ=2 résout une section différente d\'occ=1', () => {
    const s1 = sectionOf('08', 'evolution-de-carriere', 1);
    const s2 = sectionOf('08', 'evolution-de-carriere', 2);
    expect(s1.line).not.toBe(s2.line);
    const r1 = blocs('08', 'evolution-de-carriere', 0, 0, { secOcc: 1 }) as Resolu;
    const r2 = blocs('08', 'evolution-de-carriere', 0, 0, { secOcc: 2 }) as Resolu;
    expect(r1.md).not.toBe(r2.md);
  });
});

describe('resoudreFragment — cellules, empreinte, bornes', () => {
  it('C : adresse de cellule — clé de ligne × en-tête de colonne', () => {
    const res = cellule() as Resolu;
    expect(res.md).toBe('+1 Mouvement');
    expect(res.folios).toEqual([184]);
  });

  it('C : la clé de ligne se cherche dans TOUTES les colonnes', () => {
    expect((cellule({ row: '01–05', col: 'Description' }) as Resolu).md).toBe("Pattes d'animaux");
  });

  it('C : erreurs structurées — ligne introuvable, colonne inconnue', () => {
    expect((cellule({ row: 'Pattes de chaise' }) as { error: string }).error).toBe('ligne-introuvable');
    expect((cellule({ col: 'Conséquence' }) as { error: string }).error).toBe('colonne-inconnue');
  });

  it('C : `findCells` retrouve la cellule dans le chapitre, une seule fois', () => {
    const hits = findCells(chapitreDe(LDB, '19'), normText('+1 Mouvement'));
    expect(hits.length).toBe(1);
    expect(hits[0].sec).toBe('tableau-de-corruption-physique');
  });

  it('D : empreinte — une adresse juste passe, une adresse falsifiée est refusée', () => {
    const ok = blocs('21', 'prejuge-cible', 0, 1);
    expect(estErreur(ok)).toBe(false);
    const ko = blocs('21', 'prejuge-cible', 0, 1, { sum: '0000000000000000' });
    expect((ko as { error: string }).error).toBe('empreinte-divergente');
    expect((ko as { detail: string }).detail).toMatch(/texte résolu=/);
  });

  it('D : l\'empreinte est vérifiée aussi sur une adresse de cellule', () => {
    expect(estErreur(cellule())).toBe(false);
    expect((cellule({}, 'deadbeefcafe0000') as { error: string }).error).toBe('empreinte-divergente');
  });

  it('bornes hors limites et section inconnue', () => {
    const sec = sectionOf('21', 'prejuge-cible');
    const err = (r: unknown) => (r as { error: string }).error;
    expect(err(blocs('21', 'prejuge-cible', 0, sec.blocks.length))).toBe('bornes-hors-limites');
    expect(err(blocs('21', 'prejuge-cible', -1, 0))).toBe('bornes-hors-limites');
    expect(err(blocs('21', 'prejuge-cible', 1, 0))).toBe('bornes-hors-limites');
    expect(err(blocs('21', 'prejuge-cible', 0, 1.5))).toBe('bornes-hors-limites');
    expect(err(blocs('21', 'section-qui-nexiste-pas', 0, 0))).toBe('section-inconnue');
  });
});

describe('blocsPlats — mémo par identité', () => {
  it('le mémo de blocs plats tient par IDENTITÉ de chapitre', () => {
    const chapitre = chapitreDe(LDB, '21');
    expect(blocsPlats(chapitre)).toBe(blocsPlats(chapitre));
    const jumeau = parseChapitre(readFileSync(cheminChapitre(LDB, '21'), 'utf8').replace(/\r\n|\r/g, '\n'));
    expect(blocsPlats(jumeau)).not.toBe(blocsPlats(chapitre));
    expect(blocsPlats(jumeau)).toEqual(blocsPlats(chapitre));
  });
});

describe('sumOf — empreinte 64 bits', () => {
  it('rend 16 hex dont les deux moitiés DIFFÈRENT (deux sels distincts)', () => {
    const sec = sectionOf('21', 'peur-indice');
    for (const b of sec.blocks) {
      const s = sumOf(b.md);
      expect(s).toMatch(/^[0-9a-f]{16}$/);
      expect(s.slice(0, 8)).not.toBe(s.slice(8));
    }
  });

  it('aucune COLLISION sur les blocs des 16 livres extraits', () => {
    const t0 = Date.now();
    const parSum = new Map<string, string>();
    let blocsVus = 0;
    let collisions = 0;
    for (const livre of LIVRES.filter((b) => b.dir)) {
      const dir = join(RACINE, livre.dir!);
      for (const f of readdirSync(dir)) {
        const m = /^(\d{2}) - .+\.md$/.exec(f);
        if (!m) continue;
        for (const b of blocsPlats(chapitreDe(livre.id, m[1]))) {
          if (!b.norm) continue;
          blocsVus++;
          const vu = parSum.get(sumOf(b.md));
          if (vu === undefined) parSum.set(sumOf(b.md), b.norm);
          else if (vu !== b.norm) collisions++;
        }
      }
    }
    console.log(`empreintes : ${blocsVus} blocs, ${parSum.size} empreintes, ${collisions} collisions, ${Date.now() - t0} ms`);
    expect(blocsVus).toBeGreaterThan(20_000);
    expect(collisions).toBe(0);
  });
});

describe('resoudreAdresse — montage de fragments', () => {
  const chapitre21 = () => chapitreDe(LDB, '21');
  const fragment21 = (sec: string, b0: number, b1: number) =>
    estampille<FragmentBlocs>(chapitre21(), { kind: 'blocs', sec, secOcc: 1, b0, b1 });

  it('monte 2 fragments d\'un même chapitre, textes joints et folios en union', () => {
    const ref = {
      book: LDB, ch: '21',
      parts: [fragment21('peur-indice', 0, 0), fragment21('peur-indice', 1, 1)],
    };
    const res = resoudreAdresse(chapitre21(), ref);
    expect(estErreur(res)).toBe(false);
    const sec = sectionOf('21', 'peur-indice');
    expect((res as Resolu).md).toBe(`${sec.blocks[0].md}\n\n${sec.blocks[1].md}`);
  });

  it('refuse un montage de 4 fragments (plafond 3)', () => {
    const p = [fragment21('peur-indice', 0, 0), fragment21('peur-indice', 1, 1)];
    const res = resoudreAdresse(chapitre21(), { book: LDB, ch: '21', parts: [...p, ...p] });
    expect((res as { error: string }).error).toBe('montage-hors-plafond');
  });

  // `21 - Psychologie.md` : « – Lieselotte Aderhold, Aventurière » fait 34 caractères normalisés.
  it('refuse un fragment de montage trop court pour être discriminant', () => {
    const court = sectionOf('21', 'entre-deux-aventures').blocks[1];
    expect(normText(court.md).length).toBeLessThan(40);
    const res = resoudreAdresse(chapitre21(), {
      book: LDB, ch: '21',
      parts: [fragment21('peur-indice', 0, 0), fragment21('entre-deux-aventures', 1, 1)],
    });
    expect((res as { error: string }).error).toBe('fragment-trop-court');
  });

  // `10 - Talents.md` : « **Tests :** Corps à corps quand vous vous défendez » est le bloc 1 de
  // Renversement ET de Riposte — deux places pour un même texte.
  it('refuse un fragment de montage dupliqué ailleurs dans le chapitre', () => {
    const chapitre = chapitreDe(LDB, '10');
    const frag = (sec: string, b0: number) =>
      estampille<FragmentBlocs>(chapitre, { kind: 'blocs', sec, secOcc: 1, b0, b1: b0 });
    const res = resoudreAdresse(chapitre, {
      book: LDB, ch: '10', parts: [frag('renversement', 1), frag('riposte', 0)],
    });
    expect((res as { error: string }).error).toBe('fragment-ambigu');
    expect((res as { detail: string }).detail).toMatch(/2 fois/);
  });
});

describe('chargement SOUS NODE NU', () => {
  // Le parseur est importé tel quel par les scripts `.mjs` de `scripts/source/` (migrations, gardes),
  // lancés par `node` sans transpilation : Node 22 efface les types, à condition que les imports
  // internes portent leur extension (`./normalize.ts`, `../hash.ts`).
  it('`node` importe `decoupe.ts` et expose `parseChapitre`', () => {
    const url = new URL('./decoupe.ts', import.meta.url).href;
    const r = spawnSync(
      process.execPath,
      ['--input-type=module', '-e', `import('${url}').then((m) => console.log(typeof m.parseChapitre))`],
      { encoding: 'utf8' },
    );
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('function');
  });
});
