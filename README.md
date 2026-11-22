# PALM CITY '86 — Browser First-Person Shooter

Ein kompakter **GTA-inspirierter First-Person Shooter im Browser**, angesiedelt in einem sonnengebleichten Küstenviertel im **Miami-Stil zur Golden Hour / Dämmerung kurz nach einem Regenschauer**.

Gebaut mit **Three.js**, **TypeScript**, **Vite** und der **Web Audio API** — komplett ohne externe 3D-, Textur- oder Audio-Assets.

> **Live spielen (GitHub Pages):** `https://strangeoptics.github.io/gta_browser/` *(aktivierbar unter Repo Settings → Pages → Source: GitHub Actions)*

![Ocean Drive FPS View — Neon Katana, NEON CLUB & Wet Puddles](docs/screenshot-fps.png)
![Chase-Cam Driving — DeLorean DMC-12 on Ocean Drive](docs/screenshot-driving.png)

---

## Features

- **Miami Coastal District (3×3 Blocks + 4 große Erweiterungsbezirke in alle Himmelsrichtungen):**
  - Prozedurale Art-Deco-Pastellfassaden, leuchtende Neon-Schilder, organische, nicht-kachelnde **Post-Rain-Straßenpfützen** (Domain-Warped + Weltkoordinaten-Shader), zwei **Aussichtsdecks**, funktionierende **Ampeln** an den 4 Hauptkreuzungen, **Laternen-Dunst** und **Neon-Stunt-Rampen** (*INSANE STUNT BONUS!*).
  - **Abschüssiger Miami Beach & 6 m tiefes Meer mit Schwimm-System:** Sanft abfallende Dünen mit spiegelndem **nassem Ufersand**, halbtransparenter Brandung, **South-Beach-Lifeguard-Turm** (begehbar), beleuchtetem **Holzsteg zum Speedboat**, Sonnenliegen, Beachvolleyball-Netz, kreisenden **Möwen** & räumlichem **Meeresrauschen**. Im tiefen 6-m-Meer (Strand, Marina & Hafen) schwimmt der Spieler per **Auftrieb** an der Oberfläche — inkl. **Kraul-Armzügen, Flatter-Beinschlag & Wassertreten** in 3rd-Person sowie Schwimm-Kamera in 1st-Person!
  - **Osten — Starfish Island, Küstenbrücke & 44 m Superyacht „LADY VICE“:**
    - Befahrbare, geschwungene **Neon-Bogenbrücke (Causeway)** übers Meer (`z = -60`, Speedboat passt unten durch!) zur tropischen Privatinsel mit **Kartell-Anwesen „STARFISH ESTATE“** (`+$2.500` Goldtresor, bewacht von **6 Kartell-Sicherheitswachen**), Helipad mit **fliegbarem „VICE MAVERICK“-Helikopter (`M`)** sowie der begehbaren **44-Meter-Superyacht „LADY VICE“** (Planken-Teakdeck, Jacuzzi, Flybridge, drehendes Radar, Yacht-Helipad & `+$1.800` Kapitäns-Gold).
  - **Süden — Vice Port Container-Hafen & Industrie-Docks (`z = +66..+140`):**
    - Industrie-Kaimauer mit Warnstreifen & Pollern, **Wellblech-Container-Schluchten**, **2 animierte 26-Meter-Containerbrücken (Hafenkräne)**, **58-Meter-Frachtschiff „MV VICE TRADER“**, 4 Flutlichtmasten, 2 Hafen-Stunt-Rampen und die **Import-/Export-Halle (`IE`)** mit live aktualisierter 3D-Tafel für 6 gesuchte Kult-Autos (`+$1.500–$2.200` pro Fahrzeug + **`$5.000` Komplett-Bonus**).
  - **Westen — Little Havana, Starlight 80s Diner, Banco de Vice & Vice Customs (`x = -66..-124`):**
    - **VICE CUSTOMS (`T`):** Drive-In Tuning-Garage mit 2-Säulen-Hebebühne, rotierendem 3D-Neon-Felgen-Logo & echten Upgrades (`F` im Auto: **`$600` für Turbo +28 % Topspeed / +32 % Beschleunigung, +50 % Panzerung & permanente Neon-Unterbodenbeleuchtung**; `$400` für neue Neonfarbe & Reparatur).
    - **STARLIGHT 80s DINER (`D`) & LITTLE HAVANA PLAZA:** Begehbares Chrom-Art-Deco-Diner mit Barhockern, roten Vinyl-Booths, farbwechselnder Jukebox & Tresen (`F`: Cuban Burger & Shake für `$40` → 100 % HP), direkt an der kubanischen Plaza mit Kolonial-Fassaden, Balkonen, Markisen, instanzierten Lichterketten & Domino-Tischen.
    - **BANCO DE VICE (`B`):** Begehbare Marmor-Großbank mit 6 Säulen, Schalterhalle und gepanzertem Stahl-Tresorraum inkl. runder Stahltür — **Banküberfall (`F`: `+$3.000` Beute, Alarm-Stroboskop & `4★` Großfahndung)**.
  - **Norden — North Point Küsten-Highway, Vice Marina & Cape Vice Steilküsten-Leuchtturm (`z = -66..-136`):**
    - **North Point Coastal Highway** mit 2 Stunt-Rampen, Autobahn-Schilderbrücke und **Vice Marina (`⚓`)** (Yacht Club, 3 begehbare Holzstege, 4 auf den Wellen wippende Yachten & Segelboote, Schmuggler-Koffer `+$2.000`).
    - **Cape Vice 11-m-Kalkstein-Steilküste & Serpentinen-Küstenstraße:** Gewundene, stufenlos befahrbare Panoramastraße mit Leitplanken & 80s-Kurvenwarnschildern (`<<<`) hoch zum Gipfel-Plateau mit dem **26-m-Leuchtturm (`L`, ~39 m Gesamthöhe, rotierender Doppellicht-Strahl)**, Wärterhaus, Aussichtsplattform (`F`: `+$1.000` Entdecker-Bonus & 100 % HP) und **Cliff-Jump-Stunt-Rampe**.
  - **Begehbarer NEON CLUB (`C`):** Rotierende **Spiegel-Discokugel**, 4 bis zum Boden reichende **Effektstrahler**, beleuchtete Bar mit **Barkeeper & Miami Vice Cocktails (`F`, `$50`, auch bei 100 % HP)** — ab dem 2. Cocktail treten **stufenweise Betrunkenheits-Effekte** beim Laufen, Schießen, Fahren und in der Kamera auf — plus DJ-Pult, Subwoofer-Türme, 5 Tänzer und **räumliche 126-BPM-Clubmusik**.
  - **Begehbare Polizeistation — VICE PD · PRECINCT 06 (`PD` in West Downtown `-40, 0`):**
    - Art-Deco-Revier mit blauen Kugellampen, automatischen Glasschiebetüren, begehbarer Außentreppe zum **Dach-Helipad (`H`)**, Empfangstresen mit Desk-Sergeant, dynamischer **„MOST WANTED“-Pinnwand**, **Donut-Bar** (3D-Hand) und **2 Gitterzellen** (mit automatischer Schiebe-Zellentür).
    - **Asservaten- & Waffenkammer:** Kostenlose **Kevlar-Weste (`100 %`)**, **Shotgun + Munition**, **Vice-PD-Uniform** (5. Outfit) sowie ein **Syndikat-Geldkoffer (`+$1.500`)** — Diebstahl löst sofort rotes Alarmlicht, Code-3-Funk & Fahndung aus!
    - **Kaution, „VERHAFTET“ & Vigilante:** Sterne am Tresen wegbestechen (`F`), GTA-Verhaftung bei 2+★ mit **Knast-Respawn in Zelle 2** (Waffen bleiben erhalten), Verstärkung direkt vom Revier & **Bürgerwehr-Modus (`G`)** in jedem Vice-PD-Streifenwagen.
  - **Tageszeit, Wetter & Zerstörung:** `T` (Golden Hour / Sunset / Neon Night), `Y` (Tropenschauer mit Blitz & Donner), zerstörbare Hydranten (mit Wasserfontäne!), Café-Tische & Mülltonnen.
