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
    studyId: study identifier (becomes eid below). Contained in the study but
 included for simplicity of access. Alphanumeric only.
    raw: a JSON-serialized Study object containing the full information about
 the task
    tables: {
        meta: [private participant data],
        study: [study csv row with headers],
        advisors: [advisor csv rows with headers],
        trials: [trials csv rows with headers]
    }
}

PRIVATE data must ONLY appear in the meta file. This is likely only to be the
 participant platform ID and debrief comments, but could be other info.

Data are tagged with an experiment ID code (eid) and a sequential ID code
(pid; unique within experiment). This links the private (meta) data with the
public advisors and trials data.

Data are saved in the ./data/ directory as follows:
    [raw created as] ./data/public/raw/yyyy-mm-dd_hh-mm_study-[eid]_pid-[pid]
.JSON
    [meta appended to] ./data/private/[eid]_participant-metadata.csv
    [study appended to] ./data/public/[eid]_study.csv
    [advisors appended to] ./data/public/[eid]_advisors.csv
    [trials appended to] ./data/public/[eid]_trials.csv

All .csv files have a header row containing the variable names. The headers
are assumed(!) to match within a given study eid.

An JSON string is returned with the following properties:
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

// Unpack POST data
$json = json_decode(file_get_contents("php://input"));

$eid = (string) $json->studyId;
$tables = (array) $json->tables;

$pid = 0;

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
    "study" => PATH . "public/" . $eid . "_study.csv",
    "advisors" => PATH. "public/" . $eid . "_advisors.csv",
    "trials" => PATH . "public/" .$eid . "_trials.csv"
);

// Create metadata file if necessary
foreach(array_keys($tables) as $table) {

    if(!file_exists($fileNames[$table])) {

        if(($handle = fopen($fileNames[$table], 'wb')) !== false) {
            // Insert ID columns
            array_unshift($tables[$table][0], "eid");
            array_unshift($tables[$table][0], "pid");

            fputcsv($handle, $tables[$table][0]);
            fclose($handle);
        } else {
            sulk("Unable to initialize results storage.", 500);
        }

    } elseif($table == "meta") {
        // Calculate the pid by searching for largest pid in metadata file

        if(($handle = fopen($fileNames[$table], 'rb')) !== false) {

            $index = -1;

            while(($data = fgetcsv($handle)) !== false) {
                // first row: get the index of the pid field
                if($index == -1)
                    $index = array_search("pid", $data, true);
                else {
                    if($data[$index] >= $pid)
                        $pid = $data[$index] + 1;
                }
            }
            fclose($handle);

            if($index == -1)
                sulk("No pid field found in previous results.", 500);

        } else
            sulk("Unable to read existing data for pid assignment.", 500);
    }
}


// Update the objects with the IDs
foreach(array_keys($tables) as $table) {
    $log .= "\n$table: ";

    // Get rid of the header row
    array_shift($tables[$table]);

    // Write to the file
    if(($handle = fopen($fileNames[$table], 'ab')) !== false) {

        foreach($tables[$table] as $row) {
            array_unshift($row, $eid);
            array_unshift($row, $pid);
            fputcsv($handle, $row);
            $log .= strval(count($row)) . " ";
        }
        fclose($handle);

    } else
        sulk("Unable to update $table results storage.", 500);

}

// Save the raw data file
// ./data/public/raw/yyyy-mm-dd_hh-mm_study-[eid]_pid-[pid].JSON
$fileNames["raw"] = PATH . "public/raw/" . date('Y-m-d_H-i-s') . "_study-" .
$eid . "_pid-" . $pid . ".JSON";
// Create the trials file
if(($handle = fopen($fileNames["raw"], 'wb')) !== false) {
    fputs($handle, json_encode($json->raw));
    fclose($handle);
} else
    sulk("Unable to save trial results for user ID $id.", 500);

// Send back the all clear
die(json_encode(array(
    "error" => "",
    "code" => 200,
    "content" => "Data saved successfully."
)));
