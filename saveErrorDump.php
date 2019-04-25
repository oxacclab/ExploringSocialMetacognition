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
    metadata:
        studyId: study identifier (becomes eid below)
        studyVersion: study version
        idCode: participant id
        error: description of the error
    data:
        JSON string to write to file
}

Data are saved in the ./data/private/error directory

*/

//phpinfo();
error_reporting(0);
//ini_set("display_errors", true);
ini_set("auto_detect_line_endings", true);
$log = "";

// Unpack POST data
$json = json_decode(file_get_contents("php://input"), true);

$meta = $json["metadata"];
$data = $json["data"];

$error = (string) $meta["error"];
$eid = (string) $meta["studyId"];
$version = (string) $meta["studyVersion"];
$version = str_replace(".", "-", $version);
$pid = $meta["idCode"];
$userIssue = (boolean) $meta["userIssue"];

// Check input is valid
function is_alphanumeric($str, $allowHyphen = false) {
    if($allowHyphen)
        return (bool) preg_match('/^[0-9a-z\-]+$/i', $str);
    return (bool) preg_match('/^[0-9a-z]+$/i', $str);
}

if(!is_alphanumeric($version, true) ||
    !is_alphanumeric($pid) ||
    !is_alphanumeric($eid, true))
    die();

const PATH = "./data/private/error/";
$prefix = $eid . "_v" . $version;
$body = date('Y-m-d_H-i-s') . "_" . $prefix . "_" . $pid;
$suffix = $userIssue? "user-issue" : "error-dump";

$logPath = $userIssue? PATH . "issues.log" : PATH . "error.log";

$filename = PATH . $body . "_" . $suffix . ".json";

if(($handle = fopen($filename, "wb")) !== false)
    fwrite($handle, $data);

// Create/update error log
if(($handle = fopen(PATH . $logPath, "ab+")) !== false)
    fwrite($handle, "File: $filename; Error: $error" . PHP_EOL);