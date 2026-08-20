import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  scanBlindRefs, countsByFileRef, assertAgainstBaseline, readBaseline, isBlindRef,
  chapterFile, readText, significantWords, SITE_EXEMPTIONS, WINDOW, MIN_WORD_LEN,
} from '../scripts/guards/lib/rawRefIntegrity.mjs';

/**
 * Garde « réf RAW AVEUGLE » (#1318 axe B, verrou P5) — volet complémentaire de
 * `scripts/raw/check-code-refs.mjs` (qui, lui, ne borne que la ligne : hors borne du chapitre =
 * réf morte). Ici : la réf est DANS les bornes mais la ou les lignes citées sont VIDES, et la
 * fenêtre ±2 du chapitre ne partage AUCUN mot signifiant (≥5 lettres) avec le contexte porteur du
 * code. C'est la forme qu'avait la réf morte du chapitre 17 du LDB, ligne 84 : ligne vide d'un chapitre de 87
 * lignes, adossant une règle absente du livre (mesure : aucune occurrence de « ne transforme »/
 * « Degré de plus » dans tout le LDB) — l'appui RAW était fabriqué, la garde le refuse désormais à
 * l'écriture. NOTE DE GRAPHIE : ce fichier n'écrit AUCUNE réf en graphie canonique `LDB <ch> l.<n>`
 * (elles sont construites par `fixtureRef`, cf. plus bas) — les scanners du dépôt liraient un
 * spécimen de test comme une citation vivante.
 *
 * PORTÉE MESURÉE du recouvrement (à énoncer, pas à supposer) : il est LEXICAL, sur le préfixe de 5
 * lettres — « nourriture » recouvre « nourri », « colère » recouvre « colères », mais un radical
 * distinct, un synonyme ou le terme anglais du code ne recouvrent RIEN. Une dérive de ligne Marker
 * n'est donc innocentée que si son sujet reste à ±2 lignes ET s'écrit pareil : c'est ce qui peuple
 * l'essentiel du stock gelé. Mesures du 2026-08-16 sur le même arbre : 161 sites sans le préfixe
 * (dont 84 avaient pourtant leur sujet à ±6 lignes, rougis sur un pluriel), 108 avec.
 *
 * REGISTRE : `scripts/guards/raw-blind-refs-baseline.json` gèle, par fichier × réf, les sites
 * aveugles tolérés — le COMPTE vit dans ce JSON, jamais recopié ici (un nombre en dur y périmerait
 * à chaque solde). Cliquet à double sens : une réf aveugle NEUVE échoue ; une
 * réf réparée échoue tant que le registre n'est pas abaissé. Solder une entrée = lire le `Source/` et
 * réancrer la réf sur la ligne qui porte le passage. Re-geler après solde : voir `countsByFileRef` +
 * `serializeBaseline` (lib). Le registre est à `{}` : toute réf aveugle est désormais un ÉCHEC, sans
 * seuil à négocier — le contrat que ce fichier verrouille est « zéro réf aveugle dans `src/` ».
 *
 * ANGLE MORT ASSERTÉ (mesuré, pas supposé) : une réf pointant une ligne PLEINE mais ÉTRANGÈRE au
 * passage est invisible aux DEUX volets — ni `check-code-refs` (elle est dans les bornes du
 * chapitre) ni celui-ci (la ligne n'est pas vide). Le lot E3-L1 en a mesuré 18 dans le seul
 * chapitre 85 du LDB, où la section Taille a glissé d'environ 65 lignes après la ré-extraction
 * Marker : les réfs tombaient en plein texte de « Régénération »/« Résistance à la Magie ». Les
 * détecter exigerait un recouvrement SÉMANTIQUE généralisé (le recouvrement lexical à ±2 lignes ne
 * mord pas ici : la ligne visée est pleine, donc jamais soumise au test) — coût à chiffrer, hors E3.
 * Ce qui les rend TRIABLES sans garde assertive : `node scripts/raw/audit-refs-chapitre.mjs LDB 85`
 * confronte TOUTE réf d'un chapitre au texte de sa ligne, triée par ligne citée — le verdict reste
 * humain (lecture du `Source/`). C'est l'outil qui a levé 13 sites survivants au lot E3-L11, tous
 * verts pour les trois gardes.
 */

