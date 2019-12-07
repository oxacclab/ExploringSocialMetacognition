import * as utils from "../utils.js";

customElements.define('esm-response-binary-conf',
    /**
     * @class The ResponseBinaryConf is a div element which handles responses from
     * the participant. Its properties are set using the data-* HTML fields.
     * Currently supports continuous values only, interpolated linearly from
     * data-min to data-max.
     *
     * @property min {double} Minimum response value (used for advice)
     * @property max {double} Maximum response value (used for advice)
     * @property confMin {double} Minimum confidence value
     * @property confMax {double} Maximum confidence value
     * @property prefix {string} Prefix to response values
     * @property suffix {string} Suffix to response values
     * @property decimals {int} Number of decimal points in response values
     * @property labelStep {double} Label separation
     * @property markerWidths {number[]} marker widths in years
     * @property timeout {int} Maximum response time in ms
     */
    class ResponseBinaryConf extends HTMLElement {

        constructor() {
            super();

            setTimeout((me) => me.reset(), 0, this);
            this.querySelectorAll(".response-column").forEach(e => {
                e.addEventListener("click", evt => this.endInput(evt));
                e.addEventListener("touchend", evt => this.endInput(evt));

                e.addEventListener("mousemove", evt => this.registerInput(evt));
                e.addEventListener("touchmove", evt => this.registerInput(evt));

                e.addEventListener("mouseleave", evt => this.clearInput(evt));
            });
        }

        /**
         * Handle inputting a response (moving the mouse over a response area, or touching a response area).
         * @param evt {MouseEvent|TouchEvent}
         * @return {boolean|null}
         */
        registerInput(evt) {
            // Set the height of the inner column as appropriate
            const me = evt.currentTarget;
            const bb = me.getBoundingClientRect();
            const parent = me.parentElement.parentElement;

            if(!me.closest("esm-response-binary-conf").responseEnabled)
                return false;
            if(!me.querySelector(".response-column-inner:not(.ghost)"))
                return;

            // If a touch is dragged out of the column, zero it
            if(evt instanceof TouchEvent) {
                const t = evt.targetTouches[0];
                if(!(t.clientX >= bb.left &&
                    t.clientX <= bb.right &&
                    t.clientY >= bb.top &&
                    t.clientY <= bb.bottom)) {
                    this.clearInput(evt);
                    return;
                }
            }

            const y = evt.clientY || evt.targetTouches[0].clientY;
            const mouseHeight = y - bb.top -
                // account for borders
                (bb.height - me.clientHeight) / 2;

            const p = 100 - (mouseHeight / me.clientHeight * 100);
            const pc =
                Math.min(parseFloat(this.dataset.confMax),
                    Math.max(parseFloat(this.dataset.confMin), p));
            const d = this.dataset.decimals? parseInt(this.dataset.decimals) : 0;
            const percent = Math.round(pc * Math.pow(10, d)) / Math.pow(10, d);

            // Graphical update
            me.querySelector(".response-column-inner:not(.ghost)").style.height =
                percent.toString() + "%";
            // Store data
            this.responseData.confidence = percent;
            this.responseData.answer = parent.querySelector(".response-answer").innerHTML;
            this.responseData.slider = me.id;

            this.responseData.labels = "";
            parent.querySelectorAll(".response-label-text").forEach(txt => {
                if(this.responseData.labels.length)
                    this.responseData.labels += "|";
                this.responseData.labels += txt.innerHTML;
            });
            this.responseData.timeEstimate = new Date().getTime();

            // Store the index of the response column
            const columns = document.querySelectorAll(".response-column");
            for(let i = 0; i < columns.length; i++)
                if(columns[i] === me) {
                    this.responseData.ans = i;
                    break;
                }

            this.responseData.complete = true;
        }

        /**
         * Support cancelling a prospective answer
         * @param evt {MouseEvent|TouchEvent}
         * @return {boolean|null}
         */
        clearInput(evt) {
            const me = evt.currentTarget;

            if(!me.closest("esm-response-binary-conf").responseEnabled)
                return false;
            if(!me.querySelector(".response-column-inner:not(.ghost)"))
                return;

            this.responseData.complete = false;

            me.querySelector(".response-column-inner:not(.ghost)").style.height = 0;
        }

        /**
         * Handle submitting an event
         * @param evt {MouseEvent|TouchEvent}
         */
        endInput(evt) {
            // Touch events must still be within the target to be valid endings
            // This allows cancelling the response by dragging the touch out
            if(evt instanceof TouchEvent) {
                // Stop propagation of other events
                evt.preventDefault();

                // Check if touch is still over the target zone
                const bb = evt.currentTarget.getBoundingClientRect();
                const t = evt.changedTouches[0];

                if(!(t.clientX >= bb.left &&
                    t.clientX <= bb.right &&
                    t.clientY >= bb.top &&
                    t.clientY <= bb.bottom)) {
                    this.clearInput(evt);
                    return;
                }
            }

            // Add a ghost of the response
            const column = evt.currentTarget.querySelector(".response-column-inner:not(.ghost)");
            const ghost = column.parentElement.appendChild(column.cloneNode(true));
            ghost.classList.add("ghost");

            this.saveResponse(evt);
        }

        /**
         * Set up the events for handling estimate input.
         * @param [reset=true] {boolean} whether to reset the ResponseBinaryConf prior to enabling responding
         */
        enableResponse(reset = true) {
            if(reset)
                this.reset();

            this.classList.remove("cloak");
            this.responseEnabled = true;

            if(this.timeout > 0)
                this.timeoutTimer = setTimeout(this.reject, this.timeout, "timeout");
        }

        /**
         * Save estimate input. Remove the estimate events.
         * @param [evt=null] {MouseEvent|TouchEvent|null}
         */
        saveResponse(evt = null) {
            const me = this.closest("esm-response-binary-conf");

            if(!me.responseData.complete)
                return;

            if(evt)
                me.clearInput(evt);

            me.responseEnabled = false;

            if(typeof me.resolve === "function")
                me.resolve(me.responseData);

            if(me.timeoutTimer)
                clearTimeout(me.timeoutTimer);
        }

        /**
         * Perform the response collection process.
         *
         * @param [timeout=null] {int|null|undefined} maximum number of milliseconds to wait before
         * returning a Timeout.
         * @param [reset=true] {boolean} whether to reset the response panel
         *
         * @return {Promise} Resolve with the response data, or Timeout reject
         */
        getResponse(timeout, reset = true) {
            if(typeof timeout === "undefined" || timeout === null)
                this.timeout = this.dataset.hasOwnProperty("timeout")?
                    this.dataset.timeout : Infinity;

            const me = this;
            this.enableResponse(reset);

            return new Promise(function (resolve, reject) {
                me.resolve = resolve; // Called in saveResponse
                me.reject = reject; // Called automatically after timeout
            });
        }

        /**
         * Refresh the element ready for collecting a new response.
         */
        reset() {
            this.classList.add('cloak');
            this.responseEnabled = false;

            // clear data
            this.responseData = {
                slider: null,
                labels: "",
                answer: "",
                timeEstimate: null,

                complete: false
            };

            // reset timeline styling
            this.querySelectorAll(".response-column-inner").forEach(e => {
                e.style.height = 0;
            });

            this.querySelectorAll(".response-marker.feedback").forEach(
                e => e.remove()
            );
            this.querySelectorAll(".ghost").forEach(e => e.remove());
        }

        /**
         * Produce the details the study will need to run attention checks using this response method.
         * @return {{question: string, answer: *, markerWidths: *}}
         */
        get attentionCheck() {

            const answers = [
                this.querySelector(".response-panel:first-of-type .response-answer").innerHTML,
                this.querySelector(".response-panel:last-of-type .response-answer").innerHTML
            ];

            const ans = Math.random() < .5? 0 : 1;
            const conf = Math.random() >= .5;

            const q = "for this question pick the '" +
                answers[ans] + "' answer with " +
                (conf? "high" : "low") + " confidence";

            return {
                question: q,
                answer: ans,
                confidence: conf,
                checkFunction: t => this.isAttentionCheckCorrect(t)
            }
        }

        /**
         * Check a response matches the expected attention check properties, i.e. the requested answer was given with the requested confidence
         * @param trial
         * @return {boolean}
         */
        isAttentionCheckCorrect(trial) {
            if(trial.data.responseAns !== trial.correctAnswer ||
                (trial.data.responseConfidence > (this.dataset.confMax - this.dataset.confMin) / 2) !== trial.attentionCheckHighConf)
                return false;

            return true;
        }

        /**
         * Move the feedback marker
         * @param value {number} correct answer value
         * @param anchor {number} anchor value
         */
        feedbackMarker(value, anchor) {
            let marker = this.querySelector(".response-marker.correct.feedback");
            if(marker)
                marker.remove();

            const side = value < anchor? 0 : 1;
            const correct = this.responseData.ans === side;

            marker = document.createElement("div");
            marker.classList.add("response-marker", "correct", "feedback");
            if(!correct)
                marker.classList.add("participantWrong");

            marker.innerHTML = "&starf;";
            this.querySelector(".response-panel:" +
                (side? "last-of-type" : "first-of-type")).appendChild(marker);
        }
    }
);

/**
 * Inject the ResponseBinaryConf CSS file
 */
function registerResponseBinaryConfCSS() {

    // Inject styling
    const myLink = document.querySelector('script[src*="ResponseBinaryConf.js"]');
    const href = myLink.src.replace("ResponseBinaryConf.js", "ResponseBinaryConf.css");

    const css = document.createElement('link');
    css.href = href;
    css.rel = "stylesheet";
    css.type = "text/css";
    document.head.appendChild(css);
}

registerResponseBinaryConfCSS();