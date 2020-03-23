import {AdvisedTrial} from "./AdvisedTrial.js";

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

        if (confidence === "undefined") {
            this.log.push("Timeout on confidence judgement");
        }

        return this.processConfidence(confidence);
    }

    processConfidence(data) {
        let me = this;

        Object.keys(data).forEach((k) => {
            const s = "confidence";
            if (/time/.test(k))
                data[k] -= me.data.timestampStart;

            // Save in camelCase
            me.data[s + k.substr(0, 1).toUpperCase() + k.substr(1)] = data[k];
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

        if (confidence === "undefined") {
            this.log.push("Timeout on final confidence judgement");
        }

        return this.processFinalConfidence(confidence);
    }

    processFinalConfidence(data) {
        let me = this;

        Object.keys(data).forEach((k) => {
            const s = "confidence";
            if (/time/.test(k))
                data[k] -= me.data.timestampStart;

            // Save in camelCase
            me.data[s + k.substr(0, 1).toUpperCase() + k.substr(1) + "Final"] = data[k];
        });

        return this;
    }
}

export {AdvisedTrialWithConf};