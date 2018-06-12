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
$err = "";

if(!is_numeric($id))
    $err = "ID '$id' not found.";

$path = "data/raw/".strval(round(abs($id))).".JSON";

if(!is_file($path))
    $err = "Could not find results for ID '$id'.";

$file = fopen($path, 'r');
if(gettype($file) != 'resource')
    $err = "Could not retrieve results for ID '$id'.";

if($err == "")
    $json = file_get_contents($file);

if($json == false)
    $err = "Failed to read results for ID '$id'.'";

fclose($file);

?>
<!DOCTYPE html>
<html>
<head>
    <title>Feedback: Advisor Choice</title>

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
        <p><?php echo $err; ?></p>
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
    import {AdvisorChoice} from "../src/advisorChoiceDefs.js";
    let gov = AdvisorChoice(<?php echo $json; ?>);
    gov.endExperiment();
</script>
</html>
