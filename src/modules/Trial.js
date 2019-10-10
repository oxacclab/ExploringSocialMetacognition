/**
 * Trial
 * Matt Jaquiery, March 2019
 *
 * Javascript library for running social metacognition studies.
 */


"use strict";

import {Advisor} from "./Advisor.js";
import {ControlObject} from "./Prototypes.js";

/**
 * @class Trial
 * An experimental trial.
 * The basic structure is to evolve in the following phases:
 * * begin (prompt)
 * * showStim (stimulus phase)
 * * hideStim (post-stimulus)
 * * getResponse (response collection)
 * * showFeedback
 * * end
 * * cleanup
 *
 * Other classes can extend this to alter the structure.
 *
 * Properties can be set in the constructor's blueprint.
 *
 * @property stim {HTMLElement} contents of the stimulus window when the
 * stimulus is visible
 * @property correctAnswer {*} correct answer on the trial
 * @property [prompt=null] {string|object|null} HTML string of the prompt text.
 * Can be an object with phase names and entries for each phase (begin,
 * showStim, hideStim, getResponse, processResponse, showFeedback, end,
 * cleanup).
 * @property [blankStim=null] {HTMLElement|null} contents of the stimulus window
 * when the stimulus is not visible
 * @property [durationPreStim=500] {int} duration of the pre-stimulus phase in
 * ms
 * @property [durationStim=1500] {int} duration of the stimulus phase in ms
 * @property [durationPostStim=100] {int} duration between stimulus offset and
 * results phase in ms
 * @property [durationResponse=null] {int|null} duration of the response phase.
 * If null, use the default defined in the response widget
 * @property [displayFeedback=null] {function} function display feedback. Called
 * in await mode with the trial as an input (use trial.data to access the
 * response information). Omitting this omits the feedback phase.
 * @property [responseWidget] {ResponseWidget|null} the ResponseWidget
 * responsible for providing responses from the user
 *
 */
class Trial extends ControlObject {
    /**
     * Run a trial
     * @param blueprint {object} properties which will be given to the trial
     * @param [callback] {function} called with arguments of
     * <string>stageName and <Trial>this object at each stage
     */
    constructor(blueprint, callback) {

        super(blueprint, callback);

        // Register properties in the data output
        this.data.stimHTML = this.stim.outerHTML;
        this.data.correctAnswer = typeof this.correctAnswer === "function"?
            this.correctAnswer() : this.correctAnswer;

        // Expand the prompt shorthand blueprint
        this._unpackPrompt(blueprint.prompt);
        this._unpackBlockProperties();

        Trial.reset();
    }

    static get listPhases() {
        return [
            "begin",
            "showStim",
            "hideStim",
            "getResponse",
            "showFeedback",
            "end",
            "cleanup"
        ];
    }

    /**
     * Set default property values for the Trial
     * @protected
     */
    _setDefaults() {
        super._setDefaults();

        this.prompt = null;
        this.blankStim = null;
        this.durationPreStim = 500;
        this.durationStim = 500;
        this.durationPostStim = 100;
        this.durationResponse = null;
        this.displayFeedback = null;
        this.responseWidget = document.querySelector("#response-panel");

        this.data = {
            timestampStart: null,
            timeStimOn: null,
            timeStimOff: null,
            timeResponseOpen: null,
            timeResponseClose: null,
            timeFeedbackOn: null,
            timeFeedbackOff: null,
            timeEnd: null
        };
    }

    /**
     * Fill out a prompt string to cover all the phases
     * @param prompt {string|object}
     * @protected
     */
    _unpackPrompt(prompt) {
        if(typeof prompt === "string") {
            this.prompt = {};
            this.phases.forEach((k) => this.prompt[k] = prompt);
        }
    }

    /**
     * Extract perTrial block properties for this trial
     * @protected
     */
    _unpackBlockProperties() {
        if(!this.perTrial)
            return;

        for(let k in this.perTrial) {
            if(this.perTrial.hasOwnProperty(k)) {
                this[k] = this.perTrial[k].shift();
            }
        }

        delete this.perTrial;
    }

    /**
     * Update the prompt display appropriately for the phase
     * @param phase {string} phase name
     * @protected
     */
    _updatePrompt(phase) {
        document.querySelector("#prompt").innerHTML =
            this.prompt.hasOwnProperty(phase)? this.prompt[phase] : "";
    }

    /**
     * Register the beginning of a phase.
     * Prompt update.
     * Set CSS class on #content.
     * Callback.
     * @param phase {int|string} phase identifier
     * @protected
     */
    _startPhase(phase) {
        if(typeof phase !== "string")
            phase = this.phases[phase];

        this._updatePrompt(phase);
        super._startPhase(phase);
    }

