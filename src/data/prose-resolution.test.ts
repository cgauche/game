import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-expect-error - résolveur ESM JS (pas de types) — même convention que `vite.config.ts`
import { resoudreProse } from '../../scripts/source/resoudre.mjs';
import { empreinteDe, parseChapitre, type ChapitreParse, type Fragment, type FragmentBlocs } from './source/decoupe';

/**
 * EN-TÊTE STRUCTURÉ de la garde (#1475).
 */
const GARDE = {
  question:
    'A — toute `descRef` des deux racines (`src/data/**/*.json`, `src/scenes/**/*.json`) résout-elle dans ' +
    'le `Source/` COURANT (chapitre présent, section présente, bornes dans la section, ligne et colonne ' +
    'de table trouvées) ? ' +
    'B — l’empreinte `sum` de chaque fragment colle-t-elle au texte que l’adresse résout AUJOURD’HUI ? ' +
    'D — un MONTAGE (2 ou 3 fragments) a-t-il des fragments d’au moins 40 caractères normalisés, chacun ' +
    'unique dans son chapitre, DISJOINTS entre eux, et pas plus de trois ?',
  primitive:
    '`resoudreProse` (`scripts/source/resoudre.mjs`) — le résolveur FAIL-CLOSED, qui compose le parseur ' +
    'PUR `src/data/source/decoupe.ts` et le lecteur fs `scripts/source/lecteur-fs.mjs`. Aucun second ' +
    'chemin de résolution : ce que la garde éprouve est exactement ce que le plugin `wfrp:prose-source` ' +
    'exécute au build et ce que les scripts Node exécutent par `materialiser`.',
  perimetre:
    'Les DEUX racines de documents authorés (`src/data`, `src/scenes`), à toute profondeur, par un walk ' +
    'GÉNÉRIQUE (patron de `citedEntriesOf`, `scripts/guards/lib/folioIntegrity.mjs`) — jamais une liste ' +
    'de fichiers. Il est MESURÉ au run et imprimé (nombre d’adresses, nombre de chapitres distincts).',
  angleMort:
    'L’empreinte `sum` est calculée sur le texte NORMALISÉ (`normText` : emphase, guillemets, tirets, ' +
    'casse, espaces) — une ré-extraction qui ne change QUE l’habillage markdown passe le volet B sans ' +
    'rien dire. Les `desc` INLINE ne sont pas le sujet de cette garde — `maison` COMPRISES : le champ ' +
    '`maison` ne dispense pas d’adresser (`grammaire/prose.ts` V3), et ces nœuds sont déjà au ' +
    'dénominateur décroissant du stock `PROSE_INLINE_TOLEREE` ' +
    '(`src/data/schemas/grammaire/prose-inline.ts`), que le refine de parse tient. Un second stock ici ' +
    'compterait les mêmes nœuds deux fois.',
  baseline: {
    fichier: null,
    decroissant: false,
    raison:
      'Tolérance ZÉRO, donc aucun fichier de stock : une adresse qui ne résout plus rend une prose ABSENTE ' +
      'ou FAUSSE au joueur, et la garde est FAIL-CLOSED par construction. Une exception inscrite serait ' +
      'la corruption silencieuse que l’adressage existe pour empêcher.',
  },
  ticket: '#1389 (épique #1388)',
} as const;

/** Une adresse rencontrée dans la donnée, et d'où elle vient. */
interface AdresseVue {
  cle: string;
  noeud: { descRef?: { book: string; ch: string } };
}

const RACINES = ['data', 'scenes'].map((r) => fileURLToPath(new URL(`../${r}/`, import.meta.url)));

/** Tous les `.json` d'une racine, à toute profondeur. */
function fichiersJson(dir: string): string[] {
  const out: string[] = [];
  for (const nom of readdirSync(dir)) {
    const p = join(dir, nom);
    if (statSync(p).isDirectory()) out.push(...fichiersJson(p));
    else if (nom.endsWith('.json')) out.push(p);
  }
  return out.sort();
}

/** Nœuds porteurs d'une `descRef`, à toute profondeur des deux racines. Clé = `id` STABLE quand il
 *  existe, sinon le chemin JSON — jamais un libellé (doctrine 2026-07-09). */
