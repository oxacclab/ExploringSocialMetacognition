/**
 * Exploring Social Metacognition
 * Matt Jaquiery, Feb 2018
 *
 * Javascript library for running social metacognition studies.
 */


"use strict";

import processData from "./saveData.js";
import * as utils from "./utils.js";

/**
 * Defines a pair of boxes with dots which are drawn on a canvas.
 */
class DoubleDotGrid {
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

        // style properties
        this.style = {
            gridBorderColor: '#ffffff',
            gridBorderWidth: '3',
            dotColor: '#ffffff',
            dotLineWidth: '1'
        };
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
        ctx.beginPath();
        ctx.lineWidth = this.style.gridBorderWidth;
        ctx.strokeStyle = this.style.gridBorderColor;
        ctx.rect(xMin, 0, this.displayWidth, this.displayHeight);
        ctx.stroke();
        // Draw dots
        ctx.lineWidth = this.style.dotLineWidth;
        ctx.fillStyle = this.style.dotColor;
        for(let x=0; x<this.gridWidth; x++) {
            for(let y=0; y<this.gridHeight; y++) {
                if(grid[x][y] === 1) {
                    let startX = xMin + (x+1)*this.paddingX + x*this.dotWidth;
                    let startY = (y+1)*this.paddingY + y*this.dotHeight;
                    // alternating the color should prevent brightness being used as a proxy
                    //ctx.fillStyle = ctx.fillStyle==='#000000'? this.style.dotColor : '#000000';
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
}


/**
 * Lines belong to Voices and handle the audio files
 *
 *  Audio data for playing can be accessed via Line.data
 */
class Line {
    /**
     * @constructor
     *
     * @param {string|null} filePath - path to the audio file
     * @param {string} string - text of the audio file content
     * @param {int|null} side - whether the answer is 0=left or 1=right
     * @param confidence {int|null} - whether the answer is given with 0=low, 1=med, or 2=high confidence
     * @param {boolean} skipPreload - whether to skip preloading the audio data into a buffer
     */
    constructor(filePath, string, side, confidence, skipPreload = false) {
        this.filePath = filePath;
        this.string = string;
        this.loaded = false;
        this.loading = false;
        this.data = null;
        this.buffer = null;
        this.side = side;
        this.confidence = confidence;

        if (skipPreload !== true)
            this.load();
    }

    /** Load the audio data
     *
     * @param {function} [callback=null] - function to execute with the Line as a parameter once loading completes.
     */
    load(callback = null) {
        if (this.filePath === null)
            return;
        this.loading = true;
        let self = this;
        //console.log("Preloading "+self.filePath);
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
        try {
            let audioCtx = new AudioContext();
            let self = this;
            audioCtx.decodeAudioData(this.data,
                function (buffer) {
                    self.buffer = buffer;
                    self.data = null;
                    self.loaded = true;
                    if (typeof this !== 'undefined')
                       this.close();
                    if (typeof callback === "function")
                        callback(self);
                    // now the buffer is closed we can continue preloading another audio file
                    if (typeof gov.audioPreloadQueue !== 'undefined' && gov.audioPreloadQueue.length > 0) {
                        let queueItem = gov.audioPreloadQueue.pop();
                        queueItem.obj.decodeAudioData(queueItem.callback);
                    }
                },
                function(e){
                    console.log("Error with decoding audio data" + e.err);
                });
        } catch (err) {
            if (err.code === 9) {
                // DOMException
                // Trying to do too much at once, so add this to a queue and do it later
                if (typeof gov.audioPreloadQueue === 'undefined')
                    gov.audioPreloadQueue = [];
                gov.audioPreloadQueue.push({obj: this, callback});
            }
        }
    }

    /** Play the voice line */
    play() {
        if (this.filePath === null)
            return false;
        if (this.loaded !== true) {
            console.warn("Attempted to play "+this.filePath+" before loading completed.");
            return false;
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
}

/**
 * Voices belong to Advisors, and combine a voice and name.
 */
class Voice {
    /**
     * @constructor
     *
     * @param {int|null} voiceId - id of the voice
     * @param {boolean} skipAudioPreload - if false, audio files are preloaded where available
     */
    constructor(voiceId, skipAudioPreload = false) {
        this.basePath = "";
        this.id = voiceId;
        this.name = Voice.getName(this.id);
        this.nameHTML = '<span class="advisor-name">' + this.name + '</span>';
        this.skipAudioPreload = skipAudioPreload;
        this.lines = this.getLines();
    }

    /**
     *
     * @param {int} id - voice identifier
     *
     * @returns {string} - name with which the voice introduces themself
     */
    static getName(id) {
        if(id === null)
            id = Math.floor(Math.random()*10)+1; // random name from the full list
        switch(id) {
            case 1:
                return "Annie";
            case 2:
                return "Bea";
            case 3:
                return "Kate";
            case 4: // Names below do not have voice lines; they're only selected by silent advisors
                return "Sarah";
            case 5:
                return "Lisa";
            case 6:
                return "Heather";
            case 7:
                return "Julie";
            case 8:
                return "Beth";
            case 9:
                return "Pam";
            case 10:
                return "Emma";
            default:
                return "Name not found!"
        }
    }

    /**
     * Register and load audio files for this voice
     *
     * @returns {{think_left: Line, think_right: Line, left_think: Line, right_think: Line}}
     */
    getLines() {
        if(this.id===null || !Voice.hasFullAudio(this.id))
            return {
                think_left: new Line(null, "I think it was on the LEFT", 0, 0, true),
                think_right: new Line(null, "I think it was on the RIGHT", 1, 0, true),
                left_think: new Line(null, "It was on the LEFT, I think", 0, 0, true),
                right_think: new Line(null, "It was on the RIGHT, I think", 1, 0, true),
                intro: new Line(null, "Hello, my name is "+this.nameHTML, null, null, true)
            };
        let pth = this.basePath + "assets/audio/voices/" + this.id.toString() + '/';
        if(!this.skipAudioPreload)
            console.log('Preloading voice audio from ' + pth);
        return {
            think_left: new Line(pth + 'think_left.wav', "I think it was on the LEFT",
                0, 0, this.skipAudioPreload),
            think_right: new Line(pth + 'think_right.wav', "I think it was on the RIGHT",
                1, 0, this.skipAudioPreload),
            left_think: new Line(pth + 'left_think.wav', "It was on the LEFT, I think",
                0, 0, this.skipAudioPreload),
            right_think: new Line(pth + 'right_think.wav', "It was on the RIGHT, I think",
                1, 0, this.skipAudioPreload),
            intro: new Line(pth + 'intro.wav', "Hello, my name is "+this.nameHTML,
                null, null, this.skipAudioPreload)
        };
    }

    /**
     * Return a random Line from the set evaluating *func(line)* to true
     * @param {function} func - function to evaluate on a prospective line
     * @returns {Line} - random line from those passing the func check
     */
    getLineByFunction(func) {
        if(this.lines === null)
            return null;
        let options = [];
        for (let key in this.lines) {
            if (this.lines.hasOwnProperty(key))
                if (func(this.lines[key]))
                    options.push(this.lines[key]);
        }
        return options[Math.floor(Math.random()*options.length)];
    }

    /**
     * Return **true** if the specified voice id has full audio capabilities
     * @param {*} id - id number, or type cooercible to a number via parseInt(id.toString())
     * @return {boolean} - **true** if the specified voice id has full audio, otherwise **false**
     */
    static hasFullAudio(id) {
        if(id !== 'undefined' && id !== null){
            if(typeof id !== 'number')
                id = parseInt(id.toString());
            if(id >= 1 && id <= 3)
                return true;
        }
        return false;
    }
}

/**
 * Advisors contain a portrait image, a voice+name combination, and advice-giving properties.
 */
class Advisor {
    /**
     * @constructor
     *
     * @param {int|Object} id - identification number for this advisor, or a deparsed Advisor object to be regenerated
     * @param {int} [adviceType] - advice profile for this advisor. 0=default, 1=agree-in-confidence;
     *  2=agree-in-uncertainty
     * @param {Object|int} [voice=null] - voice object for the advisor. Either a voice object, or an int to pass
     *  to the Voice constructor. If blank, *id* is passed to the Voice constructor instead.
     * @param {int|string} [portrait=0] - identifier for the portrait image. If 0, *id* is used instead.
     * @param {Object} [args] - optional arguments
     * @param {boolean} [args.skipAudioPreload = false] - whether to skip preloading voice audio files
     * @param {int} [args.id]
     * @param {int} [args.adviceType]
     * @param {int} [args.voice.id] - the voice ID (nothing else needed to regenerate the voice)
     * @param {int} [args.portraitId] - the portrait ID
     * @param {string} [args.portraitSrc] - the portrait img src (nothing else needed to regenerate portrait)
     */
    constructor(id, adviceType, voice = null, portrait = 0, args = {}) {
        if(typeof id !== 'object') {
            // Create a new advisor
            this.id = id;
            this.adviceType = adviceType;
            // Fetch the voice
            if(typeof args.skipAudioPreload !== 'boolean')
                args.skipAudioPreload = false;
            if (voice !== null && typeof voice === 'object') {
                if (!(voice instanceof Voice))
                    throw("Cannot create advisor: supplied argument 'voice' not a Voice object.");
                else
                    this.voice = voice;
            } else {
                if (voice !== null)
                    this.voice = new Voice(voice, args.skipAudioPreload);
                else
                    this.voice = new Voice(null, args.skipAudioPreload);
            }
            // Fetch the portrait
            this.portraitId = portrait;
            if (portrait === 0)
                this.portraitId = this.id;
            this.portraitSrc = "assets/image/advisor" + this.portraitId + ".jpg";
        } else {
            // Regenerate an old advisor for feedback
            args = id;
            // default preloading audio to false
            let skipAudioPreload = typeof args.skipAudioPreload === 'boolean'? args.skipAudioPreload : false;
            this.id = args.id;
            this.adviceType = args.adviceType;
            this.voice = new Voice(args.voice.id, skipAudioPreload);
            this.portraitId = args.portraitId;
            this.portraitSrc = args.portraitSrc;
        }
        this.portrait = new Image();
        this.portrait.src = this.portraitSrc;
        this.portrait.className = 'advisor-portrait';
        this.portrait.id = 'advisor-portrait-' + this.portraitId;
    }

    /** Hoist the name for ease-of-access */
    get name() {return this.voice.name;}

    /** Access to the name with a classed span for styling */
    get nameHTML() {return this.voice.nameHTML;}

    /**
     * Agreement function for the advisor
     * @returns {Function} - function producing a probability of agreement given judge's correctness and confidence
     */
    get agreementFunction() {
        switch(this.adviceType) {
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
            case 3: // Extreme Agree in Confidence
                return function(judgeCorrect, judgeConfidenceCategory) {
                    if (judgeCorrect !== true)
                        return 0.3;
                    switch(judgeConfidenceCategory) {
                        case 0: // low confidence
                            return 0.5;
                        case 2: // high confidence
                            return 0.9;
                        default: // medium confidence
                            return 0.7;
                    }
                };
            case 4: // Extreme Agree in Uncertainty
                return function(judgeCorrect, judgeConfidenceCategory) {
                    if (judgeCorrect !== true)
                        return 0.3;
                    switch(judgeConfidenceCategory) {
                        case 2: // high confidence
                            return 0.5;
                        case 0: // low confidence
                            return 0.9;
                        default: // medium confidence
                            return 0.7;
                    }
                };
            case 5: // High accuracy
                return function() {
                    return 0.8;
                };
            case 6: // Low accuracy
                return function() {
                    return 0.6;
                };
            case 7: // High agreement
                return function(judgeCorrect) {
                   return judgeCorrect? 0.9 : 0.8;
                };
            case 8: // Low agreement
                return function(judgeCorrect) {
                    return judgeCorrect? 0.6 : 0.05;
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
     * Return a string describing policy of agreementType
     *
     * @param {int} agreementType
     * @returns {string}
     */
    static agreementTypeNames(agreementType) {
        switch(agreementType) {
            case 1:
            case 3:
                return "Agree in Confidence";
            case 2:
            case 4:
                return "Agree in Uncertainty";
            default:
                return "Balanced";
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
        return Math.random() < this.agreementFunction(judgeCorrect, judgeConfidenceCategory);
    }
}

/**
 * A Trial aggregates the information needed to run a single judge-advisor system trial.
 */
class Trial {
    constructor(id, args = {}) {
        for (let key in args) {
            if (args.hasOwnProperty(key))
                this[key] = args[key];
        }

        this.id = id;
        this.type = typeof args.type === 'undefined'? null : args.type;
        this.typeName = typeof args.typeName === 'undefined'? null : args.typeName;
        this.block = typeof args.block === 'undefined'? null : args.block;
        this.advisorSet = typeof args.advisorSet === 'undefined'? null : args.advisorSet;
        this.advisorId = typeof args.advisorId === 'undefined'? null : args.advisorId;
        this.choice = typeof args.choice === 'undefined'? null : args.choice;
        this.answer = typeof args.answer  === 'undefined'? null : args.answer ;
        this.confidence = typeof args.confidence === 'undefined'? null : args.confidence;
        this.confidenceCategory = typeof args.confidenceCategory === 'undefined'? null : args.confidenceCategory;
        this.advice = typeof args.advice === 'undefined'? null : args.advice;
        this.advisorAgrees = typeof args.advisorAgrees === 'undefined'? null : args.advisorAgrees;
        this.getCorrect = typeof args.getCorrect === 'undefined'? null : args.getCorrect;
        this.dotDifference = typeof args.dotDifference === 'undefined' ? null : args.dotDifference;
        this.whichSide = typeof args.whichSide === 'undefined'? null : args.whichSide;
        this.practice = typeof args.practice === 'undefined'? null : args.practice;
        this.feedback = typeof args.feedback === 'undefined'? null : args.feedback;
        this.warnings = typeof args.warnings === 'undefined'? []: args.warnings;
        this.stimulusDrawTime = typeof args.stimulusDrawTime === 'undefined'? null : args.stimulusDrawTime;
        this.stimulusOffTime = typeof args.stimulusOffTime === 'undefined'? null : args.stimulusOffTime;
        this.fixationDrawTime = typeof args.fixationDrawTime === 'undefined'? null : args.fixationDrawTime;
        this.pluginResponse = typeof args.pluginResponse === 'undefined'? [] : args.pluginResponse;
    }

    /**
     * Return a new copy of this object with each array flattened to make life easy for processing the data in R.
     * Non-array properties are preserved (including objects), but functions are dropped.
     *
     * @returns {Trial}
     * @constructor
     */
    get Rformat() {
        let out = new Trial(this.id);
        for (let key in this) {
            if (this.hasOwnProperty(key)) {
                if (Array.isArray(this[key])) {
                    this[key].forEach(function (e, i) {
                        out[key.toString()+i.toString()] = e;
                    });
                } else if (typeof this[key] !== 'function') {
                    out[key] = this[key];
                }
            }
        }
        return out;
    }
}

/**
 * A Governor manages the overarching structure of the experiment. It should be assigned to a wide scope (e.g.
 *  window.gov = new Governor()) so that its properties can be accessed by functions in plugins.
 */
class Governor {
    /**
     * @constructor
     *
     * @param {Object} [args={}] - properties to assign to the Governor
     * @param {Trial[]} [args.trials=[]] - trial list
     * @param {Object[]} [args.miscTrials] - miscellaneous trials (breaks, instructions, etc)
     * @param {int} [args.currentTrialIndex=0] - index of current trial in trial list
     * @param {string} [args.completionURL=''] - URL to which to refer participants for payment
     *
     */
    constructor(args = {}) {
        for (let key in args) {
            if (args.hasOwnProperty(key))
                this[key] = args[key];
        }
        this.trials = typeof args.trials === 'undefined'? [] : Governor.addTrials(args.trials);
        this.miscTrials = typeof args.miscTrials === 'undefined'? [] : args.miscTrials;
        this.currentTrialIndex = args.currentTrialIndex || 0;
        this.completionURL = typeof args.completionURL === 'undefined'? '' : args.completionURL;
        this.timeStart = (new Date).getTime();
    }

    /**
     * Upgrade stored trial details to genuine trials
     * @param {Object[]} trials - trials stored as JSON-compressed objects
     * @return {Trial[]} - trials expanded to be Trial objects
     */
    static addTrials(trials) {
        let out = [];
        for(let i=0; i<trials.length; i++) {
            if(trials[0].constructor.name === "Trial")
                out[i] = trials[0];
            else
                out[i] = new Trial(trials[i].id, trials[i]);
        }
        return out;
    }

    /**
     * @return {Trial} - the current trial
     */
    get currentTrial() {return this.trials[this.currentTrialIndex];}

    /**
     * Compile the data in this governor ready for sending, including a processed form
     * @return {Object} a JSON object with JSON strings containing rawData and processedData
     */
    compileSelf() {
        return {
            rawData: JSON.stringify(this),
            processedData: JSON.stringify(processData(this))
        }
    }


    /**
     * Send all the data in the governor object to a backend which will save it to a file.
     */
    exportGovernor() {
        let ask = new XMLHttpRequest();
        ask.open('POST', '../saveData.php', true);

        ask.onreadystatechange = function() {
            if (this.readyState===4 && this.status===200) {
                let text = "";
                try {
                    text = JSON.parse(this.responseText);
                } catch(e) {
                    text = this.responseText;
                }
                console.log(text);
            }
        };
        ask.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        let info = encodeURI('data='+JSON.stringify(this.compileSelf()));
        ask.send(info);
        /*
        ask.send();*/
    }

    /**
     * Save the data sent from the plugin in the Trial object
     *
     * @param {Object} pluginData - response data sent by a jsPsych plugin
     */
    storePluginData(pluginData) {
        if (Object.keys(this.currentTrial).indexOf('pluginResponse') === -1)
            this.currentTrial.pluginResponse = [];
        // Save this trial data (jspsych would do this for us, but we have access to a bunch of stuff it doesn't
        this.currentTrial.pluginResponse.push(pluginData);
    }

    /**
     * Storage function for any trial not otherwise handled (e.g. breaks, instructions) so we don't lose their timings.
     */
    storeMiscTrialData(trial) {
        this.miscTrials.push(trial);
    }

    /**
     * Draw a progress bar at the top of the screen
     */
    drawProgressBar() {
        if (document.querySelector('#jspsych-progressbar-container') === null) {
            let div = document.createElement('div');
            div.id = 'jspsych-progressbar-container';
            let outer = document.createElement('div');
            outer.id = 'progressbar-outer';
            div.appendChild(outer);
            let inner = document.createElement('div');
            inner.id = 'progressbar-inner';
            outer.appendChild(inner);
            let content = document.querySelector('.jspsych-content-wrapper');
            content.parentElement.insertBefore(div, content);
            let numDiv = document.createElement('div');
            numDiv.id = 'progressbar-number';
            outer.appendChild(numDiv);
        }
        let inner = document.querySelector('#progressbar-inner');
        inner.style.width = ((this.trials.indexOf(this.currentTrial)/this.trials.length)*100).toString()+'%';
        let numDiv = document.querySelector('#progressbar-number');
        numDiv.innerHTML = this.currentTrialIndex + ' / ' + this.trials.length;
        document.querySelector('body').style.backgroundColor = '';
    }
}

export {DoubleDotGrid, Advisor, Trial, Line, Voice, Governor, utils};
