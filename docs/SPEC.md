# Tank: design doc

## Idea
A top-down 2D tank game for families. You drive a tank through a walled maze and protect a golden bird that sits in a small brick fort at the bottom of the map. Enemy tanks roll in from three gates at the top. Stop all of them to clear the level. It is inspired by classic arcade tank games, but every tank, the bird, the levels, the sounds and the music are original.

## Look
Crisp, modern 2D art drawn in code on a canvas sized to the screen's devicePixelRatio, so it stays sharp on phones. Bricks have mortar and shading, steel has bevels and rivets, water moves, trees sway a little and hide tanks, ice shines. Tanks have rolling treads, a shaded hull and turret, a muzzle flash when they fire, and explosions with fireballs, sparks, smoke and a shock ring.

## Rules
- The map is 13 x 13 tiles. Each tile is split into 2 x 2 half tiles, so brick can be chipped away a piece at a time.
- Brick: blocks tanks and shots, a shot breaks the strip it hits. Steel: blocks everything, only a 3-star gun breaks it. Water: blocks tanks, shots fly over. Trees: tanks drive under them and are hidden. Ice: your tank slides a little after you let go.
- Enemies: basic, fast, rapid-fire and armored (takes 4 hits). About 20 per level (15 on Easy), at most 4 on the map at once (3 on Easy). They spawn from 3 gates.
- Every 4th, 11th and 18th enemy flashes red. Hitting it drops a power-up: star (gun upgrade, up to 3 stars), shield, shovel (steel fort for a while), bomb (all enemies on the map blow up), clock (enemies freeze), tank (extra life).
- The bird sits behind a two layer brick fort. If an enemy shot hits the bird, the level is lost. On Easy the fort starts as steel for 25 seconds. If all players run out of lives, the level is lost.
- Easy, Medium and Hard change enemy count, speed, aim, fire rate and lives.
- 2 players on one device: keyboard W A S D + Space and Arrows + Enter, or a split touch pad in landscape.

## Tech
- Plain JavaScript, no libraries. src/levels.js (data), src/engine.js (pure rules, seeded RNG, fixed 60 Hz steps, runs in Node), src/render.js (canvas art), src/audio.js (WebAudio), src/save.js (versioned save), src/ui/ (screens and controls).
- build.js makes site/ (single page PWA with manifest, icons, network-first service worker, version.json) and an optional single file test copy.
- Version label on the home screen: "v1 - Oct 31 - <commit>".

## Acceptance checklist
1. Home screen shows title, Play (1 player), 2 Players, Easy/Medium/Hard, How to Play, Sound toggle and the label "v1 - Oct 31 - <7 char commit>".
2. Continue appears only when a valid save exists.
3. levels.js holds at least 20 levels, each 13 rows of 13 valid tile characters, kept apart from engine code.
4. In every level each enemy gate and each player spawn can reach the bird by a path that only goes through open ground or brick.
5. Brick breaks in half tile strips; steel stops normal shots; a 3-star shot breaks steel.
6. Water blocks tanks but not shots; trees do not block tanks or shots and are drawn over tanks; ice makes the player slide after letting go.
7. An enemy shot that hits the bird ends the level as lost. Your own shots can not hurt the bird (kid friendly).
8. Enemy count per level is 20 on Medium and Hard and 15 on Easy; at most 4 (Easy 3) are alive at once; they spawn from 3 gates.
9. Four enemy types exist with different speed, fire rate and hit points (armored needs 4 hits).
10. Flashing enemies (4th, 11th, 18th) drop a power-up when hit.
11. Each of the six power-ups does its job: star raises gun tier (max 3), shield blocks hits, shovel turns the fort to steel and back, bomb clears all enemies on the map, clock freezes enemies, tank adds a life.
12. Destroying all enemies wins the level and moves to the next one.
13. Headless sims: across many seeded games no enemy stays stuck in place for more than 6 seconds while not frozen.
14. Headless sims: an autoplay bot (with its shield and the steel fort kept on as test aids) clears every level, so every level can be finished, and the steel fort keeps the bird safe the whole time.
15. Headless sims: with no player defense the bird is eventually attacked (enemy AI heads toward the bird), and games finish without errors.
16. Same seed and same inputs give the same game (seeded RNG).
17. Touch: a 4-way D-pad of up, down, left and right buttons on the left and a big fire button on the right; only the pressed direction moves the tank; a short tap still turns or nudges the tank; only the visible button area responds.
18. Turning lines the tank up with the grid when it is close and the spot is free, and never moves it into a wall.
19. No overlaps or page scrolling at 390x844, 844x390, 320x568 and 360x640; all buttons are at least 44 px.
20. Menu taps are debounced; a double tap does not start two games.
21. Keyboard play works: arrows or W A S D, Space or Enter to fire, P or Escape to pause.
22. 2 player mode works with two keyboard sets and a split touch pad.
23. Sound effects and music are made with WebAudio; the mute toggle is saved.
24. Pause, save and resume: the game saves at each level start and when paused, Continue resumes that level with the saved lives, score and gun tier.
25. Saves carry a version number; a wrong version or corrupt save is ignored without errors.
26. The PWA has a manifest, icons, a network-first service worker that updates itself, and plays offline after the first load.
27. The canvas is drawn at devicePixelRatio.
28. No console errors or warnings during the browser tests.
