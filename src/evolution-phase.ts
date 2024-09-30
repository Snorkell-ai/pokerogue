import SoundFade from "phaser3-rex-plugins/plugins/soundfade";
import { Phase } from "./phase";
import BattleScene from "./battle-scene";
import { SpeciesFormEvolution } from "./data/pokemon-evolutions";
import EvolutionSceneHandler from "./ui/evolution-scene-handler";
import * as Utils from "./utils";
import { Mode } from "./ui/ui";
import { LearnMovePhase } from "./phases";
import { cos, sin } from "./field/anims";
import { PlayerPokemon } from "./field/pokemon";
import { getTypeRgb } from "./data/type";
import i18next from "i18next";

export class EvolutionPhase extends Phase {
  protected pokemon: PlayerPokemon;
  protected lastLevel: integer;
  
  private evolution: SpeciesFormEvolution;

  protected evolutionContainer: Phaser.GameObjects.Container;
  protected evolutionBaseBg: Phaser.GameObjects.Image;
  protected evolutionBg: Phaser.GameObjects.Video;
  protected evolutionBgOverlay: Phaser.GameObjects.Rectangle;
  protected evolutionOverlay: Phaser.GameObjects.Rectangle;
  protected pokemonSprite: Phaser.GameObjects.Sprite;
  protected pokemonTintSprite: Phaser.GameObjects.Sprite;
  protected pokemonEvoSprite: Phaser.GameObjects.Sprite;
  protected pokemonEvoTintSprite: Phaser.GameObjects.Sprite;

  constructor(scene: BattleScene, pokemon: PlayerPokemon, evolution: SpeciesFormEvolution, lastLevel: integer) {
    super(scene);

    this.pokemon = pokemon;
    this.evolution = evolution;
    this.lastLevel = lastLevel;
  }

  /**
   * Validates the existence of evolution.
   * @returns {boolean} - Returns true if evolution exists, otherwise false.
   */
  validate(): boolean {
    return !!this.evolution;
  }

  /**
   * Sets the mode to evolution scene with force transition.
   * @returns A promise that resolves to void.
   * @throws {Error} If an error occurs during the mode transition.
   */
  setMode(): Promise<void> {
    return this.scene.ui.setModeForceTransition(Mode.EVOLUTION_SCENE);
  }

  /**
   * Method to start the evolution process.
   * @throws {Error} If an error occurs during the evolution process.
   */
  start() {
    super.start();

    this.setMode().then(() => {

      if (!this.validate())
        return this.end();

      this.scene.fadeOutBgm(null, false);

      const evolutionHandler = this.scene.ui.getHandler() as EvolutionSceneHandler;

      this.evolutionContainer = evolutionHandler.evolutionContainer;

      this.evolutionBaseBg = this.scene.add.image(0, 0, 'default_bg');
      this.evolutionBaseBg.setOrigin(0, 0);
      this.evolutionContainer.add(this.evolutionBaseBg);

      this.evolutionBg = this.scene.add.video(0, 0, 'evo_bg').stop();
      this.evolutionBg.setOrigin(0, 0);
      this.evolutionBg.setScale(0.4359673025);
      this.evolutionBg.setVisible(false);
      this.evolutionContainer.add(this.evolutionBg);

      this.evolutionBgOverlay = this.scene.add.rectangle(0, 0, this.scene.game.canvas.width / 6, this.scene.game.canvas.height / 6, 0x262626);
      this.evolutionBgOverlay.setOrigin(0, 0);
      this.evolutionBgOverlay.setAlpha(0);
      this.evolutionContainer.add(this.evolutionBgOverlay);

      /**
       * Retrieves the Pokemon sprite.
       * @throws {Error} Throws an error if the Pokemon sprite cannot be retrieved.
       */
      const getPokemonSprite = () => {
        const ret = this.scene.addPokemonSprite(this.pokemon, this.evolutionBaseBg.displayWidth / 2, this.evolutionBaseBg.displayHeight / 2, `pkmn__sub`);
        ret.setPipeline(this.scene.spritePipeline, { tone: [ 0.0, 0.0, 0.0, 0.0 ], ignoreTimeTint: true });
        return ret;
      };

      this.evolutionContainer.add((this.pokemonSprite = getPokemonSprite()));
      this.evolutionContainer.add((this.pokemonTintSprite = getPokemonSprite()));
      this.evolutionContainer.add((this.pokemonEvoSprite = getPokemonSprite()));
      this.evolutionContainer.add((this.pokemonEvoTintSprite = getPokemonSprite()));

      this.pokemonTintSprite.setAlpha(0);
      this.pokemonTintSprite.setTintFill(0xFFFFFF);
      this.pokemonEvoSprite.setVisible(false);
      this.pokemonEvoTintSprite.setVisible(false);
      this.pokemonEvoTintSprite.setTintFill(0xFFFFFF);

      this.evolutionOverlay = this.scene.add.rectangle(0, -this.scene.game.canvas.height / 6, this.scene.game.canvas.width / 6, (this.scene.game.canvas.height / 6) - 48, 0xFFFFFF);
      this.evolutionOverlay.setOrigin(0, 0);
      this.evolutionOverlay.setAlpha(0);
      this.scene.ui.add(this.evolutionOverlay);

      [ this.pokemonSprite, this.pokemonTintSprite, this.pokemonEvoSprite, this.pokemonEvoTintSprite ].map(sprite => {
        sprite.play(this.pokemon.getSpriteKey(true));
        sprite.setPipeline(this.scene.spritePipeline, { tone: [ 0.0, 0.0, 0.0, 0.0 ], hasShadow: false, teraColor: getTypeRgb(this.pokemon.getTeraType()) });
        sprite.setPipelineData('ignoreTimeTint', true);
        sprite.setPipelineData('spriteKey', this.pokemon.getSpriteKey());
        sprite.setPipelineData('shiny', this.pokemon.shiny);
        sprite.setPipelineData('variant', this.pokemon.variant);
        [ 'spriteColors', 'fusionSpriteColors' ].map(k => {
          if (this.pokemon.summonData?.speciesForm)
            k += 'Base';
          sprite.pipelineData[k] = this.pokemon.getSprite().pipelineData[k];
        });
      });

      this.doEvolution();
    });
  }

