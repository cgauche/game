import { Combatant } from '../engine/types';
import { CodexRef } from './compendium/CodexRef';

/**
 * Réserves de Destin / Chance / Résilience / Détermination en cartouches `.stat-chip` — primitive
 * PARTAGÉE (fiche perso + carte de sélection), SOURCE UNIQUE. Rend un fragment de 4 chips ; le parent
 * fournit la grille (`.sheet-resources`, `.char-vitals`…). Renvoie `null` si l'entité n'a pas de Destin
 * (créature sans Destin/Résilience). Chaque libellé ouvre sa description Codex (D4) : Destin/Chance/
 * Résilience/Détermination figurent DÉJÀ dans `data/characteristics.json` (source app-owned unique,
 * éditable au Compendium) — on pointe ces entrées, plus de `title=` brut ni de donnée dupliquée.
 */
export function FateChips({ c }: { c: Combatant }) {
  if (c.fate == null) return null;
  return (
    <>
      <div className="stat-chip">
        <span className="sc-label"><CodexRef category="characteristics" label="Destin">Destin</CodexRef></span>
        <span className="sc-value">{c.fate}</span>
      </div>
      <div className="stat-chip">
        <span className="sc-label"><CodexRef category="characteristics" label="Chance">Chance</CodexRef></span>
        <span className="sc-value">{c.fortune ?? 0}</span>
      </div>
      <div className="stat-chip">
        <span className="sc-label"><CodexRef category="characteristics" label="Résilience">Résilience</CodexRef></span>
        <span className="sc-value">{c.resilience ?? 0}</span>
      </div>
      <div className="stat-chip">
        <span className="sc-label"><CodexRef category="characteristics" label="Détermination">Détermination</CodexRef></span>
        <span className="sc-value">{c.resolve ?? 0}</span>
      </div>
    </>
  );
}
