/**
 * Rendu JOUEUR d'une liste de `GameOp[]` (passifs d'entité, effets de signe astral) — chips codex-liées
 * (`EntityRef`) pour les ops à ancre, phrase humanisée en repli pour le reste. Compose `opRows` (ref
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
          ) : (
            <span className="chip">{row.t === 'text' ? row.text : ''}</span>
          )}
        </Fragment>
      ))}
    </>
  );
}
