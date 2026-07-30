/**
 * CONVERSION « révélation → étape d'AFFICHAGE de cascade » (#942 L8) — module FEUILLE : le seul
 * endroit qui sait fabriquer un `CascadeStep` à partir d'une `RevealEntry` (icône par kind, cadence
 * d'auto-fermeture par gravité, charge riche portée telle quelle). Partagé par l'émetteur runtime
 * (`pushReveal`, state/combatEffects.ts) et par la migration de save qui reprend les révélations
 * d'une partie sauvegardée (`MIGRATIONS[15]`, state/saves.ts) — d'où l'extraction hors de
 * `combatEffects` (que `saves.ts` ne peut pas importer : cycle store↔flux).
 */
import type { CascadeStep, CascadeTableDecl, RevealEntry } from './pendings';
import { toRecapLines } from './recapLine';
import type { IconId } from '../ui/icons';

/** Icône d'une étape de révélation, PAR kind — exhaustif (ajouter un kind force son icône). */
const REVEAL_ICON: Record<RevealEntry['kind'], IconId> = {
  miscast: 'nav/dice', // tirage sur la Table des Imparfaites
  critical: 'journal/critical',
  round: 'journal/round',
  mutation: 'nav/mutation',
  effet: 'journal/info', // effet d'AUTEUR (scénario) : Blessure Critique / maladie infligée
  sceneEntry: 'nav/entry-point', // entrée de zone : mise en contexte narrative (N1 — « le Journal n'est pas lu »)
};

/** Délai d'AUTO-FERMETURE de l'étape par gravité (arbitrage 2026-06-11) : court pour l'informatif,
 *  long pour le grave (critique/mutation d'un héros). Un clic ferme toujours avant. */
export const REVEAL_AUTO_CLOSE_MS: Record<NonNullable<RevealEntry['severity']>, number> = { minor: 3500, grave: 9000 };

/** Une révélation → étape d'AFFICHAGE de la séquence : la charge riche `reveal` voyage TELLE QUELLE
 *  (le rendu est routé par `kind` dans `ui/RevealBody.tsx` — panneau du Critique, parchemin d'entrée
 *  de zone, rangée de tirage + lignes pour le reste). `actorId` = le CONCERNÉ (victime → propriétaire
 *  de la modale en coop, et portrait du sujet dans la fenêtre). `table` = la DÉCLARATION du tirage
 *  DÉJÀ résolu qui a produit la révélation (#942 L4 : le d100 de sévérité d'un Critique) — la rangée
 *  `TableRollLine` montre alors le dé et la ligne atteinte, comme sur une étape à table tirée. */
export function revealToStep(entry: RevealEntry, index: number, table?: CascadeTableDecl): CascadeStep {
  return {
    id: `cons-${entry.kind}-${index}`,
    kind: entry.kind,
    actorId: entry.subjectId,
    icon: REVEAL_ICON[entry.kind],
    label: entry.title,
    outcome: toRecapLines(entry.lines),
    reveal: entry,
    ...(entry.severity ? { autoCloseMs: REVEAL_AUTO_CLOSE_MS[entry.severity] } : {}),
    table,
    interactive: true,
  };
}
