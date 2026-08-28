/**
 * Schéma de `books.json` — SOURCE UNIQUE des acronymes de livres (ref #585) :
 * `abbr` est l'UNIQUE champ d'acronyme (affichage Compendium ET Atlas RAW), sans doublon `abr`.
 * `id` = relation id-pure vers `source.book` (migration `21aa4881`). `dir` = chemin d'extraction
 * `Source/…` pour les 15 livres couverts par l'Atlas RAW ; absent pour les 14 autres. `BOOKS` de
 * `scripts/raw/_lib.mjs` DÉRIVE de `books.json` (filtre les entrées `dir`), sans liste en dur
 * à synchroniser. `language`/`folder` sont typés nullable par l'interface mais toujours renseignés
 * (string) sur les 29 entrées observées ; `desc` est le seul champ réellement null (1/29).
 *
 * `desc` (clé d'ENVELOPPE) porte ici un HTML de présentation (bibliographie) — hors du périmètre
 * `<Prose>` : ce n'est pas un texte de règle copié/collé verbatim d'un livre, mais une notice
 * éditoriale du dataset lui-même.
 *
 * SANS PROVENANCE : `books` est inscrit à `SANS_LIVRE` — un livre ne se cite pas lui-même.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';

export const file = 'books.json';
export const famille = 'entite';

const doc = document(
  'books',
  famille,
  {
    abbr: z.string(),
    /** Chemin d'extraction `Source/…` — présent sur les 15 livres couverts par l'Atlas RAW. */
    dir: z.string().nullable().optional(),
    /** Chemin d'extraction `Source/…` d'un livre HORS Atlas RAW (`scripts/raw/_lib.mjs#BOOK_ORDER`
     *  ne le porte pas, donc pas de pont folio ni de fiche RAW) dont les chapitres sont néanmoins
     *  sur disque et citables — `frenchy-bzh`. Lu par `skillSpecWalk.mjs#sourceDirOf`. */
    extractionDir: z.string().nullable().optional(),
    language: z.string().nullable(),
    folder: z.string().nullable(),
  },
  {
    abbr: { label: 'Acronyme', hint: 'Acronyme d’affichage du livre (Compendium et Atlas RAW)' },
    dir: { label: 'Dossier d’extraction (Atlas)', hint: 'Chemin `Source/…` du livre, pour les 15 livres couverts par l’Atlas RAW' },
    extractionDir: { label: 'Dossier d’extraction (hors Atlas)', hint: 'Chemin `Source/…` d’un livre hors Atlas RAW mais citable' },
    language: { label: 'Langue', hint: 'Langue de l’édition (VF/VO)' },
    folder: { label: 'Rayon de classement', hint: 'Catégorie de rangement du livre (Livre de Règle, Cadre de campagne…)' },
  },
  {
    codex: { keys: ['books'] },
    edit: { dataset: 'books' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;
