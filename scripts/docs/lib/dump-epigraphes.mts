// Passerelle TS→JSON de l'ÉPIGRAPHE de Carrière : `scripts/docs/build-codex-relations.mjs` tourne
// sous Node nu et ne peut ni importer `src/data` ni exécuter `extractEpigraph` (TS). Ce dumper,
// lancé par `npx tsx`, écrit `{ total, avecEpigraphe, folios: [min, max] }` — le .md ne recopie
// jamais un compte à la main, et la SÉLECTION reste celle du code (aucune re-implémentation ici).
import { careers } from '../../../src/data';
import { extractEpigraph } from '../../../src/ui/compendium/registry';

const folios = careers.map((c) => c.source?.page).filter((p): p is number => typeof p === 'number');
process.stdout.write(
  JSON.stringify({
    total: careers.length,
    avecEpigraphe: careers.filter((c) => extractEpigraph(c.desc ?? '').epigraph).length,
    folios: folios.length ? [Math.min(...folios), Math.max(...folios)] : null,
    livres: [...new Set(careers.map((c) => c.source?.book).filter(Boolean))],
  }),
);
