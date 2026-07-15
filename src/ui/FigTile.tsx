import { CharacterPreview, type CharacterPreviewProps } from './CharacterPreview';
import { WaxSeal } from './WaxSeal';

/** Taille de la BOÎTE-FIGURINE de la tuile (`frames.css`, valeurs de la planche) : `compact` = 104px
 *  (rangées de carrière/candidats), `big` = 172px (grille de race, surface principale de son étape).
 *  Une VARIANTE de la primitive — jamais un fork ni une classe par écran. */
export type FigTileSize = 'compact' | 'big';

/**
 * FigTile — LE cadre-figurine UNIQUE (#430/#431), partagé races / carrières / candidats du lobby.
 * Une COLONNE au patron `.fam-tile` de la planche ratifiée : boîte-figurine à hauteur fixe (figurine
 * ancrée au sol sur sa lueur), nom puis compte DESSOUS. Cadre unique à rivets d'or, état sélectionné
 * = liseré doré, sceau optionnel (`sealed`, patron `SealedPlaque`). Styles : `frames.css` (SEULE
 * définition — le doublon `.fig-tile` de creator.css, qui se disputait la primitive par cascade
 * depuis #430, est purgé).
 *
 * Aucune ambiance de `CharacterPreview` n'est exposée : la tuile porte SA matière (dégradé + rivets
 * + lueur de sol) et une ambiance de plus y peindrait le « 2e cadre » que l'utilisateur a rejeté —
 * c'est précisément par là que les tuiles divergeaient (la race passait `panel`, la carrière
 * `spotlight` : « la carrière a un fond mais pas la race, c'est pourtant la même primitive ? »).
 */
export function FigTile({ preview, label, sub, selected, sealed, fig = 'compact', onClick, tabIndex = -1, className }: {
  preview: CharacterPreviewProps;
  label: string;
  sub?: string;
  selected?: boolean;
  /** Sceau de cire au coin (le choix est SCELLÉ) — absent = pas de sceau. Taille et débordement au
   *  patron de la carte-contrat (`.seat-card-seal`, CharCard) : un cachet se voit ou n'est pas un
   *  cachet — il passe PAR-DESSUS le rivet du coin. */
  sealed?: boolean;
  /** Taille de la boîte-figurine — `compact` par défaut. */
  fig?: FigTileSize;
  onClick: () => void;
  /** Roving tabindex (posé par `GroupedPickGrid`) — 0 pour la tuile active du groupe, -1 sinon. */
  tabIndex?: number;
  /** Modificateur d'appelant (ex. liseré de borne « tirée », `.rolled`) — jamais un second cadre,
   *  une classe ADDITIVE sur l'enceinte UNIQUE. */
  className?: string;
}) {
  const cls = ['fig-tile', selected && 'sel', fig === 'big' && 'big', className].filter(Boolean).join(' ');
  return (
    <button type="button" role="option" aria-selected={selected} tabIndex={tabIndex} className={cls} onClick={onClick}>
      <span className="fig-tile-fig">
        <CharacterPreview {...preview} size="fill" ambiance="none" />
      </span>
      {sealed && <WaxSeal size={40} className="fig-tile-seal" />}
      <span className="fig-tile-name">{label}</span>
      {sub && <span className="fig-tile-sub">{sub}</span>}
    </button>
  );
}
