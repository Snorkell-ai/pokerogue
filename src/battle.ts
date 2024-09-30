import BattleScene from "./battle-scene";
import { EnemyPokemon, PlayerPokemon, QueuedMove } from "./field/pokemon";
import { Command } from "./ui/command-ui-handler";
import * as Utils from "./utils";
import Trainer, { TrainerVariant } from "./field/trainer";
import { Species } from "./data/enums/species";
import { Moves } from "./data/enums/moves";
import { TrainerType } from "./data/enums/trainer-type";
import { GameMode } from "./game-mode";
import { BattleSpec } from "./enums/battle-spec";
import { PlayerGender } from "./system/game-data";
import { MoneyMultiplierModifier, PokemonHeldItemModifier } from "./modifier/modifier";
import { MoneyAchv } from "./system/achv";

export enum BattleType {
    WILD,
    TRAINER,
    CLEAR
}

export enum BattlerIndex {
    ATTACKER = -1,
    PLAYER,
    PLAYER_2,
    ENEMY,
    ENEMY_2
}

export interface TurnCommand {
    command: Command;
    cursor?: integer;
    move?: QueuedMove;
    targets?: BattlerIndex[];
    skip?: boolean;
    args?: any[];
};

interface TurnCommands {
    [key: integer]: TurnCommand
}

export default class Battle {
    protected gameMode: GameMode;
    public waveIndex: integer;
    public battleType: BattleType;
    public battleSpec: BattleSpec;
    public trainer: Trainer;
    public enemyLevels: integer[];
    public enemyParty: EnemyPokemon[];
    public seenEnemyPartyMemberIds: Set<integer>;
    public double: boolean;
    public started: boolean;
    public enemySwitchCounter: integer;
    public turn: integer;
    public turnCommands: TurnCommands;
    public playerParticipantIds: Set<integer>;
    public battleScore: integer;
    public postBattleLoot: PokemonHeldItemModifier[];
    public escapeAttempts: integer;
    public lastMove: Moves;
    public battleSeed: string;
    private battleSeedState: string;
    public moneyScattered: number;

    private rngCounter: integer = 0;

    constructor(gameMode: GameMode, waveIndex: integer, battleType: BattleType, trainer: Trainer, double: boolean) {
        this.gameMode = gameMode;
        this.waveIndex = waveIndex;
        this.battleType = battleType;
        this.trainer = trainer;
        this.initBattleSpec();
        this.enemyLevels = battleType !== BattleType.TRAINER
            ? new Array(double ? 2 : 1).fill(null).map(() => this.getLevelForWave())
            : trainer.getPartyLevels(this.waveIndex);
        this.enemyParty = [];
        this.seenEnemyPartyMemberIds = new Set<integer>();
        this.double = double;
        this.enemySwitchCounter = 0;
        this.turn = 0;
        this.playerParticipantIds = new Set<integer>();
        this.battleScore = 0;
        this.postBattleLoot = [];
        this.escapeAttempts = 0;
        this.started = false;
        this.battleSeed = Utils.randomString(16, true);
        this.battleSeedState = null;
        this.moneyScattered = 0;
    }

    /**
     * Initializes the battle specifications.
     * @throws {Error} Throws an error if the game mode is not classic.
     */
    private initBattleSpec(): void {
        let spec = BattleSpec.DEFAULT;
        if (this.gameMode.isClassic) {
            if (this.waveIndex === 200)
                spec = BattleSpec.FINAL_BOSS;
        }
        this.battleSpec = spec;
    }

