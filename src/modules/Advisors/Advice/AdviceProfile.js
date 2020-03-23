import {BaseObject} from "../../Prototypes.js";
import {Advisor} from "../Advisor.js";

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
        if (!blueprint)
            blueprint = this.blueprint;
        if (!super._verifyBlueprint(blueprint))
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
        if (typeof trial.adviceTypeOverride !== "undefined") {
            if (typeof trial.adviceTypeOverride === "function") {
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

                if (!aT.match(trial, advisor))
                    return;

                validQuantities[aT.name] = aT.quantity - this.usedTypes[aT.flag];
                validFlags += aT.flag;
            });

            let fallback = false;
            if (utils.sumList(validQuantities) <= 0)
                fallback = true;

            // Allow fallbacks if nothing qualifies
            let types = fallback ?
                Object.keys(allQuantities) : Object.keys(validQuantities);
            let sum = utils.sumList(fallback ? allQuantities : validQuantities);

            // Select a type by weighted random selection accounting for past
            // selections
            let type = null;
            let x = Math.random();
            for (type of types) {
                x -= allQuantities[type] / sum;
                if (x < 0)
                    break;
            }

            // Selected type
            this.adviceTypes.forEach(t => {
                if (t.name === type)
                    aT = t;
            });
            out.validTypes = Object.keys(validQuantities).join(", ");
            out.validTypeFlags = validFlags;
            out.nominalType = aT.name;
            out.nominalTypeFlag = aT.flag;
            this.usedTypes[out.nominalTypeFlag]++;

            if (fallback) {
                let t = aT;
                while (t.match(trial, advisor) === null) {
                    for (let x of this.adviceTypes)
                        if (x.name === t.fallback || x.flag === t.fallback) {
                            t = x;
                            break;
                        }

                    if (t === aT || t === null)
                        this.error("No valid adviceType and no fallback.");
                }
                aT = t;
            }

            // Reset the used types
            if (utils.sumList(allQuantities) === utils.sumList(this.usedTypes)) {
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
        if (trial.anchorDate)
            out.adviceSide = (out.advice >= trial.anchorDate) ? 1 : 0;

        if (trial.showAdvisorConfidence) {
            if (advisor.confidenceFunction)
                out.adviceConfidence = advisor.confidenceFunction(out, trial, advisor);
            else
                out.adviceConfidence = AdviceProfile.getConfidence(out, trial, advisor);

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
        if (advisor.confidenceAddition)
            adviceConfidence += advisor.confidenceAddition;

        return adviceConfidence;
    }

    static getConfidenceByPCorrect(answer, trial, advisor) {
        // calculate p(correct) from estimate-anchor difference
        // This is a cubic function with parameters empirically estimated for
        // advisor with confidenceVariation = anchor distribution SD
        const d = Math.abs(trial.anchorDate - answer.advice);
        let pCor;
        if (advisor.pCorFunction)
            pCor = advisor.pCorFunction(d);
        else
        // Cumulative density of the normal distribution
        // derived from simulations in dates-binary-advice-accuracy.Rmd
            pCor = utils.pNorm(d, 0, 12);

        if (pCor < 0)
            pCor = 0;
        if (pCor > 1)
            pCor = 1;

        // confidence comes from function of p(correct) in confidence space
        let slope = 1.25;
        let nudge = -.5;
        let noise_sd = .05;
        if (advisor.confidenceFunctionParams) {
            slope = advisor.confidenceFunctionParams.slope || slope;
            nudge = advisor.confidenceFunctionParams.nudge || nudge;
            noise_sd = advisor.confidenceFunctionParams.noise_sd || noise_sd;
        }

        let conf = slope * (pCor + nudge);
        // add a little random noise
        conf += utils.sampleNormal(1, 0, noise_sd);
        if (conf < 0)
            return AdviceProfile.getConfidenceByPCorrect(answer, trial, advisor);

        conf *= 100;

        if (advisor.confidenceAddition)
            conf += advisor.confidenceAddition;

        return conf;
    }

    get mainAdviceType() {
        const x = {
            q: -Infinity,
            i: null
        };

        for (let i = 0; i < this.adviceTypes.length; i++) {
            if (this.adviceTypes[i].quantity > x.q) {
                x.q = this.adviceTypes[i].quantity;
                x.i = i;
            }
        }

        if (x.i === null)
            return null;

        return this.adviceTypes[x.i];
    }
}

export {AdviceProfile};