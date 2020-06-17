/**
 * Study
 * Matt Jaquiery, March 2019
 *
 * Javascript library for running social metacognition studies.
 */


"use strict";

import * as utils from "../../utils.js";
import {ControlObject} from "../Prototypes.js";
import {Advisor, AdviceProfile, AdviceTypes} from "../Advisors/Advisor.js";
import {Trial} from "../Trials/Trial.js";

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
                            AdviceTypes.CORRECT_DISAGREE.copy(4),
                            AdviceTypes.INCORRECT_REFLECTED.copy(1),
                            // fallbacks
                            AdviceTypes.INCORRECT_REVERSED.copy(0),
                            AdviceTypes.CORRECT.copy(0)
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
                            AdviceTypes.CORRECT_AGREE.copy(4),
                            AdviceTypes.INCORRECT_REFLECTED.copy(1),
                            // fallbacks
                            AdviceTypes.INCORRECT_REVERSED.copy(0),
                            AdviceTypes.CORRECT.copy(0)
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
     */
    static exitFullscreen() {
        try {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        } catch(e) {console.log({caughtError: e})}
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

    static unlockFullscreen() {
        const element =
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement;

        document.body.classList.remove("fullscreen-error");
        const warning = document.querySelector('#fullscreen-warning.open');
        if(warning)
            warning.classList.remove('open');

        if(element)
            clearTimeout(element.fullscreenTimeOut);

        Study.exitFullscreen();
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
        Study.unlockFullscreen();

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

        data = Study._alphabetize(data);

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
     * Return a copy of d with its keys constructed in chronological order matching alphabetical order
     * @param d {Object}
     * @return {Object}
     * @protected
     */
    static _alphabetize(d) {
        const out = {};
        let keys = Object.keys(d);
        keys.sort();
        for (let k = 0; k < keys.length; k++)
            out[keys[k]] = d[k];

        return out;
    }

    /**
     * Update the core blocks to add/remove feedback
     * @param feedback {boolean} whether feedback is to be present in the blocks
     * @protected
     */
    _setFeedback(feedback) {
        const me = this;
        this.blocks.filter(
            b => b.blockType === "core"
            && typeof b.feedback === "undefined"
        )
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


export {
    Study}