const runs = 1;
for(let run = 0; run < runs; run++) {

    describe('ACv2 (run=' + run + ')', function() {

        it('Checks browser compatability', function() {
            cy.visit('localhost/ExploringSocialMetacognition/ACv2/?PROLIFIC_PID=CypressTest');

            cy.get('iframe')
                .should('be.visible');
        });

        it('Redirects to collect confidence', function() {
            cy.url()
                .should('include', '/consent.html')
                .should('include', '?PROLIFIC_PID=CypressTest');

            // Click checkboxes
            cy.get('input[type="checkbox"]')
                .click({multiple: true});

            // Give consent
            cy.get('input[type="submit"')
                .click();

            // Should be redirected to the actual test now
            cy.url().should('not.include', '/consent.html');
        });

        it('Welcomes the user', function() {

            // Should connect
            cy.contains('Welcome')
                .should('be.visible');

            // First welcome screen
            cy.get('esm-instruction button:last-of-type')
                .contains('Okay!')
                .should('be.visible')
                .click();
        });

        it('Creates a DatesStudy object', function() {
            cy.window()
                .its('study')
                .its('constructor')
                .its('name')
                .should('eq', 'DatesStudy');
        });

        it('Asks about the browser', function() {
            // Should ask about
            cy.contains('Device')
                .should('be.visible');
            cy.contains('OS / Type')
                .should('be.visible');
            cy.contains('Browser')
                .should('be.visible');

            // Click some options
            cy.get('div.item:first-of-type input[type="radio"]')
                .click({multiple: true});

            // Submit
            cy.get('button[name="submit"]')
                .click();
        });

        it('Gets study variables from server', function() {
            cy.window()
                .its('study')
                .its('id')
                .should('have.length', 8);

            cy.window()
                .its('study')
                .its('condition')
                .should('gt', 0);
        });

        it('Describes the study', function() {
            // Should connect
            cy.contains('About the study')
                .should('be.visible');

            // Click through instructions
            cy.get('esm-instruction button')
                .contains('Next')
                .should('be.visible')
                .click();

            // Keep going
            cy.get('esm-instruction button')
                .contains('Next')
                .should('be.visible')
                .click();

            cy.get('esm-instruction button')
                .contains('Next')
                .should('be.visible')
                .click();

            cy.get('esm-instruction button')
                .contains('Okay')
                .should('be.visible')
                .click();
        });

        it('Runs the training', function() {
            // Should have a visible continue instruction
            cy.get('#training-instructions')
                .contains('Click or Touch')
                .should('be.visible');

            // Should be able to click the tooltip
            cy.get('.esm-help-show > esm-help')
                .should('be.visible')
                .click();

            // Should show a question
            cy.get('#stimulus p')
                .should('be.visible');

            // Should be able to click the tooltip
            cy.get('.esm-help-show > esm-help')
                .should('be.visible')
                .click();

            // Should show the response panel
            cy.get('esm-response-timeline')
                .should('be.visible');

            // Should be able to click the tooltip
            cy.get('.esm-help-show > esm-help')
                .should('be.visible')
                .click();

            // Should now be required to drag a response onto the timeline
            cy.get('#training-instructions')
                .contains('Enter a response')
                .should('be.visible');

            // Fill in a response
            cy.get('.response-marker-pool .response-marker.size0 .clickhandler')
                .trigger('mousedown', {force: true})
                .trigger('mousemove', { force: true, pageX: 600, pageY: 600 })
                .trigger('mouseup', {force: true});

            // Confirm response
            cy.get('button.confirm.enabled')
                .click();
        });

        it('Gives instructions before practice', function() {

            cy.get('#instructions h1')
                .should('have.text', 'Practice')
                .should('be.visible');

            // Click through instructions
            cy.get('esm-instruction button')
                .contains('Okay')
                .should('be.visible')
                .click();
        });

        let q = -1;

        // 10 practice questions
        for(let i = 0; i < 10; i++) {
            q++;
            it('Runs practice Q' + i + ' [Q' + q + ']', function() {

                // Should show a question
                cy.get('#stimulus p')
                    .should('be.visible');

                cy.get('.response-marker-pool')
                    .should('be.visible');

                cy.get('body')
                    .should('have.class', 'Trial-getResponse');

                cy.wait(120);

                // Fill in a response
                cy.get('.response-marker-pool .response-marker.size0 .clickhandler')
                    .trigger('mousedown', {force: true})
                    .trigger('mousemove', { force: true, pageX: 600, pageY: 600 })
                    .trigger('mouseup', {force: true});

                // Confirm response
                cy.get('button.confirm.enabled')
                    .click();
            });
        }

        it('Introduces advice', function() {

            cy.get('#instructions h1')
                .should('have.text', 'Practice with Advice')
                .should('be.visible');

            // Click through instructions
            cy.get('esm-instruction button')
                .contains('Next')
                .should('be.visible')
                .click();

            cy.get('esm-instruction button')
                .contains('Okay')
                .should('be.visible')
                .click();
        });

        for(let i = 0; i < 2; i++) {
            q++;

            it('Runs advisor practice q'+ i + ' [Q' + q + ']', function() {

                // Should show a question
                cy.get('#stimulus p')
                    .should('be.visible');

                cy.get('.response-marker-pool')
                    .should('be.visible');

                cy.get('body')
                    .should('have.class', 'Trial-getResponse');

                cy.wait(120);

                // Fill in a response
                cy.get('.response-marker-pool .response-marker.size0 .clickhandler')
                    .trigger('mousedown', {force: true})
                    .trigger('mousemove', { force: true, pageX: 600, pageY: 600 })
                    .trigger('mouseup', {force: true});

                // Confirm response
                cy.get('button.confirm.enabled')
                    .click();

                // Receive advice
                cy.get('esm-response-timeline .response-marker.advisor')
                    .should('be.visible');

                cy.get('body')
                    .should('have.class', 'Trial-getFinalResponse');

                cy.wait(120);

                // Tap marker
                cy.get('esm-response-timeline .response-marker.ghost.set .clickhandler')
                    .click({force: true});

                // Confirm response
                cy.get('button.confirm.enabled')
                    .click();
            });
        }

        it('Provides final instructions', function() {

            cy.get('#instructions')
                .should('be.visible');

            // Click through instructions
            cy.get('esm-instruction button')
                .contains('Next')
                .should('be.visible')
                .click();

            // Click through instructions
            cy.get('esm-instruction button')
                .contains('Next')
                .should('be.visible')
                .click();

            cy.get('esm-instruction button')
                .contains('Okay')
                .should('be.visible')
                .click();
        });

        for(let i = 0; i < 15; i++) {
            q++;

            it('Runs block 1 Q' + i + ' [Q' + q + ']', function () {

                // Should show a question
                cy.get('#stimulus p')
                    .should('be.visible');

                cy.get('.response-marker-pool')
                    .should('be.visible');

                cy.get('body')
                    .should('have.class', 'Trial-getResponse');

                cy.wait(120);

                // Fill in a response
                cy.get('.response-marker-pool .response-marker.size0 .clickhandler')
                    .trigger('mousedown', {force: true})
                    .trigger('mousemove', {
                        force: true,
                        pageX: 600,
                        pageY: 600
                    })
                    .trigger('mouseup', {force: true});

                // Branch based on whether Q is attention check
                cy.get('body').then(($body) => {
                    if ($body.find('#stimulus p').text().includes('marker to cover')) {
                        // Cheat attention checks
                        const TL = $body.find('esm-response-timeline')[0];

                        const marker = $body.find('esm-response-timeline .response-marker.ghost.set')[0];

                        let study = cy.state('window').study;
                        console.log({
                            study,
                            TL,
                            marker
                        })

                        const ans = study.trials[study.currentTrial].correctAnswer;
                        console.log(ans)

                        marker.style.left = TL.valueToPixels(ans) + "px";
                        marker.style.width = TL.valueToPixels(TL.markerWidths[0], true) + "px";
                    } else {
                        // Continue as normal with normal responses
                        cy.get('button.confirm.enabled')
                            .click();

                        // Receive advice
                        cy.get('esm-response-timeline .response-marker.advisor')
                            .should('be.visible');

                        cy.get('body')
                            .should('have.class', 'Trial-getFinalResponse');

                        cy.wait(120);

                        // Tap marker
                        cy.get('esm-response-timeline .response-marker.ghost.set .clickhandler')
                            .click({force: true});
                    }
                });

                // Confirm response
                cy.get('button.confirm.enabled')
                    .click();
            });
        }

        it('Pauses between blocks', function() {

            cy.get('#instructions h1')
                .should('have.text', 'Break')
                .should('be.visible');

            // Click through instructions
            cy.get('esm-instruction button')
                .contains('Okay')
                .should('be.visible')
                .click();
        });

        for(let i = 0; i < 15; i++) {
            q++;

            it('Runs block 2 Q' + i + ' [Q' + q + ']', function() {

                // Should show a question
                cy.get('#stimulus p')
                    .should('be.visible');

                cy.get('.response-marker-pool')
                    .should('be.visible');

                cy.get('body')
                    .should('have.class', 'Trial-getResponse');

                cy.wait(120);

                // Fill in a response
                cy.get('.response-marker-pool .response-marker.size0 .clickhandler')
                    .trigger('mousedown', {force: true})
                    .trigger('mousemove', { force: true, pageX: 600, pageY: 600 })
                    .trigger('mouseup', {force: true});

                // Branch based on whether Q is attention check
                cy.get('body').then(($body) => {
                    if ($body.find('#stimulus p').text().includes('marker to cover')) {
                        // Cheat attention checks
                        const TL = $body.find('esm-response-timeline')[0];

                        const marker = $body.find('esm-response-timeline .response-marker.ghost.set')[0];

                        let study = cy.state('window').study;

                        const ans = study.trials[study.currentTrial].correctAnswer;

                        marker.style.left =
                            TL.valueToPixels(ans) +
                            "px";
                        marker.style.width = TL.valueToPixels(TL.markerWidths[0], true) + "px";
                    } else {
                        // Continue as normal with normal responses
                        cy.get('button.confirm.enabled')
                            .click();

                        // Receive advice
                        cy.get('esm-response-timeline .response-marker.advisor')
                            .should('be.visible');

                        cy.get('body')
                            .should('have.class', 'Trial-getFinalResponse');

                        cy.wait(120);

                        // Tap marker
                        cy.get('esm-response-timeline .response-marker.ghost.set .clickhandler')
                            .click({force: true});
                    }
                });

                // Confirm response
                cy.get('button.confirm.enabled')
                    .click();
            });
        }

        it('Provides advisor questionnaires', function() {
            // Questionnaires for both advisors
            for(let i = 0; i < 2; i++) {
                cy.get('input[type="range"]').as('range')
                    .invoke('val', ()=> Math.floor(Math.random() * 100))
                    .each(e => e.trigger('change'))
                    .click({multiple: true});

                cy.get('textarea')
                    .focus()
                    .type("no comment");

                cy.get('button[name="submit"]')
                    .should('be.visible')
                    .click()
            }
        });

        it('Provides a debrief screen', function() {
            cy.get('textarea.mandatory')
                .focus()
                .type('You might very well think that; I couldn\'t possibly comment.');

            cy.get('button[name="submit"]')
                .should('be.visible')
                .click()
        });

        it('Shows feedback', function() {
            cy.get('body')
                .contains('Payment code')
        });

        it('Provides a functional permalink', function() {
            cy.get('.legend.permalink .permalink')
                .invoke('text').then((txt) => {
                cy.visit(txt);

                cy.get('.timeline')
                    .should('be.visible');
            });
        });

    });
}