- **First- & Third-Person-Gunplay (5 Waffen inkl. Nahkampf), Deckungssystem & Drive-By:**
  - Umschaltbar zu Fuß per **`V`** zwischen **First-Person** und **3rd-Person (Over-the-Shoulder mit 80s-Spielermodell)**.
  - **GTA-Deckungssystem (`Q` / `X`):** An Wänden, Autos, Barrikaden & Mauern in Deckung gehen, mit **`A/D`** entlanggleiten, per **Rechtsklick (ADS)** über niedrige Deckungen auftauchen oder um Hausecken spähen — inkl. echtem Kugelschutz gegen feindliches Feuer.
  - **Neon Katana (`0`)**, **Vice 9mm (`1`)**, **Neon Mac-10 SMG (`2`)**, **Palm 12G Shotgun (`3`)**, **Neon Launcher (`4 · RPG`)** + **Drive-By-Schießen (`LMB`)** aus dem Fahrzeug.
- **Kult- & Spezialfahrzeuge, Superbike, Speedboat & Fliegbarer Helikopter:**
  - **11 individuelle 3D-Automodelle** mit extrudierten Karosserieprofilen & detaillierten Rädern: **DeLorean DMC-12**, **Tesla Cybertruck**, **1982 Pontiac Firebird Trans Am** (mit animiertem rotem **K.I.T.T.-Scanner**!), **Dodge Challenger**, **1986 Fleetwood Bounder** (Wohnmobil), **1974 Dodge Monaco** (*Bluesmobile* mit Dach-Megaphon), **Vice PD Cruiser / Interceptor**, **Cheetah GT** sowie die **3 klassischen GTA-Spezialfahrzeuge**:
    - **80s-Checker-Taxi („VICE CAB“):** Fahrgäste per **`G`** unter Zeitlimit mit **Drift- & Sprung-Trinkgeld-Bonus** durch alle Bezirke kutschieren.
    - **Feuerwehrwagen („VICE FIRE ENGINE 06“):** Mit schwenk- & neigbarer **Hochdruck-Wasserkanone** (`LMB` / `C` + Maus/Pfeile) brennende Autowracks im Einsatz (`G`) löschen oder Passanten & Polizisten wegspritzen.
    - **Rettungswagen („VICE EMS AMBULANCE“):** Verletzte per **`G`** retten & zum EMS-Depot bringen — schaltet nach **5 Rettungen dauerhaft 150 Max-HP** frei!
  - Plus die hochdetaillierte **PCJ-86 Neon-Superbike**, das **Stinger Speedboat** und der **fliegbare „VICE MAVERICK“-Helikopter** (`Space`/`C` Höhe, `WASD` Fliegen)!
  - Auto-zu-Auto-Kollisionen, Crash-Schaden, **Explosionen**, **Brems- & Rückfahrlichter**, Drift-Rauch & `InstancedMesh`-Skidmarks sowie **Pay ’n’ Spray (`F`)**.
  - **1–5 Wanted-Sterne:** Solide Gebäude-, Fahrzeug- & Safehouse-Kollision für alle NPCs, verfolgende **Vice-PD-Streifenwagen** (ab 2★), **Polizei-Straßensperren** & abschießbarer **Vice-PD-Helikopter mit Suchscheinwerfer** (ab 3★) plus **Polizeifunk**.
