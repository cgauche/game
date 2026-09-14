// Passerelle TS→JSON de l'EXERGUE de Carrière : `scripts/docs/build-codex-relations.mjs` tourne
// sous Node nu et ne peut ni importer `src/data` ni monter un composant React. Ce dumper, lancé par
// `npx tsx`, écrit `{ total, avecEpigraphe, couples, folios, livres }` — le .md ne recopie jamais un
// compte à la main, et la DÉTECTION reste celle du code : on MONTE `<Prose exergues>` et on compte
// les blocs rendus (aucune re-implémentation du prédicat ici).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { careers } from '../../../src/data';
import { Prose } from '../../../src/ui/Prose';

const blocs = (md: string): number =>
  (renderToStaticMarkup(createElement(Prose, { md, exergues: true })).match(/class="prose-exergue"/g) ?? []).length;

const parCarriere = careers.map((c) => blocs(c.desc ?? ''));
const folios = careers.map((c) => c.source?.page).filter((p): p is number => typeof p === 'number');
process.stdout.write(
  JSON.stringify({
    total: careers.length,
    avecEpigraphe: parCarriere.filter((n) => n > 0).length,
    couples: parCarriere.reduce((s, n) => s + n, 0),
    folios: folios.length ? [Math.min(...folios), Math.max(...folios)] : null,
    livres: [...new Set(careers.map((c) => c.source?.book).filter(Boolean))],
  }),
);
