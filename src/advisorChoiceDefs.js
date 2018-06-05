/**
 * Definitions for advisorChoice experiment.
 * Matt Jaquiery, Feb 2018
 */
"use strict";

import {DoubleDotGrid, Trial, Governor, utils, getGov} from './exploringSocialMetacognition.js';
import {advisorChoice} from "./analysis.js";
import debriefForm from "./debriefForm.js";

/**
 * Trial type identifiers
 * @type {{catch: number, force: number, choice: number}}
 */
const trialTypes = {
    catch: 0,
    force: 1,
    choice: 2
};

/**
 * Trial type names
 * @type {{}}
 */
const trialTypeNames = {
    [trialTypes.catch]: 'catch',
    [trialTypes.force]: 'force',
    [trialTypes.choice]: 'choice'
};

/**
 * @classdesc A dot task governor controls the dot display experiment functionality
 * @class
 * @augments Governor
 */
class DotTask extends Governor {
    /**
     * @constructor
     *
     * @param {Object} [args={}] - properties to assign to the Governor
     * @param {Trial[]} [args.trials=[]] - trial list
     * @param {Object[]} [args.miscTrials] - miscellaneous trials (breaks, instructions, etc)
     * @param {int} [args.currentTrialIndex=0] - index of current trial in trial list
     *
     * @param {int} [args.dotCount] - number of dots in a box
     * @param {int} [args.dotDifference] - half the difference between the dot counts in the two boxes; the difficulty
     * @param {int} [args.difficultyStep] - amount the difficulty increases/decreases after success/failure
     * @param {number} [args.minimumBlockScore] - lowest proportion of successful trials allowed on a block
     * @param {int} [args.blockCount] - number of blocks in the study
     * @param {int} [args.practiceBlockCount] - number of practice blocks
     * @param {Object|Object[]} [args.blockStructure] - the structure of each block, where each object is a series of [trialType: number of instances] mappings. Multiple objects represent different subblocks run consecutively.
     * @param {Object|Object[]} [args.practiceBlockStructure] - the structure of each practice block
     * @param {int} [args.preTrialInterval] - delay before each trial begins
     * @param {int} [args.preStimulusInterval] - fixation delay before the stimulus is displayed
     * @param {int} [args.stimulusDuration] - duration the dot stimulus is displayed
     * @param {int} [args.feedbackDuration] - duration of the feedback screen     *
     */
    constructor(args = {}) {
        super(args);
        this.dotCount = typeof args.dotCount === 'undefined'? null : args.dotCount;
        this.dotDifference = typeof args.dotDifference === 'undefined'? null : args.dotDifference;
        this.difficultyStep = typeof args.difficultyStep === 'undefined'? null : args.difficultyStep;
        this.minimumBlockScore = typeof args.minimumBlockScore === 'undefined'? null : args.minimumBlockScore;
        this.blockCount = typeof args.blockCount === 'undefined'? null : args.blockCount;
        this.practiceBlockCount = typeof args.practiceBlockCount === 'undefined'? null : args.practiceBlockCount;
        this.blockStructure = typeof args.blockStructure === 'undefined'? [
            {
                [trialTypes.catch]: 0,
                [trialTypes.choice]: 0,
                [trialTypes.force]: 0
            },
            {
                [trialTypes.catch]: 0,
                [trialTypes.choice]: 0,
                [trialTypes.force]: 0
            }
        ] : args.blockStructure;
        this.practiceBlockStructure = typeof args.practiceBlockStructure === 'undefined'? {
            [trialTypes.catch]: 0,
            [trialTypes.choice]: 0,
            [trialTypes.force]: 2
        } : args.practiceBlockStructure;
        this.preTrialInterval = typeof args.preTrialInterval === 'undefined'? null : args.preTrialInterval;
        this.preStimulusInterval = typeof args.preStimulusInterval === 'undefined'? null : args.preStimulusInterval;
        this.stimulusDuration = typeof args.stimulusDuration === 'undefined'? null : args.stimulusDuration;
        this.feedbackDuration = typeof args.feedbackDuration === 'undefined'? null : args.feedbackDuration;
    }

