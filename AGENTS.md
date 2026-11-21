# AGENTS.md — VICE DUSK

Guidance for coding agents working in this repository.

## Project Overview

**VICE DUSK** is a browser-based, GTA-inspired 1st/3rd-person shooter and driving game set in a compact 3×3 Miami coastal district at golden hour / dusk shortly after a rain shower.

- **Stack:** TypeScript 5, Vite 6, Three.js (WebGL2 + `EffectComposer` / `UnrealBloomPass`), Web Audio API, vanilla HTML/CSS HUD overlay.
- **Zero external assets:** All 3D geometry, PBR/canvas textures, and sound effects/music are generated procedurally in code. Keep it procedural unless the user explicitly asks to introduce external `.glb`/audio files.
- **UI language:** All user-facing HUD text, prompts, toasts, and overlays are in **German**.

---

## Commands & Verification

- **Dev server:** `npm run dev` (serves on `http://localhost:5173/`)
- **Typecheck & production build:** `npm run build` (runs `tsc && vite build`)
- Always run `npm run build` after edits and ensure **0 TypeScript errors** and **0 Vite chunk-size warnings** (`vite.config.ts` splits `three-core`, `three-postfx`, and app `index` via `manualChunks`).
- Base path is `./` in `vite.config.ts` for GitHub Pages deployment (`.github/workflows/deploy.yml`).

---

## Architecture & File Map

```text
index.html                   # Canvas + all HUD panels, overlays, shop modal, touch controls
src/
├── main.ts                  # Orchestrator: renderer, bloom composer, main loop, input bindings, HUD DOM updates
├── style.css                # Vice Dusk HUD, overlay, shop, photo mode & touch styles
├── types.ts                 # Shared AABB & PlayerStatus types
├── audio/
│   └── AudioEngine.ts       # Procedural Web Audio SFX, 80s radio (3 stations), spatial 126-BPM club music & ocean surf
├── combat/
│   └── WeaponSystem.ts      # 5 weapons (0: Katana, 1: 9mm, 2: SMG, 3: Shotgun, 4: Launcher), ADS, Drive-By, tracers & sparks
├── engine/
│   ├── GamepadInput.ts      # Browser Gamepad API poller returning GamepadSnapshot
│   ├── Physics.ts           # AABB cylinder-approx player collision with wall-sliding, step-up (0.28m) & terrain height
│   ├── Storage.ts           # localStorage persistence for settings & player progress (cash, missions, armor, launcher, outfit)
│   └── TouchControls.ts     # Mobile/tablet virtual stick + buttons (merges into GamepadSnapshot; hidden on desktop)
├── entities/
│   ├── CharacterTextures.ts # Cached 128×128 procedural face (sunglasses/mustache) & 80s outfit canvas textures
│   ├── HelicopterSystem.ts  # Vice PD Chopper (deploys at 3+ stars, sweeping SpotLight, shootable)
│   └── NpcSystem.ts         # Articulated civilians, Vice PD & bounty NPCs, NPC colliders & separation
├── gameplay/
│   ├── HeistSystem.ts       # 3-stage "Ocean Club Finale" story heist (+$3,500)
│   ├── ObjectiveSystem.ts   # 5 rotating mini-objectives (stash, race, bounty, dropoff, survive)
│   ├── PayNSpray.ts         # Drive-in respray bay at (-56, -38): repairs, repaints & clears Wanted stars
│   ├── ShopSystem.ts        # AMMU-NEON kiosk at Central Plaza (-4.5, 4.5)
│   └── WantedSystem.ts      # 0–5 star heat & decay system
├── hud/
│   └── Minimap.ts           # Rotating circular 2D-canvas radar (streets, buildings, vehicles, $, P, C, ⌂, ★, H)
├── player/
│   ├── PlayerAvatar.ts      # 3rd-person 80s protagonist model with 4 switchable outfits & held weapon
│   └── PlayerController.ts  # Pointer-Lock + drag/arrow fallback FPS & Over-the-Shoulder 3rd-person camera (with wall-clip raycast)
├── vehicles/
│   ├── BoatSystem.ts        # Drivable Stinger Speedboat moored off the beach pier (x~111, z=8)
│   └── VehicleSystem.ts     # Cars + PCJ-86 Neon Bike, 2-sphere car-to-car collisions, crash damage, explosions, stunt jumps, AI traffic & police pursuit
└── world/
    ├── BeachProps.ts        # Lifeguard tower, illuminated wooden pier, loungers, volleyball net, dune grass & circling seagulls
    ├── CityBuilder.ts       # Sky dome, PMREM reflections, wet roads, Art-Deco buildings, sloping beach, ocean shader, weather & time-of-day
    ├── CityLayout.ts        # Deterministic 3×3 city grid & reserved walk-in interior blocks
    ├── DecalSystem.ts       # Fixed-cap (150) ring buffer for drift skidmarks, blast scorches & bullet holes
    ├── DestructibleProps.ts # Smashable hydrants (water geyser), café tables & neon bins
    ├── NeonClub.ts          # Walk-in NEON CLUB (40, 0): disco ball, floor-reaching spotlights, bar, bartender, DJ & dancers
    ├── RoadblockSystem.ts   # Vice PD roadblocks at 3+ stars with smashable barricades
    ├── Safehouse.ts         # Walk-in 2-level VICE SAFEHOUSE (40, -40): auto roll-up garage, sliding doors, kitchenette/fridge, recessed rooftop pool
    ├── StuntRamps.ts        # Neon stunt ramps (beach & downtown)
    ├── Textures.ts          # Procedural wet asphalt/puddle, beach sand, sidewalk, Art-Deco facade & neon sign textures
    └── TrafficLights.ts     # Working 3-phase traffic signals at the 4 central intersections
```

