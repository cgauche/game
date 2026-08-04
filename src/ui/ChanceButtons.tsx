import { Icon } from './Icon';
import { CodexRef } from './compendium/CodexRef';

/**
 * Boutons de dépense de Chance partagés par les modales de jet (LDB « Destin et Résistance »
 * ch.17 l.22-28) : « Relancer » (uniquement si le jet propre est raté et pas déjà relancé) et
 * « +1 DR » (cumulable). Rien ne s'affiche s'il ne reste aucun Point de Chance.
 *
 * Bénédiction de Chance (LDB 41 — `freeReroll`) : une relance GRATUITE est disponible — le bouton
 * Relancer s'affiche même à 0 Chance et ne consomme pas de point.
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
    <>
      <button className="btn btn-resource" onClick={onDarkPact}>
        <Icon id="condition/bleeding" size="sm" /> Pacte
      </button>
      <CodexRef category="regles" id="sombre-pacte" label="Sombre Pacte" className="ab-codex-info"><Icon id="journal/info" size="sm" /></CodexRef>
    </>
  );
  const rerollBtn = rerollable && (freeReroll || fortune > 0) && (
    <button
      className="btn btn-resource"
      onClick={onReroll}
      /* Le « ×N » ne compte que les Points de Chance : le title est la seule surface qui porte
         aussi la contrainte LDB 12 l.40. */
      title={`Relancer le jet raté — une seule relance par Test${freeReroll ? '' : ` (${fortune} Point${fortune > 1 ? 's' : ''} de Chance)`}`}
    >
      {freeReroll ? <><Icon id="faith/prayer" size="sm" /> Relancer</> : <><Icon id="resource/fortune" size="sm" /> Relancer ×{fortune}</>}
    </button>
  );
  return (
    <>
      {rerollBtn}
      {freeReroll && rerollable && (
        <CodexRef category="spells" id="benediction-de-chance" label="Bénédiction de Chance" className="ab-codex-info"><Icon id="journal/info" size="sm" /></CodexRef>
      )}
      {!freeReroll && rerollable && fortune > 0 && (
        <CodexRef category="characteristics" id="chance" label="Chance" className="ab-codex-info"><Icon id="journal/info" size="sm" /></CodexRef>
      )}
      {fortune > 0 && onBonusSL && (
        <>
          <button className="btn btn-resource" onClick={onBonusSL}>
            <Icon id="ui/add" size="sm" /> +1 DR ×{fortune}
          </button>
          <CodexRef category="characteristics" id="chance" label="Chance" className="ab-codex-info"><Icon id="journal/info" size="sm" /></CodexRef>
        </>
      )}
      {pactBtn}
    </>
  );
}
