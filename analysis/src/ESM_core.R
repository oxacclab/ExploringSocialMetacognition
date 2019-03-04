
# Prerequisites -----------------------------------------------------------

source('src/ESM_utils.R') # libraries and some manipulation functions
source('src/miscFunctions.R') # neat printing, etc

if(!require(Rcpp)) {
  install.packages("Rcpp")
  library(Rcpp)
}

# Variables ---------------------------------------------------------------

dodge.width.agreements <- .8
dodge.width.influence <- .4


# Load and prepare data ---------------------------------------------------

loadFilesFromFolder <- function(folderName) {
  files <- list.files(folderName)
  participants <- NULL
  trials <- NULL
  advisors <- NULL
  questionnaires <- NULL
  genTrustQ <- NULL
  debrief <- NULL
  debriefRepQuiz <- NULL
  for (i in seq(length(files))) {
    fileName <- paste(folderName, files[[i]], sep = '/')
    json <- readChar(fileName, file.info(fileName)$size)
    jsonData <- fromJSON(json, simplifyVector = T, simplifyMatrix = T, simplifyDataFrame = T)
    # store all columns in participants table except the special cases  
    # (trials, advisors, and questionnaires (including GTQ) are stored separately)
    if (is.null(participants))
      participants <- rbind(participants,
                            as.data.frame(t(jsonData[!names(jsonData) %in% c('advisors',
                                                                             'questionnaires', 
                                                                             'trials',
                                                                             'generalisedTrustQuestionnaire',
                                                                             'debrief',
                                                                             'debriefRepQuiz')])))
    else
      participants <- rbind(participants[, names(participants) %in% names(jsonData)], 
                            as.data.frame(t(jsonData[names(jsonData) %in% names(participants)])))
    # store the trials in the trials table
    trials <- rbind(trials, jsonData$trials)
    advisors <- rbind(advisors, jsonData$advisors)
    questionnaires <- rbind(questionnaires, jsonData$questionnaires)
    if (('generalisedTrustQuestionnaire' %in% names(jsonData)))
      genTrustQ <- rbind(genTrustQ, jsonData$generalisedTrustQuestionnaire)
    debrief <- rbind(debrief, jsonData$debrief)
    debriefRepQuiz <- rbind(debriefRepQuiz, jsonData$debriefRepQuiz)
  }
  return(list(participants = participants, 
              trials = trials,
              advisors = advisors,
              questionnaires = questionnaires,
              genTrustQ = genTrustQ,
              debrief = debrief,
              debriefRepQuiz = debriefRepQuiz))
}

#' @param results from \link{loadFilesFromFolder}
#' @param replaceWithPID whether to add a pid field instead. If NULL, adds a pid
#'   field if it doesn't already exist.
#' @return results with each participantId field removed
removeParticipantIds <- function(results, replaceWithPID = NULL) {
  
  pids <- as.data.frame(unique(results[['participants']]$id))
  
  for (dfName in names(results)) {
    df <- results[[dfName]]
    idColName <- ifelse(dfName == 'participants', 'id', 'participantId')
    if (!(idColName %in% names(df)))
      next()
    addPID <- (replaceWithPID == T || (is.null(replaceWithPID) && !('pid' %in% names(df))))
    if (addPID) {
      pid <- sapply(df[ , idColName], function(x) which(pids == x))
      df <- cbind(pid, df)
    }
    df[ , idColName] <- NULL
    results[[dfName]] <- df
  }
  return(results)
}


# Clean data --------------------------------------------------------------

