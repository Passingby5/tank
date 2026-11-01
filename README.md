# Tank

A small top-down tank game for phones and computers. Guard the bird, clear 22 levels, play alone or with two players.

## Run it
- `npm run build` writes the game to `site/`. Open `site/index.html`, or serve the `site/` folder.
- `npm test` runs every check: unit tests, fairness sims, the Level 1 originality check, browser click-throughs, and a speed test.
- `npm run shots` saves screenshots to `shots/`.

## Originality check (read this before making the repo public)
`tools/originality.js` compares Level 1 with the 35 Battle City stages. The Battle City stage data is NOT in this repo and must never be added, because the repo will be public.

- Keep the reference file outside the repo and point to it with `BC_REF=/path/to/bc_levels_ref.js` (default: `/workspace/qa/tank-v1/scripts/bc_levels_ref.js`).
- If the file is missing, the check FAILS on purpose, so a skipped check can not look like a pass.
- To skip it on purpose (for example on a machine without the file), run `SKIP_ORIGINALITY=1 npm test`. The output then says the check was skipped.

## Difficulty
Easy is the default on first run. Medium starts gentle on Level 1 and gets stronger level by level. `npm test` checks that a slow, sloppy player model wins at least 30% of every Medium level and at least 50% of every Easy level.
