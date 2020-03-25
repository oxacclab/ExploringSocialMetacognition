import * as utils from "../../../utils.js";
import {AdviceProfile} from "./AdviceProfile.js";

/**
 * @class AdviceSpecification
 * @classdes An AdviceSpecification differs from an AdviceProfile in that AdviceSpecification does not aggregate its AdviceTypes by flag, meaning that multiple customised instances of the same AdviceType can be supplied.
 */
class AdviceSpecification extends AdviceProfile {
    constructor(blueprint) {
        super(blueprint);

        // Empty list
        this.usedTypes = this.adviceTypes.map(()=>0);
    }

    /**
     * Return the number of times this adviceType has been used
     * @param adviceType {AdviceType}
     * @return {number}
     */
    getUsedCount(adviceType) {
        return this.usedTypes[this.adviceTypes.indexOf(adviceType)];
    }

    /**
     * Set the number of times this adviceType has been used
     * @param adviceType {AdviceType}
     * @param count {number}
     */
    setUsedCount(adviceType, count) {
        this.usedTypes[this.adviceTypes.indexOf(adviceType)] = count;
    }
}

export {AdviceSpecification}