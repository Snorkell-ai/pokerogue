import Phaser from 'phaser';
import UI, { Mode } from './ui/ui';
import { NextEncounterPhase, NewBiomeEncounterPhase, SelectBiomePhase, MessagePhase, TurnInitPhase, ReturnPhase, LevelCapPhase, ShowTrainerPhase, LoginPhase, MovePhase, TitlePhase, SwitchPhase } from './phases';
import Pokemon, { PlayerPokemon, EnemyPokemon } from './field/pokemon';
import PokemonSpecies, { PokemonSpeciesFilter, allSpecies, getPokemonSpecies, initSpecies, speciesStarters } from './data/pokemon-species';
import * as Utils from './utils';
import { Modifier, ModifierBar, ConsumablePokemonModifier, ConsumableModifier, PokemonHpRestoreModifier, HealingBoosterModifier, PersistentModifier, PokemonHeldItemModifier, ModifierPredicate, DoubleBattleChanceBoosterModifier, FusePokemonModifier, PokemonFormChangeItemModifier, TerastallizeModifier, overrideModifiers, overrideHeldItems } from './modifier/modifier';
import { PokeballType } from './data/pokeball';
import { initCommonAnims, initMoveAnim, loadCommonAnimAssets, loadMoveAnimAssets, populateAnims } from './data/battle-anims';
import { Phase } from './phase';
import { initGameSpeed } from './system/game-speed';
import { Biome } from "./data/enums/biome";
import { Arena, ArenaBase } from './field/arena';
import { GameData, PlayerGender } from './system/game-data';
import StarterSelectUiHandler from './ui/starter-select-ui-handler';
import { TextStyle, addTextObject } from './ui/text';
import { Moves } from "./data/enums/moves";
import { allMoves } from "./data/move";
import { initMoves } from './data/move';
import { ModifierPoolType, getDefaultModifierTypeForTier, getEnemyModifierTypesForWave, getLuckString, getLuckTextTint, getModifierPoolForType, getPartyLuckValue } from './modifier/modifier-type';
import AbilityBar from './ui/ability-bar';
import { BlockItemTheftAbAttr, DoubleBattleChanceAbAttr, IncrementMovePriorityAbAttr, applyAbAttrs, initAbilities } from './data/ability';
import { Abilities } from "./data/enums/abilities";
import { allAbilities } from "./data/ability";
import Battle, { BattleType, FixedBattleConfig, fixedBattles } from './battle';
import { GameMode, GameModes, gameModes } from './game-mode';
import FieldSpritePipeline from './pipelines/field-sprite';
import SpritePipeline from './pipelines/sprite';
import PartyExpBar from './ui/party-exp-bar';
import { TrainerSlot, trainerConfigs } from './data/trainer-config';
import Trainer, { TrainerVariant } from './field/trainer';
import TrainerData from './system/trainer-data';
import SoundFade from 'phaser3-rex-plugins/plugins/soundfade';
import { pokemonPrevolutions } from './data/pokemon-evolutions';
import PokeballTray from './ui/pokeball-tray';
import { Setting, settingOptions } from './system/settings';
import SettingsUiHandler from './ui/settings-ui-handler';
import MessageUiHandler from './ui/message-ui-handler';
import { Species } from './data/enums/species';
import InvertPostFX from './pipelines/invert';
import { Achv, ModifierAchv, MoneyAchv, achvs } from './system/achv';
import { Voucher, vouchers } from './system/voucher';
import { Gender } from './data/gender';
import UIPlugin from 'phaser3-rex-plugins/templates/ui/ui-plugin';
import { addUiThemeOverrides } from './ui/ui-theme';
import PokemonData from './system/pokemon-data';
import { Nature } from './data/nature';
import { SpeciesFormChangeTimeOfDayTrigger, SpeciesFormChangeTrigger, pokemonFormChanges } from './data/pokemon-forms';
import { FormChangePhase, QuietFormChangePhase } from './form-change-phase';
import { BattleSpec } from './enums/battle-spec';
import { getTypeRgb } from './data/type';
import PokemonSpriteSparkleHandler from './field/pokemon-sprite-sparkle-handler';
import CharSprite from './ui/char-sprite';
import DamageNumberHandler from './field/damage-number-handler';
import PokemonInfoContainer from './ui/pokemon-info-container';
import { biomeDepths, getBiomeName } from './data/biomes';
import { UiTheme } from './enums/ui-theme';
import { SceneBase } from './scene-base';
import CandyBar from './ui/candy-bar';
import { Variant, variantData } from './data/variant';
import { Localizable } from './plugins/i18n';
import * as Overrides from './overrides';
import {InputsController} from "./inputs-controller";
import {UiInputs} from "./ui-inputs";

export const bypassLogin = import.meta.env.VITE_BYPASS_LOGIN === "1";

const DEBUG_RNG = false;

export const startingWave = Overrides.STARTING_WAVE_OVERRIDE || 1;

const expSpriteKeys: string[] = [];

export let starterColors: StarterColors;
interface StarterColors {
	[key: string]: [string, string]
}

export interface PokeballCounts {
	[pb: string]: integer;
}

export type AnySound = Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound | Phaser.Sound.NoAudioSound;

export default class BattleScene extends SceneBase {
	public rexUI: UIPlugin;
	public inputController: InputsController;
	public uiInputs: UiInputs;

	public sessionPlayTime: integer = null;
	public lastSavePlayTime: integer = null;
	public masterVolume: number = 0.5;
	public bgmVolume: number = 1;
	public seVolume: number = 1;
	public gameSpeed: integer = 1;
	public damageNumbersMode: integer = 0;
	public showLevelUpStats: boolean = true;
	public enableTutorials: boolean = import.meta.env.VITE_BYPASS_TUTORIAL === "1";
	public enableRetries: boolean = false;
	public uiTheme: UiTheme = UiTheme.DEFAULT;
	public windowType: integer = 0;
	public experimentalSprites: boolean = false;
	public moveAnimations: boolean = true;
	public expGainsSpeed: integer = 0;
	/**
	 * Defines the experience gain display mode.
	 *
	 * @remarks
	 * The `expParty` can have several modes:
	 * - `0` - Default: The normal experience gain display, nothing changed.
	 * - `1` - Level Up Notification: Displays the level up in the small frame instead of a message.
	 * - `2` - Skip: No level up frame nor message.
	 *
	 * Modes `1` and `2` are still compatible with stats display, level up, new move, etc.
	 * @default 0 - Uses the default normal experience gain display.
	 */
	public expParty: integer = 0;
	public hpBarSpeed: integer = 0;
	public fusionPaletteSwaps: boolean = true;
	public enableTouchControls: boolean = false;
	public enableVibration: boolean = false;
	public abSwapped: boolean = false;

	public disableMenu: boolean = false;

	public gameData: GameData;
	public sessionSlotId: integer;

	private phaseQueue: Phase[];
	private phaseQueuePrepend: Phase[];
	private phaseQueuePrependSpliceIndex: integer;
	private nextCommandPhaseQueue: Phase[];
	private currentPhase: Phase;
	private standbyPhase: Phase;
	public field: Phaser.GameObjects.Container;
	public fieldUI: Phaser.GameObjects.Container;
	public charSprite: CharSprite;
	public pbTray: PokeballTray;
	public pbTrayEnemy: PokeballTray;
	public abilityBar: AbilityBar;
	public partyExpBar: PartyExpBar;
	public candyBar: CandyBar;
	public arenaBg: Phaser.GameObjects.Sprite;
	public arenaBgTransition: Phaser.GameObjects.Sprite;
	public arenaPlayer: ArenaBase;
	public arenaPlayerTransition: ArenaBase;
	public arenaEnemy: ArenaBase;
	public arenaNextEnemy: ArenaBase;
	public arena: Arena;
	public gameMode: GameMode;
	public score: integer;
	public lockModifierTiers: boolean;
	public trainer: Phaser.GameObjects.Sprite;
	public lastEnemyTrainer: Trainer;
	public currentBattle: Battle;
	public pokeballCounts: PokeballCounts;
	public money: integer;
	public pokemonInfoContainer: PokemonInfoContainer;
	private party: PlayerPokemon[];
	private waveCountText: Phaser.GameObjects.Text;
	private moneyText: Phaser.GameObjects.Text;
	private scoreText: Phaser.GameObjects.Text;
	private luckLabelText: Phaser.GameObjects.Text;
	private luckText: Phaser.GameObjects.Text;
	private modifierBar: ModifierBar;
	private enemyModifierBar: ModifierBar;
	private fieldOverlay: Phaser.GameObjects.Rectangle;
	private modifiers: PersistentModifier[];
	private enemyModifiers: PersistentModifier[];
	public uiContainer: Phaser.GameObjects.Container;
	public ui: UI;

	public seed: string;
	public waveSeed: string;
	public waveCycleOffset: integer;
	public offsetGym: boolean;

	public damageNumberHandler: DamageNumberHandler
	private spriteSparkleHandler: PokemonSpriteSparkleHandler;

	public fieldSpritePipeline: FieldSpritePipeline;
	public spritePipeline: SpritePipeline;

	private bgm: AnySound;
	private bgmResumeTimer: Phaser.Time.TimerEvent;
	private bgmCache: Set<string> = new Set();
	private playTimeTimer: Phaser.Time.TimerEvent;

	public rngCounter: integer = 0;
	public rngSeedOverride: string = '';
	public rngOffset: integer = 0;

	constructor() {
		super('battle');

		initSpecies();
		initMoves();
		initAbilities();
		
		this.phaseQueue = [];
		this.phaseQueuePrepend = [];
		this.phaseQueuePrependSpliceIndex = -1;
		this.nextCommandPhaseQueue = [];
		this.updateGameInfo();
	}

	/**
	 * Loads a Pokemon atlas.
	 * 
	 * @param key The key for the atlas.
	 * @param atlasPath The path to the atlas.
	 * @param experimental Optional parameter to indicate if the experimental sprites should be used.
	 * 
	 * @throws {Error} If the atlasPath is invalid or if there is an error loading the atlas.
	 */
	loadPokemonAtlas(key: string, atlasPath: string, experimental?: boolean) {
		if (experimental === undefined)
			experimental = this.experimentalSprites;
		let variant = atlasPath.includes('variant/') || /_[0-3]$/.test(atlasPath);
		if (experimental)
			experimental = this.hasExpSprite(key);
		if (variant)
			atlasPath = atlasPath.replace('variant/', '');
		this.load.atlas(key, `images/pokemon/${variant ? 'variant/' : ''}${experimental ? 'exp/' : ''}${atlasPath}.png`,  `images/pokemon/${variant ? 'variant/' : ''}${experimental ? 'exp/' : ''}${atlasPath}.json`);
	}

	/**
	 * Asynchronously preloads the necessary resources for the game.
	 * 
	 * @throws {Error} Throws an error if there is an issue with preloading resources.
	 */
	async preload() {
		if (DEBUG_RNG) {
			const scene = this;
			const originalRealInRange = Phaser.Math.RND.realInRange;
			Phaser.Math.RND.realInRange = function (min: number, max: number): number {
				const ret = originalRealInRange.apply(this, [ min, max ]);
				const args = [ 'RNG', ++scene.rngCounter, ret / (max - min), `min: ${min} / max: ${max}` ];
				args.push(`seed: ${scene.rngSeedOverride || scene.waveSeed || scene.seed}`);
				if (scene.rngOffset)
					args.push(`offset: ${scene.rngOffset}`);
				console.log(...args);
				return ret;
			};
		}

		populateAnims();

		await this.initVariantData();
	}

	/**
	 * Creates and initializes the game.
	 * 
	 * @throws {Error} Throws an error if initialization fails.
	 */
	create() {
		initGameSpeed.apply(this);
		this.inputController = new InputsController(this);
		this.uiInputs = new UiInputs(this, this.inputController);

		this.gameData = new GameData(this);

		addUiThemeOverrides(this);

		this.load.setBaseURL();

		this.spritePipeline = new SpritePipeline(this.game);
		(this.renderer as Phaser.Renderer.WebGL.WebGLRenderer).pipelines.add('Sprite', this.spritePipeline);

		this.fieldSpritePipeline = new FieldSpritePipeline(this.game);
		(this.renderer as Phaser.Renderer.WebGL.WebGLRenderer).pipelines.add('FieldSprite', this.fieldSpritePipeline);

		this.time.delayedCall(20, () => this.launchBattle());
	}

	/**
	 * Update method to update input controller and UI.
	 * @throws {Error} If input controller update fails.
	 */
	update() {
		this.inputController.update();
		this.ui?.update();
	}

