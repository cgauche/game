import type { ReactNode } from 'react';
import { Combatant } from '../engine/types';
import { Money } from '../engine/money';
import { CharacterPreview } from './CharacterPreview';
import { OrnateFrame } from './Ornaments';
import { Icon } from './Icon';
import type { IconIdInput } from './icons';
import { Coins } from './Coins';
import { speciesSingular, findSpeciesById, careerLabelFor, skillInstanceLabel, talentConcrete } from '../data';
import { t } from '../i18n';

/** Sous-titre d'ARCHÉTYPE : « Carrière — Espèce » (la CARRIÈRE en tête, c'est le concept du personnage
 *  en WFRP ; l'espèce suit, atténuée — arbitrage user 2026-07-13). Sans « (niv. N) » (bruit : tous
 *  niveau 1 à la sélection ; le niveau vit dans la fiche). Source unique (cartes siège + candidat +
 *  HeroPresentation + sélecteur). */
export function heroSubtitle(hero: Combatant): string {
  const race = speciesSingular(findSpeciesById(hero.species)?.label ?? hero.species);
  return `${careerLabelFor(hero)} — ${race}`;
}

/** RÔLE dans le groupe — 2-3 forces EN TOUTES LETTRES, dérivées des DONNÉES (compétences les mieux
 *  notées), pas d'une table en dur par carrière. Libellé de base (sans spec) dédoublonné. */
export function heroRoles(hero: Combatant, max = 3): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of [...hero.skills].filter((s) => s.advances > 0).sort((a, b) => b.advances - a.advances)) {
    const label = skillInstanceLabel({ skillId: s.skillId });
    if (seen.has(label)) continue;
    seen.add(label);
    out.push(label);
    if (out.length >= max) break;
  }
  return out;
}

/** ACCROCHE narrative — l'ambition à court terme (évocatrice) ou, à défaut, la motivation. */
export function heroHook(hero: Combatant): string | undefined {
  return hero.details?.ambitionShort || hero.motivation || undefined;
}

/** Compétences CLÉS (libellé concret avec spec) — présentation lisible, top par avances. */
export function heroKeySkills(hero: Combatant, max = 6): string[] {
  return [...hero.skills]
    .filter((s) => s.advances > 0)
    .sort((a, b) => b.advances - a.advances)
    .slice(0, max)
    .map((s) => skillInstanceLabel(s));
}

/** Talents CLÉS (libellé concret) — présentation lisible. */
export function heroKeyTalents(hero: Combatant, max = 6): string[] {
  return hero.talents.slice(0, max).map((tt) => talentConcrete(tt));
}

/** État de recrutement d'un candidat vis-à-vis du groupe (calculé par l'écran d'équipe). */
export interface RecruitState {
  status: 'available' | 'blocked';
}

/** Identité (nom COMPLET + archétype). La PRÉSENTATION s'ouvre par le bouton loupe `WhoButton`
 *  (`.btn` canon) — pas un `<button>` nu recodé sur le nom (cliquet #373). */
function CardIdentity({ hero }: { hero: Combatant }) {
  return (
    <div className="candidate-id">
      <strong className="candidate-name">{hero.name}</strong>
      <span className="candidate-sub">{heroSubtitle(hero)}</span>
    </div>
  );
}

/** RÔLE + ACCROCHE (forces en toutes lettres + ambition) — le contenu qui aide à CHOISIR. `seat` =
 *  rôle sur UNE ligne (colonne d'équipe étroite : 4 sièges tiennent la hauteur). */
function CardLore({ hero, seat }: { hero: Combatant; seat?: boolean }) {
  const roles = heroRoles(hero);
  const hook = heroHook(hero);
  return (
    <>
      {roles.length > 0 && <div className={`card-roles${seat ? ' card-roles-1line' : ''}`}>{roles.join(' · ')}</div>}
      {hook && <div className="card-hook">« {hook} »</div>}
    </>
  );
}

/** Poignée de PRÉSENTATION — la figurine + l'identité du personnage forment le contrôle cliquable qui
 *  ouvre son récit (`HeroPresentation`) : l'affordance d'un jeu (on clique le PERSONNAGE), pas un bouton
 *  « loupe » (directive user 2026-07-13). Vrai contrôle a11y (role/aria-label/focusable, Entrée ouvre),
 *  jamais un div sourd ; feedback de survol NON DÉCALANT (`.char-present`, box-shadow/brightness — aucune
 *  dimension ne change). Sans `onPresent`, rend un conteneur inerte (même flux). */
function PresentHandle({ hero, onPresent, className, children }: { hero: Combatant; onPresent?: () => void; className?: string; children: ReactNode }) {
  if (!onPresent) return <div className={className}>{children}</div>;
  return (
    <div
      className={`char-present${className ? ` ${className}` : ''}`}
      role="button"
      tabIndex={0}
      aria-label={t('party.present.aria', { name: hero.name })}
      onClick={onPresent}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPresent();
        }
      }}
    >
      {children}
    </div>
  );
}

