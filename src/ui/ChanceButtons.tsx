/**
 * Boutons de dépense de Chance partagés par les modales de jet (LDB « Destin et Résistance »
 * ch.17 l.22-28) : « Relancer » (uniquement si le jet propre est raté et pas déjà relancé) et
 * « +1 DR » (cumulable). Rien ne s'affiche s'il ne reste aucun Point de Chance.
 *
 * Sombre Pacte (LDB 19 l.16/41) : si `onDarkPact` est fourni et que le jet est relançable par
 * le Pacte (`darkPactable` : Test raté, MÊME déjà relancé), un héros peut recevoir
 * volontairement 1 Point de Corruption pour relancer — y compris à 0 Chance, c'est son intérêt.
 */
export function ChanceButtons({
  fortune,
  rerollable,
  onReroll,
  onBonusSL,
  darkPactable = false,
  onDarkPact,
}: {
  fortune: number;
  rerollable: boolean;
  onReroll: () => void;
  onBonusSL: () => void;
  darkPactable?: boolean;
  onDarkPact?: () => void;
}) {
  const pactBtn = onDarkPact && darkPactable && (
    <button
      className="btn"
      onClick={onDarkPact}
      title="Sombre Pacte (LDB 19) : recevoir volontairement 1 Point de Corruption pour relancer ce Test — même après une relance de Chance. Les Dieux Sombres écoutent…"
    >
      🩸 Sombre Pacte
    </button>
  );
  if (fortune <= 0) return <>{pactBtn}</>;
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
      {pactBtn}
    </>
  );
}
