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

// Character definitions
const CHARACTERS = [
    {
        id: 'travioli',
        displayName: 'Travioli',
        desc: 'A loyal British bulldog channelling Churchill — verbose, unflappable, and armed with confusing conversation.',
        color: 0x4d4dff,
        avatar: 'avatars/travioli.png',
        hp: 100,
        moves: [
            { name: 'Endless Dialogue', type: 'psychic', power: 10, effect: { slowAttackPct: 20 } },
            { name: 'Sup?', type: 'trick', power: 5, effect: { chanceSkip: 30 } }
        ]
    },
    {
        id: 'badger',
        displayName: 'The Badger',
        desc: 'A geologist of fearsome flatulence and unrelenting dad jokes.',
        color: 0x9e6b3a,
        avatar: 'avatars/badger.png',
        hp: 110,
        moves: [
            { name: 'Fartquake', type: 'physical', power: 20, effect: { chanceStun: 30 } },
            { name: 'Rock Facts', type: 'physical', power: 10, effect: { chanceConfuse: 15 } }
        ]
    },
    {
        id: 'enfant',
        displayName: 'Le Enfant Terrible',
        desc: 'A chaotic Frenchman fueled by cheese, wine, and boerewors.',
        avatar: 'avatars/enfant.png',
        color: 0xff7fbf,
        hp: 95,
        moves: [
            { name: 'Fromage Barrage', type: 'physical', power: 20, effect: { chanceMissNext: 25 } },
            { name: 'Surrender', type: 'story', power: 0, effect: { surrender: true } }
        ]
    },
    {
        id: 'boet',
        displayName: 'The Boet',
        desc: 'The dependable younger brother with a heart as big as his dog collection.',
        color: 0x3aff9e,
        avatar: 'avatars/boet.png',
        hp: 105,
        moves: [
            { name: 'Paws of Justice', type: 'physical', power: 15, effect: { reduceDefPct: 10, durationTurns: 2 } },
            { name: 'Buffer Overflow', type: 'psychic', power: 10, effect: { chanceConfuse: 25 } }
        ]
    }
];

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

// --- LoadingScene ---
class LoadingScene extends Phaser.Scene {
    constructor() { super('LoadingScene'); }

    preload() {
        const { width, height } = this.scale;

        const progressBox = this.add.graphics();
        const progressBar = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);

        const loadingText = this.add.text(width / 2, height / 2 - 50, 'Loading...', { font: '20px monospace', fill: '#ffffff' }).setOrigin(0.5);
        const percentText = this.add.text(width / 2, height / 2, '0%', { font: '18px monospace', fill: '#ffffff' }).setOrigin(0.5);

        this.load.on('progress', (value) => {
            progressBar.clear();
            progressBar.fillStyle(0xffffff, 1);
            progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
            percentText.setText(parseInt(value * 100) + '%');
        });

        this.load.on('complete', () => {
            progressBar.destroy();
            progressBox.destroy();
            loadingText.setText('Ready!');
            percentText.destroy();
            this.time.delayedCall(500, () => this.scene.start('BootScene'));
        });

        // Assets
        this.load.image('overworld_tiles', 'assets/tilesets/Overworld.png');
        this.load.tilemapTiledJSON('map', 'assets/tilemaps/overworld.json');
        this.load.json('npcDialogues', 'assets/data/npcDialogues.json');

        this.load.audio('overworld_theme', 'assets/audio/overworld_theme.ogg');
        this.load.audio('battle_theme', 'assets/audio/battle_theme.ogg');
        this.load.audio('menu_theme', 'assets/audio/menu_theme.ogg');

        CHARACTERS.forEach(ch => {
            this.load.image('avatar_' + ch.id, 'assets/' + ch.avatar);
            // Idle sheet (usually 4 frames: down, left, right, up)
            // Idle (2 frames × 4 directions)
            this.load.spritesheet(ch.id + '_idle', `assets/sprites/${ch.id}/standard/idle.png`, {
                frameWidth: 64,
                frameHeight: 64
            });
            // Walk (8 frames × 4 directions)
            this.load.spritesheet(ch.id + '_walk', `assets/sprites/${ch.id}/standard/walk.png`, {
                frameWidth: 64,
                frameHeight: 64
            });
            this.load.image('battle_back_' + ch.id, 'assets/battle_sprites/back_' + ch.id + '.png');
            this.load.image('battle_front_' + ch.id, 'assets/battle_sprites/front_' + ch.id + '.png');
        });