    /**
     * Do the actual drawing on the canvas.
     *
     * This function is called by the trial (supplied as stimulus). Query the Governor to get the details for
     * drawing.
     *
     * @param {string} canvasId - id of the canvas on which to draw the dots (supplied by the trial)
     */
    drawDots(canvasId) {
        let self = getGov(this);
        self.currentTrial.dotDifference = self.dotDifference;
        let low = self.dotCount - self.dotDifference;
        let high = self.dotCount + self.dotDifference;
        let dots = self.currentTrial.whichSide === 0 ? [high, low] : [low, high];
        let grid = new DoubleDotGrid(dots[0], dots[1], {
            spacing: 100
        });
        self.currentTrial.grid = grid;
        setTimeout(function () {
            self.currentTrial.fixationDrawTime.push(performance.now());
            DotTask.drawFixation(canvasId);
        }, self.preTrialInterval);
        setTimeout(function(){
            self.currentTrial.stimulusDrawTime.push(performance.now());
            grid.draw(canvasId);
        }, self.preTrialInterval+self.preStimulusInterval);
    }

    /**
     * Draw a fixation cross on *canvasId*
     * @param {string} canvasId - id of the canvas on which to draw
     */
    static drawFixation(canvasId) {
        let self = getGov(this);
        let ctx = document.querySelector('#'+canvasId).getContext('2d');
        let len = 5;
        ctx.strokeStyle = 'black';
        ctx.lineWidth = '2';
        ctx.beginPath();
        // horizontal
        ctx.moveTo((ctx.canvas.clientWidth/2)-len, ctx.canvas.clientHeight/2);
        ctx.lineTo((ctx.canvas.clientWidth/2)+len, ctx.canvas.clientHeight/2);
        ctx.stroke();
        // vertical
        ctx.strokeStyle = 'black';
        ctx.beginPath();
        ctx.moveTo(ctx.canvas.clientWidth/2, (ctx.canvas.clientHeight/2)-len);
        ctx.lineTo(ctx.canvas.clientWidth/2, (ctx.canvas.clientHeight/2)+len);
        ctx.stroke();
    }

    /**
     * Extract the answer from the plugin's response. The plugin provides indices of the last time a slider was
     * moved; the answer is simply the slider which was moved last.
     *
     * @param {Object} response - response field provided by the jspsych-canvas-sliders-response plugin
     */
    static getAnswerFromResponse(response) {
        // Which slider was moved last?
        let L = response[0].lastChangedTime;
        let R = response[1].lastChangedTime;
        if (isNaN(L) && isNaN(R))
            return NaN;
        if (isNaN(R))
            return 0;
        if (isNaN(L))
            return 1;
        return R > L ? 1 : 0;
    }

    /**
     * Return the confidence score associated with a given slider.
     *
     * @param {Object} response - response field provided by jspsych-canvas-sliders-response plugin
     * @param {int} answer - which slider's value to extract
     */
    static getConfidenceFromResponse(response, answer) {
        if (isNaN(response[answer].answer))
            return NaN;
        return parseInt(response[answer].answer);
    }

    /**
     * Sets a click function on the sliders which makes them behave as if they are moved to 50 when they are focussed.
     * self prevents users clicking on the slider, getting the visual feedback of the slider being activated and set,
     * and then being told they have not moved the slider.
     */
    setSliderClick() {
        let self = getGov(this);
        let sliders = document.querySelectorAll('.jspsych-sliders-response-slider');
        sliders.forEach(function (slider) {
            slider.addEventListener('click', function () {
                if (typeof self.clickFunctionRun !== 'undefined')
                    return;
                self.clickFunctionRun = true;
                if (self.value !== "50")
                    return;
                // send a change event
                let event = new Event('change');
                self.dispatchEvent(event);
            });
        });
        self.drawProgressBar();
    }

