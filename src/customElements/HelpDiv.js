customElements.define('esm-help',
    /**
     * @class The HelpDiv contains help text which will be shown in a
     * tooltip-like manner. Properties are defined using the data-* HTML
     * properties.
     *
     * A HelpDiv is shown when its parent element is clicked. Hovering
     * over a parent element of an active HelpDiv will show an outline.
     *
     * A HelpDiv can be shown/hidden which indicates whether it is visible.
     * A HelpDiv can also be in/active, which indicates whether it has the
     * potential to be shown/hidden when its parent element is clicked.
     * HelpDivs start hidden and inactive.
     *
     * @property group {string[]} space-separated list of help groups.
     * HelpDivs will hide all other HelpDivs sharing a group when they
     * are revealed.
     */
    class HelpDiv extends HTMLElement {

        /**
         * Definition of initial variables.
         */
        constructor() {
            super();

            this.lastToggleTime = new Date().getTime();
            this.minToggleTimeDifference = 25;

            let me = this;
            this.sendShowHelpEvent = function(e) {
                me.dispatchEvent(new CustomEvent("showHelp", {
                    bubbles: false,
                    detail: {
                        parentEvent: e
                    },
                    target: me
                }));
            };
        }

        /**
         * Display to the user.
         */
        show() {
            // Close HelpDivs with a shared (space-separated) group tag
            if(this.dataset.hasOwnProperty("group")) {
                // Iterate this element's groups
                this.dataset.group.split(" ").forEach((g) => {
                        let others = document.querySelectorAll(
                            "esm-help[data-group~='" + g + "']"
                        );
                        others.forEach((elm) => elm.classList.remove("show"));
                    }
                );
            }

            this.classList.add("show");

            return this;
        }

        /**
         * Hide from the user.
         * @param parentClick {boolean} whether the parent element was clicked
         * (as opposed to this element, or hiding via a script call).
         */
        hide(parentClick = false) {
            // Don't close by clicks on the element that opened this
            if(this.dataset.parentClickCloses === "false" && parentClick)
                return this;

            this.classList.remove("show");

            return this;
        }

        /**
         * Toggle between show and hide states.
         * @param e {Event} event responsible for engaging the toggle
         */
        toggleVisibility(e) {
            let now = new Date().getTime();
            if(now < this.lastToggleTime + this.minToggleTimeDifference)
                return;
            else
                this.lastToggleTime = now;

            return this.classList.contains("show")?
                this.hide(e && e.type === "showHelp") : this.show();
        }

        /**
         * Set up the event listeners on the HelpDiv and its parent element
         */
        enable() {
            this.parentElement.addEventListener("click", this.sendShowHelpEvent);
            this.parentElement.classList.add("esm-help-enabled");

            this.addEventListener("click", this.toggleVisibility);
            this.addEventListener("showHelp", this.toggleVisibility);

            return this;
        }

        /**
         * Hide. Remove event listeners.
         */
        disable() {
            this.hide();

            this.parentElement.removeEventListener("click",
                this.sendShowHelpEvent);
            this.parentElement.classList.remove("esm-help-enabled");

            this.removeEventListener("click", this.toggleVisibility);
            this.removeEventListener("showHelp", this.toggleVisibility);

            return this;
        }

        /**
         * Toggle between in/active states.
         */
        toggle() {
            if(this.parentElement.classList.contains("esm-help-enabled"))
                this.disable();
            else
                this.enable();
        }
    }
);

/**
 * Inject the HelpDiv CSS file
 */
function registerHelpDivCSS() {

    // Inject styling
    const myLink = document.querySelector('script[src*="HelpDiv.js"]');
    const href = myLink.src.replace("HelpDiv.js", "HelpDiv.css");

    const css = document.createElement('link');
    css.href = href;
    css.rel = "stylesheet";
    css.type = "text/css";
    document.head.appendChild(css);
}

registerHelpDivCSS();
