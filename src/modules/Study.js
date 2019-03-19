/**
 * Study
 * Matt Jaquiery, March 2019
 *
 * Javascript library for running social metacognition studies.
 */


"use strict";

import {Advisor} from "./Advisor.js";
import {Trial, AdvisedTrial} from "./Trial.js";
import {ControlObject} from "./Prototypes.js";
import * as utils from "../utils.js";

/**
 * @class Study
 * @classdesc The Study class is responsible for the overarching structure
 * of the experiment. It handles obtaining consent, acquiring any
 * demographic info, introducing the participant to the various components,
 * the various information, and practice parts, and supplying blocks of
 * trials. Finally, it sends data save requests and offers feedback.
 *
 * Study has the following phases:
 * * splashScreen
 * * consent
 * * demographics
 * * introduction
 * * training
 * * practiceInstructions
 * * practice
 * * mainInstructions
 * * main
 * * debrief
 *
 * Properties are set in the constructor's blueprint.
 *
 * @property blockLength {int[]} number of trials to run in each block
 * @property [practiceBlocks=1] {int} number of blocks which are practice blocks
 * @property trials {Trial[]|[]} the trials in the study
 */
class Study extends ControlObject {

    constructor(blueprint) {
        super(blueprint);

        if(!this.trials.length) {
            for(let i = 0; i < utils.sumList(this.blockLength); i++) {
                this.trials.push(new AdvisedTrial(this.trialBlueprint))
            }
        }
    }

    _setDefaults() {
        super._setDefaults();

        this.currentTrial = 0;
        this.currentBlock = 0;

        this.blockLength = [0];
        this.practiceBlocks = 0;
        this.trials = [];
        this.countdownTime = 1;

        this.advisors =
            [
                new Advisor({id: 1, group: 1, name: "Advisor #37", templateId: "advisor-key"}),
                new Advisor({id: 2, group: 2, name: "Advisor #09", templateId: "advisor-key"})
            ];

        this.trialBlueprint = {
            stim: new Image(),
            correctAnswer: () => {return 1 + Math.random() * 4},
            prompt: "How much are the coins worth?",
            displayFeedback: this.displayFeedback,
            advisors: this.advisors
        };
        this.trialBlueprint.stim.src = "https://cdn.instructables.com/FMU/YSFR/IDRP7INH/FMUYSFRIDRP7INH.LARGE.jpg";
    }

    static get listPhases() {
        return [
            "splashScreen",
            "consent",
            "demographics",
            "introduction",
            "training",
            "practiceInstructions",
            "practice",
            "coreInstructions",
            "core",
            "debrief"
        ];
    }

    /**
     * Display a countdown in the stimulus window.
     * @param s {int} seconds to count down
     * @param [max=0] {int} tracker for recursion
     */
    async countdown(s, max = null) {
        const stim = document.getElementById("stimulus");

        // Handle the initial call
        if(max === null) {
            max = s + 1;
            stim.classList.add("countdown");
            stim.appendChild(
                document.getElementById("countdown")
                    .cloneNode(true).content);

            stim.querySelector("svg").style.animationDuration = s + "s";
        }

        if(s !== 1)
            await this.countdown(s - 1, max);

        stim.querySelector("span").innerText = (max - s).toString();

        // When the last resolves, remove the countdown class
        if(s === max - 1)
            return new Promise((r) => setTimeout(() => {
                stim.classList.remove("countdown");
                r();
            }, 1000));

        // Others simply resolve themselves after 1s
        return new Promise((resolve) => setTimeout(resolve, 1000));
    }

    /**
     * Update the visual indication of study progress
     * @param [increment=true] {boolean} whether to increment the trial
     * count
     */
    updateProgressBar(increment = true) {
        if(increment) {
            this.currentTrial++;

            // Update block index
            let i = 0;
            for(let b = 0; b < this.blockLength.length; b++) {
                i += this.blockLength[b];
                if(this.currentTrial < i) {
                    this.currentBlock = b;
                    break;
                }
            }
        }

        document.querySelector(".progress-bar .outer").style.width =
            (this.currentTrial /
                utils.sumList(this.blockLength) *
                document.querySelector(".progress-bar").clientWidth) + "px";
    }

