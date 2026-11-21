# VICE DUSK — Browser First-Person Shooter

Ein kompakter **GTA-inspirierter First-Person Shooter im Browser**, angesiedelt in einem sonnengebleichten Küstenviertel im **Miami-Stil zur Golden Hour / Dämmerung kurz nach einem Regenschauer**.

Gebaut mit **Three.js**, **TypeScript**, **Vite** und der **Web Audio API** — komplett ohne externe 3D-, Textur- oder Audio-Assets.

> **Live spielen (GitHub Pages):** `https://strangeoptics.github.io/gta_browser/` *(aktivierbar unter Repo Settings → Pages → Source: GitHub Actions)*

![Ocean Drive FPS View — Neon Katana & NEON CLUB](docs/screenshot-fps.png)
![Chase-Cam Driving — Vice PD Interceptor on Ocean Drive](docs/screenshot-driving.png)

---

## Features

- **Miami Coastal District (3×3 Blocks + Ocean Drive, Strand & Begehbarer Club):**
  - Prozedurale Art-Deco-Pastellfassaden, leuchtende Neon-Schilder, zwei beleuchtete **Aussichtsdecks mit Außentreppen** und der **begehbare NEON CLUB (`C`)** am Ocean Drive (pulsierende Tanzfläche, Bar, DJ-Pult, tanzende Gäste & Deckung vor dem Polizei-Heli).
  - **Nasser Post-Rain-Asphalt** mit prozeduraler Pfützen-Roughness-Map, **Drift-Skidmarks**, Brandspuren & Einschusslöchern (`DecalSystem`), Palmen, Strand & animierter Dusk-Ozean-Shader + `UnrealBloomPass`.
  - **Tageszeit & Wetter live umschaltbar:** `T` wechselt zwischen *Golden Hour*, *Miami Sunset* und *Neon Night*; `Y` startet einen **Tropenschauer** mit 3D-Regenstreifen, Wetterleuchten und fernem Donner.
  - **Zerstörbare Street-Props:** Feuerhydranten (mit 11s-Wasserfontäne!), Café-Tische mit Pastell-Sonnenschirmen und Neon-Mülltonnen.
- **First-Person-Gunplay (5 Waffen inkl. Nahkampf) & Drive-By:**
  - **Neon Katana (`0`)** für schnelle Nahkampf-Slashes, **Vice 9mm (`1`)**, **Neon Mac-10 SMG (`2`)**, **Palm 12G Shotgun (`3`)** und **Neon Launcher (`4 · RPG`)** mit Flächenschaden & **Camera-Shake**.
  - 3D-Viewmodels mit Sway, Rückstoß, Mündungsfeuer, ADS-Zoom (`RMB`), Nachladen (`R`), Tracern, Funken & Hitmarkern.
  - **Drive-By-Schießen:** Während der Fahrt mit `LMB` aus dem Fahrerfenster feuern.
- **Fahrbare Retro-Autos, Kollisionsphysik & Speedboat:**
  - 8 Retro-Fahrzeuge (u. a. *Cheetah GT*, *Infernus 86*, *Solaris Cabrio*, *Vice PD Cruiser* & *Interceptor* + Verkehr) mit **solider Auto-zu-Auto-Kollision**, geschwindigkeitsabhängigem **Crash-Schaden**, Rauch/Feuer und **Explosionen mit Kettenreaktionen**.
  - Dynamischer **Scheinwerfer-Lichtkegel (`SpotLight`)**, Drift-Rauch & Reifenquietschen (`Space`), umschaltbare **Chase-/Cockpit-Kamera (`V`)** und **Pay ’n’ Spray Lackiererei (`F`)** zum Reparieren, Umlackieren & Sterne-Löschen.
  - **Stinger Speedboat** direkt am Strandufer (`E`) für rasante Fahrten mit Gischtspur über den Dusk-Ozean.
- **Vice-City-Charaktere, Polizei-KI, Helikopter, Polizeifunk & Story-Heist:**
  - Prozedural texturierte, animierte Charaktere (80s-Sonnenbrillen, Hawaii-Hemden, Pastell-Sakkos, Vice-PD-Uniformen & Syndikat-Anzüge).
  - **1–5 Wanted-Sterne:** Vice-PD-Einheiten zu Fuß, aktive **Polizei-Streifenwagen** ab 2 Sternen, abschießbarer **Vice-PD-Helikopter mit Suchscheinwerfer** ab 3 Sternen und **Vice-PD-Polizeifunk** mit Walkie-Talkie-Rauschen.
  - **3-stufiger Story-Heist „Ocean Club Finale“ (`H`, `+$3.500`):** Fluchtwagen positionieren → Syndikat-Wachen auf der Terrasse ausschalten & Tresorkoffer sichern → unter 4-Sterne-Heat per Speedboat über den Ozean entkommen!
  - **5 rotierende Mini-Missionen** mit 3D-Neon-Beacon & **AMMU-NEON Shop (`B`)** für Medkits, Kevlar-Rüstung (`AR`) & *Neon Launcher*.
