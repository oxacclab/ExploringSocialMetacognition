import {DatesStudy} from "./DatesStudy.js";
import {Advisor} from "../Advisors/Advisor.js";

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
        const reps = this.advisorBlockReps || 1;
        advisorOrder.forEach(a => {
            for (let i = 0; i < reps; i++)
                advisors.push(a);
        });

        const me = this;

        const coreBlocks = this.blocks.filter(
            b => b.blockType === "core"
        );

        coreBlocks.forEach(b => {
            if (b.allAdvisors)
                return;

            const i = advisors.shift();
            if (b.advisorChoice)
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

        if (condition)
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
            if (regex) {
                const num = parseInt(regex.groups[0]);
                const i = numbers.indexOf(num);
                if (i !== -1) {
                    // remove the number from the numbers list
                    numbers.splice(i, 1);
                }
            }
        });

        // Assign ### advisors' numbers from the pool
        for (let t = 0; t < this.trials.length; t++) {
            const T = this.trials[t];
            if (!T.advisors || !T.advisors.length)
                continue;
            const advisors = [];
            for (let i = 0; i < T.advisors.length; i++) {
                const a = T.advisors[i];

                // Skip advisor if they have a number
                if (!/###/.test(a.name)) {
                    advisors.push(a);
                    continue;
                }

                const name = a.name.replace(/###/, "#" + numbers.pop());

                // Hoist advisor group properties to be trial context properties
                T.context = a.group;
                T.contextName = a.idDescription;
                T.contextDescription = a.introText;

                // Save as new copy of advisor if advisor is a group member
                if (a.isGroup)
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
            if (verbose)
                console.log({
                    coreBlockNum: i,
                    advisorId: b.advisors[0].id,
                    block: b,
                    isGroup: b.advisors[0].isGroup
                });

            if (b.advisors[0].isGroup === x && typeof x !== "undefined")
                me.raise(
                    "Advisors have same isGroup status in consecutive block sets",
                    errorOnFail,
                    verbose ? {
                        block: b,
                        isGroupValue: x,
                        advisor: b.advisors[0]
                    } : {}
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

        let nodeName = "advisor-intro-text";
        if (advisor.introImage)
            nodeName += "-" + advisor.introImage;

        document.querySelector('#stimulus').innerHTML =
            document.querySelector('#' + nodeName)
                .content.querySelector('.advisor-intro').outerHTML;

        document.querySelector('.advisor-intro .text').innerHTML =
            advisor.introText;

        if (advisor.introImage === "speech")
            document.querySelector('.advisor-intro .text').classList.add("group-" + advisor.group);

        const img = document.querySelector(".advisor-intro .image");
        if (img)
            img.innerHTML = advisor.getInfoTab().outerHTML;

        await new Promise((r) => {
            // Add a slight delay to the button press
            const minTime = new Date().getTime() + 500;
            document.querySelector('.advisor-intro .confirm button')
                .addEventListener('click', () => {
                    if (new Date().getTime() >= minTime)
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
        document.getElementById("prompt").innerHTML = "New advisor" + (advisors.length > 1 ? " group" : "") + "!";
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
        while (answer === null || answer < limits[0] || answer > limits[1] || answer === correctAnswer) {
            if (cycle++ > maxCycles)
                this.error("Exceeded maximum cycles in _yearDifference(" + correctAnswer + ", " + limits.toString() + ")");

            answer = Math.round(utils.sampleNormal(1, correctAnswer, 8));
        }

        return answer;
    }

    /**
     * Return the next blueprint in the sequence derived from parsing questions
     * @return {object}
     */
    get trialBlueprint() {
        if (typeof this.yearDifference !== "function")
            this.yearDifference = this.yearDifference || this._yearDifference;

        const bp = super.trialBlueprint;

        if (this.questions) {
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

            if (!marker)
                return;

            // Inject a help panel describing the feedback
            const help = document.createElement("esm-help");
            help.dataset.group = "interface";
            help.classList.add(parseInt(correctAnswer) < parseInt(trial.data.anchorDate) ? "right" : "left");
            help.innerHTML = "The correct answer and actual date are shown on the side corresponding to the correct answer. The colour will change depending upon whether your answer was correct. You won't always get feedback, but when you do it will look like this.";
            marker.closest(".response-panel").appendChild(help);

            DatesStudyBinary._showHelp(help);

            // Await a click on the marker
            return new Promise((resolve) => {
                help.addEventListener("click", e => {
                    DatesStudyBinary._hideHelp(help);
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
            yearDifference: this.yearDifference ?
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
        if (!e)
            return;

        const me = e.currentTarget;
        const pane = document.querySelector(".results .result .specific");

        if (!me || !me.selectedOptions || !me.selectedOptions.length > 0 || !pane)
            return DatesStudyBinary.resultsOverview(e);

        const opt = me.selectedOptions[0];

        if (!opt)
            return;

        const ds = opt.dataset;

        if (!ds)
            return;

        // Assign values and classes as necessary
        pane.querySelector(".stimulus-reminder p").innerText = opt.innerText;
        pane.querySelector(".anchor-date").innerHTML = ds.anchorHTML;

        pane.querySelectorAll(".initial, .advice, .final, .answer").forEach(elm => elm.classList.remove("left", "right"));

        pane.querySelector(".initial").classList.add(ds.responseAnswerSide === "0" ? "left" : "right");
        pane.querySelector(".initial .confidence-value").innerText = ds.responseConfidence;

        pane.querySelector(".advice").classList.add(ds.advisor0adviceSide === "0" ? "left" : "right");
        pane.querySelector(".advice .advisor-portrait").src =
            ds.advisor0svg ||
            Advisor.imgSrcFromString(
                sha1.sha1(ds.advisor0name),
                {
                    size: 300,
                    format: 'svg'
                }
            );
        if (ds.advisor0adviceConfidence !== "undefined") {
            pane.querySelector(".advice .confidence").classList.remove("cloak");
            pane.querySelector(".advice .confidence-value").innerText = ds.advisor0adviceConfidence;
        } else
            pane.querySelector(".advice .confidence").classList.add("cloak");

        pane.querySelector(".final").classList.add(ds.responseAnswerSideFinal === "0" ? "left" : "right");
        pane.querySelector(".final .confidence-value").innerText = ds.responseConfidenceFinal;

        pane.querySelector(".answer").classList.add(parseInt(ds.correctAnswer) < parseInt(ds.anchorDate) ? "left" : "right");
        pane.querySelector(".answer-value").innerText = ds.correctAnswer;
        if (ds.correct === "true")
            pane.querySelector(".star").classList.add("correct");
        else
            pane.querySelector(".star").classList.remove("correct");

        // Show the specific info pane
        document.querySelector(".result .overall").classList.add("cloak");
    }

    async results() {

        // leave fullscreen
        DatesStudyBinary.unlockFullscreen();

        // Generic results components.
        this.importResultsTemplate();

        let trialList = await this._fetchResults();

        const qDiv = document.querySelector("select#questions");

        if (!qDiv)
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
                'advisor0svg',
                'anchorHTML',
                'anchorDate',
                'correctAnswer',
                'responseAnswerSide',
                'responseAnswerSideFinal',
                'responseConfidence',
                'responseConfidenceFinal'
            ];
            for (const f of fields)
                opt.dataset[f] = t[f];

            opt.dataset.correct = t.responseAnswerSideFinal ===
                (parseInt(t.correctAnswer) > parseInt(t.anchorDate) ? "1" : "0");

            // Record summary stats
            const correctSide = t.correctAnswer < t.anchorDate ? "0" : "1";
            stats.a.n++;
            stats.i.n++;
            stats.f.n++;
            stats.i.correct += t.responseAnswerSide === correctSide ? 1 : 0;
            stats.i.conf += parseInt(t.responseConfidence);
            stats.i[t.responseAnswerSide === correctSide ?
                "confRight" : "confWrong"] += parseInt(t.responseConfidence);
            stats.f.correct += t.responseAnswerSideFinal === correctSide ? 1 : 0;
            stats.f.conf += parseInt(t.responseConfidenceFinal);
            stats.f[t.responseAnswerSideFinal === correctSide ?
                "confRight" : "confWrong"] += parseInt(t.responseConfidenceFinal);
            stats.a.correct += t.advisor0adviceSide === correctSide ? 1 : 0;
            if (t.advisor0adviceConfidence !== "undefined") {
                stats.a.conf += parseInt(t.advisor0adviceConfidence);
                stats.a[t.advisor0adviceSide === correctSide ?
                    "confRight" : "confWrong"] += parseInt(t.advisor0adviceConfidence);
            }
        });

        qDiv.addEventListener("change", DatesStudyBinary.inspectResult);

        // Fill in the overall results
        for (const s in stats) {
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

export {DatesStudyBinary};