trialUtilityVariables <- function(results) {
  # unpack results
  for (i in 1:length(results))
    assign(names(results)[i], results[i][[1]])
  
  out <- data.frame(trials$id)
  
  dualAdvisors <- !is.null(trials$advisor0id)
  
  # sometimes it helps to see confidence arranged from sure left to sure right (-100 to 100)
  out$initialConfSpan <- ifelse(trials$initialAnswer == 0,trials$initialConfidence*-1,trials$initialConfidence)
  out$finalConfSpan <- ifelse(trials$finalAnswer == 0,trials$finalConfidence*-1,trials$finalConfidence)
  
  # confidence changes
  out$confidenceShift <- getConfidenceShift(trials) #  amount the confidence changes
  out$confidenceShiftRaw <- getConfidenceShift(trials,T,T) # as above, without symmetry adjustment
  out$switch <- trials$initialAnswer != trials$finalAnswer # whether participant switched response
  
  # trial correctness
  out$initialCorrect <- trials$initialAnswer == trials$correctAnswer # whether the initial answer is correct
  out$finalCorrect <- trials$finalAnswer == trials$correctAnswer # whether the final answer is correct
  
  # advisor ids
  out$adviceType <- findAdviceType(trials$advisorId, trials$pid, advisors) # adviceType > trials table
  if (dualAdvisors) {
    out$advisor0type <- findAdviceType(trials$advisor0id, trials$pid, advisors)
    out$advisor1type <- findAdviceType(trials$advisor1id, trials$pid, advisors)
  } else {
    out$advisor0type <- NA
    out$advisor1type <- NA
  }
  
  # advisor group ids
  out$advisorGroup <- findAdvisorGroup(trials$advisorId, trials$pid, advisors)
  if (dualAdvisors) {
    out$advisor0group <- findAdvisorGroup(trials$advisor0id, trials$pid, advisors)
    out$advisor1group <- findAdvisorGroup(trials$advisor1id, trials$pid, advisors)
  } else {
    out$advisor0group <- NA
    out$advisor1group <- NA
  }
  
  # advisor influence
  # amount the confidence changes in the direction of the advice
  out$advisorInfluence <- NA
  out$advisor0influence <- NA
  out$advisor1influence <- NA
  
  # as above, without symmetry adjustment
  out$advisorInfluenceRaw <- NA
  out$advisor0influenceRaw <- NA
  out$advisor1influenceRaw <- NA
  
  for (tt in unique(trials$type)) {
    # Older data sometimes misses trial type assignment
    if (is.na(tt))
      next()
    
    m <- trials$type == tt & !is.na(trials$type)
    
    if (tt == trialTypes$force || tt == trialTypes$choice || tt == trialTypes$change) {
      out$advisorInfluence[m] <- findInfluence(trials$advisorAgrees,
                                               out$confidenceShift)[m]
      out$advisorInfluenceRaw[m] <- findInfluence(trials$advisorAgrees,
                                                  out$confidenceShiftRaw)[m]
    }
    if (tt == trialTypes$dual) {
      out$advisor0influence[m] <- findInfluence(trials$advisor0agrees,
                                                out$confidenceShift)[m]
      out$advisor0influenceRaw[m] <- findInfluence(trials$advisor0agrees,
                                                   out$confidenceShiftRaw)[m]
      out$advisor1influence[m] <- findInfluence(trials$advisor1agrees,
                                                out$confidenceShift)[m]
      out$advisor1influenceRaw[m] <- findInfluence(trials$advisor1agrees,
                                                   out$confidenceShiftRaw)[m]
    }
  }
  
  if (!is.null(trials$stimulusParent)) {
    # repetition stuff
    out$isRepeat <- !is.na(trials$stimulusParent)
    out$isRepeated <- F
    for (pid in unique(trials$pid)) {
      ts <- trials[trials$pid == pid, ]
      ts$isRepeated <- ts$id %in% ts$stimulusParent
      out$isRepeated[trials$pid == pid] <- ts$isRepeated
    }
  }
  
  return(out[ ,-1])
}

# Manipulation check functions ----------------------------------------------