    get trialTime() {
        return new Date().getTime() - this.data.timestampStart;
    }

    /**
     * Set the prompt text and mark the start time.
     * @return {Promise<Trial>}
     */
    begin() {
        document.querySelector("#stimulus").innerHTML = this.stim.outerHTML;

        this.data.timestampStart = new Date().getTime();

        return this.wait(this.durationPreStim);
    }

    /**
     * Stimulus showing handled by CSS.
     * Set the timeout for the hide stim phase.
     * @return {Promise<Trial>}
     */
    showStim() {
        this.data.timeStimOn = this.trialTime;

        return this.wait(this.durationStim);
    }

    /**
     * Hide stimulus handled by CSS.
     * @return {Promise<Trial>}
     */
    hideStim() {
        this.data.timeStimOff = this.trialTime;

        return this.wait(this.durationPostStim);
    }

    /**
     * Collect the participant's response via the ResponseWidget.
     * @return {Promise<Trial>}
     */
    async getResponse() {
        this.data.timeResponseOpen = this.trialTime;

        let response = await this.responseWidget
            .getResponse(this.durationResponse);

        this.data.timeResponseClose = this.trialTime;

        if(response === "undefined") {
            this.log.push("Timeout on response");
        }
        return this.processResponse(response);
    }

    /**
     * Handle the response.
     * @param data {Object|undefined} response data
     * @return {Trial}
     */
    processResponse(data) {

        if(typeof data === "undefined")
            return this;

        let me = this;

        Object.keys(data).forEach((k) => {
            const s = "response";
            if(/time/.test(k))
                data[k] -= me.data.timestampStart;

            // Save in camelCase
            me.data[s + k.substr(0,1).toUpperCase() + k.substr(1)] =
                data[k];
        });

        return this;
    }

    /**
     * Show feedback using a user-supplied feedback function.
     * @return {Promise<Trial>}
     */
    async showFeedback() {

        if(typeof this.displayFeedback !== "function") {
            this.data.timeFeedbackOn = null;
            this.data.timeFeedbackOff = null;
            return this;
        }

        // Run the user-supplied feedback function.
        this.data.timeFeedbackOn = this.trialTime;
        await this.displayFeedback(this);
        this.data.timeFeedbackOff = this.trialTime;

        return this;
    }

    /**
     * End the trial and tidy up.
     * @return {Trial}
     */
    end() {
        this.data.timeEnd = this.trialTime;

        return this;
    }

    /**
     * Set the display back to its fresh state.
     */
    cleanup() {
        this.responseWidget.reset();
        this.constructor.reset();
        return this;
    }

    /**
     * Set the display to its fresh state.
     */
    static reset() {
        document.querySelector("#stimulus").innerHTML = "";
        document.querySelector("#prompt").innerHTML = "";
    }

    /**
     * Fetch the data for the study in a flat format suitable for CSVing
     * @param [headers=null] {string[]|null} values to read. Defaults to
     * this.tableHeaders
     * @return {object} key-value pairs where all values are single items
     */
    toTable(headers=null) {
        // put some important variables into the data field
        this.data.isAttentionCheck = this.attentionCheck + 0; // cast to int
        this.data.number = this.number;
        this.data.block = this.block;
        this.data.feedback = this.feedback;
        const match  = /group-([0-9]+)/i.exec(document.body.classList.toString());
        if(match)
            this.data.pGroup = match[1];

        const out = {};

        // Use own headers if not supplied
        if(headers === null)
            headers = this.tableHeaders;

        for(let h of headers)
            out[h] = typeof this.data[h] === "undefined"? null : this.data[h];

        return out;
    }

    /**
     * @return {string[]} headers for the columns of this.toTable()
     */
    get tableHeaders() {
        return Object.keys(this.data);
    }
}

/**
 * @class AdvisedTrial
 * @extends Trial
 *
 * An AdvisedTrial has two additional phases: showAdvice and finalResponse.
 * * begin (prompt)
 * * showStim (stimulus phase)
 * * hideStim (post-stimulus)
 * * getResponse (response collection)
 * * showAdvice
 * * getFinalResponse
 * * showFeedback
 * * end
 * * cleanup
 *
 * The showAdvice phase is handled by an Advisor. The finalResponse is handled
 * by a ResponseWidget as in the initial response inherited from Trial.
 *
 * @property advisors {Advisor[]} advisors giving advice on the trial
 * @property [advisorChoice] {boolean} whether the participant can choose which advisor gives advice
 * @property [durationShowAdvice=null] {int|null} duration of the advice display
 * in ms, or null to allow the Advisor to handle it
 * @property [durationFinalResponse=null] {int|null} duration of the final
 * response phase. If null, inherit from durationResponse (which can waive
 * response time to let the ResponseWidget handle it)
 */
