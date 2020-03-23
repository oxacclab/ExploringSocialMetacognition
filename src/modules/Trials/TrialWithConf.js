import {AdvisedTrialWithConf} from "./AdvisedTrialWithConf.js";

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

export {TrialWithConf};