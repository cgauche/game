/**
 * « Fiche vivante » du créateur (Zone C) — page blanche cérémonielle (arbitrage 2026-07-13) : la
 * structure est STABLE dès l'étape 1 (tous les blocs présents — figurine, Caractéristiques, dérivées,
 * PX, bourse, Talents, Compétences), GRISÉE tant qu'un choix ne l'a pas renseignée, et se remplit
 * choix par choix. Elle ne gagne JAMAIS un bloc en cours de route (fin de l'apparition surprise).
 *
 * Source de vérité UNIQUE des Caractéristiques : la fiche montre le RÉSULTAT (via buildHero — talents
 * +5 et Augmentations gratuites inclus), le centre montre l'ÉDITION. Le compteur PX recalcule `xpTotal`
 * à chaque changement du brouillon → un tirage accepté l'incrémente EN DIRECT.
 */
import { CSSProperties, useMemo } from 'react';
import { Combatant } from '../../engine/types';
import { Coins } from '../Coins';
import type { Appearance } from '../../gameIso/rig/appearance';
import { CharacterPreview } from '../CharacterPreview';
import { Icon } from '../Icon';
import { CharStatsGrid } from '../CharStatsGrid';
import { SkillChip, TalentChip } from '../EntityChip';
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
        <span className="char-sub">{sp?.label ?? 'Race à choisir'}</span>
        <span className="char-sub">
          {level ? `${level.label} (${careerLabel})` : careerLabel || 'Carrière à choisir'}
          {level?.status ? ` · ${level.status}` : ''}
        </span>
      </div>

      <div style={started ? undefined : DIM}>
        <CharStatsGrid
          value={(k) => (hero ? hero.characteristics[k] : sp ? baseChars[k] : '—')}
          valClass={(k) => { const v = hero?.characteristics[k] ?? baseChars[k]; return hero != null && v > baseChars[k] ? 'boost' : ''; }}
          note={(k) => { const v = hero?.characteristics[k] ?? baseChars[k]; return hero != null && v > baseChars[k] ? `${baseChars[k]} + Augmentations/talents` : undefined; }}
        />
      </div>

      <div className="creator-derived" style={started ? undefined : DIM}>
        <span>
          <Icon id="resource/wounds" size="sm" /> Blessures <b>{hero?.wounds.max ?? '—'}</b>
        </span>
        <span>
          <Icon id="resource/movement" size="sm" /> Mouvement <b>{hero?.movement ?? sp?.movement ?? '—'}</b>
        </span>
        <span>
          <Icon id="resource/fate" size="sm" /> Destin <b>{hero?.fate ?? sp?.fate.fate ?? '—'}</b> · Chance <b>{hero?.fortune ?? '—'}</b>
        </span>
        <span>
          <Icon id="resource/resilience" size="sm" /> Résilience <b>{hero?.resilience ?? sp?.fate.resilience ?? '—'}</b> · Déterm. <b>{hero?.resolve ?? '—'}</b>
        </span>
        <span>
          <Icon id="resource/gold-purse" size="sm" /> Bourse <b>{wealth ? <Coins money={wealth} /> : '—'}</b>
        </span>
      </div>

      <div
        className="creator-xp"
        style={started ? undefined : DIM}
        title={`Espèce +${speciesXp(d)} · Carrière +${careerXp(d)} · Caractéristiques +${charsXp(d)}${stepIds().includes('star') ? ` · Signe +${starXp(d)}` : ''}`}
      >
        PX bonus de création : <b>+{xpTotal(d)}</b>
      </div>

      {/* Talents & Compétences : blocs PRÉSENTS dès l'étape 1 (grisés/vides), remplis par les choix —
          plus d'apparition surprise à l'étape 4 (arbitrage page blanche). */}
      <div className="char-skills" style={hero ? undefined : DIM}>
        <div className="mini-title">Talents</div>
        <div className="skill-tags">
          {hero?.talents.length
            ? hero.talents.map((t) => <TalentChip key={`${t.talentId}|${t.spec ?? ''}`} talent={t} />)
            : <span className="hint">—</span>}
        </div>
        <div className="mini-title">Compétences formées</div>
        <div className="skill-tags">
          {hero?.skills.filter((s) => s.advances > 0).length
            ? hero.skills.filter((s) => s.advances > 0).slice(0, 14).map((s) => <SkillChip key={`${s.skillId}|${s.spec ?? ''}`} skill={s} />)
            : <span className="hint">—</span>}
        </div>
      </div>
    </aside>
  );
}
