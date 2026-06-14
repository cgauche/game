/**
 * Nécromancie (Magie noire) — LDB 50, 4 sorts. Curation B4 : « Réanimation » et « Relever les
 * morts » INVOQUENT des morts-vivants contrôlés (champ summon — liés au sorcier, ils s'effondrent
 * s'il tombe) ; « Crâne hurlant » est un Projectile qui terrifie ; « L'appel de Vanhel » (Action/
 * Mouvement gratuit aux morts-vivants) reste narratif. Source du moteur d'invocation : state/summonFlow.
 */
import { SpellSpec } from '../../engine/spellspec';

export const NECROMANCIE: SpellSpec[] = [
  {
    label: 'Crâne hurlant',
    // « Projectile magique qui n'affecte que les cibles SANS le Trait Mort-vivant, Dégâts = BFM. Pour
    //   chaque blessure infligée, Test de Calme (+0) ou État Brisé. » — Dégâts via le moteur missile ;
    //   le Test de Calme/Brisé à la touche ; le filtre « non mort-vivant » reste journalisé.
    ops: [
      { op: 'test', skill: 'Calme', difficulty: 'intermediaire', onFail: [{ op: 'condition', name: 'Brisé' }] },
      { op: 'narrative', text: 'Crâne hurlant : n’affecte que les cibles SANS le Trait Mort-vivant ; le Test de Calme se répète pour chaque Blessure infligée — arbitrage MJ.' },
    ],
    durationRounds: null,
    curated: true,
    source: 'LDB 50 — Nécromancie « Crâne hurlant »',
  },
  {
    label: "L'appel de Vanhel",
    // « (Bonus d'Intelligence) cibles Mort-vivant gagnent une Action OU un Mouvement gratuit (au
    //   choix, pour toutes). +(BInt) cibles par +2 DR. » — octroi d'action gratuite à des PNJ
    //   morts-vivants : non modélisé : arbitré.
    ops: [{ op: 'narrative', text: 'L’appel de Vanhel : (BInt) morts-vivants gagnent une Action ou un Mouvement gratuit (le même pour tous), +(BInt) cibles par +2 DR — arbitrage MJ.' }],
    durationRounds: null,
    curated: true,
    source: "LDB 50 — Nécromancie « L'appel de Vanhel »",
  },
  {
    label: 'Réanimation',
    // « Réanimez (BFM + DR) corps en zombies ou squelettes à portée. Ils entrent avec l'État À Terre,
    //   sous votre contrôle ; ils s'effondrent si vous mourez ou tombez Inconscient. Reste actif
    //   jusqu'au lever du soleil. +(BFM + DR) par +2 DR. » — invocation de morts-vivants contrôlés,
    //   liés au sorcier ; le choix zombie/squelette, l'État À Terre initial et la surincantation
    //   restent journalisés.
    ops: [{ op: 'narrative', text: 'Réanimation : les réanimés (zombies, ou squelettes au choix) entrent avec l’État À Terre et tiennent jusqu’au lever du soleil ; +(BFM + DR) corps supplémentaires par +2 DR — arbitrage MJ.' }],
    summon: { ref: 'Zombie', count: { bonusOf: 'FM' }, countPerSL: { every: 1, amount: 1 }, allyOfCaster: true, despawnIfCasterDown: true },
    durationRounds: null, // « Jusqu'au lever du soleil » (persiste ; lié au sorcier)
    curated: true,
    source: 'LDB 50 — Nécromancie « Réanimation »',
  },
  {
    label: 'Relever les morts',
    // « (DR + 1) squelettes sortent du sol dans la ZdE, avec l'État À Terre, sous votre contrôle ; ils
    //   s'écroulent si vous mourez ou tombez Inconscient. Reste actif jusqu'au lever du soleil. +(DR)
    //   par +2 DR. » — invocation de squelettes contrôlés, liés au sorcier.
    ops: [{ op: 'narrative', text: 'Relever les morts : les squelettes entrent avec l’État À Terre et tiennent jusqu’au lever du soleil ; +(DR) squelettes supplémentaires par +2 DR — arbitrage MJ.' }],
    summon: { ref: 'Squelette', count: 1, countPerSL: { every: 1, amount: 1 }, allyOfCaster: true, despawnIfCasterDown: true },
    durationRounds: null, // « Jusqu'au lever du soleil »
    curated: true,
    source: 'LDB 50 — Nécromancie « Relever les morts »',
  },
];