/**
 * Carte-portrait de CANDIDAT (l'étal) — figure en pied dominante, nom complet, archétype, rôle +
 * accroche. Source unique du vivier : `gallery` (grille de l'écran) ET `modal` (remplacement, plus
 * compacte). Clic figure/nom → PRÉSENTATION (`onPresent`). L'équipe, elle, est rendue par `SeatCard`.
 */
export function CandidateCard({
  hero,
  variant = 'gallery',
  state,
  wealth,
  recruited,
  onRecruit,
  onPresent,
  onExport,
  onDelete,
}: {
  hero: Combatant;
  variant?: 'gallery' | 'modal';
  state?: RecruitState;
  wealth?: Money;
  /** Déjà dans le groupe (modale de remplacement) → bouton « Déjà choisi » désactivé. */
  recruited?: boolean;
  onRecruit?: () => void;
  onPresent?: () => void;
  onExport?: () => void;
  onDelete?: () => void;
}) {
  const blocked = state?.status === 'blocked';
  return (
    <OrnateFrame className={`candidate-card candidate-${variant}`}>
      {/* Le personnage (figurine + identité) EST le contrôle qui ouvre sa présentation (directive
          user 2026-07-13) — plus de bouton « loupe ». */}
      <PresentHandle hero={hero} onPresent={onPresent} className="candidate-present">
        <div className="candidate-fig">
          <CharacterPreview hero={hero} size="fill" ambiance="panel" />
        </div>
        <CardIdentity hero={hero} />
      </PresentHandle>
      <CardLore hero={hero} />
      {wealth != null && (
        <span className="candidate-wealth hint">{t('picker.hero.purse')} <Coins money={wealth} /></span>
      )}
      <div className="candidate-actions row-flex">
        <button
          className="btn btn-primary small"
          disabled={variant === 'modal' ? recruited : blocked}
          title={variant !== 'modal' && blocked ? t('party.recruit.full') : undefined}
          onClick={onRecruit}
        >
          {variant === 'modal' ? (recruited ? t('picker.hero.inParty') : t('picker.hero.choose')) : t('party.hero.recruit')}
        </button>
        {(onExport || onDelete) && (
          <span className="candidate-tools">
            {onExport && (
              <button className="btn small ghost" onClick={onExport} title={t('picker.hero.export.title')} aria-label={t('picker.hero.export')}>
                <Icon id="file/export" size="sm" />
              </button>
            )}
            {onDelete && (
              <button className="btn small ghost danger" onClick={onDelete} title={t('picker.hero.delete')} aria-label={t('picker.hero.delete')}>
                <Icon id="ui/delete" size="sm" />
              </button>
            )}
          </span>
        )}
      </div>
    </OrnateFrame>
  );
}

/**
 * Carte de SIÈGE (l'équipe — la star) : carte HORIZONTALE riche, MÊME niveau d'information que la
 * carte de candidat (portrait + nom + archétype + rôle + accroche), plus les actions de gestion.
 * Composée dans la colonne latérale de l'écran d'équipe.
 */
export function SeatCard({
  hero,
  seatLabel,
  onPresent,
  actions,
}: {
  hero: Combatant;
  /** Numéro de siège (« Siège 1 ») posé en médaillon. */
  seatLabel?: string;
  onPresent?: () => void;
  /** Boutons de gestion (Modifier / Remplacer / Retirer) — rendus par l'écran (droits coop). */
  actions?: ReactNode;
}) {
  return (
    <OrnateFrame className="seat-card">
      {seatLabel && <span className="seat-card-badge">{seatLabel}</span>}
      {/* Figurine + identité = le contrôle de présentation (directive user 2026-07-13). */}
      <PresentHandle hero={hero} onPresent={onPresent} className="seat-card-main">
        <div className="seat-card-fig">
          <CharacterPreview hero={hero} size="fill" ambiance="panel" />
        </div>
        <div className="seat-card-body">
          <CardIdentity hero={hero} />
          <CardLore hero={hero} seat />
        </div>
      </PresentHandle>
      {/* Gestion (Modifier/Remplacer/Retirer) TOUJOURS visible : le layout est stable, rien ne se
          décale ni n'apparaît en flux au survol (directive user 2026-07-13). */}
      {actions && <div className="seat-card-actions row-flex">{actions}</div>}
    </OrnateFrame>
  );
}

/** Carte-action du vivier (même famille visuelle que la carte-portrait) : créer / importer, avec
 *  une ligne d'invite pour ne pas être une icône dans le vide. */
export function ActionCard({ icon, label, invite, onClick, title }: { icon: IconIdInput; label: string; invite?: string; onClick: () => void; title?: string }) {
  return (
    // `btn` (canon) : la carte-action EST un bouton — styles de carte surchargés par `.candidate-action-card`.
    <button type="button" className="btn candidate-action-card" onClick={onClick} title={title}>
      <Icon id={icon} size={38} />
      <span className="candidate-action-label">{label}</span>
      {invite && <span className="candidate-action-invite">{invite}</span>}
    </button>
  );
}
