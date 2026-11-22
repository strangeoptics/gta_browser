import * as THREE from 'three';
import type { NpcEntity, NpcSystem } from '../entities/NpcSystem';
import type { WantedSystem } from './WantedSystem';

export interface StoryStageDef {
  kind: 'goto' | 'eliminate_and_grab' | 'escape_sea';
  title: string;
  description: string;
  targetPos: [number, number, number];
  radius: number;
  beaconColor: string;
  showCase?: boolean;
  enemySpawns?: [number, number, number][];
  heatOnStart?: number;
  speaker: string;
  dialogue: string;
}

export interface StoryChapterDef {
  index: number; // 0..4
  number: number; // 1..5
  districtLabel: string;
  title: string;
  summary: string;
  reward: number;
  finaleBonus?: number;
  stages: StoryStageDef[];
}

export const STORY_CHAPTERS: StoryChapterDef[] = [
  {
    index: 0,
    number: 1,
    districtLabel: 'DOWNTOWN · NEON CLUB',
    title: 'WILLKOMMEN IN VICE',
    summary: 'Triff DJ Roxy vor dem Neon Club, schalte Don Valdez’ Schläger aus und sichere den verschlüsselten Koffer am Central Plaza.',
    reward: 1500,
    stages: [
      {
        kind: 'goto',
        title: 'KAP. 1 · KONTAKT AM CLUB',
        description: 'Triff DJ Roxy am goldenen Beacon vor dem NEON CLUB am Ocean Drive.',
        targetPos: [52, 0.2, 0],
        radius: 4.0,
        beaconColor: '#ffd15c',
        speaker: 'DJ ROXY',
        dialogue: 'Hey, gut dass du da bist! Don Valdez übernimmt die ganze Küste — komm zum Neon Club, ich hab Infos!',
      },
      {
        kind: 'eliminate_and_grab',
        title: 'KAP. 1 · KOFFER AM PLAZA',
        description: 'Schalte Don Valdez’ Schläger aus und sichere den Koffer am Central Plaza.',
        targetPos: [2.2, 0.2, 2.5],
        radius: 3.2,
        beaconColor: '#ff4fa3',
        showCase: true,
        enemySpawns: [
          [6.5, 0.2, 5.5],
          [-2.0, 0.2, -2.0],
        ],
        heatOnStart: 25,
        speaker: 'DJ ROXY',
        dialogue: 'Verdammt, Valdez’ Leute haben uns gehört! Hol den Datenkoffer am Central Plaza, bevor sie ihn vernichten!',
      },
    ],
  },
  {
    index: 1,
    number: 2,
    districtLabel: 'WEST · LITTLE HAVANA',
    title: 'HAVANA-SCHULDEN',
    summary: 'Hol Tresor-Codes von Carlos am Starlight Diner, schalte die Kartell-Wachen an der Banco de Vice aus und bring die Beweise ins Safehouse.',
    reward: 2200,
    stages: [
      {
        kind: 'goto',
        title: 'KAP. 2 · STARLIGHT DINER',
        description: 'Fahr nach Little Havana zum Starlight 80s Diner und triff Informant Carlos.',
        targetPos: [-74, 0.2, -4],
        radius: 4.5,
        beaconColor: '#36f1e6',
        speaker: 'CARLOS „EL TIGER“',
        dialogue: 'Die Codes für Valdez’ Geldwäsche liegen bereit — komm ins Starlight Diner nach Little Havana!',
      },
      {
        kind: 'eliminate_and_grab',
        title: 'KAP. 2 · BANCO DE VICE',
        description: 'Schalte die 3 Kartell-Wachen an der Banco de Vice aus und schnapp dir die Akten.',
        targetPos: [-74, 0.2, 40],
        radius: 3.6,
        beaconColor: '#ff4fa3',
        showCase: true,
        enemySpawns: [
          [-70, 0.2, 36],
          [-76, 0.2, 44],
          [-80, 0.2, 38],
        ],
        heatOnStart: 75,
        speaker: 'CARLOS „EL TIGER“',
        dialogue: 'Valdez’ Leibwächter räumen gerade das Schließfach in der Banco de Vice leer — schnapp dir die Beweisakten!',
      },
      {
        kind: 'goto',
        title: 'KAP. 2 · ZURÜCK INS SAFEHOUSE',
        description: 'Bring die Beweisakten sicher zu deiner Vice-Safehouse-Einfahrt am Ocean Drive!',
        targetPos: [54, 0.2, -34.3],
        radius: 5.5,
        beaconColor: '#52f29c',
        speaker: 'DJ ROXY',
        dialogue: 'Saubere Arbeit! Die Cops sind hellhörig — bring die Akten sofort zurück zum Vice Safehouse!',
      },
    ],
  },
  {
    index: 2,
    number: 3,
    districtLabel: 'SÜD · VICE PORT',
    title: 'HAFEN-BLOCKADE',
    summary: 'Stürme den Containerhafen vor dem 58m-Frachter, schalte Valdez’ Schmuggler aus und entkomme über das Import/Export-Tor.',
    reward: 3000,
    stages: [
      {
        kind: 'eliminate_and_grab',
        title: 'KAP. 3 · FRACHTER-KAI',
        description: 'Schalte die 3 Schmuggler am Südkai im Vice Port aus und hol die Frachtpapiere.',
        targetPos: [10, 0.2, 118],
        radius: 3.6,
        beaconColor: '#ff4fa3',
        showCase: true,
        enemySpawns: [
          [4, 0.2, 112],
          [16, 0.2, 112],
          [10, 0.2, 106],
        ],
        heatOnStart: 80,
        speaker: 'CARLOS „EL TIGER“',
        dialogue: 'Die Akten zeigen eine Riesenlieferung am Südkai von Vice Port! Zerschlag den Deal direkt vor dem Frachter!',
      },
      {
        kind: 'goto',
        title: 'KAP. 3 · FLUCHT AUS DEM HAFEN',
        description: 'Durchbrich die Fahndung und erreiche den Treffpunkt am Import/Export-Lager!',
        targetPos: [58, 0.2, 92],
        radius: 5.5,
        beaconColor: '#ffd15c',
        heatOnStart: 155,
        speaker: 'DJ ROXY',
        dialogue: '3-Sterne-Alarm im Hafen! Vollgas Richtung Import/Export-Lager im Osten des Docks!',
      },
    ],
  },
  {
    index: 3,
    number: 4,
    districtLabel: 'NORD · NORTH POINT',
    title: 'LEUCHTTURM-SIGNAL',
    summary: 'Hol den Peilsender an der Vice Marina, klettere über die Serpentinen zum 26m Cape-Vice-Leuchtturm und schalte Valdez’ Funkrelais aus.',
    reward: 3800,
    stages: [
      {
        kind: 'goto',
        title: 'KAP. 4 · VICE MARINA STEG',
        description: 'Hol den Peilsender am mittleren Holzsteg der Vice Marina im Norden.',
        targetPos: [-8, 0.9, -116],
        radius: 3.8,
        beaconColor: '#36f1e6',
        showCase: true,
        speaker: 'CAPTAIN RICO',
        dialogue: 'Don Valdez steuert seine Flotte über ein Funkrelais am Cape-Vice-Leuchtturm. Hol meinen Störsender am Marina-Steg!',
      },
      {
        kind: 'eliminate_and_grab',
        title: 'KAP. 4 · CAPE VICE KLIPPE',
        description: 'Erklimme die Serpentinen zum Leuchtturm, schalte 3 Wachen aus & aktiviere das Störsignal!',
        targetPos: [78, 11.1, -118],
        radius: 4.2,
        beaconColor: '#ff4fa3',
        showCase: true,
        enemySpawns: [
          [74, 11.1, -112],
          [82, 11.1, -110],
          [78, 11.1, -122],
        ],
        heatOnStart: 90,
        speaker: 'CAPTAIN RICO',
        dialogue: 'Stark! Jetzt die Serpentinen hoch zur 11-Meter-Klippe am Leuchtturm — räum Valdez’ Funktrupp aus dem Weg!',
      },
    ],
  },
  {
    index: 4,
    number: 5,
    districtLabel: 'OST · STARFISH & YACHT',
    title: 'DON VALDEZ’ FALL',
    summary: 'Das große Finale: Stürme Starfish Estate, stelle Don Valdez persönlich und entkomme über das offene Meer (Superyacht, Speedboat oder Heli)!',
    reward: 6000,
    finaleBonus: 5000,
    stages: [
      {
        kind: 'eliminate_and_grab',
        title: 'FINALE 1/2 · STARFISH ESTATE',
        description: 'Überquere die Causeway-Brücke, eliminiere DON VALDEZ & seine Elite-Garde und sichere das Gold!',
        targetPos: [172, 0.72, -55],
        radius: 4.0,
        beaconColor: '#ff4fa3',
        showCase: true,
        enemySpawns: [
          [172, 0.72, -55], // Don Valdez
          [167, 0.72, -59],
          [167, 0.72, -51],
          [176, 0.72, -55],
        ],
        heatOnStart: 165,
        speaker: 'DON VALDEZ',
        dialogue: 'Du wagst es auf meine Insel?! Meine Garde wird dich im Sonnenuntergang von Starfish Island begraben!',
      },
      {
        kind: 'escape_sea',
        title: 'FINALE 2/2 · FREIHEIT AUF SEE',
        description: '4★ Großfahndung! Flieh mit der SUPERYACHT „LADY VICE“, Speedboat oder Maverick zum Ozean-Beacon!',
        targetPos: [228, 0.2, 62],
        radius: 22.0,
        beaconColor: '#36f1e6',
        heatOnStart: 260,
        speaker: 'DJ ROXY',
        dialogue: 'DON VALDEZ IST GESCHICHTE! Schnapp dir seine Superyacht „LADY VICE“, ein Boot oder den Heli und ab aufs offene Meer!',
      },
    ],
  },
];

