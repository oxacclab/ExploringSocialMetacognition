/**
 * Study
 * Matt Jaquiery, March 2019
 *
 * Javascript library for running social metacognition studies.
 */


"use strict";

import {Advisor, ADVICE_CORRECT, ADVICE_INCORRECT_REFLECTED, ADVICE_CORRECT_DISAGREE, ADVICE_CORRECT_AGREE, ADVICE_INCORRECT_REVERSED, AdviceProfile} from "./Advisor.js";
import {Trial, AdvisedTrial} from "./Trial.js";
import {ControlObject, BaseObject} from "./Prototypes.js";
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
 * @property blocks {Block[]} number of trials to run in each block
 * @property trials {Trial[]|[]} the trials in the study
 */
class Study extends ControlObject {

    constructor(blueprint) {
        super(blueprint);
    }

    async setupTrials() {
        for(let b = 0; b < this.blocks.length; b++) {
            for(let i = 0; i < this.blocks[b].trialCount; i++) {
                this.trials.push(new AdvisedTrial(
                    {
                        block: b,
                        ...this.blocks[b],
                        ...this.trialBlueprint
                    }));
            }
        }
        return this;
    }

    _setDefaults() {
        super._setDefaults();

        this.studyName = "datesStudy";
        this.studyVersion = "notSet";

        this.currentTrial = 0;

        this.blocks = [{trialCount: 0, isPractice: true, advisors: []}];
        this.trials = [];
        this.attentionCheckTrials = [];
        this.countdownTime = DEBUG.level? 1 : 3;

        this.advisors =
            [
                new Advisor({
                    id: 1,
                    group: 1,
                    name: "Advisor #37",
                    templateId: "advisor-key",
                    confidence: 8,
                    confidenceVariation: 3,
                    adviceProfile: new AdviceProfile({
                        adviceTypes: [
                            ADVICE_CORRECT_DISAGREE.copy(4),
                            ADVICE_INCORRECT_REFLECTED.copy(1),
                            // fallbacks
                            ADVICE_INCORRECT_REVERSED.copy(0),
                            ADVICE_CORRECT.copy(0)
                        ]
                    })
                }),
                new Advisor({
                    id: 2,
                    group: 2,
                    name: "Advisor #09",
                    templateId: "advisor-key",
                    confidence: 8,
                    confidenceVariation: 3,
                    adviceProfile: new AdviceProfile({
                        adviceTypes: [
                            ADVICE_CORRECT_AGREE.copy(4),
                            ADVICE_INCORRECT_REFLECTED.copy(1),
                            // fallbacks
                            ADVICE_INCORRECT_REVERSED.copy(0),
                            ADVICE_CORRECT.copy(0)
                        ]
                    })
                })
            ];

        this.trialBlueprint = {
            stim: new Image(),
            correctAnswer: () => {return 1 + Math.random() * 4},
            prompt: "How much are the coins worth?",
            displayFeedback: this.displayFeedback,
            advisors: this.advisors,
            attentionCheck:  false
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
            "advisorPracticeInstructions",
            "advisorPractice",
            "coreInstructions",
            "core",
            "debrief",
            "results"
        ];
    }

    /**
     * Return the index in trials of the first trial in each block
     */
    get firstTrialIndices() {

        let indices = [];
        let t = 0;
        for(let b = 0; b < this.blocks.length; b++) {
            indices.push(t);
            t += this.blocks[b].trialCount;
        }

        return indices;
    }

    async consent() {
        const me = this;
        return new Promise(function(resolve) {
            let data = [];
            Study._updateInstructions(
                "instr-fullscreen",
                (name) => {
                    if(name !== "end") {
                        if(!document.fullscreenElement)
                            Study.lockFullscreen(document.querySelector("#content"));

                        me.saveCSVRow(
                            "consent",
                            false,
                            {
                                //consentTime: new Date().getTime()
                                consentTime: "not yet implemented"
                            })
                            .then(me.setupTrials())
                            .then(reply => resolve(reply));
                    }
                });
        });
    }

    /**
     * Check whether the participant is qualified to take the study
     * @return {boolean} whether the study qualifications are met
     */
    checkQualifications() {
        if(this.isRepeat && this.prolific) {
            this.warn("Repeated prolific ID");

            const elm = document.querySelector("#content")
                .appendChild(document.createElement("div"));

            elm.id = "save-warning";
            elm.classList.add("overlay");

            Study._updateInstructions(
                "repeat",
                ()=>{},
                "save-warning");

            return false;
        }

        return true;
    }

    async demographics() {

        const me = this;

        if(!this.checkQualifications())
            return false;

        return new Promise(function(resolve) {
            const data = {
                userAgent: navigator.userAgent,
                ...me.toTable()
            };

            me.saveCSVRow("study-details", true, data);

            resolve("demographics");
        });
    }

    /**
     * @callback Study~instructionCallback
     * @param {string} buttonName
     * @param {Event} originatingEvent
     */

    /**
     * Set the content of the instructions div to be a copy of an
     * esm-instruction template.
     * @param newTemplateId {string} id of the new template to use for
     * instructions
     * @param [callback] {Study~instructionCallback} function to use as
     * the callback for instruction buttons. By default simply hide the
     * instruction div.
     * @param [targetElement="instructions"] {string} target HTML element id
     * @param [keepClosed=false] {boolean} keep the overlay closed after updating
     */
    static _updateInstructions(newTemplateId, callback, targetElement = "instructions", keepClosed = false) {
        let instr = document.getElementById(targetElement);

        if(typeof callback !== "function")
            callback = name => console.log(name);

        const cb = (name) => {
            if(name === "end")
                instr.classList.remove("open");
            return callback(name);
        };

        instr.innerHTML = "";

        // Add new
        instr.appendChild(
            document.importNode(
                document.getElementById(newTemplateId).content,
                true));

        instr.querySelector("esm-instruction").callback = cb;

        if(!keepClosed)
            instr.classList.add("open");
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
            // skip if no time
            if(!s)
                return;

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
        }