function adressesDuDepot(): AdresseVue[] {
  const out: AdresseVue[] = [];
  for (const racine of RACINES) {
    for (const fichier of fichiersJson(racine)) {
      let data: unknown;
      try {
        data = JSON.parse(readFileSync(fichier, 'utf8'));
      } catch {
        continue;
      }
      const nomCourt = fichier.slice(fichier.lastIndexOf('src')).split('\\').join('/');
      const walk = (node: unknown, path: string): void => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) {
          node.forEach((x, i) => walk(x, `${path}[${i}]`));
          return;
        }
        const rec = node as Record<string, unknown>;
        if (rec.descRef !== undefined) {
          const id = typeof rec.id === 'string' ? rec.id : path || '?';
          out.push({ cle: `${nomCourt}:${id}`, noeud: rec as AdresseVue['noeud'] });
        }
        for (const [k, v] of Object.entries(rec)) walk(v, path ? `${path}.${k}` : k);
      };
      walk(data, '');
    }
  }
  return out;
}

/** Chargeur de chapitre injecté dans le résolveur (la fixture en fournit un ; la donnée réelle prend
 *  le lecteur fs par défaut). */
type Lecteur = (book: string, ch: string) => ChapitreParse | null;

/** Code d'erreur d'une résolution ratée (`<code> : <détail>`), ou `null` si elle a rendu son texte. */
function echecDe(noeud: unknown, lecteur?: Lecteur): { code: string; message: string } | null {
  try {
    resoudreProse(noeud, lecteur);
    return null;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { code: message.split(' : ')[0], message };
  }
}

/** Les trois volets, par le CODE que le résolveur rend — un code de plus sans volet est une omission
 *  visible (il tombe dans `A`, le volet de la résolution elle-même). */
const CODES_B = new Set(['empreinte-divergente']);
const CODES_D = new Set(['fragment-trop-court', 'fragment-ambigu', 'fragments-chevauchants', 'montage-hors-plafond']);

const ADRESSES = adressesDuDepot();
const ECHECS = ADRESSES.map((a) => ({ ...a, echec: echecDe(a.noeud) }));
const chapitres = new Set(ADRESSES.map((a) => `${a.noeud.descRef?.book}|${a.noeud.descRef?.ch}`));

const lignes = (volet: (code: string) => boolean): string[] =>
  ECHECS.filter((e) => e.echec && volet(e.echec.code)).map((e) => `${e.cle} → ${e.echec!.message}`).sort();

describe('résolution de la prose ADRESSÉE — toute `descRef` rend son texte, aujourd’hui (#1389)', () => {
  it('PÉRIMÈTRE : chaque racine est réellement balayée, et ce qu’elle porte est DIT', () => {
    const balayees = RACINES.map((r) => ({ racine: r.slice(r.lastIndexOf('src')).split('\\').join('/'), fichiers: fichiersJson(r).length }));
    console.log(
      `PROSE ADRESSÉE — ${ADRESSES.length} adresse(s) sur ${balayees.map((b) => `${b.racine} (${b.fichiers} .json)`).join(' + ')}, ` +
        `${ADRESSES.length === 0 ? 'périmètre vide' : `${chapitres.size} chapitre(s) distinct(s) : ${[...chapitres].sort().join(', ')}`}` +
        ` — baseline ${GARDE.baseline.decroissant ? 'décroissante' : 'à ZÉRO'}, ticket ${GARDE.ticket}.`,
    );
    // Le walk voit une POPULATION : une racine dont le chemin a bougé rendrait 0 fichier, et les trois
    // volets passeraient au vert sur le vide.
    expect(
      balayees.filter((b) => b.fichiers === 0),
      'racine(s) balayée(s) SANS aucun `.json` — le chemin a bougé, la garde ne mesure plus rien',
    ).toEqual([]);
  });

  it('A — chaque adresse RÉSOUT dans le `Source/` courant', () => {
    const rouges = lignes((code) => !CODES_B.has(code) && !CODES_D.has(code));
    expect(
      rouges,
      'Adresse(s) que le `Source/` courant ne résout plus — relever le passage et corriger l’adresse ' +
        `(\`node scripts/source/reparer-adresses.mjs\` quand il existera) :\n${rouges.join('\n')}`,
    ).toEqual([]);
  });

  it('B — l’EMPREINTE de chaque fragment colle au texte résolu', () => {
    const rouges = lignes((code) => CODES_B.has(code));
    expect(
      rouges,
      'Empreinte(s) divergente(s) : le `Source/` a bougé sous l’adresse, la prose rendue n’est plus ' +
        `celle qui a été relue — RE-relever le passage, jamais recopier l’empreinte :\n${rouges.join('\n')}`,
    ).toEqual([]);
  });

  it('D — un MONTAGE tient ses plafonds (fragments longs, uniques, trois au plus)', () => {
    const rouges = lignes((code) => CODES_D.has(code));
    expect(
      rouges,
      'Montage(s) hors plafond : un fragment court ou répété dans son chapitre rendra un AUTRE texte à ' +
        `la première ré-extraction :\n${rouges.join('\n')}`,
    ).toEqual([]);
  });
});

