import {Advisor} from "../Advisors/Advisor.js";
import {DatesStudyBinary} from "./DatesStudyBinary.js";

/**
 * @class DatesStudyHybrid
 * @extends DatesStudyBinary
 * @classdesc Advisor introduction is now done more clearly on a separate screen. Hybrid advisor introduction is done with special instruction set.
 *
 */
class DatesStudyHybrid extends DatesStudyBinary {

    _setDefaults() {
        super._setDefaults();
        this.minAdvisorIntroPanelTime = 1000;
    }

    async advisorPracticeInstructions() {
        const me = this;
        const scorecard = Advisor.makeScorecard(
            me.trials.filter(t => t.data.block === 0)
        ).querySelector('div');
        document.getElementById('instr-practice-advisor')
            .content
            .querySelectorAll('.scorecard.participant')
            .forEach(e => e.appendChild(scorecard.cloneNode(true)));

        return super.advisorPracticeInstructions();
    }

    /**
     * Wipe the advisors panel and introduce new advisors
     * @param advisors {Advisor[]}
     */
    async _introduceAdvisors(advisors) {
        // Remove current advisors
        document.querySelectorAll(".advisor-key .advisor-key-row").forEach(
            (elm) => elm.remove()
        );

        // Check whether we've got hybrids
        if (advisors.filter(a => /Hybrid/.test(a.constructor.name)).length)
            await this._introduceHybrids(advisors, null);
        else
            await this._introduceAdvisor(advisors[0], null);
    }

    /**
     * Fetch an advisor's introductory content.
     * @param advisor {Advisor} advisor whose introduction to fetch
     * @param [templateId='instr-advisor-intro'] {string} id of the template to clone
     * @return {HTMLElement}
     * @protected
     */
    _advisorIntroSpeechPage(advisor, templateId = 'advisor-intro-speech') {
        // Update the advisor intro field to contain the appropriate info for advisor
        const template = document.getElementById(templateId);
        if (!template)
            this.error(`Cannot find intro speech template with id '${templateId}'`);

        const content = document.importNode(template.content, true);

        content.querySelectorAll('.advisor-name')
            .forEach(e => e.innerHTML = advisor.name);
        const keyRow = content.querySelector('.advisor-key-row');
        keyRow.classList.add(`group-${advisor.group}`);
        keyRow.dataset.advisorId = advisor.id;
        const marker = content.querySelector('.response-marker.advisor');
        marker.classList.add(`group-${advisor.group}`, `advisor-${advisor.id}`);
        marker.innerHTML = advisor.image().outerHTML;
        const bubble = content.querySelector('.text');
        bubble.classList.add(`group-${advisor.group}`);
        bubble.innerHTML = advisor.introText;

        // Add scorecard
        const sc = content.querySelector('.scorecard');
        if(sc) {
            content.querySelector('div')
                .classList.add('advisor-intro-with-scores');
            const me = this;
            const participantScorecard = Advisor.makeScorecard(
                me.trials.filter(t => t.data.block === 0)
            );
            const advisorScorecard =
                advisor.getScorecard(advisor.introScores);

            sc.appendChild(advisorScorecard);
            sc.appendChild(participantScorecard);
        }

        return content;
    }

    /**
     * Insert an advisor's info tab with an animation for visibility.
     * @param advisor {Advisor}
     * @param resolve {function} callback for promise
     * @return {Promise<HTMLElement>}
     */
    async _introduceAdvisor(advisor, resolve) {

        // Update the intro field of the template
        const templateId = 'instr-advisor-intro';
        const content = document.getElementById(templateId).content;
        content.querySelectorAll('.advisor-name')
            .forEach(e => e.innerHTML = advisor.name);

        // Strip old entries
        content.querySelectorAll('.temporary')
            .forEach(e => e.remove());

        // Amend the template to insert the advisor's introduction
        const page = content.querySelector('esm-instruction')
            .appendChild(document.createElement('esm-instruction-page'));
        page.appendChild(this._advisorIntroSpeechPage(advisor));
        page.classList.add('temporary');
        page.dataset.minTime = this.minAdvisorIntroPanelTime.toString();

        return new Promise(function (resolve) {
            let data = [];
            DatesStudyHybrid._updateInstructions(templateId,
                (name) => {
                    let now = new Date().getTime();
                    data.push({
                        name,
                        now
                    });
                    if (name === "exit")
                        resolve(data);
                });
        });
    }

    async _introduceHybrids(advisors, resolve) {
        const templateId = 'instr-hybrid-advisor-intro';
        const content = document.getElementById(templateId).content;

        // Strip old entries
        content.querySelectorAll('.temporary')
            .forEach(e => e.remove());

        // Remind us of the previous advisors.
        let index = content.querySelector('.advisor-reminder-general');
        for (const a of advisors) {
            if (/Hybrid/.test(a.constructor.name))
                continue;
            const page = document.createElement('esm-instruction-page');
            page.appendChild(this._advisorIntroSpeechPage(a));
            page.dataset.minTime = this.minAdvisorIntroPanelTime.toString();
            page.classList.add('temporary');
            index.after(page);
            index = page;
        }

        // Show a side-by-side comparison of the advisors along with the participant's scorecard
        const compare = document.createElement('esm-instruction-page');
        compare.appendChild(document.importNode(
            document.getElementById('scorecard-compare').content,
            true
        ));
        const bar = compare.querySelector('.scorecard');
        for (const a of advisors.filter(a => !/Hybrid/.test(a.constructor.name)))
            bar.appendChild(a.getScorecard(a.introScores));
        bar.appendChild(Advisor.makeScorecard(
            this.trials.filter(t => t.data.block === 0)
        ));
        index.after(compare);

        // Inject the hybrid's portrait
        const hybrid = advisors.filter(a => /Hybrid/.test(a.constructor.name))[0];
        content.querySelector('.advisor-hybrid-description .response-marker').innerHTML =
            hybrid.image().outerHTML;

        return new Promise(function (resolve) {
            let data = [];
            DatesStudyHybrid._updateInstructions(templateId,
                (name) => {
                    let now = new Date().getTime();
                    data.push({
                        name,
                        now
                    });
                    if (name === "exit")
                        resolve(data);
                });
        });
    }

    scorecard(parentElement, ) {
        const me = this;
        const sc = document.importNode(
            document.getElementById('scorecard').content,
            true);
        const bar = sc.querySelector('.scorecard');
        bar.appendChild(
            Advisor.makeScorecard(
                this.trials.filter(t => t.data.block === 0)
            )
        );
        // An advisor
        bar.appendChild(
            this.advisors[0].getScorecard(
                this.trials.filter(
                    t => t.data.advisor0id === me.advisors[0].id &&
                        typeof t.data.responseAnswerSideFinal !== "undefined"
                ))
        );
        // An advisor
        bar.appendChild(
            this.makeScorecard([
                    [1, 78], [1, 75], [1, 63],
                    [1, 58], [0, 46], [1, 37],
                    [0, 26], [1, 22], [0, 10]
                ],
                this.advisors[2])
        );

        const instr = document.getElementById('instructions');
        instr.classList.add('open');
        instr.innerHTML = sc.querySelector('esm-instruction').outerHTML;
    }

    toTable() {
        return {
            ...super.toTable(),
            minAdvisorIntroPanelTime: this.minAdvisorIntroPanelTime ?
                this.minAdvisorIntroPanelTime : null
        };
    }
}

export {DatesStudyHybrid};