	/**
	 * Launches the battle and sets up the battle arena with various game elements.
	 * @throws {Error} Throws an error if any of the setup fails.
	 */
	launchBattle() {
		this.arenaBg = this.add.sprite(0, 0, 'plains_bg');
		this.arenaBgTransition = this.add.sprite(0, 0, 'plains_bg');

		[ this.arenaBgTransition, this.arenaBg ].forEach(a => {
			a.setPipeline(this.fieldSpritePipeline);
			a.setScale(6);
			a.setOrigin(0);
			a.setSize(320, 240);
		});

		const field = this.add.container(0, 0);
		field.setScale(6);

		this.field = field;

		const fieldUI = this.add.container(0, this.game.canvas.height);
		fieldUI.setDepth(1);
		fieldUI.setScale(6);

		this.fieldUI = fieldUI;

		const transition = this.make.rexTransitionImagePack({
			x: 0,
			y: 0,
			scale: 6,
			key: 'loading_bg',
			origin: { x: 0, y: 0 }
		}, true);

		transition.transit({
			mode: 'blinds',
			ease: 'Cubic.easeInOut',
			duration: 1250,
			oncomplete: () => transition.destroy()
		});

		this.add.existing(transition);

		const uiContainer = this.add.container(0, 0);
		uiContainer.setDepth(2);
		uiContainer.setScale(6);

		this.uiContainer = uiContainer;

		const overlayWidth = this.game.canvas.width / 6;
		const overlayHeight = (this.game.canvas.height / 6) - 48;
		this.fieldOverlay = this.add.rectangle(0, overlayHeight * -1 - 48, overlayWidth, overlayHeight, 0x424242);
		this.fieldOverlay.setOrigin(0, 0);
		this.fieldOverlay.setAlpha(0);
		this.fieldUI.add(this.fieldOverlay);

		this.modifiers = [];
		this.enemyModifiers = [];

		this.modifierBar = new ModifierBar(this);
		this.add.existing(this.modifierBar);
		uiContainer.add(this.modifierBar);

		this.enemyModifierBar = new ModifierBar(this, true);
		this.add.existing(this.enemyModifierBar);
		uiContainer.add(this.enemyModifierBar);

		this.charSprite = new CharSprite(this);
		this.charSprite.setup();

		this.fieldUI.add(this.charSprite);

		this.pbTray = new PokeballTray(this, true);
		this.pbTray.setup();

		this.pbTrayEnemy = new PokeballTray(this, false);
		this.pbTrayEnemy.setup();

		this.fieldUI.add(this.pbTray);
		this.fieldUI.add(this.pbTrayEnemy);

		this.abilityBar = new AbilityBar(this);
		this.abilityBar.setup();
		this.fieldUI.add(this.abilityBar);

		this.partyExpBar = new PartyExpBar(this);
		this.partyExpBar.setup();
		this.fieldUI.add(this.partyExpBar);

		this.candyBar = new CandyBar(this);
		this.candyBar.setup();
		this.fieldUI.add(this.candyBar);

		this.waveCountText = addTextObject(this, (this.game.canvas.width / 6) - 2, 0, startingWave.toString(), TextStyle.BATTLE_INFO);
		this.waveCountText.setOrigin(1, 0);
		this.fieldUI.add(this.waveCountText);

		this.moneyText = addTextObject(this, (this.game.canvas.width / 6) - 2, 0, '', TextStyle.MONEY);
		this.moneyText.setOrigin(1, 0);
		this.fieldUI.add(this.moneyText);

		this.scoreText = addTextObject(this, (this.game.canvas.width / 6) - 2, 0, '', TextStyle.PARTY, { fontSize: '54px' });
		this.scoreText.setOrigin(1, 0);
		this.fieldUI.add(this.scoreText);

		this.luckText = addTextObject(this, (this.game.canvas.width / 6) - 2, 0, '', TextStyle.PARTY, { fontSize: '54px' });
		this.luckText.setOrigin(1, 0);
		this.luckText.setVisible(false);
		this.fieldUI.add(this.luckText);

		this.luckLabelText = addTextObject(this, (this.game.canvas.width / 6) - 2, 0, 'Luck:', TextStyle.PARTY, { fontSize: '54px' });
		this.luckLabelText.setOrigin(1, 0);
		this.luckLabelText.setVisible(false);
		this.fieldUI.add(this.luckLabelText);

		this.updateUIPositions();

		this.damageNumberHandler = new DamageNumberHandler();

		this.spriteSparkleHandler = new PokemonSpriteSparkleHandler();
		this.spriteSparkleHandler.setup(this);

		this.pokemonInfoContainer = new PokemonInfoContainer(this, (this.game.canvas.width / 6) + 52, -(this.game.canvas.height / 6) + 66);
		this.pokemonInfoContainer.setup();

		this.fieldUI.add(this.pokemonInfoContainer);

		this.party = [];

		let loadPokemonAssets = [];

		this.arenaPlayer = new ArenaBase(this, true);
		this.arenaPlayerTransition = new ArenaBase(this, true);
		this.arenaEnemy = new ArenaBase(this, false);
		this.arenaNextEnemy = new ArenaBase(this, false);

		this.arenaBgTransition.setVisible(false);
		this.arenaPlayerTransition.setVisible(false);
		this.arenaNextEnemy.setVisible(false);

		[ this.arenaPlayer, this.arenaPlayerTransition, this.arenaEnemy, this.arenaNextEnemy ].forEach(a => {
			if (a instanceof Phaser.GameObjects.Sprite)
				a.setOrigin(0, 0);
			field.add(a);
		});

		const trainer = this.addFieldSprite(0, 0, `trainer_${this.gameData.gender === PlayerGender.FEMALE ? 'f' : 'm'}_back`);
		trainer.setOrigin(0.5, 1);

		field.add(trainer);

		this.trainer = trainer;

		this.anims.create({
			key: 'prompt',
			frames: this.anims.generateFrameNumbers('prompt', { start: 1, end: 4 }),
			frameRate: 6,
			repeat: -1,
			showOnStart: true
		});

		this.anims.create({
			key: 'tera_sparkle',
			frames: this.anims.generateFrameNumbers('tera_sparkle', { start: 0, end: 12 }),
			frameRate: 18,
			repeat: 0,
			showOnStart: true,
			hideOnComplete: true
		});

		this.reset(false, false, true);

		const ui = new UI(this);
		this.uiContainer.add(ui);

		this.ui = ui;

		ui.setup();

		const defaultMoves = [ Moves.TACKLE, Moves.TAIL_WHIP, Moves.FOCUS_ENERGY, Moves.STRUGGLE ];

		Promise.all([
			Promise.all(loadPokemonAssets),
			initCommonAnims(this).then(() => loadCommonAnimAssets(this, true)),
			Promise.all([ Moves.TACKLE, Moves.TAIL_WHIP, Moves.FOCUS_ENERGY, Moves.STRUGGLE ].map(m => initMoveAnim(this, m))).then(() => loadMoveAnimAssets(this, defaultMoves, true)),
			this.initStarterColors()
		]).then(() => {
			this.pushPhase(new LoginPhase(this));
			this.pushPhase(new TitlePhase(this));

			this.shiftPhase();
		});
	}

	/**
	 * Initializes the session.
	 * 
	 * @throws {Error} Throws an error if the session play time or last save play time is null.
	 */
	initSession(): void {
		if (this.sessionPlayTime === null)
			this.sessionPlayTime = 0;
		if (this.lastSavePlayTime === null)
			this.lastSavePlayTime = 0;

		if (this.playTimeTimer)
			this.playTimeTimer.destroy();

		this.playTimeTimer = this.time.addEvent({
			delay: Utils.fixedInt(1000),
			repeat: -1,
    	callback: () => {
				if (this.gameData)
					this.gameData.gameStats.playTime++;
				if (this.sessionPlayTime !== null)
					this.sessionPlayTime++;
				if (this.lastSavePlayTime !== null)
					this.lastSavePlayTime++;
			}
		});

		this.updateWaveCountText();
		this.updateMoneyText();
		this.updateScoreText();
	}

	/**
	 * Asynchronously initializes experience sprites.
	 * @returns A Promise that resolves when the initialization is complete.
	 * @throws {Error} If there is an error fetching or parsing the 'exp-sprites.json' file.
	 */
	async initExpSprites(): Promise<void> {
		if (expSpriteKeys.length)
			return;
		this.cachedFetch('./exp-sprites.json').then(res => res.json()).then(keys => {
			if (Array.isArray(keys))
				expSpriteKeys.push(...keys);
			Promise.resolve();
		});
	}

	/**
	 * Asynchronously initializes the variant data.
	 * @returns A promise that resolves when the variant data is initialized.
	 * @throws {Error} If there is an error during the initialization process.
	 */
	async initVariantData(): Promise<void> {
		Object.keys(variantData).forEach(key => delete variantData[key]);
		await this.cachedFetch('./images/pokemon/variant/_masterlist.json').then(res => res.json())
			.then(v => {
				Object.keys(v).forEach(k => variantData[k] = v[k]);
				if (this.experimentalSprites) {
					const expVariantData = variantData['exp'];
					/**
					 * Traverses the variant data based on the provided keys and updates the variant tree with corresponding values from the expTree.
					 * @param keys - An array of strings representing the keys to traverse the variant data.
					 * @throws - Throws an error if the provided keys are invalid or if there is an issue with updating the variant tree.
					 */
					const traverseVariantData = (keys: string[]) => {
						let variantTree = variantData;
						let expTree = expVariantData;
						keys.map((k: string, i: integer) => {
							if (i < keys.length - 1) {
								variantTree = variantTree[k];
								expTree = expTree[k];
							} else if (variantTree.hasOwnProperty(k) && expTree.hasOwnProperty(k)) {
								if ([ 'back', 'female' ].includes(k))
									traverseVariantData(keys.concat(k));
								else
									variantTree[k] = expTree[k];
							}
						});
					};
					Object.keys(expVariantData).forEach(ek => traverseVariantData([ ek ]));
				}
				Promise.resolve();
			});
	}

	/**
	 * Fetches the data from the specified URL and returns a Promise that resolves to a Response object.
	 * @param url The URL from which to fetch the data.
	 * @param init An optional object containing any custom settings that you want to apply to the request.
	 * @throws {Error} If an error occurs during the fetch operation.
	 * @returns A Promise that resolves to a Response object.
	 */
	cachedFetch(url: string, init?: RequestInit): Promise<Response> {
		const manifest = this.game['manifest'];
		if (manifest) {
			const timestamp = manifest[`/${url.replace('./', '')}`];
			if (timestamp)
				url += `?t=${timestamp}`;
		}
		return fetch(url, init);
	}

	/**
	 * Initializes starter colors by fetching data from './starter-colors.json' and processing it.
	 * @returns A Promise that resolves when the starter colors are successfully initialized.
	 * @throws {Error} If there is an error fetching or processing the starter colors data.
	 */
	initStarterColors(): Promise<void> {
		return new Promise(resolve => {
			if (starterColors)
				return resolve();

			this.cachedFetch('./starter-colors.json').then(res => res.json()).then(sc => {
				starterColors = {};
				Object.keys(sc).forEach(key => {
					starterColors[key] = sc[key];
				});

				/*const loadPokemonAssets: Promise<void>[] = [];

				for (let s of Object.keys(speciesStarters)) {
					const species = getPokemonSpecies(parseInt(s));
					loadPokemonAssets.push(species.loadAssets(this, false, 0, false));
				}
	
				Promise.all(loadPokemonAssets).then(() => {
					const starterCandyColors = {};
					const rgbaToHexFunc = (r, g, b) => [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
		
					for (let s of Object.keys(speciesStarters)) {
						const species = getPokemonSpecies(parseInt(s));
						
						starterCandyColors[species.speciesId] = species.generateCandyColors(this).map(c => rgbaToHexFunc(c[0], c[1], c[2]));
					}
		
					console.log(JSON.stringify(starterCandyColors));

					resolve();
				});*/

				resolve();
			});
		});
	}

	/**
	 * Checks if the given key matches the specified pattern for an exp sprite.
	 * @param key The key to be checked.
	 * @returns True if the key matches the pattern, false otherwise.
	 * @throws If the key does not match the expected pattern.
	 */
	hasExpSprite(key: string): boolean {
		const keyMatch = /^pkmn__?(back__)?(shiny__)?(female__)?(\d+)(\-.*?)?(?:_[1-3])?$/g.exec(key);
		let k = keyMatch[4];
		if (keyMatch[2])
			k += 's';
		if (keyMatch[1])
			k += 'b';
		if (keyMatch[3])
			k += 'f';
		if (keyMatch[5])
			k += keyMatch[5];
		if (!expSpriteKeys.includes(k))
			return false;
		return true;
	}

	/**
	 * Retrieves the party of player's Pokémon.
	 * @returns An array of PlayerPokemon objects representing the player's Pokémon party.
	 */
	getParty(): PlayerPokemon[] {
		return this.party;
	}

	/**
	 * Retrieve the player's active Pokemon.
	 * @returns {PlayerPokemon} The active Pokemon of the player.
	 * @throws {Error} Throws an error if the active Pokemon is not found.
	 */
	getPlayerPokemon(): PlayerPokemon {
		return this.getPlayerField().find(p => p.isActive());
	}

	/**
	 * Retrieves the player's Pokemon field for the current battle.
	 * @returns An array of PlayerPokemon objects representing the player's Pokemon field.
	 * @throws {Error} If an error occurs while retrieving the player's Pokemon field.
	 */
	getPlayerField(): PlayerPokemon[] {
		const party = this.getParty();
		return party.slice(0, Math.min(party.length, this.currentBattle?.double ? 2 : 1));
	}

	/**
	 * Retrieves the enemy party from the current battle.
	 * @returns An array of EnemyPokemon objects representing the enemy party.
	 */
	getEnemyParty(): EnemyPokemon[] {
		return this.currentBattle?.enemyParty || [];
	}

	/**
	 * Retrieves the active enemy Pokemon from the enemy field.
	 * @returns {EnemyPokemon} The active enemy Pokemon.
	 * @throws {Error} If the active enemy Pokemon is not found.
	 */
	getEnemyPokemon(): EnemyPokemon {
		return this.getEnemyField().find(p => p.isActive());
	}

	/**
	 * Retrieves the enemy Pokemon field.
	 * @returns {EnemyPokemon[]} The enemy Pokemon field.
	 * @throws {Error} If the enemy party is not available.
	 */
	getEnemyField(): EnemyPokemon[] {
		const party = this.getEnemyParty();
		return party.slice(0, Math.min(party.length, this.currentBattle?.double ? 2 : 1));
	}

	/**
	 * Retrieves the Pokemon field based on the active status.
	 * @param activeOnly Indicates whether to retrieve only active Pokemon.
	 * @returns An array of Pokemon objects based on the active status.
	 * @throws {Error} Throws an error if there is an issue retrieving the field.
	 */
	getField(activeOnly: boolean = false): Pokemon[] {
		const ret = new Array(4).fill(null);
		const playerField = this.getPlayerField();
		const enemyField = this.getEnemyField();
		ret.splice(0, playerField.length, ...playerField);
		ret.splice(2, enemyField.length, ...enemyField);
		return activeOnly
			? ret.filter(p => p?.isActive())
			: ret;
	}

