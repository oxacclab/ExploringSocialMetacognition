/**
 * jspsych-jas-present-advice
 * Matt Jaquiery, Feb 2018
 *
 * plugin for presenting an image, optionally with sound and text, for a period of time
 *
 * documentation: docs.jspsych.org
 *
 **/

jsPsych.plugins["jspsych-jas-present-advice"] = (function() {

    let plugin = {};

    plugin.info = {
        name: 'jspsych-jas-present-advice',
        description: '',
        parameters: {
            displayImageFunction: {
                type: jsPsych.plugins.parameterType.FUNCTION,
                pretty_name: 'Display Image function',
                default: undefined,
                description: 'Function to display the image. Called with the id of a bounding div. Return value ' +
                    'is stored in the trial response.'
            },
            playAudioFunction: {
                type: jsPsych.plugins.parameterType.FUNCTION,
                pretty_name: 'Play Audio function',
                default: null,
                description: 'Function to play the audio. Return value stored in the trial response.'
            },
            prompt: {
                type: jsPsych.plugins.parameterType.STRING,
                pretty_name: 'Prompt',
                default: "",
                description: 'Any content here will be displayed under the image.'
            },
            trial_duration: {
                type: jsPsych.plugins.parameterType.INT,
                pretty_name: 'Trial duration',
                default: undefined,
                description: 'How long to show the trial.'
            },
        }
    };

    plugin.trial = function(display_element, trial) {

        // store response
        let response = {
            rt: null
        };

        if(typeof trial.displayImageFunction === 'undefined'){
            console.error('Required parameter "displayImageFunction" missing in jspsych-jas-present-advice');
        }

        // display stimulus
        let containerId = "jspsych-jas-present-advice-choice-image0";
        let classList = "jspsych-jas-present-advice-choice-image";
        let html = '<div id="'+containerId+'" class="'+classList+'"></div>';

        //show prompt if there is one
        html += '<div id="jspsych-jas-present-advice-choice-prompt0" ' +
            'class="jspsych-jas-present-advice-choice-prompt jspsych-jas-present-advice-prompt">'+trial.prompt+'</div>';

        display_element.innerHTML = html;

        response.image = trial.displayImageFunction(containerId);
        // short out if the trial.displayImageFunction returned '-1'
        if (response.image === -1) {
            end_trial();
            return;
        }

        if (typeof trial.playAudioFunction === "function")
            response.audio = trial.playAudioFunction();

        // start timing
        let start_time = performance.now();

        // function to end trial when it is time
        function end_trial() {
            response.rt = performance.now() - start_time;

            // kill any remaining setTimeout handlers
            jsPsych.pluginAPI.clearAllTimeouts();
            // clear the display
            display_element.innerHTML = '';

            // move on to the next trial
            jsPsych.finishTrial(response);
        }

        // end trial if time limit is set
        if (trial.trial_duration !== null) {
            jsPsych.pluginAPI.setTimeout(function() {
                end_trial();
            }, trial.trial_duration);
        }
    };

    return plugin;
})();