import {BaseObject} from "./Prototypes.js";

/**
 * @class Block
 * @classdesc A block is a class which is never saved in the data; its properties are saved in each trial in the block. It thus presents an easy way of applying specific properties to groups of trials.
 * @property trialCount {int} number of trials in the block
 * @property blockType {string} description of the block type
 * @property feedback {boolean} whether the block trials provide feedback
 * @property advisors {Advisor[]} advisors available to trials in the block
 */
class Block extends BaseObject {
    /**
     *
     * @param props {object} blueprint and other properties fed to class constructor
     * @param defaultClass {prototype} default class if block does not have trialClass variable set
     * @param [forceDefaultClass=false] {boolean} whether to force the defaultClass to be the class prototype used
     *
     * @return {object} Trial of the desired class with props
     */
    createTrial(props, defaultClass, forceDefaultClass = false) {

        let proto = this.trialClass ? this.trialClass : defaultClass;

        if (forceDefaultClass)
            proto = defaultClass;

        if (!proto)
            this.error("Tried to create a trial with no prototype supplied.");

        return new proto(props);
    }
}

export {Block}