    /**
     * inject the proportion correct into the block feedback
     */
    blockFeedback(){
        let self = getGov(this);
        let block = self.currentTrial.block-1;
        let trialList = utils.getMatches(self.trials, (trial)=>{
            return trial.block === block;
        });
        let hitList = utils.getMatches(trialList, (trial)=>{
            let answer = trial.answer[1];
            if (answer === null)
                answer = trial.answer[0];
            return answer === trial.whichSide;
        });

        let score = hitList.length / trialList.length * 100;
        if (score < self.minimumBlockScore) {
            self.terminateExperiment(score);
        }
        let div = document.querySelector('#jspsych-content');
        let p = div.insertBefore(document.createElement('p'), div.querySelector('p'));
        p.innerText = "Your score on the last block was " + (Math.round(score*100)/100).toString() + "%.";
        self.drawProgressBar();
    }

    /**
     * Stop the experiment prematurely
     *
     * @param {number} score - score obtained on previous block
     */
    terminateExperiment(score = 0.0) {

    }

    /**
     * Return the category of the confidence offered in the trial with id *trialId*. Confidence category is 0, 1, or 2
     * depending upon whether the confidence is in the lower 30%, middle 40%, or upper 30% of trials.
     * @param {int} trialId - identifier of the trial
     * @param {Object} [args] - additional options object
     * @param {int} [args.nTrialsBack=null] - maximum number of trials to search
     * @param {boolean} [args.correctOnly=true] - whether to only extract confidence on correct trials
     * @param {boolean} [args.initialAnswerCorrect=true] - whether to test the inital (as opposed to final answer) correctness
     * @param {boolean} [args.initialConfidence=true] - whether to count the initial (as opposed to final) confidence
     */
    getConfidenceCategory(trialId, args) {
        let self = getGov(this);
        args = args || {};
        args.nTrialsBack = args.nTrialsBack || self.trials.length;
        args.correctOnly = typeof args.correctOnly === 'undefined'? true : args.correctOnly;
        args.initialAnswerCorrect = typeof args.initialAnswerCorrect? true : args.initialAnswerCorrect;
        args.initialConfidence = typeof args.initialConfidence? true : args.initialConfidence;
        let trialIndex = self.trials.indexOf(utils.getMatches(self.trials, function (trial) {
            return trial.id === trialId;
        })[0]);
        if (trialIndex === -1) {
            self.currentTrial.warnings.push('getConfidenceCategory: trial not found in self.trials');
            return 1;
        }
        let confidenceScore = self.trials[trialIndex].confidence[(args.initialConfidence? 0 : 1)];

        // collate valid trials
        let validTrials = [];
        for (let i=0; i<args.nTrialsBack; i++) {
            // stop if we run out of trials
            if (i+1 === trialIndex) {
                break;
            }
            let trial = self.trials[trialIndex-(i+1)];
            // have to have provided a confidence
            if (isNaN(trial.confidence[(args.initialConfidence? 0 : 1)]))
                continue;
            // have to be correct if we want only correct trials
            if (args.correctOnly && trial.answer[(args.initialAnswerCorrect? 0 : 1)] !== trial.whichSide)
                continue;
            validTrials.push(trial);
        }

        // Get confidence list
        let confidenceList = [];
        validTrials.forEach(function (trial) {
            confidenceList.push(trial.confidence[(args.initialConfidence? 0 : 1)]);
        });
        // Put it in order
        confidenceList.sort();
        // Find the markers at 30% and 70%
        let bounds = {
            low: confidenceList[Math.ceil(confidenceList.length*.3)],
            high: confidenceList[Math.floor(confidenceList.length*.7)]
        };

        // Protect against too few trials
        if (typeof bounds.low === 'undefined' || typeof bounds.high === 'undefined') {
            self.currentTrial.warnings.push('getConfidenceCategory: too few trials available to estimate confidence');
            return 1;
        }

        if (confidenceScore > bounds.low && confidenceScore < bounds.high)
            return 1;
        if (confidenceScore <= bounds.low)
            return 0;
        if (confidenceScore >= bounds.high)
            return 2;

        // Fallback
        self.currentTrial.warnings.push('getConfidenceCategory: confidence score ('+confidenceScore+') fell through ' +
            'bounds ['+bounds.low+', '+bounds.high+']');
    }

