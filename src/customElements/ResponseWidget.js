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
     */
    class ResponseWidget extends HTMLElement {

        constructor() {
            super();

            setTimeout((me) => me.reset(), 0, this);
        }

        /**
         * Set up the events for handling estimate input.
         */
        enableResponse() {
            this.classList.remove("cloak");

            this.addEventListener("mousemove", this.updateEstimate);
            this.addEventListener("click", this.saveEstimate);
        }

        /**
         * Handle estimate input. Update the visual position of the response
         * widget, the widget label, and store the current value.
         * @param e {MouseEvent} a mouse move event
         */
        updateEstimate(e) {
            let hBar = this.querySelector(".response-hBar");
            let widget = hBar.querySelector(".response-widget");

            let cursor =
                e.clientX -
                hBar.getBoundingClientRect().x -
                (widget.clientWidth / 2);
            let max = hBar.clientWidth - widget.clientWidth;
            let left = cursor < 0? 0 : cursor > max? max : cursor;

            widget.style.left = left + "px";

            // Text label
            let d = this.dataset;
            let number =
                (parseFloat(d.max) - parseFloat(d.min)) /
                (hBar.clientWidth - widget.clientWidth) *
                left;
            number += parseFloat(d.min);

            let text = d.prefix + number.toFixed(d.decimals || 0) + d.suffix;

            widget.querySelector(".response-marker").innerText = text;

            // Record estimate info
            this.responseData.estimate = number;
            this.responseData.estimateLabel = text;
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

            // Show the confidence bar
            this.querySelector(".response-vBar").classList.remove('cloak');

            // Enable confidence responding
            this.addEventListener("mousemove", this.updateConfidence);
            this.addEventListener("click", this.saveConfidence);

        }

        /**
         * Handle confidence input. Update the visual position of the response
         * widget and store the current value.
         * @param e {MouseEvent} a mouse move event
         */
        updateConfidence(e) {
            let vBar = this.querySelector(".response-vBar");
            let widget = e.currentTarget.querySelector(".response-marker");
            let cursor =
                vBar.getBoundingClientRect().top -
                e.clientY +
                (widget.clientHeight / 2);
            let max = vBar.clientHeight - widget.clientHeight;
            cursor *= -1;
            let top = cursor < 0? 0 : cursor > max? max : cursor;
            widget.style.top = top + "px";

            let p = 1 - (1 / (vBar.clientHeight - widget.clientHeight) * top);

            widget.style.opacity = (.6 * p) + .4;

            // Record response
            this.responseData.confidence = p;
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
         * @param timeout {int} maximum number of milliseconds to wait before
         * returning a Timeout.
         *
         * @return {Promise} Resolve with the response data, or Timeout reject
         */
        getResponse(timeout) {
            const me = this;
            this.enableResponse();

            return new Promise(function (resolve, reject) {
                let ms = 50;
                let check = function(x) {
                    if(me.responseData.complete) {
                        setTimeout(() => me.reset(), 25);
                        resolve(me.responseData);
                    }
                    else if(x > timeout / ms)
                        reject("Timeout");
                    else
                        setTimeout(check, ms, x++);
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
                estimate: null,
                estimateLabel: null,
                timeEstimate: null,

                confidence: null,
                timeConfidence: null,

                complete: false
            };

            // reset widget styling
            this.querySelector(".response-widget").style.left = "";
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