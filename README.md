# VICE DUSK — Browser First-Person Shooter

Ein kompakter **GTA-inspirierter First-Person Shooter im Browser**, angesiedelt in einem kleinen, sonnengebleichten Küstenviertel im **Miami-Stil zur Golden Hour / Dämmerung kurz nach einem Regenschauer**.

Gebaut mit **Three.js**, **TypeScript**, **Vite** und der **Web Audio API** — komplett ohne externe 3D-, Textur- oder Audio-Assets.

![Ocean Drive FPS View — Vice 9mm & Neon Palms](docs/screenshot-fps.png)
![Ocean Drive Boardwalk — Neon Mac-10 SMG & Motel Vice](docs/screenshot-smg.png)

---

## Features

- **Miami Coastal District (3×3 Blocks + Ocean Drive):**
  - Prozedurale Art-Deco-Pastellfassaden, leuchtende Neon-Schilder (`HOTEL PALMA`, `OCEAN CLUB`, `CAFE SOL`, `MOTEL VICE`, …) und begehbare Gassen.
  - **Nasser Post-Rain-Asphalt** mit prozeduraler Pfützen-Roughness-Map und `PMREMGenerator`-Abendrot-Reflexionen.
  - Palmen im Küstenwind, Natriumdampf-Straßenlaternen, Strandpromenade, animierter Dusk-Ozean-Shader und `UnrealBloomPass`-Post-Processing.
- **First-Person-Gunplay (3 Waffen):**
  - **Vice 9mm** (Pistole), **Neon Mac-10** (SMG) und **Palm 12G** (Shotgun) mit 3D-Viewmodels, Rückstoß, Mündungsfeuer, ADS-Zoom (`RMB`), Nachladen (`R`), Tracern, Funken und Hitmarkern.
- **Fahrbare Retro-Autos:**
  - 7 Fahrzeuge (u. a. *Cheetah GT*, *Infernus 86*, *Solaris Cabrio*, *Vice PD Cruiser* + fahrender Verkehr).
  - Arcade-Fahrphysik mit Handbremse (`Space`) sowie umschaltbarer **Chase-** und **Cockpit-Kamera** (`V`).
- **GTA-Gameplay-Loop & Kleine Ziele:**
  - Passanten, dynamisch spawnende **Vice-PD-Polizei** und **1–5 Wanted-Sterne** mit Abklingzeit.
  - Rotierende Mini-Missionen mit über die Dächer sichtbarem 3D-Beacon (**Neon Stash**, **Hot Wheels Drop-Off**, **Syndikat-Ziel**).
- **Miami-Radar & Prozedurale Web-Audio-Engine:**
  - Mitdrehende Minimap (unten links) mit Gebäuden, Straßen, Fahrzeugen, Polizei und Zielmarker.
  - Synthetisierte Schuss-, Schritt-, Motor-, Sirenen-, Treffer- und Missions-Sounds plus dezenter 80s-Synthwave-Puls (`M` zum Stummschalten).

---

## Steuerung

| Taste | Aktion |
| :--- | :--- |
| `W` `A` `S` `D` | Bewegen / Fahren |
| `Maus` | Umsehen / Zielen |
| `Linksklick` / `Rechtsklick` | Schießen / Zielen (ADS) |
| `1` `2` `3` / `Mausrad` | Waffe wechseln (9mm / SMG / Shotgun) |
| `R` | Nachladen |
| `Shift` | Sprinten |
| `Space` | Springen / Handbremse im Auto |
| `C` / `Ctrl` | Ducken |
| `E` | Auto ein- / aussteigen |
| `V` | Kamera im Auto wechseln (Chase / Cockpit) |
| `M` | Audio stummschalten |
| `ESC` | Pause |

---

## Lokal starten

Voraussetzung: **Node.js 18+**

```bash
npm install
npm run dev
```

Danach im Browser öffnen: `http://localhost:5173/`

### Production-Build

```bash
npm run build
npm run preview
```

---

## Projektstruktur

```text
src/
├── audio/
│   └── AudioEngine.ts       # Prozedurale Web-Audio-SFX, Motor, Sirene & Synthwave-Puls
├── combat/
│   └── WeaponSystem.ts      # 3D-Viewmodels, Hitscan-Ballistik, Tracer, Funken & ADS
├── engine/
│   └── Physics.ts           # AABB-Kollision mit Wall-Sliding & Bordstein-Step-Up
├── entities/
│   └── NpcSystem.ts         # Passanten, Vice-PD-KI & Zielpersonen
├── gameplay/
│   ├── ObjectiveSystem.ts   # Rotierende Mini-Ziele & 3D-Neon-Beacon
│   └── WantedSystem.ts      # 1–5 Wanted-Sterne & Heat-Abbau
├── hud/
│   └── Minimap.ts           # Mitdrehendes Miami-Radar (2D-Canvas)
├── player/
│   └── PlayerController.ts  # Pointer-Lock FPS-Controller
├── vehicles/
│   └── VehicleSystem.ts     # Fahrbare Retro-Autos, Verkehr & Chase/Cockpit-Cam
├── world/
│   ├── CityBuilder.ts       # 3×3 Miami-Welt, Himmel, PMREM, Palmen & Ozean-Shader
│   ├── CityLayout.ts        # Deterministisches Stadt-Layout
│   └── Textures.ts          # Prozedurale Pfützen-, Fassaden- & Neon-Schild-Texturen
└── main.ts                  # Game-Loop, Post-Processing (Bloom) & HUD-Wiring
```

---

## Tech-Stack

- [Three.js](https://threejs.org/) (WebGL2 + `EffectComposer` / `UnrealBloomPass`)
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/)
- Web Audio API & HTML5 Canvas (prozedurale Texturen & Radar)
