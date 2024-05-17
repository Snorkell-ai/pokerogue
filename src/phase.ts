import BattleScene from "./battle-scene";

export class Phase {
  protected scene: BattleScene;

  constructor(scene: BattleScene) {
    this.scene = scene;
  }

  /**
   * Method to start the phase.
   * 
   * @throws {Error} If unable to start the phase.
   */
  start() {
    console.log(`%cStart Phase ${this.constructor.name}`, 'color:green;');
    if (this.scene.abilityBar.shown)
      this.scene.abilityBar.resetAutoHideTimer();
  }

  /**
   * Method to end the current process.
   * @throws {Error} Throws an error if the shiftPhase function encounters an issue.
   */
  end() {
    this.scene.shiftPhase();
  }
}