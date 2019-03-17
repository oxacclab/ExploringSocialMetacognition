customElements.define('esm-instruction',
    /**
     * @class InstructionBooklet
     *
     * Contains pages of instructions which can be navigated.
     * Properties are defined using the data-* HTML properties.
     *
     * @property [showBackNavigation=true] {boolean} whether to show the 'previous' arrow
     * @property [prevButtonText="< Back"] {string} text of 'previous' button
     * @property [nextButtonText="Next >"] {string} text of 'next' button
     * @property [endButtonText="Okay!"] {string} text of 'end' button
     */
    class InstructionBooklet extends HTMLElement {

        /**
         * Definition of initial variables.
         */
        constructor() {
            super();

            this._fixId();
            this.setPageIds();

            this.callback = null;

            if(this.dataset.noButtons !== "true")
                this._spawnButtons();

            setTimeout(()=>
                this.showPage(
                    this.querySelector("esm-instruction-page:first-child").id),
                0);
        }

        get pages() {
            return this.querySelectorAll("esm-instruction-page");
        }

        /**
         * Return the currently visible page
         * @return {HTMLElement|null}
         */
        get currentPage() {
            for(let p of this.pages) {
                if(!p.isHidden)
                    return p;
            }

            return null;
        }

        /**
         * Get the index of the current page in the pages NodeList
         * @return {number}
         */
        get currentPageNumber() {
            for(let i = 0; i < this.pages.length; i++)
                if(this.pages[i] === this.currentPage)
                    return i;

            return NaN;
        }

        /**
         * Automatically generate the element's Id
         * @param [overwriteExisting=false] {boolean} overwrite existing Id with automatic one
         * @return {InstructionBooklet}
         * @protected
         */
        _fixId(overwriteExisting = false) {
            // Don't replace an existing Id
            if(this.id !== "" && !overwriteExisting)
                return this;

            let testId;
            let i = 0;
            do {
                testId = "Instruction" + (i++).toString();
            } while(document.getElementById(testId) !== null);

            this.id = testId;

            return this;
        }

        /**
         * Automatically assign Ids to child Page elements
         * @return {InstructionBooklet}
         */
        setPageIds() {
            let pageIds = [];
            let instId = this.id;
            let i = 0;

            this.pages.forEach((p) => {
                if(p.id === "")
                    p.id = instId + "Page" + (i++).toString();
                pageIds.push(p.id);
            });

            return this;
        }

        /**
         * Spawn the buttons used to navigate the instructions
         * @return {InstructionBooklet}
         * @protected
         */
        _spawnButtons() {
            this.buttonDiv = this.appendChild(document.createElement("div"));
            this.prevButton = this.buttonDiv
                .appendChild(document.createElement('button'));
            this.nextButton = this.buttonDiv
                .appendChild(document.createElement('button'));
            this.endButton = this.buttonDiv
                .appendChild(document.createElement('button'));

            // Button text
            this.prevButton.innerHTML =
                this.dataset.hasOwnProperty("prevButtonText")?
                    this.dataset.prevButtonText : "&lt; Back";
            this.nextButton.innerHTML =
                this.dataset.hasOwnProperty("nextButtonText")?
                    this.dataset.nextButtonText : "Next &gt;";
            this.endButton.innerHTML =
                this.dataset.hasOwnProperty("endButtonText")?
                    this.dataset.endButtonText : "Okay!";

            // Button events
            this.prevButton.addEventListener("click", this.prevPage);
            this.nextButton.addEventListener("click", this.nextPage);
            this.endButton.addEventListener("click", this.end);

            return this;
        }

        sendCallback(buttonName, event) {
            if(typeof this.callback === "function")
                this.callback(buttonName, event);
        }

        /**
         * Display the content of the requested page.
         * Update the navigation buttons to represent new navigation options.
         * @return {InstructionBooklet}
         */
        showPage(pageId) {
            this.querySelector("#" + pageId).display();

            if(this.dataset.noButtons !== "true") {

                let position = this.currentPageNumber;
                // Navigation special cases
                if(position === 0 || this.dataset.enableBackButton === "false") {
                    // First page shows no back button
                    this.prevButton.classList.add("cloak");
                } else
                    this.prevButton.classList.remove("cloak");
                if(position !== this.pages.length - 1) {
                    // Last page shows okay rather than next
                    this.endButton.classList.add("cloak");
                    this.nextButton.classList.remove("cloak");
                } else {
                    // Other pages show next rather than okay
                    this.nextButton.classList.add("cloak");
                    this.endButton.classList.remove("cloak");
                }
            }

            return this;
        }

        nextPage(e) {
            // Find the button owner
            const me = e? e.currentTarget.closest("esm-instruction") : this;
            me.sendCallback("next", e);

            let position = me.currentPageNumber;
            me.showPage(me.pages[position + 1].id);
        }

        prevPage(e) {
            // Find the button owner
            const me = e? e.currentTarget.closest("esm-instruction") : this;
            me.sendCallback("prev", e);

            let position = me.currentPageNumber;
            me.showPage(me.pages[position - 1].id);
        }

        end(e) {
            // Find the button owner
            const me = e? e.currentTarget.closest("esm-instruction") : this;
            me.sendCallback("end", e);

            me.classList.add("cloak");
        }
    }
);

customElements.define('esm-instruction-page',
    /**
     * @class InstructionBookletPage
     *
     * Contains instructions. Used to differentiate different display pages which can contain
     * any valid HTML tags.
     *
     */
    class InstructionBookletPage extends HTMLElement {

        /**
         * Definition of initial variables.
         */
        constructor() {
            super();

            this.hideClass = "cloak";
        }

        display() {
            let booklet = this.closest("esm-instruction");
            booklet.querySelectorAll("esm-instruction-page").forEach((elm) =>
                elm.hide());

            this.classList.remove(this.hideClass);
        }

        hide() {
            this.classList.add(this.hideClass);
        }

        get isHidden() {
            return this.classList.contains(this.hideClass);
        }
    }
);



/**
 * Inject the InstructionDiv CSS file
 */
function registerInstructionDivCSS() {

    // Inject styling
    const myLink = document.querySelector('script[src*="InstructionDiv.js"]');
    const href = myLink.src.replace("InstructionDiv.js", "InstructionDiv.css");

    const css = document.createElement('link');
    css.href = href;
    css.rel = "stylesheet";
    css.type = "text/css";
    document.head.appendChild(css);
}

registerInstructionDivCSS();
