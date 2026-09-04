/**
 * Garde d'INTÉGRITÉ de la relation-livre : tout `source.book` porté par une entrée de `src/data/*.json`
 * doit être l'`id` STABLE d'un livre de `books.json` — jamais un libellé ni une abréviation libre.
 * Relation id-pure (i18n-safe) : `books.json` devient la SOURCE DE VÉRITÉ enforced des réfs de livre.
 * Scan file-based de `src/data` (exhaustif, comme `serialize.test.ts`), `src/data` SEUL (pas les worktrees).
 *
 * Volet 2 (#536) — INTÉGRITÉ DU FOLIO : le `book` juste ne prouve pas la `page` juste. La `desc`
 * étant un copié/collé verbatim (règle stricte 5), elle localise l'entrée dans le `Source/` du livre
 * déclaré ; l'encadrement `data-folio` de l'occurrence réfute alors le folio qui ment. Mécanique
 * dans `scripts/guards/lib/folioIntegrity.mjs`, stock gelé dans `folioRatchetStock.mjs`.
 *
 * PÉRIMÈTRE MESURÉ ET ANGLE MORT au 2026-09-01 (après B2/B3) : `src/data/*.json` porte 4500 entrées
 * à `source:{book,page}` ; 1206 citent aussi une ligne et `folio-line-align.test.ts` n'en juge que
 * 312 (894 écartées : 888 hors-forme, 6 queue-trouée), soit 6,9 % des folios vérifiés machine par
 * cette voie. Ces deux chiffres ne sont plus qu'écrits ici : `folio-line-align.test.ts` les CLIQUÈTE
 * (`SCANNED_MIN` croissant, `SANS_CITATION_MAX` décroissant).
 * Cette garde-ci scanne 2716 entrées et en laisse 1252 hors de tout verdict d'encadrement
 * (878 descs introuvables, 140 trop courtes, 92 en chapitre sans marqueur, 142 en livre hors Atlas) ;
 * `noteAuthored` est empruntée 1 fois (`maladies.json:infection-du-sang` p.186).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { books } from './index';
import { auditFolios } from '../../scripts/guards/lib/folioIntegrity.mjs';
import { FOLIO_RATCHET } from '../../scripts/guards/lib/folioRatchetStock.mjs';
import { FOLIO_TITLE_RATCHET } from '../../scripts/guards/lib/folioTitleRatchetStock.mjs';

const DIR = fileURLToPath(new URL('.', import.meta.url));
const BOOK_IDS = new Set(books.map((b) => b.id));
/** Scan UNIQUE partagé par les deux voies : il relit tout `Source/`. */
const AUDIT = auditFolios(DIR);

function collectBooks(o: unknown, acc: Set<string>): void {
  if (o == null || typeof o !== 'object') return;
  if (Array.isArray(o)) { for (const x of o) collectBooks(x, acc); return; }
  const rec = o as Record<string, unknown>;
  if (typeof rec.book === 'string') acc.add(rec.book);
  for (const v of Object.values(rec)) collectBooks(v, acc);
}

