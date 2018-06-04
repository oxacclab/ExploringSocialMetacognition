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
            let type = filename.split('.');
            type = type[type.length - 1];
            switch(type) {
                case "html":
                case "htm":
                    type = 'text/html';
                    break;
                case "css":
                    type = 'text/css';
                    break;
                case "js":
                    type = 'application/javascript';
                    break;
                default:
                    type = 'text/plain';
            }
            response.writeHead(200, {'Content-Type': type});
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

/*app.post('/server.js', cors(corsOptions), function (request, response) {
    eval(fs.readFileSync('ExploringSocialMetacognition/saveData.js').toString()); // include saveData.js
    let raw = request.body;
    let processed = processData(raw);
    let id = raw.participantId;
    fs.writeFile('ExploringSocialMetacognition/data/raw/'+id+'_RAW.JSON', JSON.stringify(raw), function(){});
    fs.writeFile('ExploringSocialMetacognition/data/processed/'+id+'_processed.JSON', JSON.stringify(processData(processed)), function(){});
}).listen(3000);*/

app.post('/server.js', cors(corsOptions), function(request, response)
{
    let raw = JSON.parse(request.body.rawData);
    let processed = JSON.parse(request.body.processedData);
    console.log("---Data incoming---");
    let id = raw.participantId;
    console.log('ID: '+id.toString());
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
        fs.writeFile('ExploringSocialMetacognition/data/raw/'+id+'_RAW.JSON', JSON.stringify(raw), function (err) {
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
                    JSON.stringify(processed),
                    function (err) {
                        if (err) {
                            // tell the user we couldn't save their data
                            console.log(err);
                            response.writeHead(500, {"Content-Type": "text/plain"});
                            response.write("500 Server error (could not write data to disk)\n");
                            response.end();
                        }   else {
                            console.log('Saved processed data for '+id); // send an okay response
                            response.write("Processed data saved.\n");
                        }
                        response.end();
                    });
            }
        });
    });
});

app.get('/feedback/:uid', function(req, res) {
    let uid = parseInt(req.params['uid']);
    console.log('Serving feedback request for ' + uid);
    let path = 'ExploringSocialMetacognition/data/raw/'+uid+'_RAW.JSON';
    fs.open(path, 'r', (err, fd) => {
        if (err) {
            if (err.code === 'ENOENT') {
                console.log(err);
                res.writeHead(404, {"Content-Type": "text/plain"});
                res.write("404 Requested results not found\n");
                res.end();
                return;
            }
            throw err;
        }
        let stream = fs.createReadStream(null,{fd});
        stream.pipe(res).on('end',res.end);
    });
});

app.listen(3000);

console.log("Backend listener initialized");

