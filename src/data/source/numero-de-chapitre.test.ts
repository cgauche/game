/**
 * Banc de BOUT EN BOUT du numéro de chapitre ENTIER (#1739), sur un livre FORGÉ à 120 chapitres dans
 * un dossier jetable (`mkdtempSync`) : le corpus réel n'en porte aucun au-delà de 85, et une chaîne
 * qu'aucun cas à trois chiffres ne traverse ne prouve rien.
 *
 * Chaque couture est prise LÀ OÙ ELLE VIT, jamais réécrite ici : la résolution numéro → fichier
 * (`fichierDuChapitre`), l'ordre des chapitres d'un livre (`prefixesDeChapitres`), la route servie en
 * dev (le middleware de `wfrp:prose-source`, corpus injecté), le schéma d'adresse (`descRefSchema`)
 * et la famille `largeur-de-numero` de la garde de format (`sitesDuDossier`).
 */
import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// Ordre TOTAL du listing (#1679 L3b) : la primitive du dépôt, jamais un `readdirSync` nu.
import { listerDossier } from '../../../scripts/guards/lib/lister.mjs';
import {
  fichierDuChapitre, graphieDeChapitre, largeurDeChapitre, parseChapitre, prefixesDeChapitres,
} from './decoupe.ts';
import { descRefSchema } from '../schemas/grammaire/valeurs';
// @ts-expect-error - plugin ESM JS (pas de types) — même convention que `vite.config.ts`
import { proseSource } from '../../../scripts/source/prose-source-plugin.mjs';
// @ts-expect-error - garde ESM JS (pas de types) — même convention que `vite.config.ts`
import { sitesDuDossier } from '../../../scripts/raw/check-source-format.mjs';

const LIVRE = 'livre-forge';
/** Un livre plus gros que tout livre réel (max 85 chapitres) : sa largeur de graphie est TROIS. */
const CHAPITRES = 120;
const LARGEUR = largeurDeChapitre(CHAPITRES);

/** Un chapitre au format canonique : ligne 1 `*Pages PDF N*`, ancre de folio INLINE. */
const texteDe = (n: number) => [
  `*Pages PDF ${n}*`,
  '',
  `<span id="page-${n}-0" data-folio="${n}"></span># Chapitre ${n}`,
  '',
  `Le passage du chapitre ${n} de ce livre forgé, assez long pour être adressable sans ambiguïté.`,
  '',
].join('\n');

const racines: string[] = [];
afterAll(() => { for (const r of racines) rmSync(r, { recursive: true, force: true }); });

/** Le dossier du livre forgé, ses 120 chapitres écrits par la graphie CANONIQUE. */
function livreForge(): string {
  const racine = mkdtempSync(join(tmpdir(), 'wfrp-chapitres-'));
  racines.push(racine);
  const dir = join(racine, LIVRE);
  mkdirSync(dir, { recursive: true });
  for (let n = 1; n <= CHAPITRES; n++) {
    writeFileSync(join(dir, `${graphieDeChapitre(n, LARGEUR)} - Chapitre ${n}.md`), texteDe(n), 'utf8');
  }
  return dir;
}

/** L'accès au corpus que le plugin consomme, servi par le livre forgé — les résolutions sont celles
 *  de la production (`fichierDuChapitre`, `prefixesDeChapitres`), jamais une copie locale. */
function corpusDe(dir: string) {
  const chemin = (book: string, ch: string): string | null => {
    if (book !== LIVRE) return null;
    const f = fichierDuChapitre(listerDossier(dir), ch) as string | null;
    return f ? join(dir, f) : null;
  };
  return {
    chemin,
    dossiers: () => [dir],
    lire: (book: string, ch: string) => {
      const p = chemin(book, ch);
      return p ? parseChapitre(readFileSync(p, 'utf8')) : null;
    },
    oublier: () => false,
    livres: () => [LIVRE],
    abbr: () => 'FORGE',
    chapitres: () => prefixesDeChapitres(listerDossier(dir)) as string[],
  };
}

/** Le middleware que `configureServer` pose, isolé : l'invariant est ce que la ROUTE rend. */
function middlewareDe(corpus: unknown) {
  const poses: ((req: { url: string }, res: unknown, next: () => void) => void)[] = [];
  proseSource({ corpus }).configureServer({
    middlewares: { use: (fn: (typeof poses)[number]) => poses.push(fn) },
    watcher: { add: () => {}, on: () => {} },
    moduleGraph: { getModuleById: () => null, invalidateModule: () => {} },
    ws: { send: () => {} },
  });
  return (url: string) => {
    let corps = '';
    let code = 200;
    let suivant = false;
    const res = {
      set statusCode(v: number) { code = v; },
      get statusCode() { return code; },
      setHeader: () => {},
      end: (t: string) => { corps = t ?? ''; },
    };
    for (const fn of poses) fn({ url }, res, () => { suivant = true; });
    return { corps, code, suivant };
  };
}

