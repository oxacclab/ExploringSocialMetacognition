import * as utils from "../utils.js";

customElements.define('esm-response-timeline',
    /**
     * @class The ResponseTimeline is a div element which handles responses from
     * the participant. Its properties are set using the data-* HTML fields.
     * Currently supports continuous values only, interpolated linearly from
     * data-min to data-max.
     *
     * @property min {double} Minimum response value
     * @property max {double} Maximum response value
     * @property prefix {string} Prefix to response values
     * @property suffix {string} Suffix to response values
     * @property decimals {int} Number of decimal points in response values
     * @property labelStep {double} Label separation
     * @property markerWidths {number[]} marker widths in years
     * @property timeout {int} Maximum response time in ms
     * @property noConfidence {string} "true" = do not ask for confidence
     */
    class ResponseTimeline extends HTMLElement {

        constructor() {
            super();

            setTimeout((me) => me.reset(), 0, this);
            this.querySelector(".confirm").addEventListener("click", this.saveResponse);
        }

        /**
         * Set up the events for handling estimate input.
         * @param [reset=true] {boolean} whether to reset the ResponseTimeline prior to enabling responding
         */
        enableResponse(reset = true) {
            if(reset)
                this.reset();

            this.classList.remove("cloak");

            this.querySelectorAll(".response-marker-pool .response-marker .clickhandler")
                .forEach((rm) => {
                    rm.addEventListener("mousedown", this.pickUpMarker);
                    rm.addEventListener("touchstart", this.pickUpMarker);
                });

            if(this.timeout > 0)
                this.timeoutTimer = setTimeout(this.reject, this.timeout, "timeout");
        }

        /**
         * Allow markers to be picked up when clicked
         * @param e {MouseEvent|TouchEvent}
         */
        pickUpMarker(e) {
            if(!e) {
                throw(new Error("pickUpMarker called without an event."));
            }

            e.stopPropagation();

            // Duplicate the marker under the cursor
            // (this = clicked marker)
            const timeline = this.closest("esm-response-timeline");
            const dragged = this.parentElement.cloneNode(true);
            dragged.classList.add("dragged");
            timeline.appendChild(dragged);

            // Support for clicking ghost
            if(this.parentElement.classList.contains("ghost")) {
                timeline.draggedMarker.classList.remove("ghost");
                timeline.draggedMarker.childNodes.forEach(elm => {
                    elm.innerHTML = "";
                    setTimeout(()=>elm.remove(), 0);
                });
            }

            const r = this.parentElement.getBoundingClientRect();
            const rCh = this.getBoundingClientRect();

            timeline.draggedMarker.style.left = r.x + "px";
            timeline.draggedMarker.style.top = r.y + "px";

            if(window.TouchEvent && e instanceof TouchEvent) {
                timeline.draggedMarker.dragOffsetX = e.targetTouches[0].clientX - r.x;
                timeline.draggedMarker.dragOffsetY = e.targetTouches[0].clientY - r.y;
            } else {
                timeline.draggedMarker.dragOffsetX =
                    e.offsetX + rCh.x - r.x;
                timeline.draggedMarker.dragOffsetY =
                    e.offsetY + rCh.y - r.y;
            }

            // Register events for dragging markers
            document.addEventListener("mouseup", timeline.dropMarker);
            document.addEventListener("touchend", timeline.dropMarker);
            document.addEventListener("mousemove", timeline.moveMarker);
            document.addEventListener("touchmove", timeline.moveMarker);

            if(timeline.ghost) {
                // allow simply clicking ghost to confirm
                if(e.currentTarget.parentElement === timeline.ghost)
                    timeline.querySelector(".confirm").classList.add("enabled");
                else {
                    // remove ghost
                    timeline.ghost.remove();
                    // disable responding
                    timeline.querySelector(".confirm").classList.remove("enabled");
                }
            }

            // Don't process mouse event if we already processed the touch event
            if(window.TouchEvent && e instanceof TouchEvent)
                return false;
        }

        /**
         * Handle mouse moving faster than the marker can track
         * @param e {MouseEvent|TouchEvent}
         */
        moveMarker(e) {
            if(!e) {
                throw(new Error("moveMarkerBackground called without an event."));
            }

            let timeline = document.querySelectorAll("esm-response-timeline");
            for(let i = 0; i < timeline.length; i++)
                if(timeline[i].draggedMarker) {
                    timeline = timeline[i];
                    break;
                }

            const m = timeline.draggedMarker;

            if(!m)
                return;

            e.stopPropagation();

            const x = window.TouchEvent && e instanceof TouchEvent? e.targetTouches[0].clientX : e.clientX;
            const y = window.TouchEvent && e instanceof TouchEvent? e.targetTouches[0].clientY : e.clientY;

            m.style.left = (x - m.dragOffsetX) + "px";
            m.style.top = (y - m.dragOffsetY) + "px";

            timeline.updateGhost();

            // Don't process mouse event if we already processed the touch event
            if(window.TouchEvent && e instanceof TouchEvent)
                return false;
        }

        /**
         * @param year {number}
         * @param [returnWidth=false] {boolean} whether to return a width rather than a coordinate (i.e. don't subtract the scale minimum)
         * @return {number} pixel coordinate
         */
        valueToPixels(year, returnWidth = false) {
            if(!returnWidth)
                year -= parseFloat(this.dataset.min);
            return year * this.querySelector(".response-line").clientWidth /
                (parseFloat(this.dataset.max) - parseFloat(this.dataset.min));
        }

        /**
         * @param x {number} pixel coordinate
         * @return {number} year
         */
        pixelsToValue(x) {
            return x /
                this.querySelector(".response-line").clientWidth *
                (parseFloat(this.dataset.max) - parseFloat(this.dataset.min))
                + parseFloat(this.dataset.min);
        }

        get draggedMarker() {
            return this.querySelector(".response-marker.dragged");
        }

        get ghost() {
            return this.querySelector(".response-marker.ghost");
        }

        updateGhost() {
            const marker = this.draggedMarker;
            const rm = marker.getBoundingClientRect();
            const rl = this.querySelector(".response-line").getBoundingClientRect();

            // Destroy ghost if outside timeline
            if(rm.right < rl.left ||
                rm.left > rl.right) {
                if(this.ghost)
                    this.ghost.remove();

                // disable responding
                this.querySelector(".confirm").classList.remove("enabled");
                return;
            }

            // Create ghost if inside timeline
            if(!this.ghost) {
                const ghost = document.createElement("div");
                ghost.innerHTML = this.draggedMarker.innerHTML;
                this.draggedMarker.classList.forEach(c =>
                    ghost.classList.add(c));
                ghost.classList.add("ghost");
                ghost.classList.remove("dragged");
                let l = ghost.appendChild(document.createElement("div"));
                l.classList.add("label", "left");
                let r = ghost.appendChild(document.createElement("div"));
                r.classList.add("label", "right");
                this.querySelector(".response-line").appendChild(ghost);

                // enable responding
                this.querySelector(".confirm").classList.add("enabled");
            }

            // Snap to nearest value
            let left = rm.left < rl.left? 0 : rm.left - rl.left;
            if(rm.right > rl.right)
                left = rl.width - rm.width;
            left = this.valueToPixels(Math.floor(this.pixelsToValue(left)));

            this.ghost.style.left = left + "px";

            // Update labels
            this.ghost.querySelector(".left").innerHTML =
                parseInt(this.pixelsToValue(left))
                    .toFixed(parseInt(this.dataset.decimals));
            this.ghost.querySelector(".right").innerHTML =
                parseInt(this.pixelsToValue(left + this.ghost.clientWidth))
                    .toFixed(parseInt(this.dataset.decimals));
        }

        /**
         * Drop the marker from the cursor
         * @param e {MouseEvent|TouchEvent}
         */
        dropMarker(e) {
            if(!e) {
                throw(new Error("dropMarker called without an event."));
            }

            let timeline = document.querySelectorAll("esm-response-timeline");
            for(let i = 0; i < timeline.length; i++)
                if(timeline[i].draggedMarker) {
                    timeline = timeline[i];
                    break;
                }

            const m = timeline.draggedMarker;

            if(!m)
                return;

            e.stopPropagation();

            // Destroy drag marker
            timeline.draggedMarker.remove();

            // Reify ghost
            if(timeline.ghost) {
                timeline.ghost.classList.add("set");

                // Add click event to ghost for adjustments
                const ghostHandler =
                    timeline.ghost.querySelector(".clickhandler");
                ghostHandler.addEventListener("mousedown", timeline.pickUpMarker);
                ghostHandler.addEventListener("touchstart", timeline.pickUpMarker);
            } else
                timeline.querySelector(".confirm").classList.remove("enabled");

            // Don't process mouse event if we already processed the touch event
            if(window.TouchEvent && e instanceof TouchEvent)
                return false;
        }

        /**
         * Save estimate input. Remove the estimate events.
         */
        saveResponse() {
            const timeline = this.closest("esm-response-timeline");

            // Quit if there's no ghost to process
            if(!timeline.ghost ||
                !timeline.querySelector(".confirm").classList.contains("enabled"))
                return;

            timeline.querySelector(".confirm").classList.remove("enabled");

            const markerWidth = Math.round(timeline.pixelsToValue(timeline.ghost.clientWidth) - timeline.dataset.min);
            const size = /size[0-9]+/.exec(timeline.ghost.classList.toString())[0];
            const nth = /[0-9+]/.exec(size)[0];
            const markerValue = timeline.markerPoints[nth];

            timeline.responseData = {
                estimateLeft: Math.round(timeline.pixelsToValue(timeline.ghost.offsetLeft)),
                markerWidth,
                markerValue,
                estimateLabelLeft: timeline.ghost.querySelector(".left").innerHTML,
                estimateLabelRight: timeline.ghost.querySelector(".right").innerHTML,
                timeEstimate: new Date().getTime(),
                complete: true
            };

            if(typeof timeline.resolve === "function")
                timeline.resolve(timeline.responseData);

            if(timeline.timeoutTimer)
                clearTimeout(timeline.timeoutTimer);
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

            // clear data
            this.responseData = {
                estimateLeft: null,
                markerWidth: null,
                estimateLabelLeft: null,
                estimateLabelRight: null,
                timeEstimate: null,

                complete: false
            };

            // reset timeline styling
            this.querySelector(".response-timeline").classList.add("cloak");
            this.querySelector(".response-marker").style.top = "";
            this.querySelector(".response-marker").style.opacity = "1";

            this.resetTimeline();
            this.resetMarkerPool();
        }

        /**
         * Reset the visual timeline to be empty
         */
        resetTimeline() {
            let TL = this.querySelector(".response-line");
            TL.innerHTML = "";

            const min = parseFloat(this.dataset.min);
            const max = parseFloat(this.dataset.max);
            const step = parseFloat(this.dataset.labelStep);
            const size = max - min;
            // Draw timeline labels
            for(let t = min; t <= max; t += step) {
                let elm = document.createElement("div");
                elm.classList.add("label");
                elm.innerText = t.toString();
                TL.appendChild(elm);
                elm.style.left = ((t - min) / size * TL.clientWidth) + "px";
            }
        }

        /**
         * Create a marker display for the marker pool
         * @param nth {int} which of the timeline's marker-widths to use
         * @return {HTMLElement}
         * @protected
         */
        _createMarkerDisplay(nth) {
            const width = this.markerWidths[nth];
            const pts = this.markerPoints[nth];

            if(!width || !pts)
                throw new Error("ResponseTimeline could not find width and/or point values for marker " + nth.toString() + ". Check the <esm-response-timeline> properties 'data-marker-widths' and 'data-marker-values'.");

            const display = document.createElement('div');

            const label = display.appendChild(document.createElement('div'));
            label.classList.add('label');
            label.innerHTML = '&plusmn;<span class="year">' + ((width - 1) / 2) + '</span> year (<span class="points">' + pts +'</span>pts)';

            const marker = display.appendChild(document.createElement('div'));
            marker.classList.add('response-marker', 'size' + nth.toString());

            // add click handler to marker
            marker.appendChild(document.createElement('div')).classList.add('clickhandler');

            return display;
        }

        get markerWidths() {
            return utils.explodeCommaList(this.dataset.markerWidths);
        }

        get markerPoints() {

            return utils.explodeCommaList(this.dataset.markerValues);
        }

        /**
         * Produce the details the study will need to run attention checks using this response method.
         * @return {{question: string, answer: *, markerWidths: *}}
         */
        get attentionCheck() {

            const ans = parseInt(this.dataset.min) +
                Math.floor(
                    Math.random() *
                    (parseInt(this.dataset.max) - parseInt(this.dataset.min))
                );

            const size = this.markerWidths.length > 1? "smallest " : "";
            const q = "for this question use the " + size + "marker to cover the year " + utils.numberToLetters(ans);

            return {
                question: q,
                answer: ans,
                markerWidths: this.markerWidths,
                checkFunction: ResponseTimeline.isAttentionCheckCorrect
            }
        }

        /**
         * Check a response matches the expected attention check properties
         * @param trial
         * @return {boolean}
         */
        static isAttentionCheckCorrect(trial) {
            if(!(trial.data.responseEstimateLeft <= trial.correctAnswer &&
                trial.data.responseEstimateLeft +
                trial.data.responseMarkerWidth - 1 >= trial.correctAnswer) ||
            // marker width
            (trial.attentionCheckMarkerWidth &&
                trial.data.responseMarkerWidth !==
                trial.attentionCheckMarkerWidth))
                return false;

            return true;
        }

        /**
         * Create marker pool
         * @param [shuffle=false] {boolean} whether to shuffle the order of the markers
         */
        resetMarkerPool(shuffle = false) {
            const pool = this.querySelector(".response-marker-pool");

            if(!pool) {
                // create a response marker pool if there isn't one
                this.appendChild(document.createElement('div')).classList.add('response-marker-pool');
                return this.resetMarkerPool(shuffle);
            } else {
                pool.innerHTML = "";
            }

            // Create markers
            let markers = utils.getSequence(0, this.markerWidths.length - 1);
            if(shuffle)
                markers = utils.shuffle(markers);

            for(let i = 0; i < markers.length; i++)
                pool.appendChild(this._createMarkerDisplay(markers[i]));

            const contents = this.querySelectorAll(".response-marker-pool > div");

            contents.forEach((rm) => {
                rm.removeEventListener("mousedown", this.pickUpMarker);
                rm.removeEventListener("touchstart", this.pickUpMarker);
            });

            // Create stylesheet
            let style = document.querySelector("#response-timeline-css");
            if(style === null) {
                style = document.createElement('style');
                style.id = "response-timeline-css";
                style.type = "text/css";
                document.head.appendChild(style);
            }

            const sizes = this.markerWidths.map(
                x => Math.floor(this.valueToPixels(
                    parseFloat(x),
                    true)));

            let css = "";

            sizes.forEach((s, i) => {
                css += ".response-marker.size" + i + " {width: " + s + "px} ";
                css += ".response-marker.size" + i + ".advisor {height: " + s + "px} ";
            });

            css += ".clickhandler {width: " + sizes[sizes.length - 1] + "px}";

            style.innerHTML = css;

            this.querySelector(".confirm").classList.remove("enabled");
        }

        /**
         * Move the feedback marker
         * @param value {number} correct answer value
         */
        feedbackMarker(value) {
            let marker = this.querySelector(".response-marker.correct.feedback");
            const correct =
                value >= this.responseData.estimateLeft &&
                value <= this.responseData.estimateLeft +
                this.responseData.markerWidth - 1;
            if(!marker) {
                marker = document.createElement("div");
                marker.classList.add("response-marker", "correct", "feedback");
                marker.innerHTML = correct? "&starf;" : "&star;";
                this.querySelector(".response-line").appendChild(marker);
            }
            marker.style.left = (this.valueToPixels(value + .5)) + "px";

            return marker;
        }
    }
);

/**
 * Inject the ResponseTimeline CSS file
 */
function registerResponseTimelineCSS() {

    // Inject styling
    const myLink = document.querySelector('script[src*="ResponseTimeline.js"]');
    const href = myLink.src.replace("ResponseTimeline.js", "ResponseTimeline.css");

    const css = document.createElement('link');
    css.href = href;
    css.rel = "stylesheet";
    css.type = "text/css";
    document.head.appendChild(css);
}

registerResponseTimelineCSS();