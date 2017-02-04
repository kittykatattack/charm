class Charm {
  constructor(renderingEngine = PIXI) {

    if (renderingEngine === undefined) throw new Error("Please assign a rendering engine in the constructor before using charm.js");

    //Find out which rendering engine is being used (the default is Pixi)
    this.renderer = "";

    //If the `renderingEngine` is Pixi, set up Pixi object aliases
    if (renderingEngine.ParticleContainer && renderingEngine.Sprite) {
      this.renderer = "pixi";
    }


    //An array to store the global tweens
    this.globalTweens = [];

    //An object that stores all the easing formulas
    this.easingFormulas = {

      //Linear
      linear(x) {
        return x;
      },

      //Smoothstep
      smoothstep(x) {
        return x * x * (3 - 2 * x);
      },
      smoothstepSquared(x) {
        return Math.pow((x * x * (3 - 2 * x)), 2);
      },
      smoothstepCubed(x) {
        return Math.pow((x * x * (3 - 2 * x)), 3);
      },

      //Acceleration
      acceleration(x) {
        return x * x;
      },
      accelerationCubed(x) {
        return Math.pow(x * x, 3);
      },

      //Deceleration
      deceleration(x) {
        return 1 - Math.pow(1 - x, 2);
      },
      decelerationCubed(x) {
        return 1 - Math.pow(1 - x, 3);
      },

      //Sine
      sine(x) {
        return Math.sin(x * Math.PI / 2);
      },
      sineSquared(x) {
        return Math.pow(Math.sin(x * Math.PI / 2), 2);
      },
      sineCubed(x) {
        return Math.pow(Math.sin(x * Math.PI / 2), 2);
      },
      inverseSine(x) {
        return 1 - Math.sin((1 - x) * Math.PI / 2);
      },
      inverseSineSquared(x) {
        return 1 - Math.pow(Math.sin((1 - x) * Math.PI / 2), 2);
      },
      inverseSineCubed(x) {
        return 1 - Math.pow(Math.sin((1 - x) * Math.PI / 2), 3);
      },

      //Spline
      spline(t, p0, p1, p2, p3) {
        return 0.5 * (
          (2 * p1) +
          (-p0 + p2) * t +
          (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
          (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t
        );
      },

      //Bezier curve
      cubicBezier(t, a, b, c, d) {
        let t2 = t * t;
        let t3 = t2 * t;
        return a + (-a * 3 + t * (3 * a - a * t)) * t + (3 * b + t * (-6 * b + b * 3 * t)) * t + (c * 3 - c * 3 * t) * t2 + d * t3;
      }
    };

    //Add `scaleX` and `scaleY` properties to Pixi sprites
    this._addScaleProperties = (sprite) => {
      if (this.renderer === "pixi") {
        if (!("scaleX" in sprite) && ("scale" in sprite) && ("x" in sprite.scale)) {
          Object.defineProperty(
            sprite,
            "scaleX", {
              get() {
                return sprite.scale.x
              },
              set(value) {
                sprite.scale.x = value
              }
            }
          );
        }
        if (!("scaleY" in sprite) && ("scale" in sprite) && ("y" in sprite.scale)) {
          Object.defineProperty(
            sprite,
            "scaleY", {
              get() {
                return sprite.scale.y
              },
              set(value) {
                sprite.scale.y = value
              }
            }
          );
        }
      }
    };
  }

  //The low level `tweenProperty` function is used as the foundation
  //for the the higher level tween methods.
  tweenProperty(
    sprite, //Sprite object
    property, //String property
    startValue, //Tween start value
    endValue, //Tween end value
    totalFrames, //Duration in frames
    type = "smoothstep", //The easing type
    yoyo = false, //Yoyo?
    delayBeforeRepeat = 0 //Delay in frames before repeating
  ) {

    //Create the tween object
    let o = {};

    //If the tween is a bounce type (a spline), set the
    //start and end magnitude values
    let typeArray = type.split(" ");
    if (typeArray[0] === "bounce") {
      o.startMagnitude = parseInt(typeArray[1]);
      o.endMagnitude = parseInt(typeArray[2]);
    }

    //Use `o.start` to make a new tween using the current
    //end point values
    o.start = (startValue, endValue) => {

      //Clone the start and end values so that any possible references to sprite
      //properties are converted to ordinary numbers 
      o.startValue = JSON.parse(JSON.stringify(startValue));
      o.endValue = JSON.parse(JSON.stringify(endValue));
      o.playing = true;
      o.totalFrames = totalFrames;
      o.frameCounter = 0;

      //Add the tween to the global `tweens` array. The `tweens` array is
      //updated on each frame
      this.globalTweens.push(o);
    };

    //Call `o.start` to start the tween
    o.start(startValue, endValue);

    //The `update` method will be called on each frame by the game loop.
    //This is what makes the tween move
    o.update = () => {

      let time, curvedTime;

      if (o.playing) {

        //If the elapsed frames are less than the total frames,
        //use the tweening formulas to move the sprite
        if (o.frameCounter < o.totalFrames) {

          //Find the normalized value
          let normalizedTime = o.frameCounter / o.totalFrames;

          //Select the correct easing function from the 
          //`ease` object’s library of easing functions


          //If it's not a spline, use one of the ordinary easing functions
          if (typeArray[0] !== "bounce") {
            curvedTime = this.easingFormulas[type](normalizedTime);
          }

          //If it's a spline, use the `spline` function and apply the
          //2 additional `type` array values as the spline's start and
          //end points
          else {
            curvedTime = this.easingFormulas.spline(normalizedTime, o.startMagnitude, 0, 1, o.endMagnitude);
          }

          //Interpolate the sprite's property based on the curve
          sprite[property] = (o.endValue * curvedTime) + (o.startValue * (1 - curvedTime));

          o.frameCounter += 1;
        }

        //When the tween has finished playing, run the end tasks
        else {
          sprite[property] = o.endValue;
          o.end();
        }
      }
    };

    //The `end` method will be called when the tween is finished
    o.end = () => {

      //Set `playing` to `false`
      o.playing = false;

      //Call the tween's `onComplete` method, if it's been assigned
      if (o.onComplete) o.onComplete();

      //Remove the tween from the `tweens` array
      this.globalTweens.splice(this.globalTweens.indexOf(o), 1);

      //If the tween's `yoyo` property is `true`, create a new tween
      //using the same values, but use the current tween's `startValue`
      //as the next tween's `endValue` 
      if (yoyo) {
        this.wait(delayBeforeRepeat).then(() => {
          o.start(o.endValue, o.startValue);
        });
      }
    };

    //Pause and play methods
    o.play = () => o.playing = true;
    o.pause = () => o.playing = false;

    //Return the tween object
    return o;
  }

  //`makeTween` is a general low-level method for making complex tweens
  //out of multiple `tweenProperty` functions. Its one argument,
  //`tweensToAdd` is an array containing multiple `tweenProperty` calls

  makeTween(tweensToAdd) {

    //Create an object to manage the tweens
    let o = {};

    //Create a `tweens` array to store the new tweens
    o.tweens = [];

    //Make a new tween for each array
    tweensToAdd.forEach(tweenPropertyArguments => {

      //Use the tween property arguments to make a new tween
      let newTween = this.tweenProperty(...tweenPropertyArguments);

      //Push the new tween into this object's internal `tweens` array
      o.tweens.push(newTween);
    });

    //Add a counter to keep track of the
    //number of tweens that have completed their actions
    let completionCounter = 0;

    //`o.completed` will be called each time one of the tweens
    //finishes
    o.completed = () => {

      //Add 1 to the `completionCounter`
      completionCounter += 1;

      //If all tweens have finished, call the user-defined `onComplete`
      //method, if it's been assigned. Reset the `completionCounter`
      if (completionCounter === o.tweens.length) {
        if (o.onComplete) o.onComplete();
        completionCounter = 0;
      }
    };

    //Add `onComplete` methods to all tweens
    o.tweens.forEach(tween => {
      tween.onComplete = () => o.completed();
    });

    //Add pause and play methods to control all the tweens
    o.pause = () => {
      o.tweens.forEach(tween => {
        tween.playing = false;
      });
    };
    o.play = () => {
      o.tweens.forEach(tween => {
        tween.playing = true;
      });
    };

    //Return the tween object
    return o;
  }

  /* High level tween methods */

  //1. Simple tweens

  //`fadeOut`
  fadeOut(sprite, frames = 60) {
    return this.tweenProperty(
      sprite, "alpha", sprite.alpha, 0, frames, "sine"
    );
  }

  //`fadeIn`
  fadeIn(sprite, frames = 60) {
    return this.tweenProperty(
      sprite, "alpha", sprite.alpha, 1, frames, "sine"
    );
  }

  //`pulse`
  //Fades the sprite in and out at a steady rate.
  //Set the `minAlpha` to something greater than 0 if you
  //don't want the sprite to fade away completely
  pulse(sprite, frames = 60, minAlpha = 0) {
    return this.tweenProperty(
      sprite, "alpha", sprite.alpha, minAlpha, frames, "smoothstep", true
    );
  }

  //2. Complex tweens

  slide(
    sprite, endX, endY,
    frames = 60, type = "smoothstep", yoyo = false, delayBeforeRepeat = 0
  ) {
    return this.makeTween([

      //Create the x axis tween
      [sprite, "x", sprite.x, endX, frames, type, yoyo, delayBeforeRepeat],

      //Create the y axis tween
      [sprite, "y", sprite.y, endY, frames, type, yoyo, delayBeforeRepeat]

    ]);
  }

  breathe(
    sprite, endScaleX = 0.8, endScaleY = 0.8,
    frames = 60, yoyo = true, delayBeforeRepeat = 0
  ) {

    //Add `scaleX` and `scaleY` properties to Pixi sprites
    this._addScaleProperties(sprite);

    return this.makeTween([

      //Create the scaleX tween
      [
        sprite, "scaleX", sprite.scaleX, endScaleX,
        frames, "smoothstepSquared", yoyo, delayBeforeRepeat
      ],

      //Create the scaleY tween
      [
        sprite, "scaleY", sprite.scaleY, endScaleY,
        frames, "smoothstepSquared", yoyo, delayBeforeRepeat
      ]
    ]);
  }

  scale(sprite, endScaleX = 0.5, endScaleY = 0.5, frames = 60) {

    //Add `scaleX` and `scaleY` properties to Pixi sprites
    this._addScaleProperties(sprite);

    return this.makeTween([

      //Create the scaleX tween
      [
        sprite, "scaleX", sprite.scaleX, endScaleX,
        frames, "smoothstep", false
      ],

      //Create the scaleY tween
      [
        sprite, "scaleY", sprite.scaleY, endScaleY,
        frames, "smoothstep", false
      ]
    ]);
  }

  strobe(
    sprite, scaleFactor = 1.3, startMagnitude = 10, endMagnitude = 20,
    frames = 10, yoyo = true, delayBeforeRepeat = 0
  ) {

    let bounce = "bounce " + startMagnitude + " " + endMagnitude;

    //Add `scaleX` and `scaleY` properties to Pixi sprites
    this._addScaleProperties(sprite);

    return this.makeTween([

      //Create the scaleX tween
      [
        sprite, "scaleX", sprite.scaleX, scaleFactor, frames,
        bounce, yoyo, delayBeforeRepeat
      ],

      //Create the scaleY tween
      [
        sprite, "scaleY", sprite.scaleY, scaleFactor, frames,
        bounce, yoyo, delayBeforeRepeat
      ]
    ]);
  }

  wobble(
    sprite,
    scaleFactorX = 1.2,
    scaleFactorY = 1.2,
    frames = 10,
    xStartMagnitude = 10,
    xEndMagnitude = 10,
    yStartMagnitude = -10,
    yEndMagnitude = -10,
    friction = 0.98,
    yoyo = true,
    delayBeforeRepeat = 0
  ) {

    let bounceX = "bounce " + xStartMagnitude + " " + xEndMagnitude;
    let bounceY = "bounce " + yStartMagnitude + " " + yEndMagnitude;

    //Add `scaleX` and `scaleY` properties to Pixi sprites
    this._addScaleProperties(sprite);

    let o = this.makeTween([

      //Create the scaleX tween
      [
        sprite, "scaleX", sprite.scaleX, scaleFactorX, frames,
        bounceX, yoyo, delayBeforeRepeat
      ],

      //Create the scaleY tween
      [
        sprite, "scaleY", sprite.scaleY, scaleFactorY, frames,
        bounceY, yoyo, delayBeforeRepeat
      ]
    ]);

    //Add some friction to the `endValue` at the end of each tween 
    o.tweens.forEach(tween => {
      tween.onComplete = () => {

        //Add friction if the `endValue` is greater than 1
        if (tween.endValue > 1) {
          tween.endValue *= friction;

          //Set the `endValue` to 1 when the effect is finished and 
          //remove the tween from the global `tweens` array
          if (tween.endValue <= 1) {
            tween.endValue = 1;
            this.removeTween(tween);
          }
        }
      };
    });

    return o;
  }

  //3. Motion path tweens

  followCurve(
    sprite,
    pointsArray,
    totalFrames,
    type = "smoothstep",
    yoyo = false,
    delayBeforeRepeat = 0
  ) {

    //Create the tween object
    let o = {};

    //If the tween is a bounce type (a spline), set the
    //start and end magnitude values
    let typeArray = type.split(" ");
    if (typeArray[0] === "bounce") {
      o.startMagnitude = parseInt(typeArray[1]);
      o.endMagnitude = parseInt(typeArray[2]);
    }

    //Use `tween.start` to make a new tween using the current
    //end point values
    o.start = (pointsArray) => {
      o.playing = true;
      o.totalFrames = totalFrames;
      o.frameCounter = 0;

      //Clone the points array
      o.pointsArray = JSON.parse(JSON.stringify(pointsArray));

      //Add the tween to the `globalTweens` array. The `globalTweens` array is
      //updated on each frame
      this.globalTweens.push(o);
    };

    //Call `tween.start` to start the first tween
    o.start(pointsArray);

    //The `update` method will be called on each frame by the game loop.
    //This is what makes the tween move
    o.update = () => {

      let normalizedTime, curvedTime,
        p = o.pointsArray;

      if (o.playing) {

        //If the elapsed frames are less than the total frames,
        //use the tweening formulas to move the sprite
        if (o.frameCounter < o.totalFrames) {

          //Find the normalized value
          normalizedTime = o.frameCounter / o.totalFrames;

          //Select the correct easing function

          //If it's not a spline, use one of the ordinary tween
          //functions
          if (typeArray[0] !== "bounce") {
            curvedTime = this.easingFormulas[type](normalizedTime);
          }

          //If it's a spline, use the `spline` function and apply the
          //2 additional `type` array values as the spline's start and
          //end points
          else {
            //curve = tweenFunction.spline(n, type[1], 0, 1, type[2]);
            curvedTime = this.easingFormulas.spline(normalizedTime, o.startMagnitude, 0, 1, o.endMagnitude);
          }

          //Apply the Bezier curve to the sprite's position 
          sprite.x = this.easingFormulas.cubicBezier(curvedTime, p[0][0], p[1][0], p[2][0], p[3][0]);
          sprite.y = this.easingFormulas.cubicBezier(curvedTime, p[0][1], p[1][1], p[2][1], p[3][1]);

          //Add one to the `elapsedFrames`
          o.frameCounter += 1;
        }

        //When the tween has finished playing, run the end tasks
        else {
          //sprite[property] = o.endValue;
          o.end();
        }
      }
    };

    //The `end` method will be called when the tween is finished
    o.end = () => {

      //Set `playing` to `false`
      o.playing = false;

      //Call the tween's `onComplete` method, if it's been
      //assigned
      if (o.onComplete) o.onComplete();

      //Remove the tween from the global `tweens` array
      this.globalTweens.splice(this.globalTweens.indexOf(o), 1);

      //If the tween's `yoyo` property is `true`, reverse the array and
      //use it to create a new tween
      if (yoyo) {
        this.wait(delayBeforeRepeat).then(() => {
          o.pointsArray = o.pointsArray.reverse();
          o.start(o.pointsArray);
        });
      }
    };

    //Pause and play methods
    o.pause = () => {
      o.playing = false;
    };
    o.play = () => {
      o.playing = true;
    };

    //Return the tween object
    return o;
  }

  walkPath(
    sprite, //The sprite
    originalPathArray, //A 2D array of waypoints
    totalFrames = 300, //The duration, in frames
    type = "smoothstep", //The easing type
    loop = false, //Should the animation loop?
    yoyo = false, //Shoud the direction reverse?
    delayBetweenSections = 0 //Delay, in milliseconds, between sections
  ) {

    //Clone the path array so that any possible references to sprite
    //properties are converted into ordinary numbers 
    let pathArray = JSON.parse(JSON.stringify(originalPathArray));

    //Figure out the duration, in frames, of each path section by 
    //dividing the `totalFrames` by the length of the `pathArray`
    let frames = totalFrames / pathArray.length;

    //Set the current point to 0, which will be the first waypoint
    let currentPoint = 0;

    //The `makePath` function creates a single tween between two points and
    //then schedules the next path to be made after it
    let makePath = (currentPoint) => {

      //Use the `makeTween` function to tween the sprite's
      //x and y position
      let tween = this.makeTween([

        //Create the x axis tween between the first x value in the
        //current point and the x value in the following point
        [
          sprite,
          "x",
          pathArray[currentPoint][0],
          pathArray[currentPoint + 1][0],
          frames,
          type
        ],

        //Create the y axis tween in the same way
        [
          sprite,
          "y",
          pathArray[currentPoint][1],
          pathArray[currentPoint + 1][1],
          frames,
          type
        ]
      ]);

      //When the tween is complete, advance the `currentPoint` by one.
      //Add an optional delay between path segments, and then make the
      //next connecting path
      tween.onComplete = () => {

        //Advance to the next point
        currentPoint += 1;

        //If the sprite hasn't reached the end of the
        //path, tween the sprite to the next point
        if (currentPoint < pathArray.length - 1) {
          this.wait(delayBetweenSections).then(() => {
            tween = makePath(currentPoint);
          });
        }

        //If we've reached the end of the path, optionally
        //loop and yoyo it
        else {

          //Reverse the path if `loop` is `true`
          if (loop) {

            //Reverse the array if `yoyo` is `true`
            if (yoyo) pathArray.reverse();

            //Optionally wait before restarting
            this.wait(delayBetweenSections).then(() => {

              //Reset the `currentPoint` to 0 so that we can
              //restart at the first point
              currentPoint = 0;

              //Set the sprite to the first point
              sprite.x = pathArray[0][0];
              sprite.y = pathArray[0][1];

              //Make the first new path
              tween = makePath(currentPoint);

              //... and so it continues!
            });
          }
        }
      };

      //Return the path tween to the main function
      return tween;
    };

    //Make the first path using the internal `makePath` function (below)
    let tween = makePath(currentPoint);

    //Pass the tween back to the main program
    return tween;
  }

  walkCurve(
    sprite, //The sprite
    pathArray, //2D array of Bezier curves
    totalFrames = 300, //The duration, in frames
    type = "smoothstep", //The easing type
    loop = false, //Should the animation loop?
    yoyo = false, //Should the direction reverse?
    delayBeforeContinue = 0 //Delay, in milliseconds, between sections
  ) {

    //Divide the `totalFrames` into sections for each part of the path
    let frames = totalFrames / pathArray.length;

    //Set the current curve to 0, which will be the first one
    let currentCurve = 0;

    //The `makePath` function
    let makePath = (currentCurve) => {

      //Use the custom `followCurve` function to make
      //a sprite follow a curve
      let tween = this.followCurve(
        sprite,
        pathArray[currentCurve],
        frames,
        type
      );

      //When the tween is complete, advance the `currentCurve` by one.
      //Add an optional delay between path segments, and then make the
      //next path
      tween.onComplete = () => {
        currentCurve += 1;
        if (currentCurve < pathArray.length) {
          this.wait(delayBeforeContinue).then(() => {
            tween = makePath(currentCurve);
          });
        }

        //If we've reached the end of the path, optionally
        //loop and reverse it
        else {
          if (loop) {
            if (yoyo) {

              //Reverse order of the curves in the `pathArray` 
              pathArray.reverse();

              //Reverse the order of the points in each curve
              pathArray.forEach(curveArray => curveArray.reverse());
            }

            //After an optional delay, reset the sprite to the
            //beginning of the path and make the next new path
            this.wait(delayBeforeContinue).then(() => {
              currentCurve = 0;
              sprite.x = pathArray[0][0];
              sprite.y = pathArray[0][1];
              tween = makePath(currentCurve);
            });
          }
        }
      };

      //Return the path tween to the main function
      return tween;
    };

    //Make the first path
    let tween = makePath(currentCurve);

    //Pass the tween back to the main program
    return tween;
  }

  //4. Utilities

  /*
  The `wait` method lets you set up a timed sequence of events

    wait(1000)
      .then(() => console.log("One"))
      .then(() => wait(1000))
      .then(() => console.log("Two"))
      .then(() => wait(1000))
      .then(() => console.log("Three"))

  */

  wait(duration = 0) {
    return new Promise((resolve, reject) => {
      setTimeout(resolve, duration);
    });
  }

  //A utility to remove tweens from the game
  removeTween(tweenObject) {

    //Remove the tween if `tweenObject` doesn't have any nested
    //tween objects
    if (!tweenObject.tweens) {
      tweenObject.pause();

      //array.splice(-1,1) will always remove last elemnt of array, so this
      //extra check prevents that (Thank you, MCumic10! https://github.com/kittykatattack/charm/issues/5)
      if (this.globalTweens.indexOf(tweenObject) != -1) {
        this.globalTweens.splice(this.globalTweens.indexOf(tweenObject), 1);
      }

      //Otherwise, remove the nested tween objects
    } else {
      tweenObject.pause();
      tweenObject.tweens.forEach(element => {
        this.globalTweens.splice(this.globalTweens.indexOf(element), 1);
      });
    }
  }

  update() {

    //Update all the tween objects in the `globalTweens` array
    if (this.globalTweens.length > 0) {
      for (let i = this.globalTweens.length - 1; i >= 0; i--) {
        let tween = this.globalTweens[i];
        if (tween) tween.update();
      }
    }
  }
}