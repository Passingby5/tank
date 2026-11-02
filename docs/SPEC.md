# Tank: design doc (v2)

## Idea
A top-down 2D tank game for families. You drive a tank through a walled maze and protect a golden bird that sits in a small brick fort at the bottom of the map. Enemy tanks roll in from three gates at the top. Stop all of them to clear the level. It is inspired by classic arcade tank games, but every tank, the bird, the levels, the sounds and the music are original.

## Look
Crisp, modern 2D art drawn in code on a canvas sized to the screen's devicePixelRatio, so it stays sharp on phones. Bricks have mortar and shading, steel has bevels and rivets, water moves, trees sway a little and hide tanks, ice shines. Tanks have rolling treads, a shaded hull and turret, a muzzle flash when they fire, and explosions with fireballs, sparks, smoke and a shock ring.

## Rules
- The map is 13 x 13 tiles. Each tile is split into 2 x 2 half tiles, so brick can be chipped away a piece at a time.
- Brick: blocks tanks and shots, a shot breaks the strip it hits. Steel: blocks everything, only a 3-star gun breaks it. Water: blocks tanks, shots fly over. Trees: tanks drive under them and are hidden. Ice: your tank slides a little after you let go.
- Enemies: basic, fast, rapid-fire and armored (takes 4 hits). 15 per level on Easy, 18 on Medium and Hard; at most 2 / 3 / 3 on the map at once (Medium starts at 2). They spawn from 3 gates.
- Three enemies per level flash red, picked at random inside the ranges 2-6, 8-12 and 14-17. Hitting it drops a power-up: star (gun upgrade, up to 3 stars), shield, shovel (steel fort for a while), bomb (all enemies on the map blow up), clock (enemies freeze), tank (extra life).
- The bird sits behind a two layer brick fort that starts as steel (Easy 90 s, Medium 45 s, Hard 42 s). The bird takes 3 enemy hits on Easy and Medium and 2 on Hard. If all players run out of lives, the level is lost.
- Easy, Medium and Hard change enemy count, speed, aim, fire rate, bullet speed, lives (6 / 6 / 5) and bird hits. Easy is the default on first run. Easy and Medium swap some armored and rapid-fire tanks for basic ones. Medium starts gentle on Level 1 and ramps smoothly to its full strength on the last level; Hard is sharp from Level 1 (faster, better aim, quicker fire) and eases its enemy mix on later levels so a strong player can still win. All three keep a little extra help on levels 1-5.
- 2 players on one device: keyboard W A S D + Space and Arrows + Enter, or a split touch pad in landscape.

## Tech
- Plain JavaScript, no libraries. src/levels.js (data), src/engine.js (pure rules, seeded RNG, fixed 60 Hz steps, runs in Node), src/render.js (canvas art), src/audio.js (WebAudio), src/save.js (versioned save), src/ui/ (screens and controls).
- build.js makes site/ (single page PWA with manifest, icons, network-first service worker, version.json) and an optional single file test copy.
- Version label on the home screen: "v4 - Oct 31 - <commit>".