        document.querySelector(".progress-bar .outer").style.width =
            (this.currentTrial /
                this.trials.length *
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
     * Insert an advisor's info tab with an animation for visibility.
     * @param advisor {Advisor}
     * @param resolve {function} callback for promise
     * @return {Promise<HTMLElement>}
     */
    _introduceAdvisor(advisor, resolve) {
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
        document.getElementById("prompt").innerHTML = "New advisor" + (advisors.length > 1? "s" : "") + "!";
        await this.wait(500);

        let i = 0;
        for(let advisor of advisors) {
            advisor.position = i++;
            await this._introduceAdvisor(advisor);
        }
    }

    static checkFullscreen(elm) {

        if(document.fullscreenElement !== elm) {
            document.body.classList.add("fullscreen-error");
            document.querySelector('#fullscreen-warning.overlay').classList.add('open');
        } else {
            document.body.classList.remove("fullscreen-error");
            document.querySelector('#fullscreen-warning.overlay').classList.remove('open');
        }
        elm.fullscreenTimeOut = setTimeout(Study.checkFullscreen, 100, elm);
    }

    /**
     * Put an element into fullscreen mode
     * @param elm {HTMLElement} element to put into fullscreen
     * @param [lock=true] {boolean} whether to lock fullscreen mode
     * @return {Promise<void>}
     */
    static async enterFullscreen(elm, lock = true) {
        if(elm.requestFullscreen)
            await elm.requestFullscreen();
        else if(elm.mozRequestFullScreen)
            await elm.mozRequestFullScreen();
        else if(elm.webkitRequestFullscreen)
            await elm.webkitRequestFullscreen();
        else if(elm.msRequestFullscreen)
            await elm.msRequestFullscreen();

        if(lock &&
            (document.fullscreenElement === elm ||
            document.webkitFullscreenElement === elm))
            elm.fullscreenTimeOut = setTimeout(Study.checkFullscreen, 100, elm);
    }

    /**
     * Exit fullscreen mode
     * @return {Promise<void>}
     */
    static async exitFullscreen() {
        if(document.exitFullscreen)
            return document.exitFullscreen();
        if(document.mozCancelFullScreen)
            return document.mozCancelFullScreen();
        if(document.webkitExitFullscreen)
            return document.webkitExitFullscreen();
    }

    /**
     * Ensure element is fullscreen and prevent continuation when it is not
     * @param element {HTMLElement}
     * @return {Promise<void>}
     */
    static async lockFullscreen(element) {
        document.body.classList.remove("fullscreen-error");

        await Study.enterFullscreen(element);

        Study._updateInstructions("fullscreen-instructions",
            () => Study.enterFullscreen(element),
            "fullscreen-warning",
            true);
    }

    static async unlockFullscreen(element) {
        document.body.classList.remove("fullscreen-error");
        const warning = document.querySelector('#fullscreen-warning.open');
        if(warning)
            warning.classList.remove('open');

        clearTimeout(element.fullscreenTimeOut);

        await Study.exitFullscreen();
    }

    static _navGuard() {
        if(utils.getQueryStringValue("debug"))
            return "";

        return "Leaving now may mean some of your data are not saved!";
    }

    async introduction() {
        return new Promise(function(resolve) {
            let data = [];
            Study._updateInstructions("instr-intro",
                (name) => {
                    let now = new Date().getTime();
                    data.push({name, now});
                    if(name === "exit")
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
     * @param block {int|object} an index of this.block or the object at that index
     * @return {Promise<Study>}
     * @protected
     */
    async _runBlock(block) {

        if(typeof block === "number")
            block = this.blocks[block];

        let n = block.trialCount;

        this.currentTrial = this.firstTrialIndices[this.blocks.indexOf(block)];

        for(let i = 0; i < n; i++) {

            // Run the trial
            const t = await this.trials[this.currentTrial].run();

            // Save trial data
            let table = t.saveTableName? t.saveTableName : t.constructor.name;
            this.saveCSVRow(table, true, t.toTable());

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

                if(DEBUG.level)
                    return new Promise(r => r());

                return new Promise((resolve)=> {
                    function next() {
                        target.removeEventListener("click", next);
                        resolve();
                    }
                    target.addEventListener("click", next);
                });
            };

            let T = new Trial(study.trialBlueprint);
            T.displayFeedback = study.trainingFeedback;

            let help = Study._showHelp(
                document.querySelector(".progress-bar esm-help"));

            // Adjust prompt position
            document.querySelector('#training-instructions').classList.add('bump');

            await gotoNextStep(help);

            // Pause the progress bar animation
            document.querySelector(".progress-bar .outer").style.animationPlayState = "paused";

            // Unset the adjusted prompt position
            document.querySelector('#training-instructions').classList.remove('bump');

            instr.classList.add("top");

            Study._hideHelp(help);

            await T.nextPhase("begin");
            await T.nextPhase("showStim");
            help = Study._showHelp(
                document.querySelector("#stimulus ~ esm-help"));

            await gotoNextStep(help);

            Study._hideHelp(help);

            let data = T.nextPhase("hideStim");
            T.nextPhase("getResponse");

            help = Study._showHelp(document.querySelector(".response-timeline ~ esm-help, esm-response-binary-conf esm-help"));

            instr.innerHTML = "Enter a response to continue";

            await T.nextPhase("getResponse");

            Study._hideHelp(help);
            instr.innerHTML = "Click or touch the tooltip to continue...";

            // finish the trial
            await T.run("showFeedback");
            instr.innerHTML = "";

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
                    if(name === "exit")
                        resolve(data);
                });
        });
    }

    async practice() {

        window.onbeforeunload = Study._navGuard;

        let blocks = this.blocks.filter(b => b.blockType === "practice");

        for(let b = 0; b < blocks.length; b++) {

            const block = blocks[b];

            await this.preBlock(block, false);

            // Run the trial
            await this._runBlock(block);

            if(blocks.length > 1 && b < blocks.length-1)
                await this.postBlock();
        }

        return this;
    }

    async advisorPracticeInstructions() {
        return new Promise(function(resolve) {
            let data = [];
            Study._updateInstructions("instr-practice-advisor",
                (name) => {
                    let now = new Date().getTime();
                    data.push({name, now});
                    if(name === "exit")
                        resolve(data);
                });
        });
    }

    /**
     * Handle pre-block tasks for a block of trials
     * @param block {int|Block} an index of this.block or the object at that index
     * @param [introduceAdvisors=true] {boolean} whether to conduct advisor introductions
     * @return {Promise<Study>}
     */
    async preBlock(block, introduceAdvisors = true) {

        if(typeof block === "number")
            block = this.blocks[block];

        // Introductory text for a block
        if(block.introText) {
            // support either esm-instruction or normal HTML
            let intro = "";
            if(/<esm-instruction/.test(block.introText))
                intro = block.introText;
            else
                intro = "<esm-instruction><esm-instruction-page>" + block.introText + "</esm-instruction-page></esm-instruction>";
            document.getElementById("block-intro")
                .content
                .querySelector(".intro").innerHTML = intro;

            await new Promise(function(resolve) {
                let data = [];
                Study._updateInstructions("block-intro",
                    (name) => {
                        let now = new Date().getTime();
                        data.push({name, now});
                        if(name === "exit")
                            resolve(data);
                    });
            });
        }

        if(introduceAdvisors) {
            await this._introduceAdvisors(block.advisors);
        }

        // Pre-block delay
        document.getElementById("prompt").innerHTML = "";
        await this.countdown(this.countdownTime);
    }

    async postBlock() {
        return new Promise(function(resolve) {
            let data = [];
            document.body.classList.add('Study-blockBreak');
            Study._updateInstructions("block-break",
                (name) => {
                    let now = new Date().getTime();
                    data.push({name, now});
                    if(name === "exit") {
                        document.body.classList.remove('Study-blockBreak');
                        resolve(data);
                    }
                });
        });
    }

    async advisorPractice() {

        // Save the advisors' CSV entries
        this.advisors.forEach(a =>
            this.saveCSVRow("advisors", true, a.toTable()));

        const blocks = this.blocks.filter(
            b => b.blockType === "practiceAdvisor");

        for(let b = 0; b < blocks.length; b++) {

            const block = blocks[b];

            await this.preBlock(block);

            // Run the trial
            await this._runBlock(block);

            if(b > 1 && b < blocks.length-1)
                await this.postBlock();
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
                    if(name === "exit")
                        resolve(data);
                });
        });
    }

    async debrief() {

        // leave fullscreen
        if(document.fullscreenElement)
            Study.unlockFullscreen(document.fullscreenElement);

        Study._updateInstructions("instr-debrief");
        await this.save(console.log);

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
        const feedbackDuration = 2000;

        const correctAnswer = trial.data.correctAnswer;
        document.getElementById("prompt").innerHTML =
            "Answer: <span>" + correctAnswer.toString() + "</span>";

        // Draw marker
        document.getElementById("response-panel").feedbackMarker(correctAnswer, trial.data.anchorDate || null);

        setTimeout(()=> {
            document.getElementById("prompt").innerText = "";
            document.querySelector("#response-panel").reset();
        }, feedbackDuration - 10);
        return new Promise((resolve) => {
            setTimeout(resolve, feedbackDuration);
        });
    }

    get trainingFeedback() {
        return this.displayFeedback;
    }

    async core() {

        const blocks = this.blocks.filter(b => b.blockType === "core");

        for(let b = 0; b < blocks.length; b++) {

            const block = blocks[b];

            let intro = false;
            if(block.introduceAdvisors !== "undefined")
                intro = block.introduceAdvisors;
            else
                intro = b === 0?
                    true :
                    !block.advisors.every(x => blocks[b - 1].advisors.includes(x));

            await this.preBlock(block, intro);

            // Run the trial
            await this._runBlock(block);

            if(b < blocks.length-1)
                await this.postBlock();
        }

        return this;
    }

    reportIssue() {
        const me = this;

        // Reset reporting form
        const div = document.querySelector("#report-issue");
        div.innerHTML = "";
        div.appendChild(document.importNode(document.querySelector("#issue-report").content, true));

        // Prevent form submission navigation especially on Safari
        utils.preventFormSubmission(div.querySelector("form"));

        div.querySelector("form button[name='submit']").addEventListener("click", e => {
            e.preventDefault();
            const form = document.querySelector("#report-issue form");
            if(form.querySelector("[name='issueContent']").value !== "") {

                let data = {
                    currentTrial: me.currentTrial,
                    question: me.trials[me.currentTrial].stimHTML
                };
                form.querySelectorAll("textarea, select, input:not([type='submit'])").forEach(i => data[i.name] = i.value);

                me.info("User issue report!");
                me.saveCSVRow("issue-report", false, data);

                const metadata = {
                    studyId: study.studyName,
                    studyVersion: study.studyVersion,
                    idCode: study.id,
                    error: data.content,
                    userIssue: true
                };

                fetch("../saveErrorDump.php", {
                    method: "POST",
                    body: JSON.stringify({metadata, data: JSON.stringify(me)})
                })
            }

            form.classList.add("exit");
            setTimeout(() => document.body.classList.remove("report-issue"), 1000);

            return false;
        });

        // Show the reporting form
        document.body.classList.add("report-issue");
    }

    /**
     * Fetch the data for the study in a flat format suitable for CSVing
     * @return {object} key-value pairs
     */
    toTable() {
        const out = {};

        // Study properties
        out.tags = this.tags;
        out.prolific = this.prolific;
        out.isRepeat = this.isRepeat;
        out.countdownTime = this.countdownTime;
        out.condition = this.condition;

        // Study structure
        out.blocks = this.blocks.length;
        out.trial = this.trials.length;

        out.coreBlocks = this.blocks.filter(b => b.blockType === "core").length;
        out.coreTrials = this.trials.filter(t => t.blockType === "core").length;

        // Display measurements
        const content = getComputedStyle(
            document.getElementById("content"));

        out.screenHeight = screen.availHeight;
        out.windowHeight = window.outerHeight;
        out.contentHeight = content.height;
        out.screenWidth = screen.availWidth;
        out.windowWidth = window.outerWidth;
        out.contentWidth = content.width;

        return out;
    }

    /**
    * @return {string[]} headers for the private columns
    */
    get privateTableHeaders() {
        return [];
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
     * Notify the user that there is a problem with saving their data
     * @param errStr {string} JSON error string returned from PHP save file
     */
    async saveErrorNotification(errStr) {
        this.warn("Save error");

        const elm = document.querySelector("#content").appendChild(
            document.createElement("div"));

        elm.id = "save-warning";
        elm.classList.add("overlay");

        return new Promise(resolve => {
            Study._updateInstructions("save-error",
                resolve,
                "save-warning");

            let str = "";
            let err = null;

            try {
                err = JSON.parse(errStr);
            } catch(e) {
                err = {};
            } finally {
                err = {
                    id: typeof this.id === "undefined"? "unset" : this.id,
                    stage: document.body.classList.toString(),
                    ...err
                };

                for(let key in err) {
                    if(err[key].length && err.hasOwnProperty(key))
                        str += "<p><strong>" + key + "</strong>: " +
                            err[key] + "</p>";
                }
            }

            document.body.querySelector(".error-content").innerHTML = str;
        });
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
            onError = async (err) => await this.saveErrorNotification(err);

        let privateData = this.extractPrivateData();
        if(privateData.length)
            privateData = JSON.stringify(privateData);
        else
            privateData = null;

        // Save raw data JSON
        return fetch("../saveJSON.php", {
            method: "POST",
            cache: "no-cache",
            body: JSON.stringify({
                metadata: {
                    studyId: this.studyName,
                    studyVersion: this.studyVersion,
                    idCode: this.id
                },
                data: JSON.stringify(this),
                privateData
            })
        })
            .then(response => response.text())
            .then(response => {
                const r = JSON.parse(response);
                if(r.code !== 200)
                    onError(response);
                else
                    callback(r);
            })
            .catch(error => onError(error));
    }

    /**
     * Save a row to a CSV file (attempt to create if non-existent)
     * @param table {string} name of the table
     * @param publicData {boolean} whether the table is publicly accessible
     * @param data {object} column-cell pairs for writing to the file
     * @param [callback] {function} to execute on the server's response
     * @param [onError] {function} on fetch error
     * @return {Promise<string | never>}
     */
    async saveCSVRow(table, publicData, data, callback, onError) {
        this.info("Save CSV row");

        if(typeof callback !== "function")
            callback = () => {};
        if(typeof onError !== "function")
            onError = async (err) => await this.saveErrorNotification(err);

        const metadata = {
            fileName: table,
            isPublic: publicData === true,
            studyId: this.studyName,
            studyVersion: this.studyVersion
        };

        data = JSON.stringify({
            studyId: this.studyName,
            studyVersion: this.studyVersion,
            pid: await this.getSaveId(),
            pidHash: this.idHash,
            clientTime: new Date().getTime(),
            ...data
        });

        return new Promise((resolve) => {
            fetch("../saveSerial.php", {
                method: "POST",
                body: JSON.stringify({metadata, data})
            })
                .then(response => response.text())
                .then(response => {
                    const r = JSON.parse(response);
                    if(r.code !== 200)
                        onError(response);
                    else
                        callback(r);
                })
                .catch(error => onError(error))
                .then(r => resolve(r));
        });
    }

    /**
     * Update the core blocks to add/remove feedback
     * @param feedback {boolean} whether feedback is to be present in the blocks
     * @protected
     */
    _setFeedback(feedback) {
        const me = this;
        this.blocks.filter(b => b.blockType === "core")
            .forEach(b => {
                b.feedback = feedback;
                b.displayFeedback = feedback?
                    me.displayFeedback : null;
            });
    }

    /**
     * Update core blocks to have the appropriate advisor order.
     * @param x {int} 0 or 1
     * @protected
     */
    _setAdvisorOrder(x) {
        const advisorOrder = [];

        advisorOrder[0] = x + 1;
        advisorOrder[1] = 3 - advisorOrder[0];

        const me = this;
        this.blocks.filter(b => b.blockType === "core")
            .forEach(b => {
                let i = me.blocks.indexOf(b);
                if(b.advisorChoice)
                    b.advisors = me.advisors.filter(a => a.id > 0);
                else
                    b.advisors = [me.advisors[advisorOrder[i % 2]]];
            });
    }

    /**
     * Refresh trial list to load block properties.
     */
    pushBlockPropertiesToTrials() {
        // Update trials with new info
        const blocks = this.blocks;
        this.trials.forEach(t => {
            if(t.blockType === "core") {
                for(let k in blocks[t.block]) {
                    if(blocks[t.block].hasOwnProperty(k)) {
                        t[k] = blocks[t.block][k];
                    }
                }
            }
        })
    }

    /**
     * Assign this study to a condition
     * @param [condition] {int} condition to assign (uses this.condition by default)
     */
    setCondition(condition) {
        if(condition)
            this.condition = condition;

        this.info("Assigning condition variables for condition " + this.condition);
        // Study condition

        this._setFeedback(this.condition <= this.conditionCount / 2);
        this._setAdvisorOrder(this.condition % 2);

        this.pushBlockPropertiesToTrials();

        this.validate();
    }

    async getSaveId() {

        if(this.id)
            return this.id;

        if(this.idFetchInProgress) {
            // periodic check for save ID
            const me = this;
            await new Promise((resolve => {
                const check = function() {
                    if(me.id)
                        resolve(me.id);
                    else
                        setTimeout(check, 25);
                };
                check();
            }));

            this.idFetchInProgress = !this.id;
            return this.id;
        }

        this.info("Getting new save ID");

        this.idFetchInProgress = true;
        const me = this;

        await fetch("../saveSerial.php", {
            method: "POST",
            body: JSON.stringify({
                metadata: {
                    isPublic: false,
                    fileName: "participant-metadata",
                    studyId: this.studyName,
                    studyVersion: this.studyVersion,
                    N: this.participantCount,
                    conditions: this.conditionCount
                },
                data: JSON.stringify({
                    studyId: this.studyName,
                    studyVersion: this.studyVersion,
                    prolificId: utils.getQueryStringValue("PROLIFIC_PID"),
                    condition: utils.getQueryStringValue("cdn")
                })
            })
        })
            .then(async (r)=> await r.text())
            .then((txt) => JSON.parse(txt))
            .then(r => {
                this.id = r.id;
                this.tags = r.tags;
                this.condition = r.condition;
                this.prolific = /(^|, )prolific($|, )/i.test(r.tags);
                this.isRepeat = /(^|, )repeat($|, )/i.test(r.tags);
                this.idHash = r.uidHash;
            })
            .catch((r) => me.saveErrorNotification(r));

        this.info("Acquired save ID '" + this.id + "'", true);

        this.setCondition();

        return this.id;
    }

    /**
     * Validate the structure of the Study
     * @param errorOnFail {boolean} whether to throw an error if structure is invalid
     * @param verbose {boolean} whether to log tests to the console
     * @return {boolean}
     */
    validate(errorOnFail = true, verbose = false) {
        this.info("Validation passed.");
        return true;
    }

    /**
     * Handle failed validation checks
     * @param content {string} log content
     * @param withError {boolean} whether to throw an error
     * @param details {object} to print to console
     */
    raise(content, withError = true, details) {
        console.log("Validation error: " + content);
        console.log(details);
        if(withError)
            this.error(content);
    }
}

