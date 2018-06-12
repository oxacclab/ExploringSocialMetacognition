<?php
/**
 * Created by PhpStorm.
 * User: Matt Jaquiery
 * Date: 11/06/2018
 * Time: 23:10
 *
 * Fetch JSON data from the filesystem and return it to the requester.
 */
$id = $_GET["id"];
if(!is_numeric($id))
    die(json_encode(array("error" => "Invalid ID provided \'$id\'")));

$path = "data/$id.JSON";
if(!is_file($path))
    die(json_encode(array("error" => "Could not find data for ID \'$id\'")));

if($file = fopen($path, 'r') == false)
    die(json_encode(array("error" => "Could not open file for ID \'$id\'")));

echo file_get_contents($file);

fclose($file);