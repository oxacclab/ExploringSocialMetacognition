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

