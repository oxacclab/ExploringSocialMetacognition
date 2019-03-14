/**
 * Trial
 * Matt Jaquiery, March 2019
 *
 * Javascript library for running social metacognition studies.
 */

"use strict";

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
 * @property stim {HTMLElement} contents of the stimulus window when the stimulus is visible
 * @property [prompt=null] {string|object|null} HTML string of the prompt text. Can be an object
 * with phase names and entries for each phase (begin, showStim, hideStim, getResponse,
 * processResponse, showFeedback, end, cleanup).
 * @property [blankStim=null] {HTMLElement|null} contents of the stimulus window when the
 * stimulus is not visible
 * @property [durationPreStim=500] {int} duration of the pre-stimulus phase in ms
 * @property [durationStim=1500] {int} duration of the stimulus phase in ms
 * @property [durationPostStim=100] {int} duration between stimulus offset and results phase in ms
 * @property [durationResponse=null] {int|null} duration of the response phase. If null, use the
 * default defined in the response widget
 * @property [displayFeedback=null] {function} function display feedback. Called in await mode
 * with the trial as an input (use trial.data to access the response information). Omitting
 * this omits the feedback phase.
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
        this.activeTimeout = null;

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
            "processResponse",
            "showFeedback",
            "end",
            "cleanup"
        ];
    }

    /**
     * Get the phases with support for inheritance.
     * This seems hacky as hell.
     */
    get myPhases() {
        try {
            return eval(this.constructor.name + ".phases");
        }
        catch {
            return Trial.phases;
        }
    }

    /**
     * Set default property values for the Trial
     */
    _setDefaults() {
        this.prompt = null;
        this.blankStim = null;
        this.durationPreStim = 500;
        this.durationStim = 1500;
        this.durationPostStim = 100;
        this.durationResponse = null;
        this.displayFeedback = null;
    }

    /**
     * Set this Trial's properties based on blueprint's properties
     * @param [blueprint=null] {object|null} properties to give to the trial. Default uses
     * this.blueprint
     */
    _readBlueprint(blueprint = null) {
        if(blueprint === null)
            blueprint = this.blueprint;

        // Check blueprint matches specifications
        if(typeof blueprint === "undefined")
            throw new Error('No blueprint supplied for building trial.');
        if(!blueprint.hasOwnProperty("stim") || !(blueprint.stim instanceof HTMLElement))
            throw new Error("Blueprint does not provide a valid HTMLElement for stim.");

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
     * @private
     */
    _updatePrompt(phase) {
        document.querySelector("#prompt").innerHTML =
            this.prompt.hasOwnProperty(phase)? this.prompt[phase] : "";
    }

    /**
     * Register the beginning of a phase. Callback and prompt update.
     * @param phase {int|string} phase identifier
     */
    _startPhase(phase) {
        if(typeof phase !== "string")
            phase = this.myPhases[phase];

        this.callback(phase);
        this._updatePrompt(phase);
    }

    /**
     * Run the trial asynchronously.
     * @return {Promise<Trial>} Resolve with the trial data.
     */
    async run() {
        this.begin();
        let me = this;
        return new Promise(function (resolve) {
            function check() {
                if(me.data.timeEnd !== null) {
                    resolve(me);
                } else
                    setTimeout(check, 50);
            }
            check(0);
        });
    }

    /**
     * Set the prompt text and mark the start time.
     * Set the timeout for the show stimulus phase.
     * @param [cueNextPhase=false] {boolean} whether to automatically move to the next phase of the Trial
     * @return {Trial}
     */
    begin(cueNextPhase = true) {
        this._startPhase(Trial.phases[0]);

        document.querySelector("#stimulus").innerHTML = this.stim.outerHTML;

        this.data.timestampStart = new Date().getTime();

        if(cueNextPhase)
            this.activeTimeout = setTimeout(
                () => this.showStim(), this.durationPreStim);

        return this;
    }

    /**
     * Show stimulus. Set the timeout for the hide stim phase.
     * @param [cueNextPhase=false] {boolean} whether to automatically move to the next phase of the Trial
     * @return {Trial}
     */
    showStim(cueNextPhase = true) {
        this._startPhase(Trial.phases[1]);

        this.data.timeStimOn = new Date().getTime() - this.data.timestampStart;
        document.querySelector("#stimulus").classList.remove('cloak');

        if(cueNextPhase)
            this.activeTimeout = setTimeout(
                () => this.hideStim(), this.durationStim);

        return this;
    }

    /**
     * Hide stimulus. Initiate the response phase.
     * @param [cueNextPhase=false] {boolean} whether to automatically move to the next phase of the Trial
     * @return {Trial}
     */
    hideStim(cueNextPhase = true) {
        this._startPhase(Trial.phases[2]);

        this.data.timeStimOff = new Date().getTime() - this.data.timestampStart;
        document.querySelector("#stimulus").classList.add('cloak');

        if(cueNextPhase)
            setTimeout(()=>{
                this.getResponse()
                    .then((data) => this.processResponse(data, cueNextPhase));
            }, this.durationPostStim);

        return this;
    }

    /**
     * Collect the participant's response via the ResponseWidget.
     * @return {Promise<*>}
     */
    async getResponse() {

        this._startPhase(Trial.phases[3]);

        this.data.timeResponseOpen = new Date().getTime();

        let response = await document.querySelector("esm-response-widget").getResponse(this.durationResponse);

        this.data.timeResponseClose = new Date().getTime();

        if(response === "undefined") {
            this.log.push("Timeout on response");
        }
        return response;
    }

    /**
     * Handle the response.
     * @param data {Object|undefined} response data
     * @param [cueNextPhase=false] {boolean} whether to automatically move to the next phase of the Trial
     */
    processResponse(data, cueNextPhase = true) {

        this._startPhase(Trial.phases[4]);

        let me = this;

        Object.keys(data).forEach((k) => {
            const s = "response";
            if(/time/.test(k))
                data[k] -= me.data.timestampStart;

            // Save in camelCase
            me.data[s + k.substr(0,1).toUpperCase() + k.substr(1)] =
                data[k];
        });

        if(!cueNextPhase)
            return this;

        if(typeof this.displayFeedback === "function")
            return this.showFeedback();
        else
            return this.end();
    }

    /**
     * Show feedback using a user-supplied feedback function.
     * @param [cueNextPhase=false] {boolean} whether to automatically move to the next phase of the Trial
     * @return {Promise<Trial>}
     */
    async showFeedback(cueNextPhase = true) {

        this._startPhase(Trial.phases[5]);

        // Run the user-supplied feedback function.
        this.data.timeFeedbackOn = new Date().getTime();
        await this.displayFeedback(this);
        this.data.timeFeedbackOff = new Date().getTime();

        return cueNextPhase? this.end() : this;
    }

    /**
     * End the trial and tidy up.
     * @param [cueNextPhase=false] {boolean} whether to automatically move to the next phase of the Trial
     * @return {Trial}
     */
    end(cueNextPhase = true) {

        this._startPhase(Trial.phases[6]);
        this.data.timeEnd = new Date().getDate() - this.data.timestampStart;

        if(cueNextPhase)
            this.cleanup();

        return this;
    }

    /**
     * Abort the trial.
     * @param level {int} urgency:
     * * 0 = wind-down via end()
     * * 1 = cleanup only
     * * 2 = immediately end
     *
     * @return {Trial}
     */
    abort(level = 0) {
        clearTimeout(this.activeTimeout);
        switch(level) {
            case 2:
                return this;
            case 1:
                this.cleanup();
                return this;
            default:
                return this.end();
        }
    }

    /**
     * Set the display back to its fresh state.
     */
    cleanup() {
        this._startPhase(Trial.phases[7]);
        Trial.reset();
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
 * The showAdvice phase is handled by an Advisor. The finalResponse is handled by a ResponseWidget
 * as in the initial response inherited from Trial.
 *
 * @property [durationShowAdvice=null] {int|null} duration of the advice display in ms, or null to
 * allow the Advisor to handle it
 * @property [durationFinalResponse=null] {int|null} duration of the final response phase. If
 * null, inherit from durationResponse (which can waive response time to let the ResponseWidget
 * handle it)
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
        this._setDefaults();
        this._readBlueprint();

        AdvisedTrial.reset();
    }

    static get phases() {
        return [
            "begin",
            "showStim",
            "hideStim",
            "getInitialResponse",
            "processInitialResponse",
            "showAdvice",
            "getFinalResponse",
            "processFinalResponse",
            "showFeedback",
            "end",
            "cleanup"
        ]
    }
}

export {AdvisedTrial, Trial, utils};