---

## World Coordinates & Spatial Invariants

Respect these coordinates when adding buildings, props, or spawn points:

- **Road centers (X and Z):** `-60, -20, 20, 60` (`ROAD_WIDTH = 12`).
- **Block centers (X and Z):** `-40, 0, 40` (`BLOCK_SIZE = 28`, sidewalks at `y = 0.18`).
- **Ocean Drive Boardwalk:** `x = 66..74`, `y = 0.22`, seawall at `x = 73.7` with walkable openings.
- **Sloping Beach & Ocean:**
  - Beach spans `x = 74..120`, height defined by `getBeachHeight(x, z)` (`+0.20` at boardwalk sloping down to `-0.68` underwater).
  - Ocean plane starts at `x = 94` (`y = -0.18`, transparent shallow wash).
  - Wooden pier at `z = 8` (`x = 87..108`) leads to the moored Speedboat at `(111, 8)`.
- **Reserved Special Blocks in `CityLayout.ts`:**
  - `row=1, col=1` `(0, 0)`: Central Plaza + **AMMU-NEON Shop** at `(-4.5, 4.5)`.
  - `row=1, col=2` `(40, 0)`: Hollow walk-in **NEON CLUB** (entrance faces `+X` Ocean Drive).
  - `row=0, col=2` `(40, -40)`: Hollow 2-level **VICE SAFEHOUSE** (garage + lounge + recessed rooftop pool).
  - **Pay 'n' Spray:** West avenue at `(-56, -38)`.
  - **Heist Start Beacon:** Ocean Drive at `(60, -26)`.

---

## Key Conventions & Gotchas

1. **Walkable Stairs:** `Physics.ts` uses `maxStepHeight = 0.28`. Every walkable staircase (rooftop decks, lifeguard tower, safehouse stairs, pool exit steps) **must** use step risers `<= 0.24m`.
2. **Bloom Threshold (`0.86`):** `UnrealBloomPass` triggers above `0.86`. Keep `emissiveIntensity > 1.0` strictly for thin neon tubes, signs, headlights, and beacons. Large flat surfaces (pool water, rooftops, floors, walls) must stay `<= 0.35` or they blow out into blinding bloom.
3. **Hollow Interiors & Rooftop Openings:** Never place a single spanning box across a roof that has a recessed pool or skylight, and verify interior partition walls don't intersect recessed basins.
4. **Unified Input Flow:** `GamepadInput.poll()` produces a `GamepadSnapshot`, which `TouchControls.mergeInto()` augments on touch devices. Pass this snapshot into controllers (`PlayerController`, `WeaponSystem`, `VehicleSystem`, `BoatSystem`) rather than duplicating input plumbing.
5. **Collision Layers:**
   - Player on foot collides with `[...world.colliders, ...vehicles.getVehicleColliders(), ...npcs.getNpcColliders()]`.
   - Vehicles filter `worldColliders` to `c.maxY > 0.45` (so cars drive over `0.18m` curbs) plus `roadblocks.getActiveColliders()`, and use 2-sphere bumper capsules for pairwise car-to-car collisions.
6. **Target Registration:** Anything shootable (NPCs, vehicles, destructible props, police helicopter) implements `ShootableTarget` (`{ id, mesh, onHit }`) and is aggregated into `shootables` in `src/main.ts`.
7. **Texture & Geometry Hygiene:** Cache procedural `CanvasTexture`s (as in `CharacterTextures.ts`) and dispose transient particle geometries/materials when their lifetime ends.
