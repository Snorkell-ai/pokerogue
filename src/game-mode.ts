import { fixedBattles } from "./battle";
import BattleScene from "./battle-scene";
import { Biome } from "./data/enums/biome";
import { Species } from "./data/enums/species";
import PokemonSpecies, { allSpecies } from "./data/pokemon-species";
import { Arena } from "./field/arena";
import * as Utils from "./utils";
import * as Overrides from './overrides';

export enum GameModes {
  CLASSIC,
  ENDLESS,
  SPLICED_ENDLESS,
  DAILY
}

interface GameModeConfig {
  isClassic?: boolean;
  isEndless?: boolean;
  isDaily?: boolean;
  hasTrainers?: boolean;
  hasFixedBattles?: boolean;
  hasNoShop?: boolean;
  hasShortBiomes?: boolean;
  hasRandomBiomes?: boolean;
  hasRandomBosses?: boolean;
  isSplicedOnly?: boolean;
}

export class GameMode implements GameModeConfig {
  public modeId: GameModes;
  public isClassic: boolean;
  public isEndless: boolean;
  public isDaily: boolean;
  public hasTrainers: boolean;
  public hasFixedBattles: boolean;
  public hasNoShop: boolean;
  public hasShortBiomes: boolean;
  public hasRandomBiomes: boolean;
  public hasRandomBosses: boolean;
  public isSplicedOnly: boolean;

  constructor(modeId: GameModes, config: GameModeConfig) {
    this.modeId = modeId;
    Object.assign(this, config);
  }

  /**
   * Returns the starting level based on the game mode.
   * - If there is an override from overrides.ts, it returns the overridden value.
   * - If the game mode is Daily Runs, it returns 20.
   * - For all other modes, it returns 5.
   * @throws {Error} If there is an issue with retrieving the starting level.
   */
  getStartingLevel(): integer {
    if (Overrides.STARTING_LEVEL_OVERRIDE)
      return Overrides.STARTING_LEVEL_OVERRIDE;
    switch (this.modeId) {
      case GameModes.DAILY:
        return 20;
      default:
        return 5;
    }
  }

  /**
   * Retrieves the starting money value.
   * @returns either:
   * - override from overrides.ts
   * - 1000
   * @throws {Error} If the starting money override is not available.
   */
  getStartingMoney(): integer {
    return Overrides.STARTING_MONEY_OVERRIDE || 1000;
  }

  /**
   * Retrieves the starting biome based on the current BattleScene.
   * @param scene The current BattleScene.
   * @returns The starting biome, which can be:
   * - A random biome for Daily mode.
   * - An override from overrides.ts.
   * - The Town biome.
   * @throws None
   */
  getStartingBiome(scene: BattleScene): Biome {
    switch (this.modeId) {
      case GameModes.DAILY:
        return scene.generateRandomBiome(this.getWaveForDifficulty(1));
      default:
        return Overrides.STARTING_BIOME_OVERRIDE || Biome.TOWN;
    }
  }

  /**
   * Get the wave number for the given difficulty level.
   * @param waveIndex The index of the wave.
   * @param ignoreCurveChanges Whether to ignore curve changes.
   * @returns The wave number for the given difficulty level.
   * @throws None
   */
  getWaveForDifficulty(waveIndex: integer, ignoreCurveChanges: boolean = false): integer {
    switch (this.modeId) {
      case GameModes.DAILY:
        return waveIndex + 30 + (!ignoreCurveChanges ? Math.floor(waveIndex / 5) : 0);
      default:
        return waveIndex;
    }
  }

  /**
   * Checks if the given wave is a wave trainer.
   * @param waveIndex The index of the wave.
   * @param arena The arena object.
   * @returns Returns true if the wave is a wave trainer, otherwise false.
   * @throws None
   */
  isWaveTrainer(waveIndex: integer, arena: Arena): boolean {
    if (this.isDaily)
      return waveIndex % 10 === 5 || (!(waveIndex % 10) && waveIndex > 10 && !this.isWaveFinal(waveIndex));
    if ((waveIndex % 30) === (arena.scene.offsetGym ? 0 : 20) && !this.isWaveFinal(waveIndex))
      return true;
    else if (waveIndex % 10 !== 1 && waveIndex % 10) {
      const trainerChance = arena.getTrainerChance();
      let allowTrainerBattle = true;
      if (trainerChance) {
        const waveBase = Math.floor(waveIndex / 10) * 10;
        for (let w = Math.max(waveIndex - 3, waveBase + 2); w <= Math.min(waveIndex + 3, waveBase + 9); w++) {
          if (w === waveIndex)
            continue;
          if ((w % 30) === (arena.scene.offsetGym ? 0 : 20) || fixedBattles.hasOwnProperty(w)) {
            allowTrainerBattle = false;
            break;
          } else if (w < waveIndex) {
            arena.scene.executeWithSeedOffset(() => {
              const waveTrainerChance = arena.getTrainerChance();
              if (!Utils.randSeedInt(waveTrainerChance))
                allowTrainerBattle = false;
            }, w);
            if (!allowTrainerBattle)
              break;
          }
        }
      }
      return allowTrainerBattle && trainerChance && !Utils.randSeedInt(trainerChance);
    }
    return false;
  }
  
