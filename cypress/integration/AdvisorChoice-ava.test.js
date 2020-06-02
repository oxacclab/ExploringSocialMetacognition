const runs = 1;

const qCount = {practice: [60, 60], advisorPractice: 4, learning: 60, test: 30};

function doTrial(pCorrect = .71) {
    cy.wait(600);
    const gov = cy.state('window').gov;
    let ans = gov.currentTrial.whichSide;
    ans = Math.random() < pCorrect? ans : !ans;
    const pos = 5 + Math.random() * 40 + (ans? 50 : 0);
    cy.wait(600);
    cy.get('.jspsych-sliders-slider input')
        .click()
        .invoke('attr', 'value', pos);
    cy.get('.jspsych-btn')
        .should('contain', 'Continue')
        .click();
};

function doAdvisedTrial(pCorrect = .71, doInitial = true) {
    if(doInitial)
        doTrial(pCorrect);
    cy.get('.jspsych-jas-present-advice-wrapper')
        .should('be.visible');
    cy.get('.jspsych-sliders-slider input');
    cy.wait(600);
    doTrial(pCorrect);
};

function doAdvisorChoice(pCorrect = .71) {
    doTrial(pCorrect);
    const img = Math.random() < .5? 0 : 1;
    cy.get('img#advisorChoice-choice-' + img)
        .should('be.visible')
        .click();
    doAdvisedTrial(pCorrect, false);
};

for(let run = 0; run < runs; run++) {

    describe('AdvisorChoice/ava (run=' + run + ')', function() {

        it('Collects consent', function() {
            cy.visit('localhost/ExploringSocialMetacognition/AdvisorChoice/ava.html?PROLIFIC_PID=CypressTest');

            cy.url()
                .should('include', '/consent.html')
                .should('include', 'PROLIFIC_PID=CypressTest');

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
            cy.get('.jspsych-btn')
                .contains('Next')
                .should('be.visible')
                .click();
        });

        it('Creates an AdvisorChoice object', function() {
            cy.window()
                .its('gov')
                .its('constructor')
                .its('name')
                .should('eq', 'AdvisorChoice');
        });

        it('Describes the study', function() {
            // Should connect
            cy.get('#jspsych-content')
                .contains('You will see two boxes containing dots')
                .should('be.visible');

            // Click through instructions
            cy.get('.jspsych-btn')
                .contains('Next')
                .should('be.visible')
                .click();
        });

        it('Runs the training', function() {
            // Pick the correct answer for the first time
            doTrial(1);

            // Confidence training
            cy.get('#jspsych-content')
                .contains('indicate your confidence')
                .should('be.visible');
            cy.get('.jspsych-btn')
                .contains('Next')
                .should('be.visible')
                .click();

            doTrial(1);

            // Brief exposure training
            cy.get('#jspsych-content')
                .contains('brief')
                .should('be.visible');
            cy.get('.jspsych-btn')
                .contains('Next')
                .should('be.visible')
                .click();

            doTrial(1);

            // Practice block
            cy.get('#jspsych-content')
                .contains('main experiment will start after')
                .should('be.visible');
            cy.get('.jspsych-btn')
                .contains('Next')
                .should('be.visible')
                .click();
        });

        let q = -1;

        // 10 practice questions
        for(let b = 0; b < qCount.practice.length; b++) {
            for(let i = 0; i < qCount.practice[b]; i++) {
                q++;
                it('Runs practice Q' + i + ' [Q' + q + ']', function() {
                    doTrial();
                });
            }
            // block break
            if(b < qCount.practice.length - 1) {
                it('Pauses between blocks', function() {
                    cy.get('#jspsych-content')
                        .contains('score on the last block')
                        .should('be.visible');
                    cy.get('.jspsych-btn')
                        .contains('Next')
                        .should('be.visible')
                        .click();
                });
            }
        }

        it('Introduces advice', function() {
            cy.get('#jspsych-content')
                .contains('you will get advice from advisors')
                .should('be.visible');
            cy.get('.jspsych-btn')
                .contains('Next')
                .should('be.visible')
                .click();
        });

        for(let i = 0; i < qCount.advisorPractice; i++) {
            q++;

            it('Runs advisor practice q'+ i + ' [Q' + q + ']', function() {
                doAdvisedTrial();
            });
        }

        it('Provides final instructions', function() {
            cy.get('#jspsych-content')
                .contains('ready to do the experiment')
                .should('be.visible');
            cy.get('.jspsych-btn')
                .contains('Next')
                .should('be.visible')
                .click();
            cy.get('#jspsych-content')
                .contains('assign you two advisors')
                .should('be.visible');
            cy.get('.jspsych-btn')
                .contains('Next')
                .should('be.visible')
                .click();
        });

        for(let i = 0; i < qCount.learning; i++) {
            q++;

            it('Runs block 1 Q' + i + ' [Q' + q + ']', function () {
                doAdvisedTrial();
            });
        }

        it('Pauses between blocks', function() {
            cy.get('#jspsych-content')
                .contains('choose which advisor')
                .should('be.visible');
            cy.get('.jspsych-btn')
                .contains('Next')
                .should('be.visible')
                .click();
        });

        for(let i = 0; i < qCount.test; i++) {
            q++;

            it('Runs block 2 Q' + i + ' [Q' + q + ']', function() {
                doAdvisorChoice();
            });
        }

        it('Provides advisor questionnaires', function() {
            cy.get('#jspsych-content')
                .contains('some brief questionnaires')
                .should('be.visible');
            cy.get('.jspsych-btn')
                .contains('Next')
                .should('be.visible')
                .click();

            // Questionnaires for both advisors and the general trust questionnaire
            for(let i = 0; i < 3; i++) {
                cy.get('input[type="range"]').as('range')
                    .invoke('val', ()=> Math.floor(Math.random() * 100))
                    .each(e => e.trigger('change'))
                    .click({multiple: true});

                cy.get('button.jspsych-btn')
                    .should('be.visible')
                    .click()
            }
        });

        it('Provides a debrief screen', function() {
            cy.get('textarea#debriefManipulationAnswer')
                .type('You might very well think that; I couldn\'t possibly comment.');
            cy.get('textarea#debriefCommentAnswer')
                .type('You might very well think that; I couldn\'t possibly comment.');
            cy.get('button.jspsych-btn')
                .should('be.visible')
                .click()
        });

        it('Shows feedback', function() {
            cy.get('body')
                .contains('Completion URL')
        });
    });
}