- **Eigene Basis — VICE SAFEHOUSE (`⌂` am Nord-Ocean-Drive):**
  - Begehbare 2-Ebenen-Art-Deco-Villa mit **automatischem Rolltor** (private Garage mit engem Nahbereichs-Sensor), **automatischen Glasschiebe- & Innentüren**, Lounge (Sofa, **einschaltbarer 80s-CRT-TV „VICE CHANNEL 6“**, **öffenbarer Waffenschrank** mit allen 5 3D-Waffen, Kleiderschrank mit 5 Outfits, Tresor), **Küchenzeile mit selbstöffnendem Kühlschrank** und **Penthouse-Dachterrasse mit eingelassenem, begehbarem Pool** inkl. Unterwasser-Stufen & schwimmendem **Einhorn-Schwimmreifen**.
  - **Interaktive Gameplay-Funktionen:**
    - **VICE CHANNEL 6 News-TV:** Fadenkreuz auf den Fernseher richten (wechselt zur **3D-Hand**) und per **`LMB` / `F`** ein- oder ausschalten — animierter 80s-Nachrichtensprecher, dynamischer Breaking-News-Ticker (reagiert auf Wanted-Sterne & Cash), Synth-Intro-Jingle & echte `en-US`-Sprachausgabe (`Web Speech API`).
    - **Küche & Kühlschrank:** 10 essbare Snacks & Drinks im Kühlschrank und auf der Theke — beim Anvisieren erscheint die **3D-Hand** zum Nehmen & Essen (`LMB` / `F`, auch bei 100 % HP).
    - **Waffenschrank:** Doppeltüren öffnen sich automatisch beim Herantreten; anvisierte Waffen können per **3D-Hand** (`LMB` / `F`) direkt ausgerüstet und aufgefüllt werden.
    - **Basis-Services:** Kostenlos **Heilen, Munition auffüllen & Speichern (`F`)** in der Lounge, **4 wechselbare 80s-Outfits (`F`)** am Kleiderschrank (gespeichert in `localStorage`), **gratis Garagen-Reparatur (`F`)**, schnellerer Wanted-Abbau drinnen & Safehouse-Respawn.