        // NPC idle-only spritesheets (2 frames × 4 directions, 64x64)
        ['angry_bridesmaid', 'priest', 'drunk_uncle'].forEach(npcId => {
            this.load.spritesheet(npcId + '_idle', `assets/sprites/${npcId}/standard/idle.png`, {
                frameWidth: 64,
                frameHeight: 64
            });
        });

        this.load.spritesheet('quest_items', 'assets/sprites/items.png', {
            frameWidth: 341,
            frameHeight: 1024
        });
        console.log("quest_items frames:", this.textures.get('quest_items').frameTotal);

    }
}

// --- BootScene ---
class BootScene extends Phaser.Scene {
    constructor() { super('BootScene'); }
    create() {
        this.game.audioManager = new AudioManager(this.game);

        // Placeholder textures
        CHARACTERS.forEach(ch => {
            const g = this.add.graphics();
            g.fillStyle(ch.color, 1);
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

        // Animations
        CHARACTERS.forEach(ch => {
            // Idle breathing (unchanged, 2 frames each)
            this.anims.create({
                key: ch.id + '_idle_up',
                frames: this.anims.generateFrameNumbers(ch.id + '_idle', { start: 0, end: 1 }),
                frameRate: 2,
                repeat: -1
            });
            this.anims.create({
                key: ch.id + '_idle_left',
                frames: this.anims.generateFrameNumbers(ch.id + '_idle', { start: 2, end: 3 }),
                frameRate: 2,
                repeat: -1
            });
            this.anims.create({
                key: ch.id + '_idle_down',
                frames: this.anims.generateFrameNumbers(ch.id + '_idle', { start: 4, end: 5 }),
                frameRate: 2,
                repeat: -1
            });
            this.anims.create({
                key: ch.id + '_idle_right',
                frames: this.anims.generateFrameNumbers(ch.id + '_idle', { start: 6, end: 7 }),
                frameRate: 2,
                repeat: -1
            });

            // Walk cycles (9 frames each)
            this.anims.create({
                key: ch.id + '_walk_up',
                frames: this.anims.generateFrameNumbers(ch.id + '_walk', { start: 0, end: 8 }),
                frameRate: 10,
                repeat: -1
            });
            this.anims.create({
                key: ch.id + '_walk_left',
                frames: this.anims.generateFrameNumbers(ch.id + '_walk', { start: 9, end: 17 }),
                frameRate: 10,
                repeat: -1
            });
            this.anims.create({
                key: ch.id + '_walk_down',
                frames: this.anims.generateFrameNumbers(ch.id + '_walk', { start: 18, end: 26 }),
                frameRate: 10,
                repeat: -1
            });
            this.anims.create({
                key: ch.id + '_walk_right',
                frames: this.anims.generateFrameNumbers(ch.id + '_walk', { start: 27, end: 35 }),
                frameRate: 10,
                repeat: -1
            });
        });

        ['angry_bridesmaid', 'priest', 'drunk_uncle'].forEach(npcId => {
            this.anims.create({ key: npcId + '_idle_up', frames: this.anims.generateFrameNumbers(npcId + '_idle', { start: 0, end: 1 }), frameRate: 2, repeat: -1 });
            this.anims.create({ key: npcId + '_idle_left', frames: this.anims.generateFrameNumbers(npcId + '_idle', { start: 2, end: 3 }), frameRate: 2, repeat: -1 });
            this.anims.create({ key: npcId + '_idle_down', frames: this.anims.generateFrameNumbers(npcId + '_idle', { start: 4, end: 5 }), frameRate: 2, repeat: -1 });
            this.anims.create({ key: npcId + '_idle_right', frames: this.anims.generateFrameNumbers(npcId + '_idle', { start: 6, end: 7 }), frameRate: 2, repeat: -1 });
        });

        this.scene.start('TitleScene');
    }
}

// --- TitleScene ---
class TitleScene extends Phaser.Scene {
    constructor() { super('TitleScene'); }

    create() {
        const { width, height } = this.scale;

        this.add.rectangle(0, 0, width, height, 0x111111).setOrigin(0);

        this.add.text(width / 2, height / 2 - 40, 'LEGEND OF THE BEST MEN', {
            font: '28px monospace',
            fill: '#FFD700'
        }).setOrigin(0.5);

        const prompt = this.add.text(width / 2, height / 2 + 40, 'Press SPACE to Start', {
            font: '18px monospace',
            fill: '#FFFFFF'
        }).setOrigin(0.5);

        this.tweens.add({ targets: prompt, alpha: { from: 1, to: 0.3 }, duration: 800, yoyo: true, repeat: -1 });

        this.input.keyboard.once('keydown-SPACE', async () => {
            try {
                if (this.sound.context.state === 'suspended') {
                    await this.sound.context.resume();
                    console.log("🔊 AudioContext resumed manually");
                }
            } catch (e) {
                console.warn("Audio resume failed:", e);
            }
            this.input.once('pointerdown', () => {
                if (this.sound.context.state === 'suspended') {
                    this.sound.context.resume().then(() => {
                        console.log("🔊 AudioContext resumed manually");
                    });
                }
            });
            this.game.audioManager.playMusic('menu_theme', { volume: 1, fadeTime: 0 });
            this.scene.start('CharacterSelectScene');
        });

    }
}

// --- CharacterSelectScene ---
class CharacterSelectScene extends Phaser.Scene {
    constructor() { super('CharacterSelectScene'); }

    create() {
        // Background panel
        this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH - 80, GAME_HEIGHT - 100, 0x000000, 0.6)
            .setStrokeStyle(4, 0xffffff);

        // Title (moved lower so it stays inside frame)
        this.add.text(GAME_WIDTH / 2, 70, 'LEGEND OF THE BEST MEN', {
            font: '30px monospace',
            fill: '#FFD700'
        }).setOrigin(0.5);

        this.add.text(GAME_WIDTH / 2, 110, 'Choose your Champion', {
            font: '18px monospace',
            fill: '#ffffff'
        }).setOrigin(0.5);

        this.selected = 0;
        this.cards = [];

        // Layout
        const spacingX = 180;
        const baseX = GAME_WIDTH / 2 - (CHARACTERS.length - 1) * spacingX / 2;
        const y = 280;

        CHARACTERS.forEach((ch, idx) => {
            const x = baseX + idx * spacingX;

            // Card background
            const cardBg = this.add.rectangle(0, 0, 120, 160, 0x222222, 0.7)
                .setStrokeStyle(2, 0xffffff);

            // Portrait image
            const portrait = this.add.image(0, 0, 'avatar_' + ch.id);

            // 🔑 Ensure portrait fills box (even if some gets cropped)
            const maxW = 100, maxH = 100;
            const tex = this.textures.get('avatar_' + ch.id).getSourceImage();
            const scale = Math.max(maxW / tex.width, maxH / tex.height);
            portrait.setScale(scale);

            // Container groups elements
            const container = this.add.container(x, y, [cardBg, portrait]);
            container.setSize(120, 160);
            container.setInteractive({ cursor: 'pointer' });

            // Hover effect (zoom + colored frame)
            container.on('pointerover', () => {
                this.tweens.add({
                    targets: portrait,
                    scale: scale * 1.1,
                    duration: 200,
                    ease: 'Sine.easeOut'
                });
                cardBg.setStrokeStyle(3, ch.color);
            });

            container.on('pointerout', () => {
                this.tweens.add({
                    targets: portrait,
                    scale: scale,
                    duration: 200,
                    ease: 'Sine.easeIn'
                });
                cardBg.setStrokeStyle(2, 0xffffff);
            });

            container.on('pointerdown', () => { this.select(idx); });

            this.cards.push(container);
        });

        // Info box
        this.infoBox = this.add.text(GAME_WIDTH / 2, 460, CHARACTERS[0].desc, {
            font: '14px monospace',
            fill: '#ffffff',
            wordWrap: { width: GAME_WIDTH - 120 }
        }).setOrigin(0.5);

        // Start button
        this.startBtn = this.add.text(GAME_WIDTH / 2, 520, '▶ Start Game', {
            font: '20px monospace',
            fill: '#000',
            backgroundColor: '#FFD700',
            padding: { x: 14, y: 6 }
        }).setOrigin(0.5).setInteractive({ cursor: 'pointer' });

        this.startBtn.on('pointerover', () => this.startBtn.setStyle({ backgroundColor: '#FFA500' }));
        this.startBtn.on('pointerout', () => this.startBtn.setStyle({ backgroundColor: '#FFD700' }));

        this.startBtn.on('pointerdown', () => {
            const chosen = CHARACTERS[this.selected];
            this.scene.start('OverworldScene', { player: chosen });
        });
        this.muteBtn = new MuteButton(this);
        this.select(0);
    }

    select(idx) {
        this.selected = idx;
        if (this.highlight) this.highlight.destroy();

        const container = this.cards[idx];

        // Unique color frame for each selection
        this.highlight = this.add.rectangle(0, 0, 124, 164)
            .setStrokeStyle(4, CHARACTERS[idx].color)
            .setOrigin(0.5);
        container.add(this.highlight);

        this.children.bringToTop(this.startBtn);
        this.infoBox.setText(CHARACTERS[idx].desc);
    }
}

class OverworldScene extends Phaser.Scene {
    constructor() { super('OverworldScene'); }

