window.analysis = {
    /**
     * @class advisorChoice
     *
     * Functions pertaining to the advisorChoice experiment
     */
    advisorChoice: {
        /**
         * Return the overall accuracy of the judge
         *
         * @param {ESM.Trial[]} trials - trial list
         * @param {boolean} firstResponse - whether to query initial response rather than final response
         * @param {boolean} returnArray - whether to return an array with proportion hits, hits, and misses
         * @returns {number[]|number} - proportion of hits / total [, hits, misses]
         */
        overallAccuracy: function(trials, returnArray = false, firstResponse = true) {
            let hits = 0;
            let misses = 0;
            let i = firstResponse? 0 : 1;
            trials.forEach(function (trial) {
                if (typeof trial.answer[i] === 'undefined' || typeof trial.whichSide === 'undefined'
                    || isNaN(trial.answer[i]))
                    return;
                if (trial.answer[i] === trial.whichSide)
                    hits++;
                else
                    misses++;
            });
            // protect against div0 errors
            if (hits === 0 && misses === 0)
                return returnArray? [NaN] : NaN;
            if (misses === 0)
                return returnArray? [1, hits, misses] : 1;
            if (returnArray)
                return [hits/(hits+misses), hits, misses];
            else
                return hits/(hits+misses);
        },

        /**
         * Return accuracy summary broken down by decision
         * @param {ESM.Trial[]} trials - trial list
         * @returns {{initial: number[], final: number[], combined: number[]}}
         */
        accuracySummary: function(trials) {
            let initial = this.overallAccuracy(trials, true, true);
            let final = this.overallAccuracy(trials, true, false);
            let combined = [
                (initial[1]+final[1]) / (initial[1]+initial[2]+final[1]+final[2]),
                (initial[1]+final[1]),
                (initial[2]+final[2])
            ];
            return {initial, final, combined};
        },

        /**
         * Return the mean confidence of trials
         * @param {ESM.Trial[]} trials - trial list
         * @param {boolean} firstResponse - whether to extract the initial vs final response
         * @returns {number[]} - [mean, sum, count]
         */
        meanConfidence: function(trials, firstResponse = true) {
            let sum = 0;
            let count = 0;
            let i = firstResponse? 0 : 1;
            trials.forEach(function (trial) {
                if (typeof trial.confidence[i] === 'undefined' || isNaN(trial.confidence[i]))
                    return;
                sum += trial.confidence[i];
                count++;
            });
            if (count===0)
                return NaN;
            return [sum/count, sum, count];
        },

        /**
         * Get a summary of confidence for inital, final, and combined scores
         * @param {ESM.Trial[]} trials - trial list
         * @returns {{initial: number[], final: number[], combined: number[]}}
         */
        confidenceSummary: function(trials) {
              let initial = this.meanConfidence(trials, true);
              let final = this.meanConfidence(trials, false);
              let combined = [
                  (initial[1]+final[1] / (initial[1]+initial[2]+final[1]+final[2])),
                  (initial[1]+final[1]),
                  (initial[2]+final[2])
              ];
              return {initial, final, combined};
        },

        /**
         * Confidence broken down by whether the initial/final decision was in/correct
         * @param trials
         * @returns {{initial: {correct: *|{initial: number[], final: number[], combined: number[]}, incorrect: *|{initial: number[], final: number[], combined: number[]}}, final: {correct: *|{initial: number[], final: number[], combined: number[]}, incorrect: *|{initial: number[], final: number[], combined: number[]}}}}
         */
        confidenceBreakdown: function(trials) {
            let self = this;
            let initialCorrectTrials = analysis.getMatches(trials, function(trial) {
                return self.accuracySummary([trial]).initial[0] === 1;
            });
            let initialIncorrectTrials = analysis.getMatches(trials, function(trial) {
                return self.accuracySummary([trial]).initial[0] === 0;
            });
            let finalCorrectTrials = analysis.getMatches(trials, function(trial) {
                return self.accuracySummary([trial]).final[0] === 1;
            });
            let finalIncorrectTrials = analysis.getMatches(trials, function(trial) {
                return self.accuracySummary([trial]).final[0] === 0;
            });
            let correct = this.confidenceSummary(initialCorrectTrials);
            let incorrect = this.confidenceSummary(initialIncorrectTrials);
            let correctFinal = this.confidenceSummary(finalCorrectTrials);
            let incorrectFinal = this.confidenceSummary(finalIncorrectTrials);

            return {
                initial: {correct, incorrect},
                final: {correct: correctFinal, incorrect: incorrectFinal}
            };
        },

        /**
         * Return true if the advice offered on *trial* was correct
         * @param {ESM.Trial} trial
         * @returns {boolean}
         */
        isGoodAdvice: function (trial) {
            if (typeof trial.advisorAgrees === 'undefined' || typeof trial.whichSide === 'undefined'
                || typeof trial.answer === 'undefined' || isNaN(trial.answer[0]))
                return false;
            if (trial.answer[0] === trial.whichSide && trial.advisorAgrees)
                return true;
            if (trial.answer[0] !== trial.whichSide && !trial.advisorAgrees)
                return true;
            return false;
        },

        /**
         * Return the accuracy of the advisor
         * @param {ESM.Trial[]} trials - trial list
         * @param {int} advisorId - id of the advisor
         * @returns {number[]} - [mean accuracy, hits, misses]
         */
        advisorAccuracy: function (trials, advisorId) {
            let self = this;
            let hits = analysis.getMatches(trials, function(trial) {
                return (trial.advisorId === advisorId && self.isGoodAdvice(trial));
            }).length;
            let misses = analysis.getMatches(trials, function(trial) {
                return (trial.advisorId === advisorId && !self.isGoodAdvice(trial));
            }).length;

            if (misses === 0 && hits === 0)
                return [NaN, 0, 0];
            if (misses === 0)
                return [1, hits, misses];
            return [hits/(hits+misses), hits, misses];
        },

        /**
         * Return the influence rating of the advice on *trial*
         * @param {ESM.Trial} trial
         * @returns {number}
         */
        getInfluence: function(trial) {
            if (typeof trial.advisorId === 'undefined' || typeof trial.advisorAgrees === 'undefined'
                || typeof trial.confidence === 'undefined' || isNaN(trial.confidence[0]))
                return 0;
            // advisor agrees; influence is the increase in confidence
            if (trial.advisorAgrees)
                return trial.confidence[1] - trial.confidence[0];
            else if (trial.answer[0] === trial.answer[1]) {
                // advisor disagrees, and the answer stays the same. Influence is decrease in confidence
                return trial.confidence[0] - trial.confidence[1];
            } else {
                // advisor disagrees, answer has changed. Influence is new confidence + old confidence
                return trial.confidence[0] + trial.confidence[1];
            }
        },

        /**
         * Return the maximum influence the advisor could have had on *trial* given the initial confidence
         * @param {ESM.Trial} trial
         * @returns {number}
         */
        getMaxInfluence: function (trial) {
            if (typeof trial.advisorId === 'undefined' || typeof trial.advisorAgrees === 'undefined'
                || typeof trial.confidence === 'undefined' || isNaN(trial.confidence[0]))
                return 0;
            // advisor agrees; max influence 100-confidence
            if (trial.advisorAgrees)
                return 100 - trial.confidence[0];
            else // advisor disagrees; max influence is 100+confidence
                return 100 + trial.confidence[0];
        },

        /**
         * Return the portion of good advice utilized by the judge. Can be >1 if the judge disagrees on incorrect
         * advice trials (the 'max' simply ignores advice on incorrect trials).
         *
         * @param {ESM.Trials[]} trials - trial list
         * @param {int} advisorId - advisor id
         * @returns {number[]} - [influence/maxInfluence, influence, maxInfluence]
         */
        strategicAdviceUsage: function (trials, advisorId) {
            let self = this;
            let goodAdviceTrials = analysis.getMatches(trials, function(trial) {
                return trial.advisorId === advisorId && self.isGoodAdvice(trial);
            });
            let badAdviceTrials = analysis.getMatches(trials, function(trial) {
                return trial.advisorId === advisorId && !self.isGoodAdvice(trial);
            });
            let maxInfluence = 0;
            let influence = 0;
            // Judge accrues points for heeding good advice
            goodAdviceTrials.forEach(function (trial) {
                maxInfluence += self.getMaxInfluence(trial);
                influence += self.getInfluence(trial);
            });
            // Judge looses points for heeding bad advice
            badAdviceTrials.forEach(function (trial) {
                influence -= self.getInfluence(trial);
            });

            return [influence/maxInfluence, influence, maxInfluence];
        },

        adviceAnswerChanges: function (trials, advisorId) {
            let advisorChangedTrials = analysis.getMatches(trials, function (trial) {
                if (trial.advisorId !== advisorId)
                    return false;
                if (trial.answer[0] === trial.answer[1])
                    return false;
                return trial.advisorAgrees;
            });
            if (advisorChangedTrials.length === 0)
                return [NaN, 0, 0];
            let hits = analysis.getMatches(advisorChangedTrials, function(trial) {
                return trial.answer[1] === trial.whichSide;
            });
            let misses = advisorChangedTrials.length - hits.length;
            if (misses === 0)
                return [NaN, hits, misses];
            else
                return [hits/misses, hits, misses];
        },

        /**
         * Return the proportion of possible choices in which this advisor was chosen
         * @param {ESM.Trial[]} trials - trial list
         * @param {int} advisorId - id of the candidate advisor
         * @returns {number[]}
         */
        advisorChoiceRate: function (trials, advisorId) {
            let choiceTrials = analysis.getMatches(trials, function(trial) {
                return trial.choice.length && trial.choice.indexOf(advisorId) !== -1;
            });
            if (!choiceTrials.length)
                return [NaN];
            let chosenTrials = analysis.getMatches(choiceTrials, function(trial) {
                return trial.advisorId === advisorId;
            });
            return [chosenTrials.length/choiceTrials.length, chosenTrials.length, choiceTrials.length];
        },

        /**
         * Show feedback based on a Governor object
         * @param {ESM.Governor} g
         */
        showFeedback: function (g) {
            let self = this;
            let advisors = [2, 3];
            let body = document.querySelector('body');
                // Nav
            let nav = document.createElement('nav');
            nav.innerHTML = "<ul><li><a href='#confidence'>confidence</a></li>" +
                "<li><a href='#advisors'>advisors</a></li>" +
                "<li><a href='#accuracy'>accuracy</a></li></ul>";
            body.appendChild(nav);
            // Thanks
            let thanksSection = body.appendChild(document.createElement('section'));
            let thanksDiv = document.createElement('div');
            thanksDiv.id = 'thanks';
            thanksDiv.innerHTML = "<h1>Thank you</h1><p>You have completed the experiment. During the experiment you " +
                "had two advisors, and were sometimes able to choose between them. Both of these advisors are " +
                "equally accurate on the task, but one agreed with you more often when you are more confident, " +
                "while the other agreed with you more often when you were unsure.</p>" +
                "<p>We suspect that most people will prefer the advisor who agrees with them more when they are more " +
                "confident. Let's have a look at how your results and see how you did on the task and whether your " +
                "choices matched our prediction.</p>";
            thanksSection.appendChild(thanksDiv);
            // Accuracy
            let accuracySection = body.appendChild(document.createElement('section'));
            let accuracyDiv = document.createElement('div');
            accuracyDiv.id = 'accuracy';
            accuracySection.appendChild(accuracyDiv);
            accuracyDiv.appendChild(document.createElement('h2')).innerHTML =
                '<a href="#top" name="accuracy">Accuracy</a>';
            let accuracyContainer = document.createElement('div');
            accuracyContainer.id = 'accuracyContainer';
            accuracyContainer.className = 'container';
            accuracyDiv.appendChild(accuracyContainer);
            let accuracyDescription = document.createElement('div');
            accuracyDescription.id = 'accuracyDescription';
            accuracyDescription.className = 'description';
            let pre = this.accuracySummary(g.trials);
            let post = Math.round(pre.final[0]*100,3);
            pre = Math.round(pre.initial[0]*100,3);
            accuracyDescription.innerHTML = "<p>The task difficulty changes based on your performance so that we " +
                "can compare advice-taking properly. Your initial accuracy should be approximately 71%. " +
                "We expect most people to have higher accuracy after advice than " +
                "before advice. Your pre-advice accuracy was <strong>"+pre+"%</strong>, and your post-advice accuracy " +
                "was <strong>"+post+"%</strong>. The advisors are programmed to be equally accurate on average, and " +
                "they should score around 70%.</p>";
            accuracyContainer.appendChild(accuracyDescription);
            let accuracyGraph = document.createElement('div');
            accuracyGraph.id = 'accuracyGraph';
            accuracyGraph.className = 'graph';
            accuracyContainer.appendChild(accuracyGraph);
            // Advisor choice
            let advisorSection = body.appendChild(document.createElement('section'));
            let advisorWrapper = document.createElement('div');
            advisorWrapper.id = 'advisorWrapper';
            advisorSection.appendChild(advisorWrapper);
            advisorWrapper.appendChild(document.createElement('h2')).innerHTML =
                '<a href="#top" name="advisors">Advisors</a>';
            let advisorContainer = document.createElement('div');
            advisorContainer.id = 'advisorContainer';
            advisorSection.appendChild(advisorContainer);
            advisors.forEach(function (i) {
                let advisor = g.advisors[g.getAdvisorIndex(i)];
                let advisorDiv = document.createElement('div');
                advisorDiv.id = 'advisor'+i;
                advisorDiv.className = 'advisor';
                // stats (portrait + statistics)
                let statsDiv = document.createElement('div');
                statsDiv.id = 'advisor'+i+'statsWrapper';
                statsDiv.className = 'advisor-stats-wrapper';
                advisorDiv.appendChild(statsDiv);
                // portrait
                let portraitDiv = document.createElement('div');
                portraitDiv.id = 'advisor'+i+'portrait';
                portraitDiv.className = 'advisor-portrait';
                portraitDiv.style.backgroundImage = "url('"+advisor.portraitSrc+"')";
                statsDiv.appendChild(portraitDiv);
                // stats
                let statsContainer = document.createElement('div');
                statsContainer.id = 'advisor'+i+'statsContainer';
                statsContainer.className = 'advisor-stats-container';
                let stats = document.createElement('div');
                stats.id = 'advisor'+i+'stats';
                stats.className = 'advisor-stats';
                stats.appendChild(document.createElement('h3')).innerText = advisor.name;
                statsContainer.appendChild(document.createElement('p')).innerText = "Chosen: "+
                    Math.round(self.advisorChoiceRate(g.trials, advisor.id)[0]*100,3).toString()+'%';
                statsContainer.appendChild(document.createElement('p')).innerHTML= "Agrees when <em>"+
                    (advisor.adviceType===1? 'confident' : 'uncertain')+"</em>";
                statsContainer.appendChild(document.createElement('p')).innerText = "Efficiency: "+
                    Math.round(self.strategicAdviceUsage(g.trials, advisor.id)[0],3).toString()+"%";
                let changedAnswers = self.adviceAnswerChanges(g.trials, advisor.id);
                statsContainer.appendChild(document.createElement('p')).innerText = "Mistakes avoided: "+
                    changedAnswers[1];
                statsContainer.appendChild(document.createElement('p')).innerText = "Mistakes caused: "+
                    changedAnswers[2];
                stats.appendChild(statsContainer);
                statsDiv.appendChild(stats);
                // graphs (questionnaire answers over time)
                let graphDiv = document.createElement('div');
                graphDiv.id = 'advisor'+i+'graph';
                graphDiv.className = 'advisor-graph graph';
                advisorDiv.appendChild(graphDiv);
                advisorContainer.appendChild(advisorDiv);
            });
            // confidence
            let confidenceSection = body.appendChild(document.createElement('section'));
            let confidenceDiv = document.createElement('div');
            confidenceDiv.id = 'confidence';
            confidenceSection.appendChild(confidenceDiv);
            confidenceDiv.appendChild(document.createElement('h2')).innerHTML =
                '<a href="#top" name="confidence">Confidence</a>';
            let confidenceContainer = document.createElement('div');
            confidenceContainer.id = 'confidenceContainer';
            confidenceContainer.className = 'container';
            confidenceDiv.appendChild(confidenceContainer);
            let confidenceGraph = document.createElement('div');
            confidenceGraph.id = 'confidenceGraph';
            confidenceGraph.className = 'graph';
            confidenceContainer.appendChild(confidenceGraph);
            let confidenceDescription = document.createElement('div');
            confidenceDescription.id = 'confidenceDescription';
            confidenceDescription.className = 'description';
            let preconf = this.accuracySummary(g.trials);
            let postconf = Math.round(preconf.final[0]*100,3);
            pre = Math.round(preconf.initial[0]*100,3);
            confidenceDescription.innerHTML = "<p>Your confidence is presented here broken down by whether " +
                "or not your final decision was correct. Most people show a pattern where their confidence is " +
                "higher for trials where they were correct than for trials where they were mistaken. We would " +
                "also expect confidence to be higher on average after taking advice (though if the advisors " +
                "disagreed with you a lot, this would be different).</p>";
            confidenceContainer.appendChild(confidenceDescription);

            // apply 'feedback' class to all elements for styling purposes
            body.className += ' feedback';
            analysis.applyClassToChildren(body, 'feedback');
            body.style.backgroundColor = 'white';

            // fill in graphs
            this.getAccuracyGraph(g, accuracyGraph);
            this.getConfidenceGraph(g, confidenceGraph);
            advisors.forEach(function (i) {
                let graphDiv = document.querySelector('#advisor'+i+'graph')
                self.getQuestionnaireGraph(g, i, graphDiv);
            })
        },

        /**
         * Display a graph of questionnaire responses for a given advisor. Uses google graph API.
         * @param {ESM.Governor} input
         * @param {int} advisorId - the advisor who is the subject of the graph
         * @param {Element} div - div to draw the graph in
         */
        getQuestionnaireGraph: function (input, advisorId, div) {
            // Create the data table.
            let raw = [
                ['Time', 'Likeable', 'Capable', 'Helping']
            ];

            let timepoint = 0;
            for (let t=1; t<(input.questionnaires.length); t+=2) {
                let Qs = [input.questionnaires[t], input.questionnaires[t+1]];
                let q = analysis.getMatches(Qs, function(questionnaire) {
                    return questionnaire.advisorId === advisorId;
                })[0];
                let likeable = 0;
                let capable = 0;
                let helping = 0;
                for (let r=0; r<q.response.length; r++) {
                    switch(q.response[r].name) {
                        case "Likability":
                            likeable = q.response[r].answer;
                            break;
                        case "Ability":
                            capable = q.response[r].answer;
                            break;
                        case "Benevolence":
                            helping = q.response[r].answer;
                            break;
                    }
                }
                raw.push([timepoint.toString(), parseInt(likeable), parseInt(capable), parseInt(helping)]);
                timepoint++;
            }
            let data = google.visualization.arrayToDataTable(raw);

            let options = {
                width: div.parentElement.clientWidth,
                height: div.clientHeight,
                hAxis: {
                    title: 'Time'
                },
                vAxis: {
                    title: 'Your rating',
                    minValue: 0,
                    maxValue: 100
                },
                legend: {
                    position: 'top',
                    maxLines: 2,
                    alignment: 'end',
                }
            };

            // Instantiate and draw our chart, passing in some options.
            let chart = new google.visualization.LineChart(div);
            chart.draw(data, options);
            console.log(options);
        },

        /**
         * Display a graph of participant accuracy. Uses google graph API.
         * @param {ESM.Governor} input
         * @param {HTMLElement} div - div to draw the graph in
         */
        getAccuracyGraph: function (input, div) {
            let advisors = [];
            [2, 3].forEach(function(i) {
                advisors.push(input.advisors[input.getAdvisorIndex(i)]);
            });
            let judgeAcc = this.accuracySummary(input.trials);

            // Create the data table.
            let raw = [
                ['Person', 'Accuracy', { role: 'style' }],
                ['You (pre advice)', judgeAcc.initial[0]*100, 'blue'],
                ['You (post advice)', judgeAcc.final[0]*100, 'cornflower']
            ];

            let col = ['silver', '#e5e4e2'];
            for (let a=0; a<advisors.length; a++) {
                raw.push([advisors[a].name, this.advisorAccuracy(input.trials, advisors[a].id)[0]*100, col[a]]);
            }
            let data = google.visualization.arrayToDataTable(raw);
            let options = {
                title: 'Dot-task accuracy',
                width: div.clientWidth,
                height: div.parentElement.clientHeight,
                legend: {
                    position: 'none',
                },
                vAxis: {
                    title: '% correct',
                    minValue: 50,
                    maxValue: 100
                }
            };
            // Instantiate and draw our chart, passing in some options.
            let chart = new google.visualization.ColumnChart(div);
            chart.draw(data, options);
        },

        /**
         * Display a graph of participant confidence. Uses google graph API.
         * @param {ESM.Governor} input
         * @param {HTMLElement} div - div to draw the graph in
         */
        getConfidenceGraph: function (input, div) {
            let confReport = this.confidenceBreakdown(input.trials);

            // Create the data table.
            let raw = [
                ['Contingency', 'Confidence', { role: 'style' }],
                ['Correct (pre advice)', confReport.final.correct.initial[0], 'blue'],
                ['Incorrect (pre advice)', confReport.final.incorrect.initial[0], 'pink'],
                ['Correct (post advice)', confReport.final.correct.final[0], 'blue'],
                ['Incorrect (post advice)', confReport.final.incorrect.final[0], 'pink']
            ];

            let data = google.visualization.arrayToDataTable(raw);
            let options = {
                title: 'Dot-task confidence',
                width: div.clientWidth,
                height: div.parentElement.clientHeight,
                legend: {
                    position: 'none',
                },
                vAxis: {
                    title: 'mean confidence',
                    minValue: 0,
                    maxValue: 100
                }
            };
            // Instantiate and draw our chart, passing in some options.
            let chart = new google.visualization.ColumnChart(div);
            chart.draw(data, options);
        },

    },

    /**
     * Return a subset of list where items within it return true when fed into matchFunc
     * @param {Array} array - array to examine
     * @param {function} matchFunc - function to examine items with
     * @returns {Array} - array of items in *array* which pass *matchFunc*
     */
    getMatches: function (array, matchFunc) {
        let out = [];
        array.forEach(function (item) {
            if (matchFunc(item))
                out.push(item);
        });
        return out;
    },

    applyClassToChildren: function (element, classname, recursive = true) {
        for (let i=0; i<element.childElementCount; i++) {
            let child = element.children[i];
            child.className += ' '+classname;
            if (recursive)
                this.applyClassToChildren(child, classname, true);
        }
    }
};