    /**
     * Inter-trial interval
     */
    async ITI() {
        this.updateProgressBar();

        let elm = document.querySelector("#content");
        elm.classList.add("ITI");
        return new Promise((resolve) =>
            setTimeout(() => {
                    elm.classList.remove("ITI");
                    resolve();
                }, 500
            )
        );
    }

    /**
     * Set the content of the instructions div to be a copy of an
     * esm-instruction template.
     * @param newTemplateId {string} id of the new template to use for
     * instructions
     * @param [callback] {function(buttonName, event)} function to use as
     * the callback for instruction buttons. By default simply hide the
     * instruction div.
     */
    static _updateInstructions(newTemplateId, callback) {
        let instr = document.getElementById("instructions");

        if(typeof callback !== "function")
            callback = (name, event) => {
                console.log(name);
            };

        instr.innerHTML = "";

        // Add new
        instr.appendChild(
            document.importNode(
                document.getElementById(newTemplateId).content,
                true));

        instr.querySelector("esm-instruction").callback = callback;

        instr.classList.remove("hidden");
    }

    /**
     * Insert an advisor's info tab with an animation for visibility.
     * @param advisor {Advisor}
     * @return {Promise<HTMLElement>}
     */
    _introduceAdvisor(advisor) {
        const elm = advisor.getInfoTab("advisor-key");
        document.querySelector(".advisor-key").appendChild(elm);

        return new Promise((resolve) => {setTimeout(resolve, 1000, elm)});
    }

    /**
     * Wipe the advisors panel and introduce new advisors
     * @param advisors {Advisor[]}
     */
    async _introduceAdvisors(advisors) {
        // Remove current advisors
        document.querySelectorAll(".advisor-key .advisor-key-row").forEach(
            (elm) => elm.remove()
        );

        // Change prompt text to state what is happening
        document.getElementById("prompt").innerHTML = "New advisors!";
        await this.wait(500);

        for(let advisor of advisors) {
            await this._introduceAdvisor(advisor);
        }
    }

    async introduction() {
        return new Promise(function(resolve) {
            let data = [];
            Study._updateInstructions("instr-intro",
                (name) => {
                    let now = new Date().getTime();
                    data.push({name, now});
                    if(name === "end")
                        resolve(data);
                });
        });
    }

    /**
     * Show a help element's help display
     * @param helpElement {HTMLElement}
     * @return {HTMLElement}
     * @protected
     */
    static _showHelp(helpElement) {
        helpElement.show();
        helpElement.parentElement.classList.add("esm-help-show");
        return helpElement;
    }

    /**
     * Hide a help element's help display
     * @param helpElement {HTMLElement}
     * @return {HTMLElement}
     * @protected
     */
    static _hideHelp(helpElement) {
        helpElement.hide();
        helpElement.parentElement.classList.remove("esm-help-show");
        return helpElement;
    }

    async training() {

        let study = this;

        // Show navigation cues
        let instr = document.getElementById("training-instructions");

        return new Promise(async function(resolve) {
            // Spacebar moves onwards
            const gotoNextStep = function(target) {
                return(new Promise((resolve)=> {
                    function next() {
                        target.removeEventListener("click", next);
                        resolve();
                    }
                    target.addEventListener("click", next);
                }))
            };

            let T = new Trial(study.trialBlueprint);

            let help = Study._showHelp(
                document.querySelector(".progress-bar esm-help"));

            await gotoNextStep(help);

            Study._hideHelp(help);

            await T.nextPhase("begin");
            await T.nextPhase("showStim");
            help = Study._showHelp(
                document.querySelector("#stimulus ~ esm-help"));

            await gotoNextStep(help);

            Study._hideHelp(help);
            instr.innerHTML =
                "Enter an estimate and rate your confidence to move on...";
            instr.classList.add("top");
            let data = T.nextPhase("hideStim");

            help = Study._showHelp(
                document.querySelector("esm-response-widget ~ esm-help"));

            await T.nextPhase("getResponse");

            Study._hideHelp(help);

            // finish the trial
            await T.run("end");

            // Reset progress bar
            study.updateProgressBar(false);

            resolve(data);
        });
    }

