# Orphelines de données — GÉNÉRÉ

> ⚠️ Fichier GÉNÉRÉ par `node scripts/docs/build-entity-orphans.mjs` (`npm run docs:orphelines`) — NE PAS ÉDITER À LA MAIN.
> Pour chaque catalogue `src/data/*.json` retenu, les entités dont AUCUN autre `src/data/*.json`
> ni le code de prod TypeScript (`.ts`/`.tsx`, hors tests) ne cite l'id en toutes lettres. Périmètre
> mesuré, angles morts déclarés, définition d'un consommateur : voir l'en-tête de
> `scripts/docs/build-entity-orphans.mjs`. Cliquet décroissant : `src/data/entity-orphans.test.ts`
> + `scripts/guards/lib/entityOrphanStock.mjs`.

## Catalogues ÉCARTÉS (angle mort structurel mesuré, pas couverts)

| Catalogue | Entités | Orphelines BRUTES (id seul) | Taux |
|---|---|---|---|
| `spells` | 576 | 282 | 49 % |
| `trappings` | 440 | 215 | 49 % |
| `creatures` | 490 | 362 | 74 % |

Ces trois catalogues portent un lookup de repli PAR LABEL (`findSpell`/`findTrappingByLabel`/
`findCreature`) que la détection id-seule ne voit pas — taux 8 à 12× les catalogues retenus,
signe d'un détecteur inadapté plutôt que d'une dette réelle à ce volume. Non câblés ici.

## Catalogues MESURÉS

| Catalogue | Entités | Orphelines | Taux |
|---|---|---|---|
| `traits` | 130 | 7 | 5 % |
| `talents` | 187 | 6 | 3 % |
| `qualities` | 59 | 3 | 5 % |
| `maneuvers` | 20 | 0 | 0 % |
| `skills` | 48 | 1 | 2 % |
| `props` | 59 | 0 | 0 % |
| `vehicles` | 31 | 2 | 6 % |
| **Total** | **534** | **19** | — |

### `traits`

- `marque-de-tzeentch` — Marque de Tzeentch
- `absorption` — Absorption
- `amorphe` — Amorphe
- `contagieux` — Contagieux
- `decerebre` — Décérébré
- `voleur-de-chair` — Voleur de chair
- `aura-de-mort` — Aura de Mort

### `talents`

- `talent-aleatoire` — Talent aléatoire
- `benediction-de-tzeentch` — Bénédiction de Tzeentch
- `disciple-du-changement` — Disciple du changement
- `double-vie` — Double vie
- `empreint-de-la-magie` — Empreint de la Magie
- `sang-neuf` — Sang Neuf

### `qualities`

- `filet-barbele` — Filet barbelé
- `deroutante` — Déroutante
- `laid` — Laid

### `skills`

- `hypnotisme` — Hypnotisme

### `vehicles`

- `petite-litiere` — Petite litière
- `grande-litiere` — Grande litière

