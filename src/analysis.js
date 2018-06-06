/**
 * Analysis functions for Exploring Social Metacognition
 * Matt Jaquiery, Feb 2018
 *
 * Javascript library for running social metacognition analyses.
 */

"use strict";
import {Trial, utils} from "./exploringSocialMetacognition.js";

/**
 * @class advisorChoice
 *
 * Functions pertaining to the advisorChoice experiment
 */
class advisorChoice {
    /**
     * Return the overall accuracy of the judge
     *
     * @param {Trial[]} trials - trial list
     * @param {boolean} firstResponse - whether to query initial response rather than final response
     * @param {boolean} returnArray - whether to return an array with proportion hits, hits, and misses
     * @returns {number[]|number} - proportion of hits / total [, hits, misses]
     */
    overallAccuracy(trials, returnArray = false, firstResponse = true) {
        let hits = 0;
        let misses = 0;
        let i = firstResponse? 0 : 1;
        trials.forEach(function (trial) {
            if (trial.answer[i] === null || trial.whichSide === null
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
    }

    /**
     * Return accuracy summary broken down by decision
     * @param {Trial[]} trials - trial list
     * @returns {{initial: number[], final: number[], combined: number[]}}
     */
    accuracySummary(trials) {
        let initial = this.overallAccuracy(trials, true, true);
        let final = this.overallAccuracy(trials, true, false);
        let combined = [
            (initial[1]+final[1]) / (initial[1]+initial[2]+final[1]+final[2]),
            (initial[1]+final[1]),
            (initial[2]+final[2])
        ];
        return {initial, final, combined};
    }

    /**
     * Return the mean confidence of trials
     * @param {Trial[]} trials - trial list
     * @param {boolean} firstResponse - whether to extract the initial vs final response
     * @returns {number|number[]} - [mean, sum, count] or NaN if no trials are found
     */
    meanConfidence(trials, firstResponse = true) {
        let sum = 0;
        let count = 0;
        let i = firstResponse? 0 : 1;
        trials.forEach(function (trial) {
            if (trial.confidence[i] === null || isNaN(trial.confidence[i]))
                return;
            sum += trial.confidence[i];
            count++;
        });
        if (count===0)
            return NaN;
        return [sum/count, sum, count];
    }

    /**
     * Get a summary of confidence for inital, final, and combined scores
     * @param {Trial[]} trials - trial list
     * @returns {{initial: number[], final: number[], combined: number[]}}
     */
    confidenceSummary(trials) {
          let initial = this.meanConfidence(trials, true);
          let final = this.meanConfidence(trials, false);
          let combined = [
              (initial[1]+final[1] / (initial[1]+initial[2]+final[1]+final[2])),
              (initial[1]+final[1]),
              (initial[2]+final[2])
          ];
          return {initial, final, combined};
    }

    /**
     * Confidence broken down by whether the initial/final decision was in/correct
     * @param trials
     * @returns {{initial: {correct: *|{initial: number[], final: number[], combined: number[]}, incorrect: *|{initial: number[], final: number[], combined: number[]}}, final: {correct: *|{initial: number[], final: number[], combined: number[]}, incorrect: *|{initial: number[], final: number[], combined: number[]}}}}
     */
    confidenceBreakdown(trials) {
        let self = this;
        let initialCorrectTrials = utils.getMatches(trials, function(trial) {
            return self.accuracySummary([trial]).initial[0] === 1;
        });
        let initialIncorrectTrials = utils.getMatches(trials, function(trial) {
            return self.accuracySummary([trial]).initial[0] === 0;
        });
        let finalCorrectTrials = utils.getMatches(trials, function(trial) {
            return self.accuracySummary([trial]).final[0] === 1;
        });
        let finalIncorrectTrials = utils.getMatches(trials, function(trial) {
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
    }

    /**
     * Return true if the advice offered on *trial* was correct
     * @param {Trial} trial
     * @returns {boolean}
     */
    static isGoodAdvice(trial) {
        if (trial.advisorAgrees === null || trial.whichSide === null
            || trial.answer === null || isNaN(trial.answer[0]))
            return false;
        if (trial.answer[0] === trial.whichSide && trial.advisorAgrees)
            return true;
        return trial.answer[0] !== trial.whichSide && !trial.advisorAgrees;

    }

    /**
     * Return the accuracy of the advisor
     * @param {Trial[]} trials - trial list
     * @param {int} advisorId - id of the advisor
     * @returns {number[]} - [mean accuracy, hits, misses]
     */
    static advisorAccuracy(trials, advisorId) {
        let hits = utils.getMatches(trials, function(trial) {
            return (trial.advisorId === advisorId && advisorChoice.isGoodAdvice(trial));
        }).length;
        let misses = utils.getMatches(trials, function(trial) {
            return (trial.advisorId === advisorId && !advisorChoice.isGoodAdvice(trial));
        }).length;

        if (misses === 0 && hits === 0)
            return [NaN, 0, 0];
        if (misses === 0)
            return [1, hits, misses];
        return [hits/(hits+misses), hits, misses];
    }

    /**
     * Return the influence rating of the advice on *trial*
     * @param {Trial} trial
     * @returns {number}
     */
    static getInfluence(trial) {
        if (trial.advisorId === null || trial.advisorAgrees === null
            || trial.confidence === null || isNaN(trial.confidence[0]))
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
    }

    /**
     * Return the maximum influence the advisor could have had on *trial* given the initial confidence
     * @param {Trial} trial
     * @returns {number}
     */
    static getMaxInfluence(trial) {
        if (trial.advisorId === null || trial.advisorAgrees === null
            || trial.confidence === null || isNaN(trial.confidence[0]))
            return 0;
        // advisor agrees; max influence 100-confidence
        if (trial.advisorAgrees)
            return 100 - trial.confidence[0];
        else // advisor disagrees; max influence is 100+confidence
            return 100 + trial.confidence[0];
    }

    getTotalInfluence(trials, advisorId) {
        let influence = [];
        trials.forEach(function (trial){
            if (trial.advisorId !== advisorId)
                return;
            influence.push(advisorChoice.getInfluence(trial));
        });
        if (!influence.length)
            return NaN;
        let sum = 0;
        influence.forEach((x)=>{sum+=x});
        return sum/influence.length;
    }

    /**
     * Return the portion of good advice utilized by the judge. Can be >1 if the judge disagrees on incorrect
     * advice trials (the 'max' simply ignores advice on incorrect trials).
     *
     * @param {Trial[]} trials - trial list
     * @param {int} advisorId - advisor id
     * @returns {number[]} - [influence/maxInfluence, influence, maxInfluence]
     */
    static strategicAdviceUsage(trials, advisorId) {
        let goodAdviceTrials = utils.getMatches(trials, function(trial) {
            return trial.advisorId === advisorId && advisorChoice.isGoodAdvice(trial);
        });
        let badAdviceTrials = utils.getMatches(trials, function(trial) {
            return trial.advisorId === advisorId && !advisorChoice.isGoodAdvice(trial);
        });
        let maxInfluence = 0;
        let influence = 0;
        // Judge accrues points for heeding good advice
        goodAdviceTrials.forEach(function (trial) {
            maxInfluence += advisorChoice.getMaxInfluence(trial);
            influence += advisorChoice.getInfluence(trial);
        });
        // Judge looses points for heeding bad advice
        badAdviceTrials.forEach(function (trial) {
            influence -= advisorChoice.getInfluence(trial);
        });

        return [influence/maxInfluence, influence, maxInfluence];
    }

    adviceAnswerChanges(trials, advisorId) {
        let advisorChangedTrials = utils.getMatches(trials, function (trial) {
            if (trial.advisorId !== advisorId)
                return false;
            if (trial.answer[0] === trial.answer[1])
                return false;
            return trial.advisorAgrees;
        });
        if (advisorChangedTrials.length === 0)
            return [NaN, 0, 0];
        let hits = utils.getMatches(advisorChangedTrials, function(trial) {
            return trial.answer[1] === trial.whichSide;
        }).length;
        let misses = advisorChangedTrials.length - hits;
        if (misses === 0)
            return [NaN, hits, misses];
        else
            return [hits/misses, hits, misses];
    }

    /**
     * Return the proportion of possible choices in which this advisor was chosen
     * @param {Trial[]} trials - trial list
     * @param {int} advisorId - id of the candidate advisor
     * @returns {number[]}
     */
    advisorChoiceRate(trials, advisorId) {
        let choiceTrials = utils.getMatches(trials, function(trial) {
            return trial.choice.length && trial.choice.indexOf(advisorId) !== -1;
        });
        if (!choiceTrials.length)
            return [NaN];
        let chosenTrials = utils.getMatches(choiceTrials, function(trial) {
            return trial.advisorId === advisorId;
        });
        return [chosenTrials.length/choiceTrials.length, chosenTrials.length, choiceTrials.length];
    }

    /**
     * Show feedback based on a Governor object
     * @param {AdvisorChoice} g
     */
    showFeedback(g) {
        let self = this;
        let advisors = utils.copyArray(g.advisors);
        advisors.shift(); // drop the practice advisor
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
        let permalinkDiv = thanksDiv.appendChild(document.createElement('div'));
        permalinkDiv.className = 'permalink-container';
        let permalinkLabel = permalinkDiv.appendChild(document.createElement('div'));
        permalinkLabel.className = 'permalink-label';
        permalinkLabel.innerText = 'Permanent link:';
        let permalinkLink = permalinkDiv.appendChild(document.createElement('div'));
        permalinkLink.className = 'permalink-link';
        permalinkLink.innerText = window.location.origin + '/' + window.location.pathname.split('/')[1] +
            '/feedback.html?uid=' + g.participantId;
        let permalinkCopy = permalinkDiv.appendChild(document.createElement('div'));
        permalinkCopy.className = 'permalink-copy';
        permalinkCopy.onclick = function(){
            let linkDiv = document.querySelector('div.permalink-link');
            let range = document.createRange();
            range.selectNodeContents(linkDiv);
            window.getSelection().removeAllRanges();
            window.getSelection().addRange(range);
            document.execCommand('copy');
        };
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
        let post = utils.round(pre.final[0]*100,1);
        pre = utils.round(pre.initial[0]*100,1);
        accuracyDescription.innerHTML = "<p>The task difficulty changes based on your performance so that we " +
            "can compare advice-taking properly. Your initial accuracy should be approximately 71%. " +
            "We expect most people to have higher accuracy after advice than " +
            "before advice. Your pre-advice accuracy was <strong>"+pre+
            "%</strong>, and your post-advice accuracy " +
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
        for(let aS=0; aS<advisors.length/2; aS++) {
            let advisorContainer = document.createElement('div');
            advisorContainer.id = 'advisorContainer' + aS.toString();
            advisorContainer.className = 'advisor-container container';
            advisorSection.appendChild(advisorContainer);
            for(let a=aS*2; a<aS*2+2; a++) {
                let advisor = advisors[a];
                let i = advisor.id;
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
                let last = statsContainer.appendChild(document.createElement('p'));
                last.innerHTML= "<em>Agrees when "+(advisor.adviceType===3? 'confident' : 'uncertain')+"</em>";
                last.title = 'When your initial decision is correct, this advisor is '+
                    (advisor.adviceType === 1? 'more' : 'less')+
                    ' likely to agree with you if you are more confident ' +
                    'in your initial decision.';
                last = statsContainer.appendChild(document.createElement('p'));
                last.innerHTML = "Chosen: <strong>"+
                    utils.round(self.advisorChoiceRate(g.trials, advisor.id)[0]*100,1).toString()+'%</strong>';
                last.title = 'How many times did you select this advisor when you had a choice?';
                last = statsContainer.appendChild(document.createElement('p'));
                last.innerHTML = "Influence: <strong>"+
                    utils.round(self.getTotalInfluence(g.trials, advisor.id),1).toString()+'</strong>';
                last.title = 'How much did you change your confidence after hearing this advisor\'s advice.';
                let changedAnswers = self.adviceAnswerChanges(g.trials, advisor.id);
                last = statsContainer.appendChild(document.createElement('p'));
                last.innerHTML = "Mistakes avoided: <strong>"+changedAnswers[1]+'</strong>';
                last.title = 'How many times did you get the initial decision wrong, '+
                    'but correct it after hearing ' +
                    'this advisor\'s advice?';
                last = statsContainer.appendChild(document.createElement('p'));
                last.innerHTML = "Mistakes caused: <strong>"+changedAnswers[2]+'</strong>';
                last.title = 'How many times did you get the initial decision correct, ' +
                    'but select the wrong answer ' +
                    'after hearing this advisor\'s advice?';
                stats.appendChild(statsContainer);
                statsDiv.appendChild(stats);
                // graphs (questionnaire answers over time)
                let graphDiv = document.createElement('div');
                graphDiv.id = 'advisor'+i+'graph';
                graphDiv.className = 'advisor-graph graph';
                advisorDiv.appendChild(graphDiv);
                advisorContainer.appendChild(advisorDiv);
            }
        }

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
        let postconf = utils.round(preconf.final[0]*100,1);
        pre = utils.round(preconf.initial[0]*100,1);
        confidenceDescription.innerHTML = "<p>Your confidence is presented here broken down by whether " +
            "or not your final decision was correct. Most people show a pattern where they are more confident " +
            "when they are correct than when they are mistaken. Additionally, most people are more confident " +
            "after receiving advice than they were on their initial decision.</p>";
        confidenceContainer.appendChild(confidenceDescription);

        // apply 'feedback' class to all elements for styling purposes
        body.className += ' feedback';
        utils.applyClassToChildren(body, 'feedback');
        body.style.backgroundColor = 'ghostwhite';

        // fill in graphs
        this.getAccuracyGraph(g, accuracyGraph);
        this.getConfidenceFeedback(g, confidenceGraph);
        advisors.forEach(function (advisor) {
            let graphDiv = document.querySelector('#advisor'+advisor.id+'graph');
            self.getQuestionnaireGraph(g, advisor.id, graphDiv);
        })
    }

    /**
     * Display a graph of questionnaire responses for a given advisor. Uses google graph API.
     * @param {AdvisorChoice} input
     * @param {int} advisorId - the advisor who is the subject of the graph
     * @param {Element} div - div to draw the graph in
     */
    getQuestionnaireGraph(input, advisorId, div) {
        // Create the data table.
        let raw = [
            ['Time', 'Likeable', 'Capable', 'Helping']
        ];

        let timepoint = 0;
        let Qs = utils.getMatches(input.questionnaires, function(questionnaire) {
            return questionnaire.advisorId === advisorId;
        });
        for (let q=0; q<Qs.length; q++) {
            let Q = Qs[q];
            let likeable = "0";
            let capable = "0";
            let helping = "0";
            for (let r=0; r<Q.response.length; r++) {
                switch(Q.response[r].name) {
                    case "Likeability":
                        likeable = Q.response[r].answer;
                        break;
                    case "Ability":
                        capable = Q.response[r].answer;
                        break;
                    case "Benevolence":
                        helping = Q.response[r].answer;
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
    }

    /**
     * Display a graph of participant accuracy. Uses google graph API.
     * @param {AdvisorChoice} input
     * @param {HTMLElement} div - div to draw the graph in
     */
    getAccuracyGraph(input, div) {
        let advisors = [];
        for (let a=1; a<input.advisors.length; a++) {
            advisors.push(input.advisors[a]);
        }
        let judgeAcc = this.accuracySummary(input.trials);

        // Create the data table.
        let raw = [
            ['Person', 'Accuracy', { role: 'style' }],
            ['You (pre advice)', judgeAcc.initial[0]*100, 'blue'],
            ['You (post advice)', judgeAcc.final[0]*100, 'cornflower']
        ];

        let col = ['silver', '#e5e4e2'];
        let coli = 0;
        advisors.forEach(function(advisor) {
            raw.push([
                advisor.name,
                advisorChoice.advisorAccuracy(input.trials, advisor.id)[0]*100,
                col[coli++]
            ]);
        });
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
    }

    /**
     * Display a graph of participant confidence. Uses google graph API.
     * @param {Governor} input
     * @param {HTMLElement} div - div to draw the graph in
     */
    static getConfidenceGraph(input, div) {
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
    }

    /**
     * Show the confidence breakdown using positions on the sliders
     * @param {Governor} input - data holder
     * @param {HTMLElement} div - div to draw the output inside
     */
    getConfidenceFeedback(input, div) {
        let confReport = this.confidenceBreakdown(input.trials);
        // Draw a representation of the slider
        let container = div.appendChild(document.createElement('div'));
        container.className = 'feedback confidenceBarContainer';
        let label = container.appendChild(document.createElement('h3'));
        label.id = 'confidenceBarLabel';
        label.className = 'confidenceLabel preAdvice feedback';
        label.innerText = 'Before taking advice';
        let bar = container.appendChild(document.createElement('div'));
        bar.id = 'confidenceBarPre';
        bar.className = 'feedback confidenceBar preAdvice';
        // Add indicators for the various positions
        let correctPre = bar.appendChild(document.createElement('div'));
        correctPre.id = 'confidenceCorrectPre';
        correctPre.className = 'confidenceMarker correct preAdvice feedback';
        correctPre.style.left = confReport.final.correct.initial[0].toString()+'%';
        let incorrectPre = bar.appendChild(document.createElement('div'));
        incorrectPre.id = 'confidenceIncorrectPre';
        incorrectPre.className = 'confidenceMarker incorrect preAdvice feedback';
        incorrectPre.style.left = 'calc(-20px + '+confReport.final.incorrect.initial[0].toString()+'%)';
        // Repeat the steps for post-advice
        let containerPost = div.appendChild(document.createElement('div'));
        containerPost.className = 'feedback confidenceBarContainer';
        let barPost = containerPost.appendChild(document.createElement('div'));
        barPost.id = 'confidenceBarPost';
        barPost.className = 'feedback confidenceBar postAdvice';
        let correctPost = barPost.appendChild(document.createElement('div'));
        correctPost.id = 'confidenceCorrectPost';
        correctPost.className = 'confidenceMarker correct postAdvice feedback';
        correctPost.style.left = confReport.final.correct.final[0].toString()+'%';
        let incorrectPost = barPost.appendChild(document.createElement('div'));
        incorrectPost.id = 'confidenceIncorrectPost';
        incorrectPost.className = 'confidenceMarker incorrect postAdvice feedback';
        incorrectPost.style.left = 'calc(-20px + '+confReport.final.incorrect.final[0].toString()+'%)';
        let labelPost = containerPost.appendChild(document.createElement('h3'));
        labelPost.id = 'confidenceBarLabel';
        labelPost.className = 'confidenceLabel postAdvice feedback';
        labelPost.innerText = 'After taking advice';
        // Add popups
        let cpChild = correctPre.appendChild(document.createElement('div'));
        cpChild.className = 'confidencePopup correct preAdvice feedback';
        cpChild.innerHTML = 'Your average confidence before advice was <strong>'+
            utils.round(confReport.final.correct.initial[0],1,true).toString()+
            '</strong> when you were correct.';
        let ipChild = incorrectPre.appendChild(document.createElement('div'));
        ipChild.className = 'confidencePopup incorrect preAdvice feedback';
        ipChild.innerHTML = 'Your average confidence before advice was <strong>'+
           utils.round(confReport.final.incorrect.initial[0],1,true).toString()+
            '</strong> when you were incorrect.';
        let ctChild = correctPost.appendChild(document.createElement('div'));
        ctChild.className = 'confidencePopup correct postAdvice feedback';
        ctChild.innerHTML = 'Your average confidence after advice was <strong>'+
            utils.round(confReport.final.correct.final[0],1,true).toString()+
            '</strong> when you were correct.';
        let itChild = incorrectPost.appendChild(document.createElement('div'));
        itChild.className = 'confidencePopup incorrect postAdvice feedback';
        itChild.innerHTML = 'Your average confidence after advice was <strong>'+
            utils.round(confReport.final.incorrect.final[0],1,true).toString()+
            '</strong> when you were incorrect.';
    }
}

export {advisorChoice};