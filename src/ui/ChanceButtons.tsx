import { Icon } from './Icon';
import { CodexRef } from './compendium/CodexRef';
import { RULE_REF } from '../engine/ruleRefs';

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
 * Chaque bouton EST l'affordance de sa règle : son `CodexRef` (`wrap`) l'ENGLOBE et rend le texte
 * de la règle au survol/focus, SANS intercepter le clic de dépense — aucun ⓘ voisin (#1078).
 * Libellés courts normés (rangée « influencer le jet »).
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
    <CodexRef category={RULE_REF['sombre-pacte'].category} id={RULE_REF['sombre-pacte'].id} label="Sombre Pacte" wrap>
      <button className="btn btn-resource" onClick={onDarkPact}>
        <Icon id="condition/bleeding" size="sm" /> Pacte
      </button>
    </CodexRef>
  );
  // La relance GRATUITE relève de la Bénédiction de Chance (LDB 41), la payante de la Chance
  // (LDB 12 l.40) : le bouton porte la règle qui l'autorise RÉELLEMENT.
  const rerollRef = freeReroll ? RULE_REF['benediction-de-chance'] : RULE_REF.chance;
  const rerollBtn = rerollable && (freeReroll || fortune > 0) && (
    <CodexRef category={rerollRef.category} id={rerollRef.id} label={freeReroll ? 'Bénédiction de Chance' : 'Chance'} wrap>
      <button
        className="btn btn-resource"
        onClick={onReroll}
        /* Le « ×N » ne compte que les Points de Chance : le title est la seule surface qui porte
           aussi la contrainte LDB 12 l.40. */
        title={`Relancer le jet raté — une seule relance par Test${freeReroll ? '' : ` (${fortune} Point${fortune > 1 ? 's' : ''} de Chance)`}`}
      >
        {freeReroll ? <><Icon id="faith/prayer" size="sm" /> Relancer</> : <><Icon id="resource/fortune" size="sm" /> Relancer ×{fortune}</>}
      </button>
    </CodexRef>
  );
  return (
    <>
      {rerollBtn}
      {fortune > 0 && onBonusSL && (
        <CodexRef category={RULE_REF.chance.category} id={RULE_REF.chance.id} label="Chance" wrap>
          {/* Le bouton NOMME la ressource qu'il dépense : « +1 DR ×N » nu ne disait pas d'où venait le
              cran (recette : lu comme un Avantage, une Résilience partielle…). Même forme de pool que
              son voisin « Relancer ×N » — le compteur est la réserve de Points de Chance. */}
          <button
            className="btn btn-resource"
            onClick={onBonusSL}
            title={`Dépenser un Point de Chance pour +1 DR (${fortune} restant${fortune > 1 ? 's' : ''})`}
          >
            <Icon id="ui/add" size="sm" /> Chance : +1 DR ×{fortune}
          </button>
        </CodexRef>
      )}
      {pactBtn}
    </>
  );
}
