# Analysis of overall accuracy for participants in date estimation
# Matt Jaquiery
# July 2019

library(ggplot2)

theme_set(theme_light())

old <- setwd("./ACv2")

# minGroups ---------------------------------------------------------------

studyName <- "minGroups"
studyVersion <- "1-1-3"
rDir <- "http://localhost/ExploringSocialMetacognition/data/public/"
testData <- T

exclude <- list()  # exclude multiple attempts

source("./src/02_Exclusions.R")

advice <- AdvisedTrial[, c("pid", "studyVersion", "advisor0idDescription")]
advice$adviceError <- abs(AdvisedTrial$advisor0adviceCentre - AdvisedTrial$correctAnswer)
advice$studyName <- studyName

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

