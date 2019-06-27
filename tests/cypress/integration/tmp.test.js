/**
 * This file contains tests being implemented so we don't have to step through the whole damn bunch every time.
 *
 * Matt Jaquiery, June 2019
 */

describe('The Study', function() {

    it('Starts halfway through', function() {
        cy.visit('localhost/ExploringSocialMetacognition/ACv2/?PROLIFIC_PID=CypressTest&consent=true');

        // Accept fullscreen prompt
        cy.get('esm-instruction button:last-of-type')
            .contains('Okay!')
            .should('be.visible')
            .click();

        cy.window()
            .its('study')
            .should((study) => {
                study.run("debriefAdvisors");
                return true;
            });
    });
});