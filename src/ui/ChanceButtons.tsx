/**
 * Boutons de dépense de Chance partagés par les modales de jet (LDB « Destin et Résistance »
 * ch.17 l.22-28) : « Relancer » (uniquement si le jet propre est raté et pas déjà relancé) et
 * « +1 DR » (cumulable). Rien ne s'affiche s'il ne reste aucun Point de Chance.
 *
 * Bénédiction de Chance (LDB 41 — `freeReroll`) : une relance GRATUITE est disponible — le bouton
 * Relancer s'affiche même à 0 Chance et ne consomme pas de point (🙏).
 *
 * Sombre Pacte (LDB 19 l.16/41) : si `onDarkPact` est fourni et que le jet est relançable par
 * le Pacte (`darkPactable` : Test raté, MÊME déjà relancé), un héros peut recevoir
 * volontairement 1 Point de Corruption pour relancer — y compris à 0 Chance, c'est son intérêt.
 *
 * Libellés courts normés (rangée « influencer le jet ») — les explications vivent en tooltip.
 */
export function ChanceButtons({
  fortune,
  rerollable,
  onReroll,
  freeReroll = false,
  onBonusSL,
  darkPactable = false,
  onDarkPact,
}: {
  fortune: number;
  rerollable: boolean;
  onReroll: () => void;
  freeReroll?: boolean;
  onBonusSL?: () => void;
  darkPactable?: boolean;
  onDarkPact?: () => void;
}) {
  const pactBtn = onDarkPact && darkPactable && (
    <button
      className="btn btn-resource"
      onClick={onDarkPact}
      title="Sombre Pacte (LDB 19) : recevoir volontairement 1 Point de Corruption pour relancer ce Test — même après une relance de Chance. Les Dieux Sombres écoutent…"
    >
      🩸 Pacte
    </button>
  );
  const rerollBtn = rerollable && (freeReroll || fortune > 0) && (
    <button
      className="btn btn-resource"
      onClick={onReroll}
      title={freeReroll
        ? 'Bénédiction de Chance (LDB 41) : relance gratuite du Test raté — sans dépenser de Chance'
        : 'Dépense un point de Chance pour relancer le jet (LDB Destin)'}
    >
      {freeReroll ? '🙏 Relancer' : `🍀 Relancer ×${fortune}`}
    </button>
  );
  return (
    <>
      {rerollBtn}
      {fortune > 0 && onBonusSL && (
        <button className="btn btn-resource" onClick={onBonusSL} title="Dépense un point de Chance pour ajouter +1 DR (LDB Destin)">
          ➕ +1 DR ×{fortune}
        </button>
      )}
      {pactBtn}
    </>
  );
}