/**
 * @class DatesStudy
 * @extends Study
 * @classdesc A study using a set of history questions with answers being
 * years between 1900 and 1999.
 *
 * @property questionsXML {string} URL of a question.xml file for parsing
 */
class DatesStudy extends Study {
    constructor(blueprint) {
        super(blueprint);
    }

    async setupTrials() {

        // Fetch questions then assign trials
        await Promise.all([
            this.getSaveId(),
            this.parseQuestionsXML()
        ])
            .then(() => {
                this.trials = [];
                let t = 0;

                for(let b = 0; b < this.blocks.length; b++) {
                    const block = this.blocks[b];
                    for(let i = 0; i < block.trialCount; i++) {
                        if(this.attentionCheckTrials.indexOf(t) !== -1) {
                            this.trials.push(block.createTrial(
                                {
                                    block: b,
                                    ...block,
                                    ...this.attentionCheckBlueprint,
                                    number: t++
                                }, Trial, true));
                        } else {
                            switch(block.blockType) {
                                case "practice":
                                    this.trials.push(block.createTrial(
                                        {
                                            block: b,
                                            ...block,
                                            ...this.trialBlueprint,
                                            number: t++,
                                            saveTableName: "practiceTrial",
                                            displayFeedback: block.feedback?
                                                this.displayFeedback : null
                                        }, Trial));
                                    break;

                                case "practiceAdvisor":
                                    this.trials.push(block.createTrial(
                                        {
                                            block: b,
                                            ...block,
                                            ...this.trialBlueprint,
                                            number: t++,
                                            saveTableName:
                                                "practiceAdvisedTrial",
                                            displayFeedback: block.feedback?
                                                this.displayFeedback : null
                                        }, AdvisedTrial));
                                    break;

                                case "core":
                                    this.trials.push(block.createTrial({
                                        block: b,
                                        ...block,
                                        ...this.trialBlueprint,
                                        number: t++,
                                        displayFeedback: block.feedback?
                                            this.displayFeedback : null
                                    }, AdvisedTrial));
                                    break;
                            }
                        }
                    }
                }

            })
            .then(() => {

                for(let b = 0; b < this.blocks.length; b++) {
                    // Ids of advisors in the block
                    const block = this.blocks[b];

                    if(!block.advisors)
                        return this.info("No block advisors to process.");

                    const ids = block.advisors.map(a => a.id);

                    // Skip if no shuffling needed
                    if(ids.length <= 1 ||
                        ids.length === block.advisorsPerTrial)
                        return;

                    if(!block.advisorsPerTrial)
                        return;

                    // Count valid trials (core, non attn check)
                    const validTrials = this.trials.filter(
                        t => t.block === b && !t.attentionCheck
                    );

                    // Make drop lists for advisors to be removed from the trial advisors.
                    // First one is balanced, thereafter done randomly.
                    // I.e. this is only balanced for nAdvisors = nOptions - 1
                    const mix = utils.shuffleShoe(ids,
                        Math.ceil(validTrials.length / ids.length));

                    // remove advisors by id
                    mix.map((id, i) =>
                        validTrials[i].advisors =
                            [validTrials[i].advisors.filter(
                                a => a.id !== id
                            )]);

                    for(let i = 1;
                        i < ids.length - b.advisorsPerTrial;
                        i++) {
                        // Remove advisors at random
                        validTrials.forEach(t => {
                            t.advisors = utils.shuffle(t.advisors);
                            t.advisors.pop();
                        });
                    }

                }
            });

        return this;
    }