	/**
	 * Retrieves a Pokemon by its ID.
	 * @param pokemonId The ID of the Pokemon to retrieve.
	 * @returns The Pokemon with the specified ID, if found in the party or enemy party.
	 * @throws If the Pokemon with the specified ID is not found in either party.
	 */
	getPokemonById(pokemonId: integer): Pokemon {
		/**
		 * Find a Pokemon in the party by its ID.
		 * @param party The array of Pokemon to search.
		 * @returns The found Pokemon, or undefined if not found.
		 */
		const findInParty = (party: Pokemon[]) => party.find(p => p.id === pokemonId);
		return findInParty(this.getParty()) || findInParty(this.getEnemyParty());
	}

	/**
	 * Adds a player's Pokemon with the specified details.
	 * @param species The species of the Pokemon.
	 * @param level The level of the Pokemon.
	 * @param abilityIndex The index of the ability.
	 * @param formIndex The index of the form.
	 * @param gender Optional. The gender of the Pokemon.
	 * @param shiny Optional. Indicates if the Pokemon is shiny.
	 * @param variant Optional. The variant of the Pokemon.
	 * @param ivs Optional. The individual values of the Pokemon.
	 * @param nature Optional. The nature of the Pokemon.
	 * @param dataSource Optional. The data source of the Pokemon.
	 * @param postProcess Optional. A function to post-process the player's Pokemon.
	 * @throws {Error} If any error occurs during the process.
	 * @returns The player's Pokemon with the specified details.
	 */
	addPlayerPokemon(species: PokemonSpecies, level: integer, abilityIndex: integer, formIndex: integer, gender?: Gender, shiny?: boolean, variant?: Variant, ivs?: integer[], nature?: Nature, dataSource?: Pokemon | PokemonData, postProcess?: (playerPokemon: PlayerPokemon) => void): PlayerPokemon {
		const pokemon = new PlayerPokemon(this, species, level, abilityIndex, formIndex, gender, shiny, variant, ivs, nature, dataSource);
		if (postProcess)
			postProcess(pokemon);
		pokemon.init();
		return pokemon;
	}

	/**
	 * Creates and adds an enemy Pokemon to the game.
	 * 
	 * @param species The species of the Pokemon to be added.
	 * @param level The level of the Pokemon.
	 * @param trainerSlot The slot of the trainer.
	 * @param boss Indicates if the Pokemon is a boss.
	 * @param dataSource Optional data source for the Pokemon.
	 * @param postProcess Optional function to post-process the created Pokemon.
	 * @returns The created enemy Pokemon.
	 * @throws Error if any exceptions occur during the process.
	 */
	addEnemyPokemon(species: PokemonSpecies, level: integer, trainerSlot: TrainerSlot, boss: boolean = false, dataSource?: PokemonData, postProcess?: (enemyPokemon: EnemyPokemon) => void): EnemyPokemon {
		if (Overrides.OPP_SPECIES_OVERRIDE)
			species = getPokemonSpecies(Overrides.OPP_SPECIES_OVERRIDE);
		const pokemon = new EnemyPokemon(this, species, level, trainerSlot, boss, dataSource);
		overrideModifiers(this, false);
		overrideHeldItems(this, pokemon, false);
		if (boss && !dataSource) {
			const secondaryIvs = Utils.getIvsFromId(Utils.randSeedInt(4294967295));

			for (let s = 0; s < pokemon.ivs.length; s++)
				pokemon.ivs[s] = Math.round(Phaser.Math.Linear(Math.min(pokemon.ivs[s], secondaryIvs[s]), Math.max(pokemon.ivs[s], secondaryIvs[s]), 0.75));
		}
		if (postProcess)
			postProcess(pokemon);
		pokemon.init();
		return pokemon;
	}

	/**
	 * Adds a Pokemon icon to the game at the specified coordinates within a container.
	 * 
	 * @param pokemon The Pokemon object to display as an icon.
	 * @param x The x-coordinate for the container.
	 * @param y The y-coordinate for the container.
	 * @param originX The origin point on the x-axis for the container, default is 0.5.
	 * @param originY The origin point on the y-axis for the container, default is 0.5.
	 * @param ignoreOverride Flag to ignore any overrides for the Pokemon icon, default is false.
	 * @returns A Phaser.GameObjects.Container containing the Pokemon icon.
	 * @throws None
	 */
	addPokemonIcon(pokemon: Pokemon, x: number, y: number, originX: number = 0.5, originY: number = 0.5, ignoreOverride: boolean = false): Phaser.GameObjects.Container {
		const container = this.add.container(x, y);
		
		const icon = this.add.sprite(0, 0, pokemon.getIconAtlasKey(ignoreOverride));
    	icon.setFrame(pokemon.getIconId(true));
		// Temporary fix to show pokemon's default icon if variant icon doesn't exist
		if (icon.frame.name != pokemon.getIconId(true)) {
			console.log(`${pokemon.name}'s variant icon does not exist. Replacing with default.`)
			const temp = pokemon.shiny;
			pokemon.shiny = false;
			icon.setTexture(pokemon.getIconAtlasKey(ignoreOverride));
			icon.setFrame(pokemon.getIconId(true));
			pokemon.shiny = temp;
		}
		icon.setOrigin(0.5, 0);

		container.add(icon);

		if (pokemon.isFusion()) {
			const fusionIcon = this.add.sprite(0, 0, pokemon.getFusionIconAtlasKey(ignoreOverride));
			fusionIcon.setOrigin(0.5, 0)
			fusionIcon.setFrame(pokemon.getFusionIconId(true));

			const originalWidth = icon.width;
			const originalHeight = icon.height;
			const originalFrame = icon.frame;

			const iconHeight = (icon.frame.cutHeight <= fusionIcon.frame.cutHeight ? Math.ceil : Math.floor)((icon.frame.cutHeight + fusionIcon.frame.cutHeight) / 4);
			
			// Inefficient, but for some reason didn't work with only the unique properties as part of the name
			const iconFrameId = `${icon.frame.name}f${fusionIcon.frame.name}`;

			if (!icon.frame.texture.has(iconFrameId))
				icon.frame.texture.add(iconFrameId, icon.frame.sourceIndex, icon.frame.cutX, icon.frame.cutY, icon.frame.cutWidth, iconHeight);

			icon.setFrame(iconFrameId);

			fusionIcon.y = icon.frame.cutHeight;

			const originalFusionFrame = fusionIcon.frame;

			const fusionIconY = fusionIcon.frame.cutY + icon.frame.cutHeight;
			const fusionIconHeight = fusionIcon.frame.cutHeight - icon.frame.cutHeight;

			// Inefficient, but for some reason didn't work with only the unique properties as part of the name
			const fusionIconFrameId = `${fusionIcon.frame.name}f${icon.frame.name}`;

			if (!fusionIcon.frame.texture.has(fusionIconFrameId))
				fusionIcon.frame.texture.add(fusionIconFrameId, fusionIcon.frame.sourceIndex, fusionIcon.frame.cutX, fusionIconY, fusionIcon.frame.cutWidth, fusionIconHeight);
			fusionIcon.setFrame(fusionIconFrameId);

			const frameY = (originalFrame.y + originalFusionFrame.y) / 2;
			icon.frame.y = fusionIcon.frame.y = frameY;

			container.add(fusionIcon);

			if (originX !== 0.5)
				container.x -= originalWidth * (originX - 0.5);
			if (originY !== 0)
				container.y -= (originalHeight) * originY;
		} else {
			if (originX !== 0.5)
				container.x -= icon.width * (originX - 0.5);
			if (originY !== 0)
				container.y -= icon.height * originY;
		}

		return container;
	}

	/**
	 * Set the seed for the random number generator.
	 * @param seed - The seed to set for the random number generator.
	 * @throws - Throws an error if the seed is invalid.
	 */
	setSeed(seed: string): void {
		this.seed = seed;
		this.rngCounter = 0;
		this.waveCycleOffset = this.getGeneratedWaveCycleOffset();
		this.offsetGym = this.gameMode.isClassic && this.getGeneratedOffsetGym();
	}

	/**
	 * Generate a random battle seed integer within the specified range.
	 * 
	 * @param range The range within which the random integer should be generated.
	 * @param min The minimum value for the random integer (default is 0).
	 * @returns The generated random integer.
	 * @throws Error if the range or min values are not valid.
	 */
	randBattleSeedInt(range: integer, min: integer = 0): integer {
		return this.currentBattle.randSeedInt(this, range, min);
	}

	/**
	 * Resets the game state with optional parameters to clear the scene, clear data, and reload internationalization.
	 * 
	 * @param clearScene Set to true to clear the scene.
	 * @param clearData Set to true to clear the game data.
	 * @param reloadI18n Set to true to reload internationalization data.
	 * @throws None
	 */
	reset(clearScene: boolean = false, clearData: boolean = false, reloadI18n: boolean = false): void {
		if (clearData)
			this.gameData = new GameData(this);

		this.gameMode = gameModes[GameModes.CLASSIC];
		
		this.setSeed(Overrides.SEED_OVERRIDE || Utils.randomString(24));
		console.log('Seed:', this.seed);

		this.disableMenu = false;

		this.score = 0;
		this.money = 0;

		this.lockModifierTiers = false;

		this.pokeballCounts = Object.fromEntries(Utils.getEnumValues(PokeballType).filter(p => p <= PokeballType.MASTER_BALL).map(t => [ t, 0 ]));
		this.pokeballCounts[PokeballType.POKEBALL] += 5;
		if (Overrides.POKEBALL_OVERRIDE.active) {
            this.pokeballCounts = Overrides.POKEBALL_OVERRIDE.pokeballs;
          }

		this.modifiers = [];
		this.enemyModifiers = [];
		this.modifierBar.removeAll(true);
		this.enemyModifierBar.removeAll(true);

		for (let p of this.getParty())
			p.destroy();
		this.party = [];
		for (let p of this.getEnemyParty())
			p.destroy();
			
		this.currentBattle = null;

		this.waveCountText.setText(startingWave.toString());
		this.waveCountText.setVisible(false);

		this.updateMoneyText();
		this.moneyText.setVisible(false);

		this.updateScoreText();
		this.scoreText.setVisible(false);

		[ this.luckLabelText, this.luckText ].map(t => t.setVisible(false));

		this.newArena(Overrides.STARTING_BIOME_OVERRIDE || Biome.TOWN);

		this.field.setVisible(true);

		this.arenaBgTransition.setPosition(0, 0);
		this.arenaPlayer.setPosition(300, 0);
		this.arenaPlayerTransition.setPosition(0, 0);
		[ this.arenaEnemy, this.arenaNextEnemy ].forEach(a => a.setPosition(-280, 0));
		this.arenaNextEnemy.setVisible(false);

		this.arena.init();

		this.trainer.setTexture(`trainer_${this.gameData.gender === PlayerGender.FEMALE ? 'f' : 'm'}_back`);
		this.trainer.setPosition(406, 186);
		this.trainer.setVisible(true);
		
		this.updateGameInfo();

		if (reloadI18n) {
			const localizable: Localizable[] = [
				...allSpecies,
				...allMoves,
				...allAbilities,
				...Utils.getEnumValues(ModifierPoolType).map(mpt => getModifierPoolForType(mpt)).map(mp => Object.values(mp).flat().map(mt => mt.modifierType).filter(mt => 'localize' in mt).map(lpb => lpb as unknown as Localizable)).flat()
			];
			for (let item of localizable)
				item.localize();
		}

		if (clearScene) {
			// Reload variant data in case sprite set has changed
			this.initVariantData();

			this.fadeOutBgm(250, false);
			this.tweens.add({
				targets: [ this.uiContainer ],
				alpha: 0,
				duration: 250,
				ease: 'Sine.easeInOut',
				onComplete: () => {
					this.clearPhaseQueue();

					this.children.removeAll(true);
					this.game.domContainer.innerHTML = '';
					this.launchBattle();
				}
			});
		}
	}

