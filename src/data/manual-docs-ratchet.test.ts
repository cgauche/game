/**
 * Cliquet décroissant de la dette de doc MANUSCRITE (#903 — toute la documentation est GÉNÉRÉE
 * depuis le code, jamais écrite à la main). Ce lot ne génère rien : il fige la liste des docs
 * encore manuscrits (`manualDocsStock.mjs`) pour qu'un document manuscrit NEUF échoue la CI.
 *
 * Périmètre — `docs/*.md` À PLAT (hors sous-dossiers, `docs/plans/` et `docs/raw/` compris),
 * même frontière que `scripts/docs/check-doc-refs.mjs` (`readdirSync(DOCS_DIR)` non récursif).
 * Détection GÉNÉRÉ — marqueur `GÉNÉRÉ par` en tête de ligne dans les 10 premières lignes du doc ;
 * les deux formes mesurées dans le dépôt sont couvertes : « ⚠️ Fichier GÉNÉRÉ par … » et
 * « GÉNÉRÉ par `npx tsx …` ».
 *
 * Second volet (#903 suite) — le marqueur ne suffit pas à qualifier un doc de « généré » : rien
 * ne vérifiait que le script cité existe ni qu'il est chaîné dans `docs:check`. C'est exactement
 * le trou par lequel `docs/sorts-implementation.md` a pourri (en-tête GÉNÉRÉ, aucun script `npm`,
 * aucun `--check`, absent de la CI — 160 sorts d'écart mesurés avant correction). Ce fichier
 * verrouille que le marqueur ENGAGE réellement son générateur.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MANUAL_DOCS_STOCK } from '../../scripts/guards/lib/manualDocsStock.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DOCS_DIR = join(ROOT, 'docs');

const GENERATED_MARKER = /^>\s*(?:⚠️\s*)?(?:Fichier\s+)?GÉNÉRÉ par\b/m;

function isGenerated(text: string): boolean {
  const head = text.split('\n').slice(0, 10).join('\n');
  return GENERATED_MARKER.test(head);
}

function manualDocs(): string[] {
  return readdirSync(DOCS_DIR)
    .filter((f) => f.endsWith('.md'))
    .filter((f) => !isGenerated(readFileSync(join(DOCS_DIR, f), 'utf8')))
    .map((f) => `docs/${f}`);
}

/**
 * Plafond du stock cliqueté. Il vit ICI, dans le test, et NON dans `manualDocsStock.mjs` — sans
 * lui, « le stock ne peut que décroître » n'était qu'un commentaire, et le chemin le plus court
 * pour « solder » un doc manuscrit neuf restait d'ajouter une ligne au stock, CI verte. Toute
 * hausse de ce chiffre modifie CE fichier de test, jamais `manualDocsStock.mjs` seul. Il ne
 * DESCEND qu'en soldant des docs (génération ou suppression), jamais en ajoutant une entrée.
 */
const MANUAL_DOCS_MAX = 22;

describe('cliquet des docs manuscrits — docs/*.md à plat doit se GÉNÉRER, pas s’écrire à la main (#903)', () => {
  const docs = manualDocs();

  it('aucun doc manuscrit NEUF hors du stock — un doc neuf se GÉNÈRE, il ne s’inscrit pas au stock', () => {
    const horsStock = docs.filter((d) => !MANUAL_DOCS_STOCK.has(d));
    expect(
      horsStock.map((d) => `${d} est manuscrit et absent du stock — un doc neuf se GÉNÈRE, il ne s’inscrit pas au stock manuel`),
    ).toEqual([]);
  });

  it('le stock cliqueté ne peut que DÉCROÎTRE — aucune entrée désormais GÉNÉRÉE n’y traîne', () => {
    const perimees = [...MANUAL_DOCS_STOCK].filter((d) => !docs.includes(d));
    expect(perimees.map((d) => `retirer "${d}" du stock — il est désormais GÉNÉRÉ (ou n'existe plus)`)).toEqual([]);
  });

  it('le stock cliqueté ne GROSSIT pas — sa taille est plafonnée par le test', () => {
    expect(MANUAL_DOCS_STOCK.size).toBeLessThanOrEqual(MANUAL_DOCS_MAX);
  });
});

/**
 * Motif d'extraction du générateur cité en en-tête. Les formes mesurées dans le dépôt divergent
 * (« GÉNÉRÉ par `node scripts/docs/build-systemes.mjs` » vs « GÉNÉRÉ par `npx tsx
 * scripts/gen-sorts-doc.mts` ») : le motif capture tout le contenu entre backticks après
 * « GÉNÉRÉ par », puis retient le PREMIER token qui ressemble à un chemin de script exécutable
 * (`.mjs`/`.mts`/`.cjs`/`.ts`/`.js`) — insensible au lanceur (`node`, `npx tsx`…) qui le précède.
 */
