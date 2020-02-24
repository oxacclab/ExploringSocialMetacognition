/**
 * Advisor
 * Matt Jaquiery, March 2019
 *
 * Javascript library for running social metacognition studies.
 */


"use strict";

import {BaseObject} from "./Prototypes.js";
import * as utils from "../utils.js";
import * as icon from "../identicon.js";

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

/**
 * @class AdvisorHybrid
 * @extends Advisor
 * @classdesc Hybrids allow advice to be presented from one of a list of advisors while being labelled as coming from an ambiguous source.
 */
class AdvisorHybrid extends Advisor {
    /**
     * @param blueprint {object} Options used to construct the class
     * @param blueprint.blueprints {Advisor[]|object[]} Advisors or advisor representations to stitch together to form the hybrid
     * @param
     */
    constructor(blueprint) {

        super(blueprint.blueprints[0]);

        const hybridIds = [];
        const hybridDescriptions = [];

        for(let bp of blueprint.blueprints) {
            hybridIds.push(bp.id);
            hybridDescriptions.push(bp.idDescription);
        }

        this._readBlueprint(blueprint);

        this.hybridBlueprints = blueprint.blueprints;

        this.hybridIds = hybridIds.join('|');
        this.hybridDescriptions = hybridDescriptions.join('|');

        this.name = this.name || '?';
    }

