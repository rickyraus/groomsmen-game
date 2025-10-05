/*
Legend of the Best Men - Phaser 3 game.js
Merged prototype and structured tilemap overworld
- Character select
- Tilemap-based Overworld (new tileset)
- Demo turn-based battle system
*/

const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const BASE_SPEED = 36;
const SCALE = 4; // try 2, 3, or 4 to taste
const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

class AudioManager {
    constructor(game) {
        this.sound = game.sound;
        this.currentTrack = null;
    }

    playMusic(key, { volume = 0.6 } = {}) {
        // If same track, do nothing
        if (this.currentTrack && this.currentTrack.key === key) return;

        // Stop any existing music
        if (this.currentTrack) {
            this.currentTrack.stop();
            this.currentTrack.destroy();
        }

        // Start fresh track at full volume
        this.currentTrack = this.sound.add(key, { loop: true, volume });
        this.currentTrack.play();

    }

    stopMusic() {
        if (this.currentTrack) {
            this.currentTrack.stop();
            this.currentTrack.destroy();
            this.currentTrack = null;
        }
    }
}

// --- MuteButton UI ---
class MuteButton {
    constructor(scene) {
        this.scene = scene;
        this.isMuted = false;

        this.button = scene.add.text(GAME_WIDTH - 20, 20, '🔊', {
            font: '20px monospace',
            fill: '#fff',
            backgroundColor: '#00000088',
            padding: { x: 6, y: 2 }
        })
            .setOrigin(1, 0)
            .setScrollFactor(0)
            .setDepth(1000)
            .setInteractive({ cursor: 'pointer' });

        this.button.on('pointerdown', () => this.toggle());
    }

    toggle() {
        this.isMuted = !this.isMuted;
        this.scene.sound.mute = this.isMuted;
        this.button.setText(this.isMuted ? '🔇' : '🔊');
    }
}

class LoadingScene extends Phaser.Scene {
    constructor() { super('LoadingScene'); }

    preload() {
        const { width, height } = this.scale;

        // --- Progress bar ---
        const progressBox = this.add.graphics();
        const progressBar = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);

        const loadingText = this.add.text(width / 2, height / 2 - 50, 'Loading...', {
            fontFamily: 'monospace', fontSize: '20px', fill: '#ffffff'
        }).setOrigin(0.5);

        const percentText = this.add.text(width / 2, height / 2, '0%', {
            fontFamily: 'monospace', fontSize: '18px', fill: '#ffffff'
        }).setOrigin(0.5);

        this.load.on('progress', (value) => {
            progressBar.clear();
            progressBar.fillStyle(0xffffff, 1);
            progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
            percentText.setText(parseInt(value * 100) + '%');
        });

        this.load.once('complete', () => {
            progressBar.destroy();
            progressBox.destroy();
            percentText.setText('100%');
        });

        // --- Core game assets ---
        this.load.image('overworld_tiles', 'assets/tilesets/Overworld.png');
        this.load.image('objects_tiles', 'assets/tilesets/objects.png');
        this.load.image('battle_bg_grass', 'assets/backgrounds/battle_grass.png');
        this.load.tilemapTiledJSON('map', 'assets/tilemaps/overworld.json');
        this.load.json('npcDialogues', 'assets/data/npcDialogues.json');
        this.load.json('characters', 'assets/data/characters.json');

        this.load.audio('overworld_theme', 'assets/audio/overworld_theme.ogg');
        this.load.audio('battle_theme', 'assets/audio/battle_theme.ogg');
        this.load.audio('menu_theme', 'assets/audio/menu_theme.ogg');

        this.load.audio('slash_sfx', 'assets/sfx/slash.ogg');
        this.load.audio('attack_sfx', 'assets/sfx/hit.ogg');
        this.load.audio('heal_sfx', 'assets/sfx/heal.ogg');

        this.load.spritesheet('quest_items', 'assets/sprites/items.png', {
            frameWidth: 341, frameHeight: 1024
        });

        WebFont.load({ google: { families: ['Pixelify Sans', 'VT323'] } });

        // generate a white diagonal slash texture at preload time:
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        g.lineStyle(6, 0xffffff);
        g.beginPath(); g.moveTo(0, 32); g.lineTo(64, 0); g.strokePath();
        g.generateTexture('fx_slash', 64, 32);
    }

    create() {
        const chars = this.cache.json.get('characters');

        // ✅ Only load avatars for non-NPCs
        chars.forEach(ch => {
            if (!ch.isNPC && ch.avatar) {
                this.load.image('avatar_' + ch.id, ch.avatar);
            }

            // NPCs + PCs both get idle/walk sprites if defined
            if (ch.sprites?.idle) {
                this.load.spritesheet(ch.id + '_idle', ch.sprites.idle,
                    { frameWidth: 64, frameHeight: 64 });
            }
            if (ch.sprites?.walk) {
                this.load.spritesheet(ch.id + '_walk', ch.sprites.walk,
                    { frameWidth: 64, frameHeight: 64 });
            }

            if (ch.battleSprites?.back) {
                this.load.image('battle_back_' + ch.id, ch.battleSprites.back);
            }
            if (ch.battleSprites?.front) {
                this.load.image('battle_front_' + ch.id, ch.battleSprites.front);
            }
        });

        this.load.once('complete', () => {
            this.scene.start('BootScene');
        });

        this.load.start();
    }
}

// --- BootScene ---
class BootScene extends Phaser.Scene {
    constructor() { super('BootScene'); }

    create() {
        this.game.audioManager = new AudioManager(this.game);

        this.characters = this.cache.json.get('characters');
        this.game.characters = this.characters;

        // --- Placeholder textures for all characters
        this.characters.forEach(ch => {
            const g = this.add.graphics();
            g.fillStyle(ch.color || 0xffffff, 1);
            g.fillRoundedRect(0, 0, 48, 48, 6);
            g.lineStyle(2, 0x000000, 1);
            g.strokeRoundedRect(0, 0, 48, 48, 6);
            g.generateTexture('char_' + ch.id, 48, 48);
            g.destroy();
        });

        const g2 = this.add.graphics();
        g2.fillStyle(0xffff00, 1);
        g2.fillCircle(16, 16, 16);
        g2.generateTexture('npc_circle', 32, 32);
        g2.destroy();

        // --- Animations ---
        this.characters.forEach(ch => {
            if (ch.sprites?.idle) {
                this.anims.create({
                    key: ch.id + '_idle_up',
                    frames: this.anims.generateFrameNumbers(ch.id + '_idle', { start: 0, end: 1 }),
                    frameRate: 2, repeat: -1
                });
                this.anims.create({
                    key: ch.id + '_idle_left',
                    frames: this.anims.generateFrameNumbers(ch.id + '_idle', { start: 2, end: 3 }),
                    frameRate: 2, repeat: -1
                });
                this.anims.create({
                    key: ch.id + '_idle_down',
                    frames: this.anims.generateFrameNumbers(ch.id + '_idle', { start: 4, end: 5 }),
                    frameRate: 2, repeat: -1
                });
                this.anims.create({
                    key: ch.id + '_idle_right',
                    frames: this.anims.generateFrameNumbers(ch.id + '_idle', { start: 6, end: 7 }),
                    frameRate: 2, repeat: -1
                });
            }

            if (ch.sprites?.walk) {
                this.anims.create({
                    key: ch.id + '_walk_up',
                    frames: this.anims.generateFrameNumbers(ch.id + '_walk', { start: 0, end: 8 }),
                    frameRate: 10, repeat: -1
                });
                this.anims.create({
                    key: ch.id + '_walk_left',
                    frames: this.anims.generateFrameNumbers(ch.id + '_walk', { start: 9, end: 17 }),
                    frameRate: 10, repeat: -1
                });
                this.anims.create({
                    key: ch.id + '_walk_down',
                    frames: this.anims.generateFrameNumbers(ch.id + '_walk', { start: 18, end: 26 }),
                    frameRate: 10, repeat: -1
                });
                this.anims.create({
                    key: ch.id + '_walk_right',
                    frames: this.anims.generateFrameNumbers(ch.id + '_walk', { start: 27, end: 35 }),
                    frameRate: 10, repeat: -1
                });
            }
        });

        this.scene.start('TitleScene');
    }
}