#' @param trials data frame
#' @return a list of by-participant advisor interaction data frames and summary
#'   tables
advisorManipulationData <- function(trials) {
  pairs <- getAdviceTypePairs(c(trials$adviceType, trials$advisor0type, trials$advisor1type))
  full <- data.frame(pid = unique(trials$pid))
    
  for(advisorTypes in pairs) {
    advisorTypes <- advisorTypes[order(advisorTypes)]
    # make a table of the advice for each trial
    advice <- data.frame(trials$id)
    for(a in advisorTypes)
      advice <- cbind(advice, data.frame(getAdviceByType(trials, a)))
    names(advice)[2:3] <- getAdviceTypeName(advisorTypes)
    
    if(advisorTypes[1] == adviceTypes$AiC) {
      # Agree-in-Confidence/Uncertainty - compare agreement at different confidence categories
      df <- data.frame(pid = unique(trials$pid))
      for(x in 1:6) {
        cc <- list(0, 1, 2, c(0:2), c(0:2), c(0:2))[[x]]
        right <- list(T, T, T, T, F, T)[[x]]
        ccName <- list('low', 'med', 'high', 'right', 'wrong', 'all')[[x]]
        m <- trials$confidenceCategory %in% cc & trials$initialCorrect == right
        for(a in advisorTypes) {
          df[ , paste0(getAdviceTypeName(a), ccName)] <- 
            sapply(df$pid, 
                   function(pid) 
                     mean(advice[m & trials$pid == pid, getAdviceTypeName(a)] == 
                            trials$initialAnswer[m & trials$pid == pid], 
                          na.rm = T))
        }
      }
    }
    if(advisorTypes[1] == adviceTypes$HighAcc) {
      # High/Low Accuracy - compare objective accuracy
      for(a in advisorTypes) {
        v <- paste0(getAdviceTypeName(a), 'Correct')
        advice[ , v] <- advice[ , getAdviceTypeName(a)] == trials$correctAnswer
      }
      tmp <- cbind(data.frame(pid = trials$pid), advice)
      df <- aggregate(cbind(HighAccCorrect, LowAccCorrect) ~ pid, tmp, mean)
    }
    if(advisorTypes[1] == adviceTypes$HighAgr) {
      # High/Low Agreement - compare agreement
      for(a in advisorTypes) {
        v <- paste0(getAdviceTypeName(a), 'Agrees')
        advice[ , v] <- advice[ , getAdviceTypeName(a)] == trials$initialAnswer
      }
      tmp <- cbind(data.frame(pid = trials$pid), advice)
      df <- aggregate(cbind(HighAgrAgrees, LowAgrAgrees) ~ pid, tmp, mean)
    }
    full <- cbind(full, df[ ,-1])
  }
  short <- data.frame(mean = colMeans(full[ ,-1]),
                      sd = apply(full[ ,-1], 2, sd, na.rm = T),
                      ciLow = apply(full[ ,-1], 2, function(x) mean_cl_normal(x)$ymin),
                      ciHigh = apply(full[ ,-1], 2, function(x) mean_cl_normal(x)$ymax),
                      rangeLow = apply(full[ ,-1], 2, function(x) range(x, na.rm = T)[1]),
                      rangeHigh = apply(full[ ,-1], 2, function(x) range(x, na.rm = T)[2]))
  return(list(data = full, summary = short))
}

#' Aggregate trial agreement by confidence, advisor, and initial correctness
#' @param trials trial set
#' @param factorize whether to convert aggregate-by values to factors
#' @param stripMissing whether to remove observations without complete data for each factor combination
tmp.agreementContingencies <- function(trials, factorize = T, stripMissing = T) {
  tmp <- aggregate(advisorAgrees ~ pid + confidenceCategory + adviceType + initialCorrect, data = trials, FUN = mean)
  if(!factorize)
    return(tmp)
  for(n in names(tmp[-(length(tmp))]))
    tmp[ ,n] <- factor(tmp[ ,n])
  if(!stripMissing)
    return(tmp)
  # drop missing observations
  miss <- aggregateMissing(tmp, 'pid', list('confidenceCategory', 'adviceType', 'initialCorrect'))
  tmp <- tmp[!(tmp$pid %in% miss), ]
}

#' ANOVA of agreement by correcteness, confidence, and advisor
#' @param trials trial list to compute ANOVA on
aov.agreementContingencies <- function(trials) {
  tmp <- tmp.agreementContingencies(trials)
  ezANOVA(data = tmp, dv = advisorAgrees, wid = pid, 
          within = .(confidenceCategory, adviceType, initialCorrect), 
          return_aov = T)
}