    /**
     * Get the confidence category of the last response
     * @param {Object} [args] - additional options object
     * @param {int} [args.nTrialsBack=null] - maximum number of trials to search
     * @param {boolean} [args.correctOnly=true] - whether to only extract confidence on correct trials
     * @param {boolean} [args.initialAnswerCorrect=true] - whether to test the inital (as opposed to final answer) correctness
     * @param {boolean} [args.initialConfidence=true] - whether to count the initial (as opposed to final) confidence
     */
    getLastConfidenceCategory(args) {
        let self = getGov(this);
        let last = utils.getMatches(self.trials, function (trial) {
            return !isNaN(trial.answer[0]);
        }).length-1;

        let cc = self.getConfidenceCategory(self.trials[last].id, args);
        self.trials[last].confidenceCategory = cc;
        return cc;
    }

    /**
     * Wrap up a trial. Store data, staircase difficulty, and prepare next trial.
     * @param {Object} trial - jsPsych plugin response
     */
    closeTrial(trial) {
        let self = getGov(this);
        // Feedback
        if (self.currentTrial.feedback) {
            if (self.currentTrial.answer[1] === self.currentTrial.whichSide ||
                (isNaN(self.currentTrial.answer[1]) && self.currentTrial.whichSide === self.currentTrial.answer[0]))
                document.querySelector('body').style.backgroundColor = 'white';
            else
                document.querySelector('body').style.backgroundColor = 'black';
        }
        // Staircasing stuff
        let warning = "";
        if (self.currentTrialIndex > 1) {
            // two-down one-up staircase
            let lastTrial = self.trials[self.currentTrialIndex-1];
            if (!self.currentTrial.getCorrect(false)) {
                // Wrong! Make it easier
                self.dotDifference += self.difficultyStep;
                if (self.dotDifference > self.dotCount-1) {
                    self.dotDifference = self.dotCount-1;
                    warning = "Difficulty at minimum!";
                }
            } else if (lastTrial.getCorrect(false) && self.currentTrial.getCorrect(false)) {
                // Two hits, impressive! Make it harder
                self.dotDifference -= self.difficultyStep;
                if (self.dotDifference < 1) {
                    self.dotDifference = 1;
                    warning = "Difficulty at maximum!";
                }
            }
        }
        if (warning.length > 0 && self.currentTrialIndex < self.trials.length) {
            self.currentTrial.warnings.push(warning);
            console.warn(warning);
        }
        // Move to next trial
        self.currentTrialIndex++;
    }
}

/**
 * @classdesc A dot task governor controls the dot display experiment functionality
 * @class
 * @augments DotTask
 */
class AdvisorChoice extends DotTask {
    /**
     * @constructor
     *
     * @param {Object} [args={}] - properties to assign to the Governor
     * @param {Trial[]} [args.trials=[]] - trial list
     * @param {Object[]} [args.miscTrials] - miscellaneous trials (breaks, instructions, etc)
     * @param {int} [args.currentTrialIndex=0] - index of current trial in trial list
     *
     * @param {int} [args.dotCount] - number of dots in a box
     * @param {int} [args.dotDifference] - half the difference between the dot counts in the two boxes; the difficulty
     * @param {int} [args.difficultyStep] - amount the difficulty increases/decreases after success/failure
     * @param {number} [args.minimumBlockScore] - lowest proportion of successful trials allowed on a block
     * @param {int} [args.blockCount] - number of blocks in the study
     * @param {int} [args.practiceBlockCount] - number of practice blocks
     * @param {Object|Object[]} [args.blockStructure] - the structure of each block, where each object is a series of [trialType: number of instances] mappings. Multiple objects represent different subblocks run consecutively.
     * @param {Object|Object[]} [args.practiceBlockStructure] - the structure of each practice block
     * @param {int} [args.preTrialInterval] - delay before each trial begins
     * @param {int} [args.preStimulusInterval] - fixation delay before the stimulus is displayed
     * @param {int} [args.stimulusDuration] - duration the dot stimulus is displayed
     * @param {int} [args.feedbackDuration] - duration of the feedback screen
     *
     * @param {Advisor[]} [args.advisors=[]] - list of advisors
     * @param {Advisor} [args.practiceAdvisor] - practice advisor
     * @param {[Advisor[]]} [args.advisorLists] - list of lists of advisors, each one being a set of advisors competing with one another in a block
     * @param {[Advisor[]]} [args.contingentAdvisors] - list of advisors to be used contingent on the confidence category of a response matching the list index
     * @param {[Advisor[]]} [args.questionnaireStack] - stack of advisors about whom questionnaires are to be asked
     *
     * @property {Advisor} currentAdvisor - advisor currently in focus
     * @property {Trial} currentTrial - trial currently underway
     */
    constructor(args = {}) {
        super(args);

        this.advisors = typeof args.advisors === 'undefined'? null : args.advisors;
        this.practiceAdvisor = typeof args.practiceAdvisor === 'undefined'? null : args.practiceAdvisor;
        this.advisorLists = typeof args.advisorLists === 'undefined'? null : args.advisorLists;
        this.contingentAdvisors = typeof args.contingentAdvisors === 'undefined'? null : args.contingentAdvisors;
        this.questionnaireStack = typeof args.questionnaireStack === 'undefined'? null : args.questionnaireStack;
        this.drawDebriefForm = debriefForm; // why is this in a separate file?
    }
    get currentAdvisor() {
        let self = getGov(this);
        return self.advisors[self.getAdvisorIndex(self.currentTrial.advisorId)];
    }

