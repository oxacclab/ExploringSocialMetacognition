# Exploring Social Metacognition support functions and variables ----------


# Libraries ---------------------------------------------------------------
# Load the dependencies for the main scripts

# Parsing JSON files
if(!require(jsonlite)) {
  install.packages("jsonlite")
  library(jsonlite)
}
# Calculating Bayes factors
if(!require(BayesFactor)) {
  install.packages('BayesFactor')
  library(BayesFactor)
}
# Plots
if(!require(tidyverse)) {
  install.packages('tidyverse')
  library(tidyverse)
}
# Long-to-wide conversions
if(!require(reshape2)) {
  install.packages('reshape2')
  library(reshape2)
}
# Linear modelling
if(!require(lme4)) {
  install.packages('lme4')
  library(lme4)
}
# CohensD calculations
if(!require(lsr)) {
  install.packages('lsr')
  library(lsr)
}
# repeated measures ANOVA
if(!require(ez)) {
  install.packages('ez')
  library(ez)
}
# RMarkdown to HTML conversion
if(!require(knitr)) {
  install.packages('knitr')
  library(knitr)
}
# Confidence intervals?
if(!require(Hmisc)) {
  install.packages('Hmisc')
  library(Hmisc)
}
# Brier scores
if(!require(scoring)) {
  install.packages('scoring')
  library(scoring)
}

# Reference and mapping functions -----------------------------------------

# Return the advice type of an advisor for participant with row number=pid
getAdviceTypeById <- function(aid, pid, advisor.data.frame) {
  type <- advisor.data.frame[which(advisor.data.frame$participantId==pid),]
  type <- type[which(type$id==aid),]
  if (length(type) > 0)
    return(type$adviceType)
  return(NA)
}
# Return a vector of advice types for trial list t
getAdviceType <- function (t, participant.data.frame, advisor.data.frame, forceRecalculate = FALSE) {
  # shortcut if we already calculated this
  if('adviceType' %in% colnames(t) && !forceRecalculate)
    return(t$adviceType)
  out <- vector(length=dim(t)[1])
  for (i in seq(length(out))) {
    if (t$advisorId[i]==0) {
      # no advisor
      out[i] <- NA;
    } else {
      pid <- t$participantId[i]
      out[i] <- getAdviceTypeById(t$advisorId[i], pid, advisor.data.frame)
    }
  }
  return(out)
}

#' Find the confidence shift in a given trial
#' @param t trial list
#' @param rawShift whether to report the confidence shift without adjusting for the assymetric scale
#' @param forceRecalulate if true, simply return the appropriate column from t if it exists already
#' @return a vector of confidence shifts for trial list t
getConfidenceShift <- function (t, rawShift = FALSE, forceRecalculate = FALSE) {
  scaleMaximum <- 50
  # shortcut if we already calculated this
  if('confidenceShift' %in% colnames(t) && !forceRecalculate)
    return(t$confidenceShift)
  out <- vector(length=dim(t)[1])
  for (i in seq(length(out))) {
    if (is.na(t$finalConfidence[i])) { # no advisor
      out[i] <- NA
    } else {
      max.shift <- scaleMaximum - t$initialConfidence[i]
      if(t$initialAnswer[i]==t$finalAnswer[i])
        out[i] <- t$finalConfidence[i]-t$initialConfidence[i] # same side
      else
        out[i] <- -1 * (t$finalConfidence[i]+t$initialConfidence[i]) # switched sliders, so went to 0 on the first one
      out[i] <- ifelse((abs(out[i]) > max.shift) & rawShift == F, max.shift*sign(out[i]), out[i])
    }
  }
  return(out)
}

# Return a vector of influence for trial list t
#' @param t trial list
#' @param rawShift whether to report the influence without adjusting for the assymetric scale
#' @param forceRecalulate if true, simply return the appropriate column from t if it exists already
#' @return a vector of influence for trial list t
getInfluence <- function (t, rawShift = FALSE, forceRecalculate = FALSE) {
  # shortcut if we already calculated this
  if('influence' %in% colnames(t) && !forceRecalculate)
    return(t$influence)
  out <- vector(length=dim(t)[1])
  for (i in seq(length(out))) {
    if (t$advisorId[i] == 0) { # no advisor
      out[i] <- NA
    } else {
      if (t$advisorAgrees[i])
        out[i] <- getConfidenceShift(t[i,], rawShift, forceRecalculate) # amount confidence increased
      else
        out[i] <- -1 * getConfidenceShift(t[i,], rawShift, forceRecalculate) # -1 * amount confidence increased
    }
  }
  return(out)
}

#' Get the name of the advice type
#' @param adviceType the advice type to fetch the name for
#' @param long whether to return the long name
#' @return string of the advice type, or NA by default
getAdviceTypeName <- function(adviceType, long = FALSE) {
  if(length(adviceType)>1) {
    out <- NULL
    for(aT in adviceType)
      out <- c(out, getAdviceTypeName(aT))
    return(out)
  }
  if(adviceType==adviceTypes$neutral)
    return(ifelse(long, 'neutral', 'Ntl'))
  if(adviceType==adviceTypes$AiC)
    return(ifelse(long,'Agree-in-confidence', 'AiC'))
  if(adviceType==adviceTypes$AiU)
    return(ifelse(long,'Agree-in-uncertainty', 'AiU'))
  if(adviceType==adviceTypes$HighAcc)
    return(ifelse(long,'High accuracy', 'HighAcc'))
  if(adviceType==adviceTypes$LowAcc)
    return(ifelse(long,'Low accuracy', 'LowAcc'))
  if(adviceType==adviceTypes$HighAgr)
    return(ifelse(long, 'High agreement', 'HighAgr'))
  if(adviceType==adviceTypes$LowAgr)
    return(ifelse(long, 'Low agreement', 'LowAgr'))
  return(ifelse(long, 'None', NA))
}


# Global variables --------------------------------------------------------

# advice types: neutral, agree-in-confidence, and agree-in-uncertainty
adviceTypes <- list(neutral=0, 
                    AiC=3, AiU=4, 
                    HighAcc=5, LowAcc=6,
                    HighAgr=7, LowAgr=8)

trialTypes <- list(catch=0, force=1, choice=2)
confidenceCategories <- list(low=0, medium=1, high=2)

# Advisor questionnaire dimensions
questionnaireDimensions <- list(accurate=1,
                                like=2,
                                trust=3,
                                influence=4)

# The Advisor portraits have properties which might affect ratings, so we should investigate these:
portraitDetails <- data.frame(
  portraitId = 1:5,
  category = factor(c('w', 'b', 'w', 'b', 'w')),
  blackProp = c(0, .99, 0, .99, .01),
  age = c(28.7, 24.9, 23.3, 24.6, 23.7)
)