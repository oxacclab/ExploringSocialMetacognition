import * as utils from "../../../utils.js";
import {BaseObject} from "../../Prototypes.js";

/**
 * @class AdviceType
 * @classdesc AdviceTypes define the circumstances which must obtain on a trial
 * in order for the advisor to offer the particular kind of advice. E.g. if
 * we desire the advisor to give an answer which spans both the participant's
 * response and the correct answer, this will be possible on some trials and
 * impossible on others given some limitations on advice width.
 * AdviceTypes offer a fallback AdviceType for use when they are not available.
 * AdviceTypes are shallow objects to enable easy copying of the pre-defined
 * examples presented here.
 *
 * @property name {string}
 * @property flag {int} flag number (e.g. 2^x)
 * @property fallback {string|int} name or flag of another AdviceType to use
 * where this type is inadmissable (fallbacks will fall back themselves if not
 * suitable, and an error arises if no fallback is possible)
 * @property matches {<number[]|null>function(<Trial>, <Advisor>)} given a trial
 * object, return a range specifying which values for the middle of the advice are consistent with this advice type (null if none are)
 * @property quantity {number} used to indicate how many trials should use this AdviceType
 */
class AdviceType extends BaseObject {
    constructor(blueprint) {
        super(blueprint);
    }

    /**
     * Produce a mutable copy of this object for actual use
     * @param quantity {int} number of these trials desired
     * @param properties {{}} object to be copied into the child.
     * @return {{quantity: int}} copy of this object + a quantity property
     */
    copy(quantity, properties) {
        return {
            ...this,
            quantity,
            ...properties
        };
    }
}

/*
* Specific AdviceTypes
* It is not expected that AdviceType is instantiated except by using one of the
* below.
* When supplying fallbacks, they should be included with quantity 0.
* */

// Agreement is always possible
const AGREE = Object.freeze(new AdviceType({
    name: "agree",
    flag: 1,
    fallback: null,
    /**
     * Values for middle consistent with agreement
     * @param t {Trial} at the post-initial-decision phase
     * @param a {Advisor} advisor giving advice
     * @param [self=null] {AdviceType|null} this object for self-referencing
     * @return {number[]|null}
     */
    match: (t, a, self = null) => {
        const w = Math.ceil(a.confidence / 2);
        let min = t.data.responseEstimateLeft - w;
        let max = t.data.responseEstimateLeft + t.data.responseMarkerWidth + w;
        // constrain to scale
        let minS = parseFloat(t.responseWidget.dataset.min);
        let maxS = parseFloat(t.responseWidget.dataset.max);
        return [
            utils.max([min, minS]),
            utils.min([max, maxS])
        ];
    }
}));

// Correct advice is always possible
const CORRECT = Object.freeze(new AdviceType({
    name: "correct",
    flag: 2,
    fallback: null,
    /**
     * Values for middle consistent with correctness
     * @param t {Trial} at the post-initial-decision phase
     * @param a {Advisor} advisor giving advice
     * @param [self=null] {AdviceType|null} this object for self-referencing
     * @return {number[]|null}
     */
    match: (t, a, self = null) => {
        const w = Math.ceil(a.confidence / 2);
        let min = t.correctAnswer - w;
        let max = t.correctAnswer + w;
        // constrain to scale
        let minS = parseFloat(t.responseWidget.dataset.min);
        let maxS = parseFloat(t.responseWidget.dataset.max);
        return [
            utils.max([min, minS]),
            utils.min([max, maxS])
        ];
    }
}));