  /**
   * Check if the trainer is a boss in the given wave and biome.
   * @param waveIndex The index of the wave.
   * @param biomeType The type of biome.
   * @param offsetGym Whether the gym is offset.
   * @returns A boolean indicating whether the trainer is a boss.
   * @throws None
   */
  isTrainerBoss(waveIndex: integer, biomeType: Biome, offsetGym: boolean): boolean {
    switch (this.modeId) {
      case GameModes.DAILY:
        return waveIndex > 10 && waveIndex < 50 && !(waveIndex % 10);
      default:
        return (waveIndex % 30) === (offsetGym ? 0 : 20) && (biomeType !== Biome.END || this.isClassic || this.isWaveFinal(waveIndex));
    }
  }

  /**
   * Retrieves the override Pokemon species for a given wave index.
   * @param waveIndex The index of the wave.
   * @returns The PokemonSpecies object representing the override species, or null if no override species is found.
   * @throws {Error} If an error occurs while retrieving the override species.
   */
  getOverrideSpecies(waveIndex: integer): PokemonSpecies {
    if (this.isDaily && this.isWaveFinal(waveIndex)) {
      const allFinalBossSpecies = allSpecies.filter(s => (s.subLegendary || s.legendary || s.mythical)
        && s.baseTotal >= 600 && s.speciesId !== Species.ETERNATUS && s.speciesId !== Species.ARCEUS);
      return Utils.randSeedItem(allFinalBossSpecies);
    }

    return null;
  }

  /**
   * Check if the wave is final based on the wave index.
   * @param waveIndex The index of the wave to be checked.
   * @returns A boolean value indicating whether the wave is final or not.
   * @throws None
   */
  isWaveFinal(waveIndex: integer): boolean {
    switch (this.modeId) {
      case GameModes.CLASSIC:
        return waveIndex === 200;
      case GameModes.ENDLESS:
      case GameModes.SPLICED_ENDLESS:
        return !(waveIndex % 250);
      case GameModes.DAILY:
        return waveIndex === 50;
    }
  }

  /**
   * Retrieves the clear score bonus based on the game mode.
   * @returns {number} The clear score bonus.
   * @throws {Error} If the modeId is not recognized.
   */
  getClearScoreBonus(): integer {
    switch (this.modeId) {
      case GameModes.CLASSIC:
        return 5000;
      case GameModes.DAILY:
        return 2500;
    }
  }

  /**
   * Get the enemy modifier chance based on the game mode and boss status.
   * @param isBoss - A boolean indicating whether the enemy is a boss.
   * @returns An integer representing the enemy modifier chance.
   * @throws If the game mode is not recognized.
   */
  getEnemyModifierChance(isBoss: boolean): integer {
    switch (this.modeId) {
      case GameModes.CLASSIC:
      case GameModes.DAILY:
        return !isBoss ? 18 : 6;
      case GameModes.ENDLESS:
      case GameModes.SPLICED_ENDLESS:
        return !isBoss ? 12 : 4;
    }
  }

  /**
   * Returns the name of the game mode based on the modeId.
   * @returns {string} The name of the game mode.
   * @throws {Error} If the modeId is not recognized.
   */
  getName(): string {
    switch (this.modeId) {
      case GameModes.CLASSIC:
        return 'Classic';
      case GameModes.ENDLESS:
        return 'Endless';
      case GameModes.SPLICED_ENDLESS:
        return 'Endless (Spliced)';
      case GameModes.DAILY:
        return 'Daily Run';
    }
  }
}

export const gameModes = Object.freeze({
  [GameModes.CLASSIC]: new GameMode(GameModes.CLASSIC, { isClassic: true, hasTrainers: true, hasFixedBattles: true }),
  [GameModes.ENDLESS]: new GameMode(GameModes.ENDLESS, { isEndless: true, hasShortBiomes: true, hasRandomBosses: true }),
  [GameModes.SPLICED_ENDLESS]: new GameMode(GameModes.SPLICED_ENDLESS, { isEndless: true, hasShortBiomes: true, hasRandomBosses: true, isSplicedOnly: true }),
  [GameModes.DAILY]: new GameMode(GameModes.DAILY, { isDaily: true, hasTrainers: true, hasNoShop: true })
});