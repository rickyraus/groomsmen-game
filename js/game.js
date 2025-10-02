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
        this.load.image('battle_bg_grass', 'assets/backgrounds/battle_grass.png');
        this.load.tilemapTiledJSON('map', 'assets/tilemaps/overworld.json');
        this.load.json('npcDialogues', 'assets/data/npcDialogues.json');
        this.load.json('characters', 'assets/data/characters.json');

        this.load.audio('overworld_theme', 'assets/audio/overworld_theme.ogg');
        this.load.audio('battle_theme', 'assets/audio/battle_theme.ogg');
        this.load.audio('menu_theme', 'assets/audio/menu_theme.ogg');

        this.load.spritesheet('quest_items', 'assets/sprites/items.png', {
            frameWidth: 341, frameHeight: 1024
        });

        WebFont.load({ google: { families: ['Pixelify Sans', 'VT323'] } });
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

        // --- Input: SPACE to Continue ---
        this.input.keyboard.once('keydown-SPACE', async () => {
            try {
                // Fix Chrome autoplay policy
                if (this.sound.context.state === 'suspended') {
                    await this.sound.context.resume();
                }
            } catch (e) {
                console.warn("⚠️ Audio resume failed:", e);
            }

            // Play menu theme + transition
            this.game.audioManager.playMusic('menu_theme', { volume: 1 });
            this.scene.start('CharacterSelectScene');
        });
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
    }

    create() {
        // Music
        this.game.audioManager.playMusic('overworld_theme', { volume: 0.5 });

        // Dialogue trees
        this.npcDialogues = this.cache.json.get('npcDialogues');

        // ---- WORLD ----
        const map = this.make.tilemap({ key: 'map' });
        const tileset = map.addTilesetImage('Overworld', 'overworld_tiles');
        const belowLayer = map.createLayer('Below', tileset, 0, 0);
        const worldLayer = map.createLayer('World', tileset, 0, 0);
        const aboveLayer = map.createLayer('Above', tileset, 0, 0);
        worldLayer.setCollisionByProperty({ collides: true });

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
        this.player.body.setSize(this.player.width, this.player.height, true);

        // ---- NPCs ----
        this.angryBridesmaid = this.physics.add.sprite(200, 200, 'angry_bridesmaid_idle', 4)
            .setImmovable(true).setScale(0.33).play('angry_bridesmaid_idle_down');
        this.priest = this.physics.add.sprite(600, 380, 'priest_idle', 4)
            .setImmovable(true).setScale(0.33).play('priest_idle_down');
        this.drunkUncle = this.physics.add.sprite(400, 300, 'drunk_uncle_idle', 4)
            .setImmovable(true).setScale(0.33).play('drunk_uncle_idle_down');

        [this.angryBridesmaid, this.priest, this.drunkUncle].forEach(npc => {
            npc.body.setSize(npc.width, npc.height, true);
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

        // ---- UI ROOT ----
        this.uiRoot = this.add.container(0, 0).setDepth(10000).setScrollFactor(0);
        mainCam.ignore(this.uiRoot);
        this.uiCam = this.cameras.add(0, 0, GAME_WIDTH, GAME_HEIGHT, false);
        this.uiCam.setZoom(1);
        this.uiCam.setScroll(0, 0);
        this.uiCam.ignore([
            belowLayer, worldLayer, aboveLayer,
            this.player, this.angryBridesmaid, this.priest, this.drunkUncle
        ]);

        // ---- HUD ----
        this.hud = this.add.text(GAME_WIDTH - 200, 16,
            `${this.playerData.displayName}\nHP: ${this.playerData.hp}`,
            { font: '14px monospace', backgroundColor: '#00000080', fill: '#ffffff', padding: 6 }
        ).setScrollFactor(0);
        this.uiRoot.add(this.hud);

        // ---- Mobile controls ----
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

        // ---- DIALOG BOX (reused for all NPCs) ----
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
        });

        // ✅ Intro quest
        if (!this.introShown) {
            this.introShown = true;
            this.showIntroQuest();
        }
    }

    // ===== NPC PROMPTS =====
    setNearbyNPC(npc) {
        this.currentlyNearNPC = npc;
        this.promptLabel.setText('[SPACE] Talk to ' + npc.npcName);
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
        const sx = (npc.x - cam.scrollX) * cam.zoom;
        const sy = (npc.y - npc.displayHeight * 0.8 - cam.scrollY) * cam.zoom;
        this.promptLabel.setPosition(sx, sy);
    }

    // ===== DIALOGUE SYSTEM =====
    openDialogueFor(npc) {
        const tree = this.npcDialogues[npc.npcName];
        if (!tree) return;
        this.dialogueTree = tree;
        this.dialogueNode = tree[0];
        this.dialogueNpc = npc;
        this.showDialogueNode(this.dialogueNode);
    }

    showDialogueNode(node) {
        if (this.choiceButtons) this.choiceButtons.forEach(b => b.destroy());
        this.choiceButtons = [];

        const npc = this.dialogueNpc;
        const cam = this.cameras.main;
        const sx = (npc.x - cam.scrollX) * cam.zoom;
        const sy = (npc.y - cam.scrollY) * cam.zoom;

        const bubbleWidth = 240;

        // Set text first so height is accurate
        this.dialogText
            .setText(`${npc.npcName}: ${node.text}`)
            .setWordWrapWidth(bubbleWidth - 20)
            .setVisible(true);

        const textHeight = this.dialogText.height;
        const bubbleHeight = textHeight + node.choices.length * 22 + 40;

        // Flip bubble if too close to top
        let bubbleY = sy - npc.displayHeight * 1.2;
        if (bubbleY - bubbleHeight / 2 < 0) {
            bubbleY = sy + npc.displayHeight * 1.2; // place below NPC
        }

        this.dialogBox
            .setPosition(sx, bubbleY)
            .setSize(bubbleWidth, bubbleHeight)
            .setVisible(true);

        // Reposition text neatly inside
        this.dialogText.setPosition(sx, bubbleY - bubbleHeight / 2 + 20);

        this.hud.setVisible(false);
        this.dialogueOpen = true;

        // Choices inside box with padding from bottom
        const startY = bubbleY - bubbleHeight / 2 + textHeight + 30;
        const maxY = bubbleY + bubbleHeight / 2 - 20; // margin at bottom
        node.choices.forEach((choice, idx) => {
            const y = Math.min(startY + idx * 22, maxY);
            const btn = this.add.text(sx, y, choice.text, {
                font: '12px monospace',
                backgroundColor: '#333',
                padding: { x: 4, y: 2 },
                color: '#fff'
            }).setOrigin(0.5).setInteractive();

            btn.on('pointerdown', () => this.chooseDialogueOption(choice));
            this.uiRoot.add(btn);
            this.choiceButtons.push(btn);
        });
    }

    chooseDialogueOption(choice) {
        if (choice.next === "battle" || choice.battle) {
            this.closeDialogue(true);
            const foeId = this.dialogueNpc.npcName.replace(" ", "_").toLowerCase();
            const foeData = this.game.characters.find(c => c.id === foeId);
            if (!foeData) { console.warn("No foe data for", foeId); return; }

            this.scene.launch('BattleScene', {
                player: this.playerData,
                foe: foeData
            });
            this.scene.pause();
            return;
        }

        if (choice.reward) {
            this.inventory.push(choice.reward);
            this.updateInventoryHud();
            this.dialogText.setText(`${this.dialogueNpc.npcName}: You got ${choice.reward}!`);
            this.time.delayedCall(1500, () => this.closeDialogue(), [], this);
            return;
        }

        if (choice.next === "end" || !choice.next) {
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
        this.dialogText
            .setText("The Groom is in despair!\n\nHe has lost three sacred treasures:\n💍 The Wedding Band\n👰 The Veil\n💙 Something Blue\n\nYou, brave Groomsman, must recover them\nfrom the guests you encounter —\nby words... or by force.")
            .setWordWrapWidth(GAME_WIDTH - 120)
            .setVisible(true);
    
        // Measure and resize box dynamically
        const textHeight = this.dialogText.height;
        const boxHeight = textHeight + 40;
    
        this.dialogBox
            .setPosition(GAME_WIDTH / 2, GAME_HEIGHT / 2)
            .setSize(GAME_WIDTH - 80, boxHeight)
            .setVisible(true);
    
        this.dialogText.setPosition(GAME_WIDTH / 2, GAME_HEIGHT / 2 - boxHeight / 2 + 20);
    
        this.hud.setVisible(false);
        this.dialogueOpen = true;
    
        this.input.keyboard.once('keydown-SPACE', () => {
            this.dialogBox.setVisible(false);
            this.dialogText.setVisible(false);
            this.hud.setVisible(true);
            this.dialogueOpen = false;
        });
    }    

    // ===== MOBILE CONTROLS =====
    createMobileControls() {
        this.input.addPointer(1);
        this.joyBase = this.add.circle(80, GAME_HEIGHT - 80, 40, 0x000000, 0.3)
            .setScrollFactor(0).setDepth(2000);
        this.joyStick = this.add.circle(80, GAME_HEIGHT - 80, 20, 0xffffff, 0.6)
            .setScrollFactor(0).setDepth(2001);

        this.actionBtn = this.add.text(GAME_WIDTH - 80, GAME_HEIGHT - 80, 'A', {
            font: '24px monospace',
            backgroundColor: '#FFD700',
            color: '#000',
            padding: { x: 16, y: 16 }
        }).setOrigin(0.5).setInteractive().setScrollFactor(0).setDepth(2000);

        this.actionBtn.on('pointerdown', () => {
            if (this.dialogueOpen) this.closeDialogue();
            else if (this.currentlyNearNPC) this.openDialogueFor(this.currentlyNearNPC);
        });

        this.input.on('pointerdown', (p) => {
            if (p.x < GAME_WIDTH / 2) {
                this.joyTouch = p.id;
                this.joyStick.setPosition(p.x, p.y);
            }
        });
        this.input.on('pointermove', (p) => {
            if (this.joyTouch === p.id) {
                this.joyStick.setPosition(p.x, p.y);
            }
        });
        this.input.on('pointerup', (p) => {
            if (this.joyTouch === p.id) {
                this.joyTouch = null;
                this.joyStick.setPosition(this.joyBase.x, this.joyBase.y);
            }
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
            console.log("✅ Player has all 3 items – final boss unlocked!");
            this.time.delayedCall(1000, () => {
                const boss = this.game.characters.find(c => c.id === 'bridezilla');
                if (!boss) return;
                this.scene.launch('BattleScene', {
                    player: this.playerData,
                    foe: boss
                });
                this.scene.pause();
            });
        }
    }

    // ===== UPDATE LOOP =====
    update() {
        const speed = BASE_SPEED;
        let moveX = 0, moveY = 0;

        if (this.dialogueOpen) {
            this.player.setVelocity(0, 0);
        } else {
            if (isMobile && this.joyTouch) {
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
        this.updateNpcPromptPos();
        this.hud.setText(`${this.playerData.displayName}\nHP: ${this.player.hp}`);
    }
}

class BattleScene extends Phaser.Scene {
    constructor() { super('BattleScene'); }

    init(data) {
        this.playerData = JSON.parse(JSON.stringify(data.player)); // clone so we don't overwrite base json
        this.foeData = JSON.parse(JSON.stringify(data.foe));
    }

    create() {
        const DEPTH_BG = 0, DEPTH_PLATFORM = 1, DEPTH_UI = 5, DEPTH_SPRITES = 6;
        this.game.audioManager.playMusic('battle_theme', { volume: 0.5, fadeTime: 1500 });

        // --- Background ---
        this.bg = this.add.image(0, 0, 'battle_bg_grass')
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
            maxHP: this.playerData.hp,
            hp: this.playerData.hp,
            atkMod: 1,
            defMod: 1,
            status: {},
        };
        this.foeState = {
            maxHP: this.foeData.hp,
            hp: this.foeData.hp,
            atkMod: 1,
            defMod: 1,
            status: {},
        };

        // ===== UI HELPERS =====
        const makePanel = (x, y, w, h) => {
            const c = this.add.container(x, y).setDepth(DEPTH_UI);
            const shadow = this.add.rectangle(4, 4, w, h, 0x000000, 0.08).setOrigin(0);
            const frame = this.add.rectangle(0, 0, w, h, 0xffffff, 1).setOrigin(0).setStrokeStyle(2, 0x111111);
            c.add([shadow, frame]);
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
            const pad = 10, barW = 140, barH = 10;
            const x = frameWidth - pad - barW / 2;
            const y = frameHeight - pad - barH / 2;

            const label = this.add.text(x - barW / 2 - 28, y - 8, 'HP', {
                font: '12px monospace', fill: '#333'
            }).setOrigin(0, 0);
            const bg = this.add.rectangle(x, y, barW, barH, 0x888888).setOrigin(0.5);
            const fill = this.add.rectangle(x, y, barW, barH, 0x44cc44).setOrigin(0.5);
            parent.add([label, bg, fill]);
            return { fill, barW };
        };

        // ===== INFO BOXES =====
        this.foeUI = makePanel(420, 40, 320, 60);
        this.foeText = addLabel(this.foeUI, `${this.foeData.displayName} Lv.5`, 10, 10, 300);
        const foeHP = addHP(this.foeUI, 320, 60);
        this.foeHPFill = foeHP.fill;

        this.playerUI = makePanel(40, 270, 320, 60);
        this.playerText = addLabel(this.playerUI, `${this.playerData.displayName} Lv.5`, 10, 10, 300);
        const plyHP = addHP(this.playerUI, 320, 60);
        this.playerHPFill = plyHP.fill;

        // ===== Dialogue + Menu =====
        this.dialogUI = makePanel(20, 400, 760, 90);
        this.log = addLabel(this.dialogUI, 'What will you do?', 12, 12, 740);

        this.menuUI = makePanel(20, 500, 760, 90);
        this.moveButtons = [];
        const cols = 2, gutter = 16, pad = 12;
        const colW = (760 - pad * 2 - gutter) / cols;
        const rowH = 30;

        this.playerData.moves.forEach((m, idx) => {
            const col = idx % cols;
            const row = Math.floor(idx / cols);
            const x = pad + col * (colW + gutter);
            const y = pad + row * rowH;

            const btnC = this.add.container(x, y);
            const btnBg = this.add.rectangle(0, 0, colW, 26, 0xeeeeee).setOrigin(0).setStrokeStyle(1, 0xbbbbbb);
            const t = this.add.text(8, 5, m.name.toUpperCase(), {
                font: '14px monospace', fill: '#000', wordWrap: { width: colW - 16 }
            }).setOrigin(0, 0);
            btnC.add([btnBg, t]);
            btnC.setSize(colW, 26).setInteractive(new Phaser.Geom.Rectangle(0, 0, colW, 26), Phaser.Geom.Rectangle.Contains);

            btnC.on('pointerover', () => btnBg.setFillStyle(0xdddddd));
            btnC.on('pointerout', () => btnBg.setFillStyle(0xeeeeee));
            btnC.on('pointerdown', () => this.playerUseMove(idx));

            this.menuUI.add(btnC);
            this.moveButtons.push(btnC);
        });

        // --- State ---
        this.currentTurn = 'player';
        this.updateHPBars(true);
    }

    // ====== CORE HELPERS ======
    rollAccuracy(move) {
        return Phaser.Math.Between(1, 100) <= (move.accuracy || 100);
    }

    applyDamage(attacker, defender, move) {
        let dmg = move.power || 0;
        dmg *= attacker.atkMod || 1;
        dmg *= 1 / (defender.defMod || 1);
        defender.hp = Math.max(0, defender.hp - dmg);
        return Math.round(dmg);
    }

    applyEffect(target, effect) {
        if (!effect) return;
        if (effect.chanceConfuse && Phaser.Math.Between(1, 100) <= effect.chanceConfuse) {
            target.status.confuse = effect.durationTurns || 2;
            this.log.setText(`${target === this.playerState ? this.playerData.displayName : this.foeData.displayName} is confused!`);
        }
        if (effect.chanceSkip && Phaser.Math.Between(1, 100) <= effect.chanceSkip) {
            target.status.skip = 1;
            this.log.setText(`${target === this.playerState ? this.playerData.displayName : this.foeData.displayName} flinched!`);
        }
        if (effect.sleep) {
            target.status.sleep = effect.durationTurns || 2;
            this.log.setText(`${target === this.playerState ? this.playerData.displayName : this.foeData.displayName} fell asleep!`);
        }
        if (effect.stun) {
            target.status.stun = effect.durationTurns || 1;
            this.log.setText(`${target === this.playerState ? this.playerData.displayName : this.foeData.displayName} is stunned!`);
        }
        if (effect.bleed) {
            target.status.bleed = effect.durationTurns || 2;
            this.log.setText(`${target === this.playerState ? this.playerData.displayName : this.foeData.displayName} is bleeding!`);
        }
        if (effect.atkBoost) {
            target.atkMod *= (1 + effect.atkBoost / 100);
            target.status.atkBoost = effect.durationTurns || 2;
            this.log.setText(`${target === this.playerState ? this.playerData.displayName : this.foeData.displayName} attack rose!`);
        }
        if (effect.defBoost) {
            target.defMod *= (1 + effect.defBoost / 100);
            target.status.defBoost = effect.durationTurns || 2;
            this.log.setText(`${target === this.playerState ? this.playerData.displayName : this.foeData.displayName} defense rose!`);
        }
        if (effect.atkDebuff) {
            target.atkMod *= (1 - effect.atkDebuff / 100);
            target.status.atkDebuff = effect.durationTurns || 2;
            this.log.setText(`${target === this.playerState ? this.playerData.displayName : this.foeData.displayName} attack fell!`);
        }
        if (effect.reduceDefPct) {
            target.defMod *= (1 - effect.reduceDefPct / 100);
            target.status.defDebuff = effect.durationTurns || 2;
            this.log.setText(`${target === this.playerData.displayName ? this.playerData.displayName : this.foeData.displayName} defense fell!`);
        }
    }

    tickStatuses(target) {
        // apply DOT effects
        if (target.status.bleed) {
            const bleedDmg = Math.round(target.maxHP * 0.05);
            target.hp = Math.max(0, target.hp - bleedDmg);
            this.log.setText(`${target === this.playerState ? this.playerData.displayName : this.foeData.displayName} bleeds for ${bleedDmg} damage!`);
            target.status.bleed--;
        }
        if (target.status.sleep) target.status.sleep--;
        if (target.status.stun) target.status.stun--;
        if (target.status.skip) target.status.skip--;
        if (target.status.confuse) target.status.confuse--;
        if (target.status.atkBoost) target.status.atkBoost--;
        if (target.status.defBoost) target.status.defBoost--;
        if (target.status.atkDebuff) target.status.atkDebuff--;
        if (target.status.defDebuff) target.status.defDebuff--;
    }

    // ===== TURN HANDLERS =====
    playerUseMove(idx) {
        if (this.currentTurn !== 'player') return;
        const move = this.playerData.moves[idx];

        if (!this.rollAccuracy(move)) {
            this.log.setText(`${this.playerData.displayName}'s ${move.name} missed!`);
        } else {
            const dmg = this.applyDamage(this.playerState, this.foeState, move);
            this.applyEffect(this.foeState, move.effect);
            this.log.setText(`${this.playerData.displayName} used ${move.name}! ${dmg > 0 ? "It dealt " + dmg + "!" : ""}`);
        }

        this.updateHPBars();
        if (this.foeState.hp <= 0) return this.win();

        this.currentTurn = 'foe';
        this.time.delayedCall(1800, () => this.foeAction(), [], this);
    }

    foeAction() {
        if (this.foeState.hp <= 0) return;
        const move = Phaser.Utils.Array.GetRandom(this.foeData.moves);

        if (!this.rollAccuracy(move)) {
            this.log.setText(`${this.foeData.displayName}'s ${move.name} missed!`);
        } else {
            const dmg = this.applyDamage(this.foeState, this.playerState, move);
            this.applyEffect(this.playerState, move.effect);
            this.log.setText(`${this.foeData.displayName} used ${move.name}! ${dmg > 0 ? "It dealt " + dmg + "!" : ""}`);
        }

        this.updateHPBars();
        if (this.playerState.hp <= 0) return this.lose();

        this.currentTurn = 'player';
    }

    // ===== WIN / LOSE =====
    win() {
        this.log.setText(`${this.playerData.displayName} is victorious!`);
        this.time.delayedCall(2000, () => {
            this.scene.stop('BattleScene');
            this.scene.resume('OverworldScene');
            this.game.audioManager.playMusic('overworld_theme', { volume: 0.5 });
        });
    }

    lose() {
        this.log.setText(`You fainted...`);
        this.time.delayedCall(2000, () => {
            this.scene.stop('BattleScene');
            this.scene.resume('OverworldScene');
            this.game.audioManager.playMusic('overworld_theme', { volume: 0.5 });
        });
    }

    // ===== HP BAR UPDATE =====
    updateHPBars(skipTween = false) {
        const pRatio = this.playerState.hp / this.playerState.maxHP;
        const fRatio = this.foeState.hp / this.foeState.maxHP;
        this.playerHPFill.scaleX = Phaser.Math.Clamp(pRatio, 0, 1);
        this.foeHPFill.scaleX = Phaser.Math.Clamp(fRatio, 0, 1);
        this.playerHPFill.fillColor = (pRatio > 0.6) ? 0x44cc44 : (pRatio > 0.3 ? 0xffcc00 : 0xff4444);
        this.foeHPFill.fillColor = (fRatio > 0.6) ? 0x44cc44 : (fRatio > 0.3 ? 0xffcc00 : 0xff4444);
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
    scene: [LoadingScene, BootScene, TitleScene, CharacterSelectScene, OverworldScene, BattleScene]
};

const game = new Phaser.Game(config);
