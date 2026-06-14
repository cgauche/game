// Couche de TENUES par carrière : auto (workflow → careerTenuesAuto.ts) + overrides MANUELS.
// Les overrides ci-dessous sont éditables à la main et PRIMENT sur l'auto (l'ingestion ne touche que le fichier auto).
import { GENERATED_CAREER_TENUES_AUTO } from './careerTenuesAuto';
import { CAREER_TENUE_DEFS } from '../tenues';
import type { PartArt } from '../types';

type TenueSlots = Partial<Record<'torse' | 'jambes' | 'bras' | 'tete', PartArt>>;

/** Overrides manuels de tenue de carrière (édition à la main OK).
 *  Une part peut être une string (= FRONT pour toutes les vues, complétée par les vues
 *  AUTO via withViews) OU un objet `{front, back?, profile?}` d'art DÉDIÉ et cohérent —
 *  dans ce cas withViews laisse la part telle quelle (pas de greffe d'une vue étrangère). */
const MANUAL: Record<string, TenueSlots> = {
  // Skaven (guerrier-rat famélique) : PAS de couvre-chef (slot `tete` absent → la tête de rat
  // monstrueuse s'affiche). Le corps reste en PELAGE (`@peau` = brun d'espèce) : seul un
  // plastron de lamelles d'acier DÉPAREILLÉES (`@metal`, irrégulières/rouillées/rapiécées)
  // sanglé de cuir (`@cuir`) couvre le torse ; les bras gardent le pelage nu (juste un
  // brassard de cuir) pour que le POING LIBRE en pelage raccorde au bras ; les jambes =
  // pelage + bandes de chiffon/cuir. Art DÉDIÉ {front, back, profile} (pas dans tenueViews).
  Skaven: {
    torse: {
      // FACE : ventre/poitrail en pelage (token @peau, plus clair sur le poitrail), par-dessus
      // un plastron de lamelles d'acier dépareillées (tailles inégales) sanglé en croix de cuir.
      front: `<g stroke-linejoin="round">`
        // pelage du torse (base) — poitrail plus clair (@peauH), plis du ventre
        + `<path d="M-13 -27 Q0 -31 13 -27 L12 2 Q11 16 6 22 L-6 22 Q-11 16 -12 2Z" fill="@peau" stroke="@peauO" stroke-width="0.7"/>`
        + `<path d="M-10 -24 Q0 -27 10 -24 Q9 -10 6 0 Q0 3 -6 0 Q-9 -10 -10 -24Z" fill="@peauH" opacity="0.5"/>`
        + `<path d="M-7 6 Q0 9 7 6 M-6 12 Q0 15 6 12 M-5 17 Q0 19 5 17" fill="none" stroke="@peauO" stroke-width="0.6" opacity="0.5"/>`
        // sangles de cuir en croix (baudrier de récup)
        + `<path d="M-12 -25 L9 18" stroke="@cuirO" stroke-width="3" stroke-linecap="round"/>`
        + `<path d="M-12 -25 L9 18" stroke="@cuir" stroke-width="1.1" stroke-linecap="round" opacity="0.7"/>`
        + `<path d="M11 -22 L-3 14" stroke="@cuirO" stroke-width="2.2" stroke-linecap="round"/>`
        // plastron de lamelles d'acier DÉPAREILLÉES (plaques de tailles/teintes/angles inégaux,
        // ternies/rouillées) — base @metalO sombre, rares reflets @metalH, taches de rouille brunes.
        + `<path d="M-10 -23 L-2 -24 L-3 -15 L-11 -13Z" fill="@metalO" stroke="#23282f" stroke-width="0.7"/>`
        + `<path d="M-1 -24 L8 -22 L9 -16 L7 -13 L-2 -14Z" fill="@metal" stroke="#23282f" stroke-width="0.7"/>`
        + `<path d="M-1 -24 L8 -22 L8 -20 L-1 -22Z" fill="@metalH" opacity="0.4"/>`
        + `<path d="M-12 -13 L-3 -14 L-4 -4 L-11 -2 L-12 -7Z" fill="@metal" stroke="#23282f" stroke-width="0.7"/>`
        + `<path d="M-3 -14 L7 -13 L9 -9 L8 -2 L-4 -4Z" fill="@metalO" stroke="#23282f" stroke-width="0.7"/>`
        + `<path d="M-4 -4 L8 -2 L6 7 L-3 6Z" fill="@metalO" stroke="#23282f" stroke-width="0.7"/>`
        + `<path d="M-3 -3 L4 -3 L4 -1 L-3 -1.5Z" fill="@metalH" opacity="0.35"/>`
        // voile de rouille brune sur l'ensemble du plastron (acier terni/oxydé) + coulures
        + `<path d="M-11 -23 L8 -22 L9 -9 L6 7 L-3 6 L-12 -2Z" fill="@cuirO" opacity="0.22"/>`
        + `<path d="M-8 -20 Q-7 -16 -9 -12 Q-6 -14 -6 -19Z" fill="@cuirO" opacity="0.55"/>`
        + `<path d="M5 -11 Q7 -6 5 -1 Q4 -6 3 -10Z" fill="@cuirO" opacity="0.5"/>`
        + `<path d="M-2 -9 Q0 -5 -1 2" stroke="@cuirO" stroke-width="1" fill="none" opacity="0.5"/>`
        + `<path d="M1 -20 Q3 -17 6 -19" stroke="@cuir" stroke-width="0.7" fill="none" opacity="0.5"/>`
        // rivets dépareillés (piqûres sombres)
        + `<circle cx="-6" cy="-19" r="0.7" fill="#1c2026"/><circle cx="3" cy="-21" r="0.6" fill="#1c2026"/>`
        + `<circle cx="-7" cy="-8" r="0.7" fill="#1c2026"/><circle cx="4" cy="-10" r="0.6" fill="#1c2026"/>`
        + `<circle cx="-1" cy="0" r="0.6" fill="#1c2026"/>`
        // ourlet de chiffon en lambeaux sous le plastron
        + `<path d="M-12 4 L-9 12 L-6 5 L-3 13 L0 5 L3 12 L6 5 L9 13 L12 4 L11 18 Q0 22 -11 18Z" fill="@vet1O" stroke="@vet1O" stroke-width="0.5" opacity="0.9"/>`
        + `</g>`,
      // DOS : pelage du dos (épine plus sombre) + sangles de cuir croisées + une ou deux
      // lamelles d'acier rivetées sur les omoplates (le gros du plastron est devant).
      back: `<g stroke-linejoin="round">`
        + `<path d="M-13 -27 Q0 -31 13 -27 L12 2 Q11 16 6 22 L-6 22 Q-11 16 -12 2Z" fill="@peauO" stroke="@peauO" stroke-width="0.7"/>`
        + `<path d="M0 -28 Q1.4 -2 0 22" fill="none" stroke="#2a1d12" stroke-width="1" opacity="0.6"/>`
        + `<path d="M-9 -24 Q0 -27 9 -24 M-10 -8 Q0 -5 10 -8 M-9 8 Q0 11 9 8" fill="none" stroke="@peauO" stroke-width="0.6" opacity="0.5"/>`
        + `<path d="M9 -25 L-9 18" stroke="@cuirO" stroke-width="3" stroke-linecap="round"/>`
        + `<path d="M-11 -22 L3 14" stroke="@cuirO" stroke-width="2.2" stroke-linecap="round"/>`
        + `<path d="M-9 -23 L0 -24 L-1 -15 L-10 -14Z" fill="@metalO" stroke="#2a3038" stroke-width="0.7"/>`
        + `<path d="M1 -23 L9 -21 L8 -14 L0 -15Z" fill="@metalO" stroke="#2a3038" stroke-width="0.7"/>`
        + `<circle cx="-5" cy="-19" r="0.7" fill="#2a3038"/><circle cx="5" cy="-18" r="0.7" fill="#2a3038"/>`
        + `<path d="M-12 4 L-9 12 L-6 5 L-3 13 L0 5 L3 12 L6 5 L9 13 L12 4 L11 18 Q0 22 -11 18Z" fill="@vet1O" stroke="@vet1O" stroke-width="0.5" opacity="0.85"/>`
        + `</g>`,
      // PROFIL : tronc étroit en pelage (poitrine avancée +x), plastron de lamelles d'acier de
      // côté + sangle de cuir, ourlet de chiffon. Lit le même rat-guerrier de côté.
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-6 -27 Q4 -31 8 -26 Q8.5 -8 6 4 L5 20 Q0 23 -5 20 Q-7 6 -6 -27Z" fill="@peau" stroke="@peauO" stroke-width="0.7"/>`
        + `<path d="M4 -25 Q6 -10 4.4 2" fill="none" stroke="@peauH" stroke-width="0.8" opacity="0.5"/>`
        + `<path d="M-6 6 Q0 9 5 6 M-5 12 Q0 14 5 12" fill="none" stroke="@peauO" stroke-width="0.6" opacity="0.5"/>`
        + `<path d="M-5 -25 L7 16" stroke="@cuirO" stroke-width="2.6" stroke-linecap="round"/>`
        + `<path d="M-4 -23 L1 -24 L0 -14 L-5 -13Z" fill="@metalO" stroke="#2a3038" stroke-width="0.7"/>`
        + `<path d="M1 -23 L7 -21 L6 -12 L0 -13Z" fill="@metal" stroke="#2a3038" stroke-width="0.7"/>`
        + `<path d="M0 -13 L6 -12 L5 -2 L-1 -3Z" fill="@metalO" stroke="#2a3038" stroke-width="0.7"/>`
        + `<circle cx="3" cy="-18" r="0.7" fill="#2a3038"/><circle cx="2.5" cy="-7" r="0.7" fill="#2a3038"/>`
        + `<path d="M-5 4 L-3 12 L-1 5 L1 13 L3 5 L5 12 L7 4 L6.4 18 Q0 21 -5.4 18Z" fill="@vet1O" stroke="@vet1O" stroke-width="0.5" opacity="0.9"/>`
        + `</g>`,
    },
    // Bras = PATTE VELUE : pelage nu (token @peau) sur toute la longueur, juste un brassard de
    // cuir + une lanière près de l'épaule. PAS de manche d'acier → le poing (main @peau) raccorde.
    bras: {
      front: `<g stroke-linejoin="round">`
        + `<path d="M-3.4 -2 Q-4.6 8 -3.8 20 Q-3.6 28 -3 32 L3 32 Q3.6 28 3.8 20 Q4.6 8 3.4 -2 Q0 -4 -3.4 -2Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>`
        + `<path d="M-2 0 Q-3 10 -2.4 26 M2 0 Q3 10 2.4 26" fill="none" stroke="@peauO" stroke-width="0.5" opacity="0.45"/>`
        // brassard de cuir (épaule) + lanière (avant-bras)
        + `<path d="M-3.8 1 Q0 -1 3.8 1 L3.6 7 Q0 9 -3.6 7Z" fill="@cuir" stroke="@cuirO" stroke-width="0.6"/>`
        + `<path d="M-3.6 3 Q0 5 3.6 3" fill="none" stroke="@cuirO" stroke-width="0.5" opacity="0.6"/>`
        + `<path d="M-3.4 18 Q0 16.5 3.4 18 L3.2 21 Q0 22.5 -3.2 21Z" fill="@cuirO" stroke="@cuirO" stroke-width="0.5"/>`
        + `</g>`,
      back: `<g stroke-linejoin="round">`
        + `<path d="M-3.4 -2 Q-4.6 8 -3.8 20 Q-3.6 28 -3 32 L3 32 Q3.6 28 3.8 20 Q4.6 8 3.4 -2 Q0 -4 -3.4 -2Z" fill="@peauO" stroke="@peauO" stroke-width="0.6"/>`
        + `<path d="M0 0 Q0 14 0 28" fill="none" stroke="#2a1d12" stroke-width="0.5" opacity="0.45"/>`
        + `<path d="M-3.8 1 Q0 -1 3.8 1 L3.6 7 Q0 9 -3.6 7Z" fill="@cuirO" stroke="@cuirO" stroke-width="0.6"/>`
        + `<path d="M-3.4 18 Q0 16.5 3.4 18 L3.2 21 Q0 22.5 -3.2 21Z" fill="@cuirO" stroke="@cuirO" stroke-width="0.5"/>`
        + `</g>`,
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-3 -2 Q-4 8 -3.2 20 Q-3 28 -2.6 32 L2.6 32 Q3 28 3.2 20 Q4 8 3 -2 Q0 -4 -3 -2Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>`
        + `<path d="M0 0 Q-0.4 12 0 26" fill="none" stroke="@peauO" stroke-width="0.5" opacity="0.45"/>`
        + `<path d="M-3.2 1 Q0 -1 3.2 1 L3 7 Q0 9 -3 7Z" fill="@cuir" stroke="@cuirO" stroke-width="0.6"/>`
        + `<path d="M-3 18 Q0 16.5 3 18 L2.8 21 Q0 22.5 -2.8 21Z" fill="@cuirO" stroke="@cuirO" stroke-width="0.5"/>`
        + `</g>`,
    },
    // Jambes = pelage (token @peau) avec bandes de chiffon/cuir enroulées (haillons), laissant
    // le pelage apparent. Le pied nu griffu est dessiné par le système (FOOT directionnel).
    jambes: {
      front: `<g stroke-linejoin="round">`
        + `<path d="M-4.6 0 Q-5.4 14 -4.2 30 Q-4 42 -3.4 50 L3.4 50 Q4 42 4.2 30 Q5.4 14 4.6 0Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>`
        + `<path d="M-2.6 2 Q-3.4 16 -2.6 44 M2.6 2 Q3.4 16 2.6 44" fill="none" stroke="@peauO" stroke-width="0.5" opacity="0.45"/>`
        // bandes de chiffon/cuir enroulées (haillons) — espacées, pelage visible entre
        + `<path d="M-4.6 6 L4.6 4 L4.6 9 L-4.6 11Z" fill="@vet1O" stroke="@vet1O" stroke-width="0.4"/>`
        + `<path d="M-4.4 16 L4.4 14 L4.4 19 L-4.4 21Z" fill="@cuirO" stroke="@cuirO" stroke-width="0.4"/>`
        + `<path d="M-4 27 L4 25 L4 30 L-4 32Z" fill="@vet1O" stroke="@vet1O" stroke-width="0.4"/>`
        + `<path d="M-3.6 38 L3.6 36 L3.6 41 L-3.6 43Z" fill="@cuirO" stroke="@cuirO" stroke-width="0.4"/>`
        + `<path d="M2 9 L-2 11 M2 30 L-2 32" stroke="@cuir" stroke-width="0.5" opacity="0.6"/>`
        + `</g>`,
      back: `<g stroke-linejoin="round">`
        + `<path d="M-4.6 0 Q-5.4 14 -4.2 30 Q-4 42 -3.4 50 L3.4 50 Q4 42 4.2 30 Q5.4 14 4.6 0Z" fill="@peauO" stroke="@peauO" stroke-width="0.6"/>`
        + `<path d="M0 2 Q0 26 0 48" fill="none" stroke="#2a1d12" stroke-width="0.5" opacity="0.45"/>`
        + `<path d="M-4.6 4 L4.6 6 L4.6 11 L-4.6 9Z" fill="@vet1O" stroke="@vet1O" stroke-width="0.4"/>`
        + `<path d="M-4.4 14 L4.4 16 L4.4 21 L-4.4 19Z" fill="@cuirO" stroke="@cuirO" stroke-width="0.4"/>`
        + `<path d="M-4 25 L4 27 L4 32 L-4 30Z" fill="@vet1O" stroke="@vet1O" stroke-width="0.4"/>`
        + `<path d="M-3.6 36 L3.6 38 L3.6 43 L-3.6 41Z" fill="@cuirO" stroke="@cuirO" stroke-width="0.4"/>`
        + `</g>`,
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-3.4 0 Q-4.2 14 -3 30 Q-2.8 42 -2.4 50 L3.4 50 Q4 42 3.6 30 Q4.2 14 3.6 0Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>`
        + `<path d="M0 2 Q-0.4 26 0 48" fill="none" stroke="@peauO" stroke-width="0.5" opacity="0.45"/>`
        + `<path d="M-3.4 6 L3.6 4 L3.6 9 L-3.4 11Z" fill="@vet1O" stroke="@vet1O" stroke-width="0.4"/>`
        + `<path d="M-3.2 16 L3.4 14 L3.4 19 L-3.2 21Z" fill="@cuirO" stroke="@cuirO" stroke-width="0.4"/>`
        + `<path d="M-2.8 27 L3 25 L3 30 L-2.8 32Z" fill="@vet1O" stroke="@vet1O" stroke-width="0.4"/>`
        + `<path d="M-2.6 38 L2.8 36 L2.8 41 L-2.6 43Z" fill="@cuirO" stroke="@cuirO" stroke-width="0.4"/>`
        + `</g>`,
    },
  },
  // Squelette (mort-vivant décharné) : le corps EST une ossature — torse = cage thoracique
  // (cavité SOMBRE + côtes/sternum/colonne en os @peau), membres = os longs grêles à articulations
  // (rotule/coude renflés, fût d'os fin). Sans ça le corps crème plein lisait comme une MOMIE
  // bandée. Tête de crâne via SPECIES_AUTO_MONSTER ; pieds nus osseux via la règle bareFoot.
  Squelette: {
    torse: {
      front: `<g stroke-linejoin="round">`
        + `<path d="M-12 -27 Q0 -30 12 -27 L11 2 Q10 16 5 22 L-5 22 Q-10 16 -11 2Z" fill="#17140e" stroke="@peauO" stroke-width="0.7"/>`
        + `<path d="M-11 -24 Q-5 -20 0 -21 Q5 -20 11 -24" fill="none" stroke="@peau" stroke-width="2.2" stroke-linecap="round"/>`
        + `<path d="M0 -21 L0 -3" stroke="@peau" stroke-width="2.6" stroke-linecap="round"/>`
        + `<path d="M-0.5 -18 Q-7 -19 -10 -12 M0.5 -18 Q7 -19 10 -12" fill="none" stroke="@peau" stroke-width="1.8" stroke-linecap="round"/>`
        + `<path d="M-0.5 -13 Q-8 -14 -10.5 -6 M0.5 -13 Q8 -14 10.5 -6" fill="none" stroke="@peau" stroke-width="1.8" stroke-linecap="round"/>`
        + `<path d="M-0.5 -8 Q-8 -9 -9.5 -0.5 M0.5 -8 Q8 -9 9.5 -0.5" fill="none" stroke="@peau" stroke-width="1.7" stroke-linecap="round"/>`
        + `<path d="M-0.5 -3 Q-6 -4 -7.5 4 M0.5 -3 Q6 -4 7.5 4" fill="none" stroke="@peau" stroke-width="1.6" stroke-linecap="round"/>`
        + `<path d="M-8 8 Q-10 16 -4 21 Q0 19 4 21 Q10 16 8 8 Q4 12 0 11 Q-4 12 -8 8Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>`
        + `<path d="M0 11 L0 19" stroke="@peauO" stroke-width="0.9"/>`
        + `</g>`,
      back: `<g stroke-linejoin="round">`
        + `<path d="M-12 -27 Q0 -30 12 -27 L11 2 Q10 16 5 22 L-5 22 Q-10 16 -11 2Z" fill="#1d1a13" stroke="@peauO" stroke-width="0.7"/>`
        + `<path d="M0 -25 L0 20" stroke="@peau" stroke-width="2.8" stroke-linecap="round"/>`
        + `<path d="M-2 -22 h4 M-2 -17 h4 M-2.4 -12 h4.8 M-2.4 -7 h4.8 M-2 -2 h4 M-2 3 h4 M-1.6 8 h3.2" stroke="@peauO" stroke-width="1" opacity="0.7"/>`
        + `<path d="M-10 -23 Q-3 -22 -3 -14 Q-8 -13 -10 -23Z M10 -23 Q3 -22 3 -14 Q8 -13 10 -23Z" fill="@peauO" stroke="@peauO" stroke-width="0.5"/>`
        + `<path d="M0 -16 Q-7 -16 -9 -10 M0 -16 Q7 -16 9 -10 M0 -10 Q-8 -10 -9 -4 M0 -10 Q8 -10 9 -4" fill="none" stroke="@peauO" stroke-width="1.2" opacity="0.7"/>`
        + `<path d="M-8 9 Q-9 16 -4 20 L4 20 Q9 16 8 9 Q4 12 0 11 Q-4 12 -8 9Z" fill="@peauO" stroke="@peauO" stroke-width="0.5"/>`
        + `</g>`,
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-5 -27 Q5 -30 8 -25 Q8 -8 6 2 L5 22 Q0 24 -5 22 Q-6 4 -5 -27Z" fill="#17140e" stroke="@peauO" stroke-width="0.7"/>`
        + `<path d="M-4 -25 Q-5 -2 -4 20" fill="none" stroke="@peau" stroke-width="2.4" stroke-linecap="round"/>`
        + `<path d="M6 -22 Q6.5 -8 5 0" fill="none" stroke="@peau" stroke-width="1.7" stroke-linecap="round"/>`
        + `<path d="M-3.5 -18 Q3 -19 6 -14 M-4 -12 Q3 -13 6.5 -7 M-4 -6 Q3 -7 6 -1 M-3.5 0 Q2 -1 4.5 5" fill="none" stroke="@peau" stroke-width="1.5" stroke-linecap="round"/>`
        + `<path d="M-4 8 Q-5 16 0 20 Q5 17 5 9 Q1 12 -4 8Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>`
        + `</g>`,
    },
    bras: {
      front: `<g stroke-linejoin="round">`
        + `<path d="M-2.4 -1 Q-3 7 -2 13 L2 13 Q3 7 2.4 -1Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>`
        + `<circle cx="0" cy="15" r="2.4" fill="@peauH" stroke="@peauO" stroke-width="0.5"/>`
        + `<path d="M-2 17 Q-2.4 25 -1.6 31 L1.6 31 Q2.4 25 2 17Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>`
        + `<path d="M0 17 L0 31" stroke="@peauO" stroke-width="0.5" opacity="0.5"/>`
        + `</g>`,
      back: `<g stroke-linejoin="round">`
        + `<path d="M-2.4 -1 Q-3 7 -2 13 L2 13 Q3 7 2.4 -1Z" fill="@peauO" stroke="@peauO" stroke-width="0.6"/>`
        + `<circle cx="0" cy="15" r="2.4" fill="@peauO" stroke="@peauO" stroke-width="0.5"/>`
        + `<path d="M-2 17 Q-2.4 25 -1.6 31 L1.6 31 Q2.4 25 2 17Z" fill="@peauO" stroke="@peauO" stroke-width="0.6"/>`
        + `</g>`,
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-2 -1 Q-2.6 7 -1.8 13 L2 13 Q2.6 7 2.2 -1Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>`
        + `<circle cx="0.2" cy="15" r="2.2" fill="@peauH" stroke="@peauO" stroke-width="0.5"/>`
        + `<path d="M-1.8 17 Q-2.2 25 -1.4 31 L1.8 31 Q2.2 25 1.9 17Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>`
        + `</g>`,
    },
    jambes: {
      front: `<g stroke-linejoin="round">`
        + `<path d="M-3 0 Q-3.6 12 -2.4 21 L2.4 21 Q3.6 12 3 0Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>`
        + `<circle cx="0" cy="24" r="3" fill="@peauH" stroke="@peauO" stroke-width="0.6"/>`
        + `<path d="M-2.6 27 Q-3 39 -2 49 L2 49 Q3 39 2.6 27Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>`
        + `<path d="M0.8 28 Q1 39 0.8 48" stroke="@peauO" stroke-width="0.5" opacity="0.5" fill="none"/>`
        + `</g>`,
      back: `<g stroke-linejoin="round">`
        + `<path d="M-3 0 Q-3.6 12 -2.4 21 L2.4 21 Q3.6 12 3 0Z" fill="@peauO" stroke="@peauO" stroke-width="0.6"/>`
        + `<circle cx="0" cy="24" r="3" fill="@peauO" stroke="@peauO" stroke-width="0.6"/>`
        + `<path d="M-2.6 27 Q-3 39 -2 49 L2 49 Q3 39 2.6 27Z" fill="@peauO" stroke="@peauO" stroke-width="0.6"/>`
        + `</g>`,
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-2.6 0 Q-3.2 12 -2 21 L2.6 21 Q3.2 12 2.8 0Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>`
        + `<circle cx="0.3" cy="24" r="2.8" fill="@peauH" stroke="@peauO" stroke-width="0.6"/>`
        + `<path d="M-2.2 27 Q-2.6 39 -1.6 49 L2.4 49 Q2.8 39 2.4 27Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>`
        + `</g>`,
    },
  },
  // Vampire (aristocrate) : manteau de cour SOMBRE (@vet1) à plastron/parements CRAMOISIS
  // (@vet2), fermoir d'acier à la gorge, et un COL HAUT en éventail dressé derrière la nuque
  // (silhouette de comte). Tenue SÉLECTIONNABLE pour n'importe quel humanoïde (le costume est
  // découplé de l'espèce) ; les crocs restent un détail de visage propre au Vampire (monster.cape).
  Vampire: {
    torse: {
      front: `<g stroke-linejoin="round">`
        + `<path d="M-3 -27 L-22 -42 Q-24 -25 -8 -20 Z" fill="@vet1O" stroke="#000" stroke-width="0.5"/>`
        + `<path d="M3 -27 L22 -42 Q24 -25 8 -20 Z" fill="@vet1O" stroke="#000" stroke-width="0.5"/>`
        + `<path d="M-4 -26 L-17 -37 Q-18 -25 -8 -21 Z" fill="@vet2" opacity="0.9"/>`
        + `<path d="M4 -26 L17 -37 Q18 -25 8 -21 Z" fill="@vet2" opacity="0.9"/>`
        + `<path d="M-13 -27 Q0 -31 13 -27 L12 4 L10 34 Q0 38 -10 34 L-12 4Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M-4 -23 L4 -23 L3 30 L-3 30Z" fill="@vet2" stroke="@vet2O" stroke-width="0.5"/>`
        + `<path d="M-4 -23 L-9 -9 L-7 4 M4 -23 L9 -9 L7 4" fill="none" stroke="@vet1H" stroke-width="0.8" opacity="0.5"/>`
        + `<path d="M-2 -22 L2 -22 L1.4 -18 L-1.4 -18Z" fill="@metal" stroke="@metalO" stroke-width="0.4"/>`
        + `<circle cx="0" cy="-8" r="0.9" fill="@metal"/><circle cx="0" cy="0" r="0.9" fill="@metal"/><circle cx="0" cy="8" r="0.9" fill="@metal"/>`
        + `</g>`,
      back: `<g stroke-linejoin="round">`
        + `<path d="M-3 -27 L-22 -42 Q-24 -25 -8 -20 Z" fill="@vet1" stroke="#000" stroke-width="0.5"/>`
        + `<path d="M3 -27 L22 -42 Q24 -25 8 -20 Z" fill="@vet1" stroke="#000" stroke-width="0.5"/>`
        + `<path d="M-4 -25 L-15 -35 Q-16 -25 -8 -21 Z" fill="@vet2O" opacity="0.7"/>`
        + `<path d="M4 -25 L15 -35 Q16 -25 8 -21 Z" fill="@vet2O" opacity="0.7"/>`
        + `<path d="M-13 -27 Q0 -31 13 -27 L12 4 L10 34 Q0 38 -10 34 L-12 4Z" fill="@vet1O" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M0 -22 Q1 4 0 32" fill="none" stroke="#000" stroke-width="0.8" opacity="0.5"/>`
        + `</g>`,
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-4 -27 L-16 -40 Q-17 -25 -7 -20 Z" fill="@vet1O" stroke="#000" stroke-width="0.5"/>`
        + `<path d="M-5 -28 Q3 -31 7 -26 Q8.5 -10 6 4 L5 33 Q-1 37 -6 33 L-5 4 Q-7 -13 -5 -28Z" fill="@vet1" stroke="@vet1O" stroke-width="0.6"/>`
        + `<path d="M3 -26 Q5 -8 4 30" fill="none" stroke="@vet2" stroke-width="2.2" opacity="0.85"/>`
        + `<circle cx="2" cy="-6" r="0.8" fill="@metal"/><circle cx="2" cy="4" r="0.8" fill="@metal"/>`
        + `</g>`,
    },
    jambes: {
      front: `<g stroke-linejoin="round">`
        + `<path d="M-4.5 0 Q-5 24 -3.4 38 L3.4 38 Q5 24 4.5 0Z" fill="@vet1" stroke="@vet1O" stroke-width="0.6"/>`
        + `<path d="M0 2 Q-0.4 20 0 36" stroke="@vet1O" stroke-width="0.6" opacity="0.4" fill="none"/>`
        + `<path d="M-3.6 38 Q0 36 3.6 38 L4 50 Q0 52 -4 50Z" fill="@cuir" stroke="@cuirO" stroke-width="0.6"/>`
        + `<path d="M-3.8 41 Q0 39.4 3.8 41" fill="none" stroke="@cuirO" stroke-width="0.6" opacity="0.6"/>`
        + `</g>`,
      back: `<g stroke-linejoin="round">`
        + `<path d="M-4.5 0 Q-5 24 -3.4 38 L3.4 38 Q5 24 4.5 0Z" fill="@vet1O" stroke="@vet1O" stroke-width="0.6"/>`
        + `<path d="M-3.6 38 Q0 36 3.6 38 L4 50 Q0 52 -4 50Z" fill="@cuirO" stroke="@cuirO" stroke-width="0.6"/>`
        + `</g>`,
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-3.4 0 Q-4 24 -2.6 38 L3.4 38 Q4 24 3.6 0Z" fill="@vet1" stroke="@vet1O" stroke-width="0.6"/>`
        + `<path d="M-2.6 38 Q0 36 3.6 38 L8 50 Q4 52 -2.8 50Z" fill="@cuir" stroke="@cuirO" stroke-width="0.6"/>`
        + `</g>`,
    },
  },
  Garde: {
    // Gambeson matelassé bleu ardoise + buffle de cuir, gorgerin d'acier à médaillon crâne,
    // baudrier de cuir en croix, cape rouge drapée sur l'épaule gauche (vu de dos).
    torse: `<g stroke-linejoin="round">`
      + `<path d="M-15 -27 Q-20 -12 -16 22 L-7 28 Q-8 6 -10 -22Z" fill="url(#g_cloak)" stroke="#4a1014" stroke-width="0.8"/>`
      + `<path d="M-14 -27 Q0 -32 14 -27 L13 6 L11 33 Q0 37 -11 33 L-13 6Z" fill="#3a4658" stroke="#222a36" stroke-width="0.8"/>`
      + `<path d="M-12 -24 Q-13 -2 -11 22" fill="none" stroke="#4d5c70" stroke-width="1" opacity="0.7"/>`
      + `<path d="M12 -24 Q13 -2 11 22" fill="none" stroke="#262f3c" stroke-width="1.1" opacity="0.8"/>`
      + `<path d="M-9 6 Q0 9 9 6 M-10 14 Q0 17 10 14 M-10 22 Q0 25 10 22" fill="none" stroke="#2a323e" stroke-width="0.7" opacity="0.6"/>`
      + `<path d="M-10 -10 Q0 -6 10 -10 L9 4 Q0 8 -9 4Z" fill="#7a5a34" stroke="#4a3520" stroke-width="0.7"/>`
      + `<path d="M-9 -9 Q0 -5 9 -9 L8 2 Q0 5 -8 2Z" fill="#8c6a3e" opacity="0.5"/>`
      + `<path d="M-12 -27 Q-14 -22 -11 -16 L11 -16 Q14 -22 12 -27 Q0 -31 -12 -27Z" fill="url(#g_steelD)" stroke="#2a3038" stroke-width="0.8"/>`
      + `<circle cx="0" cy="-21" r="2.4" fill="#cdd4df" stroke="#5a6272" stroke-width="0.5"/>`
      + `<path d="M-1.4 -22.2 Q0 -23.4 1.4 -22.2 Q1.5 -20.4 0 -19.4 Q-1.5 -20.4 -1.4 -22.2Z" fill="#3a4150"/>`
      + `<circle cx="-0.7" cy="-21.4" r="0.5" fill="#1a1f28"/><circle cx="0.7" cy="-21.4" r="0.5" fill="#1a1f28"/>`
      + `<path d="M-11 -16 L9 26" stroke="#5a3f24" stroke-width="3.4" stroke-linecap="round"/>`
      + `<path d="M-11 -16 L9 26" stroke="#7a5734" stroke-width="1.2" opacity="0.6"/>`
      + `<circle cx="-2" cy="2" r="0.9" fill="#caa64a"/><circle cx="1.5" cy="11" r="0.9" fill="#caa64a"/>`
      + `<path d="M8.5 -8 Q11 0 9.5 18 Q9 8 7 -2Z M11 -4 Q12.6 6 11 20 Q10.6 10 9.6 0Z" fill="url(#g_crest)" opacity="0.8" stroke="#8a2e08" stroke-width="0.4"/>`
      + `</g>`,
    // Cuisse rembourrée bleu ardoise + genouillère d'acier, accent fendu rouille,
    // botte de cuir sombre à revers bouclé. Côté gauche (miroité à droite).
    jambes: `<g stroke-linejoin="round">`
      + `<path d="M-4.5 0 Q-5.5 14 -4 24 L4 24 Q5.5 14 4.5 0Z" fill="#3a4658" stroke="#222a36" stroke-width="0.8"/>`
      + `<path d="M-3 2 Q-3.6 12 -2.6 22 M2.6 2 Q3.4 12 2.6 22" fill="none" stroke="#2a323e" stroke-width="0.7" opacity="0.6"/>`
      + `<path d="M0.5 1 Q1 11 0.5 21" fill="none" stroke="#a8551c" stroke-width="2.2" opacity="0.55" stroke-linecap="round"/>`
      + `<path d="M-5 22 Q0 19 5 22 Q5.6 28 4.5 31 Q0 33 -4.5 31 Q-5.6 28 -5 22Z" fill="url(#g_steelD)" stroke="#2a3038" stroke-width="0.9"/>`
      + `<path d="M-3.6 25.5 Q0 23.8 3.6 25.5" fill="none" stroke="#cdd4df" stroke-width="0.7" opacity="0.7"/>`
      + `<path d="M-4.6 31 Q0 33 4.6 31 L5 50 Q0 52 -5 50Z" fill="#2e2018" stroke="#161009" stroke-width="0.8"/>`
      + `<path d="M-4.4 33 Q0 31.4 4.4 33 L4.6 37 Q0 39 -4.6 37Z" fill="#43301f"/>`
      + `<path d="M-4.6 36 Q0 38 4.6 36" fill="none" stroke="#0e0a06" stroke-width="1.4"/>`
      + `<rect x="-1" y="34.5" width="2" height="2.4" rx="0.4" fill="#caa64a"/>`
      + `<path d="M-4.2 44 Q0 46 4.2 44" fill="none" stroke="#1c130c" stroke-width="0.7" opacity="0.7"/>`
      + `</g>`,
    // Casque d'acier type chapeau de fer : bombe + large bord rabattu, emblème crâne ailé.
    tete: `<g stroke-linejoin="round">`
      + `<path d="M-8 -3 Q0 -16 8 -3 Q0 -8 -8 -3Z" fill="url(#g_steel)" stroke="#39414e" stroke-width="0.8"/>`
      + `<path d="M0 -15.4 Q-7 -8 -7.4 -3.4 Q-3 -7 0 -7.6 Q3 -7 7.4 -3.4 Q7 -8 0 -15.4Z" fill="#cfd6e0" opacity="0.5"/>`
      + `<path d="M-10 -2.6 Q0 -8 10 -2.6 Q11 -0.6 9.6 1.6 Q0 -2.4 -9.6 1.6 Q-11 -0.6 -10 -2.6Z" fill="url(#g_steelD)" stroke="#2a3038" stroke-width="0.8"/>`
      + `<path d="M-9.4 -2.2 Q0 -6.4 9.4 -2.2" fill="none" stroke="#dfe6ef" stroke-width="0.6" opacity="0.6"/>`
      + `<path d="M0 -13.2 Q-2.4 -10.4 -2.6 -7.8 Q0 -9 2.6 -7.8 Q2.4 -10.4 0 -13.2Z" fill="#cdd4df" stroke="#5a6272" stroke-width="0.4"/>`
      + `<path d="M-2 -10.6 Q0 -11.6 2 -10.6 Q2.1 -8.8 0 -7.9 Q-2.1 -8.8 -2 -10.6Z" fill="#3a4150"/>`
      + `<circle cx="-0.8" cy="-10" r="0.45" fill="#12161d"/><circle cx="0.8" cy="-10" r="0.45" fill="#12161d"/>`
      + `<path d="M-2.4 -9.6 Q-5 -10.4 -6.2 -9 Q-4 -9 -2.4 -8.6Z M2.4 -9.6 Q5 -10.4 6.2 -9 Q4 -9 2.4 -8.6Z" fill="#b9c0cc" stroke="#7a828f" stroke-width="0.3"/>`
      + `</g>`,
    // Manche bouffante matelassée bleu ardoise à crevés rouille, épaulière d'acier.
    bras: `<g stroke-linejoin="round">`
      + `<path d="M-5 -1 Q-7 7 -5.4 14 Q-4 11 -3.4 8 Q-4.4 4 -4 -0.4Z" fill="#3a4658" stroke="#222a36" stroke-width="0.7"/>`
      + `<path d="M5 -1 Q7 7 5.4 14 Q4 11 3.4 8 Q4.4 4 4 -0.4Z" fill="#2f3a49" stroke="#1c232e" stroke-width="0.7"/>`
      + `<path d="M-4 0 Q-5.6 7 -4.6 14 L4.6 14 Q5.6 7 4 0 Q0 -2 -4 0Z" fill="#34404f"/>`
      + `<path d="M-1.6 1 Q-3.4 7 -2.6 13 M1.6 1 Q3.4 7 2.6 13" fill="none" stroke="#a8551c" stroke-width="1.8" opacity="0.5" stroke-linecap="round"/>`
      + `<path d="M-3.4 4 Q0 6 3.4 4 M-3.6 8 Q0 10 3.6 8" fill="none" stroke="#262f3c" stroke-width="0.6" opacity="0.6"/>`
      + `<path d="M-5 -2 Q0 -5 5 -2 Q6 1 4.6 4 Q0 1 -4.6 4 Q-6 1 -5 -2Z" fill="url(#g_steelD)" stroke="#2a3038" stroke-width="0.8"/>`
      + `<path d="M-4.4 -1.4 Q0 -4 4.4 -1.4" fill="none" stroke="#cdd4df" stroke-width="0.5" opacity="0.6"/>`
      + `<path d="M-3.4 14 Q0 16 3.4 14 L3.2 24 Q0 25.4 -3.2 24Z" fill="#34404f" stroke="#1c232e" stroke-width="0.6"/>`
      + `<path d="M-3 24 Q0 25.4 3 24 L2.6 30 Q0 31 -2.6 30Z" fill="#43301f" stroke="#241a10" stroke-width="0.6"/>`
      + `</g>`,
  },
  Soldat: {
    // Fantassin d'État : cuirasse d'acier à arête centrale + col riveté, tabard aux
    // couleurs (rouge à pal blanc) frappé d'un médaillon doré, ceinturon de cuir à boucle.
    // Art DÉDIÉ {front, back, profile} : même cuirasse + tabard + ceinturon sous tous les angles.
    torse: {
      front: `<g stroke-linejoin="round">`
        + `<path d="M-13 -27 Q0 -32 13 -27 L12 2 Q11 14 6 20 L-6 20 Q-11 14 -12 2Z" fill="url(#g_steel)" stroke="#39414e" stroke-width="0.9"/>`
        + `<path d="M0 -29 Q2.2 -4 0 20 Q-2.2 -4 0 -29Z" fill="#cfd6e0" opacity="0.45"/>`
        + `<path d="M-13 -27 Q0 -32 13 -27 L11 -21 Q0 -25 -11 -21Z" fill="url(#g_steelD)" stroke="#2a3038" stroke-width="0.7"/>`
        + `<circle cx="-9" cy="-24" r="0.7" fill="#9aa6b8"/><circle cx="0" cy="-26" r="0.7" fill="#9aa6b8"/><circle cx="9" cy="-24" r="0.7" fill="#9aa6b8"/>`
        + `<path d="M-11.5 13 Q0 16 11.5 13 L10.5 18.5 Q0 21.5 -10.5 18.5Z" fill="url(#g_steelD)" stroke="#2a3038" stroke-width="0.6"/>`
        + `<path d="M-6.5 -16 L6.5 -16 L5.6 33 Q0 36 -5.6 33Z" fill="#b0323a" stroke="#7a1c20" stroke-width="0.7"/>`
        + `<path d="M-1.7 -16 L1.7 -16 L1.5 34 L-1.5 34Z" fill="#e8e0d0"/>`
        + `<circle cx="0" cy="-3" r="2.5" fill="#caa64a" stroke="#7a5a1a" stroke-width="0.4"/>`
        + `<circle cx="0" cy="-3" r="1" fill="#7a5a1a"/>`
        + `<path d="M-11 15 Q0 18 11 15 L10 20 Q0 23 -10 20Z" fill="#5a3f24" stroke="#3a2614" stroke-width="0.7"/>`
        + `<rect x="-2.3" y="15.6" width="4.6" height="4.2" rx="0.6" fill="#caa64a" stroke="#7a5a1a" stroke-width="0.5"/>`
        + `</g>`,
      // DOS : dossière d'acier (même cuirasse vue de derrière) + tabard rouge à pal blanc
      // qui pend dans le dos + ceinturon. Pas de médaillon (il est sur la poitrine).
      back: `<g stroke-linejoin="round">`
        + `<path d="M-13 -27 Q0 -32 13 -27 L12 2 Q11 14 6 20 L-6 20 Q-11 14 -12 2Z" fill="url(#g_steelD)" stroke="#2a3038" stroke-width="0.9"/>`
        + `<path d="M-12.5 -27 Q0 -31 12.5 -27 L11 -21 Q0 -24 -11 -21Z" fill="url(#g_steel)" stroke="#39414e" stroke-width="0.7"/>`
        + `<path d="M0 -28 Q1.4 -4 0 19" stroke="#2a3038" stroke-width="0.9" fill="none"/>`
        + `<path d="M-8 -23 Q0 -20 8 -23" stroke="#2a3038" stroke-width="0.7" fill="none" opacity="0.7"/>`
        + `<path d="M-6.5 -16 L6.5 -16 L5.6 33 Q0 36 -5.6 33Z" fill="#9c2b32" stroke="#7a1c20" stroke-width="0.7"/>`
        + `<path d="M-1.7 -16 L1.7 -16 L1.5 34 L-1.5 34Z" fill="#ddd5c4"/>`
        + `<path d="M-11 15 Q0 18 11 15 L10 20 Q0 23 -10 20Z" fill="#5a3f24" stroke="#3a2614" stroke-width="0.7"/>`
        + `</g>`,
      // PROFIL : tronc étroit (cuirasse de côté, poitrine bombée vers l'avant +x), bord du
      // tabard rouge le long du flanc, col riveté, ceinturon. Lit le MÊME perso de côté.
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-6 -27 Q4 -31 8 -26 Q8.5 -6 6 6 L5 18 Q0 21 -5 18 Q-7 6 -6 -27Z" fill="url(#g_steel)" stroke="#39414e" stroke-width="0.9"/>`
        + `<path d="M5 -26 Q7 -10 5.5 8" stroke="#cfd6e0" stroke-width="0.8" fill="none" opacity="0.5"/>`
        + `<path d="M-6 -27 Q4 -31 8 -26 L7 -21 Q1 -24 -5 -22Z" fill="url(#g_steelD)" stroke="#2a3038" stroke-width="0.7"/>`
        + `<circle cx="-1" cy="-24" r="0.7" fill="#9aa6b8"/><circle cx="4" cy="-25" r="0.7" fill="#9aa6b8"/>`
        + `<path d="M5.2 -16 L7 -16 L6 33 L4 33Z" fill="#b0323a" stroke="#7a1c20" stroke-width="0.6"/>`
        + `<path d="M-6 13 Q0 16 6 13 L5.4 19 Q0 22 -5.4 19Z" fill="#5a3f24" stroke="#3a2614" stroke-width="0.7"/>`
        + `<rect x="3.6" y="14.4" width="3" height="4" rx="0.5" fill="#caa64a" stroke="#7a5a1a" stroke-width="0.5"/>`
        + `</g>`,
    },
    // Cuissard matelassé (chamois) + genouillère d'acier, botte de cuir sombre à revers.
    jambes: {
      front: `<g stroke-linejoin="round">`
        + `<path d="M-4.6 0 Q-5.4 12 -4 22 L4 22 Q5.4 12 4.6 0Z" fill="#cabf9a" stroke="#8a7d52" stroke-width="0.7"/>`
        + `<path d="M-2 2 Q-2.6 12 -1.8 21 M2 2 Q2.6 12 1.8 21" fill="none" stroke="#a89a6a" stroke-width="0.5" opacity="0.6"/>`
        + `<path d="M-5 22 Q0 19 5 22 Q5.6 27 4.4 30 Q0 32 -4.4 30 Q-5.6 27 -5 22Z" fill="url(#g_steelD)" stroke="#2a3038" stroke-width="0.9"/>`
        + `<path d="M-3.6 25 Q0 23.4 3.6 25" fill="none" stroke="#cdd4df" stroke-width="0.6" opacity="0.7"/>`
        + `<path d="M-4.6 30 Q0 32 4.6 30 L5 50 Q0 52 -5 50Z" fill="#3a2816" stroke="#1c130a" stroke-width="0.8"/>`
        + `<path d="M-4.4 32 Q0 30.4 4.4 32 L4.6 36 Q0 38 -4.6 36Z" fill="#5a3f24"/>`
        + `<path d="M-4.6 35 Q0 37 4.6 35" fill="none" stroke="#120c06" stroke-width="1.2"/>`
        + `</g>`,
      // DOS : revers de la jambe (chamois) + genouillère vue de derrière (plaque lisse) + arrière
      // de la botte (talon, revers). MÊMES couleurs/composants que la face.
      back: `<g stroke-linejoin="round">`
        + `<path d="M-4.6 0 Q-5.4 12 -4 22 L4 22 Q5.4 12 4.6 0Z" fill="#bfb38e" stroke="#8a7d52" stroke-width="0.7"/>`
        + `<path d="M0 2 Q0 12 0 21" fill="none" stroke="#a89a6a" stroke-width="0.5" opacity="0.6"/>`
        + `<path d="M-5 22 Q0 19.6 5 22 Q5.6 27 4.4 30 Q0 32 -4.4 30 Q-5.6 27 -5 22Z" fill="url(#g_steelD)" stroke="#2a3038" stroke-width="0.9"/>`
        + `<path d="M-4.6 30 Q0 32 4.6 30 L5 50 Q0 52 -5 50Z" fill="#33240f" stroke="#1c130a" stroke-width="0.8"/>`
        + `<path d="M-4.4 32 Q0 30.6 4.4 32 L4.6 36 Q0 38 -4.6 36Z" fill="#4e3620"/>`
        + `<path d="M-4.6 35 Q0 37 4.6 35" fill="none" stroke="#120c06" stroke-width="1.2"/>`
        + `</g>`,
      // PROFIL : jambe de côté (chamois) + genouillère d'acier en saillie (+x) + botte qui
      // pointe vers l'avant (talon -x, bout +x). Reprend exactement les composants de la face.
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-3.4 0 Q-4.2 12 -3 22 L3.4 22 Q4 12 3.6 0Z" fill="#cabf9a" stroke="#8a7d52" stroke-width="0.7"/>`
        + `<path d="M0 2 Q-0.4 12 0 21" fill="none" stroke="#a89a6a" stroke-width="0.5" opacity="0.6"/>`
        + `<path d="M-3.4 22 Q1 19 4.6 22 Q5.6 26 4.8 30 Q1 32 -3 30 Q-4 26 -3.4 22Z" fill="url(#g_steelD)" stroke="#2a3038" stroke-width="0.9"/>`
        + `<path d="M0 24.5 Q2.6 23.6 4.2 25" fill="none" stroke="#cdd4df" stroke-width="0.6" opacity="0.7"/>`
        + `<path d="M-3.2 30 Q1 32 4 30 L4.2 49 Q4 52 1 51.5 L-3.2 49Z" fill="#3a2816" stroke="#1c130a" stroke-width="0.8"/>`
        + `<path d="M-3.2 32 Q1 30.6 4 32 L4.2 36 Q1 38 -3.2 36Z" fill="#5a3f24"/>`
        + `<path d="M-3.2 35 Q1 37 4 35" fill="none" stroke="#120c06" stroke-width="1.1"/>`
        + `</g>`,
    },
    // Manche de gambeson matelassée + spallière d'acier (2 lames), brassard de cuir, main.
    bras: {
      front: `<g stroke-linejoin="round">`
        + `<path d="M-4 0 Q-5.6 8 -4.6 16 L4.6 16 Q5.6 8 4 0 Q0 -2 -4 0Z" fill="#cabf9a" stroke="#8a7d52" stroke-width="0.7"/>`
        + `<path d="M-3 1 Q-3.8 8 -3.2 15 M-1 1 Q-1.6 8 -1.2 15 M1 1 Q1.6 8 1.2 15 M3 1 Q3.8 8 3.2 15" fill="none" stroke="#a89a6a" stroke-width="0.45" opacity="0.7"/>`
        + `<path d="M-5 -2 Q0 -6 5 -2 Q6.3 2 4.6 5 Q0 1.6 -4.6 5 Q-6.3 2 -5 -2Z" fill="url(#g_steelD)" stroke="#2a3038" stroke-width="0.8"/>`
        + `<path d="M-4.4 -1.6 Q0 -4.8 4.4 -1.6" fill="none" stroke="#cdd4df" stroke-width="0.5" opacity="0.6"/>`
        + `<path d="M-4.6 4 Q0 1.4 4.6 4 Q5.2 7 3.8 9.4 Q0 6.6 -3.8 9.4 Q-5.2 7 -4.6 4Z" fill="url(#g_steelD)" stroke="#2a3038" stroke-width="0.6"/>`
        + `<path d="M-4.6 16 Q0 18 4.6 16 L4 27 Q0 29 -4 27Z" fill="#5a3f24" stroke="#3a2614" stroke-width="0.6"/>`
        + `<path d="M-4.2 19 Q0 21 4.2 19 M-4 23 Q0 25 4 23" fill="none" stroke="#3a2614" stroke-width="0.5" opacity="0.6"/>`
        + `<path d="M-3.4 27 Q0 29 3.4 27 Q3.2 31 0 31.6 Q-3.2 31 -3.4 27Z" fill="@peau"/>`
        + `</g>`,
      // DOS : même manche (chamois) + spallière d'acier + brassard de cuir + main. Identique
      // de structure à la face (le bras n'a pas d'asymétrie avant/arrière marquée).
      back: `<g stroke-linejoin="round">`
        + `<path d="M-4 0 Q-5.6 8 -4.6 16 L4.6 16 Q5.6 8 4 0 Q0 -2 -4 0Z" fill="#bfb38e" stroke="#8a7d52" stroke-width="0.7"/>`
        + `<path d="M0 1 Q0 8 0 15" fill="none" stroke="#a89a6a" stroke-width="0.45" opacity="0.6"/>`
        + `<path d="M-5 -2 Q0 -6 5 -2 Q6.3 2 4.6 5 Q0 1.6 -4.6 5 Q-6.3 2 -5 -2Z" fill="url(#g_steelD)" stroke="#2a3038" stroke-width="0.8"/>`
        + `<path d="M-4.6 4 Q0 1.4 4.6 4 Q5.2 7 3.8 9.4 Q0 6.6 -3.8 9.4 Q-5.2 7 -4.6 4Z" fill="url(#g_steelD)" stroke="#2a3038" stroke-width="0.6"/>`
        + `<path d="M-4.6 16 Q0 18 4.6 16 L4 27 Q0 29 -4 27Z" fill="#4e3620" stroke="#3a2614" stroke-width="0.6"/>`
        + `<path d="M-3.4 27 Q0 29 3.4 27 Q3.2 31 0 31.6 Q-3.2 31 -3.4 27Z" fill="@peauO"/>`
        + `</g>`,
      // PROFIL : manche étroite + spallière de côté + main. Reprend les composants de la face.
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-3 0 Q-4 8 -3.4 16 L3.4 16 Q4 8 3 0 Q0 -2 -3 0Z" fill="#cabf9a" stroke="#8a7d52" stroke-width="0.7"/>`
        + `<path d="M0 1 Q-0.4 8 0 15" fill="none" stroke="#a89a6a" stroke-width="0.45" opacity="0.6"/>`
        + `<path d="M-4 -2 Q0 -6 4.4 -2 Q5.4 2 4 5 Q0 1.6 -4 5 Q-5 2 -4 -2Z" fill="url(#g_steelD)" stroke="#2a3038" stroke-width="0.8"/>`
        + `<path d="M-3.4 16 Q0 18 3.4 16 L3 27 Q0 29 -3 27Z" fill="#5a3f24" stroke="#3a2614" stroke-width="0.6"/>`
        + `<path d="M-2.6 27 Q0 29 2.6 27 Q2.6 31 0 31.6 Q-2.6 31 -2.6 27Z" fill="@peau"/>`
        + `</g>`,
    },
    // Morion : bombe d'acier à crête, large bord relevé, rivets. PAS de plume — même casque
    // sous toutes les vues (corrige la « plume fantôme » des vues auto).
    tete: {
      front: `<g stroke-linejoin="round">`
        + `<path d="M-9 -2 Q-10 -14 0 -15 Q10 -14 9 -2 Q0 -6 -9 -2Z" fill="url(#g_steel)" stroke="#39414e" stroke-width="0.8"/>`
        + `<path d="M0 -14 Q-6 -10 -7 -3 Q-3 -6 0 -6 Q3 -6 7 -3 Q6 -10 0 -14Z" fill="#cfd6e0" opacity="0.45"/>`
        + `<path d="M0 -16.5 Q-2.2 -9 0 -3 Q2.2 -9 0 -16.5Z" fill="url(#g_steelD)" stroke="#2a3038" stroke-width="0.6"/>`
        + `<path d="M-11 -2 Q0 -7 11 -2 Q12.4 1 10 3.4 Q0 -2.4 -10 3.4 Q-12.4 1 -11 -2Z" fill="url(#g_steelD)" stroke="#2a3038" stroke-width="0.8"/>`
        + `<path d="M-10 -1.6 Q0 -6 10 -1.6" fill="none" stroke="#dfe6ef" stroke-width="0.6" opacity="0.6"/>`
        + `<circle cx="-7" cy="-1" r="0.7" fill="#9aa6b8"/><circle cx="7" cy="-1" r="0.7" fill="#9aa6b8"/>`
        + `</g>`,
      // DOS : bombe vue de derrière, crête au centre, bord relevé pointes avant/arrière.
      back: `<g stroke-linejoin="round">`
        + `<path d="M-9 -2 Q-10 -14 0 -15 Q10 -14 9 -2 Q0 -6 -9 -2Z" fill="url(#g_steelD)" stroke="#2a3038" stroke-width="0.8"/>`
        + `<path d="M0 -16.5 Q-1.6 -9 0 -2 Q1.6 -9 0 -16.5Z" fill="url(#g_steel)" stroke="#2a3038" stroke-width="0.6"/>`
        + `<path d="M-8 -8 Q0 -11 8 -8" stroke="#2a3038" stroke-width="0.6" fill="none" opacity="0.6"/>`
        + `<path d="M-11 -2 Q0 -7 11 -2 Q12.4 1 10 3.4 Q0 -2.4 -10 3.4 Q-12.4 1 -11 -2Z" fill="url(#g_steelD)" stroke="#2a3038" stroke-width="0.8"/>`
        + `<circle cx="-7" cy="-1" r="0.7" fill="#9aa6b8"/><circle cx="7" cy="-1" r="0.7" fill="#9aa6b8"/>`
        + `</g>`,
      // PROFIL : bombe de côté + crête en ligne sur le sommet, large bord relevé (pointe avant +x,
      // pointe arrière -x). Le visage reste dégagé sous le bord. Pas de plume.
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-8.5 -2 Q-9 -13 0 -15 Q7 -14.5 8 -3 Q1 -6.5 -8.5 -2Z" fill="url(#g_steel)" stroke="#39414e" stroke-width="0.8"/>`
        + `<path d="M-7 -3 Q-7.5 -12 0 -14.5 Q3 -13.5 4 -3 Q-1 -6 -7 -3Z" fill="#cfd6e0" opacity="0.4"/>`
        + `<path d="M-2 -14 Q-3 -8 -2 -3" fill="none" stroke="#2a3038" stroke-width="1.1" opacity="0.7"/>`
        + `<path d="M-11 -2 Q0 -7 10 -2.4 Q12 0 9.6 2.6 Q0 -2 -10.4 2.8 Q-12.4 0.4 -11 -2Z" fill="url(#g_steelD)" stroke="#2a3038" stroke-width="0.8"/>`
        + `<path d="M-10 -1.8 Q0 -6 9.4 -2" fill="none" stroke="#dfe6ef" stroke-width="0.5" opacity="0.55"/>`
        + `<circle cx="1" cy="-2" r="0.7" fill="#9aa6b8"/>`
        + `</g>`,
    },
  },
  // Noble : doublet cramoisi long (g_cloak/@vet1) à boutons d'or et chaîne, gorgerin doré,
  // épaulières d'acier, coiffe à plumes et diadème d'or. Art DÉDIÉ {front, back, profile} :
  // mêmes cramoisi + or + acier sous tous les angles (la chaîne/les boutons restent de face).
  Noble: {
    torse: {
      front: `<g stroke="@vet1O" stroke-width="0.7" stroke-linejoin="round">`
        + `<path d="M-13 -27 Q-8 -32 -1 -30 L-3 -22 Q-9 -24 -13 -20 Z" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.5"/>`
        + `<path d="M13 -27 Q8 -32 1 -30 L3 -22 Q9 -24 13 -20 Z" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.5"/>`
        + `<path d="M-11 -28 Q0 -31 11 -28 Q13 -16 12 -2 L11 12 Q11 24 8 33 Q0 37 -8 33 Q-11 24 -11 12 L-12 -2 Q-13 -16 -11 -28Z" fill="@vet1"/>`
        + `<path d="M-11 -28 Q-6 -30 -1 -29 L-2 33 Q-6 35 -8 33 Q-11 24 -11 12 L-12 -2 Q-13 -16 -11 -28Z" fill="@vet1O" opacity="0.5"/>`
        + `<path d="M-4 -22 L4 -22 M-4 -14 L4 -14 M-4 -6 L4 -6 M-4 2 L4 2 M-4 10 L4 10" stroke="@vet1O" stroke-width="0.55" fill="none" opacity="0.7"/>`
        + `<path d="M-7 -29 Q0 -32 7 -29 L6 -25 Q0 -27 -6 -25 Z" fill="url(#g_steelD)" stroke="@metalO" stroke-width="0.4"/>`
        + `<path d="M-8 -29 Q-6 -33 0 -33 Q6 -33 8 -29 Q4 -30 0 -30 Q-4 -30 -8 -29Z" fill="@vet2"/>`
        + `<path d="M-10 -22 Q0 -12 10 -20" fill="none" stroke="@metal" stroke-width="1.7"/>`
        + `<g fill="@metalH" stroke="@metalO" stroke-width="0.4"><circle cx="0" cy="-6" r="1.1"/><circle cx="0" cy="0" r="1.1"/><circle cx="0" cy="6" r="1.1"/><circle cx="0" cy="12" r="1.1"/></g>`
        + `<path d="M-11 18 Q0 22 11 18 L11 22 Q0 26 -11 22 Z" fill="@metalO"/>`
        + `<rect x="-2.2" y="18.6" width="4.4" height="4" rx="0.8" fill="@metalH" stroke="@metalO" stroke-width="0.4"/>`
        + `</g>`,
      // DOS : dos du doublet cramoisi (pli central), col doré, épaulières d'acier, ceinture
      // dorée. Pas de chaîne ni de boutons (ils sont sur la poitrine).
      back: `<g stroke="@vet1O" stroke-width="0.7" stroke-linejoin="round">`
        + `<path d="M-13 -27 Q-8 -32 -1 -30 L-3 -22 Q-9 -24 -13 -20 Z" fill="url(#g_steelD)" stroke="@metalO" stroke-width="0.5"/>`
        + `<path d="M13 -27 Q8 -32 1 -30 L3 -22 Q9 -24 13 -20 Z" fill="url(#g_steelD)" stroke="@metalO" stroke-width="0.5"/>`
        + `<path d="M-11 -28 Q0 -31 11 -28 Q13 -16 12 -2 L11 12 Q11 24 8 33 Q0 37 -8 33 Q-11 24 -11 12 L-12 -2 Q-13 -16 -11 -28Z" fill="@vet1O"/>`
        + `<path d="M0 -29 Q1.4 -4 0 33" fill="none" stroke="@vet1O" stroke-width="0.9"/>`
        + `<path d="M-8 -23 Q0 -20 8 -23 M-9 0 Q0 3 9 0" fill="none" stroke="@vet1O" stroke-width="0.55" opacity="0.6"/>`
        + `<path d="M-7 -29 Q0 -32 7 -29 L6 -25 Q0 -27 -6 -25 Z" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.4"/>`
        + `<path d="M-11 18 Q0 22 11 18 L11 22 Q0 26 -11 22 Z" fill="@metalO"/>`
        + `</g>`,
      // PROFIL : tronc étroit cramoisi (poitrine avancée +x), col doré, épaulière d'acier de
      // côté, bord de la ceinture dorée, un seul rang de boutons d'or le long de la fente.
      profile: `<g stroke="@vet1O" stroke-width="0.7" stroke-linejoin="round">`
        + `<path d="M-6 -28 Q4 -32 8 -27 Q9 -10 7 4 L6 28 Q6 33 4 35 Q-1 37 -5 34 Q-7 18 -6 -28Z" fill="@vet1"/>`
        + `<path d="M-6 -28 Q-2 -30 0 -29 L-1 34 Q-4 35 -5 34 Q-7 18 -6 -28Z" fill="@vet1O" opacity="0.5"/>`
        + `<path d="M4.6 -24 Q6 0 4.8 28" fill="none" stroke="@vet1O" stroke-width="0.8" opacity="0.7"/>`
        + `<path d="M-6 -28 Q4 -32 8 -27 L7 -22 Q0 -25 -5 -23Z" fill="url(#g_steelD)" stroke="@metalO" stroke-width="0.5"/>`
        + `<path d="M-2 -29 Q4 -32 8 -28 Q5 -30 0 -30 Q-2 -30 -2 -29Z" fill="@vet2"/>`
        + `<g fill="@metalH" stroke="@metalO" stroke-width="0.4"><circle cx="5" cy="-6" r="1"/><circle cx="5" cy="0" r="1"/><circle cx="5" cy="6" r="1"/><circle cx="5" cy="12" r="1"/></g>`
        + `<path d="M-6 18 Q0 22 6.5 18 L6.5 22 Q0 26 -6 22 Z" fill="@metalO"/>`
        + `</g>`,
    },
    jambes: {
      front: `<g stroke="@cuirO" stroke-width="0.6" stroke-linejoin="round">`
        + `<path d="M-5 0 Q-6 8 -5.4 18 Q-5 24 -4.6 26 L4.6 26 Q5 24 5.4 18 Q6 8 5 0 Q0 -2 -5 0Z" fill="url(#g_cloak)"/>`
        + `<path d="M-3.4 0 Q-4 12 -3.4 24 M0 -1 Q0 12 0 25 M3.4 0 Q4 12 3.4 24" fill="none" stroke="@vet1O" stroke-width="0.5" opacity="0.6"/>`
        + `<path d="M-4.6 24 Q0 26 4.6 24 L4.4 27 Q0 29 -4.4 27 Z" fill="@metalO"/>`
        + `<path d="M-4.4 27 Q0 29 4.4 27 L4 38 L3.2 47 Q0 49 -3.2 47 L-4 38 Z" fill="url(#g_steel)"/>`
        + `<path d="M0 28 L0 47" stroke="@metalH" stroke-width="0.8" opacity="0.7" fill="none"/>`
        + `<path d="M-3.8 41 Q0 43 3.8 41" fill="none" stroke="@metal" stroke-width="0.7"/>`
        + `<path d="M-3.2 46 L3.2 46 L4.2 49 Q0 51 -3.6 49 Z" fill="@cuir"/></g>`,
      back: `<g stroke="@cuirO" stroke-width="0.6" stroke-linejoin="round">`
        + `<path d="M-5 0 Q-6 8 -5.4 18 Q-5 24 -4.6 26 L4.6 26 Q5 24 5.4 18 Q6 8 5 0 Q0 -2 -5 0Z" fill="@vet1O"/>`
        + `<path d="M0 -1 Q0 12 0 25" fill="none" stroke="@vet1O" stroke-width="0.6" opacity="0.6"/>`
        + `<path d="M-4.6 24 Q0 26 4.6 24 L4.4 27 Q0 29 -4.4 27 Z" fill="@metalO"/>`
        + `<path d="M-4.4 27 Q0 29 4.4 27 L4 38 L3.2 47 Q0 49 -3.2 47 L-4 38 Z" fill="url(#g_steelD)"/>`
        + `<path d="M-3.2 46 L3.2 46 L4.2 49 Q0 51 -3.6 49 Z" fill="@cuirO"/></g>`,
      // PROFIL : cuisse cramoisie de côté + grève d'acier (saillie +x) + bout de botte de cuir.
      profile: `<g stroke="@cuirO" stroke-width="0.6" stroke-linejoin="round">`
        + `<path d="M-3.6 0 Q-4.4 8 -3.8 18 Q-3.4 24 -3 26 L3.6 26 Q4 24 4.2 18 Q4.6 8 4 0 Q0 -2 -3.6 0Z" fill="url(#g_cloak)"/>`
        + `<path d="M0 0 Q0 12 0 25" fill="none" stroke="@vet1O" stroke-width="0.5" opacity="0.6"/>`
        + `<path d="M-3 24 Q1 26 4 24 L4 27 Q1 29 -3 27 Z" fill="@metalO"/>`
        + `<path d="M-3 27 Q1 29 4 27 L4.2 38 L3.6 47 Q1 49 -2.6 47 L-3 38 Z" fill="url(#g_steel)"/>`
        + `<path d="M0.6 28 L0.6 47" stroke="@metalH" stroke-width="0.8" opacity="0.7" fill="none"/>`
        + `<path d="M-2.6 46 L3.6 46 L7.6 49 Q4 51 -3 49 Z" fill="@cuir"/></g>`,
    },
    bras: {
      front: `<g stroke="@cuirO" stroke-width="0.6" stroke-linejoin="round">`
        + `<path d="M-5 -2 Q-6.5 4 -6 9 Q-5.5 14 -4.4 14 L-3.6 26 Q-3.4 30 0 31 Q3.4 30 3.6 26 L4.4 14 Q5.5 14 6 9 Q6.5 4 5 -2 Q0 -4 -5 -2Z" fill="url(#g_cloak)"/>`
        + `<path d="M-3.6 -1 Q-4 5 -3.4 12 M0 -2 Q0 5 0 12 M3.6 -1 Q4 5 3.4 12" fill="none" stroke="@vet1O" stroke-width="0.5" opacity="0.7"/>`
        + `<path d="M-5 -2 Q0 -5 5 -2 Q6 1 4.6 4 Q0 1 -4.6 4 Q-6 1 -5 -2Z" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.5"/>`
        + `<path d="M-3.6 25 Q0 27 3.6 25 L3.4 28 Q0 30 -3.4 28 Z" fill="@metalO"/></g>`,
      back: `<g stroke="@cuirO" stroke-width="0.6" stroke-linejoin="round">`
        + `<path d="M-5 -2 Q-6.5 4 -6 9 Q-5.5 14 -4.4 14 L-3.6 26 Q-3.4 30 0 31 Q3.4 30 3.6 26 L4.4 14 Q5.5 14 6 9 Q6.5 4 5 -2 Q0 -4 -5 -2Z" fill="@vet1O"/>`
        + `<path d="M0 -2 Q0 8 0 26" fill="none" stroke="@vet1O" stroke-width="0.5" opacity="0.6"/>`
        + `<path d="M-5 -2 Q0 -5 5 -2 Q6 1 4.6 4 Q0 1 -4.6 4 Q-6 1 -5 -2Z" fill="url(#g_steelD)" stroke="@metalO" stroke-width="0.5"/>`
        + `<path d="M-3.6 25 Q0 27 3.6 25 L3.4 28 Q0 30 -3.4 28 Z" fill="@metalO"/></g>`,
      profile: `<g stroke="@cuirO" stroke-width="0.6" stroke-linejoin="round">`
        + `<path d="M-3.6 -2 Q-5 4 -4.6 9 Q-4 14 -3.2 14 L-2.6 26 Q-2.4 30 0 31 Q2.6 30 2.8 26 L3.4 14 Q4.4 14 4.6 9 Q5 4 3.6 -2 Q0 -4 -3.6 -2Z" fill="url(#g_cloak)"/>`
        + `<path d="M0 -2 Q0 6 0 26" fill="none" stroke="@vet1O" stroke-width="0.5" opacity="0.6"/>`
        + `<path d="M-3.6 -2 Q0 -5 4 -2 Q5 1 3.8 4 Q0 1 -3.6 4 Q-4.6 1 -3.6 -2Z" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.5"/>`
        + `<path d="M-2.6 25 Q0 27 2.6 25 L2.4 28 Q0 30 -2.4 28 Z" fill="@metalO"/></g>`,
    },
    // Coiffe à plumes : calotte cramoisie cerclée d'un diadème d'or, plumes latérales, gemme.
    tete: {
      front: `<g stroke="@vet1O" stroke-width="0.7" stroke-linejoin="round">`
        + `<path d="M5 -6 Q9 -14 7 -22 Q12 -15 11 -7 Q9 -3 5 -6 Z" fill="@vet1O"/>`
        + `<path d="M-3 -7 Q-1 -15 -3 -21 Q2 -14 1 -7 Q-1 -4 -3 -7 Z" fill="@vet1"/>`
        + `<path d="M-10 0 Q-12 -11 0 -14 Q12 -11 10 0 Q0 5 -10 0 Z" fill="url(#g_cloak)"/>`
        + `<path d="M-10 0 Q0 4 10 0" fill="none" stroke="@metal" stroke-width="0.9"/>`
        + `<g stroke="@metalH" stroke-width="0.9" fill="none" opacity="0.92"><path d="M-6 -1 Q-7 -8 -4 -12"/><path d="M0 -2 L0 -13"/><path d="M6 -1 Q7 -8 4 -12"/></g>`
        + `<circle cx="0" cy="-2" r="2" fill="@metalH" stroke="@metalO" stroke-width="0.5"/>`
        + `<circle cx="0" cy="-2" r="0.9" fill="@metal" stroke="none"/></g>`,
      // DOS : calotte cramoisie de derrière, diadème doré, plume qui dépasse au sommet.
      back: `<g stroke="@vet1O" stroke-width="0.7" stroke-linejoin="round">`
        + `<path d="M-1 -7 Q1 -16 -2 -22 Q4 -15 3 -7 Q1 -4 -1 -7 Z" fill="@vet1O"/>`
        + `<path d="M-10 0 Q-12 -11 0 -14 Q12 -11 10 0 Q0 5 -10 0 Z" fill="url(#g_cloak)"/>`
        + `<path d="M-10 0 Q0 4 10 0" fill="none" stroke="@metal" stroke-width="0.9"/>`
        + `<path d="M0 -13 Q0 -6 0 0" stroke="@vet1O" stroke-width="0.6" fill="none" opacity="0.6"/></g>`,
      // PROFIL : calotte de côté + diadème doré + plume vers l'arrière (-x) + gemme avant (+x).
      profile: `<g stroke="@vet1O" stroke-width="0.7" stroke-linejoin="round">`
        + `<path d="M-3 -7 Q-7 -15 -5 -22 Q-10 -15 -9 -7 Q-7 -3 -3 -7 Z" fill="@vet1O"/>`
        + `<path d="M-9 -1 Q-10 -12 0 -14 Q9 -12 8.5 -1 Q0 3 -9 -1 Z" fill="url(#g_cloak)"/>`
        + `<path d="M-9 -1 Q0 3 8.5 -1" fill="none" stroke="@metal" stroke-width="0.9"/>`
        + `<g stroke="@metalH" stroke-width="0.9" fill="none" opacity="0.9"><path d="M-3 -2 Q-3 -8 -1 -12"/><path d="M2 -3 Q3 -8 1 -12"/></g>`
        + `<circle cx="5" cy="-3" r="1.6" fill="@metalH" stroke="@metalO" stroke-width="0.5"/></g>`,
    },
  },
  // Sorcier : robe gris-beige (@vet1) sous une sur-robe / cape olive (@vet2) drapée aux
  // épaules, double galon d'or (@metal) en travers du buste, ceinture de cuir à gemme,
  // capuchon olive (@vet2) à liseré d'or. Art DÉDIÉ {front, back, profile}.
  Sorcier: {
    torse: {
      front: `<g stroke-linejoin="round">`
        + `<path d="M14 -26 Q21 -8 17 24 L8 30 Q9 4 11 -22Z" fill="@vet2" stroke="@vet2O" stroke-width="0.8"/>`
        + `<path d="M14 -26 Q20 -9 16 22" fill="none" stroke="@vet2H" stroke-width="1" opacity="0.7"/>`
        + `<path d="M-15 -27 Q-12 -30 -7 -28 Q-13 -16 -10 6Z" fill="@vet2O" stroke="@vet2O" stroke-width="0.7"/>`
        + `<path d="M-14 -27 Q0 -33 14 -26 L9 4 L13 26 L-13 30 L-9 4Z" fill="@vet1H" stroke="@vet1O" stroke-width="0.8"/>`
        + `<path d="M-11 -24 Q-12 0 -10 24 M11 -23 Q12 0 10 23" fill="none" stroke="@vet1O" stroke-width="0.7" opacity="0.55"/>`
        + `<path d="M-10 -8 Q0 -4 10 -8 L9 -1 Q0 3 -9 -1Z" fill="@metal" stroke="@metalO" stroke-width="0.6"/>`
        + `<path d="M-10 2 Q0 6 10 2 L9 8 Q0 11 -9 8Z" fill="@metal" stroke="@metalO" stroke-width="0.6"/>`
        + `<path d="M-11 -16 Q0 -12 11 -16 L10 -10 Q0 -6 -10 -10Z" fill="@cuir" stroke="@cuirO" stroke-width="0.7"/>`
        + `<circle cx="0" cy="-13" r="1.6" fill="@metalH" stroke="@metalO" stroke-width="0.5"/>`
        + `<path d="M-9 18 L-13 30 -11 32 -7 22Z" fill="@vet1" opacity="0.85"/><path d="M9 18 L13 26 11 31 6 22Z" fill="@vet1" opacity="0.85"/>`
        + `<path d="M-3 14 L-5 30 -3 31 -1 16Z" fill="@vet1" opacity="0.7"/><path d="M4 14 L6 28 4 30 2 16Z" fill="@vet1" opacity="0.7"/>`
        + `<path d="M-8 6 Q-11 9 -10 16 L-7 17 Q-7 10 -6 7Z" fill="@metal" stroke="@metalO" stroke-width="0.5" opacity="0.9"/></g>`,
      // DOS : sur-robe olive qui couvre tout le dos (pli central) + bas de robe gris-beige
      // qui dépasse, galon d'or en travers des épaules. Pas d'amulette (elle est devant).
      back: `<g stroke-linejoin="round">`
        + `<path d="M-14 -27 Q0 -33 14 -26 Q15 -8 14 24 L8 30 Q0 32 -8 30 L-14 24 Q-15 -8 -14 -27Z" fill="@vet2" stroke="@vet2O" stroke-width="0.8"/>`
        + `<path d="M0 -29 Q1.4 -2 0 30" fill="none" stroke="@vet2O" stroke-width="1"/>`
        + `<path d="M-12 -22 Q0 -18 12 -22 M-13 2 Q0 6 13 2" fill="none" stroke="@vet2H" stroke-width="0.8" opacity="0.55"/>`
        + `<path d="M-9 22 Q0 26 9 22 L13 30 L-13 30Z" fill="@vet1H" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M-10 -9 Q0 -5 10 -9 L9 -3 Q0 1 -9 -3Z" fill="@metal" stroke="@metalO" stroke-width="0.6"/></g>`,
      // PROFIL : tronc étroit — robe gris-beige (poitrine avancée +x) + sur-robe olive qui
      // pend le long du flanc (-x) + galon d'or + bord de ceinture de cuir. Même perso de côté.
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-7 -27 Q-5 -30 -3 -29 Q-9 -10 -7 24 L-9 30 L-3 30 Q-3 4 -3 -22Z" fill="@vet2" stroke="@vet2O" stroke-width="0.7"/>`
        + `<path d="M-7 -10 Q-6 8 -8 26" fill="none" stroke="@vet2H" stroke-width="0.8" opacity="0.6"/>`
        + `<path d="M-5 -27 Q4 -31 8 -26 Q9 -6 7 4 L7 26 L1 30 Q-3 30 -4 27 Q-6 6 -5 -27Z" fill="@vet1H" stroke="@vet1O" stroke-width="0.8"/>`
        + `<path d="M4 -24 Q5 0 4 26" fill="none" stroke="@vet1O" stroke-width="0.6" opacity="0.55"/>`
        + `<path d="M-5 -8 Q1 -5 8 -8 L7.6 -2 Q1 1 -5 -2Z" fill="@metal" stroke="@metalO" stroke-width="0.6"/>`
        + `<path d="M-5 2 Q1 5 8 2 L7.6 8 Q1 11 -5 8Z" fill="@metal" stroke="@metalO" stroke-width="0.6"/>`
        + `<path d="M-5 -16 Q1 -12 8 -16 L7.6 -10 Q1 -6 -5 -10Z" fill="@cuir" stroke="@cuirO" stroke-width="0.7"/></g>`,
    },
    jambes: {
      front: `<g stroke-linejoin="round">`
        + `<path d="M-4.6 0 Q-5.6 16 -4.4 30 L4.4 30 Q5.6 16 4.6 0Z" fill="@vet1H" stroke="@vet1O" stroke-width="0.8"/>`
        + `<path d="M-2.6 2 Q-3.2 16 -2.4 28 M2.6 2 Q3.2 16 2.4 28" fill="none" stroke="@vet1O" stroke-width="0.6" opacity="0.55"/>`
        + `<path d="M-5 30 Q0 27 5 30 L5.4 50 Q0 52 -5.4 50Z" fill="@cuir" stroke="@cuirO" stroke-width="0.8"/>`
        + `<path d="M-4.6 34 Q0 36 4.6 34" fill="none" stroke="@cuirO" stroke-width="1.2"/>`
        + `<path d="M-5.2 48 Q0 50 5.2 48 L5.4 50 Q0 52 -5.4 50Z" fill="@cuirO"/></g>`,
      back: `<g stroke-linejoin="round">`
        + `<path d="M-4.6 0 Q-5.6 16 -4.4 30 L4.4 30 Q5.6 16 4.6 0Z" fill="@vet1" stroke="@vet1O" stroke-width="0.8"/>`
        + `<path d="M0 2 Q0 16 0 28" fill="none" stroke="@vet1O" stroke-width="0.6" opacity="0.5"/>`
        + `<path d="M-5 30 Q0 27 5 30 L5.4 50 Q0 52 -5.4 50Z" fill="@cuirO" stroke="@cuirO" stroke-width="0.8"/>`
        + `<path d="M-5.2 48 Q0 50 5.2 48 L5.4 50 Q0 52 -5.4 50Z" fill="@cuirO"/></g>`,
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-3.4 0 Q-4.4 16 -3.2 30 L3.4 30 Q4.4 16 3.6 0Z" fill="@vet1H" stroke="@vet1O" stroke-width="0.8"/>`
        + `<path d="M0 2 Q-0.4 16 0 28" fill="none" stroke="@vet1O" stroke-width="0.6" opacity="0.5"/>`
        + `<path d="M-3.4 30 Q1 27 4 30 L4.2 49 Q4 52 1 51.5 L-3.4 49Z" fill="@cuir" stroke="@cuirO" stroke-width="0.8"/>`
        + `<path d="M-3.2 34 Q1 36 4 34" fill="none" stroke="@cuirO" stroke-width="1.1"/>`
        + `<path d="M-3.4 48 Q1 50 4.2 48 L4.2 50 Q1 52 -3.4 50Z" fill="@cuirO"/></g>`,
    },
    bras: {
      front: `<g stroke-linejoin="round">`
        + `<path d="M-4 0 Q-5.8 8 -4.4 17 L4.4 17 Q5.8 8 4 0 Q0 -2 -4 0Z" fill="@vet1H"/>`
        + `<path d="M-2 1 Q-3.4 8 -2.4 16 M2 1 Q3.4 8 2.4 16" fill="none" stroke="@vet1O" stroke-width="0.6" opacity="0.55"/>`
        + `<path d="M-5 -2 Q0 -5 5 -2 Q5.6 1 4.4 4 Q0 1 -4.4 4 Q-5.6 1 -5 -2Z" fill="@vet1" stroke="@vet1O" stroke-width="0.6"/>`
        + `<path d="M-4 16 Q0 18 4 16 L3.6 24 Q0 25.2 -3.6 24Z" fill="@cuir" stroke="@cuirO" stroke-width="0.6"/>`
        + `<path d="M-3.4 24 Q0 25.2 3.4 24 L3 30 Q0 31 -3 30Z" fill="@vet1" stroke="@vet1O" stroke-width="0.5"/></g>`,
      back: `<g stroke-linejoin="round">`
        + `<path d="M-4 0 Q-5.8 8 -4.4 17 L4.4 17 Q5.8 8 4 0 Q0 -2 -4 0Z" fill="@vet1"/>`
        + `<path d="M0 1 Q0 8 0 16" fill="none" stroke="@vet1O" stroke-width="0.6" opacity="0.5"/>`
        + `<path d="M-5 -2 Q0 -5 5 -2 Q5.6 1 4.4 4 Q0 1 -4.4 4 Q-5.6 1 -5 -2Z" fill="@vet1O" stroke="@vet1O" stroke-width="0.6"/>`
        + `<path d="M-4 16 Q0 18 4 16 L3.6 24 Q0 25.2 -3.6 24Z" fill="@cuirO" stroke="@cuirO" stroke-width="0.6"/>`
        + `<path d="M-3.4 24 Q0 25.2 3.4 24 L3 30 Q0 31 -3 30Z" fill="@vet1O" stroke="@vet1O" stroke-width="0.5"/></g>`,
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-3 0 Q-4.4 8 -3.4 17 L3.4 17 Q4.4 8 3 0 Q0 -2 -3 0Z" fill="@vet1H"/>`
        + `<path d="M0 1 Q-0.4 8 0 16" fill="none" stroke="@vet1O" stroke-width="0.6" opacity="0.55"/>`
        + `<path d="M-3.4 -2 Q0 -5 4 -2 Q4.6 1 3.4 4 Q0 1 -3.4 4 Q-4.4 1 -3.4 -2Z" fill="@vet1" stroke="@vet1O" stroke-width="0.6"/>`
        + `<path d="M-3.4 16 Q0 18 3.4 16 L3 24 Q0 25.2 -3 24Z" fill="@cuir" stroke="@cuirO" stroke-width="0.6"/>`
        + `<path d="M-2.6 24 Q0 25.2 2.6 24 L2.4 30 Q0 31 -2.4 30Z" fill="@vet1" stroke="@vet1O" stroke-width="0.5"/></g>`,
    },
    // Capuchon olive à liseré d'or, en pointe au sommet, visage dégagé sous l'ourlet.
    tete: {
      front: `<g stroke-linejoin="round">`
        + `<path d="M-10 4 Q-13 -10 -7 -15 Q0 -19 7 -15 Q13 -10 10 4 Q9 -2 7 -5 Q0 -8 -7 -5 Q-9 -2 -10 4Z" fill="@vet2" stroke="@vet2O" stroke-width="0.9"/>`
        + `<path d="M-7 -15 Q0 -19 7 -15 Q9 -11 9 -5" fill="none" stroke="@vet2H" stroke-width="1" opacity="0.65"/>`
        + `<path d="M-9 2 Q0 -6 9 2" fill="none" stroke="@vet2O" stroke-width="1" opacity="0.7"/>`
        + `<path d="M-7 -5 Q0 -8 7 -5 L6 0 Q0 -3 -6 0Z" fill="@vet2" opacity="0.8"/>`
        + `<path d="M-7 -1 Q0 -3 7 -1" fill="none" stroke="@metal" stroke-width="0.8" opacity="0.7"/></g>`,
      // DOS : capuchon de derrière — calotte olive en pointe, pli central, liseré d'or à la base.
      back: `<g stroke-linejoin="round">`
        + `<path d="M-10 5 Q-13 -10 -6 -16 Q0 -19 6 -16 Q13 -10 10 5 Q0 9 -10 5Z" fill="@vet2" stroke="@vet2O" stroke-width="0.9"/>`
        + `<path d="M0 -17 Q1 -4 0 7" fill="none" stroke="@vet2O" stroke-width="0.8" opacity="0.7"/>`
        + `<path d="M-9 2 Q0 6 9 2" fill="none" stroke="@metal" stroke-width="0.8" opacity="0.7"/></g>`,
      // PROFIL : capuchon de côté — pointe au sommet, l'ouverture du capuchon dégage le visage
      // vers l'avant (+x), pli arrière (-x), liseré d'or à l'ourlet.
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-9 3 Q-12 -10 -5 -16 Q1 -19 7 -13 Q9 -8 8 -2 Q6 -6 2 -6 Q-2 -5 -4 -1 Q-7 1 -9 3Z" fill="@vet2" stroke="@vet2O" stroke-width="0.9"/>`
        + `<path d="M-5 -15 Q-8 -8 -8 1" fill="none" stroke="@vet2O" stroke-width="0.8" opacity="0.65"/>`
        + `<path d="M-4 -1 Q2 -6 8 -2" fill="none" stroke="@metal" stroke-width="0.8" opacity="0.7"/></g>`,
    },
  },
  // Voleur : cape bleu-ardoise (@vet2) drapée derrière les épaules, justaucorps brun (@vet1)
  // lacé au centre, baudrier de cuir en travers, ceinture à bourses, capuchon brun (@cuir) à
  // fermail d'acier. Art DÉDIÉ {front, back, profile} (lacage/bourses → de face).
  Voleur: {
    torse: {
      front: `<g stroke-linejoin="round">`
        + `<path d="M-15 -28 Q-22 -14 -19 16 Q-16 30 -9 32 Q-12 14 -11 -24Z" fill="@vet2H" stroke="@vet2O" stroke-width="0.8"/>`
        + `<path d="M15 -28 Q22 -14 18 14 Q15 27 8 30 Q11 12 11 -24Z" fill="@vet2" stroke="@vet2O" stroke-width="0.8"/>`
        + `<path d="M-17 6 L-19 16 L-15 14Z M-12 22 L-13 31 L-9 27Z M16 8 L18 17 L13 14Z" fill="@vet2O" opacity="0.7"/>`
        + `<path d="M-14 -26 Q0 -31 14 -26 L12 6 L10 33 Q0 37 -10 33 L-12 6Z" fill="@vet1" stroke="@vet1O" stroke-width="0.8"/>`
        + `<path d="M-12 -22 Q0 -26 12 -22 L10 4 L8 30 Q0 33 -8 30 L-10 4Z" fill="@vet1H" opacity="0.55"/>`
        + `<path d="M0 -25 Q1 0 0 32" fill="none" stroke="@vet1O" stroke-width="1.4"/>`
        + `<path d="M-3 -18 L3 -16 M-3 -10 L3 -8 M-3 -2 L3 0 M-3 6 L3 8 M-3 14 L3 16 M-3 22 L3 24" fill="none" stroke="@vet1O" stroke-width="0.9" opacity="0.8"/>`
        + `<path d="M-3 -18 L3 -8 M3 -16 L-3 -6 M-3 -2 L3 8 M3 0 L-3 10 M-3 14 L3 24 M3 16 L-3 26" fill="none" stroke="@metal" stroke-width="0.5" opacity="0.5"/>`
        + `<path d="M-14 -22 L11 16" stroke="@cuirO" stroke-width="3.2" stroke-linecap="round"/>`
        + `<path d="M-14 -22 L11 16" stroke="@vet1" stroke-width="1.2" opacity="0.6"/>`
        + `<path d="M-13 30 Q0 35 13 30 L13 26 Q0 31 -13 26Z" fill="@vet1O" stroke="@cuirO" stroke-width="0.8"/>`
        + `<rect x="-2" y="28.5" width="4" height="3.4" rx="0.6" fill="@metal" stroke="@metalO" stroke-width="0.4"/>`
        + `<path d="M5 29 Q11 28 12 33 Q12 39 6 40 Q3 40 3 35 Q3 30 5 29Z" fill="@vet1" stroke="@cuirO" stroke-width="0.7"/>`
        + `<path d="M-9 30 Q-13 31 -13 35 Q-12 39 -8 38 Q-6 37 -7 33Z" fill="@vet1" stroke="@cuirO" stroke-width="0.6"/></g>`,
      // DOS : la cape bleu-ardoise couvre tout le dos (capuchon retombé entre les épaules),
      // pli central, ourlet déchiqueté. Le justaucorps brun n'apparaît qu'au col et au bas.
      back: `<g stroke-linejoin="round">`
        + `<path d="M-15 -28 Q-22 -14 -19 16 Q-16 30 -9 33 Q0 36 9 33 Q16 30 19 16 Q22 -14 15 -28 Q0 -33 -15 -28Z" fill="@vet2" stroke="@vet2O" stroke-width="0.8"/>`
        + `<path d="M0 -30 Q1 0 0 34" fill="none" stroke="@vet2O" stroke-width="1.2"/>`
        + `<path d="M-19 16 L-16 24 L-13 18 L-10 30 L-7 22 L-3 33 L0 24 L3 33 L7 22 L10 30 L13 18 L16 24 L19 16" fill="none" stroke="@vet2O" stroke-width="0.8" opacity="0.7"/>`
        + `<path d="M-13 -27 Q0 -31 13 -27 L11 -20 Q0 -24 -11 -20Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M-9 28 Q0 31 9 28 L8 33 Q0 35 -8 33Z" fill="@vet1O" opacity="0.8"/></g>`,
      // PROFIL : justaucorps brun étroit (poitrine avancée +x) + cape bleu-ardoise qui pend
      // derrière (-x) + bord du baudrier + ceinture à bourse de hanche. Même perso de côté.
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-6 -28 Q-12 -14 -10 16 Q-8 30 -4 32 Q-7 12 -6 -24Z" fill="@vet2" stroke="@vet2O" stroke-width="0.8"/>`
        + `<path d="M-8 12 L-10 22 L-6 20Z" fill="@vet2O" opacity="0.7"/>`
        + `<path d="M-6 -26 Q4 -31 8 -26 Q9 -6 7 6 L6 33 Q0 37 -5 33 Q-7 6 -6 -26Z" fill="@vet1" stroke="@vet1O" stroke-width="0.8"/>`
        + `<path d="M-6 -26 Q-2 -28 0 -27 L-1 33 Q-4 35 -5 33 Q-7 6 -6 -26Z" fill="@vet1H" opacity="0.5"/>`
        + `<path d="M4.6 -24 Q5.6 4 4.6 30" fill="none" stroke="@vet1O" stroke-width="0.8" opacity="0.7"/>`
        + `<path d="M-5 -22 L7 14" stroke="@cuirO" stroke-width="3" stroke-linecap="round"/>`
        + `<path d="M-6 28 Q0 32 7 28 L7 24 Q0 28 -6 24Z" fill="@vet1O" stroke="@cuirO" stroke-width="0.7"/>`
        + `<path d="M4 30 Q9 29 10 34 Q10 40 5 40 Q3 40 3 35 Q3 31 4 30Z" fill="@vet1" stroke="@cuirO" stroke-width="0.7"/></g>`,
    },
    jambes: {
      front: `<g stroke-linejoin="round">`
        + `<path d="M-5 0 Q-6 16 -4.6 32 Q-2.4 33 0 33 Q2.4 33 4.6 32 Q6 16 5 0 Q0 -2 -5 0Z" fill="@vet2O" stroke="@vet2O" stroke-width="0.8"/>`
        + `<path d="M-5 6 Q0 8 5 6 M-4.6 13 Q0 15 4.6 13 M-4.4 20 Q0 22 4.4 20" fill="none" stroke="@vet1O" stroke-width="1.8" opacity="0.8" stroke-linecap="round"/>`
        + `<path d="M-4.8 31 Q0 33 4.8 31 L5.4 39 Q0 42 -5.4 39Z" fill="@cuirO" stroke="@cuirO" stroke-width="0.8"/>`
        + `<path d="M-5.4 38 Q0 41 5.4 38 L5 50 Q0 52 -5 50Z" fill="@cuir" stroke="@cuirO" stroke-width="0.8"/>`
        + `<path d="M-4.6 46 Q0 48 4.6 46" fill="none" stroke="@cuirO" stroke-width="1.2"/></g>`,
      back: `<g stroke-linejoin="round">`
        + `<path d="M-5 0 Q-6 16 -4.6 32 Q-2.4 33 0 33 Q2.4 33 4.6 32 Q6 16 5 0 Q0 -2 -5 0Z" fill="@vet2O" stroke="@vet2O" stroke-width="0.8"/>`
        + `<path d="M-5 6 Q0 8 5 6 M-4.6 13 Q0 15 4.6 13 M-4.4 20 Q0 22 4.4 20" fill="none" stroke="@vet1O" stroke-width="1.8" opacity="0.7" stroke-linecap="round"/>`
        + `<path d="M-4.8 31 Q0 33 4.8 31 L5.4 39 Q0 42 -5.4 39Z" fill="@cuirO" stroke="@cuirO" stroke-width="0.8"/>`
        + `<path d="M-5.4 38 Q0 41 5.4 38 L5 50 Q0 52 -5 50Z" fill="@cuirO" stroke="@cuirO" stroke-width="0.8"/></g>`,
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-3.6 0 Q-4.6 16 -3.4 32 Q-1.2 33 1 33 Q3.4 33 3.8 32 Q4.6 16 4 0 Q0 -2 -3.6 0Z" fill="@vet2O" stroke="@vet2O" stroke-width="0.8"/>`
        + `<path d="M-3.6 6 Q1 8 4 6 M-3.4 13 Q1 15 3.8 13 M-3.2 20 Q1 22 3.6 20" fill="none" stroke="@vet1O" stroke-width="1.6" opacity="0.8" stroke-linecap="round"/>`
        + `<path d="M-3.6 31 Q1 33 4 31 L4.4 39 Q1 42 -3.8 39Z" fill="@cuirO" stroke="@cuirO" stroke-width="0.8"/>`
        + `<path d="M-3.8 38 Q1 41 4.4 38 L4.4 49 Q4 52 1 51.5 L-3.6 49Z" fill="@cuir" stroke="@cuirO" stroke-width="0.8"/>`
        + `<path d="M-3.4 46 Q1 48 4.2 46" fill="none" stroke="@cuirO" stroke-width="1.1"/></g>`,
    },
    bras: {
      front: `<g stroke-linejoin="round">`
        + `<path d="M-4 -1 Q-5.4 6 -4.4 14 L4.4 14 Q5.4 6 4 -1 Q0 -3 -4 -1Z" fill="@vet1H"/>`
        + `<path d="M-2.6 1 Q-3.6 7 -3 13 M2.6 1 Q3.6 7 3 13" fill="none" stroke="@vet1O" stroke-width="0.7" opacity="0.6"/>`
        + `<path d="M-4 14 Q0 16 4 14 L4.2 22 Q0 24 -4.2 22Z" fill="@vet1O" stroke="@cuirO" stroke-width="0.7"/>`
        + `<path d="M-3.6 16 Q0 18 3.6 16 M-3.8 19 Q0 21 3.8 19" fill="none" stroke="@cuirO" stroke-width="0.7" opacity="0.7"/>`
        + `<rect x="-1" y="17" width="2" height="2.4" rx="0.4" fill="@metal"/>`
        + `<path d="M-3.8 22 Q0 24 3.8 22 L3.4 30 Q0 31 -3.4 30Z" fill="@metalH" stroke="@vet1H" stroke-width="0.6"/></g>`,
      back: `<g stroke-linejoin="round">`
        + `<path d="M-4 -1 Q-5.4 6 -4.4 14 L4.4 14 Q5.4 6 4 -1 Q0 -3 -4 -1Z" fill="@vet1"/>`
        + `<path d="M0 1 Q0 7 0 13" fill="none" stroke="@vet1O" stroke-width="0.6" opacity="0.5"/>`
        + `<path d="M-4 14 Q0 16 4 14 L4.2 22 Q0 24 -4.2 22Z" fill="@vet1O" stroke="@cuirO" stroke-width="0.7"/>`
        + `<path d="M-3.8 22 Q0 24 3.8 22 L3.4 30 Q0 31 -3.4 30Z" fill="@metalH" stroke="@vet1H" stroke-width="0.6"/></g>`,
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-3 -1 Q-4.4 6 -3.4 14 L3.4 14 Q4.4 6 3 -1 Q0 -3 -3 -1Z" fill="@vet1H"/>`
        + `<path d="M0 1 Q-0.4 7 0 13" fill="none" stroke="@vet1O" stroke-width="0.7" opacity="0.6"/>`
        + `<path d="M-3.4 14 Q0 16 3.4 14 L3.6 22 Q0 24 -3.6 22Z" fill="@vet1O" stroke="@cuirO" stroke-width="0.7"/>`
        + `<path d="M-3.2 16 Q0 18 3.2 16 M-3.4 19 Q0 21 3.4 19" fill="none" stroke="@cuirO" stroke-width="0.7" opacity="0.7"/>`
        + `<path d="M-3.4 22 Q0 24 3.4 22 L3 30 Q0 31 -3 30Z" fill="@metalH" stroke="@vet1H" stroke-width="0.6"/></g>`,
    },
    // Capuchon brun (@cuir) relevé + ourlet (@vet1) + fermail d'acier sur le côté.
    tete: {
      front: `<g stroke-linejoin="round">`
        + `<path d="M-10 -1 Q-10 -14 0 -16 Q10 -14 10 -1 Q5 -4 0 -4 Q-5 -4 -10 -1Z" fill="@cuir" stroke="@vet1O" stroke-width="0.9"/>`
        + `<path d="M-9 -2 Q-9 -12 0 -14 Q9 -12 9 -2 Q4 -5 0 -5 Q-4 -5 -9 -2Z" fill="@cuir" opacity="0.5"/>`
        + `<path d="M-10 -1 Q0 -5 10 -1 Q11 1.4 9.6 3.4 Q0 -0.6 -9.6 3.4 Q-11 1.4 -10 -1Z" fill="@vet1" stroke="@cuirO" stroke-width="0.8"/>`
        + `<path d="M-2 -14 Q0 -17 2 -14 Q1.4 -12 0 -12 Q-1.4 -12 -2 -14Z" fill="@vet1O" stroke="@cuirO" stroke-width="0.5"/>`
        + `<ellipse cx="4.4" cy="-3" rx="2.6" ry="2.2" fill="@metal" stroke="@metalO" stroke-width="0.7"/>`
        + `<ellipse cx="4.4" cy="-3" rx="1.4" ry="1.2" fill="@cuirO" stroke="@cuirO" stroke-width="0.4"/>`
        + `<circle cx="3.8" cy="-3.6" r="0.4" fill="@metalH" opacity="0.8"/></g>`,
      // DOS : capuchon brun de derrière, pointe au sommet, pli central, ourlet plus clair à la base.
      back: `<g stroke-linejoin="round">`
        + `<path d="M-10 0 Q-10 -15 0 -16 Q10 -15 10 0 Q0 4 -10 0Z" fill="@cuir" stroke="@vet1O" stroke-width="0.9"/>`
        + `<path d="M0 -16 Q1 -5 0 2" fill="none" stroke="@cuirO" stroke-width="0.7" opacity="0.6"/>`
        + `<path d="M-10 0 Q0 4 10 0 L9.6 2.6 Q0 6 -9.6 2.6Z" fill="@vet1" stroke="@cuirO" stroke-width="0.8"/></g>`,
      // PROFIL : capuchon brun de côté, ouverture qui dégage le visage (+x), pli arrière (-x),
      // ourlet (@vet1), fermail d'acier près de l'ouverture.
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-9 -1 Q-10 -14 -2 -16 Q6 -15 8 -4 Q4 -6 0 -5 Q-4 -4 -9 -1Z" fill="@cuir" stroke="@vet1O" stroke-width="0.9"/>`
        + `<path d="M-2 -15 Q-7 -9 -8 0" fill="none" stroke="@cuirO" stroke-width="0.7" opacity="0.6"/>`
        + `<path d="M-9 -1 Q0 -5 8 -3 Q8.6 -0.6 7.4 1.6 Q0 -1 -9.6 3.4 Q-10 1.4 -9 -1Z" fill="@vet1" stroke="@cuirO" stroke-width="0.8"/>`
        + `<ellipse cx="4" cy="-3.5" rx="2.2" ry="2" fill="@metal" stroke="@metalO" stroke-width="0.6"/>`
        + `<ellipse cx="4" cy="-3.5" rx="1.1" ry="1" fill="@cuirO"/></g>`,
    },
  },
  // Nonne : habit crème (@vet1), scapulaire/voile brun (@vet2) en plastron, pans de voile
  // pâle (@cheveux) sur les flancs, cordelière brune à boucle d'or, longue jupe d'habit
  // (@cuir) jusqu'aux pieds, guimpe/voile (@cheveux). Art DÉDIÉ {front, back, profile}.
  Nonne: {
    torse: {
      front: `<g stroke-linejoin="round">`
        + `<path d="M-15 -28 Q-22 -8 -19 20 L-12 22 Q-13 -4 -11 -25Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.7"/>`
        + `<path d="M15 -28 Q22 -8 19 20 L12 22 Q13 -4 11 -25Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.7"/>`
        + `<path d="M-14 -27 Q0 -31 14 -27 L13 6 L11 34 Q0 38 -11 34 L-13 6Z" fill="@vet1" stroke="@vet1O" stroke-width="0.8"/>`
        + `<path d="M-12 -25 Q-12 0 -10 24 M12 -25 Q12 0 10 24" fill="none" stroke="@vet1" stroke-width="0.7" opacity="0.6"/>`
        + `<path d="M-14 -27 Q0 -31 14 -27 Q15 -16 10 -6 Q0 -2 -10 -6 Q-15 -16 -14 -27Z" fill="@vet2O" stroke="@vet2O" stroke-width="0.9"/>`
        + `<path d="M-13 -25 Q0 -29 13 -25 Q14 -17 9 -9" fill="none" stroke="@vet2" stroke-width="0.8" opacity="0.7"/>`
        + `<path d="M-9 -7 Q0 -3 9 -7 L8 -3 Q0 1 -8 -3Z" fill="@vet2" opacity="0.6"/>`
        + `<path d="M-11 16 Q0 19 11 16 L11.5 23 Q0 26 -11.5 23Z" fill="@vet2O" stroke="@vet2O" stroke-width="0.8"/>`
        + `<rect x="-2.4" y="17.4" width="4.8" height="4.6" rx="0.6" fill="@metalH" stroke="@metal" stroke-width="0.5"/>`
        + `<circle cx="0" cy="19.7" r="1" fill="@metalO"/>`
        + `<path d="M-8 23 L-9 33 Q-8 35 -6.5 33 L-6 23Z" fill="@vet2" stroke="@vet2O" stroke-width="0.6"/>`
        + `<path d="M-7.5 32 L-8 36 L-6.5 36 L-6.5 32Z" fill="@metalH" opacity="0.85"/>`
        + `<path d="M6 23 Q7 30 6 36 Q4.5 37 4 34 L4.5 23Z" fill="@vet2" stroke="@vet2O" stroke-width="0.6"/>`
        + `<circle cx="5.2" cy="35" r="1.4" fill="#b9c0cc" stroke="#6a727f" stroke-width="0.5"/></g>`,
      // DOS : voile pâle (@cheveux) qui couvre tout le dos (pli central), bord du scapulaire
      // brun aux épaules, cordelière brune. Pas de boucle ni de rosaire (ils sont devant).
      back: `<g stroke-linejoin="round">`
        + `<path d="M-15 -28 Q-22 -8 -19 22 Q-12 26 0 27 Q12 26 19 22 Q22 -8 15 -28 Q0 -32 -15 -28Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.7"/>`
        + `<path d="M0 -30 Q1 0 0 27" fill="none" stroke="@cheveuxO" stroke-width="1"/>`
        + `<path d="M-14 -27 Q0 -31 14 -27 Q15 -16 10 -7 Q0 -3 -10 -7 Q-15 -16 -14 -27Z" fill="@vet2O" stroke="@vet2O" stroke-width="0.9"/>`
        + `<path d="M-13 -25 Q0 -29 13 -25" fill="none" stroke="@vet2" stroke-width="0.7" opacity="0.6"/>`
        + `<path d="M-11 16 Q0 19 11 16 L11.5 23 Q0 26 -11.5 23Z" fill="@vet2O" stroke="@vet2O" stroke-width="0.8"/></g>`,
      // PROFIL : habit crème étroit + scapulaire brun de côté (pan avant +x, pan arrière -x) +
      // voile pâle le long du dos + cordelière à boucle. Lit la même religieuse de côté.
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-7 -28 Q-12 -8 -10 22 L-5 24 Q-6 -4 -5 -25Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.7"/>`
        + `<path d="M-5 -27 Q4 -31 8 -26 Q9 6 7 34 Q0 38 -4 34 Q-6 6 -5 -27Z" fill="@vet1" stroke="@vet1O" stroke-width="0.8"/>`
        + `<path d="M4.6 -24 Q5.6 4 4.6 30" fill="none" stroke="@vet1" stroke-width="0.7" opacity="0.6"/>`
        + `<path d="M-5 -27 Q4 -31 8 -26 Q9 -16 5 -7 Q0 -4 -5 -7 Q-6 -16 -5 -27Z" fill="@vet2O" stroke="@vet2O" stroke-width="0.9"/>`
        + `<path d="M-5 16 Q1 19 7 16 L7.4 23 Q1 26 -5 23Z" fill="@vet2O" stroke="@vet2O" stroke-width="0.8"/>`
        + `<rect x="2.6" y="17.4" width="4.4" height="4.4" rx="0.6" fill="@metalH" stroke="@metal" stroke-width="0.5"/>`
        + `<path d="M4 23 Q5 30 4 36 Q2.6 37 2.2 34 L2.6 23Z" fill="@vet2" stroke="@vet2O" stroke-width="0.6"/></g>`,
    },
    jambes: {
      front: `<g stroke-linejoin="round">`
        + `<path d="M-5 0 Q-7 18 -7 38 Q-7 47 -6 50 L6 50 Q7 47 7 38 Q7 18 5 0Z" fill="@cuir" stroke="@cuirO" stroke-width="0.9"/>`
        + `<path d="M-4 2 Q-6 22 -5.6 48 M4 2 Q6 22 5.6 48 M0 1 Q0 24 0 49" fill="none" stroke="@cuir" stroke-width="0.8" opacity="0.6"/>`
        + `<path d="M-6 44 Q0 41 6 44 L6 50 Q0 52 -6 50Z" fill="@cuirO" stroke="@cuirO" stroke-width="0.8"/></g>`,
      // DOS : revers de la longue jupe (mêmes plis, plus sombre), ourlet bas.
      back: `<g stroke-linejoin="round">`
        + `<path d="M-5 0 Q-7 18 -7 38 Q-7 47 -6 50 L6 50 Q7 47 7 38 Q7 18 5 0Z" fill="@cuirO" stroke="@cuirO" stroke-width="0.9"/>`
        + `<path d="M-4 2 Q-6 22 -5.6 48 M4 2 Q6 22 5.6 48 M0 1 Q0 24 0 49" fill="none" stroke="@cuir" stroke-width="0.8" opacity="0.5"/>`
        + `<path d="M-6 44 Q0 41 6 44 L6 50 Q0 52 -6 50Z" fill="@cuirO" stroke="@cuirO" stroke-width="0.8"/></g>`,
      // PROFIL : jupe longue de côté (un peu fuselée), plis verticaux, ourlet.
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-4.4 0 Q-6 18 -5.6 38 Q-5.6 47 -4.6 50 L5 50 Q6 47 5.6 38 Q5.6 18 4.4 0Z" fill="@cuir" stroke="@cuirO" stroke-width="0.9"/>`
        + `<path d="M-2.6 2 Q-4 22 -3.6 48 M2.6 2 Q4 22 3.6 48 M0 1 Q-0.4 24 0 49" fill="none" stroke="@cuir" stroke-width="0.8" opacity="0.6"/>`
        + `<path d="M-4.6 44 Q0 41 5 44 L5 50 Q0 52 -4.6 50Z" fill="@cuirO" stroke="@cuirO" stroke-width="0.8"/></g>`,
    },
    bras: {
      front: `<g stroke-linejoin="round">`
        + `<path d="M-5 -1 Q-7 8 -5.4 20 Q0 22 5.4 20 Q7 8 5 -1 Q0 -3 -5 -1Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M-3.4 1 Q-4.6 10 -3.4 19 M3.4 1 Q4.6 10 3.4 19" fill="none" stroke="@vet1" stroke-width="0.6" opacity="0.6"/>`
        + `<path d="M-5 -2 Q0 -5 5 -2 Q6 3 4.4 7 Q0 4 -4.4 7 Q-6 3 -5 -2Z" fill="@vet2O" stroke="@vet2O" stroke-width="0.7"/>`
        + `<path d="M-4.6 20 Q0 22 4.6 20 L4.2 30 Q0 31 -4.2 30Z" fill="@vet2O" stroke="@cuirO" stroke-width="0.6"/></g>`,
      back: `<g stroke-linejoin="round">`
        + `<path d="M-5 -1 Q-7 8 -5.4 20 Q0 22 5.4 20 Q7 8 5 -1 Q0 -3 -5 -1Z" fill="@vet1O" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M0 1 Q0 10 0 19" fill="none" stroke="@vet1" stroke-width="0.6" opacity="0.5"/>`
        + `<path d="M-5 -2 Q0 -5 5 -2 Q6 3 4.4 7 Q0 4 -4.4 7 Q-6 3 -5 -2Z" fill="@vet2O" stroke="@vet2O" stroke-width="0.7"/>`
        + `<path d="M-4.6 20 Q0 22 4.6 20 L4.2 30 Q0 31 -4.2 30Z" fill="@vet2O" stroke="@cuirO" stroke-width="0.6"/></g>`,
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-4 -1 Q-5.6 8 -4.4 20 Q0 22 4.4 20 Q5.6 8 4 -1 Q0 -3 -4 -1Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M0 1 Q-0.4 10 0 19" fill="none" stroke="@vet1" stroke-width="0.6" opacity="0.6"/>`
        + `<path d="M-4 -2 Q0 -5 4.4 -2 Q5.4 3 4 7 Q0 4 -4 7 Q-5 3 -4 -2Z" fill="@vet2O" stroke="@vet2O" stroke-width="0.7"/>`
        + `<path d="M-4 20 Q0 22 4 20 L3.6 30 Q0 31 -3.6 30Z" fill="@vet2O" stroke="@cuirO" stroke-width="0.6"/></g>`,
    },
    // Guimpe / voile : coiffe pâle (@cheveuxH) couvrant le crâne, pans (@cheveux) encadrant.
    tete: {
      front: `<g stroke-linejoin="round">`
        + `<path d="M-9 -2 Q-13 -6 -12 4 L-10 5 Q-10 -2 -8 -3Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.6"/>`
        + `<path d="M9 -2 Q13 -6 12 4 L10 5 Q10 -2 8 -3Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.6"/>`
        + `<path d="M-9.5 -4 Q0 -18 9.5 -4 Q10 0 8.5 3 Q4 -1 0 -1 Q-4 -1 -8.5 3 Q-10 0 -9.5 -4Z" fill="@cheveuxH" stroke="@cheveuxO" stroke-width="0.7"/>`
        + `<path d="M-8.5 -4.5 Q0 -16 8.5 -4.5" fill="none" stroke="@cheveuxH" stroke-width="0.8" opacity="0.7"/>`
        + `<path d="M-7.5 -2 Q0 -12 7.5 -2 Q7 1 6 3 Q0 0 -6 3 Q-7 1 -7.5 -2Z" fill="@cheveuxH" opacity="0.55"/></g>`,
      // DOS : voile pâle qui couvre tout le crâne et descend sur la nuque ; pans latéraux.
      back: `<g stroke-linejoin="round">`
        + `<path d="M-9 -2 Q-13 -6 -12 6 L-9 7 Q-9 -1 -8 -3Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.6"/>`
        + `<path d="M9 -2 Q13 -6 12 6 L9 7 Q9 -1 8 -3Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.6"/>`
        + `<path d="M-9.5 -4 Q0 -18 9.5 -4 Q10 8 7 14 Q0 17 -7 14 Q-10 8 -9.5 -4Z" fill="@cheveuxH" stroke="@cheveuxO" stroke-width="0.7"/>`
        + `<path d="M0 -15 Q1 0 0 13" fill="none" stroke="@cheveuxO" stroke-width="0.6" opacity="0.5"/></g>`,
      // PROFIL : voile de côté couvrant le crâne et descendant sur la nuque (-x) ; l'ourlet du
      // voile dégage le visage vers l'avant (+x) ; pan latéral.
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-9 -2 Q-13 -6 -12 6 L-9 7 Q-9 -1 -8 -3Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.6"/>`
        + `<path d="M-9.5 -4 Q-2 -18 7 -6 Q8 0 6.5 3 Q3 -1 0 -1 Q-5 -2 -8.5 3 Q-10 6 -9.5 -4Z" fill="@cheveuxH" stroke="@cheveuxO" stroke-width="0.7"/>`
        + `<path d="M-9.5 -4 Q-10 8 -7 14 Q-3 16 0 14 Q-5 12 -6 4 Q-7 -2 -9.5 -4Z" fill="@cheveuxH" opacity="0.7"/>`
        + `<path d="M-2 -15 Q-7 -8 -8.5 0" fill="none" stroke="@cheveuxO" stroke-width="0.6" opacity="0.55"/></g>`,
    },
  },
  // Mendiant : tunique en haillons (g_rag = @vet1) à ourlet déchiqueté + corde à la taille +
  // pièce rapportée ; jambes en bandelettes croisées (@vet2) + pied nu ; bras nu (@peau) à
  // lambeau de manche. Tête nue (pas d'override → cheveux cosmétiques). Art DÉDIÉ.
  Mendiant: {
    torse: {
      front: `<defs><linearGradient id="g_rag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="@vet1H"/><stop offset="0.55" stop-color="@vet1"/><stop offset="1" stop-color="@vet1O"/></linearGradient></defs>`
        + `<path d="M-13 -27 Q-7 -30 -1 -30 Q6 -31 13 -27 L12 -2 L13 12 L11 20 L12 27 L8 22 L9 31 L4 25 L3 33 L-1 26 L-2 34 L-6 27 L-7 32 L-10 24 L-9 30 L-12 22 L-11 9 L-13 -4 Z" fill="url(#g_rag)" stroke="@vet1O" stroke-width="0.6"/>`
        + `<path d="M-13 -27 Q-7 -30 -1 -30 Q6 -31 13 -27 L9 -24 Q2 -27 -4 -25 Q-9 -24 -13 -22 Z" fill="@vet1" opacity="0.7"/>`
        + `<path d="M2 -29 Q7 -22 5 -14" fill="none" stroke="@vet1O" stroke-width="0.8" opacity="0.6"/>`
        + `<path d="M-6 -8 Q-3 -4 -6 0 Q-9 -3 -6 -8 Z" fill="@vet1O"/><path d="M5 4 Q8 8 4 11 Q2 7 5 4 Z" fill="@vet1O"/>`
        + `<path d="M-10 6 L-3 5 L-3 14 L-11 15 Z" fill="@vet2H" opacity="0.85" stroke="@vet1O" stroke-width="0.5" stroke-dasharray="1.4 1.2"/>`
        + `<path d="M-12 2 Q0 7 12 2" fill="none" stroke="@vet1O" stroke-width="2.2"/>`
        + `<path d="M-1 3 L-3 12 M0 4 L3 11" stroke="@vet1O" stroke-width="1.6" fill="none"/>`
        + `<path d="M-9 16 Q-4 22 -10 24 Z" fill="@vet1O" opacity="0.5"/>`
        + `<path d="M6 -18 Q10 -10 8 -2" fill="none" stroke="@vet1" stroke-width="1.4" opacity="0.4"/>`,
      // DOS : dos de la tunique en haillons — même ourlet déchiqueté, corde à la taille, une
      // grande déchirure dans le dos (épaule découverte) ; pas de col ni de pièce devant.
      back: `<defs><linearGradient id="g_rag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="@vet1H"/><stop offset="0.55" stop-color="@vet1"/><stop offset="1" stop-color="@vet1O"/></linearGradient></defs>`
        + `<path d="M-13 -27 Q0 -31 13 -27 L12 -2 L13 12 L11 20 L12 27 L8 22 L9 31 L4 25 L3 33 L-1 26 L-2 34 L-6 27 L-7 32 L-10 24 L-9 30 L-12 22 L-11 9 L-13 -4 Z" fill="url(#g_rag)" stroke="@vet1O" stroke-width="0.6"/>`
        + `<path d="M-13 -27 Q0 -31 13 -27 L9 -24 Q0 -27 -9 -24 Z" fill="@vet1O" opacity="0.7"/>`
        + `<path d="M4 -22 Q9 -16 6 -6 Q3 -12 4 -22 Z" fill="@vet1O"/>`
        + `<path d="M-12 2 Q0 7 12 2" fill="none" stroke="@vet1O" stroke-width="2.2"/>`
        + `<path d="M-7 -10 Q-4 -2 -8 4" fill="none" stroke="@vet1O" stroke-width="0.7" opacity="0.5"/>`,
      // PROFIL : tunique en haillons étroite (poitrine avancée +x), ourlet déchiqueté de côté,
      // corde, lambeau de manche. Le même mendiant de côté.
      profile: `<defs><linearGradient id="g_rag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="@vet1H"/><stop offset="0.55" stop-color="@vet1"/><stop offset="1" stop-color="@vet1O"/></linearGradient></defs>`
        + `<path d="M-6 -28 Q4 -31 8 -27 L8 -2 L9 12 L7 22 L8 30 L5 24 L5.5 33 L1.5 26 L1 34 L-3 26 L-4 32 L-6 24 L-5 9 L-6 -4 Z" fill="url(#g_rag)" stroke="@vet1O" stroke-width="0.6"/>`
        + `<path d="M-6 -28 Q2 -30 6 -28 L5 -24 Q0 -26 -4 -24 Z" fill="@vet1" opacity="0.6"/>`
        + `<path d="M3 -8 Q6 -4 3 0 Q1 -3 3 -8 Z" fill="@vet1O"/>`
        + `<path d="M-6 2 Q1 6 8 2" fill="none" stroke="@vet1O" stroke-width="2"/>`
        + `<path d="M-5 16 Q-1 21 -6 23 Z" fill="@vet1O" opacity="0.5"/>`,
    },
    jambes: {
      front: `<path d="M-4 0 L4 0 L3 18 L4 40 L3 50 L-3 50 L-4 40 L-3 18 Z" fill="@vet2"/>`
        + `<path d="M-4 20 L4 17 L4 22 L-4 25 Z" fill="@vet2" stroke="@vet1O" stroke-width="0.4"/>`
        + `<path d="M-4 27 L4 24 L4 29 L-4 32 Z" fill="@vet2O" stroke="@vet1O" stroke-width="0.4"/>`
        + `<path d="M-4 34 L4 31 L4 36 L-4 39 Z" fill="@vet2" stroke="@vet1O" stroke-width="0.4"/>`
        + `<path d="M-4 41 L4 38 L4 43 L-4 46 Z" fill="@vet2O" stroke="@vet1O" stroke-width="0.4"/>`
        + `<path d="M2 43 L5 50 L3 50 Z" fill="@vet2"/>`
        + `<path d="M-3 50 Q-4 53 0 53 Q5 53 4 50 Z" fill="@peau"/>`
        + `<path d="M-4 18 L-3 39" stroke="@vet1O" stroke-width="0.5" opacity="0.5"/>`,
      // DOS : même jambe en bandelettes (inclinaison inversée), talon nu.
      back: `<path d="M-4 0 L4 0 L3 18 L4 40 L3 50 L-3 50 L-4 40 L-3 18 Z" fill="@vet2O"/>`
        + `<path d="M-4 17 L4 20 L4 25 L-4 22 Z" fill="@vet2" stroke="@vet1O" stroke-width="0.4"/>`
        + `<path d="M-4 24 L4 27 L4 32 L-4 29 Z" fill="@vet2O" stroke="@vet1O" stroke-width="0.4"/>`
        + `<path d="M-4 31 L4 34 L4 39 L-4 36 Z" fill="@vet2" stroke="@vet1O" stroke-width="0.4"/>`
        + `<path d="M-4 38 L4 41 L4 46 L-4 43 Z" fill="@vet2O" stroke="@vet1O" stroke-width="0.4"/>`
        + `<path d="M-3 50 Q-3.6 53 0 53 Q4 53 3.4 50 Z" fill="@peau"/>`,
      // PROFIL : jambe maigre de côté en bandelettes + pied nu pointant vers l'avant (+x).
      profile: `<path d="M-3 0 L3.4 0 L2.6 18 L3.4 40 L2.6 50 L-2.4 50 L-3 40 L-2.4 18 Z" fill="@vet2"/>`
        + `<path d="M-3 20 L3.4 17 L3.4 22 L-3 25 Z" fill="@vet2" stroke="@vet1O" stroke-width="0.4"/>`
        + `<path d="M-3 27 L3.4 24 L3.4 29 L-3 32 Z" fill="@vet2O" stroke="@vet1O" stroke-width="0.4"/>`
        + `<path d="M-3 34 L3.4 31 L3.4 36 L-3 39 Z" fill="@vet2" stroke="@vet1O" stroke-width="0.4"/>`
        + `<path d="M-3 41 L3.4 38 L3.4 43 L-3 46 Z" fill="@vet2O" stroke="@vet1O" stroke-width="0.4"/>`
        + `<path d="M-2.4 50 Q-3 53 0 53 L7 53 Q9 53 7.6 50 L3 50 Z" fill="@peau"/>`,
    },
    bras: {
      front: `<rect x="-3" y="-2" width="6" height="34" rx="3" fill="@peau"/>`
        + `<path d="M-4 -2 Q0 -4 4 -2 L4 9 L2 6 L1 12 L-1 7 L-3 13 L-4 7 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.5"/>`
        + `<path d="M-3 1 Q0 0 3 1" fill="none" stroke="@vet1" stroke-width="0.8" opacity="0.6"/>`
        + `<path d="M2 18 Q3 24 1 30" fill="none" stroke="@vet2" stroke-width="1.2" opacity="0.5"/>`,
      back: `<rect x="-3" y="-2" width="6" height="34" rx="3" fill="@peauO"/>`
        + `<path d="M-4 -2 Q0 -4 4 -2 L4 9 L2 6 L1 12 L-1 7 L-3 13 L-4 7 Z" fill="@vet1O" stroke="@vet1O" stroke-width="0.5"/>`
        + `<path d="M-2 18 Q-3 24 -1 30" fill="none" stroke="@vet2" stroke-width="1.2" opacity="0.4"/>`,
      profile: `<rect x="-2.6" y="-2" width="5.2" height="34" rx="2.6" fill="@peau"/>`
        + `<path d="M-3.4 -2 Q0 -4 3.4 -2 L3.4 9 L1.6 6 L1 12 L-1 7 L-2.6 13 L-3.4 7 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.5"/>`
        + `<path d="M1.6 18 Q2.6 24 0.6 30" fill="none" stroke="@vet2" stroke-width="1.2" opacity="0.5"/>`,
    },
  },
  // Artisan : tablier de cuir (@cuir) sur tunique brune (@vet1), bretelles + rivets, ceinture
  // à boucle d'acier ; pantalon de cuir sombre (@cuirO) ; manches retroussées (@peau + bande
  // de cuir) ; calotte d'ouvrier à bandeau d'acier. Art DÉDIÉ {front, back, profile}.
  Artisan: {
    torse: {
      front: `<g><path d="M-14 -28 Q0 -33 14 -28 L13 -8 L11 30 Q0 34 -11 30 L-13 -8 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.8"/>`
        + `<path d="M-14 -28 Q-7 -30 -2 -29 L-6 -8 L-12 -10 Z" fill="@vet1H" opacity="0.6"/>`
        + `<path d="M-9 -28 Q0 -23 9 -28 L9 -22 Q0 -17 -9 -22 Z" fill="@peau" opacity="0.5"/>`
        + `<path d="M-8 -29 Q0 -26 8 -29 L9 -10 L8 32 Q0 36 -8 32 L-9 -10 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.9"/>`
        + `<path d="M-8 -10 Q0 -6 8 -10 L7 26 Q0 30 -7 26 Z" fill="@vet1" opacity="0.55"/>`
        + `<path d="M-7 -27 L-3 -2 M7 -27 L3 -2" stroke="@peau" stroke-width="1.6" fill="none" opacity="0.85"/>`
        + `<circle cx="-5" cy="-23" r="1.3" fill="@metalH"/><circle cx="5" cy="-23" r="1.3" fill="@metalH"/>`
        + `<rect x="-9" y="2" width="18" height="3.4" rx="1" fill="@vet1O"/>`
        + `<rect x="-2.4" y="1.4" width="4.8" height="4.6" rx="0.6" fill="url(#g_steel)" stroke="@metal" stroke-width="0.5"/>`
        + `<path d="M-8 12 L8 12 M-8 22 L8 22" stroke="@vet1O" stroke-width="0.6" opacity="0.5"/></g>`,
      // DOS : dos de la tunique brune, bretelles du tablier qui se croisent dans le dos
      // (rivetées), ceinture. Le tablier de cuir ne couvre que le devant → ici la tunique.
      back: `<g><path d="M-13 -28 Q0 -32 13 -28 L12 -8 L11 32 Q0 36 -11 32 L-12 -8 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.9"/>`
        + `<path d="M0 -29 Q1 0 0 34" fill="none" stroke="@vet1O" stroke-width="0.7" opacity="0.6"/>`
        + `<path d="M-9 -27 L7 4 M9 -27 L-7 4" stroke="@peau" stroke-width="1.6" fill="none" opacity="0.85"/>`
        + `<circle cx="-7" cy="-24" r="1.3" fill="@metalH"/><circle cx="7" cy="-24" r="1.3" fill="@metalH"/>`
        + `<rect x="-10" y="2" width="20" height="3.4" rx="1" fill="@vet1O"/>`
        + `<path d="M-8 14 L8 14 M-8 24 L8 24" stroke="@vet1O" stroke-width="0.6" opacity="0.5"/></g>`,
      // PROFIL : tablier de cuir de côté (bavette avant +x) sur tunique brune, bretelle sur
      // l'épaule, bord de la ceinture à boucle. Même artisan de côté.
      profile: `<g><path d="M-5 -28 Q4 -32 7 -28 L7 -8 L7 32 Q0 36 -5 32 L-5 -8 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.9"/>`
        + `<path d="M-1 -27 Q6 -29 8 -26 L8.5 4 L8 28 L2 28 L2 -10 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.8"/>`
        + `<path d="M4 -26 Q5 4 4 26" fill="none" stroke="@cuirO" stroke-width="0.6" opacity="0.5"/>`
        + `<path d="M3 -27 L6 -2" stroke="@peau" stroke-width="1.6" fill="none" opacity="0.85"/>`
        + `<circle cx="3.5" cy="-23" r="1.3" fill="@metalH"/>`
        + `<rect x="-5" y="2" width="13.5" height="3.4" rx="1" fill="@vet1O"/>`
        + `<rect x="4.4" y="1.4" width="4" height="4.6" rx="0.6" fill="url(#g_steel)" stroke="@metal" stroke-width="0.5"/></g>`,
    },
    jambes: {
      front: `<g><rect x="-4.6" y="0" width="9.2" height="50" rx="3" fill="@cuirO"/>`
        + `<path d="M-4.6 0 Q-1 2 -1 0 L-1 50 L-4.6 50 Z" fill="@cuirO" opacity="0.7"/>`
        + `<path d="M2.6 1 L2.6 48" stroke="@cuirO" stroke-width="0.8" opacity="0.6"/>`
        + `<rect x="-4.6" y="40" width="9.2" height="10" rx="2" fill="@cuirO"/>`
        + `<path d="M-4.6 40 L4.6 40" stroke="@cuirO" stroke-width="0.8"/></g>`,
      back: `<g><rect x="-4.6" y="0" width="9.2" height="50" rx="3" fill="@cuirO"/>`
        + `<path d="M0 1 L0 48" stroke="@cuirO" stroke-width="0.8" opacity="0.5"/>`
        + `<rect x="-4.6" y="40" width="9.2" height="10" rx="2" fill="@cuirO"/>`
        + `<path d="M-4.6 40 L4.6 40" stroke="@cuirO" stroke-width="0.8"/></g>`,
      profile: `<g><rect x="-3.4" y="0" width="7.4" height="50" rx="3" fill="@cuirO"/>`
        + `<path d="M0 1 L0 48" stroke="@cuirO" stroke-width="0.8" opacity="0.5"/>`
        + `<rect x="-3.4" y="40" width="7.4" height="10" rx="2" fill="@cuirO"/>`
        + `<path d="M-3.4 40 L4 40" stroke="@cuirO" stroke-width="0.8"/></g>`,
    },
    bras: {
      front: `<g><rect x="-3.4" y="-2" width="6.8" height="6" rx="3" fill="@peau" opacity="0.55"/>`
        + `<path d="M-3.2 3 Q0 5 3.2 3 L3 9 Q0 11 -3 9 Z" fill="@cuirO" stroke="@cuirO" stroke-width="0.6"/>`
        + `<rect x="-3.3" y="4.4" width="6.6" height="1.2" fill="url(#g_steel)" opacity="0.85"/>`
        + `<path d="M-3.2 18 Q0 16.5 3.2 18 L3.2 28 Q0 30 -3.2 28 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M-3.2 21 L3.2 21 M-3.2 24.5 L3.2 24.5" stroke="@vet1O" stroke-width="0.6" opacity="0.7"/>`
        + `<circle cx="0" cy="19.4" r="0.8" fill="@metalH"/></g>`,
      back: `<g><rect x="-3.4" y="-2" width="6.8" height="6" rx="3" fill="@peauO" opacity="0.6"/>`
        + `<path d="M-3.2 3 Q0 5 3.2 3 L3 9 Q0 11 -3 9 Z" fill="@cuirO" stroke="@cuirO" stroke-width="0.6"/>`
        + `<path d="M-3.2 18 Q0 16.5 3.2 18 L3.2 28 Q0 30 -3.2 28 Z" fill="@vet1O" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M0 19 L0 27" stroke="@vet1O" stroke-width="0.6" opacity="0.5"/></g>`,
      profile: `<g><rect x="-2.8" y="-2" width="5.6" height="6" rx="2.8" fill="@peau" opacity="0.55"/>`
        + `<path d="M-2.8 3 Q0 5 2.8 3 L2.6 9 Q0 11 -2.6 9 Z" fill="@cuirO" stroke="@cuirO" stroke-width="0.6"/>`
        + `<rect x="-2.8" y="4.4" width="5.6" height="1.2" fill="url(#g_steel)" opacity="0.85"/>`
        + `<path d="M-2.8 18 Q0 16.5 2.8 18 L2.8 28 Q0 30 -2.8 28 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M-2.8 21 L2.8 21 M-2.8 24.5 L2.8 24.5" stroke="@vet1O" stroke-width="0.6" opacity="0.7"/></g>`,
    },
    // Calotte d'ouvrier brune cerclée d'un bandeau d'acier riveté.
    tete: {
      front: `<g><path d="M-9 -3 Q0 -15 9 -3 Q4 -6 0 -6 Q-4 -6 -9 -3 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M-9 -3 Q0 -6 9 -3 L9 -0.5 Q0 2 -9 -0.5 Z" fill="url(#g_steel)" stroke="@metal" stroke-width="0.6"/>`
        + `<circle cx="-5" cy="-1" r="0.9" fill="@metalH"/><circle cx="0" cy="-0.4" r="0.9" fill="@metalH"/><circle cx="5" cy="-1" r="0.9" fill="@metalH"/>`
        + `<path d="M-2 -12 Q0 -15 2 -12" stroke="@peau" stroke-width="1" fill="none" opacity="0.7"/></g>`,
      back: `<g><path d="M-9 -3 Q0 -15 9 -3 Q4 -6 0 -6 Q-4 -6 -9 -3 Z" fill="@vet1O" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M-9 -3 Q0 -6 9 -3 L9 -0.5 Q0 2 -9 -0.5 Z" fill="url(#g_steel)" stroke="@metal" stroke-width="0.6"/>`
        + `<circle cx="-5" cy="-1" r="0.9" fill="@metalH"/><circle cx="0" cy="-0.4" r="0.9" fill="@metalH"/><circle cx="5" cy="-1" r="0.9" fill="@metalH"/></g>`,
      // PROFIL : calotte de côté + bandeau d'acier à l'ourlet, un rivet visible.
      profile: `<g><path d="M-8.5 -3 Q-2 -15 8 -3 Q3 -6 -1 -6 Q-5 -6 -8.5 -3 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M-8.5 -3 Q0 -6 8 -3 L8 -0.5 Q0 2 -8.5 -0.5 Z" fill="url(#g_steel)" stroke="@metal" stroke-width="0.6"/>`
        + `<circle cx="-2" cy="-1" r="0.9" fill="@metalH"/><circle cx="3" cy="-1" r="0.9" fill="@metalH"/></g>`,
    },
  },
  // Bourgeois : doublet matelassé vert-olive (g_hVest), tablier ocre (@vet2), large ceinture
  // de cuir + médaillon d'or, épaulière de cuir cloutée, bourse à la hanche ; chausses vertes
  // + hautes bottes de cuir ; toque de feutre à plumes. Art DÉDIÉ {front, back, profile}.
  Bourgeois: {
    torse: {
      front: `<path d="M-14 -28 Q0 -33 14 -28 L13 2 L11 30 Q0 35 -11 30 L-13 2 Z" fill="url(#g_hVest)" stroke="@vet1O" stroke-width="0.8"/>`
        + `<path d="M-11 -26 Q0 -30 11 -26" fill="none" stroke="@vet1H" stroke-width="0.8" opacity="0.7"/>`
        + `<path d="M-9 -18 Q0 -22 9 -18 M-9 -8 Q0 -12 9 -8 M-9 2 Q0 -2 9 2" fill="none" stroke="@vet1O" stroke-width="0.7" opacity="0.6"/>`
        + `<path d="M-10 -2 Q0 1 10 -2 L9 24 Q0 31 -9 24 Z" fill="@vet2" stroke="@vet2O" stroke-width="0.8"/>`
        + `<path d="M-9 4 Q0 7 9 4 M-8 12 Q0 15 8 12" fill="none" stroke="@vet2O" stroke-width="0.6" opacity="0.7"/>`
        + `<rect x="-12" y="4" width="24" height="6" rx="1.5" fill="@cuir" stroke="@cuirO" stroke-width="0.7"/>`
        + `<rect x="-3" y="4.5" width="6" height="5" rx="1" fill="@metal" stroke="@metalO" stroke-width="0.6"/>`
        + `<path d="M-14 -27 Q-19 -24 -18 -16 Q-17 -10 -12 -8 L-9 -10 Q-13 -14 -12 -22 Q-12 -26 -14 -27Z" fill="@cuir" stroke="@cuirO" stroke-width="0.8"/>`
        + `<circle cx="-15.5" cy="-22" r="0.7" fill="@metalH"/><circle cx="-13.5" cy="-18" r="0.7" fill="@metalH"/><circle cx="-15" cy="-13" r="0.7" fill="@metalH"/>`
        + `<circle cx="0" cy="-12" r="2.2" fill="@metal" stroke="@metalO" stroke-width="0.6"/><circle cx="0" cy="-12" r="0.9" fill="@metalO"/>`
        + `<path d="M9 8 Q14 10 15 18 L12 26 L8 24 Q11 16 9 9Z" fill="@cuir" stroke="@cuirO" stroke-width="0.6" opacity="0.95"/>`
        + `<rect x="10" y="12" width="3" height="7" rx="0.8" fill="@cuirO"/>`,
      // DOS : dos du doublet olive (pli central) + tablier ocre qui pend + ceinture de cuir +
      // épaulière de cuir cloutée (épaule gauche, vue de derrière). Pas de médaillon (devant).
      back: `<path d="M-14 -28 Q0 -33 14 -28 L13 2 L11 30 Q0 35 -11 30 L-13 2 Z" fill="url(#g_hVest)" stroke="@vet1O" stroke-width="0.8"/>`
        + `<path d="M0 -29 Q1 2 0 32" fill="none" stroke="@vet1O" stroke-width="0.8" opacity="0.6"/>`
        + `<path d="M-10 -20 Q0 -16 10 -20 M-10 -8 Q0 -4 10 -8" fill="none" stroke="@vet1O" stroke-width="0.7" opacity="0.55"/>`
        + `<path d="M-10 -2 Q0 1 10 -2 L9 24 Q0 31 -9 24 Z" fill="@vet2O" stroke="@vet2O" stroke-width="0.8"/>`
        + `<path d="M-8 6 Q0 9 8 6 M-7 14 Q0 17 7 14" fill="none" stroke="@vet2O" stroke-width="0.6" opacity="0.6"/>`
        + `<rect x="-12" y="4" width="24" height="6" rx="1.5" fill="@cuir" stroke="@cuirO" stroke-width="0.7"/>`
        + `<path d="M-14 -27 Q-19 -24 -18 -16 Q-17 -10 -12 -8 L-9 -10 Q-13 -14 -12 -22 Q-12 -26 -14 -27Z" fill="@cuir" stroke="@cuirO" stroke-width="0.8"/>`
        + `<circle cx="-15.5" cy="-22" r="0.7" fill="@metalH"/><circle cx="-13.5" cy="-18" r="0.7" fill="@metalH"/><circle cx="-15" cy="-13" r="0.7" fill="@metalH"/>`,
      // PROFIL : doublet olive étroit (poitrine avancée +x) + tablier ocre + bord de ceinture +
      // médaillon sur la poitrine + bourse de hanche. Même bourgeois de côté.
      profile: `<path d="M-6 -28 Q4 -32 8 -28 Q9 -10 7 2 L6 30 Q0 35 -5 30 Q-7 -10 -6 -28 Z" fill="url(#g_hVest)" stroke="@vet1O" stroke-width="0.8"/>`
        + `<path d="M-4 -22 Q4 -24 7 -20 M-4 -10 Q4 -12 7 -8" fill="none" stroke="@vet1O" stroke-width="0.7" opacity="0.6"/>`
        + `<path d="M-5 -2 Q1 1 7 -2 L6 24 Q0 30 -5 24 Z" fill="@vet2" stroke="@vet2O" stroke-width="0.8"/>`
        + `<path d="M-5 4 Q1 7 7 4 M-5 12 Q1 15 6 12" fill="none" stroke="@vet2O" stroke-width="0.6" opacity="0.7"/>`
        + `<rect x="-6" y="4" width="13.5" height="6" rx="1.5" fill="@cuir" stroke="@cuirO" stroke-width="0.7"/>`
        + `<rect x="3.4" y="4.5" width="4" height="5" rx="1" fill="@metal" stroke="@metalO" stroke-width="0.6"/>`
        + `<circle cx="5" cy="-12" r="2" fill="@metal" stroke="@metalO" stroke-width="0.6"/><circle cx="5" cy="-12" r="0.8" fill="@metalO"/>`
        + `<path d="M-7 8 Q-12 10 -13 18 L-10 26 L-6 24 Q-9 16 -7 9Z" fill="@cuir" stroke="@cuirO" stroke-width="0.6"/>`,
    },
    jambes: {
      front: `<path d="M-4.5 0 L4.5 0 L4 18 L-4 18 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M-2 2 L-2.5 17 M2 2 L2.5 17" fill="none" stroke="@vet1O" stroke-width="0.6" opacity="0.6"/>`
        + `<path d="M-4 16 Q0 18 4 16 L4.5 44 Q0 50 -4.5 44 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.8"/>`
        + `<path d="M-4.2 16 Q0 19 4.2 16 L4.5 22 Q0 25 -4.5 22 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.7"/>`
        + `<path d="M-3.5 30 Q0 32 3.8 30" fill="none" stroke="@cuirO" stroke-width="0.6" opacity="0.7"/>`
        + `<path d="M-4.5 44 Q0 50 4.5 44 L5 49 Q0 51 -5 49 Z" fill="@cuirO"/>`,
      back: `<path d="M-4.5 0 L4.5 0 L4 18 L-4 18 Z" fill="@vet1O" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M0 2 L0 17" fill="none" stroke="@vet1O" stroke-width="0.6" opacity="0.5"/>`
        + `<path d="M-4 16 Q0 18 4 16 L4.5 44 Q0 50 -4.5 44 Z" fill="@cuirO" stroke="@cuirO" stroke-width="0.8"/>`
        + `<path d="M-4.2 16 Q0 19 4.2 16 L4.5 22 Q0 25 -4.5 22 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.7"/>`
        + `<path d="M-4.5 44 Q0 50 4.5 44 L5 49 Q0 51 -5 49 Z" fill="@cuirO"/>`,
      profile: `<path d="M-3.4 0 L3.8 0 L3.4 18 L-3 18 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M0 2 L0 17" fill="none" stroke="@vet1O" stroke-width="0.6" opacity="0.6"/>`
        + `<path d="M-3 16 Q1 18 4 16 L4.4 44 Q1 50 -3.4 44 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.8"/>`
        + `<path d="M-3.2 16 Q1 19 4.2 16 L4.4 22 Q1 25 -3.4 22 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.7"/>`
        + `<path d="M-3.4 44 Q1 50 4.6 44 L5 49 Q1 51 -3.8 49 Z" fill="@cuirO"/>`,
    },
    bras: {
      front: `<path d="M-4 -2 Q-7 6 -5 12 Q0 14 5 12 Q7 6 4 -2 Q0 -5 -4 -2Z" fill="url(#g_hVest)" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M-4 2 Q0 4 4 2 M-4.5 7 Q0 9 4.5 7" fill="none" stroke="@vet1O" stroke-width="0.6" opacity="0.6"/>`
        + `<path d="M-4 12 Q0 14 4 12 L3.5 32 Q0 34 -3.5 32 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.8"/>`
        + `<circle cx="-2.3" cy="16" r="0.6" fill="@metalH"/><circle cx="2.3" cy="16" r="0.6" fill="@metalH"/><circle cx="-2.1" cy="22" r="0.6" fill="@metalH"/><circle cx="2.1" cy="22" r="0.6" fill="@metalH"/><circle cx="-1.9" cy="28" r="0.6" fill="@metalH"/><circle cx="1.9" cy="28" r="0.6" fill="@metalH"/>`,
      back: `<path d="M-4 -2 Q-7 6 -5 12 Q0 14 5 12 Q7 6 4 -2 Q0 -5 -4 -2Z" fill="url(#g_hVest)" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M0 -3 Q0 5 0 13" fill="none" stroke="@vet1O" stroke-width="0.6" opacity="0.5"/>`
        + `<path d="M-4 12 Q0 14 4 12 L3.5 32 Q0 34 -3.5 32 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.8"/>`
        + `<circle cx="-2.1" cy="18" r="0.6" fill="@metalH"/><circle cx="2.1" cy="18" r="0.6" fill="@metalH"/><circle cx="-1.9" cy="26" r="0.6" fill="@metalH"/><circle cx="1.9" cy="26" r="0.6" fill="@metalH"/>`,
      profile: `<path d="M-3.4 -2 Q-5.6 6 -4 12 Q0 14 4 12 Q5.6 6 3.4 -2 Q0 -5 -3.4 -2Z" fill="url(#g_hVest)" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M-3.4 2 Q0 4 3.4 2 M-3.8 7 Q0 9 3.8 7" fill="none" stroke="@vet1O" stroke-width="0.6" opacity="0.6"/>`
        + `<path d="M-3.4 12 Q0 14 3.4 12 L3 32 Q0 34 -3 32 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.8"/>`
        + `<circle cx="-1.6" cy="16" r="0.6" fill="@metalH"/><circle cx="1.6" cy="16" r="0.6" fill="@metalH"/><circle cx="-1.4" cy="22" r="0.6" fill="@metalH"/><circle cx="1.4" cy="22" r="0.6" fill="@metalH"/><circle cx="0" cy="28" r="0.6" fill="@metalH"/>`,
    },
    // Toque de feutre ocre à bord, plumes (vet2/vet2H) sur le côté.
    tete: {
      front: `<g><path d="M-9 -1 Q-11 -13 0 -14 Q11 -13 9 -1 Q4 -4 0 -4 Q-5 -4 -9 -1Z" fill="@metal" stroke="@metalO" stroke-width="0.8"/>`
        + `<path d="M-8 -2 Q0 -10 8 -2" fill="none" stroke="@metalH" stroke-width="0.7" opacity="0.7"/>`
        + `<path d="M-9 -1 Q0 -5 9 -1 L9 1 Q0 -2 -9 1Z" fill="@metal" stroke="@metalO" stroke-width="0.6"/>`
        + `<circle cx="-7" cy="-3" r="1.3" fill="@metal" stroke="@metalO" stroke-width="0.4"/>`
        + `<path d="M-7 -3 Q-12 -8 -11 -16 Q-10 -13 -8 -11 Q-10 -7 -7 -3Z" fill="@vet2" stroke="@vet2O" stroke-width="0.5"/>`
        + `<path d="M-7 -3 Q-9 -10 -6 -17 Q-5 -13 -5 -10 Q-6 -7 -7 -3Z" fill="@vet2H" stroke="@vet2O" stroke-width="0.4"/></g>`,
      // DOS : toque de derrière, bord, plumes qui dépassent sur le côté gauche.
      back: `<g><path d="M-9 -1 Q-11 -13 0 -14 Q11 -13 9 -1 Q4 -4 0 -4 Q-5 -4 -9 -1Z" fill="@metal" stroke="@metalO" stroke-width="0.8"/>`
        + `<path d="M0 -13 Q1 -6 0 -3" fill="none" stroke="@metalO" stroke-width="0.6" opacity="0.6"/>`
        + `<path d="M-9 -1 Q0 -5 9 -1 L9 1 Q0 -2 -9 1Z" fill="@metal" stroke="@metalO" stroke-width="0.6"/>`
        + `<path d="M-8 -2 Q-12 -8 -11 -16 Q-10 -13 -8.5 -11 Q-10 -6 -8 -2Z" fill="@vet2" stroke="@vet2O" stroke-width="0.5"/></g>`,
      // PROFIL : toque de côté + bord, plumes vers l'arrière (-x).
      profile: `<g><path d="M-9 -1 Q-10 -13 1 -14 Q10 -13 8 -1 Q3 -4 -1 -4 Q-5 -4 -9 -1Z" fill="@metal" stroke="@metalO" stroke-width="0.8"/>`
        + `<path d="M-7 -2 Q0 -10 7 -2" fill="none" stroke="@metalH" stroke-width="0.7" opacity="0.7"/>`
        + `<path d="M-9 -1 Q0 -5 8 -1 L8 1 Q0 -2 -9 1Z" fill="@metal" stroke="@metalO" stroke-width="0.6"/>`
        + `<path d="M-7 -3 Q-13 -8 -12 -16 Q-11 -13 -9 -11 Q-11 -7 -7 -3Z" fill="@vet2" stroke="@vet2O" stroke-width="0.5"/>`
        + `<path d="M-7 -3 Q-10 -10 -7 -17 Q-6 -13 -6 -10 Q-7 -7 -7 -3Z" fill="@vet2H" stroke="@vet2O" stroke-width="0.4"/></g>`,
    },
  },
  // Agitateur : tunique bleu-ardoise (@vet1) à coutures, écharpe / besace en bandoulière
  // (@vet2H) en travers, liasses de tracts à la hanche, ceinture ; culotte de cuir + bottes ;
  // bonnet mou à plume d'oie (@metal). Art DÉDIÉ {front, back, profile}.
  Agitateur: {
    torse: {
      front: `<g><path d="M-15 -29 Q0 -34 15 -29 L13 6 L11 33 Q0 38 -11 33 L-13 6 Z" fill="@vet1" stroke="@vet1O" stroke-width="1"/>`
        + `<path d="M-15 -29 Q-9 -31 -6 -30 L-5 33 Q-9 35 -13 33 L-13 6 Z" fill="@vet1O" opacity="0.8"/>`
        + `<g stroke="@vet1O" stroke-width="0.8" opacity="0.7" fill="none"><path d="M-7 -26 L-6 32"/><path d="M0 -27 L0 35"/><path d="M7 -26 L6 32"/><path d="M-13 -12 Q0 -10 13 -12"/><path d="M-13 2 Q0 4 12 2"/><path d="M-12 18 Q0 20 11 18"/></g>`
        + `<path d="M-15 -29 Q0 -25 15 -29 L13 -23 Q0 -19 -13 -23 Z" fill="@vet1H" opacity="0.6"/>`
        + `<path d="M-2 -19 L7 -16 L5 -2 L-4 -8 Z" fill="@vet2H" stroke="@vet2" stroke-width="0.6" opacity="0.92"/>`
        + `<path d="M-1 -16 L6 -13 M-2 -12 L5 -10 M-3 -7 L4 -5" stroke="@vet2O" stroke-width="0.5" opacity="0.7"/>`
        + `<path d="M-12 12 L-7 14 L-9 27 L-13 23 Z" fill="@vet2H" stroke="@vet2" stroke-width="0.5" opacity="0.85"/>`
        + `<path d="M-11 30 L-6 31 L-9 41 L-13 37 Z" fill="@vet2H" stroke="@vet2" stroke-width="0.5" opacity="0.8"/>`
        + `<path d="M-11 33 Q0 38 11 33 L11 36 Q0 41 -11 36 Z" fill="@vet1O"/></g>`,
      // DOS : dos de la tunique bleu-ardoise (coutures verticales) + la bandoulière de la besace
      // qui traverse en diagonale + ceinture. Pas de liasses de tracts (à la hanche avant).
      back: `<g><path d="M-15 -29 Q0 -34 15 -29 L13 6 L11 33 Q0 38 -11 33 L-13 6 Z" fill="@vet1" stroke="@vet1O" stroke-width="1"/>`
        + `<g stroke="@vet1O" stroke-width="0.8" opacity="0.7" fill="none"><path d="M-7 -26 L-6 32"/><path d="M0 -27 L0 35"/><path d="M7 -26 L6 32"/><path d="M-13 -12 Q0 -10 13 -12"/><path d="M-13 2 Q0 4 12 2"/><path d="M-12 18 Q0 20 11 18"/></g>`
        + `<path d="M-15 -29 Q0 -25 15 -29 L13 -23 Q0 -19 -13 -23 Z" fill="@vet1H" opacity="0.6"/>`
        + `<path d="M9 -22 L13 -19 L-6 16 L-9 13 Z" fill="@vet2H" stroke="@vet2" stroke-width="0.6" opacity="0.85"/>`
        + `<path d="M-11 33 Q0 38 11 33 L11 36 Q0 41 -11 36 Z" fill="@vet1O"/></g>`,
      // PROFIL : tunique étroite (poitrine avancée +x), bandoulière de la besace sur l'épaule,
      // une liasse de tracts dépassant à la hanche, ceinture. Même agitateur de côté.
      profile: `<g><path d="M-7 -29 Q4 -34 9 -29 Q10 -10 8 6 L7 33 Q0 38 -5 33 Q-7 6 -7 -29 Z" fill="@vet1" stroke="@vet1O" stroke-width="1"/>`
        + `<path d="M-7 -29 Q-2 -31 1 -30 L0 33 Q-3 35 -5 33 Q-7 6 -7 -29 Z" fill="@vet1O" opacity="0.7"/>`
        + `<g stroke="@vet1O" stroke-width="0.8" opacity="0.6" fill="none"><path d="M3 -26 L2 32"/><path d="M-5 -10 Q1 -8 7 -10"/><path d="M-5 4 Q1 6 7 4"/><path d="M-5 18 Q1 20 6 18"/></g>`
        + `<path d="M-2 -22 L4 -19 L4 -4 L-2 -7 Z" fill="@vet2H" stroke="@vet2" stroke-width="0.6" opacity="0.9"/>`
        + `<path d="M-6 12 L-1 14 L-3 27 L-7 23 Z" fill="@vet2H" stroke="@vet2" stroke-width="0.5" opacity="0.85"/>`
        + `<path d="M-5 33 Q0 38 7 33 L7 36 Q0 41 -5 36 Z" fill="@vet1O"/></g>`,
    },
    jambes: {
      front: `<g><path d="M-5 0 L5 0 L6 18 Q4 21 0 21 Q-4 21 -6 18 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.8"/>`
        + `<g stroke="@vet2H" stroke-width="1.4" opacity="0.85"><path d="M-3 2 L-3 17"/><path d="M0 1 L0 18"/><path d="M3 2 L3 17"/></g>`
        + `<path d="M-6 18 Q0 22 6 18 L6 22 Q0 26 -6 22 Z" fill="@cuirO"/>`
        + `<path d="M-5 22 L5 22 L4 44 L-4 44 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.7"/>`
        + `<g stroke="@cuirO" stroke-width="1" opacity="0.7" fill="none"><path d="M-5 26 Q0 28 5 25"/><path d="M-5 31 Q0 29 4 32"/><path d="M-4 36 Q0 38 4 35"/><path d="M-4 40 Q0 39 4 41"/></g>`
        + `<path d="M-4 43 Q0 45 4 43 L5 50 Q0 52 -5 50 Z" fill="@cuirO" stroke="@cuirO" stroke-width="0.7"/></g>`,
      back: `<g><path d="M-5 0 L5 0 L6 18 Q4 21 0 21 Q-4 21 -6 18 Z" fill="@cuirO" stroke="@cuirO" stroke-width="0.8"/>`
        + `<path d="M0 1 L0 18" stroke="@vet2H" stroke-width="1.2" opacity="0.6"/>`
        + `<path d="M-6 18 Q0 22 6 18 L6 22 Q0 26 -6 22 Z" fill="@cuirO"/>`
        + `<path d="M-5 22 L5 22 L4 44 L-4 44 Z" fill="@cuirO" stroke="@cuirO" stroke-width="0.7"/>`
        + `<path d="M-4 43 Q0 45 4 43 L5 50 Q0 52 -5 50 Z" fill="@cuirO" stroke="@cuirO" stroke-width="0.7"/></g>`,
      profile: `<g><path d="M-3.6 0 L4.4 0 L5 18 Q3 21 0 21 Q-3 21 -4.6 18 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.8"/>`
        + `<path d="M0 1 L0 18" stroke="@vet2H" stroke-width="1.4" opacity="0.85"/>`
        + `<path d="M-4.6 18 Q0 22 5 18 L5 22 Q0 26 -4.6 22 Z" fill="@cuirO"/>`
        + `<path d="M-3.6 22 L4.4 22 L3.6 44 L-3.6 44 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.7"/>`
        + `<g stroke="@cuirO" stroke-width="1" opacity="0.7" fill="none"><path d="M-3.6 26 Q0 28 3.6 25"/><path d="M-3.6 31 Q0 29 3.6 32"/><path d="M-3.6 36 Q0 38 3.6 35"/></g>`
        + `<path d="M-3.6 43 Q0 45 4 43 L5 50 Q0 52 -3.6 50 Z" fill="@cuirO" stroke="@cuirO" stroke-width="0.7"/></g>`,
    },
    bras: {
      front: `<g><path d="M-4 -2 Q-6 -2 -6 2 L-5 16 L-4 30 L4 30 L5 16 L5 2 Q5 -2 3 -2 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.9"/>`
        + `<path d="M-4 -2 Q-6 -2 -6 2 L-5 16 L-1 16 L-1 -2 Z" fill="@vet1O" opacity="0.7"/>`
        + `<g stroke="@vet1O" stroke-width="0.7" opacity="0.6" fill="none"><path d="M-2 0 L-2 28"/><path d="M2 0 L2 28"/><path d="M-5 8 Q0 9 5 8"/><path d="M-5 19 Q0 20 5 19"/></g>`
        + `<path d="M-5 26 L5 26 L5 30 L-5 30 Z" fill="@vet1O" opacity="0.8"/>`
        + `<path d="M-5 28 L-9 31 L-6 33 L0 30 Z" fill="@vet2H" stroke="@vet2" stroke-width="0.5" opacity="0.8"/></g>`,
      back: `<g><path d="M-4 -2 Q-6 -2 -6 2 L-5 16 L-4 30 L4 30 L5 16 L5 2 Q5 -2 3 -2 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.9"/>`
        + `<g stroke="@vet1O" stroke-width="0.7" opacity="0.6" fill="none"><path d="M0 0 L0 28"/><path d="M-5 8 Q0 9 5 8"/><path d="M-5 19 Q0 20 5 19"/></g>`
        + `<path d="M-5 26 L5 26 L5 30 L-5 30 Z" fill="@vet1O" opacity="0.8"/></g>`,
      profile: `<g><path d="M-3.4 -2 Q-5 -2 -5 2 L-4 16 L-3.4 30 L3.4 30 L4 16 L4 2 Q4 -2 2.6 -2 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.9"/>`
        + `<g stroke="@vet1O" stroke-width="0.7" opacity="0.6" fill="none"><path d="M0 0 L0 28"/><path d="M-4 8 Q0 9 4 8"/><path d="M-4 19 Q0 20 4 19"/></g>`
        + `<path d="M-3.4 26 L3.4 26 L3.4 30 L-3.4 30 Z" fill="@vet1O" opacity="0.8"/>`
        + `<path d="M-3 28 L-7 31 L-4 33 L1 30 Z" fill="@vet2H" stroke="@vet2" stroke-width="0.5" opacity="0.8"/></g>`,
    },
    // Bonnet mou bleu-ardoise + plume d'oie (@metal) sur le côté.
    tete: {
      front: `<g><path d="M-10 0 Q-11 -7 -4 -10 Q0 -14 5 -11 Q11 -9 10 -1 Q11 2 7 3 Q0 5 -7 3 Q-11 2 -10 0 Z" fill="@vet2O" stroke="@vet2O" stroke-width="1"/>`
        + `<path d="M-9 -1 Q-3 -3 4 -2 Q9 -1 9 0 L8 3 Q0 5 -8 2 Z" fill="@vet2O" opacity="0.7"/>`
        + `<path d="M-4 -10 Q0 -13 5 -11 Q7 -7 2 -6 Q-3 -6 -4 -10 Z" fill="@vet2" opacity="0.8"/>`
        + `<path d="M5 -10 Q9 -16 12 -12 Q11 -7 7 -7 Z" fill="@metal" stroke="@metalO" stroke-width="0.6"/>`
        + `<path d="M3 -9 Q7 -15 11 -13" stroke="@metalH" stroke-width="0.5" fill="none" opacity="0.7"/></g>`,
      // DOS : bonnet mou de derrière, qui retombe sur la nuque, plume qui dépasse à droite.
      back: `<g><path d="M-10 1 Q-11 -7 -3 -11 Q0 -13 3 -11 Q11 -7 10 1 Q0 5 -10 1 Z" fill="@vet2O" stroke="@vet2O" stroke-width="1"/>`
        + `<path d="M0 -12 Q1 -4 0 4" fill="none" stroke="@vet2O" stroke-width="0.7" opacity="0.6"/>`
        + `<path d="M6 -8 Q10 -15 13 -11 Q12 -6 8 -6 Z" fill="@metal" stroke="@metalO" stroke-width="0.6"/></g>`,
      // PROFIL : bonnet mou de côté, retombée vers l'arrière (-x), plume vers le haut/arrière.
      profile: `<g><path d="M-11 0 Q-12 -7 -4 -11 Q1 -14 6 -11 Q9 -8 8 -1 Q1 3 -7 3 Q-11 2 -11 0 Z" fill="@vet2O" stroke="@vet2O" stroke-width="1"/>`
        + `<path d="M-4 -11 Q1 -13 6 -11 Q7 -8 4 -6 Q0 -6 -4 -11 Z" fill="@vet2" opacity="0.8"/>`
        + `<path d="M-6 -8 Q-10 -16 -13 -12 Q-12 -7 -8 -6 Z" fill="@metal" stroke="@metalO" stroke-width="0.6"/>`
        + `<path d="M-4 -9 Q-8 -15 -12 -13" stroke="@metalH" stroke-width="0.5" fill="none" opacity="0.7"/></g>`,
    },
  },
  // Flagellant : torse nu lacéré (@peau, plaies rouges @vet2), sangles de cuir croisées,
  // loques de bure pâle (@vet1), bourse de cuir ; jambes bandées de cuir + pieds nus ; bras
  // bandé de bure ; tignasse hirsute (@cheveux) couronnée de billets et de flammes. Art DÉDIÉ.
  Flagellant: {
    torse: {
      front: `<g><path d="M-13 -28 Q0 -32 13 -28 L11 2 L9 30 Q0 35 -9 30 L-11 2 Z" fill="@peau"/>`
        + `<path d="M-13 -28 Q0 -32 13 -28 L11 2 L9 30 Q0 35 -9 30 L-11 2 Z" fill="@cuirO" opacity=".28"/>`
        + `<path d="M-9 -6 Q-6 -4 -3 -6 M3 -6 Q6 -4 9 -6 M-8 1 Q-5 3 -2 1 M2 1 Q5 3 8 1 M-7 8 Q-4 10 -1 8 M1 8 Q4 10 7 8" stroke="@cuir" stroke-width="1" fill="none" opacity=".55"/>`
        + `<path d="M-7 -2 L-3 7 M5 0 L9 9" stroke="@vet2" stroke-width="1.4" stroke-linecap="round" opacity=".85"/>`
        + `<circle cx="-4" cy="4" r="1.1" fill="@vet2O"/><circle cx="6" cy="12" r="1" fill="@vet2O"/>`
        + `<path d="M-13 -27 L7 18" stroke="@cuirO" stroke-width="3.4" stroke-linecap="round"/><path d="M13 -27 L-7 18" stroke="@cuirO" stroke-width="3.4" stroke-linecap="round"/>`
        + `<path d="M-13 -27 L7 18" stroke="@cuir" stroke-width="1.4" stroke-linecap="round" opacity=".7"/><path d="M13 -27 L-7 18" stroke="@cuir" stroke-width="1.4" stroke-linecap="round" opacity=".7"/>`
        + `<path d="M-15 -26 L-9 -27 L-8 -19 L-16 -18 Z" fill="@vet1" stroke="@vet1O" stroke-width=".5"/>`
        + `<path d="M-16 -18 L-8 -19 L-7 -8 L-14 -4 L-17 -10 Z" fill="@vet1" stroke="@vet1O" stroke-width=".5"/>`
        + `<path d="M9 -27 L15 -25 L16 -16 L8 -18 Z" fill="@vet1" stroke="@vet1O" stroke-width=".5"/>`
        + `<path d="M8 -18 L16 -16 L17 -6 L11 -2 L7 -9 Z" fill="@vet1" stroke="@vet1O" stroke-width=".5"/>`
        + `<path d="M-12 4 L-13 14 L-9 26 L-5 14 L-7 4 Z" fill="@vet1" stroke="@vet1O" stroke-width=".5" opacity=".92"/>`
        + `<rect x="4" y="12" width="13" height="16" rx="1.5" fill="@cuir" stroke="@cuirO" stroke-width="1"/>`
        + `<rect x="6" y="13" width="11" height="14" rx="1" fill="@cuir"/>`
        + `<path d="M11 13 L11 27 M8 13 L8 27 M14 13 L14 27" stroke="@cuirO" stroke-width=".6" opacity=".7"/>`
        + `<path d="M8 18 L13 18 M9 18 Q11 16 13 19" stroke="@metal" stroke-width="1" fill="none" opacity=".85"/>`
        + `<path d="M3 -22 L9 14" stroke="@cuirO" stroke-width="2" stroke-linecap="round"/></g>`,
      // DOS : dos nu lacéré (plaies rouges plus nombreuses), sangles de cuir croisées, loques
      // de bure aux épaules + bande pendante. Pas de bourse (sur la hanche avant).
      back: `<g><path d="M-13 -28 Q0 -32 13 -28 L11 2 L9 30 Q0 35 -9 30 L-11 2 Z" fill="@peau"/>`
        + `<path d="M-13 -28 Q0 -32 13 -28 L11 2 L9 30 Q0 35 -9 30 L-11 2 Z" fill="@cuirO" opacity=".34"/>`
        + `<path d="M-9 -8 L-3 -2 M9 -8 L3 -2 M-8 0 L-2 6 M8 0 L2 6 M-8 8 L-3 13 M8 8 L3 13 M-6 16 L-1 21 M6 16 L1 21" stroke="@vet2" stroke-width="1.3" stroke-linecap="round" opacity=".8"/>`
        + `<circle cx="-5" cy="2" r="1" fill="@vet2O"/><circle cx="4" cy="10" r="1" fill="@vet2O"/><circle cx="-2" cy="18" r="0.9" fill="@vet2O"/>`
        + `<path d="M-13 -27 L7 18" stroke="@cuirO" stroke-width="3.4" stroke-linecap="round"/><path d="M13 -27 L-7 18" stroke="@cuirO" stroke-width="3.4" stroke-linecap="round"/>`
        + `<path d="M-13 -27 L7 18" stroke="@cuir" stroke-width="1.4" stroke-linecap="round" opacity=".7"/><path d="M13 -27 L-7 18" stroke="@cuir" stroke-width="1.4" stroke-linecap="round" opacity=".7"/>`
        + `<path d="M-15 -26 L-9 -27 L-8 -19 L-16 -18 Z" fill="@vet1" stroke="@vet1O" stroke-width=".5"/>`
        + `<path d="M9 -27 L15 -25 L16 -16 L8 -18 Z" fill="@vet1" stroke="@vet1O" stroke-width=".5"/>`
        + `<path d="M-3 22 L-5 33 L0 36 L4 33 L2 22 Z" fill="@vet1" stroke="@vet1O" stroke-width=".5" opacity=".9"/></g>`,
      // PROFIL : flanc nu lacéré (poitrine avancée +x), une sangle de cuir en travers, loque de
      // bure à l'épaule, bourse de hanche. Même flagellant de côté.
      profile: `<g><path d="M-6 -28 Q4 -32 8 -28 L7 2 L6 30 Q0 35 -5 30 L-6 2 Z" fill="@peau"/>`
        + `<path d="M-6 -28 Q4 -32 8 -28 L7 2 L6 30 Q0 35 -5 30 L-6 2 Z" fill="@cuirO" opacity=".28"/>`
        + `<path d="M-3 -4 L3 0 M-2 4 L4 8 M-3 11 L3 14" stroke="@vet2" stroke-width="1.3" stroke-linecap="round" opacity=".82"/>`
        + `<circle cx="1" cy="6" r="1" fill="@vet2O"/>`
        + `<path d="M-5 -26 L7 16" stroke="@cuirO" stroke-width="3" stroke-linecap="round"/>`
        + `<path d="M-5 -26 L7 16" stroke="@cuir" stroke-width="1.2" stroke-linecap="round" opacity=".7"/>`
        + `<path d="M-7 -26 L-1 -27 L0 -18 L-8 -16 Z" fill="@vet1" stroke="@vet1O" stroke-width=".5"/>`
        + `<path d="M-8 -16 L0 -18 L1 -6 L-6 -2 L-9 -8 Z" fill="@vet1" stroke="@vet1O" stroke-width=".5"/>`
        + `<rect x="2" y="12" width="9" height="15" rx="1.5" fill="@cuir" stroke="@cuirO" stroke-width="1"/>`
        + `<path d="M5 13 L5 26 M8 13 L8 26" stroke="@cuirO" stroke-width=".6" opacity=".7"/>`
        + `<path d="M4 18 Q6 16 8 19" stroke="@metal" stroke-width="1" fill="none" opacity=".85"/></g>`,
    },
    jambes: {
      front: `<g><path d="M-5 0 L5 0 L4 12 L-4 12 Z" fill="@cuir"/><rect x="-5" y="10" width="10" height="40" rx="3" fill="@cuir"/>`
        + `<path d="M-5 14 L5 12 M-5 20 L5 19 M-5 27 L5 25 M-5 33 L5 32 M-5 39 L5 37 M-5 45 L5 44" stroke="@cuirO" stroke-width="1.6" stroke-linecap="round"/>`
        + `<path d="M-5 11 L5 13 M-5 17 L5 16 M-5 24 L5 22 M-5 30 L5 29 M-5 36 L5 35 M-5 42 L5 41" stroke="@cuir" stroke-width="1" stroke-linecap="round" opacity=".7"/>`
        + `<path d="M-5 23 L-9 27 L-6 29 Z" fill="@cuir" opacity=".85"/><path d="M5 34 L9 37 L5 40 Z" fill="@cuir" opacity=".8"/>`
        + `<path d="M-5 46 Q0 49 5 46 L4 50 L-4 50 Z" fill="@peau"/>`
        + `<path d="M-4 50 L-4 53 M0 50 L0 53 M4 50 L4 53" stroke="@peau" stroke-width="1.4" stroke-linecap="round"/></g>`,
      back: `<g><path d="M-5 0 L5 0 L4 12 L-4 12 Z" fill="@cuirO"/><rect x="-5" y="10" width="10" height="40" rx="3" fill="@cuirO"/>`
        + `<path d="M-5 12 L5 14 M-5 19 L5 20 M-5 25 L5 27 M-5 32 L5 33 M-5 37 L5 39 M-5 44 L5 45" stroke="@cuir" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>`
        + `<path d="M-5 46 Q0 49 5 46 L4 50 L-4 50 Z" fill="@peauO"/>`
        + `<path d="M-3.4 50 L-3.4 53 M0 50 L0 53 M3.4 50 L3.4 53" stroke="@peauO" stroke-width="1.4" stroke-linecap="round"/></g>`,
      profile: `<g><path d="M-3.6 0 L4 0 L3.4 12 L-3 12 Z" fill="@cuir"/><rect x="-3.6" y="10" width="7.6" height="40" rx="3" fill="@cuir"/>`
        + `<path d="M-3.6 14 L4 12 M-3.6 20 L4 19 M-3.6 27 L4 25 M-3.6 33 L4 32 M-3.6 39 L4 37 M-3.6 45 L4 44" stroke="@cuirO" stroke-width="1.6" stroke-linecap="round"/>`
        + `<path d="M-3.6 23 L-7.6 27 L-4.6 29 Z" fill="@cuir" opacity=".85"/>`
        + `<path d="M-3 46 Q0 49 4 46 L8 50 Q9 53 6 53 L-3 50 Z" fill="@peau"/>`
        + `<path d="M2 50 L2 53 M5 50 L5.4 53 M8 50 L8.4 53" stroke="@peau" stroke-width="1.2" stroke-linecap="round"/></g>`,
    },
    bras: {
      front: `<g><rect x="-3.5" y="-2" width="7" height="34" rx="3" fill="@vet1"/>`
        + `<path d="M-3.5 1 L3.5 3 M-3.5 6 L3.5 5 M-3.5 11 L3.5 13 M-3.5 17 L3.5 16 M-3.5 22 L3.5 24 M-3.5 27 L3.5 26" stroke="@vet1O" stroke-width="1.3" stroke-linecap="round"/>`
        + `<path d="M-3.5 3 L3.5 1 M-3.5 14 L3.5 11 M-3.5 25 L3.5 22" stroke="@vet1H" stroke-width=".7" stroke-linecap="round" opacity=".7"/>`
        + `<path d="M-3.5 19 L-7 22 L-4 24 Z" fill="@vet1" opacity=".8"/>`
        + `<path d="M1 9 L2 13" stroke="@vet2" stroke-width="1" stroke-linecap="round" opacity=".6"/></g>`,
      back: `<g><rect x="-3.5" y="-2" width="7" height="34" rx="3" fill="@vet1O"/>`
        + `<path d="M-3.5 1 L3.5 3 M-3.5 6 L3.5 5 M-3.5 11 L3.5 13 M-3.5 17 L3.5 16 M-3.5 22 L3.5 24 M-3.5 27 L3.5 26" stroke="@vet1" stroke-width="1.3" stroke-linecap="round" opacity=".7"/>`
        + `<path d="M2 9 L1 13" stroke="@vet2" stroke-width="1" stroke-linecap="round" opacity=".5"/></g>`,
      profile: `<g><rect x="-3" y="-2" width="6" height="34" rx="3" fill="@vet1"/>`
        + `<path d="M-3 1 L3 3 M-3 6 L3 5 M-3 11 L3 13 M-3 17 L3 16 M-3 22 L3 24 M-3 27 L3 26" stroke="@vet1O" stroke-width="1.3" stroke-linecap="round"/>`
        + `<path d="M-3 19 L-6.4 22 L-3.6 24 Z" fill="@vet1" opacity=".8"/>`
        + `<path d="M1 9 L2 13" stroke="@vet2" stroke-width="1" stroke-linecap="round" opacity=".6"/></g>`,
    },
    // Tignasse hirsute (@cheveux) couronnée de billets de prière (@vet1H) et de flammèches (@metal).
    tete: {
      front: `<g><path d="M-9 4 Q0 0 9 4 L8 -2 Q0 -5 -8 -2 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width=".6"/>`
        + `<path d="M-8 0 L-9 -14 L-6 -14 L-5 0" fill="@cheveuxO"/>`
        + `<path d="M-3 -1 L-3 -16 L0 -16 L0 -1" fill="@cheveux"/>`
        + `<path d="M3 -1 L4 -16 L7 -15 L5 -1" fill="@cheveuxO"/>`
        + `<path d="M-9 -14 Q-4 -18 0 -16 M0 -16 Q5 -18 7 -15" stroke="@cheveuxO" stroke-width="1.4" fill="none"/>`
        + `<rect x="-7" y="-15" width="2.4" height="5" rx=".6" fill="@vet1H"/><rect x="-1.2" y="-17" width="2.4" height="5" rx=".6" fill="@vet1H"/><rect x="4.4" y="-15.5" width="2.2" height="5" rx=".6" fill="@vet1H"/>`
        + `<path d="M-5.8 -15 Q-5.8 -19 -4 -20 Q-6.4 -19 -5.8 -15" fill="@metalH"/><path d="M0 -17 Q0 -22 1.6 -23 Q-1.2 -21 0 -17" fill="@metalH"/><path d="M5.5 -15.5 Q5.5 -19.5 7 -20.5 Q4.6 -19 5.5 -15.5" fill="@metalH"/>`
        + `<path d="M-4 -20 Q-3 -24 -4.5 -26 M1.6 -23 Q3 -27 1 -30 M7 -20.5 Q8 -24 6.5 -26" stroke="@metal" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".85"/>`
        + `<path d="M-4.8 -12 L-5.6 -8 M0.6 -12 L0 -7 M5.4 -12.5 L4.8 -9" stroke="@vet1H" stroke-width=".7" stroke-linecap="round" opacity=".7"/></g>`,
      // DOS : tignasse hirsute de derrière (mèches dressées), billets et flammèches qui dépassent.
      back: `<g><path d="M-9.6 6 Q0 9 9.6 6 Q10 -8 0 -10 Q-10 -8 -9.6 6 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width=".6"/>`
        + `<path d="M-7 4 L-8 -12 L-5 -12 L-4 4 M-2 5 L-2 -13 L1 -13 L1 5 M4 4 L5 -12 L8 -11 L6 4" fill="@cheveuxO" opacity=".7"/>`
        + `<path d="M-9 -6 Q-4 -10 0 -9 Q5 -10 9 -6" stroke="@cheveuxO" stroke-width="1.2" fill="none"/>`
        + `<rect x="-6.6" y="-13" width="2.4" height="5" rx=".6" fill="@vet1H"/><rect x="3.4" y="-13" width="2.2" height="5" rx=".6" fill="@vet1H"/>`
        + `<path d="M-3 -11 Q-2 -16 -3.6 -18 M3.6 -11 Q5 -15 3 -18" stroke="@metal" stroke-width="1.3" fill="none" stroke-linecap="round" opacity=".8"/></g>`,
      // PROFIL : tignasse de côté (mèches dressées), un billet et une flammèche, oreille dégagée.
      profile: `<g><path d="M-9 4 Q0 1 7 4 L7 -2 Q0 -5 -8 -2 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width=".6"/>`
        + `<path d="M-8 0 L-9 -14 L-6 -14 L-5 0 M-3 -1 L-3 -16 L0 -16 L0 -1 M2 -1 L3 -15 L6 -14 L4 -1" fill="@cheveuxO" opacity=".7"/>`
        + `<path d="M-9 -14 Q-3 -18 1 -16 Q4 -17 6 -14" stroke="@cheveuxO" stroke-width="1.3" fill="none"/>`
        + `<rect x="-5.4" y="-15" width="2.4" height="5" rx=".6" fill="@vet1H"/><rect x="1" y="-16" width="2.2" height="5" rx=".6" fill="@vet1H"/>`
        + `<path d="M-4 -20 Q-3 -24 -4.5 -26 M2 -22 Q3.4 -26 1.4 -29" stroke="@metal" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".85"/></g>`,
    },
  },
  // Batelier : vareuse de cuir (@cuir) à mailles ondulées + col haut, ciré sombre (@cuirO)
  // drapé derrière, baudrier, spaulder d'acier (g_steelD), bouton de corne (@vet1H) ; culotte
  // moutarde (@vet1H) + bottes de cuir ; manches retroussées rouille (@vet2) ; bonnet de cuir.
  Batelier: {
    torse: {
      front: `<g stroke-linejoin="round"><path d="M-13 -25 Q-22 -8 -20 18 Q-23 30 -16 40 L-9 44 Q-11 36 -8 30 Q-13 18 -11 0 Q-12 -14 -9 -23Z" fill="@cuirO" stroke="@cuirO" stroke-width="0.8"/>`
        + `<path d="M-20 16 Q-22 26 -18 33 Q-15 28 -15 22Z M-16 30 Q-18 38 -15 42 Q-12 36 -12 31Z" fill="@cuirO"/>`
        + `<path d="M-14 -26 Q0 -32 14 -26 L13 6 L11 33 Q0 37 -11 33 L-13 6Z" fill="@cuir" stroke="@cuirO" stroke-width="0.9"/>`
        + `<path d="M-12 -24 Q-12 -2 -10 30" fill="none" stroke="@cuir" stroke-width="1" opacity="0.6"/>`
        + `<path d="M11 -23 Q12 -2 9 30" fill="none" stroke="@cuirO" stroke-width="1.1" opacity="0.7"/>`
        + `<path d="M-10 -14 Q-7 -11 -5 -14 M-5 -14 Q-2 -11 0 -14 M0 -14 Q3 -11 5 -14 M5 -14 Q8 -11 11 -14" fill="none" stroke="@vet1" stroke-width="0.6" opacity="0.7"/>`
        + `<path d="M-9 -8 Q-6 -5 -4 -8 M-4 -8 Q-1 -5 1 -8 M1 -8 Q4 -5 6 -8 M6 -8 Q9 -5 11 -8" fill="none" stroke="@vet1" stroke-width="0.6" opacity="0.7"/>`
        + `<path d="M-9 -2 Q-6 1 -4 -2 M-4 -2 Q-1 1 1 -2 M1 -2 Q4 1 6 -2 M6 -2 Q9 1 11 -2" fill="none" stroke="@vet1" stroke-width="0.6" opacity="0.7"/>`
        + `<path d="M-9 8 Q-6 11 -4 8 M-4 8 Q-1 11 1 8 M1 8 Q4 11 6 8 M6 8 Q9 11 11 8" fill="none" stroke="@vet1" stroke-width="0.6" opacity="0.65"/>`
        + `<path d="M-9 14 Q-6 17 -4 14 M-4 14 Q-1 17 1 14 M1 14 Q4 17 6 14 M6 14 Q9 17 10 14" fill="none" stroke="@vet1" stroke-width="0.6" opacity="0.6"/>`
        + `<path d="M-10 -27 Q-13 -22 -11 -15 Q0 -19 11 -15 Q13 -22 10 -27 Q0 -31 -10 -27Z" fill="@cuir" stroke="@cuirO" stroke-width="0.8"/>`
        + `<path d="M-9 -25 Q0 -28 9 -25 L8 -17 Q0 -20 -8 -17Z" fill="@cuirH" opacity="0.6"/>`
        + `<path d="M-9 -16 L11 24" stroke="@cuir" stroke-width="3" stroke-linecap="round"/><path d="M-9 -16 L11 24" stroke="@cuirH" stroke-width="1" opacity="0.5"/>`
        + `<path d="M10 -24 Q18 -22 19 -13 Q20 -5 15 1 Q9 -1 8 -10 Q9 -19 10 -24Z" fill="url(#g_steelD)" stroke="#2a3038" stroke-width="0.8"/>`
        + `<path d="M11 -22 Q17 -20 17.5 -13" fill="none" stroke="@metalH" stroke-width="0.7" opacity="0.55"/>`
        + `<path d="M9 -1 Q15 1 18 -2 Q18 4 16 8 Q11 6 9 1Z" fill="@cuirH" stroke="@cuirO" stroke-width="0.7"/>`
        + `<path d="M9 6 Q14 8 17 5 Q17 11 15 14 Q11 12 9 8Z" fill="@cuirH" stroke="@cuirO" stroke-width="0.7"/>`
        + `<circle cx="13.5" cy="-12" r="2.4" fill="@vet1H" stroke="@vet1O" stroke-width="0.6"/><circle cx="13.5" cy="-12" r="1" fill="@vet1"/><circle cx="12.5" cy="-12.8" r="0.7" fill="@metalH" opacity="0.8"/></g>`,
      // DOS : ciré sombre qui drape le dos (pli central, ourlet en lambeaux à gauche) + col haut
      // + baudrier qui traverse + spaulder d'acier sur l'épaule. Pas de bouton (sur le devant).
      back: `<g stroke-linejoin="round"><path d="M-13 -25 Q-22 -8 -20 18 Q-23 30 -16 40 L-9 44 Q-11 36 -8 30 Q-13 18 -11 0 Q-12 -14 -9 -23Z" fill="@cuirO" stroke="@cuirO" stroke-width="0.8"/>`
        + `<path d="M-20 16 Q-22 26 -18 33 Q-15 28 -15 22Z M-16 30 Q-18 38 -15 42 Q-12 36 -12 31Z" fill="@cuirO"/>`
        + `<path d="M-14 -26 Q0 -32 14 -26 L13 6 L11 33 Q0 37 -11 33 L-13 6Z" fill="@cuir" stroke="@cuirO" stroke-width="0.9"/>`
        + `<path d="M0 -27 Q1 0 0 35" fill="none" stroke="@cuirO" stroke-width="1"/>`
        + `<path d="M-9 -10 Q0 -6 9 -10 M-10 4 Q0 8 10 4 M-9 18 Q0 22 9 18" fill="none" stroke="@cuir" stroke-width="0.6" opacity="0.6"/>`
        + `<path d="M-10 -27 Q-13 -22 -11 -15 Q0 -19 11 -15 Q13 -22 10 -27 Q0 -31 -10 -27Z" fill="@cuir" stroke="@cuirO" stroke-width="0.8"/>`
        + `<path d="M9 -16 L-11 24" stroke="@cuir" stroke-width="3" stroke-linecap="round"/><path d="M9 -16 L-11 24" stroke="@cuirH" stroke-width="1" opacity="0.5"/>`
        + `<path d="M10 -24 Q18 -22 19 -13 Q20 -5 15 1 Q9 -1 8 -10 Q9 -19 10 -24Z" fill="url(#g_steelD)" stroke="#2a3038" stroke-width="0.8"/></g>`,
      // PROFIL : vareuse de cuir étroite (poitrine avancée +x) + ciré sombre qui pend derrière
      // (-x) + col + baudrier + spaulder d'acier de côté. Même batelier de profil.
      profile: `<g stroke-linejoin="round"><path d="M-6 -25 Q-12 -8 -11 18 Q-13 30 -8 40 L-3 42 Q-6 30 -5 18 Q-7 0 -6 -23Z" fill="@cuirO" stroke="@cuirO" stroke-width="0.8"/>`
        + `<path d="M-11 16 Q-13 26 -10 33 Q-7 28 -7 22Z" fill="@cuirO"/>`
        + `<path d="M-6 -26 Q4 -32 8 -26 Q9 -6 7 6 L6 33 Q0 37 -5 33 Q-7 6 -6 -26Z" fill="@cuir" stroke="@cuirO" stroke-width="0.9"/>`
        + `<path d="M-4 -14 Q0 -11 4 -14 M-4 -6 Q0 -3 4 -6 M-4 2 Q0 5 4 2 M-4 10 Q0 13 4 10 M-4 18 Q0 21 4 18" fill="none" stroke="@vet1" stroke-width="0.6" opacity="0.65"/>`
        + `<path d="M-6 -27 Q4 -31 9 -26 Q10 -20 7 -15 Q0 -18 -6 -16Z" fill="@cuir" stroke="@cuirO" stroke-width="0.8"/>`
        + `<path d="M-5 -16 L7 22" stroke="@cuir" stroke-width="3" stroke-linecap="round"/><path d="M-5 -16 L7 22" stroke="@cuirH" stroke-width="1" opacity="0.5"/>`
        + `<path d="M2 -24 Q10 -22 11 -13 Q12 -5 7 1 Q1 -1 0 -10 Q1 -19 2 -24Z" fill="url(#g_steelD)" stroke="#2a3038" stroke-width="0.8"/></g>`,
    },
    jambes: {
      front: `<g stroke-linejoin="round"><path d="M-5 0 Q-7 10 -5.6 20 Q-7 26 -5 30 L5 30 Q7 26 5.6 20 Q7 10 5 0Z" fill="@vet1H" stroke="@cuir" stroke-width="0.8"/>`
        + `<path d="M-3 3 Q-4 12 -2.6 20 M2.6 3 Q4 12 2.6 20 M0 2 Q-0.5 11 0 19" fill="none" stroke="@vet1H" stroke-width="0.8" opacity="0.5"/>`
        + `<path d="M-5.4 28 Q0 25 5.4 28 L5.6 35 Q0 37 -5.6 35Z" fill="@cuirO" stroke="@cuirO" stroke-width="0.9"/>`
        + `<path d="M-5 34 Q0 36 5 34 L5 50 Q0 52 -5 50Z" fill="@cuirO" stroke="@cuirO" stroke-width="0.8"/>`
        + `<path d="M-5 31.5 Q0 34 5 31.5" fill="none" stroke="@cuirH" stroke-width="1.4"/>`
        + `<rect x="-1.2" y="31.4" width="2.4" height="2.6" rx="0.4" fill="@vet1H" stroke="@vet1" stroke-width="0.4"/>`
        + `<path d="M-4.6 36 Q0 34.6 4.6 36" fill="none" stroke="@cuirO" stroke-width="1.2"/></g>`,
      back: `<g stroke-linejoin="round"><path d="M-5 0 Q-7 10 -5.6 20 Q-7 26 -5 30 L5 30 Q7 26 5.6 20 Q7 10 5 0Z" fill="@vet1H" stroke="@cuir" stroke-width="0.8"/>`
        + `<path d="M0 2 Q-0.5 11 0 19" fill="none" stroke="@vet1H" stroke-width="0.8" opacity="0.4"/>`
        + `<path d="M-5.4 28 Q0 25 5.4 28 L5.6 35 Q0 37 -5.6 35Z" fill="@cuirO" stroke="@cuirO" stroke-width="0.9"/>`
        + `<path d="M-5 34 Q0 36 5 34 L5 50 Q0 52 -5 50Z" fill="@cuirO" stroke="@cuirO" stroke-width="0.8"/></g>`,
      profile: `<g stroke-linejoin="round"><path d="M-3.6 0 Q-5.6 10 -4.2 20 Q-5.6 26 -3.6 30 L4 30 Q6 26 4.6 20 Q6 10 4 0Z" fill="@vet1H" stroke="@cuir" stroke-width="0.8"/>`
        + `<path d="M0 2 Q-0.5 11 0 19" fill="none" stroke="@vet1H" stroke-width="0.8" opacity="0.5"/>`
        + `<path d="M-3.6 28 Q1 25 4.4 28 L4.6 35 Q1 37 -3.8 35Z" fill="@cuirO" stroke="@cuirO" stroke-width="0.9"/>`
        + `<path d="M-3.6 34 Q1 36 4.4 34 L4.4 49 Q4 52 1 51.5 L-3.6 49Z" fill="@cuirO" stroke="@cuirO" stroke-width="0.8"/>`
        + `<path d="M-3.6 31.5 Q1 34 4.4 31.5" fill="none" stroke="@cuirH" stroke-width="1.4"/></g>`,
    },
    bras: {
      front: `<g stroke-linejoin="round"><path d="M-4.5 -2 Q-6 6 -4.5 14 L4.5 14 Q6 6 4.5 -2 Q0 -5 -4.5 -2Z" fill="@vet2" stroke="@vet2O" stroke-width="0.6"/>`
        + `<path d="M-2.4 0 Q-3.6 7 -2.6 13 M2.4 0 Q3.6 7 2.6 13 M0 -1 Q-0.4 7 0 13" fill="none" stroke="@vet2O" stroke-width="1.2" opacity="0.6" stroke-linecap="round"/>`
        + `<path d="M-3 4 Q0 6 3 4 M-3.4 9 Q0 11 3.4 9" fill="none" stroke="@vet2H" stroke-width="0.6" opacity="0.55"/>`
        + `<path d="M-4.6 14 Q0 16.5 4.6 14 L4.2 22 Q0 24 -4.2 22Z" fill="@cuir" stroke="@cuirO" stroke-width="0.7"/>`
        + `<path d="M-4 22 Q0 24 4 22 L3.4 30 Q0 31 -3.4 30Z" fill="@cuir" stroke="@cuirO" stroke-width="0.6"/>`
        + `<path d="M-3.6 17 Q0 19 3.6 17 M-3.4 25 Q0 27 3.4 25" fill="none" stroke="@cuirH" stroke-width="0.6" opacity="0.6"/></g>`,
      back: `<g stroke-linejoin="round"><path d="M-4.5 -2 Q-6 6 -4.5 14 L4.5 14 Q6 6 4.5 -2 Q0 -5 -4.5 -2Z" fill="@vet2O" stroke="@vet2O" stroke-width="0.6"/>`
        + `<path d="M0 -1 Q-0.4 7 0 13" fill="none" stroke="@vet2O" stroke-width="1" opacity="0.5" stroke-linecap="round"/>`
        + `<path d="M-4.6 14 Q0 16.5 4.6 14 L4.2 22 Q0 24 -4.2 22Z" fill="@cuir" stroke="@cuirO" stroke-width="0.7"/>`
        + `<path d="M-4 22 Q0 24 4 22 L3.4 30 Q0 31 -3.4 30Z" fill="@cuir" stroke="@cuirO" stroke-width="0.6"/></g>`,
      profile: `<g stroke-linejoin="round"><path d="M-3.6 -2 Q-5 6 -3.6 14 L3.6 14 Q5 6 3.6 -2 Q0 -5 -3.6 -2Z" fill="@vet2" stroke="@vet2O" stroke-width="0.6"/>`
        + `<path d="M0 -1 Q-0.4 7 0 13" fill="none" stroke="@vet2O" stroke-width="1.2" opacity="0.6" stroke-linecap="round"/>`
        + `<path d="M-3 4 Q0 6 3 4 M-3.2 9 Q0 11 3.2 9" fill="none" stroke="@vet2H" stroke-width="0.6" opacity="0.55"/>`
        + `<path d="M-3.6 14 Q0 16.5 3.6 14 L3.4 22 Q0 24 -3.4 22Z" fill="@cuir" stroke="@cuirO" stroke-width="0.7"/>`
        + `<path d="M-3.4 22 Q0 24 3.4 22 L3 30 Q0 31 -3 30Z" fill="@cuir" stroke="@cuirO" stroke-width="0.6"/></g>`,
    },
    // Bonnet de cuir mou (calotte + bord roulé).
    tete: {
      front: `<g stroke-linejoin="round"><path d="M-9 4 Q-11 -8 -7 -13 Q0 -15 7 -13 Q11 -8 9 4 Q4 0 0 0 Q-4 0 -9 4Z" fill="@cuir" stroke="@cuirO" stroke-width="0.8"/>`
        + `<path d="M-7 -11 Q0 -14 7 -11" fill="none" stroke="@cuir" stroke-width="0.7" opacity="0.6"/>`
        + `<path d="M-7 -6 Q0 -11 7.5 -6 Q9 -5 7 -3 Q0 -8 -7 -3 Q-9 -5 -7 -6Z" fill="@cuir" stroke="@cuirO" stroke-width="0.7"/>`
        + `<path d="M-8.5 -8 Q-2 -16 4 -14 Q9 -13 9.5 -7 Q10.5 -3 8 -2 Q9 -8 4 -11 Q-2 -13 -8 -7Z" fill="@cuir" stroke="@cuirO" stroke-width="0.8"/>`
        + `<path d="M-8 -7 Q-1 -14 5 -12.5" fill="none" stroke="@cuirH" stroke-width="0.7" opacity="0.6"/>`
        + `<path d="M5 -13 Q11 -12 12.5 -7.5 Q13.5 -4.5 10.5 -3.5 Q9 -7 6 -9 Q5 -11 5 -13Z" fill="@cuir" stroke="@cuirO" stroke-width="0.7"/>`
        + `<path d="M6 -11 Q10.5 -10 11.5 -6.5" fill="none" stroke="@cuir" stroke-width="0.6" opacity="0.5"/></g>`,
      // DOS : bonnet de cuir de derrière, calotte + bord roulé.
      back: `<g stroke-linejoin="round"><path d="M-9 4 Q-11 -9 0 -14 Q11 -9 9 4 Q0 7 -9 4Z" fill="@cuir" stroke="@cuirO" stroke-width="0.8"/>`
        + `<path d="M0 -13 Q1 -5 0 4" fill="none" stroke="@cuirO" stroke-width="0.6" opacity="0.6"/>`
        + `<path d="M-9 -1 Q0 -6 9 -1 Q10 1 8 3 Q0 -2 -8 3 Q-10 1 -9 -1Z" fill="@cuir" stroke="@cuirO" stroke-width="0.7"/></g>`,
      // PROFIL : bonnet de cuir de côté, calotte + bord roulé qui dégage le visage (+x).
      profile: `<g stroke-linejoin="round"><path d="M-9 4 Q-11 -9 -2 -14 Q6 -14 8 -4 Q3 -2 -1 -2 Q-5 -1 -9 4Z" fill="@cuir" stroke="@cuirO" stroke-width="0.8"/>`
        + `<path d="M-2 -13 Q-7 -8 -8 -1" fill="none" stroke="@cuirH" stroke-width="0.7" opacity="0.6"/>`
        + `<path d="M-9 -1 Q-1 -7 8 -3 Q9.5 -2 7.5 0 Q0 -4 -8 3 Q-10 1 -9 -1Z" fill="@cuir" stroke="@cuirO" stroke-width="0.7"/></g>`,
    },
  },
  // Répurgateur : seul le COUVRE-CHEF est doté de vues dédiées — le chapeau à large bord
  // (capotain) est trop distinctif pour la calotte générique. Torse/jambes/bras gardent
  // l'auto (+ vues auto / silhouette token de profil). Le chapeau garde sa boucle d'acier.
  Répurgateur: {
    tete: {
      // FACE : large bord ovale + dôme tronqué + bandeau + boucle d'acier (identique à l'auto).
      front: `<g>`
        + `<ellipse cx="0" cy="-7" rx="14" ry="4.5" fill="@cuir" stroke="@cuirO" stroke-width="0.8"/>`
        + `<ellipse cx="0" cy="-7.8" rx="13" ry="3.6" fill="@cuir"/>`
        + `<path d="M-6 -8 Q-7 -16 0 -16 Q7 -16 6 -8 Q0 -6 -6 -8 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.8"/>`
        + `<path d="M-6 -8 Q-6 -13 0 -14 L0 -8 Q-3 -7 -6 -8 Z" fill="@cuirH" opacity="0.6"/>`
        + `<rect x="-6.5" y="-9" width="13" height="2.4" rx="0.6" fill="@cuirO"/>`
        + `<rect x="-2" y="-9.3" width="4" height="3" rx="0.7" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.5"/>`
        + `<circle cx="0" cy="-7.8" r="0.7" fill="@cuirO"/></g>`,
      // DOS : même chapeau de derrière — bord ovale, dôme, bandeau (boucle masquée à l'avant).
      back: `<g>`
        + `<ellipse cx="0" cy="-7" rx="14" ry="4.5" fill="@cuirO" stroke="@cuirO" stroke-width="0.8"/>`
        + `<ellipse cx="0" cy="-7.8" rx="13" ry="3.6" fill="@cuir"/>`
        + `<path d="M-6 -8 Q-7 -16 0 -16 Q7 -16 6 -8 Q0 -6 -6 -8 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.8"/>`
        + `<path d="M0 -15 L0 -8" stroke="@cuirO" stroke-width="0.6" opacity="0.6"/>`
        + `<rect x="-6.5" y="-9" width="13" height="2.4" rx="0.6" fill="@cuirO"/></g>`,
      // PROFIL : chapeau de côté — bord large (pointe avant +x et arrière -x), dôme, boucle de
      // côté. Le large bord (la signature du chasseur de sorcières) reste lisible de profil.
      profile: `<g>`
        + `<path d="M-12 -6.6 Q-13.5 -8.4 -10 -8.8 L9 -8.8 Q12.5 -8.4 11 -6.6 Q0 -5 -12 -6.6Z" fill="@cuir" stroke="@cuirO" stroke-width="0.8"/>`
        + `<ellipse cx="-0.5" cy="-7.4" rx="11" ry="2.4" fill="@cuir"/>`
        + `<path d="M-5.5 -8 Q-6.5 -16 0 -16 Q6 -16 6 -8 Q1 -6.4 -5.5 -8Z" fill="@cuir" stroke="@cuirO" stroke-width="0.8"/>`
        + `<path d="M-5.5 -8 Q-6 -14 -1 -15.4 L-1 -8 Q-3.5 -7.2 -5.5 -8Z" fill="@cuirH" opacity="0.5"/>`
        + `<rect x="-5.5" y="-9" width="11" height="2.2" rx="0.6" fill="@cuirO"/>`
        + `<rect x="2.4" y="-9.2" width="3" height="2.8" rx="0.6" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.5"/></g>`,
    },
  },
};

/** Tenue par carrière exposée au moteur : auto + overrides manuels, fusionnés PAR SLOT.
 *  Un override manuel peut ne fournir QUE certains slots (p.ex. juste `tete`) ; les autres
 *  restent ceux de l'auto. Le slot manuel l'emporte sur l'auto. */
export const TENUE_MODELS: Record<string, TenueSlots> = (() => {
  const out: Record<string, TenueSlots> = {};
  for (const [tenue, slots] of Object.entries(GENERATED_CAREER_TENUES_AUTO)) out[tenue] = { ...slots };
  for (const [tenue, slots] of Object.entries(MANUAL)) out[tenue] = { ...(out[tenue] ?? {}), ...slots };
  // Tenues DÉPOSÉES en defs/ (tenues/defs/<Nom>.ts, flag career:true) — la voie
  // CANONIQUE pour un nouvel humanoïde habillé : un fichier, zéro édition d'existant. PRIORITAIRE.
  for (const [tenue, slots] of Object.entries(CAREER_TENUE_DEFS)) out[tenue] = { ...(out[tenue] ?? {}), ...slots };
  return out;
})();