    // Override the prefix so styling can use Trial rather than duplicating
    get _phaseClassPrefix() {
        return "Study";
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
            "advisorPracticeInstructions",
            "advisorPractice",
            "coreInstructions",
            "core",
            "debriefAdvisors",
            "debrief",
            "results"
        ];
    }

    async awaitTrialLoading() {
        await this.setupTrials();
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
            this.questionIndex = 0;
        }

        let q = this.questions[this.questionIndex];

        let bp = {
            stim: document.createElement("p"),
            correctAnswer:
                parseInt(q.getElementsByTagName("target")[0].innerHTML),
            prompt: "",
            attentionCheck: false,
            displayFeedback: this.displayFeedback
        };
        bp.stim.innerHTML = q.getElementsByTagName("prompt")[0].innerHTML;

        return bp;
    };

    set trialBlueprint(bp) {
        this._trialBlueprint = bp;
    }

    /**
     * Insert an advisor's info tab with an animation for visibility.
     * @param advisor {Advisor}
     * @param resolve {function} callback for promise
     * @return {Promise<HTMLElement>}
     */
    async _introduceAdvisor(advisor, resolve) {
        const elm = await super._introduceAdvisor(advisor, (o)=>o);

        // Continue immediately if no intro text exists
        if(!advisor.introText) {
            return new Promise((resolve) => {setTimeout(resolve, 0, elm)});
        }

        return new Promise((resolve) => {
            // Description message about the advisor, continue when clicked
            elm.appendChild(document.importNode(
                document.getElementById("advisor-intro-text").content,
                true));

            const popup = elm.querySelector('.advisor-intro');

            const delay = 1000;
            const minTime = new Date().getTime() + delay;
            popup.querySelector(".text").innerHTML = advisor.introText;

            const btn = popup.querySelector(".confirm button");
            btn.disabled = "disabled";

            setTimeout(() => btn.disabled = "", delay);

            btn.addEventListener("click", (e) => {
                if(new Date().getTime() < minTime)
                    return;

                advisor.info("Intro text okay'd.");
                popup.remove();
                resolve(elm);
            });
        });

    }

    /**
     * End experiment on incorrect attention check (paid participants only)
     * @param trial {Trial}
     * @return {Promise<never>}
     */
    async attentionCheckFeedback(trial) {

        if(trial.attentionCheckCorrect && !trial.attentionCheckCorrect(trial)) {
            Study._updateInstructions("attn-check-fail",
                ()=>{},
                "fullscreen-warning");
            document.body.classList.add("fatal-error");

            // leave fullscreen
            if(document.fullscreenElement)
                Study.unlockFullscreen(document.fullscreenElement);

            // save the trial so there's a record of the failure
            let table = trial.saveTableName?
                trial.saveTableName : trial.constructor.name;
            this.saveCSVRow(table, true, trial.toTable());

            return new Promise(r => {});
        }
    }

    get attentionCheckBlueprint() {

        const me = this;
        const attentionCheck = document.querySelector('#response-panel').attentionCheck || null;
        const markerWidth = attentionCheck && attentionCheck.markerWidths?
            parseInt(attentionCheck.markerWidths[0]) : null;
        const highConf = attentionCheck? attentionCheck.confidence : null;

        let bp = {
            stim: document.createElement("p"),
            correctAnswer: attentionCheck.answer,
            prompt: "",
            attentionCheck: true,
            attentionCheckMarkerWidth: markerWidth,
            attentionCheckHighConf: highConf,
            attentionCheckCorrect: attentionCheck.checkFunction,
            advisors: null,
            displayFeedback: (me.prolific || /test/i.test(me.tags))?
                (t)=>me.attentionCheckFeedback(t) : null
        };

        bp.stim.innerHTML = attentionCheck.question;

        return bp;
    }

    async debriefAdvisors() {

        const me = this;
        const advisors = utils.shuffle(this.advisors).filter(a => a.id !== 0);

        // Show the debrief questions
        const setForm = function (resolve) {
            const content = document.querySelector("#content");
            content.innerHTML = "";
            content.appendChild(
                document.importNode(
                    document.getElementById("debrief-advisors").content, true
                ));

            const form = document.querySelector("form");

            const advisor = advisors.pop();
            const div = form.querySelector(".subject");
            div.dataset.id = advisor.id;
            div.appendChild(advisor.getInfoTab());

            // Prevent form submission navigation especially on Safari
            utils.preventFormSubmission(form);

            // Disable form submission until an input or textarea has been clicked
            const submit = form.querySelector("button[name='submit']");
            submit.disabled = "disabled";
            form.querySelectorAll("input[type='range'], form textarea")
                .forEach(i => {
                    i.addEventListener("click", ()=> submit.disabled = "");
                    i.addEventListener("change", ()=> submit.disabled = "");
                    i.addEventListener("focus", ()=> submit.disabled = "");
                });

            // Register submit function
            submit.addEventListener("click", e=>{
                e = e || window.event();
                e.preventDefault();
                const data = {};
                form.querySelectorAll("input:not([type='submit']), textarea").forEach(i => data[i.name] = i.value);
                data.advisorId = form.querySelector(".subject").dataset.id;
                me.saveCSVRow("debrief-advisors", true, data);
                if(advisors.length)
                    setForm(resolve);
                else
                    resolve("debriefAdvisors");

                return false;
            });
        };

        return new Promise(function(resolve) {
            setForm(resolve);
        });
    }

    async debrief() {

        const me = this;

        const checkInput = function() {
            document.querySelectorAll("form *").forEach(e => e.classList.remove("invalid"));

            // Has anything been written in the mandatory fields?
            let okay = true;
            document.querySelectorAll("form textarea.mandatory").forEach(elm => {
                if(elm.value === "") {
                    elm.classList.add("invalid");
                    okay = false;
                }
            });

            // Check radio groups
            const radios = document.querySelectorAll("form input[type='radio'].mandatory");
            const names = [];
            radios.forEach(r => {
                if(names.indexOf(r.name) === -1)
                    names.push(r.name);
            });

            names.forEach(n => {
                const opts = document.querySelectorAll("form input[type='radio'][name='" + n + "']");

                let k = false;
                opts.forEach(o => {
                    if(o.checked)
                        k = true;
                });

                if(!k) {
                    okay = false;
                    opts[0].closest(".radioQ").classList.add("invalid");
                }
            });

            return okay;
        };

        return new Promise(function(resolve) {
            // Show the debrief questions
            const content = document.querySelector("#content");
            content.innerHTML = "";
            content.appendChild(
                document.importNode(
                    document.getElementById("debrief").content, true
                ));

            // Prevent form submission especially on Safari
            utils.preventFormSubmission(content.querySelector("form"));

            document.querySelector("form button[name='submit']").addEventListener("click", e=>{
                e = e || window.event();
                e.preventDefault();

                if(!checkInput())
                    return false;

                const priv = {
                    comment: document.querySelector("form textarea[name='generalComments']").value
                };

                const pub = me._getPublicDebriefFormData();

                me.saveCSVRow("debrief-form", false, priv);
                me.saveCSVRow("debrief-form", true, pub);

                // Save the study in the background and take off the nav lock
                me.save(console.log)
                        .then(() => window.onbeforeunload = null);

                resolve("debrief");

                return false;
            });
        });
    }

    _getPublicDebriefFormData() {
        return {
            comment: document.querySelector("form textarea[name='advisorDifference']").value
        };
    }

    /**
     * Simulate a set of results for testing the results display
     * @return {Array}
     * @protected
     */
    _simulateResults() {
        const trialList = [];

        for(let t = 0; t < this.trials.length; t++) {
            this.trials[t].data.responseMarkerWidthFinal =
                utils.shuffle([3, 9, 27])[0];
            this.trials[t].data.responseEstimateLeftFinal =
                1900 +
                Math.floor(Math.random() *
                    (100 - this.trials[t].data.responseMarkerWidthFinal));
            trialList.push(this.trials[t].toTable());
        }

        return trialList;
    }

    /**
     * Fetch results from the server
     * @return {Promise<*>}
     * @protected
     */
    async _fetchResults() {
        let trialList = null;

        let idCode = "";
        let version = "";
        if(utils.getQueryStringValue("fb")) {
            idCode = utils.getQueryStringValue("fb").split("-")[0];
            this.id = idCode;
            version = utils.getQueryStringValue("fb").split("-")[1];
            this.studyVersion = version;
        } else {
            idCode = this.id;
            version = this.studyVersion;
        }

        // Look up trials according to the core trial type
        const trialClass = this.blocks.filter(b => b.blockType === "core")[0].trialClass;
        const trialClassName = trialClass? trialClass.name : "AdvisedTrial";

        await fetch("../readSerial.php?tbl=" + trialClassName,
            {method: "POST", body: JSON.stringify(
                    { idCode, version, studyId: this.studyName})})
            .then(async (r) => await r.text())
            .then((txt) => JSON.parse(txt))
            .then((o) => trialList = JSON.parse(o.content));

        return trialList;
    }

    /**
     * Handle click event for the result icons
     * @param e {Event}
     * @protected
     */
    static _playMarker(e) {
        e.stopPropagation();

        const marker = e.currentTarget;
        const detail = /true/i.test(utils.getQueryStringValue("detail"));

        // show confidence guides
        document.querySelectorAll(".marker.target").forEach((elm) => {
            elm.classList.remove("detail");
        });

        if(marker.classList.contains("marker"))
            marker.classList.add("detail");

        // show correct answer
        const targetId = "estimate" + marker.dataset.number;
        document.querySelectorAll(".marker.estimate").forEach((elm) => {
            if(/(estimate[0-9]+)/.exec(elm.id)[0] === targetId)
                elm.style.display = "block";
            else
                elm.style.display = "";
        });

        // show prompt in the prompt area
        if(marker.classList.contains("marker"))
            document.querySelector(".feedback-wrapper .prompt").innerHTML =
                marker.dataset.prompt + " (" + marker.dataset.target + ")";
        else
            document.querySelector(".feedback-wrapper .prompt").innerHTML =
                "Click a marker for more info...";

        if(detail) {
            // Show some debugging info at the top
            const p = document.querySelector(".timeline .debug");
            p.innerHTML = "";
            for(let k in marker.dataset) {
                p.innerHTML += "<strong>" + k + "</strong>: " +
                    marker.dataset[k] + "<br/>";
            }
        }
    }

    /**
     * Create the detailed display of results
     * @param trialList {Trial[]} trials to display results for
     * @param [detail=false] {boolean} whether to use detailed displays
     */
    static resultsTimeline(trialList, detail=false) {
        // Update the score spans
        let n = 0;
        let nCorrect = 0;
        let score = 0;
        const scoreFactor = 27;
        trialList.forEach((t) => {
            n++;
            if(parseInt(t.responseEstimateLeftFinal) <=
                parseInt(t.correctAnswer) &&
                parseInt(t.responseEstimateLeftFinal) +
                parseInt(t.responseMarkerWidthFinal) >=
                parseInt(t.correctAnswer)) {
                // Check whether the score is saved in the data
                if(t.responseMarkerValueFinal)
                    score += parseInt(t.responseMarkerValueFinal);
                else
                if(t.responseMarkerValue)
                    score += parseInt(t.responseMarkerValue);
                else
                    score +=
                        scoreFactor /
                        parseInt(t.responseMarkerWidthFinal);
                nCorrect++;
            }
        });
        document.querySelector("span.nCorrect").innerHTML = nCorrect.toString();
        document.querySelector("span.n").innerHTML = n.toString();
        document.querySelector("span.percentCorrect").innerHTML =
            (nCorrect / n * 100).toFixed(2);
        document.querySelector("span.score").innerHTML = score.toString();

        const TL = content.querySelector(".line");

        TL.parentElement.addEventListener("click", DatesStudy._playMarker);

        // Draw timeline labels
        let min = Infinity;
        let max = -Infinity;
        trialList.forEach(t => {
            // Final response
            if(parseInt(t.responseEstimateLeftFinal) < min)
                min = parseInt(t.responseEstimateLeftFinal);
            if(parseInt(t.correctAnswer) < min)
                min = parseInt(t.correctAnswer);
            if(parseInt(t.responseEstimateLeftFinal) +
                parseInt(t.responseMarkerWidthFinal) > max)
                max = parseInt(t.responseEstimateLeftFinal) +
                    parseInt(t.responseMarkerWidthFinal);
            if(parseInt(t.correctAnswer) > max)
                max = parseInt(t.correctAnswer);
            if(detail) {
                // Initial response
                if(parseInt(t.responseEstimateLeft) < min)
                    min = parseInt(t.responseEstimateLeft);
                if(parseInt(t.responseEstimateLeft) +
                    parseInt(t.responseMarkerWidth) > max)
                    max = parseInt(t.responseEstimateLeft) +
                        parseInt(t.responseMarkerWidth);

                // Advice
                let i = 0;
                while(Object.keys(t).indexOf("advisor" +
                    i.toString() + "id") !== -1) {
                    const p = "advisor" + i.toString();
                    const w = parseInt(t[p + "confidence"]);

                    if(parseInt(t[p + "advice"]) - w < min)
                        min = parseInt(t[p + "advice"]) - w;
                    if(parseInt(t[p + "advice"]) + w > max)
                        max = parseInt(t[p + "advice"]) + w;

                    i++;
                }
            }
        });
        const step = 10;
        // add a little buffer to the next marker
        max = max + step - (max % step);
        min = min - (min % step);

        for(let t = min; t <= max; t += step) {
            let elm = document.createElement("div");
            elm.classList.add("label");
            elm.innerText = t.toString();
            TL.appendChild(elm);
            elm.style.left = ((t - min) / (max - min) * TL.clientWidth) + "px";
        }

        window.feedbackMarker = null;

        // Draw markers
        let x = -1;
        const year = TL.clientWidth / (max - min);

        const makeMarker = function(left, width, type = "", classes = []) {
            const l = parseFloat(left);
            const w = parseFloat(width);
            const marker = document.createElement('div');
            marker.id = "estimate" + x.toString() + type;
            marker.classList.add("response-marker", "marker", "estimate");
            if(type)
                marker.classList.add(type);
            if(classes.length)
                marker.classList.add(...classes);

            marker.style.width = (year * (w + 1) - 1) + "px";
            marker.style.left = ((l - min) /
                (max - min) * TL.clientWidth) +
                "px";
            marker.title = left + " - " +  (l + w).toString();
            return TL.appendChild(marker);
        };

        trialList.forEach((t) => {
            x++;

            if(detail) {
                // Initial answer marker
                makeMarker(t.responseEstimateLeft,
                    t.responseMarkerWidth,
                    "initial");

                // Advice
                let i = 0;
                while(Object.keys(t).indexOf("advisor" +
                    i.toString() +
                    "id") !== -1) {
                    const a = "advisor" + i.toString();
                    const w = t[a + "confidence"];
                    makeMarker(t[a + "advice"] - w,
                        w,
                        t[a + "idDescription"],
                        ["advice"]);

                    i++;
                }
            }

            // Answer marker
            makeMarker(t.responseEstimateLeftFinal,
                t.responseMarkerWidthFinal);

            // Actual answer
            const ans = document.createElement('div');
            ans.id = "answer" + x.toString();
            // pull the prompt out of its <p> tags
            let prompt = /^<p[^>]*?>([\s\S]*)<\/p>\s*$/i.exec(t.stimHTML);
            ans.dataset.prompt = prompt? prompt[1] : t.stimHTML;
            ans.title = t.correctAnswer;
            ans.dataset.target = t.correctAnswer;
            ans.dataset.number = x.toString();
            ans.addEventListener("click", DatesStudy._playMarker);
            ans.classList.add("marker", "target");
            ans.style.left = ((t.correctAnswer - min) / (max - min) *
                TL.clientWidth + year / 2) +
                "px";
            ans.style.top = "-1em";
            if(parseInt(t.responseEstimateLeftFinal) <=
                parseInt(t.correctAnswer) &&
                parseInt(t.responseEstimateLeftFinal) +
                parseInt(t.responseMarkerWidthFinal) >=
                parseInt(t.correctAnswer))
                ans.innerHTML = "&starf;";
            else
                ans.innerHTML = "&star;";

            // Additional details
            if(detail) {
                let i = 0;
                while(Object.keys(t).indexOf("advisor" +
                    i.toString() + "id") !== -1) {
                    const p = "advisor" + i.toString();
                    ans.dataset[p + "idDescription"] =
                        t[p + "idDescription"];
                    ans.dataset[p + "actualType"] = t[p + "actualType"];
                    ans.dataset[p + "nominalType"] = t[p + "nominalType"];

                    i++;
                }
            }

            // Avoid collisions
            const others = TL.querySelectorAll(".marker.target");
            TL.appendChild(ans);
            let my = ans.getBoundingClientRect();

            let i = 0;
            while(true) {
                if(i++ > 300) {
                    console.error("loop did not break");
                    break;
                }

                let okay = true;
                for(let o of others) {
                    let r = o.getBoundingClientRect();
                    if(((my.top <= r.bottom && my.bottom >= r.top) ||
                        (my.bottom > r.top && my.top < r.bottom)) &&
                        ((my.left <= r.right && my.right >= r.left) ||
                            (my.right > r.left && my.left < r.right)))
                        okay = false;
                }

                if(okay)
                    break;

                ans.style.top = (ans.offsetTop - 1).toString() + "px";
                my = ans.getBoundingClientRect();
            }
        });
    }

    /**
     * Load the template from the #feedback element and fix links/payment detail display as necessary
     */
    importResultsTemplate() {
        const content = document.querySelector("#content");
        content.innerHTML = "";
        content.appendChild(
            document.importNode(
                document.getElementById("feedback").content, true
            ));

        // Update the permalink
        let link = window.location.origin + window.location.pathname;
        link = /localhost/.test(link)? link :
            link.replace(
                "https://acclab.psy.ox.ac.uk/~mj221/ESM/ACv2/",
                "http://tinyurl.com/acclab-ac2/");
        let code = this.id + "-" + this.studyVersion;

        const permalink = document.querySelector(".feedback-wrapper span.permalink");
        if(permalink)
            permalink.innerHTML = link + "?fb=" + code;
        // Update redo link
        const redoLink = document.querySelector(".feedback-wrapper span.redo-link");
        if(redoLink)
            redoLink.innerText = link + "?PROLIFIC_PID=" + code + encodeURIComponent("_+1");

        // Hide payment link for revisits
        const paymentLink = document.querySelector(".payment-link");
        if(paymentLink) {
            if(utils.getQueryStringValue("fb"))
                paymentLink.style.display = "none";
            else
                paymentLink.innerHTML =
                    "Payment code: <a href='https://app.prolific.ac/submissions/complete?cc=" + code + "' target='_blank'>" + code + "</a>";
        }
    }

    async results() {

        // leave fullscreen
        if(document.fullscreenElement)
            Study.unlockFullscreen(document.fullscreenElement);

        // Protect against weird-looking-ness when resizing
        const me = this;
        window.addEventListener("resize", () => {
            if(window.resizeTimeout)
                clearTimeout(window.resizeTimeout);

            window.resizeTimeout = setTimeout(() => me.results(), 50);
        });

        // Permalinks, thanks text, etc.
        this.importResultsTemplate();

        let trialList = null;

        // Simulate results if we're testing feedback
        if(DEBUG.level >= 1 && utils.getQueryStringValue("fb"))
            trialList = this._simulateResults();
        else
            trialList = await this._fetchResults();

        // Remove attention checks
        trialList = trialList.filter(t => t.isAttentionCheck !== 1);

        const detail = /true/i.test(utils.getQueryStringValue("detail"));

        DatesStudy.resultsTimeline(trialList, detail);
    }

    /**
     * Fetch the data for the study in a flat format suitable for CSVing
     * @return {object} key-value pairs
     */
    toTable() {
        const out = super.toTable();

        return {...out, feedback: this.feedback};
    }
}