describe('livre FORGÉ à 120 chapitres — la chaîne entière porte le numéro à trois chiffres', () => {
  it('les 120 chapitres sont rendus, dans l’ordre des ENTIERS', () => {
    const chapitres = prefixesDeChapitres(listerDossier(livreForge())) as string[];
    expect(chapitres).toHaveLength(CHAPITRES);
    expect(chapitres[0]).toBe('001');
    expect(chapitres[CHAPITRES - 1]).toBe('120');
    expect(chapitres.map(Number)).toEqual([...Array(CHAPITRES)].map((_, i) => i + 1));
  });

  it('l’ordre est celui des ENTIERS même sur des graphies MÊLÉES — un tri de chaînes ment', () => {
    const meles = ['9 - A.md', '10 - B.md', '100 - C.md', 'Index.md'];
    expect(prefixesDeChapitres(meles)).toEqual(['9', '10', '100']);
    expect([...meles].sort()[0]).toBe('10 - B.md');
  });

  it('la résolution compare des ENTIERS : 7, « 07 » et « 007 » désignent le même fichier', () => {
    const listing = listerDossier(livreForge());
    const attendu = '007 - Chapitre 7.md';
    expect(fichierDuChapitre(listing, 7)).toBe(attendu);
    expect(fichierDuChapitre(listing, '07')).toBe(attendu);
    expect(fichierDuChapitre(listing, '007')).toBe(attendu);
    expect(fichierDuChapitre(listing, 105)).toBe('105 - Chapitre 105.md');
    expect(fichierDuChapitre(listing, '105')).toBe('105 - Chapitre 105.md');
    expect(fichierDuChapitre(listing, 121)).toBeNull();
  });

  it('la route de dev sert `/source/<livre>/105.md`, et dit l’introuvable', () => {
    const servir = middlewareDe(corpusDe(livreForge()));
    const cent5 = servir(`/source/${LIVRE}/105.md`);
    expect(cent5.code).toBe(200);
    expect(cent5.corps).toContain('Le passage du chapitre 105');
    expect(servir(`/source/${LIVRE}/007.md`).corps).toContain('Le passage du chapitre 7');
    const absent = servir(`/source/${LIVRE}/121.md`);
    expect(absent.code).toBe(404);
    expect(absent.corps).toContain('chapitre-introuvable');
  });

  it('le manifeste servi porte les 120 chapitres, dans l’ordre, à leur graphie de fichier', () => {
    const servir = middlewareDe(corpusDe(livreForge()));
    const manifeste = JSON.parse(servir('/source/manifest.json').corps) as
      Record<string, { chapitres: { ch: string; fichier: string }[] }>;
    const chapitres = manifeste[LIVRE].chapitres;
    expect(chapitres).toHaveLength(CHAPITRES);
    expect(chapitres[104].ch).toBe('105');
    expect(chapitres[104].fichier).toBe('105 - Chapitre 105.md');
  });

  it('`descRefSchema` accepte un `ch` à trois chiffres et refuse une graphie à UN chiffre', () => {
    const adresse = (ch: string) => ({
      book: LIVRE,
      ch,
      parts: [{ kind: 'blocs' as const, sec: 'chapitre-105', secOcc: 1, b0: 0, b1: 0, sum: 'a'.repeat(16) }],
    });
    expect(descRefSchema.safeParse(adresse('105')).success).toBe(true);
    expect(descRefSchema.safeParse(adresse('007')).success).toBe(true);
    expect(descRefSchema.safeParse(adresse('21')).success).toBe(true);
    expect(descRefSchema.safeParse(adresse('7')).success).toBe(false);
    expect(descRefSchema.safeParse(adresse('10a')).success).toBe(false);
  });
});

describe('garde `largeur-de-numero` — une largeur par dossier, celle du plus grand numéro', () => {
  /** Les seuls sites de la famille jugée, sur un dossier réduit à ses NOMS de fichier. */
  const largeurs = (noms: string[]) =>
    (sitesDuDossier('Source/Livre', noms.map((nom) => ({ nom, texte: texteDe(1) }))) as
      { famille: string; file: string; ref: string }[])
      .filter((s) => s.famille === 'largeur-de-numero');

  it('un dossier à largeur UNE ne rend aucun écart, à deux comme à trois chiffres', () => {
    expect(largeurs(['07 - A.md', '21 - B.md'])).toEqual([]);
    expect(largeurs(['099 - A.md', '100 - B.md'])).toEqual([]);
    expect(largeurs(listerDossier(livreForge()))).toEqual([]);
  });

  it('un dossier MÊLÉ rougit, et NOMME le premier fichier hors largeur', () => {
    const court = largeurs(['99 - A.md', '100 - B.md']);
    expect(court.map((s) => s.ref)).toEqual(['1 préfixe(s) hors largeur 3']);
    expect(court[0].file).toBe('Source/Livre/99 - A.md');
    expect(largeurs(['07 - A.md', '100 - B.md']).map((s) => s.ref)).toEqual(['1 préfixe(s) hors largeur 3']);
    expect(largeurs(['07 - A.md', '08 - B.md', '100 - C.md']).map((s) => s.ref)).toEqual(['2 préfixe(s) hors largeur 3']);
  });
});