    getAdvisorIndex(id) {
        let self = getGov(this);
        for (let i=0; i<self.advisors.length; i++) {
            if (self.advisors[i].id === id)
                return i;
        }
        return null;
    }

    /**
     * Return a list of Trial objects.
     *
     * A large part of the work of defining the experiment takes place here, although the key properties are
     * actually defined in the Governor definition.
     *
     * The trials defined here are the master list used by the Governor to decide which stimuli to serve,
     * which advisor or choice to offer, etc. This list is **not necessarily the same as** the trial list
     * established at the beginning of the experiment and handed to jsPsych. It is therefore the responsibility
     * of the programmer to ensure that these lists are lawfully aligned such that the block structures, etc.
     * match.
     *
     * A possible alternative strategy - push new trials to the jsPsych timeline at
     * the end of each completed trial. Since we don't get nice progress bar this way we may as well use on-the-fly
     * timeline tweaking. This may just be more work to duplicate jsPsych's capabilities, though
     */
    getTrials() {
        let self = getGov(this);
        let trials = [];
        let id = 0;
        let realId = 0;
        let advisorSets = self.advisorLists.length;
        let blockCount = self.blockStructure.length * advisorSets;
        // Same for which side the correct answer appears on
        let whichSideDeck = utils.shuffleShoe([0, 1], advisorSets*utils.sumList(self.blockStructure));
        // Define trials
        for (let b=1; b<=self.practiceBlockCount+blockCount; b++) {
            let advisorSet = 0;
            let blockIndex = b;
            let advisorChoices = [];
            let advisorDeck = null;
            if (b > self.practiceBlockCount) {
                advisorSet = Math.floor((b-self.practiceBlockCount-1) / self.blockStructure.length);
                blockIndex = (b-self.practiceBlockCount-1)%self.blockStructure.length;
                advisorChoices = self.advisorLists[advisorSet];
                // Shuffle advisors so they appear an equal number of times
                advisorDeck = utils.shuffleShoe(advisorChoices,
                    self.blockStructure[blockIndex][trialTypes.force]);
            } else {
                advisorSet = NaN;
            }
            let blockLength = b<=self.practiceBlockCount? self.practiceBlockLength :
                utils.sumList(self.blockStructure[blockIndex]);
            // intro trials are a special case so the block length needs to be longer to accommodate them
            if (b === 1)
                blockLength += 3;
            // Work out what type of trial to be
            let trialTypeDeck = [];
            let structure = b<=self.practiceBlockCount? self.practiceBlockStructure : self.blockStructure[blockIndex];
            if (b === 1)
                structure = {0:0, 1:5, 2:0};
            for (let tt=0; tt<Object.keys(trialTypes).length; tt++) {
                for (let i=0; i<structure[tt]; i++)
                    trialTypeDeck.push(tt);
            }
            trialTypeDeck = utils.shuffle(trialTypeDeck);
            for (let i=1; i<=blockLength; i++) {
                id++;
                let isPractice = b<=self.practiceBlockCount;
                let trialType = trialTypeDeck.pop();
                let advisorId = 0;
                if (isPractice)
                    advisorId = id<=2? 0 : self.practiceAdvisor.id;
                else
                    advisorId = trialType === trialTypes.force? advisorDeck.pop().id : 0;
                let r = Math.random() < .5? 1 : 0;
                let choice = trialType === trialTypes.choice? [advisorChoices[r].id, advisorChoices[1-r].id] : [];
                trials.push(new Trial(id, {
                    type: trialType,
                    typeName: trialTypeNames[trialType],
                    block: b,
                    advisorSet,
                    advisorId,
                    choice,
                    answer: [NaN, NaN],
                    confidence: [NaN, NaN],
                    getCorrect: function(finalAnswer = true) {
                        let answer = finalAnswer? this.answer[1] : this.answer[0];
                        return answer === this.whichSide;
                    },
                    whichSide: isPractice? Math.round(Math.random()) : whichSideDeck[realId],
                    practice: isPractice,
                    feedback: isPractice,
                    warnings: [],
                    stimulusDrawTime: [],
                    stimulusOffTime: [],
                    fixationDrawTime: []
                }));
                if (!isPractice)
                    realId++;
            }
        }
        return trials;
    }

