import {NoFeedbackStudy} from "./NoFeedbackStudy.js";
import {Advisor} from "../Advisors/Advisor.js";

/**
 * @class NoFeedbackContexts
 * @extends NoFeedbackStudy
 * @classdesc Advisors are unique on each trial, drawn from a population of advisors defined by the initial advisors. Context, described at the beginning of each block, informs participants about the population of advisors (rather than an introduction to the advisor they'll have for the whole block).
 *
 */
class NoFeedbackContexts extends NoFeedbackStudy {

    static get listPhases() {
        return [
            "splashScreen",
            "consent",
            "demographics",
            "introduction",
            "training",
            "practiceInstructions",
            "practice",
            "advisorPracticeInstructions",
            "advisorPractice",
            "coreInstructions",
            "core",
            "debrief",
            "results"
        ];
    }

    async setupTrials() {
        await super.setupTrials();
        this.fillAdvisorNames();
    }

    /**
     * Add cosmetic renaming of advisors to make them appear to be from different groups
     * @return {void}
     */
    fillAdvisorNames() {
        // Make individual advisors for each trial from the individual advisors
        let numbers = utils.shuffle(utils.getSequence(10, 99));

        for (let t = 0; t < this.trials.length; t++) {
            const T = this.trials[t];
            if (!T.advisors)
                continue;
            const advisors = [];
            for (let i = 0; i < T.advisors.length; i++) {
                const a = T.advisors[i];
                const name = a.id === 0 ? "Practice advisor #" : "Advisor #";

                // Hoist advisor group properties to be trial context properties
                T.context = a.group;
                T.contextName = a.idDescription;
                T.contextDescription = a.introText;

                // Save as new copy of advisor
                advisors.push(new Advisor({
                    ...a,
                    id: t,
                    name: name + numbers.pop().toString(),
                    _image: null // force the identicon to recalculate
                }));
            }
            T.advisors = advisors;
        }

    }

    /**
     * Introduce the context in which the next block is to take place
     * @param advisors
     * @return {Promise<void>}
     * @protected
     */
    async _introduceAdvisors(advisors) {
        // Filter advisors to be unique across id
        const uniqueAdvisors = [];

        advisors.forEach(a => {
            if (!uniqueAdvisors.filter(x => x.id === a.id).length)
                uniqueAdvisors.push(a);
        });

        // Remove current advisors
        document.querySelectorAll(".advisor-key .advisor-key-row").forEach(
            (elm) => elm.remove()
        );

        const a = uniqueAdvisors.pop();

        document.querySelector('#stimulus').innerHTML =
            document.querySelector('#advisor-intro-text')
                .content.querySelector('.advisor-intro').outerHTML;

        document.querySelector('.advisor-intro .text').innerHTML =
            a.introText;

        await new Promise(r => {
            // Add a slight delay to the button press
            const minTime = new Date().getTime() + 500;
            document.querySelector('.advisor-intro .confirm button')
                .addEventListener('click', () => {
                    if (new Date().getTime() >= minTime)
                        r();
                });
        });
    }

}

export {NoFeedbackContexts};