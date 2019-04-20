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
            this.getInfoTab().querySelector(".response-marker").cloneNode(true);

        this.marker.classList.remove("static", "medium");

        if(appendTo !== null)
            appendTo.appendChild(this.marker);

        return this.marker;
    }

    drawAdvice() {
        this.info("Drawing advice");

        const rw = document.getElementById("response-panel");
        switch (rw.tagName.toLowerCase()) {
            case "esm-response-widget":
                this.drawWidgetAdvice();
                break;
            case "esm-response-timeline":
                this.drawTimelineAdvice();
                break;
        }
    }

    drawWidgetAdvice() {
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

    drawTimelineAdvice() {
        if(this.marker === null)
            this.createMarker(
                document.querySelector("esm-response-timeline .response-line"));

        const TL = document.querySelector("esm-response-timeline");

        // General position format is %(span) + adjustment
        this.marker.style.left =
            TL.valueToPixels(this.getAdvice(false).estimate -
            this.getAdvice(false).confidence) + "px";

        this.marker.style.width = TL.valueToPixels(this.getAdvice(false).confidence * 10, true) + "px";

        console.log(this.getAdvice(false))
    }

    hideAdvice() {
        if(this.marker !== null) {
            this.marker.remove();
            this.marker = null;
        }
    }

    getAdvice(recalculate = true) {

        if(recalculate || this.lastAdvice === null) {
            if(this.lastAdvice === null && !recalculate)
                this.warn("Advice requested where none exists; recalculating.");
            else
                this.info("Calculating advice");

            let confidence = 0.5;

            this.lastAdvice = {
                estimate: 1900 + (Math.random() *
                    (100 - Math.round(confidence * 10))),
                confidence
            };
        }

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
        elm.querySelector(".response-marker").classList.add(
            "advisor-bg-" + this.id,
            "advisor-border-" + this.id
        );
        elm.querySelector(".advisor-key-row span").innerHTML = this.name;

        return elm.querySelector(".advisor-key-row");
    }

    /**
     * Fetch the data for the study in a flat format suitable for CSVing
     * @param [headers=null] {string[]|null} values to read. Defaults to
     * this.tableHeaders
     * @return {object} key-value pairs where all values are single items
     */
    toTable(headers=null) {
        const out = {};

        // Use own headers if not supplied
        if(headers === null)
            headers = this.tableHeaders;

        for(let h of headers)
            out[h] = typeof this[h] === "undefined"? null : this[h];

        return out;
    }

    /**
     * @return {string[]} headers for the columns of this.toTable()
     */
    get tableHeaders() {
        return [
            "id", "group", "name"
        ];
    }
}

export {Advisor};