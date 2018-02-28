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
            if (misses === 0)
                return returnArray? [NaN] : NaN;
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
            });

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
        }

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
    }
};