<?php
/**
 * Created by PhpStorm.
 * User: Matt Jaquiery
 * Date: 06/03/2018
 * Time: 10:28
 *
 */

/** https://stackoverflow.com/questions/2982059/testing-if-string-is-sha1-in-php
 * @param {string} $str - string to test
 * @return bool - true if $str is a viable sha1 string
 */
function is_sha1($str) {
    return (bool) preg_match('/^[0-9a-f]{40}$/i', $str);
}

$json = $_POST["data"];
$data = json_decode($json);
$raw = json_decode($data->rawData);
$processed = json_decode($data->processedData);
$id = $raw->participantId;
$prefix = $raw->experimentCode;

// Experiment name is the last directory
$experimentName = basename(pathinfo($_SERVER['HTTP_REFERER'], PATHINFO_DIRNAME));
// Whitelist for experiment names:
$experimentNames = array("AdvisorChoice", "DotTask");

$out = array(
    "error" => "",
    "code" => 200,
    "content" => $id
);

//$out['debug'] = basename($_SERVER['HTTP_REFERER']);

if (!is_sha1($id)
    || !in_array($experimentName, $experimentNames, true)
    || !preg_match("/^[a-z0-9\-]+$/i", $prefix)) {
    $out['error'] = 'Refused';
    $out['code'] = 403;
    $out['content'] = "Invalid ID specified '$id'";
    die(json_encode($out));
}

$fname = "$experimentName/data/raw/".$prefix."_$id.JSON";
if (file_exists($fname)) {
    $out['error'] = 'File exists';
    $out['code'] = 500;
    $out['content'] = '';
    die(json_encode($out));
}
$file = fopen($fname, 'w');
if (gettype($file) !== 'resource') {
    $out['error'] = 'Unable to create file';
    $out['code'] = 500;
    $out['content'] = '';
    die(json_encode($out));
}
fwrite($file, json_encode($raw));
fclose($file);

$fname = "$experimentName/data/processed/".$prefix."_$id.JSON";
// A file exists check is unlikely to trigger given the cleanup script which tarballs and compresses everything daily
$file = fopen($fname, 'w');
if (gettype($file) !== 'resource') {
    $out['error'] = 'Unable to store processed data';
    $out['code'] = 500;
    $out['content'] = '';
    die(json_encode($out));
}
fwrite($file, json_encode($processed));
fclose($file);

echo json_encode($out);