class AdvisedTrial extends Trial {

    /**
     * Run a trial
     * @param blueprint {object} properties which will be given to the trial
     * @param [callback] {function} called with arguments of
     * <string>stageName and <Trial>this object at each stage
     */
    constructor(blueprint, callback) {
        super(blueprint, callback);

        AdvisedTrial.reset();
    }

    _setDefaults(skipParentDefaults = false) {
        super._setDefaults();

        this.durationShowAdvice = 1500;
        this.durationFinalResponse = null;
        this.advice = [];
    }

    // Override the prefix so styling can use Trial rather than duplicating
    get _phaseClassPrefix() {
        return "Trial";
    }

    /**
     * Fill out a prompt string to cover all the phases
     * @param prompt {string|object}
     * @protected
     */
    _unpackPrompt(prompt) {
        if(typeof prompt === "string") {
            // Default prompt varies by phase
            const s = "Consider the advice below and provide a final response.";
            const a = "Choose an advisor from the side to continue.";
            this.prompt = {
                showAdvice: s,
                getFinalResponse: s,
                chooseAdvisor: a,
                showFeedback: s,
                end: "",
                cleanup: ""
            };
            this.phases.forEach((k) => {
                if(!this.prompt.hasOwnProperty(k))
                   this.prompt[k] = prompt
            });
        }
    }

    static get listPhases() {
        return [
            "begin",
            "showStim",
            "hideStim",
            "getResponse",
            "chooseAdvisor",
            "showAdvice",
            "getFinalResponse",
            "showFeedback",
            "end",
            "cleanup"
        ]
    }

    /**
     * Choose the advisor for the trial
     * @return {Promise<AdvisedTrial>}
     */
    async chooseAdvisor() {
        if(!this.advisorChoice)
            return this;

        const me = this;

        // Copy advisors to options
        this.advisorOptions = [...this.advisors];
        this.advisors = [];

        return new Promise(resolve => {
            // Set click events to select the advisor
            document.querySelectorAll(".advisor-key-row").forEach(elm => {
                elm.onclick = null;
                elm.addEventListener("click", e => {
                    const id = e.currentTarget.dataset.advisorId;
                    me.advisorOptions.forEach(a => {
                        if(a.id.toString() === id) {
                            me.advisors = [a];
                            resolve(me);

                            document.querySelectorAll(".advisor-key-row").forEach(e => e.onclick = null);
                        }
                    })
                })
                }
            );
        });
    }

    /**
     * Show the advice for the trial
     * @return {Promise<AdvisedTrial>}
     */
    async showAdvice() {

        // Fade out advisors who won't be giving advice
        const me = this;
        let clean = true;
        document.querySelectorAll(".advisor-key-row").forEach(
            elm => {
                const id = elm.dataset.advisorId;
                if(id) {
                    elm.classList.remove("gives-advice");

                    me.advisors.forEach(a => {
                        if(a.id.toString() === id) {
                            elm.classList.add("gives-advice");
                            clean = false;
                        }
                    });
                }
            });
        // Allow time for animations to play
        if(!clean)
            await this.wait(1000);

        // Register advisors in the data output
        for(let i = 0; i < this.advisors.length; i++) {
            const a = this.advisors[i];

            // Save advisor's advice
            const advice = a.getAdvice(this);
            Object.keys(advice).forEach((k)=> {
                if(advice.hasOwnProperty(k))
                    this.data["advisor" + i.toString() + k] = advice[k];
            });

            await a.drawAdvice();
        }

        return this;
    }

    /**
     * Register advisors in the data output
     */
    saveAdvisorData() {

        for(let i = 0; i < this.advisors.length; i++) {
            const a = this.advisors[i];
            const tbl = a.toTable();
            const s = "advisor" + i.toString();
            this.data[s] = i;
            for(let x in tbl)
                if(tbl.hasOwnProperty(x))
                    this.data[s + x] = tbl[x];
        }

    }

    /**
     * Get the final response from the ResponseWidget
     * @return {Promise<AdvisedTrial>}
     */
    async getFinalResponse() {

        this.data.timeResponseOpenFinal = this.trialTime;

        let response = await this.responseWidget
            .getResponse(this.durationResponse, false);

        this.data.timeResponseClose = this.trialTime;

        if(response === "undefined") {
            this.log.push("Timeout on response");
        }

        return this.processFinalResponse(response);
    }