  /**
   * Perform evolution of the pokemon.
   * 
   * This method triggers the evolution process of the pokemon. It includes various animations and sound effects to simulate the evolution process.
   * 
   * @throws {Error} Throws an error if the evolution process is interrupted or fails.
   */
  doEvolution(): void {
    const evolutionHandler = this.scene.ui.getHandler() as EvolutionSceneHandler;
    const preName = this.pokemon.name;
    
    this.scene.ui.showText(i18next.t('menu:evolving', { pokemonName: preName }), null, () => {
      this.pokemon.cry();

      this.pokemon.getPossibleEvolution(this.evolution).then(evolvedPokemon => {

        [ this.pokemonEvoSprite, this.pokemonEvoTintSprite ].map(sprite => {
          sprite.play(evolvedPokemon.getSpriteKey(true));
          sprite.setPipelineData('ignoreTimeTint', true);
          sprite.setPipelineData('spriteKey', evolvedPokemon.getSpriteKey());
          sprite.setPipelineData('shiny', evolvedPokemon.shiny);
          sprite.setPipelineData('variant', evolvedPokemon.variant);
          [ 'spriteColors', 'fusionSpriteColors' ].map(k => {
            if (evolvedPokemon.summonData?.speciesForm)
              k += 'Base';
            sprite.pipelineData[k] = evolvedPokemon.getSprite().pipelineData[k];
          });
        });

        this.scene.time.delayedCall(1000, () => {
          const evolutionBgm = this.scene.playSoundWithoutBgm('evolution');
          this.scene.tweens.add({
            targets: this.evolutionBgOverlay,
            alpha: 1,
            delay: 500,
            duration: 1500,
            ease: 'Sine.easeOut',
            onComplete: () => {
              this.scene.time.delayedCall(1000, () => {
                this.scene.tweens.add({
                  targets: this.evolutionBgOverlay,
                  alpha: 0,
                  duration: 250
                });
                this.evolutionBg.setVisible(true);
                this.evolutionBg.play();
              });
              this.scene.playSound('charge');
              this.doSpiralUpward();
              this.scene.tweens.addCounter({
                from: 0,
                to: 1,
                duration: 2000,
                onUpdate: t => {
                  this.pokemonTintSprite.setAlpha(t.getValue());
                },
                onComplete: () => {
                  this.pokemonSprite.setVisible(false);
                  this.scene.time.delayedCall(1100, () => {
                    this.scene.playSound('beam');
                    this.doArcDownward();
                    this.scene.time.delayedCall(1500, () => {
                      this.pokemonEvoTintSprite.setScale(0.25);
                      this.pokemonEvoTintSprite.setVisible(true);
                      evolutionHandler.canCancel = true;
                      this.doCycle(1).then(success => {
                        if (!success) {

                          this.pokemonSprite.setVisible(true);
                          this.pokemonTintSprite.setScale(1);
                          this.scene.tweens.add({
                            targets: [ this.evolutionBg, this.pokemonTintSprite, this.pokemonEvoSprite, this.pokemonEvoTintSprite ],
                            alpha: 0,
                            duration: 250,
                            onComplete: () => {
                              this.evolutionBg.setVisible(false);
                            }
                          });

                          SoundFade.fadeOut(this.scene, evolutionBgm, 100);

                          this.scene.unshiftPhase(new EndEvolutionPhase(this.scene));

                          this.scene.ui.showText(i18next.t('menu:stoppedEvolving', { pokemonName: preName }), null, () => {
                            this.scene.ui.showText(i18next.t('menu:pauseEvolutionsQuestion', { pokemonName: preName }), null, () => {
                              /**
                               * Method to end the process.
                               * 
                               * @throws {Error} If any of the called functions encounter an error.
                               */
                              const end = () => {
                                this.scene.ui.showText(null, 0);
                                this.scene.playBgm();
                                evolvedPokemon.destroy();
                                this.end();
                              };
                              this.scene.ui.setOverlayMode(Mode.CONFIRM, () => {
                                this.scene.ui.revertMode();
                                this.pokemon.pauseEvolutions = true;
                                this.scene.ui.showText(i18next.t('menu:evolutionsPaused', { pokemonName: preName }), null, end, 3000);
                              }, () => {
                                this.scene.ui.revertMode();
                                this.scene.time.delayedCall(3000, end);
                              });
                            });
                          }, null, true);
                          return;
                        }
                        
                        this.scene.playSound('sparkle');
                        this.pokemonEvoSprite.setVisible(true);
                        this.doCircleInward();
                        this.scene.time.delayedCall(900, () => {
                          evolutionHandler.canCancel = false;

                          this.pokemon.evolve(this.evolution).then(() => {
                            const levelMoves = this.pokemon.getLevelMoves(this.lastLevel + 1, true);
                            for (let lm of levelMoves)
                              this.scene.unshiftPhase(new LearnMovePhase(this.scene, this.scene.getParty().indexOf(this.pokemon), lm[1]));  
                            this.scene.unshiftPhase(new EndEvolutionPhase(this.scene));

                            this.scene.playSound('shine');
                            this.doSpray();
                            this.scene.tweens.add({
                              targets: this.evolutionOverlay,
                              alpha: 1,
                              duration: 250,
                              easing: 'Sine.easeIn',
                              onComplete: () => {
                                this.evolutionBgOverlay.setAlpha(1);
                                this.evolutionBg.setVisible(false);
                                this.scene.tweens.add({
                                  targets: [ this.evolutionOverlay, this.pokemonEvoTintSprite ],
                                  alpha: 0,
                                  duration: 2000,
                                  delay: 150,
                                  easing: 'Sine.easeIn',
                                  onComplete: () => {
                                    this.scene.tweens.add({
                                      targets: this.evolutionBgOverlay,
                                      alpha: 0,
                                      duration: 250,
                                      onComplete: () => {
                                        SoundFade.fadeOut(this.scene, evolutionBgm, 100);
                                        this.scene.time.delayedCall(250, () => {
                                          this.pokemon.cry();
                                          this.scene.time.delayedCall(1250, () => {
                                            this.scene.playSoundWithoutBgm('evolution_fanfare');
                                            
                                            evolvedPokemon.destroy();
                                            this.scene.ui.showText(i18next.t('menu:evolutionDone', { pokemonName: preName, evolvedPokemonName: this.pokemon.name }), null, () => this.end(), null, true, Utils.fixedInt(4000));
                                            this.scene.time.delayedCall(Utils.fixedInt(4250), () => this.scene.playBgm());
                                          });
                                        });
                                      }
                                    });
                                  }
                                });
                              }
                            });
                          });
                        });
                      });
                    });
                  });
                }
              })
            }
          });
        });
      });
    }, 1000);
  }