	/**
	 * Creates a new battle with the given parameters.
	 * 
	 * @param waveIndex - The index of the wave for the battle.
	 * @param battleType - The type of battle (e.g. wild, trainer).
	 * @param trainerData - The data of the trainer for the battle.
	 * @param double - Indicates if it's a double battle.
	 * @returns The newly created Battle object.
	 * @throws {Error} If an error occurs during the battle creation process.
	 */
	newBattle(waveIndex?: integer, battleType?: BattleType, trainerData?: TrainerData, double?: boolean): Battle {
		let newWaveIndex = waveIndex || ((this.currentBattle?.waveIndex || (startingWave - 1)) + 1);
		let newDouble: boolean;
		let newBattleType: BattleType;
		let newTrainer: Trainer;

		let battleConfig: FixedBattleConfig = null;

		this.resetSeed(newWaveIndex);

		const playerField = this.getPlayerField();
		
		if (this.gameMode.hasFixedBattles && fixedBattles.hasOwnProperty(newWaveIndex) && trainerData === undefined) {
			battleConfig = fixedBattles[newWaveIndex];
			newDouble = battleConfig.double;
			newBattleType = battleConfig.battleType;
			this.executeWithSeedOffset(() => newTrainer = battleConfig.getTrainer(this), (battleConfig.seedOffsetWaveIndex || newWaveIndex) << 8);
			if (newTrainer)
				this.field.add(newTrainer);
		} else {
			if (!this.gameMode.hasTrainers)
				newBattleType = BattleType.WILD;
			else if (battleType === undefined)
				newBattleType = this.gameMode.isWaveTrainer(newWaveIndex, this.arena) ? BattleType.TRAINER : BattleType.WILD;
			else
				newBattleType = battleType;

			if (newBattleType === BattleType.TRAINER) {
				const trainerType = this.arena.randomTrainerType(newWaveIndex);
				let doubleTrainer = false;
				if (trainerConfigs[trainerType].doubleOnly)
					doubleTrainer = true;
				else if (trainerConfigs[trainerType].hasDouble) {
					const doubleChance = new Utils.IntegerHolder(newWaveIndex % 10 === 0 ? 32 : 8);
					this.applyModifiers(DoubleBattleChanceBoosterModifier, true, doubleChance);
					playerField.forEach(p => applyAbAttrs(DoubleBattleChanceAbAttr, p, null, doubleChance));
					doubleTrainer = !Utils.randSeedInt(doubleChance.value);
				}
				newTrainer = trainerData !== undefined ? trainerData.toTrainer(this) : new Trainer(this, trainerType, doubleTrainer ? TrainerVariant.DOUBLE : Utils.randSeedInt(2) ? TrainerVariant.FEMALE : TrainerVariant.DEFAULT);
				this.field.add(newTrainer);
			}
		}

		if (double === undefined && newWaveIndex > 1) {
			if (newBattleType === BattleType.WILD && !this.gameMode.isWaveFinal(newWaveIndex)) {
				const doubleChance = new Utils.IntegerHolder(newWaveIndex % 10 === 0 ? 32 : 8);
				this.applyModifiers(DoubleBattleChanceBoosterModifier, true, doubleChance);
				playerField.forEach(p => applyAbAttrs(DoubleBattleChanceAbAttr, p, null, doubleChance));
				newDouble = !Utils.randSeedInt(doubleChance.value);
			} else if (newBattleType === BattleType.TRAINER)
				newDouble = newTrainer.variant === TrainerVariant.DOUBLE;
		} else if (!battleConfig)
			newDouble = !!double;

		if (Overrides.DOUBLE_BATTLE_OVERRIDE)
			newDouble = true;

		const lastBattle = this.currentBattle;

		if (lastBattle?.double && !newDouble)
			this.tryRemovePhase(p => p instanceof SwitchPhase);

		const maxExpLevel = this.getMaxExpLevel();

		this.lastEnemyTrainer = lastBattle?.trainer ?? null;

		this.executeWithSeedOffset(() => {
			this.currentBattle = new Battle(this.gameMode, newWaveIndex, newBattleType, newTrainer, newDouble);
		}, newWaveIndex << 3, this.waveSeed);
		this.currentBattle.incrementTurn(this);

		//this.pushPhase(new TrainerMessageTestPhase(this, TrainerType.RIVAL, TrainerType.RIVAL_2, TrainerType.RIVAL_3, TrainerType.RIVAL_4, TrainerType.RIVAL_5, TrainerType.RIVAL_6));

		if (!waveIndex && lastBattle) {
			let isNewBiome = !(lastBattle.waveIndex % 10) || ((this.gameMode.hasShortBiomes || this.gameMode.isDaily) && (lastBattle.waveIndex % 50) === 49);
			if (!isNewBiome && this.gameMode.hasShortBiomes && (lastBattle.waveIndex % 10) < 9) {
				let w = lastBattle.waveIndex - ((lastBattle.waveIndex % 10) - 1);
				let biomeWaves = 1;
				while (w < lastBattle.waveIndex) {
					let wasNewBiome = false;
					this.executeWithSeedOffset(() => {
						wasNewBiome = !Utils.randSeedInt(6 - biomeWaves);
					}, w << 4);
					if (wasNewBiome)
						biomeWaves = 1;
					else
						biomeWaves++;
					w++;
				}

				this.executeWithSeedOffset(() => {
					isNewBiome = !Utils.randSeedInt(6 - biomeWaves);
				}, lastBattle.waveIndex << 4);
			}
			const resetArenaState = isNewBiome || this.currentBattle.battleType === BattleType.TRAINER || this.currentBattle.battleSpec === BattleSpec.FINAL_BOSS;
			this.getEnemyParty().forEach(enemyPokemon => enemyPokemon.destroy());
			this.trySpreadPokerus();
			if (!isNewBiome && (newWaveIndex % 10) == 5)
				this.arena.updatePoolsForTimeOfDay();
			if (resetArenaState) {
				this.arena.removeAllTags();
				playerField.forEach((_, p) => this.unshiftPhase(new ReturnPhase(this, p)));
				this.unshiftPhase(new ShowTrainerPhase(this));
			}
			for (let pokemon of this.getParty()) {
				if (pokemon) {
					if (resetArenaState)
						pokemon.resetBattleData();
					this.triggerPokemonFormChange(pokemon, SpeciesFormChangeTimeOfDayTrigger);
				}
			}
			if (!this.gameMode.hasRandomBiomes && !isNewBiome)
				this.pushPhase(new NextEncounterPhase(this));
			else {
				this.pushPhase(new SelectBiomePhase(this));
				this.pushPhase(new NewBiomeEncounterPhase(this));

				const newMaxExpLevel = this.getMaxExpLevel();
				if (newMaxExpLevel > maxExpLevel)
					this.pushPhase(new LevelCapPhase(this));
			}
		}
		
		return this.currentBattle;
	}

	/**
	 * Creates a new Arena object based on the provided biome.
	 * @param biome The biome to create the Arena for.
	 * @returns The newly created Arena object.
	 * @throws Error if the provided biome is invalid or not supported.
	 */
	newArena(biome: Biome): Arena {
		this.arena = new Arena(this, biome, Biome[biome].toLowerCase());

		this.arenaBg.pipelineData = { terrainColorRatio: this.arena.getBgTerrainColorRatioForBiome() };

		return this.arena;
	}

	/**
	 * Updates the field scale asynchronously.
	 * @returns A Promise that resolves when the field scale is updated.
	 * @throws {Error} If there is an error updating the field scale.
	 */
	updateFieldScale(): Promise<void> {
		return new Promise(resolve => {
			const fieldScale = Math.floor(Math.pow(1 / this.getField(true)
				.map(p => p.getSpriteScale())
				.reduce((highestScale: number, scale: number) => highestScale = Math.max(scale, highestScale), 0), 0.7) * 40
			) / 40;
			this.setFieldScale(fieldScale).then(() => resolve());
		});
	}

	/**
	 * Sets the scale of the field.
	 * 
	 * @param scale - The scale to set for the field.
	 * @param instant - Whether to set the scale instantly or with animation. Default is false.
	 * @returns A promise that resolves when the scale is set.
	 * @throws {Error} If there is an error setting the scale.
	 */
	setFieldScale(scale: number, instant: boolean = false): Promise<void> {
		return new Promise(resolve => {
			scale *= 6;
			if (this.field.scale === scale)
				return resolve();

			const defaultWidth = this.arenaBg.width * 6;
			const defaultHeight = 132 * 6;
			const scaledWidth = this.arenaBg.width * scale;
			const scaledHeight = 132 * scale;

			this.tweens.add({
				targets: this.field,
				scale: scale,
				x: (defaultWidth - scaledWidth) / 2,
				y: defaultHeight - scaledHeight,
				duration: !instant ? Utils.fixedInt(Math.abs(this.field.scale - scale) * 200) : 0,
				ease: 'Sine.easeInOut',
				onComplete: () => resolve()
			});
		});
	}

	/**
	 * Returns the index of the species form based on the provided parameters.
	 * @param species The PokemonSpecies for which the form index needs to be retrieved.
	 * @param gender Optional. The gender of the Pokemon.
	 * @param nature Optional. The nature of the Pokemon.
	 * @param ignoreArena Optional. If true, ignores the arena and returns the form index.
	 * @returns The index of the species form.
	 * @throws Throws an error if the species forms are not available.
	 */
	getSpeciesFormIndex(species: PokemonSpecies, gender?: Gender, nature?: Nature, ignoreArena?: boolean): integer {
		if (!species.forms?.length)
			return 0;

		switch (species.speciesId) {
			case Species.UNOWN:
			case Species.SHELLOS:
			case Species.GASTRODON:
			case Species.BASCULIN:
			case Species.DEERLING:
			case Species.SAWSBUCK:
			case Species.FROAKIE:
			case Species.FROGADIER:
			case Species.SCATTERBUG:
			case Species.SPEWPA:
			case Species.VIVILLON:
			case Species.FLABEBE:
			case Species.FLOETTE:
			case Species.FLORGES:
			case Species.FURFROU:
			case Species.ORICORIO:
			case Species.MAGEARNA:
			case Species.ZARUDE:
			case Species.SQUAWKABILLY:
			case Species.TATSUGIRI:
			case Species.PALDEA_TAUROS:
				return Utils.randSeedInt(species.forms.length);
			case Species.GRENINJA:
				return Utils.randSeedInt(2);
			case Species.ZYGARDE:
				return Utils.randSeedInt(3);
			case Species.MINIOR:
				return Utils.randSeedInt(6);
			case Species.ALCREMIE:
				return Utils.randSeedInt(9);
			case Species.MEOWSTIC:
			case Species.INDEEDEE:
			case Species.BASCULEGION:
			case Species.OINKOLOGNE:
				return gender === Gender.FEMALE ? 1 : 0;
			case Species.TOXTRICITY:
				const lowkeyNatures = [ Nature.LONELY, Nature.BOLD, Nature.RELAXED, Nature.TIMID, Nature.SERIOUS, Nature.MODEST, Nature.MILD, Nature.QUIET, Nature.BASHFUL, Nature.CALM, Nature.GENTLE, Nature.CAREFUL ];
				if (nature !== undefined && lowkeyNatures.indexOf(nature) > -1)
					return 1;
				return 0;
		}

		if (ignoreArena) {
			switch (species.speciesId) {
				case Species.BURMY:
				case Species.WORMADAM:
				case Species.ROTOM:
				case Species.LYCANROC:
					return Utils.randSeedInt(species.forms.length);
			}
			return 0;
		}

		return this.arena.getSpeciesFormIndex(species);
	}

	/**
	 * Private method to get the generated offset gym.
	 * 
	 * @returns {boolean} - Returns a boolean value indicating the success of the operation.
	 * @throws {Error} - Throws an error if any of the called functions fail.
	 */
	private getGeneratedOffsetGym(): boolean {
		let ret = false;
		this.executeWithSeedOffset(() => {
			ret = !Utils.randSeedInt(2);
		}, 0, this.seed.toString());
		return ret;
	}

	/**
	 * Private method to get the generated wave cycle offset.
	 * @returns {number} The generated wave cycle offset.
	 * @throws {Error} Throws an error if the seed is not a valid string.
	 */
	private getGeneratedWaveCycleOffset(): integer {
		let ret = 0;
		this.executeWithSeedOffset(() => {
			ret = Utils.randSeedInt(8) * 5;
		}, 0, this.seed.toString());
		return ret;
	}

	/**
	 * Returns the number of encounter boss segments based on the wave index, level, species, and forceBoss flag.
	 * @param waveIndex The index of the wave.
	 * @param level The level of the encounter.
	 * @param species (Optional) The species of the encounter.
	 * @param forceBoss (Optional) Flag to force a boss encounter.
	 * @returns The number of encounter boss segments.
	 * @throws {Error} If an error occurs during the execution of the method.
	 */
	getEncounterBossSegments(waveIndex: integer, level: integer, species?: PokemonSpecies, forceBoss: boolean = false): integer {
		if (this.gameMode.isDaily && this.gameMode.isWaveFinal(waveIndex))
			return 5;

		let isBoss: boolean;
		if (forceBoss || (species && (species.subLegendary || species.legendary || species.mythical)))
			isBoss = true;
		else {
			this.executeWithSeedOffset(() => {
				isBoss = waveIndex % 10 === 0 || (this.gameMode.hasRandomBosses && Utils.randSeedInt(100) < Math.min(Math.max(Math.ceil((waveIndex - 250) / 50), 0) * 2, 30));
			}, waveIndex << 2);
		}
		if (!isBoss)
			return 0;

		let ret: integer = 2;

		if (level >= 100)
			ret++;
		if (species) {
			if (species.baseTotal >= 670)
				ret++;
		}
		ret += Math.floor(waveIndex / 250);

		return ret;
	}

	/**
	 * Tries to spread Pokerus within the party.
	 * @throws {Error} Throws an error if there is a problem with spreading Pokerus.
	 */
	trySpreadPokerus(): void {
		const party = this.getParty();
		const infectedIndexes: integer[] = [];
		/**
		 * Spread pokerus to a party member at a specific index.
		 * @param index The index of the party member to spread pokerus from.
		 * @param spreadTo The index to spread pokerus to.
		 * @throws {Error} Throws an error if the party member at the specified index is not found.
		 * @throws {Error} Throws an error if the random seed generation fails.
		 */
		const spread = (index: number, spreadTo: number) => {
			const partyMember = party[index + spreadTo];
			if (!partyMember.pokerus && !Utils.randSeedInt(10)) {
				partyMember.pokerus = true;
				infectedIndexes.push(index + spreadTo);
			}
		};
		party.forEach((pokemon, p) => {
			if (!pokemon.pokerus || infectedIndexes.indexOf(p) > -1)
				return;
			
			this.executeWithSeedOffset(() => {
				if (p)
					spread(p, -1);
				if (p < party.length - 1)
					spread(p, 1);
			}, this.currentBattle.waveIndex + (p << 8));
		});
	}

	/**
	 * Resets the seed for the random number generator.
	 * @param waveIndex - Optional parameter specifying the index of the wave. If not provided, the currentBattle's waveIndex is used. If that is also not available, 0 is used.
	 * @throws - No exceptions are thrown by this method.
	 * @returns - This method does not return any value.
	 */
	resetSeed(waveIndex?: integer): void {
		const wave = waveIndex || this.currentBattle?.waveIndex || 0;
		this.waveSeed = Utils.shiftCharCodes(this.seed, wave);
		Phaser.Math.RND.sow([ this.waveSeed ]);
		console.log('Wave Seed:', this.waveSeed, wave);
		this.rngCounter = 0;
	}

