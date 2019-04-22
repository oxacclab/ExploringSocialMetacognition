/**
 * Advisor
 * Matt Jaquiery, March 2019
 *
 * Javascript library for running social metacognition studies.
 */

"use strict";

import {BaseObject} from "./Prototypes.js";
import * as utils from "../utils.js";

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

        this.marker.classList.remove("static", "medium");

        if(appendTo !== null)
            appendTo.appendChild(this.marker);

        return this.marker;
    }

    drawAdvice() {
        this.info("Drawing advice");

        const rw = document.getElementById("response-panel");
        switch (rw.tagName.toLowerCase()) {
            case "esm-response-widget":
                this.drawWidgetAdvice();
                break;
            case "esm-response-timeline":
                this.drawTimelineAdvice();
                break;
        }
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

        console.log(this.getAdvice(false))
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
            "group-bg-" + this.group,
            "group-border-" + this.group
        );
        elm.querySelector(".response-marker").classList.add(
            "advisor-bg-" + this.id,
            "advisor-border-" + this.id
        );
        elm.querySelector(".advisor-key-row span").innerHTML = this.name;

        return elm.querySelector(".advisor-key-row");
    }

    /**
     * Fetch the data for the study in a flat format suitable for CSVing
     * @param [headers=null] {string[]|null} values to read. Defaults to
     * this.tableHeaders
     * @return {object} key-value pairs where all values are single items
     */
    toTable(headers=null) {
        const out = {};

        // Use own headers if not supplied
        if(headers === null)
            headers = this.tableHeaders;

        for(let h of headers)
            out[h] = typeof this[h] === "undefined"? null : this[h];

        return out;
    }

    /**
     * @return {string[]} headers for the columns of this.toTable()
     */
    get tableHeaders() {
        return [
            "id", "group", "name"
        ];
    }
}

/**
 * @class AdviceProfile
 * @classdesc An AdviceProfile contains different kinds of advice, specifying
 * their definitions and their desired quantities. It also tracks the number
 * of times each advice type has actually been used, which allows for recording
 * the empirical provision of advice as well as the desired provision.
 * @property adviceTypes {AdviceType[]}
 */
class AdviceProfile extends BaseObject {
    constructor(blueprint) {
        super(blueprint);

        this.usedTypes = {};
        this.adviceTypes.forEach(aT => {
            this.usedTypes[aT.flag] = 0;
        });
    }

    /**
     * Verifies the blueprint contains the correct fields
     * @param blueprint {object}
     * @return {boolean}
     * @protected
     */
    _verifyBlueprint(blueprint = null) {
        if(!blueprint)
            blueprint = this.blueprint;
        if(!super._verifyBlueprint(blueprint))
            return false;

        return Object.keys(blueprint).indexOf("adviceTypes") !== -1;
    }

    /**
     * Return the centre of the advice for a trial
     * @param trial {Trial}
     * @param advisor {Advisor}
     * @return {number} centre for the advice
     */
    getAdvice(trial, advisor) {
        const out = {};

        // Find qualified matches
        let validQuantities = {};
        let validFlags = 0;
        let allQuantities = {};
        this.adviceTypes.forEach(aT => {
            allQuantities[aT.name] = aT.quantity - this.usedTypes[aT.flag];

            if(!aT.match(trial, advisor))
                return;

            validQuantities[aT.name] = aT.quantity - this.usedTypes[aT.flag];
            validFlags += aT.flag;
        });

        let fallback = false;
        if(utils.sumList(validQuantities) <= 0)
            fallback = true;

        // Allow fallbacks if nothing qualifies
        let types = fallback?
            Object.keys(allQuantities) : Object.keys(validQuantities);
        let sum = utils.sumList(fallback? allQuantities : validQuantities);

        // Select a type by weighted random selection accounting for past
        // selections
        let type = null;
        let x = Math.random();
        for(type of types) {
            x -= allQuantities[type] / sum;
            if(x < 0)
                break;
        }

        // Selected type
        let aT = null;
        this.adviceTypes.forEach(t => {
            if(t.name === type)
                aT = t;
        });
        out.validTypes = Object.keys(validQuantities).join(", ");
        out.validTypeFlags = validFlags;
        out.nominalType = aT.name;
        out.nominalTypeFlag = aT.flag;
        this.usedTypes[out.nominalTypeFlag]++;

        if(fallback) {
            let t = aT;
            while(t.match(trial, advisor) === null) {
                for(let x of this.adviceTypes)
                    if(x.name === t.fallback || x.flag === t.fallback) {
                        t = x;
                        break;
                    }

                if(t === aT || t === null)
                    this.error("No valid adviceType and no fallback.");
            }
            aT = t;
        }

        // Actual type
        out.actualType = aT.name;
        out.actualTypeFlag = aT.flag;
        // Advice is selected as the middle of the available values
        let range = aT.match(trial, advisor);
        out.adviceCentre = Math.round((range[1] - range[0]) / 2) + range[0];
        out.adviceWidth = advisor.confidence;

        // Add some variation around the mean
        let room = utils.min([
            out.adviceCentre - range[0],
            advisor.confidenceVariation,
            range[1] - out.adviceCentre
        ], true);
        out.advice = utils.randomNumber(out.adviceCentre - room, out.adviceCentre + room);

        // Reset the used types
        if(utils.sumList(allQuantities) === utils.sumList(this.usedTypes)) {
            Object.keys(this.usedTypes).forEach(k => this.usedTypes[k] = 0);
            this.info("Used all advice instances; resetting.");
        }

        return out;
    }
}