    init(data) {
        this.playerData = data.player;
        this.currentlyNearNPC = null;
        this.dialogueOpen = false;
        this.inventory = []; // ✅ minimal inventory
    }

    create() {
        // Music
        this.game.audioManager.playMusic('overworld_theme', { volume: 0.5 });

        //Dialogue
        this.npcDialogues = this.cache.json.get('npcDialogues');

        // ---- WORLD
        const map = this.make.tilemap({ key: 'map' });
        const tileset = map.addTilesetImage('Overworld', 'overworld_tiles');
        const belowLayer = map.createLayer('Below', tileset, 0, 0);
        const worldLayer = map.createLayer('World', tileset, 0, 0);
        const aboveLayer = map.createLayer('Above', tileset, 0, 0);
        worldLayer.setCollisionByProperty({ collides: true });

        // Controls
        this.cursors = this.input.keyboard.createCursorKeys();
        this.keyW = this.input.keyboard.addKey('W');
        this.keyA = this.input.keyboard.addKey('A');
        this.keyS = this.input.keyboard.addKey('S');
        this.keyD = this.input.keyboard.addKey('D');

        // ---- PLAYER
        const spawnPoint = map.findObject('Objects', obj => obj.name === 'SpawnPoint') || { x: 100, y: 100 };
        this.player = this.physics.add.sprite(spawnPoint.x, spawnPoint.y, this.playerData.id + '_idle', 4);
        this.player.setScale(0.33).setCollideWorldBounds(true).play(this.playerData.id + '_idle_down');
        this.player.hp = this.playerData.hp;
        this.physics.add.collider(this.player, worldLayer);
        this.player.body.setSize(this.player.width, this.player.height, true);

        // ---- NPCs
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

        // ---- MAIN CAMERA
        const mainCam = this.cameras.main;
        this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        mainCam.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        mainCam.startFollow(this.player, true, 0.1, 0.1);
        mainCam.setZoom(SCALE);

        // ---- UI CAMERA
        this.uiRoot = this.add.container(0, 0).setDepth(10000).setScrollFactor(0);
        mainCam.ignore(this.uiRoot);
        this.uiCam = this.cameras.add(0, 0, GAME_WIDTH, GAME_HEIGHT, false);
        this.uiCam.setZoom(1);
        this.uiCam.setScroll(0, 0);
        this.uiCam.ignore([belowLayer, worldLayer, aboveLayer, this.player, this.angryBridesmaid, this.priest, this.drunkUncle]);

        // ---- HUD
        this.hud = this.add.text(GAME_WIDTH - 200, 16,
            `${this.playerData.displayName}\nHP: ${this.playerData.hp}`,
            { font: '14px monospace', backgroundColor: '#00000080', fill: '#ffffff', padding: 6 }
        ).setScrollFactor(0);
        this.uiRoot.add(this.hud);

        // 🎒 Inventory HUD (3 slots, bottom center)
        this.inventorySlots = [];
        const slotSize = 32;
        const spacing = 40;
        const startX = GAME_WIDTH / 2 - spacing; // centers 3 slots
        const y = GAME_HEIGHT - 50;

        for (let i = 0; i < 3; i++) {
            const slot = this.add.rectangle(startX + i * spacing, y, slotSize, slotSize, 0x000000, 0.5)
                .setStrokeStyle(2, 0xffffff)
                .setScrollFactor(0);
            this.uiRoot.add(slot);
            this.inventorySlots.push(slot);
        }

        // ---- NPC PROMPT
        this.promptLabel = this.add.text(0, 0, '', {
            font: '12px monospace',
            backgroundColor: '#000A',
            padding: { x: 4, y: 2 },
            color: '#fff'
        }).setOrigin(0.5, 1).setVisible(false).setScrollFactor(0);
        this.uiRoot.add(this.promptLabel);

        // ---- DIALOGUE
        this.dialogBox = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 140, GAME_WIDTH - 120, 120, 0x000000, 0.7)
            .setOrigin(0.5, 0).setVisible(false).setScrollFactor(0);
        this.dialogText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 132, '', {
            font: '14px monospace',
            wordWrap: { width: GAME_WIDTH - 140, useAdvancedWrap: true },
            align: 'center',
            color: '#fff'
        }).setOrigin(0.5, 0).setVisible(false).setScrollFactor(0);
        this.uiRoot.add([this.dialogBox, this.dialogText]);