// Incorrect advice is the participant's answer reflected on the correct answer
// Advice should disagree
const INCORRECT_REFLECTED = Object.freeze(new AdviceType({
    name: "disagreeReflected",
    flag: 4,
    fallback: 32,
    /**
     * Values for middle indicating incorrect answers roughly as wrong as the
     * participant's answer, but in the other direction.
     * @param t {Trial} at the post-initial-decision phase
     * @param a {Advisor} advisor giving advice
     * @param [self=null] {AdviceType|null} this object for self-referencing
     * @return {number[]|null}
     */
    match: (t, a, self = null) => {
        const w = Math.ceil(a.confidence / 2);
        const minError = w < 4? 4 : w;

        // Agreement values
        const minA = t.data.responseEstimateLeft - w;
        const maxA = t.data.responseEstimateLeft + t.data.responseMarkerWidth + w;

        // Target is the correct answer reflected in the middle of the
        // participant's answer
        let ans = Math.round(
            t.data.responseEstimateLeft +
            t.data.responseMarkerWidth / 2);
        let target = t.correctAnswer + (t.correctAnswer - ans);

        // If target is too near the correct answer, adjust it away
        if(Math.abs(ans - t.correctAnswer) < minError)
            target = (ans > t.correctAnswer)?
                t.correctAnswer - minError : t.correctAnswer + minError;

        // Keep target within the boundaries of the scale
        let minS = parseFloat(t.responseWidget.dataset.min);
        let maxS = parseFloat(t.responseWidget.dataset.max);
        if(target < minS + 2 * w)
            target = minS + 2 * w;
        else
        if(target > maxS - 2 * w)
            target = maxS - 2 * w;

        // If there's no conflict with the participant, return the target value
        let min = target - w;
        let max = target + w;
        if(min > maxA || max < minA)
            return [min, max];

        // If the participant is correct avoid the participant's response
        if(target - minA < maxA - target) // target below estimate
            if(min < minA - 1) // room for a marker
                return [min, minA - 1];
            else // no room; shift away from participant (missing target)
                return minA - 1 - w > minS? [minA - 1, minA - 1] : null;
        else // estimate below target
        if(maxA + 1 < max) // room for marker
            return [maxA + 1, max];
        else // no room; shift away from participant (missing target)
            return maxA + 1 + w < maxS? [maxA + 1, maxA + 1]: null;
    },
}));

// Agreeing and being correct falls back to being correct
const CORRECT_AGREE = Object.freeze(new AdviceType({
    name: "correctAgree",
    flag: 8,
    fallback: 1,
    /**
     * Values for middle consistent with simultaneous correctness and agreement
     * @param t {Trial} at the post-initial-decision phase
     * @param a {Advisor} advisor giving advice
     * @param [self=null] {AdviceType|null} this object for self-referencing
     * @return {number[]|null}
     */
    match: (t, a, self = null) => {
        const w = Math.ceil(a.confidence / 2);
        // Agreement values
        const minA = t.data.responseEstimateLeft - w;
        const maxA = t.data.responseEstimateLeft + t.data.responseMarkerWidth + w;
        // Correctness values
        const minC = t.correctAnswer - w;
        const maxC = t.correctAnswer + w;

        // find the intersected region
        let min = utils.max([minA, minC]);
        let max = utils.min([maxA, maxC]);
        // check for non-overlapping
        if(min > max)
            return null;

        return [min, max];
    }
}));

// Being correct and disagreeing falls back to being correct
const CORRECT_DISAGREE = Object.freeze(new AdviceType({
    name: "correctDisagree",
    flag: 16,
    fallback: 2,
    /**
     * Values for middle consistent with simultaneous disagreement and
     * correctness
     * @param t {Trial} at the post-initial-decision phase
     * @param a {Advisor} advisor giving advice
     * @param [self=null] {AdviceType|null} this object for self-referencing
     * @return {number[]|null}
     */
    match: (t, a, self = null) => {
        const w = Math.ceil(a.confidence / 2);

        // If the participant is correct this will not be possible
        if(t.data.responseEstimateLeft <= t.correctAnswer &&
            t.data.responseEstimateLeft + t.data.responseMarkerWidth >=
            t.correctAnswer)
            return null;

        // Agreement values
        const minA = t.data.responseEstimateLeft - w;
        const maxA = t.data.responseEstimateLeft + t.data.responseMarkerWidth + w;

        // Correctness values
        const minC = t.correctAnswer - w;
        const maxC = t.correctAnswer + w;

        // If the spans don't overlap just return correctness
        if(maxA < minC || minA > maxC)
            return [minC, maxC];

        if(minA < minC)
            return [maxA, maxC];
        return [minC, minA];
    },
}));


