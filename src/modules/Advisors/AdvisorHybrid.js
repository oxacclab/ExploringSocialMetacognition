import {Advisor} from "./Advisor.js";

/**
 * @class AdvisorHybrid
 * @extends Advisor
 * @classdesc Hybrids allow advice to be presented from one of a list of advisors while being labelled as coming from an ambiguous source.
 */
class AdvisorHybrid extends Advisor {
    /**
     * @param blueprint {object} Options used to construct the class
     * @param blueprint.blueprints {Advisor[]|object[]} Advisors or advisor representations to stitch together to form the hybrid
     * @param [name='?'] {string} name to give to the hybrid
     */
    constructor(blueprint) {

        super(blueprint.blueprints[0]);

        const hybridIds = [];
        const hybridDescriptions = [];

        for (let bp of blueprint.blueprints) {
            hybridIds.push(bp.id);
            hybridDescriptions.push(bp.idDescription);
        }

        this._readBlueprint(blueprint);

        this.hybridBlueprints = blueprint.blueprints;

        this.hybridIds = hybridIds.join('|');
        this.hybridDescriptions = hybridDescriptions.join('|');

        this.name = this.name || '?';
    }

    /**
     * Construct an SVG made up of slices of the SVGs of the blueprinted advisors
     * @return {null|*}
     */
    get svg() {
        if (!this._image) {
            this.info("Generating hybrid identicon");

            // Sort blueprints by ids to ensure same hybrid has same look regardless of who is actually giving the advice
            const blueprints = this.hybridBlueprints
                .sort((a, b) => a.id < b.id ? 1 : -1);

            const svgToBase64 = (svg) => {
                let xml = svg.querySelector('svg').outerHTML;
                xml = xml.replace(/clippath/g, 'clipPath');
                xml = xml.replace(/<defs[^>]+/, '<defs');
                return btoa(xml);
            };

            const images = [];
            for (let bp of this.hybridBlueprints) {
                const svg = new Advisor(bp).svg;
                const match = /^data:image\/svg\+xml;base64,(\S+)$/.exec(svg);
                if (match && match[1]) {
                    const svg = atob(match[1]);
                    const obj = new DOMParser().parseFromString(svg, 'text/xml');
                    images.push(obj);
                } else
                    this.warn(`Unable to register hybrid blueprint image segment for advisor ${bp.id}`);
            }

            const theta = Math.PI * 2 / images.length;
            const offset = Math.PI * 2 * 3 / 8;
            const width = 150;
            const r = Math.sqrt(2 * Math.pow(width, 2)); // radius
            const tweak = width;

            for (let i = 0; i < images.length; i++) {
                const img = images[i];
                // Add a clipPath to obscure unwanted pieces
                let start = [
                    tweak + Math.cos(offset + theta * i) * r,
                    tweak + Math.sin(offset + theta * i) * r
                ];
                let end = [
                    tweak + Math.cos(offset + theta * (i + 1)) * r,
                    tweak + Math.sin(offset + theta * (i + 1)) * r
                ];

                const clipId = "clip-path-" + i.toString();

                // Apply clip mask
                const pathAttr = document.createAttribute('clip-path');
                pathAttr.value = "url(#" + clipId + ")";
                img.querySelector('svg g').attributes.setNamedItem(pathAttr);
                img.querySelector('svg').insertBefore(document.createElement('defs'), img.querySelector('svg').firstChild);
                const clip = img.querySelector('defs').appendChild(document.createElement('clippath'));
                clip.id = clipId;
                clip.innerHTML =
                    `<path d="M ${start[0]} ${start[1]} A 1 1 0 0 0 ${end[0]} ${end[1]} Z"/>`;

                if (!i)
                    this._image = img;
                else {
                    this._image.querySelector('svg')
                        .appendChild(img.querySelector('g'));
                    this._image.querySelector('defs')
                        .appendChild(img.querySelector('clippath'));
                    // Add lines showing the divide
                    this._image.querySelector('svg')
                        .innerHTML += `<g><line x1="${start[0]}" y1="${start[1]}" x2="${width}" y2="${width}" style="stroke:rgb(0,0,0);stroke-width:4"/><line x1="${end[0]}" y1="${end[1]}" x2="${width}" y2="${width}" style="stroke:rgb(0,0,0);stroke-width:4"/></g>`;
                }
            }

            this._image = "data:image/svg+xml;base64," + svgToBase64(this._image);
        }
        return this._image;
    }
}

export {AdvisorHybrid};