/**
 * Advisor
 * Matt Jaquiery, March 2019
 *
 * Javascript library for running social metacognition studies.
 */


"use strict";

import * as utils from "../../utils.js";
import {BaseObject} from "../Prototypes.js";
import {AdviceProfile} from "./Advice/AdviceProfile.js";
import {AdviceSpecification} from "./Advice/AdviceSpecification.js";
import * as AdviceTypes from "./Advice/AdviceType.js"
import * as icon from "../../identicon.js";

/**
 * @class Advisor
 * @classdesc Advisors are responsible for tendering advice to participants.
 * Advisors are constructed with a set of target behaviours which they
 * attempt to fulfil. They may, for instance, have a specific number of trials
 * on which they must agree with the participant, or on which they must give
 * the correct answer, etc.
 * @property id {int|string} advisor's identification
 * @property name {string} advisor's displayed name
 * @property group {int|string} group(id|name) to which the advisor belongs
 * @property confidence {number} width of the advisor's marker
 * @param confidenceVariation {number} adjustment allowed around advisor's marker trial-by-trial
 * @property adviceProfile {AdviceProfile} target behaviours
 */
class Advisor extends BaseObject {
    constructor(blueprint) {
        super(blueprint);

        this.lastAdvice = null;
        this.marker = null;

        this.templateId = blueprint.templateId;
    }

    /**
     * Create a response marker
     * @param [appendTo=null] {HTMLElement} to append the marker to
     * @return {HTMLElement}
     */
    createMarker(appendTo = null) {
        this.marker =
            this.getInfoTab().querySelector(".response-marker").cloneNode(true);

        this.marker.classList.remove("static");
        this.marker.classList.forEach(s => {
            if(/^size[0-9]+$/.test(s))
                this.marker.classList.remove(s);
        });

        if(appendTo !== null)
            appendTo.appendChild(this.marker);

        return this.marker;
    }

    static imgSrcFromString(s, options) {
        const data = new Identicon(s, options).toString();
        return "data:image/svg+xml;base64," + data;
    }

    get svg() {
        if(!this._image) {

            this.info("Generating identicon");

            // sha1 included in main body
            this._image = Advisor.imgSrcFromString(
                sha1.sha1(this.name),
                {
                    size: 300,
                    format: 'svg'
                });
        }
        return this._image;
    }

    /**
     * Return an Identicon image based on this advisor's name
     * @param options {{}} properties to set on the resulting img element.
     * @return {HTMLElement}
     */
    image(options = {}) {

        // write to a data URI
        const elm = document.createElement('img');
        for(let key in options) {
            elm[key] = options[key];
        }

        elm.classList.add("identicon");
        elm.src = this.svg;

        return elm;
    }

    async drawAdvice() {
        this.info("Drawing advice");

        const rw = document.getElementById("response-panel");
        switch (rw.tagName.toLowerCase()) {
            case "esm-response-widget":
                this.drawWidgetAdvice();
                break;
            case "esm-response-timeline":
                this.drawTimelineAdvice();
                break;
            case "esm-response-binary-conf":
                this.drawBinaryConfAdvice();
                break;
        }

        this._markerSafariFix();

        await this.wait(1000);
        // Collect questionnaire about advice if necessary
        await this.offerQuestionnaire();
    }

    drawWidgetAdvice() {
        if(this.marker === null)
            this.createMarker(
                document.querySelector("esm-response-widget .response-hBar"));

        const d = document.querySelector("esm-response-widget")
            .valueToProportion(
                this.getAdvice(false).advice,
                this.getAdvice(false).adviceWidth
            );

        let box = document.querySelector(".response-hBar")
            .getBoundingClientRect();

        // General position format is %(span) + adjustment
        this.marker.style.left =
            (d.estimateProportion * (box.width - box.height) +
                (box.height / 2) -
                (this.marker.clientWidth / 2)) + "px";

        box = document.querySelector(".response-vBar").getBoundingClientRect();

        this.marker.style.top = "calc(" +
            ((1 - d.adviceWidth) * (box.height - this.marker.clientHeight)) + "px" +
            " - " +
            "var(--response-vBar-offset))";
    }

    drawTimelineAdvice() {
        if(this.marker === null)
            this.createMarker(
                document.querySelector("esm-response-timeline .response-line"));

        const TL = document.querySelector("esm-response-timeline");

        this.marker.style.left =
            TL.valueToPixels(this.getAdvice(false).advice -
            this.getAdvice(false).adviceWidth / 2) + "px";

        this.marker.style.width = TL.valueToPixels(this.getAdvice(false).adviceWidth, true) + "px";
        this.marker.style.height = this.marker.style.width;

        this.debug(this.getAdvice(false));
    }

