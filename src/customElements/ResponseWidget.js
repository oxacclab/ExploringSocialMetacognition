customElements.define('esm-response-widget',
    /**
     * @class The ResponseWidget is a div element which handles responses from
     * the participant. Its properties are set using the data-* HTML fields.
     * Currently supports continuous values only, interpolated linearly from
     * data-min to data-max.
     *
     * @property min {double} Minimum response value
     * @property max {double} Maximum response value
     * @property prefix {string} Prefix to response values
     * @property suffix {string} Suffix to response values
     * @property decimals {int} Number of decimal points in response values
     * @property timeout {int} Maximum response time in ms
     * @property noConfidence {string} "true" = do not ask for confidence
     */
    class ResponseWidget extends HTMLElement {

        constructor() {
            super();

            setTimeout((me) => me.reset(), 0, this);
        }

        /**
         * Set up the events for handling estimate input.
         * @param [reset=true] {boolean} whether to reset the ResponseWidget prior to enabling responding
         */
        enableResponse(reset = true) {
            if(reset)
                this.reset();

            this.classList.remove("cloak");
            this.addEventListener("mousemove", this.updateEstimate);
            this.addEventListener("click", this.saveEstimate);
        }

        /**
         * Return the pixel coordinates which would indicate an the given estimate and confidence
         * @param estimate {number}
         * @param confidence {number}
         * @return {{estimateProportion: number, confidence: number}}
         */
        valueToProportion(estimate, confidence) {
            const hBarRect =
                this.querySelector(".response-hBar").getBoundingClientRect();
            const vBarRect =
                this.querySelector(".response-vBar").getBoundingClientRect();

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
            const widget = hBar.querySelector(".response-widget");

            let cursor =
                x - hBar.getBoundingClientRect().x - (widget.clientWidth / 2);
            let max = hBar.clientWidth - widget.clientWidth;
            const xNew = cursor < 0? 0 : cursor > max? max : cursor;
            const xProp = xNew / max;

            let number =
                (parseFloat(this.dataset.max) - parseFloat(this.dataset.min)) /
                (hBar.clientWidth - widget.clientWidth) *
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
         * Update the visuals of the ResponseWidget
         * @param values {object} values obtained from user interaction
         * @param specify {object} which (x {boolean} and y {boolean}) to update
         */
        updateVisual(values, specify = {x: false, y: false}) {
            if(specify.x) {
                const widget = this.querySelector(".response-widget");

                widget.style.left = values.x + "px";
                this.querySelector(".response-marker").innerText = values.estimateLabel;
                widget.classList.remove("cloak");
            }
            if(specify.y) {
                const widget = this.querySelector(".response-marker");

                widget.style.top = values.y + "px";
                widget.style.opacity = (.6 * values.confidence) + .4;
            }
        }

        /**
         * Handle estimate input. Update the visual position of the response
         * widget, the widget label, and store the current value.
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
         * Handle confidence input. Update the visual position of the response
         * widget and store the current value.
         * @param e {MouseEvent|TouchEvent} a mouse move/click or touch event
         */
        updateConfidence(e) {
            const val = this.pixelsToValues(0, e.clientY);

            this.updateVisual(val,{y: true});

            // Record response
            this.responseData.confidence = val.confidence;
            this.responseData.y = val.y;
            this.responseData.eventY = e.clientY;
            this.responseData.timeConfidence = new Date().getTime();
        }

        /**
         * Save confidence input. Remove the confidence events.
         * @param e {MouseEvent|TouchEvent} a mouse click/touch event
         */
        saveConfidence(e) {
            this.updateConfidence(e);
            this.removeEventListener("mousemove", this.updateConfidence);
            this.removeEventListener("click", this.saveConfidence);

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
                estimateLabel: null,
                estimateProportion: null,
                timeEstimate: null,

                confidence: null,
                timeConfidence: null,

                complete: false
            };

            // reset widget styling
            this.querySelector(".response-widget").style.left = "";
            this.querySelector(".response-widget").classList.add("cloak");
            this.querySelector(".response-vBar").classList.add('cloak');
            this.querySelector(".response-marker").style.top = "";
            this.querySelector(".response-marker").style.opacity = "1";

            let d = this.dataset;
            let number = (parseFloat(d.max) - parseFloat(d.min)) / 2;
            number += parseFloat(d.min);

            this.querySelector(".response-marker").innerText =
                d.prefix + number.toFixed(d.decimals || 0) + d.suffix;
        }
    }
);

/**
 * Inject the ResponseWidget CSS file
 */
function registerResponseWidgetCSS() {

    // Inject styling
    const myLink = document.querySelector('script[src*="ResponseWidget.js"]');
    const href = myLink.src.replace("ResponseWidget.js", "ResponseWidget.css");

    const css = document.createElement('link');
    css.href = href;
    css.rel = "stylesheet";
    css.type = "text/css";
    document.head.appendChild(css);
}

registerResponseWidgetCSS();