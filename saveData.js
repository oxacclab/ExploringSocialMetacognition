let srv = require('http');
let express = require("express");
let bodyParser = require("body-parser");
let cors = require('cors');
let fs = require('fs');
let url = require('url');
let path = require('path');

// app server
srv.createServer(function(request, response) {

    let uri = url.parse(request.url).pathname
    let filename = path.join(process.cwd(), uri);

    fs.exists(filename, function(exists) {
        if(!exists) {
            response.writeHead(404, {"Content-Type": "text/plain"});
            response.write("404 Not Found\n");
            response.end();
            return;
        }

        if (fs.statSync(filename).isDirectory()) filename += '/index.html';

        fs.readFile(filename, "binary", function(err, file) {
            if(err) {
                response.writeHead(500, {"Content-Type": "text/plain"});
                response.write(err + "\n");
                response.end();
                return;
            }

            response.writeHead(200);
            response.write(file, "binary");
            response.end();
        });
    });
}).listen(8080);

console.log("HTTP server initialized");


// Backend listener
let app = express();
app.use(bodyParser.json({limit: '16mb'}));
app.use(cors());

let corsOptions = {
    origin: 'http://localhost:8080',
    optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
};


app.post('/saveData.js', cors(corsOptions), function(request, response)
{
    console.log("---Data incoming---");
    let id = request.body.participantId;
    // Check existence of raw data file
    fs.open('ExploringSocialMetacognition/data/raw/'+id+'_RAW.JSON', 'wx', (err) => {
        if (err) {
            if (err.code === 'EEXIST') {
                console.error('File already exists: ExploringSocialMetacognition/data/raw/'+id+'_RAW.JSON');
                response.writeHead(500, {"Content-Type": "text/plain"});
                response.write("500 Server error (could not write data to disk)\n");
                response.end();
                return;
            }
            throw err;
        }
        // write RAW data
        fs.writeFile('ExploringSocialMetacognition/data/raw/'+id+'_RAW.JSON', JSON.stringify(request.body), function (err) {
            if (err) {
                // tell the user we couldn't save their data
                console.log(err);
                response.writeHead(500, {"Content-Type": "text/plain"});
                response.write("500 Server error (could not write data to disk)\n");
                response.end();
                throw err;
            }   else {
                console.log('Saved raw data for '+id); // send an okay response
                // Write PROCESSED data (don't check existence first)
                fs.writeFile('ExploringSocialMetacognition/data/processed/'+id+'_processed.JSON',
                    JSON.stringify(processData(request.body)),
                    function (err) {
                        if (err) {
                            // tell the user we couldn't save their data
                            console.log(err);
                            response.writeHead(500, {"Content-Type": "text/plain"});
                            response.write("500 Server error (could not write data to disk)\n");
                            response.end();
                            throw err;
                        }   else {
                            console.log('Saved processed data for '+id); // send an okay response
                            response.write("Processed data saved.\n");
                        }
                        response.end();
                    });
            }

        });
    });

}).listen(3000);

console.log("Backend listener initialized");

function processData(data) {
    // Data about the participant
    let participantData = {
        id: (new Date).getTime(),
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
    out.timeStart = Q.startTime;
    out.timeResponseStart = Q.responseStartTime;
    out.timeEnd = Q.time_elapsed;
    out.duration = Q.rt;
    for(let r=0; r < Q.response.length; r++) {
        switch(Q.response[r].name) {
            case 'Likeability':
                out.likeability = Q.response[r].answer;
                break;
            case 'Benevolence':
                out.benevolence = Q.response[r].answer;
                break;
            case 'Ability':
                out.ability = Q.response[r].answer;
                break;
        }
    }
    return out;
}