/**
 * @class NoFeedbackStudy
 * @extends DatesStudy
 * @classdesc Overwrite feedback assignment in the conditions.
 *
 */
class NoFeedbackStudy extends DatesStudy {

    /**
     * This is kinda a massive ugly copy+paste hack.
     * Really conditions should be handled with flags or something.
     * @param condition
     */
    setCondition(condition) {
        if(condition)
            this.condition = condition;

        this.info("Assigning condition variables for condition " + this.condition);

        this._setAdvisorOrder(this.condition % 2);

        // Group stuff (static)
        const match = /(^| )group-([0-9]+)( |$)/.exec(document.body.className);
        let pGroup;
        if(match[2]) {
            pGroup = parseInt(match[2]);
        } else {
            this.warn('No group-# class in body, defaulting to group 1.');
            pGroup = 1;
        }
        this.pGroup = pGroup;

        this.advisors.forEach(
            a => a.sameGroup = a.group === this.pGroup
        );

        this.pushBlockPropertiesToTrials();
    }
}

/**
 * @class NoFeedbackContexts
 * @extends NoFeedbackStudy
 * @classdesc Advisors are unique on each trial, drawn from a population of advisors defined by the initial advisors. Context, described at the beginning of each block, informs participants about the population of advisors (rather than an introduction to the advisor they'll have for the whole block).
 *
 */