    /**
     * Show a ghost of the previous thumb placement to remind judges of their previous answer.
     */
    showMarker() {
        let self = getGov(this);
        let slider = document.querySelector('#jspsych-canvas-sliders-response-slider'+
            self.currentTrial.answer[0].toString());
        let marker = document.createElement('div');
        marker.className = 'advisorChoice-marker';
        slider.parentElement.appendChild(marker);

        let yOffset = slider.getBoundingClientRect().top;
        yOffset -= (marker.clientHeight - slider.clientHeight) / 2;
        yOffset += 1; // compensate for box shadow on the slider making things look off
        marker.style.top = yOffset.toString() + 'px';

        let xOffset = 0;
        if (self.currentTrial.answer[0] === 0) {
            // Left bar is scored in reverse
            xOffset = 100 - self.currentTrial.confidence[0];
        } else {
            xOffset = self.currentTrial.confidence[0];
        }
        marker.style.left = (slider.getBoundingClientRect().left +
            xOffset * (slider.clientWidth-marker.clientWidth) / 100).toString() + 'px';

        // and call the slider-click function because we only get one on_load call
        self.setSliderClick();
    }

    /**
     * Show advice over the stimulus presentation area
     */
    showAdvice(){
        let self = getGov(this);
        // Hack an advisor display in here with a directional indicator
        let div = document.querySelector('canvas').parentElement;
        div.innerHTML = "";
        let picDiv = div.appendChild(document.createElement('div'));
        picDiv.id = '#jspsych-jas-present-advice-choice-image';
        let textDiv = div.appendChild(document.createElement('div'));
        textDiv.id = '#jspsych-jas-present-advice-choice-prompt';
        let a = self.currentAdvisor;
        picDiv.innerHTML = a.portrait.outerHTML;
        textDiv.innerHTML = self.currentAdvisor.name.toUpperCase() + ": " + self.currentTrial.advice.string;
        // Set the class of the slider the advisor endorsed
        let slider = document.querySelector('#jspsych-sliders-response-slider-col' +
            self.currentTrial.advice.side);
        slider.className += ' advisor-endorsed';
        self.showMarker();
    }

