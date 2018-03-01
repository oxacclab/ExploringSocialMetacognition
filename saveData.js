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
app.use(bodyParser.json());
app.use(cors());

let corsOptions = {
    origin: 'http://localhost:8080',
    optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
};

app.post('/saveData.js', cors(corsOptions), function(request, response)
{
    console.log("Data recieved");
    console.log(request);
    let id = (new Date).getTime();
    request.body.participantId = id;
    fs.appendFile('ExploringSocialMetacognition/participantData.JSON', '\n\n'+JSON.stringify(request.body), function (err) {
        if (err) {
            // tell the user we couldn't save their data
            console.log(err);
            response.writeHead(500, {"Content-Type": "text/plain"});
            response.write("500 Server error (could not write data to disk)\n");
            response.end();
            throw err;
        }   else
            console.log('Saved data for '+id); // send an okay response
        response.writeHead(200, {"Content-Type": "text/plain"});
        response.write("Data saved.\n");
        response.end();
    });

    console.log(response);

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

console.log("Backend listener initialized");


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