/**
 * Réf de FIXTURE, CONSTRUITE et jamais écrite en graphie canonique : ce fichier est scanné par les
 * scanners de réfs du dépôt (`reconcile.mjs` sens A, `check-code-refs.mjs`, `build-implemente`), qui
 * ne distinguent pas une citation d'un spécimen de test — une fixture littérale `LDB <ch> l.<n>` s'y
 * lit comme une vraie citation (vécu : `ch.1 ligne 2` a compté comme trou dur du sens A).
 */
const fixtureRef = (ch: number, line: number): string => ['LDB', String(ch), `l.${line}`].join(' ');
/** Commentaire de fixture porteur d'une réf construite (même raison). */
const fixtureLine = (texte: string, ch: number, line: number): string =>
  `// ${texte} ${fixtureRef(ch, line)}\nexport const zzz = 1;\n`;
describe('garde « réf RAW aveugle » — ligne citée VIDE et sans recouvrement (#1318 P5)', () => {
  const blind = scanBlindRefs();
  const counts = countsByFileRef(blind);
  const baseline = readBaseline();
  const { over, stale } = assertAgainstBaseline(counts, baseline);

  it('aucune réf aveugle NEUVE (ligne vide + zéro recouvrement) hors registre gelé', () => {
    const detail = over.map((o) => {
      const first = blind.find((b) => o.startsWith(`${b.file} — ${b.ref}`));
      return first ? `${o}  [${first.file}:${first.row}]` : o;
    });
    expect(
      detail,
      'Réf(s) RAW citant une ligne VIDE dont la fenêtre ±2 ne porte rien du sujet : lire le Source/ et\n' +
        'réancrer sur la ligne qui porte le passage (ou, si le site est irréductible, exemption AU SITE\n' +
        `datée dans SITE_EXEMPTIONS) :\n${detail.join('\n')}`,
    ).toEqual([]);
  });

  it('CLIQUET : toute entrée du registre devenue périmée (réf réparée) doit être ABAISSÉE', () => {
    expect(stale, `Registre PÉRIMÉ — abaisser raw-blind-refs-baseline.json :\n${stale.join('\n')}`).toEqual([]);
  });

  it('MORSURE DE BOUT EN BOUT — `scanBlindRefs` sur une arborescence FIXTURE : détecte, innocente, oublie', () => {
    const dir = mkdtempSync(join(tmpdir(), 'raw-ref-integrity-'));
    try {
      // 1. Réf sur une ligne VIDE du chapitre réel, contexte étranger → détectée, nominativement.
      writeFileSync(join(dir, 'mut.ts'), fixtureLine('une regle inventee adossee', 17, 84));
      const vus = scanBlindRefs(dir);
      expect(vus.map((b: { ref: string; row: number }) => `${b.row}:${b.ref}`)).toEqual([`1:${fixtureRef(17, 84)}`]);
      expect(assertAgainstBaseline(countsByFileRef(vus), {}).over.length).toBe(1);

      // 2. La MÊME ligne citée sur la ligne PLEINE qui porte la règle (l.24) → innocentée.
      writeFileSync(join(dir, 'mut.ts'), fixtureLine('une regle inventee adossee', 17, 24));
      expect(scanBlindRefs(dir)).toEqual([]);

      // 3. Ligne vide MAIS contexte qui reprend le sujet de la fenêtre (dérive Marker) → innocentée.
      writeFileSync(join(dir, 'mut.ts'), fixtureLine('Chance : ajouter un Degre a un Test deja effectue', 17, 26));
      expect(scanBlindRefs(dir)).toEqual([]);

      // 4. Réf retirée → plus rien (le cliquet peut redescendre).
      writeFileSync(join(dir, 'mut.ts'), 'export const zzz = 1;\n');
      expect(scanBlindRefs(dir)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('CLIQUET (fixture) : hausse = `over`, baisse = `stale` — les deux sens mordent', () => {
    const ref = fixtureRef(1, 2);
    expect(assertAgainstBaseline({ 'a.ts': { [ref]: 2 } }, { 'a.ts': { [ref]: 1 } }).over.length).toBe(1);
    expect(assertAgainstBaseline({}, { 'a.ts': { [ref]: 1 } }).stale.length).toBe(1);
    expect(assertAgainstBaseline({ 'a.ts': { [ref]: 1 } }, { 'a.ts': { [ref]: 1 } })).toEqual({ over: [], stale: [] });
  });

  it('RÉGIME CIBLE : l’arbre réel ne porte AUCUNE réf aveugle, et le registre est VIDE', () => {
    expect(blind.map((b: { file: string; row: number; ref: string }) => `${b.file}:${b.row} — ${b.ref}`)).toEqual([]);
    expect(baseline).toEqual({});
  });

  it('CLIQUET sur une MESURE RÉELLE : un site aveugle scanné sur un chapitre RÉEL monte en `over`, l’inscrire l’éteint, le retirer le rend `stale`', () => {
    const dir = mkdtempSync(join(tmpdir(), 'raw-ref-integrity-cliquet-'));
    try {
      writeFileSync(join(dir, 'mut.ts'), fixtureLine('une regle inventee adossee', 17, 84));
      const mesure = countsByFileRef(scanBlindRefs(dir));
      const [fichier] = Object.keys(mesure);
      const ref = Object.keys(mesure[fichier])[0];
      // Le registre confronté est CONSTRUIT ici, jamais dérivé du registre du dépôt : ce test doit
      // mordre à l'identique quand le stock réel se repeuple (une entrée étrangère y ferait `stale`).
      // (a) registre VIDE : le site mesuré n'y figure pas → rouge nominatif.
      expect(assertAgainstBaseline(mesure, {}).over.some((o: string) => o.startsWith(`${fichier} — ${ref}`))).toBe(true);
      // (b) inscrit à sa mesure → plus rien.
      const inscrit = { [fichier]: { [ref]: 1 } };
      expect(assertAgainstBaseline(mesure, inscrit)).toEqual({ over: [], stale: [] });
      // (c) le site disparaît, l'entrée reste → périmée.
      expect(assertAgainstBaseline({}, inscrit).stale.some((s: string) => s.startsWith(`${fichier} — ${ref}`))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('MORSURE — le cas historique (ch.17 ligne 84) est ROUGE sur le chapitre RÉEL, la ligne qui porte la règle est VERTE', () => {
    const cf = chapterFile('LDB', '17');
    expect(cf).not.toBeNull();
    const lines = readText(cf!.path).split('\n');
    expect(lines[86].trim()).not.toBe(''); // l.87 = dernière ligne de texte du chapitre
    expect(lines[83].trim()).toBe(''); // ligne 84 = VIDE

    // Contexte porteur historique, tel qu'il vivait dans rollFlowSpecs.ts avant ce lot.
    const contexteHistorique = "DR, `success`/`roll` INTACTS (un Degré de plus ne transforme pas un échec en réussite).";
    expect(isBlindRef(lines, 84, 84, contexteHistorique, WINDOW, MIN_WORD_LEN)).toBe(true);

    // La ligne RÉELLE de l'option de Chance (l.24) porte le texte : jamais rougie.
    expect(lines[23]).toContain('Ajouter +1 DR à un Test après');
    expect(isBlindRef(lines, 24, 24, contexteHistorique, WINDOW, MIN_WORD_LEN)).toBe(false);
  });

  it('PORTÉE du recouvrement : le préfixe de 5 lettres tolère la FORME (pluriel/dérivé), jamais le synonyme', () => {
    const commun = (a: string, b: string) => [...significantWords(b)].some((w: string) => significantWords(a).has(w));
    expect(commun('la nourriture du campement', 'personnage nourri')).toBe(true);   // nourriture / nourri
    expect(commun('accès de colère', 'les colères du Meurtre')).toBe(true);         // colère / colères
    expect(commun('perte d’Avantage', 'les avantages du camp')).toBe(true);         // avantage / avantages
    expect(commun('portée du projectile', 'encombrement du navire')).toBe(false);   // radicaux distincts
    expect(commun('Blessure critique', 'wound modifier stack')).toBe(false);       // vocabulaire de code étranger
    // …mais un cognat FR/EN qui partage le préfixe recouvre (portée réelle, mesurée) :
    expect(commun('Blessure critique', 'critical hit')).toBe(true);                // critique / critical → « criti »
    expect(significantWords('nourriture').has('nourr')).toBe(true);                 // radical = préfixe 5
    expect(significantWords('etat').size).toBe(0);                                  // < 5 lettres : ignoré
  });

  it('MORSURE — dérive Marker : ligne VIDE dont la fenêtre ±2 porte le sujet reste VERTE', () => {
    const cf = chapterFile('LDB', '17');
    const lines = readText(cf!.path).split('\n');
    expect(lines[25].trim()).toBe(''); // ligne 26 = vide (la vraie règle est en l.24, à ±2)
    // Contexte qui NOMME le sujet présent dans la fenêtre (« Ajouter +1 DR à un Test ») :
    expect(isBlindRef(lines, 26, 26, "Chance : ajouter un Degré à un Test déjà effectué", WINDOW, MIN_WORD_LEN)).toBe(false);
    // …et le MÊME emplacement redevient rouge sous un contexte étranger à la fenêtre.
    expect(isBlindRef(lines, 26, 26, "portee des projectiles et encombrement du navire", WINDOW, MIN_WORD_LEN)).toBe(true);
  });

  it('les réfs corrigées dans le lot de pose pointent une ligne PLEINE du chapitre', () => {
    const cas: Array<[string, string, number, string]> = [
      ['LDB', '17', 24, 'Ajouter +1 DR à un Test'],
      ['LDB', '12', 11, 'inférieur ou égal'],
      ['LDB', '12', 40, 'Relance'],
      ['LDB', '10', 767, 'Maniement de deux armes'],
      ['LDB', '16', 7, 'vous perdez immédiatement tout Avantage'],
      ['LDB', '17', 59, 'immunisé à *Psychologie*'],
      ['LDB', '46', 121, 'capable de voir'],
      ['LDB', '16', 13, 'ne se cumulent pas'],
    ];
    const manquants = cas.filter(([abbr, nn, row, needle]) => {
      const cf = chapterFile(abbr, nn);
      if (!cf) return true;
      return !readText(cf.path).split('\n')[row - 1]?.includes(needle);
    }).map(([abbr, nn, row, needle]) => `${abbr} ${nn} l.${row} ne contient pas « ${needle} »`);
    expect(manquants, manquants.join('\n')).toEqual([]);
  });

  it('toute exemption AU SITE porte sa raison ET sa date (jamais une exemption au fichier)', () => {
    const mal = SITE_EXEMPTIONS.filter(
      (e: { file?: string; row?: number; ref?: string; raison?: string; date?: string }) =>
        !e.file || !e.row || !e.ref || !e.raison || !/^\d{4}-\d{2}-\d{2}$/.test(e.date ?? ''),
    );
    expect(mal, `Exemption(s) incomplète(s) : ${JSON.stringify(mal)}`).toEqual([]);
  });

  it('le registre gelé ne nomme que des fichiers src/ réellement présents', () => {
    const fantomes = Object.keys(baseline).filter((f) => {
      try { readFileSync(f, 'utf8'); return false; } catch { return true; }
    });
    expect(fantomes, `Entrée(s) fantôme(s) du registre :\n${fantomes.join('\n')}`).toEqual([]);
  });
});
