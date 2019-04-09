<?php
/**
 * Created by PhpStorm.
 * User: Matt Jaquiery
 * Date: 19/03/2019
 * Time: 10:28
 *
 */

/*
The $_POST[] array will contain a JSON string which decomposes into either:
{
    studyId: study identifier (becomes eid below)
    prolificId: participant's prolific ID
}
{
    studyId: study identifier (becomes eid below). Contained in the study but
 included for simplicity of access. Alphanumeric only.
    various fields constituting a single trial for inclusion in a csv file
}

PRIVATE data must ONLY appear in the meta file. This is likely only to be the
 participant platform ID

Data are tagged with an experiment ID code (eid) and a sequential ID code
(pid; unique within experiment). This links the private (meta) data with the
public advisors and trials data.

Data are saved in the ./data/ directory as follows:
    [meta appended to] ./data/private/[eid]_participant-metadata.csv
    [trials appended to] ./data/public/[eid]_trialStream.csv

All .csv files have a header row containing the variable names. The headers
are assumed(!) to match within a given study eid.

An JSON string is returned with a unique participant id (for prolificId
registration), or the following properties:
{
    error: description of any error which occurred,
    code: response code,
    content: message
}

*/

//phpinfo();
error_reporting(0);
//ini_set("display_errors", true);
ini_set("auto_detect_line_endings", true);
$log = "";

function sulk($err, $code) {
    $out = array(
        "error" => $err,
        "code" => $code,
    );
    die(json_encode($out));
}

// Table id comes from GET
$tid = $_GET["tbl"];

// Unpack POST data
$json = json_decode(file_get_contents("php://input"), true);

$eid = (string) $json["studyId"];

// Check study ID is valid

function is_alphanumeric($str) {
    return (bool) preg_match('/^[0-9a-z]+$/i', $str);
}

if(!is_alphanumeric($eid)) {
    sulk("Invalid studyId '$eid'.", 403);
}

const PATH = "./data/";
$fileNames = array(
    "meta" => PATH . "private/" . $eid . "_participant-metadata.csv",
    "trials" => PATH . "public/" .$eid . "_trialStream.csv",
    "qualitative" => PATH . "private/" . $eid . "_qualitative-feedback.csv",
    "general" => PATH . "private/" . $eid . "_general-feedback.csv"
);

$pid = 0;

// Initial responses will have a prolificId
if(array_key_exists("prolificId", $json) && $tid === "participantMetadata") {
    if(!file_exists($fileNames["meta"])) {
        if(($handle = fopen($fileNames["meta"], "wb")) !== false) {
            fputcsv($handle, array("studyName", "time", "prolificId", "pid"));
        } else
            sulk("Unable to create metadata file.", 500);
    } else {
        // work out the id
        if(($handle = fopen($fileNames["meta"], 'rb')) !== false) {
            $existingIds = array();

            $index = -1;
            while(($data = fgetcsv($handle)) !== false) {
                // first row: get the index of the pid field
                if($index == -1)
                    $index = array_search("pid", $data, true);
                else
                    array_push($existingIds, $data[$index]);
            }
            fclose($handle);

            $i = 1679616;
            do {
                $pid = substr(md5($eid.$i++), 0, 8);
            } while(in_array($pid, $existingIds));

            if($index == -1)
                sulk("No pid field found in previous results.", 500);

        } else
            sulk("Unable to read existing data for pid assignment.", 500);
    }

    // record in the metadata file
    if(($handle = fopen($fileNames["meta"], "ab")) !== false) {
        fputcsv($handle, array($eid, date('c'), (string) $json["prolificId"],
            $pid));
    } else
        sulk("Unable to save metadata.", 500);

    die(json_encode(array("id" => $pid)));
}

$fname = "";
switch($tid) {
    case "qualitativeFeedback":
        $fname = $fileNames["qualitative"];
        break;
    case "trial":
        $fname = $fileNames["trials"];
        break;
    case "generalFeedback":
        $fname = $fileNames["general"];
        break;
    default:
        sulk("Uninterpretable metadata.", 403);
}

// Create file if necessary
if(!file_exists($fname)) {
    if(($handle = fopen($fname, "wb")) !== false) {
        fputcsv($handle, array_keys($json));
    } else
        sulk("Unable to create file.", 500);
}

// Save data
if(($handle = fopen($fname, "ab")) !== false) {
    fputcsv($handle, $json);
} else
    sulk("Unable to save result.", 500);

// Send back the all clear
die(json_encode(array(
    "error" => "",
    "code" => 200,
    "content" => "Data saved successfully."
)));