class NoFeedbackContexts extends NoFeedbackStudy {

    static get listPhases() {
        return [
            "splashScreen",
            "consent",
            "demographics",
            "introduction",
            "training",
            "practiceInstructions",
            "practice",
            "advisorPracticeInstructions",
            "advisorPractice",
            "coreInstructions",
            "core",
            "debrief",
            "results"
        ];
    }

    async setupTrials() {
        await super.setupTrials();
        this.fillAdvisorNames();
    }

    /**
     * Add cosmetic renaming of advisors to make them appear to be from different groups
     * @return {void}
     */
    fillAdvisorNames() {
        // Make individual advisors for each trial from the individual advisors
        let numbers = utils.shuffle(utils.getSequence(10, 99));

        for(let t = 0; t < this.trials.length; t++) {
            const T = this.trials[t];
            if(!T.advisors)
                continue;
            const advisors = [];
            for(let i = 0; i < T.advisors.length; i++) {
                const a = T.advisors[i];
                const name = a.id === 0? "Practice advisor #" : "Advisor #";

                // Hoist advisor group properties to be trial context properties
                T.context = a.group;
                T.contextName = a.idDescription;
                T.contextDescription = a.introText;

                // Save as new copy of advisor
                advisors.push(new Advisor({
                    ...a,
                    id: t,
                    name: name + numbers.pop().toString(),
                    _image: null // force the identicon to recalculate
                }));
            }
            T.advisors = advisors;
        }

    }

    /**
     * Introduce the context in which the next block is to take place
     * @param advisors
     * @return {Promise<void>}
     * @protected
     */
    async _introduceAdvisors(advisors) {
        // Filter advisors to be unique across id
        const uniqueAdvisors = [];

        advisors.forEach(a => {
            if(!uniqueAdvisors.filter(x => x.id === a.id).length)
                uniqueAdvisors.push(a);
        });

        // Remove current advisors
        document.querySelectorAll(".advisor-key .advisor-key-row").forEach(
            (elm) => elm.remove()
        );

        const a = uniqueAdvisors.pop();

        document.querySelector('#stimulus').innerHTML =
            document.querySelector('#advisor-intro-text')
                .content.querySelector('.advisor-intro').outerHTML;

        document.querySelector('.advisor-intro .text').innerHTML =
            a.introText;

        await new Promise(r => {
            // Add a slight delay to the button press
            const minTime = new Date().getTime() + 500;
            document.querySelector('.advisor-intro .confirm button')
                .addEventListener('click', () => {
                    if(new Date().getTime() >= minTime)
                        r();
                });
        });
    }

}

/**
 * @class MinGroupsStudy
 * @extends DatesStudy
 * @classdesc Minimal groups manipulation.
 *
 * @property questionsXML {string} URL of a question.xml file for parsing
 */
class MinGroupsStudy extends DatesStudy {

    static get listPhases() {
        return [
            "splashScreen",
            "consent",
            "demographics",
            "introduction",
            "training",
            "practiceInstructions",
            "practice",
            "advisorPracticeInstructions",
            "advisorPractice",
            "coreInstructions",
            "assignGroup",
            "core",
            "debriefAdvisors",
            "debrief",
            "results"
        ];
    }
    _setDefaults() {
        super._setDefaults();
    }

    async assignGroup() {

        const me = this;

        return new Promise(function(resolve) {
            function flipCoin() {
                const coin = document.querySelector("#instructions .coin");
                coin.classList.add("spin-stop");

                setTimeout(() => {
                    coin.classList.add("spin-fast", "side-" + me.pGroup);
                    setTimeout(showResult, 3500);
                }, 500);
            }

            function showResult() {
                document.querySelector(".coin-instructions")
                    .classList.remove("pre");
                document.querySelector(".coin-instructions")
                    .classList.add("post");

                setTimeout(allowProgress, 1000);
            }

            function allowProgress() {
                document.querySelector("#instructions button.okay")
                    .disabled = false;
            }

            function finish() {
                instr.innerHTML = "";
                resolve();
            }

            let instr = document.getElementById("instructions");
            instr.innerHTML = "";
            // Add new
            instr.appendChild(
                document.importNode(
                    document.getElementById("assign-group").content,
                    true));
            instr.classList.remove("hidden");

            // Start the coin-flippery
            document.querySelector("#instructions .coin")
                .addEventListener('click', e => {
                    flipCoin();
                });

            document.querySelector("#instructions button.okay")
                .addEventListener('click', e => {finish()});
        });
    }