    /**
     * Private method to calculate the level for the current wave.
     * 
     * @returns {integer} The calculated level for the wave.
     * @throws {Error} If an error occurs during the calculation.
     */
    private getLevelForWave(): integer {
        let levelWaveIndex = this.gameMode.getWaveForDifficulty(this.waveIndex);
        let baseLevel = 1 + levelWaveIndex / 2 + Math.pow(levelWaveIndex / 25, 2);
        const bossMultiplier = 1.2;

        if (!(this.waveIndex % 10)) {
            const ret = Math.floor(baseLevel * bossMultiplier);
            if (this.battleSpec === BattleSpec.FINAL_BOSS || !(this.waveIndex % 250))
                return Math.ceil(ret / 25) * 25;
            let levelOffset = 0;
            if (!this.gameMode.isWaveFinal(this.waveIndex))
                levelOffset = Math.round(Phaser.Math.RND.realInRange(-1, 1) * Math.floor(levelWaveIndex / 10));
            return ret + levelOffset;
        }

        let levelOffset = 0;
        
        const deviation = 10 / levelWaveIndex;
        levelOffset = Math.abs(this.randSeedGaussForLevel(deviation));

        return Math.max(Math.round(baseLevel + levelOffset), 1);
    }

    /**
     * Generates a random seed using Gaussian distribution for the given level.
     * 
     * @param value The level for which the random seed is generated.
     * @returns The generated random seed.
     * @throws None
     */
    randSeedGaussForLevel(value: number): number { 
        let rand = 0;

        
        for (let i = value; i > 0; i--)
            rand += Phaser.Math.RND.realInRange(0, 1);
        return rand / value;
    }

    /**
     * Returns the number of battlers.
     * @throws {Error} Throws an error if the battler count is not a valid integer.
     * @returns {number} The number of battlers, either 1 or 2 based on the value of 'double'.
     */
    getBattlerCount(): integer {
        return this.double ? 2 : 1;
    }

    /**
     * Increment the turn in the battle scene.
     * @param scene The battle scene to increment the turn for.
     * @throws {Error} If the scene is not provided.
     */
    incrementTurn(scene: BattleScene): void {
        this.turn++;
        this.turnCommands = Object.fromEntries(Utils.getEnumValues(BattlerIndex).map(bt => [ bt, null ]));
        this.battleSeedState = null;
    }

    /**
     * Adds a participant to the player's participant list.
     * 
     * @param playerPokemon The player's Pokemon to be added as a participant.
     * @throws {Error} If the playerPokemon is not valid or if an error occurs while adding the participant.
     */
    addParticipant(playerPokemon: PlayerPokemon): void {
        this.playerParticipantIds.add(playerPokemon.id);
    }

    /**
     * Removes the fainted participant from the player's Pokemon.
     * @param playerPokemon The player's Pokemon to be removed.
     * @throws {Error} If the playerPokemon is not found in the participant list.
     */
    removeFaintedParticipant(playerPokemon: PlayerPokemon): void {
        this.playerParticipantIds.delete(playerPokemon.id);
    }

    /**
     * Adds post-battle loot from the enemy Pokemon to the current loot list.
     * @param enemyPokemon The enemy Pokemon from which to retrieve loot.
     * @throws {Error} Throws an error if the enemy Pokemon does not have any loot modifiers.
     */
    addPostBattleLoot(enemyPokemon: EnemyPokemon): void {
        this.postBattleLoot.push(...enemyPokemon.scene.findModifiers(m => m instanceof PokemonHeldItemModifier && m.pokemonId === enemyPokemon.id && m.getTransferrable(false), false).map(i => {
            const ret = i as PokemonHeldItemModifier;
            ret.pokemonId = null;
            return ret;
        }));
    }

    /**
     * Picks up scattered money in the battle scene.
     * 
     * @param scene The battle scene from which to pick up the money.
     * @throws {Error} If any error occurs during the process.
     */
    pickUpScatteredMoney(scene: BattleScene): void {
        const moneyAmount = new Utils.IntegerHolder(scene.currentBattle.moneyScattered);
        scene.applyModifiers(MoneyMultiplierModifier, true, moneyAmount);

        scene.addMoney(moneyAmount.value);
        
        scene.queueMessage(`You picked up ₽${moneyAmount.value.toLocaleString('en-US')}!`, null, true);

        scene.currentBattle.moneyScattered = 0;
    }