/* ─────────────────────────────────────────────────────────────────────────────
 * Les trois volets, PROUVÉS sur une fixture synthétique — la donnée ne porte
 * aujourd'hui aucune adresse, et une garde qu'aucun cas ne fait rougir ne prouve rien.
 * Le chapitre est injecté par le paramètre `lecteur` de `resoudreProse` : aucun fichier
 * temporaire, aucun `Source/` touché.
 * ──────────────────────────────────────────────────────────────────────────── */

const TEXTE_FIXTURE = [
  '### Terreur',
  '',
  "Les créatures les plus perturbantes de l'Empire glacent le sang de quiconque croise leur route.",
  '',
  'Une fois le Test de Psychologie effectué, la créature cause la Peur au lieu de la Terreur glaçante.',
  '',
  'Bref.',
  '',
  // La colonne `Race` porte des cellules d'UN MOT : c'est le cas de la règle D (une cellule est
  // adressée exactement, donc exempte du plancher de 40 caractères), mesuré en recette sur la table
  // des races aléatoires du chapitre 04.
  '| Localisation | Effet | Race |',
  '| --- | --- | --- |',
  '| Tete | Le coup porte au front et la vue se brouille un long moment, sans reprise possible. | Humain |',
  '| Bras | Le coup porte au bras et la main lache tout ce qu elle tenait, sans reprise possible. | Nain |',
  '',
  '### Peur',
  '',
  "Les créatures les plus perturbantes de l'Empire glacent le sang de quiconque croise leur route.",
  '',
].join('\n');

const CHAPITRE: ChapitreParse = parseChapitre(TEXTE_FIXTURE);
const LECTEUR = (book: string, ch: string): ChapitreParse | null =>
  book === 'livre-fixture' && ch === '01' ? CHAPITRE : null;

/** Fragment de blocs de la fixture, empreinte POSÉE par le helper unique (jamais écrite à la main). */
function fragment(sec: string, b0: number, b1: number): FragmentBlocs {
  const brut: FragmentBlocs = { kind: 'blocs', sec, secOcc: 1, b0, b1, sum: '' };
  const sum = empreinteDe(CHAPITRE, brut);
  if (typeof sum !== 'string') throw new Error(`fixture illisible : ${JSON.stringify(sum)}`);
  return { ...brut, sum };
}

const adresse = (...parts: Fragment[]) => ({ descRef: { book: 'livre-fixture', ch: '01', parts } });

