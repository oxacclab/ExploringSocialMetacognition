import {DatesStudy} from "./DatesStudy.js";

/**
 * @class NoFeedbackStudy
 * @extends DatesStudy
 * @classdesc Overwrite feedback assignment in the conditions.
 *
 */
class NoFeedbackStudy extends DatesStudy {

    /**
     * This is kinda a massive ugly copy+paste hack.
     * Really conditions should be handled with flags or something.
     * @param condition
     */
    setCondition(condition) {
        if (condition)
            this.condition = condition;

        this.info("Assigning condition variables for condition " + this.condition);

        this._setAdvisorOrder(this.condition % 2);

        // Group stuff (static)
        const match = /(^| )group-([0-9]+)( |$)/.exec(document.body.className);
        let pGroup;
        if (match[2]) {
            pGroup = parseInt(match[2]);
        } else {
            this.warn('No group-# class in body, defaulting to group 1.');
            pGroup = 1;
        }
        this.pGroup = pGroup;

        this.advisors.forEach(
            a => a.sameGroup = a.group === this.pGroup
        );

        this.pushBlockPropertiesToTrials();
    }
}

export {NoFeedbackStudy};