        // ---- OVERLAPS
        const near = (npc) => () => this.setNearbyNPC(npc);
        this.physics.add.overlap(this.player, this.angryBridesmaid, near(this.angryBridesmaid), null, this);
        this.physics.add.overlap(this.player, this.priest, near(this.priest), null, this);
        this.physics.add.overlap(this.player, this.drunkUncle, near(this.drunkUncle), null, this);

        // ---- SPACE for dialogue
        this.input.keyboard.on('keydown-SPACE', () => {
            if (this.dialogueOpen) {
                this.closeDialogue();
            } else if (this.currentlyNearNPC) {
                this.openDialogueFor(this.currentlyNearNPC);
            }
        });
    }

    // ===== Prompt =====
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

    // ===== Dialogue Tree =====
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

        this.dialogText.setText(`${this.dialogueNpc.npcName}: ${node.text}`);
        this.dialogBox.setVisible(true);
        this.dialogText.setVisible(true);
        this.hud.setVisible(false);
        this.dialogueOpen = true;

        const startY = GAME_HEIGHT - 80;
        node.choices.forEach((choice, idx) => {
            const btn = this.add.text(GAME_WIDTH / 2, startY + idx * 22, choice.text, {
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
            this.scene.launch('BattleScene', {
                player: this.playerData,
                foe: { id: this.dialogueNpc.npcName.replace(" ", "_").toLowerCase(), name: this.dialogueNpc.npcName, hp: 80, moves: [{ name: "Angry Slap", power: 10 }] }
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

    // ===== Inventory HUD =====
    updateInventoryHud() {
        const frameMap = {
            wedding_band: 0,
            something_blue: 1,
            wedding_veil: 2
        };

        this.inventorySlots.forEach((slot, i) => {
            if (slot.itemSprite) {
                slot.itemSprite.destroy();
                slot.itemSprite = null;
            }

            if (this.inventory[i]) {
                const frame = frameMap[this.inventory[i]];
                console.log("🎒 Updating HUD. Current inventory:", this.inventory);
                if (frame !== undefined) {
                    const icon = this.add.image(slot.x, slot.y, 'quest_items', frame)
                        .setOrigin(0.5)          // center in slot
                        .setDisplaySize(28, 28)  // slightly smaller than 32×32
                        .setScrollFactor(0)
                        .setDepth(10100);        // above slots

                    this.uiRoot.add(icon);
                    slot.itemSprite = icon;
                    console.log(`🖼 Added icon ${this.inventory[i]} at frame ${frame}`);


                }
            }
        });

        // 🎯 Check for full inventory → trigger final boss
        if (this.inventory.includes('wedding_band') &&
            this.inventory.includes('something_blue') &&
            this.inventory.includes('wedding_veil')) {
            console.log("✅ Player has all 3 items – final boss unlocked!");
            this.time.delayedCall(1000, () => {
                this.scene.launch('BattleScene', {
                    player: this.playerData,
                    foe: {
                        id: 'bridezilla',
                        name: 'Bridezilla',
                        hp: 200,
                        moves: [
                            { name: "Tearful Rage", power: 15 },
                            { name: "Bouquet Slam", power: 25 }
                        ]
                    }
                });
                this.scene.pause();
            });
        }
    }

    // ===== Update loop =====
    update() {
        const speed = BASE_SPEED;
        if (this.dialogueOpen) {
            this.player.setVelocity(0, 0);
        } else if (this.cursors.left.isDown || this.keyA.isDown) {
            this.player.setVelocity(-speed, 0);
            this.player.anims.play(this.playerData.id + '_walk_left', true);
        } else if (this.cursors.right.isDown || this.keyD.isDown) {
            this.player.setVelocity(speed, 0);
            this.player.anims.play(this.playerData.id + '_walk_right', true);
        } else if (this.cursors.up.isDown || this.keyW.isDown) {
            this.player.setVelocity(0, -speed);
            this.player.anims.play(this.playerData.id + '_walk_up', true);
        } else if (this.cursors.down.isDown || this.keyS.isDown) {
            this.player.setVelocity(0, speed);
            this.player.anims.play(this.playerData.id + '_walk_down', true);
        } else {
            this.player.setVelocity(0, 0);
            const anim = this.player.anims.currentAnim;
            if (anim) {
                if (anim.key.includes('down')) this.player.anims.play(this.playerData.id + '_idle_down', true);
                else if (anim.key.includes('up')) this.player.anims.play(this.playerData.id + '_idle_up', true);
                else if (anim.key.includes('left')) this.player.anims.play(this.playerData.id + '_idle_left', true);
                else if (anim.key.includes('right')) this.player.anims.play(this.playerData.id + '_idle_right', true);
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


// --- BattleScene (Containers + padding, safe wrapping, depths, polished) ---
class BattleScene extends Phaser.Scene {
    constructor() { super('BattleScene'); }
    init(data) {
        this.playerData = data.player;
        this.foe = data.foe;
    }

    create() {
        // Layering guide: 0 bg, 1 platforms, 6 sprites, 5 UI (frames/text/bars)
        const DEPTH_BG = 0, DEPTH_PLATFORM = 1, DEPTH_UI = 5, DEPTH_SPRITES = 6;

        // Music
        this.game.audioManager.playMusic('battle_theme', { volume: 0.5, fadeTime: 1500 });

        // --- Background ---
        const bg = this.add.rectangle(0, 0, 800, 600, 0xf7f7f7).setOrigin(0).setDepth(DEPTH_BG);
        bg.setAlpha(0);
        this.tweens.add({ targets: bg, alpha: 1, duration: 300 });

        // --- Platforms (under sprites) ---
        this.add.ellipse(620, 240, 120, 40, 0xd0d0d0).setStrokeStyle(1, 0x999999).setDepth(DEPTH_PLATFORM);
        this.add.ellipse(200, 420, 120, 40, 0xd0d0d0).setStrokeStyle(1, 0x999999).setDepth(DEPTH_PLATFORM);

        // --- Sprites (always above UI so they aren't obscured) ---
        this.playerSprite = this.add.image(200, 360, 'battle_back_' + this.playerData.id)
            .setDisplaySize(64, 64)
            .setDepth(DEPTH_SPRITES);
        this.foeSprite = this.add.image(620, 200, 'battle_front_' + this.foe.id)
            .setDisplaySize(64, 64)
            .setDepth(DEPTH_SPRITES);

        // ===== UI HELPERS =====
        const makePanel = (x, y, w, h) => {
            // Shadow + frame in a container at top-left
            const c = this.add.container(x, y).setDepth(DEPTH_UI);
            const shadow = this.add.rectangle(4, 4, w, h, 0x000000, 0.08).setOrigin(0);
            const frame = this.add.rectangle(0, 0, w, h, 0xffffff, 1).setOrigin(0).setStrokeStyle(2, 0x111111);
            c.add([shadow, frame]);
            c._frame = frame; // keep for bounds if needed
            return c;
        };

        const addLabel = (parent, text, padX, padY, maxWidth) => {
            const t = this.add.text(padX, padY, text, {
                font: '16px monospace',
                fill: '#111',
                wordWrap: { width: maxWidth, useAdvancedWrap: true },
                align: 'left'
            }).setOrigin(0, 0);
            parent.add(t);
            return t;
        };

        const addHP = (parent, frameWidth, frameHeight, opts = {}) => {
            const pad = 10;
            const barW = opts.barW ?? 140;
            const barH = opts.barH ?? 10;
            // Place on right side, vertically centered near bottom
            const x = frameWidth - pad - barW / 2;
            const y = frameHeight - pad - barH / 2;

            const label = this.add.text(x - barW / 2 - 28, y - 8, 'HP', {
                font: '12px monospace', fill: '#333'
            }).setOrigin(0, 0);
            const bg = this.add.rectangle(x, y, barW, barH, 0x888888).setOrigin(0.5);
            const fill = this.add.rectangle(x, y, barW, barH, 0x44cc44).setOrigin(0.5);
            parent.add([label, bg, fill]);

            return { bg, fill, barW };
        };

        const tweenHPTo = (barFill, ratio, duration = 250) => {
            const clamped = Phaser.Math.Clamp(ratio, 0, 1);
            this.tweens.add({
                targets: barFill,
                scaleX: clamped,
                duration,
                onUpdate: () => {
                    const r = barFill.scaleX;
                    barFill.fillColor = (r > 0.6) ? 0x44cc44 : (r > 0.3 ? 0xffcc00 : 0xff4444);
                }
            });
        };

        // ===== INFO BOXES =====
        // Foe info (top-right)
        this.foeUI = makePanel(420, 40, 320, 60);
        this.foeText = addLabel(this.foeUI, `${this.foe.name} Lv.5`, 10, 10, 320 - 10 - 10);
        const foeHP = addHP(this.foeUI, 320, 60);
        this.foeHPFill = foeHP.fill; // save reference
        this.foeHPBarW = foeHP.barW;

        // Player info (near hero, but won't cover him because sprites are depth 6)
        // Move this box a little higher to avoid visual overlap with the head
        this.playerUI = makePanel(40, 270, 320, 60);
        this.playerText = addLabel(this.playerUI, `${this.playerData.displayName} Lv.5`, 10, 10, 320 - 10 - 10);
        const plyHP = addHP(this.playerUI, 320, 60);
        this.playerHPFill = plyHP.fill;
        this.playerHPBarW = plyHP.barW;

        // ===== DIALOGUE =====
        this.dialogUI = makePanel(20, 400, 760, 90);
        this.log = addLabel(this.dialogUI, 'What will you do?', 12, 12, 760 - 24);

        // ===== MOVE MENU (2 columns inside the box) =====
        this.menuUI = makePanel(20, 500, 760, 90);
        this.moveButtons = [];
        {
            const pad = 12;
            const innerW = 760 - pad * 2;
            const innerH = 90 - pad * 2;
            const cols = 2;
            const gutter = 16;
            const colW = (innerW - gutter) / cols;
            const rowH = 30;

            this.playerData.moves.forEach((m, idx) => {
                const col = idx % cols;
                const row = Math.floor(idx / cols);
                const x = pad + col * (colW + gutter);
                const y = pad + row * rowH;

                // Button as its own mini-container so text never bleeds
                const btnC = this.add.container(x, y);
                const btnBg = this.add.rectangle(0, 0, colW, 26, 0xeeeeee, 1).setOrigin(0);
                btnBg.setStrokeStyle(1, 0xbbbbbb);
                const t = this.add.text(8, 5, m.name.toUpperCase(), {
                    font: '14px monospace',
                    fill: '#000',
                    wordWrap: { width: colW - 16, useAdvancedWrap: true }
                }).setOrigin(0, 0);

                btnC.add([btnBg, t]);
                btnC.setSize(colW, 26).setInteractive(new Phaser.Geom.Rectangle(0, 0, colW, 26), Phaser.Geom.Rectangle.Contains);

                btnC.on('pointerover', () => btnBg.setFillStyle(0xdddddd, 1));
                btnC.on('pointerout', () => btnBg.setFillStyle(0xeeeeee, 1));
                btnC.on('pointerdown', () => this.playerUseMove(idx));

                this.menuUI.add(btnC);
                this.moveButtons.push(btnC);
            });
        }

        // --- State ---
        this.playerHP = this.playerData.hp;
        this.foeHP = this.foe.hp;
        this.currentTurn = 'player';
        // initialize HP visuals
        this.updateHPBars(true);
    }

    updateHPBars(skipTween = false) {
        const pRatio = this.playerHP / this.playerData.hp;
        const fRatio = this.foeHP / this.foe.hp;

        if (skipTween) {
            this.playerHPFill.scaleX = Phaser.Math.Clamp(pRatio, 0, 1);
            this.foeHPFill.scaleX = Phaser.Math.Clamp(fRatio, 0, 1);
            this.playerHPFill.fillColor = (pRatio > 0.6) ? 0x44cc44 : (pRatio > 0.3 ? 0xffcc00 : 0xff4444);
            this.foeHPFill.fillColor = (fRatio > 0.6) ? 0x44cc44 : (fRatio > 0.3 ? 0xffcc00 : 0xff4444);
        } else {
            // tween to new value
            this.tweens.killTweensOf(this.playerHPFill);
            this.tweens.killTweensOf(this.foeHPFill);
            const tweenHPTo = (barFill, ratio) => {
                const clamped = Phaser.Math.Clamp(ratio, 0, 1);
                this.tweens.add({
                    targets: barFill,
                    scaleX: clamped,
                    duration: 280,
                    onUpdate: () => {
                        const r = barFill.scaleX;
                        barFill.fillColor = (r > 0.6) ? 0x44cc44 : (r > 0.3 ? 0xffcc00 : 0xff4444);
                    }
                });
            };
            tweenHPTo(this.playerHPFill, pRatio);
            tweenHPTo(this.foeHPFill, fRatio);
        }
    }

    // ===== Turn flow =====
    playerUseMove(idx) {
        if (this.currentTurn !== 'player') return;

        const move = this.playerData.moves[idx];
        const damage = move.power || 0;
        this.foeHP = Math.max(0, this.foeHP - damage);

        let log = `${this.playerData.displayName} used ${move.name}!`;
        if (move.type === 'psychic') log += "\nThe foe stares into the void...";
        else if (move.type === 'trick') log += "\nThe foe's confidence is mildly shaken.";
        else log += "\nIt was oddly specific.";
        this.log.setText(log);

        this.updateHPBars();

        if (this.foeHP <= 0) return this.win();

        this.currentTurn = 'foe';
        this.time.delayedCall(1800, () => this.foeAction(), [], this);
    }

    foeAction() {
        if (this.foeHP <= 0) return;

        const m = this.foe.moves[Math.floor(Math.random() * this.foe.moves.length)];
        this.playerHP = Math.max(0, this.playerHP - m.power);

        let text = `${this.foe.name} used ${m.name}!`;
        text += m.power > 15 ? "\nIt’s ridiculously overkill!" : "\nIt’s vaguely annoying.";
        this.log.setText(text);

        this.updateHPBars();

        if (this.playerHP <= 0) return this.lose();

        this.currentTurn = 'player';
        this.time.delayedCall(1800, () => { }, [], this);
    }

    win() {
        this.log.setText(`${this.playerData.displayName} is victorious!\nFoe is now emotionally unstable.`);
        this.time.delayedCall(2000, () => {
            this.scene.stop('BattleScene');
            this.scene.resume('OverworldScene');
            this.game.audioManager.playMusic('overworld_theme', { volume: 0.5 });
        }, [], this);
    }

    lose() {
        this.log.setText(`You fainted...\nAnd dropped your dignity.`);
        this.time.delayedCall(2000, () => {
            this.scene.stop('BattleScene');
            this.scene.resume('OverworldScene');
            this.game.audioManager.playMusic('overworld_theme', { volume: 0.5 });
        }, [], this);
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