    /**
     * Advisor choice function called by the jspsych-jas-present-advice-choice plugin.
     * Offer a choice of advisors by drawing clickable portraits.
     *
     * @param {HTMLElement} display_element - element within which to display the choices
     * @param {function} callback - function to call when a portrait is clicked. Called with the choice as an argument.
     */
    getAdvisorChoice(display_element, callback) {
        let self = getGov(this);
        let choices = self.currentTrial.choice;
        if (choices.length === 0) { // force and catch trials
            if (typeof self.currentAdvisor === 'undefined') {
                callback(-1); // catch trials
                return;
            } else {
                self.findAdvisorFromContingency();
                callback(self.currentAdvisor.id); // force trials
                return;
            }
        }
        // present choices
        let choiceImgs = [];
        for (let a=0; a<choices.length; a++) {
            let advisor = self.advisors[self.getAdvisorIndex(choices[a])];
            let img = document.createElement('img');
            img.className = 'advisorChoice-choice advisor-portrait';
            img.id = 'advisorChoice-choice-' + a.toString();
            img.src = advisor.portrait.src;
            img.addEventListener('click', function () {
                self.currentTrial.advisorId = choices[a];
                self.setAgreementVars();
                callback(choices[a]);
            });
            choiceImgs.push(img);
        }
        let p = document.createElement('p');
        p.innerText = 'Click on a portrait to hear the advisor\'s advice';
        p.className = 'advisorChoice-choice';
        display_element.appendChild(choiceImgs.pop());
        display_element.appendChild(p);
        display_element.appendChild(choiceImgs.pop());
    }

    /**
     * Ensure the participant did the intro trial correctly
     * @param {Object} trial - jsPsych plugin response
     *
     * @return {Boolean|void} false if trial should be repeated or void if okay
     */
    checkIntroResponse(trial) {
        let self = getGov(this);
        switch(self.currentTrialIndex) {
            case 0: // First practice - have to get it right (it's very easy)
                if(AdvisorChoice.getAnswerFromResponse(trial.response) !== self.currentTrial.whichSide) {
                    // redo the first trial
                    // returning false tells jsPsych to repeat the trial
                    return false;
                } else
                    return self.initialResponse(trial);
            default:
                return self.initialResponse(trial);
        }
    }

    /**
     * Process the judge's initial response
     * @param {Object} trial - jsPsych plugin response
     */
    initialResponse(trial) {
        let self = getGov(this);
        self.storePluginData(trial);
        self.currentTrial.stimulusOffTime.push(trial.stimulusOffTime);
        // trial is the complete trial object with its trial.response object
        self.currentTrial.answer[0] = AdvisorChoice.getAnswerFromResponse(trial.response);
        self.currentTrial.confidence[0]  = AdvisorChoice.getConfidenceFromResponse(trial.response, self.currentTrial.answer[0]);

        if (typeof self.currentAdvisor === 'undefined' && self.currentTrial.choice.length === 0) {
            self.closeTrial(trial);
        } else if (self.currentTrial.choice.length === 0)
            self.setAgreementVars();
    }

    /**
     * Determine whether the advisor in self trial is to agree or disagree with the judge
     */
    setAgreementVars() {
        let self = getGov(this);
        // Check the answer and dis/agree as appropriate
        if (self.currentAdvisor.agrees(self.currentTrial.getCorrect(false), self.getLastConfidenceCategory())) {
            self.currentTrial.advice = self.currentAdvisor.voice.getLineByFunction(function (line) {
                self.currentTrial.advisorAgrees = true;
                return line.side === self.currentTrial.whichSide;
            });
        } else {
            self.currentTrial.advice = self.currentAdvisor.voice.getLineByFunction(function (line) {
                self.currentTrial.advisorAgrees = false;
                let side = [1, 0][self.currentTrial.whichSide];
                return line.side === side;
            });
        }
    }

    /**
     * determine the advisor this trial should have on the basis of the confidence of the trial
     */
    findAdvisorFromContingency() {
        let self = getGov(this);
        // Only apply where advisor ID is specified already (i.e. force trials)
        if (self.currentTrial.advisorId === 0 || self.currentTrial.practice)
            return;
        // Determine confidence
        let cc = self.getConfidenceCategory(self.currentTrial.id);
        // Redraw advisor list if the answer was not valid
        let a = self.contingentAdvisors[cc].pop();
        if (typeof a === 'undefined' || self.advisorLists[self.currentTrial.advisorSet].indexOf(a) === -1) {
            self.redrawContingency(cc);
            self.findAdvisorFromContingency();
            return;
        }
        // Store advisor
        self.currentTrial.advisorId = a.id;
    }

