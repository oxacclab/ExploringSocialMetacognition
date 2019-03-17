/**
 * Prototypes
 * Matt Jaquiery, March 2019
 *
 * Javascript library for running social metacognition studies. The
 * prototypes make available various utility functions which should belong
 * to all the objects in the experiment.
 */

"use strict";

/**
 * @class BaseObject
 * @classdesc BaseObjects are extended by all the key objects in the experiment.
 * BaseObjects are built from blueprints, which can be previous instances of
 * the objects.
 */
class BaseObject {
    constructor(blueprint) {
        this.blueprint = blueprint;
        this._setDefaults();
        this._readBlueprint();

        this.info("Created.")
    }

    /**
     * Set default values for the object. Should be overridden.
     * @protected
     */
    _setDefaults() {
        this.log = [];
    }

    /**
     * Set this BaseObject's properties based on blueprint's properties
     * @param [blueprint=null] {object|null} properties to give to the trial.
     * Default uses this.blueprint
     * @param [verifyBlueprint=true] {boolean} whether to check the
     * blueprint has all required fields
     * @protected
     */
    _readBlueprint(blueprint = null, verifyBlueprint = true) {
        if(blueprint === null)
            blueprint = this.blueprint;

        // Check blueprint matches specifications
        if(verifyBlueprint) {
            this._verifyBlueprint(blueprint);
        }

        for(let key in blueprint) {
            if(!blueprint.hasOwnProperty(key))
                continue;

            this[key] = blueprint[key];
        }
    }

    /**
     * Verify that the blueprint supplied has the necessary properties.
     * @param [blueprint=null] {object|null} blueprint to check
     * @return {boolean}
     * @protected
     */
    _verifyBlueprint(blueprint = null) {
        if(blueprint === null)
            blueprint = this.blueprint;

        return typeof blueprint !== "undefined";
    }

    /**
     * Register a warning
     * @param content {*} log entry
     * @param [echoToConsole=true] {boolean} also show in console?
     */
    warn(content, echoToConsole = true) {
        if(echoToConsole)
            console.warn(content);
        this._writeToLog(content, "Warn");
    }

    /**
     * Register information
     * @param content {*} log entry
     * @param [echoToConsole=false] {boolean} also show in console?
     */
    info(content, echoToConsole = false) {
        if(echoToConsole)
            console.log(content);
        this._writeToLog(content, "Info");
    }

    /**
     * Write an entry to the log. Currently no support for level filtering.
     * @param o {object} log entry
     * @param level {string} severity description
     * @protected
     */
    _writeToLog(o, level) {
        if(typeof o !== "string" && typeof o !== "number")
            o = JSON.stringify(o);
        this.log.push("[" + new Date().getTime() + "] " + level + ": " + o);
    }
}

/**
 * @class ControlObject
 * @classdesc ControlObjects have discrete phases through which they step.
 * They update the document's body tag with a class representing their
 * current phase.
 *
 */
class ControlObject extends BaseObject {
    constructor(blueprint, callback) {
        super(blueprint);

        if(typeof callback === "function")
            this.callback = (phaseName) => callback(phaseName, this);
        else
            this.callback = () => {};
    }

    _setDefaults() {
        super._setDefaults();
        this.currentPhase = -1;
    }

    /**
     * Phase list of the class. Should be overridden.
     * @return {[]}
     */
    static get listPhases() {
        return [
            "cleanup"
        ];
    }

    /**
     * The phase list of the live instance.
     * @return {*[]}
     */
    get phases() {
        return this.constructor.listPhases;
    }

    get _phaseClassPrefix() {
        return this.constructor.name;
    }

    /**
     * Get the name of the phase classes. Will be object name-phase name,
     * e.g. ControlObject-begin
     * @return {string[]}
     */
    get phaseClasses() {
        let out = [];
        this.phases.forEach(
            (p) => out.push(this._phaseClassPrefix + "-" + p));
        return out;
    }

    /**
     * Register the beginning of a phase.
     * Prompt update.
     * Set CSS class on #content.
     * Callback.
     * @param phase {int|string} phase identifier
     * @protected
     */
    _startPhase(phase) {
        let p;

        if(typeof phase !== "string")
            p = this.phases[phase];
        else
            p = phase;

        const i = this.phases.indexOf(p);
        this.currentPhase = i;

        if(i === -1)
            this.warn("Unknown phase requested '" + p + "'");

        // Remove phase classes add add current one
        const body = document.body;
        body.classList.remove(...this.phaseClasses);
        body.classList.add(this._phaseClassPrefix + "-any");
        if(p !== "cleanup")
            body.classList.add(this.phaseClasses[i]);
        else
            body.classList.remove(this._phaseClassPrefix + "-any");

        this.info("Begin phase " + p);

        this.callback(p);
    }

    /**
     * Run phases asynchronously.
     * Requires for each phase the there is a function with that phase name.
     * @param [startPhase=0] {int|string}
     * @return {Promise<ControlObject>} Resolve with this object.
     */
    async run(startPhase = 0) {
        let phase;
        if(typeof startPhase === "string")
            phase = this.phases.indexOf(startPhase);
        else
            phase = startPhase;

        while(phase < this.phases.length)
            await this.nextPhase(phase++);

        return this;
    }

    /**
     * Execute a single phase
     * @param [phase=null] {int|string} phase to execute
     * @return {Promise<*>}
     */
    async nextPhase(phase = null) {
        if(phase === null)
            phase = this.currentPhase + 1;
        else
            if(typeof phase === "string")
                phase = this.phases.indexOf(phase);

        if(phase >= this.phases.length)
            return null;

        if(eval("typeof this." + this.phases[phase] + " !== 'function'")) {
            this.warn("No phase function found for " + this.phases[phase]);
            return null;
        }

        this._startPhase(phase);
        return await eval("this." + this.phases[phase] + "()");
    }

    /**
     * Wait for a time.
     * @param ms {int} milliseconds to wait
     * @param [args=null] {*} argument to return from Promise
     * @return {Promise<*>}
     */
    wait(ms, args = null) {
        if(args === null)
            args = this;
        return new Promise((resolve) => setTimeout(resolve, ms, args));
    }
}

export {BaseObject, ControlObject}