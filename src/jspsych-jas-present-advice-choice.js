/**
 * jspsych-jas-present-advice-choice
 * Matt Jaquiery, Feb 2018
 *
 * plugin for presenting an image, optionally with sound and text, for a period of time
 * In this version a choice function is called before the advice display function.
 *
 * documentation: docs.jspsych.org
 *
 **/

jsPsych.plugins["jspsych-jas-present-advice-choice"] = (function() {

    let plugin = {};

    plugin.info = {
        name: 'jspsych-jas-present-advice-choice',
        description: '',
        parameters: {
            choiceFunction: {
                type: jsPsych.plugins.parameterType.FUNCTION,
                pretty_name: 'Choice function',
                default: undefined,
                description: 'Function run to determine the choice made. All drawing etc. must be done by ' +
                    'the function in question.  This function will be called with a callback function and the ' +
                    'display element as arguments. The callback should be called with the choice as the only ' +
                    'argument. On a choice of -1 the plugin will end this trial immediately. ' +
                    'Any other return value will be stored in the trial response and passed to the ' +
                    'displayImageFunction and playAudioFunction.'
            },
            displayImageFunction: {
                type: jsPsych.plugins.parameterType.FUNCTION,
                pretty_name: 'Display Image function',
                default: undefined,
                description: 'Function to display the image. Called with the return value of choiceFunction ' +
                    'and the id of a bounding div. Return value ' +
                    'is stored in the trial response.'
            },
            playAudioFunction: {
                type: jsPsych.plugins.parameterType.FUNCTION,
                pretty_name: 'Play Audio function',
                default: null,
                description: 'Function to play the audio. Called with the return value of choiceFunction. ' +
                    'Return value stored in the trial response.'
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
            choiceTime: null,
            changeTimes: [],
            choice: null,
            totalTime: null
        };

        // start timing
        let start_time = performance.now();

        if (typeof trial.choiceFunction === 'undefined')
            console.error('Required parameter "choiceFunction" missing in jspsych-jas-present-advice-choice');

        trial.choiceFunction(display_element, run_trial);

        function run_trial(choice, changeTimes = []) {
            if(typeof trial.displayImageFunction === 'undefined'){
                console.error('Required parameter "displayImageFunction" missing in jspsych-jas-present-advice-choice');
            }

            response.changeTimes = changeTimes;
            // set change times to be relative to start_time
            if(response.changeTimes.length > 0)
                for(let i = 0; i < response.changeTimes.length; i++)
                    response.changeTimes[i] -= start_time;
            response.choice = choice;
            if (response.choice === -1)
                end_trial();
            else
                response.choiceTime = performance.now() - start_time;


            // display stimulus
            let containerId = "jspsych-jas-present-advice-choice-image0";
            let classList = "jspsych-jas-present-advice-choice-image";
            let html = '<div id="'+containerId+'" class="'+classList+'"></div>';

            //show prompt if there is one
            html += '<div id="jspsych-jas-present-advice-choice-prompt0" ' +
                'class="jspsych-jas-present-advice-choice-prompt">'+trial.prompt+'</div>';

            display_element.innerHTML = html;

            response.image = trial.displayImageFunction(response.choice, containerId);
            // short out if the trial.displayImageFunction returned '-1'
            if (response.image === -1) {
                end_trial();
                return;
            }

            if (typeof trial.playAudioFunction === "function")
                response.audio = trial.playAudioFunction(response.choice);

            // end trial if time limit is set
            if (trial.trial_duration !== null) {
                jsPsych.pluginAPI.setTimeout(function() {
                    end_trial();
                }, trial.trial_duration);
            }
        }

        // function to end trial when it is time
        function end_trial() {
            response.totalTime = performance.now() - start_time;
            response.adviceTime = response.totalTime - response.choiceTime;

            // kill any remaining setTimeout handlers
            jsPsych.pluginAPI.clearAllTimeouts();
            // clear the display
            display_element.innerHTML = '';

            // move on to the next trial
            jsPsych.finishTrial(response);
        }
    };

    return plugin;
})();