    /**
     * Adds the battle score to the scene.
     * @param scene The BattleScene to add the score to.
     * @throws {Error} If the scene is not valid or if there is an issue updating the score text.
     */
    addBattleScore(scene: BattleScene): void {
        let partyMemberTurnMultiplier = scene.getEnemyParty().length / 2 + 0.5;
        if (this.double)
            partyMemberTurnMultiplier /= 1.5;
        for (let p of scene.getEnemyParty()) {
            if (p.isBoss())
                partyMemberTurnMultiplier *= (p.bossSegments / 1.5) / scene.getEnemyParty().length;
        }
        const turnMultiplier = Phaser.Tweens.Builders.GetEaseFunction('Sine.easeIn')(1 - Math.min(this.turn - 2, 10 * partyMemberTurnMultiplier) / (10 * partyMemberTurnMultiplier));
        const finalBattleScore = Math.ceil(this.battleScore * turnMultiplier);
        scene.score += finalBattleScore;
        console.log(`Battle Score: ${finalBattleScore} (${this.turn - 1} Turns x${Math.floor(turnMultiplier * 100) / 100})`);
        console.log(`Total Score: ${scene.score}`);
        scene.updateScoreText();
    }

    /**
    * Retrieves the background music override for the battle scene.
    *
    * This method determines the appropriate background music based on the current battle scene,
    * the type of battle, and the characteristics of the battlers involved. It checks various conditions
    * such as the battle type, game mode, and specific attributes of the Pokémon to return the correct
    * music track.
    *
    * @param {BattleScene} scene - The battle scene for which the background music override is needed.
    * @returns {string} The string representing the background music override, or null if no override is applicable.
    * @throws {Error} If the battle type is not recognized.
    *
    * @example
    * const bgm = getBgmOverride(currentScene);
    * console.log(bgm); // Outputs the appropriate background music track for the current battle scene.
    */
    addBattleScore1(scene: BattleScene): void {
        let partyMemberTurnMultiplier = scene.getEnemyParty().length / 2 + 0.5;
        if (this.double)
            partyMemberTurnMultiplier /= 1.5;
        for (let p of scene.getEnemyParty()) {
            if (p.isBoss())
                partyMemberTurnMultiplier *= (p.bossSegments / 1.5) / scene.getEnemyParty().length;
        }
        const turnMultiplier = Phaser.Tweens.Builders.GetEaseFunction('Sine.easeIn')(1 - Math.min(this.turn - 2, 10 * partyMemberTurnMultiplier) / (10 * partyMemberTurnMultiplier));
        const finalBattleScore = Math.ceil(this.battleScore * turnMultiplier);
        scene.score += finalBattleScore;
        console.log(`Battle Score: ${finalBattleScore} (${this.turn - 1} Turns x${Math.floor(turnMultiplier * 100) / 100})`);
        console.log(`Total Score: ${scene.score}`);
        scene.updateScoreText();
    }


