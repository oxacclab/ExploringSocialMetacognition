/**
 * Definitions for advisorChoice experiment.
 * Matt Jaquiery, Feb 2018
 */
"use strict";

import {DoubleDotGrid, Trial, Governor, Advisor, utils} from './exploringSocialMetacognition.js';
import {advisorChoice} from "./analysis.js";
import debriefForm from "./debriefForm.js";
//import processData from "./saveData.js";

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
     * @param {string} [args.completionURL=''] - URL to which to refer participants for payment
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
        this.currentTrial.dotDifference = this.dotDifference;
        let low = this.dotCount - this.dotDifference;
        let high = this.dotCount + this.dotDifference;
        let dots = this.currentTrial.whichSide === 0 ? [high, low] : [low, high];
        let grid = new DoubleDotGrid(dots[0], dots[1], {
            spacing: 100
        });
        this.currentTrial.grid = grid;
        let self = this;
        setTimeout(function () {
            self.currentTrial.fixationDrawTime.push(performance.now());
            DotTask.drawFixation(canvasId);
        }, this.preTrialInterval);
        setTimeout(function(){
            self.currentTrial.stimulusDrawTime.push(performance.now());
            grid.draw(canvasId);
        }, this.preTrialInterval+this.preStimulusInterval);
    }

    /**
     * Draw a fixation cross on *canvasId*
     * @param {string} canvasId - id of the canvas on which to draw
     */
    static drawFixation(canvasId) {
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
     * Extract the answer from the plugin's response. The plugin provides a value from 1-100,
     * values 0-49 indicate 'left', 50-100 indicate 'right'.
     *
     * @param {Object} response - response field provided by the jspsych-canvas-sliders-response plugin
     *
     * @return {int} 1 for a rightward response, 0 for a leftward response
     */
    static getAnswerFromResponse(response) {
        let ans = parseInt(response[0].answer);
        if(ans === 50)
            return NaN;
        return ans > 50 ? 1 : 0;
    }

    /**
     * Return the confidence score associated with a given slider.
     *
     * @param {Object} response - response field provided by jspsych-canvas-sliders-response plugin
     * @param {int} side - which side the answer was on (1 = right, 0 = left)
     *
     * @return {int} Confidence of the response from 1-50
     */
    static getConfidenceFromResponse(response, side) {
        let ans = parseInt(response[0].answer);
        if (isNaN(ans))
            return NaN;
        return parseInt(ans) - (51 * side) + 1;
    }

    /**
     * Sets a click function on the sliders which makes them behave as if they are moved to 50 when they are focussed.
     * This prevents users clicking on the slider, getting the visual feedback of the slider being activated and set,
     * and then being told they have not moved the slider.
     *
     * @param {bool} drawMiddleBar - whether to draw the middle bar on the questionnaire
     */
    setSliderClick(drawMiddleBar = true) {
        let sliders = document.querySelectorAll('.jspsych-sliders-response-slider');
        sliders.forEach(function (slider) {
            slider.addEventListener('click', function () {
                if (typeof this.clickFunctionRun !== 'undefined')
                    return;
                this.clickFunctionRun = true;
                if (this.value !== "50")
                    return;
                // send a change event
                let event = new Event('change');
                this.dispatchEvent(event);
            });
            if(drawMiddleBar === true) {
                // Add a visual indicator to the middle of the slider to show the excluded zone
                let parent = slider.parentElement;
                let marker = document.createElement('div');
                marker.className = 'advisorChoice-middleBar advisorChoice-marker';
                parent.appendChild(marker);

                let yOffset = slider.clientHeight + 7;
                // Massive HACK for Edge doing sliders differently
                if(window.navigator.userAgent.indexOf("Edge") > -1)
                    yOffset -= 21;
                marker.style.top = -yOffset.toString() + 'px';

                let xOffset = slider.clientWidth/2 - marker.clientWidth/2;
                marker.style.left = xOffset.toString() + 'px';
            }
        });
        this.drawProgressBar();
    }

    /**
     * inject the proportion correct into the block feedback
     */
    blockFeedback(){
        let block = this.currentTrial.block-1;
        let trialList = utils.getMatches(this.trials, (trial)=>{
            return trial.block === block;
        });
        let hitList = utils.getMatches(trialList, (trial)=>{
            let answer = trial.answer[1];
            if (answer === null)
                answer = trial.answer[0];
            return answer === trial.whichSide;
        });

        let score = hitList.length / trialList.length * 100;
        if (score < this.minimumBlockScore) {
            this.terminateExperiment(score);
            return;
        }
        let div = document.querySelector('#jspsych-content');
        let p = div.insertBefore(document.createElement('p'), div.querySelector('p'));
        p.innerText = "Your score on the last block was " + (Math.round(score*100)/100).toString() + "%.";
        this.drawProgressBar();
    }

    /**
     * Stop the experiment prematurely
     *
     * @param {number} score - score obtained on previous block
     */
    terminateExperiment(score = 0.0) {
        let div = document.querySelector('#jspsych-content');
        div.innerHTML = "<p>Your score on the last block was " + (Math.round(score*100)/100).toString() + "%.</p>" +
        "<p>This is below the score required to continue with the study, so your participation has been ended prematurely.</p>";
        div.classList.add('terminated');
        this.drawProgressBar();
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
        args = args || {};
        args.nTrialsBack = args.nTrialsBack || this.trials.length;
        args.correctOnly = typeof args.correctOnly === 'undefined'? true : args.correctOnly;
        args.initialAnswerCorrect = typeof args.initialAnswerCorrect? true : args.initialAnswerCorrect;
        args.initialConfidence = typeof args.initialConfidence? true : args.initialConfidence;
        let trialIndex = this.trials.indexOf(utils.getMatches(this.trials, function (trial) {
            return trial.id === trialId;
        })[0]);
        if (trialIndex === -1) {
            this.currentTrial.warnings.push('getConfidenceCategory: trial not found in this.trials');
            return 1;
        }
        let confidenceScore = this.trials[trialIndex].confidence[(args.initialConfidence? 0 : 1)];

        // collate valid trials
        let validTrials = [];
        for (let i=0; i<args.nTrialsBack; i++) {
            // stop if we run out of trials
            if (i+1 === trialIndex) {
                break;
            }
            let trial = this.trials[trialIndex-(i+1)];
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
            this.currentTrial.warnings.push('getConfidenceCategory: too few trials available to estimate confidence');
            return 1;
        }

        if (confidenceScore > bounds.low && confidenceScore < bounds.high)
            return 1;
        if (confidenceScore <= bounds.low)
            return 0;
        if (confidenceScore >= bounds.high)
            return 2;

        // Fallback
        this.currentTrial.warnings.push('getConfidenceCategory: confidence score ('+confidenceScore+') fell through ' +
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
        let last = utils.getMatches(this.trials, function (trial) {
            return !isNaN(trial.answer[0]);
        }).length-1;

        let cc = this.getConfidenceCategory(this.trials[last].id, args);
        this.trials[last].confidenceCategory = cc;
        return cc;
    }

    /**
     * Wrap up a trial. Store data, staircase difficulty, and prepare next trial.
     * @param {Object} trial - jsPsych plugin response
     */
    closeTrial(trial) {
        // Feedback
        if (this.currentTrial.feedback) {
            if (this.currentTrial.answer[1] === this.currentTrial.whichSide ||
                (isNaN(this.currentTrial.answer[1]) && this.currentTrial.whichSide === this.currentTrial.answer[0]))
                document.querySelector('body').style.backgroundColor = 'white';
            else
                document.querySelector('body').style.backgroundColor = 'black';
        }
        // Staircasing stuff
        let warning = "";
        if (this.currentTrialIndex > 1) {
            // two-down one-up staircase
            let lastTrial = this.trials[this.currentTrialIndex-1];
            if (!this.currentTrial.getCorrect(false)) {
                // Wrong! Make it easier
                this.dotDifference += this.difficultyStep;
                if (this.dotDifference > this.dotCount-1) {
                    this.dotDifference = this.dotCount-1;
                    warning = "Difficulty at minimum!";
                }
            } else if (lastTrial.getCorrect(false) && this.currentTrial.getCorrect(false)) {
                // Two hits, impressive! Make it harder
                this.dotDifference -= this.difficultyStep;
                if (this.dotDifference < 1) {
                    this.dotDifference = 1;
                    warning = "Difficulty at maximum!";
                }
            }
        }
        if (warning.length > 0 && this.currentTrialIndex < this.trials.length) {
            this.currentTrial.warnings.push(warning);
            console.warn(warning);
        }
        // Move to next trial
        this.currentTrialIndex++;
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
     * @param {string} [args.completionURL=''] - URL to which to refer participants for payment
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

        this.advisors = typeof args.advisors === 'undefined'? null : AdvisorChoice.addAdvisors(args.advisors);
        this.practiceAdvisor = typeof args.practiceAdvisor === 'undefined'? null : args.practiceAdvisor;
        this.advisorLists = typeof args.advisorLists === 'undefined'? null : args.advisorLists;
        this.contingentAdvisors = typeof args.contingentAdvisors === 'undefined'? null : args.contingentAdvisors;
        this.questionnaireStack = typeof args.questionnaireStack === 'undefined'? null : args.questionnaireStack;
        this.drawDebriefForm = debriefForm; // why is this in a separate file?
    }

    /**
     * Upgrade stored advisor details to genuine advisors
     * @param {Object[]} advisors - advisors stored as JSON-compressed objects
     * @return {Advisor[]} - advisors expanded to be Advisor objects
     */
    static addAdvisors(advisors) {
        let out = [];
        for(let i=0; i<advisors.length; i++) {
            if(advisors[i].constructor.name === "Advisor")
                out[i] = advisors[i];
            else
                out[i] = new Advisor(advisors[i]);
        }
        return out;
    }

    /**
     * @return {Advisor} - The advisor registered for the current trial
     */
    get currentAdvisor() {
        return this.advisors[this.getAdvisorIndex(this.currentTrial.advisorId)];
    }

    /**
     * Return the index of an advisor in the advisors list
     * @param {int} id - id of the advisor whose index is required
     * @return {int} - index of the advisor in the advisors list
     */
    getAdvisorIndex(id) {
        for (let i=0; i<this.advisors.length; i++) {
            if (this.advisors[i].id === id)
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
        let trials = [];
        let id = 0;
        let realId = 0;
        let advisorSets = this.advisorLists.length;
        let blockCount = this.blockStructure.length * advisorSets;
        // Same for which side the correct answer appears on
        let whichSideDeck = utils.shuffleShoe([0, 1], advisorSets*utils.sumList(this.blockStructure));
        // Define trials
        for (let b=1; b<=this.practiceBlockCount+blockCount; b++) {
            let advisorSet = 0;
            let blockIndex = b;
            let advisorChoices = [];
            let advisorDeck = null;
            if (b > this.practiceBlockCount) {
                advisorSet = Math.floor((b-this.practiceBlockCount-1) / this.blockStructure.length);
                blockIndex = (b-this.practiceBlockCount-1)%this.blockStructure.length;
                advisorChoices = this.advisorLists[advisorSet];
                // Shuffle advisors so they appear an equal number of times
                advisorDeck = utils.shuffleShoe(advisorChoices,
                    this.blockStructure[blockIndex][trialTypes.force]);
            } else {
                advisorSet = NaN;
            }
            let blockLength = b<=this.practiceBlockCount? this.practiceBlockLength :
                utils.sumList(this.blockStructure[blockIndex]);
            // intro trials are a special case so the block length needs to be longer to accommodate them
            if (b === 1)
                blockLength += 4;
            // Work out what type of trial to be
            let trialTypeDeck = [];
            let structure = b<=this.practiceBlockCount? this.practiceBlockStructure : this.blockStructure[blockIndex];
            if (b === 1)
                structure = {0:0, 1:5, 2:0};
            for (let tt=0; tt<Object.keys(trialTypes).length; tt++) {
                for (let i=0; i<structure[tt]; i++)
                    trialTypeDeck.push(tt);
            }
            trialTypeDeck = utils.shuffle(trialTypeDeck);
            for (let i=1; i<=blockLength; i++) {
                id++;
                let isPractice = b<=this.practiceBlockCount;
                let trialType = trialTypeDeck.pop();
                let advisorId = 0;
                if (isPractice)
                    advisorId = id<=3? 0 : this.practiceAdvisor.id;
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
        let slider = document.querySelector('#jspsych-canvas-sliders-response-slider0');
        let marker = document.createElement('div');
        marker.className = 'advisorChoice-marker advisorChoice-prevAnswer';
        slider.parentElement.appendChild(marker);

        let yOffset = -marker.clientHeight;
        yOffset += 1; // compensate for box shadow on the slider making things look off
        // Massive HACK to compensate for Edge drawing sliders differently
        if(window.navigator.userAgent.indexOf("Edge") > -1)
            yOffset -= 21;
        marker.style.top = yOffset.toString() + 'px';

        let xOffset = this.currentTrial.answer[0] === 1? slider.clientWidth/2 : 0;
        xOffset -= marker.clientWidth/2;
        marker.style.left = (xOffset + this.currentTrial.confidence[0] * (slider.clientWidth-marker.clientWidth)
            / 100).toString() + 'px';

        // and call the slider-click function because we only get one on_load call
        this.setSliderClick();
    }

    /* Check the initial response to ensure that the participant hasn't selected neither answer.
     * @param {Object} trialresponse - potential response from the plugin
     * @return true to allow the response through, false to prevent it
     */
    checkResponse(trialresponse) {
        let okay = trialresponse.response[0].answer!=="50";
        if(okay)
            return true;
        // Add a warning and reject response
        document.querySelector('#jspsych-canvas-sliders-response-warnings').innerHTML =
            "<span style='color: red'>Please choose one side or the other.</span>";
        return false;
    }

    /**
     * Show advice over the stimulus presentation area
     */
    showAdvice(){
        // Hack an advisor display in here with a directional indicator
        let div = document.querySelector('canvas').parentElement;
        div.innerHTML = "";
        let picDiv = div.appendChild(document.createElement('div'));
        picDiv.id = 'jspsych-jas-present-advice-choice-image';
        let textDiv = div.appendChild(document.createElement('div'));
        textDiv.id = 'jspsych-jas-present-advice-choice-prompt';
        let a = this.currentAdvisor;
        picDiv.innerHTML = a.portrait.outerHTML;
        textDiv.innerHTML = this.currentAdvisor.nameHTML + ': ' + this.currentTrial.advice.string;
        // Set the class of the slider the advisor endorsed
        let labelID = this.currentTrial.advice.side === 0? 0 : 2;
        let sliderLabel = document.querySelector('#jspsych-canvas-sliders-response-labelS0L' +
            labelID);
        sliderLabel.classList.add('advisor-endorsed');
        this.showMarker();
    }

    /**
     * Advisor choice function called by the jspsych-jas-present-advice-choice plugin.
     * Offer a choice of advisors by drawing clickable portraits.
     *
     * @param {HTMLElement} display_element - element within which to display the choices
     * @param {function} callback - function to call when a portrait is clicked. Called with the choice as an argument.
     */
    getAdvisorChoice(display_element, callback) {
        let choices = this.currentTrial.choice;
        if (choices.length === 0) { // force and catch trials
            if (typeof this.currentAdvisor === 'undefined') {
                callback(-1); // catch trials
                return;
            } else {
                this.findAdvisorFromContingency();
                callback(this.currentAdvisor.id); // force trials
                return;
            }
        }
        // present choices
        let choiceImgs = [];
        let self = this;
        for (let a=0; a<choices.length; a++) {
            let advisor = this.advisors[this.getAdvisorIndex(choices[a])];
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
        switch(this.currentTrialIndex) {
            case 0: // First practice - have to get it right (it's very easy)
                if(AdvisorChoice.getAnswerFromResponse(trial.response) !== this.currentTrial.whichSide) {
                    // redo the first trial
                    // returning false tells jsPsych to repeat the trial
                    return false;
                } else
                    return this.initialResponse(trial);
            default:
                return this.initialResponse(trial);
        }
    }

    /**
     * Process the judge's initial response
     * @param {Trial} trial - jsPsych plugin response
     * @param {Object} [args={}] - assorted arguments to customize behaviour
     * @param {boolean} [args.advisorAlwaysCorrect - whether to override advisor's behaviour and force them to advice the correct response
     */
    initialResponse(trial, args={}) {
        this.storePluginData(trial);
        this.currentTrial.stimulusOffTime.push(trial.stimulusOffTime);
        // trial is the complete trial object with its trial.response object
        this.currentTrial.answer[0] = AdvisorChoice.getAnswerFromResponse(trial.response);
        this.currentTrial.confidence[0]  = AdvisorChoice.getConfidenceFromResponse(trial.response, this.currentTrial.answer[0]);

        if (typeof this.currentAdvisor === 'undefined' && this.currentTrial.choice.length === 0) {
            this.closeTrial(trial);
        } else if (this.currentTrial.choice.length === 0)
            if(typeof args.advisorAlwaysCorrect !== "undefined" && args.advisorAlwaysCorrect === true)
                this.setAgreementVars(true);
            else
                this.setAgreementVars();
    }

    /**
     * Determine whether the advisor in this trial is to agree or disagree with the judge
     * @param [alwaysCorrect=false] - whether the advisor is always correct
     */
    setAgreementVars(alwaysCorrect = false) {
        let self = this;
        let agree = false;
        if(alwaysCorrect === true)
            agree = this.currentTrial.getCorrect(false);
        else
            agree = this.currentAdvisor.agrees(this.currentTrial.getCorrect(false), this.getLastConfidenceCategory());
        // Check the answer and dis/agree as appropriate
        if (agree) {
            this.currentTrial.advice = this.currentAdvisor.voice.getLineByFunction(function (line) {
                self.currentTrial.advisorAgrees = true;
                return line.side === self.currentTrial.whichSide;
            });
        } else {
            this.currentTrial.advice = this.currentAdvisor.voice.getLineByFunction(function (line) {
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
        // Only apply where advisor ID is specified already (i.e. force trials)
        if (this.currentTrial.advisorId === 0 || this.currentTrial.practice)
            return;
        // Determine confidence
        let cc = this.getConfidenceCategory(this.currentTrial.id);
        // Redraw advisor list if the answer was not valid
        let a = this.contingentAdvisors[cc].pop();
        if (typeof a === 'undefined' || this.advisorLists[this.currentTrial.advisorSet].indexOf(a) === -1) {
            this.redrawContingency(cc);
            this.findAdvisorFromContingency();
            return;
        }
        // Store advisor
        this.currentTrial.advisorId = a.id;
    }

    /**
     * produce a shuffled list of advisors to be used for the specified confidence category
     */
    redrawContingency(confidenceCategory) {
        let advisors = this.advisorLists[this.currentTrial.advisorSet];
        let blockLength = utils.getMatches(this.trials, (trial)=>{
            return trial.block === this.currentTrial.block;
        }).length;
        this.contingentAdvisors[confidenceCategory] =
            utils.shuffleShoe(advisors, Math.ceil(blockLength/advisors.length));
    }

    /**
     * Process the judge's final response
     * @param {Object} trial - jsPsych plugin response
     */
    finalResponse(trial) {
        this.currentTrial.stimulusOffTime.push(trial.stimulusOffTime); // always undefined - no stimulus!
        this.storePluginData(trial);
        this.currentTrial.answer[1] = AdvisorChoice.getAnswerFromResponse(trial.response);
        // empty responses are allowed 2nd time through (copy intial response)
        if (isNaN(this.currentTrial.answer[1])) {
            this.currentTrial.answer[1] = this.currentTrial.answer[0];
            this.currentTrial.confidence[1] = this.currentTrial.confidence[0];
        } else {
            this.currentTrial.confidence[1] = AdvisorChoice.getConfidenceFromResponse(trial.response, this.currentTrial.answer[1]);
        }
        this.closeTrial(trial);
    }

    /**
     * Draws the questionnaire portrait. Called by the jsPsych plugin
     *
     * @param {HTMLElement} display_element - element within which to draw the portrait
     * @param {Function} callback - function to execute when drawing is complete. Called with the portrait src
     */
    drawQuestionnaire(display_element, callback) {
        // set some styling stuff
        let style = display_element.appendChild(document.createElement('style'));
        style.innerText = 'div#jspsych-function-sliders-response-stimulus {float:left; max-width:40vw} ' +
            '.jspsych-sliders-response-wrapper {max-width:60vw} ' +
            '.jspsych-sliders-response-container {max-width:100%} ' +
            '#jspsych-content {max-width: 1000px !important; display:flex; margin:auto;}' +
            '#advisorChoice-choice-stimulus {max-width:30vw; display:block; position:relative; ' +
            'top:60%; left:10%; margin-top:-40%; margin-right: 5vw}';

        let advisor = this.questionnaireStack.pop();
        this.lastQuestionnaireAdvisorId = advisor.id;
        let img = document.createElement('img');
        img.className = 'advisor-portrait';
        img.id = 'advisorChoice-choice-stimulus';
        img.src = advisor.portrait.src;
        display_element.appendChild(img);
        callback(img.src);
        AdvisorChoice.changeQuestionnairePrompt(advisor);
    }

    /**
     * Change the questionnaire prompt to replace 'This advisor' with the advisor's name
     * @param {Advisor} advisor
     */
    static changeQuestionnairePrompt(advisor) {
        let p = document.querySelector('#jspsych-sliders-response-prompt > p');
        p.innerHTML = p.textContent.replace('This advisor', advisor.nameHTML);
    }

    /**
     * Save the response to the questionnaire.
     */
    questionnaireResponse(trial) {
        if (Object.keys(gov).indexOf('questionnaires') === -1)
            this.questionnaires = [];
        trial.afterTrial = this.currentTrialIndex-1;
        trial.advisorId = this.lastQuestionnaireAdvisorId;
        this.questionnaires.push(trial);
    }

    /**
     * submit the debrief form and finish the experiment
     *
     */
    debriefFormSubmit(form) {
        let txt = form.querySelector('#debriefManipulationAnswer');
        if (txt.value.length===0) {
            txt.style.border = '1px solid red';
            return;
        }
        this.debrief = {
            manipulationQuestion: txt.value,
            comments: form.querySelector('#debriefCommentAnswer').value
        };
        document.querySelector('body').innerHTML = "";
        this.endExperiment();
    }

    feedback(data, includePayment = false) {
        if(typeof data === 'undefined')
            data = this;
        google.charts.load('current', {'packages':['corechart']});
        google.charts.setOnLoadCallback(function(){advisorChoice.showFeedback(data, includePayment)});
    }

    endExperiment(saveData = true, clearScreen = true) {
        this.timeEnd = (new Date()).getTime();
        if(saveData === true)
            this.exportGovernor();
        // reset background colour
        if(clearScreen === true) {
            document.querySelector('body').style.backgroundColor = '';
            document.body.innerHTML = "<div id='jspsych-content'></div>";
        }
        this.feedback(this, (saveData && this.completionURL !== ''));
    }
}

export {trialTypes, trialTypeNames, DotTask, AdvisorChoice};