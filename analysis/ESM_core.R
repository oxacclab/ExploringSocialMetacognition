
# Prerequisites -----------------------------------------------------------

source('ESM_utils.R') # libraries and some manipulation functions
source('miscFunctions.R') # neat printing, etc

# Variables ---------------------------------------------------------------

dodge.width.agreements <- .8
dodge.width.influence <- .4

# Manipulation check functions ----------------------------------------------

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
    printMean(tmp$influence[tmp$adviceType==aT], 
              paste0('Mean|', getAdviceTypeName(aT)))
  if(length(unique(tmp$hasChoice)) > 1) {
    printMean(tmp$influence[tmp$hasChoice==T], 'Mean|Choice')
    printMean(tmp$influence[tmp$hasChoice==F], 'Mean|Forced')
  }
  if(length(unique(tmp$advisorAgrees)) > 1) {
    printMean(tmp$influence[tmp$advisorAgrees==T], 'Mean|Agree')
    printMean(tmp$influence[tmp$advisorAgrees==F], 'Mean|Disagree')
  }
  NULL
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