- **Miami-Radar, 80s-Radio, Gamepad, Touch & Persistenz:**
  - Mitdrehende Minimap mit Gebäuden, Straßen, Fahrzeugen, `$`-Shop, `P`-Pay-’n’-Spray, `C`-Club, `★`-Heist & `H`-Helikopter.
  - Prozedurale **Web-Audio-Engine** + **3 Synthwave-Radiosender (`Q`)**: *VICE FM*, *DUSK CHILL*, *OUTRUN TURBO*.
  - Voller **Gamepad-Support** (Xbox/PlayStation), automatische **Mobile/Tablet-Touch-Steuerung**, Vite Code-Splitting & `localStorage`-Speicherstand.

---

## Steuerung

| Taste | Aktion |
| :--- | :--- |
| `W` `A` `S` `D` | Bewegen / Fahren / Boot steuern |
| `Maus` | Umsehen / Zielen |
| `Linksklick` / `Rechtsklick` | Schießen (auch Drive-By) / Zielen (ADS) |
| `0` `1` `2` `3` `4` / `Mausrad` | Waffe wechseln (Katana / 9mm / SMG / Shotgun / Launcher) |
| `R` | Nachladen |
| `H` | Ocean Club Story-Heist starten (`+$3.500`) |
| `Shift` / `C` | Sprinten / Ducken |
| `Space` | Springen / Drift-Handbremse im Auto |
| `E` | Auto oder Speedboat ein- / aussteigen |
| `V` | Kamera im Auto wechseln (Chase / Cockpit) |
| `Q` | 80s-Radio-Sender wechseln |
| `F` | Pay ’n’ Spray nutzen (im Auto in der Bucht) |
| `B` | AMMU-NEON Shop öffnen (am Central Plaza) |
| `T` / `Y` | Tageszeit wechseln / Tropenschauer an & aus |
| `M` | Audio stummschalten |
| `ESC` | Pause & Einstellungen |

### Gamepad-Steuerung (Xbox / PlayStation)
- **Linker Stick / Rechter Stick:** Analoges Laufen & Lenken / Umsehen
- **RT / LT:** Schießen & Gas / Zielen (ADS) & Bremse/Rückwärts
- **Y (Dreieck):** Auto & Boot ein-/aussteigen · **X (Viereck):** Nachladen / Pay ’n’ Spray
- **A (Kreuz):** Springen / Handbremse · **LB / RB:** Waffen wechseln (im Auto: Radio / Drive-By)
- **Steuerkreuz:** Rechts = Kamera, Hoch = Tageszeit, Runter = Regen · **Start:** Pause

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
│   └── AudioEngine.ts         # Prozedurale Web-Audio-SFX, Crash, Donner, Sirene & 80s-Radio
├── combat/
│   └── WeaponSystem.ts        # 4 Waffen-Viewmodels, Hitscan/RPG-Explosionen & Drive-By
├── engine/
│   ├── Physics.ts             # AABB-Kollision mit Wall-Sliding & Treppen/Bordstein-Step-Up
│   └── Storage.ts             # localStorage-Speicherstand & Live-Einstellungen
├── entities/
│   ├── CharacterTextures.ts   # Prozedurale Gesichts- & 80s-Outfit-Texturen
│   ├── HelicopterSystem.ts    # Vice-PD-Helikopter mit Suchscheinwerfer & Abschuss
│   └── NpcSystem.ts           # Artikulierte Passanten, Vice-PD-KI & Syndikat-Ziele
├── gameplay/
│   ├── ObjectiveSystem.ts     # 5 rotierende Mini-Missionen & 3D-Neon-Beacon
│   ├── PayNSpray.ts           # Lackiererei (Reparatur, Neulack & Sterne löschen)
│   ├── ShopSystem.ts          # AMMU-NEON Upgrade-Kiosk am Central Plaza
│   └── WantedSystem.ts        # 1–5 Wanted-Sterne & Heat-Abbau
├── hud/
│   └── Minimap.ts             # Mitdrehendes Miami-Radar (2D-Canvas)
├── player/
│   └── PlayerController.ts    # Pointer-Lock FPS-Controller mit Fallback-Steuerung
├── vehicles/
│   ├── BoatSystem.ts          # Fahrbares Stinger Speedboat am Strand
│   └── VehicleSystem.ts       # Retro-Autos, Kollisionen, Crash-Schaden, Explosionen & Polizei-Jäger
├── world/
│   ├── CityBuilder.ts         # 3×3 Miami-Welt, Terrassen, Wetter, Tageszeit, Palmen & Ozean
│   ├── CityLayout.ts          # Deterministisches Stadt-Layout
│   ├── DestructibleProps.ts   # Zerstörbare Hydranten (Wasserfontäne), Cafés & Mülltonnen
│   └── Textures.ts            # Prozedurale Pfützen-, Fassaden- & Neon-Schild-Texturen
└── main.ts                    # Game-Loop, Post-Processing (Bloom) & HUD-Wiring
```

---

## Tech-Stack

- [Three.js](https://threejs.org/) (WebGL2 + `EffectComposer` / `UnrealBloomPass`)
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/)
- Web Audio API & HTML5 Canvas (prozedurale Texturen & Radar)