// --- TitleScene ---
class TitleScene extends Phaser.Scene {
    constructor() { super('TitleScene'); }

    create() {
        const { width, height } = this.scale;

        // --- Background ---
        this.add.rectangle(0, 0, width, height, 0x111111).setOrigin(0);

        // --- Game Title ---
        this.add.text(width / 2, height / 2 - 80, 'LEGEND OF THE BEST MEN', {
            fontFamily: '"Pixelify Sans"',   // ✅ retro font
            fontSize: '42px',
            fill: '#FFD700',
            stroke: '#000000',
            strokeThickness: 8
        }).setOrigin(0.5);

        // --- Press SPACE Prompt ---
        const prompt = this.add.text(width / 2, height / 2 + 40, 'Press SPACE to Start', {
            fontFamily: '"VT323"',
            fontSize: '22px',
            fill: '#FFFFFF'
        }).setOrigin(0.5);

        // Blinking tween
        this.tweens.add({
            targets: prompt,
            alpha: { from: 1, to: 0.2 },
            duration: 800,
            yoyo: true,
            repeat: -1
        });

        // --- Starfield Background ---
        this.stars = this.add.group();
        for (let i = 0; i < 150; i++) {
            const x = Phaser.Math.Between(0, width);
            const y = Phaser.Math.Between(0, height);
            const star = this.add.rectangle(x, y, 2, 2, 0xffffff);
            star.alpha = Phaser.Math.FloatBetween(0.3, 1);
            this.stars.add(star);
        }

        // Fullscreen button
        const fsBtn = this.add.text(GAME_WIDTH - 20, GAME_HEIGHT - 20, '⛶', {
            font: '24px monospace',
            fill: '#fff',
            backgroundColor: '#00000088',
            padding: { x: 6, y: 2 }
        })
            .setOrigin(1, 1)
            .setInteractive({ useHandCursor: true })
            .setScrollFactor(0)
            .setDepth(1000);

        fsBtn.on('pointerdown', () => {
            if (this.scale.isFullscreen) {
                this.scale.stopFullscreen();
            } else {
                this.scale.startFullscreen();
            }
        });

        // --- Input: SPACE or TAP to Continue ---
        const startGame = async () => {
            try {
                // Fix Chrome autoplay policy on mobile
                if (this.sound.context.state === 'suspended') {
                    await this.sound.context.resume();
                }
            } catch (e) {
                console.warn("⚠️ Audio resume failed:", e);
            }

            // Play menu theme + transition
            this.game.audioManager.playMusic('menu_theme', { volume: 1 });
            this.scene.start('CharacterSelectScene');
        };

        // ✅ Support both keyboard and touch
        this.input.keyboard.once('keydown-SPACE', startGame);
        this.input.once('pointerdown', startGame);

    }

    update() {
        // --- Scroll starfield ---
        this.stars.children.iterate(star => {
            star.y += 0.5;
            if (star.y > GAME_HEIGHT) {
                star.y = 0;
                star.x = Phaser.Math.Between(0, GAME_WIDTH);
            }
        });
    }
}

// --- CharacterSelectScene ---
class CharacterSelectScene extends Phaser.Scene {
    constructor() {
        super('CharacterSelectScene');
    }

