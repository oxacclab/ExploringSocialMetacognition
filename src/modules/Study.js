/**
 * Study
 * Matt Jaquiery, March 2019
 *
 * Javascript library for running social metacognition studies.
 */


"use strict";

import {Advisor, ADVICE_AGREE, ADVICE_CORRECT, ADVICE_INCORRECT_REFLECTED, ADVICE_CORRECT_DISAGREE, ADVICE_CORRECT_AGREE, AdviceProfile} from "./Advisor.js";
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
        this.studyVersion = "0.0.1";
        this.platformId = "not set";
        this.debriefComments = "";

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
                    confidence: 9,
                    adviceProfile: new AdviceProfile({
                        adviceTypes: [
                            ADVICE_CORRECT_DISAGREE.copy(4),
                            ADVICE_INCORRECT_REFLECTED.copy(1),
                            ADVICE_CORRECT.copy(0)
                        ]
                    })
                }),
                new Advisor({
                    id: 2,
                    group: 2,
                    name: "Advisor #09",
                    templateId: "advisor-key",
                    confidence: 9,
                    adviceProfile: new AdviceProfile({
                        adviceTypes: [
                            ADVICE_INCORRECT_REFLECTED.copy(1),
                            ADVICE_CORRECT_AGREE.copy(4),
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

            // Save trial data
            this.saveCSVRow(this.trials[this.currentTrial].constructor.name,
                true, this.trials[this.currentTrial].toTable());

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

            // Pause the progress bar animation
            document.querySelector(".progress-bar .outer").style.animationPlayState = "paused";

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

            instr.innerHTML =
                "Enter an estimate to move on...";
            instr.classList.add("top");
            let data = T.nextPhase("hideStim");

            help = Study._showHelp(
                document.querySelector("esm-response-timeline ~ esm-help"));

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

    async postBlock() {
        return new Promise(function(resolve) {
            let data = [];
            Study._updateInstructions("block-break",
                (name) => {
                    let now = new Date().getTime();
                    data.push({name, now});
                    if(name === "end")
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
                    if(name === "end")
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

            await this.preBlock(false);

            // Run the trial
            await this._runNextBlock();

            if(i < b-1)
                await this.postBlock();
        }

        if(document.fullscreenElement)
            document.exitFullscreen();

        return this;
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

        const privateData = this.extractPrivateData();

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
                privateData: JSON.stringify(privateData)
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
            ...data
        });

        return fetch("../saveSerial.php", {
            method: "POST",
            body: JSON.stringify({metadata, data})
        })
            .then(response => response.text())
            .then(response => callback(response))
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
                for(let i = 0; i < utils.sumList(this.blockLength); i++) {
                    if(this.attentionCheckTrials.indexOf(i) !== -1)
                        this.trials.push(new Trial({...this.attentionCheckBlueprint, number: i}));
                    else
                        this.trials.push(new AdvisedTrial({...this.trialBlueprint, number: i}))
                }
            });
    }

    // Override the prefix so styling can use Trial rather than duplicating
    get _phaseClassPrefix() {
        return "Study";
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
            displayFeedback: this.displayFeedback,
            advisors: this.advisors,
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

    async results() {
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
            "http://tinyurl.com/acclab-de";
        let code = this.id + "-" + this.studyVersion;
        document.querySelector(".feedback-wrapper .display span.permalink")
            .innerHTML = link + "?fb=" + code;

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
                if(i++ > 100) {
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

                ans.style.top = (i * -my.height / 3) + "px";
                my = ans.getBoundingClientRect();
            }
        });
    }
}

export {Study, DatesStudy}