- **Story-Heist, Mini-Missionen, Fotomodus (`P`) & Komfort:**
  - **3-stufiger Story-Heist „Ocean Club Finale“ (`H`, `+$3.500`)**, 5 rotierende Mini-Missionen & **AMMU-NEON Shop (`B`)** (Medkits, Kevlar-Armor, Launcher).
  - **Fotomodus (`P`):** Welt einfrieren, freie Flugkamera (`WASD` + `E`/`Q`) und PNG-Screenshot per **`K`** speichern.
  - Miami-Radar, **3 Synthwave-Radiosender (`Q`)**, **Gamepad-Support**, **Mobile/Tablet-Touch-Steuerung**, Vite Code-Splitting & `localStorage`-Speicherstand.

---

## Steuerung

| Taste | Aktion |
| :--- | :--- |
| `W` `A` `S` `D` | Bewegen / Fahren / Boot steuern |
| `Maus` | Umsehen / Zielen |
| `Linksklick` / `Rechtsklick` | Schießen (auch Drive-By) · Feuerwehr-Wasserwerfer · Interagieren (3D-Hand) / Zielen (ADS & Spähen aus Deckung) |
| `0` `1` `2` `3` `4` / `Mausrad` | Waffe wechseln (Katana / 9mm / SMG / Shotgun / Launcher) |
| `R` | Nachladen |
| `H` | Ocean Club Story-Heist starten (`+$3.500`) |
| `G` | Spezialfahrzeug-Einsatz starten / beenden (Vigilante / Taxi / Feuerwehr / Rettungswagen) |
| `X` / `Q` (zu Fuß an Deckung) | In Deckung gehen / verlassen (`A/D` entlanggleiten, `RMB` spähen & feuern) |
| `Shift` / `C` | Sprinten / Ducken (im Feuerwehrwagen: Wasserwerfer-Alternative) |
| `Space` / `C` | Springen / Ducken · Im Auto: Drift-Handbremse · Im Helikopter: Steigen / Sinken |
| `E` | Auto, Motorrad, Speedboat oder Helikopter ein- / aussteigen |
| `V` | Kamera wechseln (zu Fuß: 1st/3rd-Person · im Auto: Chase/Cockpit) |
| `Q` | 80s-Radio-Sender wechseln (oder zu Fuß nahe Deckung: Deckung ein/aus) |
| `F` | Interagieren: Pay ’n’ Spray / Vice Customs Tuning / Safehouse / PD / Diner / Bank / Marina / Leuchtturm / Club |
| `B` | AMMU-NEON Shop öffnen (am Central Plaza) |
| `T` / `Y` | Tageszeit wechseln / Tropenschauer an & aus |
| `P` / `K` | Fotomodus an & aus / PNG-Screenshot im Fotomodus |
| `M` | Audio stummschalten |
| `ESC` | Pause & Einstellungen (inkl. Sensitivität, **Maus Y-Achse umkehren**, Lautstärke & Performance-Modus) |

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
│   └── WeaponSystem.ts        # 5 Waffen-Viewmodels, 3D-Hand-Interaktion, Hitscan/RPG & Drive-By
├── engine/
│   ├── Physics.ts             # AABB-Kollision mit Wall-Sliding & Treppen/Bordstein-Step-Up
│   └── Storage.ts             # localStorage-Speicherstand & Live-Einstellungen
├── entities/
│   ├── CharacterTextures.ts   # Prozedurale Gesichts- & 80s-Outfit-Texturen
│   ├── HelicopterSystem.ts    # Vice-PD-Helikopter mit Suchscheinwerfer & Abschuss
│   └── NpcSystem.ts           # Artikulierte Passanten, Vice-PD-KI & Syndikat-Ziele
├── gameplay/
│   ├── HeistSystem.ts         # 3-stufiger Story-Heist "Ocean Club Finale" (+$3.500)
│   ├── ObjectiveSystem.ts     # 5 rotierende Mini-Missionen & 3D-Neon-Beacon
│   ├── PayNSpray.ts           # Lackiererei (Reparatur, Neulack & Sterne löschen)
│   ├── ShopSystem.ts          # AMMU-NEON Upgrade-Kiosk am Central Plaza
│   ├── SpecialVehicleMissions.ts # Taxi (VICE CAB), Feuerwehr (Wasserwerfer) & Rettungswagen (150 Max-HP)
│   ├── VigilanteSystem.ts     # Bürgerwehr-Modus ([G]) in Vice-PD-Streifenwagen
│   └── WantedSystem.ts        # 1–5 Wanted-Sterne & Heat-Abbau
├── hud/
│   └── Minimap.ts             # Mitdrehendes Miami-Radar (2D-Canvas)
├── player/
│   ├── PlayerAvatar.ts        # 3rd-Person-Protagonist (5 Outfits, Schwimmen & Deckungspose)
│   └── PlayerController.ts    # Pointer-Lock FPS/3rd-Person-Controller mit Deckungssystem & Spähen
├── vehicles/
│   ├── BoatSystem.ts          # Fahrbares Stinger Speedboat (Strand, Starfish Island & Yacht)
│   ├── CarBuilder.ts          # 11 individuelle 3D-Automodelle (inkl. Checker Taxi, Ambulance & Feuerwehr mit Wasserkanone)
│   ├── MotorcycleBuilder.ts   # Hochdetailliertes 80s-Superbike (PCJ-86 Neon Bike)
│   ├── PlayerHelicopterSystem.ts # Fliegbarer „VICE MAVERICK“-Helikopter auf Starfish Island
│   └── VehicleSystem.ts       # Fahrzeugphysik, Kollisionen, Crash-Schaden, Explosionen & Polizei-Jäger
├── world/
│   ├── BeachProps.ts          # Lifeguard-Turm, Holzsteg, Sonnenliegen, Volleyball & Möwen
│   ├── CityBuilder.ts         # Miami-Welt, Instanced-Palmen, fester Licht-Pool, Strand, Wetter & Ozean
│   ├── CityLayout.ts          # Deterministisches Stadt-Layout & Weltgrenzen
│   ├── DecalSystem.ts         # 3 InstancedMesh-Ringbuffer für Skidmarks, Brandspuren & Einschusslöcher
│   ├── DestructibleProps.ts   # Zerstörbare Hydranten (Wasserfontäne), Cafés & Mülltonnen
│   ├── NeonClub.ts            # Begehbarer NEON CLUB (Discokugel, Strahler, Bar, Barkeeper, DJ)
│   ├── NorthPoint.ts          # Küsten-Highway, Vice Marina (Yacht Club, Stege, Yachten) & 11m-Steilküsten-Leuchtturm mit Serpentine
│   ├── PoliceStation.ts       # Begehbare VICE PD Polizeistation (Zellen, Asservaten, Helipad)
│   ├── RoadblockSystem.ts     # Vice-PD-Straßensperren mit durchbrechbaren Barrikaden
│   ├── Safehouse.ts           # Begehbare VICE SAFEHOUSE Villa (Garage, Küche, Waffenschrank, TV, Einhorn-Pool)
│   ├── StarfishIsland.ts      # Neon-Küstenbrücke, Starfish Island (Kartell-Villa) & 44m Superyacht „LADY VICE“
│   ├── StuntRamps.ts          # Neon-Stunt-Rampen für Insane Stunt Bonuses
│   ├── Textures.ts            # Prozedurale Domain-Warped-Pfützen-, Sand-, Fassaden- & Neon-Texturen
│   ├── TrafficLights.ts       # Funktionierende Ampeln an den 4 Hauptkreuzungen
│   ├── ViceNewsTv.ts          # Prozeduraler 80s-US-Nachrichtensender (Canvas-Studio, Ticker & Speech API)
│   ├── VicePort.ts            # Container-Hafen, 26m Hafenkräne, 58m Frachter & Import/Export-Halle
│   └── WestDistrict.ts        # Little Havana Plaza, Starlight 80s Diner, Banco de Vice & Vice Customs Tuning-Garage
└── main.ts                    # Game-Loop, Post-Processing (Bloom) & HUD-Wiring
```

---

## Tech-Stack

- [Three.js](https://threejs.org/) (WebGL2 + `EffectComposer` / `UnrealBloomPass`)
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/)
- Web Audio API & HTML5 Canvas (prozedurale Texturen & Radar)
