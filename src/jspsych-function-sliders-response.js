/**
 * jspsych-function-sliders-response
 *
 * jsPsych plugin for free response to questions presented using a function.
 * This version uses multiple sliders to record responses. All
 * slider values will be included in the final data.
 * Sliders can be designated into groups of various kinds. These groups specify
 * which sliders need to be moved before the trial can be completed, and
 * which sliders get reset when other sliders are moved. E.g. one may want to
 * give a participant a split confidence scale where a response is required on
 * one of two sliders (but not both). Setting these two sliders to have the
 * same require_change group and the same exclusive_group identifier will
 * accomplish this.
 *
 * The stimulus is a function called by the plugin. This function is provided a
 * callback which it should execute when the trial is ready to begin. The callback
 * may be given an argument which will be stored as response.stimulus_properties
 *
 * Matt Jaquiery - https://github.com/mjaquiery/ - Feb 2018
 *
 * documentation: docs.jspsych.org
 *
 */


jsPsych.plugins['function-sliders-response'] = (function() {

    let plugin = {};

    plugin.info = {
        name: 'function-sliders-response',
        description: 'Collect multiple slider responses to stimuli '+
        'drawn using a function',
        parameters: {
            stimulus: {
                type: jsPsych.plugins.parameterType.FUNCTION,
                pretty_name: 'Stimulus',
                default: undefined,
                description: 'The function to be called to produce the stimulus. '+
                'This should handle drawing operations.'
            },
            prompt: {
                type: jsPsych.plugins.parameterType.STRING,
                pretty_name: 'Prompt',
                default: null,
                description: 'Content to display below the stimulus.'
            },
            sliderCount: {
                type: jsPsych.plugins.parameterType.INT,
                pretty_name: 'Slider count',
                default: undefined,
                description: 'Number of sliders to draw.'
            },
            min: {
                type: jsPsych.plugins.parameterType.INT,
                pretty_name: 'Min slider',
                default: [0],
                array: true,
                description: 'Sets the minimum value of the sliders. '+
                'Format is an array of length sliderCount. '+
                'Shorter arrays will be padded with the final value.'
            },
            max: {
                type: jsPsych.plugins.parameterType.INT,
                pretty_name: 'Max slider',
                default: [100],
                array: true,
                description: 'Sets the maximum value of the sliders. '+
                'Format is an array of length sliderCount. '+
                'Shorter arrays will be padded with the final value.'
            },
            reversed: {
                type: jsPsych.plugins.parameterType.BOOL,
                pretty_name: 'Reverse scored',
                default: [false],
                array: true,
                description: 'Reverse scored sliders have their answer '+
                'reported as max-answer rather than as simply answer. '+
                'Format is an array of length sliderCount. '+
                'Shorter arrays will be padded with the final value.'
            },
            start: {
                type: jsPsych.plugins.parameterType.INT,
                pretty_name: 'Slider starting value',
                default: [50],
                array: true,
                description: 'Sets the starting value of the sliders. '+
                'Format is an array of length sliderCount. '+
                'Shorter arrays will be padded with the final value.'
            },
            step: {
                type: jsPsych.plugins.parameterType.INT,
                pretty_name: 'Step',
                default: [1],
                array: true,
                description: 'Sets the step of the sliders. '+
                'Format is an array of length sliderCount. '+
                'Shorter arrays will be padded with the final value.'
            },
            labels: {
                type: jsPsych.plugins.parameterType.COMPLEX,
                pretty_name:'Labels',
                default: [[]],
                array: true,
                description: 'Labels of the sliders. '+
                'Format is an array of length sliderCount. '+
                'Shorter arrays will be padded with the final value. '+
                'Each array entry must be an array of strings for the labels '+
                'which apply to that slider.'
            },
            require_change: {
                type: jsPsych.plugins.parameterType.INT,
                pretty_name: 'Require change',
                default: [0],
                array: true,
                description: 'Whether one of these sliders must have been changed '+
                'before a response is accepted. Format is an array of ints, where '+
                'non-zero ints specify slider sets. At least one slider in each '+
                'set must be changed before the response is accepted.'
            },
            require_change_warning: {
                type: jsPsych.plugins.parameterType.HTML_STRING,
                pretty_name: 'Require change warning',
                default: ['<p class="jspsych-function-sliders-response" style="color: red;">'+
                'At least one of the bars must have been moved to continue.'
                +'</p>'],
                array: true,
                description: 'HTML to display when not enough sliders have been '+
                'moved to continue',
            },
            slider_arrangement: {
                type: jsPsych.plugins.parameterType.INT,
                pretty_name: 'Slider arrangement',
                default: null,
                array: true,
                description: 'Sliders with the same slider arrangement value '+
                'will be placed on the same row, with those appearing first '+
                'placed to the left of those appearing later.'
            },
            slider_prompt: {
                type: jsPsych.plugins.parameterType.STRING,
                pretty_name: 'Prompt',
                default: null,
                array: true,
                description: 'Any content here will be displayed below the sliders. '+
                'Format is an array of length sliderCount. '+
                'Shorter arrays will be padded with the final value.'
            },
            slider_name: {
                type: jsPsych.plugins.parameterType.STRING,
                pretty_name: 'Slider name',
                default: [null],
                array: true,
                description: 'Name of the slider (used in the results reporting'+
                    ' only). Sliders with missing values in this array will not'+
                    ' have a name associated with them in the results.'
            },
            slider_col_spacing: {
                type: jsPsych.plugins.parameterType.INT,
                pretty_name: 'Slider column spacing',
                default: [25],
                array: true,
                description: 'Spacing between columns within each row of sliders. '+
                'Added as a margin to the left and right of each slider. '+
                'Each entry in the array refers to an individual row. '+
                'Shorter arrays will be padded with the final value.'
            },
            exclusive_group: {
                type: jsPsych.plugins.parameterType.INT,
                pretty_name: 'Exclusive slider response group',
                default: [0],
                description: 'Whether changing one slider resets the other sliders '+
                'in this group to their starting values. Group 0 are not exclusive'
            },
            slider_full_width: {
                type: jsPsych.plugins.parameterType.BOOL,
                pretty_name: 'Slider occupies full label width',
                array: true,
                default: [false],
                description: 'Whether the slider occupies the full width allowed (true) or ' +
                'is truncated so that the labels are centered on the ends of the slider (false).' +
                ' Padded with final value.'
            },
            slider_class_touched: {
                type: jsPsych.plugins.parameterType.STRING,
                pretty_name: 'Slider class (touched)',
                default: ['jspsych-sliders-response-slider-touched'],
                array: true,
                description: 'Class to apply to a slider when changed. Applied within an exclusive_group.'
            },
            slider_class_untouched: {
                type: jsPsych.plugins.parameterType.STRING,
                pretty_name: 'Slider class (untouched)',
                array: true,
                default: ['jspsych-sliders-response-slider-untouched'],
                description: 'Class to apply to a slider when reset. Applied within an exclusive_group.'
            },
            max_warnings: {
                type: jsPsych.plugins.parameterType.INT,
                pretty_name: 'Maximum warnings',
                array: false,
                default: 0,
                description: 'Maximum require_change_warnings to display at any one time. Prioritises ' +
                    'require_change_warning sliders with lower numbers.'
            },
            check_response: {
                type: jsPsych.plugins.parameterType.FUNCTION,
                pretty_name: 'Check response',
                default: null,
                description: 'This function is called with the candidate response data. '+
                'It should return true to allow the submission or false to prevent it.'
            },
            button_label: {
                type: jsPsych.plugins.parameterType.STRING,
                pretty_name: 'Button label',
                default:  'Continue',
                array: false,
                description: 'Label of the button to advance.'
            },
            stimulus_duration: {
                type: jsPsych.plugins.parameterType.INT,
                pretty_name: 'Stimulus duration',
                default: null,
                description: 'How long to hide the stimulus.'
            },
            trial_duration: {
                type: jsPsych.plugins.parameterType.INT,
                pretty_name: 'Trial duration',
                default: null,
                description: 'How long to show the trial.'
            },
            response_ends_trial: {
                type: jsPsych.plugins.parameterType.BOOL,
                pretty_name: 'Response ends trial',
                default: true,
                description: 'If true, trial will end when user makes a response.'
            },
            special_class_names: {
                type: jsPsych.plugins.parameterType.STRING,
                pretty_name: 'Special class name',
                default: [],
                array: true,
                description: 'Class names to be added to all elements created by this plugin. ' +
                    'This class can be used to differentiate different trials or uses of the pluging ' +
                    'for CSS styling purposes.'
            }
        }
    };

    plugin.trial = function(display_element, trial) {

        let response = {
            startTime: performance.now(),
            responseStartTime: null,
            rt: null,
            response: null,
            stimulus_properties: null
        };

        // Draw the stimulus
        if (typeof trial.stimulus !== 'function') {
            console.error('jspsych-function-sliders-response: stimulus property must be a function. Ending trial.');
            return end_trial();
        }
        let div = document.createElement('div');
        div.id = 'jspsych-function-sliders-response-stimulus';
        div.classList.add('jspsych-function-sliders-response');
        display_element.appendChild(div);
        trial.stimulus(div, do_trial);

        function do_trial(stimulusSaveData) {
            if (typeof stimulusSaveData !== 'undefined')
                response.stimulus = stimulusSaveData;
            response.responseStartTime = performance.now();

            let html = '<div id="jspsych-function-sliders-response-wrapper"' +
                'class="jspsych-function-sliders-response jspsych-sliders-response-wrapper">';
            // Prompt text
            if (trial.prompt !== null) {
                html = html + '<div id="jspsych-sliders-response-prompt" class="jspsych-function-sliders-response"' +
                    '>' + trial.prompt + '</div>';
            }
            // Sliders
            // Define the sliders
            const sliders = [];
            let max_slider_row = null;
            for (let i=0; i<trial.sliderCount; i++) {
                sliders.push({
                    min: (trial.min.length > i)? trial.min[i] :
                        trial.min[trial.min.length-1],
                    max: (trial.max.length > i)?  trial.max[i] :
                        trial.max[trial.max.length-1],
                    reversed: (trial.reversed.length > i)? trial.reversed[i] :
                        trial.reversed[trial.reversed.length-1],
                    start: (trial.start.length > i)? trial.start[i] :
                        trial.start[trial.start.length-1],
                    step: (trial.step.length > i)? trial.step[i] :
                        trial.step[trial.step.length-1],
                    labels: (trial.labels.length > i)? trial.labels[i] :
                        trial.labels[trial.labels.length-1],
                    require_change: (trial.require_change.length > i)?
                        trial.require_change[i] :
                        trial.require_change[trial.require_change.length-1],
                    require_change_warning: (trial.require_change_warning.length > i)?
                        trial.require_change_warning[i] :
                        trial.require_change_warning[trial.require_change_warning.length-1],
                    exclusive_group: (trial.exclusive_group.length > i)?
                        trial.exclusive_group[i] :
                        trial.exclusive_group[trial.exclusive_group.length-1],
                    slider_full_width: (trial.slider_full_width.length > i)?
                        trial.slider_full_width[i] :
                        trial.slider_full_width[trial.slider_full_width.length-1],
                    name: (typeof trial.slider_name[i] === 'undefined')?
                        null : trial.slider_name[i]
                });
                let slider = sliders.pop();
                if (trial.slider_arrangement !== null) {
                    slider.arrangement = (trial.slider_arrangement.length > i)?
                        trial.slider_arrangement[i] :
                        trial.slider_arrangement[trial.slider_arrangement.length-1];
                    if (max_slider_row === null || slider.arrangement > max_slider_row) {
                        max_slider_row = slider.arrangement;
                    }
                } else {
                    slider.arrangement = 0;
                }
                if (trial.slider_prompt !== null) {
                    slider.prompt = (trial.slider_prompt.length > i)?
                        trial.slider_prompt[i] :
                        trial.slider_prompt[trial.slider_prompt.length-1];
                } else {
                    slider.prompt = "";
                }
                if (trial.slider_class_touched !== null) {
                    slider.class_touched = (trial.slider_class_touched.length > slider.exclusive_group)?
                        trial.slider_class_touched[slider.exclusive_group] :
                        trial.slider_class_touched[trial.slider_class_touched.length-1];
                } else {
                    slider.class_touched = null;
                }
                if (trial.slider_class_untouched !== null) {
                    slider.class_untouched = (trial.slider_class_untouched.length > slider.exclusive_group)?
                        trial.slider_class_untouched[slider.exclusive_group] :
                        trial.slider_class_untouched[trial.slider_class_untouched.length-1];
                } else {
                    slider.class_untouched = null;
                }
                slider.changedTime = NaN;
                sliders.push(slider)
            }
            let row_count = (max_slider_row === null)? 1 : max_slider_row+1;
            html += '<div class="jspsych-function-sliders-response jspsych-sliders-response-container">';
            // Loop the rows of sliders
            for (let i=0; i<row_count; i++) {
                let col = 0;
                html += '<div id="jspsych-sliders-response-slider-row'+i+'" class="'+
                    'jspsych-function-sliders-response jspsych-sliders-row">';
                for(let s=0; s<sliders.length; s++) {
                    let slider = sliders[s];
                    if (max_slider_row === null || slider.arrangement === i) {
                        // Draw the slider
                        let colCount = slider.labels.length * 2;
                        let tdWidth = 100/colCount;
                        html += '<div id="jspsych-sliders-response-slider-col'+
                            col+'" class="jspsych-function-sliders-response jspsych-sliders-col">';
                        // Draw sliders in tables because rigid formatting is important here
                        html += '<table id="jspsych-sliders-response-table'+s+
                            '" class="jspsych-function-sliders-response jspsych-sliders-table">';
                        // prompt
                        html += '<tr class="jspsych-function-sliders-response jspsych-sliders-prompt">'+
                            '<td colspan="'+colCount+
                            '" style="width: 100%;" id="jspsych-sliders-response-slider-prompt'+s+
                            '" class="jspsych-function-sliders-response jspsych-sliders-prompt">'+
                            slider.prompt+'</td></tr>';
                        // slider
                        let spacer = '';
                        if(colCount!==2 && slider.slider_full_width === false)
                            spacer = '<td class="jspsych-function-sliders-response jspsych-sliders-spacer"' +
                            'style="width: '+tdWidth.toString()+
                                '%;"></td>';
                        let colSpan = colCount/2;
                        if(colCount===2)
                            colSpan = 2;
                        else if(slider.slider_full_width === true)
                            colSpan = colCount;
                        html += '<tr class="jspsych-function-sliders-response jspsych-sliders-slider">'+
                            spacer+
                            '<td colspan="'+(colSpan).toString()+'" style="width: '+(tdWidth*colSpan).toString()+'%;" '+
                            'class="jspsych-function-sliders-response jspsych-sliders-slider"' +
                            ' id="jspsych-function-sliders-response-sliderCell'+s+'"'+
                            ' ><input type="range" value="'+slider.start+
                            '" min="'+slider.min+'" max="'+slider.max+
                            '" step="'+slider.step+'" '+
                            'id="jspsych-function-sliders-response-slider'+s+'" '+
                            'class="jspsych-function-sliders-response jspsych-sliders-response-slider"/></td>'+
                            spacer+
                            '</tr>';
                        // labels
                        html += '<tr id="jspsych-function-sliders-response-labels'+s
                            +'" class="jspsych-function-sliders-response jspsych-sliders-response-labels">';
                        for(let j=0; j < slider.labels.length; j++){
                            let width = 100/slider.labels.length;
                            let left_offset = j * width;
                            let widthStr = (j === slider.labels.length-1)?
                                "" : 'width: '+(100/slider.labels.length).toString()+'%;';
                            html += '<td colspan="2" style="width: '+(tdWidth*2).toString()+
                                '%;" class="jspsych-function-sliders-response jspsych-sliders-response-label"'+
                                ' id="jspsych-function-sliders-response-labelS'+s+'L'+j+'">';
                            html += '<span class="jspsych-function-sliders-response jspsych-sliders-response-label">'+
                                slider.labels[j]+'</span>';
                            html += '</td>'
                        }
                        html += '</tr>';
                        html += '</table>';
                        html += '</div>';
                        col++;
                    }
                }
                html += '</div>';
                html += '<div id="jspsych-function-sliders-row-divider-'+i
                    +'" class="jspsych-function-sliders-response jspsych-sliders-row-divider"></div>';
            }
            html += '</div>';

            // warning area if sliders are missed
            html += '<div id="jspsych-function-sliders-response-warnings" ' +
                'class="jspsych-function-sliders-response"></div>';

            // add submit button
            html += '<button id="jspsych-function-sliders-response-next" ' +
                'class="jspsych-function-sliders-response jspsych-btn">'+trial.button_label+'</button>';

            // basic styling
            html += '<style type="text/css">table.jspsych-sliders-table {width: 100%}'+
                'div.jspsych-sliders-row {display: inline-flex; width: 100%}'+
                'div.jspsych-sliders-col {width: 100%}</style>';

            display_element.innerHTML += html + '</div>';

            // Add the custom class to the elements created by this plugin
            if(trial.special_class_names !== []) {
                document.querySelectorAll('.jspsych-function-sliders-response').forEach(
                    (elm)=>{trial.special_class_names.forEach(
                        (myClass)=>{elm.classList.add(myClass)}
                    )}
                );
            }

            // Swap the touched and reset classes on the slider
            function swapClass(el, classIn, classOut) {
                let cls = el.className;
                if (classIn !== null && cls.search(classIn) === -1) {
                    cls += cls[cls.length-1]===' '? classIn : ' '+classIn;
                }
                if (classOut !== null && cls.search(classOut) !== -1) {
                    cls = cls.replace(classOut, '');
                }
                el.className = cls;
                return el;
            }

            // Add listeners to the sliders
            function onSliderChange() {
                let slider = {};
                for (let i=0; i<sliders.length; i++) {
                    let id = 'jspsych-function-sliders-response-slider'+i;
                    if (id===this.id) {
                        slider = sliders[i];
                        swapClass(this, slider.class_touched, slider.class_untouched);
                        slider.changedTime = performance.now();
                        break;
                    }
                }
                if(slider.exclusive_group !== 0) {
                    swapSliderChangeFunction(true);
                    for (let i=0; i<sliders.length; i++) {
                        let id = 'jspsych-function-sliders-response-slider'+i;
                        if (id !== this.id &&
                            slider.exclusive_group === sliders[i].exclusive_group) {
                            let other = display_element.querySelector('#'+id);
                            other.value = sliders[i].start;
                            swapClass(other, slider.class_untouched, slider.class_touched);
                        }
                    }
                    swapSliderChangeFunction();
                }
            }

            function swapSliderChangeFunction(remove=false) {
                for (let i=0; i<sliders.length; i++) {
                    let s = display_element.querySelector('#jspsych-function-sliders-response-slider'+i);
                    if (remove) {
                        s.removeEventListener('change', onSliderChange);
                        s.removeEventListener('click', onSliderChange);
                    } else {
                        s.addEventListener('change', onSliderChange);
                        s.addEventListener('click', onSliderChange);
                    }
                }
            }

            swapSliderChangeFunction();

            display_element.querySelector('#jspsych-function-sliders-response-next').addEventListener('click', function() {
                // Validate the sliders (did they move everything they were supposed to?)
                let groups = [];
                let warnings = [];
                for (let i=0; i<sliders.length; i++) {
                    let slider = sliders[i];
                    if (slider.require_change !== 0) {
                        if (!isNaN(slider.changedTime)) {
                            // this group is okay!
                            groups.push(slider.require_change);
                        } else {
                            // note the warning string
                            warnings[slider.require_change] = slider.require_change_warning;
                            // limit the warnings according to max_warnings
                            if (Object.keys(warnings).length === trial.max_warnings)
                                break;
                        }
                    }
                }
                let halt = false;
                let warn_html = '';
                warnings.forEach(function (w,i) {
                    if (groups.indexOf(i) === -1) {
                        // not moved sliders in this group yet
                        halt = true;
                        warn_html += w;
                    }
                });
                // Issue the warnings
                if (halt) {
                    display_element.querySelector('#jspsych-function-sliders-response-warnings').innerHTML = warn_html;
                    return;
                }
                // measure response time
                response.rt = performance.now() - response.responseStartTime;
                let answers = [];
                for (let i=0; i<sliders.length; i++) {
                    let value = display_element.querySelector('#jspsych-function-sliders-response-slider'+i).value;
                    let slider = sliders[i];
                    slider.value = slider.reversed? slider.max - value : value;
                    answers.push({
                        id: i,
                        name: slider.name,
                        answer: slider.value,
                        prompt: slider.prompt,
                        lastChangedTime: slider.changedTime
                    });
                }
                response.response = answers;

                if(trial.response_ends_trial){
                    end_trial();
                } else {
                    display_element.querySelector('#jspsych-function-sliders-response-next').disabled = true;
                }

            });

            if (trial.stimulus_duration !== null) {
                jsPsych.pluginAPI.setTimeout(function() {
                    display_element.querySelector('#jspsych-function-sliders-response-stimulus').style.visibility = 'hidden';
                    response.stimulusOffTime = performance.now() - response.startTime;
                }, trial.stimulus_duration);
            }

            // end trial if trial_duration is set
            if (trial.trial_duration !== null) {
                jsPsych.pluginAPI.setTimeout(function() {
                    end_trial();
                }, trial.trial_duration);
            }
        }

        function end_trial(){

            // save data
            let trialdata = {
                "startTime": response.startTime,
                "responseStartTime": response.responseStartTime,
                "rt": response.rt,
                "response": response.response,
                "stimulus_properties": response.stimulus_properties
            };

            let okay = false;
            if(trial.check_response === null)
                okay = true;
            else
                okay = trial.check_response(trialdata);

            if(okay === false)
                return;

            jsPsych.pluginAPI.clearAllTimeouts();

            if(trial.stimulus_duration !== null)
                trialdata.stimulusOffTime = response.stimulusOffTime;

            display_element.innerHTML = '';

            // next trial
            jsPsych.finishTrial(trialdata);
        }
    };

    return plugin;
})();
