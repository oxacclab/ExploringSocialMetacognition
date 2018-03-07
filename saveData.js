function processData(data) {
    // Data about the participant
    let participantData = {
        id: data.participantId,
        blockCount: data.blockCount,
        blockLength: data.blockLength,
        catchPerBlock: data.blockStructure[0],
        forcePerBlock: data.blockStructure[1],
        choicePerBlock: data.blockStructure[2],
        practiceBlockCount: data.practiceBlockCount,
        practiceBlockLength: data.practiceBlockLength,
        practiceCatchPerBlock: data.practiceBlockStructure[0],
        practiceForcePerBlock: data.practiceBlockStructure[1],
        practiceChoicePerBlock: data.practiceBlockStructure[2],
        difficultyStep: data.difficultyStep,
        dotCount: data.dotCount,
        preTrialInterval: data.preTrialInterval,
        preStimulusInterval: data.preStimulusInterval,
        stimulusDuration: data.stimulusDuration,
        feedbackDuration: data.feedbackDuration,
        timeStart: data.timeStart,
        timeEnd: data.timeEnd,
        experimentDuration: data.timeEnd - data.timeStart
    };

    // Advisor data
    let advisorData = [];
    for (let a=0; a<data.advisors.length; a++)
        advisorData.push(flattenAdvisorData(data.advisors[a], participantData.id));
    participantData.advisors = advisorData;

    // Questionnaires
    let questionnaireData = [];
    for (let q=0; q<data.questionnaires.length; q++)
        questionnaireData.push(flattenQuestionnaireData(data.questionnaires[q], participantData.id))
    participantData.questionnaires = questionnaireData;

    // Trials
    let trialData = [];
    for (let t=0; t<data.trials.length; t++)
        trialData.push(flattenTrialData(data.trials[t], participantData.id));
    participantData.trials = trialData;
    return participantData;
}

/** Return a trial squeezed into a format suitable for saving as .csv
 * @param {ESM.Trial} trial - trial object to squeeze
 * @param {int} id - id of the participant (inserted as first column)
 */
function flattenTrialData(trial, id) {
    let out = {};
    out.participantId = id;
    out.id = trial.id;
    out.block = trial.block;
    out.practice = trial.practice;
    out.type = trial.type;
    out.typeName = trial.typeName;
    out.correctAnswer = trial.whichSide;
    out.initialAnswer = trial.answer[0];
    out.finalAnswer = trial.answer[1];
    out.initialConfidence = trial.confidence[0];
    out.finalConfidence = trial.confidence[1];
    out.confidenceCategory = trial.confidenceCategory;
    out.hasChoice = !!trial.choice.length;
    out.choice0 = trial.choice.length? trial.choice[0] : null;
    out.choice1 = trial.choice.length? trial.choice[1] : null;
    out.advisorId = trial.advisorId;
    out.advisorAgrees = trial.advisorAgrees;
    if (trial.advisorId !== 0)
        out.adviceSide = trial.advisorAgrees? trial.whichSide : 1-trial.whichSide;
    else
        out.adviceSide = null;
    out.feedback = trial.feedback;
    out.warnings = trial.warnings.join("\n");
    // timings
    if (trial.pluginResponse.length > 0) {
        // initial decision
        out.timeInitialStart = trial.pluginResponse[0].startTime;
        out.timeInitialFixation = trial.fixationDrawTime[0];
        out.timeInitialStimOn = trial.stimulusDrawTime[0];
        out.timeInitialStimOff = trial.pluginResponse[0].startTime + trial.pluginResponse[0].stimulusOffTime;
        out.timeInitialResponse = trial.pluginResponse[0].startTime + trial.pluginResponse[0].rt;
        if (trial.pluginResponse.length === 3) {
            // advice and final decision
            // advice
            out.durationAdvisorChoice = trial.pluginResponse[1].choiceTime;
            out.durationAdviceDuration = trial.pluginResponse[1].adviceTime;
            // final decision
            out.timeFinalStart = trial.pluginResponse[2].startTime;
            out.timeFinalFixation = trial.fixationDrawTime[0];
            out.timeFinalStimOn = trial.stimulusDrawTime[0];
            out.timeFinalStimOff = trial.pluginResponse[2].startTime + trial.pluginResponse[2].stimulusOffTime;
            out.timeFinalResponse = trial.pluginResponse[2].startTime + trial.pluginResponse[2].rt;
        }
    }
    out.adviceString = typeof trial.advice==='undefined'? "" : trial.advice.string;

    return out;
}

/**
 * Extract the key variables from the advisor object
 * @param {ESM.Advisor} data - advisor object
 * @param {int} id - id of the participant (inserted as first column)
 * @returns {Object} - slim representation of advisor object
 */
function flattenAdvisorData(data, id) {
    let out = {};
    out.participantId = id;
    out.id = data.id;
    out.adviceType = data.adviceType;
    out.name = data.name;
    out.portraitSrc = data.portraitSrc;
    out.voiceId = data.voice.id;
    return out;
}

/**
 * Extract the key variables from the quesitonnaire object
 * @param {Object[]} Q - questionnaire
 * @param {int} id - id of the participant (inserted as first column)
 * @returns {Object} - slim representation of advisor object
 */
function flattenQuestionnaireData(Q, id) {
    let out = {};
    out.participantId = id;
    out.advisorId = Q.advisorId;
    out.afterTrial = Q.afterTrial;
    out.timeStart = Q.startTime;
    out.timeResponseStart = Q.responseStartTime;
    out.timeEnd = Q.time_elapsed;
    out.duration = Q.rt;
    for(let r=0; r < Q.response.length; r++) {
        switch(Q.response[r].name) {
            case 'Likeability':
                out.likeability = parseInt(Q.response[r].answer);
                break;
            case 'Benevolence':
                out.benevolence = parseInt(Q.response[r].answer);
                break;
            case 'Ability':
                out.ability = parseInt(Q.response[r].answer);
                break;
        }
    }
    return out;
}