  /**
   * Method to perform a spiral upward animation.
   * 
   * @throws {Exception} If there is an error during the animation.
   */
  doSpiralUpward() {
    let f = 0;
      
    this.scene.tweens.addCounter({
      repeat: 64,
      duration: Utils.getFrameMs(1),
      onRepeat: () => {
        if (f < 64) {
          if (!(f & 7)) {
            for (let i = 0; i < 4; i++)
              this.doSpiralUpwardParticle((f & 120) * 2 + i * 64);
          }
          f++;
        }
      }
    });
  }

  /**
   * Method to perform arc downward animation.
   * 
   * @throws {Error} If the animation counter cannot be added.
   */
  doArcDownward() {
    let f = 0;
      
    this.scene.tweens.addCounter({
      repeat: 96,
      duration: Utils.getFrameMs(1),
      onRepeat: () => {
        if (f < 96) {
          if (f < 6) {
            for (let i = 0; i < 9; i++)
              this.doArcDownParticle(i * 16);
          }
          f++;
        }
      }
    });
  }

  /**
   * Perform a cycle with the given number and last cycle value.
   * @param l The current cycle number.
   * @param lastCycle The last cycle number, default value is 15.
   * @returns A promise that resolves to a boolean indicating the success of the cycle.
   * @throws {Error} If an error occurs during the cycle process.
   */
  doCycle(l: number, lastCycle: integer = 15): Promise<boolean> {
    return new Promise(resolve => {
      const evolutionHandler = this.scene.ui.getHandler() as EvolutionSceneHandler;
      const isLastCycle = l === lastCycle;
      this.scene.tweens.add({
        targets: this.pokemonTintSprite,
        scale: 0.25,
        ease: 'Cubic.easeInOut',
        duration: 500 / l,
        yoyo: !isLastCycle
      });
      this.scene.tweens.add({
        targets: this.pokemonEvoTintSprite,
        scale: 1,
        ease: 'Cubic.easeInOut',
        duration: 500 / l,
        yoyo: !isLastCycle,
        onComplete: () => {
          if (evolutionHandler.cancelled)
            return resolve(false);
          if (l < lastCycle)
            this.doCycle(l + 0.5, lastCycle).then(success => resolve(success));
          else {
            this.pokemonTintSprite.setVisible(false);
            resolve(true);
          }
        }
      });
    });
  }

