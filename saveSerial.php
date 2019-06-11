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
    metadata: {
        fileName: name of the CSV file to save to (e.g. "participant-metadata")
        isPublic: (boolean) whether to put the file in the private/ or public/ folder
        studyId: study identifier (becomes eid below)
        studyVersion: study version string
    },
    data {
        ...: key-value pairs for writing to the file
    }


}

Data are tagged with an experiment ID code (eid) and a sequential ID code
(pid; unique within experiment). This links the private (meta) data with the
public advisors and trials data.

Data are saved in the ./data/ directory into a private/ or public/ folder as specified in the incoming data.

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

/**
 * Return the experimental condition
 * @param $n {int} subject number (nth)
 * @param $conditions {int} number of conditions
 * @param $subjects {int} total subjects required
 *
 * @return {int} condition for assigning subject to
 */
function getCondition($n, $conditions, $subjects) {
    // Generate the sequence of conditions

    // ensure we have can balance conditions and subjects by increasing total subjects if necessary
    if($subjects % $conditions)
        $subjects = $conditions * (ceil($subjects / $conditions));

    $nPerCondition = $subjects / $conditions;


    $map = array();

    // 0 refers to no condition, so start a 1
    for($i = 1; $i <= $conditions; $i++)
        for($j = 0; $j < $nPerCondition; $j++)
            array_push($map, $i);

    // very important we use the same seed each time!
    srand(20190528);
    shuffle($map);

    // recycle values if n > subjects
    $n = $n % $subjects;

    return (int) $map[$n];
}

// Unpack POST data
$json = json_decode(file_get_contents("php://input"), true);

$meta = $json["metadata"];
$data = json_decode($json["data"], true);

$public = (boolean) $meta["isPublic"];
$tid = (string) $meta["fileName"];
$eid = (string) $meta["studyId"];
$version = (string) $meta["studyVersion"];
$version = str_replace(".", "-", $version);

// Check input is valid
function is_alphanumeric($str, $allowHyphen = false) {
    if($allowHyphen)
        return (bool) preg_match('/^[0-9a-z\-]+$/i', $str);
    return (bool) preg_match('/^[0-9a-z]+$/i', $str);
}

if(!is_bool($public))
    $public = false;

if(!is_alphanumeric($version, true))
    sulk("Invalid version format '$version'.", 403);

if(!is_alphanumeric($tid, true))
    sulk("Invalid table name '$tid'.", 403);

if(!is_alphanumeric($eid, true)) {
    sulk("Invalid studyId '$eid'.", 403);
}

const PATH = "./data/";
$privacy = $public? "public" : "private";
$prefix = $eid . "_v" . $version;
$filename = PATH . $privacy . "/" . $prefix . "_" . $tid . ".csv";

$pid = 0;

// Initial responses will have a prolificId and will require an id to be assigned
if(array_key_exists("prolificId", $data)) {

    $data["pid"] = "awaiting";
    $data["serverTime"] = date('c');

    if(!file_exists($filename)) {
        if(($handle = fopen($filename, "wb")) !== false) {
            fputcsv($handle, array_keys($data));
        } else
            sulk("Unable to create metadata file.", 500);
    }

    // work out the id
    if(($handle = fopen($filename, 'rb')) !== false) {
        $existingIds = array();

        $index = -1;
        while(($line = fgetcsv($handle)) !== false) {
            // first row: get the index of the pid field
            if($index == -1)
                $index = array_search("pid", $line, true);
            else
                array_push($existingIds, $line[$index]);
        }
        fclose($handle);

        $i = 0;
        do {
            $pid = substr(md5($prefix.$i++), 0, 8);
        } while(in_array($pid, $existingIds));

        if($index == -1)
            sulk("No id field found in previous results.", 500);

    } else
        sulk("Unable to read existing data for id assignment.", 500);


    $data["pid"] = $pid;

    // record in the metadata file
    if(($handle = fopen($filename, "ab")) !== false) {
        fputcsv($handle, $data);
    } else
        sulk("Unable to save metadata.", 500);

    // We also record the id we're assigning in a public-facing file which tells the curious about the kind of participants creating the data
    $metaFile = PATH."/public/".$prefix."_metadata.csv";
    if(!file_exists($metaFile)) {
        if(($handle = fopen($metaFile, "a+b")) !== false) {
            // Write headers
            fputcsv($handle, array("pid", "tags", "uidHash", "condition"));
        }
    }

    // Collate tags
    $tags = array();

    // Prolific
    if(preg_match("/^[0-9a-f]{24}$/i", $data["prolificId"])) {
        array_push($tags, "prolific");
        array_push($tags, "paid");
    }

    if(preg_match("/test/i", $data["prolificId"])) {
        array_push($tags, "test");
    }

    if(preg_match("/(\+1|%2B1)$/i", $data["prolificId"])) {
        array_push($tags, "plus1");
    }

    $tags = join(", ", $tags);

    // Count previous entries for randomisation
    // Separate counts for un/paid participants
    if(!isset($data["condition"]) || !$data["condition"]) {
        $nLines = 0;
        $handle = fopen($metaFile, "rb");
        $paid = in_array("paid", explode(", ", $tags));
        $tagsIndex = -1;
        while($data = fgetcsv($handle)) {
            if($tagsIndex === -1) {
                $tagsIndex = array_search("tags", $data);
                if($tagsIndex === false)
                    break;
            }
            elseif (in_array("paid",
                explode(", ", $data[$tagsIndex])) === $paid)
                $nLines++;
        }
    }

    if(($handle = fopen($metaFile, "a+b")) !== false) {

        $hash = md5($prefix . "_" . $pid);

        if(isset($data["condition"]) && $data["condition"])
            $condition = $data["condition"];
        else
            $condition = getCondition($nLines,
                $meta["conditions"], $meta["N"]);

        // Write data
        fputcsv($handle, array($pid, $tags, $hash, $condition));
    }


    die(json_encode(
        array("id" => $pid,
            "tags" => $tags,
            "uidHash" => $hash,
            "condition" => $condition
        )));
}

// Create file if necessary
if(!file_exists($filename)) {
    if(($handle = fopen($filename, "wb")) !== false) {
        fputcsv($handle, array_keys($data));
    } else
        sulk("Unable to create file.", 500);
}

// Save data
if(($handle = fopen($filename, "ab")) !== false) {
    fputcsv($handle, $data);
} else
    sulk("Unable to save result.", 500);

// Send back the all clear
die(json_encode(array(
    "error" => "",
    "code" => 200,
    "content" => "Data saved successfully."
)));