    /**
    * Retrieves the background music override for the battle scene.
    *
    * This method determines the appropriate background music based on the current battle scene,
    * the type of battle, and the characteristics of the battlers involved. It checks various conditions
    * such as the battle type, game mode, and specific attributes of the Pokémon to return the correct
    * music track.
    *
    * @param {BattleScene} scene - The battle scene for which the background music override is needed.
    * @returns {string} The string representing the background music override, or null if no override is applicable.
    * @throws {Error} If the battle type is not recognized.
    *
    * @example
    * const bgm = getBgmOverride(currentScene);
    * console.log(bgm); // Outputs the appropriate background music track for the current battle scene.
    */
    getBgmOverride(scene: BattleScene): string {
        const battlers = this.enemyParty.slice(0, this.getBattlerCount());
        if (this.battleType === BattleType.TRAINER) {
            if (!this.started && this.trainer.config.encounterBgm && this.trainer.getEncounterMessages()?.length)
                return `encounter_${this.trainer.getEncounterBgm()}`;
            return this.trainer.getBattleBgm();
        } else if (this.gameMode.isClassic && this.waveIndex > 195 && this.battleSpec !== BattleSpec.FINAL_BOSS)
            return 'end_summit';
        for (let pokemon of battlers) {
            if (this.battleSpec === BattleSpec.FINAL_BOSS) {
                if (pokemon.formIndex)
                    return 'battle_final';
                return 'battle_final_encounter';
            }
            if (pokemon.species.legendary || pokemon.species.subLegendary || pokemon.species.mythical) {
                if (pokemon.species.speciesId === Species.REGIROCK || pokemon.species.speciesId === Species.REGICE || pokemon.species.speciesId === Species.REGISTEEL || pokemon.species.speciesId === Species.REGIGIGAS || pokemon.species.speciesId === Species.REGIELEKI || pokemon.species.speciesId === Species.REGIDRAGO)
                    return 'battle_legendary_regis';
                if (pokemon.species.speciesId === Species.COBALION || pokemon.species.speciesId === Species.TERRAKION || pokemon.species.speciesId === Species.VIRIZION || pokemon.species.speciesId === Species.TORNADUS || pokemon.species.speciesId === Species.THUNDURUS || pokemon.species.speciesId === Species.LANDORUS || pokemon.species.speciesId === Species.KELDEO || pokemon.species.speciesId === Species.MELOETTA || pokemon.species.speciesId === Species.GENESECT)
                    return 'battle_legendary_unova';
                if (pokemon.species.speciesId === Species.RESHIRAM || pokemon.species.speciesId === Species.ZEKROM)
                    return 'battle_legendary_res_zek';
                if (pokemon.species.speciesId === Species.KYUREM)
                    return 'battle_legendary_kyurem';
                if (pokemon.species.legendary)
                    return 'battle_legendary_res_zek';
                return 'battle_legendary_unova';
            }
        }

        if (scene.gameMode.isClassic && this.waveIndex <= 4)
            return 'battle_wild';

        return null;
    }

    /**
     * Generates a random integer based on the provided range and minimum value.
     * @param scene The BattleScene object.
     * @param range The range of the random integer.
     * @param min The minimum value for the random integer. Default is 0.
     * @returns The generated random integer.
     * @throws If the range is less than or equal to 1.
     */
    randSeedInt(scene: BattleScene, range: integer, min: integer = 0): integer {
        if (range <= 1)
            return min;
        let ret: integer;
        const tempRngCounter = scene.rngCounter;
        const tempSeedOverride = scene.rngSeedOverride;
        const state = Phaser.Math.RND.state();
        if (this.battleSeedState)
            Phaser.Math.RND.state(this.battleSeedState);
        else {
            Phaser.Math.RND.sow([ Utils.shiftCharCodes(this.battleSeed, this.turn << 6) ]);
            console.log('Battle Seed:', this.battleSeed);
        }
        scene.rngCounter = this.rngCounter++;
        scene.rngSeedOverride = this.battleSeed;
        ret = Utils.randSeedInt(range, min);
        this.battleSeedState = Phaser.Math.RND.state();
        Phaser.Math.RND.state(state);
        scene.rngCounter = tempRngCounter;
        scene.rngSeedOverride = tempSeedOverride;
        return ret;
    }
}

export class FixedBattle extends Battle {
    constructor(scene: BattleScene, waveIndex: integer, config: FixedBattleConfig) {
        super(scene.gameMode, waveIndex, config.battleType, config.battleType === BattleType.TRAINER ? config.getTrainer(scene) : null, config.double);
        if (config.getEnemyParty)
            this.enemyParty = config.getEnemyParty(scene);
    }
}

type GetTrainerFunc = (scene: BattleScene) => Trainer;
type GetEnemyPartyFunc = (scene: BattleScene) => EnemyPokemon[];

export class FixedBattleConfig {
    public battleType: BattleType;
    public double: boolean;
    public getTrainer: GetTrainerFunc;
    public getEnemyParty: GetEnemyPartyFunc;
    public seedOffsetWaveIndex: integer;

