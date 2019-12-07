import * as utils from "../utils.js";

customElements.define('esm-confidence-widget',
    /**
     * @class The ConfidenceWidget is a div element which handles confidence judgements from the participant. Its properties are set using the data-* HTML fields.
     *
     * @property labels {string[]} comma-separated button labels for confidence options
     * @property timeout {int} Maximum response time in ms
     * @property buttonClasses {string[]} classes to apply to the buttons
     */
    class ConfidenceWidget extends HTMLElement {

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

            if(this.timeout > 0)
                this.timeoutTimer = setTimeout(this.reject, this.timeout, "timeout");
        }

        /**
         * Save input. Remove the events.
         */
        saveResponse() {

            if(typeof this.resolve === "function")
                this.resolve(this.responseData);

            if(this.timeoutTimer)
                clearTimeout(this.timeoutTimer);
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
                confidence: null,
                timeConfidence: null
            };

            // reset timeline styling
            this.resetButtons();
        }

        get buttonDiv() {
            const bd = this.querySelector("div.buttons");
            if(bd)
                return bd;

            const elm = this.appendChild(document.createElement('div'));
            elm.classList.add('buttons');

            return elm;
        }

        resetButtons() {
            const buttonClasses = utils.explodeCommaList(this.dataset.buttonClasses);

            const buttonDiv = this.buttonDiv;
            buttonDiv.innerHTML = "";

            const buttonLabels = utils.explodeCommaList(this.dataset.labels);

            buttonLabels.map((s) => {
                const elm = document.createElement("button");
                elm.classList.add("confidence-button", s, ...buttonClasses);
                elm.innerText = s;

                elm.addEventListener('click', (e) => {
                    const cw = this.closest('esm-confidence-widget');
                    cw.responseData.confidence = s;
                    cw.responseData.timeConfidence = new Date().getTime();

                    cw.saveResponse();
                });

                buttonDiv.appendChild(elm);
            })
        }
    }
);

/**
 * Inject the ResponseTimeline CSS file
 */
function registerConfidenceWidgetCSS() {

    // Inject styling
    const myLink = document.querySelector('script[src*="ConfidenceWidget.js"]');
    const href = myLink.src.replace("ConfidenceWidget.js", "ConfidenceWidget.css");

    const css = document.createElement('link');
    css.href = href;
    css.rel = "stylesheet";
    css.type = "text/css";
    document.head.appendChild(css);
}

registerConfidenceWidgetCSS();