/**
 * Exploring Social Metacognition
 * Matt Jaquiery, Feb 2018
 *
 * Javascript library for running social metacognition studies.
 */

window.ESM = {

    /**
     * Defines a pair of boxes with dots which are drawn on a canvas.
     */
    DoubleDotGrid: class {
        /**
         * @constructor
         * @param {int} nDotsL - number of dots in the left grid
         * @param {int} nDotsR - number of dots in the right grid
         * @param {Object} [args] - additional arguments.
         * @param {int} [args.gridWidth=20] - number of squares in a row
         * @param {int} [args.gridHeight=20] - number of squares in a column
         * @param {int} [args.dotWidth=2] - pixel width of each dot
         * @param {int} [args.dotHeight=2] - pixel height of each dot
         * @param {int} [args.paddingX=6] - horizontal padding of the squares (pixels)
         * @param {int} [args.paddingY=6] - vertical padding of the squares (pixels)
         * @param {int} [args.spacing=26] - spacing between the boxes
         */
        constructor(nDotsL, nDotsR, args = {}) {
            this.dotCountL = nDotsL;
            this.dotCountR = nDotsR;
            this.gridWidth = args.gridWidth || 20;
            this.gridHeight = args.gridHeight || 20;
            this.dotWidth = args.dotWidth || 2;
            this.dotHeight = args.dotHeight || 2;
            this.paddingX = args.paddingX || 6;
            this.paddingY = args.paddingY || 6;
            this.gridL = this.renewGrid(this.dotCountL);
            this.gridR = this.renewGrid(this.dotCountR);
            this.displayWidth = this.gridWidth * this.dotWidth + (this.gridWidth + 2) * this.paddingX;
            this.displayHeight = this.gridHeight * this.dotHeight + (this.gridHeight + 2) * this.paddingY;
            this.spacing = args.spacing || 26;
        };
        /** Create a grid
         * @param {int} dotCount - number of dots to place in the grid
         * @returns {int[]} A matrix of 0s with *dotCount* 1s inserted
         */
        renewGrid(dotCount) {
            let grid = [];
            for(let i=0; i<this.gridWidth; i++) {
                let row = [];
                for(let j=0; j<this.gridHeight; j++) {
                    row.push(0);
                }
                grid.push(row);
            }
            grid = this.populateGrid(grid, dotCount);
            return grid;
        };

        /** Populate a grid with dots
         * @param {int[]} grid - grid to populate
         * @param {int} dotCount - number of dots to populate *grid* with
         * @returns {int[]} *grid* populated with *dotCount* dots (1s)
         */
        populateGrid(grid, dotCount) {
            for(let i=0; i<dotCount; i++) {
                let x = Math.floor(Math.random()*this.gridWidth);
                let y = Math.floor(Math.random()*this.gridHeight);
                if(grid[x][y]===1)
                    i--;
                else
                    grid[x][y] = 1;
            }
            return grid;
        };

        /** Draw a grid onto an HTML canvas
         * @param {int[]} grid - grid to draw
         * @param {object} ctx - HTML canvas on which to draw
         * @param {boolean} offset - if *true*, draw offset horizontally by *this.spacing*
         */
        drawGrid(grid, ctx, offset) {
            let xMin = (offset)? this.spacing+this.displayWidth : 0;
            // Draw frame
            ctx.lineWidth = "3";
            ctx.rect(xMin, 0, this.displayWidth, this.displayHeight);
            ctx.stroke();
            // Draw dots
            ctx.lineWidth = "1";
            for(let x=0; x<this.gridWidth; x++) {
                for(let y=0; y<this.gridHeight; y++) {
                    if(grid[x][y] === 1) {
                        let startX = xMin + (x+1)*this.paddingX + x*this.dotWidth;
                        let startY = (y+1)*this.paddingY + y*this.dotHeight;
                        ctx.fillRect(startX, startY, this.dotWidth, this.dotHeight);
                        ctx.stroke();
                    }
                }
            }
        };

        draw(canvasId) {
            let canvas = document.getElementById(canvasId);
            let ctx = canvas.getContext('2d');
            this.drawGrid(this.gridL, ctx, false);
            this.drawGrid(this.gridR, ctx, true);
        };
    },


    /**
     * Lines belong to Voices and handle the audio files
     *
     *  Audio data for playing can be accessed via Line.data
     */
    Line: class {
        /**
         * @constructor
         *
         * @param {string} filePath - path to the audio file
         * @param {string} string - text of the audio file content
         * @param {boolean} skipPreload - whether to skip preloading the audio data into a buffer
         */
        constructor(filePath, string, skipPreload = false) {
            this.filePath = filePath;
            this.string = string;
            this.loaded = false;
            this.loading = false;
            this.data = null;
            this.buffer = null;

            if (skipPreload !== true)
                this.load();
        }

        /** Load the audio data
         *
         * @param {function} [callback=null] - function to execute with the Line as a parameter once loading completes.
         */
        load(callback = null) {
            this.loading = true;
            let self = this;
            console.log("Preloading "+self.filePath);
            let xhr = new XMLHttpRequest();
            xhr.open('GET', this.filePath);
            xhr.responseType = 'arraybuffer';
            xhr.onreadystatechange = function (response) {
                if (response.currentTarget.response === null)
                    return;
                self.data = response.currentTarget.response;
                self.decodeAudioData(callback);
            };
            xhr.send();
        }

        decodeAudioData(callback) {
            let audioCtx = new AudioContext();
            let self = this;
            audioCtx.decodeAudioData(this.data,
                function (buffer) {
                    self.buffer = buffer;
                    self.data = null;
                    self.loaded = true;
                    this.close();
                    if (typeof callback === "function")
                        callback(self);
                },
                function(e){
                    console.log("Error with decoding audio data" + e.err);
            });
        }

        /** Play the voice line */
        play() {
            if (this.loaded !== true) {
                console.warn("Attempted to play "+this.filePath+" before loading completed.");
                return;
            }
            let audioCtx = new AudioContext();
            let source = audioCtx.createBufferSource();
            source.buffer = this.buffer;
            source.connect(audioCtx.destination);
            source.start();
            source.onended = function() {
                // cleanup by closing the audio context
                this.context.close();
            };
            return true;
        }
    },
    /**
     * Voices belong to Advisors, and combine a voice and name.
     */
    Voice: class {
        /**
         * @constructor
         *
         * @param {int} voiceId - id of the voice
         */
        constructor(voiceId) {
            this.basePath = "";
            this.id = voiceId;
            this.name = this.getName(this.id);
            this.lines = this.getLines(this.id);
        }

        /**
         *
         * @param {int} id - voice identifier
         *
         * @returns {string} - name with which the voice introduces themself
         */
        getName(id) {
            switch(id) {
                case 1:
                    return "Annie";
                case 2:
                    return "Bea";
                case 3:
                    return "Sarah";
                default:
                    return "Name not found!"
            }
        }

        /**
         * Register and load audio files for this voice
         *
         * @param {int} id - voice identifier
         * @param {boolean} [skipPreload=false] - skip preloading the audio file
         * @returns {{think_left: Line, think_right: Line, left_think: Line, right_think: Line}}
         */
        getLines(id, skipPreload = false) {
            let pth = this.basePath + "assets/audio/voices/";
            return {
                think_left: new ESM.Line(pth + id.toString() + '/111.wav', "I think it was on the LEFT", skipPreload),
                think_right: new ESM.Line(pth + id.toString() + '/112.wav', "I think it was on the RIGHT", skipPreload),
                left_think: new ESM.Line(pth + id.toString() + '/121.wav', "It was on the LEFT, I think", skipPreload),
                right_think: new ESM.Line(pth + id.toString() + '/122.wav', "It was on the RIGHT, I think", skipPreload),
                intro: new ESM.Line(pth + id.toString() + '/intro.wav',
                    "Hello, my name is "+this.name.toUpperCase(), skipPreload)
            };
        }
    },


    /**
     * Advisors contain a portrait image, a voice+name combination, and advice-giving properties.
     */
    Advisor: class {
        /**
         * @constructor
         *
         * @param {int} id - identification number for this advisor
         * @param {int} adviceType - advice profile for this advisor. 0=default, 1=agree-in-confidence;
         *  2=agree-in-uncertainty
         * @param {Object|int} [voice=null] - voice object for the advisor. Either a voice object, or an into to pass
         *  to the Voice constructor. If blank, *id* is passed to the Voice constructor instead.
         * @param {int|string} [portrait=0] - identfier for the portrait image. If 0, *id* is used instead.
         */
        constructor(id, adviceType, voice = null, portrait = 0) {
            this.id = id;
            this.adviceType = adviceType;
            // Set agreement function
            this.getAgreementProbability = this.getAgreementFunction(this.id);
            // Fetch the voice
            if (voice !== null && typeof voice === 'object') {
                if (!(voice instanceof ESM.Voice))
                    throw("Cannot create advisor: supplied argument 'voice' not a Voice object.");
                else
                    this.voice = voice;
            } else {
                if (voice !== null)
                    this.voice = new ESM.Voice(voice);
                else
                    this.voice = new ESM.Voice(this.id);
            }
            // Hoist the name for ease-of-access
            this.name = this.voice.name;
            // Fetch the portrait
            let portraitId = portrait;
            if (portrait === 0)
                portraitId = this.id;
            this.portrait = new Image();
            this.portrait.src = "assets/image/advisor" + portraitId + ".jpg";
            this.portrait.id = 'advisor-portrait-' + portraitId;
        }

        /**
         * Agreement functions for the advisors
         * @param {int} adviceType - advice profile for the advisor
         * @returns {Function} - function producing a probability of agreement given judge's correctness and confidence
         */
        getAgreementFunction(adviceType) {
            switch(adviceType) {
                case 1: // Agree in Confidence
                    return function(judgeCorrect, judgeConfidenceCategory) {
                        if (judgeCorrect !== true)
                            return 0.3;
                        switch(judgeConfidenceCategory) {
                            case 0: // low confidence
                                return 0.6;
                            case 2: // high confidence
                                return 0.8;
                            default: // medium confidence
                                return 0.7;
                        }
                    };
                case 2: // Agree in Uncertainty
                    return function(judgeCorrect, judgeConfidenceCategory) {
                        if (judgeCorrect !== true)
                            return 0.3;
                        switch(judgeConfidenceCategory) {
                            case 2: // high confidence
                                return 0.6;
                            case 0: // low confidence
                                return 0.8;
                            default: // medium confidence
                                return 0.7;
                        }
                    };
                default:
                    return function(judgeCorrect) {
                        if (judgeCorrect !== true)
                            return 0.3;
                        return 0.7;
                    };
            }
        }

        /**
         * Return true if Advisor agrees with judgement
         *
         * @param {boolean} judgeCorrect - whether the judge's judgement was correct
         * @param {int} judgeConfidenceCategory - the category of the judge's confidence (0=low;1=med;2=high)
         * @returns {boolean} - whether Advisor agrees with judge
         */
        agrees(judgeCorrect, judgeConfidenceCategory) {
            return Math.random() < this.getAgreementProbability(judgeCorrect, judgeConfidenceCategory);
        }
    },

    /**
     * A Trial aggregates the information needed to run a single judge-advisor system trial.
     */
    Trial: class {
        constructor(id, args = {}) {
            for (let key in args) {
                if (args.hasOwnProperty(key))
                    this[key] = args[key];
            }
            this.id = id;
        }
    },


    /**
     * A Governor manages the overarching structure of the experiment. It should be assigned to a wide scope (e.g.
     *  window.gov = new ESM.Governor()) so that its properties can be accessed by functions in plugins.
     */
    Governor: class {
        /**
         * @constructor
         *
         * @param {object} [args={}] - properties to assign to the Governor
         * @param {Advisor[]} [args.advisors=[]] - advisor list
         * @param {int} [args.currentAdvisorIndex=0] - index of advisor for current trial
         * @param {Trial[]} [args.trials=[]] - trial list
         * @param {int} [args.currentTrialIndex=0] - index of current trial in trial list
         *
         * @property {Advisor} currentAdvisor - advisor currently in focus
         * @property {Trial} currentTrial - trial currently underway
         */
        constructor(args = {}) {
            for (let key in args) {
                if (args.hasOwnProperty(key))
                    this[key] = args[key];
            }
            this.advisors = args.advisors || [];
            this.currentAdvisorIndex = args.currentAdvisorIndex || 0;
            this.trials = args.trials || [];
            this.currentTrialIndex = args.currentTrialIndex || 0;

            this.currentAdvisor = this.advisors[this.currentAdvisorIndex];
            this.currentTrial = this.trials[this.currentTrialIndex];
        }
    }
};
