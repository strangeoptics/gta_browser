# AGENTS.md — PALM CITY '86

Guidance for coding agents working in this repository.

## Project Overview

**PALM CITY '86** is a browser-based, GTA-inspired 1st/3rd-person shooter and driving game set in a compact 3×3 Miami coastal district at golden hour / dusk shortly after a rain shower.

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
├── style.css                # Palm City '86 HUD, overlay, shop, photo mode & touch styles
├── types.ts                 # Shared AABB & PlayerStatus types
├── audio/
│   └── AudioEngine.ts       # Procedural Web Audio SFX, 80s radio (3 stations + beat pulse), 8-bit ice cream jingle, Jaws 2-note shark bass, spatial 126-BPM club music & ocean surf
├── combat/
│   └── WeaponSystem.ts      # 5 weapons (0: Katana, 1: 9mm, 2: SMG, 3: Shotgun, 4: Launcher), ADS, Drive-By, tracers & sparks
├── engine/
│   ├── GamepadInput.ts      # Browser Gamepad API poller returning GamepadSnapshot
│   ├── Physics.ts           # AABB cylinder-approx player collision with wall-sliding, step-up (0.28m) & terrain height
│   ├── Storage.ts           # localStorage persistence ($300 cash, missions, armor, launcher, 5 outfits, paramedicRescues/150 Max-HP, invertMouseY & settings)
│   └── TouchControls.ts     # Mobile/tablet virtual stick + buttons (merges into GamepadSnapshot; hidden on desktop)
├── entities/
│   ├── CharacterTextures.ts # Cached 128×128 procedural face (sunglasses/mustache) & 80s outfit canvas textures
│   ├── HelicopterSystem.ts  # Vice PD Chopper (deploys at 3+ stars, sweeping SpotLight, shootable)
│   ├── NpcSystem.ts         # Articulated civilians, Vice PD & bounty NPCs, cover-aware gunfire, ice-cream/donut lure, Big Head hallucination & precinct spawns
│   └── WildlifeSystem.ts    # Flamingos, dolphins, stalker reef sharks (Jaws alarm), pelicans, turtles, roosters, dive-bombing snack-stealing seagull & giant kickable beach ball
├── gameplay/
│   ├── HeistSystem.ts       # 3-stage "Ocean Club Finale" story heist (+$3,500)
│   ├── InteractionRouter.ts # Contextual [F] & [G] interaction dispatcher (garages, tuning, Lowrider arena, vaults, bars, special vehicles)
│   ├── KittAiSystem.ts      # K.I.T.T. German sarcastic AI voice (Web Speech API) & HUD subtitles
│   ├── LowriderBattleSystem.ts # Little Havana Plaza 16-beat Lowrider Hydraulics rhythm battle (+$1,200–$1,800)
│   ├── ObjectiveSystem.ts   # 5 rotating mini-objectives (stash, race, bounty, dropoff, survive)
│   ├── PayNSpray.ts         # Drive-in respray bay at (-56, -38): repairs, repaints & clears Wanted stars
│   ├── ShopSystem.ts        # AMMU-NEON kiosk at Central Plaza (-4.5, 4.5)
│   ├── SpecialVehicleMissions.ts # Taxi (VICE CAB w/ drift/jump tips), Firefighter (aimable water cannon) & Paramedic (5 rescues -> 150 Max-HP)
│   ├── VigilanteSystem.ts   # Police Vigilante mode ([G]) in Vice PD vehicles with escalating bounties
│   └── WantedSystem.ts      # 0–5 star heat & decay system
├── hud/
│   └── Minimap.ts           # 30-Hz rotating circular 2D-canvas radar (all 4 expansion districts + $, P, C, ⌂, PD, IE, T, D, B, ⚓, L, M, ★, H)
├── ui/
│   ├── DomHelpers.ts        # Dirty-checked DOM write helpers & pooled Lowrider rhythm note DOM nodes
│   ├── HudController.ts     # Owns live HUD DOM elements & per-frame status/objective/prompt updates
│   └── ModalController.ts   # Owns AMMU-NEON Shop, Havana Pets, Dev Panel, Mission Phone & Pause Profile/Settings modals
├── player/
│   ├── PlayerAvatar.ts      # 3rd-person 80s protagonist model with 5 outfits, held weapon, cover pose & swimming animations
│   └── PlayerController.ts  # Pointer-Lock + drag/arrow FPS & 3rd-person camera (invertMouseY, GTA cover & peeking [Q/X], wall-clip raycast & swimming)
├── vehicles/
│   ├── BoatSystem.ts        # Drivable Stinger Speedboat (beach pier, Starfish Island & Superyacht docking)
│   ├── CarBuilder.ts        # 12 detailed extruded 3D car models (DeLorean, Cybertruck, Trans Am K.I.T.T., Bounder RV, Monaco, Challenger, Police, Checker Taxi, Ambulance, Firetruck w/ water turret, Cherry Popper '86 Ice Cream Van, Supercar)
│   ├── MotorcycleBuilder.ts # Detailed procedural 80s superbike ("PCJ-86 NEON BIKE") with torus tires, forks, engine & rider
│   ├── PlayerHelicopterSystem.ts # Flyable 80s executive helicopter ("VICE MAVERICK") stationed on Starfish Island Helipad
│   └── VehicleSystem.ts     # Vehicle physics, Vice Customs Turbo/Underglow/Hydraulics, K.I.T.T. Turbo-Boost, DeLorean 88 MPH Time Jump, Flamingo Police hallucination, cliff launches, height-aware collisions, pooled VFX & AI traffic/police
└── world/
    ├── BeachProps.ts        # Lifeguard tower, illuminated wooden pier, loungers, volleyball net, dune grass & circling seagulls
    ├── CityBuilder.ts       # Sky dome, PMREM reflections, instanced palms (per-palm Y), world-space wet road shader, 6m ocean & weather
    ├── CityLayout.ts        # Deterministic 3×3 city grid, reserved walk-in blocks & expanded playableBounds (all 4 cardinal districts)
    ├── DecalSystem.ts       # 3 InstancedMesh ring buffers (constant 3 draw calls) for skidmarks, scorches & bullet holes
    ├── DestructibleProps.ts # Smashable hydrants (water geyser), café tables & neon bins (with flat raycast hitboxes)
    ├── NeonClub.ts          # Walk-in NEON CLUB (40, 0): instanced bottles/disco tiles, spotlights, bar/cocktails (drunk system), bartender, DJ & dancers
    ├── NorthPoint.ts        # North Coastal Highway (z=-66..-136), Vice Marina (3 piers, 4 bobbing yachts, +$2,000 stash) & 11m Cape Vice Sea Cliff with serpentine road & 26m Lighthouse
    ├── PoliceStation.ts     # Walk-in VICE PD PRECINCT 06 (-40, 0): lobby, Desk Sergeant, Wanted board, donuts, 2 cells, evidence armory (+$1,500), helipad
    ├── RoadblockSystem.ts   # Vice PD roadblocks at 3+ stars with smashable barricades
    ├── Safehouse.ts         # Walk-in 2-level VICE SAFEHOUSE (40, -40): tight-sensor garage, sliding doors, kitchenette/fridge, gun cabinet, TV, pool + unicorn float
    ├── StarfishIsland.ts    # Arched Neon Causeway Bridge (z=-60), Starfish Island Estate (+$2,500 vault), & 44m Superyacht "LADY VICE" (+$1,800 stash)
    ├── StuntRamps.ts        # Neon stunt ramps (beach & downtown)
    ├── Textures.ts          # Procedural seamless domain-warped wet asphalt/puddle, beach sand, sidewalk, Art-Deco facade & neon sign textures
    ├── TrafficLights.ts     # Working 3-phase traffic signals at the 4 central intersections
    ├── ViceNewsTv.ts        # Procedural 80s US news channel ("VICE 6 NEWS") with animated anchor, ticker & Web Speech API voice
    ├── VicePort.ts          # South Industrial Container Docks (z=66..140): 26m animated cranes, 58m freighter, stunt ramps & Import/Export warehouse (IE)
    └── WestDistrict.ts      # West District (x=-66..-124): Little Havana Plaza, walk-in Starlight 80s Diner, Banco de Vice (+$3,000 vault) & Vice Customs Tuning Garage
