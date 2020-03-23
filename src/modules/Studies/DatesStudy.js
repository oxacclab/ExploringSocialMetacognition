import {Trial} from "../Trials/Trial.js";
import {AdvisedTrial} from "../Trials/AdvisedTrial.js";
import * as utils from "../../utils.js";
import {Study} from "./Study.js";

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

                for (let b = 0; b < this.blocks.length; b++) {
                    const block = this.blocks[b];
                    for (let i = 0; i < block.trialCount; i++) {
                        if (this.attentionCheckTrials.indexOf(t) !== -1) {
                            this.trials.push(block.createTrial(
                                {
                                    block: b,
                                    ...block,
                                    ...this.attentionCheckBlueprint,
                                    number: t++
                                }, Trial, true));
                        } else {
                            switch (block.blockType) {
                                case "practice":
                                    this.trials.push(block.createTrial(
                                        {
                                            block: b,
                                            ...block,
                                            ...this.trialBlueprint,
                                            number: t++,
                                            saveTableName: "practiceTrial",
                                            displayFeedback: block.feedback ?
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
                                            displayFeedback: block.feedback ?
                                                this.displayFeedback : null
                                        }, AdvisedTrial));
                                    break;

                                case "core":
                                    this.trials.push(block.createTrial({
                                        block: b,
                                        ...block,
                                        ...this.trialBlueprint,
                                        number: t++,
                                        displayFeedback: block.feedback ?
                                            this.displayFeedback : null
                                    }, AdvisedTrial));
                                    break;
                            }
                        }
                    }
                }

            })
            .then(() => {

                for (let b = 0; b < this.blocks.length; b++) {
                    // Ids of advisors in the block
                    const block = this.blocks[b];

                    if (!block.advisors) {
                        this.info("No block advisors to process.");
                        continue;
                    }


                    const ids = block.advisors.map(a => a.id);

                    // Skip if no shuffling needed
                    if (ids.length <= 1 ||
                        ids.length === block.advisorsPerTrial)
                        continue;

                    if (!block.advisorsPerTrial)
                        continue;

                    // Count valid trials (core, non attn check)
                    const validTrials = this.trials.filter(
                        t => t.block === b && !t.attentionCheck
                    );

                    // Make drop lists for advisors to be removed from the trial advisors.
                    // First one is balanced, thereafter done randomly.
                    // I.e. this is only balanced for nAdvisors = nOptions - 1
                    const mix = utils.shuffleShoe(block.advisors,
                        Math.ceil(validTrials.length / ids.length));

                    // Special case for balancing where we want 1 advisor/trial
                    if (block.advisorsPerTrial === 1) {
                        mix.map((advisor, i) =>
                            validTrials[i].advisors = [advisor]);
                        return;
                    }

                    // remove advisors by id
                    mix.map((advisor, i) =>
                        validTrials[i].advisors =
                            validTrials[i].advisors.filter(
                                a => a !== advisor
                            ));

                    for (let i = 1;
                         i < ids.length - block.advisorsPerTrial;
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

        if (typeof this.questions === "undefined")
            return this._trialBlueprint;

        this.questionIndex++;
        if (this.questionIndex >= this.questions.length) {
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
        const elm = await super._introduceAdvisor(advisor, (o) => o);

        // Continue immediately if no intro text exists
        if (!advisor.introText) {
            return new Promise((resolve) => {
                setTimeout(resolve, 0, elm)
            });
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
                if (new Date().getTime() < minTime)
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

        if (trial.attentionCheckCorrect && !trial.attentionCheckCorrect(trial)) {
            DatesStudy._updateInstructions("attn-check-fail",
                () => {
                },
                "fullscreen-warning");
            document.body.classList.add("fatal-error");

            // leave fullscreen
            DatesStudy.unlockFullscreen();

            // save the trial so there's a record of the failure
            let table = trial.saveTableName ?
                trial.saveTableName : trial.constructor.name;
            this.saveCSVRow(table, true, trial.toTable());

            return new Promise(r => {
            });
        }
    }

    get attentionCheckBlueprint() {

        const me = this;
        const attentionCheck = document.querySelector('#response-panel').attentionCheck || null;
        const markerWidth = attentionCheck && attentionCheck.markerWidths ?
            parseInt(attentionCheck.markerWidths[0]) : null;
        const highConf = attentionCheck ? attentionCheck.confidence : null;

        let bp = {
            stim: document.createElement("p"),
            correctAnswer: attentionCheck.answer,
            prompt: "",
            attentionCheck: true,
            attentionCheckMarkerWidth: markerWidth,
            attentionCheckHighConf: highConf,
            attentionCheckCorrect: attentionCheck.checkFunction,
            advisors: null,
            displayFeedback: (me.prolific || /test/i.test(me.tags)) ?
                (t) => me.attentionCheckFeedback(t) : null
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
                    i.addEventListener("click", () => submit.disabled = "");
                    i.addEventListener("change", () => submit.disabled = "");
                    i.addEventListener("focus", () => submit.disabled = "");
                });

            // Register submit function
            submit.addEventListener("click", e => {
                e = e || window.event();
                e.preventDefault();
                const data = {};
                form.querySelectorAll("input:not([type='submit']), textarea").forEach(i => data[i.name] = i.value);
                data.advisorId = form.querySelector(".subject").dataset.id;
                me.saveCSVRow("debrief-advisors", true, data);
                if (advisors.length)
                    setForm(resolve);
                else
                    resolve("debriefAdvisors");

                return false;
            });
        };

        return new Promise(function (resolve) {
            setForm(resolve);
        });
    }

    async debrief() {

        const me = this;

        const checkInput = function () {
            document.querySelectorAll("form *").forEach(e => e.classList.remove("invalid"));

            // Has anything been written in the mandatory fields?
            let okay = true;
            document.querySelectorAll("form textarea.mandatory").forEach(elm => {
                if (elm.value === "") {
                    elm.classList.add("invalid");
                    okay = false;
                }
            });

            // Check radio groups
            const radios = document.querySelectorAll("form input[type='radio'].mandatory");
            const names = [];
            radios.forEach(r => {
                if (names.indexOf(r.name) === -1)
                    names.push(r.name);
            });

            names.forEach(n => {
                const opts = document.querySelectorAll("form input[type='radio'][name='" + n + "']");

                let k = false;
                opts.forEach(o => {
                    if (o.checked)
                        k = true;
                });

                if (!k) {
                    okay = false;
                    opts[0].closest(".radioQ").classList.add("invalid");
                }
            });

            return okay;
        };

        return new Promise(function (resolve) {
            // Show the debrief questions
            const content = document.querySelector("#content");
            content.innerHTML = "";
            content.appendChild(
                document.importNode(
                    document.getElementById("debrief").content, true
                ));

            // Prevent form submission especially on Safari
            utils.preventFormSubmission(content.querySelector("form"));

            document.querySelector("form button[name='submit']").addEventListener("click", e => {
                e = e || window.event();
                e.preventDefault();

                if (!checkInput())
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

        for (let t = 0; t < this.trials.length; t++) {
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
        if (utils.getQueryStringValue("fb")) {
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
        const trialClassName = trialClass ? trialClass.name : "AdvisedTrial";

        await fetch("../readSerial.php?tbl=" + trialClassName,
            {
                method: "POST",
                body: JSON.stringify(
                    {
                        idCode,
                        version,
                        studyId: this.studyName
                    })
            })
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

        if (marker.classList.contains("marker"))
            marker.classList.add("detail");

        // show correct answer
        const targetId = "estimate" + marker.dataset.number;
        document.querySelectorAll(".marker.estimate").forEach((elm) => {
            if (/(estimate[0-9]+)/.exec(elm.id)[0] === targetId)
                elm.style.display = "block";
            else
                elm.style.display = "";
        });

        // show prompt in the prompt area
        if (marker.classList.contains("marker"))
            document.querySelector(".feedback-wrapper .prompt").innerHTML =
                marker.dataset.prompt + " (" + marker.dataset.target + ")";
        else
            document.querySelector(".feedback-wrapper .prompt").innerHTML =
                "Click a marker for more info...";

        if (detail) {
            // Show some debugging info at the top
            const p = document.querySelector(".timeline .debug");
            p.innerHTML = "";
            for (let k in marker.dataset) {
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
    static resultsTimeline(trialList, detail = false) {
        // Update the score spans
        let n = 0;
        let nCorrect = 0;
        let score = 0;
        const scoreFactor = 27;
        trialList.forEach((t) => {
            n++;
            if (parseInt(t.responseEstimateLeftFinal) <=
                parseInt(t.correctAnswer) &&
                parseInt(t.responseEstimateLeftFinal) +
                parseInt(t.responseMarkerWidthFinal) >=
                parseInt(t.correctAnswer)) {
                // Check whether the score is saved in the data
                if (t.responseMarkerValueFinal)
                    score += parseInt(t.responseMarkerValueFinal);
                else if (t.responseMarkerValue)
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
            if (parseInt(t.responseEstimateLeftFinal) < min)
                min = parseInt(t.responseEstimateLeftFinal);
            if (parseInt(t.correctAnswer) < min)
                min = parseInt(t.correctAnswer);
            if (parseInt(t.responseEstimateLeftFinal) +
                parseInt(t.responseMarkerWidthFinal) > max)
                max = parseInt(t.responseEstimateLeftFinal) +
                    parseInt(t.responseMarkerWidthFinal);
            if (parseInt(t.correctAnswer) > max)
                max = parseInt(t.correctAnswer);
            if (detail) {
                // Initial response
                if (parseInt(t.responseEstimateLeft) < min)
                    min = parseInt(t.responseEstimateLeft);
                if (parseInt(t.responseEstimateLeft) +
                    parseInt(t.responseMarkerWidth) > max)
                    max = parseInt(t.responseEstimateLeft) +
                        parseInt(t.responseMarkerWidth);

                // Advice
                let i = 0;
                while (Object.keys(t).indexOf("advisor" +
                    i.toString() + "id") !== -1) {
                    const p = "advisor" + i.toString();
                    const w = parseInt(t[p + "confidence"]);

                    if (parseInt(t[p + "advice"]) - w < min)
                        min = parseInt(t[p + "advice"]) - w;
                    if (parseInt(t[p + "advice"]) + w > max)
                        max = parseInt(t[p + "advice"]) + w;

                    i++;
                }
            }
        });
        const step = 10;
        // add a little buffer to the next marker
        max = max + step - (max % step);
        min = min - (min % step);

        for (let t = min; t <= max; t += step) {
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

        const makeMarker = function (left, width, type = "", classes = []) {
            const l = parseFloat(left);
            const w = parseFloat(width);
            const marker = document.createElement('div');
            marker.id = "estimate" + x.toString() + type;
            marker.classList.add("response-marker", "marker", "estimate");
            if (type)
                marker.classList.add(type);
            if (classes.length)
                marker.classList.add(...classes);

            marker.style.width = (year * (w + 1) - 1) + "px";
            marker.style.left = ((l - min) /
                (max - min) * TL.clientWidth) +
                "px";
            marker.title = left + " - " + (l + w).toString();
            return TL.appendChild(marker);
        };

        trialList.forEach((t) => {
            x++;

            if (detail) {
                // Initial answer marker
                makeMarker(t.responseEstimateLeft,
                    t.responseMarkerWidth,
                    "initial");

                // Advice
                let i = 0;
                while (Object.keys(t).indexOf("advisor" +
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
            ans.dataset.prompt = prompt ? prompt[1] : t.stimHTML;
            ans.title = t.correctAnswer;
            ans.dataset.target = t.correctAnswer;
            ans.dataset.number = x.toString();
            ans.addEventListener("click", DatesStudy._playMarker);
            ans.classList.add("marker", "target");
            ans.style.left = ((t.correctAnswer - min) / (max - min) *
                TL.clientWidth + year / 2) +
                "px";
            ans.style.top = "-1em";
            if (parseInt(t.responseEstimateLeftFinal) <=
                parseInt(t.correctAnswer) &&
                parseInt(t.responseEstimateLeftFinal) +
                parseInt(t.responseMarkerWidthFinal) >=
                parseInt(t.correctAnswer))
                ans.innerHTML = "&starf;";
            else
                ans.innerHTML = "&star;";

            // Additional details
            if (detail) {
                let i = 0;
                while (Object.keys(t).indexOf("advisor" +
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
            while (true) {
                if (i++ > 300) {
                    console.error("loop did not break");
                    break;
                }

                let okay = true;
                for (let o of others) {
                    let r = o.getBoundingClientRect();
                    if (((my.top <= r.bottom && my.bottom >= r.top) ||
                        (my.bottom > r.top && my.top < r.bottom)) &&
                        ((my.left <= r.right && my.right >= r.left) ||
                            (my.right > r.left && my.left < r.right)))
                        okay = false;
                }

                if (okay)
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
        link = /localhost/.test(link) ? link :
            link.replace(
                "https://acclab.psy.ox.ac.uk/~mj221/ESM/ACv2/",
                "http://tinyurl.com/acclab-ac2/");
        let code = this.id + "-" + this.studyVersion;

        const permalink = document.querySelector(".feedback-wrapper span.permalink");
        if (permalink)
            permalink.innerHTML = link + "?fb=" + code;
        // Update redo link
        const redoLink = document.querySelector(".feedback-wrapper span.redo-link");
        if (redoLink)
            redoLink.innerText = link + "?PROLIFIC_PID=" + code + encodeURIComponent("_+1");

        // Hide payment link for revisits
        const paymentLink = document.querySelector(".payment-link");
        if (paymentLink) {
            if (utils.getQueryStringValue("fb"))
                paymentLink.style.display = "none";
            else
                paymentLink.innerHTML =
                    "Payment code: <a href='https://app.prolific.ac/submissions/complete?cc=" + code + "' target='_blank'>" + code + "</a>";
        }
    }

    async results() {

        // leave fullscreen
        DatesStudy.unlockFullscreen();

        // Protect against weird-looking-ness when resizing
        const me = this;
        window.addEventListener("resize", () => {
            if (window.resizeTimeout)
                clearTimeout(window.resizeTimeout);

            window.resizeTimeout = setTimeout(() => me.results(), 50);
        });

        let trialList = null;

        // Simulate results if we're testing feedback
        if (DEBUG.level >= 1 && utils.getQueryStringValue("fb"))
            trialList = this._simulateResults();
        else
            trialList = await this._fetchResults();

        // Permalinks, thanks text, etc.
        this.importResultsTemplate();

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

        return {
            ...out,
            feedback: this.feedback
        };
    }
}

export {DatesStudy};