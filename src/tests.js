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
    const study = window.cy? cy.state('window').study : window.study;
    const trials = study.trials.filter(t => !t.attentionCheck);
    advisor = advisor || study.advisors;

    if(!advisor.length)
        advisor = [advisor];

    const json = [];
    advisor.forEach(a => {
        for(let t = 0; t < trials.length; t++) {
            const T = trials[t];
            json.push({
                ...etc,
                studyName: study.studyName,
                trialNumber: T.data.number,
                blockNumber: T.block,
                blockType: T.blockType,
                correctAnswer: T.correctAnswer,
                correctAnswerSide: T.data.correctAnswerSide,
                responseAnswerSide: T.data.responseAnswerSide,
                responseConfidence: T.data.responseConfidence,
                responseEstimateLeft: T.data.responseEstimateLeft,
                ...a,
                ...a.getAdvice(T),
                adviceProfile: null,
                blueprint: null,
                log: null,
                lastAdvice: null,
                _image: null
            });
        }
    });

    return json;
}

function setDummyAnswers(study) {
    study.trials.forEach(t => {
        //t.data.responseEstimateLeft = Math.floor(Math.random() * 100) + 1900;
        // use average participant accuracy for binary questions
        t.data.responseAnswerSide = Math.random() < .6?
            t.data.correctAnswerSide : 1 - t.data.correctAnswerSide;
    });
}

async function generateAdviceSets(n = 1000, dummyAnswers = false) {
    const out = [];
    for(let i = 0; i < n; i ++) {
        // Refresh the study
        await study.setupTrials();
        if(dummyAnswers)
            setDummyAnswers(study);
        out.push(...seeAllAdvice(null, {iteration: i}));
    }
    return out;
}

export {seeAllAdvice, generateAdviceSets}