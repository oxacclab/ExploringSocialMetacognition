import {Trial} from "./Trial.js";

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
        this.advisorOptions = [];
        this.advisorChoice = false;
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
        if (typeof prompt === "string") {
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
                if (!this.prompt.hasOwnProperty(k))
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
     * Check advisor can be seen, as well as setting prompt etc.
     * @return {Promise<Trial>}
     */
    async begin() {
        const me = this;
        const advisors = this.advisors;
        // Remove old unused advisors
        document.querySelectorAll('.advisor-key .advisor-key-row').forEach(elm => {
            if (
                !advisors.filter(a => a.id.toString() === elm.dataset.advisorId).length ||
                me.forceRefreshAdvisor)
                elm.remove();
        });

        // Add new advisors
        if (this.advisors) {
            this.advisors.forEach(a => {
                let add = true;
                document.querySelectorAll(
                    '.advisor-key .advisor-key-row'
                ).forEach(elm => {
                    if (elm.dataset.advisorId === a.id.toString())
                        add = false;
                });
                if (add)
                    document.querySelector('.advisor-key')
                        .appendChild(a.getInfoTab());
            });
        }

        return super.begin();
    }

    /**
     * Choose the advisor for the trial
     * @return {Promise<AdvisedTrial>}
     */
    async chooseAdvisor() {
        if (!this.advisorChoice)
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
                            if (a.id.toString() === id) {
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
                if (id) {
                    elm.classList.remove("gives-advice");

                    me.advisors.forEach(a => {
                        if (a.id.toString() === id) {
                            elm.classList.add("gives-advice");
                            clean = false;
                        }
                    });
                }
            });
        // Allow time for animations to play
        if (!clean)
            await this.wait(1000);

        // Register advisors in the data output
        for (let i = 0; i < this.advisors.length; i++) {
            const a = this.advisors[i];

            // Save advisor's advice
            const advice = a.getAdvice(this);
            // Don't use forEach here because Apple has a unique interpretation of alphabetical order!
            const keys = Object.keys(advice);
            for(let k = 0; k < keys.length; k++) {
                const key = keys[k];
                if (advice.hasOwnProperty(key))
                    this.data["advisor" + i.toString() + key] = advice[key];
            }

            await a.drawAdvice();
        }

        return this;
    }

    /**
     * Register advisors in the data output
     */
    saveAdvisorData() {

        for (let i = 0; i < this.advisors.length; i++) {
            const a = this.advisors[i];
            const tbl = a.toTable();
            const s = "advisor" + i.toString();
            this.data[s] = i;
            for (let x in tbl)
                if (tbl.hasOwnProperty(x))
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

        if (response === "undefined") {
            this.log.push("Timeout on response");
        }

        return this.processFinalResponse(response);
    }

    processFinalResponse(data) {

        this.saveAdvisorData();

        let me = this;

        Object.keys(data).forEach((k) => {
            const s = "response";
            if (/time/.test(k))
                data[k] -= me.data.timestampStart;

            // Save in camelCase
            me.data[s + k.substr(0, 1).toUpperCase() + k.substr(1) + "Final"] =
                data[k];
        });

        return this;
    }

    cleanup() {
        this.advisors.forEach((a) => a.hideAdvice());
        return super.cleanup();
    }

    /**
     * Fetch the data for the study in a flat format suitable for CSVing
     * @param [headers=null] {string[]|null} values to read. Defaults to
     * this.tableHeaders
     * @return {object} key-value pairs where all values are single items
     */
    toTable(headers = null) {
        // Add advisor-specific data fields
        this.data.context = this.context;
        this.data.contextName = this.contextName;
        this.data.contextDescription = this.contextDescription;

        // Add advisor choice data fields
        this.data.advisorChoice = this.advisorChoice;
        this.data.advisorOptions = this.advisorOptions.map(a => a.id).join(',');

        // Add attention check stuff
        if (this.attentionCheck) {
            this.data.attentionCheckMarkerWidth = this.attentionCheckMarkerWidth;
            this.data.attentionCheckHighConf = this.attentionCheckHighConf;
            this.data.attentionCheckCorrect = this.attentionCheckCorrect;
        }

        return super.toTable(headers);
    }
}

export {AdvisedTrial};