const DATA_IN = '{"dotCount":200,"dotDifference":6,"difficultyStep":3,"advisors":[{"id":1,"adviceType":0,"voice":{"basePath":"","id":1,"name":"Annie","lines":{"think_left":{"filePath":"assets/audio/voices/1/think_left.wav","string":"I think it was on the LEFT","loaded":true,"loading":true,"data":null,"buffer":{},"side":0,"confidence":0},"think_right":{"filePath":"assets/audio/voices/1/think_right.wav","string":"I think it was on the RIGHT","loaded":true,"loading":true,"data":null,"buffer":{},"side":1,"confidence":0},"left_think":{"filePath":"assets/audio/voices/1/left_think.wav","string":"It was on the LEFT, I think","loaded":true,"loading":true,"data":null,"buffer":{},"side":0,"confidence":0},"right_think":{"filePath":"assets/audio/voices/1/right_think.wav","string":"It was on the RIGHT, I think","loaded":true,"loading":true,"data":null,"buffer":{},"side":1,"confidence":0},"intro":{"filePath":"assets/audio/voices/1/intro.wav","string":"Hello, my name is ANNIE","loaded":true,"loading":true,"data":null,"buffer":{},"side":false}}},"name":"Annie","portrait":{},"portraitSrc":"http://localhost:8080/ExploringSocialMetacognition/assets/image/advisor1.png"},{"id":2,"adviceType":1,"voice":{"basePath":"","id":2,"name":"Bea","lines":{"think_left":{"filePath":"assets/audio/voices/2/think_left.wav","string":"I think it was on the LEFT","loaded":true,"loading":true,"data":null,"buffer":{},"side":0,"confidence":0},"think_right":{"filePath":"assets/audio/voices/2/think_right.wav","string":"I think it was on the RIGHT","loaded":true,"loading":true,"data":null,"buffer":{},"side":1,"confidence":0},"left_think":{"filePath":"assets/audio/voices/2/left_think.wav","string":"It was on the LEFT, I think","loaded":true,"loading":true,"data":null,"buffer":{},"side":0,"confidence":0},"right_think":{"filePath":"assets/audio/voices/2/right_think.wav","string":"It was on the RIGHT, I think","loaded":true,"loading":true,"data":null,"buffer":{},"side":1,"confidence":0},"intro":{"filePath":"assets/audio/voices/2/intro.wav","string":"Hello, my name is BEA","loaded":true,"loading":true,"data":null,"buffer":{},"side":false}}},"name":"Bea","portrait":{},"portraitSrc":"http://localhost:8080/ExploringSocialMetacognition/assets/image/advisor2.png"},{"id":3,"adviceType":2,"voice":{"basePath":"","id":3,"name":"Kate","lines":{"think_left":{"filePath":"assets/audio/voices/3/think_left.wav","string":"I think it was on the LEFT","loaded":true,"loading":true,"data":null,"buffer":{},"side":0,"confidence":0},"think_right":{"filePath":"assets/audio/voices/3/think_right.wav","string":"I think it was on the RIGHT","loaded":true,"loading":true,"data":null,"buffer":{},"side":1,"confidence":0},"left_think":{"filePath":"assets/audio/voices/3/left_think.wav","string":"It was on the LEFT, I think","loaded":true,"loading":true,"data":null,"buffer":{},"side":0,"confidence":0},"right_think":{"filePath":"assets/audio/voices/3/right_think.wav","string":"It was on the RIGHT, I think","loaded":true,"loading":true,"data":null,"buffer":{},"side":1,"confidence":0},"intro":{"filePath":"assets/audio/voices/3/intro.wav","string":"Hello, my name is KATE","loaded":true,"loading":true,"data":null,"buffer":{},"side":false}}},"name":"Kate","portrait":{},"portraitSrc":"http://localhost:8080/ExploringSocialMetacognition/assets/image/advisor3.png"}],"blockCount":2,"blockStructure":{"0":0,"1":2,"2":2},"blockLength":4,"practiceBlockCount":1,"practiceBlockStructure":{"0":0,"1":2,"2":0},"practiceBlockLength":2,"preTrialInterval":200,"preStimulusInterval":300,"stimulusDuration":200,"feedbackDuration":200,"questionnaireStack":[],"trials":[{"type":1,"typeName":"force","block":1,"advisorId":0,"choice":[],"answer":[1,null],"confidence":[100,null],"whichSide":1,"practice":true,"feedback":true,"warnings":[],"stimulusDrawTime":86205.0000000745,"stimulusOffTime":null,"fixationDrawTime":85905.99999995902,"id":1,"grid":{"dotCountL":170,"dotCountR":230,"gridWidth":20,"gridHeight":20,"dotWidth":2,"dotHeight":2,"paddingX":6,"paddingY":6,"gridL":[[1,0,0,1,1,1,1,1,0,1,1,1,0,0,0,1,0,1,1,1],[0,1,0,1,1,0,1,1,0,1,0,0,0,0,0,1,1,0,0,0],[0,1,0,0,0,1,0,1,1,0,1,1,0,0,0,0,1,1,0,1],[1,1,1,0,1,1,0,0,1,1,0,1,0,0,0,1,1,0,0,0],[1,0,0,0,0,1,1,0,0,0,1,1,0,0,1,0,0,1,0,0],[1,0,1,1,1,0,1,1,0,1,0,0,1,1,0,0,0,0,0,0],[0,1,0,0,1,0,1,1,0,1,0,0,0,0,0,0,1,0,0,1],[0,1,1,0,1,0,0,1,1,0,0,1,0,1,0,1,0,0,0,0],[0,1,0,0,1,0,0,0,1,1,0,0,0,0,0,0,0,1,0,0],[1,0,0,1,1,0,1,1,0,0,0,1,1,0,0,1,0,1,1,1],[1,1,0,0,1,1,1,0,0,0,0,0,0,0,1,0,0,1,0,0],[0,0,1,0,0,0,1,1,1,0,0,1,1,0,0,0,0,0,0,1],[1,0,1,0,1,0,0,0,0,0,0,1,0,1,0,0,1,0,0,1],[0,1,1,0,1,1,0,0,0,0,0,0,0,0,0,0,1,0,1,1],[1,0,1,1,0,0,0,0,1,1,1,0,0,1,1,0,0,1,0,1],[0,0,1,0,0,1,0,0,1,0,1,0,0,0,0,1,1,1,0,0],[0,1,0,0,1,0,1,0,1,1,1,0,1,1,1,1,0,1,0,0],[0,1,1,0,0,1,1,0,1,0,1,0,1,1,0,0,0,0,1,0],[1,1,1,0,1,0,0,0,1,0,0,1,0,1,0,0,1,1,0,1],[1,0,0,0,0,1,0,1,0,1,1,0,1,0,1,0,0,1,0,0]],"gridR":[[1,0,0,1,0,0,0,0,1,1,1,1,0,1,1,0,0,0,0,1],[1,0,1,1,0,1,0,1,1,1,0,0,0,1,0,0,1,1,0,0],[0,1,1,1,1,0,0,1,1,0,1,0,0,0,1,1,0,0,0,0],[0,0,0,1,1,0,1,0,0,1,1,0,0,0,1,1,1,0,1,1],[0,0,1,1,1,0,0,0,1,1,1,1,0,1,0,0,0,0,1,0],[0,1,1,1,0,1,1,1,1,1,1,0,1,1,0,1,0,0,1,0],[1,0,1,0,0,1,0,1,1,0,1,0,1,0,1,0,1,1,0,0],[1,1,0,0,0,0,1,1,1,1,0,1,1,1,0,0,0,1,0,1],[1,1,1,1,0,1,0,0,1,1,0,0,1,1,1,1,0,0,1,1],[1,0,0,0,1,0,0,0,1,1,1,1,0,1,1,1,0,1,1,1],[1,0,0,1,0,0,0,1,1,0,0,1,1,1,1,0,1,1,1,1],[0,1,0,0,0,0,1,1,0,0,1,0,1,1,0,0,1,1,1,0],[1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,0,0,0,1],[1,1,1,0,0,0,1,0,1,1,1,1,1,0,1,1,1,1,0,1],[1,0,0,0,0,1,1,1,0,1,1,0,1,1,1,1,1,1,0,1],[1,1,0,1,1,0,1,1,0,0,1,1,0,0,0,1,1,0,0,0],[0,1,0,1,0,0,1,1,0,1,1,0,1,1,1,1,1,0,1,1],[1,0,1,0,1,0,0,0,1,1,1,1,1,0,0,1,1,1,1,0],[0,1,1,0,1,1,1,1,0,0,1,0,1,1,0,1,1,1,0,1],[0,1,0,0,0,0,0,1,1,1,1,1,1,1,0,1,1,0,1,1]],"displayWidth":172,"displayHeight":172,"spacing":100,"style":{"gridBorderColor":"#ffffff","gridBorderWidth":"3","dotColor":"#ffffff","dotLineWidth":"1"}},"pluginResponse":[{"startTime":85705.0000000745,"rt":3834.999999962747,"response":[{"id":0,"name":"Left","answer":50,"prompt":"Left","lastChangedTime":null},{"id":1,"name":"Right","answer":"100","prompt":"Right","lastChangedTime":88576.00000011735}],"trial_type":"canvas-sliders-response","trial_index":1,"time_elapsed":89288,"internal_node_id":"0.0-1.0"}]},{"type":1,"typeName":"force","block":1,"advisorId":0,"choice":[],"answer":[0,null],"confidence":[100,null],"whichSide":0,"practice":true,"feedback":true,"warnings":[],"stimulusDrawTime":91040.99999996834,"stimulusOffTime":null,"fixationDrawTime":90740.99999992177,"id":2,"grid":{"dotCountL":230,"dotCountR":170,"gridWidth":20,"gridHeight":20,"dotWidth":2,"dotHeight":2,"paddingX":6,"paddingY":6,"gridL":[[1,0,0,0,0,1,1,0,0,0,1,1,1,1,0,0,1,0,1,1],[1,0,1,1,1,0,0,0,1,0,0,1,0,0,1,0,0,0,1,1],[0,1,1,1,1,1,0,1,1,1,1,0,1,1,1,0,1,0,1,0],[1,1,1,1,1,1,1,0,1,0,0,1,1,0,1,1,0,1,0,0],[0,0,0,1,1,1,1,1,1,1,1,1,0,0,1,1,1,1,0,1],[0,0,0,0,0,0,1,0,1,1,0,1,0,0,1,0,0,0,1,1],[1,1,1,0,1,1,1,0,1,1,1,1,1,1,1,1,0,0,1,0],[0,1,0,1,1,1,1,0,1,0,0,1,1,0,1,0,1,1,1,1],[1,0,0,1,0,0,0,1,1,1,1,0,0,1,1,1,1,0,1,0],[1,0,0,1,1,1,1,1,0,0,1,1,0,0,0,0,1,1,0,1],[0,1,1,1,0,0,0,1,0,0,0,1,1,1,1,0,1,1,0,0],[0,0,1,0,0,0,1,1,1,0,0,0,0,1,1,1,1,0,1,1],[1,0,1,0,1,1,1,0,1,0,1,1,1,0,1,1,1,1,0,0],[1,1,1,1,1,1,0,0,0,1,1,1,1,1,1,1,0,1,0,0],[1,0,0,0,1,1,1,0,0,0,0,1,1,0,1,0,0,0,1,1],[1,1,1,1,1,1,1,0,0,1,1,0,1,1,0,0,0,1,1,1],[0,1,1,0,0,1,0,1,1,1,1,0,0,0,1,0,1,1,1,0],[1,0,1,1,1,0,0,1,1,0,0,0,1,1,1,1,1,0,1,0],[1,0,1,1,0,1,1,0,1,0,0,1,0,1,1,0,1,1,1,0],[1,1,0,1,0,1,0,0,1,1,0,1,0,1,0,0,0,0,0,0]],"gridR":[[1,1,0,0,1,0,1,1,0,0,0,1,0,0,1,1,0,0,0,0],[1,1,1,0,1,1,0,0,0,1,0,1,1,0,1,0,0,1,0,0],[1,0,1,0,0,1,1,0,0,0,0,0,1,0,1,1,1,1,1,0],[1,1,0,0,0,0,0,0,0,1,0,0,1,0,1,1,1,1,1,1],[1,0,1,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,1,0],[0,0,0,0,1,0,1,0,0,0,0,0,1,0,1,0,0,0,1,1],[0,0,0,1,0,1,1,0,1,0,1,0,1,1,1,0,1,1,0,0],[1,1,0,0,1,0,1,1,1,1,0,1,1,0,0,0,1,1,1,0],[0,0,0,0,0,1,1,1,0,0,0,0,0,1,1,0,1,1,0,0],[1,0,0,1,0,0,0,1,1,0,0,1,1,0,1,0,0,1,0,1],[1,0,0,1,0,0,0,0,1,0,0,0,0,0,1,1,0,0,0,0],[1,0,0,1,1,0,0,0,0,1,0,1,0,0,0,1,1,1,1,1],[0,0,0,1,1,0,0,0,1,0,0,1,0,0,1,0,0,1,1,0],[1,0,0,0,1,0,0,1,1,0,0,0,0,0,1,0,1,1,1,0],[0,0,0,1,0,1,0,1,1,1,1,1,0,0,0,1,0,1,1,0],[1,0,1,0,0,1,0,1,1,0,1,0,1,0,0,1,0,0,0,1],[1,0,1,1,1,0,1,0,0,1,1,1,0,0,0,0,1,1,1,1],[0,1,1,0,0,0,0,1,0,0,1,1,0,0,1,0,0,1,1,0],[0,0,1,0,1,0,0,0,1,0,0,0,0,0,1,1,1,0,0,1],[0,0,0,1,0,0,1,0,0,0,0,0,1,1,1,1,1,0,0,0]],"displayWidth":172,"displayHeight":172,"spacing":100,"style":{"gridBorderColor":"#ffffff","gridBorderWidth":"3","dotColor":"#ffffff","dotLineWidth":"1"}},"pluginResponse":[{"startTime":90540.99999996834,"rt":3141.0000000614673,"response":[{"id":0,"name":"Left","answer":100,"prompt":"Left","lastChangedTime":93023.99999997579},{"id":1,"name":"Right","answer":"50","prompt":"Right","lastChangedTime":null}],"trial_type":"canvas-sliders-response","trial_index":3,"time_elapsed":93431,"internal_node_id":"0.0-3.0"}]},{"type":1,"typeName":"force","block":1,"advisorId":1,"choice":[],"answer":[0,0],"confidence":[100,100],"whichSide":0,"practice":true,"feedback":true,"warnings":[],"stimulusDrawTime":96098.99999992922,"stimulusOffTime":null,"fixationDrawTime":95800.00000004657,"id":3,"grid":{"dotCountL":230,"dotCountR":170,"gridWidth":20,"gridHeight":20,"dotWidth":2,"dotHeight":2,"paddingX":6,"paddingY":6,"gridL":[[1,1,0,1,1,0,1,0,1,0,0,1,1,0,1,0,1,0,1,1],[1,1,1,0,1,0,1,0,0,0,1,0,0,1,0,1,0,1,0,0],[0,0,1,0,0,0,1,1,1,1,0,1,1,1,1,0,1,0,0,1],[1,1,0,1,0,0,1,1,0,1,1,1,1,0,1,0,1,1,1,0],[1,0,1,1,0,0,0,1,1,0,1,0,1,1,0,0,1,1,0,0],[1,1,1,0,0,1,0,0,1,0,1,0,0,1,0,1,0,1,1,1],[1,1,1,0,1,1,1,0,0,0,0,1,1,1,1,0,1,1,1,1],[1,1,1,1,1,1,0,0,1,1,1,0,0,0,0,0,0,1,1,1],[1,0,0,0,0,1,1,1,0,1,0,1,0,1,1,1,1,0,1,0],[0,0,1,0,1,1,1,0,1,1,1,1,0,0,0,0,0,0,1,0],[0,1,1,0,1,1,0,0,1,1,0,0,0,0,1,0,1,1,1,1],[0,1,0,0,1,0,1,1,0,0,1,1,1,1,0,1,1,1,1,1],[0,1,1,1,0,0,0,0,1,0,1,1,1,1,1,0,1,1,1,0],[0,1,1,1,1,0,1,1,1,0,1,0,1,0,1,1,1,0,1,1],[1,1,0,0,0,1,1,1,0,0,1,1,0,0,1,1,1,1,0,1],[1,1,1,0,1,1,0,0,0,0,0,0,0,1,1,1,1,1,1,1],[1,1,0,1,0,1,0,1,1,1,1,0,1,1,1,0,1,1,1,0],[0,1,0,1,1,1,0,0,1,0,1,0,0,0,1,0,1,0,0,0],[0,1,1,0,0,1,1,1,0,1,0,1,0,0,1,0,0,0,0,1],[0,1,1,1,1,1,1,0,0,0,1,1,1,1,0,1,0,0,1,1]],"gridR":[[1,0,0,0,1,1,0,1,0,1,0,0,0,1,1,1,1,1,0,1],[1,0,1,1,0,1,0,1,0,1,0,0,0,0,1,0,0,0,0,1],[0,0,0,0,0,1,1,1,0,1,0,1,0,1,0,1,1,1,0,1],[1,0,0,0,0,1,0,0,1,1,0,0,0,1,0,0,1,0,1,1],[0,1,0,0,0,1,1,0,0,1,0,1,1,0,0,1,0,1,1,0],[0,0,1,1,1,1,0,0,0,1,0,1,0,0,1,0,0,1,1,1],[0,1,1,0,1,0,1,0,0,1,0,0,1,0,1,0,1,0,0,0],[0,1,1,0,1,0,1,0,1,0,0,1,0,1,1,1,0,0,0,1],[0,0,0,1,0,1,0,1,1,0,0,0,1,1,0,0,1,0,0,1],[0,0,0,1,1,1,0,0,1,1,1,0,0,0,0,1,0,1,0,0],[1,0,0,0,1,0,0,0,1,1,0,0,0,0,0,1,1,0,0,0],[0,0,1,0,0,1,0,0,0,0,0,0,0,1,1,1,0,1,1,1],[0,0,0,1,0,0,1,1,1,0,1,1,0,0,1,1,1,0,1,0],[0,0,1,0,1,1,0,0,1,0,1,0,1,0,1,0,1,0,0,0],[0,1,0,1,1,0,1,0,0,1,1,0,0,0,1,0,0,1,0,1],[0,0,1,0,0,1,0,1,1,1,0,0,0,0,1,1,1,0,0,0],[0,1,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,1,1,0],[1,0,1,0,1,0,0,0,0,0,0,1,0,1,0,1,1,0,0,0],[1,1,0,0,1,0,1,0,1,1,0,0,0,1,1,1,0,0,0,0],[1,0,1,1,0,0,0,0,0,0,1,0,0,1,1,1,0,1,0,1]],"displayWidth":172,"displayHeight":172,"spacing":100,"style":{"gridBorderColor":"#ffffff","gridBorderWidth":"3","dotColor":"#ffffff","dotLineWidth":"1"}},"pluginResponse":[{"startTime":95598.99999992922,"rt":2747.0000002067536,"response":[{"id":0,"name":"Left","answer":100,"prompt":"Left","lastChangedTime":97742.00000008568},{"id":1,"name":"Right","answer":"50","prompt":"Right","lastChangedTime":null}],"trial_type":"canvas-sliders-response","trial_index":5,"time_elapsed":98095,"internal_node_id":"0.0-5.0-0.0"},{"choiceTime":0,"choice":1,"totalTime":2005.000000121072,"image":"http://localhost:8080/ExploringSocialMetacognition/assets/image/advisor1.png","adviceTime":2005.000000121072,"trial_type":"jspsych-jas-present-advice-choice","trial_index":6,"time_elapsed":100301,"internal_node_id":"0.0-5.0-1.0"},{"startTime":100554.00000000373,"rt":2121.000000042841,"response":[{"id":0,"name":"Left","answer":100,"prompt":"Left","lastChangedTime":102026.00000007078},{"id":1,"name":"Right","answer":"50","prompt":"Right","lastChangedTime":null}],"trial_type":"canvas-sliders-response","trial_index":7,"time_elapsed":102424,"internal_node_id":"0.0-5.0-2.0"}],"advisorAgrees":false},{"type":1,"typeName":"force","block":1,"advisorId":1,"choice":[],"answer":[1,1],"confidence":[100,100],"whichSide":1,"practice":true,"feedback":true,"warnings":[],"stimulusDrawTime":104307.0000000298,"stimulusOffTime":699.9999999534339,"fixationDrawTime":104006.99999998324,"id":4,"grid":{"dotCountL":173,"dotCountR":227,"gridWidth":20,"gridHeight":20,"dotWidth":2,"dotHeight":2,"paddingX":6,"paddingY":6,"gridL":[[0,1,0,0,1,0,0,0,0,1,1,0,1,0,0,0,0,1,1,1],[1,0,1,1,0,1,1,1,0,0,0,0,0,0,1,0,1,0,0,1],[0,0,1,0,0,1,1,0,0,1,0,1,1,1,1,0,1,1,1,0],[0,0,1,0,1,0,0,0,0,1,1,1,0,1,0,1,1,1,1,1],[0,0,1,0,1,1,1,1,1,0,1,0,0,0,1,0,1,0,1,0],[1,1,0,1,0,1,0,0,0,0,0,0,0,1,1,1,0,0,1,0],[1,0,0,0,0,0,1,0,1,1,1,1,1,0,1,0,0,0,0,1],[0,1,0,1,1,0,1,1,1,1,0,1,0,1,0,0,1,0,0,1],[0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[0,0,1,1,1,0,0,0,0,1,0,1,0,1,0,1,1,1,1,0],[0,0,0,0,0,0,1,0,0,1,0,1,0,0,0,0,0,0,1,0],[1,0,0,0,0,1,1,1,0,0,1,0,0,0,1,1,1,0,0,0],[0,0,0,0,1,1,1,0,0,1,1,1,1,1,0,0,0,0,1,0],[0,0,0,0,0,0,1,1,1,0,0,0,0,0,1,1,0,1,0,0],[0,0,0,1,1,0,0,1,0,1,0,1,1,0,1,0,0,1,0,0],[1,1,0,1,1,0,0,0,1,1,1,1,1,1,0,0,1,1,0,1],[0,1,1,0,0,0,1,1,1,0,1,0,1,1,0,0,1,1,0,1],[0,0,0,0,0,0,0,1,1,0,0,1,0,0,0,0,1,1,0,1],[0,0,1,1,1,1,1,1,1,0,1,1,0,1,0,0,0,0,0,0],[1,1,0,0,0,1,0,1,0,0,1,0,0,1,1,0,1,1,0,0]],"gridR":[[1,0,0,1,0,0,1,0,1,1,0,0,0,0,0,1,0,0,1,0],[1,1,1,1,0,1,0,1,1,0,1,0,0,1,0,0,0,1,0,0],[1,1,1,1,0,1,0,0,1,0,0,0,0,0,1,0,1,1,0,1],[0,1,1,1,1,1,1,0,1,1,1,1,0,1,1,1,0,1,1,1],[1,1,1,1,1,0,0,1,1,1,0,1,0,0,1,0,1,1,0,0],[0,1,1,1,0,1,1,0,0,1,0,0,1,0,1,1,1,1,0,1],[1,0,0,1,1,0,0,0,0,1,1,1,0,0,0,0,0,0,0,1],[1,1,1,1,1,1,1,0,0,0,1,0,0,1,0,0,0,1,1,0],[0,1,0,1,1,1,1,1,1,1,0,0,1,1,0,0,0,1,1,0],[1,0,0,0,1,0,1,0,1,0,0,1,1,1,1,0,1,0,1,1],[0,1,0,0,1,0,0,1,1,0,1,1,0,1,0,1,1,0,1,0],[1,1,1,0,1,1,1,1,1,0,1,0,1,1,1,1,1,0,1,0],[0,1,0,1,0,0,1,0,1,0,0,0,1,1,1,0,0,1,0,1],[1,0,0,1,1,1,1,1,0,0,1,1,1,1,1,1,0,1,1,1],[1,1,1,1,1,1,0,0,1,0,0,0,1,1,1,0,1,0,0,1],[1,1,0,0,1,1,1,0,0,1,1,0,1,0,1,1,1,0,1,1],[1,1,1,0,0,1,0,1,0,0,1,0,1,0,1,0,1,0,0,1],[1,1,1,0,0,1,1,1,0,0,1,1,1,0,0,0,1,0,1,0],[0,1,1,0,0,1,0,1,1,0,1,0,1,1,1,1,1,0,1,1],[1,1,1,1,0,0,1,0,1,0,0,1,0,0,0,1,1,1,1,0]],"displayWidth":172,"displayHeight":172,"spacing":100,"style":{"gridBorderColor":"#ffffff","gridBorderWidth":"3","dotColor":"#ffffff","dotLineWidth":"1"}},"pluginResponse":[{"startTime":103807.0000000298,"rt":2469.9999999720603,"response":[{"id":0,"name":"Left","answer":50,"prompt":"Left","lastChangedTime":null},{"id":1,"name":"Right","answer":"100","prompt":"Right","lastChangedTime":105618.99999994785}],"stimulusOffTime":699.9999999534339,"trial_type":"canvas-sliders-response","trial_index":9,"time_elapsed":106025,"internal_node_id":"0.0-7.0-0.0"},{"choiceTime":0,"choice":1,"totalTime":2003.000000026077,"image":"http://localhost:8080/ExploringSocialMetacognition/assets/image/advisor1.png","adviceTime":2003.000000026077,"trial_type":"jspsych-jas-present-advice-choice","trial_index":10,"time_elapsed":108028,"internal_node_id":"0.0-7.0-1.0"},{"startTime":108282.00000012293,"rt":1663.9999998733401,"response":[{"id":0,"name":"Left","answer":50,"prompt":"Left","lastChangedTime":null},{"id":1,"name":"Right","answer":"100","prompt":"Right","lastChangedTime":109317.9999999702}],"trial_type":"canvas-sliders-response","trial_index":11,"time_elapsed":109695,"internal_node_id":"0.0-7.0-2.0"}],"advisorAgrees":false},{"type":1,"typeName":"force","block":1,"advisorId":1,"choice":[],"answer":[1,1],"confidence":[100,100],"whichSide":1,"practice":true,"feedback":true,"warnings":[],"stimulusDrawTime":110648.0000000447,"stimulusOffTime":700.999999884516,"fixationDrawTime":110347.99999999814,"id":5,"grid":{"dotCountL":176,"dotCountR":224,"gridWidth":20,"gridHeight":20,"dotWidth":2,"dotHeight":2,"paddingX":6,"paddingY":6,"gridL":[[0,1,0,0,1,0,0,0,1,0,1,1,1,0,0,0,0,1,0,0],[1,1,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,1,0,1],[1,1,0,1,1,1,0,1,1,1,1,0,0,1,0,0,1,0,0,1],[0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0],[0,0,0,1,0,0,0,1,0,1,1,0,1,0,0,0,0,0,0,0],[0,0,1,0,1,0,1,0,0,1,0,1,0,0,0,1,1,0,0,0],[1,0,1,0,1,1,1,0,1,0,0,1,1,1,0,0,1,0,0,1],[1,1,0,0,1,1,1,0,0,1,1,1,0,0,1,0,1,0,1,1],[0,1,0,0,1,0,0,0,1,1,0,0,0,0,1,1,1,0,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0],[1,1,0,1,0,0,0,1,1,0,1,0,1,1,1,0,0,1,0,1],[0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,0,0],[0,1,1,1,1,1,1,1,0,0,0,0,0,1,1,1,0,1,1,1],[0,0,1,1,1,0,1,1,1,1,0,1,0,0,1,1,1,0,0,0],[0,1,0,1,1,1,1,1,0,0,1,1,0,1,0,0,1,0,1,0],[1,0,1,0,0,1,1,1,0,0,0,1,1,0,0,0,1,0,1,0],[0,1,1,0,1,0,0,1,0,0,0,1,1,1,1,1,0,1,0,1],[1,0,1,0,1,1,1,1,0,0,1,0,0,0,1,0,0,0,0,1],[1,1,0,0,0,0,0,0,1,0,0,0,0,1,1,1,1,0,0,0],[1,0,1,1,1,1,0,0,0,1,0,0,0,1,1,0,1,1,0,0]],"gridR":[[1,0,0,0,1,0,0,1,0,0,1,1,1,0,0,1,0,0,1,1],[1,1,0,0,0,1,1,1,1,1,1,0,1,1,0,0,0,1,1,1],[0,0,1,0,1,1,1,1,1,1,0,0,1,1,0,0,0,1,1,1],[0,1,0,0,1,1,1,0,1,0,1,0,0,0,1,0,1,1,1,0],[0,1,0,1,0,0,1,0,1,1,0,0,1,1,1,0,1,1,1,1],[1,1,1,0,1,1,1,1,0,0,0,1,1,0,1,1,0,1,0,1],[0,1,1,1,1,0,1,1,0,0,0,1,0,0,1,1,1,1,0,1],[0,0,1,0,1,0,1,1,1,0,0,1,1,0,1,0,0,1,0,0],[1,1,0,1,1,0,1,1,1,1,0,0,0,1,1,1,0,0,1,1],[0,1,1,1,0,0,0,1,0,1,0,1,1,1,0,1,0,0,0,0],[1,1,1,0,0,1,1,1,0,1,1,1,1,1,1,0,0,1,0,1],[0,1,0,1,1,1,1,0,1,1,1,1,1,0,1,1,0,1,1,1],[0,0,1,1,1,0,1,1,1,1,0,0,0,0,0,0,1,0,0,1],[0,1,0,1,0,0,0,1,1,1,0,1,1,1,1,1,0,0,1,1],[1,0,1,1,0,1,0,0,0,1,0,0,1,1,0,1,1,1,0,1],[1,0,1,0,0,1,1,0,0,0,1,1,0,0,1,0,1,1,1,0],[1,0,1,0,1,1,1,1,1,0,1,0,0,1,1,0,0,0,0,0],[1,1,0,1,1,1,0,0,1,1,1,1,1,1,1,1,0,1,1,1],[0,1,0,1,1,0,1,0,0,1,0,0,0,1,1,0,1,1,0,1],[0,0,1,1,0,0,0,0,1,0,0,0,1,0,0,0,0,1,0,0]],"displayWidth":172,"displayHeight":172,"spacing":100,"style":{"gridBorderColor":"#ffffff","gridBorderWidth":"3","dotColor":"#ffffff","dotLineWidth":"1"}},"pluginResponse":[{"startTime":110148.0000000447,"rt":3233.9999999385327,"response":[{"id":0,"name":"Left","answer":50,"prompt":"Left","lastChangedTime":null},{"id":1,"name":"Right","answer":"100","prompt":"Right","lastChangedTime":112672.00000002049}],"stimulusOffTime":700.999999884516,"trial_type":"canvas-sliders-response","trial_index":12,"time_elapsed":113130,"internal_node_id":"0.0-7.0-0.1"},{"choiceTime":0,"choice":1,"totalTime":2002.9999997932464,"image":"http://localhost:8080/ExploringSocialMetacognition/assets/image/advisor1.png","adviceTime":2002.9999997932464,"trial_type":"jspsych-jas-present-advice-choice","trial_index":13,"time_elapsed":115133,"internal_node_id":"0.0-7.0-1.1"},{"startTime":115387.00000010431,"rt":2176.9999999087304,"response":[{"id":0,"name":"Left","answer":50,"prompt":"Left","lastChangedTime":null},{"id":1,"name":"Right","answer":"100","prompt":"Right","lastChangedTime":116963.9999999199}],"trial_type":"canvas-sliders-response","trial_index":14,"time_elapsed":117312,"internal_node_id":"0.0-7.0-2.1"}],"advisorAgrees":true},{"type":2,"typeName":"choice","block":2,"advisorId":3,"choice":[3,2],"answer":[1,1],"confidence":[97,100],"whichSide":0,"practice":false,"feedback":false,"warnings":[],"stimulusDrawTime":186851.0000000242,"stimulusOffTime":700.999999884516,"fixationDrawTime":186550.00000004657,"id":6,"grid":{"dotCountL":221,"dotCountR":179,"gridWidth":20,"gridHeight":20,"dotWidth":2,"dotHeight":2,"paddingX":6,"paddingY":6,"gridL":[[0,0,0,1,1,1,0,0,0,0,0,1,1,1,1,0,1,0,0,1],[0,1,0,1,1,1,0,0,0,0,0,0,0,1,0,1,1,1,1,0],[0,1,1,1,1,0,1,0,0,1,0,1,0,0,1,1,0,1,1,1],[1,0,0,0,0,0,0,1,1,1,1,0,0,1,1,1,0,1,0,1],[1,1,1,0,1,1,0,0,1,0,1,1,0,0,0,1,1,0,0,1],[1,1,0,0,0,0,0,1,1,1,0,1,0,0,1,1,1,1,1,0],[1,1,1,0,0,1,1,1,0,1,0,0,0,1,0,1,0,1,0,1],[0,1,1,1,0,0,0,0,0,0,0,1,1,0,1,1,0,1,0,1],[0,0,0,1,1,1,1,0,0,1,1,1,1,1,0,1,0,0,0,0],[0,1,1,1,1,1,0,0,0,1,0,0,1,0,0,1,1,0,1,1],[1,0,1,1,0,0,0,1,0,1,1,1,1,1,1,1,1,1,0,1],[1,1,0,0,1,1,1,0,0,1,1,1,1,1,1,0,1,0,0,1],[1,1,0,0,0,0,0,0,1,1,1,1,1,0,1,0,0,0,1,0],[0,1,1,1,0,1,1,0,1,0,1,1,0,0,1,1,1,1,0,1],[1,1,1,1,0,0,1,1,1,1,0,0,1,1,1,0,1,1,1,1],[0,0,1,1,1,1,1,1,1,1,0,1,0,1,1,1,0,0,0,0],[0,1,0,0,1,0,1,1,1,1,1,1,1,0,0,1,0,0,0,0],[1,0,0,1,0,1,0,0,1,0,1,0,0,0,0,0,1,0,1,0],[1,0,1,0,1,0,1,0,1,1,0,0,1,1,1,1,1,1,0,1],[1,1,1,1,0,0,0,1,1,0,0,1,1,1,0,0,1,1,0,1]],"gridR":[[1,1,0,1,1,1,0,0,1,0,1,0,0,1,0,0,0,1,0,0],[1,1,0,1,0,0,1,1,0,1,1,0,1,1,1,1,0,1,0,0],[0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,1,1,1,0],[1,0,1,1,0,1,0,1,0,0,1,0,1,0,1,0,0,0,0,0],[0,0,0,0,0,1,1,0,0,1,0,0,1,0,1,1,1,0,0,0],[1,1,1,0,0,0,0,1,1,1,1,0,1,1,1,1,0,0,1,0],[0,0,1,1,0,1,0,1,0,1,1,1,0,0,1,0,0,0,1,0],[1,1,0,0,0,0,0,1,0,0,0,1,1,1,0,0,0,1,0,1],[0,1,0,0,1,0,1,0,0,0,0,0,1,0,1,0,1,0,0,1],[1,0,1,0,1,0,0,0,0,1,1,0,1,1,1,0,1,0,0,0],[0,1,1,0,1,1,0,1,1,0,0,0,1,0,1,0,0,0,1,0],[1,1,0,0,1,1,1,0,1,1,0,0,1,0,1,0,0,0,1,1],[1,0,1,0,1,0,0,1,0,1,1,0,1,1,0,0,0,0,1,1],[1,1,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,1,1,0],[0,0,1,0,0,0,0,1,1,1,1,1,0,1,0,0,1,0,1,0],[0,1,1,0,0,0,0,0,1,1,1,1,0,0,1,1,0,0,1,1],[1,0,0,0,0,0,1,0,0,0,1,0,0,1,0,1,0,1,1,1],[1,1,1,1,1,0,1,0,0,1,0,0,1,1,1,1,0,1,0,1],[1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,0,1,1,1],[0,1,0,1,0,1,1,0,0,0,0,1,1,1,1,1,1,0,0,0]],"displayWidth":172,"displayHeight":172,"spacing":100,"style":{"gridBorderColor":"#ffffff","gridBorderWidth":"3","dotColor":"#ffffff","dotLineWidth":"1"}},"pluginResponse":[{"startTime":186350.00000009313,"rt":2356.999999843538,"response":[{"id":0,"name":"Left","answer":50,"prompt":"Left","lastChangedTime":null},{"id":1,"name":"Right","answer":"97","prompt":"Right","lastChangedTime":188044.9999999255}],"stimulusOffTime":700.999999884516,"trial_type":"canvas-sliders-response","trial_index":20,"time_elapsed":188454,"internal_node_id":"0.0-13.0-0.0"},{"choiceTime":4941.000000108033,"choice":3,"totalTime":6942.999999970198,"image":"http://localhost:8080/ExploringSocialMetacognition/assets/image/advisor3.png","adviceTime":2001.9999998621643,"trial_type":"jspsych-jas-present-advice-choice","trial_index":21,"time_elapsed":195399,"internal_node_id":"0.0-13.0-1.0"},{"startTime":195654.00000009686,"rt":2395.0000000186265,"response":[{"id":0,"name":"Left","answer":50,"prompt":"Left","lastChangedTime":null},{"id":1,"name":"Right","answer":"100","prompt":"Right","lastChangedTime":197435.00000005588}],"trial_type":"canvas-sliders-response","trial_index":22,"time_elapsed":197796,"internal_node_id":"0.0-13.0-2.0"}],"advisorAgrees":true},{"type":1,"typeName":"force","block":2,"advisorId":2,"choice":[],"answer":[0,0],"confidence":[75,92],"whichSide":0,"practice":false,"feedback":false,"warnings":[],"stimulusDrawTime":198750,"stimulusOffTime":701.0000001173466,"fixationDrawTime":198449.99999995343,"id":7,"grid":{"dotCountL":224,"dotCountR":176,"gridWidth":20,"gridHeight":20,"dotWidth":2,"dotHeight":2,"paddingX":6,"paddingY":6,"gridL":[[0,0,1,0,0,1,1,1,1,1,1,0,0,1,1,1,0,0,1,1],[0,1,1,1,0,1,0,1,1,1,1,1,0,1,1,1,1,1,1,1],[1,0,0,1,1,1,0,0,1,1,1,1,0,0,1,1,1,0,0,1],[1,0,1,1,0,1,0,0,0,0,1,0,1,1,1,1,0,0,0,1],[1,1,0,1,1,1,0,0,1,1,1,0,1,0,0,0,1,0,1,0],[1,0,1,0,1,1,0,1,1,0,0,1,1,0,0,0,1,0,1,1],[1,0,0,1,1,0,0,1,1,1,0,1,0,1,0,0,1,0,0,1],[1,0,0,1,0,0,1,0,0,1,1,0,1,0,0,1,0,1,0,0],[0,0,0,1,1,0,1,0,0,1,0,1,1,1,1,0,1,0,0,1],[1,0,1,0,1,0,0,1,1,0,0,1,1,1,0,0,1,1,0,1],[0,0,1,0,1,0,1,0,1,0,0,0,1,1,1,1,1,0,0,1],[1,1,1,1,1,0,1,1,1,1,1,1,1,0,1,1,1,1,0,0],[1,1,1,0,1,0,0,1,1,1,0,1,1,1,0,1,0,1,1,1],[1,0,1,0,1,1,1,0,0,0,0,1,1,0,0,1,1,0,1,0],[1,0,1,0,1,0,0,1,1,0,0,0,1,0,0,1,0,0,1,0],[0,1,0,0,0,0,1,0,0,1,1,1,1,1,1,1,0,1,1,1],[1,0,1,1,1,0,0,0,1,0,0,0,1,1,1,0,0,0,1,1],[0,0,0,1,0,1,1,0,0,1,1,0,1,1,1,0,0,0,0,0],[1,1,0,1,1,1,0,1,0,0,0,0,1,1,1,1,1,0,1,0],[1,0,1,0,1,0,1,1,1,1,0,1,1,1,0,1,0,1,0,1]],"gridR":[[1,0,1,0,0,1,0,0,0,1,1,1,1,1,0,1,0,0,1,0],[0,0,0,1,1,0,1,0,0,0,1,1,0,0,0,0,1,0,1,0],[0,1,0,1,0,0,0,1,0,0,1,0,1,0,0,1,1,0,1,0],[1,0,1,1,1,1,0,1,0,1,0,1,1,1,1,1,1,0,0,1],[0,0,0,0,0,0,0,1,1,1,1,1,1,0,1,1,1,0,1,0],[1,0,1,0,1,0,0,1,0,1,0,0,0,1,1,1,1,0,0,0],[0,0,0,1,1,0,0,0,0,0,0,1,1,1,1,0,1,0,1,1],[0,1,1,1,0,0,0,0,0,1,0,1,0,0,0,1,1,1,1,0],[1,0,0,1,1,1,0,1,1,0,0,1,0,0,1,0,0,0,1,0],[1,0,1,1,1,0,0,1,0,0,0,0,1,0,0,0,1,0,0,0],[1,1,0,1,1,0,0,1,0,1,1,0,1,0,0,1,1,0,0,1],[1,0,1,1,1,1,0,0,0,1,0,0,0,1,0,0,1,0,0,0],[0,0,0,1,0,0,0,0,1,0,0,0,1,1,1,0,0,1,0,0],[0,0,0,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,1,0,0,0,1,0,0,0,0,0,0,1,1,1,0,0,0,0,1],[1,1,0,0,1,0,0,0,1,0,0,0,0,1,1,0,0,1,0,0],[1,0,0,0,1,1,1,0,1,1,0,0,0,0,1,0,0,0,1,0],[1,0,1,1,0,1,1,1,1,0,1,1,1,1,1,0,1,1,1,1],[0,1,1,0,0,0,0,1,1,0,1,1,0,0,1,0,0,1,1,1],[0,0,0,0,0,1,1,0,0,1,1,1,1,0,1,0,0,0,1,0]],"displayWidth":172,"displayHeight":172,"spacing":100,"style":{"gridBorderColor":"#ffffff","gridBorderWidth":"3","dotColor":"#ffffff","dotLineWidth":"1"}},"pluginResponse":[{"startTime":198250,"rt":2094.9999999720603,"response":[{"id":0,"name":"Left","answer":75,"prompt":"Left","lastChangedTime":199671.0000000894},{"id":1,"name":"Right","answer":"50","prompt":"Right","lastChangedTime":null}],"stimulusOffTime":701.0000001173466,"trial_type":"canvas-sliders-response","trial_index":23,"time_elapsed":200092,"internal_node_id":"0.0-13.0-0.1"},{"choiceTime":0,"choice":2,"totalTime":2001.9999998621643,"image":"http://localhost:8080/ExploringSocialMetacognition/assets/image/advisor2.png","adviceTime":2001.9999998621643,"trial_type":"jspsych-jas-present-advice-choice","trial_index":24,"time_elapsed":202095,"internal_node_id":"0.0-13.0-1.1"},{"startTime":202347.99999999814,"rt":2397.0000001136214,"response":[{"id":0,"name":"Left","answer":92,"prompt":"Left","lastChangedTime":204134.00000007823},{"id":1,"name":"Right","answer":"50","prompt":"Right","lastChangedTime":null}],"trial_type":"canvas-sliders-response","trial_index":25,"time_elapsed":204492,"internal_node_id":"0.0-13.0-2.1"}],"advisorAgrees":true},{"type":1,"typeName":"force","block":2,"advisorId":3,"choice":[],"answer":[0,0],"confidence":[84,92],"whichSide":0,"practice":false,"feedback":false,"warnings":[],"stimulusDrawTime":205445.99999999627,"stimulusOffTime":699.9999999534339,"fixationDrawTime":205145.9999999497,"id":8,"grid":{"dotCountL":224,"dotCountR":176,"gridWidth":20,"gridHeight":20,"dotWidth":2,"dotHeight":2,"paddingX":6,"paddingY":6,"gridL":[[1,0,0,0,1,0,1,0,1,1,1,0,0,1,0,1,0,1,1,0],[0,1,0,1,1,0,0,1,0,1,0,0,0,0,1,1,1,0,1,1],[0,0,1,1,0,0,0,1,1,1,0,0,1,0,0,1,0,0,0,0],[1,1,0,0,1,0,1,0,1,1,0,1,0,0,1,1,1,1,0,1],[1,1,0,1,1,1,1,0,0,1,0,1,1,0,1,0,1,0,1,0],[1,1,0,0,1,0,1,0,0,1,1,1,0,0,1,1,0,0,1,0],[1,1,1,1,1,0,0,1,0,0,1,1,0,0,1,0,1,1,1,0],[0,1,0,1,1,1,1,1,0,0,1,0,0,0,1,1,0,0,1,0],[1,1,0,1,0,0,1,1,1,1,1,1,0,1,1,0,0,0,1,0],[1,1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1,0,0,1],[1,0,1,0,1,1,0,1,0,1,0,0,1,1,0,0,1,0,1,1],[0,1,0,1,0,1,0,1,1,1,1,0,1,0,1,1,0,0,0,0],[0,1,1,1,1,1,0,1,1,1,0,0,0,1,0,1,1,1,1,0],[1,0,1,1,1,1,0,0,0,0,0,1,1,0,0,1,0,0,1,0],[1,0,1,0,0,0,0,0,0,0,1,1,1,0,0,1,1,1,0,0],[0,0,0,0,1,0,0,1,0,1,0,1,0,1,1,1,1,0,0,0],[1,0,1,0,1,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0],[1,1,1,0,1,1,0,1,1,1,1,1,1,0,0,1,1,0,0,1],[1,1,1,0,0,0,1,1,0,1,0,1,0,1,1,1,1,1,0,1],[1,1,1,0,1,1,1,1,1,1,1,0,1,1,1,0,1,1,1,0]],"gridR":[[0,1,1,1,0,1,1,0,0,1,1,0,0,0,0,0,0,0,1,1],[0,0,1,0,0,0,0,1,1,0,0,0,0,1,0,1,1,0,0,0],[0,1,0,1,0,1,0,0,0,0,1,0,1,0,1,0,1,1,0,0],[0,1,0,1,1,1,1,1,0,1,1,1,0,1,1,0,0,1,1,0],[0,0,0,1,0,0,0,1,0,0,0,0,1,1,0,1,0,0,0,0],[0,1,0,0,0,0,1,1,1,0,0,1,0,0,1,1,0,0,1,0],[1,1,1,0,0,1,0,1,0,0,1,1,0,1,0,1,1,0,1,1],[0,1,0,0,1,0,1,0,1,0,0,0,0,1,1,0,0,1,0,0],[0,1,1,1,1,1,0,0,0,1,1,1,1,1,0,0,0,1,0,1],[0,1,0,1,0,0,1,1,0,1,1,1,1,1,1,0,1,0,1,1],[0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,0,1,1,1],[0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,1,0,1,1,0],[1,1,1,1,0,1,1,0,1,1,1,0,0,0,1,0,0,1,1,0],[0,1,0,0,1,0,1,1,0,1,0,0,1,0,0,1,0,1,0,0],[0,0,0,0,0,1,1,0,1,0,0,0,0,1,0,1,1,1,0,1],[0,0,0,1,1,0,0,1,0,1,0,0,1,0,1,0,0,1,1,1],[0,0,1,1,1,0,0,1,1,0,0,0,1,1,0,0,0,0,0,0],[1,0,0,1,1,1,0,0,0,0,0,0,0,1,0,0,0,0,1,1],[0,0,1,0,1,1,0,0,0,1,0,1,1,0,0,1,1,1,0,1],[0,0,0,1,0,0,0,0,1,0,0,0,1,0,1,1,1,1,0,0]],"displayWidth":172,"displayHeight":172,"spacing":100,"style":{"gridBorderColor":"#ffffff","gridBorderWidth":"3","dotColor":"#ffffff","dotLineWidth":"1"}},"pluginResponse":[{"startTime":204945.99999999627,"rt":2908.999999985099,"response":[{"id":0,"name":"Left","answer":84,"prompt":"Left","lastChangedTime":207040.99999996834},{"id":1,"name":"Right","answer":"50","prompt":"Right","lastChangedTime":null}],"stimulusOffTime":699.9999999534339,"trial_type":"canvas-sliders-response","trial_index":26,"time_elapsed":207603,"internal_node_id":"0.0-13.0-0.2"},{"choiceTime":0,"choice":3,"totalTime":2001.9999998621643,"image":"http://localhost:8080/ExploringSocialMetacognition/assets/image/advisor3.png","adviceTime":2001.9999998621643,"trial_type":"jspsych-jas-present-advice-choice","trial_index":27,"time_elapsed":209605,"internal_node_id":"0.0-13.0-1.2"},{"startTime":209858.99999993853,"rt":1316.0000001080334,"response":[{"id":0,"name":"Left","answer":92,"prompt":"Left","lastChangedTime":210542.00000013225},{"id":1,"name":"Right","answer":"50","prompt":"Right","lastChangedTime":null}],"trial_type":"canvas-sliders-response","trial_index":28,"time_elapsed":210922,"internal_node_id":"0.0-13.0-2.2"}],"advisorAgrees":true},{"type":2,"typeName":"choice","block":2,"advisorId":3,"choice":[2,3],"answer":[1,1],"confidence":[100,98],"whichSide":1,"practice":false,"feedback":false,"warnings":[],"stimulusDrawTime":211875.99999993108,"stimulusOffTime":701.0000001173466,"fixationDrawTime":211576.00000011735,"id":9,"grid":{"dotCountL":179,"dotCountR":221,"gridWidth":20,"gridHeight":20,"dotWidth":2,"dotHeight":2,"paddingX":6,"paddingY":6,"gridL":[[0,1,0,1,1,1,1,0,0,0,0,1,0,0,0,0,0,0,1,1],[1,1,1,0,0,1,1,0,1,0,1,1,1,1,0,0,0,0,0,1],[0,0,0,1,0,0,0,1,1,1,0,1,1,1,0,1,0,1,0,0],[0,0,1,0,1,1,0,0,0,1,1,1,0,1,1,1,1,0,1,0],[0,1,0,1,1,0,1,1,0,0,0,1,0,0,1,0,0,0,0,1],[1,0,0,1,1,0,1,0,1,0,1,1,0,1,0,0,0,0,1,0],[0,1,1,0,0,1,0,0,1,1,0,0,1,1,0,1,1,0,0,0],[0,0,1,0,0,0,1,1,0,1,1,1,0,1,0,1,0,1,0,1],[0,1,0,0,1,0,0,1,0,0,0,1,0,0,1,1,1,1,1,1],[1,0,0,0,0,0,0,1,0,0,1,1,0,0,0,0,0,1,1,1],[0,1,1,0,0,1,0,1,0,0,1,1,1,1,0,1,1,0,0,1],[1,1,1,1,1,0,0,0,1,1,1,1,0,0,1,0,1,0,0,0],[1,0,1,0,0,0,0,1,0,0,1,1,0,1,0,0,1,0,0,0],[0,1,0,0,0,0,0,1,1,1,1,0,1,1,0,0,0,1,0,0],[0,0,1,0,0,0,0,0,0,0,0,1,1,0,0,1,0,0,1,1],[0,0,0,1,1,0,0,1,0,1,0,1,1,1,1,0,0,1,1,0],[1,1,1,0,1,1,0,1,0,0,0,1,0,1,0,0,0,0,0,0],[1,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,1,1,0],[1,0,0,0,0,0,1,1,0,1,0,1,0,0,1,0,1,0,0,0],[1,1,0,1,0,1,0,1,1,0,1,1,1,1,0,0,0,1,0,0]],"gridR":[[0,1,0,1,0,0,1,0,1,0,0,1,0,0,1,0,1,0,0,1],[0,0,1,1,0,0,0,0,0,1,0,0,1,0,0,1,1,1,0,1],[0,1,0,1,0,0,1,0,0,1,0,0,1,1,0,1,0,1,0,0],[0,1,0,1,1,0,0,1,0,0,1,1,0,1,0,1,1,0,0,1],[0,1,0,1,1,0,1,1,1,0,1,1,0,1,0,0,1,1,0,1],[1,1,1,1,1,1,1,1,0,0,1,1,0,1,0,1,0,0,1,0],[0,1,0,1,0,1,1,0,0,0,1,1,1,1,0,1,1,0,1,1],[0,0,1,0,0,0,1,1,1,0,0,0,0,1,0,0,0,0,1,1],[1,0,1,1,0,1,0,1,1,0,1,1,0,0,1,1,1,1,0,1],[1,0,1,0,0,0,0,0,1,1,1,1,0,1,0,1,1,0,0,0],[1,0,0,1,1,1,1,0,1,1,0,1,1,1,0,1,0,1,1,0],[1,0,0,1,1,1,1,1,0,0,0,1,1,1,0,0,1,1,1,0],[1,1,0,1,0,0,1,1,1,1,1,1,0,1,0,0,0,1,0,0],[1,0,0,1,0,1,1,0,1,0,1,1,1,1,1,0,0,1,1,1],[1,1,1,0,1,1,1,1,1,1,1,1,1,1,0,0,1,0,1,1],[0,1,1,1,1,1,1,1,0,1,0,0,1,0,1,1,0,1,1,1],[1,0,0,0,1,1,0,1,1,1,0,0,1,1,0,0,1,0,1,1],[1,1,1,0,1,1,0,0,1,1,0,0,0,1,0,0,1,0,1,0],[0,1,1,1,1,1,1,1,1,1,0,1,0,0,1,0,0,1,0,1],[0,0,0,1,1,1,0,0,1,0,1,0,1,0,0,0,0,1,0,1]],"displayWidth":172,"displayHeight":172,"spacing":100,"style":{"gridBorderColor":"#ffffff","gridBorderWidth":"3","dotColor":"#ffffff","dotLineWidth":"1"}},"pluginResponse":[{"startTime":211375.99999993108,"rt":2269.0000000875443,"response":[{"id":0,"name":"Left","answer":50,"prompt":"Left","lastChangedTime":null},{"id":1,"name":"Right","answer":"100","prompt":"Right","lastChangedTime":212966.99999994598}],"stimulusOffTime":701.0000001173466,"trial_type":"canvas-sliders-response","trial_index":29,"time_elapsed":213392,"internal_node_id":"0.0-13.0-0.3"},{"choiceTime":3246.999999973923,"choice":3,"totalTime":5249.000000068918,"image":"http://localhost:8080/ExploringSocialMetacognition/assets/image/advisor3.png","adviceTime":2002.000000094995,"trial_type":"jspsych-jas-present-advice-choice","trial_index":30,"time_elapsed":218641,"internal_node_id":"0.0-13.0-1.3"},{"startTime":218895.00000001863,"rt":3310.0000000558794,"response":[{"id":0,"name":"Left","answer":50,"prompt":"Left","lastChangedTime":null},{"id":1,"name":"Right","answer":"98","prompt":"Right","lastChangedTime":221574.00000002235}],"trial_type":"canvas-sliders-response","trial_index":31,"time_elapsed":221952,"internal_node_id":"0.0-13.0-2.3"}],"advisorAgrees":true},{"type":2,"typeName":"choice","block":3,"advisorId":3,"choice":[2,3],"answer":[0,0],"confidence":[94,100],"whichSide":0,"practice":false,"feedback":false,"warnings":[],"stimulusDrawTime":224476.9999999553,"stimulusOffTime":701.0000001173466,"fixationDrawTime":224177.00000014156,"id":10,"grid":{"dotCountL":218,"dotCountR":182,"gridWidth":20,"gridHeight":20,"dotWidth":2,"dotHeight":2,"paddingX":6,"paddingY":6,"gridL":[[0,1,0,0,0,0,1,1,1,1,0,1,1,0,1,0,1,1,0,0],[1,1,0,0,0,1,1,0,1,0,0,0,1,1,1,1,1,0,0,0],[1,0,1,0,1,1,1,1,0,1,1,1,0,0,1,0,0,1,0,0],[1,1,1,0,1,1,0,0,0,0,0,1,1,1,1,0,0,0,1,1],[1,0,1,1,0,1,1,0,1,0,1,0,1,0,1,1,1,1,0,0],[1,1,0,0,1,0,0,1,1,1,1,0,1,1,1,0,1,0,1,1],[1,0,1,1,0,0,0,1,1,1,1,1,1,1,1,1,0,0,1,0],[0,1,1,0,1,0,0,1,1,0,1,0,1,0,0,1,1,1,1,1],[0,0,1,1,1,1,1,0,0,0,1,0,1,1,0,1,1,1,0,0],[1,1,1,0,1,0,1,0,0,0,0,0,0,0,1,1,1,1,0,1],[1,1,1,0,1,0,1,1,0,1,1,0,1,0,0,1,1,0,1,0],[1,0,1,0,1,0,1,0,1,0,0,1,0,0,0,1,0,1,0,1],[0,1,0,1,1,0,0,0,0,1,1,0,0,0,1,1,0,0,0,1],[0,0,0,0,1,1,0,0,1,1,0,1,1,1,0,1,0,1,1,1],[0,0,0,1,1,0,1,1,0,1,1,0,0,1,0,0,1,1,1,1],[1,0,0,0,0,1,1,1,1,0,1,0,1,0,0,1,1,0,1,0],[0,1,0,1,1,1,1,1,0,0,0,1,1,0,1,0,0,0,1,1],[1,1,1,1,0,0,1,0,1,1,1,0,0,0,0,1,1,0,1,1],[1,1,0,0,1,0,1,0,1,0,0,0,1,1,0,1,1,1,0,0],[0,0,1,1,1,1,1,0,0,0,1,1,0,1,0,1,1,1,0,0]],"gridR":[[1,1,1,0,0,1,1,1,1,0,0,0,0,0,0,1,0,0,0,0],[1,1,1,0,1,0,1,0,0,0,1,1,1,0,0,1,0,1,1,1],[0,0,1,0,1,1,1,0,1,1,1,0,1,1,0,0,0,0,1,0],[0,0,0,1,1,0,0,1,0,1,0,0,1,1,1,0,1,0,0,0],[1,0,1,0,0,0,0,0,1,0,1,0,0,1,0,0,1,0,0,0],[0,1,1,1,1,1,0,1,1,0,0,0,1,0,1,1,0,0,0,1],[0,1,1,1,0,1,0,1,1,0,0,1,1,1,0,1,0,0,0,1],[0,0,0,1,0,0,0,1,0,1,1,1,0,1,0,1,1,0,1,0],[0,0,0,0,1,1,0,0,0,1,0,1,1,1,0,1,0,0,1,0],[1,1,1,0,0,1,1,0,0,0,0,1,1,1,1,0,0,1,1,0],[0,1,0,1,1,0,1,1,1,1,1,1,1,1,0,1,0,1,1,1],[0,0,0,0,0,1,1,1,1,1,1,0,1,0,0,1,0,0,1,0],[0,1,0,0,0,1,1,1,0,0,0,0,0,0,1,1,0,0,1,1],[0,0,0,0,1,1,1,1,0,1,0,0,1,0,1,1,0,0,1,0],[0,0,0,0,0,0,0,0,0,1,0,1,0,1,0,0,0,0,1,0],[1,0,0,1,1,1,0,1,1,1,0,0,0,0,0,1,0,0,0,1],[0,0,1,0,0,1,0,1,0,0,1,1,1,1,0,0,0,0,0,0],[1,1,1,1,0,1,0,1,1,0,1,0,1,0,0,0,1,1,0,0],[1,0,0,0,0,1,0,1,0,0,0,0,1,0,0,0,0,1,0,1],[1,1,1,1,1,0,0,0,1,1,0,1,0,0,0,1,0,0,0,1]],"displayWidth":172,"displayHeight":172,"spacing":100,"style":{"gridBorderColor":"#ffffff","gridBorderWidth":"3","dotColor":"#ffffff","dotLineWidth":"1"}},"pluginResponse":[{"startTime":223976.9999999553,"rt":2229.0000000502914,"response":[{"id":0,"name":"Left","answer":94,"prompt":"Left","lastChangedTime":225596.00000013597},{"id":1,"name":"Right","answer":"50","prompt":"Right","lastChangedTime":null}],"stimulusOffTime":701.0000001173466,"trial_type":"canvas-sliders-response","trial_index":33,"time_elapsed":225953,"internal_node_id":"0.0-15.0-0.0"},{"choiceTime":1404.0000000968575,"choice":3,"totalTime":3405.999999959022,"image":"http://localhost:8080/ExploringSocialMetacognition/assets/image/advisor3.png","adviceTime":2001.9999998621643,"trial_type":"jspsych-jas-present-advice-choice","trial_index":34,"time_elapsed":229360,"internal_node_id":"0.0-15.0-1.0"},{"startTime":229613.00000012852,"rt":1655.9999999590218,"response":[{"id":0,"name":"Left","answer":100,"prompt":"Left","lastChangedTime":230607.00000007637},{"id":1,"name":"Right","answer":"50","prompt":"Right","lastChangedTime":null}],"trial_type":"canvas-sliders-response","trial_index":35,"time_elapsed":231016,"internal_node_id":"0.0-15.0-2.0"}],"advisorAgrees":true},{"type":1,"typeName":"force","block":3,"advisorId":3,"choice":[],"answer":[1,1],"confidence":[100,98],"whichSide":1,"practice":false,"feedback":false,"warnings":[],"stimulusDrawTime":231971.00000013597,"stimulusOffTime":700.999999884516,"fixationDrawTime":231671.0000000894,"id":11,"grid":{"dotCountL":185,"dotCountR":215,"gridWidth":20,"gridHeight":20,"dotWidth":2,"dotHeight":2,"paddingX":6,"paddingY":6,"gridL":[[1,0,0,0,0,1,0,1,0,1,0,1,0,0,0,1,0,0,1,0],[0,1,1,0,1,1,0,1,0,0,1,1,0,0,1,1,0,1,1,1],[0,0,0,0,0,0,1,1,0,1,0,0,1,0,1,0,0,1,1,0],[1,0,0,1,1,1,1,1,1,0,0,1,0,0,1,1,0,0,1,1],[0,0,1,1,0,1,1,1,0,1,0,0,0,0,1,1,0,1,1,1],[0,0,0,1,0,1,0,1,0,1,1,1,0,0,0,1,1,1,1,1],[0,0,0,0,0,0,1,1,0,0,1,1,0,0,1,0,0,0,0,0],[0,1,0,0,0,0,1,1,1,1,0,0,1,0,0,1,1,0,1,1],[1,1,0,1,0,0,0,1,1,0,0,1,1,0,1,0,1,1,0,0],[1,0,0,1,1,1,1,1,1,0,1,1,1,1,1,0,1,0,0,1],[1,1,1,0,1,1,0,0,0,0,0,0,0,0,1,0,1,1,0,0],[0,0,1,1,1,1,1,0,0,1,0,0,1,1,0,1,1,0,1,0],[1,1,1,1,0,1,0,0,0,1,0,1,1,1,0,0,0,0,1,1],[0,0,1,0,1,1,0,0,1,0,0,0,0,0,0,0,1,0,1,1],[0,0,0,0,0,1,1,0,1,0,0,1,0,0,1,1,0,0,0,0],[1,1,0,0,1,1,0,1,0,0,0,0,0,1,1,0,1,0,0,0],[1,1,0,1,0,0,0,0,0,1,0,1,0,0,0,0,0,1,0,1],[1,0,1,1,0,0,0,0,1,0,0,0,0,0,1,0,1,0,0,1],[1,1,0,1,1,0,0,1,0,1,1,0,1,0,1,0,0,1,0,0],[1,1,1,0,0,0,1,1,1,1,0,0,1,0,1,0,0,1,0,1]],"gridR":[[0,0,0,0,0,1,0,1,0,1,1,1,0,1,0,0,1,1,1,0],[0,0,0,0,1,0,1,0,0,0,0,1,1,1,0,0,1,0,1,0],[1,1,0,1,1,0,0,1,1,1,0,1,0,0,1,1,1,0,0,1],[1,0,1,0,0,1,1,1,1,1,1,1,0,0,0,0,1,0,0,0],[1,1,1,1,1,1,0,1,0,0,0,0,1,0,1,0,1,0,0,0],[1,0,1,0,1,1,0,1,1,1,1,1,1,1,0,1,1,0,0,0],[1,1,0,0,0,0,0,0,0,0,1,0,1,1,0,1,1,1,1,0],[1,0,0,1,0,1,0,1,0,0,0,0,0,1,0,1,1,0,1,0],[0,0,1,1,1,0,1,1,1,0,0,0,1,0,0,0,1,0,0,0],[1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,1,0,1,0,0],[0,1,0,0,1,1,0,1,0,1,0,1,1,1,0,0,1,1,1,0],[1,0,0,1,0,1,0,1,0,1,1,0,0,0,0,1,1,1,1,1],[0,0,1,1,0,0,0,1,0,1,1,1,0,1,1,0,0,1,0,1],[1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,1,0,1,0,1],[0,1,0,0,1,0,1,0,1,1,0,1,1,1,1,1,1,0,1,1],[1,1,1,1,0,0,0,1,0,0,0,0,0,1,0,0,1,0,1,1],[1,0,0,0,0,0,1,0,1,1,1,1,0,0,0,1,1,0,0,1],[1,1,1,1,1,0,0,1,1,0,0,0,1,1,0,1,0,1,1,1],[0,1,0,1,1,0,1,0,1,1,0,1,1,1,0,1,1,1,1,0],[0,1,1,1,1,0,1,1,1,1,0,0,1,1,1,1,0,1,0,1]],"displayWidth":172,"displayHeight":172,"spacing":100,"style":{"gridBorderColor":"#ffffff","gridBorderWidth":"3","dotColor":"#ffffff","dotLineWidth":"1"}},"pluginResponse":[{"startTime":231471.00000013597,"rt":2527.999999932945,"response":[{"id":0,"name":"Left","answer":50,"prompt":"Left","lastChangedTime":null},{"id":1,"name":"Right","answer":"100","prompt":"Right","lastChangedTime":233401.00000007078}],"stimulusOffTime":700.999999884516,"trial_type":"canvas-sliders-response","trial_index":36,"time_elapsed":233748,"internal_node_id":"0.0-15.0-0.1"},{"choiceTime":0,"choice":3,"totalTime":2002.000000094995,"image":"http://localhost:8080/ExploringSocialMetacognition/assets/image/advisor3.png","adviceTime":2002.000000094995,"trial_type":"jspsych-jas-present-advice-choice","trial_index":37,"time_elapsed":235749,"internal_node_id":"0.0-15.0-1.1"},{"startTime":236003.99999995716,"rt":2582.0000001695007,"response":[{"id":0,"name":"Left","answer":50,"prompt":"Left","lastChangedTime":null},{"id":1,"name":"Right","answer":"98","prompt":"Right","lastChangedTime":237677.00000014156}],"trial_type":"canvas-sliders-response","trial_index":38,"time_elapsed":238335,"internal_node_id":"0.0-15.0-2.1"}],"advisorAgrees":true},{"type":2,"typeName":"choice","block":3,"advisorId":3,"choice":[2,3],"answer":[0,0],"confidence":[81,99],"whichSide":0,"practice":false,"feedback":false,"warnings":[],"stimulusDrawTime":239289.00000010617,"stimulusOffTime":699.9999999534339,"fixationDrawTime":238989.0000000596,"id":12,"grid":{"dotCountL":212,"dotCountR":188,"gridWidth":20,"gridHeight":20,"dotWidth":2,"dotHeight":2,"paddingX":6,"paddingY":6,"gridL":[[1,0,1,1,0,0,1,1,0,1,1,1,0,1,0,1,0,1,0,0],[0,1,1,0,0,0,1,1,1,0,1,1,1,0,0,0,0,0,0,0],[1,0,1,1,0,0,0,0,1,1,0,1,1,0,1,0,0,1,1,1],[0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,0,0,0],[1,1,0,1,0,1,0,1,0,1,1,0,1,1,1,1,1,0,1,1],[1,1,1,0,0,0,0,1,0,0,0,1,0,1,0,0,1,1,1,0],[1,1,1,0,0,0,0,0,1,1,0,1,1,0,1,1,1,1,1,0],[1,0,1,0,0,0,0,1,1,0,0,1,0,1,1,0,1,0,0,0],[1,1,0,0,1,0,1,0,1,0,1,1,0,1,0,0,1,0,1,1],[0,1,1,1,1,1,1,0,1,0,0,0,0,0,0,0,0,1,1,0],[1,1,1,0,1,1,1,0,0,0,0,1,1,1,1,1,0,0,0,1],[0,1,1,1,1,1,0,0,1,1,1,1,0,0,0,1,0,1,0,0],[0,1,1,1,0,1,0,0,1,1,1,1,1,0,0,1,1,0,0,1],[1,0,0,1,1,1,0,1,0,1,1,1,0,1,1,1,1,0,0,1],[0,1,0,1,1,1,0,1,0,0,1,1,1,1,1,1,0,0,1,0],[0,0,1,1,1,0,1,0,0,1,1,1,1,0,1,0,0,1,0,0],[0,0,0,1,0,1,0,1,0,0,0,0,1,0,1,1,1,0,0,0],[1,1,1,0,0,1,0,1,1,0,1,0,0,1,1,1,0,0,1,1],[1,0,0,0,1,1,1,1,0,1,1,1,0,0,0,1,0,1,1,0],[1,1,0,0,0,0,1,1,1,0,1,0,1,0,1,1,0,1,0,0]],"gridR":[[1,0,0,1,1,1,1,1,1,1,0,0,0,0,0,1,1,0,1,0],[0,1,0,0,0,0,0,1,1,1,0,1,1,1,0,0,0,0,1,0],[1,1,0,1,1,1,0,1,1,0,0,0,0,1,0,0,1,1,0,1],[1,1,0,0,1,1,1,1,0,1,0,0,0,0,1,1,0,1,0,1],[1,0,0,0,0,0,0,0,1,0,0,0,1,0,1,0,1,1,1,0],[0,0,0,0,1,0,1,0,0,0,1,0,0,0,0,1,1,1,0,0],[1,0,0,0,1,1,0,0,0,0,0,0,1,1,1,0,0,0,1,1],[0,0,1,1,0,0,0,1,0,1,1,1,0,1,0,1,0,1,1,1],[0,1,0,1,0,0,1,0,0,1,0,0,1,1,0,1,1,0,1,1],[1,0,1,0,1,0,0,1,0,1,0,1,1,1,1,1,0,1,0,0],[0,1,1,0,0,0,1,0,0,1,1,1,1,0,1,0,0,1,0,1],[1,0,0,1,0,0,1,1,0,0,0,0,1,0,1,0,1,1,1,0],[1,1,1,1,1,1,0,1,0,1,0,1,0,0,0,1,1,1,0,0],[0,1,0,1,1,1,0,0,0,1,1,1,0,0,1,0,0,0,0,0],[0,1,0,0,0,1,0,1,0,0,1,0,1,1,1,1,0,1,0,0],[1,1,0,1,1,0,1,0,1,0,1,0,0,0,1,1,0,1,0,0],[1,1,1,0,0,1,0,0,0,0,1,0,1,1,0,1,1,0,1,1],[1,0,1,0,0,0,0,1,0,0,0,0,0,1,0,1,1,0,1,1],[0,1,1,0,1,0,0,1,1,0,1,1,1,0,0,0,1,0,1,0],[0,1,0,0,1,0,1,0,1,0,0,0,0,1,1,1,0,0,0,0]],"displayWidth":172,"displayHeight":172,"spacing":100,"style":{"gridBorderColor":"#ffffff","gridBorderWidth":"3","dotColor":"#ffffff","dotLineWidth":"1"}},"pluginResponse":[{"startTime":238789.00000010617,"rt":2298.9999998826534,"response":[{"id":0,"name":"Left","answer":81,"prompt":"Left","lastChangedTime":240334.00000003166},{"id":1,"name":"Right","answer":"50","prompt":"Right","lastChangedTime":null}],"stimulusOffTime":699.9999999534339,"trial_type":"canvas-sliders-response","trial_index":39,"time_elapsed":240836,"internal_node_id":"0.0-15.0-0.2"},{"choiceTime":955.0000000745058,"choice":3,"totalTime":2957.0000001695007,"image":"http://localhost:8080/ExploringSocialMetacognition/assets/image/advisor3.png","adviceTime":2002.000000094995,"trial_type":"jspsych-jas-present-advice-choice","trial_index":40,"time_elapsed":243793,"internal_node_id":"0.0-15.0-1.2"},{"startTime":244046.0000000894,"rt":1694.999999832362,"response":[{"id":0,"name":"Left","answer":99,"prompt":"Left","lastChangedTime":245229.0000000503},{"id":1,"name":"Right","answer":"50","prompt":"Right","lastChangedTime":null}],"trial_type":"canvas-sliders-response","trial_index":41,"time_elapsed":245489,"internal_node_id":"0.0-15.0-2.2"}],"advisorAgrees":true},{"type":1,"typeName":"force","block":3,"advisorId":3,"choice":[],"answer":[1,1],"confidence":[99,97],"whichSide":1,"practice":false,"feedback":false,"warnings":[],"stimulusDrawTime":246442.9999999702,"stimulusOffTime":699.9999999534339,"fixationDrawTime":246142.99999992363,"id":13,"grid":{"dotCountL":191,"dotCountR":209,"gridWidth":20,"gridHeight":20,"dotWidth":2,"dotHeight":2,"paddingX":6,"paddingY":6,"gridL":[[0,1,1,1,1,1,1,1,0,0,0,0,0,0,1,0,1,1,0,1],[1,0,1,0,1,0,0,0,1,0,0,1,1,1,0,0,1,0,0,0],[1,1,0,0,1,0,0,1,0,1,1,0,1,1,1,1,0,1,0,0],[0,0,1,0,0,1,1,0,1,0,1,0,0,0,1,0,0,1,1,0],[1,0,0,0,0,0,0,1,0,1,0,1,1,0,1,1,1,0,1,0],[0,0,1,0,1,0,0,1,1,1,0,0,0,0,1,0,1,1,0,1],[0,1,1,0,0,1,1,0,1,1,0,0,1,1,1,1,1,1,1,0],[0,1,0,0,0,1,1,1,0,1,1,1,1,0,1,0,0,1,1,0],[1,0,1,0,1,1,0,0,1,1,1,1,1,0,1,0,1,0,1,0],[0,1,1,1,1,0,0,0,0,0,0,1,0,0,1,1,1,0,1,1],[0,1,1,0,1,1,1,0,0,1,1,0,1,0,0,0,0,0,1,1],[0,0,0,0,0,1,1,0,1,0,0,0,0,1,1,1,1,0,0,0],[1,1,0,1,1,0,1,0,1,1,1,0,0,1,0,0,0,1,0,0],[0,0,1,0,1,1,0,0,0,0,1,1,1,1,0,0,0,0,1,0],[0,0,1,0,1,1,1,0,0,0,1,0,0,0,1,1,1,1,1,0],[1,1,0,0,1,0,1,0,0,0,0,0,0,1,1,1,0,0,1,1],[0,0,0,0,1,0,0,0,0,0,1,0,1,1,0,0,0,1,1,0],[1,1,1,0,0,1,0,0,0,1,1,1,1,1,1,1,0,0,1,1],[0,0,0,0,1,0,0,0,0,0,0,1,1,0,1,1,1,1,0,1],[0,0,0,0,1,0,0,0,1,0,0,0,1,1,1,1,0,0,1,1]],"gridR":[[0,1,1,0,0,0,1,0,1,1,0,0,1,0,1,1,1,0,1,0],[1,0,1,1,0,0,1,1,1,1,1,0,0,0,0,1,1,0,1,1],[0,0,1,0,1,1,1,1,1,0,1,1,1,0,1,1,0,0,1,1],[1,1,0,0,1,0,0,0,0,1,1,1,0,1,0,1,1,0,0,1],[0,1,1,1,0,0,0,0,0,0,0,0,1,1,0,0,1,0,1,0],[1,1,0,1,0,1,0,1,1,1,1,0,1,1,1,1,1,1,0,1],[0,0,1,0,1,0,0,1,1,1,1,0,0,0,0,1,1,0,0,1],[1,0,0,0,0,1,1,1,0,0,0,1,0,1,0,1,0,0,0,1],[0,0,1,1,1,0,0,1,0,1,1,1,1,0,1,0,0,0,0,1],[0,1,1,0,0,1,0,1,0,1,1,1,1,1,1,0,0,0,0,0],[1,1,0,0,1,1,1,1,1,0,1,1,0,1,1,1,0,0,1,1],[0,1,0,0,0,1,0,0,1,1,1,1,0,0,0,0,0,1,1,1],[0,1,1,0,0,0,1,1,1,0,0,1,0,0,1,0,0,1,1,0],[0,0,0,1,1,0,0,1,1,1,1,1,0,0,0,0,0,1,0,0],[1,0,1,0,0,0,1,0,0,1,1,1,1,1,1,1,1,1,1,0],[1,1,0,1,0,1,1,0,0,0,0,1,1,0,0,1,1,0,1,0],[1,1,1,0,0,0,0,0,0,0,0,1,0,0,0,0,1,1,0,1],[1,1,0,1,1,0,1,1,0,0,1,0,1,1,1,1,0,1,0,0],[1,0,0,0,0,0,1,1,1,0,1,0,0,0,1,1,1,1,0,0],[1,0,0,1,0,0,1,1,1,1,1,1,1,0,1,1,1,1,0,1]],"displayWidth":172,"displayHeight":172,"spacing":100,"style":{"gridBorderColor":"#ffffff","gridBorderWidth":"3","dotColor":"#ffffff","dotLineWidth":"1"}},"pluginResponse":[{"startTime":245942.9999999702,"rt":1948.0000000912696,"response":[{"id":0,"name":"Left","answer":50,"prompt":"Left","lastChangedTime":null},{"id":1,"name":"Right","answer":"99","prompt":"Right","lastChangedTime":247357.00000007637}],"stimulusOffTime":699.9999999534339,"trial_type":"canvas-sliders-response","trial_index":42,"time_elapsed":247638,"internal_node_id":"0.0-15.0-0.3"},{"choiceTime":0,"choice":3,"totalTime":2003.9999999571592,"image":"http://localhost:8080/ExploringSocialMetacognition/assets/image/advisor3.png","adviceTime":2003.9999999571592,"trial_type":"jspsych-jas-present-advice-choice","trial_index":43,"time_elapsed":249642,"internal_node_id":"0.0-15.0-1.3"},{"startTime":249895.9999999497,"rt":1408.0000000540167,"response":[{"id":0,"name":"Left","answer":50,"prompt":"Left","lastChangedTime":null},{"id":1,"name":"Right","answer":"97","prompt":"Right","lastChangedTime":250844.99999997206}],"trial_type":"canvas-sliders-response","trial_index":44,"time_elapsed":251052,"internal_node_id":"0.0-15.0-2.3"}],"advisorAgrees":true}],"currentTrialIndex":13,"audioPreloadQueue":[],"advice":{"filePath":"assets/audio/voices/3/right_think.wav","string":"It was on the RIGHT, I think","loaded":true,"loading":true,"data":null,"buffer":{},"side":1,"confidence":0},"lastQuestionnaireAdvisorId":2,"questionnaires":[{"startTime":117765.00000013039,"responseStartTime":117766.00000006147,"rt":27165.000000037253,"response":[{"id":0,"name":"Benevolence","answer":"88","prompt":"","lastChangedTime":123694.00000013411},{"id":1,"name":"Likability","answer":"75","prompt":"","lastChangedTime":130425.99999997765},{"id":2,"name":"Ability","answer":"77","prompt":"","lastChangedTime":141829.00000014342}],"stimulus_properties":null,"trial_type":"function-sliders-response","trial_index":15,"time_elapsed":144680,"internal_node_id":"0.0-8.0","afterTrial":4,"advisorId":1},{"startTime":156348.99999992922,"responseStartTime":156348.99999992922,"rt":16470.00000020489,"response":[{"id":0,"name":"Benevolence","answer":"66","prompt":"","lastChangedTime":163094.99999997206},{"id":1,"name":"Likability","answer":"59","prompt":"","lastChangedTime":169456.0000000056},{"id":2,"name":"Ability","answer":"67","prompt":"","lastChangedTime":168684.0000001248}],"stimulus_properties":null,"trial_type":"function-sliders-response","trial_index":18,"time_elapsed":172566,"internal_node_id":"0.0-11.0","afterTrial":4,"advisorId":2},{"startTime":172820.0000000652,"responseStartTime":172820.0000000652,"rt":13528.999999864027,"response":[{"id":0,"name":"Benevolence","answer":"67","prompt":"","lastChangedTime":176593.0000001099},{"id":1,"name":"Likability","answer":"67","prompt":"","lastChangedTime":180803.00000007264},{"id":2,"name":"Ability","answer":"72","prompt":"","lastChangedTime":182608.00000000745}],"stimulus_properties":null,"trial_type":"function-sliders-response","trial_index":19,"time_elapsed":186097,"internal_node_id":"0.0-12.0","afterTrial":4,"advisorId":3},{"startTime":251505.00000012107,"responseStartTime":251505.00000012107,"rt":5902.000000001863,"response":[{"id":0,"name":"Benevolence","answer":"98","prompt":"","lastChangedTime":254773.0000000447},{"id":1,"name":"Likability","answer":"100","prompt":"","lastChangedTime":255591.0000000149},{"id":2,"name":"Ability","answer":"98","prompt":"","lastChangedTime":256313.00000008196}],"stimulus_properties":null,"trial_type":"function-sliders-response","trial_index":45,"time_elapsed":257155,"internal_node_id":"0.0-16.0","afterTrial":12,"advisorId":3},{"startTime":257408.00000005402,"responseStartTime":257408.00000005402,"rt":5217.999999877065,"response":[{"id":0,"name":"Benevolence","answer":"62","prompt":"","lastChangedTime":259844.99999997206},{"id":1,"name":"Likability","answer":"63","prompt":"","lastChangedTime":261250},{"id":2,"name":"Ability","answer":"64","prompt":"","lastChangedTime":261969.00000004098}],"stimulus_properties":null,"trial_type":"function-sliders-response","trial_index":46,"time_elapsed":262374,"internal_node_id":"0.0-17.0","afterTrial":12,"advisorId":2}]}';