  /**
   * Method to perform inward circle animation.
   * 
   * @throws {Error} If there is an error in tween animation.
   */
  doCircleInward() {
    let f = 0;
      
    this.scene.tweens.addCounter({
      repeat: 48,
      duration: Utils.getFrameMs(1),
      onRepeat: () => {
        if (!f) {
          for (let i = 0; i < 16; i++)
            this.doCircleInwardParticle(i * 16, 4);
        } else if (f === 32) {
          for (let i = 0; i < 16; i++)
            this.doCircleInwardParticle(i * 16, 8);
        }
        f++;
      }
    });
  }

  /**
   * Method to perform spraying action.
   * 
   * @throws {Exception} If there is an error during the spraying action.
   */
  doSpray() {
    let f = 0;
      
    this.scene.tweens.addCounter({
      repeat: 48,
      duration: Utils.getFrameMs(1),
      onRepeat: () => {
        if (!f) {
          for (let i = 0; i < 8; i++)
            this.doSprayParticle(i);
        } else if (f < 50)
          this.doSprayParticle(Utils.randInt(8));
        f++;
      }
    });
  }

  /**
   * Method to create a spiral upward particle effect.
   * @param trigIndex - The index for trigonometric calculations.
   * @throws - No exceptions handled within this method.
   */
  doSpiralUpwardParticle(trigIndex: integer) {
    const initialX = this.evolutionBaseBg.displayWidth / 2;
    const particle = this.scene.add.image(initialX, 0, 'evo_sparkle');
    this.evolutionContainer.add(particle);

    let f = 0;
    let amp = 48;

    const particleTimer = this.scene.tweens.addCounter({
      repeat: -1,
      duration: Utils.getFrameMs(1),
      onRepeat: () => {
        updateParticle();
      }
    });

    /**
     * Update the particle position and properties.
     * @throws {Error} Throws an error if the particle is not found or if the y-coordinate of the particle exceeds 8.
     */
    const updateParticle = () => {
      if (!f || particle.y > 8) {
        particle.setPosition(initialX, 88 - (f * f) / 80);
        particle.y += sin(trigIndex, amp) / 4;
        particle.x += cos(trigIndex, amp);
        particle.setScale(1 - (f / 80));
        trigIndex += 4;
        if (f & 1)
          amp--;
        f++;
      } else {
        particle.destroy();
        particleTimer.remove();
      }
    };

    updateParticle();
  }

