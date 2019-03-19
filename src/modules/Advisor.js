/**
 * Advisor
 * Matt Jaquiery, March 2019
 *
 * Javascript library for running social metacognition studies.
 */

"use strict";

import {BaseObject} from "./Prototypes.js";

class Advisor extends BaseObject {
    constructor(blueprint) {
        super(blueprint);

        this.id = blueprint.id;
        this.name = blueprint.name;
        this.group = blueprint.group;
        this.lastAdvice = null;
        this.marker = null;

        this.templateId = blueprint.templateId;
    }

    /**
     * Create a response marker
     * @param [appendTo=null] {HTMLElement} to append the marker to
     * @return {HTMLElement}
     */
    createMarker(appendTo = null) {
        this.marker =
            this.getInfoTab().querySelector(".marker").cloneNode(true);

        this.marker.classList.add("advisor", "response-marker");

        if(appendTo !== null)
            appendTo.appendChild(this.marker);

        return this.marker;
    }

    drawAdvice() {

        if(this.marker === null)
            this.createMarker(
                document.querySelector("esm-response-widget .response-hBar"));

        const d = document.querySelector("esm-response-widget")
            .valueToProportion(
                this.getAdvice(false).estimate,
                this.getAdvice(false).confidence
            );

        let box = document.querySelector(".response-hBar")
            .getBoundingClientRect();

        // General position format is %(span) + adjustment
        this.marker.style.left =
            (d.estimateProportion * (box.width - box.height) +
                (box.height / 2) -
                (this.marker.clientWidth / 2)) + "px";

        box = document.querySelector(".response-vBar").getBoundingClientRect();

        this.marker.style.top = "calc(" +
            ((1 - d.confidence) * (box.height - this.marker.clientHeight)) + "px" +
            " - " +
            "var(--response-vBar-offset))";
    }

    hideAdvice() {
        if(this.marker !== null) {
            this.marker.remove();
            this.marker = null;
        }
    }

    getAdvice(recalculate = true) {
        if(recalculate || this.lastAdvice === null)
            this.lastAdvice = {
                estimate: 2.5 - 1.5 + (Math.random() * 4),
                confidence: 0.5
            };

        return this.lastAdvice;
    }

    /**
     *
     * @param [templateId] {string} id of the template to clone
     * @return {Node}
     */
    getInfoTab(templateId) {
        if(!templateId)
            templateId = this.templateId;

        const template = document.getElementById(templateId);
        const elm = document.importNode(template.content, true);
        elm.querySelector(".advisor-key-row").classList.add(
            "group-bg-" + this.group,
            "group-border-" + this.group
        );
        elm.querySelector(".marker svg circle").classList.add(
            "advisor-bg-" + this.id,
            "advisor-border-" + this.id
        );
        elm.querySelector(".advisor-key-row span").innerHTML = this.name;

        return elm.querySelector(".advisor-key-row");
    }
}

export {Advisor};