#' Graph of agreement
#' @inheritDotParams tmp.agreementContingencies
#' Additional arguments are passed to \code{tmp.agreementContingencies}
gg.agreementContingencies <- function(trials, ...) {
  tmp <- tmp.agreementContingencies(trials, ...)
  ggplot(tmp, aes(y = advisorAgrees, x = as.factor(confidenceCategory), colour = as.factor(adviceType))) +
    stat_summary(geom = 'point', size = 3, fun.y = mean, position = position_dodge(dodge.width.agreements)) +
    stat_summary(geom = 'errorbar', fun.data = mean_cl_boot, position = position_dodge(dodge.width.agreements), size = 0.2) +
    geom_point(alpha = 0.5, position = position_dodge(dodge.width.agreements)) +
    facet_wrap(~initialCorrect, labeller = label_both) +
    scale_x_discrete(name = 'Confidence Category', labels = c('Low', 'Med', 'High')) +
    scale_color_discrete(name = 'Advice Type', labels = getAdviceTypeName(unique(tmp$adviceType))) +
    scale_y_continuous(name = 'Advisor Agreement') +
    labs(title = 'Observed agreement rate on Forced trials') +
    style
}

#' Aggregate advisor agreement by confidence, advisor, and trial type
#' @param trials trial set
#' @param factorize whether to convert aggregate-by values to factors
#' @param stripMissing whether to remove observations without complete data for each factor combination
tmp.agreementContingenciesByType <- function(trials, factorize = T, stripMissing = T) {
  tmp <- aggregate(advisorAgrees ~ pid + confidenceCategory + adviceType + typeName, 
                   data = trials[trials$initialCorrect==T, ], FUN = mean)
  if(!factorize)
    return(tmp)
  for(n in names(tmp[-(length(tmp))]))
    tmp[ ,n] <- factor(tmp[ ,n])
  if(!stripMissing)
    return(tmp)
  # drop missing observations
  miss <- aggregateMissing(tmp, 'pid', list('confidenceCategory', 'adviceType', 'typeName'))
  tmp <- tmp[!(tmp$pid %in% miss), ]
}

#' ANOVA of agreement by trial type, confidence, and advisor
#' @param trials trial list to compute ANOVA on
aov.agreementContingenciesByType <- function(trials) {
  tmp <- tmp.agreementContingenciesByType(trials)
  ezANOVA(data = tmp, dv = advisorAgrees, wid = pid, 
          within = .(confidenceCategory, adviceType, typeName), 
          return_aov = T)
}

#' Graph of agreement
#' @inheritDotParams tmp.agreementContingenciesByType
#' Additional arguments are passed to \code{tmp.agreementContingenciesByType}
gg.agreementContingenciesByType <- function(trials, ...) {
  tmp <- tmp.agreementContingenciesByType(trials, ...)
  ggplot(tmp, aes(y = advisorAgrees, x = as.factor(confidenceCategory), colour = as.factor(adviceType))) +
    stat_summary(geom = 'point', size = 3, fun.y = mean, position = position_dodge(dodge.width.agreements)) +
    stat_summary(geom = 'errorbar', fun.data = mean_cl_boot, position = position_dodge(dodge.width.agreements), size = 0.2) +
    geom_point(alpha = 0.5, position = position_dodge(dodge.width.agreements)) +
    facet_wrap(~typeName, labeller = label_both) +
    scale_x_discrete(name = 'Confidence Category', labels = c('Low', 'Med', 'High')) +
    scale_color_discrete(name = 'Advice Type', labels = getAdviceTypeName(unique(tmp$adviceType))) +
    scale_y_continuous(name = 'Advisor Agreement') +
    labs(title = 'Observed agreement rate on initially correct trials') +
    style
}

#' Trial count by confidence, advisor, and agreement
#' @param trials trial set
#' @param factorize whether to convert aggregate-by values to factors
#' @param stripMissing whether to remove observations without complete data for each factor combination
tmp.contingencyCounts <- function(trials, factorize = T, stripMissing = F) {
  tmp <- aggregate(practice ~ 
                     pid + confidenceCategory + adviceType + initialCorrect + advisorAgrees, 
                   data = trials, FUN = length)
  if(!factorize)
    return(tmp)
  for(n in names(tmp[-(length(tmp))]))
    tmp[ ,n] <- factor(tmp[ ,n])
  if(!stripMissing)
    return(tmp)
  # drop missing observations
  miss <- aggregateMissing(tmp, 'pid', list('confidenceCategory', 'adviceType', 'initialCorrect', 'advisorAgrees'))
  tmp <- tmp[!(tmp$pid %in% miss), ]
}