    create() {
        const W = GAME_WIDTH, H = GAME_HEIGHT;

        // ✅ Only allow *playable* characters (non-NPCs) for selection
        const CHARACTERS = this.game.characters.filter(ch => !ch.isNPC);

        // ================= BACKGROUND =================
        const g = this.make.graphics({ x: 0, y: 0, add: false });

        // tiny dot texture (used for fireflies)
        g.fillStyle(0x224422, 1);
        g.fillCircle(2, 2, 2);
        g.generateTexture('spark', 4, 4);

        // subtle speckle noise tile
        const TILE = 64;
        g.clear();
        g.fillStyle(0x173017, 1);
        g.fillRect(0, 0, TILE, TILE);
        for (let i = 0; i < 40; i++) {
            g.fillStyle(0x183118, Phaser.Math.FloatBetween(0.2, 0.6));
            g.fillRect(Phaser.Math.Between(0, TILE), Phaser.Math.Between(0, TILE), 1, 1);
        }
        g.generateTexture('speckle64', TILE, TILE);

        // scanline overlay
        g.clear();
        g.fillStyle(0x000000, 0.18);
        g.fillRect(0, 1, TILE, 1);
        g.generateTexture('scanline', TILE, 2);

        this.bgFar = this.add.tileSprite(0, 0, W, H, 'speckle64')
            .setOrigin(0).setAlpha(0.85);
        this.bgNear = this.add.tileSprite(0, 0, W, H, 'speckle64')
            .setOrigin(0).setAlpha(0.95);

        // fireflies
        this.add.particles(0, 0, 'spark', {
            x: { min: 0, max: W },
            y: { min: 0, max: H },
            speedY: { min: -12, max: -22 },
            speedX: { min: -6, max: 6 },
            lifespan: { min: 4000, max: 8000 },
            quantity: 1,
            scale: { start: 1, end: 0.2 },
            alpha: { start: 0.5, end: 0 },
            blendMode: 'ADD'
        });

        this.add.tileSprite(0, 0, W, H, 'scanline')
            .setOrigin(0).setAlpha(0.08);

        // ================= TITLE =================
        this.add.text(W / 2, 60, 'LEGEND OF THE BEST MEN', {
            fontFamily: '"Pixelify Sans"',
            fontSize: '32px',
            fill: '#FFD700',
            stroke: '#000',
            strokeThickness: 6
        }).setOrigin(0.5);

        this.add.text(W / 2, 100, 'Choose your Champion', {
            fontFamily: '"VT323"',
            fontSize: '20px',
            fill: '#ffffff'
        }).setOrigin(0.5);

        // ================= CHARACTER CARDS =================
        this.selected = 0;
        this.cards = [];

        // reusable glow
        g.clear();
        g.fillStyle(0xffffff, 1);
        g.fillCircle(64, 64, 64);
        g.generateTexture('softGlow', 128, 128);

        const spacingX = 180;
        const baseX = W / 2 - (CHARACTERS.length - 1) * spacingX / 2;
        const y = 285;

        CHARACTERS.forEach((ch, idx) => {
            const x = baseX + idx * spacingX;

            const cardBg = this.add.rectangle(0, 0, 120, 160, 0x1f1f1f, 0.9)
                .setStrokeStyle(2, 0x777777);

            const glow = this.add.image(0, 0, 'softGlow')
                .setScale(0.7).setTint(ch.color).setAlpha(0);

            // ✅ Avatar (defensive: if missing, fallback to placeholder)
            let portrait;
            if (this.textures.exists('avatar_' + ch.id)) {
                portrait = this.add.image(0, -10, 'avatar_' + ch.id);
                const maxW = 90, maxH = 90;
                const tex = this.textures.get('avatar_' + ch.id).getSourceImage();
                const scale = Math.min(maxW / tex.width, maxH / tex.height);
                portrait.setScale(scale);
            } else {
                portrait = this.add.rectangle(0, -10, 80, 80, ch.color || 0x999999);
            }

            const nameText = this.add.text(0, 66, ch.displayName, {
                fontFamily: '"VT323"',
                fontSize: '16px',
                color: '#FFD700'
            }).setOrigin(0.5);

            const colorFrame = this.add.rectangle(0, 0, 124, 164)
                .setStrokeStyle(3, ch.color).setAlpha(0);

            const container = this.add.container(x, y, [glow, cardBg, portrait, nameText, colorFrame]);
            container.setSize(120, 160);
            container.setInteractive({ useHandCursor: true });

            // hover / select behaviour
            container.on('pointerover', () => {
                this.tweens.add({ targets: container, scale: 1.06, duration: 120 });
                this.tweens.add({ targets: glow, alpha: 0.25, duration: 120 });
                cardBg.setStrokeStyle(3, ch.color);
            });
            container.on('pointerout', () => {
                this.tweens.add({ targets: container, scale: 1.0, duration: 120 });
                if (this.selected !== idx)
                    this.tweens.add({ targets: glow, alpha: 0, duration: 120 });
                cardBg.setStrokeStyle(2, 0x777777);
            });
            container.on('pointerdown', () => this.select(idx, CHARACTERS));

            this.cards.push({ container, glow, colorFrame, cardBg, ch });

            // entrance animation
            container.alpha = 0; container.y = y + 10;
            this.tweens.add({
                targets: container,
                alpha: 1, y,
                duration: 500,
                delay: idx * 120,
                ease: 'Sine.easeOut'
            });
        });

        // ================= INFO BOX =================
        this.add.rectangle(W / 2, 460, W - 120, 90, 0x000000, 0.45)
            .setStrokeStyle(2, 0x888888);

        this.infoBox = this.add.text(W / 2, 460, CHARACTERS[0].desc || 'No description', {
            fontFamily: '"VT323"',
            fontSize: '16px',
            color: '#ffffff',
            wordWrap: { width: W - 140 },
            align: 'center'
        }).setOrigin(0.5);

        // ================= START BUTTON =================
        this.startBtn = this.add.text(W / 2, 525, '▶ Start Game', {
            fontFamily: '"Pixelify Sans"',
            fontSize: '20px',
            color: '#000000',
            backgroundColor: '#FFD700',
            padding: { left: 14, right: 14, top: 6, bottom: 6 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        this.startBtn.on('pointerover', () =>
            this.startBtn.setStyle({ backgroundColor: '#FFA500' }));
        this.startBtn.on('pointerout', () =>
            this.startBtn.setStyle({ backgroundColor: '#FFD700' }));
        this.startBtn.on('pointerdown', () => {
            const chosen = CHARACTERS[this.selected];
            this.scene.start('OverworldScene', { player: chosen });
        });

        // ================= MUTE BTN =================
        this.muteBtn = new MuteButton(this);

        // init selection
        this.select(0, CHARACTERS);

        // --- Input: SPACE or TAP to Start ---
        const startGame = async () => {
            try {
                if (this.sound.context.state === 'suspended') {
                    await this.sound.context.resume();
                }
            } catch (e) {
                console.warn("⚠️ Audio resume failed:", e);
            }

            const chosen = CHARACTERS[this.selected];
            this.scene.start('OverworldScene', { player: chosen });
        };

        // Desktop: SPACE starts
        this.input.keyboard.once('keydown-SPACE', startGame);

        // Mobile: tap anywhere not on a card/button also starts
        this.input.on('pointerdown', (pointer, currentlyOver) => {
            if (currentlyOver.length === 0) {
                startGame();
            }
        });

        // ✅ Optional helper text for mobile users
        if (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
            this.add.text(W / 2, H - 20, '👆 Tap Start or screen to begin', {
                fontFamily: '"VT323"',
                fontSize: '16px',
                color: '#fff',
                backgroundColor: '#00000088',
                padding: { x: 6, y: 2 }
            }).setOrigin(0.5).setDepth(999);
        }
    }


    select(idx, CHARACTERS) {
        this.selected = idx;

        this.cards.forEach((c, i) => {
            const isSel = i === idx;
            this.tweens.add({ targets: c.colorFrame, alpha: isSel ? 1 : 0, duration: 120 });
            this.tweens.add({ targets: c.glow, alpha: isSel ? 0.35 : 0, duration: 120 });
            c.cardBg.setStrokeStyle(isSel ? 3 : 2, isSel ? c.ch.color : 0x777777);
        });

        this.children.bringToTop(this.startBtn);
        this.infoBox.setText(CHARACTERS[idx].desc || 'No description available');
    }

    update() {
        this.bgFar.tilePositionY += 0.06;
        this.bgNear.tilePositionY += 0.12;
    }
}

class OverworldScene extends Phaser.Scene {
    constructor() { super('OverworldScene'); }

    init(data) {
        this.playerData = data.player;
        this.currentlyNearNPC = null;
        this.dialogueOpen = false;
        this.inventory = [];
        this.introShown = false;
        this.joyTouch = null;

        this.bridezillaSpawned = false;
        this.bridezillaTimer = null;
        this.caveCoords = { x: 607, y: 113 }; // change as needed

        // Dialogue UI refs
        this.dialogBox = null;
        this.dialogText = null;
        this.choiceButtons = [];

        // Random dismissive lines when NPC already spent
        this.dismissiveLines = [
            "I have nothing more to say to you.",
            "Leave me alone, I’m busy.",
            "We’ve spoken enough already.",
            "Go bother someone else.",
            "The conversation is over."
        ];
    }

    create() {
        // Music
        this.game.audioManager.playMusic('overworld_theme', { volume: 0.5 });

        // Dialogue trees
        this.npcDialogues = this.cache.json.get('npcDialogues') || {};
        console.log("[Overworld] npcDialogues keys:", Object.keys(this.npcDialogues));

        // ---- WORLD ----
        const map = this.make.tilemap({ key: 'map' });

        // Names must match exactly how they appear in Tiled
        const tileset1 = map.addTilesetImage('Overworld', 'overworld_tiles');
        const tileset2 = map.addTilesetImage('objects', 'objects_tiles');

        // Create layers in correct z-order
        const belowLayer = map.createLayer('Below', [tileset1, tileset2], 0, 0);
        const worldLayer = map.createLayer('World', [tileset1, tileset2], 0, 0);
        const aboveLayer = map.createLayer('Above', [tileset1, tileset2], 0, 0);

        // ✅ Enable collisions for both solid layers
        worldLayer.setCollisionFromCollisionGroup(true);
        aboveLayer.setCollisionFromCollisionGroup(true);

        // ---- CONTROLS ----
        this.cursors = this.input.keyboard.createCursorKeys();
        this.keyW = this.input.keyboard.addKey('W');
        this.keyA = this.input.keyboard.addKey('A');
        this.keyS = this.input.keyboard.addKey('S');
        this.keyD = this.input.keyboard.addKey('D');

        // ---- PLAYER ----
        const spawnPoint = map.findObject('Objects', obj => obj.name === 'SpawnPoint') || { x: 100, y: 100 };
        this.player = this.physics.add.sprite(spawnPoint.x, spawnPoint.y, this.playerData.id + '_idle', 4);
        this.player.setScale(0.33).setCollideWorldBounds(true).play(this.playerData.id + '_idle_down');
        this.player.hp = this.playerData.hp;
        this.physics.add.collider(this.player, worldLayer);
        this.physics.add.collider(this.player, aboveLayer);

        // ---- PLAYER BODY CALIBRATION ----
        // Shrink the collision box to roughly match the sprite's "feet"
        const bodyWidth = this.player.width * 0.35;   // ~one third of sprite width
        const bodyHeight = this.player.height * 0.25; // shorter, only lower part collides
        const offsetX = this.player.width * 0.32;     // centers horizontally
        const offsetY = this.player.height * 0.68;    // shifts box toward feet

        this.player.body.setSize(bodyWidth, bodyHeight);
        this.player.body.setOffset(offsetX, offsetY);


        // ---- NPCs ----
        this.angryBridesmaid = this.physics.add.sprite(200, 200, 'angry_bridesmaid_idle', 4)
            .setImmovable(true).setScale(0.33).play('angry_bridesmaid_idle_down');
        this.priest = this.physics.add.sprite(600, 380, 'priest_idle', 4)
            .setImmovable(true).setScale(0.33).play('priest_idle_down');
        this.drunkUncle = this.physics.add.sprite(400, 300, 'drunk_uncle_idle', 4)
            .setImmovable(true).setScale(0.33).play('drunk_uncle_idle_down');

        [this.angryBridesmaid, this.priest, this.drunkUncle].forEach(npc => {
            npc.body.setSize(npc.width, npc.height, true);
            npc.spent = false; // track if NPC already used
        });
        this.angryBridesmaid.npcName = 'Angry Bridesmaid';
        this.priest.npcName = 'Priest';
        this.drunkUncle.npcName = 'Drunk Uncle';

        // ---- CAMERA ----
        const mainCam = this.cameras.main;
        this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        mainCam.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        mainCam.startFollow(this.player, true, 0.1, 0.1);
        mainCam.setZoom(SCALE);

        // ---- UI ROOT + UI CAMERA ----
        this.uiRoot = this.add.container(0, 0).setDepth(10000).setScrollFactor(0);
        mainCam.ignore(this.uiRoot);
        this.uiCam = this.cameras.add(0, 0, GAME_WIDTH, GAME_HEIGHT, false);
        this.uiCam.setZoom(1);
        this.uiCam.setScroll(0, 0);
        this.uiCam.ignore([belowLayer, worldLayer, aboveLayer, this.player, this.angryBridesmaid, this.priest, this.drunkUncle]);

        // ---- HUD ----
        this.hud = this.add.text(GAME_WIDTH - 200, 16,
            `${this.playerData.displayName}\nHP: ${this.playerData.hp}`,
            { font: '14px monospace', backgroundColor: '#00000080', fill: '#ffffff', padding: 6 }
        ).setScrollFactor(0);
        this.uiRoot.add(this.hud);

        if (isMobile) this.createMobileControls();

        // ---- INVENTORY HUD ----
        this.inventorySlots = [];
        const slotSize = 32, spacing = 40, startX = GAME_WIDTH / 2 - spacing, y = GAME_HEIGHT - 50;
        for (let i = 0; i < 3; i++) {
            const slot = this.add.rectangle(startX + i * spacing, y, slotSize, slotSize, 0x000000, 0.5)
                .setStrokeStyle(2, 0xffffff).setScrollFactor(0);
            this.uiRoot.add(slot);
            this.inventorySlots.push(slot);
        }

        // ---- PROMPT LABEL ----
        this.promptLabel = this.add.text(0, 0, '', {
            font: '12px monospace',
            backgroundColor: '#000A',
            padding: { x: 4, y: 2 },
            color: '#fff'
        }).setOrigin(0.5, 1).setVisible(false).setScrollFactor(0);
        this.uiRoot.add(this.promptLabel);

        // ---- DIALOG BOX ----
        this.dialogBox = this.add.rectangle(0, 0, 240, 100, 0x000000, 0.7)
            .setVisible(false).setScrollFactor(0).setDepth(20000);
        this.dialogText = this.add.text(0, 0, '', {
            font: '14px monospace',
            wordWrap: { width: 220, useAdvancedWrap: true },
            align: 'center',
            color: '#fff'
        }).setOrigin(0.5, 0).setVisible(false).setScrollFactor(0).setDepth(20001);
        this.uiRoot.add([this.dialogBox, this.dialogText]);

        // ---- OVERLAPS ----
        const near = (npc) => () => this.setNearbyNPC(npc);
        this.physics.add.overlap(this.player, this.angryBridesmaid, near(this.angryBridesmaid), null, this);
        this.physics.add.overlap(this.player, this.priest, near(this.priest), null, this);
        this.physics.add.overlap(this.player, this.drunkUncle, near(this.drunkUncle), null, this);

        // ---- SPACE KEY ----
        this.input.keyboard.on('keydown-SPACE', () => {
            if (this.dialogueOpen) this.closeDialogue();
            else if (this.currentlyNearNPC) this.openDialogueFor(this.currentlyNearNPC);
            else if (this.readyForFinalBattle &&
                Phaser.Math.Distance.Between(this.player.x, this.player.y, this.caveCoords.x, this.caveCoords.y) < 40) {
                const foe = this.game.characters.find(c => c.id === 'bridezilla');
                // Adjust stats based on items
                if (this.inventory.includes('wedding_band')) foe.hp -= 30;
                if (this.inventory.includes('something_blue')) this.playerData.hp += 30;
                if (this.inventory.includes('wedding_veil')) foe.atkMod *= 0.8;

                this.scene.launch('BattleScene', { player: this.playerData, foe });
                this.scene.pause();
            }
        });

        // Intro text
        if (!this.introShown) {
            this.introShown = true;
            this.showIntroQuest();
        }
    }

    // ===== NPC PROMPTS =====
    setNearbyNPC(npc) {
        if (npc.spent) return;
        this.currentlyNearNPC = npc;
        const actionKey = isMobile ? '[A] Tap' : '[SPACE] Talk';
        this.promptLabel.setText(`${actionKey} to ${npc.npcName}`);
        this.promptLabel.setVisible(true);
        this.updateNpcPromptPos();
    }
    clearNearbyNPC() {
        this.currentlyNearNPC = null;
        this.promptLabel.setVisible(false);
    }
    updateNpcPromptPos() {
        if (!this.currentlyNearNPC || !this.promptLabel.visible) return;
        const cam = this.cameras.main;
        const npc = this.currentlyNearNPC;
        const sx = npc.x - cam.scrollX;
        const sy = npc.y - npc.displayHeight * 1.2 - cam.scrollY;
        this.promptLabel.setPosition(
            Phaser.Math.Clamp(sx, 40, GAME_WIDTH - 40),
            Phaser.Math.Clamp(sy, 20, GAME_HEIGHT - 20)
        );
    }

    // ===== DIALOGUE SYSTEM =====
    openDialogueFor(npc) {
        this.promptLabel.setVisible(false); // hide prompt when talking

        if (npc.spent) {
            const randomLine = Phaser.Utils.Array.GetRandom(this.dismissiveLines);
            this.showAdhocBubble(npc, randomLine);
            return;
        }

        const tree = this.npcDialogues[npc.npcName];
        if (!tree) {
            this.showAdhocBubble(npc, `${npc.npcName} has nothing to say...`);
            return;
        }
        this.dialogueTree = tree;
        this.dialogueNode = tree[0];
        this.dialogueNpc = npc;
        this.showDialogueNode(this.dialogueNode);
    }

    showAdhocBubble(npc, text) {
        const cam = this.cameras.main;
        const sx = npc.x - cam.scrollX;
        const sy = npc.y - cam.scrollY;
        const bubbleWidth = 220;

        this.dialogText.setText(text).setWordWrapWidth(bubbleWidth - 20).setVisible(true);
        const textHeight = this.dialogText.height || 40;
        const bubbleHeight = textHeight + 30;

        let bubbleY = sy - npc.displayHeight * 1.4;
        if (bubbleY - bubbleHeight / 2 < 0) bubbleY = sy + npc.displayHeight * 1.4;

        this.dialogBox.setPosition(sx, bubbleY).setSize(bubbleWidth, bubbleHeight).setVisible(true);
        this.dialogText.setPosition(sx, bubbleY - bubbleHeight / 2 + 16);

        this.hud.setVisible(false);
        this.dialogueOpen = true;
    }

    //Spawn Bridezilla
    // ===== SPAWN BRIDEZILLA =====
    spawnBridezilla() {
        if (this.bridezillaSpawned || this.readyForFinalBattle) return;
        this.bridezillaSpawned = true;

        const spawnX = Phaser.Math.Between(200, 600);
        const spawnY = Phaser.Math.Between(200, 400);

        this.bridezilla = this.physics.add.sprite(spawnX, spawnY, 'bridezilla_idle', 4)
            .setScale(0.33)
            .setImmovable(false)
            .play('bridezilla_idle_down');

        this.bridezilla.npcName = 'Bridezilla';

        // ✅ overlap → instant battle
        this.physics.add.overlap(this.player, this.bridezilla, () => {
            this.scene.launch('BattleScene', {
                player: this.playerData,
                foe: this.game.characters.find(c => c.id === 'bridezilla'),
                npc: this.bridezilla
            });
            this.scene.pause();
        });

        // --- Bridezilla anger lines ---
        const rageLines = [
            "When I catch him, he's toast!",
            "You can’t run forever!",
            "No one escapes MY wedding!",
            "WHERE’S THE GROOM?!",
            "I WILL have my vows fulfilled!",
            "He’ll regret saying 'I do'!"
        ];

        // --- Faster + smarter wandering ---
        this.time.addEvent({
            delay: 2000,
            loop: true,
            callback: () => {
                if (!this.bridezilla.active) return;

                const distToPlayer = Phaser.Math.Distance.Between(
                    this.bridezilla.x, this.bridezilla.y,
                    this.player.x, this.player.y
                );

                const speed = (distToPlayer < 250) ? 80 : 60; // ✅ faster if player close
                let vel = { x: 0, y: 0 };

                // Random chase chance if player nearby
                if (distToPlayer < 300 && Phaser.Math.Between(0, 100) < 40) {
                    const angle = Phaser.Math.Angle.Between(
                        this.bridezilla.x, this.bridezilla.y,
                        this.player.x, this.player.y
                    );
                    vel = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
                } else {
                    const dir = Phaser.Math.Between(0, 3);
                    vel = [
                        { x: -speed, y: 0 }, { x: speed, y: 0 },
                        { x: 0, y: -speed }, { x: 0, y: speed }
                    ][dir];
                }

                this.bridezilla.setVelocity(vel.x, vel.y);
                this.time.delayedCall(1000, () => this.bridezilla.setVelocity(0, 0));

                // Occasionally yell an angry line
                if (Phaser.Math.Between(0, 100) < 25) {
                    const line = Phaser.Utils.Array.GetRandom(rageLines);
                    this.showAdhocBubble(this.bridezilla, line);
                }
            }
        });

        this.showAdhocBubble(this.player, "Bridezilla has awoken! Run for your life!");
    }

    showDialogueNode(node) {
        if (this.choiceButtons) this.choiceButtons.forEach(b => b.destroy());
        this.choiceButtons = [];

        const npc = this.dialogueNpc;
        const cam = this.cameras.main;
        let sx = npc.x - cam.scrollX;
        const sy = npc.y - cam.scrollY;

        const bubbleWidth = isMobile ? 280 : 240;
        const textSize = isMobile ? '16px monospace' : '14px monospace';

        this.dialogText.setText(`${npc.npcName}: ${node.text}`)
            .setWordWrapWidth(bubbleWidth - 20)
            .setVisible(true).setStyle({ font: textSize });

        const textHeight = this.dialogText.height || 40;
        const bubbleHeight = textHeight + node.choices.length * 26 + 44; // extra padding

        let bubbleY = sy - npc.displayHeight * 1.4;
        if (bubbleY - bubbleHeight / 2 < 0) bubbleY = sy + npc.displayHeight * 1.4;

        sx = Phaser.Math.Clamp(sx, bubbleWidth / 2 + 8, GAME_WIDTH - bubbleWidth / 2 - 8);

        this.dialogBox.setPosition(sx, bubbleY).setSize(bubbleWidth, bubbleHeight).setVisible(true);
        this.dialogText.setPosition(sx, bubbleY - bubbleHeight / 2 + 14);

        this.hud.setVisible(false);
        this.dialogueOpen = true;

        const startY = bubbleY - bubbleHeight / 2 + textHeight + 32; // more gap
        node.choices.forEach((choice, idx) => {
            const btnY = startY + idx * 26;
            const btn = this.add.text(sx, btnY, choice.text, {
                font: '12px monospace',
                backgroundColor: '#333',
                padding: { x: 4, y: 2 },
                color: '#fff',
                wordWrap: { width: bubbleWidth - 30, useAdvancedWrap: true }, // ✅ wrap long lines
                align: 'center'
            }).setOrigin(0.5, 0).setInteractive();

            btn.on('pointerdown', () => this.chooseDialogueOption(choice));
            this.uiRoot.add(btn);
            this.choiceButtons.push(btn);
        });
    }

    chooseDialogueOption(choice) {
        if (choice.next === "battle" || choice.battle) {
            this.dialogueNpc.spent = true;
            this.closeDialogue(true);
            const foeId = this.dialogueNpc.npcName.replace(/\s+/g, "_").toLowerCase();
            const foeData = this.game.characters.find(c => c.id === foeId);
            if (!foeData) return;
            this.scene.launch('BattleScene', { player: this.playerData, foe: foeData, npc: this.dialogueNpc });
            this.scene.pause();
            return;
        }

        if (choice.reward) {
            this.inventory.push(choice.reward);
            this.updateInventoryHud();
            this.dialogText.setText(`${this.dialogueNpc.npcName}: You got ${choice.reward}!`);
            this.dialogueNpc.spent = true;
            this.time.delayedCall(1200, () => this.closeDialogue(), [], this);
            return;
        }

        if (choice.next === "end" || !choice.next) {
            this.dialogueNpc.spent = true;
            this.closeDialogue();
            return;
        }

        const nextNode = this.dialogueTree.find(n => n.id === choice.next);
        if (nextNode) {
            this.dialogueNode = nextNode;
            this.showDialogueNode(nextNode);
        }
    }

    closeDialogue(force = false) {
        this.dialogBox.setVisible(false);
        this.dialogText.setVisible(false);
        this.hud.setVisible(true);
        this.dialogueOpen = false;

        if (this.choiceButtons) {
            this.choiceButtons.forEach(b => b.destroy());
            this.choiceButtons = [];
        }
        if (!force) {
            this.dialogueTree = null;
            this.dialogueNode = null;
            this.dialogueNpc = null;
        }
    }

    // ===== INTRO QUEST TEXT =====
    showIntroQuest() {
        const intro =
            "The Groom is in despair!\n\n" +
            "He has lost three sacred treasures:\n" +
            "💍 The Wedding Band\n👰 The Veil\n💙 Something Blue\n\n" +
            "You, Chosen One, must recover them\n" +
            "from the guests you encounter —\n" +
            "by words... or by force.\n\n" +
            "Press [SPACE] to begin";

        this.dialogText.setText(intro).setWordWrapWidth(GAME_WIDTH - 120).setVisible(true);
        const textHeight = this.dialogText.height || 120;
        const boxHeight = textHeight + 36;

        this.dialogBox.setPosition(GAME_WIDTH / 2, GAME_HEIGHT / 2)
            .setSize(GAME_WIDTH - 80, boxHeight).setVisible(true);
        this.dialogText.setPosition(GAME_WIDTH / 2, GAME_HEIGHT / 2 - boxHeight / 2 + 14);

        this.hud.setVisible(false);
        this.dialogueOpen = true;

        this.input.keyboard.once('keydown-SPACE', () => {
            this.dialogBox.setVisible(false);
            this.dialogText.setVisible(false);
            this.hud.setVisible(true);
            this.dialogueOpen = false;

            // Start 5-minute countdown (300 000 ms)
            this.time.delayedCall(300000, () => this.spawnBridezilla(), [], this);
            this.timerLabel = this.add.text(20, 16, "Bridezilla Timer: 05:00", {
                font: '14px monospace', fill: '#fff', backgroundColor: '#0008', padding: 4
            }).setScrollFactor(0).setDepth(9999);
            this.remainingTime = 300000;

        });
    }

    // ===== MOBILE CONTROLS =====
    createMobileControls() {
        this.input.addPointer(1);

        this.joyBase = this.add.circle(80, GAME_HEIGHT - 80, 40, 0x000000, 0.3)
            .setScrollFactor(0).setDepth(2000);
        this.joyStick = this.add.circle(80, GAME_HEIGHT - 80, 20, 0xffffff, 0.6)
            .setScrollFactor(0).setDepth(2001);

        // Track drag
        this.input.on('pointerdown', (p) => {
            if (Phaser.Math.Distance.Between(p.x, p.y, this.joyBase.x, this.joyBase.y) < 60) {
                this.joyTouch = p.id;
            }
        });
        this.input.on('pointermove', (p) => {
            if (this.joyTouch === p.id) {
                const dx = p.x - this.joyBase.x;
                const dy = p.y - this.joyBase.y;
                const dist = Math.min(Math.sqrt(dx * dx + dy * dy), 40);
                const angle = Math.atan2(dy, dx);
                this.joyStick.setPosition(
                    this.joyBase.x + Math.cos(angle) * dist,
                    this.joyBase.y + Math.sin(angle) * dist
                );
            }
        });
        this.input.on('pointerup', (p) => {
            if (this.joyTouch === p.id) {
                this.joyTouch = null;
                this.joyStick.setPosition(this.joyBase.x, this.joyBase.y);
            }
        });

        this.actionBtn = this.add.circle(GAME_WIDTH - 80, GAME_HEIGHT - 80, 32, 0xFFD700)
            .setScrollFactor(0).setDepth(2000).setInteractive();

        this.actionBtnText = this.add.text(this.actionBtn.x, this.actionBtn.y, 'A', {
            font: '20px monospace',
            color: '#000'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2001);

        this.actionBtn.on('pointerdown', () => {
            if (this.dialogueOpen) this.closeDialogue();
            else if (this.currentlyNearNPC) this.openDialogueFor(this.currentlyNearNPC);
        });
    }

    // ===== INVENTORY =====
    updateInventoryHud() {
        const frameMap = { wedding_band: 0, something_blue: 1, wedding_veil: 2 };
        this.inventorySlots.forEach((slot, i) => {
            if (slot.itemSprite) {
                slot.itemSprite.destroy();
                slot.itemSprite = null;
            }
            if (this.inventory[i]) {
                const frame = frameMap[this.inventory[i]];
                if (frame !== undefined) {
                    const icon = this.add.image(slot.x, slot.y, 'quest_items', frame)
                        .setOrigin(0.5).setDisplaySize(28, 28).setScrollFactor(0).setDepth(10100);
                    this.uiRoot.add(icon);
                    slot.itemSprite = icon;
                }
            }
        });

        if (this.inventory.includes('wedding_band') &&
            this.inventory.includes('something_blue') &&
            this.inventory.includes('wedding_veil')) {

            // Stop countdown
            if (this.timerLabel) this.timerLabel.setVisible(false);
            if (this.bridezillaTimer) this.bridezillaTimer.remove(false);
            this.remainingTime = 0;

            this.showAdhocBubble(this.player,
                "You sense Bridezilla awaits in her cave...\nFind her and return the lost items to end this madness!");
            this.readyForFinalBattle = true;
        }

    }

    // ===== UPDATE LOOP =====
    update() {
        const speed = BASE_SPEED;
        let moveX = 0, moveY = 0;

        if (this.dialogueOpen) {
            this.player.setVelocity(0, 0);
        } else {
            if (typeof isMobile !== 'undefined' && isMobile && this.joyTouch) {
                const dx = this.joyStick.x - this.joyBase.x;
                const dy = this.joyStick.y - this.joyBase.y;
                const len = Math.sqrt(dx * dx + dy * dy);
                if (len > 10) {
                    moveX = dx / len;
                    moveY = dy / len;
                }
            } else {
                if (this.cursors.left.isDown || this.keyA.isDown) moveX = -1;
                else if (this.cursors.right.isDown || this.keyD.isDown) moveX = 1;
                if (this.cursors.up.isDown || this.keyW.isDown) moveY = -1;
                else if (this.cursors.down.isDown || this.keyS.isDown) moveY = 1;
            }

            this.player.setVelocity(moveX * speed, moveY * speed);

            if (moveX < 0) this.player.anims.play(this.playerData.id + '_walk_left', true);
            else if (moveX > 0) this.player.anims.play(this.playerData.id + '_walk_right', true);
            else if (moveY < 0) this.player.anims.play(this.playerData.id + '_walk_up', true);
            else if (moveY > 0) this.player.anims.play(this.playerData.id + '_walk_down', true);
            else {
                this.player.setVelocity(0, 0);
                const anim = this.player.anims.currentAnim;
                if (anim) {
                    if (anim.key.includes('down')) this.player.anims.play(this.playerData.id + '_idle_down', true);
                    else if (anim.key.includes('up')) this.player.anims.play(this.playerData.id + '_idle_up', true);
                    else if (anim.key.includes('left')) this.player.anims.play(this.playerData.id + '_idle_left', true);
                    else if (anim.key.includes('right')) this.player.anims.play(this.playerData.id + '_idle_right', true);
                }
            }
        }

        if (this.currentlyNearNPC) {
            const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.currentlyNearNPC.x, this.currentlyNearNPC.y);
            if (d > 64) this.clearNearbyNPC();
        }

        if (this.timerLabel && !this.bridezillaSpawned && this.remainingTime > 0) {
            this.remainingTime -= this.game.loop.delta;
            const minutes = Math.floor(this.remainingTime / 60000);
            const seconds = Math.floor((this.remainingTime % 60000) / 1000);
            this.timerLabel.setText(`Bridezilla Timer: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
            if (this.remainingTime <= 0) this.spawnBridezilla();
        }

        if (this.readyForFinalBattle) {
            const dToCave = Phaser.Math.Distance.Between(
                this.player.x, this.player.y, this.caveCoords.x, this.caveCoords.y);
            if (dToCave < 40 && !this.promptLabel.visible) {
                this.promptLabel.setText('[SPACE] Enter the Bride’s Cave');
                this.promptLabel.setVisible(true);
            }
        }

        this.updateNpcPromptPos();
        this.hud.setText(`${this.playerData.displayName}\nHP: ${this.player.hp}`);
    }
}

class BattleScene extends Phaser.Scene {
    constructor() { super('BattleScene'); }

    init(data) {
        this.playerData = JSON.parse(JSON.stringify(data.player));
        this.foeData = JSON.parse(JSON.stringify(data.foe));
        this.npcRef = data.npc || null;

        // ✅ ensure we keep CURRENT HP passed from overworld
        this.initialPlayerHP = data.player.hp;
    }

    create() {
        const DEPTH_BG = 0, DEPTH_PLATFORM = 1, DEPTH_UI = 5, DEPTH_SPRITES = 6;
        this.game.audioManager.playMusic('battle_theme', { volume: 0.5, fadeTime: 1500 });

        // --- Background ---
        this.add.image(0, 0, 'battle_bg_grass')
            .setOrigin(0).setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setDepth(DEPTH_BG);

        // --- Platforms ---
        this.add.ellipse(620, 240, 120, 40, 0xd0d0d0).setStrokeStyle(1, 0x999999).setDepth(DEPTH_PLATFORM);
        this.add.ellipse(200, 420, 120, 40, 0xd0d0d0).setStrokeStyle(1, 0x999999).setDepth(DEPTH_PLATFORM);

        // --- Sprites ---
        this.playerSprite = this.add.image(200, 360, 'battle_back_' + this.playerData.id)
            .setDisplaySize(64, 64).setDepth(DEPTH_SPRITES);
        this.foeSprite = this.add.image(620, 200, 'battle_front_' + this.foeData.id)
            .setDisplaySize(64, 64).setDepth(DEPTH_SPRITES);

        // --- Setup stats ---
        this.playerState = {
            maxHP: this.playerData.maxHP || this.playerData.hp,
            hp: this.initialPlayerHP,   // ✅ persists current HP
            atkMod: 1, defMod: 1, status: {}
        };
        this.foeState = {
            maxHP: this.foeData.hp,
            hp: this.foeData.hp,
            atkMod: 1, defMod: 1, status: {}
        };

        // ===== UI HELPERS =====
        const makePanel = (x, y, w, h) => {
            const c = this.add.container(x, y).setDepth(DEPTH_UI);
            c.add(this.add.rectangle(4, 4, w, h, 0x000000, 0.08).setOrigin(0));
            c.add(this.add.rectangle(0, 0, w, h, 0xffffff, 1).setOrigin(0).setStrokeStyle(2, 0x111111));
            return c;
        };
        const addLabel = (parent, text, padX, padY, maxWidth) => {
            const t = this.add.text(padX, padY, text, {
                font: '16px monospace',
                fill: '#111',
                wordWrap: { width: maxWidth, useAdvancedWrap: true }
            }).setOrigin(0, 0);
            parent.add(t);
            return t;
        };
        const addHP = (parent, frameWidth, frameHeight) => {
            const barW = 140, barH = 10, pad = 10;
            const x = frameWidth - pad - barW / 2;
            const y = frameHeight - pad - barH / 2;
            parent.add(this.add.text(x - barW / 2 - 28, y - 8, 'HP', { font: '12px monospace', fill: '#333' }).setOrigin(0, 0));
            parent.add(this.add.rectangle(x, y, barW, barH, 0x888888).setOrigin(0.5));
            const fill = this.add.rectangle(x, y, barW, barH, 0x44cc44).setOrigin(0.5);
            parent.add(fill);
            return { fill, barW };
        };

        // ===== INFO BOXES =====
        this.foeUI = makePanel(420, 40, 320, 60);
        this.foeText = addLabel(this.foeUI, `${this.foeData.displayName} Lv.5`, 10, 10, 300);
        this.foeHPFill = addHP(this.foeUI, 320, 60).fill;

        this.playerUI = makePanel(40, 270, 320, 60);
        this.playerText = addLabel(this.playerUI, `${this.playerData.displayName} Lv.5`, 10, 10, 300);
        this.playerHPFill = addHP(this.playerUI, 320, 60).fill;

        // ===== Dialogue + Menu =====
        this.dialogUI = makePanel(20, 400, 760, 90);
        this.log = addLabel(this.dialogUI, 'What will you do?', 12, 12, 740);

        this.menuUI = makePanel(20, 500, 760, 90);
        this.moveButtons = [];
        const cols = 2, gutter = 16, pad = 12, colW = (760 - pad * 2 - gutter) / cols, rowH = 30;
        this.playerData.moves.forEach((m, idx) => {
            const col = idx % cols, row = Math.floor(idx / cols);
            const x = pad + col * (colW + gutter), y = pad + row * rowH;
            const btnC = this.add.container(x, y);
            const bg = this.add.rectangle(0, 0, colW, 26, 0xeeeeee).setOrigin(0).setStrokeStyle(1, 0xbbbbbb);
            const t = this.add.text(8, 5, m.name.toUpperCase(), { font: '14px monospace', fill: '#000', wordWrap: { width: colW - 16 } }).setOrigin(0, 0);
            btnC.add([bg, t]);
            btnC.setSize(colW, 26).setInteractive(new Phaser.Geom.Rectangle(0, 0, colW, 26), Phaser.Geom.Rectangle.Contains);
            btnC.on('pointerover', () => bg.setFillStyle(0xdddddd));
            btnC.on('pointerout', () => bg.setFillStyle(0xeeeeee));
            btnC.on('pointerdown', () => this.playerUseMove(idx));
            this.menuUI.add(btnC);
            this.moveButtons.push(btnC);
        });

        this.currentTurn = 'player';
        this.updateHPBars();
    }

    // ====== HELPERS ======
    rollAccuracy(move) { return Phaser.Math.Between(1, 100) <= (move.accuracy || 100); }
    // ===== VISUAL FEEDBACK =====
    playAttackAnimation(attacker, defender, moveName) {
        const cam = this.cameras.main;

        // 🔊 Sound FX (optional — replace with your actual sound keys)
        if (this.sound.get('attack_sfx')) this.sound.play('attack_sfx', { volume: 0.4 });
        else this.sound.play('slash_sfx', { volume: 0.4, detune: Phaser.Math.Between(-100, 100) });

        // 💥 Screen shake when physical attacks land
        cam.shake(120, 0.0035);

        // 💨 Simple lunge effect
        this.tweens.add({
            targets: attacker,
            x: attacker.x + (attacker === this.playerSprite ? 30 : -30),
            duration: 80,
            yoyo: true,
            ease: 'Quad.easeOut'
        });

        // 💢 Red flash on defender
        this.tweens.addCounter({
            from: 255, to: 0, duration: 160,
            onUpdate: tween => {
                const val = Math.floor(tween.getValue());
                defender.setTintFill(Phaser.Display.Color.GetColor(255, val, val));
            },
            onComplete: () => defender.clearTint()
        });

        // ✂️ Slash overlay
        const slash = this.add.image(defender.x, defender.y - 10, 'fx_slash')
            .setScale(0.6).setAlpha(0).setDepth(999);
        this.tweens.add({
            targets: slash,
            alpha: { from: 0, to: 1 },
            scale: { from: 0.3, to: 0.8 },
            angle: { from: -25, to: 10 },
            duration: 150,
            yoyo: true,
            onComplete: () => slash.destroy()
        });
    }
    applyDamage(attacker, defender, move) {
        let dmg = (move.power || 0) * (attacker.atkMod || 1) * (1 / (defender.defMod || 1));
        defender.hp = Math.max(0, defender.hp - dmg);
        return Math.round(dmg);
    }

    // ===== EFFECTS =====
    applyEffect(target, effect, sourceName, targetName) {
        if (!effect) return;
        if (effect.heal) {
            target.hp = Math.min(target.maxHP, target.hp + effect.heal);
            this.log.setText(`${sourceName} healed ${effect.heal} HP!`);
        }
        if (effect.chanceConfuse && Phaser.Math.Between(1, 100) <= effect.chanceConfuse) {
            target.status.confuse = effect.durationTurns || 2;
            this.log.setText(`${targetName} is confused for ${target.status.confuse} turns!`);
        }
        if (effect.chanceSkip && Phaser.Math.Between(1, 100) <= effect.chanceSkip) {
            target.status.skip = 1;
            this.log.setText(`${targetName} flinched and will miss their next turn!`);
        }
        if (effect.sleep) {
            target.status.sleep = effect.durationTurns || 2;
            this.log.setText(`${targetName} fell asleep for ${target.status.sleep} turns!`);
        }
        if (effect.stun) {
            target.status.stun = effect.durationTurns || 1;
            this.log.setText(`${targetName} is stunned for ${target.status.stun} turn(s)!`);
        }
        if (effect.bleed) {
            target.status.bleed = effect.durationTurns || 2;
            this.log.setText(`${targetName} is bleeding for ${target.status.bleed} turns!`);
        }
        if (effect.atkBoost) {
            target.atkMod *= (1 + effect.atkBoost / 100);
            target.status.atkBoost = effect.durationTurns || 2;
            this.log.setText(`${targetName}'s attack rose for ${target.status.atkBoost} turns!`);
        }
        if (effect.defBoost) {
            target.defMod *= (1 + effect.defBoost / 100);
            target.status.defBoost = effect.durationTurns || 2;
            this.log.setText(`${targetName}'s defense rose for ${target.status.defBoost} turns!`);
        }
        if (effect.atkDebuff) {
            target.atkMod *= (1 - effect.atkDebuff / 100);
            target.status.atkDebuff = effect.durationTurns || 2;
            this.log.setText(`${targetName}'s attack dropped for ${target.status.atkDebuff} turns!`);
        }
        if (effect.reduceDefPct) {
            target.defMod *= (1 - effect.reduceDefPct / 100);
            target.status.defDebuff = effect.durationTurns || 2;
            this.log.setText(`${targetName}'s defense dropped for ${target.status.defDebuff} turns!`);
        }
    }

    tickStatuses(target, targetName) {
        if (target.status.bleed) {
            const bleedDmg = Math.round(target.maxHP * 0.05);
            target.hp = Math.max(0, target.hp - bleedDmg);
            this.log.setText(`${targetName} suffers ${bleedDmg} bleeding damage! (${target.status.bleed} turns left)`);
            target.status.bleed--;
        }
        ["sleep", "stun", "skip", "confuse", "atkBoost", "defBoost", "atkDebuff", "defDebuff"].forEach(s => {
            if (target.status[s]) target.status[s]--;
        });
    }

    // ===== TURN HANDLERS =====
    playerUseMove(idx) {
        if (this.currentTurn !== 'player') return;
        const move = this.playerData.moves[idx];

        if (this.playerState.status.sleep > 0) { this.log.setText(`${this.playerData.displayName} is asleep!`); return this.endTurn('foe'); }
        if (this.playerState.status.stun > 0) { this.log.setText(`${this.playerData.displayName} is stunned!`); return this.endTurn('foe'); }
        if (this.playerState.status.skip > 0) { this.log.setText(`${this.playerData.displayName} flinched!`); return this.endTurn('foe'); }

        if (!this.rollAccuracy(move)) this.log.setText(`${this.playerData.displayName}'s ${move.name} missed!`);
        else {
            this.playAttackAnimation(this.playerSprite, this.foeSprite, move.name);
            const dmg = this.applyDamage(this.playerState, this.foeState, move);
            this.applyEffect(this.foeState, move.effect, this.playerData.displayName, this.foeData.displayName);
            this.log.setText(`${this.playerData.displayName} used ${move.name}! ${dmg > 0 ? `It dealt ${dmg}!` : ""}`);
        }
        this.updateHPBars();
        if (this.foeState.hp <= 0) return this.win();
        this.endTurn('foe');
    }

    foeAction() {
        if (this.foeState.hp <= 0) return;
        const move = Phaser.Utils.Array.GetRandom(this.foeData.moves);

        if (this.foeState.status.sleep > 0) { this.log.setText(`${this.foeData.displayName} is asleep!`); return this.endTurn('player'); }
        if (this.foeState.status.stun > 0) { this.log.setText(`${this.foeData.displayName} is stunned!`); return this.endTurn('player'); }
        if (this.foeState.status.skip > 0) { this.log.setText(`${this.foeData.displayName} flinched!`); return this.endTurn('player'); }

        if (!this.rollAccuracy(move)) this.log.setText(`${this.foeData.displayName}'s ${move.name} missed!`);
        else {
            this.playAttackAnimation(this.foeSprite, this.playerSprite, move.name);
            const dmg = this.applyDamage(this.foeState, this.playerState, move);
            this.applyEffect(this.playerState, move.effect, this.foeData.displayName, this.playerData.displayName);
            this.log.setText(`${this.foeData.displayName} used ${move.name}! ${dmg > 0 ? `It dealt ${dmg}!` : ""}`);
        }
        this.updateHPBars();
        if (this.playerState.hp <= 0) return this.lose();
        this.endTurn('player');
    }

    endTurn(next) {
        this.tickStatuses(this.playerState, this.playerData.displayName);
        this.tickStatuses(this.foeState, this.foeData.displayName);
        this.currentTurn = next;
        if (next === 'foe') this.time.delayedCall(1800, () => this.foeAction(), [], this);
    }

    // ===== WIN / LOSE =====
    // ===== WIN / LOSE =====
    win() {
        this.log.setText(`${this.playerData.displayName} is victorious!`);

        this.time.delayedCall(2000, () => {
            let rewardText = null;
            const overworld = this.scene.get('OverworldScene');

            // --- 1️⃣ Handle normal NPC victories ---
            if (this.npcRef && this.foeData.id !== 'bridezilla') {
                this.npcRef.spent = true;

                const npcDialogues = overworld?.npcDialogues?.[this.npcRef.npcName];
                if (npcDialogues) {
                    for (let node of npcDialogues) {
                        const rewardChoice = node.choices?.find(c => c.reward);
                        if (rewardChoice) {
                            overworld.inventory.push(rewardChoice.reward);
                            overworld.updateInventoryHud();
                            rewardText = `You seized ${rewardChoice.reward.replace(/_/g, " ")} from ${this.npcRef.npcName}!`;
                            break;
                        }
                    }
                }
            }

            // --- 2️⃣ Persist player HP back to overworld ---
            if (overworld) {
                overworld.player.hp = this.playerState.hp;
                overworld.playerData.hp = this.playerState.hp;
            }

            // --- 3️⃣ Handle Bridezilla special case (final boss) ---
            if (this.foeData.id === 'bridezilla') {
                this.time.delayedCall(2500, () => {
                    this.scene.stop('BattleScene');
                    this.scene.stop('OverworldScene');
                    this.scene.start('CreditsScene', { playerId: this.playerData.id });
                });
                return; // stop further handling
            }

            // --- 4️⃣ Normal victory reward prompt ---
            if (rewardText) {
                const boxW = isMobile ? 480 : 420;
                const boxH = 110;
                const prompt = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, boxW, boxH, 0x000000, 0.85)
                    .setOrigin(0.5).setDepth(9999);
                const msg = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, rewardText, {
                    font: isMobile ? '18px VT323' : '16px monospace',
                    color: '#fff',
                    wordWrap: { width: boxW - 40, useAdvancedWrap: true },
                    align: 'center'
                }).setOrigin(0.5).setDepth(10000);

                const promptText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + boxH / 2 - 20,
                    isMobile ? '👉 Tap to continue' : 'Press [SPACE] to continue',
                    { font: '14px VT323', color: '#FFD700' }
                ).setOrigin(0.5).setDepth(10000);

                const cleanup = () => {
                    prompt.destroy(); msg.destroy(); promptText.destroy();
                    this.endBattle();
                };

                // both keyboard and tap support
                this.input.keyboard.once('keydown-SPACE', cleanup);
                this.input.once('pointerdown', cleanup);
            } else {
                this.endBattle();
            }
        });
    }

    lose() {
        this.log.setText(`You fainted...`);
        this.time.delayedCall(2000, () => {
            const prompt = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 460, 120, 0x000000, 0.85).setOrigin(0.5).setDepth(9999);
            const msg = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2,
                "GAME OVER!\n\nYou failed the sacred wedding quest...\nPress [SPACE] to return to Title.", {
                font: '16px monospace', color: '#fff',
                wordWrap: { width: 440, useAdvancedWrap: true }, align: 'center'
            }).setOrigin(0.5).setDepth(10000);
            this.input.keyboard.once('keydown-SPACE', () => {
                prompt.destroy(); msg.destroy();
                this.scene.stop('BattleScene');
                this.scene.stop('OverworldScene');
                this.scene.start('TitleScene');
            });
        });
    }

    endBattle() {
        this.scene.stop('BattleScene');
        this.scene.resume('OverworldScene');
        this.game.audioManager.playMusic('overworld_theme', { volume: 0.5 });
    }

    updateHPBars() {
        const pRatio = this.playerState.hp / this.playerState.maxHP;
        const fRatio = this.foeState.hp / this.foeState.maxHP;

        this.playerHPFill.scaleX = Phaser.Math.Clamp(pRatio, 0, 1);
        this.foeHPFill.scaleX = Phaser.Math.Clamp(fRatio, 0, 1);

        this.playerHPFill.fillColor =
            (pRatio > 0.6) ? 0x44cc44 : (pRatio > 0.3 ? 0xffcc00 : 0xff4444);
        this.foeHPFill.fillColor =
            (fRatio > 0.6) ? 0x44cc44 : (fRatio > 0.3 ? 0xffcc00 : 0xff4444);
    }
}