```

---

## World Coordinates & Spatial Invariants

Respect these coordinates when adding buildings, props, or spawn points:

- **Road centers (X and Z):** `-60, -20, 20, 60` (`ROAD_WIDTH = 12`).
- **Block centers (X and Z):** `-40, 0, 40` (`BLOCK_SIZE = 28`, sidewalks at `y = 0.18`).
- **Ocean Drive Boardwalk:** `x = 66..74`, `y = 0.22`, seawall at `x = 73.7` with walkable openings.
- **Sloping Beach & Deep Ocean (`-6.0m` seabed):**
  - Beach spans `x = 74..112`, height defined by `getBeachHeight(x, z)` (`+0.20` at boardwalk sloping to `-0.22` at surf line `x = 98`, then dropping to `-6.0m` deep ocean; North Marina `z < -98.5` & South Port `z > 126.2` are also `-6.0m`).
  - Ocean plane starts at `x = 94` (`y = -0.18`), with North/South bay extensions and opaque deep-water shader across all 3 coastlines.
  - Wooden pier at `z = 8` (`x = 87..108`) leads to the moored Speedboat at `(111, 8)`.
- **Reserved Special Blocks & Expansion Districts in `CityLayout.ts`:**
  - `row=1, col=0` `(-40, 0)`: Hollow walk-in **VICE PD · PRECINCT 06** Police Station (entrance faces `+X` Central Plaza, rooftop helipad).
  - `row=1, col=1` `(0, 0)`: Central Plaza + **AMMU-NEON Shop** at `(-4.5, 4.5)`.
  - `row=1, col=2` `(40, 0)`: Hollow walk-in **NEON CLUB** (entrance faces `+X` Ocean Drive).
  - `row=0, col=2` `(40, -40)`: Hollow 2-level **VICE SAFEHOUSE** (garage + lounge + recessed rooftop pool).
  - **Pay 'n' Spray:** West avenue at `(-56, -38)`.
  - **Heist Start Beacon:** Ocean Drive at `(60, -26)`.
  - **Starfish Island & Superyacht (East):** Arched Causeway Bridge at `z = -60` (`x = 66..148`), Starfish Island (`x = 148..198, z = -84..-20`, `y = 0.68`, Estate vault + Maverick helipad at `(162, -74)`), Superyacht `"LADY VICE"` (`x = 165..179, z = -7..38`).
  - **Vice Port Industrial Docks (South):** Concrete port apron (`x = -68..78, z = 66..126`), 58m freighter (`z = 135`), Import/Export Warehouse (`58, 92`).
  - **West District (West, `x = -66..-124`):** Vice Customs Tuning Garage (`-85, -37.5`), Walk-in Starlight 80s Diner & Little Havana Plaza (`-87, 0`), Walk-in Banco de Vice (`-87, 40`, `+$3,000` vault), West Havana Blvd (`x = -112`).
  - **North Point (North, `z = -66..-136`):** Coastal Highway (`z = -81`), Vice Marina (`x = -50..+36, z = -90..-126`, 3 piers, 4 bobbing yachts, `+$2,000` stash), and 11m Cape Vice Sea Cliff (`78, -114`) with winding serpentine road, 26m Lighthouse, Keeper's Cottage, Scenic Overlook & Cliff-Jump Ramp.

---

## Key Conventions & Gotchas

1. **Walkable Stairs:** `Physics.ts` uses `maxStepHeight = 0.28`. Every walkable staircase (rooftop decks, lifeguard tower, safehouse stairs, pool exit steps, yacht stairs) **must** use step risers `<= 0.24m`.
2. **Bloom Threshold (`0.86`):** `UnrealBloomPass` runs at half-resolution and triggers above `0.86`. Keep `emissiveIntensity > 1.0` strictly for thin neon tubes, signs, headlights, and beacons. Large flat surfaces (pool water, rooftops, floors, walls) must stay `<= 0.35` or they blow out into blinding bloom.
3. **Never Toggle `THREE.Light.visible` or Add/Remove Lights at Runtime:** Changing the active `NUM_POINT_LIGHTS` count triggers synchronous ANGLE/D3D11 shader recompilation stalls (300–1000ms freezes). Keep a small, fixed set of permanent lights, modulate `intensity` (0 when inactive), and pre-compile via `renderer.compile(scene, camera)` at startup.
4. **Hollow Interiors & Rooftop Openings:** Never place a single spanning box across a roof that has a recessed pool or skylight, and verify interior partition walls don't intersect recessed basins.
5. **Unified Input Flow:** `GamepadInput.poll()` produces a `GamepadSnapshot`, which `TouchControls.mergeInto()` augments on touch devices. Pass this snapshot into controllers (`PlayerController`, `WeaponSystem`, `VehicleSystem`, `BoatSystem`, `PlayerHelicopterSystem`) rather than duplicating input plumbing.
6. **Collision Layers & Vertical Clearance:**
   - Player on foot collides with `[...world.colliders, ...vehicles.getVehicleColliders(), ...npcs.getNpcColliders()]`.
   - Vehicles use pre-filtered `world.solidVehicleColliders` (`c.maxY > 0.45 && c.minY < 2.9`) plus vertical overlap checks (`v.position.y < box.maxY && vehTop > box.minY`) so cars/bikes drive cleanly under garage lintels and roofs.
   - NPCs use `world.solidNpcColliders` with per-NPC floor elevation checks (`box.maxY > npcY + 0.35`) so Starfish Island & Superyacht guards walk cleanly on elevated decks.
7. **Target Registration & Flat Hitboxes:** Anything shootable (NPCs, vehicles, destructible props, police helicopter) exposes a single invisible proxy `hitbox` `THREE.Mesh` (`material: { visible: false }`) as `ShootableTarget.mesh` so `WeaponSystem` performs fast non-recursive raycasts (`intersectObjects(..., false)`).
8. **Texture & Geometry Hygiene:** Cache procedural `CanvasTexture`s (as in `CharacterTextures.ts`), use `InstancedMesh` for repeated props/palms/decals, and pool transient particle meshes/materials (`sparkPool`, `smokePool`).