#' Graph of contingency counts
#' @inheritDotParams tmp.contingencyCounts
#' Additional arguments are passed to \code{tmp.contingencyCounts}
gg.contingencyCounts <- function(trials, ...) {
  tmp <- tmp.contingencyCounts(trials, ...)
  ggplot(tmp, aes(y = practice, x = as.factor(confidenceCategory), 
                       colour = as.factor(adviceType), shape = as.factor(advisorAgrees))) +
    stat_summary(geom = 'point', size = 3, fun.y = mean, position = position_dodge(dodge.width.agreements)) +
    stat_summary(geom = 'errorbar', fun.data = mean_cl_boot, position = position_dodge(dodge.width.agreements), size = 0.2) +
    geom_point(alpha = 0.5, position = position_dodge(dodge.width.agreements)) +
    facet_wrap(~initialCorrect, labeller = label_both) +
    scale_x_discrete(name = 'Confidence Category', labels = c('Low', 'Med', 'High')) +
    scale_color_discrete(name = 'Advice Type', labels = c('AiC', 'AiU')) +
    scale_y_continuous(name = 'Trial Count') +
    scale_shape_discrete(name = 'Advisor Agreement', labels = c('Disagree', 'Agree')) +
    labs(title = 'Observed trial counts') +
    style
}


# Hypothesis test functions -----------------------------------------------


#' Aggregate influence by confidence, advisor, and agreement
#' @param trials trial set
#' @param factorize whether to convert aggregate-by values to factors
#' @param stripMissing whether to remove observations without complete data for each factor combination
tmp.influence <- function(trials, factorize = T, stripMissing = T) {
  tmp <- aggregate(influence ~ adviceType + hasChoice + advisorAgrees + pid, data = trials, FUN = mean)
  if(!factorize)
    return(tmp)
  for(n in names(tmp[-(length(tmp))]))
    tmp[ ,n] <- factor(tmp[ ,n])
  if(!stripMissing)
    return(tmp)
  # drop missing observations
  miss <- aggregateMissing(tmp, 'pid', list('adviceType', 'hasChoice', 'advisorAgrees'))
  tmp <- tmp[!(tmp$pid %in% miss), ]
} 

#' ANOVA on influence by the within-subjects factors
#' @param trials trial list to compute ANOVA on
aov.influence <- function(trials) {
  tmp <- tmp.influence(trials)
  ezANOVA(data = tmp, dv = influence, wid = pid, 
          within = .(adviceType, hasChoice, advisorAgrees), 
          return_aov = T)
}

#' ANOVA on influence by the within-subjects factors
#' @param trials trial list to compute ANOVA on
aov.influence.allForced <- function(trials) {
  tmp <- tmp.influence(trials)
  ezANOVA(data = tmp, dv = influence, wid = pid, 
          within = .(adviceType, advisorAgrees), 
          return_aov = T)
}

#' Print the means for the within-subjects factors
#' @inheritDotParams tmp.influence
#' @inheritParams tmp.influence
#' 
printMeans.influence <- function(trials, ...) {
  tmp <- tmp.influence(trials, ...)
  for(aT in unique(tmp$adviceType))
    cat(paste0(md.mean(tmp$influence[tmp$adviceType==aT], 
                paste0('*M*|', getAdviceTypeName(aT))), '\n\n'))
  if(length(unique(tmp$hasChoice)) > 1) {
    cat(paste0(md.mean(tmp$influence[tmp$hasChoice==T], '*M*|Choice'), '\n\n'))
    cat(paste0(md.mean(tmp$influence[tmp$hasChoice==F], '*M*|Forced'), '\n\n'))
  }
  if(length(unique(tmp$advisorAgrees)) > 1) {
    cat(paste0(md.mean(tmp$influence[tmp$advisorAgrees==T], '*M*|Agree'), '\n\n'))
    cat(paste0(md.mean(tmp$influence[tmp$advisorAgrees==F], '*M*|Disagree'), '\n\n'))
  }
  # NULL
}