    /**
     * Construct an SVG made up of slices of the SVGs of the blueprinted advisors
     * @return {null|*}
     */
    get svg() {
        if(!this._image) {
            this.info("Generating hybrid identicon");

            // Sort blueprints by ids to ensure same hybrid has same look regardless of who is actually giving the advice
            const blueprints = this.hybridBlueprints
                .sort((a, b) => a.id < b.id? 1 : -1);

            const base64toSVG = (s) => {
                // Sychronous XHTTP requests are depreciated but really useful here!
                const request = new XMLHttpRequest();
                request.open('GET', s, false);
                request.send(null);

                if (request.status === 200)
                    return new DOMParser().parseFromString(request.responseText, 'text/xml');

                return null;
            };

            const svgToBase64 = (svg) => {
                let xml = svg.querySelector('svg').outerHTML;
                xml = xml.replace(/clippath/g, 'clipPath');
                xml = xml.replace(/<defs[^>]+/, '<defs');
                return btoa(xml);
            };

            const images = [];
            for(let bp of this.hybridBlueprints) {
                images.push(new Advisor(bp).svg);
            }

            const theta = Math.PI * 2 / images.length;
            const offset = Math.PI * 2 * 3 / 8;
            const width = 150;
            const r = Math.sqrt(2 * Math.pow(width, 2)); // radius
            const tweak = width;

            for(let i = 0; i < images.length; i++) {
                const img = images[i];
                // Add a clipPath to obscure unwanted pieces
                let start = [
                    tweak + Math.cos(offset + theta * i) * r,
                    tweak + Math.sin(offset + theta * i) * r
                ];
                let end = [
                    tweak + Math.cos(offset + theta * (i + 1)) * r,
                    tweak + Math.sin(offset + theta * (i + 1)) * r
                ];

                const clipId = "clip-path-" + i.toString();

                let svg = base64toSVG(img);

                // Apply clip mask
                const pathAttr = document.createAttribute('clip-path');
                pathAttr.value = "url(#" + clipId + ")";
                svg.querySelector('svg g').attributes.setNamedItem(pathAttr);
                svg.querySelector('svg').insertBefore(document.createElement('defs'), svg.querySelector('svg').firstChild);
                const clip = svg.querySelector('defs').appendChild(document.createElement('clippath'));
                clip.id = clipId;
                clip.innerHTML =
                    `<path d="M ${start[0]} ${start[1]} A 1 1 0 0 0 ${end[0]} ${end[1]} Z"/>`;

                if(!i)
                    this._image = svg;
                else {
                    this._image.querySelector('svg')
                        .appendChild(svg.querySelector('g'));
                    this._image.querySelector('defs')
                        .appendChild(svg.querySelector('clippath'));
                    // Add lines showing the divide
                    this._image.querySelector('svg')
                        .innerHTML += `<g><line x1="${start[0]}" y1="${start[1]}" x2="${width}" y2="${width}" style="stroke:rgb(0,0,0);stroke-width:4"/><line x1="${end[0]}" y1="${end[1]}" x2="${width}" y2="${width}" style="stroke:rgb(0,0,0);stroke-width:4"/></g>`;
                }
            }

            this._image = "data:image/svg+xml;base64," + svgToBase64(this._image);
        }
        return this._image;
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
     * @return {{validTypeFlags: int[], nominalTypeFlag: int, nominalType: string, validTypes: string[], actualTypeFlag: int, actualType: string, adviceCentre: number, adviceWidth: number, advice: number, adviceSide: number|null, adviceConfidence: number|null}} centre for the advice
     */
    getAdvice(trial, advisor) {
        const out = {
            validTypes: null,
            validTypeFlags: null,
            nominalType: null,
            nominalTypeFlag: null,
            actualTypeFlag: null,
            actualType: null,
            adviceCentre: null,
            adviceWidth: null,
            advice: null,
            adviceSide: null,
            adviceConfidence: null
        };
        let aT = null;

        // Detect advice type override
        if(typeof trial.adviceTypeOverride !== "undefined") {
            if(typeof trial.adviceTypeOverride === "function") {
                aT = trial.adviceTypeOverride(this);
            } else {
                aT = trial.adviceTypeOverride;
            }
        } else {
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

            // Reset the used types
            if(utils.sumList(allQuantities) === utils.sumList(this.usedTypes)) {
                Object.keys(this.usedTypes).forEach(
                    k => this.usedTypes[k] = 0);
                this.info("Used all advice instances; resetting.");
            }
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

        // Advice for binary options is thresholded by the anchor
        if(trial.anchorDate)
            out.adviceSide = (out.advice >= trial.anchorDate)? 1 : 0;

        if(trial.showAdvisorConfidence) {
            if(advisor.confidenceFunction)
                out.adviceConfidence = advisor.confidenceFunction(out, trial, advisor);
            else
                out.adviceConfidence = Advisor.getConfidence(out, trial, advisor);

            out.adviceConfidence = Math.max(
                0, Math.min(100, Math.round(out.adviceConfidence))
            );
        }

        return out;
    }

    static getConfidence(answer, trial, advisor) {
        // More confident each year, up to 100% confident at confidence boundary
        let adviceConfidence =
            Math.abs(answer.advice - trial.anchorDate) /
            advisor.confidence * 100;
        if(advisor.confidenceAddition)
            adviceConfidence += advisor.confidenceAddition;

        return adviceConfidence;
    }

    static getConfidenceByPCorrect(answer, trial, advisor) {
        // calculate p(correct) from estimate-anchor difference
        // This is a cubic function with parameters empirically estimated for
        // advisor with confidenceVariation = anchor distribution SD
        const d = Math.abs(trial.anchorDate - answer.advice);
        let pCor;
        if(advisor.pCorFunction)
            pCor = advisor.pCorFunction(d);
        else  // derived from simulations in dates-binary-advice-accuracy.Rmd
            pCor = .4670 +
                d * .04426 +
                Math.pow(d, 2) * -.00121 +
                Math.pow(d, 3) * .00001;

        // confidence comes from function of p(correct) in confidence space
        let slope = 1.25;
        let nudge = -.5;
        let noise_sd = .05;
        if(advisor.confidenceFunctionParams) {
            slope = advisor.confidenceFunctionParams.slope || slope;
            nudge = advisor.confidenceFunctionParams.nudge || nudge;
            noise_sd = advisor.confidenceFunctionParams.noise_sd || noise_sd;
        }

        let conf = slope * (pCor + nudge);
        // add a little random noise
        conf += utils.sampleNormal(1, 0, noise_sd);

        conf *= 100;

        if(advisor.confidenceAddition)
            conf += advisor.confidenceAddition;

        return conf;
    }

    get mainAdviceType() {
        const x = {q: -Infinity, i: null};

        for(let i = 0; i < this.adviceTypes.length; i++) {
            if(this.adviceTypes[i].quantity > x.q) {
                x.q = this.adviceTypes[i].quantity;
                x.i = i;
            }
        }

        if(x.i === null)
            return null;

        return this.adviceTypes[x.i];
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

// Incorrect advice is the participant's answer reflected on the correct answer
// Advice should disagree
const ADVICE_INCORRECT_REFLECTED = Object.freeze(new AdviceType({
    name: "disagreeReflected",
    flag: 4,
    fallback: 32,
    /**
     * Values for middle indicating incorrect answers roughly as wrong as the
     * participant's answer, but in the other direction.
     * @param t {Trial} at the post-initial-decision phase
     * @param a {Advisor} advisor giving advice
     * @return {number[]|null}
     */
    match: (t, a) => {
        const w = Math.ceil(a.confidence / 2);
        const minError = w < 4? 4 : w;

        // Agreement values
        const minA = t.data.responseEstimateLeft - w;
        const maxA = t.data.responseEstimateLeft + t.data.responseMarkerWidth + w;

        // Target is the correct answer reflected in the middle of the
        // participant's answer
        let ans = Math.round(
            t.data.responseEstimateLeft +
            t.data.responseMarkerWidth / 2);
        let target = t.correctAnswer + (t.correctAnswer - ans);

        // If target is too near the correct answer, adjust it away
        if(Math.abs(ans - t.correctAnswer) < minError)
            target = (ans > t.correctAnswer)?
                t.correctAnswer - minError : t.correctAnswer + minError;

        // Keep target within the boundaries of the scale
        let minS = parseFloat(t.responseWidget.dataset.min);
        let maxS = parseFloat(t.responseWidget.dataset.max);
        if(target < minS + 2 * w)
            target = minS + 2 * w;
        else
            if(target > maxS - 2 * w)
                target = maxS - 2 * w;

        // If there's no conflict with the participant, return the target value
        let min = target - w;
        let max = target + w;
        if(min > maxA || max < minA)
            return [min, max];

        // If the participant is correct avoid the participant's response
        if(target - minA < maxA - target) // target below estimate
            if(min < minA - 1) // room for a marker
                return [min, minA - 1];
            else // no room; shift away from participant (missing target)
                return minA - 1 - w > minS? [minA - 1, minA - 1] : null;
        else // estimate below target
            if(maxA + 1 < max) // room for marker
                return [maxA + 1, max];
            else // no room; shift away from participant (missing target)
                return maxA + 1 + w < maxS? [maxA + 1, maxA + 1]: null;
    },
}));

// Agreeing and being correct falls back to being correct
const ADVICE_CORRECT_AGREE = Object.freeze(new AdviceType({
    name: "correctAgree",
    flag: 8,
    fallback: 1,
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


// Incorrect advice is the correct answer reflected on the participant's answer
// Advice should disagree. This is a fallback for disagreeReflected
const ADVICE_INCORRECT_REVERSED = Object.freeze(new AdviceType({
    name: "disagreeReversed",
    flag: 32,
    fallback: null,
    /**
     * Values for middle indicating incorrect answers roughly twice as wrong as the
     * participant's answer, in the same direction.
     * @param t {Trial} at the post-initial-decision phase
     * @param a {Advisor} advisor giving advice
     * @return {number[]|null}
     */
    match: (t, a) => {
        const w = Math.ceil(a.confidence / 2);
        const minError = w < 4? 4 : w;

        // Agreement values
        const minA = t.data.responseEstimateLeft - w;
        const maxA = t.data.responseEstimateLeft + t.data.responseMarkerWidth + w;

        // Target is the correct answer reflected in the middle of the
        // participant's answer
        let ans = Math.round(t.data.responseEstimateLeft +
            t.data.responseMarkerWidth / 2);
        let target = ans + (ans - t.correctAnswer);

        // If target is too near the correct answer, adjust it away
        if(Math.abs(ans - t.correctAnswer) < minError)
            target = (ans > t.correctAnswer)?
                t.correctAnswer - minError : t.correctAnswer + minError;

        // Keep target within the boundaries of the scale
        let minS = parseFloat(t.responseWidget.dataset.min);
        let maxS = parseFloat(t.responseWidget.dataset.max);
        if(target < minS + 2 * w)
            target = minS + 2 * w;
        else
        if(target > maxS - 2 * w)
            target = maxS - 2 * w;

        // If there's no conflict with the participant, return the target value
        let min = target - w;
        let max = target + w;
        if(min > maxA || max < minA)
            return [min, max];

        // If the participant is correct avoid the participant's response
        if(target - minA < maxA - target) // target below estimate
            if(min < minA - 1) // room for a marker
                return [min, minA - 1];
            else // no room; shift away from participant (missing target)
                return minA - 1 - w > minS? [minA - 1, minA - 1] : null;
        else // estimate below target
        if(maxA + 1 < max) // room for marker
            return [maxA + 1, max];
        else // no room; shift away from participant (missing target)
            return maxA + 1 + w < maxS? [maxA + 1, maxA + 1]: null;
    },
}));


// Correct-normDist advice has a centre sampled from a (roughly) normal
// distribution around the correct answer. Out-of-range responses are replaced
// with another sampled response until a sample is found within the scale
// boundaries.
const ADVICE_CORRECTISH = Object.freeze(new AdviceType({
    name: "correctish",
    flag: 64,
    fallback: null,
    /**
     * Values for middle point sampled from normal-like (combined uniform)
     * distribution.
     * @param t {Trial} at the post-initial-decision phase
     * @param a {Advisor} advisor giving advice
     * @return {number[]}
     */
    match: (t, a) => {
        const w = Math.ceil(a.confidence / 2);
        const minS = parseFloat(t.responseWidget.dataset.min);
        const maxS = parseFloat(t.responseWidget.dataset.max);

        // Don't give exactly the participant's response because when advice matches initial response WoA is undefined
        const pCentre = t.data.responseEstimateLeft +
            Math.floor(t.data.responseMarkerWidth / 2);

        // Normally distributed around the correct answer
        let c;
        let min;
        let max;
        let z;

        do {
            c = t.correctAnswer;
            z = utils.sampleNormal(1, 0, a.confidenceVariation);

            c += z;

            c = Math.round(c);
            min = c - w;
            max = c + w;
        } while(min < minS || max > maxS || c === pCentre);

        // constrain to scale
        return [c, c];
    }
}));


// Correct-normDist advice has a centre sampled from a (roughly) normal
// distribution around the correct answer. Out-of-range responses are replaced
// with another sampled response until a sample is found within the scale
// boundaries.
const ADVICE_AGREEISH = Object.freeze(new AdviceType({
    name: "agreeish",
    flag: 128,
    fallback: null,
    /**
     * Values for middle point sampled from normal-like (combined uniform)
     * distribution.
     * @param t {Trial} at the post-initial-decision phase
     * @param a {Advisor} advisor giving advice
     * @return {number[]}
     */
    match: (t, a) => {
        const w = Math.ceil(a.confidence / 2);
        const minS = parseFloat(t.responseWidget.dataset.min);
        const maxS = parseFloat(t.responseWidget.dataset.max);

        // Don't give exactly the participant's response because when advice matches initial response WoA is undefined
        const pCentre = t.data.responseEstimateLeft +
            Math.floor(t.data.responseMarkerWidth / 2);

        // Normally distributed around the correct answer
        let c;
        let min;
        let max;
        let z;

        do {
            c = pCentre;
            z = utils.sampleNormal(1, 0, a.confidenceVariation);

            c += z;

            c = Math.round(c);
            min = c - w;
            max = c + w;
        } while(min < minS || max > maxS || c === pCentre);

        // constrain to scale
        return [c, c];
    }
}));


// ADVICE_AGREE_BY_CONF gives different advice depending on the confidence of the previous response. Advisors must have a confidenceOptions object containing a list of possible advice offsets (from the initial response) for each of the possible confidence levels. Advice is selected randomly from the available offsets, in the direction of the correct answer.
//
// Where the advice would not fit on the scale, Correct advice is used instead.
const ADVICE_AGREE_BY_CONF = Object.freeze(new AdviceType({
    name: "agree-in-conf",
    flag: 256,
    fallback: 2,
    /**
     * Values dependent on initial response + initial confidence.
     * @param t {Trial} at the post-initial-decision phase
     * @param a {Advisor} advisor giving advice
     * @return {number[]}
     */
    match: (t, a) => {
        // Participant answer
        const ans = t.data.responseEstimateLeft +
            Math.floor(t.data.responseMarkerWidth / 2);

        const w = Math.ceil(a.confidence / 2);
        const minS = parseFloat(t.responseWidget.dataset.min);
        const maxS = parseFloat(t.responseWidget.dataset.max);

        const set = a.confidenceOptions[t.data.confidenceConfidence];
        const pick = set[utils.randomNumber(0, set.length - 1)];

        // Advice should be in the direction of the correct answer
        const c = t.correctAnswer > ans? ans + pick: ans - pick;

        // Test whether the target value works
        if(c + w > maxS || c - w < minS)
            return null;

        return [c, c];
    }
}));

// ADVICE_AGREE_OFFSET gives advice offset from the initial response by a given value specified as the Advisor's confidenceOffset. The advice is always in the direction of the correct answer.
//
// Where the advice would not fit on the scale, Correct advice is used instead.
const ADVICE_AGREE_OFFSET = Object.freeze(new AdviceType({
    name: "agree-offset",
    flag: 512,
    fallback: 2,
    /**
     * Values dependent on initial response + initial confidence.
     * @param t {Trial} at the post-initial-decision phase
     * @param a {Advisor} advisor giving advice
     * @return {number[]}
     */
    match: (t, a) => {
        // Participant answer
        const ans = t.data.responseEstimateLeft +
            Math.floor(t.data.responseMarkerWidth / 2);

        const w = Math.ceil(a.confidence / 2);
        const minS = parseFloat(t.responseWidget.dataset.min);
        const maxS = parseFloat(t.responseWidget.dataset.max);

        const set = a.confidenceOffset;
        const pick = set[utils.randomNumber(0, set.length - 1)];

        // Advice should be in the direction of the correct answer
        const c = t.correctAnswer > ans? ans + pick: ans - pick;

        // Test whether the target value works
        if(c + w > maxS || c - w < minS)
            return null;

        return [c, c];
    }
}));


export {Advisor, AdvisorHybrid, AdviceProfile, ADVICE_AGREE, ADVICE_CORRECT, ADVICE_INCORRECT_REFLECTED, ADVICE_CORRECT_AGREE, ADVICE_CORRECT_DISAGREE, ADVICE_INCORRECT_REVERSED, ADVICE_CORRECTISH, ADVICE_AGREEISH, ADVICE_AGREE_BY_CONF, ADVICE_AGREE_OFFSET};
