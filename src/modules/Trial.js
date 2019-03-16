/**
 * Trial
 * Matt Jaquiery, March 2019
 *
 * Javascript library for running social metacognition studies.
 */

"use strict";

import {Advisor} from "./Advisor.js";
import * as utils from "../utils.js";

/**
 * @class
 * An experimental trial.
 * The basic structure is to evolve in the following phases:
 * * begin (prompt)
 * * showStim (stimulus phase)
 * * hideStim (post-stimulus)
 * * getResponse (response collection)
 * * processResponse (post-response)
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
class Trial {
    /**
     * Run a trial
     * @param blueprint {object} properties which will be given to the trial
     * @param [callback] {function} called with arguments of
     * <string>stageName and <Trial>this object at each stage
     */
    constructor(blueprint, callback) {

        this.log = [];

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

        this.blueprint = blueprint;
        this.callback = null;

        this._setDefaults();
        this._readBlueprint();

        // Register the stimulus HTML in the data output
        this.data.stimHTML = this.stim.outerHTML;

        Trial.reset();

        if(typeof callback === "function")
            this.callback = (stage) => callback(stage, this);
        else
            this.callback = () => {};
    }

    static get phases() {
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
     * Get the phases with support for inheritance.
     */
    get myPhases() {
        return this.constructor.phases;
    }

    /**
     * Set default property values for the Trial
     * @protected
     */
    _setDefaults() {
        this.prompt = null;
        this.blankStim = null;
        this.durationPreStim = 500;
        this.durationStim = 500;
        this.durationPostStim = 100;
        this.durationResponse = null;
        this.displayFeedback = null;
        this.responseWidget = document.querySelector("esm-response-widget");
    }

    /**
     * Set this Trial's properties based on blueprint's properties
     * @param [blueprint=null] {object|null} properties to give to the trial.
     * Default uses this.blueprint
     * @protected
     */
    _readBlueprint(blueprint = null) {
        if(blueprint === null)
            blueprint = this.blueprint;

        // Check blueprint matches specifications
        if(typeof blueprint === "undefined")
            throw new Error('No blueprint supplied for building trial.');
        if(!blueprint.hasOwnProperty("stim") ||
            !(blueprint.stim instanceof HTMLElement))
            throw new Error(
                "Blueprint does not provide a valid HTMLElement for stim."
            );

        for(let key in blueprint) {
            if(!blueprint.hasOwnProperty(key))
                continue;

            this[key] = blueprint[key];
        }

        // Special properties
        this._unpackPrompt(blueprint.prompt);
    }

    /**
     * Fill out a prompt string to cover all the phases
     * @param prompt {string|object}
     * @protected
     */
    _unpackPrompt(prompt) {
        if(typeof prompt === "string") {
            this.prompt = {};
            this.myPhases.forEach((k) => this.prompt[k] = prompt);
        }
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
     * Register the beginning of a phase. Callback and prompt update.
     * @param phase {int|string} phase identifier
     * @protected
     */
    _startPhase(phase) {
        if(typeof phase !== "string")
            phase = this.myPhases[phase];

        this._updatePrompt(phase);
        this.callback(phase);
    }

    /**
     * Wait for a time.
     * @param ms {int} milliseconds to wait
     * @return {Promise<Trial>}
     * @protected
     */
    _wait(ms) {
        const me = this;
        return new Promise((resolve) => setTimeout(resolve, ms, me));
    }

    /**
     * Run the trial asynchronously.
     * @param [startPhase=0] {int|string}
     * @return {Promise<Trial>} Resolve with the trial data.
     */
    async run(startPhase = 0) {
        if(typeof startPhase === "string")
            startPhase = this.myPhases.indexOf(startPhase);
        for(let phase = startPhase; phase < this.myPhases.length; phase++)
            await eval("this." + this.myPhases[phase] + "()");
        return this;
    }

    /**
     * Set the prompt text and mark the start time.
     * @return {Promise<Trial>}
     */
    begin() {
        this._startPhase(Trial.phases[0]);

        document.querySelector("#stimulus").innerHTML = this.stim.outerHTML;

        this.data.timestampStart = new Date().getTime();

        return this._wait(this.durationPreStim);
    }

    /**
     * Show stimulus. Set the timeout for the hide stim phase.
     * @return {Promise<Trial>}
     */
    showStim() {
        this._startPhase(Trial.phases[1]);

        this.data.timeStimOn = new Date().getTime() - this.data.timestampStart;
        document.querySelector("#stimulus").classList.remove('cloak');

        return this._wait(this.durationStim);
    }

    /**
     * Hide stimulus. Initiate the response phase.
     * @return {Promise<Trial>}
     */
    hideStim() {
        this._startPhase(Trial.phases[2]);

        this.data.timeStimOff = new Date().getTime() - this.data.timestampStart;
        document.querySelector("#stimulus").classList.add('cloak');

        return this._wait(this.durationPostStim);
    }

    /**
     * Collect the participant's response via the ResponseWidget.
     * @return {Promise<Trial>}
     */
    async getResponse() {

        this._startPhase(Trial.phases[3]);

        this.data.timeResponseOpen = new Date().getTime();

        let response = await this.responseWidget
            .getResponse(this.durationResponse);

        this.data.timeResponseClose = new Date().getTime();

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

        if(typeof this.displayFeedback !== "function")
            return this;

        this._startPhase(Trial.phases[4]);

        // Run the user-supplied feedback function.
        this.data.timeFeedbackOn = new Date().getTime();
        await this.displayFeedback(this);
        this.data.timeFeedbackOff = new Date().getTime();

        return this;
    }

    /**
     * End the trial and tidy up.
     * @return {Trial}
     */
    end() {
        this._startPhase(Trial.phases[5]);
        this.data.timeEnd = new Date().getDate() - this.data.timestampStart;

        return this;
    }

    /**
     * Set the display back to its fresh state.
     */
    cleanup() {
        this._startPhase(Trial.phases[6]);
        this.responseWidget.reset();
        this.constructor.reset();
        return this;
    }

    /**
     * Set the display to its fresh state.
     */
    static reset() {
        document.querySelector("#stimulus").classList.add('cloak');
        document.querySelector("#prompt").innerHTML = "";
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
 * * processResponse (post-response)
 * * showAdvice
 * * getFinalResponse
 * * processFinalResponse
 * * showFeedback
 * * end
 * * cleanup
 *
 * The showAdvice phase is handled by an Advisor. The finalResponse is handled
 * by a ResponseWidget as in the initial response inherited from Trial.
 *
 * @property advisors {Advisor[]} advisors giving advice on the trial
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

        // Generate blueprint values with respect to new defaults
        this._setDefaults(true);
        super._readBlueprint();

        AdvisedTrial.reset();
    }

    _setDefaults(skipParentDefaults = false) {

        super._setDefaults();
        this.durationShowAdvice = 1500;
        this.durationFinalResponse = null;
        this.advice = [];
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
            this.prompt = {
                showAdvice: s,
                getFinalResponse: s,
                showFeedback: s,
                end: "",
                cleanup: ""
            };
            this.myPhases.forEach((k) => {
                if(!this.prompt.hasOwnProperty(k))
                   this.prompt[k] = prompt
            });
        }
    }

    static get phases() {
        return [
            "begin",
            "showStim",
            "hideStim",
            "getResponse",
            "showAdvice",
            "getFinalResponse",
            "showFeedback",
            "end",
            "cleanup"
        ]
    }

    /**
     * Handle the response.
     * @param data {Object|undefined} response data
     */
    processResponse(data) {

        // Parent handles processing initial response
        super.processResponse(data, false);

        return this;
    }

    /**
     * Show the advice for the trial
     * @return {Promise<AdvisedTrial>}
     */
    async showAdvice() {
        this._startPhase(AdvisedTrial.phases[5]);

        this.advisors.forEach((a) => {
            const advice = a.getAdvice();
            Object.keys(advice).forEach((k)=> {
                this.data["advisor" + a.id.toString() + k] = advice[k];
            });
            a.drawAdvice();
        });

        return this;
    }

    /**
     * Hide the advice for the trial
     * @return {AdvisedTrial}
     * @protected
     */
    _hideAdvice() {
        this.advisors.forEach((a) => a.hideAdvice());

        return this;
    }

    /**
     * Get the final response from the ResponseWidget
     * @return {Promise<AdvisedTrial>}
     */
    async getFinalResponse() {
        this._startPhase(AdvisedTrial.phases[6]);

        this.data.timeResponseOpenFinal = new Date().getTime();

        let response = await this.responseWidget
            .getResponse(this.durationResponse);

        this.data.timeResponseClose = new Date().getTime();

        if(response === "undefined") {
            this.log.push("Timeout on response");
        }

        return this.processFinalResponse(response);
    }

    processFinalResponse(data) {
        this._startPhase(AdvisedTrial.phases[7]);

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

    /**
     * Set the display back to its fresh state.
     */
    cleanup() {

        this._hideAdvice();
        super.cleanup();

        return this;
    }
}

export {AdvisedTrial, Trial, utils};