	/**
	 * Executes the given function with a specified offset and seed override.
	 * @param func The function to be executed.
	 * @param offset The offset value to be used.
	 * @param seedOverride An optional seed override value.
	 * @throws If the func parameter is not provided.
	 */
	executeWithSeedOffset(func: Function, offset: integer, seedOverride?: string): void {
		if (!func)
			return;
		const tempRngCounter = this.rngCounter;
		const tempRngOffset = this.rngOffset;
		const tempRngSeedOverride = this.rngSeedOverride;
		const state = Phaser.Math.RND.state();
		Phaser.Math.RND.sow([ Utils.shiftCharCodes(seedOverride || this.seed, offset) ]);
		this.rngCounter = 0;
		this.rngOffset = offset;
		this.rngSeedOverride = seedOverride || '';
		func();
		Phaser.Math.RND.state(state);
		this.rngCounter = tempRngCounter;
		this.rngOffset = tempRngOffset;
		this.rngSeedOverride = tempRngSeedOverride;
	}

	/**
	 * Adds a field sprite to the game world at the specified coordinates.
	 * @param x The x-coordinate for the sprite.
	 * @param y The y-coordinate for the sprite.
	 * @param texture The texture for the sprite, specified as a string or Phaser.Textures.Texture.
	 * @param frame Optional. The frame for the sprite, specified as a string or number.
	 * @param terrainColorRatio Optional. The terrain color ratio for the sprite, defaults to 0.
	 * @returns The created Phaser.GameObjects.Sprite.
	 * @throws None
	 */
	addFieldSprite(x: number, y: number, texture: string | Phaser.Textures.Texture, frame?: string | number, terrainColorRatio: number = 0): Phaser.GameObjects.Sprite {
		const ret = this.add.sprite(x, y, texture, frame);
		ret.setPipeline(this.fieldSpritePipeline);
		if (terrainColorRatio)
			ret.pipelineData['terrainColorRatio'] = terrainColorRatio;

		return ret;
	}

	/**
	 * Adds a Pokemon sprite to the game.
	 * 
	 * @param pokemon The Pokemon object to be added as a sprite.
	 * @param x The x-coordinate of the sprite.
	 * @param y The y-coordinate of the sprite.
	 * @param texture The texture of the sprite.
	 * @param frame The frame of the sprite.
	 * @param hasShadow Indicates whether the sprite has a shadow.
	 * @param ignoreOverride Indicates whether to ignore any overrides.
	 * 
	 * @returns The created Phaser.GameObjects.Sprite.
	 * 
	 * @throws If there is an issue with adding the field sprite or initializing the Pokemon sprite.
	 */
	addPokemonSprite(pokemon: Pokemon, x: number, y: number, texture: string | Phaser.Textures.Texture, frame?: string | number, hasShadow: boolean = false, ignoreOverride: boolean = false): Phaser.GameObjects.Sprite {
		const ret = this.addFieldSprite(x, y, texture, frame);
		this.initPokemonSprite(ret, pokemon, hasShadow, ignoreOverride);
		return ret;
	}

	/**
	 * Initializes the Pokemon sprite.
	 * @param sprite The Phaser.GameObjects.Sprite to initialize.
	 * @param pokemon Optional Pokemon object to associate with the sprite.
	 * @param hasShadow Boolean indicating whether the sprite has a shadow.
	 * @param ignoreOverride Boolean indicating whether to ignore any overrides.
	 * @throws {Error} If the sprite pipeline cannot be set.
	 * @returns The initialized Phaser.GameObjects.Sprite.
	 */
	initPokemonSprite(sprite: Phaser.GameObjects.Sprite, pokemon?: Pokemon, hasShadow: boolean = false, ignoreOverride: boolean = false): Phaser.GameObjects.Sprite {
		sprite.setPipeline(this.spritePipeline, { tone: [ 0.0, 0.0, 0.0, 0.0 ], hasShadow: hasShadow, ignoreOverride: ignoreOverride, teraColor: pokemon ? getTypeRgb(pokemon.getTeraType()) : undefined });
		this.spriteSparkleHandler.add(sprite);
		return sprite;
	}

	/**
	 * Show field overlay with a specified duration.
	 * @param duration The duration for which the field overlay should be displayed.
	 * @returns A Promise that resolves when the field overlay animation is complete.
	 * @throws {Error} If the duration is not a valid integer.
	 */
	showFieldOverlay(duration: integer): Promise<void> {
		return new Promise(resolve => {
			this.tweens.add({
				targets: this.fieldOverlay,
				alpha: 0.5,
				ease: 'Sine.easeOut',
				duration: duration,
				onComplete: () => resolve()
			});
		});
	}

	/**
	 * Hides the field overlay with a specified duration.
	 * @param duration The duration in milliseconds for the overlay to fade out.
	 * @returns A Promise that resolves when the overlay is completely hidden.
	 * @throws {Error} If there is an error while hiding the overlay.
	 */
	hideFieldOverlay(duration: integer): Promise<void> {
		return new Promise(resolve => {
			this.tweens.add({
				targets: this.fieldOverlay,
				alpha: 0,
				duration: duration,
				ease: 'Cubic.easeIn',
				onComplete: () => resolve()
			});
		});
	}

	/**
	 * Update the wave count text on the screen.
	 * @throws {Error} If the currentBattle is not defined.
	 */
	updateWaveCountText(): void {
		const isBoss = !(this.currentBattle.waveIndex % 10);
		this.waveCountText.setText(this.currentBattle.waveIndex.toString());
		this.waveCountText.setColor(!isBoss ? '#404040' : '#f89890');
		this.waveCountText.setShadowColor(!isBoss ? '#ded6b5' : '#984038');
		this.waveCountText.setVisible(true);
	}

	/**
	 * Updates the money text on the screen.
	 * @throws {Error} If unable to update the money text.
	 */
	updateMoneyText(): void {
		this.moneyText.setText(`₽${this.money.toLocaleString('en-US')}`);
		this.moneyText.setVisible(true);
	}

	/**
	 * Updates the score text on the game screen.
	 * @throws {Error} If the game mode is not daily.
	 */
	updateScoreText(): void {
		this.scoreText.setText(`Score: ${this.score.toString()}`);
		this.scoreText.setVisible(this.gameMode.isDaily);
	}

	/**
	 * Updates and shows luck text with a specified duration.
	 * @param duration The duration for the animation in milliseconds.
	 * @throws {Error} If any of the specified functions are not defined or if there is an error during the animation.
	 */
	updateAndShowLuckText(duration: integer): void {
		const labels = [ this.luckLabelText, this.luckText ];
		labels.map(t => {
			t.setAlpha(0);
			t.setVisible(true);
		})
		const luckValue = getPartyLuckValue(this.getParty());
		this.luckText.setText(getLuckString(luckValue));
		if (luckValue < 14)
			this.luckText.setTint(getLuckTextTint(luckValue));
		else
			this.luckText.setTint(0x83a55a, 0xee384a, 0x5271cd, 0x7b487b);
		this.luckLabelText.setX((this.game.canvas.width / 6) - 2 - (this.luckText.displayWidth + 2));
		this.tweens.add({
			targets: labels,
			duration: duration,
			alpha: 1
		});
	}

	/**
	 * Hides luck text with a specified duration.
	 * @param duration The duration in milliseconds for hiding the luck text.
	 * @throws {Error} Throws an error if the specified duration is not a valid integer.
	 */
	hideLuckText(duration: integer): void {
		const labels = [ this.luckLabelText, this.luckText ];
		this.tweens.add({
			targets: labels,
			duration: duration,
			alpha: 0,
			onComplete: () => {
				labels.map(l => l.setVisible(false));
			}
		});
	}

	/**
	 * Update the UI positions based on enemy modifier count and canvas height.
	 * @throws {Error} If any error occurs during the update process.
	 */
	updateUIPositions(): void {
		const enemyModifierCount = this.enemyModifiers.filter(m => m.isIconVisible(this)).length;
		this.waveCountText.setY(-(this.game.canvas.height / 6) + (enemyModifierCount ? enemyModifierCount <= 12 ? 15 : 24 : 0));
		this.moneyText.setY(this.waveCountText.y + 10);
		this.scoreText.setY(this.moneyText.y + 10);
		[ this.luckLabelText, this.luckText ].map(l => l.setY((this.scoreText.visible ? this.scoreText : this.moneyText).y + 10));
		const offsetY = (this.scoreText.visible ? this.scoreText : this.moneyText).y + 15;
		this.partyExpBar.setY(offsetY);
		this.candyBar.setY(offsetY + 15);
		this.ui?.achvBar.setY(this.game.canvas.height / 6 + offsetY);
	}

	/**
	 * Increases the score for a fainted enemy based on its level, base experience, IVs, held items, and boss status.
	 * @param enemy The fainted enemy Pokemon.
	 * @throws {Error} If the enemy is not valid or if any of the calculations fail.
	 */
	addFaintedEnemyScore(enemy: EnemyPokemon): void {
		let scoreIncrease = enemy.getSpeciesForm().getBaseExp() * (enemy.level / this.getMaxExpLevel()) * ((enemy.ivs.reduce((iv: integer, total: integer) => total += iv, 0) / 93) * 0.2 + 0.8);
		this.findModifiers(m => m instanceof PokemonHeldItemModifier && m.pokemonId === enemy.id, false).map(m => scoreIncrease *= (m as PokemonHeldItemModifier).getScoreMultiplier());
		if (enemy.isBoss())
			scoreIncrease *= Math.sqrt(enemy.bossSegments);
		this.currentBattle.battleScore += Math.ceil(scoreIncrease);
	}

	/**
	 * Returns the maximum experience level.
	 * @param ignoreLevelCap Set to true to ignore the level cap.
	 * @returns The maximum experience level as an integer.
	 * @throws None
	 */
	getMaxExpLevel(ignoreLevelCap?: boolean): integer {
		if (ignoreLevelCap)
			return Number.MAX_SAFE_INTEGER;
		const waveIndex = Math.ceil((this.currentBattle?.waveIndex || 1) / 10) * 10;
		const difficultyWaveIndex = this.gameMode.getWaveForDifficulty(waveIndex);
		const baseLevel = (1 + difficultyWaveIndex / 2 + Math.pow(difficultyWaveIndex / 25, 2)) * 1.2;
		return Math.ceil(baseLevel / 2) * 2 + 2;
	}

	/**
	 * Generates a random Pokemon species based on the provided parameters.
	 * 
	 * @param waveIndex The index of the wave.
	 * @param level The level of the Pokemon.
	 * @param fromArenaPool Optional parameter to indicate if the species should be randomly selected from the arena pool.
	 * @param speciesFilter Optional filter function to apply on the Pokemon species.
	 * @param filterAllEvolutions Optional parameter to indicate if all evolutions should be filtered.
	 * 
	 * @returns The randomly generated Pokemon species.
	 * 
	 * @throws If an error occurs while generating the random species.
	 */
	randomSpecies(waveIndex: integer, level: integer, fromArenaPool?: boolean, speciesFilter?: PokemonSpeciesFilter, filterAllEvolutions?: boolean): PokemonSpecies {
		if (fromArenaPool)
			return this.arena.randomSpecies(waveIndex, level);
		const filteredSpecies = speciesFilter ? [...new Set(allSpecies.filter(s => s.isCatchable()).filter(speciesFilter).map(s => {
			if (!filterAllEvolutions) {
				while (pokemonPrevolutions.hasOwnProperty(s.speciesId))
					s = getPokemonSpecies(pokemonPrevolutions[s.speciesId]);
			}
			return s;
		}))] : allSpecies.filter(s => s.isCatchable());
		return filteredSpecies[Utils.randSeedInt(filteredSpecies.length)];
	}

	/**
	 * Generates a random biome based on the wave index.
	 * @param waveIndex The index of the wave.
	 * @returns The generated biome.
	 * @throws {Error} If the calculation of the random biome fails.
	 */
	generateRandomBiome(waveIndex: integer): Biome {
		const relWave = waveIndex % 250;
		const biomes = Utils.getEnumValues(Biome).slice(1, Utils.getEnumValues(Biome).filter(b => b >= 40).length * -1);
		const maxDepth = biomeDepths[Biome.END][0] - 2;
		const depthWeights = new Array(maxDepth + 1).fill(null)
			.map((_, i: integer) => ((1 - Math.min(Math.abs((i / (maxDepth - 1)) - (relWave / 250)) + 0.25, 1)) / 0.75) * 250);
		const biomeThresholds: integer[] = [];
		let totalWeight = 0;
		for (let biome of biomes) {
			totalWeight += Math.ceil(depthWeights[biomeDepths[biome][0] - 1] / biomeDepths[biome][1]);
			biomeThresholds.push(totalWeight);
		}

		const randInt = Utils.randSeedInt(totalWeight);

		for (let biome of biomes) {
			if (randInt < biomeThresholds[biome])
				return biome;
		}

		return biomes[Utils.randSeedInt(biomes.length)];
	}

	/**
	 * Check if background music is currently playing.
	 * @returns {boolean} - Returns true if background music is playing, otherwise false.
	 * @throws {Error} - Throws an error if there is an issue checking the status of background music.
	 */
	isBgmPlaying(): boolean {
		return this.bgm && this.bgm.isPlaying;
	}

