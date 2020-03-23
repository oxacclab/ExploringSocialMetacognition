import {DatesStudy} from "./DatesStudy.js";

/**
 * @class MinGroupsStudy
 * @extends DatesStudy
 * @classdesc Minimal groups manipulation.
 *
 * @property questionsXML {string} URL of a question.xml file for parsing
 */
class MinGroupsStudy extends DatesStudy {

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
            "assignGroup",
            "core",
            "debriefAdvisors",
            "debrief",
            "results"
        ];
    }

    _setDefaults() {
        super._setDefaults();
    }

    async assignGroup() {

        const me = this;

        return new Promise(function (resolve) {
            function flipCoin() {
                const coin = document.querySelector("#instructions .coin");
                coin.classList.add("spin-stop");

                setTimeout(() => {
                    coin.classList.add("spin-fast", "side-" + me.pGroup);
                    setTimeout(showResult, 3500);
                }, 500);
            }

            function showResult() {
                document.querySelector(".coin-instructions")
                    .classList.remove("pre");
                document.querySelector(".coin-instructions")
                    .classList.add("post");

                setTimeout(allowProgress, 1000);
            }

            function allowProgress() {
                document.querySelector("#instructions button.okay")
                    .disabled = false;
            }

            function finish() {
                instr.innerHTML = "";
                resolve();
            }

            let instr = document.getElementById("instructions");
            instr.innerHTML = "";
            // Add new
            instr.appendChild(
                document.importNode(
                    document.getElementById("assign-group").content,
                    true));
            instr.classList.remove("hidden");

            // Start the coin-flippery
            document.querySelector("#instructions .coin")
                .addEventListener('click', e => {
                    flipCoin();
                });

            document.querySelector("#instructions button.okay")
                .addEventListener('click', e => {
                    finish()
                });
        });
    }

    /**
     * Set the condition variables according to condition.
     * There are 4 conditions
     *  Odd conditions present the same-group advisor first
     *  Conditions 1-2 vs 3-4 use different participant group assignment
     * @param condition
     */
    setCondition(condition) {
        if (condition)
            this.condition = condition;

        this.info("Assigning condition variables for condition " + this.condition);

        // Group
        this.pGroup = (this.condition <= this.conditionCount / 2) + 1;

        const pGroup = this.pGroup;
        this.advisors.forEach(a => {
            // Do nothing with the practice advisor
            if (a.idDescription === "Practice")
                return;

            a.sameGroup = a.group === pGroup;
            if (a.sameGroup) {
                a.idDescription = "inGroup";
                a.introText = "This advisor is in your group."
            } else {
                a.idDescription = "outGroup";
                a.introText = "This advisor is in the other group."
            }
        });

        // Track the participant's group in CSS using a body class
        document.body.classList.add("group-" + this.pGroup);

        // Advisor order
        const advisorOrder = [];

        advisorOrder[0] = (this.condition % 2) + 1;
        advisorOrder[1] = 3 - advisorOrder[0];

        const advisors = this.advisors;
        const me = this;

        this.blocks.filter(b => b.blockType === "core")
            .forEach(b => {
                let i = me.blocks.indexOf(b);
                b.advisors = [advisors[advisorOrder[i % 2]]]
            });

        // Update trials with new info
        const blocks = this.blocks;
        this.trials.forEach(t => {
            if (t.blockType === "core") {
                for (let k in blocks[t.block]) {
                    if (blocks[t.block].hasOwnProperty(k)) {
                        t[k] = blocks[t.block][k];
                    }
                }
            }
        });

        this.validate();
    }

    _getPublicDebriefFormData() {
        return {
            comment: document.querySelector("form textarea[name='advisorDifference']").value,
            group: document.querySelector("form input[name='group']:checked").value,
        };
    }

    /**
     * Fetch the data for the study in a flat format suitable for CSVing
     * @return {object} key-value pairs
     */
    toTable() {
        return {
            ...super.toTable(),
            pGroup: this.pGroup
        };
    }
}

export {MinGroupsStudy};