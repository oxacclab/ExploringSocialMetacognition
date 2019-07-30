# Analysis of overall accuracy for participants in date estimation
# Matt Jaquiery
# July 2019

library(ggplot2)
library(beepr)

theme_set(theme_light())

old <- setwd("./ACv2")

# minGroups ---------------------------------------------------------------

studyName <- "minGroups"
studyVersion <- "all"

exclude <- list(maxAttnCheckFails = 0, # pass all attn checks
                # requireGroupAttnCheck = T, # get the which group Q right
                requireComplete = T,   # complete experiment
                maxTrialRT = 60000,    # trials take < 1 minute
                minTrials = 11,        # at least 11 trials completed
                minChangeRate = .1,    # some advice taken on 10%+ of trials
                multipleAttempts = T)  # exclude multiple attempts

source("./src/02 Exclusions.R")

re <- AdvisedTrial[, c("responseError", "pid", "studyVersion")]
re$studyName <- studyName

advice <- AdvisedTrial[, c("pid", "studyVersion", "advisor0idDescription")]
advice$adviceError <- abs(AdvisedTrial$advisor0adviceCentre - AdvisedTrial$correctAnswer)
advice$studyName <- studyName

rm(list = ls()[!(ls() %in% c("re", "advice", "out"))])

# datesStudy --------------------------------------------------------------

studyName <- "datesStudy"
studyVersion <- "1-0-1"

exclude <- list(maxAttnCheckFails = 0, # pass all attn checks
                requireComplete = T,   # complete experiment
                maxTrialRT = 60000,    # trials take < 1 minute
                minTrials = 25,        # at least 25 trials completed
                minChangeRate = .1,    # some advice taken on 10%+ of trials
                multipleAttempts = T)  # exclude multiple attempts

source("./src/02 Exclusions.R")

# Also include v1.1.0
studyVersion <- "1-1-0"
source("./src/02 Exclusions.R")

tmp <- AdvisedTrial[, c("responseError", "pid", "studyVersion")]
tmp$studyName <- studyName

re <- rbind(re, tmp)

tmp <- AdvisedTrial[, c("pid", "studyVersion", "advisor0idDescription")]
tmp$adviceError <- abs(AdvisedTrial$advisor0adviceCentre - AdvisedTrial$correctAnswer)
tmp$studyName <- studyName

advice <- rbind(advice, tmp)

setwd(old)

# Participants' initial responses -----------------------------------------

ggplot(re, aes(x = responseError)) +
  geom_histogram(bins = 50, fill = "white", colour = "black") +
  geom_freqpoly(bins = 50, aes(colour = studyName))

ggplot(re, aes(x = "", y = responseError)) +
  geom_hline(aes(group = 1, yintercept = mean(responseError)),
             size = 2, colour = "grey90") +
  stat_summary(geom = "point", aes(colour = studyName, group = pid), 
               fun.y = mean, position = position_dodge(0.75)) + 
  stat_summary(geom = "errorbar", aes(colour = studyName, group = pid), 
               fun.data = mean_cl_normal, position = position_dodge(0.75),
               width = 0) +
  stat_summary(geom = "point", aes(group = studyName), 
               fun.y = mean, position = position_dodge(0.75)) +
  stat_summary(geom = "errorbar", aes(group = studyName), 
               fun.data = mean_cl_normal, position = position_dodge(0.75),
               width = .2)


# Advice ------------------------------------------------------------------

ggplot(advice, aes(x = adviceError)) +
  geom_histogram(bins = 50, fill = "white", colour = "black") +
  geom_freqpoly(bins = 50, aes(colour = studyName))

ggplot(advice, aes(x = advisor0idDescription, y = adviceError)) +
  geom_hline(aes(group = 1, yintercept = mean(adviceError)),
             size = 2, colour = "grey90") +
  stat_summary(geom = "point", aes(colour = studyName, group = pid), 
               fun.y = mean, position = position_dodge(0.75)) + 
  stat_summary(geom = "errorbar", aes(colour = studyName, group = pid), 
               fun.data = mean_cl_normal, position = position_dodge(0.75),
               width = 0) +
  stat_summary(geom = "point", aes(group = studyName), 
               fun.y = mean, position = position_dodge(0.75)) +
  stat_summary(geom = "errorbar", aes(group = studyName), 
               fun.data = mean_cl_normal, position = position_dodge(0.75),
               width = .2)

beep("coin")
