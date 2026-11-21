# passport-of-quartidia

[![make.fun · the-passport-page-of-a-countr-2-20261121-0318](https://make.fun/badge/the-passport-page-of-a-countr-2-20261121-0318.svg)](https://make.fun/bounty/the-passport-page-of-a-countr-2-20261121-0318?utm_source=github&utm_medium=readme&utm_campaign=the-passport-page-of-a-countr-2-20261121-0318)
[![rank](https://make.fun/badge/the-passport-page-of-a-countr-2-20261121-0318/Skyzo07/passport-of-quartidia/rank.svg)](https://make.fun/bounty/the-passport-page-of-a-countr-2-20261121-0318/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=the-passport-page-of-a-countr-2-20261121-0318)
[![reward](https://make.fun/badge/the-passport-page-of-a-countr-2-20261121-0318/Skyzo07/passport-of-quartidia/reward.svg)](https://make.fun/bounty/the-passport-page-of-a-countr-2-20261121-0318?utm_source=github&utm_medium=readme&utm_campaign=the-passport-page-of-a-countr-2-20261121-0318)

**The passport of the Republic of Quartidia** — a country that exists only on 29 February, one day every four years. The spread is drawn entirely in code: a data page for Ana Mara Selin, a leap baby born 29 FEB 1996 (age in leap years: 7), with a code-drawn portrait, a coat of arms built around "29" and the four quarters, and a machine-readable strip with correct ICAO check digits; and a visas page with a one-day Aurelia visa, exit/entry stamps that tell a plausible story (out on 29 FEB 2024, home again on 29 FEB 2028), a boxed CONDITIONS stamp — "HOLDER MUST ENTER AND LEAVE ON 29 FEBRUARY. THIS PASSPORT CEASES TO EXIST AT MIDNIGHT." — a "LEAP FEE PAID — 29 COINS" stamp, and a faint chart of the crescent Isle of Quartidia.

## How the entry runs

`main.ts` (Node 22, standard library only) draws the 1024x1024 spread from scratch — every line, letter, stamp and the portrait is computed, with no image assets, no fonts loaded from disk and no network — and writes `/output/entry.png`. The render is deterministic: run it again and you get the same bytes back.

```sh
node main.ts   # writes /output/entry.png (1024x1024, under 1 MiB)
```

## How the spread is made

- A tiny built-in 5x7 bitmap font draws all lettering in one consistent sans style; the MRZ is set monospace with check digits computed in code (TD3 format).
- The portrait is drawn in code: head-and-shoulders, dark hair parted in the middle, simple dark jacket — a woman in her late 20s who belongs to the name and the country.
- Every date agrees: the passport is issued 29 FEB 2024 and expires 29 FEB 2028, and no stamp predates the issue — the whole travel history happens on 29 February, because in Quartidia there is no other day.
