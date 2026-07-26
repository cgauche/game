/**
 * Garde d'ATTESTATION des emplacements SECONDAIRES `alsoIn[]` (#563 Lot 1 item 2). L'ANCRE
 * (`source`) reste vérifiée par `book-source-integrity.test.ts` (règle 5, voie A/B) ; ce module
 * vérifie que chaque `alsoIn[i]` porte une PREUVE POSITIVE (label de l'entrée, ou `quote` authoré)
 * retrouvée dans le SPAN du folio déclaré — charge de la preuve sur l'auteur, jamais une réfutation
 * par absence (doctrine `folioIntegrity.mjs` — un folio de TABLE ne porte pas la desc, `quote`
 * couvre ce cas, ex. `zweihander-flamberge`/`cimeterre`).
 *
 * Lot 2 (#563) a migré 15 entrées réelles (`traits.json`/`qualities.json`/`trappings.json`/
 * `spells.json`/`naval-traits.json`) — les morsures ci-dessous gardent des fixtures SYNTHÉTIQUES
 * pour isoler chaque cas, contre le VRAI corpus `Source/` (jamais des livres inventés), patron déjà
 * établi par `book-source-integrity.test.ts` pour l'ancre.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditSecondaries, auditSecondaryRef, secondaryEntriesOf } from '../../scripts/guards/lib/folioIntegrity.mjs';

const DIR = fileURLToPath(new URL('.', import.meta.url));

describe('secondaryEntriesOf — walk de `alsoIn[]`', () => {
  it('collecte chaque emplacement secondaire avec le label du porteur et son propre quote', () => {
    const data = [
      {
        id: 'exemple',
        label: 'Exemple',
        source: { book: 'livre-de-base', page: 1 },
        alsoIn: [{ book: 'zoo-imperial', page: 23, quote: 'une preuve' }],
      },
    ];
    expect(secondaryEntriesOf(data)).toEqual([
      { key: 'exemple.alsoIn[0]', book: 'zoo-imperial', page: 23, label: 'Exemple', quote: 'une preuve' },
    ]);
  });

  it('ignore une entrée sans alsoIn', () => {
    expect(secondaryEntriesOf([{ id: 'x', label: 'X', source: { book: 'livre-de-base', page: 1 } }])).toEqual([]);
  });
});

describe('auditSecondaryRef — attestation POSITIVE (#563 Lot 1 item 2, morsures)', () => {
  it('ATTESTÉ par LABEL : `Fouissement` retrouvé dans le span du folio 23 déclaré (ZI, réel)', () => {
    // ZI 02 - Griffon.md : marqueur data-folio="23" en tête, section "FOUISSEMENT" quelques lignes
    // après, avant le marqueur suivant — span réel, aucun livre inventé.
    const r = auditSecondaryRef({ book: 'zoo-imperial', page: 23, label: 'Fouissement', quote: undefined });
    expect(r.verdict).toBe('attesté');
    expect(r.via).toBe('label');
  });

  it('MORSURE (a) — ni label ni quote dans le span déclaré → non-attesté (rouge)', () => {
    // Folio 1 du ZI existe (dans les bornes), mais ce label fabriqué n'y figure nulle part.
    const r = auditSecondaryRef({ book: 'zoo-imperial', page: 1, label: 'Fouissement-Inexistant-XYZ', quote: undefined });
    expect(r.verdict).toBe('non-attesté');
  });

  it('MORSURE (b) — folio hors bornes du livre → folio-impossible (rouge)', () => {
    const r = auditSecondaryRef({ book: 'zoo-imperial', page: 999999, label: 'Fouissement', quote: undefined });
    expect(r.verdict).toBe('folio-impossible');
    expect(typeof r.max).toBe('number');
  });

  it('MORSURE (c) — quote NON verbatim (mot altéré) → non-attesté (rouge)', () => {
    const r = auditSecondaryRef({
      book: 'zoo-imperial',
      page: 23,
      label: undefined,
      quote: "cette créature peut se déplacer en VOLANT un tunnel dans la terre",
    });
    expect(r.verdict).toBe('non-attesté');
  });

  it('ATTESTÉ par QUOTE verbatim (cas TABLE, où le label du porteur ne suffit pas)', () => {
    const r = auditSecondaryRef({
      book: 'zoo-imperial',
      page: 23,
      label: undefined,
      quote: "cette créature peut se déplacer en creusant un tunnel dans la terre",
    });
    expect(r.verdict).toBe('attesté');
    expect(r.via).toBe('quote');
  });

  it('livre-hors-atlas si le livre déclaré n\'a pas d\'extraction FR', () => {
    const r = auditSecondaryRef({ book: 'inexistant', page: 1, label: 'X', quote: undefined });
    expect(r.verdict).toBe('livre-hors-atlas');
  });
});

describe('auditSecondaries — 64 entrées `alsoIn` réelles sur src/data/*.json (Lot 2, #563 ; +1 VDM #734 ; +7 Hysh #729 ; +6 Chamon #729 ; +5 attributs de Domaine republiés #729 ; +6 Ghyran #729 ; +7 Azyr #729 ; +5 Ulgu #729 ; +6 Shyish #729 ; +2 Aqshy #729 ; +2 VDM #731 : Bête des marais et Prédateur sanglant ; +1 VDM couronne-de-flammes)', () => {
  it('toutes les entrées `alsoIn` réelles sont ATTESTÉES (aucune violation)', () => {
    const { violations, total } = auditSecondaries(DIR);
    expect(total).toBe(64);
    expect(violations).toEqual([]);
  });

  it('EXHAUSTIF : les fichiers portant `alsoIn` sont exactement les datasets migrés (Lot 2 + talents #734 + creatures #731)', () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith('.json'));
    const offenders = files.filter((f) => readFileSync(join(DIR, f), 'utf8').includes('"alsoIn"')).sort();
    expect(offenders).toEqual(['creatures.json', 'domains.json', 'naval-traits.json', 'qualities.json', 'spells.json', 'talents.json', 'traits.json', 'trappings.json']);
  });
});
