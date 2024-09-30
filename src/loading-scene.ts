import { GachaType } from "./data/egg";
import { Biome } from "./data/enums/biome";
import { TrainerType } from "./data/enums/trainer-type";
import { trainerConfigs } from "./data/trainer-config";
import { getBiomeHasProps } from "./field/arena";
import CacheBustedLoaderPlugin from "./plugins/cache-busted-loader-plugin";
import { SceneBase } from "./scene-base";
import { WindowVariant, getWindowVariantSuffix } from "./ui/ui-theme";
import { isMobile } from "./touch-controls";
import * as Utils from "./utils";
import { initI18n } from "./plugins/i18n";

export class LoadingScene extends SceneBase {
  constructor() {
    super('loading');

    Phaser.Plugins.PluginCache.register('Loader', CacheBustedLoaderPlugin, 'load');
    initI18n();
  }

  preload() {
    this.load['manifest'] = this.game['manifest'];

    if (!isMobile())
      this.load.video('intro_dark', 'images/intro_dark.mp4', true);

    this.loadImage('loading_bg', 'arenas');
    this.loadImage('logo', '');

    // Load menu images
    this.loadAtlas('bg', 'ui');
    this.loadImage('command_fight_labels', 'ui');
    this.loadAtlas('prompt', 'ui');
    this.loadImage('candy', 'ui');
    this.loadImage('candy_overlay', 'ui');
    this.loadImage('cursor', 'ui');
    this.loadImage('cursor_reverse', 'ui');
    for (let wv of Utils.getEnumValues(WindowVariant)) {
      for (let w = 1; w <= 5; w++)
        this.loadImage(`window_${w}${getWindowVariantSuffix(wv)}`, 'ui/windows');
    }
    this.loadAtlas('namebox', 'ui');
    this.loadImage('pbinfo_player', 'ui');
    this.loadImage('pbinfo_player_stats', 'ui');
    this.loadImage('pbinfo_player_mini', 'ui');
    this.loadImage('pbinfo_player_mini_stats', 'ui');
    this.loadAtlas('pbinfo_player_type', 'ui');
    this.loadAtlas('pbinfo_player_type1', 'ui');
    this.loadAtlas('pbinfo_player_type2', 'ui');
    this.loadImage('pbinfo_enemy_mini', 'ui');
    this.loadImage('pbinfo_enemy_mini_stats', 'ui');
    this.loadImage('pbinfo_enemy_boss', 'ui');
    this.loadImage('pbinfo_enemy_boss_stats', 'ui');
    this.loadAtlas('pbinfo_enemy_type', 'ui');
    this.loadAtlas('pbinfo_enemy_type1', 'ui');
    this.loadAtlas('pbinfo_enemy_type2', 'ui');
    this.loadAtlas('pbinfo_stat', 'ui');
    this.loadAtlas('pbinfo_stat_numbers', 'ui');
    this.loadImage('overlay_lv', 'ui');
    this.loadAtlas('numbers', 'ui');
    this.loadAtlas('numbers_red', 'ui');
    this.loadAtlas('overlay_hp', 'ui');
    this.loadAtlas('overlay_hp_boss', 'ui');
    this.loadImage('overlay_exp', 'ui');
    this.loadImage('icon_owned', 'ui');
    this.loadImage('ability_bar_left', 'ui');
    this.loadImage('party_exp_bar', 'ui');
    this.loadImage('achv_bar', 'ui');
    this.loadImage('achv_bar_2', 'ui');
    this.loadImage('achv_bar_3', 'ui');
    this.loadImage('achv_bar_4', 'ui');
    this.loadImage('achv_bar_5', 'ui');
    this.loadImage('shiny_star', 'ui', 'shiny.png');
    this.loadImage('shiny_star_1', 'ui', 'shiny_1.png');
    this.loadImage('shiny_star_2', 'ui', 'shiny_2.png');
    this.loadImage('shiny_star_small', 'ui', 'shiny_small.png');
    this.loadImage('shiny_star_small_1', 'ui', 'shiny_small_1.png');
    this.loadImage('shiny_star_small_2', 'ui', 'shiny_small_2.png');
    this.loadImage('ha_capsule', 'ui', 'ha_capsule.png');
    this.loadImage('champion_ribbon', 'ui', 'champion_ribbon.png');
    this.loadImage('icon_spliced', 'ui');
    this.loadImage('icon_tera', 'ui');
    this.loadImage('type_tera', 'ui');
    this.loadAtlas('type_bgs', 'ui');

    this.loadImage('pb_tray_overlay_player', 'ui');
    this.loadImage('pb_tray_overlay_enemy', 'ui');
    this.loadAtlas('pb_tray_ball', 'ui');

    this.loadImage('party_bg', 'ui');
    this.loadImage('party_bg_double', 'ui');
    this.loadAtlas('party_slot_main', 'ui');
    this.loadAtlas('party_slot', 'ui');
    this.loadImage('party_slot_overlay_lv', 'ui');
    this.loadImage('party_slot_hp_bar', 'ui');
    this.loadAtlas('party_slot_hp_overlay', 'ui');
    this.loadAtlas('party_pb', 'ui');
    this.loadAtlas('party_cancel', 'ui');

    this.loadImage('summary_bg', 'ui');
    this.loadImage('summary_overlay_shiny', 'ui');
    this.loadImage('summary_profile', 'ui');
    this.loadImage('summary_profile_prompt_z', 'ui')      // The pixel Z button prompt
    this.loadImage('summary_profile_prompt_a', 'ui');     // The pixel A button prompt
    this.loadImage('summary_profile_ability', 'ui');      // Pixel text 'ABILITY'
    this.loadImage('summary_profile_passive', 'ui');      // Pixel text 'PASSIVE'
    this.loadImage('summary_status', 'ui');
    this.loadImage('summary_stats', 'ui');
    this.loadImage('summary_stats_overlay_exp', 'ui');
    this.loadImage('summary_moves', 'ui');
    this.loadImage('summary_moves_effect', 'ui');
    this.loadImage('summary_moves_overlay_row', 'ui');
    this.loadImage('summary_moves_overlay_pp', 'ui');
    this.loadAtlas('summary_moves_cursor', 'ui');
    for (let t = 1; t <= 3; t++)
      this.loadImage(`summary_tabs_${t}`, 'ui');

    this.loadImage('starter_select_bg', 'ui');
    this.loadImage('select_cursor', 'ui');
    this.loadImage('select_cursor_highlight', 'ui');
    this.loadImage('select_cursor_highlight_thick', 'ui');
    this.loadImage('select_cursor_pokerus', 'ui');
    this.loadImage('select_gen_cursor', 'ui');
    this.loadImage('select_gen_cursor_highlight', 'ui');

    this.loadImage('saving_icon', 'ui');

    this.loadImage('default_bg', 'arenas');
    // Load arena images
    Utils.getEnumValues(Biome).map(bt => {
      const btKey = Biome[bt].toLowerCase();
      const isBaseAnimated = btKey === 'end';
      const baseAKey = `${btKey}_a`;
      const baseBKey = `${btKey}_b`;
      this.loadImage(`${btKey}_bg`, 'arenas');
      if (!isBaseAnimated)
        this.loadImage(baseAKey, 'arenas');
      else
        this.loadAtlas(baseAKey, 'arenas');
      if (!isBaseAnimated)
        this.loadImage(baseBKey, 'arenas');
      else
        this.loadAtlas(baseBKey, 'arenas');
      if (getBiomeHasProps(bt)) {
        for (let p = 1; p <= 3; p++) {
          const isPropAnimated = p === 3 && [ 'power_plant', 'end' ].find(b => b === btKey);
          const propKey = `${btKey}_b_${p}`;
          if (!isPropAnimated)
            this.loadImage(propKey, 'arenas');
          else
            this.loadAtlas(propKey, 'arenas');
        }
      }
    });

    // Load bitmap fonts
    this.load.bitmapFont('item-count', 'fonts/item-count.png', 'fonts/item-count.xml');

    // Load trainer images
    this.loadAtlas('trainer_m_back', 'trainer');
    this.loadAtlas('trainer_m_back_pb', 'trainer');
    this.loadAtlas('trainer_f_back', 'trainer');
    this.loadAtlas('trainer_f_back_pb', 'trainer');

    Utils.getEnumValues(TrainerType).map(tt => {
      const config = trainerConfigs[tt];
      this.loadAtlas(config.getSpriteKey(), 'trainer');
      if (config.doubleOnly || config.hasDouble)
        this.loadAtlas(config.getSpriteKey(true), 'trainer');
    });

    // Load character sprites
    this.loadAtlas('c_rival_m', 'character', 'rival_m');
    this.loadAtlas('c_rival_f', 'character', 'rival_f');

    // Load pokemon-related images
    this.loadImage(`pkmn__back__sub`, 'pokemon/back', 'sub.png');
    this.loadImage(`pkmn__sub`, 'pokemon', 'sub.png');
    this.loadAtlas('battle_stats', 'effects');
    this.loadAtlas('shiny', 'effects');
    this.loadAtlas('shiny_2', 'effects');
    this.loadAtlas('shiny_3', 'effects');
    this.loadImage('tera', 'effects');
    this.loadAtlas('pb_particles', 'effects');
    this.loadImage('evo_sparkle', 'effects');
    this.loadAtlas('tera_sparkle', 'effects');
    this.load.video('evo_bg', 'images/effects/evo_bg.mp4', true);

    this.loadAtlas('pb', '');
    this.loadAtlas('items', '');
    this.loadAtlas('types', '');
    this.loadAtlas('statuses', '');
    this.loadAtlas('categories', '');
    
    this.loadAtlas('egg', 'egg');
    this.loadAtlas('egg_crack', 'egg');
    this.loadAtlas('egg_icons', 'egg');
    this.loadAtlas('egg_shard', 'egg');
    this.loadAtlas('egg_lightrays', 'egg');
    Utils.getEnumKeys(GachaType).forEach(gt => {
      const key = gt.toLowerCase();
      this.loadImage(`gacha_${key}`, 'egg');
      this.loadAtlas(`gacha_underlay_${key}`, 'egg');
    });
    this.loadImage('gacha_glass', 'egg');
    this.loadImage('gacha_eggs', 'egg');
    this.loadAtlas('gacha_hatch', 'egg');
    this.loadImage('gacha_knob', 'egg');

    this.loadImage('egg_list_bg', 'ui');

    this.loadImage('end_m', 'cg');
    this.loadImage('end_f', 'cg');

    for (let i = 0; i < 10; i++) {
      this.loadAtlas(`pokemon_icons_${i}`, '');
      if (i)
        this.loadAtlas(`pokemon_icons_${i}v`, '');
    }

    this.loadSe('select');
    this.loadSe('menu_open');
    this.loadSe('hit');
    this.loadSe('hit_strong');
    this.loadSe('hit_weak');
    this.loadSe('stat_up');
    this.loadSe('stat_down');
    this.loadSe('faint');
    this.loadSe('flee');
    this.loadSe('low_hp');
    this.loadSe('exp');
    this.loadSe('level_up');
    this.loadSe('sparkle');
    this.loadSe('restore');
    this.loadSe('shine');
    this.loadSe('shing');
    this.loadSe('charge');
    this.loadSe('beam');
    this.loadSe('upgrade');
    this.loadSe('buy');
    this.loadSe('achv');
    this.loadSe('error');

    this.loadSe('pb_rel');
    this.loadSe('pb_throw');
    this.loadSe('pb_bounce_1');
    this.loadSe('pb_bounce_2');
    this.loadSe('pb_move');
    this.loadSe('pb_catch');
    this.loadSe('pb_lock');

    this.loadSe('pb_tray_enter');
    this.loadSe('pb_tray_ball');
    this.loadSe('pb_tray_empty');

    this.loadSe('egg_crack');
    this.loadSe('egg_hatch');
    this.loadSe('gacha_dial');
    this.loadSe('gacha_running');
    this.loadSe('gacha_dispense');

    this.loadSe('PRSFX- Transform', 'battle_anims');

    this.loadBgm('menu');

    this.loadBgm('level_up_fanfare', 'bw/level_up_fanfare.mp3');
    this.loadBgm('item_fanfare', 'bw/item_fanfare.mp3');
    this.loadBgm('minor_fanfare', 'bw/minor_fanfare.mp3');
    this.loadBgm('heal', 'bw/heal.mp3');
    this.loadBgm('victory_trainer', 'bw/victory_trainer.mp3');
    this.loadBgm('victory_gym', 'bw/victory_gym.mp3');
    this.loadBgm('victory_champion', 'bw/victory_champion.mp3');
    this.loadBgm('evolution', 'bw/evolution.mp3');
    this.loadBgm('evolution_fanfare', 'bw/evolution_fanfare.mp3');

    this.load.plugin('rextexteditplugin', 'https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rextexteditplugin.min.js', true);

    this.loadLoadingScreen();
  }

