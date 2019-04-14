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

        // Don't recalculate trial list if it will be overridden
        let me = this;
        setTimeout(() => {
            if(!me.trials.length) {
                for(let i = 0; i < utils.sumList(me.blockLength); i++) {
                    me.trials.push(new AdvisedTrial(me.trialBlueprint))
                }
            }
        }, 0);
    }

    _setDefaults() {
        super._setDefaults();

        this.name = "newStudy";
        this.platformId = "not set";
        this.debriefComments = "";

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
            // "splashScreen",
            // "consent",
            // "demographics",
            // "introduction",
            // "training",
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
        document.getElementById("content").requestFullscreen();

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

    /**
     * Run a block of trials
     * @return {Promise<Study>}
     * @protected
     */
    async _runNextBlock() {

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
                "Enter an estimate to move on...";
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

        let b = this.practiceBlocks;

        for(let i = 0; i < b; i++) {

            await this.preBlock();

            // Run the trial
            await this._runNextBlock();
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
        this.save(console.log);

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
        document.getElementById("prompt").innerHTML =
            "Answer: <span>" + correctAnswer.toString() + "</span>";

        // Draw marker
        document.getElementById("response-panel").feedbackMarker(correctAnswer);

        setTimeout(()=> {
            document.getElementById("prompt").innerText = "";
            document.querySelector("esm-response-timeline").reset();
        }, feedbackDuration - 10);
        return new Promise((resolve) => {
            setTimeout(resolve, feedbackDuration);
        });
    }

    async core() {

        let b = this.blockLength.length;

        for(let i = this.practiceBlocks; i < b; i++) {

            await this.preBlock(false);

            // Run the trial
            await this._runNextBlock();
        }

        if(document.fullscreenElement)
            document.exitFullscreen();

        return this;
    }

    /**
     * Flatten the data to CSV-able tables
     * Each element in the output is a list of entries
     * @param [headers=true] {boolean} whether the first row in each list
     * should be the column headers
     * @return {{study: Array, trials: Array, advisors: Array}}
     */
    toTables(headers = true, fixLengths = true) {
        const out = {
            study: null,
            advisors: [],
            trials: []
        };

        out.study = this.toTable(headers);

        // Get the headers based on the last of each entity
        if(headers) {
            out.advisors.push(this.advisors[this.advisors.length - 1].tableHeaders);
            out.trials.push(this.trials[this.trials.length - 1].tableHeaders);
        }

        let aHead = null;
        let tHead = null;
        if(fixLengths) {
            aHead = out.advisors[0];
            tHead = out.trials[0];
        }
        this.advisors.forEach(async (a) =>
            out.advisors.push(a.toTable(aHead)));

        this.trials.forEach(async (t) =>
            out.trials.push(t.toTable(tHead)));

        return out;
    }

    /**
     * Fetch the data for the study in a flat format suitable for CSVing
     * @param headers {boolean} whether to include column headers
     * @return {string[]}
     */
    toTable(headers) {
        const out = [
            ...this.blockLength,
            this.countdownTime,
            this.practiceBlocks
        ];

        if(!headers)
            return out;

        let head = [];
        for(let i = 0; i < this.blockLength.length; i++)
            head.push("block" + i.toString() + "length");
        head = [
            ...head,
            ...[
                "countdownTime",
                "practiceBlocks"
            ]
        ];

        return [head, out];
    }

    /**
    * @return {string[]} headers for the private columns
    */
    get privateTableHeaders() {
        return [
            "platformId", "debriefComments"
        ];
    }

    /**
     * Remove the private data from this object and return it in a table
     * @param [remove=true] {boolean} whether to strip private data
     * @param [headers=true] {boolean} whether the table includes column headers
     * @return {*[]}
     */
    extractPrivateData(remove = true, headers = true) {
        const row = [];

        for(let h of this.privateTableHeaders) {
            row.push(this[h]);
            if(remove)
                this[h] = "[redacted]";
        }

        return headers? [this.privateTableHeaders, row] : [row];
    }

    /**
     * Save the data for the Study
     * @param [callback] {function} function to execute on the server response
     * @param [onError] {function} function to execute on fetch error
     * @return {Promise<Response|never>}
     */
    save(callback, onError) {
        this.info("Saving.");

        if(typeof callback !== "function")
            callback = () => {};
        if(typeof onError !== "function")
            onError = (reply)=>console.error("Error: ", reply);

        // Prepare data for saving
        const tables = this.toTables();
        tables.meta = this.extractPrivateData();

        const data = JSON.stringify({
            studyId: this.name,
            raw: this,
            tables
            });

        // Save
        return fetch("../saveCSV.php", {
            method: "POST",
            cache: "no-cache",
            headers: {"Content-Type": "application/x-www-form-urlencoded"},
            body: data
        })
            .then(response => response.text())
            .then(response => callback(response))
            .catch(error => onError(error));
    }
}

/**
 * @class DatesStudy
 * @extends Study
 * @classdesc A study using a set of history questions with answers being
 * years between 1850 and 1950.
 *
 * @property questionsXML {string} URL of a question.xml file for parsing
 */
class DatesStudy extends Study {
    constructor(blueprint) {
        super(blueprint);

        // Fetch questions then assign trials
        this.parseQuestionsXML()
            .then(() => {
                this.trials = [];
                for(let i = 0; i < utils.sumList(this.blockLength); i++) {
                    this.trials.push(new AdvisedTrial(this.trialBlueprint))
                }
            });
    }

    // Override the prefix so styling can use Trial rather than duplicating
    get _phaseClassPrefix() {
        return "Study";
    }

    /**
     * The questions.xml file should list QUESTIONs. Each question should have:
     * * PROMPT text
     * * TARGET year as the answer
     */
    async parseQuestionsXML() {
        // read the questions.xml file
        let qList = await fetch(this.questionsXML)
            .then(async (r) => await r.text())
            .then((qs) =>
                new DOMParser().parseFromString(qs, "text/xml")
                    .getElementsByTagName("question")
            );

        // shuffle the answers (spread HTMLcollection to array for shuffling)
        this.questions = utils.shuffle([...qList]);
        this.questionIndex = -1;
    }

    /**
     * Return the next blueprint in the sequence derived from parsing questions
     * @return {object}
     */
    get trialBlueprint() {

        if(typeof this.questions === "undefined")
            return this._trialBlueprint;

        this.questionIndex++;
        if(this.questionIndex >= this.questions.length) {
            this.warn("More questions requested than available; " +
                "shuffling and recycling.");
            this.questions = utils.shuffle(this.questions);
            this.questionIndex = -1;
        }

        let q = this.questions[this.questionIndex];

        let bp = {
            stim: document.createElement("p"),
            correctAnswer:
                parseInt(q.getElementsByTagName("target")[0].innerHTML),
            prompt: "",
            displayFeedback: this.displayFeedback,
            advisors: this.advisors
        };
        bp.stim.innerHTML = q.getElementsByTagName("prompt")[0].innerHTML;

        return bp;
    };

    set trialBlueprint(bp) {
        this._trialBlueprint = bp;
    }
}

export {Study, DatesStudy}