## Acceptance checklist
1. Home screen shows title, Play (1 player), 2 Players, Easy/Medium/Hard, How to Play, Sound toggle and the label "v4 - Oct 31 - <7 char commit>".
2. Continue appears only when a valid save exists.
3. levels.js holds at least 20 levels, each 13 rows of 13 valid tile characters, kept apart from engine code.
4. In every level each enemy gate and each player spawn can reach the bird by a path that only goes through open ground or brick.
5. Brick breaks in half tile strips; steel stops normal shots; a 3-star shot breaks steel.
6. Water blocks tanks but not shots; trees do not block tanks or shots and are drawn over tanks; ice makes the player slide after letting go.
7. An enemy shot that hits the bird ends the level as lost. Your own shots can not hurt the bird (kid friendly).
8. Enemy count per level is 15 / 18 / 18 (Easy / Medium / Hard); at most 2 / 3 / 3 are alive at once; they spawn from 3 gates.
9. Four enemy types exist with different speed, fire rate and hit points (armored needs 4 hits).
10. Three flashing enemies per level, at random spots inside fixed ranges (not the 4th/11th/18th), drop a power-up when hit.
11. Each of the six power-ups does its job: star raises gun tier (max 3), shield blocks hits, shovel turns the fort to steel and back, bomb clears all enemies on the map, clock freezes enemies, tank adds a life.
12. Destroying all enemies wins the level and moves to the next one.
13. Headless sims: across many seeded games no enemy stays stuck in place for more than 6 seconds while not frozen.
14. Headless sims: an autoplay bot (with its shield and the steel fort kept on as test aids) clears every level, so every level can be finished, and the steel fort keeps the bird safe the whole time.
15. Headless sims: with no player defense the bird is eventually attacked (enemy AI heads toward the bird), and games finish without errors.
16. Same seed and same inputs give the same game (seeded RNG).
17. Touch: a 4-way D-pad of up, down, left and right buttons on the left and a big fire button on the right; only the pressed direction moves the tank; a short tap still turns or nudges the tank; only the visible button area responds.
18. Turning lines the tank up with the grid when it is close and the spot is free; a press up to 0.45 tile early or late still enters an open corridor; it never moves the tank into a wall or another tank.
19. No overlaps or page scrolling at 390x844, 844x390, 320x568, 360x640 and 568x320; all buttons are at least 44 px and D-pad arms at least 56 px, also in 2 player mode. The board fits at 1024x600 and sits on whole device pixels at fractional DPR.
20. Menu taps are debounced; a double tap does not start two games.
21. Keyboard play works: arrows or W A S D, Space or Enter to fire, P or Escape to pause.
22. 2 player mode works with two keyboard sets and a split touch pad in landscape; in portrait the game waits behind a turn-your-phone message.
23. Sound effects and music are made with WebAudio; the mute toggle is saved.
24. Pause, save and resume: pausing (or leaving the page) saves the exact spot mid-level; Continue, even after a reload, resumes it. The Back button pauses instead of leaving.
25. Saves carry a version number; a wrong version or corrupt save is ignored without errors.
26. The PWA has a manifest, icons, a network-first service worker that updates itself, and plays offline after the first load. An update never reloads during play or pause; it waits until Home.
27. The canvas is drawn at devicePixelRatio.
28. No console errors or warnings during the browser tests.
29. Fairness gates with no test aids: the Kid player model wins at least 50% of Easy levels 1-5; Medium is beatable (kid at least 25% of L1-5, pro at least 8% overall); Hard is challenging (pro 3-50% on L1-5 and below Medium).
30. Even undefended, the bird lasts longer than the fastest possible level on every difficulty.
31. Level 1 overlaps less than 30% (tile match and wall Jaccard) with every Battle City stage (tools/originality.js).
32. Prefers-reduced-motion turns off screen shake and cuts particles.
33. Under 4x CPU throttle at 390x844 DPR 3, a busy game runs at least 50 fps with at most 10% of frames over 33 ms.

## v3 additions (QA v2 report)
- FIRE keeps at least 16 px from every D-pad arm at every size, portrait, landscape and 2 players (browser test measures it). Arms stay at least 56 px.
- The kid player model wins at least 30% of every Medium level and at least 50% of every Easy level (per-level gate in npm test).
- On the pause screen, a second Back goes Home; the run is saved and Continue resumes it.
- Perf test gates the median of 3 runs (at least 50 fps, at most 10% of frames over 33 ms).
- Originality check needs the Battle City reference file kept outside the repo; it fails if missing unless SKIP_ORIGINALITY=1.
- Tanks never get nudged backward when turning, and a tank never drives into another tank or a spawning tank.
- Level 1 Frost Garden: mostly brick with a little ice, trees and steel; under 0.30 on both originality metrics.

## v4 additions (QA v3 report)
- BLOCKER fixed: the board always shows the current level. Map versions come from one global counter, the renderer's terrain and tree caches are keyed to the map object as well as its version, and they are cleared on every new game, level, Continue, restore and Home. tests/chain.js plays Next, Home, Play, Continue and reload + restore in ONE page and compares the board pixels with a fresh render of each level.
- Hard ramps: the pro model wins at least 20% of every Hard level (per-level gate in npm test), and Hard stays clearly harder than Medium for both player models.
