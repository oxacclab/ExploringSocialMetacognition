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
    static _advisorIntroSpeechPage(advisor, templateId = 'advisor-intro-speech') {
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
        page.appendChild(DatesStudyHybrid._advisorIntroSpeechPage(advisor));
        page.classList.add('temporary');
        page.dataset.minTime = this.minAdvisorIntroPanelTime.toString();

        return new Promise(function (resolve) {
            let data = [];
            Study._updateInstructions(templateId,
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
            page.appendChild(DatesStudyHybrid._advisorIntroSpeechPage(a));
            page.dataset.minTime = this.minAdvisorIntroPanelTime.toString();
            page.classList.add('temporary');
            index.after(page);
            index = page;
        }

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

    static get listPhases() {
        return [
            "splashScreen",
            "consent",
            "demographics",
            "practice",
            "_makeScorecard"
        ];
    }

    _makeScorecard() {
        const sc = document.importNode(
            document.getElementById('scorecard').content,
            true);
        const bar = sc.querySelector('.scorecard');
        bar.appendChild(
            this.makeScorecard(
                this.trials.filter(
                    t => typeof t.data.responseAnswerSide !== "undefined"
                )
            )
        );
        // An advisor
        bar.appendChild(
            this.makeScorecard([
                    [1, 98], [1, 95], [1, 80],
                    [1, 78], [0, 72], [1, 70],
                    [0, 69], [1, 66], [0, 53]
                ],
                this.advisors[0])
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

    /**
     * Show a scorecard indicating which questions were answered correctly ordered by the confidence of the answers.
     * @param trials {Trial[]|number[][]} either a list of trials or a list of 2-item lists with [0] correctness {binary} [1] confidence {numeric}
     * @param advisor {Advisor|null} Advisor whose advice is being presented, or null for the participant
     * @return {HTMLElement}
     */
    makeScorecard(trials, advisor = null) {
        const sc = document.importNode(
            document.getElementById('scorecard-content').content,
            true);
        // Set avatar
        if (advisor) {
            sc.querySelector('.scorecard-avatar div').innerHTML = advisor.name;
            sc.querySelector('.scorecard-avatar img').src = advisor.svg;
        } else {
            sc.querySelector('.scorecard-avatar div').innerHTML = "You";
            sc.querySelector('.scorecard-avatar img').src = "../assets/image/you.svg";
        }
        const bar = sc.querySelector('.response-column-inner');
        trials.forEach(t => {
            const elm = bar.appendChild(document.createElement('span'));
            elm.classList.add('star');
            let correct;
            if (!t.data)
                correct = t[0];
            else if (t.data.responseAnswerSideFinal)
                correct = t.data.responseAnswerSideFinal === t.data.correctAnswerSide;
            else
                correct = t.data.responseAnswerSide === t.data.correctAnswerSide;
            if (correct) {
                elm.classList.add('correct');
                elm.innerHTML = "&#10004;";
            } else {
                elm.classList.add('incorrect');
                elm.innerHTML = "&#10007;";
            }
            if (!t.data)
                elm.style.bottom = `${t[1]}%`;
            else
                elm.style.bottom = `${t.data.responseConfidenceFinal || t.data.responseConfidence}%`;
            elm.style.transform = `translate(${Math.random() * 100 - 50}%, 50%)`;
        });

        return sc;
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