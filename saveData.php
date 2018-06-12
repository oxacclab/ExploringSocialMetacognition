<?php
/**
 * Created by PhpStorm.
 * User: Matt Jaquiery
 * Date: 06/03/2018
 * Time: 10:28
 *
 */
$raw = $_POST["rawData"];
$pro = $_POST["processedData"];
$obj = json_decode($pro);

$out = array(
    "error" => "",
    "code" => 200,
    "content" => $obj['participantId']
);

if (!is_numeric($obj['participantId'])) {
    $out['error'] = 'Refused';
    $out['code'] = 403;
    $out['content'] = '';
    die(json_encode($out));
}

$fname = '../raw_data/'.strval(intval($obj['participantId'])).'.JSON';
if (file_exists($fname)) {
    $out['error'] = 'File exists';
    $out['code'] = 500;
    $out['content'] = '';
    die(json_encode($out));
}
if ($file = fopen($fname, 'w') == false) {
    $out['error'] = 'Unable to create file';
    $out['code'] = 500;
    $out['content'] = '';
    die(json_encode($out));
}
fwrite($file, $raw);
fclose($file);

$fname = '../processed_data/'.strval(intval($obj['participantId'])).'.JSON';
// A file exists check is unlikely to trigger given the cleanup script which tarballs and compresses everything daily
if ($file = fopen($fname, 'w') == false) {
    $out['error'] = 'Unable to store processed data';
    $out['code'] = 500;
    $out['content'] = '';
    die(json_encode($out));
}
fwrite($file, $pro);
fclose($file);

echo json_encode($out);