    /**
     * Safari fix - flicker the marker so it draws in the correct place;
     * @protected
     */
    _markerSafariFix() {
        const d = this.marker.style.display;
        this.marker.style.display = "none";
        setTimeout((m) => m.style.display = "", 0, this.marker);
    }

    drawBinaryConfAdvice() {
        // Which side is advice on?
        const side = this.getAdvice(false).adviceSide;
        const confidence = this.getAdvice(false).adviceConfidence;
        const panel = document.querySelector("esm-response-binary-conf .response-panel:" + (side? "last-of-type" : "first-of-type"));

        if(!panel)
            this.error("Could not find panel " + side + " to draw advice on.");

        // Refresh marker in the correct panel
        if(this.marker)
            this.marker.remove();

        // Are we showing advice confidence?
        if(confidence !== null) {
            // with confidence we draw alongside the column
            const column = panel.querySelector(".response-column");
            this.createMarker(column);
            this.marker.classList.add("confidence");
            this.marker.style.bottom =
                "calc(" + Math.round(confidence) + "% - " +
                (this.marker.getBoundingClientRect().height / 2) + "px)";
        } else {
            // without confidence just indicate the answer
            this.createMarker(panel);
        }
    }

    /**
     * Fetch the scorecard for this advisor.
     * @param trials {Trial[]|number[]} either a list of trials or a list of 2-item lists with [0] correctness {binary}, [1] confidence {numeric}
     * @return {HTMLElement}
     */
    getScorecard(trials) {
        return Advisor.makeScorecard(trials, this);
    }

    /**
     * Show a scorecard indicating which questions were answered correctly ordered by the confidence of the answers.
     * @param trials {Trial[]|number[][]} either a list of trials or a list of 2-item lists with [0] correctness {binary} [1] confidence {numeric}
     * @param advisor {Advisor|null} Advisor whose advice is being presented, or null for the participant
     * @return {HTMLElement}
     */
    static makeScorecard(trials, advisor = null) {
        if(!trials)
            this.error(`No trials supplied for makeScorecard (${advisor})`);

        trials = utils.shuffle(trials);
        const sc = document.importNode(
            document.getElementById('scorecard-content').content,
            true);
        // Set avatar
        if (advisor) {
            sc.querySelector('.scorecard-avatar div').innerHTML = advisor.name;
            sc.querySelector('.scorecard-avatar img').src = advisor.svg;
            // Extract the advisor's trial responses rather than the participant's
            const trialList = [];
            trials.forEach(t => {
                if(!t.data)
                    trialList.push(t);
                else {
                    // Find advisor index
                    let a;
                    let i = -1;
                    while(t.data.hasOwnProperty(`advisor${++i}id`))
                        if(t.data[`advisor${i}id`] === advisor.id)
                            a = `advisor${i}`;
                    if(typeof a === "undefined") {
                        this.warn(`Advisor (id=${advisor.id}) does not give advice on scorecard trial #${t.data.number}`);
                        return;
                    }
                    trialList.push([
                        t.data[`${a}adviceSide`] === t.data.correctAnswerSide,
                        t.data[`${a}adviceConfidence`]
                    ]);
                }
            });
            trials = trialList;
        } else {
            sc.querySelector('.scorecard-avatar div').innerHTML = "You";
            sc.querySelector('.scorecard-avatar img').src = "../assets/image/you.svg";
        }
        const bar = sc.querySelector('.response-column-inner');
        const fraction = 1 / (trials.length - 1) * 100;
        trials.forEach((t, i) => {
            const elm = bar.appendChild(document.createElement('span'));
            elm.classList.add('star');
            let correct;
            if (!t.data)
                correct = t[0];
            else if (t.data.responseAnswerSideFinal)
                correct = t.data.responseAnswerSideFinal === t.data.correctAnswerSide;
            else
                correct = t.data.responseAnswerSide === t.data.correctAnswerSide;
            if (correct) {
                elm.classList.add('correct');
                elm.innerHTML = "&#10004;";
            } else {
                elm.classList.add('incorrect');
                elm.innerHTML = "&#10007;";
            }
            if (!t.data)
                elm.style.bottom = `${t[1]}%`;
            else
                elm.style.bottom = `${t.data.responseConfidenceFinal || t.data.responseConfidence}%`;
            elm.style.left = `${fraction * i}%`;
        });

        return sc;
    }