    async practiceInstructions() {
        return new Promise(function(resolve) {
            let data = [];
            Study._updateInstructions("instr-practice",
                (name) => {
                    let now = new Date().getTime();
                    data.push({name, now});
                    if(name === "end")
                        resolve(data);
                });
        });
    }

    async preBlock(introduceAdvisors = true) {

        if(introduceAdvisors) {
            await this._introduceAdvisors(this.advisors);
        }

        // Pre-block delay
        document.getElementById("prompt").innerHTML = "Get ready";
        await this.countdown(this.countdownTime);
    }

    async practice() {

        await this.preBlock();

        let n = this.blockLength[this.currentBlock];

        for(let i = 0; i < n; i++) {

            // Run the trial
            this.trials[this.currentTrial] =
                await this.trials[this.currentTrial].run();

            // Inter-trial interval
            await this.ITI();
        }

        return this;
    }

    async coreInstructions() {
        return new Promise(function(resolve) {
            let data = [];
            Study._updateInstructions("instr-final",
                (name) => {
                    let now = new Date().getTime();
                    data.push({name, now});
                    if(name === "end")
                        resolve(data);
                });
        });
    }

    async debrief() {
        Study._updateInstructions("instr-debrief");
        return new Promise(function(resolve) {
            setTimeout(resolve, 0, "debrief");
        });
    }

    /**
     * Display the feedback for a trial
     * @param trial {Trial}
     * @return {Promise<*>}
     */
    async displayFeedback(trial) {
        const feedbackDuration = 1000;

        const correctAnswer = trial.data.correctAnswer;
        const answer = trial.data.responseEstimate;
        const error = Math.abs(answer - correctAnswer);
        const correct = error < .25;

        document.getElementById("content").classList
            .add(correct? "correct" : "incorrect", "feedback");
        document.getElementById("prompt").innerHTML =
            "Actual amount: <span>&pound;" +
            correctAnswer.toFixed(2) +
            "</span>";

        // Draw marker
        const marker = document.querySelector(
            "esm-response-widget .response-marker.correct.feedback"
        );
        const d = document.querySelector("esm-response-widget")
            .valueToProportion(correctAnswer, 1);
        let box = document.querySelector(".response-hBar")
            .getBoundingClientRect();
        // General position format is %(span) + adjustment
        marker.style.left =
            (d.estimateProportion * (box.width - box.height) +
                ((box.height - marker.clientWidth) / 2)) + "px";
        box = document.querySelector(".response-vBar")
            .getBoundingClientRect();
        marker.style.top = "calc(" +
            ((1 - d.confidence) * (box.height - marker.clientHeight)) +
            "px - var(--response-vBar-offset))";

        setTimeout(()=> {
            document.getElementById("content").classList
                .remove(correct? "correct" : "incorrect", "feedback");
            document.getElementById("prompt").innerText = "";
            document.querySelector("esm-response-widget").reset();
        }, feedbackDuration - 10);
        return new Promise((resolve) => {
            setTimeout(resolve, feedbackDuration);
        });
    }

    async core() {

        await this.preBlock(false);

        let n = this.blockLength[this.currentBlock];

        for(let i = 0; i < n; i++) {
            // Define the trial
            let blueprint = {};
            blueprint.stim = new Image();
            blueprint.stim.src =
                "https://cdn.instructables.com/FMU/YSFR/IDRP7INH/" +
                "FMUYSFRIDRP7INH.LARGE.jpg";
            blueprint.prompt = [];
            Trial.listPhases.forEach((p)=>blueprint.prompt[p] =
                "How much are the coins worth?");
            blueprint.prompt["cleanup"] = "";
            blueprint.prompt["end"] = "";

            // Run the trial
            this.trials[this.currentTrial] = await new Trial(blueprint).run();

            // Inter-trial interval
            await this.ITI();
        }
    }
}

export {Study}