// Incorrect advice is the correct answer reflected on the participant's answer
// Advice should disagree. This is a fallback for disagreeReflected
const INCORRECT_REVERSED = Object.freeze(new AdviceType({
    name: "disagreeReversed",
    flag: 32,
    fallback: null,
    /**
     * Values for middle indicating incorrect answers roughly twice as wrong as the
     * participant's answer, in the same direction.
     * @param t {Trial} at the post-initial-decision phase
     * @param a {Advisor} advisor giving advice
     * @param [self=null] {AdviceType|null} this object for self-referencing
     * @return {number[]|null}
     */
    match: (t, a, self = null) => {
        const w = Math.ceil(a.confidence / 2);
        const minError = w < 4? 4 : w;

        // Agreement values
        const minA = t.data.responseEstimateLeft - w;
        const maxA = t.data.responseEstimateLeft + t.data.responseMarkerWidth + w;

        // Target is the correct answer reflected in the middle of the
        // participant's answer
        let ans = Math.round(t.data.responseEstimateLeft +
            t.data.responseMarkerWidth / 2);
        let target = ans + (ans - t.correctAnswer);

        // If target is too near the correct answer, adjust it away
        if(Math.abs(ans - t.correctAnswer) < minError)
            target = (ans > t.correctAnswer)?
                t.correctAnswer - minError : t.correctAnswer + minError;

        // Keep target within the boundaries of the scale
        let minS = parseFloat(t.responseWidget.dataset.min);
        let maxS = parseFloat(t.responseWidget.dataset.max);
        if(target < minS + 2 * w)
            target = minS + 2 * w;
        else
        if(target > maxS - 2 * w)
            target = maxS - 2 * w;

        // If there's no conflict with the participant, return the target value
        let min = target - w;
        let max = target + w;
        if(min > maxA || max < minA)
            return [min, max];

        // If the participant is correct avoid the participant's response
        if(target - minA < maxA - target) // target below estimate
            if(min < minA - 1) // room for a marker
                return [min, minA - 1];
            else // no room; shift away from participant (missing target)
                return minA - 1 - w > minS? [minA - 1, minA - 1] : null;
        else // estimate below target
        if(maxA + 1 < max) // room for marker
            return [maxA + 1, max];
        else // no room; shift away from participant (missing target)
            return maxA + 1 + w < maxS? [maxA + 1, maxA + 1]: null;
    },
}));


// Correct-normDist advice has a centre sampled from a (roughly) normal
// distribution around the correct answer. Out-of-range responses are replaced
// with another sampled response until a sample is found within the scale
// boundaries.
const CORRECTISH = Object.freeze(new AdviceType({
    name: "correctish",
    flag: 64,
    fallback: null,
    /**
     * Values for middle point sampled from normal-like (combined uniform)
     * distribution.
     * @param t {Trial} at the post-initial-decision phase
     * @param a {Advisor} advisor giving advice
     * @param [self=null] {AdviceType|null} this object for self-referencing
     * @return {number[]}
     */
    match: (t, a, self = null) => {
        const w = Math.ceil(a.confidence / 2);
        const minS = parseFloat(t.responseWidget.dataset.min);
        const maxS = parseFloat(t.responseWidget.dataset.max);

        // Don't give exactly the participant's response because when advice matches initial response WoA is undefined
        const pCentre = t.data.responseEstimateLeft +
            Math.floor(t.data.responseMarkerWidth / 2);

        // Normally distributed around the correct answer
        let c;
        let min;
        let max;
        let z;

        do {
            c = t.correctAnswer;
            z = utils.sampleNormal(1, 0, a.confidenceVariation);

            c += z;

            c = Math.round(c);
            min = c - w;
            max = c + w;
        } while(min < minS || max > maxS || c === pCentre);

        // constrain to scale
        return [c, c];
    }
}));


