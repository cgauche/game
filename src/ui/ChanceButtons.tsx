/**
 * Boutons de dépense de Chance partagés par les modales de jet (LDB « Destin et Résistance »
 * ch.17 l.22-28) : « Relancer » (uniquement si le jet propre est raté et pas déjà relancé) et
 * « +1 DR » (cumulable). Rien ne s'affiche s'il ne reste aucun Point de Chance.
 */
export function ChanceButtons({
  fortune,
  rerollable,
  onReroll,
  onBonusSL,
}: {
  fortune: number;
  rerollable: boolean;
  onReroll: () => void;
  onBonusSL: () => void;
}) {
  if (fortune <= 0) return null;
  return (
    <>
      {rerollable && (
        <button className="btn" onClick={onReroll} title="Dépense un point de Chance pour relancer le jet (LDB Destin)">
          🍀 Relancer ({fortune})
        </button>
      )}
      <button className="btn" onClick={onBonusSL} title="Dépense un point de Chance pour ajouter +1 DR (LDB Destin)">
        ➕ +1 DR ({fortune})
      </button>
    </>
  );
}