#' Graph of influence
#' @inheritDotParams tmp.influence
gg.influence <- function(trials, ...) {
  tmp <- tmp.influence(trials, ...)
  ggplot(tmp, aes(advisorAgrees, influence, color = adviceType, fill = adviceType)) +
    geom_point(position = position_jitterdodge(0.25, dodge.width = dodge.width.influence), alpha = 0.5) +
    stat_summary(geom = "errorbar", fun.data = "mean_cl_boot", width = 0.2, 
                 position = position_dodge(dodge.width.influence)) +
    stat_summary(geom = "point", fun.y = "mean", shape = 23, size = 5, 
                 position = position_dodge(dodge.width.influence)) +
    # stat_summary(aes(group = adviceType), fun.y=mean, geom="line", 
    #              position = position_dodge(dodge.width.influence)) + 
    facet_grid(.~hasChoice, 
               labeller = as_labeller(c('FALSE'='Forced trials','TRUE'='Choice trials'))) +
    scale_color_discrete(name = 'Advisor type', labels = getAdviceTypeName(unique(tmp$adviceType))) +
    scale_fill_discrete(name = 'Advisor type', labels = getAdviceTypeName(unique(tmp$adviceType))) +
    scale_x_discrete(name = 'Judge-advisor agreement', labels = c('Disagree', 'Agree')) +
    labs(title = "Advice Influence",
         legend = NULL,
         y = "Influence") +
    style
}

# Data exploration --------------------------------------------------------

#' Produce a dataframe of pick rate and forced trial agreement difference
df.initialAgreement <- function(trials) {
  tmp <- NULL
  for(pid in unique(trials$pid)) {
    ts <- trials[trials$pid == pid, ]
    r <- NULL
    for(i in length(unique(ts$block))/2) {
      fBlock <- unique(ts$block)[2*(i-1)+1]
      cBlock <- unique(ts$block)[2*(i-1)+2]
      tsF <- ts[ts$block == fBlock, ]
      tsC <- ts[ts$block == cBlock, ]
      advisors <- unique(tsF$adviceType)
      agrDiff <- mean(tsF$advisorAgrees[tsF$adviceType == advisors[1]]) - 
        mean(tsF$advisorAgrees[tsF$adviceType == advisors[2]])
      pickRate <- mean(tsC$adviceType == advisors[1])
      # orient towards positive agreement difference
      if(agrDiff < 0) {
        agrDiff <- abs(agrDiff)
        pickRate <- 1-pickRate
        advisors <- rev(advisors)
      } 
      r <- rbind(r, data.frame(referenceAdvisor = advisors[1], 
                               agreementDiff = agrDiff,
                               pickRate))
    }
    r <- apply(r, 2, mean)
    tmp <- rbind(tmp, data.frame(pid = factor(pid),
                                       referenceAdvisor = r['referenceAdvisor'],
                                       agreementDiff = r['agreementDiff'],
                                       pickRate = r['pickRate']))
  }

  tmp$sameAdviceProfile <- round(tmp$referenceAdvisor) == tmp$referenceAdvisor
  return(tmp)
}

#' Plot of forced trial agreement vs pickRate
gg.initialAgreement <- function(trials) {
  tmp <- df.initialAgreement(trials)
  ggplot(tmp, aes(x = agreementDiff, y = pickRate, colour = pid, shape = sameAdviceProfile)) +
    geom_hline(linetype = 'dashed', colour = 'black', yintercept = .5) +
    geom_smooth(method = 'lm', colour = 'blue', fill = 'lightblue', alpha = .25) +
    geom_point(alpha = 0.5) +
    scale_shape_discrete(labels = c('Consistent', 'Inconsistent'), name = 'Most agreeing advisor') +
    scale_x_continuous(expand = c(0.005,0)) +
    labs(title = 'Initial agreement effects',
         y = 'P(More agreeing advisor chosen)',
         x = 'Mean agreement difference on Forced trials') +
    style.long
}