// Correct-normDist advice has a centre sampled from a (roughly) normal
// distribution around the correct answer. Out-of-range responses are replaced
// with another sampled response until a sample is found within the scale
// boundaries.
const AGREEISH = Object.freeze(new AdviceType({
    name: "agreeish",
    flag: 128,
    fallback: null,
    /**
     * Values for middle point sampled from normal-like (combined uniform)
     * distribution.
     * @param t {Trial} at the post-initial-decision phase
     * @param a {Advisor} advisor giving advice
     * @param [self=null] {AdviceType|null} this object for self-referencing
     * @return {number[]}
     */
    match: (t, a, self = null) => {
        const w = Math.ceil(a.confidence / 2);
        const minS = parseFloat(t.responseWidget.dataset.min);
        const maxS = parseFloat(t.responseWidget.dataset.max);

        // Don't give exactly the participant's response because when advice matches initial response WoA is undefined
        const pCentre = t.data.responseEstimateLeft +
            Math.floor(t.data.responseMarkerWidth / 2);

        // Normally distributed around the correct answer
        let c;
        let min;
        let max;
        let z;

        do {
            c = pCentre;
            z = utils.sampleNormal(1, 0, a.confidenceVariation);

            c += z;

            c = Math.round(c);
            min = c - w;
            max = c + w;
        } while(min < minS || max > maxS || c === pCentre);

        // constrain to scale
        return [c, c];
    }
}));


// AGREE_BY_CONF gives different advice depending on the confidence of the previous response. Advisors must have a confidenceOptions object containing a list of possible advice offsets (from the initial response) for each of the possible confidence levels. Advice is selected randomly from the available offsets, in the direction of the correct answer.
//
// Where the advice would not fit on the scale, Correct advice is used instead.
const AGREE_BY_CONF = Object.freeze(new AdviceType({
    name: "agree-in-conf",
    flag: 256,
    fallback: 2,
    /**
     * Values dependent on initial response + initial confidence.
     * @param t {Trial} at the post-initial-decision phase
     * @param a {Advisor} advisor giving advice
     * @param [self=null] {AdviceType|null} this object for self-referencing
     * @return {number[]}
     */
    match: (t, a, self = null) => {
        // Participant answer
        const ans = t.data.responseEstimateLeft +
            Math.floor(t.data.responseMarkerWidth / 2);

        const w = Math.ceil(a.confidence / 2);
        const minS = parseFloat(t.responseWidget.dataset.min);
        const maxS = parseFloat(t.responseWidget.dataset.max);

        const set = a.confidenceOptions[t.data.confidenceConfidence];
        const pick = set[utils.randomNumber(0, set.length - 1)];

        // Advice should be in the direction of the correct answer
        const c = t.correctAnswer > ans? ans + pick: ans - pick;

        // Test whether the target value works
        if(c + w > maxS || c - w < minS)
            return null;

        return [c, c];
    }
}));

// AGREE_OFFSET gives advice offset from the initial response by a given value specified as the Advisor's confidenceOffset. The advice is always in the direction of the correct answer.
//
// Where the advice would not fit on the scale, Correct advice is used instead.
const AGREE_OFFSET = Object.freeze(new AdviceType({
    name: "agree-offset",
    flag: 512,
    fallback: 2,
    /**
     * Values dependent on initial response + initial confidence.
     * @param t {Trial} at the post-initial-decision phase
     * @param a {Advisor} advisor giving advice
     * @param [self=null] {AdviceType|null} this object for self-referencing
     * @return {number[]}
     */
    match: (t, a, self = null) => {
        // Participant answer
        const ans = t.data.responseEstimateLeft +
            Math.floor(t.data.responseMarkerWidth / 2);

        const w = Math.ceil(a.confidence / 2);
        const minS = parseFloat(t.responseWidget.dataset.min);
        const maxS = parseFloat(t.responseWidget.dataset.max);

        const set = a.confidenceOffset;
        const pick = set[utils.randomNumber(0, set.length - 1)];

        // Advice should be in the direction of the correct answer
        const c = t.correctAnswer > ans? ans + pick: ans - pick;

        // Test whether the target value works
        if(c + w > maxS || c - w < minS)
            return null;

        return [c, c];
    }
}));


