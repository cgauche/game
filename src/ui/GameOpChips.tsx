/**
 * Rendu JOUEUR d'une liste de `GameOp[]` (passifs d'entité, effets de signe astral) — chips codex-liées
 * (`EntityRef`) pour les ops à ancre, phrase humanisée en repli pour le reste. Une op `rollTable`
 * s'expanse en ses rangées (`opRows`/`tableRows`, ref #540) : sous-en-tête de fourchette (`.codex-rowsub`,
 * même rendu que la catégorie « Tables d'effets ») + chips des ops de la rangée. Compose `opRows` (ref
 * #495) : SOURCE UNIQUE, jamais le résumeur d'atelier `opSummary`. Composable dans une rangée
 * `.skill-tags` existante.
 */
import { Fragment } from 'react';
import type { GameOp } from '../engine/ops';
import { opRows } from './compendium/opRows';
import { EntityRef } from './EntityChip';

export function GameOpChips({ ops }: { ops: GameOp[] }) {
  return (
    <>
      {opRows(ops).map((row, i) => (
        <Fragment key={i}>
          {row.t === 'ref' ? (
            <EntityRef category={row.category} id={row.id} label={row.label} show={row.show} badge={row.badge} />
          ) : row.t === 'sub' ? (
            <span className="codex-rowsub">{row.label}</span>
          ) : (
            <span className="chip">{row.t === 'text' ? row.text : ''}</span>
          )}
        </Fragment>
      ))}
    </>
  );
}