    /**
     * Set the condition variables according to condition.
     * There are 4 conditions
     *  Odd conditions present the same-group advisor first
     *  Conditions 1-2 vs 3-4 use different participant group assignment
     * @param condition
     */
    setCondition(condition) {
        if(condition)
            this.condition = condition;

        this.info("Assigning condition variables for condition " + this.condition);

        // Group
        this.pGroup = (this.condition <= this.conditionCount / 2) + 1;

        const pGroup = this.pGroup;
        this.advisors.forEach(a => {
            // Do nothing with the practice advisor
            if(a.idDescription === "Practice")
                return;

            a.sameGroup = a.group === pGroup;
            if(a.sameGroup) {
                a.idDescription = "inGroup";
                a.introText = "This advisor is in your group."
            }
            else {
                a.idDescription = "outGroup";
                a.introText = "This advisor is in the other group."
            }
        });

        // Track the participant's group in CSS using a body class
        document.body.classList.add("group-" + this.pGroup);

        // Advisor order
        const advisorOrder = [];

        advisorOrder[0] = (this.condition % 2) + 1;
        advisorOrder[1] = 3 - advisorOrder[0];

        const advisors = this.advisors;
        const me = this;

        this.blocks.filter(b => b.blockType === "core")
            .forEach(b => {
                let i = me.blocks.indexOf(b);
                b.advisors = [advisors[advisorOrder[i % 2]]]
            });

        // Update trials with new info
        const blocks = this.blocks;
        this.trials.forEach(t => {
            if(t.blockType === "core") {
                for(let k in blocks[t.block]) {
                    if(blocks[t.block].hasOwnProperty(k)) {
                        t[k] = blocks[t.block][k];
                    }
                }
            }
        });

        this.validate();
    }

    _getPublicDebriefFormData() {
        return {
            comment: document.querySelector("form textarea[name='advisorDifference']").value,
            group: document.querySelector("form input[name='group']:checked").value,
        };
    }

    /**
     * Fetch the data for the study in a flat format suitable for CSVing
     * @return {object} key-value pairs
     */
    toTable() {
        return {...super.toTable(), pGroup: this.pGroup};
    }
}

/**
 * @class DatesStudyBinary
 * @extends DatesStudy
 * @classdesc The task is altered to be one in which a prospective date is offered for each event, and the participant indicates whether the event occurred before or after that date.
 *
 * @property questionsXML {string} URL of a question.xml file for parsing
 * @property [yearDifference=null] {function} function returning a prospective date given a real date (i.e. the correct answer) and limits ([min, max]). Can be used to alter the difficulty of the task.
 */
class DatesStudyBinary extends DatesStudy {

    static get listPhases() {
        return [
            "splashScreen",
            "consent",
            "demographics",
            "introduction",
            "training",
            "practiceInstructions",
            "practice",
            "advisorPracticeInstructions",
            "advisorPractice",
            "coreInstructions",
            "core",
            "debrief",
            "results"
        ];
    }

    async setupTrials() {
        await super.setupTrials();
        this.fillAdvisorNames();
    }

    /**
     * Update core blocks to have the appropriate advisor order.
     * @param x {int} 0 or 1
     * @protected
     */
    _setAdvisorOrder(x) {
        const advisorOrder = [];

        advisorOrder[0] = x + 1;
        advisorOrder[1] = 3 - advisorOrder[0];

        const advisors = [];

        // Repeat the same advisor for train and test blocks
        const reps = 2;
        advisorOrder.forEach(a => {
            for (let i = 0; i < reps; i++)
                advisors.push(a);
        });

        const me = this;

        const coreBlocks = this.blocks.filter(
            b => b.blockType === "core"
        );

        coreBlocks.forEach(b => {
                const i = advisors.shift();
                if(b.advisorChoice)
                    b.advisors = me.advisors.filter(a => a.id > 0);
                else
                    b.advisors = [me.advisors[i]];
            });
    }

    /**
     * Add cosmetic renaming of certain advisors to make them appear to be a group rather than an individual
     * Advisors who have the number '###' will get assigned a new number.
     * Advisors who have the isGroup variable set to 'true' will be cloned and given different numbers at each appearance.
     * @return {void}
     */
    setCondition(condition) {

        if(condition)
            this.condition = condition;

        this.info("Assigning condition variables for condition " + this.condition);

        // Counterbalanced advisor order
        this._setAdvisorOrder(this.condition % 2);

        this.pushBlockPropertiesToTrials();

        this.validate();
    }