/**
 * Fetch the confidence from a set value. Applies the advisor's confidenceAddition.
 * @param advice {{
 *     adviceCentre: number,
 *     adviceWidth: number,
 *     advice: number,
 *     adviceSide: (number|null)}}
 * @param trial {Trial}
 * @param advisor {Advisor}
 * @param self {AdviceType|null}
 * @return {number}
 */
const getConfFromValue = function(advice, trial, advisor, self = null) {
    let conf = typeof self.confidenceValue === "function"?
        self.confidenceValue() : self.confidenceValue;
    if(advisor.confidenceAddition)
        conf += advisor.confidenceAddition;
    return conf;
};

/**
 * Advisor estimate which has both its direction and its difference from the anchor date specified at creation time.
 * @type {Readonly<AdviceType>}
 * @property correct {boolean|function} used to determine whether the answer should be correct
 * @property confidenceValue {number|function} used to determine what the confidence should be
 */
const EXACT_CONFIDENCE_BINARY = Object.freeze(new AdviceType({
    name: "binary-cheat-confidence",
    flag: 1024,
    fallback: null,
    /**
     * Return an answer which is Infinitely far from the anchor date in the in/correct direction. Correctness is specified in this object's correct {boolean} property.
     * @param t {Trial}
     * @param a {Advisor}
     * @param [self=null] {AdviceType|null} this object for self-referencing
     * @return {number[]}
     */
    match: (t, a, self = null) => {
        // Work out how to be in/correct
        const correct = typeof self.correct === "function"?
            self.correct() : self.correct;

        const side = (t.data.correctAnswerSide == correct)? 1 : -1;

        const c = t.anchorDate + side * Infinity;
        return [c];
    },
    confidence: getConfFromValue
}));

/**
 * Advisor estimate which agrees with the participant and has its confidence specified at creation time.
 * @type {Readonly<AdviceType>}
 * @property confidenceValue {number|function} used to determine what the confidence should be
 */
const AGREE_EXACT_CONFIDENCE_BINARY = Object.freeze(new AdviceType({
    name: "binary-agree-cheat-confidence",
    flag: 2048,
    fallback: null,
    /**
     * Return an answer whose side matches the participant's.
     * @param t {Trial}
     * @param a {Advisor}
     * @param [self=null] {AdviceType|null} this object for self-referencing
     * @return {number[]}
     */
    match: (t, a, self = null) => {
        const p = t.data.responseAnswerSide;
        const c = p? Infinity : -Infinity;
        return [c];
    },
    confidence: getConfFromValue
}));

/**
 * Advisor estimate which disagrees with the participant and has its confidence specified at creation time.
 * @type {Readonly<AdviceType>}
 * @property confidenceValue {number|function} used to determine what the confidence should be
 */
const DISAGREE_EXACT_CONFIDENCE_BINARY = Object.freeze(new AdviceType({
    name: "binary-disagree-cheat-confidence",
    flag: 4096,
    fallback: null,
    /**
     * Return an answer whose side doesn't match the participant's.
     * @param t {Trial}
     * @param a {Advisor}
     * @param [self=null] {AdviceType|null} this object for self-referencing
     * @return {number[]}
     */
    match: (t, a, self = null) => {
        const p = t.data.responseAnswerSide;
        const c = p? -Infinity : Infinity;
        return [c];
    },
    confidence: getConfFromValue
}));


export {
    AGREE_OFFSET,
    AGREE_BY_CONF,
    AGREEISH,
    CORRECTISH,
    INCORRECT_REVERSED,
    CORRECT_DISAGREE,
    CORRECT_AGREE,
    INCORRECT_REFLECTED,
    CORRECT,
    AGREE,
    EXACT_CONFIDENCE_BINARY,
    AGREE_EXACT_CONFIDENCE_BINARY,
    DISAGREE_EXACT_CONFIDENCE_BINARY
};