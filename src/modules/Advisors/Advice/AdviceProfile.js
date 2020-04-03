import * as utils from "../../../utils.js";
import {BaseObject} from "../../Prototypes.js";

/**
 * @class AdviceProfile
 * @classdesc An AdviceProfile contains different kinds of advice, specifying
 * their definitions and their desired quantities. It also tracks the number
 * of times each advice type has actually been used, which allows for recording
 * the empirical provision of advice as well as the desired provision.
 * AdviceProfile can be used to specify the exact order in which AdviceTypes are used by setting fixedSelection to true.
 *
 * @property adviceTypes {AdviceType[]} list of AdviceTypes to iterate through when calculating advice
 * @property fixedSelection {boolean} whether to select AdviceType by adhering to the order in which they are input rather than using weighted random selection. Where the desired adviceType is not available, its fallback will be used. Defaults to false.
 * @property shuffleOnReset {boolean} whether to shuffle the order of adviceTypes when starting at index 0. Defaults to true.
 */
class AdviceProfile extends BaseObject {
    constructor(blueprint) {
        super(blueprint);

        this.usedTypes = {};
        const me = this;
        this.adviceTypes.forEach(aT => me.setUsedCount(aT, 0));
    }

    _setDefaults() {
        super._setDefaults();
        this.shuffleOnReset = true;
        this.fixedSelection = false;
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
     * Fetch an advisor's advice for a trial
     * @param trial {Trial}
     * @param advisor {Advisor}
     * @return {{
     *      adviceCentre: number,
     *      adviceSide: (number|null),
     *      adviceWidth: number,
     *      validTypeFlags: null,
     *      actualTypeFlag: int,
     *      actualType: string,
     *      nominalTypeFlag: null,
     *      advice: number,
     *      adviceConfidence: (number|null),
     *      nominalType: null,
     *      validTypes: null
     * }}
     */
    getAdvice(trial, advisor) {
        let out = {
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
            const type = this.getAdviceType(trial, advisor);
            aT = type.adviceType;
            // Copy meta information for saving in trial csv file later
            delete type.adviceType;
            out = {...out, ...type};
        }

        // Record final AdviceType details and use to get advice
        out = {
            ...out,
            actualType: aT.name,
            actualTypeFlag: aT.flag,
            ...this.getAdviceFromAdviceType(trial, advisor, aT)
        };

        return out;
    }

    /**
     * Fetch the AdviceType to use for this advisor's advice on the trial
     * @param trial {Trial}
     * @param advisor {Advisor}
     * @param [includeInCounter=true] {boolean} whether to count the selected trial towards the quotas
     *
     * @return {{
     *     validTypes: string,
     *     validTypeFlags: int,
     *     adviceType: AdviceType
     * }}
     */
    getAdviceType(trial, advisor, includeInCounter = true) {
        const out = {validTypes: "", validTypeFlags: 0};
        // Record qualified matches
        const types = this.getValidAdviceTypes(trial, advisor);
        out.validTypes = types
            .map(aT => `${(aT.quantity - this.getUsedCount(aT))}/${aT.quantity}:${aT.name}`)
            .join(", ");
        out.validTypeFlags = utils.sumList(types.map(aT => aT.flag));

        // Pick an AdviceType to use
        let aT = this.chooseAdviceType(trial, advisor);
        out.nominalType = aT.name;
        out.nominalTypeFlag = aT.flag;

        // Handle cases where there were no valid AdviceTypes, so the invalid one selected requires a fallback
        if (!types.length) {
            let t = aT;
            while (t.match(trial, advisor, t) === null) {
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

        if(includeInCounter) {
            this.markUsed(aT);
        }

        return {...out, adviceType: aT};
    }

    /**
     * Return a list of the adviceTypes which are valid for this trial and advisor
     * @param trial {Trial|null} If blank, the last cached value is returned
     * @param advisor {Advisor|null}
     * @return {AdviceType[]|null}
     */
    getValidAdviceTypes(trial, advisor) {
        if(this.fixedSelection) {
            return [this.nextAdviceType];
        }
        if(!trial) {
            if (this._validAdviceTypes)
                return this._validAdviceTypes;
            else {
                this.warn("getValidTypes() did not receive a trial object and has no cached value.");
                return null;
            }
        }

        this._validAdviceTypes = this.adviceTypes.filter(
            aT => aT.match(trial, advisor, aT)
        );

        return this._validAdviceTypes;
    }

    /**
     * Choose an AdviceType by weighted random selection based on the quantities of the available adviceTypes. Prioritise AdviceTypes which can offer valid advice on the trial.
     * @param trial {Trial}
     * @param advisor {Advisor}
     * @return {AdviceType}
     */
    chooseAdviceType(trial, advisor) {
        const me = this;
        let types = this.getValidAdviceTypes(trial, advisor);
        let quantities = types.map(
            aT => aT.quantity - me.getUsedCount(aT)
        );
        let sum = utils.sumList(quantities);

        if(sum <= 0) {
            // Fallback on looking at any type rather than simply valid types
            types = this.adviceTypes;
            quantities = types.map(
                aT => aT.quantity - me.getUsedCount(aT)
            );
            sum = utils.sumList(quantities);
            if(sum <= 0) {
                // If everything is exhausted, reset the counts
                this.resetUsedCounts();
                if(utils.sumList(types.map(
                    aT => aT.quantity - me.getUsedCount(aT))
                ))
                    return this.chooseAdviceType(trial, advisor);
                else
                    this.error('No AdviceTypes left even after resetting!')
            }
        }

        // Select a type by weighted random selection accounting for past
        // selections
        let x = utils.randomNumber(1, sum, true);
        let i = 0;
        while(x > 0 || i === 0) {
            x -= quantities[i++];
        }

        return types[i - 1];
    }

    /**
     * @return {AdviceType} first AdviceType with unused quantity
     */
    get nextAdviceType() {
        // Fetch the first adviceType with quantity left to use
        for(let i = 0; i < this.adviceTypes.length; i++) {
            const aT = this.adviceTypes[i];
            if(aT.quantity > this.getUsedCount(aT))
                return aT;
        }
    }

    /**
     * Increase the usage count for this AdviceType and reset all counts if all AdviceTypes have been used according to their quantities.
     * @param adviceType {AdviceType}
     */
    markUsed(adviceType) {
        // Mark chosen type as used
        this.setUsedCount(adviceType, this.getUsedCount(adviceType) + 1);
    }

    /**
     * Return the number of times this adviceType has been used
     * @param adviceType {AdviceType}
     * @return {number}
     */
    getUsedCount(adviceType) {
        return this.usedTypes[adviceType.flag];
    }

    /**
     * Set the number of times this adviceType has been used
     * @param adviceType {AdviceType}
     * @param count {number}
     */
    setUsedCount(adviceType, count) {
        this.usedTypes[adviceType.flag] = count;
    }

    /**
     * Reset used type counts
     */
    resetUsedCounts() {
        if(this.shuffleOnReset)
            this.adviceTypes = utils.shuffle(this.adviceTypes);
        this.adviceTypes.forEach(
            aT => this.setUsedCount(aT, 0));
        this.info("Used all advice instances; resetting.");
    }

    /**
     * Use an AdviceType to calculate advice
     * @param trial {Trial}
     * @param advisor {Advisor}
     * @param adviceType {AdviceType}
     *
     * @return {{
     *     adviceCentre: number,
     *     adviceWidth: number,
     *     advice: number,
     *     adviceSide: (number|null),
     *     adviceConfidence: (number|null)
     * }}
     */
    getAdviceFromAdviceType(trial, advisor, adviceType) {
        const out = {};

        // Advice is selected as the middle of the available values
        let range = adviceType.match(trial, advisor, adviceType);
        if(range.length === 1) {
            out.adviceCentre = range[0];
            out.advice = range[0];
        }
        else {
            out.adviceCentre =
                Math.round((range[1] - range[0]) / 2) +
                range[0];

            // Add some variation around the mean
            let room = utils.min([
                out.adviceCentre - range[0],
                advisor.confidenceVariation,
                range[1] - out.adviceCentre
            ], true);
            out.advice = utils.randomNumber(out.adviceCentre - room, out.adviceCentre + room);
        }

        out.adviceWidth = advisor.confidence;

        // Advice for binary options is thresholded by the anchor
        if (trial.anchorDate)
            out.adviceSide = (out.advice >= trial.anchorDate) ? 1 : 0;

        if (trial.showAdvisorConfidence) {
            if(advisor.confidenceFunction)
                out.adviceConfidence = advisor.confidenceFunction(out, trial, advisor, adviceType);
            else if(adviceType.confidence)
                out.adviceConfidence = adviceType.confidence(out, trial, advisor, adviceType);
            else
                out.adviceConfidence = AdviceProfile.getConfidence(out, trial, advisor, adviceType);

            out.adviceConfidence = Math.max(
                0, Math.min(100, Math.round(out.adviceConfidence))
            );
        }

        return out;
    }

    /**
     * Confidence increases each year up to 100% confident at the advisor's confidence boundary
     * @param answer {{
     *     adviceCentre: number,
     *     adviceWidth: number,
     *     advice: number,
     *     adviceSide: (number|null)}}
     * @param trial {Trial}
     * @param advisor {Advisor}
     * @param adviceType {AdviceType}
     * @return {number}
     */
    static getConfidence(answer, trial, advisor, adviceType) {
        let adviceConfidence =
            Math.abs(answer.advice - trial.anchorDate) /
            advisor.confidence * 100;
        if (advisor.confidenceAddition)
            adviceConfidence += advisor.confidenceAddition;

        return adviceConfidence;
    }

    /**
     * Confidence increases via the cumulative normal distribution based on the difference between the estimate and the anchor.
     * @param answer {{
     *     adviceCentre: number,
     *     adviceWidth: number,
     *     advice: number,
     *     adviceSide: (number|null)}}
     * @param trial {Trial}
     * @param advisor {Advisor}
     * @param adviceType {AdviceType}
     * @return {number}
     */
    static getConfidenceByPCorrect(answer, trial, advisor, adviceType) {
        // calculate p(correct) from estimate-anchor difference
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

    /**
     * The AdviceType with the greatest quantity
     * @return {AdviceType|null}
     */
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