
customElements.define('esm-questionnaire-widget',
    /**
     * @class The QuestionnaireWidget is a div element which handles giving questionnaires to the participant. Its properties are set using the data-* HTML fields, while its contents are set in HTML as if it were a form.
     *
     * @property [name="Questionnaire"] {string} Questionnaire name
     * @property [timeout=null] {int|null} Maximum response time in ms
     * @property [buttonClasses=null] {string[]|null} classes to apply to the buttons
     * @property [mandatory=0] {int} whether items are mandatory (1) or not (0) by default
     */
    class QuestionnaireWidget extends HTMLElement {

        constructor() {
            super();

            this.dataset.name = typeof this.dataset.name === "undefined"? "questionnaire" : this.dataset.name;
            this.dataset.mandatory = this.dataset.mandatory || 0;

            // Set up individual questions
            this.questions.forEach(q => {
                // Set mandatory defaults where necessary
                q.dataset.mandatory = q.dataset.mandatory | this.dataset.mandatory;
                // Set activation effect on individual items
                q.querySelectorAll('.esm-qw-item').forEach(i => {
                    // Clear rejected status
                    i.addEventListener('changed', e => {
                        e.target.closest('.esm-qw-question').classList.remove('rejected');
                    })
                });
            });

            setTimeout((me) => me.reset(), 0, this);
        }

        get questions() {
            return this.querySelectorAll('.esm-qw-question');
        }

        /**
         * Set up the events for handling estimate input.
         * @param [reset=true] {boolean} whether to reset the ResponseTimeline prior to enabling responding
         */
        enableResponse() {

            this.responseData[this.dataset.name + 'TimeOpen'] = new Date().getTime();

            this.classList.remove("cloak");

            if(this.timeout > 0)
                this.timeoutTimer = setTimeout(this.reject, this.timeout, "timeout");
        }

        /**
         * Save input. Remove the events.
         */
        saveResponse() {

            if(!this.checkResponse()) {
                return false;
            }

            if(typeof this.resolve === "function")
                this.resolve(this.responseData);

            if(this.timeoutTimer)
                clearTimeout(this.timeoutTimer);

            if(this.resetAfterSubmission)
                this.reset();
        }

        /**
         * Update the visuals for invalid responses and return whether all items were completed
         * @return {boolean}
         */
        checkResponse() {
            let okay = true;

            this.responseData[this.dataset.name + 'TimeSubmitted'] = new Date().getTime();

            // Check items and store their data
            this.questions.forEach(q => {
                let checkedItem = q.querySelector('.esm-qw-item input:checked');
                if(!checkedItem) {
                   q.classList.add('esm-qw-rejected');
                   okay = false;
               } else {
                    const name = checkedItem.name[0].toUpperCase() + checkedItem.name.substr(1);
                    const prompt = q.querySelector('.esm-qw-prompt');

                    if(prompt)
                        this.responseData[this.dataset.name + name + 'Prompt'] = prompt.innerHTML;

                    this.responseData[this.dataset.name + name + 'Value'] = checkedItem.value;
                    this.responseData[this.dataset.name + name + 'Label'] = document.querySelector('label[for="' + checkedItem.id + '"]').innerHTML;
                }
            });

            return okay;
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

            this.resetAfterSubmission = reset;

            const me = this;
            this.enableResponse();


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
            this.responseData = {};

            // clear rejected statuses
            this.querySelectorAll('.rejected').forEach(e => {
                e.classList.remove('rejected');
            });

            // clear answers
            this.querySelectorAll(':checked').forEach(e => {
                e.checked = false;
            });

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
            const buttonClasses = QuestionnaireWidget.explodeCommaList(this.dataset.buttonClasses);

            const buttonDiv = this.buttonDiv;
            buttonDiv.innerHTML = "";

            const elm = document.createElement("button");
            elm.classList.add("questionnaire-button", ...buttonClasses);
            elm.innerHTML = '&check;';

            elm.addEventListener('click', (e) => {
                const qw = this.closest('esm-questionnaire-widget');

                qw.saveResponse();
            });

            buttonDiv.appendChild(elm);
        }

        /**
         * Split a comma-separated list into its component items
         * @param list {string} comma-separated list
         * @return {string[]} array of items in list
         */
        static explodeCommaList(list) {
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
    }
);

/**
 * Inject the ResponseTimeline CSS file
 */
function registerQuestionnaireWidgetCSS() {

    // Inject styling
    const myLink = document.querySelector('script[src*="QuestionnaireWidget.js"]');
    const href = myLink.src.replace("QuestionnaireWidget.js", "QuestionnaireWidget.css");

    const css = document.createElement('link');
    css.href = href;
    css.rel = "stylesheet";
    css.type = "text/css";
    document.head.appendChild(css);
}

registerQuestionnaireWidgetCSS();