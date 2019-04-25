/**
 * Study
 * Matt Jaquiery, March 2019
 *
 * Javascript library for running social metacognition studies.
 */


"use strict";

import {Advisor, ADVICE_CORRECT, ADVICE_INCORRECT_REFLECTED, ADVICE_CORRECT_DISAGREE, ADVICE_CORRECT_AGREE, ADVICE_INCORRECT_REVERSED, AdviceProfile} from "./Advisor.js";
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

        this.studyName = "datesStudy";
        this.studyVersion = "notSet";

        this.currentTrial = 0;
        this.currentBlock = 0;

        this.blockLength = [0];
        this.practiceBlocks = 0;
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
            "coreInstructions",
            "core",
            "debrief",
            "results"
        ];
    }

    async consent() {
        return new Promise(resolve => {
            this.saveCSVRow("consent",false,{
                consentTime: "not yet implemented"//new Date().getTime()
            }).then(reply => resolve(reply));
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
     */
    static _updateInstructions(newTemplateId, callback) {
        let instr = document.getElementById("instructions");

        if(typeof callback !== "function")
            callback = name => console.log(name);

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
                    if(!document.fullscreenElement &&
                        document.querySelector("esm-instruction-page:not(.cloak)").id === "Instruction0Page0")
                        document.querySelector("#content").requestFullscreen();
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
     * @return {Promise<Study>}
     * @protected
     */
    async _runNextBlock() {

        let n = this.blockLength[this.currentBlock];

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

            let help = Study._showHelp(
                document.querySelector(".progress-bar esm-help"));

            await gotoNextStep(help);

            // Pause the progress bar animation
            document.querySelector(".progress-bar .outer").style.animationPlayState = "paused";

            instr.classList.add("top");

            Study._hideHelp(help);

            await T.nextPhase("begin");
            await T.nextPhase("showStim");
            help = Study._showHelp(
                document.querySelector("#stimulus ~ esm-help"));

            await gotoNextStep(help);

            Study._hideHelp(help);

            help = Study._showHelp(
                document.querySelector(".frame.top > .left > esm-help")
            );

            await gotoNextStep(help);
            Study._hideHelp(help);

            let data = T.nextPhase("hideStim");
            T.nextPhase("getResponse");

            help = Study._showHelp(document.querySelector(".response-timeline ~ esm-help"));
            await gotoNextStep(help);
            Study._hideHelp(help);

            help = Study._showHelp(document.querySelector(".response-marker-pool > div ~ esm-help"));
            await gotoNextStep(help);
            Study._hideHelp(help);

            help = Study._showHelp(document.querySelector("#response-panel .buttons ~ esm-help"));
            await gotoNextStep(help);
            Study._hideHelp(help);

            instr.innerHTML =
                "Enter a response to continue";

            await T.nextPhase("getResponse");

            Study._hideHelp(help);

            // finish the trial
            await T.run("showFeedback");

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

    /**
     * Return a list of unique advisors registered to trials in a block
     * @param [block=null] {int|null} a block number or null for the current block
     * @return {Advisor[]}
     */
    getBlockAdvisors(block = null) {
        if(block === null)
            block = this.currentBlock;

        let firstTrial = 0;
        for(let i = 0; i < block; i++)
            firstTrial += this.blockLength[i];

        // Find advisors in the upcoming block
        let advisors = [];
        for(let i = firstTrial; i < firstTrial + this.blockLength[block]; i++)
            if(this.trials[i].advisors)
                this.trials[i].advisors.forEach(a => {
                    if(advisors.indexOf(a) === -1)
                        advisors.push(a);
                });

        return advisors;
    }

    async preBlock(introduceAdvisors = true) {

        if(introduceAdvisors) {
            await this._introduceAdvisors(this.getBlockAdvisors());
        }

        // Pre-block delay
        document.getElementById("prompt").innerHTML = "Get ready";
        await this.countdown(this.countdownTime);
    }

    async postBlock() {
        return new Promise(function(resolve) {
            let data = [];
            Study._updateInstructions("block-break",
                (name) => {
                    let now = new Date().getTime();
                    data.push({name, now});
                    if(name === "exit")
                        resolve(data);
                });
        });
    }

    async practice() {

        // Save the advisors' CSV entries
        this.advisors.forEach(a =>
            this.saveCSVRow("advisors", true, a.toTable()));

        let b = this.practiceBlocks;

        for(let i = 0; i < b; i++) {

            await this.preBlock();

            // Run the trial
            await this._runNextBlock();

            if(b > 1 && i < b-1)
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

            let intro = i === 0? false : this.getBlockAdvisors(i) !== this.getBlockAdvisors(i - 1);

            await this.preBlock(intro);

            // Run the trial
            await this._runNextBlock();

            if(i < b-1)
                await this.postBlock();
        }

        if(document.fullscreenElement)
            document.exitFullscreen();

        return this;
    }

    reportIssue() {
        const me = this;

        // Reset reporting form
        const div = document.querySelector("#report-issue");
        div.innerHTML = "";
        div.appendChild(document.importNode(document.querySelector("#issue-report").content, true));

        div.querySelector("form").addEventListener("submit", e => {
            e.preventDefault();
            const form = document.querySelector("#report-issue form");
            if(form.querySelector("[name='issueContent']").value !== "") {

                const data = {
                    ...me.toTable(),
                    ...me.trials[me.currentTrial].toTable()
                };
                form.querySelectorAll("textarea, select, input:not([type='submit'])").forEach(i => data[i.name] = i.value);

                me.info("User issue report!");
                me.saveCSVRow("issue-report", false, data);
            }

            form.classList.add("exit");
            setTimeout(() => document.body.classList.remove("report-issue"), 1000);
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
        for(let i = 0; i < this.blockLength.length; i++)
            out["block" + i.toString() + "length"] = this.blockLength[i];

        out.countdownTime = this.countdownTime;
        out.practiceBlocks = this.practiceBlocks;

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
            .then(response => callback(response))
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
            onError = (reply)=>console.error("Error: ", reply);

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
            clientTime: new Date().getTime(),
            ...data
        });

        return fetch("../saveSerial.php", {
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
            .catch(error => onError(error));
    }

    async getSaveId() {
        if(this.id)
            return this.id;

        await fetch("../saveSerial.php", {
            method: "POST",
            body: JSON.stringify({
                metadata: {
                    isPublic: false,
                    fileName: "participant-metadata",
                    studyId: this.studyName,
                    studyVersion: this.studyVersion
                },
                data: JSON.stringify({
                    studyId: this.studyName,
                    studyVersion: this.studyVersion,
                    prolificId: utils.getQueryStringValue("PROLIFIC_PID")
                })
            })
        })
            .then(async (r)=> await r.text())
            .then((txt) => JSON.parse(txt))
            .then(id => this.id = id.id);

        return this.id;
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

                let practiceTrials = 0;
                for(let i = 0; i < this.practiceBlocks; i++)
                    practiceTrials += this.blockLength[i];

                for(let i = 0; i < utils.sumList(this.blockLength); i++) {
                    if(i < practiceTrials) {
                        this.trials.push(new AdvisedTrial({
                            ...this.trialBlueprint,
                            advisors: [this.advisors[0]],
                            number: i,
                            saveTableName: "practiceTrial",
                            displayFeedback: this.displayFeedback,
                        }))
                    } else {
                        if(this.attentionCheckTrials.indexOf(i) !== -1)
                            this.trials.push(new Trial({...this.attentionCheckBlueprint, number: i}));
                        else
                            if(this.feedback)
                                this.trials.push(new AdvisedTrial({
                                    ...this.trialBlueprint,
                                    number: i,
                                    displayFeedback: this.displayFeedback
                                }));
                            else
                                this.trials.push(new AdvisedTrial({
                                    ...this.trialBlueprint,
                                    number: i
                                }));
                    }
                }
            });
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
            "coreInstructions",
            "core",
            "debriefAdvisors",
            "debrief",
            "results"
        ];
    }

    async awaitTrialLoading() {
        const me = this;
        return new Promise(resolve => {
           const check = function() {
               if(me.trials.length)
                   resolve(true);
               else
                   setTimeout(check, 25);
           };
           check();
        });
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
            advisors: [this.advisors[1], this.advisors[2]],
            attentionCheck: false
        };
        bp.stim.innerHTML = q.getElementsByTagName("prompt")[0].innerHTML;

        return bp;
    };

    set trialBlueprint(bp) {
        this._trialBlueprint = bp;
    }

    get attentionCheckBlueprint() {
        let ans = 1900 + Math.floor(Math.random() * 100);

        let bp = {
            stim: document.createElement("p"),
            correctAnswer: ans,
            prompt: "",
            attentionCheck: true
        };
        bp.stim.innerHTML = "for this question use the smallest marker to cover the year " + utils.numberToLetters(ans);

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

            // Disable form submission until an input or textarea has been clicked
            const submit = form.querySelector("input[type='submit'");
            submit.disabled = "disabled";
            form.querySelectorAll("input[type='range'], form textarea")
                .forEach(i => i.addEventListener("click", ()=> submit.disabled = ""));

            // Register submit function
            form.addEventListener("submit", e=>{
                e.preventDefault();
                const data = {};
                form.querySelectorAll("input:not([type='submit']), textarea").forEach(i => data[i.name] = i.value);
                data.advisorId = form.querySelector(".subject").dataset.id;
                me.saveCSVRow("debrief-advisors", true, data);
                if(advisors.length)
                    setForm(resolve);
                else
                    resolve("debriefAdvisors");
            });
        };

        return new Promise(function(resolve) {
            setForm(resolve);
        });
    }

    async debrief() {

        const me = this;

        const checkInput = function() {
            // Has anything been written in the mandatory fields?
            let okay = true;
            document.querySelectorAll("form textarea.mandatory").forEach(elm => {
                if(elm.value === "") {
                    elm.classList.add("invalid");
                    okay = false;
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
            document.querySelector("form").addEventListener("submit", e=>{
                e.preventDefault();

                if(!checkInput())
                    return false;

                const priv = {
                    comment: document.querySelector("form textarea[name='generalComments']").value
                };
                const pub = {
                    comment: document.querySelector("form textarea[name='advisorDifference']").value
                };
                me.saveCSVRow("debrief-form", false, priv);
                me.saveCSVRow("debrief-form", true, pub);

                resolve("debrief");
            });
        });
    }

    async results() {
        // Save the study in the background
        if(DEBUG.level < 3)
            this.save(console.log);

        let trialList = [];

        // Simulate results if we're testing feedback
        if(DEBUG.level >= 1 && utils.getQueryStringValue("fb"))
            for(let t = 0; t < this.trials.length; t++) {
                this.trials[t].data.responseMarkerWidthFinal =
                    utils.shuffle([3, 9, 27])[0];
                this.trials[t].data.responseEstimateLeftFinal =
                    1900 +
                    Math.floor(Math.random() *
                        (100 - this.trials[t].data.responseMarkerWidthFinal));
                trialList.push(this.trials[t].toTable());
            }
        else {
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
            await fetch("../readSerial.php?tbl=AdvisedTrial",
                {method: "POST", body: JSON.stringify(
                        { idCode, version, studyId: this.studyName})})
                .then(async (r) => await r.text())
                .then((txt) => JSON.parse(txt))
                .then((o) => trialList = JSON.parse(o.content));
        }

        trialList = trialList.filter(t => t.isAttentionCheck !== 1);

        // Typecast the numerical variables and use final answer if available
        trialList.forEach(t => {
            t.responseMarkerWidth = t.responseMarkerWidthFinal?
                parseInt(t.responseMarkerWidthFinal) :
                parseInt(t.responseMarkerWidth);
            t.responseEstimateLeft = t.responseEstimateLeftFinal?
                parseInt(t.responseEstimateLeftFinal) :
                parseInt(t.responseEstimateLeft);
        });

        const playMarker = function() {
            const e = window.event;

            e.stopPropagation();

            const marker = e.currentTarget;

            // show confidence guides
            document.querySelectorAll(".marker.target").forEach((elm) => {
                elm.classList.remove("detail");
            });

            if(marker.classList.contains("marker"))
                marker.classList.add("detail");

            // show correct answer
            const targetId = "estimate" + marker.dataset.number;
            document.querySelectorAll(".marker.estimate").forEach((elm) => {
                if(elm.id === targetId)
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
        };

        const content = document.querySelector("#content");
        content.innerHTML = "";
        content.appendChild(
            document.importNode(
                document.getElementById("feedback").content, true
            ));

        // Update the permalink
        let link = window.location.host === "localhost"?
            window.location.origin + window.location.pathname :
            "http://tinyurl.com/acclab-ac2/";
        let code = this.id + "-" + this.studyVersion;
        document.querySelector(".feedback-wrapper .display span.permalink")
            .innerHTML = link + "?fb=" + code;
        // Update redo link
        document.querySelector(".feedback-wrapper .display span.redo-link")
            .innerHTML = link + "?PROLIFIC_PID=" + code + "_+1";

        // Hide payment link for revisits
        if(utils.getQueryStringValue("fb"))
            document.querySelector(".payment-link").style.display = "none";
        else
            document.querySelector(".payment-link").innerHTML =
                "Payment code: <a href='https://app.prolific.ac/submissions/complete?cc=" + code + "' target='_blank'>" + code + "</a>";

        // Update the score spans
        let n = 0;
        let nCorrect = 0;
        let score = 0;
        trialList.forEach((t) => {
            n++;
            if(t.responseEstimateLeft <= t.correctAnswer &&
            t.responseEstimateLeft + t.responseMarkerWidth >= t.correctAnswer) {
                score += 27 / t.responseMarkerWidth;
                nCorrect++;
            }
        });
        document.querySelector("span.nCorrect").innerHTML = nCorrect.toString();
        document.querySelector("span.n").innerHTML = n.toString();
        document.querySelector("span.percentCorrect").innerHTML =
            (nCorrect / n * 100).toFixed(2);
        document.querySelector("span.score").innerHTML = score.toString();

        const TL = content.querySelector(".line");

        TL.parentElement.addEventListener("click", playMarker);

        // Draw timeline labels
        let min = Infinity;
        let max = -Infinity;
        trialList.forEach(t => {
            if(parseInt(t.responseEstimateLeft) < min)
                min = parseInt(t.responseEstimateLeft);
            if(parseInt(t.correctAnswer) < min)
                min = parseInt(t.correctAnswer);
            if(parseInt(t.responseEstimateLeft) +
                parseInt(t.responseMarkerWidth) > max)
                max = parseInt(t.responseEstimateLeft) +
                    parseInt(t.responseMarkerWidth);
            if(parseInt(t.correctAnswer) > max)
                max = parseInt(t.correctAnswer);
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
        trialList.forEach((t) => {
            x++;

            // Answer marker
            const marker = document.createElement('div');
            marker.id = "estimate" + x.toString();
            marker.classList.add("response-marker", "marker", "estimate");
            marker.style.width = (year * (t.responseMarkerWidth + 1) - 1) + "px";
            marker.style.left = ((t.responseEstimateLeft - min) / (max - min) * TL.clientWidth) +
                "px";
            marker.title = t.responseEstimateLeft.toString() + " - " +
                (t.responseEstimateLeft + t.responseMarkerWidth).toString();
            TL.appendChild(marker);

            // Actual answer
            const ans = document.createElement('div');
            ans.id = "answer" + x.toString();
            // pull the prompt out of its <p> tags
            let prompt = /^<p[^>]*?>([\s\S]*)<\/p>\s*$/i.exec(t.stimHTML);
            ans.dataset.prompt = prompt? prompt[1] : t.stimHTML;
            ans.title = t.correctAnswer;
            ans.dataset.target = t.correctAnswer;
            ans.dataset.number = x.toString();
            ans.addEventListener("click", playMarker);
            ans.classList.add("marker", "target");
            ans.style.left = ((t.correctAnswer - min) / (max - min) *
                TL.clientWidth + year / 2) +
                "px";
            ans.style.top = "-1em";
            if(t.responseEstimateLeft <= t.correctAnswer &&
                t.responseEstimateLeft + t.responseMarkerWidth >= t.correctAnswer)
                ans.innerHTML = "&starf;";
            else
                ans.innerHTML = "&star;";

            // avoid collisions
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
     * Fetch the data for the study in a flat format suitable for CSVing
     * @return {object} key-value pairs
     */
    toTable() {
        const out = super.toTable();

        return {...out, feedback: this.feedback};
    }
}

export {Study, DatesStudy}