/**
 * Trial
 * Matt Jaquiery, March 2019
 *
 * Javascript library for running social metacognition studies.
 */

"use strict";

import processData from "../saveData.js";
import * as utils from "../utils.js";

class Trial {
    /**
     * Run a trial
     * @param [callback] {function} called with arguments of
     * <string>stageName and <Trial>this object at each stage
     * @param [beginImmediately = false] {boolean} whether to begin the
     * trial immediately
     */
    constructor(callback, beginImmediately = false) {

        this.callback = null;
        this.activeTimeout = null;

        this.stim = new Image();
        this.stim.src = "https://cdn.instructables.com/FMU/YSFR/IDRP7INH/FMUYSFRIDRP7INH.LARGE.jpg";

        this.data = {
            timestampStart: null,
            timeStimOn: null,
            timeStimOff: null,
            timeEnd: null,

            stim: this.stim.src
        };

        Trial.reset();

        if(typeof callback === "function")
            this.callback = (stage) => callback(stage, this);
        else
            this.callback = () => {};

        if(beginImmediately)
            this.begin();
    }

    /**
     * Run the trial asynchronously.
     * @return {Promise<*>} Resolve with the trial data.
     */
    async run() {
        this.begin();
        let me = this;
        return new Promise(function (resolve, reject) {
            function check(x) {
                if(me.data.timeEnd !== null) {
                    resolve(me.data);
                } else
                    setTimeout(check, 50, x++);
            }
            check(0);
        });
    }

    /**
     * Set the prompt text and mark the start time.
     * Set the timeout for the show stimulus phase.
     */
    begin() {
        this.callback("begin");

        document.querySelector("#stimulus").innerHTML = this.stim.outerHTML;
        document.querySelector("#prompt").innerHTML =
            "How much are the coins worth?";

        this.data.timestampStart = new Date().getTime();

        this.activeTimeout = setTimeout(() => this.showStim(), 500);
    }

    /**
     * Show stimulus. Set the timeout for the hide stim phase.
     */
    showStim() {
        this.callback("showStim");

        this.data.timeStimOn = new Date().getTime() - this.data.timestampStart;
        document.querySelector("#stimulus").classList.remove('cloak');

        this.activeTimeout = setTimeout(() => this.hideStim(), 1000);
    }

    /**
     * Hide stimulus. Initiate the response phase.
     */
    hideStim() {
        this.callback("hideStim");

        this.data.timeStimOff = new Date().getTime() - this.data.timestampStart;
        document.querySelector("#stimulus").classList.add('cloak');

        this.getResponse()
            .then((data) => this.processResponse(data, false));
    }

    /**
     * Collect the participant's response via the ResponseWidget.
     * @return {Promise<*>}
     */
    async getResponse() {

        this.callback("getResponse");

        let response = await document.querySelector("esm-response-widget").getResponse(Infinity);
        if(response === "undefined") {
            console.log("Timeout on response");
        }
        return response;
    }

    /**
     * Handle the response.
     * @param data {Object|undefined} response data
     * @param isInitial {boolean} whether the response is the initial response
     */
    processResponse(data, isInitial) {

        this.callback("processResponse");

        let me = this;

        Object.keys(data).forEach((k) => {
            const s = isInitial? "initialResponse" : "finalResponse";
            if(/time/.test(k))
                data[k] -= me.data.timestampStart;

            // Save in camelCase
            me.data[s + k.substr(0,1).toUpperCase() + k.substr(1)] =
                data[k];
        });

        if(isInitial) {

        } else {
            this.data.timeEnd = new Date().getDate() - this.data.timestampStart;
            this.cleanup();

        }
    }

    /**
     * Set the display back to its fresh state.
     */
    cleanup() {
        this.callback("cleanup");
        Trial.reset();
    }

    /**
     * Set the display to its fresh state.
     */
    static reset() {
        document.querySelector("#stimulus").classList.add('cloak');
        document.querySelector("#prompt").innerHTML = "";
    }

}
export {Trial, utils};