    /**
     * Set the battle type for the fixed battle configuration.
     * @param battleType The type of battle to set.
     * @returns The updated FixedBattleConfig instance.
     * @throws {Error} If the battleType is not valid.
     */
    setBattleType(battleType: BattleType): FixedBattleConfig {
        this.battleType = battleType;
        return this;
    }

    /**
     * Set the double property of FixedBattleConfig.
     * @param double - The value to set for the double property.
     * @returns FixedBattleConfig - The updated FixedBattleConfig instance.
     * @throws - No exceptions are thrown by this method.
     */
    setDouble(double: boolean): FixedBattleConfig {
        this.double = double;
        return this;
    }

    /**
     * Set the getTrainer function for FixedBattleConfig.
     * @param getTrainerFunc The function to get the trainer.
     * @returns The updated FixedBattleConfig.
     * @throws {Error} If getTrainerFunc is not provided.
     */
    setGetTrainerFunc(getTrainerFunc: GetTrainerFunc): FixedBattleConfig {
        this.getTrainer = getTrainerFunc;
        return this;
    }

    /**
     * Set the function to get the enemy party for the fixed battle configuration.
     * @param getEnemyPartyFunc The function to get the enemy party.
     * @returns The updated fixed battle configuration.
     * @throws {Error} If the getEnemyPartyFunc is not provided.
     */
    setGetEnemyPartyFunc(getEnemyPartyFunc: GetEnemyPartyFunc): FixedBattleConfig {
        this.getEnemyParty = getEnemyPartyFunc;
        return this;
    }

    /**
     * Sets the seed offset wave for the FixedBattleConfig.
     * @param seedOffsetWaveIndex The index of the seed offset wave to set.
     * @returns The updated FixedBattleConfig instance.
     * @throws {Error} If the seedOffsetWaveIndex is not a valid integer.
     */
    setSeedOffsetWave(seedOffsetWaveIndex: integer): FixedBattleConfig {
        this.seedOffsetWaveIndex = seedOffsetWaveIndex;
        return this;
    }
}

/**
 * Returns a function that generates a random trainer from the given pool of trainer types.
 * @param trainerPool An array of TrainerType or TrainerType[] representing the pool of trainer types.
 * @returns A function that takes a BattleScene and returns a randomly selected Trainer.
 * @throws If the trainerPool is empty or contains invalid trainer types.
 */
function getRandomTrainerFunc(trainerPool: (TrainerType | TrainerType[])[]): GetTrainerFunc {
    return (scene: BattleScene) => {
        const rand = Utils.randSeedInt(trainerPool.length);
        const trainerTypes: TrainerType[] = [];
        for (let trainerPoolEntry of trainerPool) {
            const trainerType = Array.isArray(trainerPoolEntry)
                ? Utils.randSeedItem(trainerPoolEntry)
                : trainerPoolEntry;
            trainerTypes.push(trainerType);
        }
        return new Trainer(scene, trainerTypes[rand], TrainerVariant.DEFAULT);
    };
}

interface FixedBattleConfigs {
    [key: integer]: FixedBattleConfig
}