class CreditsScene extends Phaser.Scene {
    constructor() { super('CreditsScene'); }

    init(data) { this.playerId = data.playerId; }

    create() {
        const msg = this.playerId === 'boet'
            ? "You defeated Bridezilla!\n\nRick asks...\nWill you be his BEST MAN?"
            : "You defeated Bridezilla!\n\nRick asks...\nWill you be one of his groomsmen?";

        this.add.image(0, 0, 'battle_bg_grass').setOrigin(0).setAlpha(0.4);
        const text = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT + 40, msg + "\n\n— LEGEND OF THE BEST MEN —", {
            font: '20px VT323', color: '#fff', align: 'center', wordWrap: { width: 600 }
        }).setOrigin(0.5);

        this.tweens.add({
            targets: text,
            y: -text.height,
            duration: 18000,
            ease: 'Linear',
            onComplete: () => {
                this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, "Press [SPACE] to Return", {
                    font: '16px VT323', color: '#FFD700'
                }).setOrigin(0.5);
                this.input.keyboard.once('keydown-SPACE', () => this.scene.start('TitleScene'));
            }
        });
    }
}

//Phaser config
const config = {
    type: Phaser.AUTO,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 800,
        height: 600
    },
    render: {
        pixelArt: true   // <---- keep pixels sharp
    },
    parent: 'game-container',
    backgroundColor: '#222',
    physics: { default: 'arcade', arcade: { debug: false } },
    scene: [LoadingScene, BootScene, TitleScene, CharacterSelectScene, OverworldScene, BattleScene, CreditsScene]
};

const game = new Phaser.Game(config);
