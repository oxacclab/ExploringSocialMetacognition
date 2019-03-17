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

        this.templateId = blueprint.templateId;
    }

    drawAdvice() {
        const marker = document.querySelector("esm-response-widget .response-marker.advisor-" + this.id);
        const d = document.querySelector("esm-response-widget")
            .valueToProportion(this.getAdvice(false).estimate, Math.random());
        let box = document.querySelector(".response-hBar")
            .getBoundingClientRect();
        // General position format is %(span) + adjustment
        marker.style.left =
            (d.estimateProportion * (box.width - box.height) +
                ((box.height - marker.clientWidth) / 2) -
                (marker.clientWidth / 2)) + "px";
        box = document.querySelector(".response-vBar").getBoundingClientRect();
        marker.style.top = "calc(" +
            ((1 - d.confidence) * (box.height - marker.clientHeight)) + "px - " +
            "var(--response-vBar-offset))";
    }

    getAdvice(recalculate = true) {
        if(recalculate || this.lastAdvice === null)
            this.lastAdvice = {
                estimate: 3.75,
                confidence: Math.random()
            };

        return this.lastAdvice;
    }

    /**
     *
     * @param templateId {string} id of the template to clone
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
        elm.querySelector(".marker").classList.add(
            "advisor-bg-" + this.id,
            "advisor-border-" + this.id
        );
        elm.querySelector(".advisor-key-row span").innerHTML = this.name;

        return elm.querySelector(".advisor-key-row");
    }
}

export {Advisor};