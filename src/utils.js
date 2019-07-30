/** General utility functions
 *  Matt Jaquiery, Feb 2018
 */

/**
 * Return the value of key in the query string
 * @param key {string}
 * @return {string|null}
 */
function getQueryStringValue(key) {
    let regex = new RegExp("[?&]?" + key + "=([^&]+)", "i");
    let test = regex.exec(window.location.search);
    if(test)
        return test[1];
    return null;
}

function applyClassToChildren (element, classname, recursive = true) {
    for (let i=0; i<element.childElementCount; i++) {
        let child = element.children[i];
        child.classList.add(classname);
        if (recursive)
            applyClassToChildren(child, classname, true);
    }
}

/**
 * return a new copy of an array
 *
 * @param {Array} array - array to copy
 * @param {boolean} [recursive=true] - whether to create new copies of arrays within *array*
 * @returns {Array}
 */
function copyArray(array, recursive = true) {
    let out = [];
    for (let i=0; i<array.length; i++) {
        if(Array.isArray(array[i]) && recursive)
            out.push(copyArray(array[i]), true);
        else
            out.push(array[i]);
    }
    return out;
}

/**
 * Return a new copy of object
 *
 * @param {object} obj - object to copy
 * @param {boolean} [deep=true] - whether to recursively copy child objects
 * @returns {object} - copy of *obj*
 */
function copyObject(obj, deep = true) {
    let out = {};
    for(let k=0; k<Object.keys(obj).length; k++) {
        let key = Object.keys(obj)[k];
        if (typeof obj[key] === 'object' && deep)
            out[key] = copyObject(obj[key], deep);
        else
            out[key] = obj[key];
    }
    return out;
}

/**
 * Return a subset of list where items within it return true when fed into matchFunc
 * @param {Array} array - array to examine
 * @param {function} matchFunc - function to examine items with
 * @returns {Array} - array of items in *array* which pass *matchFunc*
 */
function getMatches (array, matchFunc) {
    let out = [];
    array.forEach(function (item) {
        if (matchFunc(item))
            out.push(item);
    });
    return out;
}

/**
 * Return a list of every **by**th number from start to end (inclusive)
 * @param {Number} start - starting number
 * @param {Number} end - number to end on
 * @param {Number} by - difference between successive numbers in the list
 * @return {Number[]}
 */
function getSequence(start, end, by=1) {
    let seq = [];
    if(start > end) // go backwards
        for(let i=start; i>=end; i-=by)
            seq.push(i);
    else
        for(let i=start; i<=end; i+=by)
            seq.push(i);
    return seq;
}

/**
 * Return *array* ordered according to a second array containing the indices of the new order. If the order array
 * is shorter than the value array, the order array is repeated. A warning is issued if the length of the first
 * array is not neatly divisible by the length of the second.
 *
 * orderArray([11, 12, 13, 14, 15], [0, 2, 4, 1, 3]) -> [11, 13, 15, 12, 14]
 * orderArray([1, 2, 3, 4, 5, 6], [1, 0]) -> [2, 1, 4, 3, 6, 5]
 *
 * @param {Array} array - the array of values to reorder
 * @param {int[]} order - the array of indices specifying the order into which the value array should be placed
 * @returns {Array} - *array* ordered by *order*
 */
function orderArray(array, order) {
    let out = [];
    let o = 0;
    let pass = 0;
    if (array.length % order)
        console.warn('orderArray: length of array not a multiple of order list length. The array is reordered, but '+
            'this might be due to providing the wrong values.');
    for (let i=0; i<array.length; i++) {
        out[i] = array[order[o]+pass*order.length];
        if (o >= order.length-1) {
            o = 0;
            pass++;
        } else
            o++;
    }
    return out;
}

/**
 * TODO: remove this and replace with call to Number.toFixed()
 * Round x to a specified number of decimal places
 * @param x {number} - number to round
 * @param {number} [decimals=0] - number of decimal places to which to round x
 * @param {boolean} [asPaddedString=false] - whether to return a string with zeros added to fill out truncated values
 * @return {number|string} - x rounded to *decimals* decimal places
 */
function round (x, decimals = 0, asPaddedString=false) {
    let y = Math.pow(10, decimals);
    let ans = Math.round(x * y) / y;
    if(!asPaddedString || decimals <= 0)
        return ans;
    ans = ans.toString();
    let d = 0;
    if(ans.indexOf('.')===-1) {
        d = decimals;
        ans = ans + '.';
    }
    else
        d = decimals - ans.split('.')[1].length;
    for(let i=0;i<d;i++)
        ans = ans + '0';
    return ans;
}

/**
 * https://stackoverflow.com/questions/6274339/how-can-i-shuffle-an-array
 */
function shuffle(array) {
    let counter = array.length;

    if(counter === 2)
        return Math.random() < .5? array : array.reverse();

    // While there are elements in the array
    while (counter > 0) {
        // Pick a random index
        let index = Math.floor(Math.random() * counter);

        // Decrease counter by 1
        counter--;

        // And swap the last element with it
        let temp = array[counter];
        array[counter] = array[index];
        array[index] = temp;
    }

    return array;
}

/**
 * Return a single array containing deckCount copies of deck shuffled together
 */