/**
 * @class AdviceType
 * @classdesc AdviceTypes define the circumstances which must obtain on a trial
 * in order for the advisor to offer the particular kind of advice. E.g. if
 * we desire the advisor to give an answer which spans both the participant's
 * response and the correct answer, this will be possible on some trials and
 * impossible on others given some limitations on advice width.
 * AdviceTypes offer a fallback AdviceType for use when they are not available.
 * AdviceTypes are shallow objects to enable easy copying of the pre-defined
 * examples presented here.
 *
 * @property name {string}
 * @property flag {int} flag number (e.g. 2^x)
 * @property fallback {string|int} name or flag of another AdviceType to use
 * where this type is inadmissable (fallbacks will fall back themselves if not
 * suitable, and an error arises if no fallback is possible)
 * @property matches {<number[]|null>function(<Trial>, <Advisor>)} given a trial
 * object, return a range specifying which values for the middle of the advice are
 * consistent with this advice type (null if none are)
 */
class AdviceType extends BaseObject {
    constructor(blueprint) {
        super(blueprint);
    }

    /**
     * Produce a mutable copy of this object for actual use
     * @param quantity {int} number of these trials desired
     * @return {{quantity: int}} copy of this object + a quantity property
     */
    copy(quantity) {
        return {...this, quantity};
    }
}

/*
* Specific AdviceTypes
* It is not expected that AdviceType is instantiated except by using one of the
* below.
* When supplying fallbacks, they should be included with quantity 0.
* */

// Agreement is always possible
const ADVICE_AGREE = Object.freeze(new AdviceType({
    name: "agree",
    flag: 1,
    fallback: null,
    /**
     * Values for middle consistent with agreement
     * @param t {Trial} at the post-initial-decision phase
     * @param a {Advisor} advisor giving advice
     * @return {number[]|null}
     */
    match: (t, a) => {
        const w = Math.ceil(a.confidence / 2);
        let min = t.data.responseEstimateLeft - w;
        let max = t.data.responseEstimateLeft + t.data.responseMarkerWidth + w;
        // constrain to scale
        let minS = parseFloat(t.responseWidget.dataset.min);
        let maxS = parseFloat(t.responseWidget.dataset.max);
        return [
            utils.max([min, minS]),
            utils.min([max, maxS])
        ];
    }
}));

// Correct advice is always possible
const ADVICE_CORRECT = Object.freeze(new AdviceType({
    name: "correct",
    flag: 2,
    fallback: null,
    /**
     * Values for middle consistent with correctness
     * @param t {Trial} at the post-initial-decision phase
     * @param a {Advisor} advisor giving advice
     * @return {number[]|null}
     */
    match: (t, a) => {
        const w = Math.ceil(a.confidence / 2);
        let min = t.correctAnswer - w;
        let max = t.correctAnswer + w;
        // constrain to scale
        let minS = parseFloat(t.responseWidget.dataset.min);
        let maxS = parseFloat(t.responseWidget.dataset.max);
        return [
            utils.max([min, minS]),
            utils.min([max, maxS])
        ];
    }
}));

