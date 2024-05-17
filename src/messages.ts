import { BattleSpec } from "./enums/battle-spec";
import Pokemon from "./field/pokemon";

/**
 * Returns a message with the specified content for the given Pokemon.
 * @param pokemon The Pokemon for which the message is being generated.
 * @param content The content to be included in the message.
 * @returns The message containing the Pokemon's name and the specified content.
 * @throws {Error} If the Pokemon prefix cannot be retrieved.
 */
export function getPokemonMessage(pokemon: Pokemon, content: string): string {
  return `${getPokemonPrefix(pokemon)}${pokemon.name}${content}`;
}

/**
 * Returns the prefix for a given Pokemon based on the current battle specifications.
 * @param pokemon The Pokemon for which to determine the prefix.
 * @returns The prefix string for the given Pokemon.
 * @throws If the pokemon parameter is not provided.
 */
export function getPokemonPrefix(pokemon: Pokemon): string {
  let prefix: string;
  switch (pokemon.scene.currentBattle.battleSpec) {
    case BattleSpec.DEFAULT:
      prefix = !pokemon.isPlayer() ? pokemon.hasTrainer() ? 'Foe ' : 'Wild ' : '';
      break;
    case BattleSpec.FINAL_BOSS:
      prefix = !pokemon.isPlayer() ? 'Foe ' : '';
      break;
  }
  return prefix;
}