    processFinalResponse(data) {

        this.saveAdvisorData();

        let me = this;

        Object.keys(data).forEach((k) => {
            const s = "response";
            if(/time/.test(k))
                data[k] -= me.data.timestampStart;

            // Save in camelCase
            me.data[s + k.substr(0,1).toUpperCase() + k.substr(1) + "Final"] =
                data[k];
        });

        return this;
    }

    cleanup() {
        this.advisors.forEach((a) => a.hideAdvice());
        return super.cleanup();
    }
}


/**
 * @class AdvisedTrialWithConf
 * @extends AdvisedTrial
 *
 * An AdvisedTrial has two additional phases: showAdvice and finalResponse.
 * * begin (prompt)
 * * showStim (stimulus phase)
 * * hideStim (post-stimulus)
 * * getResponse (response collection)
 * * getConfidence (metacognitive response collection)
 * * showAdvice
 * * getFinalResponse
 * * getFinalConfidence
 * * showFeedback
 * * end
 * * cleanup
 *
 * The confidence judgement is collected from a confidence widget in the same way the response widget provides the basic response.
 *
 * @property [durationConfidence=durationResponse] {number} duration (ms) to allow for confidence ratings
 *
 * @property [confidenceWidget] {ConfidenceWidget|null} the ConfidenceWidget responsible for acquiring confidence judgements from the user
 */
class AdvisedTrialWithConf extends AdvisedTrial {

    /**
     * Run a trial
     * @param blueprint {object} properties which will be given to the trial
     * @param [callback] {function} called with arguments of
     * <string>stageName and <Trial>this object at each stage
     */
    constructor(blueprint, callback) {
        super(blueprint, callback);

        AdvisedTrialWithConf.reset();
    }

    _setDefaults(skipParentDefaults = false) {
        super._setDefaults();

        this.confidenceWidget = document.querySelector("#conf-widget");
    }

    static get listPhases() {
        return [
            "begin",
            "showStim",
            "hideStim",
            "getResponse",
            "getConfidence",
            "chooseAdvisor",
            "showAdvice",
            "getFinalResponse",
            "getFinalConfidence",
            "showFeedback",
            "end",
            "cleanup"
        ]
    }

    /**
     * Get the response from the ConfidenceWidget
     * @return {Promise<AdvisedTrial>}
     */
    async getConfidence() {
        this.data.timeConfidenceOpen = this.trialTime;

        let confidence = await this.confidenceWidget
            .getResponse(this.durationConfidence, false);

        this.data.timeConfidenceClose = this.trialTime;

        if(confidence === "undefined") {
            this.log.push("Timeout on confidence judgement");
        }

        return this.processConfidence(confidence);
    }

    processConfidence(data) {
        let me = this;

        Object.keys(data).forEach((k) => {
            const s = "confidence";
            if(/time/.test(k))
                data[k] -= me.data.timestampStart;

            // Save in camelCase
            me.data[s + k.substr(0,1).toUpperCase() + k.substr(1)] = data[k];
        });

        return this;
    }

    /**
     * Get the response from the ConfidenceWidget
     * @return {Promise<AdvisedTrial>}
     */
    async getFinalConfidence() {
        this.data.timeConfidenceOpenFinal = this.trialTime;

        let confidence = await this.confidenceWidget
            .getResponse(this.durationConfidence, false);

        this.data.timeConfidenceCloseFinal = this.trialTime;

        if(confidence === "undefined") {
            this.log.push("Timeout on final confidence judgement");
        }

        return this.processFinalConfidence(confidence);
    }

    processFinalConfidence(data) {
        let me = this;

        Object.keys(data).forEach((k) => {
            const s = "confidence";
            if(/time/.test(k))
                data[k] -= me.data.timestampStart;

            // Save in camelCase
            me.data[s + k.substr(0,1).toUpperCase() + k.substr(1) + "Final"] = data[k];
        });

        return this;
    }
}

/**
 * @class TrialWithConf
 * @extends AdvisedTrialWithConf
 *
 * An AdvisedTrialWithConf with the advice stripped out.
 * * begin (prompt)
 * * showStim (stimulus phase)
 * * hideStim (post-stimulus)
 * * getResponse (response collection)
 * * getConfidence (metacognitive response collection)
 * * showFeedback
 * * end
 * * cleanup
 *
 */
class TrialWithConf extends AdvisedTrialWithConf {

    static get listPhases() {
        return [
            "begin",
            "showStim",
            "hideStim",
            "getResponse",
            "getConfidence",
            "showFeedback",
            "end",
            "cleanup"
        ]
    }
}

export {AdvisedTrial, Trial, AdvisedTrialWithConf, TrialWithConf};