describe('les trois volets MORDENT — fixture synthétique', () => {
  it('une adresse juste rend son texte, et lui seul', () => {
    const res = resoudreProse(adresse(fragment('terreur', 0, 0)), LECTEUR);
    expect(res.etat).toBe('resolue');
    expect(res.md).toContain('glacent le sang');
    expect(res.md).not.toContain('Bref.');
  });

  it('A — une borne hors de la section est REFUSÉE (`b1` d’un bloc de trop)', () => {
    // La section de fixture porte 4 blocs (trois paragraphes + une table) : viser le 5ᵉ sort.
    const juste = fragment('terreur', 0, 3);
    const faux = { ...juste, b1: juste.b1 + 1 };
    expect(echecDe(adresse(faux), LECTEUR)?.code).toBe('bornes-hors-limites');
  });

  it('A — une section absente du chapitre est REFUSÉE', () => {
    expect(echecDe(adresse({ ...fragment('terreur', 0, 0), sec: 'terreur-glacante' }), LECTEUR)?.code).toBe('section-inconnue');
  });

  it('A — un chapitre que le lecteur ne rend pas est REFUSÉ', () => {
    expect(echecDe({ descRef: { book: 'livre-fixture', ch: '99', parts: [fragment('terreur', 0, 0)] } }, LECTEUR)?.code).toBe('chapitre-introuvable');
  });

  it('B — une empreinte amputée d’un caractère est REFUSÉE', () => {
    const juste = fragment('terreur', 0, 0);
    const ampute = { ...juste, sum: `${juste.sum[0] === '0' ? '1' : '0'}${juste.sum.slice(1)}` };
    expect(echecDe(adresse(ampute), LECTEUR)?.code).toBe('empreinte-divergente');
  });

  it('D — un MONTAGE dont un fragment est trop court est REFUSÉ', () => {
    // Le 3ᵉ bloc de la fixture (« Bref. ») fait moins de 40 caractères normalisés.
    expect(echecDe(adresse(fragment('terreur', 1, 1), fragment('terreur', 2, 2)), LECTEUR)?.code).toBe('fragment-trop-court');
  });

  it('D — une CELLULE d’un mot se monte : le plancher et l’unicité ne visent que les `blocs`', () => {
    // Une cellule est adressée EXACTEMENT (section, ligne, colonne) : rien à discriminer par le texte,
    // et aucune borne à étendre — lui opposer « étendez les bornes de blocs » était un remède
    // impossible (recette : « Humain », valide seul, refusé dès l’ajout d’un 2ᵉ fragment).
    const cellule: Fragment = { kind: 'cellule', sec: 'terreur', secOcc: 1, row: 'Tete', col: 'Race', sum: '' };
    const sum = empreinteDe(CHAPITRE, cellule);
    expect(typeof sum, 'la cellule d’un mot doit résoudre SEULE').toBe('string');
    const court = resoudreProse(adresse({ ...cellule, sum: sum as string }), LECTEUR);
    expect(court.md, 'la cellule rend bien un texte d’un mot').toBe('Humain');

    const monte = resoudreProse(adresse({ ...cellule, sum: sum as string }, fragment('terreur', 1, 1)), LECTEUR);
    expect(echecDe(adresse({ ...cellule, sum: sum as string }, fragment('terreur', 1, 1)), LECTEUR)?.code).toBeUndefined();
    expect(monte.etat).toBe('resolue');
    expect(monte.md).toContain('Humain');
    expect(monte.md).toContain('Test de Psychologie');
  });

  it('D — un MONTAGE dont un fragment se répète dans le chapitre est REFUSÉ', () => {
    // Le bloc de § peur est le MÊME texte que le premier bloc de § terreur.
    expect(echecDe(adresse(fragment('terreur', 1, 1), fragment('terreur', 0, 0)), LECTEUR)?.code).toBe('fragment-ambigu');
  });

  it('D — un montage qui cite DEUX FOIS le même passage est REFUSÉ', () => {
    // Le cas dégénéré : le même fragment répété, que l’unicité-dans-le-chapitre ne voit pas (chaque
    // fragment est unique PRIS SÉPARÉMENT) — l’adresse rendrait le paragraphe deux fois.
    const f = fragment('terreur', 1, 1);
    expect(echecDe(adresse(f, f), LECTEUR)?.code).toBe('fragments-chevauchants');
  });

  it('D — deux fragments qui SE RECOUVRENT partiellement sont REFUSÉS', () => {
    expect(echecDe(adresse(fragment('terreur', 0, 1), fragment('terreur', 1, 2)), LECTEUR)?.code).toBe('fragments-chevauchants');
  });

  it('D — la TABLE entière puis UNE de ses cellules se recouvrent (les `kind` diffèrent, le bloc non)', () => {
    // Le verrou compare les BLOCS COUVERTS, pas les genres : une cellule est un morceau du bloc-table,
    // l'adresser après la table dirait deux fois la même chose.
    const table = fragment('terreur', 3, 3);
    const cellule: Fragment = { kind: 'cellule', sec: 'terreur', secOcc: 1, row: 'Tete', col: 'Effet', sum: '' };
    const sum = empreinteDe(CHAPITRE, cellule);
    expect(typeof sum, 'la cellule de fixture doit résoudre').toBe('string');
    expect(echecDe(adresse(table, { ...cellule, sum: sum as string }), LECTEUR)?.code).toBe('fragments-chevauchants');
  });

  it('D — un montage de plus de trois fragments est REFUSÉ', () => {
    const f = fragment('terreur', 1, 1);
    expect(echecDe(adresse(f, f, f, f), LECTEUR)?.code).toBe('montage-hors-plafond');
  });

  it('EXCLUSIVITÉ — `desc` et `descRef` ensemble LÈVENT (deux vérités pour un texte)', () => {
    expect(echecDe({ desc: 'une copie', ...adresse(fragment('terreur', 0, 0)) }, LECTEUR)?.code).toBe('desc-et-descRef');
  });
});