	/**
	 * Plays background music with the given name and options.
	 * @param bgmName Optional. The name of the background music to play.
	 * @param fadeOut Optional. If true, the current background music will fade out before playing the new one.
	 * @throws {Error} If there is an issue with loading or playing the background music.
	 */
	playBgm(bgmName?: string, fadeOut?: boolean): void {
		if (bgmName === undefined)
			bgmName = this.currentBattle?.getBgmOverride(this) || this.arena?.bgm;
		if (this.bgm && bgmName === this.bgm.key) {
			if (!this.bgm.isPlaying) {
				this.bgm.play({
					volume: this.masterVolume * this.bgmVolume
				});
			}
			return;
		}
		if (fadeOut && !this.bgm)
			fadeOut = false;
		this.bgmCache.add(bgmName);
		this.loadBgm(bgmName);
		let loopPoint = 0;
		loopPoint = bgmName === this.arena.bgm
			? this.arena.getBgmLoopPoint()
			: this.getBgmLoopPoint(bgmName);
		let loaded = false;
		/**
		 * Plays a new background music.
		 * @throws {Error} If an error occurs while playing the background music.
		 */
		const playNewBgm = () => {
			if (bgmName === null && this.bgm && !this.bgm.pendingRemove) {
				this.bgm.play({
					volume: this.masterVolume * this.bgmVolume
				});
				return;
			}
			if (this.bgm && !this.bgm.pendingRemove && this.bgm.isPlaying)
				this.bgm.stop();
			this.bgm = this.sound.add(bgmName, { loop: true });
			this.bgm.play({
				volume: this.masterVolume * this.bgmVolume
			});
			if (loopPoint)
				this.bgm.on('looped', () => this.bgm.play({ seek: loopPoint }));
		};
		this.load.once(Phaser.Loader.Events.COMPLETE, () => {
			loaded = true;
			if (!fadeOut || !this.bgm.isPlaying)
				playNewBgm();
		});
		if (fadeOut) {
			/**
			 * This method checks if the background music is faded and plays a new background music if it is not playing or pending removal.
			 * @throws {Error} Throws an error if the background music is not loaded.
			 */
			const onBgmFaded = () => {
				if (loaded && (!this.bgm.isPlaying || this.bgm.pendingRemove))
					playNewBgm();
			};
			this.time.delayedCall(this.fadeOutBgm(500, true) ? 750 : 250, onBgmFaded);
		}
		if (!this.load.isLoading())
			this.load.start();
	}

	/**
	 * Pauses the background music.
	 * @returns {boolean} - Returns true if the background music is successfully paused, otherwise returns false.
	 * @throws {Error} - Throws an error if the background music is not found or if there is an issue pausing the music.
	 */
	pauseBgm(): boolean {
		if (this.bgm && !this.bgm.pendingRemove && this.bgm.isPlaying) {
			this.bgm.pause();
			return true;
		}
		return false;
	}

	/**
	 * Resumes the background music.
	 * @returns {boolean} - Returns true if the background music is successfully resumed, otherwise returns false.
	 * @throws {Error} - Throws an error if the background music is not available or cannot be resumed.
	 */
	resumeBgm(): boolean {
		if (this.bgm && !this.bgm.pendingRemove && this.bgm.isPaused) {
			this.bgm.resume();
			return true;
		}
		return false;
	}

	/**
	 * Updates the sound volume.
	 * @throws {Error} If the sound is not available.
	 */
	updateSoundVolume(): void {
		if (this.sound) {
			for (let sound of this.sound.getAllPlaying())
				(sound as AnySound).setVolume(this.masterVolume * (this.bgmCache.has(sound.key) ? this.bgmVolume : this.seVolume));
		}
	}

	/**
	 * Fades out the background music.
	 * @param duration The duration of the fade out in milliseconds. Default is 500.
	 * @param destroy Whether to destroy the background music after fading out. Default is true.
	 * @returns Returns true if the fade out was successful, otherwise false.
	 * @throws If the background music is not found or if an error occurs during the fade out process.
	 */
	fadeOutBgm(duration: integer = 500, destroy: boolean = true): boolean {
		if (!this.bgm)
			return false;
    const bgm = this.sound.getAllPlaying().find(bgm => bgm.key === this.bgm.key);
		if (bgm) {
			SoundFade.fadeOut(this, this.bgm, duration, destroy);
			return true;
		}

		return false;
	}

	/**
	 * Plays a sound with the given configuration.
	 * @param sound - The sound to be played, either a string or an object of type AnySound.
	 * @param config - Optional configuration object for the sound.
	 * @returns The played sound of type AnySound.
	 * @throws If an error occurs while playing the sound.
	 */
	playSound(sound: string | AnySound, config?: object): AnySound {
		if (config) {
			if (config.hasOwnProperty('volume'))
				config['volume'] *= this.masterVolume * this.seVolume;
			else
				config['volume'] = this.masterVolume * this.seVolume;
		} else
			config = { volume: this.masterVolume * this.seVolume };
		// PRSFX sounds are mixed too loud
		if ((typeof sound === 'string' ? sound : sound.key).startsWith('PRSFX- '))
			config['volume'] *= 0.5;
		if (typeof sound === 'string') {
			this.sound.play(sound, config);
			return this.sound.get(sound) as AnySound;
		} else {
			sound.play(config);
			return sound;
		}
	}

	/**
	 * Play a sound without background music.
	 * 
	 * @param soundName - The name of the sound to be played.
	 * @param pauseDuration - Optional. The duration to pause the background music in milliseconds.
	 * @returns The played sound.
	 * @throws If the soundName is not found in the sound cache.
	 * @throws If an error occurs while playing the sound.
	 */
	playSoundWithoutBgm(soundName: string, pauseDuration?: integer): AnySound {
		this.bgmCache.add(soundName);
		const resumeBgm = this.pauseBgm();
		this.playSound(soundName);
		const sound = this.sound.get(soundName) as AnySound;
		if (this.bgmResumeTimer)
			this.bgmResumeTimer.destroy();
		if (resumeBgm) {
			this.bgmResumeTimer = this.time.delayedCall((pauseDuration || Utils.fixedInt(sound.totalDuration * 1000)), () => {
				this.resumeBgm();
				this.bgmResumeTimer = null;
			});
		}
		return sound;
	}

	/**
	 * Retrieves the loop point of the background music based on the given name.
	 * @param bgmName The name of the background music.
	 * @returns The loop point of the background music.
	 * @throws If the specified background music name is not found, it throws an error.
	 */
	getBgmLoopPoint(bgmName: string): number {
		switch (bgmName) {
			case 'battle_kanto_champion':
				return 13.950;
			case 'battle_johto_champion':
				return 23.498;
			case 'battle_hoenn_champion':
				return 11.328;
			case 'battle_sinnoh_champion':
				return 12.235;
			case 'battle_champion_alder':
				return 27.653;
			case 'battle_champion_iris':
				return 10.145;
			case 'battle_elite':
				return 17.730;
			case 'battle_final_encounter':
				return 19.159;
			case 'battle_final':
				return 16.453;
			case 'battle_kanto_gym':
				return 13.857;
			case 'battle_johto_gym':
				return 12.911;
			case 'battle_hoenn_gym':
				return 12.379;
			case 'battle_sinnoh_gym':
				return 13.122;
			case 'battle_unova_gym':
				return 19.145;
			case 'battle_legendary_regis': //B2W2 Legendary Titan Battle
				return 49.500;
			case 'battle_legendary_unova': //BW Unova Legendary Battle
				return 13.855;
			case 'battle_legendary_kyurem': //BW Kyurem Battle
				return 18.314;
			case 'battle_legendary_res_zek': //BW Reshiram & Zekrom Battle
				return 18.329;
			case 'battle_rival':
				return 13.689;
			case 'battle_rival_2':
				return 17.714;
			case 'battle_rival_3':
				return 17.586;
			case 'battle_trainer':
				return 13.686;
			case 'battle_wild':
				return 12.703;
			case 'battle_wild_strong':
				return 13.940;
			case 'end_summit':
				return 30.025;
		}

		return 0;
	}

	/**
	 * Toggles the invert effect for the main camera.
	 * @param invert - A boolean value indicating whether to apply the invert effect.
	 * @throws {Error} - Throws an error if the specified invert value is not a boolean.
	 */
	toggleInvert(invert: boolean): void {
		if (invert)
			this.cameras.main.setPostPipeline(InvertPostFX);
		else
			this.cameras.main.removePostPipeline('InvertPostFX');
	}

	/**
	 * Get the current phase.
	 * @returns {Phase} The current phase.
	 * @throws {Error} If the current phase is not available.
	 */
	/* Phase Functions */
	getCurrentPhase(): Phase {
		return this.currentPhase;
	}

	/**
	 * Retrieves the standby phase.
	 * @returns {Phase} The standby phase.
	 */
	getStandbyPhase(): Phase {
		return this.standbyPhase;
	}

	/**
	 * Pushes a phase onto the phase queue or the next command phase queue.
	 * @param phase The phase to push onto the queue.
	 * @param defer If true, the phase will be pushed onto the next command phase queue; otherwise, it will be pushed onto the phase queue.
	 * @throws {Error} Throws an error if the phase cannot be pushed onto the queue.
	 */
	pushPhase(phase: Phase, defer: boolean = false): void {
		(!defer ? this.phaseQueue : this.nextCommandPhaseQueue).push(phase);
	}

	/**
	 * Add a phase to the beginning of the phase queue.
	 * @param phase The phase to be added to the queue.
	 * @throws {Error} Throws an error if the phaseQueuePrependSpliceIndex is -1 and the phaseQueuePrepend.push operation fails.
	 * @throws {Error} Throws an error if the phaseQueuePrependSpliceIndex is not -1 and the phaseQueuePrepend.splice operation fails.
	 */
	unshiftPhase(phase: Phase): void {
		if (this.phaseQueuePrependSpliceIndex === -1)
			this.phaseQueuePrepend.push(phase);
		else
			this.phaseQueuePrepend.splice(this.phaseQueuePrependSpliceIndex, 0, phase);
	}

	/**
	 * Clears the phase queue.
	 * @throws {Error} Throws an error if unable to clear the phase queue.
	 */
	clearPhaseQueue(): void {
		this.phaseQueue.splice(0, this.phaseQueue.length);
	}

	/**
	 * Sets the phase queue splice.
	 * 
	 * @throws {Error} If an error occurs while setting the phase queue splice.
	 */
	setPhaseQueueSplice(): void {
		this.phaseQueuePrependSpliceIndex = this.phaseQueuePrepend.length;
	}

	/**
	 * Clears the phase queue splice.
	 * @throws {Error} If an error occurs while clearing the phase queue splice.
	 */
	clearPhaseQueueSplice(): void {
		this.phaseQueuePrependSpliceIndex = -1;
	}

	/**
	 * Shifts the phase to the next one in the queue or standby phase if available.
	 * If standby phase is available, it becomes the current phase and standby phase is set to null.
	 * If phase queue prepend splice index is greater than -1, clears the phase queue splice.
	 * If phase queue prepend has elements, adds them to the beginning of the phase queue.
	 * If phase queue is empty, populates the phase queue.
	 * Sets the current phase to the next one in the queue and starts it.
	 * 
	 * @throws {Error} If an error occurs while shifting the phase.
	 */
	shiftPhase(): void {
		if (this.standbyPhase) {
			this.currentPhase = this.standbyPhase;
			this.standbyPhase = null;
			return;
		}

		if (this.phaseQueuePrependSpliceIndex > -1)
			this.clearPhaseQueueSplice();
		if (this.phaseQueuePrepend.length) {
			while (this.phaseQueuePrepend.length)
				this.phaseQueue.unshift(this.phaseQueuePrepend.pop());
		}
		if (!this.phaseQueue.length)
			this.populatePhaseQueue();
		this.currentPhase = this.phaseQueue.shift();
		this.currentPhase.start();
	}
	
	/**
	 * Override the current phase with the given phase.
	 * @param phase The phase to override with.
	 * @throws {Error} If the standby phase is active.
	 * @returns {boolean} True if the phase was successfully overridden, false otherwise.
	 */
	overridePhase(phase: Phase): boolean {
		if (this.standbyPhase)
			return false;

		this.standbyPhase = this.currentPhase;
		this.currentPhase = phase;
		phase.start();

		return true;
	}

	/**
	 * Find phase based on the provided filter function.
	 * @param phaseFilter A function that filters the phase based on certain conditions.
	 * @returns The phase that matches the filter function.
	 * @throws If no phase is found based on the filter function.
	 */
	findPhase(phaseFilter: (phase: Phase) => boolean): Phase {
		return this.phaseQueue.find(phaseFilter);
	}

	/**
	 * Replace a phase in the phase queue based on the provided filter function.
	 * @param phaseFilter A function that filters phases based on certain criteria.
	 * @param phase The phase to be replaced.
	 * @returns Returns true if the phase was successfully replaced, otherwise false.
	 * @throws {Error} Throws an error if the phaseFilter function encounters an exception.
	 */
	tryReplacePhase(phaseFilter: (phase: Phase) => boolean, phase: Phase): boolean {
		const phaseIndex = this.phaseQueue.findIndex(phaseFilter);
		if (phaseIndex > -1) {
			this.phaseQueue[phaseIndex] = phase;
			return true;
		}
		return false;
	}

	/**
	 * Tries to remove a phase from the phase queue based on the provided filter function.
	 * @param phaseFilter A function that filters the phase to be removed.
	 * @returns Returns true if the phase is successfully removed, otherwise returns false.
	 * @throws None
	 */
	tryRemovePhase(phaseFilter: (phase: Phase) => boolean): boolean {
		const phaseIndex = this.phaseQueue.findIndex(phaseFilter);
		if (phaseIndex > -1) {
			this.phaseQueue.splice(phaseIndex, 1);
			return true;
		}
		return false;
	}

	/**
	 * Pushes a move phase into the phase queue with an optional priority override.
	 * 
	 * @param movePhase The move phase to push into the queue.
	 * @param priorityOverride An optional integer value to override the priority of the move phase.
	 * @throws {Error} Throws an error if there is an issue with applying ability attributes or manipulating the phase queue.
	 */
	pushMovePhase(movePhase: MovePhase, priorityOverride?: integer): void {
		const movePriority = new Utils.IntegerHolder(priorityOverride !== undefined ? priorityOverride : movePhase.move.getMove().priority);
		applyAbAttrs(IncrementMovePriorityAbAttr, movePhase.pokemon, null, movePhase.move.getMove(), movePriority);
		const lowerPriorityPhase = this.phaseQueue.find(p => p instanceof MovePhase && p.move.getMove().priority < movePriority.value);
		if (lowerPriorityPhase)
			this.phaseQueue.splice(this.phaseQueue.indexOf(lowerPriorityPhase), 0, movePhase);
		else
			this.pushPhase(movePhase);
	}

