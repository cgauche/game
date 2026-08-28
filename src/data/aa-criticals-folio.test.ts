import { describe, it, expect } from 'vitest';
import { auditFolio } from '../../scripts/guards/lib/folioIntegrity.mjs';
import aa from './aa-criticals.json';

/**
 * Garde-fou « le folio déclaré par une entrée d'`aa-criticals.json` est celui où vit sa `desc` »
 * (#1467 L1b V-FLIP-CONFIG).
 *
 * Le dataset a longtemps porté une NOTE LIBRE `_source` annonçant « p.≈118-124 » : ce sont des pages
 * PDF, pas des folios imprimés. La migration
 * `scripts/migrations/2026-08-28-l1b-7b-aa-criticals-source.mjs` l'a remplacée par un
 * `source: {book:'aux-armes', page}` PAR ENTRÉE, aux folios relevés sur les ancres `data-folio` de
 * `Source/WH - V4 - Aux Armes/07 - MISES À JOUR DE L'ÉTAT HÉMORRAGIQUE.md` : 83 juste avant
 * « TABLEAU DES BLESSURES CRITIQUES À LA TÊTE », 84 « … AU BRAS », 85 « … AU TORSE », 86
 * « … À LA JAMBE ». Ce test est ce qui rend la migration VÉRIFIABLE plutôt que déclarée.
 *
 * COUVERTURE DITE, PAS SUPPOSÉE. `auditFolio` juge par la voie VERBATIM : il cherche la `desc` dans
 * l'extraction Markdown. Mesuré sur les 80 entrées : 22 y sont retrouvées (verdict `folio-ok` sur le
 * folio déclaré), 51 rendent `desc-introuvable` et 7 `desc-trop-courte` — les cellules du tableau
 * source portent des `<br>` et une mise en page que la `desc` recolle sans les reproduire. Ces 58
 * entrées sont HORS de la voie verbatim ; leur folio est attesté par l'ANCRE DE TITRE de leur table,
 * relevée au geste de migration. Ce que le test exige :
 *  - les 22 attestables le sont, et AUCUNE des 80 n'est réfutée (`folio-ment` = 0) ;
 *  - l'instrument MORD : au folio croisé, 20 des 22 rendent `folio-ment`. Les 2 exceptions sont
 *    NOMMÉES et mesurées — leur `desc` est le MÊME texte dans les deux tables voisines.
 */

type Entree = { id: string; desc: string; source: { book: string; page: number } };
type Famille = 'tete' | 'bras' | 'corps' | 'jambe';

/** Folio IMPRIMÉ de chaque table, et son CROISÉ (la table voisine — la plus petite erreur possible). */
const FOLIO: Record<Famille, number> = { tete: 83, bras: 84, corps: 85, jambe: 86 };
const CROISE: Record<Famille, number> = { tete: 84, bras: 83, corps: 86, jambe: 85 };
const FAMILLES = Object.keys(FOLIO) as Famille[];

const doc = aa as unknown as Record<string, unknown>;
const entreesDe = (f: Famille) => doc[f] as Entree[];
const toutes = FAMILLES.flatMap((f) => entreesDe(f).map((e) => ({ ...e, famille: f })));

const verdict = (page: number, desc: string) => auditFolio({ book: 'aux-armes', page, desc }).verdict;

describe('aa-criticals.json — folio de source confronté à l’extraction (#1467 L1b)', () => {
  it('les 80 entrées portent leur `source` au folio de LEUR famille (83/84/85/86)', () => {
    expect(toutes.length).toBe(80);
    const fautifs = toutes
      .filter((e) => e.source?.book !== 'aux-armes' || e.source?.page !== FOLIO[e.famille])
      .map((e) => `${e.famille}/${e.id} → ${JSON.stringify(e.source)}`);
    expect(fautifs, `source(s) hors du folio de leur table :\n  ${fautifs.join('\n  ')}`).toEqual([]);
    for (const f of FAMILLES) expect(entreesDe(f).length, `${f} : 20 entrées attendues`).toBe(20);
  });

  it('AUCUNE des 80 n’est réfutée par l’extraction (`folio-ment` = 0)', () => {
    const menteuses = toutes.filter((e) => verdict(FOLIO[e.famille], e.desc) === 'folio-ment').map((e) => `${e.famille}/${e.id}`);
    expect(menteuses, `folio(s) réfuté(s) par l’extraction :\n  ${menteuses.join('\n  ')}`).toEqual([]);
  });

  it('les 22 entrées de la voie VERBATIM sont attestées `folio-ok` — population gelée', () => {
    const attestees = toutes.filter((e) => verdict(FOLIO[e.famille], e.desc) === 'folio-ok');
    expect(attestees.length, 'la population attestable a bougé — re-mesurer avant de déplacer la borne').toBe(22);
    expect(attestees.map((e) => `${e.famille}/${e.id}`)).toEqual([
      'tete/aa-tete-04', 'tete/aa-tete-07', 'tete/aa-tete-16', 'tete/aa-tete-26', 'tete/aa-tete-00',
      'bras/aa-bras-21', 'bras/aa-bras-26', 'bras/aa-bras-41', 'bras/aa-bras-76', 'bras/aa-bras-86',
      'bras/aa-bras-110', 'bras/aa-bras-136',
      'corps/aa-corps-26', 'corps/aa-corps-31', 'corps/aa-corps-36',
      'jambe/aa-jambe-11', 'jambe/aa-jambe-21', 'jambe/aa-jambe-46', 'jambe/aa-jambe-66',
      'jambe/aa-jambe-71', 'jambe/aa-jambe-91', 'jambe/aa-jambe-126',
    ]);
  });

  it('l’instrument MORD : au folio CROISÉ, 20 des 22 rendent `folio-ment` (les 2 autres, nommées, ont la MÊME desc dans les deux tables)', () => {
    const attestees = toutes.filter((e) => verdict(FOLIO[e.famille], e.desc) === 'folio-ok');
    const survivantes = attestees.filter((e) => verdict(CROISE[e.famille], e.desc) !== 'folio-ment');
    // Mesuré : « Vous subissez un Traumatisme Déchirure musculaire (Mineure). » est imprimé à
    // l'IDENTIQUE au torse (folio 85, « Torsion du dos ») et à la jambe (86, « Cheville foulée ») —
    // le verbatim se retrouve donc sur les deux folios, et le croisement ne peut pas le réfuter.
    expect(survivantes.map((e) => `${e.famille}/${e.id}`)).toEqual(['corps/aa-corps-31', 'jambe/aa-jambe-46']);
    expect(attestees.length - survivantes.length).toBe(20);
  });

  it('la note libre `_source` est MORTE — la provenance vit à l’entrée', () => {
    expect(doc._source).toBeUndefined();
    expect(doc.id).toBe('aa-criticals');
    expect(doc.type).toBe('aa-criticals');
  });
});