export const fixedBattles: FixedBattleConfigs = {
    [5]: new FixedBattleConfig().setBattleType(BattleType.TRAINER)
        .setGetTrainerFunc(scene => new Trainer(scene, TrainerType.YOUNGSTER, Utils.randSeedInt(2) ? TrainerVariant.FEMALE : TrainerVariant.DEFAULT)),
    [8]: new FixedBattleConfig().setBattleType(BattleType.TRAINER)
        .setGetTrainerFunc(scene => new Trainer(scene, TrainerType.RIVAL, scene.gameData.gender === PlayerGender.MALE ? TrainerVariant.FEMALE : TrainerVariant.DEFAULT)),
    [25]: new FixedBattleConfig().setBattleType(BattleType.TRAINER)
        .setGetTrainerFunc(scene => new Trainer(scene, TrainerType.RIVAL_2, scene.gameData.gender === PlayerGender.MALE ? TrainerVariant.FEMALE : TrainerVariant.DEFAULT)),
    [55]: new FixedBattleConfig().setBattleType(BattleType.TRAINER)
        .setGetTrainerFunc(scene => new Trainer(scene, TrainerType.RIVAL_3, scene.gameData.gender === PlayerGender.MALE ? TrainerVariant.FEMALE : TrainerVariant.DEFAULT)),
    [95]: new FixedBattleConfig().setBattleType(BattleType.TRAINER)
        .setGetTrainerFunc(scene => new Trainer(scene, TrainerType.RIVAL_4, scene.gameData.gender === PlayerGender.MALE ? TrainerVariant.FEMALE : TrainerVariant.DEFAULT)),
    [145]: new FixedBattleConfig().setBattleType(BattleType.TRAINER)
        .setGetTrainerFunc(scene => new Trainer(scene, TrainerType.RIVAL_5, scene.gameData.gender === PlayerGender.MALE ? TrainerVariant.FEMALE : TrainerVariant.DEFAULT)),
    [182]: new FixedBattleConfig().setBattleType(BattleType.TRAINER)
        .setGetTrainerFunc(getRandomTrainerFunc([ TrainerType.LORELEI, TrainerType.WILL, TrainerType.SIDNEY, TrainerType.AARON, TrainerType.SHAUNTAL, TrainerType.MALVA, [ TrainerType.HALA, TrainerType.MOLAYNE ], TrainerType.RIKA, TrainerType.CRISPIN ])),
    [184]: new FixedBattleConfig().setBattleType(BattleType.TRAINER).setSeedOffsetWave(182)
        .setGetTrainerFunc(getRandomTrainerFunc([ TrainerType.BRUNO, TrainerType.KOGA, TrainerType.PHOEBE, TrainerType.BERTHA, TrainerType.MARSHAL, TrainerType.SIEBOLD, TrainerType.OLIVIA, TrainerType.POPPY, TrainerType.AMARYS ])),
    [186]: new FixedBattleConfig().setBattleType(BattleType.TRAINER).setSeedOffsetWave(182)
        .setGetTrainerFunc(getRandomTrainerFunc([ TrainerType.AGATHA, TrainerType.BRUNO, TrainerType.GLACIA, TrainerType.FLINT, TrainerType.GRIMSLEY, TrainerType.WIKSTROM, TrainerType.ACEROLA, TrainerType.LARRY_ELITE, TrainerType.LACEY ])),
    [188]: new FixedBattleConfig().setBattleType(BattleType.TRAINER).setSeedOffsetWave(182)
        .setGetTrainerFunc(getRandomTrainerFunc([ TrainerType.LANCE, TrainerType.KAREN, TrainerType.DRAKE, TrainerType.LUCIAN, TrainerType.CAITLIN, TrainerType.DRASNA, TrainerType.KAHILI, TrainerType.HASSEL, TrainerType.DRAYTON ])),
    [190]: new FixedBattleConfig().setBattleType(BattleType.TRAINER).setSeedOffsetWave(182)
        .setGetTrainerFunc(getRandomTrainerFunc([ TrainerType.BLUE, [ TrainerType.RED, TrainerType.LANCE_CHAMPION ], [ TrainerType.STEVEN, TrainerType.WALLACE ], TrainerType.CYNTHIA, [ TrainerType.ALDER, TrainerType.IRIS ], TrainerType.DIANTHA, TrainerType.HAU, [ TrainerType.GEETA, TrainerType.NEMONA ], TrainerType.KIERAN, TrainerType.LEON ])),
    [195]: new FixedBattleConfig().setBattleType(BattleType.TRAINER)
        .setGetTrainerFunc(scene => new Trainer(scene, TrainerType.RIVAL_6, scene.gameData.gender === PlayerGender.MALE ? TrainerVariant.FEMALE : TrainerVariant.DEFAULT))
};
