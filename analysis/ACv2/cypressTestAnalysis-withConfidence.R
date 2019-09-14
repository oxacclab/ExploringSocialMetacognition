# Analysis of overall accuracy for participants in date estimation
# Matt Jaquiery
# July 2019

library(ggplot2)

theme_set(theme_light())

old <- setwd("./ACv2")

# withConf ---------------------------------------------------------------

studyName <- "withConf"
studyVersion <- "0-0-1"
rDir <- "http://localhost/ExploringSocialMetacognition/data/public/"
testData <- T

exclude <- list()  # exclude multiple attempts

source("./src/02 Exclusions.R")

AdvisedTrialWithConf <- AdvisedTrialWithConf[-1, ]

advice <- AdvisedTrialWithConf[c("pid", 
                                 "studyId", 
                                 "studyVersion", 
                                 "advisor0idDescription",
                                 "advisor0actualType",
                                 "confidenceConfidence")]

advice$adviceDistance <- abs(AdvisedTrialWithConf$advisor0adviceCentre 
                             - AdvisedTrialWithConf$responseEstimateLeft + 
                               (AdvisedTrialWithConf$responseMarkerWidth / 2))

# Advice ------------------------------------------------------------------

ggplot(advice, aes(x = advisor0idDescription, 
                   y = adviceDistance, 
                   colour = advisor0actualType,
                   shape = confidenceConfidence)) +
  geom_point(position = position_jitterdodge(jitter.width = .4))


tmp <- aggregate(studyId ~ pid + advisor0actualType + advisor0idDescription, 
                 advice, length)

ggplot(tmp, aes(x = advisor0actualType,
                y = studyId)) +
  stat_summary(geom = "point", aes(group = pid), fun.y = mean,
               position = position_jitter()) +
  labs(y = "Trial count") +
  facet_wrap(~advisor0idDescription)

beep("coin")


# Simulation --------------------------------------------------------------

# We can now extend the analysis by filling in the Cypress responses with some
# simulated data to see if we can recover the patterns

# The level of advice taking is modelled as an effect of subject, question,
# advisor, and confidence. Each component is expressed as weight-on-advice.

# We do not include correlations between e.g. those who take less advice overall
# (subject) showing less of a confidence-based advice effect (subjectConf).
fixed <- list(
  mean = .33,
  advisor = .1,
  confidence = .2,
  interaction = .2
)
random <- list(
  subject = .25,
  subjectAdvisor = .1, # subjects vary on advisor effect size
  subjectConf = .2, # subjects vary on confidence effect size
  subjectInter = .1, # subjects vary in interaction strength
  item = .15,
  itemAdvisor = .1,
  itemConf = .1,
  itemInter = .1,
  noise = .2
)

# Get values for random factors from identifier
rFact <- function(x, sd) {
  if (length(x) > 1) {
    return(sapply(x, rFact, sd))
  }
  set.seed(as.numeric(x))
  rnorm(1, sd = sd)
}

# Assign weights of -.5 and .5 to two-level factors
fFact <- function(x) {
  if (length(levels(x)) != 2)
    stop('factoring for fixed effect expects two-level factor')
  as.numeric(x) - 1.5
}

# question ids
advice$qid <- factor(AdvisedTrialWithConf$stimHTML)
advice$advisor0idDescription <- factor(advice$advisor0idDescription)

# simulate advice taking
advice$woaSim <- 
  # mean
  fixed$mean + 
  # random intercepts
  rFact(advice$pid, random$subject) +
  rFact(advice$qid, random$item) + 
  # fixed factors
  ((fixed$advisor + 
      rFact(advice$pid, random$subjectAdvisor) + 
      rFact(advice$qid, random$itemAdvisor)) * 
     fFact(advice$advisor0idDescription)) +
  ((fixed$confidence + 
      rFact(advice$pid, random$subjectConf) +
      rFact(advice$qid, random$itemConf)) * 
     fFact(advice$confidenceConfidence)) +
  # (interaction)
  ((fixed$interaction + 
      rFact(advice$pid, random$subjectInter) +
      rFact(advice$qid, random$itemInter)) *
     fFact(advice$advisor0idDescription) * 
     fFact(advice$confidenceConfidence)) +
  # noise
  rnorm(nrow(advice), sd = random$noise)

advice$woa <- pmax(0, pmin(1, advice$woaSim))

hist(advice$woa)


# Parameter recovery ------------------------------------------------------

library(lmerTest)

nicelmer <- function(...) {
  res <- summary(lmer(...))
  rx <- res$varcor
  fx <- res$coefficients
  
  # Nice summary dataframe of the input effect vs the recovered effect
  fxt <- cbind(fx, data.frame(input = 
                                c(fixed$mean, fixed$advisor, fixed$confidence)))
  rxt <- cbind(as.data.frame(rx)[c(1:5, 9), ], 
               data.frame(input = c(
                 random$item, random$itemAdvisor, random$itemConf, NA,
                 random$subject, random$subjectAdvisor, random$subjectConf, NA,
                 random$noise)))
  rxt <- rxt[, c(1:2, 5:6)]
 
  list(model = res, output = list(random = rxt, fixed = fxt))
}

f <- woa ~ 
  # mean
  1 +
  # fixed effects
  advisor0idDescription *
  confidenceConfidence +
  # random effects
  # All fixed effects and interaction can vary by subject and item
  (1 + (advisor0idDescription * confidenceConfidence) | pid) + 
  (1 + (advisor0idDescription * confidenceConfidence) | qid)

res <- nicelmer(f, advice, REML = F)

res$output$random
res$output$fixed