    /**
     * Fill in '###' in advisor names with a unique number
     */
    fillAdvisorNames() {
        // Make individual advisors for each trial from the individual advisors
        let numbers = utils.shuffle(utils.getSequence(10, 99));

        // Ensure specifically named advisors' names aren't duplicated
        this.advisors.forEach(a => {
            const regex = /[ #]([0-9]+)$/.exec(a.name);
            if(regex) {
                const num = parseInt(regex.groups[0]);
                const i = numbers.indexOf(num);
                if(i !== -1) {
                    // remove the number from the numbers list
                    numbers.splice(i, 1);
                }
            }
        });

        // Assign ### advisors' numbers from the pool
        for(let t = 0; t < this.trials.length; t++) {
            const T = this.trials[t];
            if(!T.advisors || !T.advisors.length)
                continue;
            const advisors = [];
            for(let i = 0; i < T.advisors.length; i++) {
                const a = T.advisors[i];

                // Skip advisor if they have a number
                if(!/###/.test(a.name)) {
                    advisors.push(a);
                    continue;
                }

                const name = a.name.replace(/###/, "#" + numbers.pop());

                // Hoist advisor group properties to be trial context properties
                T.context = a.group;
                T.contextName = a.idDescription;
                T.contextDescription = a.introText;

                // Save as new copy of advisor if advisor is a group member
                if(a.isGroup)
                    advisors.push(new Advisor({
                        ...a,
                        name: name,
                        _image: null // force the identicon to recalculate
                    }));
                else {
                    a.name = name;
                    advisors.push(a);
                }
            }
            T.advisors = advisors;
        }
    }

    /**
     * Validate the structure of the Study
     * @param errorOnFail {boolean} whether to throw an error if structure is invalid
     * @param verbose {boolean} whether to log tests to the console
     * @return {boolean}
     */
    validate(errorOnFail = true, verbose = false) {
        const me = this;
        // Advisors should alternate between block sets by isGroup
        const coreBlocks = this.blocks.filter(
            // Core (non-test) blocks have feedback
            b => b.blockType === "core" && b.feedback);
        let x = -1;
        coreBlocks.forEach((b, i) => {
            if(verbose)
                console.log({coreBlockNum: i, advisorId: b.advisors[0].id, block: b, isGroup: b.advisors[0].isGroup});

            if(b.advisors[0].isGroup === x)
                me.raise(
                    "Advisors have same isGroup status in consecutive block sets",
                    errorOnFail,
                    verbose? {block: b, isGroupValue: x, advisor: b.advisors[0]} : {}
                    );
            else
                x = b.advisors[0].isGroup;
        });

        return super.validate(errorOnFail, verbose);
    }

    /**
     * Insert an advisor's info tab with an animation for visibility.
     * @param advisor {Advisor}
     * @param resolve {function} callback for promise
     * @return {Promise<HTMLElement>}
     */
    async _introduceAdvisor(advisor, resolve) {

        document.querySelector('#stimulus').innerHTML =
            document.querySelector('#advisor-intro-text')
                .content.querySelector('.advisor-intro').outerHTML;

        document.querySelector('.advisor-intro .text').innerHTML =
            advisor.introText;

        await new Promise((r) => {
            // Add a slight delay to the button press
            const minTime = new Date().getTime() + 500;
            document.querySelector('.advisor-intro .confirm button')
                .addEventListener('click', () => {
                    if(new Date().getTime() >= minTime)
                        r();
                });
        });
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
        document.getElementById("prompt").innerHTML = "New advisor" + (advisors.length > 1? " group" : "") + "!";
        await this.wait(500);

        await this._introduceAdvisor(advisors[0]);
    }

    /**
     * Default year difference function. Sample an answer from a normal distribution around the correct answer with SD=5yrs.
     * @param correctAnswer {int}
     * @param [limits=[-Infinity, Infinity]] {[int, int]} limits within which to keep the answer
     * @protected
     * @return {int}
     */
    _yearDifference(correctAnswer, limits = [-Infinity, Infinity]) {
        let answer = null;
        let cycle = 0;
        const maxCycles = 10000;
        while(answer === null || answer < limits[0] || answer > limits[1] || answer === correctAnswer) {
            if(cycle++ > maxCycles)
                this.error("Exceeded maximum cycles in _yearDifference(" + correctAnswer + ", " + limits.toString() + ")");

            answer = Math.round(utils.sampleNormal(1, correctAnswer, 5));
        }

        return answer;
    }

    /**
     * Return the next blueprint in the sequence derived from parsing questions
     * @return {object}
     */
    get trialBlueprint() {
        if(typeof this.yearDifference !== "function")
            this.yearDifference = this.yearDifference || this._yearDifference;

        const bp = super.trialBlueprint;

        if(this.questions) {
            bp.anchor = document.createElement("p");
            bp.anchorDate = this.yearDifference(bp.correctAnswer, [1900, 2000]);
            bp.anchor.innerHTML = bp.anchorDate;
        }

        return bp;
    };

    set trialBlueprint(bp) {
        this._trialBlueprint = bp;
    }

    get trainingFeedback() {
        return async (trial) => {
            const correctAnswer = trial.data.correctAnswer;
            document.getElementById("prompt").innerHTML = "";

            // Draw marker
            const marker = document.getElementById("response-panel").feedbackMarker(correctAnswer, trial.data.anchorDate || null);

            if(!marker)
                return;

            // Inject a help panel describing the feedback
            const help = document.createElement("esm-help");
            help.dataset.group = "interface";
            help.classList.add(parseInt(correctAnswer) < parseInt(trial.data.anchorDate)? "right" : "left");
            help.innerHTML = "The correct answer and actual date are shown on the side corresponding to the correct answer. The colour will change depending upon whether your answer was correct. You won't always get feedback, but when you do it will look like this.";
            marker.closest(".response-panel").appendChild(help);

            Study._showHelp(help);

            // Await a click on the marker
            return new Promise((resolve) => {
                help.addEventListener("click", e => {
                    Study._hideHelp(help);
                    help.remove();
                    document.getElementById("prompt").innerText = "";
                    document.querySelector("#response-panel").reset();
                    resolve();
                });
            });
        }
    }

    /**
     * Fetch the data for the study in a flat format suitable for CSVing
     * @return {object} key-value pairs
     */
    toTable() {
        return {
            ...super.toTable(),
            yearDifference: this.yearDifference?
                this.yearDifference.toString() : null
        };
    }

    /**
     * Update the results pane to show overview
     * @param e {Event}
     */
    static resultsOverview(e) {
        document.querySelector(".result .overall").classList.remove("cloak");
    }

    /**
     * Update the specific result inspection area
     * @param e {Event}
     */
    static inspectResult(e) {
        if(!e)
            return;

        const me = e.currentTarget;
        const pane = document.querySelector(".results .result .specific");

        if(!me || !me.selectedOptions || !me.selectedOptions.length > 0 || !pane)
            return DatesStudyBinary.resultsOverview(e);

        const opt = me.selectedOptions[0];

        if(!opt)
            return;

        const ds = opt.dataset;

        if(!ds)
            return;

        // Assign values and classes as necessary
        pane.querySelector(".stimulus-reminder p").innerText = opt.innerText;
        pane.querySelector(".anchor-date").innerHTML = ds.anchorHTML;

        pane.querySelectorAll(".initial, .advice, .final, .answer").forEach(elm => elm.classList.remove("left", "right"));

        pane.querySelector(".initial").classList.add(ds.responseAns === "0"? "left" : "right");
        pane.querySelector(".initial .confidence-value").innerText = ds.responseConfidence;

        pane.querySelector(".advice").classList.add(ds.advisor0adviceSide === "0"? "left" : "right");
        pane.querySelector(".advice .advisor-portrait").src =
            Advisor.imgSrcFromString(
                sha1.sha1(ds.advisor0name),
                {size: 300, format: 'svg'}
                );
        if(ds.advisor0adviceConfidence !== "undefined") {
            pane.querySelector(".advice .confidence").classList.remove("cloak");
            pane.querySelector(".advice .confidence-value").innerText = ds.advisor0adviceConfidence;
        } else
            pane.querySelector(".advice .confidence").classList.add("cloak");

        pane.querySelector(".final").classList.add(ds.responseAnsFinal === "0"? "left" : "right");
        pane.querySelector(".final .confidence-value").innerText = ds.responseConfidenceFinal;

        pane.querySelector(".answer").classList.add(parseInt(ds.correctAnswer) < parseInt(ds.anchorDate)? "left" : "right");
        pane.querySelector(".answer-value").innerText = ds.correctAnswer;
        if(ds.correct === "true")
            pane.querySelector(".star").classList.add("correct");
        else
            pane.querySelector(".star").classList.remove("correct");

        // Show the specific info pane
        document.querySelector(".result .overall").classList.add("cloak");
    }

    async results() {

        // leave fullscreen
        if (document.fullscreenElement || document.webkitFullscreenElement)
            Study.unlockFullscreen(
                document.fullscreenElement || document.webkitFullscreenElement
            );

        // Generic results components.
        this.importResultsTemplate();

        let trialList = await this._fetchResults();

        const qDiv = document.querySelector("select#questions");

        if(!qDiv)
            throw("No questions area found.");

        // Unpack trial list to the response column and store overall stats
        const stats = {
            i: {
                name: "initial",
                correct: 0,
                n: 0,
                conf: 0,
                confRight: 0,
                confWrong: 0
            },
            f: {
                name: "final",
                correct: 0,
                n: 0,
                conf: 0,
                confRight: 0,
                confWrong: 0
            },
            a: {
                name: "advice",
                correct: 0,
                n: 0,
                conf: 0,
                confRight: 0,
                confWrong: 0
            }
        };

        trialList.forEach(t => {
            const tmp = document.createElement("div");
            tmp.innerHTML = t.stimHTML;
            const txt = tmp.textContent || tmp.innerText;
            tmp.remove();

            const opt = qDiv.appendChild(document.createElement("option"));

            opt.innerText = txt;
            opt.title = txt;

            const fields = [
                'advisor0adviceConfidence',
                'advisor0name',
                'advisor0adviceSide',
                'anchorHTML',
                'anchorDate',
                'correctAnswer',
                'responseAns',
                'responseAnsFinal',
                'responseConfidence',
                'responseConfidenceFinal'
            ];
            for(const f of fields)
                opt.dataset[f] = t[f];

            opt.dataset.correct = t.responseAnsFinal ===
                (parseInt(t.correctAnswer) > parseInt(t.anchorDate)? "1" : "0");

            // Record summary stats
            const correctSide = t.correctAnswer < t.anchorDate? "0" : "1";
            stats.a.n++;
            stats.i.n++;
            stats.f.n++;
            stats.i.correct += t.responseAns === correctSide? 1 : 0;
            stats.i.conf += parseInt(t.responseConfidence);
            stats.i[t.responseAns === correctSide?
                "confRight" : "confWrong"] += parseInt(t.responseConfidence);
            stats.f.correct += t.responseAnsFinal === correctSide? 1 : 0;
            stats.f.conf += parseInt(t.responseConfidenceFinal);
            stats.f[t.responseAnsFinal === correctSide?
                "confRight" : "confWrong"] += parseInt(t.responseConfidenceFinal);
            stats.a.correct += t.advisor0adviceSide === correctSide? 1 : 0;
            if(t.advisor0adviceConfidence !== "undefined") {
                stats.a.conf += parseInt(t.advisor0adviceConfidence);
                stats.a[t.advisor0adviceSide === correctSide?
                    "confRight" : "confWrong"] += parseInt(t.advisor0adviceConfidence);
            }
        });

        qDiv.addEventListener("change", DatesStudyBinary.inspectResult);

        // Fill in the overall results
        for(const s in stats) {
            const x = stats[s];
            document.querySelector(".overall ." + x.name + " .accuracy").innerText =
                (x.correct / x.n * 100).toFixed(2);
            document.querySelector(".overall ." + x.name + " .confidence").innerText =
                (x.conf / x.n).toFixed(1);
            document.querySelector(".overall ." + x.name + " .confidence-correct").innerText =
                (x.confRight / x.correct).toFixed(1);
            document.querySelector(".overall ." + x.name + " .confidence-wrong").innerText =
                (x.confWrong / (x.n - x.correct)).toFixed(1);
        }

        // Event listener for overview button
        document.querySelector(".grid .feedback-wrapper .results .question-list p").addEventListener("click", DatesStudyBinary.resultsOverview);
    }

}

/**
 * @class Block
 * @classdesc A block is a class which is never saved in the data; its properties are saved in each trial in the block. It thus presents an easy way of applying specific properties to groups of trials.
 * @property trialCount {int} number of trials in the block
 * @property blockType {string} description of the block type
 * @property feedback {boolean} whether the block trials provide feedback
 * @property advisors {Advisor[]} advisors available to trials in the block
 */
class Block extends BaseObject{
    /**
     *
     * @param props {object} blueprint and other properties fed to class constructor
     * @param defaultClass {prototype} default class if block does not have trialClass variable set
     * @param [forceDefaultClass=false] {boolean} whether to force the defaultClass to be the class prototype used
     *
     * @return {object} Trial of the desired class with props
     */
    createTrial(props, defaultClass, forceDefaultClass = false) {

        let proto = this.trialClass? this.trialClass : defaultClass;

        if(forceDefaultClass)
            proto = defaultClass;

        if(!proto)
            this.error("Tried to create a trial with no prototype supplied.");

        return new proto(props);
    }
}

export {
    Study,
    DatesStudy,
    DatesStudyBinary,
    NoFeedbackStudy,
    NoFeedbackContexts,
    MinGroupsStudy,
    Block
}