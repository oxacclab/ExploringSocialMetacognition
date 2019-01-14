<!DOCTYPE html>
<html>
<head>
    <title>Feedback: DotTask</title>
    <?php
/**
 * Created by PhpStorm.
 * User: Matt Jaquiery
 * Date: 11/06/2018
 * Time: 23:10
 *
 * Fetch JSON data from the filesystem and return it to the requester.
 */


/** https://stackoverflow.com/questions/2982059/testing-if-string-is-sha1-in-php
 * @param {string} $str - string to test
 * @return bool - true if $str is a viable sha1 string
 */
function is_sha1($str) {
    return (bool) preg_match('/^[0-9a-f]{40}$/i', $str);
}

$id = $_GET["id"];
$err = "";
$filename = array();
$json = false;
$file = null;

if(!preg_match('/^[a-z0-9\-]*_?[0-9a-f]{40}$/i', $id))
    $err = "ID '$id' not found.";

$path = "data".DIRECTORY_SEPARATOR."raw".DIRECTORY_SEPARATOR;

if(!is_readable($path))
    $err = "Could not find results director.";
else {
    $filenames = scandir($path);
    $filename = preg_grep("/$id.JSON/", $filenames);
}

if(count($filename) < 0)
    $err = "Could not find results file for '$id'.";
else
    $filename = array_pop($filename);

if($err == "")
    $json = file_get_contents($path.$filename);

if($json == false)
    $err = "Failed to read results for ID '$id'.";

?>

    <script src="https://www.gstatic.com/charts/loader.js"></script>

    <link rel="stylesheet" href="https://mjaquiery.github.io/jsPsych/css/jspsych.css"/>
    <link rel="stylesheet" href="../style/confidenceSliders.css"/>
    <link rel="stylesheet" href="../style/feedbackStyle.css"/>
    <link rel="stylesheet" href="../style/debriefForm.css"/>
</head>
<body>
<div style="max-width:50vw; text-align:center; margin:auto; top:45vh; position:relative;">
    <?php
    if($err != "") {
        ?>
        <h1>Error!</h1>
        <p><?php echo $err."<br/>".realpath($path)."<br/>".intval(filesize($file))." bytes"; ?></p>
</div>
</body>
</html>
        <?php
        die();
    }
    ?>
    <h1>Loading...</h1>
    <p>If you continue to see this message after a couple of seconds something has gone wrong. Results display best in a modern browser with javascript enabled, and may not display on older browsers or if javascript is disabled.</p>
</div>
</body>
<script type="module">
    import {DotTask} from "../src/advisorChoiceDefs.js";
    window.gov = new DotTask(<?php echo $json; ?>);
    window.gov.endExperiment(false);
</script>
</html>