describe('relation-livre id-pure — tout source.book est un id de books.json', () => {
  const files = readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== 'books.json');
  for (const f of files) {
    it(`${f} : source.book ∈ ids de livres`, () => {
      const found = new Set<string>();
      collectBooks(JSON.parse(readFileSync(join(DIR, f), 'utf8')), found);
      expect([...found].filter((b) => !BOOK_IDS.has(b))).toEqual([]);
    });
  }
  it('books.json : ids uniques et non vides', () => {
    const ids = books.map((b) => b.id);
    expect(ids.every((x) => !!x)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

/**
 * Plafond du stock cliqueté. Il vit ICI, dans la garde, et NON dans le fichier de stock : sans lui,
 * « le stock ne peut que décroître » n'était qu'un commentaire, et le chemin le plus court pour
 * « solder » une régression restait d'ajouter une ligne au stock, CI verte (précédent `reconcile` :
 * 157 dettes affichées, CI verte). Le relever est un geste délibéré, visible en revue — l'inverse
 * d'un append discret. Il ne DESCEND qu'en soldant des folios au Source.
 */
const FOLIO_RATCHET_MAX = 109;

describe('intégrité du folio — source.page pointe sur la page qui porte la desc (#536)', () => {
  const { violations } = AUDIT;
  const found = new Set(violations.map((v) => v.key));

  it('aucune entrée NEUVE ne déclare un folio réfuté par son Source', () => {
    const nouvelles = violations.filter((v) => !FOLIO_RATCHET.has(v.key));
    expect(
      nouvelles.map((v) => {
        if (v.voie === 'hors-livre') {
          return `${v.key} (${v.book}) déclare p.${v.page}, or le livre s’arrête au folio ${v.max}`;
        }
        const reel = v.ranges
          .map((r) => (r.hi === null ? `${r.lo}+` : r.lo === r.hi ? `${r.lo}` : `${r.lo}-${r.hi}`))
          .join(',');
        return `${v.key} (${v.book}) déclare p.${v.page}, desc trouvée en folio ${reel}`;
      }),
    ).toEqual([]);
  });

  it('le stock cliqueté ne peut que DÉCROÎTRE — aucune clé soldée n’y traîne', () => {
    expect([...FOLIO_RATCHET].filter((k) => !found.has(k))).toEqual([]);
  });

  it('le stock cliqueté ne GROSSIT pas — sa taille est plafonnée par la garde', () => {
    expect(FOLIO_RATCHET.size).toBeLessThanOrEqual(FOLIO_RATCHET_MAX);
  });
});

/**
 * Plafond du stock de la VOIE C, même rôle et même lecture que `FOLIO_RATCHET_MAX`. À ZÉRO depuis
 * le solde des 57 clés de la pose (#1225) : toute réfutation par titre est désormais un échec, il
 * n'y a plus de dette à cliqueter.
 */
const FOLIO_TITLE_RATCHET_MAX = 0;

/**
 * Plafond des entrées IRRÉSOLUES — ni desc verbatim, ni titre de section. C'est le compte de ce que
 * la garde ne PEUT pas juger ; il ne se solde qu'en recollant des descs au verbatim (règle 5) ou en
 * nommant les entrées comme leur livre les intitule. Plafonné pour la même raison que les stocks :
 * sans plafond, « la garde couvre de plus en plus » n'est qu'un commentaire.
 */
/**
 * Plafond des IRRÉSOLUES. Relevé 661 → 713 le 2026-08-27 (#1467 L1b V-P2) : c'est la POPULATION
 * mesurée qui a grandi, pas le détecteur qui a faibli. L'audit ne voit une entrée que si elle porte
 * une `desc` ; la migration `text` → `desc` fait entrer d'un coup la prose d'`interludeEvents`,
 * `peripeties`, `mass-battle › hazards` et `land-cargo › rumours` (mesuré au rendu de la garde :
 * 30 + 10 + 10 + 20 irrésolues sur ces quatre fichiers). Le plafond ne DESCEND qu'en soldant des
 * folios au `Source/` ; l'entrée `interludeEvents:kleptomane`, elle, n'était pas irrésolue mais
 * RÉFUTÉE (folio 193 déclaré, desc en 194) — corrigée à la donnée dans le même lot.
 *
 * Relevé 713 → 771 le 2026-08-28 (#1467 L1b V-FLIP-CONFIG), même lecture — `aa-criticals.json` est
 * depuis #1657 B2a l'un des deux jeux de `criticals.json`, ces 80 entrées y sont toujours : il ne
 * portait AUCUNE `source` (une note libre `_source` approximative), ses 80 entrées étaient donc hors
 * de l'audit. Sourcées au folio, elles y entrent : 22 sont prouvées par leur desc, 58 restent
 * irrésolues (51 `desc-introuvable`, 7 `desc-trop-courte` — les cellules du tableau AA portent des
 * `<br>` que la desc recolle sans les reproduire). Zéro réfutée : le volet « aucune entrée NEUVE
 * réfutée » est resté VERT sur ces 80. Population qui grandit, pas détecteur qui faiblit.
 *
 * Relevé 771 → 775 le 2026-08-31 (#677) : `reseau-routier.json` entre à l'audit avec 9 `desc`
 * citées, dont 4 restent irrésolues — 3 classes de route déclarées au folio 19, qu'`EDOC 06` ne
 * marque d'AUCUNE ancre `data-folio` (verdict `sans-marqueur` : le span est introuvable, pas la
 * desc), et `patrouille-routiere` (folio 39) dont la desc recolle les deux moitiés d'une phrase que
 * l'extraction coupe autour de l'encadré « LES JUSTICIERS » — même classe que les `<br>` des tables
 * d'Aux Armes ci-dessus. Population qui grandit, pas détecteur qui faiblit.
 */
// 775 → 776 (#1657 B3-2b-a). MESURÉ : les 3 irrésolues neuves sont les stations `pont` (p.119),
// `greement` (p.118) et `avirons` (p.120) de `ship-stations.json` — desc-introuvable ET
// titre-introuvable. Leur `desc` recolle une CELLULE de tableau MDG 13 que l'extraction coupe par des
// `<br>` (« se trouve sur le pont, il<br>doit réussir », l.730 ; « se trouve<br>dans le gréement »,
// l.714 ; « se trouve aux<br>avirons », l.751) : la voie DESC cherche le verbatim d'un seul tenant et
// ne le retrouve pas. Les garder AVEC leurs `<br>` est exclu — c'est du HTML, que la règle 5 interdit
// et que `no-html-in-prose.test.ts` refuse (`HTML_TAG` couvre `br`). Les 3 autres entrées du lot
// (`nid-de-pie` MDG 12 l.303, station `cale` et Trait `cale` MSRC 07 l.94) citent de la PROSE continue
// et sont RÉSOLUES. Le cliquet est un PLAFOND : le compte réel à l'arbre précédent était sous 775.
const UNRESOLVED_MAX = 776;

describe('intégrité du folio — voie TITRE de section, et skip BRUYANT de ce qui reste (#1200)', () => {
  const { titleViolations, noteAuthored, unresolved, stats, total } = AUDIT;
  const found = new Set(titleViolations.map((v) => v.key));

  it('aucune entrée NEUVE ne déclare un folio réfuté par le titre de sa section', () => {
    expect(
      titleViolations
        .filter((v) => !FOLIO_TITLE_RATCHET.has(v.key))
        .map(
          (v) =>
            `${v.key} (${v.book}) déclare p.${v.page}, titre le plus proche en folio ${v.proche?.lo ?? '?'} (écart ${v.ecart})`,
        ),
    ).toEqual([]);
  });

  it('le stock des titres ne peut que DÉCROÎTRE — aucune clé soldée n’y traîne', () => {
    expect([...FOLIO_TITLE_RATCHET].filter((k) => !found.has(k))).toEqual([]);
  });

  it('le stock des titres ne GROSSIT pas — sa taille est plafonnée par la garde', () => {
    expect(FOLIO_TITLE_RATCHET.size).toBeLessThanOrEqual(FOLIO_TITLE_RATCHET_MAX);
  });

  it('ce que NI la desc NI le titre ne résolvent est compté et LISTÉ, jamais tu', () => {
    const parFichier = new Map<string, string[]>();
    for (const u of unresolved) {
      const l = parFichier.get(u.file) ?? [];
      l.push(`${u.key.slice(u.file.length + 1)} p.${u.page} (${u.descVerdict}/${u.titreVerdict})`);
      parFichier.set(u.file, l);
    }
    console.log(
      `FOLIO — ${total} entrées citées : ${stats['folio-ok'] ?? 0} prouvées par la desc, ${
        stats['titre:titre-ok'] ?? 0
      } par le titre, ${violationsCount(stats)} réfutées, ${noteAuthored.length} à NOTE AUTHORÉE (jamais cliquetées : ${noteAuthored
        .map((n) => `${n.key} p.${n.page} « ${n.note} »`)
        .join(' ; ')}), ${unresolved.length} IRRÉSOLUES :\n` +
        [...parFichier]
          .sort((a, b) => b[1].length - a[1].length)
          .map(([f, l]) => `  ${f} (${l.length}) : ${l.join(', ')}`)
          .join('\n'),
    );
    expect(unresolved.length).toBeLessThanOrEqual(UNRESOLVED_MAX);
  });
});

/** Somme des verdicts réfutants, pour la ligne de compte du skip bruyant. */
function violationsCount(stats: Record<string, number>): number {
  return (stats['folio-ment'] ?? 0) + (stats['folio-impossible'] ?? 0) + (stats['titre:titre-ment'] ?? 0);
}
