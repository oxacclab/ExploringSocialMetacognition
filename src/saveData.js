/**
 * Exploring Social Metacognition - data processing
 * Matt Jaquiery, Feb 2018
 *
 */

"use strict";

import {Trial, Advisor, Cue} from "./exploringSocialMetacognition.js";

export default function processData(data, test = false) {
    // Data about the participant
    let participantData = {
        id: data.participantId,
        blockCount: data.blockCount,
        blockLength: data.blockLength,
        catchPerBlock: data.blockStructure[0],
        forcePerBlock: data.blockStructure[1],
        choicePerBlock: data.blockStructure[2],
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
        changeDuration: data.changeTime,
        timeStart: data.timeStart,
        timeEnd: data.timeEnd,
        experimentDuration: data.timeEnd - data.timeStart,
        manipulationQuestion: data.debrief.manipulationQuestion,
        debriefComments: data.debrief.comments
    };

    if(test)
        return participantData;

    // Advisor data
    let advisorData = [];
    if(typeof data.advisors !== 'undefined')
        for (let a=0; a<data.advisors.length; a++)
            advisorData.push(flattenAdvisorData(data.advisors[a], participantData.id));
    if(typeof data.practiceAdvisors !== 'undefined')
        for(let a = 0; a < data.practiceAdvisors.length; a++)
            advisorData.push(flattenAdvisorData(data.practiceAdvisors[a], participantData.id));
    participantData.advisors = advisorData;

    // Questionnaires
    let questionnaireData = [];
    if(typeof data.questionnaires !== 'undefined')
        for (let q=0; q<data.questionnaires.length; q++)
            questionnaireData.push(flattenQuestionnaireData(data.questionnaires[q], participantData.id))
    participantData.questionnaires = questionnaireData;

    // Trials
    let trialData = [];
    for (let t=0; t<data.trials.length; t++)
        trialData.push(flattenTrialData(data.trials[t], participantData.id));
    participantData.trials = trialData;

    // Generalized trust questionnaire
    participantData.generalisedTrustQuestionnaire = flattenGTQ(data.generalisedTrustQuestionnaire, participantData.id);

    return participantData;
}

/** Return a trial squeezed into a format suitable for saving as .csv
 * @param {Trial} trial - trial object to squeeze
 * @param {int} id - id of the participant (inserted as first column)
 * @returns {Object} - slim representation of trial object
 */
function flattenTrialData(trial, id) {
    let out = {};
    out.participantId = id;
    out.id = trial.id;
    out.block = trial.block;
    out.practice = trial.practice;
    out.type = trial.type;
    out.typeName = trial.typeName;
    out.dotDifference = trial.dotDifference;
    out.correctAnswer = trial.whichSide;
    out.initialAnswer = trial.answer[0];
    out.finalAnswer = trial.answer[1];
    out.initialConfidence = trial.confidence[0];
    out.finalConfidence = trial.confidence[1];
    out.confidenceCategory = trial.confidenceCategory;
    if(trial.choice !== null) {
        out.hasChoice = !!trial.choice.length;
        out.choice0 = trial.choice.length? trial.choice[0] : null;
        out.choice1 = trial.choice.length? trial.choice[1] : null;
    } else {
        out.hasChoice = null;
        out.choice0 = null;
        out.choice1 = null;
    }

    out.advisorId = trial.advisorId;
    out.advisorAgrees = trial.advisorAgrees;
    if (trial.advice !== null) {
        out.adviceSide = trial.advice.side;
        out.adviceString = trial.advice.string;
    }
    else {
        out.adviceSide = null;
        out.adviceString = null;
    }
    // and for individual advisors in the dual advice paradigm
    for(let i = 0; i < 2; i++) {
        let index = 'advisor' + i.toString();
        out[index + 'id'] = trial[index + 'id'];
        if(trial[index + 'advice'] === null) {
            out[index + 'adviceSide'] = null;
            out[index + 'agrees'] = null;
            out[index + 'adviceString'] = null;
        } else {
            out[index + 'adviceSide'] = trial[index + 'advice'].side;
            out[index + 'agrees'] = trial[index + 'agrees'];
            out[index + 'adviceString'] = trial[index + 'adviceString'];
        }
    }
    out.defaultAdvisor = trial.defaultAdvisor;

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

    return out;
}

/**
 * Extract the key variables from the advisor object
 * @param {Advisor} data - advisor object
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
    out.styleClass = data.styleClass;
    out.advisorClass = data instanceof Cue? "Cue" : "Advisor";
    return out;
}

/**
 * Extract the key variables from the questionnaire object
 * @param {Object[]} Q - questionnaire
 * @param {int} id - id of the participant (inserted as first column)
 * @returns {Object} - slim representation of questionnare object
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

/**
 * Extract the key variables from the trust questionnaire object
 * @param {Object[]} Q - trust questionnaire
 * @param {int} id - id of the participant (inserted as first column)
 * @returns {Object} - slim representation of trust questionnare object
 */
function flattenGTQ(Q, id) {
    let out = [];
    for(let r=0; r < Q.response.length; r++) {
        out[r] = {
            participantId: id,
            timeStart: Q.startTime,
            timeResponseStart: Q.responseStartTime,
            timeEnd: Q.time_elapsed,
            duration: Q.rt
        };
        out[r].order = Q.response[r].id;
        out[r].answer = Q.response[r].answer;
        out[r].prompt = Q.response[r].prompt;
        out[r].lastChangedTime = Q.response[r].lastChangedTime;
    }
    return out;
}