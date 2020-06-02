const runs = 1;

function respond(position = null, force = false) {
    position = position || {x: 0, y: Math.random() * 100};

    cy.get('esm-response-binary-conf .response-panel.response-' + (Math.random() > .5 ? 'left' : 'right') + ' .response-column')
        .trigger('mousemove', {
            position: "top",
            force: true,
            ...position
        })
        .click(position.x, position.y, {force: force});
}

function doTrial(hasChoice = false) {

    // Should show a question
    cy.get('#stimulus p')
        .should('be.visible');

    cy.get('esm-response-binary-conf')
        .should('be.visible');

    cy.get('body')
        .should('have.class', 'Trial-getResponse');

    cy.wait(120);

    // Branch based on whether Q is attention check
    cy.get('body').then(($body) => {
        if ($body.find('#stimulus p').text().includes('for this question')) {
            // Cheat attention checks
            let study = cy.state('window').study;
            const ans = study.trials[study.currentTrial].correctAnswer;
            const conf = study.trials[study.currentTrial].attentionCheckHighConf;
            const bar = 'esm-response-binary-conf .response-panel.response-' + (ans === 0 ? 'left' : 'right') + ' .response-column';
            const offset = conf ? "top" : "bottom";

            cy.get(bar)
                .trigger('mousemove', {position: offset})
                .click(offset);
        } else {
            // Fill in a response
            respond();

            if(hasChoice) {
                const img = Math.random() < .5? 'first-of-type' : 'last-of-type';
                cy.get(`.advisor-key-row:${img} img.identicon`)
                    .should('be.visible')
                    .click();
            }

            // Receive advice
            cy.get('esm-response-binary-conf .response-marker.advisor')
                .should('be.visible');

            cy.get('body')
                .should('have.class', 'Trial-getFinalResponse');

            cy.wait(120);

            // Fill in a final response
            respond();
        }
    });
}

for(let run = 0; run < runs; run++) {

    describe('ACBin/ACC (run=' + run + ')', function () {

        it('Checks browser compatibility', function () {
            cy.visit('localhost/ExploringSocialMetacognition/ACBin/agr.html?PROLIFIC_PID=CypressTest');

            cy.get('h1')
                .should('be.visible')
                .contains('Checking browser compatibility');
        });

        it('Redirects to collect confidence', function () {
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

        it('Welcomes the user', function () {

            // Should connect
            cy.contains('Welcome')
                .should('be.visible');

            // First welcome screen
            cy.get('esm-instruction button:last-of-type')
                .contains('Okay!')
                .should('be.visible')
                .click();
        });

        it('Creates a DatesStudyBinary object', function () {
            cy.window()
                .its('study')
                .its('constructor')
                .its('name')
                .should('eq', 'DatesStudyBinary');
        });

        it('Gets study variables from server', function () {
            cy.window()
                .its('study')
                .its('id')
                .should('have.length', 8);

            cy.window()
                .its('study')
                .its('condition')
                .should('gt', 0);
        });

        it('Describes the study', function () {
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
                .contains('Okay')
                .should('be.visible')
                .click();
        });

        it('Runs the training', function () {
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
            cy.get('esm-response-binary-conf')
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
            respond({x: 50, y: 15});

            // Now we get told what feedback means
            cy.get('.esm-help-show > esm-help')
                .should('be.visible')
                .click();
        });

        it('Gives instructions before practice', function () {

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
        for (let i = 0; i < 10; i++) {
            q++;
            it('Runs practice Q' + i + ' [Q' + q + ']', function () {

                // Should show a question
                cy.get('#stimulus p')
                    .should('be.visible');

                cy.get('body')
                    .should('have.class', 'Trial-getResponse');

                cy.wait(120);

                // Fill in a response
                respond();
            });
        }

        it('Introduces advice', function () {

            cy.get('#instructions h1')
                .should('be.visible');

            // Click through instructions
            cy.get('esm-instruction button')
                .contains('Okay')
                .should('be.visible')
                .click();
        });

        for (let i = 0; i < 2; i++) {
            q++;

            it('Runs advisor practice q' + i + ' [Q' + q + ']',
                function () {
                    doTrial();
                });
        }

        it('Provides final instructions', function () {

            cy.get('#instructions')
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

        for (let i = 0; i < 15; i++) {
            q++;

            it('Runs block 1 Q' + i + ' [Q' + q + ']', function () {
                doTrial();
            });
        }

        it('Pauses between blocks', function () {

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

            it('Runs block 2 Q' + i + ' [Q' + q + ']',
                function() {doTrial();});
        }

        it('Pauses between blocks', function () {

            cy.get('#instructions h1')
                .should('have.text', 'Break')
                .should('be.visible');

            // Click through instructions
            cy.get('esm-instruction button')
                .contains('Okay')
                .should('be.visible')
                .click();

            cy.wait(250);

            // Acknowledge advisor choice
            cy.get('esm-instruction button')
                .contains('Okay')
                .should('be.visible')
                .click();
        });

        for (let i = 0; i < 10; i++) {
            q++;

            it('Runs block 3 Q' + i + ' [Q' + q + ']', function () {
                doTrial(true);
            });
        }

        it('Provides a debrief screen', function () {
            cy.get('textarea.mandatory')
                .focus()
                .type('You might very well think that; I couldn\'t possibly comment.');

            cy.get('button[name="submit"]')
                .should('be.visible')
                .click()
        });

        it('Shows feedback', function () {
            cy.get('body')
                .contains('Payment code')
        });

        it('Provides a functional permalink', function () {
            cy.get('.legend.permalink .permalink')
                .invoke('text').then((txt) => {
                cy.visit(txt);

                cy.get('.results .result .overall')
                    .should('be.visible');
            });
        });
    });
}