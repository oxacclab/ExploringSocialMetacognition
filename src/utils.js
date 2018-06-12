/** General utility functions
 *  Matt Jaquiery, Feb 2018
 */


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

export {shuffle, shuffleShoe, sumList, copyArray, orderArray, copyObject, getMatches, applyClassToChildren, round,
    getSequence}