// Incorrect advice is the correct answer reflected on the participant's answer
// Advice should disagree
const ADVICE_INCORRECT_REFLECTED = Object.freeze(new AdviceType({
    name: "disagreeReflected",
    flag: 4,
    fallback: null,
    /**
     * Values for middle indicating incorrect answers roughly as wrong as the
     * participant's answer, but in the other direction.
     * @param t {Trial} at the post-initial-decision phase
     * @param a {Advisor} advisor giving advice
     * @return {number[]|null}
     */
    match: (t, a) => {
        const w = Math.ceil(a.confidence / 2);
        // Agreement values
        const minA = t.data.responseEstimateLeft - w;
        const maxA = t.data.responseEstimateLeft + t.data.responseMarkerWidth + w;

        // Target is the correct answer reflected in the middle of the
        // participant's answer
        let target = t.correctAnswer +
            (t.correctAnswer -
            Math.round(
                t.data.responseEstimateLeft +
                t.data.responseMarkerWidth / 2));

        // Keep target within the boundaries of the scale, assuming we have
        // one step either side of the true answer limits
        let step = parseFloat(t.responseWidget.dataset.labelStep);
        if(target < parseFloat(t.responseWidget.dataset.min) + step)
            target = parseFloat(t.responseWidget.dataset.min) + step;
        else
            if(target > parseFloat(t.responseWidget.dataset.max) - step)
                target = parseFloat(t.responseWidget.dataset.max) - step;

        // If there's no conflict with the participant, return the target value
        let min = target - w;
        let max = target + w;
        if(min > maxA || max < minA)
            return [min, max];

        // If the participant is correct avoid the participant's response
        if(target - minA < maxA - target) // target below estimate
            return [min, minA - 1];
        else // estimate below target
            return [maxA + 1, max];
    },
}));

// Agreeing and being correct falls back to being correct
const ADVICE_CORRECT_AGREE = Object.freeze(new AdviceType({
    name: "correctAgree",
    flag: 8,
    fallback: 2,
    /**
     * Values for middle consistent with simultaneous correctness and agreement
     * @param t {Trial} at the post-initial-decision phase
     * @param a {Advisor} advisor giving advice
     * @return {number[]|null}
     */
    match: (t, a) => {
        const w = Math.ceil(a.confidence / 2);
        // Agreement values
        const minA = t.data.responseEstimateLeft - w;
        const maxA = t.data.responseEstimateLeft + t.data.responseMarkerWidth + w;
        // Correctness values
        const minC = t.correctAnswer - w;
        const maxC = t.correctAnswer + w;

        // find the intersected region
        let min = utils.max([minA, minC]);
        let max = utils.min([maxA, maxC]);
        // check for non-overlapping
        if(min > max)
            return null;

        return [min, max];
    }
}));

// Being correct and disagreeing falls back to being correct
const ADVICE_CORRECT_DISAGREE = Object.freeze(new AdviceType({
    name: "correctDisagree",
    flag: 16,
    fallback: 2,
    /**
     * Values for middle consistent with simultaneous disagreement and
     * correctness
     * @param t {Trial} at the post-initial-decision phase
     * @param a {Advisor} advisor giving advice
     * @return {number[]|null}
     */
    match: (t, a) => {
        const w = Math.ceil(a.confidence / 2);

        // If the participant is correct this will not be possible
        if(t.data.responseEstimateLeft <= t.correctAnswer &&
            t.data.responseEstimateLeft + t.data.responseMarkerWidth >=
            t.correctAnswer)
            return null;

        // Agreement values
        const minA = t.data.responseEstimateLeft - w;
        const maxA = t.data.responseEstimateLeft + t.data.responseMarkerWidth + w;

        // Correctness values
        const minC = t.correctAnswer - w;
        const maxC = t.correctAnswer + w;

        // If the spans don't overlap just return correctness
        if(maxA < minC || minA > maxC)
            return [minC, maxC];

        if(minA < minC)
            return [maxA, maxC];
        return [minC, minA];
    },
}));



export {Advisor, AdviceProfile, ADVICE_AGREE, ADVICE_CORRECT, ADVICE_INCORRECT_REFLECTED, ADVICE_CORRECT_AGREE, ADVICE_CORRECT_DISAGREE};