	/**
	 * Queue a message to be displayed in the message queue.
	 * 
	 * @param message The message to be queued.
	 * @param callbackDelay Optional. The delay before the callback is invoked.
	 * @param prompt Optional. Indicates whether a prompt should be displayed.
	 * @param promptDelay Optional. The delay before the prompt is displayed.
	 * @param defer Optional. Indicates whether the message should be deferred.
	 * 
	 * @throws {Error} If an error occurs while queuing the message.
	 */
	queueMessage(message: string, callbackDelay?: integer, prompt?: boolean, promptDelay?: integer, defer?: boolean) {
		const phase = new MessagePhase(this, message, callbackDelay, prompt, promptDelay);
		if (!defer)
			this.unshiftPhase(phase);
		else
			this.pushPhase(phase);
	}

	/**
	 * Method to populate the phase queue.
	 * 
	 * @throws {Error} Throws an error if the nextCommandPhaseQueue is empty.
	 */
	populatePhaseQueue(): void {
		if (this.nextCommandPhaseQueue.length) {
			this.phaseQueue.push(...this.nextCommandPhaseQueue);
			this.nextCommandPhaseQueue.splice(0, this.nextCommandPhaseQueue.length);
		}
		this.phaseQueue.push(new TurnInitPhase(this));
	}

	/**
	 * Adds the specified amount of money to the current balance.
	 * 
	 * @param amount The amount of money to add.
	 * @throws {Error} If the resulting balance exceeds Number.MAX_SAFE_INTEGER.
	 */
	addMoney(amount: integer): void {
		this.money = Math.min(this.money + amount, Number.MAX_SAFE_INTEGER);
		this.updateMoneyText();
		this.validateAchvs(MoneyAchv);
	}

	/**
	 * Calculates the amount of money to be rewarded based on the wave index and a money multiplier.
	 * @param moneyMultiplier The multiplier to be applied to the money value.
	 * @returns The calculated money amount rounded down to the nearest multiple of 10.
	 * @throws {TypeError} If moneyMultiplier is not a number.
	 */
	getWaveMoneyAmount(moneyMultiplier: number): integer {
		const waveIndex = this.currentBattle.waveIndex;
		const waveSetIndex = Math.ceil(waveIndex / 10) - 1;
		const moneyValue = Math.pow((waveSetIndex + 1 + (0.75 + (((waveIndex - 1) % 10) + 1) / 10)) * 100, 1 + 0.005 * waveSetIndex) * moneyMultiplier;
		return Math.floor(moneyValue / 10) * 10;
	}

	/**
	 * Adds a modifier to the current context.
	 * @param modifier The modifier to be added.
	 * @param ignoreUpdate If true, the update will be ignored.
	 * @param playSound If true, a sound will be played.
	 * @param virtual If true, the modifier is virtual.
	 * @param instant If true, the modifier is instant.
	 * @returns A promise that resolves to a boolean indicating the success of adding the modifier.
	 * @throws {Error} If an error occurs during the addition of the modifier.
	 */
	addModifier(modifier: Modifier, ignoreUpdate?: boolean, playSound?: boolean, virtual?: boolean, instant?: boolean): Promise<boolean> {
		return new Promise(resolve => {
			let success = false;
			const soundName = modifier.type.soundName;
			this.validateAchvs(ModifierAchv, modifier);
			const modifiersToRemove: PersistentModifier[] = [];
			const modifierPromises: Promise<boolean>[] = [];
			if (modifier instanceof PersistentModifier) {
				if (modifier instanceof TerastallizeModifier)
					modifiersToRemove.push(...(this.findModifiers(m => m instanceof TerastallizeModifier && m.pokemonId === modifier.pokemonId)));
				if ((modifier as PersistentModifier).add(this.modifiers, !!virtual, this)) {
					if (modifier instanceof PokemonFormChangeItemModifier || modifier instanceof TerastallizeModifier)
						success = modifier.apply([ this.getPokemonById(modifier.pokemonId), true ]);
					if (playSound && !this.sound.get(soundName))
						this.playSound(soundName);
				} else if (!virtual) {
					const defaultModifierType = getDefaultModifierTypeForTier(modifier.type.tier);
					this.queueMessage(`The stack for this item is full.\n You will receive ${defaultModifierType.name} instead.`, null, true);
					return this.addModifier(defaultModifierType.newModifier(), ignoreUpdate, playSound, false, instant).then(success => resolve(success));
				}
				
				for (let rm of modifiersToRemove)
					this.removeModifier(rm);

				if (!ignoreUpdate && !virtual)
					return this.updateModifiers(true, instant).then(() => resolve(success));
			} else if (modifier instanceof ConsumableModifier) {
				if (playSound && !this.sound.get(soundName))
					this.playSound(soundName);

				if (modifier instanceof ConsumablePokemonModifier) {
					for (let p in this.party) {
						const pokemon = this.party[p];

						const args: any[] = [ pokemon ];
						if (modifier instanceof PokemonHpRestoreModifier) {
							if (!(modifier as PokemonHpRestoreModifier).fainted) {
								const hpRestoreMultiplier = new Utils.IntegerHolder(1);
								this.applyModifiers(HealingBoosterModifier, true, hpRestoreMultiplier);
								args.push(hpRestoreMultiplier.value);
							} else
								args.push(1);
						} else if (modifier instanceof FusePokemonModifier)
							args.push(this.getPokemonById(modifier.fusePokemonId) as PlayerPokemon);
							
						if (modifier.shouldApply(args)) {
							const result = modifier.apply(args);
							if (result instanceof Promise)
								modifierPromises.push(result.then(s => success ||= s));
							else
								success ||= result;
						}
					}
					
					return Promise.allSettled([this.party.map(p => p.updateInfo(instant)), ...modifierPromises]).then(() => resolve(success));
				} else {
					const args = [ this ];
					if (modifier.shouldApply(args)) {
						const result = modifier.apply(args);
						if (result instanceof Promise) {
							return result.then(success => resolve(success));
						} else
							success ||= result;
					}
				}
			}

			resolve(success);
		});
	}

	/**
	 * Adds an enemy modifier to the battle.
	 * 
	 * @param modifier The persistent modifier to add.
	 * @param ignoreUpdate Optional. If true, the update will be ignored.
	 * @param instant Optional. If true, the modifier will be applied instantly.
	 * @returns A Promise that resolves when the operation is complete.
	 * @throws {Error} If there is an issue with adding the modifier.
	 */
	addEnemyModifier(modifier: PersistentModifier, ignoreUpdate?: boolean, instant?: boolean): Promise<void> {
		return new Promise(resolve => {
			const modifiersToRemove: PersistentModifier[] = [];
			if (modifier instanceof TerastallizeModifier)
					modifiersToRemove.push(...(this.findModifiers(m => m instanceof TerastallizeModifier && m.pokemonId === modifier.pokemonId, false)));
			if ((modifier as PersistentModifier).add(this.enemyModifiers, false, this)) {
				if (modifier instanceof PokemonFormChangeItemModifier || modifier instanceof TerastallizeModifier)
					modifier.apply([ this.getPokemonById(modifier.pokemonId), true ]);
				for (let rm of modifiersToRemove)
					this.removeModifier(rm, true);
			}
			if (!ignoreUpdate)
				this.updateModifiers(false, instant).then(() => resolve());
			else
				resolve();
		});
	}

	/**
	 * Asynchronously transfers a held item modifier to a target Pokemon.
	 * 
	 * @param itemModifier The PokemonHeldItemModifier to transfer.
	 * @param target The target Pokemon to transfer the modifier to.
	 * @param transferStack A boolean indicating whether to transfer the stack count of the modifier.
	 * @param playSound A boolean indicating whether to play a sound during the transfer.
	 * @param instant An optional boolean indicating whether the transfer should be instant.
	 * @param ignoreUpdate An optional boolean indicating whether to ignore updating the modifiers.
	 * 
	 * @returns A Promise that resolves to a boolean indicating the success of the transfer.
	 * 
	 * @throws Throws an error if there is an issue with applying attribute modifiers or updating modifiers.
	 */
	tryTransferHeldItemModifier(itemModifier: PokemonHeldItemModifier, target: Pokemon, transferStack: boolean, playSound: boolean, instant?: boolean, ignoreUpdate?: boolean): Promise<boolean> {
		return new Promise(resolve => {
			const source = itemModifier.pokemonId ? itemModifier.getPokemon(target.scene) : null;
			const cancelled = new Utils.BooleanHolder(false);
			Utils.executeIf(source && source.isPlayer() !== target.isPlayer(), () => applyAbAttrs(BlockItemTheftAbAttr, source, cancelled)).then(() => {
				if (cancelled.value)
					return resolve(false);
				const newItemModifier = itemModifier.clone() as PokemonHeldItemModifier;
				newItemModifier.pokemonId = target.id;
				const matchingModifier = target.scene.findModifier(m => m instanceof PokemonHeldItemModifier
					&& (m as PokemonHeldItemModifier).matchType(itemModifier) && m.pokemonId === target.id, target.isPlayer()) as PokemonHeldItemModifier;
				let removeOld = true;
				if (matchingModifier) {
					const maxStackCount = matchingModifier.getMaxStackCount(target.scene);
					if (matchingModifier.stackCount >= maxStackCount)
						return resolve(false);
					const countTaken = transferStack ? Math.min(itemModifier.stackCount, maxStackCount - matchingModifier.stackCount) : 1;
					itemModifier.stackCount -= countTaken;
					newItemModifier.stackCount = matchingModifier.stackCount + countTaken;
					removeOld = !itemModifier.stackCount;
				} else if (!transferStack) {
					newItemModifier.stackCount = 1;
					removeOld = !(--itemModifier.stackCount);
				}
				if (!removeOld || !source || this.removeModifier(itemModifier, !source.isPlayer())) {
					/**
					 * Adds a modifier to the target.
					 * 
					 * @throws {Error} Throws an error if the matching modifier is not found or if the target is not a player.
					 */
					const addModifier = () => {
						if (!matchingModifier || this.removeModifier(matchingModifier, !target.isPlayer())) {
							if (target.isPlayer())
								this.addModifier(newItemModifier, ignoreUpdate, playSound, false, instant).then(() => resolve(true));
							else
								this.addEnemyModifier(newItemModifier, ignoreUpdate, instant).then(() => resolve(true));
						} else
							resolve(false);
					};
					if (source && source.isPlayer() !== target.isPlayer() && !ignoreUpdate)
						this.updateModifiers(source.isPlayer(), instant).then(() => addModifier());
					else
						addModifier();
					return;
				}
				resolve(false);
			});
		});
	}

	/**
	 * Removes all modifiers associated with a specific party member.
	 * @param partyMemberIndex The index of the party member for which modifiers should be removed.
	 * @throws {Error} Throws an error if the party member index is out of range.
	 * @returns A Promise that resolves when the modifiers are successfully removed.
	 */
	removePartyMemberModifiers(partyMemberIndex: integer): Promise<void> {
		return new Promise(resolve => {
			const pokemonId = this.getParty()[partyMemberIndex].id;
			const modifiersToRemove = this.modifiers.filter(m => m instanceof PokemonHeldItemModifier && (m as PokemonHeldItemModifier).pokemonId === pokemonId);
			for (let m of modifiersToRemove)
				this.modifiers.splice(this.modifiers.indexOf(m), 1);
			this.updateModifiers().then(() => resolve());
		});
	}

	/**
	 * Asynchronously generates enemy modifiers for the current battle.
	 * @returns A Promise that resolves when the enemy modifiers have been generated.
	 * @throws {Error} If there is an error generating enemy modifiers.
	 */
	generateEnemyModifiers(): Promise<void> {
		return new Promise(resolve => {
			if (this.currentBattle.battleSpec === BattleSpec.FINAL_BOSS)
				return resolve();
			const difficultyWaveIndex = this.gameMode.getWaveForDifficulty(this.currentBattle.waveIndex);
			const isFinalBoss = this.gameMode.isWaveFinal(this.currentBattle.waveIndex);
			let chances = Math.ceil(difficultyWaveIndex / 10);
			if (isFinalBoss)
				chances = Math.ceil(chances * 2.5);

			const party = this.getEnemyParty();

			if (this.currentBattle.trainer) {
				const modifiers = this.currentBattle.trainer.genModifiers(party);
				for (let modifier of modifiers)
					this.addEnemyModifier(modifier, true, true);
			}

			party.forEach((enemyPokemon: EnemyPokemon, i: integer) => {
				const isBoss = enemyPokemon.isBoss() || (this.currentBattle.battleType === BattleType.TRAINER && this.currentBattle.trainer.config.isBoss);
				let upgradeChance = 32;
				if (isBoss)
					upgradeChance /= 2;
				if (isFinalBoss)
					upgradeChance /= 8;
				const modifierChance = this.gameMode.getEnemyModifierChance(isBoss);
				let pokemonModifierChance = modifierChance;
				if (this.currentBattle.battleType === BattleType.TRAINER)
					pokemonModifierChance = Math.ceil(pokemonModifierChance * this.currentBattle.trainer.getPartyMemberModifierChanceMultiplier(i));
				let count = 0;
				for (let c = 0; c < chances; c++) {
					if (!Utils.randSeedInt(modifierChance))
						count++;
				}
				if (isBoss)
					count = Math.max(count, Math.floor(chances / 2));
				getEnemyModifierTypesForWave(difficultyWaveIndex, count, [ enemyPokemon ], this.currentBattle.battleType === BattleType.TRAINER ? ModifierPoolType.TRAINER : ModifierPoolType.WILD, upgradeChance)
					.map(mt => mt.newModifier(enemyPokemon).add(this.enemyModifiers, false, this));
			});

			this.updateModifiers(false).then(() => resolve());
		});
	}

