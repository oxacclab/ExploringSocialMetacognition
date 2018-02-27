//let http = require('http');
let express = require("express");
let bodyParser = require("body-parser");
let cors = require('cors');
let fs = require('fs');


console.log("server initialized");

let http = express();
http.use(bodyParser.json());
http.use(cors());

let corsOptions = {
    origin: 'http://localhost:8080',
    optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
};

http.post('/saveData.js', cors(corsOptions), function(request, response)
{
    console.log("Data recieved");
    let id = (new Date).getTime();
    request.body.participantId = id;
    fs.appendFile('participantData.JSON', JSON.stringify(request.body), function (err) {
        if (err) {
            // tell the user we couldn't save their data
            throw err;
        }
        // send an okay response
        console.log('Saved!');
    });

    /*// Data about the participant
    let participantData = {
        id: (new Date).getTime(),
        blockCount: response.body.blockCount,
        blockLength: response.body.blockLength,
        catchPerBlock: response.body.blockStructure[0],
        forcePerBlock: response.body.blockStructure[1],
        choicePerBlock: response.body.blockStructure[2],
        practiceBlockCount: response.body.practiceBlockCount,
        practiceBlockLength: response.body.practiceBlockLength,
        practiceCatchPerBlock: response.body.practiceBlockStructure[0],
        practiceForcePerBlock: response.body.practiceBlockStructure[1],
        practiceChoicePerBlock: response.body.practiceBlockStructure[2],
        difficultyStep: response.body.difficultyStep,
        dotCount: response.body.dotCount
    };
    for (let a=0; a<response.body.advisors.length; a++)
        participantData['advisor'+a.toString()] = response.body.advisors[a];

    // Participant's performance across trials
    let trialData = [];
    for (let t=0; t<response.body.trials.length; t++)
        trialData.push(flattenTrialData(response.body.trials[t]), participantData.id);
    */
}).listen(3000);

/** Return a trial squeezed into a format suitable for saving as .csv
 * @param {ESM.Trial} trial - trial object to squeeze
 * @param {int} id - id of the participant (inserted as first column)
 */
function flattenTrialData(trial, id) {
    let out = {
        participantId: id,
        trialId: id,
        advisorId: trial.advisorId,
        initialAnswer: trial.answer[0],
        finalAnswer: trial.answer[1],
        initialConfidence: trial.confidence[0],
        finalConfidence: trial.confidence[1],
        block: trial.block,
        practice: trial.practice,
        type: trial.type.toString() + ' (' + trial.typeName + ')',
        correctAnswer: trial.whichSide
    };
    // flatten arrays
    for (let c=0; c<trial.choice.length; c++)
        out['choice' + c.toString()] = trial.choice[c];

    return out;
}