const GENERATOR_QUOTE = /GÉNÉRÉ par\s+`([^`]+)`/;

function extractGeneratorScript(head: string): string | null {
  const m = head.match(GENERATOR_QUOTE);
  if (!m) return null;
  const token = m[1].split(/\s+/).find((t) => /\.(?:mjs|mts|cjs|ts|js)$/.test(t));
  return token ?? null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function generatedDocs(): { file: string; head: string }[] {
  return readdirSync(DOCS_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({ file: f, text: readFileSync(join(DOCS_DIR, f), 'utf8') }))
    .filter(({ text }) => isGenerated(text))
    .map(({ file, text }) => ({ file, head: text.split('\n').slice(0, 10).join('\n') }));
}

describe('le marqueur GÉNÉRÉ engage réellement son générateur (#903 suite)', () => {
  const PACKAGE_JSON = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>;
  };
  const DOCS_CHECK_SCRIPT = PACKAGE_JSON.scripts?.['docs:check'] ?? '';

  it('tout doc `GÉNÉRÉ par` cite un script qui existe et qui est chaîné en --check dans docs:check', () => {
    const violations = generatedDocs().flatMap(({ file, head }) => {
      const script = extractGeneratorScript(head);
      if (!script) {
        return [
          `docs/${file} se déclare GÉNÉRÉ sans citer de script exécutable en en-tête — un marqueur sans générateur pourrit en silence (précédent : docs/sorts-implementation.md, 160 sorts d'écart avant correction)`,
        ];
      }
      const violationsForDoc: string[] = [];
      if (!existsSync(join(ROOT, script))) {
        violationsForDoc.push(
          `docs/${file} se déclare GÉNÉRÉ par "${script}" — ce script n'existe pas sur disque : le marqueur pourrit en silence`,
        );
      }
      const wiredInCheck = new RegExp(`${escapeRegExp(script)}\\s+--check`).test(DOCS_CHECK_SCRIPT);
      if (!wiredInCheck) {
        violationsForDoc.push(
          `docs/${file} se déclare GÉNÉRÉ par "${script}" — absent (ou sans --check) du script "docs:check" de package.json : le marqueur pourrit en silence, non gardé par la CI`,
        );
      }
      return violationsForDoc;
    });
    expect(violations).toEqual([]);
  });
});

/**
 * Troisième volet (#908) — le marqueur `GÉNÉRÉ` engage son générateur (#903 suite), mais un
 * générateur qui ne déclare pas son PÉRIMÈTRE MESURÉ se lit comme exhaustif alors qu'aucune mesure
 * ne l'est. La section s'émet DEPUIS le générateur (jamais à la main dans le `.md`, sinon elle
 * périme comme le reste) — patron : `docs/vocabulaire-mecanique.md:33-36`.
 */
// Deux phrases co-présentes, PAS un mot isolé (piège de mesure consigné dans #908 : « périmètre »
// seul donne des faux positifs — `systemes.md` « nom/périmètre/état/ticket », une ligne de tableau
// de `sorts-implementation.md`). La forme du rendu diverge selon le générateur (bloc `**gras**` sur
// une ligne, titre `## Périmètre mesuré et angles morts`, ou blockquote `> ` multi-lignes) — le texte
// est donc normalisé (continuations de blockquote et retours à la ligne aplatis) avant le test.
function hasPerimeterSection(text: string): boolean {
  const normalized = text.replace(/\n>?\s*/g, ' ');
  return /P[ée]rim[èe]tre\s+mesur[ée]s?/i.test(normalized) && /angles?\s+morts?/i.test(normalized);
}

function fullGeneratedDocs(): { file: string; text: string }[] {
  return readdirSync(DOCS_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({ file: f, text: readFileSync(join(DOCS_DIR, f), 'utf8') }))
    .filter(({ text }) => isGenerated(text));
}

describe('tout doc `GÉNÉRÉ` déclare son périmètre mesuré et ses angles morts (#908)', () => {
  it('section « Périmètre mesuré / angles morts » présente dans chaque doc GÉNÉRÉ', () => {
    const violations = fullGeneratedDocs()
      .filter(({ text }) => !hasPerimeterSection(text))
      .map(
        ({ file }) =>
          `docs/${file} se déclare GÉNÉRÉ sans section « Périmètre mesuré / angles morts » — un généré qui ne dit pas ce qu'il ne couvre PAS se lit comme exhaustif ; la section s'émet depuis le générateur (patron : docs/vocabulaire-mecanique.md:33-36)`,
      );
    expect(violations).toEqual([]);
  });
});
