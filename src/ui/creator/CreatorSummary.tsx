/**
 * « Fiche vivante » du créateur (Zone C) — page blanche cérémonielle (arbitrage 2026-07-13) : la
 * structure est STABLE dès l'étape 1 (tous les blocs présents — figurine, Caractéristiques, dérivées,
 * PX, bourse, Talents, Compétences), GRISÉE tant qu'un choix ne l'a pas renseignée, et se remplit
 * choix par choix. Elle ne gagne JAMAIS un bloc en cours de route (fin de l'apparition surprise).
 *
 * Source de vérité UNIQUE des Caractéristiques : la fiche montre le RÉSULTAT (via buildHero — talents
 * +5 et Augmentations gratuites inclus), le centre montre l'ÉDITION. Le compteur PX recalcule `xpTotal`
 * à chaque changement du brouillon → un tirage accepté l'incrémente EN DIRECT.
 *
 * Le CORPS de fiche (Caractéristiques/dérivées/Forces/Compétences/Talents/Sorts/Possessions) compose
 * la primitive `HeroSheet` (`../HeroSheet.tsx`, consécration #417 suite — constat utilisateur fondateur
 * « La fiche vivante ce n'est pas une primitive ? », 2026-07-15) dès qu'un héros prévisualisé existe ;
 * l'alcôve (figurine+identité), le compteur PX et la bourse restent des encarts PROPRES au créateur
 * (page blanche pré-héros, apparence de secours sans héros bâti, tirage EN DIRECT) — hors mandat de
 * `HeroSheet` (entrée = un `Combatant`).
 */
import { CSSProperties, useMemo } from 'react';
import { CHAR_KEYS, CharKey, Combatant } from '../../engine/types';
import { Coins } from '../Coins';
import type { Appearance } from '../../gameIso/rig/appearance';
import { CharacterPreview } from '../CharacterPreview';
import { Icon } from '../Icon';
import { CharStatsGrid } from '../CharStatsGrid';
import { HeroSheet } from '../HeroSheet';
import { careerLabelFor, rigSpeciesId } from '../../data';
import { CreatorDraft, buildHero, draftSpecies, draftLevel, draftWealth, draftChars, hasSpecies, xpTotal, speciesXp, careerXp, charsXp, starXp, stepIds } from './draft';

/** Grisage cérémoniel d'un bloc « non renseigné » (page blanche). */
const DIM: CSSProperties = { opacity: 0.38 };

export function previewHero(d: CreatorDraft): Combatant | null {
  try {
    return buildHero(d, 'preview');
  } catch {
    return null;
  }
}

export function CreatorSummary({ d }: { d: CreatorDraft; step?: number }) {
  const hero = useMemo(() => previewHero(d), [d]);
  const sp = draftSpecies(d);
  const level = draftLevel(d);
  const baseChars = draftChars(d);
  // Surlignage des Caractéristiques AUGMENTÉES (talents +5, Augmentations gratuites) : le héros
  // prévisualisé porte le RÉSULTAT, `baseChars` l'ÉDITION brute — un écart signale une contribution
  // externe (`HeroSheet` `statAnnotations`, data-driven, aucun branchement créateur dans la primitive).
  const statAnnotations = useMemo(() => {
    if (!hero) return undefined;
    const out: Partial<Record<CharKey, { valClass?: string; note?: string }>> = {};
    for (const k of CHAR_KEYS) {
      if (hero.characteristics[k] > baseChars[k]) {
        out[k] = { valClass: 'boost', note: `${baseChars[k]} + Augmentations/talents` };
      }
    }
    return out;
  }, [hero, baseChars]);
  const started = hasSpecies(d); // au moins une race choisie → la fiche commence à vivre
  const careerLabel = d.careerId ? careerLabelFor({ career: d.careerId, appearance: { sex: d.sex } }) : '';
  // Repli si le brouillon ne construit aucun héros valide : apparence du brouillon (race choisie), sans équipement.
  const appearance: Appearance | null = sp
    ? { species: rigSpeciesId(d.speciesId), sex: d.sex, build: d.build, seed: d.appSeed, colors: d.colors, parts: d.parts }
    : null;
  const wealth = d.careerId ? draftWealth(d) : null;

  return (
    <aside className="creator-summary">
      {hero ? (
        <CharacterPreview hero={hero} size="fill" ambiance="panel" className="creator-fig" />
      ) : appearance ? (
        <CharacterPreview appearance={appearance} career={d.careerId || undefined} size="fill" ambiance="panel" className="creator-fig" />
      ) : (
        <div className="creator-fig" style={DIM} aria-hidden />
      )}
      <div className="creator-id" style={started ? undefined : DIM}>
        <strong>{d.name.trim() || 'Aventurier'}</strong>
        <span className="char-sub">
          {level ? `${level.label} (${careerLabel})` : careerLabel || 'Carrière à choisir'}
          {level?.status ? ` · ${level.status}` : ''}
        </span>
        <span className="char-sub">{sp?.label ?? 'Race à choisir'}</span>
      </div>

      {hero ? (
        <HeroSheet hero={hero} header={false} statAnnotations={statAnnotations} className="creator-hero-sheet" />
      ) : (
        <>
          <div style={started ? undefined : DIM}>
            <CharStatsGrid size="sm" value={(k) => (sp ? baseChars[k] : '—')} />
          </div>
          <div className="creator-derived" style={started ? undefined : DIM}>
            <span>
              <Icon id="resource/wounds" size="sm" /> Blessures <b>—</b>
            </span>
            <span>
              <Icon id="resource/movement" size="sm" /> Mouvement <b>{sp?.movement ?? '—'}</b>
            </span>
            <span>
              <Icon id="resource/fate" size="sm" /> Destin <b>{sp?.fate.fate ?? '—'}</b> · Chance <b>—</b>
            </span>
            <span>
              <Icon id="resource/resilience" size="sm" /> Résilience <b>{sp?.fate.resilience ?? '—'}</b> · Déterm. <b>—</b>
            </span>
          </div>
        </>
      )}

      <div
        className="creator-xp"
        style={started ? undefined : DIM}
        title={`Espèce +${speciesXp(d)} · Carrière +${careerXp(d)} · Caractéristiques +${charsXp(d)}${stepIds().includes('star') ? ` · Signe +${starXp(d)}` : ''}`}
      >
        PX bonus de création : <b>+{xpTotal(d)}</b>
      </div>
      <div className="creator-derived" style={started ? undefined : DIM}>
        <span>
          <Icon id="resource/gold-purse" size="sm" /> Bourse <b>{wealth ? <Coins money={wealth} /> : '—'}</b>
        </span>
      </div>
    </aside>
  );
}