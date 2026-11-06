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
Hard is the default on a brand-new install; an existing saved Easy/Medium choice is kept. The bird fort starts as brick; shovel steels it for about 16 seconds. Enemy quotas are 20 / 25 / 30 by level band. `npm test` checks fort/spawn/anti-camp rules, and advanced fair-play sims (camp vs mobile), not the old kid-win ease gates.


## Saves (v7)
Restart Level restores the score, lives and gun you had when the level began. Continue still resumes a mid-level snapshot. Older mid-level saves migrate overdue spawn timers and cap leftover free fort steel to a normal shovel.
