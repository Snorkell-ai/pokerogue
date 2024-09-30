export const legacyCompatibleImages: string[] = [];

export class SceneBase extends Phaser.Scene {
  constructor(config?: string | Phaser.Types.Scenes.SettingsConfig) {
    super(config);
  }

	/**
	 * Retrieves the cached URL for the given input URL.
	 * @param url The input URL to retrieve the cached URL for.
	 * @returns The cached URL for the input URL.
	 * @throws If an error occurs while retrieving the cached URL.
	 */
	getCachedUrl(url: string): string {
		const manifest = this.game['manifest'];
		if (manifest) {
			const timestamp = manifest[`/${url}`];
			if (timestamp)
				url += `?t=${timestamp}`;
		}
		return url;
	}

  /**
   * Loads an image with the specified key and from the specified folder and filename.
   * If the filename is not provided, it defaults to `${key}.png`.
   * 
   * @param key - The key to use for the loaded image.
   * @param folder - The folder from which to load the image.
   * @param filename - (Optional) The filename of the image to load.
   * 
   * @throws {Error} If the specified key or folder is invalid.
   */
  loadImage(key: string, folder: string, filename?: string) {
		if (!filename)
			filename = `${key}.png`;
		this.load.image(key, this.getCachedUrl(`images/${folder}/${filename}`));
		if (folder.startsWith('ui')) {
			legacyCompatibleImages.push(key);
			folder = folder.replace('ui', 'ui/legacy');
			this.load.image(`${key}_legacy`, this.getCachedUrl(`images/${folder}/${filename}`));
		}
	}

  /**
   * Load a spritesheet for a given key and folder.
   * @param key The key for the spritesheet.
   * @param folder The folder where the spritesheet is located.
   * @param size The size of the spritesheet.
   * @param filename Optional filename for the spritesheet. If not provided, defaults to `${key}.png`.
   * @throws Error if the spritesheet loading fails.
   */
  loadSpritesheet(key: string, folder: string, size: integer, filename?: string) {
		if (!filename)
			filename = `${key}.png`;
		this.load.spritesheet(key, this.getCachedUrl(`images/${folder}/${filename}`), { frameWidth: size, frameHeight: size });
		if (folder.startsWith('ui')) {
			legacyCompatibleImages.push(key);
			folder = folder.replace('ui', 'ui/legacy');
			this.load.spritesheet(`${key}_legacy`, this.getCachedUrl(`images/${folder}/${filename}`), { frameWidth: size, frameHeight: size });
		}
	}

	/**
	 * Load an atlas for a given key, folder, and optional filename root.
	 * @param key - The key for the atlas.
	 * @param folder - The folder where the atlas is located.
	 * @param filenameRoot - Optional filename root for the atlas.
	 * @throws {Error} - If key or folder is not provided.
	 */
	loadAtlas(key: string, folder: string, filenameRoot?: string) {
		if (!filenameRoot)
			filenameRoot = key;
		if (folder)
			folder += '/';
		this.load.atlas(key, this.getCachedUrl(`images/${folder}${filenameRoot}.png`), this.getCachedUrl(`images/${folder}/${filenameRoot}.json`));
		if (folder.startsWith('ui')) {
			legacyCompatibleImages.push(key);
			folder = folder.replace('ui', 'ui/legacy');
			this.load.atlas(`${key}_legacy`, this.getCachedUrl(`images/${folder}${filenameRoot}.png`), this.getCachedUrl(`images/${folder}/${filenameRoot}.json`));
		}
	}

	/**
	 * Load sound effects into the game.
	 * @param key - The key to use for the loaded sound effect.
	 * @param folder - The folder in which the sound effect is located. (Optional)
	 * @param filenames - The name of the sound effect file(s) to load. Can be a string or an array of strings. (Optional)
	 * @throws {Error} If the filenames parameter is not provided and key is not a valid string.
	 * @throws {Error} If an error occurs while loading the sound effect.
	 */
	loadSe(key: string, folder?: string, filenames?: string | string[]) {
		if (!filenames)
			filenames = `${key}.wav`;
		if (!folder)
			folder = '';
		else
			folder += '/';
		if (!Array.isArray(filenames))
			filenames = [ filenames ];
		for (let f of filenames as string[])
			this.load.audio(key, this.getCachedUrl(`audio/se/${folder}${f}`));
	}

	/**
	 * Load background music with the specified key and filename.
	 * @param key The key to identify the background music.
	 * @param filename The filename of the background music. If not provided, the default filename will be used.
	 * @throws Error if the audio loading fails.
	 */
	loadBgm(key: string, filename?: string) {
		if (!filename)
			filename = `${key}.mp3`;
		this.load.audio(key, this.getCachedUrl(`audio/bgm/${filename}`));
	}
}