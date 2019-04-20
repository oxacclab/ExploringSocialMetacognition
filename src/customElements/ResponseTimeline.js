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
     * @property markerWidthThin {double} width in response-values of thin marker
     * @property markerWidthMedium {double} width in response-values of medium marker
     * @property markerWidthThick {double} width in response-values of thick marker
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

            this.querySelectorAll(".response-marker-pool .response-marker")
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
            const dragged = this.cloneNode(true);
            dragged.classList.add("dragged");
            timeline.appendChild(dragged);

            // Support for clicking ghost
            if(this.classList.contains("ghost")) {
                timeline.draggedMarker.classList.remove("ghost");
                timeline.draggedMarker.childNodes.forEach(elm => {
                    elm.innerHTML = "";
                    setTimeout(()=>elm.remove(), 0);
                });
            }

            const r = this.getBoundingClientRect();

            timeline.draggedMarker.style.left = r.x + "px";
            timeline.draggedMarker.style.top = r.y + "px";

            if(window.TouchEvent && e instanceof TouchEvent) {
                timeline.draggedMarker.dragOffsetX = e.targetTouches[0].clientX - r.x;
                timeline.draggedMarker.dragOffsetY = e.targetTouches[0].clientY - r.y;
            } else {
                timeline.draggedMarker.dragOffsetX = e.offsetX;
                timeline.draggedMarker.dragOffsetY = e.offsetY;
            }

            // Register events for dragging markers
            document.addEventListener("mouseup", timeline.dropMarker);
            document.addEventListener("touchend", timeline.dropMarker);
            document.addEventListener("mousemove", timeline.moveMarker);
            document.addEventListener("touchmove", timeline.moveMarker);

            if(timeline.ghost) {
                // allow simply clicking ghost to confirm
                if(e.currentTarget === timeline.ghost)
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
                timeline.ghost.addEventListener("mousedown", timeline.pickUpMarker);
                timeline.ghost.addEventListener("touchstart", timeline.pickUpMarker);
            } else
                timeline.querySelector(".confirm").classList.remove("enabled");

            // Don't process mouse event if we already processed the touch event
            if(window.TouchEvent && e instanceof TouchEvent)
                return false;
        }

        /**
         * Save estimate input. Remove the estimate events. Add confidence
         * events.
         */
        saveResponse() {
            const timeline = this.closest("esm-response-timeline");

            // Quit if there's no ghost to process
            if(!timeline.ghost ||
                !timeline.querySelector(".confirm").classList.contains("enabled"))
                return;

            timeline.querySelector(".confirm").classList.remove("enabled");

            timeline.responseData = {
                estimateLeft: Math.round(timeline.pixelsToValue(timeline.ghost.offsetLeft)),
                markerWidth: Math.round(timeline.pixelsToValue(timeline.ghost.clientWidth) - timeline.dataset.min),
                estimateLabelLeft: timeline.ghost.querySelector(".left").innerHTML,
                estimateLabelRight: timeline.ghost.querySelector(".right").innerHTML,
                timeEstimate: new Date().getTime(),
                complete: true
            };

            if(typeof timeline.resolve === "function")
                timeline.resolve(timeline.responseData);

            if(timeline.timeoutTimer)
                clearTimeout(timeline.timeoutTimer);

            console.log(timeline.responseData)
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
         * Reset the marker pool marker widths
         * @param [shuffle=false] {boolean} whether to shuffle the order of the markers
         */
        resetMarkerPool(shuffle = false) {
            const contents = this.querySelectorAll(".response-marker-pool > div");
            if(shuffle)
                utils.shuffle(contents).forEach((elm) =>
                    elm.parentElement.appendChild(elm));

            contents.forEach((rm) => {
                rm.removeEventListener("mousedown", this.pickUpMarker);
                rm.removeEventListener("touchstart", this.pickUpMarker);
            });

            let style = document.querySelector("#response-timeline-css");
            if(style === null) {
                style = document.createElement('style');
                style.id = "response-timeline-css";
                style.type = "text/css";
                document.head.appendChild(style);
            }

            const thin = (this.valueToPixels(parseFloat(this.dataset.markerWidthThin), true) - 1) + "px";
            const med = (this.valueToPixels(parseFloat(this.dataset.markerWidthMedium), true) - 1) + "px";
            const thick = (this.valueToPixels(parseFloat(this.dataset.markerWidthThick), true) - 1) + "px";

            style.innerHTML = ".response-marker.thin {width: " +
                thin + "} " +
            ".response-marker.medium {width: " + med + "} " +
            ".response-marker.thick {width: " + thick + "}";

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
                this.responseData.markerWidth;
            if(!marker) {
                marker = document.createElement("div");
                marker.classList.add("response-marker", "correct", "feedback");
                marker.innerHTML = correct? "&starf;" : "&star;";
                this.querySelector(".response-line").appendChild(marker);
            }
            marker.style.left = this.valueToPixels(value) + "px";
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