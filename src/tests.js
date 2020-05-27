/** Summary functions
 *  Matt Jaquiery, May 2020
 */

/**
 * Generate the advice that would be given for each trial in the study
 * @param [advisor=null] {object|null} advisor whose advice to use. Null for all advisors
 * @param [etc={}] {object|null} object whose properties will be prepended to each entry of out
 * @return {object[]} list of objects representing sparse data about trial, advisor, advice
 */
function seeAllAdvice(advisor = null, etc = {}) {
    const study = window.study;
    const trials = study.trials.filter(t => !t.attentionCheck);
    advisor = advisor || study.advisors;

    if(!advisor.length)
        advisor = [advisor];

    const json = [];
    advisor.forEach(a => {
        for(let t = 0; t < trials.length; t++) {
            json.push({
                ...etc,
                studyName: study.studyName,
                trialNumber: t,
                blockNumber: trials[t].block,
                blockType: trials[t].blockType,
                correctAnswer: trials[t].correctAnswer,
                correctAnswerSide: trials[t].data.correctAnswerSide,
                ...a,
                ...a.getAdvice(trials[t]),
                adviceProfile: null,
                blueprint: null,
                log: null,
                lastAdvice: null
            });
        }
    });

    return json;
}

async function generateAdviceSets(n = 1000) {
    const out = [];
    for(let i = 0; i < n; i ++) {
        // Refresh the study
        await study.setupTrials();
        out.push(...seeAllAdvice(null, {iteration: i}));
    }
    return out;
}

export {seeAllAdvice, generateAdviceSets}