    /**
     * Provide a questionnaire probing view on the advice offered
     */
    async offerQuestionnaire() {
        this.questionnaire = null;

        if(!this.includeQuestionnaire || !this.getAdvice(false)) {
            return;
        }

        let widget = document.querySelector('#questionnaire-widget');

        if(!widget) {
            this.warn('Questionnaire requested but no questionnaire-widget found');
            return;
        }

        this.questionnaire = await widget.getResponse();

        // unpack response
        if(this.questionnaire === "undefined") {
            this.log.push("Timeout on confidence judgement");
        }

        return;
    }

    hideAdvice() {
        if(this.marker !== null) {
            this.marker.remove();
            this.marker = null;
        }
    }

    /**
     * Fetch the advice on this trial from the advisor's AdviceProfile
     * @param trial {Trial|boolean} trial to calculate advice for, or false to fetch from memory
     * @return {object}
     */
    getAdvice(trial) {

        if(trial) {
            this.info("Calculating advice");

            if(!this.adviceProfile instanceof AdviceProfile)
                this.error("Invalid adviceProfile found when fetching advice.");

            this.lastAdvice = this.adviceProfile.getAdvice(trial, this);
        } else
            if(!this.lastAdvice)
                this.error("No last advice found and no trial supplied.");

        return this.lastAdvice;
    }

    /**
     *
     * @param [templateId] {string} id of the template to clone
     * @return {Node}
     */
    getInfoTab(templateId) {
        if(!templateId)
            templateId = this.templateId;

        const template = document.getElementById(templateId);
        const elm = document.importNode(template.content, true);
        elm.querySelector(".advisor-key-row").classList.add(
            "group-" + this.group,
            "group-bg",
            "group-border"
        );
        elm.querySelector(".advisor-key-row").dataset.advisorId = this.id;
        elm.querySelector(".response-marker").classList.add(
            "group-" + this.group,
            "advisor-" + this.id,
            "advisor-bg",
            "advisor-border"
        );
        elm.querySelector(".response-marker").appendChild(this.image());
        elm.querySelector(".advisor-key-row .advisor-name").innerHTML = this.name;

        if(this.group !== 0) {
            elm.querySelector(".advisor-key-row .advisor-group").innerHTML = "Group " + (this.sameGroup? "One" : "Two");
        } else {
            const group = elm.querySelector(".advisor-key-row .advisor-group");
            if(group)
                group.remove();
        }

        return elm.querySelector(".advisor-key-row");
    }

    /**
     * Fetch the data for the study in a flat format suitable for CSVing
     * @param [overrideHeaders=null] {string[]|null} values to read. Defaults to
     * this.tableHeaders
     * @return {object} key-value pairs where all values are single items
     */
    toTable(overrideHeaders=null) {
        const out = {};
        let headers = [];

        // Use own headers if not supplied
        if(overrideHeaders === null)
            headers = this.tableHeaders;

        for(let h of headers) {
            if(h === "questionnaire" && this.questionnaire) {
                for(let n in this.questionnaire)
                    out[n] = this.questionnaire[n];
            }
            else if(h === "confidenceFunction")
                if(typeof this[h] !== "undefined")
                    out[h] = this[h].name;
                else
                    out[h] = null;
            else if(h === "confidenceFunctionParams")
                if(typeof this[h] !== "undefined")
                    out[h] = JSON.stringify(this[h]);
                else
                    out[h] = null;
            else if(h === "pCorFunction")
                if(typeof this[h] !== "undefined")
                    out[h] = this[h].toString();
                else
                    out[h] = null;
            else
                out[h] = typeof this[h] === "undefined"? null : this[h];
        }

        return out;
    }

    /**
     * @return {string[]} headers for the columns of this.toTable()
     */
    get tableHeaders() {
        return [
            "id",
            "position",
            "idDescription",
            "introImage",
            "introText",
            "group",
            "name",
            "confidence",
            "confidenceAddition",
            "confidenceFunction",
            "confidenceFunctionParams",
            "confidenceVariation",
            "sameGroup",
            "questionnaire",
            "hybridIds",
            "hybridDescriptions",
            "pCorFunction",
            "svg"
        ];
    }
}

export {Advisor, AdviceProfile, AdviceSpecification, AdviceTypes};