	/**
	 * Removes all modifiers from enemy of PersistentModifier type
	 * @throws {Error} If there is an error while updating modifiers or UI positions
	 */
	clearEnemyModifiers(): void {
		const modifiersToRemove = this.enemyModifiers.filter(m => m instanceof PersistentModifier);
		for (let m of modifiersToRemove)
			this.enemyModifiers.splice(this.enemyModifiers.indexOf(m), 1);
		this.updateModifiers(false).then(() => this.updateUIPositions());
	}

	/**
	 * Removes all modifiers from enemy of PokemonHeldItemModifier type
	 * @throws {Error} Throws an error if updateModifiers or updateUIPositions functions fail
	 */
	clearEnemyHeldItemModifiers(): void {
		const modifiersToRemove = this.enemyModifiers.filter(m => m instanceof PokemonHeldItemModifier);
		for (let m of modifiersToRemove)
			this.enemyModifiers.splice(this.enemyModifiers.indexOf(m), 1);
		this.updateModifiers(false).then(() => this.updateUIPositions());
	}

	/**
	 * Sets the visibility of modifiers.
	 * 
	 * @param visible - A boolean value indicating the visibility of the modifiers.
	 * @throws - No exceptions are thrown by this method.
	 */
	setModifiersVisible(visible: boolean) {
		[ this.modifierBar, this.enemyModifierBar ].map(m => m.setVisible(visible));
	}

	/**
	 * Updates the modifiers for the player or enemy.
	 * @param player Optional parameter to specify if the modifiers are for the player. Defaults to true.
	 * @param instant Optional parameter to specify if the update should be instant.
	 * @returns A Promise that resolves when the modifiers are updated.
	 * @throws {Error} If there is an error updating the modifiers.
	 */
	updateModifiers(player?: boolean, instant?: boolean): Promise<void> {
		if (player === undefined)
			player = true;
		return new Promise(resolve => {
			const modifiers = player ? this.modifiers : this.enemyModifiers as PersistentModifier[];
			for (let m = 0; m < modifiers.length; m++) {
				const modifier = modifiers[m];
				if (modifier instanceof PokemonHeldItemModifier && !this.getPokemonById((modifier as PokemonHeldItemModifier).pokemonId))
					modifiers.splice(m--, 1);
			}
			for (let modifier of modifiers) {
				if (modifier instanceof PersistentModifier)
					(modifier as PersistentModifier).virtualStackCount = 0;
			}

			const modifiersClone = modifiers.slice(0);
			for (let modifier of modifiersClone) {
				if (!modifier.getStackCount())
					modifiers.splice(modifiers.indexOf(modifier), 1);
			}

			this.updatePartyForModifiers(player ? this.getParty() : this.getEnemyParty(), instant).then(() => {
				(player ? this.modifierBar : this.enemyModifierBar).updateModifiers(modifiers);
				if (!player)
					this.updateUIPositions();
				resolve();
			});
		});
	}

	/**
	 * Updates party for modifiers.
	 * @param party - The array of Pokemon objects representing the party.
	 * @param instant - Optional parameter to indicate if the update should be instant.
	 * @returns A Promise that resolves to void.
	 * @throws Error if any of the asynchronous operations fail.
	 */
	updatePartyForModifiers(party: Pokemon[], instant?: boolean): Promise<void> {
		return new Promise(resolve => {
			Promise.allSettled(party.map(p => {
				if (p.scene)
					p.calculateStats();
				return p.updateInfo(instant);
			})).then(() => resolve());
		});
	}

	/**
	 * Removes the specified modifier from the list of modifiers.
	 * 
	 * @param modifier - The modifier to be removed.
	 * @param enemy - Optional parameter to indicate if the modifier belongs to an enemy. Default is false.
	 * @returns Returns true if the modifier is successfully removed, otherwise returns false.
	 * @throws {Error} Throws an error if the modifier is not found in the list of modifiers.
	 */
	removeModifier(modifier: PersistentModifier, enemy?: boolean): boolean {
		const modifiers = !enemy ? this.modifiers : this.enemyModifiers;
		const modifierIndex = modifiers.indexOf(modifier);
		if (modifierIndex > -1) {
			modifiers.splice(modifierIndex, 1);
			if (modifier instanceof PokemonFormChangeItemModifier || modifier instanceof TerastallizeModifier)
				modifier.apply([ this.getPokemonById(modifier.pokemonId), false ]);
			return true;
		}

		return false;
	}

	/**
	 * Retrieves the modifiers of a specific type for a player or enemy.
	 * @param modifierType The type of modifier to retrieve.
	 * @param player Indicates whether to retrieve the modifiers for the player (default is true).
	 * @returns An array of PersistentModifier objects that match the specified type.
	 * @throws {Error} If the specified modifierType is not a valid constructor.
	 */
	getModifiers(modifierType: { new(...args: any[]): Modifier }, player: boolean = true): PersistentModifier[] {
		return (player ? this.modifiers : this.enemyModifiers).filter(m => m instanceof modifierType);
	}

	/**
	 * Find modifiers based on the provided filter and player type.
	 * @param modifierFilter The filter function to apply on the modifiers.
	 * @param player Indicates whether to search in player's modifiers or enemy's modifiers.
	 * @returns An array of PersistentModifier objects that match the filter.
	 */
	findModifiers(modifierFilter: ModifierPredicate, player: boolean = true): PersistentModifier[] {
		return (player ? this.modifiers : this.enemyModifiers).filter(m => (modifierFilter as ModifierPredicate)(m));
	}

	/**
	 * Find modifier based on the provided filter and player type.
	 * @param modifierFilter The filter to apply for finding the modifier.
	 * @param player Indicates whether to search in player's modifiers or enemy's modifiers.
	 * @returns The persistent modifier that matches the filter.
	 */
	findModifier(modifierFilter: ModifierPredicate, player: boolean = true): PersistentModifier {
		return (player ? this.modifiers : this.enemyModifiers).find(m => (modifierFilter as ModifierPredicate)(m));
	}

	/**
	 * Apply shuffled modifiers to the battle scene.
	 * 
	 * @param scene The battle scene to apply the modifiers to.
	 * @param modifierType The type of modifier to apply.
	 * @param player Indicates whether the modifier is for the player or the enemy. Default is true.
	 * @param args Additional arguments for applying the modifiers.
	 * @returns An array of persistent modifiers applied to the scene.
	 * @throws {Error} Throws an error if there is an issue applying the modifiers.
	 */
	applyShuffledModifiers(scene: BattleScene, modifierType: { new(...args: any[]): Modifier }, player: boolean = true, ...args: any[]): PersistentModifier[] {
		let modifiers = (player ? this.modifiers : this.enemyModifiers).filter(m => m instanceof modifierType && m.shouldApply(args));
		scene.executeWithSeedOffset(() => {
			/**
			 * Shuffles the elements of an array.
			 * @param mods The array of elements to be shuffled.
			 * @returns The shuffled array of elements.
			 * @throws {Error} If mods is not an array.
			 * @throws {Error} If mods is an empty array.
			 * @throws {Error} If mods contains non-numeric elements.
			 */
			const shuffleModifiers = mods => {
				if (mods.length < 1)
					return mods;
				const rand = Math.floor(Utils.randSeedInt(mods.length));
				return [mods[rand], ...shuffleModifiers(mods.filter((_, i) => i !== rand))];
			};
			modifiers = shuffleModifiers(modifiers);
		}, scene.currentBattle.turn << 4, scene.waveSeed);
		return this.applyModifiersInternal(modifiers, player, args);
	}

	/**
	 * Apply modifiers to the player or enemy based on the provided modifier type and arguments.
	 * @param modifierType The type of modifier to apply.
	 * @param player Indicates whether the modifiers should be applied to the player (default: true).
	 * @param args Additional arguments to be passed to the modifiers.
	 * @throws {Error} If an error occurs during the application of modifiers.
	 * @returns An array of persistent modifiers applied to the player or enemy.
	 */
	applyModifiers(modifierType: { new(...args: any[]): Modifier }, player: boolean = true, ...args: any[]): PersistentModifier[] {
		const modifiers = (player ? this.modifiers : this.enemyModifiers).filter(m => m instanceof modifierType && m.shouldApply(args));
		return this.applyModifiersInternal(modifiers, player, args);
	}

	/**
	 * Apply modifiers internally to the given player or enemy.
	 * @param modifiers - The array of PersistentModifier objects to apply.
	 * @param player - A boolean value indicating whether the modifiers are being applied to the player (true) or the enemy (false).
	 * @param args - An array of any type of arguments to be used for applying the modifiers.
	 * @returns An array of PersistentModifier objects that have been successfully applied.
	 * @throws {Error} If there is an error while applying the modifiers.
	 */
	applyModifiersInternal(modifiers: PersistentModifier[], player: boolean, args: any[]): PersistentModifier[] {
		const appliedModifiers: PersistentModifier[] = [];
		for (let modifier of modifiers) {
			if (modifier.apply(args)) {
				console.log('Applied', modifier.type.name, !player ? '(enemy)' : '');
				appliedModifiers.push(modifier);
			}
		}

		return appliedModifiers;
	}

	/**
	 * Apply a modifier to the player or enemy.
	 * 
	 * @param modifierType The type of modifier to apply.
	 * @param player Whether the modifier should be applied to the player (default: true).
	 * @param args Additional arguments for applying the modifier.
	 * @returns The applied persistent modifier, or null if no modifier was applied.
	 * @throws {Error} If an error occurs during the application of the modifier.
	 */
	applyModifier(modifierType: { new(...args: any[]): Modifier }, player: boolean = true, ...args: any[]): PersistentModifier {
		const modifiers = (player ? this.modifiers : this.enemyModifiers).filter(m => m instanceof modifierType && m.shouldApply(args));
		for (let modifier of modifiers) {
			if (modifier.apply(args)) {
				console.log('Applied', modifier.type.name, !player ? '(enemy)' : '');
				return modifier;
			}
		}

		return null;
	}

	/**
	 * Triggers a Pokemon form change based on the specified trigger type.
	 * @param pokemon The Pokemon to trigger the form change for.
	 * @param formChangeTriggerType The type of trigger for the form change.
	 * @param delayed Whether the form change should be delayed.
	 * @param modal Whether the form change should be modal.
	 * @throws {Error} If the form change trigger type is not found or if the form change cannot be executed.
	 * @returns {boolean} Returns true if the form change was triggered successfully, otherwise false.
	 */
	triggerPokemonFormChange(pokemon: Pokemon, formChangeTriggerType: { new(...args: any[]): SpeciesFormChangeTrigger }, delayed: boolean = false, modal: boolean = false): boolean {
		if (pokemonFormChanges.hasOwnProperty(pokemon.species.speciesId)) {
			const matchingFormChange = pokemonFormChanges[pokemon.species.speciesId].find(fc => fc.findTrigger(formChangeTriggerType) && fc.canChange(pokemon));
			if (matchingFormChange) {
				let phase: Phase;
				if (pokemon instanceof PlayerPokemon && !matchingFormChange.quiet)
					phase = new FormChangePhase(this, pokemon, matchingFormChange, modal);
				else
					phase = new QuietFormChangePhase(this, pokemon, matchingFormChange);
				if (pokemon instanceof PlayerPokemon && !matchingFormChange.quiet && modal)
					this.overridePhase(phase);
				else if (delayed)
					this.pushPhase(phase);
				else
					this.unshiftPhase(phase);
				return true;
			}
		}

		return false;
	}

	/**
	 * Validates the achievement type and its arguments.
	 * 
	 * @param achvType The type of achievement to validate.
	 * @param args The arguments to validate.
	 * @throws {Error} If there is an issue validating the achievement type or its arguments.
	 */
	validateAchvs(achvType: { new(...args: any[]): Achv }, ...args: any[]): void {
		const filteredAchvs = Object.values(achvs).filter(a => a instanceof achvType);
		for (let achv of filteredAchvs)
			this.validateAchv(achv, args);
	}

	/**
	 * Validates the achievement and unlocks it if the validation is successful.
	 * @param achv The achievement to validate.
	 * @param args Optional arguments for validation.
	 * @returns Returns true if the achievement is successfully validated and unlocked, otherwise returns false.
	 * @throws Throws an error if the validation fails.
	 */
	validateAchv(achv: Achv, args?: any[]): boolean {
		if (!this.gameData.achvUnlocks.hasOwnProperty(achv.id) && achv.validate(this, args)) {
			this.gameData.achvUnlocks[achv.id] = new Date().getTime();
			this.ui.achvBar.showAchv(achv);
			if (vouchers.hasOwnProperty(achv.id))
				this.validateVoucher(vouchers[achv.id]);
			return true;
		}

		return false;
	}

	/**
	 * Validates the voucher and performs necessary actions if the voucher is valid.
	 * @param voucher - The voucher to be validated.
	 * @param args - Optional arguments for voucher validation.
	 * @returns A boolean indicating whether the voucher is valid.
	 * @throws Error - If the voucher validation fails or if any of the called functions throw an error.
	 */
	validateVoucher(voucher: Voucher, args?: any[]): boolean {
		if (!this.gameData.voucherUnlocks.hasOwnProperty(voucher.id) && voucher.validate(this, args)) {
			this.gameData.voucherUnlocks[voucher.id] = new Date().getTime();
			this.ui.achvBar.showAchv(voucher);
			this.gameData.voucherCounts[voucher.voucherType]++;
			return true;
		}

		return false;
	}
	
	/**
	 * Update the game information and store it in the window object.
	 * @throws {Error} If any error occurs during the update process.
	 */
	updateGameInfo(): void {
		const gameInfo = {
			playTime: this.sessionPlayTime ? this.sessionPlayTime : 0,
			gameMode: this.currentBattle ? this.gameMode.getName() : 'Title',
			biome: this.currentBattle ? getBiomeName(this.arena.biomeType) : '',
			wave: this.currentBattle?.waveIndex || 0,
			party: this.party ? this.party.map(p => {
				return { name: p.name, level: p.level };
			}) : []
		};
		(window as any).gameInfo = gameInfo;
	}
}