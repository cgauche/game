import { Combatant } from '../engine/types';

/**
 * Réserves de Destin / Chance / Résilience / Détermination en cartouches `.stat-chip` — primitive
 * PARTAGÉE (fiche perso + carte de sélection), SOURCE UNIQUE. Rend un fragment de 4 chips ; le parent
 * fournit la grille (`.sheet-resources`, `.char-vitals`…). Renvoie `null` si l'entité n'a pas de Destin
 * (créature sans Destin/Résilience). LDB 17 : Destin/Résilience permanents ; Chance/Détermination =
 * réserve par session.
 */
export function FateChips({ c }: { c: Combatant }) {
  if (c.fate == null) return null;
  return (
    <>
      <div className="stat-chip" title="Points de Destin — permanents (« Meurs un autre jour »)">
        <span className="sc-label">Destin</span>
        <span className="sc-value">{c.fate}</span>
      </div>
      <div className="stat-chip" title="Points de Chance — réserve par session, relances">
        <span className="sc-label">Chance</span>
        <span className="sc-value">{c.fortune ?? 0}</span>
      </div>
      <div className="stat-chip" title="Résilience — permanente (« Je ne faillirai pas ! »)">
        <span className="sc-label">Résilience</span>
        <span className="sc-value">{c.resilience ?? 0}</span>
      </div>
      <div className="stat-chip" title="Détermination — par session, retire un État">
        <span className="sc-label">Détermination</span>
        <span className="sc-value">{c.resolve ?? 0}</span>
      </div>
    </>
  );
}
