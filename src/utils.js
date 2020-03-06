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
 * Prevent a form from being submittable, especially on Safari
 * @param form {HTMLElement}
 * @return {HTMLElement} form
 */
function preventFormSubmission(form) {
    form.addEventListener("submit", (e)=>{e.preventDefault(); return false});

    return form;
}


/**
 * Split a comma-separated list into its component items
 * @param list {string} comma-separated list
 * @return {string[]} array of items in list
 */
function explodeCommaList(list) {
    const items = [];
    const r = new RegExp(/([^,]+)/g);
    while(true) {
        const match = r.exec(list);
        if(!match)
            break;

        // Clean up initial spaces for item
        let item = match[0];
        item = item.replace(/\s*/, "");

        items.push(item);
    }
    return items;
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
 * @param array {[]}
 * @return {[]}
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

/**
 * Return values from a cumulative normal distribution. Values calculated in r with
 * pnorm(seq(0, 4, .01))
 * @param x {int | int[]} values to find the distribution for
 * @param [mean=0] {int} mean of the distribution
 * @param [sd=1] {number} standard deviation of the distribution
 * @return {number | number[]} cumulative probability for x
 */
function pNorm(x, mean = 0, sd = 1) {
    // Support for vectored inputs
    if(typeof x == "object")
        return x.map(i => pNorm(i));

    // cumulative probabilities for z-scores 0-4 in .01 increments
    const R = [
        0.5000000, 0.5039894, 0.5079783, 0.5119665, 0.5159534, 0.5199388,
        0.5239222, 0.5279032, 0.5318814, 0.5358564, 0.5398278, 0.5437953,
        0.5477584, 0.5517168, 0.5556700, 0.5596177, 0.5635595, 0.5674949,
        0.5714237, 0.5753454, 0.5792597, 0.5831662, 0.5870644, 0.5909541,
        0.5948349, 0.5987063, 0.6025681, 0.6064199, 0.6102612, 0.6140919,
        0.6179114, 0.6217195, 0.6255158, 0.6293000, 0.6330717, 0.6368307,
        0.6405764, 0.6443088, 0.6480273, 0.6517317, 0.6554217, 0.6590970,
        0.6627573, 0.6664022, 0.6700314, 0.6736448, 0.6772419, 0.6808225,
        0.6843863, 0.6879331, 0.6914625, 0.6949743, 0.6984682, 0.7019440,
        0.7054015, 0.7088403, 0.7122603, 0.7156612, 0.7190427, 0.7224047,
        0.7257469, 0.7290691, 0.7323711, 0.7356527, 0.7389137, 0.7421539,
        0.7453731, 0.7485711, 0.7517478, 0.7549029, 0.7580363, 0.7611479,
        0.7642375, 0.7673049, 0.7703500, 0.7733726, 0.7763727, 0.7793501,
        0.7823046, 0.7852361, 0.7881446, 0.7910299, 0.7938919, 0.7967306,
        0.7995458, 0.8023375, 0.8051055, 0.8078498, 0.8105703, 0.8132671,
        0.8159399, 0.8185887, 0.8212136, 0.8238145, 0.8263912, 0.8289439,
        0.8314724, 0.8339768, 0.8364569, 0.8389129, 0.8413447, 0.8437524,
        0.8461358, 0.8484950, 0.8508300, 0.8531409, 0.8554277, 0.8576903,
        0.8599289, 0.8621434, 0.8643339, 0.8665005, 0.8686431, 0.8707619,
        0.8728568, 0.8749281, 0.8769756, 0.8789995, 0.8809999, 0.8829768,
        0.8849303, 0.8868606, 0.8887676, 0.8906514, 0.8925123, 0.8943502,
        0.8961653, 0.8979577, 0.8997274, 0.9014747, 0.9031995, 0.9049021,
        0.9065825, 0.9082409, 0.9098773, 0.9114920, 0.9130850, 0.9146565,
        0.9162067, 0.9177356, 0.9192433, 0.9207302, 0.9221962, 0.9236415,
        0.9250663, 0.9264707, 0.9278550, 0.9292191, 0.9305634, 0.9318879,
        0.9331928, 0.9344783, 0.9357445, 0.9369916, 0.9382198, 0.9394292,
        0.9406201, 0.9417924, 0.9429466, 0.9440826, 0.9452007, 0.9463011,
        0.9473839, 0.9484493, 0.9494974, 0.9505285, 0.9515428, 0.9525403,
        0.9535213, 0.9544860, 0.9554345, 0.9563671, 0.9572838, 0.9581849,
        0.9590705, 0.9599408, 0.9607961, 0.9616364, 0.9624620, 0.9632730,
        0.9640697, 0.9648521, 0.9656205, 0.9663750, 0.9671159, 0.9678432,
        0.9685572, 0.9692581, 0.9699460, 0.9706210, 0.9712834, 0.9719334,
        0.9725711, 0.9731966, 0.9738102, 0.9744119, 0.9750021, 0.9755808,
        0.9761482, 0.9767045, 0.9772499, 0.9777844, 0.9783083, 0.9788217,
        0.9793248, 0.9798178, 0.9803007, 0.9807738, 0.9812372, 0.9816911,
        0.9821356, 0.9825708, 0.9829970, 0.9834142, 0.9838226, 0.9842224,
        0.9846137, 0.9849966, 0.9853713, 0.9857379, 0.9860966, 0.9864474,
        0.9867906, 0.9871263, 0.9874545, 0.9877755, 0.9880894, 0.9883962,
        0.9886962, 0.9889893, 0.9892759, 0.9895559, 0.9898296, 0.9900969,
        0.9903581, 0.9906133, 0.9908625, 0.9911060, 0.9913437, 0.9915758,
        0.9918025, 0.9920237, 0.9922397, 0.9924506, 0.9926564, 0.9928572,
        0.9930531, 0.9932443, 0.9934309, 0.9936128, 0.9937903, 0.9939634,
        0.9941323, 0.9942969, 0.9944574, 0.9946139, 0.9947664, 0.9949151,
        0.9950600, 0.9952012, 0.9953388, 0.9954729, 0.9956035, 0.9957308,
        0.9958547, 0.9959754, 0.9960930, 0.9962074, 0.9963189, 0.9964274,
        0.9965330, 0.9966358, 0.9967359, 0.9968333, 0.9969280, 0.9970202,
        0.9971099, 0.9971972, 0.9972821, 0.9973646, 0.9974449, 0.9975229,
        0.9975988, 0.9976726, 0.9977443, 0.9978140, 0.9978818, 0.9979476,
        0.9980116, 0.9980738, 0.9981342, 0.9981929, 0.9982498, 0.9983052,
        0.9983589, 0.9984111, 0.9984618, 0.9985110, 0.9985588, 0.9986051,
        0.9986501, 0.9986938, 0.9987361, 0.9987772, 0.9988171, 0.9988558,
        0.9988933, 0.9989297, 0.9989650, 0.9989992, 0.9990324, 0.9990646,
        0.9990957, 0.9991260, 0.9991553, 0.9991836, 0.9992112, 0.9992378,
        0.9992636, 0.9992886, 0.9993129, 0.9993363, 0.9993590, 0.9993810,
        0.9994024, 0.9994230, 0.9994429, 0.9994623, 0.9994810, 0.9994991,
        0.9995166, 0.9995335, 0.9995499, 0.9995658, 0.9995811, 0.9995959,
        0.9996103, 0.9996242, 0.9996376, 0.9996505, 0.9996631, 0.9996752,
        0.9996869, 0.9996982, 0.9997091, 0.9997197, 0.9997299, 0.9997398,
        0.9997493, 0.9997585, 0.9997674, 0.9997759, 0.9997842, 0.9997922,
        0.9997999, 0.9998074, 0.9998146, 0.9998215, 0.9998282, 0.9998347,
        0.9998409, 0.9998469, 0.9998527, 0.9998583, 0.9998637, 0.9998689,
        0.9998739, 0.9998787, 0.9998834, 0.9998879, 0.9998922, 0.9998964,
        0.9999004, 0.9999043, 0.9999080, 0.9999116, 0.9999150, 0.9999184,
        0.9999216, 0.9999247, 0.9999277, 0.9999305, 0.9999333, 0.9999359,
        0.9999385, 0.9999409, 0.9999433, 0.9999456, 0.9999478, 0.9999499,
        0.9999519, 0.9999539, 0.9999557, 0.9999575, 0.9999593, 0.9999609,
        0.9999625, 0.9999641, 0.9999655, 0.9999670, 0.9999683
    ];

    // Convert X to a z-score
    const z = (x - mean) / sd;
    const i = Math.abs(Math.round(z * 100));

    if(i > R.length)
        return R[R.length];

    return R[i];
}

export {getQueryStringValue, shuffle, shuffleShoe, sumList, mean, stDev, max, min, copyArray, orderArray, copyObject, getMatches, applyClassToChildren, round, getSequence, numberToLetters, preventFormSubmission, randomNumber, sampleNormal, zToNormal, pNorm, explodeCommaList}