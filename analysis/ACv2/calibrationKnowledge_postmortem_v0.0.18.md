# Calibration knowledge study postmortem

   | 
---|---:
Matt Jaquiery  | 
Study version: | 0.0.18
Analysis file: | calibrationKnowledge_v0.0.2.Rmd

## Main conclusions

Participants were not influenced differently depending on the presentations of the advisor (hybrid or labelled). In the region of equivalent advice confidence, there were no differences in influence between labelled and hybrid presentations of either their favourite (most influential) or least favourite advisor, or even between the least and most favourite advisor (despite this being determined by influence itself). 

Overall, these results suggest that participants were influenced by the confidence of advice (and hence influence is generally higher for more versus less confident advisors) but were not able to adjust appropriately for the difference in advisors. 

## Suggestions for improvement

In order to test whether advice from an unknown source is treated hyperconservatively (i.e. discounted over and above how much it would be discounted if it came from the most overconfident advisor), it is important to have participants establish equivalence (or close to it) between the advisors so that differences emerge in the shared part of the confidence bar (where moderately-confident advice from a low-confidence advisor is recognised as high-confidence, while the same advice from the high-confidence advisor is recognised as low-confidence).

We may be able to establish this equivalence more precisely by increasing the relevant experience participants have of the advisors. There are two main approaches we could take to this (which are not mutually exclusive): increasing the number of trials and decreasing the variation in experience of advice. A secondary approach, perhaps deployed in conjunction with the main approaches, is to provide information about advisor confidence mappings to participants directly.

### Increasing number of trials

Increasing the number of trials for which feedback is provided would allow participants to have greater exposure to examples of advice, from which they could derive an increasingly robust estimate of how the probability of an advisor being correct scaled with the advisor's expressed confidence.

The disadvantages to this approach are twofold: increased experiment time and requiring a larger question pool. Increased experiment time is disadvantageous because it increases the expense of data collection and decreases participant enjoyment of the task. Requiring a larger question pool is disadvantageous because producing, checking, and validating new questions takes a substantial amount of time and incurs a cost to pay participants during validation. Currently each participant sees 49 question from a pool of 74, meaning that scope for increasing the number of training trials per advisor exists, but is constrained.

#### Alternative task

The time and question pool issues could be mitigated by switching to a task which allows for a shorter trial duration, such as the dots task. There is a considerable overhead in the time it would take to implement this (perhaps a week or two), and it would remove some of the advantages of the dates task such as its more natural feel, its ability to extract information from relatively few key trials, and its increased interest for participants.

### Decreasing variation in advice experience

Decreasing variation in advice experience by tailoring the exposure participants have to advice may allow participants to more quickly and accurately learn the contingencies between confidence and accuracy for the advisors. 

This tailoring would expose each participant to a set schedule of advice. That schedule may look something like:

Confidence | Accuracy (%)
-----------|:-----------:
Low        | 33
Medium     | 66
High       | 100

With the confidence being scaled by the advisor's confidence mapping.

The disadvantages to decreasing variation in advice experience are that it reduces the external validity of the task and reduces the protential robustness of the results to variations in sampling. 

### Telling participants about confidence mappings

The first two suggestions focus on better enabling participants' endogenous learning capabilities to form assessments of the advisors. An alternative approach (which could be used in conjunction with the first two) is to provide the information about the advisors exogenously. In effect, we can simply tell participants how the advisors differ. There are a range of levels of subtelty we can use, ranging from cueing participants to attend to confidence-accuracy contingencies, through providing participants with examples of the advisors' contingencies, to simply instructing participants how to respond. 

#### Cueing participant attention

Participants could be instructed that the different advisors are equally accurate but use the confidence scale differently. They may even be told that one advisor is more confident than another. Cueing participants to attend to how the advisors use the scale detracts from the external valiadity of the task, and means that we cannot argue that people naturally perform these kinds of assessments (only that if they do, we can say something about how advice of ambiguous provenence is treated), so we would need to rely on other evidence from the literature to establish this claim.

#### Telling rather than showing advisor properties

Participants could be shown an advisor's scorecard or similar from a previous experiment, where their over or underconfidence was clearly visible. We could even show the participant their own performance over the training trials, along with confidence-accuracy contingency, explain this to the participant in detail, and then provide the advisor's version. The disadvantage to this approach, as before, is in removing our ability to demonstrate that people produce internal estimates of advisors' properties in this task (although that behaviour is well evidenced for similar tasks). 

#### Instructing participants

Finally, participants could be told how the advisors differ, and how to use the advice most effectively (reducing the weight on the high confidence advisor, increasing weight on the low confidence advisor). This removes a great deal of external validity, but would at least allow a test of whether participants can overcome a confidence=p(correct) heuristic even when explicitly instructed. It would also allow a test of how participants respond to advice of ambiguous origin, although this latter (crucial) test would be marred by a question of whether effects were driven by ambiguity in advice profile information or simply a lack of coaching on how to respond.

## Recommendations

Overall, balancing probability of efficacy against time invested, the following alterations are recommended:

* Provide participants with a 'scorecard' for their own performance over training trials

* Tell participants that advisors can differ in how they use the confidence scale

* Provide participants with a scorecard for their advisor during the introduction

* Tailor the advisor experience to closely match the scorecard

* Provide participants with a recap scorecard containing the original plus their own experience of that advisor before the test phase