export interface StoryHudState {
  active: boolean;
  chapterIndex: number;
  chapterNumber: number;
  title: string;
  description: string;
  distanceM: number;
  targetPos: THREE.Vector3 | null;
  dialogueSpeaker: string | null;
  dialogueText: string | null;
  toastText: string | null;
  completedChapterReward: number;
  justCompletedFinale: boolean;
}

export class StoryCampaign {
  public unlockedChapters = 0; // 0..5 (count of completed chapters)
  private activeChapter: StoryChapterDef | null = null;
  private stageIdx = 0;
  private stageEnemies: NpcEntity[] = [];

  private readonly scene: THREE.Scene;
  private readonly beaconGroup = new THREE.Group();
  private readonly beam: THREE.Mesh;
  private readonly ring: THREE.Mesh;
  private readonly caseProp: THREE.Mesh;

  private dialogueSpeaker: string | null = null;
  private dialogueText: string | null = null;
  private dialogueTimer = 0;
  private pendingToast: string | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    const beamMat = new THREE.MeshBasicMaterial({
      color: '#ffd15c',
      transparent: true,
      opacity: 0.26,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.4, 34, 16, 1, true), beamMat);
    this.beam.position.y = 17;
    this.beaconGroup.add(this.beam);

    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(1.6, 2.1, 28),
      new THREE.MeshBasicMaterial({ color: '#ffd15c', side: THREE.DoubleSide }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.22;
    this.beaconGroup.add(this.ring);

    this.caseProp = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.55, 0.36),
      new THREE.MeshStandardMaterial({
        color: '#ffd15c',
        emissive: '#ffaa22',
        emissiveIntensity: 2.2,
        metalness: 0.8,
        roughness: 0.2,
      }),
    );
    this.caseProp.position.y = 1.1;
    this.caseProp.visible = false;
    this.beaconGroup.add(this.caseProp);

    this.beaconGroup.visible = false;
    this.scene.add(this.beaconGroup);
  }

  public isActive(): boolean {
    return this.activeChapter !== null;
  }

  public getActiveChapterIndex(): number {
    return this.activeChapter ? this.activeChapter.index : -1;
  }

  public setCompletedChapters(count: number): void {
    this.unlockedChapters = Math.max(0, Math.min(STORY_CHAPTERS.length, Math.floor(count)));
  }

  public getCompletedChapters(): number {
    return this.unlockedChapters;
  }

  public canStartChapter(index: number): boolean {
    return index >= 0 && index < STORY_CHAPTERS.length && index <= this.unlockedChapters;
  }

  public startChapter(index: number, npcs: NpcSystem, wanted: WantedSystem): boolean {
    if (!this.canStartChapter(index)) return false;
    this.clearStageEnemies(npcs);
    this.activeChapter = STORY_CHAPTERS[index];
    this.stageIdx = 0;
    this.setupStage(npcs, wanted);
    this.pendingToast = `STORY KAPITEL ${this.activeChapter.number} · ${this.activeChapter.title}`;
    return true;
  }

  private clearStageEnemies(npcs?: NpcSystem): void {
    if (npcs) {
      for (const e of this.stageEnemies) npcs.removeNpc(e);
    }
    this.stageEnemies = [];
  }

  public cancelChapter(npcs?: NpcSystem): void {
    this.clearStageEnemies(npcs);
    this.activeChapter = null;
    this.stageIdx = 0;
    this.beaconGroup.visible = false;
    this.dialogueTimer = 0;
    this.dialogueSpeaker = null;
    this.dialogueText = null;
  }

  public failChapter(npcs?: NpcSystem): void {
    if (!this.activeChapter) return;
    const num = this.activeChapter.number;
    this.cancelChapter(npcs);
    this.pendingToast = `STORY KAPITEL ${num} GESCHEITERT · [J] FÜR NEUSTART`;
  }

  private setupStage(npcs: NpcSystem, wanted: WantedSystem): void {
    if (!this.activeChapter) return;
    const st = this.activeChapter.stages[this.stageIdx];
    this.stageEnemies = [];

    if (st.enemySpawns) {
      for (const [ex, ey, ez] of st.enemySpawns) {
        const enemy = npcs.spawnBountyTarget(ex, ez, ey);
        enemy.state = 'pursue';
        this.stageEnemies.push(enemy);
      }
    }
    if (st.heatOnStart && st.heatOnStart > 0) {
      wanted.addHeat(st.heatOnStart);
    }

    (this.beam.material as THREE.MeshBasicMaterial).color.set(st.beaconColor);
    (this.ring.material as THREE.MeshBasicMaterial).color.set(st.beaconColor);
    this.caseProp.visible = Boolean(st.showCase);
    this.beaconGroup.position.set(st.targetPos[0], Math.max(0, st.targetPos[1] - 0.12), st.targetPos[2]);
    this.beaconGroup.visible = true;

    this.dialogueSpeaker = st.speaker;
    this.dialogueText = st.dialogue;
    this.dialogueTimer = 7.5;
  }

  public update(
    dt: number,
    elapsed: number,
    playerPos: THREE.Vector3,
    inSeaOrAirCraft: boolean,
    npcs: NpcSystem,
    wanted: WantedSystem,
  ): StoryHudState {
    const toastOut = this.pendingToast;
    this.pendingToast = null;

    if (this.dialogueTimer > 0) {
      this.dialogueTimer = Math.max(0, this.dialogueTimer - dt);
      if (this.dialogueTimer <= 0) {
        this.dialogueSpeaker = null;
        this.dialogueText = null;
      }
    }

    if (!this.activeChapter) {
      this.beaconGroup.visible = false;
      return {
        active: false,
        chapterIndex: -1,
        chapterNumber: 0,
        title: '',
        description: '',
        distanceM: 0,
        targetPos: null,
        dialogueSpeaker: this.dialogueSpeaker,
        dialogueText: this.dialogueText,
        toastText: toastOut,
        completedChapterReward: 0,
        justCompletedFinale: false,
      };
    }

    const st = this.activeChapter.stages[this.stageIdx];
    const targetVec = new THREE.Vector3(...st.targetPos);

    this.beaconGroup.visible = true;
    const pulse = 1 + Math.sin(elapsed * 4.5) * 0.1;
    this.ring.scale.set(pulse, pulse, 1);
    if (this.caseProp.visible) {
      this.caseProp.rotation.y = elapsed * 2.4;
      this.caseProp.position.y = 1.1 + Math.sin(elapsed * 3.2) * 0.15;
    }

    const horizDist = Math.hypot(playerPos.x - targetVec.x, playerPos.z - targetVec.z);
    const dist3D = playerPos.distanceTo(targetVec);
    const aliveEnemies = this.stageEnemies.filter((e) => e.alive).length;

    let stageDone = false;
    if (st.kind === 'goto') {
      if (horizDist < st.radius && Math.abs(playerPos.y - targetVec.y) < 4.0) {
        stageDone = true;
      }
    } else if (st.kind === 'eliminate_and_grab') {
      if (aliveEnemies === 0 && dist3D < st.radius + 1.2) {
        stageDone = true;
      }
    } else if (st.kind === 'escape_sea') {
      if (inSeaOrAirCraft && horizDist < st.radius) {
        stageDone = true;
      }
    }

    if (stageDone) {
      this.stageIdx++;
      if (this.stageIdx >= this.activeChapter.stages.length) {
        // Chapter completed!
        const ch = this.activeChapter;
        const firstTimeClear = ch.index >= this.unlockedChapters;
        if (firstTimeClear) {
          this.unlockedChapters = Math.min(STORY_CHAPTERS.length, ch.index + 1);
        }
        const totalReward = ch.reward + (firstTimeClear && ch.finaleBonus ? ch.finaleBonus : 0);
        const isFinale = ch.index === STORY_CHAPTERS.length - 1;

        this.activeChapter = null;
        this.stageEnemies = [];
        this.beaconGroup.visible = false;

        this.dialogueSpeaker = isFinale ? "PALM CITY '86 · FINALE" : 'DJ ROXY';
        this.dialogueText = isFinale
          ? "Die ganze Küste gehört jetzt dir! Don Valdez ist Geschichte — genieße Palm City '86!"
          : `Kapitel ${ch.number} geschafft! Öffne das Missions-Telefon [J] für Kapitel ${ch.number + 1}!`;
        this.dialogueTimer = 6.5;

        return {
          active: false,
          chapterIndex: -1,
          chapterNumber: ch.number,
          title: '',
          description: '',
          distanceM: 0,
          targetPos: null,
          dialogueSpeaker: this.dialogueSpeaker,
          dialogueText: this.dialogueText,
          toastText: isFinale
            ? `KAMPAGNE ABGESCHLOSSEN! · +$${totalReward.toLocaleString('en-US')}`
            : `KAPITEL ${ch.number} ERFÜLLT · +$${totalReward.toLocaleString('en-US')}`,
          completedChapterReward: totalReward,
          justCompletedFinale: isFinale,
        };
      } else {
        this.setupStage(npcs, wanted);
      }
    }

    const curStage = this.activeChapter.stages[this.stageIdx];
    const curTarget = new THREE.Vector3(...curStage.targetPos);
    const curDist = Math.round(Math.hypot(playerPos.x - curTarget.x, playerPos.z - curTarget.z));
    const desc =
      curStage.kind === 'eliminate_and_grab' && aliveEnemies > 0
        ? `${curStage.description} (${aliveEnemies} Gegner übrig)`
        : curStage.description;

    return {
      active: true,
      chapterIndex: this.activeChapter.index,
      chapterNumber: this.activeChapter.number,
      title: curStage.title,
      description: desc,
      distanceM: curDist,
      targetPos: curTarget,
      dialogueSpeaker: this.dialogueSpeaker,
      dialogueText: this.dialogueText,
      toastText: toastOut,
      completedChapterReward: 0,
      justCompletedFinale: false,
    };
  }
}