function shuffleShoe(deck, deckCount=1) {
    let shoe = [];
    for (let d=0; d<deck.length; d++) {
        let item = deck[d];
        for (let i=0; i<deckCount; i++) {
            shoe.push(item);
        }
    }
    return shuffle(shoe);
}

/**
 * Sum the contents of a list
 *
 * @param {number|number[]|Object|Object[]} list - list of numbers to be summed
 * @param {boolean} recursive - whether to call sumList on lists within list
 * @param {boolean} ignoreBadValues - whether to ignore non-finite values in *list*
 * @returns {number}
 */
function sumList(list, recursive = true, ignoreBadValues = true) {
    if(typeof list !== 'object')
        return NaN;
    let sum = 0;
    for(let i=0; i<Object.keys(list).length; i++) {
        let k = Object.keys(list)[i];
        if(!isFinite(list[k])) {
            if(typeof list[k] === 'object') {
                let tmp = sumList(list[k], recursive, ignoreBadValues);
                if(isNaN(tmp))
                    return NaN;
                else
                    sum += tmp;
            } else {
                if(!ignoreBadValues)
                    return NaN;
            }
        } else {
            if(isFinite(list[k]))
                sum += list[k]
        }
    }
    return sum;
}

/**
 * The mean of numbers in a list
 * @param {[]} list
 * @return {number}
 */
function mean(list) {
    let mean = 0;
    list.forEach((x)=>mean += parseFloat(x));
    mean /= list.length;
    return mean;
}

/**
 * The standard deviation of numbers in a list
 * @param {[]} list
 * @param {boolean} [population=true] whether to return the population as opposed to the sample standard deviation
 * @return {number}
 */
function stDev(list, population = true) {
    let m = mean(list);
    let errors = 0;
    list.forEach((x)=>errors += Math.pow(parseFloat(x) - m, 2));

    let variance = errors / (population? list.length : list.length - 1);

    return Math.sqrt(variance);
}

/**
 * The largest value in a list
 * @param {[]} list
 * @param {boolean} [abs=false] whether to check absolute values
 * @return {number}
 */
function max(list, abs = false) {
    let max = -Infinity;
    list.forEach(function(x) {
        x = parseFloat(x);
        if(x > max || (Math.abs(x) > max && abs))
            max = x;
    });
    return max;
}

/**
 * The smallest value in a list
 * @param {[]} list
 * @param {boolean} [abs=false] whether to check absolute values
 * @return {number}
 */
function min(list, abs = false) {
    let min = Infinity;
    list.forEach(function(x) {
        x = parseFloat(x);
        if(x < min || (Math.abs(x) < min && abs))
            min = x;
    });
    return min;
}

/**
 * Express a number (e.g. 20) as letters (e.g. two zero)
 * @param num {number}
 * @return {string}
 */
function numberToLetters(num) {
    let out = "";

    let s = num.toString();
    for(let i = 0; i < s.length; i++) {
        if(i > 0)
            out += " ";
        switch(s[i]) {
            case ".":
                out += "point"; break;
            case "0":
                out += "zero"; break;
            case "1":
                out += "one"; break;
            case "2":
                out += "two"; break;
            case "3":
                out += "three"; break;
            case "4":
                out += "four"; break;
            case "5":
                out += "five"; break;
            case "6":
                out += "six"; break;
            case "7":
                out += "seven"; break;
            case "8":
                out += "eight"; break;
            case "9":
                out += "nine"; break;
        }
    }

    return out;
}

/**
 * Generate a random number between min and max (inclusive)
 * @param [min=0]
 * @param [max=1]
 * @param [int=true] {boolean} whether to return an int
 * @return {number}
 */
function randomNumber(min = 0, max = 1, int = true) {
    let x = Math.random() * (max - min + 1) + min;
    return int? Math.floor(x) : x;
}

/**
 * Box-Muller Transform sampling from the normal distribution.
 * @param [n = 1] {number}  samples to take
 * @param [mean = 0] {number} mean of the normal distribution
 * @param [sd = 1] {number} standard deviation of the distribution
 * @return {number|number[]} random sample(s) from the normal distribution
 */
function sampleNormal(n = 1, mean = 0, sd = 1) {
    if(n > 1)
        return getSequence(1, n).map(() => sampleNormal(1, mean, sd));

    const a = Math.random();
    const b = Math.random();

    const x = Math.sqrt(-2 * Math.log(a));
    const y = Math.cos(2 * Math.PI * b);

    return ((x * y) * sd) + mean;
}

/**
 * Returns the probability density of the normal distribution (mean, sd) for a given z-score
 * @param z {number | number[]} z-score
 * @param mean {number}
 * @param sd {number}
 * @return {number | number[]}
 */
function zToNormal(z, mean = 0, sd = 1) {
    // Support for vectored inputs
    if(typeof z === "object")
        return z.map(x => zToNormal(x, mean, sd));

    const scale = 1 / Math.sqrt(2 * Math.PI * Math.pow(sd, 2));
    const exp = Math.pow(z - mean, 2) / (2 * Math.pow(sd, 2));

    return scale * Math.exp(-exp);
}


export {getQueryStringValue, shuffle, shuffleShoe, sumList, mean, stDev, max, min, copyArray, orderArray, copyObject, getMatches, applyClassToChildren, round, getSequence, numberToLetters, randomNumber, sampleNormal, zToNormal}