    /**
     * produce a shuffled list of advisors to be used for the specified confidence category
     */
    redrawContingency(confidenceCategory) {
        let self = getGov(this);
        let advisors = self.advisorLists[self.currentTrial.advisorSet];
        let blockLength = utils.getMatches(self.trials, (trial)=>{
            return trial.block === self.currentTrial.block;
        }).length;
        self.contingentAdvisors[confidenceCategory] =
            utils.shuffleShoe(advisors, Math.ceil(blockLength/advisors.length));
    }

    /**
     * Process the judge's final response
     * @param {Object} trial - jsPsych plugin response
     */
    finalResponse(trial) {
        let self = getGov(this);
        self.currentTrial.stimulusOffTime.push(trial.stimulusOffTime); // always undefined - no stimulus!
        self.storePluginData(trial);
        self.currentTrial.answer[1] = AdvisorChoice.getAnswerFromResponse(trial.response);
        // empty responses are allowed 2nd time through (copy intial response)
        if (isNaN(self.currentTrial.answer[1])) {
            self.currentTrial.answer[1] = self.currentTrial.answer[0];
            self.currentTrial.confidence[1] = self.currentTrial.confidence[0];
        } else {
            self.currentTrial.confidence[1] = AdvisorChoice.getConfidenceFromResponse(trial.response, self.currentTrial.answer[1]);
        }
        self.closeTrial(trial);
    }

    /**
     * Draws the questionnaire portrait. Called by the jsPsych plugin
     *
     * @param {HTMLElement} display_element - element within which to draw the portrait
     * @param {Function} callback - function to execute when drawing is complete. Called with the portrait src
     */
    drawQuestionnaire(display_element, callback) {
        let self = getGov(this);
        // set some styling stuff
        let style = display_element.appendChild(document.createElement('style'));
        style.innerText = 'div#jspsych-function-sliders-response-stimulus {float:left; max-width:30%} ' +
            '.jspsych-sliders-response-container {max-width:100%} ' +
            '#jspsych-content {max-width: 1000px !important; display:flex; margin:auto;}' +
            '#advisorChoice-choice-stimulus {max-width:100%; display:block; position:relative; ' +
            'top:60%; left:10%; margin-top:-50%;}';

        let advisor = self.questionnaireStack.pop();
        self.lastQuestionnaireAdvisorId = advisor.id;
        let img = document.createElement('img');
        img.className = 'advisor-portrait';
        img.id = 'advisorChoice-choice-stimulus';
        img.src = advisor.portrait.src;
        display_element.appendChild(img);
        callback(img.src);
    }

    /**
     * Save the response to the questionnaire.
     */
    questionnaireResponse(trial) {
        let self = getGov(this);
        if (Object.keys(gov).indexOf('questionnaires') === -1)
            self.questionnaires = [];
        trial.afterTrial = self.currentTrialIndex-1;
        trial.advisorId = self.lastQuestionnaireAdvisorId;
        self.questionnaires.push(trial);
    }

    /**
     * submit the debrief form and finish the experiment
     *
     */
    debriefFormSubmit(form) {
        let self = getGov(this);
        let txt = form.querySelector('#debriefManipulationAnswer');
        if (txt.value.length===0) {
            txt.style.border = '1px solid red';
            return;
        }
        self.debrief = {
            manipulationQuestion: txt.value,
            comments: form.querySelector('#debriefCommentAnswer').value
        };
        document.querySelector('body').innerHTML = "";
        self.endExperiment();
    }

    feedback(data) {
        google.charts.load('current', {'packages':['corechart']});
        google.charts.setOnLoadCallback(function(){new advisorChoice().showFeedback(data)});
    }

    endExperiment() {
        let self = getGov(this);
        self.timeEnd = (new Date()).getTime();
        // reset background colour
        document.querySelector('body').style.backgroundColor = '';
        self.exportGovernor();
        self.feedback(gov);
    }
}

export {trialTypes, trialTypeNames, DotTask, AdvisorChoice};