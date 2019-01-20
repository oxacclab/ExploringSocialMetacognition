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
# Forest plots
if(!require(ggridges)) {
  install.packages('ggridges')
  library(ggridges)
}
# # Long-to-wide conversions
# if(!require(reshape2)) {
#   install.packages('reshape2')
#   library(reshape2)
# }
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

#' Return a property of an Advisor from their ID for a given participant. 
#' @param property to return. Should be a column in advisors
#' @param advisorId
#' @param participantId will be joined to advisorId as a data.frame, so must be of the same length
#' @param advisors data frame of advisors
#' @return property of specified advisor
.lookupAdvisorProperty <- function(property, advisorId, participantId, advisors) {
  df <- data.frame(advisorId, participantId, type = NA)
  if(any(!is.na(df$advisorId))) {
    tmp <- df[!is.na(df$advisorId), ]
    tmp$type <- sapply(1:nrow(tmp),
                       function(i) advisors[advisors$pid == tmp$participantId[i] 
                                            & advisors$id == tmp$advisorId[i], property])
    for(i in 1:nrow(tmp))
      if(length(unlist(tmp$type[i])) == 0)
        tmp$type[i] <- list(NA)
    df[!is.na(df$advisorId), ] <- tmp
  }
  
  return(unlist(df$type))
}

#' Return an Advisor's adviceType from their ID for a given participant. Updated version of getAdviceType
#' @param advisorId
#' @param participantId will be joined to advisorId as a data.frame, so must be of the same length
#' @param advisors data frame of advisors
#' @return adviceType of specified advisor
findAdviceType <- function(advisorId, participantId, advisors) {
  return(.lookupAdvisorProperty('adviceType', advisorId, participantId, advisors))
}

#' Return an Advisor's groupId from their ID for a given participant. Updated version of getAdviceType
#' @param advisorId
#' @param participantId will be joined to advisorId as a data.frame, so must be of the same length
#' @param advisors data frame of advisors
#' @return adviceType of specified advisor
findAdvisorGroup <- function(advisorId, participantId, advisors) {
  return(.lookupAdvisorProperty('groupId', advisorId, participantId, advisors))
}

#' Return a vector of length \code{trials} containing the advice from an advisor
#' with advice profile \code{type} on each trial
#' @param trials data frame of trials to search
#' @param type advice type to search for
#' @requireSeen whether the advice must have been visible to the participant. If
#'   TRUE, unseen advice is replaced with NA
getAdviceByType <- function(trials, type, requireSeen = T) {
  out <- NULL
  for(i in 1:nrow(trials)) {
    tr <- trials[i, ]
    if(tr$adviceType == type && !is.na(tr$adviceSide))
      out <- c(out, tr$adviceSide)
    else {
      if(tr$advisor0type == type && !is.na(tr$advisor0adviceSide))
        out <- c(out, tr$advisor0adviceSide)
      else {
        if(tr$advisor1type == type && !is.na(tr$advisor1adviceSide))
          out <- c(out, tr$advisor1adviceSide)
        else
          out <- c(out, NA)
      }
    }
  }
  if(requireSeen)
    out[!getAdviceSeen(trials, type)] <- NA
  return(out)
}

#' @param trials data frame containing trials
#' @param type advisor's advice type
#' @return boolean vector of length \code{trials} with TRUE where the advice was
#'   seen on a trial
getAdviceSeen <- function(trials, type) {
  out <- NULL
  for(i in 1:nrow(trials)) {
    tr <- trials[i, ]
    if(tr$type %in% c(trialTypes$force, trialTypes$choice, trialTypes$change))
      out <- c(out, tr$adviceType == type)
    else {
      if(tr$type %in% c(trialTypes$dual))
        out <- c(out, type %in% c(tr$advisor0type, tr$advisor1type))
      else
        out <- c(out, F)
    }
  }
  return(out)
}

#' @param adviceTypeVector vector of advisor's adviceTypes
#' @param allowNeutral whether to allow neutral advisors as a type
#' @return list of pairs of adviceTypes which complement one another
getAdviceTypePairs <- function(adviceTypeVector, allowNeutral = F) {
  types <- unique(adviceTypeVector)
  if(!allowNeutral)
    types <- types[types != adviceTypes$neutral]
  types <- types[!is.na(types)]
  types <- types[order(types)]
  pairs <- list()
  if(length(types) < 2)
    return(list())
  for(i in 1:(length(types)/2)) 
    pairs[[i]] <- c(types[2*(i-1)+1], types[2*(i-1)+2])
  return(pairs)
}

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

#' Return a vector of influences of advisors. Influence is +confidenceShift
#' where the advisor agrees, and -confidenceShift where the advisor disagrees.
#' @param advisorIds
#' @param advisorAgreements
#' @param confidenceShifts the parameters are all bound together into a
#'   dataframe so must all be the same length
#' @return vector of influences of the advisors. NA where advisorId is NA
findInfluence <- function(advisorAgreements, confidenceShift) {
  out <- NA
  out[advisorAgreements == T 
      & !is.na(advisorAgreements)] <- confidenceShift[advisorAgreements == T
                                                       & !is.na(advisorAgreements)]
  out[advisorAgreements == F 
      & !is.na(advisorAgreements)] <- -1 * confidenceShift[advisorAgreements == F 
                                                            & !is.na(advisorAgreements)]
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
      out <- c(out, getAdviceTypeName(aT, long = long))
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

#' Get the name of a trial type
#' @param type of trial
getTrialTypeName <- function(type) {
  names(trialTypes)[trialTypes == type]
}


# Type2 ROC ---------------------------------------------------------------

#' @param correctness vector of correctness of judgements
#' @param confidence vector of the confidence of judgements
#' @param bins number of bins to use, or NA if data should be judged by each confidence value individually
#' @return type 2 receiver operator characterisitc curve points
type2ROC <- function(correctness, confidence, bins = NA) {
  if(!is.na(bins)) 
    confidence <- cut(confidence, seq(0, 50, length.out = bins))
  
  points <- data.frame(x = unique(confidence), y = NA)
  for(i in 1:nrow(points)) {
    points$y[i] <- mean(correctness[confidence == points$x[i]])
  }
  
  points <- points[order(points$x), ]
  
  # scale x values
  #points$x <- points$x / max(points$x)
  return(points)
}

# Global variables --------------------------------------------------------

# advice types: neutral, agree-in-confidence, and agree-in-uncertainty
adviceTypes <- list(neutral=0, 
                    AiC=3, AiU=4, 
                    HighAcc=5, LowAcc=6,
                    HighAgr=7, LowAgr=8)

trialTypes <- list(catch=0, force=1, choice=2, dual=3, change=4)
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