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
            timeline.draggedMarker = this.cloneNode(true);
            timeline.appendChild(timeline.draggedMarker);
            timeline.draggedMarker.classList.add("dragged");

            const r = this.getBoundingClientRect();

            timeline.draggedMarker.style.left = r.x + "px";
            timeline.draggedMarker.style.top = r.y + "px";

            if(e instanceof TouchEvent) {
                timeline.draggedMarker.dragOffsetX = e.targetTouches[0].clientX - r.x;
                timeline.draggedMarker.dragOffsetY = e.targetTouches[0].clientY - r.y;
            } else {
                timeline.draggedMarker.dragOffsetX = e.offsetX;
                timeline.draggedMarker.dragOffsetY = e.offsetY;
            }

            // Register events for dragging markers
            timeline.draggedMarker.addEventListener("mousemove", timeline.moveMarker);
            timeline.draggedMarker.addEventListener("touchmove", timeline.moveMarker);
            timeline.draggedMarker.addEventListener("mouseup", timeline.dropMarker);
            timeline.draggedMarker.addEventListener("touchend", timeline.dropMarker);
            document.addEventListener("mousemove", timeline.moveMarker);
            document.addEventListener("touchmove", timeline.moveMarker);

            // Don't process mouse event if we already processed the touch event
            if(e instanceof TouchEvent)
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
            e.stopPropagation();

            let timeline = document.querySelectorAll("esm-response-timeline");
            for(let i = 0; i < timeline.length; i++)
                if(timeline[i].draggedMarker) {
                    timeline = timeline[i];
                    break;
                }

            const m = timeline.draggedMarker;
            const x = e instanceof TouchEvent? e.targetTouches[0].clientX : e.clientX;
            const y = e instanceof TouchEvent? e.targetTouches[0].clientY : e.clientY;

            m.style.left = (x - m.dragOffsetX) + "px";
            m.style.top = (y - m.dragOffsetY) + "px";

            timeline.updateGhost();

            // Don't process mouse event if we already processed the touch event
            if(e instanceof TouchEvent)
                return false;
        }

        updateGhost() {
            const TL = this.querySelector(".response-line");
            const marker = this.draggedMarker;
            const rm = marker.getBoundingClientRect();
            const rl = TL.getBoundingClientRect();

            // Destroy ghost if outside timeline
            if(rm.right < rl.left ||
                rm.left > rl.right) {
                if(TL.ghost) {
                    TL.ghost.remove();
                    TL.ghost = "";
                }
                return;
            }

            // Create ghost if inside timeline
            if(!TL.ghost) {
                TL.ghost = document.createElement("div");
                this.draggedMarker.classList.forEach(c =>
                    TL.ghost.classList.add(c));
                TL.ghost.classList.add("ghost");
                TL.ghost.classList.remove("dragged");
                let l = TL.ghost.appendChild(document.createElement("div"));
                l.classList.add("label", "left");
                let r = TL.ghost.appendChild(document.createElement("div"));
                r.classList.add("label", "right");
                TL.appendChild(TL.ghost);
            }

            // Snap to nearest value
            let left = rm.left < rl.left? 0 : rm.left - rl.left;
            if(rm.right > rl.right)
                left = rl.right - rm.clientWidth;

            TL.ghost.style.left = left + "px";

            // Update labels
            const ppy =
                (parseFloat(this.dataset.max) - parseFloat(this.dataset.min)) /
                TL.clientWidth;
            TL.ghost.querySelector(".left").innerHTML =
                (parseInt(this.dataset.min) + ppy * + left)
                    .toFixed(parseInt(this.dataset.decimals));
            TL.ghost.querySelector(".right").innerHTML =
                (parseInt(this.dataset.min) + ppy * + left + TL.ghost.clientWidth)
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
            e.stopPropagation();
            const timeline = this.closest("esm-response-timeline");

            // Destroy drag marker
            timeline.draggedMarker.remove();
            timeline.draggedMarker = null;
            document.removeEventListener("mousemove", timeline.moveMarker);
            document.removeEventListener("touchmove", timeline.moveMarker);

            // Reify ghost

            // Add click event to ghost for adjustments

            // Don't process mouse event if we already processed the touch event
            if(e instanceof TouchEvent)
                return false;
        }

        /**
         * Return the pixel coordinates which would indicate an the given estimate and confidence
         * @param estimate {number}
         * @param confidence {number}
         * @return {{estimateProportion: number, confidence: number}}
         */
        valueToProportion(estimate, confidence) {
            // Convert estimate to a proportion of the available value range
            const p =
                (estimate - this.dataset.min) /
                (this.dataset.max - this.dataset.min);

            return {estimateProportion: p, confidence}
        }

        /**
         * Take pixel coordinates from a MouseEvent or TouchEvent and convert into
         * a percentage offset
         * @param x {int} horizontal pixel position
         * @param y {int} vertical pixel position
         * @return {{x: number, y: number}}
         */
        pixelsToValues(x, y) {
            // x
            const hBar = this.querySelector(".response-hBar");
            const timeline = hBar.querySelector(".response-timeline");

            let cursor =
                x - hBar.getBoundingClientRect().x - (timeline.clientWidth / 2);
            let max = hBar.clientWidth - timeline.clientWidth;
            const xNew = cursor < 0? 0 : cursor > max? max : cursor;
            const xProp = xNew / max;

            let number =
                (parseFloat(this.dataset.max) - parseFloat(this.dataset.min)) /
                (hBar.clientWidth - timeline.clientWidth) *
                xNew;
            number += parseFloat(this.dataset.min);
            const text =
                this.dataset.prefix +
                number.toFixed(this.dataset.decimals || 0) +
                this.dataset.suffix;

            // y
            const vBar = this.querySelector(".response-vBar");
            const marker = vBar.querySelector(".response-marker");

            cursor =
                vBar.getBoundingClientRect().top - y + (marker.clientHeight / 2);
            max = vBar.clientHeight - marker.clientHeight;
            cursor *= -1;
            const yNew = cursor < 0? 0 : cursor > max? max : cursor;
            const p = 1 - (yNew / (vBar.clientHeight - marker.clientHeight));

            return {
                x: xNew,
                y: yNew,
                estimateLabel: text,
                estimate: number,
                estimateProportion: xProp,
                confidence: p
            };
        }

        /**
         * Update the visuals of the ResponseTimeline
         * @param values {object} values obtained from user interaction
         * @param specify {object} which (x {boolean} and y {boolean}) to update
         */
        updateVisual(values, specify = {x: false, y: false}) {
            if(specify.x) {
                const timeline = this.querySelector(".response-timeline");

                timeline.style.left = values.x + "px";
                this.querySelector(".response-marker").innerText = values.estimateLabel;
                timeline.classList.remove("cloak");
            }
            if(specify.y) {
                const timeline = this.querySelector(".response-marker");

                timeline.style.top = values.y + "px";
                timeline.style.opacity = (.6 * values.confidence) + .4;
            }
        }

        /**
         * Handle estimate input. Update the visual position of the response
         * timeline, the timeline label, and store the current value.
         * @param e {MouseEvent|TouchEvent} a mouse move/click or touch event
         */
        updateEstimate(e) {
            const val = this.pixelsToValues(e.clientX, 0);

            this.updateVisual(val, {x: true});

            // Record estimate info
            this.responseData.estimate = val.estimate;
            this.responseData.estimateLabel = val.estimateLabel;
            this.responseData.estimateProportion = val.estimateProportion;
            this.responseData.x = val.x;
            this.responseData.eventX = e.clientX;
            this.responseData.timeEstimate = new Date().getTime();
        }

        /**
         * Save estimate input. Remove the estimate events. Add confidence
         * events.
         * @param e {MouseEvent|TouchEvent} a mouse click/touch event
         */
        saveEstimate(e) {
            this.updateEstimate(e);
            this.removeEventListener("mousemove", this.updateEstimate);
            this.removeEventListener("click", this.saveEstimate);

            if(this.dataset.noConfidence !== "true") {

                // Show the confidence bar
                this.querySelector(".response-vBar").classList.remove('cloak');

                // Enable confidence responding
                this.addEventListener("mousemove", this.updateConfidence);
                this.addEventListener("click", this.saveConfidence);
            } else
                this.responseData.complete = true;

        }

        /**
         * Perform the response collection process.
         *
         * @param [timeout=null] {int|null|undefined} maximum number of milliseconds to wait before
         * returning a Timeout.
         *
         * @return {Promise} Resolve with the response data, or Timeout reject
         */
        getResponse(timeout) {
            if(typeof timeout === "undefined" || timeout === null)
                timeout = this.dataset.hasOwnProperty("timeout")?
                    this.dataset.timeout : Infinity;

            const me = this;
            this.enableResponse();

            return new Promise(function (resolve, reject) {
                let ms = 50;
                let check = function(x) {
                    if(me.responseData.complete) {
                        //setTimeout(() => me.reset(), 25);
                        resolve(me.responseData);
                    }
                    else if(x > timeout / ms)
                        reject("Timeout");
                    else
                        setTimeout(check, ms, x + 1);
                };
                check(0);
            });
        }

        /**
         * Refresh the element ready for collecting a new response.
         */
        reset() {
            this.classList.add('cloak');

            // clear data
            this.responseData = {
                x: null,
                y: null,

                eventX: null,
                eventY: null,

                estimate: null,
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

            let style = document.querySelector("#response-timeline-css");
            if(style === null) {
                style = document.createElement('style');
                style.id = "response-timeline-css";
                style.type = "text/css";
                document.head.appendChild(style);
            }

            const min = parseFloat(this.dataset.min);
            const max = parseFloat(this.dataset.max);
            const w = this.querySelector(".response-line").clientWidth / (max - min);
            const thin = (parseFloat(this.dataset.markerWidthThin) * w) + "px";
            const med = (parseFloat(this.dataset.markerWidthMedium) * w) + "px";
            const thick = (parseFloat(this.dataset.markerWidthThick) * w) + "px";

            style.innerHTML = ".response-marker.thin {width: " +
                thin + "} " +
            ".response-marker.medium {width: " + med + "} " +
            ".response-marker.thick {width: " + thick + "}";

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