  /**
   * Method to create and animate a particle for arc down effect.
   * 
   * @param trigIndex - The index for trigonometric calculations.
   * @throws - No exceptions handled within this method.
   */
  doArcDownParticle(trigIndex: integer) {
    const initialX = this.evolutionBaseBg.displayWidth / 2;
    const particle = this.scene.add.image(initialX, 0, 'evo_sparkle');
    particle.setScale(0.5);
    this.evolutionContainer.add(particle);

    let f = 0;
    let amp = 8;

    const particleTimer = this.scene.tweens.addCounter({
      repeat: -1,
      duration: Utils.getFrameMs(1),
      onRepeat: () => {
        updateParticle();
      }
    });

    /**
     * Updates the particle position and properties.
     * @throws {Error} If the particle is not found.
     * @throws {Error} If the particle timer cannot be removed.
     */
    const updateParticle = () => {
      if (!f || particle.y < 88) {
        particle.setPosition(initialX, 8 + (f * f) / 5);
        particle.y += sin(trigIndex, amp) / 4;
        particle.x += cos(trigIndex, amp);
        amp = 8 + sin(f * 4, 40);
        f++;
      } else {
        particle.destroy();
        particleTimer.remove();
      }
    };

    updateParticle();
  }

  /**
   * Perform inward circular motion for a particle.
   * @param trigIndex The index for trigonometric functions.
   * @param speed The speed of the inward motion.
   * @throws {Error} If there is an issue with the particle creation or animation.
   */
  doCircleInwardParticle(trigIndex: integer, speed: integer) {
    const initialX = this.evolutionBaseBg.displayWidth / 2;
    const initialY = this.evolutionBaseBg.displayHeight / 2;
    const particle = this.scene.add.image(initialX, initialY, 'evo_sparkle');
    this.evolutionContainer.add(particle);

    let amp = 120;

    const particleTimer = this.scene.tweens.addCounter({
      repeat: -1,
      duration: Utils.getFrameMs(1),
      onRepeat: () => {
        updateParticle();
      }
    });

    /**
     * Update the particle position and behavior.
     * @throws {Error} Throws an error if the particle's amplitude is less than or equal to 8.
     */
    const updateParticle = () => {
      if (amp > 8) {
        particle.setPosition(initialX, initialY);
        particle.y += sin(trigIndex, amp);
        particle.x += cos(trigIndex, amp);
        amp -= speed;
        trigIndex += 4;
      } else {
        particle.destroy();
        particleTimer.remove();
      }
    };

    updateParticle();
  }

  /**
   * Spray particles for a given trigonometric index.
   * @param trigIndex The trigonometric index for particle movement.
   * @throws {Error} Throws an error if the trigIndex is not a valid integer.
   */
  doSprayParticle(trigIndex: integer) {
    const initialX = this.evolutionBaseBg.displayWidth / 2;
    const initialY = this.evolutionBaseBg.displayHeight / 2;
    const particle = this.scene.add.image(initialX, initialY, 'evo_sparkle');
    this.evolutionContainer.add(particle);

    let f = 0;
    let yOffset = 0;
    let speed = 3 - Utils.randInt(8);
    let amp = 48 + Utils.randInt(64);

    const particleTimer = this.scene.tweens.addCounter({
      repeat: -1,
      duration: Utils.getFrameMs(1),
      onRepeat: () => {
        updateParticle();
      }
    });

    /**
     * Update the particle position and properties.
     * @throws {Error} Throws an error if any of the called functions are not available.
     */
    const updateParticle = () => {
      if (!(f & 3))
        yOffset++;
      if (trigIndex < 128) {
        particle.setPosition(initialX + (speed * f) / 3, initialY + yOffset);
        particle.y += -sin(trigIndex, amp);
        if (f > 108)
          particle.setScale((1 - (f - 108) / 20));
        trigIndex++;
        f++;
      } else {
        particle.destroy();
        particleTimer.remove();
      }
    };

    updateParticle();
  }
}

export class EndEvolutionPhase extends Phase {
  /**
   * Start the process and set the mode to MESSAGE.
   * @throws {Error} If an error occurs during the process.
   */
  start() {
    super.start();

    this.scene.ui.setModeForceTransition(Mode.MESSAGE).then(() => this.end());
  }
}