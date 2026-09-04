/**
 * Schéma de `ship-stations.json` — catalogue FERMÉ des PRÉSENCES à bord que les livres NOMMENT, et
 * seule cible de `ShipCrewHit.crewTarget.stations` (`grammaire/mecanique.ts`).
 *
 * Cinq entrées, une par présence imprimée : `pont` (`MDG 13 l.730`, `MSRC 07 l.78`), `greement`
 * (`MDG 13 l.714`), `nid-de-pie` (`MDG 13 l.680`, `MDG 12 l.303`), `avirons` (`MDG 13 l.751`,
 * `MSRC 07 l.82`), `cale` (`MSRC 07 l.94`). Une station n'est JAMAIS déduite d'un rôle ni d'une
 * Compétence : elle est épinglée par le joueur sur `Combatant.shipStation`.
 *
 * `requiresTrait` porte le GATE en donnée — la station n'existe que sur une coque qui porte ce Trait
 * naval (`shipHasNavalTrait`, `src/engine/navalTraits.ts`). Sans lui, `shipCritical.ts` devrait brancher
 * par id de station.
 */
import { document } from '../grammaire/document';
import { ref } from '../grammaire/ref';

export const file = 'ship-stations.json';
export const famille = 'entite';

const doc = document(
  'ship-stations',
  famille,
  {
    requiresTrait: ref('navalTrait').optional(),
  },
  {
    requiresTrait: {
      label: 'Trait naval requis',
      hint: 'La coque doit porter ce Trait/Amélioration naval pour que la station existe à son bord',
    },
  },
  {
    codex: { keys: ['shipStations'] },
    edit: { dataset: 'shipStations' },
  },
  { exiges: ['desc'] },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
