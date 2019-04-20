<?php
/**
 * Created by PhpStorm.
 * User: Matt Jaquiery
 * Date: 19/03/2019
 * Time: 10:28
 *
 */

/*
The $_POST[] array will contain a JSON string which decomposes into:
{
    idCode: public participant identifier
    studyId: study identifier
}

A JSON string is returned with all of the data recorded for that participant:
{
    error: description of any error which occurred,
    code: response code,
    content: trial data in JSON string
}

*/

error_reporting(0);
//ini_set("display_errors", true);
ini_set("auto_detect_line_endings", true);

function sulk($err, $code) {
    $out = array(
        "error" => $err,
        "code" => $code,
    );
    die(json_encode($out));
}

// Unpack POST data
$json = json_decode(file_get_contents("php://input"), true);

$eid = (string) $json["studyId"];
$pid = (string) $json["idCode"];
$tid = (string) $_GET["tbl"];
$version = (string) $json["version"];
$version = str_replace(".", "-", $version);

// Check input is valid
function is_alphanumeric($str, $allowHyphen = false) {
    if($allowHyphen)
        return (bool) preg_match('/^[0-9a-z\-]+$/i', $str);
    return (bool) preg_match('/^[0-9a-z]+$/i', $str);
}

if(!is_alphanumeric($tid))
    sulk("Bad table request '$tid'.", 403);

if(strlen($version) && !is_alphanumeric($version, true))
    sulk("Invalid version format '$version'.", 403);

if(!is_alphanumeric($eid, true)) {
    sulk("Invalid study id '$eid'.", 403);
}

if(strlen($version))
    $dataFileName = "./data/public/" .$eid . "_v" . $version. "_" . $tid . ".csv";
else
    $dataFileName = "./data/public/" .$eid . "_trialStream.csv";

// Create trialStream.csv file if necessary
if(!file_exists($dataFileName)) {
    sulk("Unknown study id '$eid'.", 500);
}

if($eid == "dateCheck" && !strlen($version))
    $needle = "id";
else
    $needle = "pid";

$myData = array();
// Load trial data
if(($handle = fopen($dataFileName, "rb")) !== false) {
    $index = -1;
    $fields = array();
    while(($line = fgetcsv($handle)) !== false) {
        if($index === -1) {
            $fields = $line;
            if(in_array($needle, $line))
                $index = array_search($needle, $line, true);
            else
                sulk("No id field found in data.", 500);
        }
        if($line[$index] === $pid) {
            $data = array();
            for($i = 0; $i < count($line); $i++) {
                $data[$fields[$i]] = $line[$i];
            }
            array_push($myData, $data);
        }
    }
} else
    sulk("Unable to save result.", 500);

// Send back the all clear
die(json_encode(array(
    "error" => "",
    "code" => 200,
    "content" => json_encode($myData)
)));