  /**
   * Initializes and displays a loading screen with graphical elements,
   * including a progress bar, loading percentage text, and asset details.
   * This function sets up event listeners for loading progress and asset
   * loading events, updating the UI accordingly.
   *
   * @returns {void} 
   *
   * @throws {Error} Throws an error if there is an issue with loading assets.
   *
   * @example
   * // Call this method to load the loading screen when initializing the scene.
   * this.loadLoadingScreen();
   */
  loadLoadingScreen() {
    /**
     * Initializes a basic graphic element with specified styles.
     *
     * This helper function creates a graphics object, applies a line style 
     * with the given thickness and color, and optionally applies a fill style 
     * if a fill color is provided.
     *
     * @param {number} lineThickness - The thickness of the line to be drawn.
     * @param {number} lineColor - The color of the line, represented as a hexadecimal value.
     * @param {number|null} [fillColor=null] - The color to fill the graphic, represented as a hexadecimal value. 
     *                                          If not provided, the graphic will not be filled.
     * @returns {Graphics} The initialized graphics object with the applied styles.
     *
     * @throws {Error} Throws an error if the lineThickness is less than or equal to zero.
     *
     * @example
     * const graphic = initGraphic(2, 0xff0000, 0x00ff00);
     * // This creates a graphic with a red line of thickness 2 and a green fill.
     */
    // Helper function to initialize basic graphic elements with style
    const initGraphic = (lineThickness, lineColor, fillColor = null) => {
        const graphic = this.add.graphics();
        graphic.lineStyle(lineThickness, lineColor, 1);
        if (fillColor !== null) {
            graphic.fillStyle(fillColor, 0.8);
        }
        return graphic;
    };

    /**
     * Creates a text element with specified properties.
     *
     * This helper function generates a text object positioned at the center of the screen
     * horizontally and at a specified vertical position. The text is styled with a specific
     * font size and color.
     *
     * @param {string} text - The text content to be displayed.
     * @param {number} fontSize - The size of the font in pixels.
     * @param {number} yPos - The vertical position (Y-coordinate) for the text element.
     * @returns {Phaser.GameObjects.Text} The created text object.
     *
     * @throws {Error} Throws an error if the fontSize is not a positive number.
     *
     * @example
     * const myText = createText("Hello World", 24, 100);
     * // This will create a text element saying "Hello World" with a font size of 24px
     * // positioned at Y-coordinate 100.
     */
    // Helper function to create text elements
    const createText = (text, fontSize, yPos) => {
        return this.make.text({
            x: this.cameras.main.width / 2,
            y: yPos,
            text: text,
            style: {
                font: `${fontSize}px emerald`,
                color: "#ffffff",
            },
        }).setOrigin(0.5, 0.5);
    };

    // Check if the device is mobile
    const mobile = isMobile();

    // Basic scene elements container
    const loadingGraphics = [];

    // Background image configuration
    const bg = this.add.image(0, 0, '').setOrigin(0, 0).setScale(6).setVisible(false);

    // Progress bar and box setup
    const progressBar = initGraphic(4, 0xffffff);
    const progressBox = initGraphic(5, 0xff00ff, 0x222222);

    // Text displays for loading percentage and asset details
    const percentText = createText('0%', 72, this.cameras.main.height / 2 - 24);
    const assetText = createText("", 48, this.cameras.main.height / 2 + 48);

    // Intro video configuration
    const intro = this.add.video(0, 0).setOrigin(0, 0).setScale(3);

    // Listen to loading progress to update UI
    this.load.on("progress", (value) => {
        const parsedValue = parseFloat(value);
        percentText.setText(`${Math.floor(parsedValue * 100)}%`);
        progressBar.clear().fillStyle(0xffffff, 0.8).fillRect(
            this.cameras.main.width / 2 - 320, 360, 640 * parsedValue, 64
        );
    });

    // Update current loading asset text
    this.load.on("fileprogress", file => {
        assetText.setText(`Loading asset: ${file.key}`);
    });

    // Add elements to the graphics array for group manipulation
    loadingGraphics.push(bg, progressBar, progressBox, percentText, assetText);

    // Show or hide loading graphics based on device type
    if (!mobile) {
        loadingGraphics.forEach(g => g.setVisible(false));
    }

    // Manage specific asset loads with actions
    this.load.on('filecomplete', key => {
        switch (key) {
            case 'intro_dark':
                intro.load('intro_dark').on('complete', () => {
                    loadingGraphics.forEach(g => g.setVisible(true));
                    this.tweens.add({
                        targets: intro,
                        duration: 500,
                        alpha: 0,
                        ease: 'Sine.easeIn'
                    });
                });
                intro.play();
                break;
            case 'loading_bg':
                bg.setTexture('loading_bg').setVisible(mobile);
                break;
            case 'logo':
                logo.setTexture('logo').setVisible(mobile);
                break;
        }
    });

    // Cleanup assets once loading is complete
    this.load.on("complete", () => {
        intro.destroy();
        loadingGraphics.forEach(g => g.destroy());
    });
}


  get gameHeight() {
    return this.game.config.height as number;
  }

  get gameWidth() {
    return this.game.config.width as number;
  }

  async create() {
    this.scene.start("battle");
  }
}
