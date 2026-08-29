/**
 * Schéma de `decorPalette.json` — palette de tons NOMMÉS (bois/terre/or/sang/pierre/os/feuillage/azur/
 * arcane/pourpre/patine/ombre/blanc + groupe `villageois*`), consommée par `catalog/decorPalette.ts`
 * (`export const P: Record<DecorTone, string> = raw.entries`, `DecorTone = keyof typeof raw.entries`).
 * Document de famille `record` : sa carte ton→couleur vit sous `entries` (#1467 L1b V-FLIP-RECORD),
 * et ses CLÉS restent OUVERTES — le nombre de tons par famille grandit librement, les fermer ferait
 * de 435 jetons d'art autant de clés OBLIGATOIRES au sceau.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';

export const file = 'decorPalette.json';
export const famille = 'record';

const doc = document(
  'decorPalette',
  famille,
  {},
  {},
  {
    codex: {
      exempt: {
        kind: 'vocabulaire-app-interne',
        raison:
          "palette de couleurs de rendu (hex), pas une fiche de contenu (vocabulaire app-interne de rendu)",
      },
    },
    edit: { none: "palette d'art éditée au fichier (aucun écran d'atelier ne l'expose)" },
  },
  /** Valeurs observées : hex 3/6/8 chiffres (`#fff`, `#5a4a33`, `#94908648` — 8 chiffres = alpha RVBA). */
  { valeurRecord: z.string() },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
