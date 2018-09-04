## Analysis script for AdvisorChoice web data ##############################################
# Matt Jaquiery, March 2018 (matt.jaquiery@psy.ox.ac.uk)
#

# 0) Support ####

#   0.i) Libraries ####

if(!require(jsonlite)) {
  install.packages("jsonlite")
  library(jsonlite)
}
  
if(!require(BayesFactor)) {
  install.packages('BayesFactor')
  library(BayesFactor)
}

if(!require(tidyverse)) {
  install.packages('tidyverse')
  library(tidyverse)
}

if(!require(reshape2)) {
  install.packages('reshape2')
  library(reshape2)
}

if(!require(lme4)) {
  install.packages('lme4')
  library(lme4)
}

if(!require(lsr)) {
  install.packages('lsr')
  library(lsr)
}

#   0.ii) Functions ####

# Print the results of a t-test as we would like to see them reported in a paper
prettyPrint <- function(results, d = NULL) {
  es <- NULL
  if(!is.null(d))
    es <- paste0(' , d=', round(d,2))
  print(paste0('t(',results$parameter,')=',round(results$statistic,2),
               ' [',round(attr(results$conf.int, "conf.level")*100),'%CI: ',
               round(results$conf.int[[1]],2), ', ', round(results$conf.int[[2]],2),'],',
               ' p=',round(results$p.value,3), es))
}

# Print the mean and CIs of a vector
printMean <- function(vector, label = 'Mean', doPrint = T, conf.int = .95, na.rm = F, decimals = 2) {
  mu <- mean(vector, na.rm = na.rm)
  s <- sd(vector, na.rm = na.rm)
  n <- length(vector)
  error <- qnorm(1-(1-conf.int)/2)*s/sqrt(n) # 95% confidence interval width
  ci.low <- mu - error
  ci.high <- mu + error
  r <- round(range(vector, na.rm = na.rm), decimals)
  print(paste0(label,'=', round(mu,decimals), ' [', round(conf.int,decimals)*100, '%CI: ',
               round(ci.low,decimals), ', ', round(ci.high,decimals),'] [Range: ',
               r[[1]], ', ', r[[2]], ']'))
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
  return(ifelse(long, 'None', NA))
}

#   0.iii) Globals ####

# advice types: neutral, agree-in-confidence, and agree-in-uncertainty
adviceTypes <- list(neutral=0, AiC=3, AiU=4, HighAcc=5, LowAcc=6)
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

# styling for ggplots
style <- theme_light() +
  theme(panel.grid.minor = element_blank(),
        panel.grid.major.x = element_blank(),
        legend.position = 'top')
style.long <- style + theme(legend.position = 'none')

# 1) Load data  ####

#   1.i) Load data ####

print('Load data')
if(exists('trials'))
  rm(trials)
if(exists('participants'))
  rm(participants)
if(exists('advisors'))
  rm(advisors)
if(exists('questionnaires'))
  rm(questionnaires)
if(exists('genTrustQ'))
  rm(genTrustQ)
folderName <- '../AdvisorChoice/data/processed/'
files <- list.files(folderName)
participants <- NULL
trials <- NULL
advisors <- NULL
questionnaires <- NULL
genTrustQ <- NULL
for (i in seq(length(files))) {
  fileName <- paste(folderName, files[[i]], sep='/')
  json <- readChar(fileName, file.info(fileName)$size)
  jsonData <- fromJSON(json, simplifyVector = T, simplifyMatrix = T, simplifyDataFrame = T)
  # store all columns in participants table except the three last 
  # (trials, advisors, and questionnaires are stored separately)
  # Patch for missing data in practice
  if(!('debriefComments' %in% names(jsonData)))
    jsonData <- c(list(debriefComments = 'NA'), jsonData)
  participants <- rbind(participants, 
                        as.data.frame(t(jsonData[!names(jsonData) %in% c('advisors', 
                                                                         'questionnaires', 
                                                                         'trials',
                                                                         'generalisedTrustQuestionnaire')])))
  # store the trials in the trials table
  trials <- rbind(trials, jsonData$trials)
  advisors <- rbind(advisors, jsonData$advisors)
  questionnaires <- rbind(questionnaires, jsonData$questionnaires)
  if(('generalisedTrustQuestionnaire' %in% names(jsonData)))
    genTrustQ <- rbind(genTrustQ, jsonData$generalisedTrustQuestionnaire)
}
rm(jsonData, files, fileName, folderName, json)
  
#   1.ii) Calculate utility variables ####
print('Calculate utility variables')
# Fix for the javascript saving function recording the advice side as correctness rather than agreement
trials$adviceRight <- grepl('RIGHT', trials$adviceString, fixed = T)
trials$adviceSideOld <- trials$adviceSide
trials$adviceSide <- ifelse(trials$adviceRight, 1, 0)
trials$advisorAgreesOld <- trials$advisorAgrees
trials$advisorAgrees <- trials$initialAnswer == trials$adviceRight

trials$adviceType <- getAdviceType(trials, participants, advisors) # adviceType > trials table
trials$confidenceShift <- getConfidenceShift(trials) #  amount the confidence changes
trials$confidenceShiftRaw <- getConfidenceShift(trials,T,T) # as above, without symmetry adjustment
trials$influence <- getInfluence(trials) # amount the confidence changes in the direction of the advice
trials$rawInfluence <- getInfluence(trials, T, T) # as above, without symmetry adjustment
trials$switch <- trials$initialAnswer != trials$finalAnswer # whether participant switched response
trials$initialCorrect <- trials$initialAnswer == trials$correctAnswer # whether the initial answer is correct
trials$finalCorrect <- trials$finalAnswer == trials$correctAnswer # whether the final answer is correct
# Sometimes it helps to see confidence arranged from sure left to sure right (-100 to 100)
trials$initialConfSpan <- ifelse(trials$initialAnswer==0,trials$initialConfidence*-1,trials$initialConfidence)
trials$finalConfSpan <- ifelse(trials$finalAnswer==0,trials$finalConfidence*-1,trials$finalConfidence)
# Was the response to the advice irrational?
trials$irrational <- (trials$advisorAgrees & trials$confidenceShift < 0) |
  (!trials$advisorAgrees & trials$confidenceShift > 0)
# Convert times to seconds since the 70 epoch
participants$timeStart <- sapply(participants$timeStart, function(x)x[[1]]/1000)
participants$timeEnd <- sapply(participants$timeEnd, function(x)x[[1]]/1000)
# For convenience the long participant Id is shortened to a simple number:
participants$pid <- which(as.character(participants$id) == participants$id)
tmp <- function(x) participants$pid[which(participants$id == x)]
trials$pid <- sapply(trials$participantId, tmp)
questionnaires$pid <- sapply(questionnaires$participantId, tmp)
advisors$pid <- sapply(advisors$participantId, tmp)
genTrustQ$pid <- sapply(genTrustQ$participantId, tmp)
# adviceType > questionnaire table
aT <- vector(length = dim(questionnaires)[1]) 
timepoint <- aT
for (i in 1:dim(questionnaires)[1]) {
  aT[[i]] <- getAdviceTypeById(questionnaires$advisorId[i], questionnaires$participantId[i], advisors)
  # get the time point of the questionnaire (1=prospective, 2=retrospective)
  timepoint[i] <- 1 + 
    as.numeric(questionnaires$afterTrial[i] > 
                 mean(questionnaires$afterTrial[questionnaires$pid == questionnaires$pid[i] 
                                                & questionnaires$advisorId == questionnaires$advisorId[i]]))
}
questionnaires$adviceType <- aT
questionnaires$timepoint <- timepoint
# Stick the name and portrait data into the questionnaires table
questionnaires$advisorName <- factor(sapply(1:nrow(questionnaires), function(i) 
  advisors$name[advisors$pid==questionnaires$pid[i]
                & advisors$id == questionnaires$advisorId[i]]))
questionnaires$advisorPortrait <- sapply(1:nrow(questionnaires), function(i) {
  x <- advisors$portraitSrc[advisors$pid==questionnaires$pid[i]
                            & advisors$id == questionnaires$advisorId[i]]
  x <- sub('assets/image/advisor', '', x, fixed = T)
  as.factor(sub('.jpg', '', x, fixed = T))
})
# Add on the source data
questionnaires$advisorAge <- sapply(questionnaires$advisorPortrait, function(i) portraitDetails$age[i])
questionnaires$advisorCategory <- sapply(questionnaires$advisorPortrait, function(i) portraitDetails$category[i])
# The first general trust question is reverse coded
genTrustQ$answer <- as.numeric(genTrustQ$answer)
genTrustQ$answer[genTrustQ$order==0] <- 100 - genTrustQ$answer[genTrustQ$order==0]

#   1.iii) Split off real trials ####
print('Separate real trials from practice')
all.trials <- trials
trials <- trials[which(!trials$practice),]
all.questionnaires <- questionnaires
questionnaires <- questionnaires[which(questionnaires$adviceType!=0),]
all.advisors <- advisors
advisors <- advisors[which(advisors$adviceType!=0),]

# 2) Demographics ####

print('Demographics')
print('Demographic data are not collected and therefore not analysed')

# 3) Manipulation checks ####

print('Manipulation checks')

#   3.i) Overall agreement by contingency ####

# These advisors don't show contingent agreement, so there shouldn't be much
# here. This is retained mostly for comparison purposes
print('3.i Overall agreement by contingency')
tmp <- aggregate(advisorAgrees ~ pid + confidenceCategory + adviceType + initialCorrect, data = trials, FUN = mean)
aov.iii.i <- aov(advisorAgrees ~ confidenceCategory * adviceType * initialCorrect + 
             Error(pid / (confidenceCategory + adviceType + initialCorrect)), data = tmp)
print(summary(aov.iii.i))

#   3.ii) Graph: overall agreement by contingency ####
print('3.ii Graph of overall agreement by contingency')
w <- 0.8
gg.iii.ii <- ggplot(tmp, aes(y = advisorAgrees, x = as.factor(confidenceCategory), colour = as.factor(adviceType))) +
  stat_summary(geom = 'point', size = 3, fun.y = mean, position = position_dodge(w)) +
  stat_summary(geom = 'errorbar', fun.data = mean_cl_boot, position = position_dodge(w), size = 0.2) +
  geom_point(alpha = 0.5, position = position_dodge(w)) +
  facet_wrap(~initialCorrect, labeller = label_both) +
  scale_x_discrete(name = 'Confidence Category', labels = c('Low', 'Med', 'High')) +
  scale_color_discrete(name = 'Advice Type', labels = getAdviceTypeName(unique(tmp$adviceType))) +
  scale_y_continuous(name = 'Advisor Agreement') +
  labs(title = 'Observed agreement rate for each advisor by initial decision confidence and correctness') +
  style
gg.iii.ii

#   3.iii) Initial block agreement by contingency ####
print('3.iii Initial block agreement by contingency')
# Initial block is forced trials
tmp <- aggregate(advisorAgrees ~ pid + confidenceCategory + adviceType + initialCorrect, 
                 data = trials[trials$type==trialTypes$force, ], FUN = mean)
tmp.aov <- aov(advisorAgrees ~ confidenceCategory * adviceType * initialCorrect + 
                 Error(pid / (confidenceCategory + adviceType + initialCorrect)), data = tmp)
summary(tmp.aov)

#   3.iv) Graph: initial block agreement by contingency ####
print('3.iv Graph of intial block agreement by contingency')
gg.iii.iv <- ggplot(tmp, aes(y = advisorAgrees, x = as.factor(confidenceCategory), colour = as.factor(adviceType))) +
  stat_summary(geom = 'point', size = 3, fun.y = mean, position = position_dodge(w)) +
  stat_summary(geom = 'errorbar', fun.data = mean_cl_boot, position = position_dodge(w), size = 0.2) +
  geom_point(alpha = 0.5, position = position_dodge(w)) +
  facet_wrap(~initialCorrect, labeller = label_both) +
  scale_x_discrete(name = 'Confidence Category', labels = c('Low', 'Med', 'High')) +
  scale_color_discrete(name = 'Advice Type', labels = c('AiC', 'AiU')) +
  scale_y_continuous(name = 'Advisor Agreement') +
  labs(title = 'Observed agreement rate for each advisor by initial decision confidence and correctness\n on forced trials') +
  style
gg.iii.iv

print('3.iv.i Graph of agreement by block on initialCorrect trials')
tmp <- aggregate(advisorAgrees ~ pid + confidenceCategory + adviceType + typeName, 
                 data = trials[trials$initialCorrect==T, ], FUN = mean)
tmp.aov <- aov(advisorAgrees ~ confidenceCategory * adviceType * typeName + 
                 Error(pid / (confidenceCategory + adviceType + typeName)), data = tmp)
summary(tmp.aov)
gg.iii.iv.i <- ggplot(tmp, aes(y = advisorAgrees, x = as.factor(confidenceCategory), colour = as.factor(adviceType))) +
  stat_summary(geom = 'point', size = 3, fun.y = mean, position = position_dodge(w)) +
  stat_summary(geom = 'errorbar', fun.data = mean_cl_boot, position = position_dodge(w), size = 0.2) +
  geom_point(alpha = 0.5, position = position_dodge(w)) +
  facet_wrap(~typeName, labeller = label_both) +
  scale_x_discrete(name = 'Confidence Category', labels = c('Low', 'Med', 'High')) +
  scale_color_discrete(name = 'Advice Type', labels = c('AiC', 'AiU')) +
  scale_y_continuous(name = 'Advisor Agreement') +
  labs(title = 'Observed agreement rate for each advisor by initial decision confidence and block\n on initially correct trials') +
  style
gg.iii.iv.i

#   3.v) Trial count by contingency ####
print('3.v Trial count by contingency')
# Let's also check we got appropriate numbers of trials in each of the bins for
# each participant
df.iii.v <- aggregate(practice ~ 
                   pid + confidenceCategory + adviceType + initialCorrect + advisorAgrees, 
                 data = trials, FUN = length)
#print(df.iii.v)

#   3.vi) Graph: trial count by contingency ####
print('3.vi Graph of trial count by contingency')
gg.iii.vi <- ggplot(df.iii.v, aes(y = practice, x = as.factor(confidenceCategory), 
                colour = as.factor(adviceType), shape = as.factor(advisorAgrees))) +
  stat_summary(geom = 'point', size = 3, fun.y = mean, position = position_dodge(w)) +
  stat_summary(geom = 'errorbar', fun.data = mean_cl_boot, position = position_dodge(w), size = 0.2) +
  geom_point(alpha = 0.5, position = position_dodge(w)) +
  facet_wrap(~initialCorrect, labeller = label_both) +
  scale_x_discrete(name = 'Confidence Category', labels = c('Low', 'Med', 'High')) +
  scale_color_discrete(name = 'Advice Type', labels = c('AiC', 'AiU')) +
  scale_y_continuous(name = 'Trial Count') +
  scale_shape_discrete(name = 'Advisor Agreement', labels = c('Disagree', 'Agree')) +
  labs(title = 'Observed trial count for dis/agreement from each advisor by initial decision confidence\n and correctness') +
  style
gg.iii.vi

# 4) Exclusions ####

print('Running exclusions')
# Exclusion rules:
# Proportion of correct initial judgements must be (.60 < cor1/n < .90) 
#NB:practice trials are INCLUDED in this since they are used in part for
#determining confidence calibration
participants$excluded <- sapply(participants$pid, function(pid){
  ts <- which(all.trials$pid == pid)
  # overall accuracy of initial decisions
  v <- all.trials$initialAnswer[ts] == all.trials$correctAnswer[ts]
  m <- mean(as.numeric(v), na.rm = T)
  if(m < .6 | m > .85)
    return('Accuracy')
  # varied use of confidence scale
  ts <- which(trials$pid == pid)
  cCs <- aggregate(pid ~ confidenceCategory, data = trials[ts, ], FUN = length)
  # All confidence categories must be used
  if(nrow(cCs) < 3)
    return ('Confidence')
  # Clarify the numbers on the rules below
  # All confidence categories must have at least 5% of the number of trials
  if(any(cCs$pid < length(ts)*.05))
    return('Confidence.cat')
  return(F)
  })
all.participants <- participants
participants <- participants[participants$excluded==F, ]
# Remove excluded participants' data from other data frames
trials <- trials[trials$pid %in% participants$pid, ]
advisors <- advisors[advisors$pid %in% participants$pid, ]
questionnaires <- questionnaires[questionnaires$pid %in% participants$pid, ]

df.iv <- aggregate(pid ~ excluded, data = all.participants, FUN = length)
names(df.iv) <- c('exclusionReason', 'count')
print(df.iv)

# 5) Descriptives ####
print('Descriptive statistics')
#   5.i) Proportion correct ####
print('5.i Proportion correct')
df.v.i <- NULL
for(col in c('initial', 'final')) {
  for(aT in c(5,6,0)) {
    colName <- paste0(col,'Correct')
    if(aT==adviceTypes$neutral)
      aT <- c(adviceTypes$HighAcc, adviceTypes$LowAcc) # hack for including the total
    x <- as.numeric(trials[trials$adviceType %in% aT, colName])
    m <- mean(x)
    cl <- mean_cl_normal(x)
    rn <- range(aggregate(trials[trials$adviceType %in% aT, c(colName,'pid','adviceType')], 
                          by = list(trials$pid[trials$adviceType %in% aT]), 
                          FUN = function(x){sum(as.numeric(x))/length(x)})[,colName])
    df.v.i <- rbind(df.v.i, data.frame(decision = col,
                                 adviceType = ifelse(length(aT)>1,'Total',getAdviceTypeName(aT)), # hack to label total
                                 target = ifelse(col=='initial',.71,NA),
                                 meanCorrect = m,
                                 cl95Min = cl$ymin,
                                 cl95Max = cl$ymax,
                                 rangeMin = rn[1],
                                 rangeMax = rn[2]))
  }
}
df.v.i[,-(1:2)] <- round(df.v.i[,-(1:2)],2)
print(df.v.i)


#   5.ii) Agreement rate ####
print('5.ii Agreement rate')
df.v.ii <- NULL
for(aT in c(5,6)) {
  if(aT==adviceTypes$neutral)
    next()
  ts <- trials[trials$adviceType==aT, ]
  for(i in 1:(length(confidenceCategories)+3)) {
    if(i <= length(confidenceCategories)) {
      x <- ts[ts$confidenceCategory==confidenceCategories[i] & ts$initialCorrect==T, ]
      name <- names(confidenceCategories[i])
    } else {
      i <- i - length(confidenceCategories)
      if(i==1) {
        x <- ts[ts$initialCorrect, ]
        name <- 'allCorrect'
      } else if(i==2) {
        x <- ts[!ts$initialCorrect, ]
        name <- 'allWrong'
      } else {
        x <- ts
        name <- 'All'
      }
    }
    m <- mean(as.numeric(x$advisorAgrees))
    cl <- mean_cl_normal(as.numeric(x$advisorAgrees))
    rn <- range(aggregate(advisorAgrees ~ pid, data = x,
                          FUN = function(x){sum(as.numeric(x))/length(x)})$advisorAgrees)
    df.v.ii <- rbind(df.v.ii, data.frame(adviceType = getAdviceTypeName(aT), # hack to label totalname,
                                 name,
                                 probAgree = m,
                                 cl95Min = cl$ymin,
                                 cl95Max = cl$ymax,
                                 rangeMin = rn[1],
                                 rangeMax = rn[2]))
  }
}
df.v.ii[,-(1:2)] <- round(df.v.ii[,-(1:2)],2)
print(df.v.ii)

#   5.iii) Mean confidence ####
print('5.iii.i Mean confidence by correctness')
df.v.iii.i <- NULL
for(col in c('initial', 'final')) {
  for(correct in list(T,F,c(T,F))) {
    colName <- paste0(col,'Confidence')
    x <- trials[trials[,paste0(col,'Correct')] %in% correct, ]
    m <- mean(x[,colName])
    cl <- mean_cl_normal(x[,colName])
    rn <- range(aggregate(trials[trials[,paste0(col,'Correct')] %in% correct, c(colName,'pid','adviceType')], 
                          by = list(trials$pid[trials[,paste0(col,'Correct')] %in% correct]), 
                          FUN = function(x){sum(as.numeric(x))/length(x)})[,colName])
    df.v.iii.i <- rbind(df.v.iii.i, data.frame(decision = col,
                                 correct = ifelse(length(correct)>1,'Both',correct), # hack to label total
                                 meanConfidence = m,
                                 cl95Min = cl$ymin,
                                 cl95Max = cl$ymax,
                                 rangeMin = rn[1],
                                 rangeMax = rn[2]))
  }
}
df.v.iii.i[,-(1:2)] <- round(df.v.iii.i[,-(1:2)],2)
print(df.v.iii.i)

print('5.iii.ii Mean confidence by advisor')
df.v.iii.ii <- NULL
for(col in c('initial', 'final')) {
  for(aT in c(adviceTypes$HighAcc, adviceTypes$LowAcc, adviceTypes$neutral)) {
    if(aT==adviceTypes$neutral)
      aT <- c(adviceTypes$HighAcc, adviceTypes$LowAcc) # hack for including the total
    colName <- paste0(col,'Confidence')
    x <- trials[trials[,"adviceType"] %in% aT, ]
    m <- mean(x[,colName])
    cl <- mean_cl_normal(x[,colName])
    rn <- range(aggregate(trials[trials[,"adviceType"] %in% aT, c(colName,'pid','adviceType')], 
                          by = list(trials$pid[trials[,"adviceType"] %in% aT]), 
                          FUN = function(x){sum(as.numeric(x))/length(x)})[,colName])
    df.v.iii.ii <- rbind(df.v.iii.ii, data.frame(decision = col,
                                             adviceType = ifelse(length(aT)>1,'Both',getAdviceTypeName(aT)), # hack to label total
                                             meanConfidence = m,
                                             cl95Min = cl$ymin,
                                             cl95Max = cl$ymax,
                                             rangeMin = rn[1],
                                             rangeMax = rn[2]))
  }
}
df.v.iii.ii[,-(1:2)] <- round(df.v.iii.ii[,-(1:2)],2)
print(df.v.iii.ii)

# As above by dis/agreement and advice type
df.v.iii.2 <- NULL
for(agree in c(T,F)) {
  for(aT in c(adviceTypes$HighAcc, adviceTypes$LowAcc, adviceTypes$neutral)) {
    if(aT==adviceTypes$neutral)
      aT <- c(adviceTypes$HighAcc, adviceTypes$LowAcc) # hack for including the total
    x <- trials[trials$advisorAgrees==agree & trials$adviceType %in% aT, ]
    m <- mean(x$finalConfidence)
    cl <- mean_cl_normal(x$finalConfidence)
    rn <- range(aggregate(finalConfidence ~ pid, data = x,
                          FUN = function(x){sum(as.numeric(x))/length(x)})$finalConfidence)
    df.v.iii.2 <- rbind(df.v.iii.2, data.frame(agree,
                                 advisor = ifelse(length(aT)>1,'Both',getAdviceTypeName(aT)), # hack to label total
                                 meanConfidence = m,
                                 cl95Min = cl$ymin,
                                 cl95Max = cl$ymax,
                                 rangeMin = rn[1],
                                 rangeMax = rn[2]))
  }
}
df.v.iii.2[,-(1:2)] <- round(df.v.iii.2[,-(1:2)],2)
print('Descriptives: final decision confidence')
df.v.iii.2

#   5.iv) Graph: Initial vs Final confidence ####
print('5.iv Graph of initial vs final confidence')
# Influence of the advisors is evident in the deviation from the dashed y=x
# line. Points lying below the line indicate a more leftward response from
# initial to final judgement. Points above the line indicate a more rightward
# response in the final judgement. The further away from the y=x line, the
# greater the change from initial to final judgement. Separate plots show
# agreement vs disagreement trials (between the advisor and judge), and separate
# colours indicate whether the judge's final decision was correct or incorrect.
# The shaded area indicates the boundary for the symmetrical influence measure.
# Points outside this area are truncated by moving them vertically until they
# meet the grey area.

df.poly1 <- data.frame(    # These polygon points define a parellelogram marking the limits for the capped influence
  x=c(50, 0, 0),
  y=c(50, 50, -50)
)
df.poly2 <- df.poly1 * -1
gg.v.iv <- ggplot(trials, aes(x = initialConfSpan, y = finalConfSpan)) +
  geom_polygon(data = df.poly1, aes(x,y), fill = 'grey', alpha = 0.2) +
  geom_polygon(data = df.poly2, aes(x,y), fill = 'grey', alpha = 0.2) +
  geom_point(alpha = 0.2, aes(color = factor(finalCorrect))) +
  geom_abline(slope = 1, intercept = 0, linetype = 'dashed', size = 1, color = 'black') +
  scale_color_discrete(name = 'Final judgement', labels = c('Incorrect', 'Correct')) +
  scale_x_continuous(limits = c(-50,50), expand = c(0,0)) +
  scale_y_continuous(limits = c(-50,50), expand = c(0,0)) +
  facet_grid(~advisorAgrees, labeller = as_labeller(c('FALSE'='Disagree', 'TRUE'='Agree'))) +
  labs(title = "Initial vs final confidence",
       legend = NULL,
       x = 'Initial confidence',
       y = "Final confidence") +
  coord_fixed() +
  style + 
  theme(panel.spacing = unit(1.5, 'lines'),
        plot.margin = unit(c(0,1,0,0.5), 'lines'))
gg.v.iv

df.v.iv <- NULL
for(a in c(T,F)) {
  v <- trials[trials$advisorAgrees == a, ]
  i <- mean(v$confidenceShiftRaw > 0)
  d <- mean(v$confidenceShiftRaw < 0)
  n <- mean(v$confidenceShiftRaw == 0)
  df.v.iv <- rbind(df.v.iv, data.frame(advisorAgrees = a, 
                                       increaseConfPerC = i,
                                       noChangePerC = n,
                                       decreaseConfPerC = d))
}
print(df.v.iv)

#   5.v) Questionnaire responses ####
print('5.v Questionnaire responses')
df.v.v <- NULL
for(tp in unique(questionnaires$timepoint)) {
  for(colName in c('likeability', 'ability', 'benevolence')) {
    for(aT in c(5,6)) {
      if(aT == adviceTypes$neutral)
        next()
      x <- questionnaires[questionnaires$adviceType==aT & questionnaires$timepoint==tp, ]
      m <- mean(x[,colName])
      cl <- mean_cl_normal(x[,colName])
      rn <- range(aggregate(x[,c('pid',colName)], 
                            by = list(questionnaires$pid[questionnaires$adviceType==aT 
                                                         & questionnaires$timepoint==tp]), 
                            FUN = function(x){sum(as.numeric(x))/length(x)})[,colName])
      df.v.v <- rbind(df.v.v, data.frame(timepoint = tp,
                                         question = colName,
                                         adviceType = getAdviceTypeName(aT),
                                         mean = m,
                                         cl95Min = cl$ymin,
                                         cl95Max = cl$ymax,
                                         rangeMin = rn[1],
                                         rangeMax = rn[2]))
    }
  }
}
df.v.v[,-(1:3)] <- round(df.v.v[,-(1:3)],2)
print(df.v.v)

#   5.vi) Advisor accuracy ####
print('5.vi) Advisor accuracy')
df.vi <- NULL
for(agree in list(T,F,c(T,F))) {
  for(aT in c(adviceTypes$HighAcc, adviceTypes$LowAcc, adviceTypes$neutral)) {
    if(aT==adviceTypes$neutral)
      aT <- c(adviceTypes$HighAcc, adviceTypes$LowAcc) # hack for including the total
    x <- trials[trials$advisorAgrees %in% agree & trials$adviceType %in% aT, ]
    x$adviceCorrect <- x$adviceSide == x$correctAnswer
    cl <- mean_cl_normal(x$adviceCorrect)
    rn <- range(aggregate(adviceCorrect ~ pid, x, FUN = mean)$adviceCorrect)
    df.vi <- rbind(df.vi, data.frame(agree = ifelse(length(agree)>1, 'Both', agree),
                                     advisor = ifelse(length(aT)>1,'Both',getAdviceTypeName(aT)), # hack to label total
                                     meanConfidence = cl$y,
                                     cl95Min = cl$ymin,
                                     cl95Max = cl$ymax,
                                     rangeMin = rn[1],
                                     rangeMax = rn[2]))
    
  }
}
df.vi[,-(1:2)] <- round(df.vi[,-(1:2)],2)
df.vi

# 6) Is the HighAcc advisor selected more often? ####

print('Preferential selection for high accuracy advisor')

#   6.i) Overall ####
print('6.i Overall preference')
# We want to know whether the more accurate advisor is selected more often by
# the participant when a choice is offered.
#
# We will find this out by taking the number of times each participant selected
# the high accuracy advisor and dividing by the total number of choice
# trials for that participant (should be the same for all participants). We can
# then take the mean of this proportion across participants and test it for
# significant versus the null hypothesis of random picking (0.5).
tmp <- aggregate(adviceType ~ pid, 
                 data = trials[trials$type==trialTypes$choice, ],
                 FUN = function(x)sum(x==adviceTypes$HighAcc)/length(x))
t.vi.i <- t.test(tmp$adviceType, mu=0.5)
d <- cohensD(tmp$adviceType, mu = 0.5)
tB.vi.i <- ttestBF(tmp$adviceType, mu = 0.5)

printMean(tmp$adviceType, 'Mean HighAcc pick rate')
print('Choice proportion HighAcc vs. chance level (.5)')
prettyPrint(t.vi.i, d)
print('Bayesian examination of above (prior = mean of 0.5, sd as empirically observed)')
print(tB.vi.i)
print(paste0('Evidence strength for preferential HighAcc picking: BF=', round(exp(tB.vi.i@bayesFactor$bf),3)))

#   6.ii) Medium-confidence trials ####
print('6.ii Medium-confidence trials')
# And the same with mid-confidence trials only:
tmp <- aggregate(adviceType ~ pid, 
                 data = trials[trials$type==trialTypes$choice 
                               & trials$confidenceCategory==confidenceCategories$medium, ],
                 FUN = function(x)sum(x==adviceTypes$HighAcc)/length(x))
t.vi.ii <- t.test(tmp$adviceType, mu=0.5)
d <- cohensD(tmp$adviceType, mu=0.5)
tB.vi.ii <- ttestBF(tmp$adviceType, mu = 0.5)

printMean(tmp$adviceType, 'Mean HighAcc pick rate')
print('Choice proportion HighAcc vs. chance level (.5) for mid-confidence trials')
prettyPrint(t.vi.ii,d)
print('Bayesian examination of above (prior = mean of 0.5, sd as empirically observed)')
print(tB.vi.ii)
print(paste0('Evidence strength for preferential HighAcc picking: BF=', round(exp(tB.vi.ii@bayesFactor$bf),3)))

#   6.iii) Graph: Advisor preference by confidence category ####
print('6.iii Graph of advisor preference')
# Proportion of the time each participant picked the high agreement
# advisor. Connected points of a colour indicate data from a single participant,
# while the diamond indicates the mean proportion across all participants. The
# dashed reference line indicates picking both advisors equally, as would be
# expected by chance. Error bars give 95% bootstrapped confidence intervals.

# This graph is likely to change in the write-up because confidence categories
# aren't very useful for these advisors
tmp <- aggregate(adviceType ~ pid + confidenceCategory,
                 data = trials[trials$type==trialTypes$choice, ],
                 FUN = function(x)sum(x==adviceTypes$HighAcc)/length(x))
tmp.2 <- aggregate(adviceType ~ pid,
                   data = trials[trials$type == trialTypes$choice, ],
                   FUN = function(x)sum(x==adviceTypes$HighAcc)/length(x))
gg.vi.iii <- ggplot(tmp, aes(x = factor(confidenceCategory), y = adviceType)) +
  geom_hline(linetype = "dashed", color = "black", yintercept = .5, size = 1) +
  geom_point(aes(color = factor(pid))) +
  geom_line(aes(group = factor(pid), color = factor(pid))) +
  stat_summary(geom = "errorbar", fun.data = "mean_cl_boot", width = 0.1) +
  stat_summary(geom = "point", fun.y = "mean", shape = 23, fill = "black", size = 4) +
  geom_point(position = position_jitter(w=0.03, h=0),
             aes(x="Overall", color = factor(pid)), 
             data = tmp.2) +
  stat_summary(geom = "errorbar", fun.data = "mean_cl_boot", width = 0.1,
               aes(x="Overall"), data = tmp.2) +
  stat_summary(geom = "point", fun.y = "mean", shape = 23, fill = "black", size = 4,
               aes(x="Overall"), data = tmp.2) +
  scale_y_continuous(limits = c(0,1), expand = c(0.05,0)) +
  scale_x_discrete(expand = c(0,1), labels = c('Low', 'Medium',
                                               'High', 'Overall')) +
  scale_color_discrete(name = 'Participant') +
  labs(title = "Advisor preference",
       legend = NULL,
       x = "Confidence",
       y = "P(HighAcc advisor is chosen)") +
  style.long
gg.vi.iii

# 7) ANOVA investigating influence ####

print('ANOVAs investigating influence')

#   7.i) Adjusted influence, all trials ####
print('7.i Adjusted influence on all trials')
#Influence is defined as the extent to which the judge's (participant's) final
#decision has moved from their initial decision in the direction of the advice
#received.
# We begin by calculating influence for all trials and saving that information
# since it will come in handy for looking at influence on subsets of trials
# later. Below, we run an ANOVA using the influence data.

# 2x2x2 ANOVA investigating effects of advisor type
# (High/Low accuracy), choice (un/forced), and agreement
# (dis/agree) on influence. These are all within-subjects manipulations.
tmp <- aggregate(influence ~ adviceType + hasChoice + advisorAgrees + pid, data = trials, FUN = mean)
print('Running ANOVAs')
aov.vii.i <- aov(influence ~ adviceType * hasChoice * advisorAgrees + 
                                              Error(pid / (adviceType + hasChoice + advisorAgrees)), 
                                            data=tmp)
print('2x2x2 Mixed ANOVA of advisor type x choice x agreement')
print(summary(aov.vii.i))

print('Means:')
printMean(tmp$influence[tmp$adviceType==adviceTypes$HighAcc], 'Mean|HighAcc')
printMean(tmp$influence[tmp$adviceType==adviceTypes$LowAcc], 'Mean|LowAcc')
printMean(tmp$influence[tmp$hasChoice], 'Mean|Choice')
printMean(tmp$influence[!tmp$hasChoice], 'Mean|Forced')
printMean(tmp$influence[tmp$advisorAgrees], 'Mean|Agree')
printMean(tmp$influence[!tmp$advisorAgrees], 'Mean|Disagree')

#   7.ii) Graph: Adjusted Advice influence, all trials ####
print('7.ii Graph of adjusted influence on all trials')
# Influence of advice under varied conditions. Points indicate mean values for a
# participant, while diamonds indicate the mean of participant means, with error
# bars specifying 95% confidence intervals.
tmp$adviceType <- factor(tmp$adviceType)
gg.vii.ii <- ggplot(tmp, aes(advisorAgrees, influence, color = adviceType, fill = adviceType)) +
  geom_point(position = position_jitter(w=0.1, h=0), alpha = 0.5) +
  stat_summary(geom = "errorbar",
               fun.data = "mean_cl_boot",
               width = 0.2) +
  stat_summary(geom = "point",
               fun.y = "mean",
               shape = 23, size = 5) +
  stat_summary(aes(group = adviceType), fun.y=mean, geom="line") + 
  facet_grid(.~hasChoice, 
             labeller = as_labeller(c('FALSE'='Forced trials','TRUE'='Choice trials'))) +
  scale_color_discrete(name = 'Advisor type', labels = getAdviceTypeName(unique(tmp$adviceType))) +
  scale_fill_discrete(name = 'Advisor type', labels = getAdviceTypeName(unique(tmp$adviceType))) +
  scale_x_discrete(name = 'Judge-advisor agreement', labels = c('Disagree', 'Agree')) +
  labs(title = "Advice Influence",
       legend = NULL,
       y = "Influence of the advice") +
  style
gg.vii.ii

#   7.iii) Adjusted influence, medium-confidence trials ####
print('7.iii Adjusted influence on medium-confidence trials')
# The bias-sharing advisor and anti-bias advisors differ in their frequency with
# which they agree with the participant as a  function of participant confidence
# (by design). To control for background effects where people are influenced
# different amounts depending on their own initial confidence, we also look at
# only those trials where participant confidence was in the mid-range (i.e.
# where both advisors agree 70% of the time, and thus where agreement and
# confidence balance out). This subset only includes trials on which the
# participant was CORRECT. Where incorrect, advisors also agree equally often 
# (30% of the time), so these trials could be included. 
tmp <- aggregate(influence ~ adviceType + hasChoice + advisorAgrees + pid, 
                 data = trials[trials$confidenceCategory==confidenceCategories$medium
                               & trials$finalAnswer==trials$correctAnswer, ], 
                 FUN = mean)
aov.vii.iii <- aov(influence ~ adviceType * hasChoice * advisorAgrees + 
                                                 Error(pid / (adviceType + hasChoice + advisorAgrees)), 
                                               data=tmp)
print('As above, looking at only trials where intial decision was correct and made with middle confidence:')
print(summary(aov.vii.iii))

print('Means:')
printMean(tmp$influence[tmp$adviceType==adviceTypes$HighAcc], 'Mean|HighAcc')
printMean(tmp$influence[tmp$adviceType==adviceTypes$LowAcc], 'Mean|LowAcc')
printMean(tmp$influence[tmp$hasChoice], 'Mean|Choice')
printMean(tmp$influence[!tmp$hasChoice], 'Mean|Forced')
printMean(tmp$influence[tmp$advisorAgrees], 'Mean|Agree')
printMean(tmp$influence[!tmp$advisorAgrees], 'Mean|Disagree')

#   7.iv) Raw influence, all trials ####
print('7.iv Raw influence on all trials')

# N.B. This is not a core analysis!

# 2x2x2 ANOVA investigating effects of advisor type
# (agree-in-confidence/uncertainty), choice (un/forced), and agreement
# (dis/agree) on influence. These are all within-subjects manipulations.
tmp <- aggregate(rawInfluence ~ adviceType + hasChoice + advisorAgrees + pid, data = trials, FUN = mean)
print('Running ANOVAs')
aov.vii.iv <- aov(rawInfluence ~ adviceType * hasChoice * advisorAgrees + 
                                              Error(pid / (adviceType + hasChoice + advisorAgrees)), 
                                            data=tmp)
print('Original mixed ANOVA using raw influence scores')
print(summary(aov.vii.iv))

print('Means:')
printMean(tmp$rawInfluence[tmp$adviceType==adviceTypes$HighAcc], 'Mean|HighAcc')
printMean(tmp$rawInfluence[tmp$adviceType==adviceTypes$LowAcc], 'Mean|LowAcc')
printMean(tmp$rawInfluence[tmp$hasChoice], 'Mean|Choice')
printMean(tmp$rawInfluence[!tmp$hasChoice], 'Mean|Forced')
printMean(tmp$rawInfluence[tmp$advisorAgrees], 'Mean|Agree')
printMean(tmp$rawInfluence[!tmp$advisorAgrees], 'Mean|Disagree')

# 8) Trust questionnaire answers ####
print('Analysis of trust questionnaires')
#   8.i) Bayesian no-difference tests for advisor properties ####
print('Bayesian tests investigating advisor properties')
# We want to show that the randomly assigned advisor race/age/portrait/name had
# no effect. We will do this by showing that they did not differ between
# timepoints.

#     8.i.i) Race
print('8.i.i Race')
df.viii.i.i <- NULL
for(v in c('likeability', 'ability', 'benevolence')) {
  x <- questionnaires[questionnaires$advisorCategory=='b',v]
  y <- questionnaires[questionnaires$advisorCategory=='w',v]
  bf <- ttestBF(x,y)
  df.viii.i.i <- rbind(df.viii.i.i, data.frame(variable = v,
                                               BF = exp(bf@bayesFactor$bf),
                                               mu1 = mean(x),
                                               mu2 = mean(y)))
}
print(df.viii.i.i)

#     8.i.ii) Age
print('8.i.ii Age')
df.viii.i.ii <- NULL
for(v in c('likeability', 'ability', 'benevolence')) {
  tmp <- correlationBF(questionnaires[,v], questionnaires[,'advisorAge'])
  df.viii.i.ii <- rbind(df.viii.i.ii, data.frame(variable = v,
                                                 corellationBF = exp(tmp@bayesFactor$bf)))
}
print(df.viii.i.ii)

#     8.i.iii) Portrait
print('8.i.iii Portrait')
tmp <- questionnaires
tmp$pid <- as.factor(tmp$pid)
df.viii.i.iii <- NULL
for(v in c('likeability', 'ability', 'benevolence')) {
  tmp$v <- tmp[,v]
  tmp.aov <- anovaBF(v ~ advisorPortrait + pid, data = tmp, whichRandom = 'pid', progress = F)
  df.viii.i.iii <- rbind(df.viii.i.iii, data.frame(variable = v,
                                                 BF = exp(tmp.aov@bayesFactor$bf)))
}
print(df.viii.i.iii)

#     8.i.iv) Name
print('8.i.iv Name')
tmp <- questionnaires
tmp$pid <- as.factor(tmp$pid)
df.viii.i.iv <- NULL
for(v in c('likeability', 'ability', 'benevolence')) {
  tmp$v <- tmp[,v]
  tmp.aov <- anovaBF(v ~ advisorName + pid, data = tmp, whichRandom = 'pid', progress = F)
  df.viii.i.iv <- rbind(df.viii.i.iv, data.frame(variable = v,
                                                 BF = exp(tmp.aov@bayesFactor$bf)))
}
print(df.viii.i.iv)

# If any of the above do show significant differences then we'll have to show
# that the factors which differ are not systematically linked to the advice type
# in order to demonstrate that they're not responsible for any advice type
# effects we observe

#   8.ii) 2x2 AdviceType x Timepoint MANOVA ####
# TODO ####
# Check this MANOVA actually accounts for multiple observations per participant
print('8.ii AdviceType x Timepoint MANOVA')
aov.viii.ii <- manova(cbind(ability, likeability, benevolence) ~ adviceType * timepoint,# + Error(pid),
                      data = questionnaires)
print(summary(aov.viii.ii))

df.viii.ii <- NULL
tmp <- questionnaires[ ,c('likeability', 'benevolence', 'ability', 'pid', 'adviceType', 'timepoint')]
for(v in c('likeability', 'ability', 'benevolence')) {
  tmp$v <- tmp[ ,v]
  tmp.2 <- aggregate(v ~ adviceType + timepoint + pid, 
                     data = tmp,
                     FUN = mean)
  for(aT in c(5,6)) {
    if(aT == adviceTypes$neutral)
      next()
    for(tp in unique(tmp.2$timepoint)) {
      x <- tmp.2$v[tmp.2$adviceType==aT & tmp.2$timepoint==tp]
      df.viii.ii <- rbind(df.viii.ii, data.frame(domain = v,
                                                 adviceType=aT,
                                                 timepoint=tp,
                                                 mu=mean(x),
                                                 ci95low=mean_cl_normal(x)$ymin,
                                                 ci95hi =mean_cl_normal(x)$ymax))
    }
  }
}
df.viii.ii[ ,4:6] <- round(df.viii.ii[ ,4:6],2)
df.viii.ii$adviceType <- sapply(df.viii.ii$adviceType, getAdviceTypeName)
df.viii.ii[order(df.viii.ii$timepoint), ]

#   8.iii) Graph: Pro/retrospective assessments by advice type and dimension ####
print('8.iii Graph of questionnaire responses')
# TODO ####
# tidy the hell out of this graph. Should allow easy discrimination
# between advice type assessment changes over time.
tmp <- aggregate(cbind(likeability, ability, benevolence) ~ adviceType + timepoint + pid, 
                 data = questionnaires, FUN = mean)
tmp <- melt(tmp, id.vars = c('adviceType', 'timepoint', 'pid'))
gg.viii.iii <- ggplot(tmp, aes(x = variable, y = value, colour = as.factor(timepoint))) +
  geom_boxplot() +
  scale_y_continuous(limits = c(0,100)) +
  facet_grid(~ adviceType) + 
  style
gg.viii.iii


# 9) Do participants simply prefer agreement? ####

print('Do participants simply prefer agreement?')

#   9.i) Pick rate in low- vs high-confidence trials ####
print('9.i Pick rate in low- vs high-confidence trials')
# If so, we should see that participants preferentially pick the high accuracy
# advisor when their initial confidence is high, and low accuracy when
# their initial confidence is low. We can t-test HighAcc pick proportion in
# high-confidence vs HighAcc pick proportion in low-confidence.
tmp <- aggregate(adviceType ~ pid + confidenceCategory,
                 data = trials[trials$type==trialTypes$choice, ],
                 FUN = function(x)sum(x==adviceTypes$HighAcc)/length(x))
t.ix.i <- t.test(tmp$adviceType[tmp$confidenceCategory==confidenceCategories$low],
       tmp$adviceType[tmp$confidenceCategory==confidenceCategories$high],
       paired = T)
d <- cohensD(tmp$adviceType[tmp$confidenceCategory==confidenceCategories$low],
              tmp$adviceType[tmp$confidenceCategory==confidenceCategories$high])
tB.ix.i <- ttestBF(tmp$adviceType[tmp$confidenceCategory==confidenceCategories$low],
        tmp$adviceType[tmp$confidenceCategory==confidenceCategories$high],
        paired = T)
print('Choice proportion HighAcc in low- vs high-confidence trials')
prettyPrint(t.ix.i,d)
printMean(tmp$adviceType[tmp$confidenceCategory==confidenceCategories$low], 'low')
printMean(tmp$adviceType[tmp$confidenceCategory==confidenceCategories$high], 'high')
print('Bayesian examination of above (prior = mean diff of 0, sd as empirically observed)')
print(tB.ix.i)
print(paste0('Evidence strength for differential high/low confidence picking strategy: BF=', 
             round(exp(tB.ix.i@bayesFactor$bf),3)))

# 10) Subjective-objective correlation ####
print('Subjective-objective measure correlation')
#   10.i) Questionnaire-influence correlation ####
print('10.i Questionnaire-influence correlation')
# Participants rate advisors on three factors: ability, benevolence, and
# likeability. We can investigate these ratings for correlations with the
# objective influence measure. We would expect ability to show the strongest
# correlation because it relates to expertise in the literature and should be
# the primary dimension of variation in appraisal (indeed our theoretical model
# only considers ability assessments). Benevolence is unlikely to change much,
# though some participants may use benevolence to compensate for advisors they
# believe to be high in ability and yet still not very influential (because
# they're deliberately giving bad advice). Likeability, reasoning from the
# results of our previous study, is likely to be largely orthogonal to advice.
 
tmp <- aggregate(cbind(likeability, ability, benevolence) ~ adviceType + timepoint + pid,
                 data = questionnaires, FUN = mean)
# calculate difference scores
for(i in 1:nrow(tmp))
  if(tmp$timepoint[i]==2)
    tmp[i,4:6] <- tmp[i, 4:6] - tmp[tmp$timepoint==1 
                                   & tmp$pid == tmp$pid[i]
                                   & tmp$adviceType == tmp$adviceType[i], 4:6]

tmp.2 <- aggregate(influence ~ adviceType + pid + hasChoice, 
                   data = trials, FUN = mean)
tmp$influence <- sapply(1:nrow(tmp), function(i){tmp.2$influence[tmp.2$hasChoice 
                                                                 & tmp.2$pid == tmp$pid[i]
                                                                 & tmp.2$adviceType == tmp$adviceType[i]]})

# The test is a regression with the change in subjective variables as predictors
lm.x.i <- lm(influence ~ ability + benevolence + likeability, data = tmp)
print(summary(lm.x.i))

#   10.ii) Graph: Questionnaire-influence correlation ####
print('10.ii Graph of questionnaire-influence correlation')
tmp <- melt(tmp[tmp$timepoint==2, ], id.vars = c('adviceType', 'pid', 'timepoint', 'influence'), 
            measure.vars = c('likeability', 'ability', 'benevolence'), 
            variable.name = 'trustDimension', value.name = 'trust')
gg.x.ii <- ggplot(tmp, aes(x = trust, y = influence, colour = factor(adviceType))) +
  geom_point(alpha = 0.33) +
  geom_smooth(method = 'lm', aes(fill = factor(adviceType)), alpha = 0.1) +
  facet_grid(trustDimension ~ .) +
  coord_fixed(ratio = 3, expand = F) +
  scale_x_continuous(name = 'Trust change') +
  scale_y_continuous(name = 'Influence') + 
  scale_color_discrete(name = 'Advice type', labels = getAdviceTypeName(unique(tmp$adviceType))) +
  scale_fill_discrete(name = 'Advice type', labels = getAdviceTypeName(unique(tmp$adviceType))) +
  style
gg.x.ii

# 11) Generalised Trust ####
#   11.i) Generalised Trust and subjective assessments ####
print('11.i Generalized Trust and Subjective Assessments')

# Generalised Trust is a measure of the propensity to trust, so we expect it to
# correlate with the initial scores for the advisor questionnaires
tmp <- aggregate(cbind(likeability, ability, benevolence) ~ pid,
                  data = questionnaires[questionnaires$timepoint==1,],
                  FUN = mean)
tmp$genTrust <- sapply(tmp$pid, function(x) genTrustQ$answer[genTrustQ$pid==x & genTrustQ$order==0])
df.xi.i <- NULL
for(v in c('likeability', 'ability', 'benevolence')) {
  tmp.2 <- cor.test(tmp[,v], tmp[,'genTrust'])
  df.xi.i <- rbind(df.xi.i, data.frame(variable = v,
                                       corellation = tmp.2$estimate,
                                       p.value = tmp.2$p.value,
                                       method = tmp.2$method))
}
print(df.xi.i)

# Graph result
tmp.2 <- melt(tmp, id.vars = c('pid'), measure.vars = c('likeability', 'ability', 'benevolence'))
tmp.2$genTrust <- sapply(tmp.2$pid, function(x) tmp$genTrust[tmp$pid==x][1])
gg.xi.i <- ggplot(tmp.2, aes(x = genTrust, y = value)) +
  geom_smooth(method = 'lm') +
  geom_point(aes(colour = as.factor(pid))) +
  facet_grid(variable ~ .) + 
  style.long
gg.xi.i

#   11.ii) Generalised Trust and influence ####
print('11.ii Generalized Trust and Influence')

# Generalised trust should also correlate with influence given that influence is
# supposedly a manifestation of trust
tmp <- aggregate(cbind(influence, rawInfluence) ~ pid,
                 data = trials,
                 FUN = mean)
tmp$genTrust <- sapply(tmp$pid, function(x) genTrustQ$answer[genTrustQ$pid==x & genTrustQ$order==0])
df.xi.ii <- NULL
for(v in c('rawInfluence', 'influence')) {
  tmp.2 <- cor.test(tmp[,v], tmp[,'genTrust'])
  df.xi.ii <- rbind(df.xi.ii, data.frame(variable = v,
                                         corellation = tmp.2$estimate,
                                         p.value = tmp.2$p.value,
                                         method = tmp.2$method))
}
print(df.xi.ii)

gg.xi.ii <- ggplot(tmp, aes(x = genTrust, y = influence)) +
  geom_smooth(method = 'lm') + 
  geom_point(aes(colour = as.factor(pid))) +
  style.long
gg.xi.ii


# 12) Predicting advisor from confidence ####
print('12 Predicting advisor from confidence')

df.xii <- NULL
for(pid in unique(trials$pid)) {
  tmp <- trials[trials$pid==pid, ]
  tmp$adviceType <- as.factor(tmp$adviceType)
  ans <- glm(adviceType ~ initialConfidence, tmp, family = binomial(link = "logit"))
  s <- summary(ans)
  df.xii <- rbind(df.xii, data.frame(pid,
                                     coef = s$coefficients[2,1],
                                     p = s$coefficients[2,4]))
}
tmp <- df.xii
names(tmp)[2] <- 'y'
tmp$x <- 0
gg.xii <- ggplot(tmp, aes(x = p)) + geom_freqpoly(binwidth = 0.1) 
gg.xii


# 13) Influence strength by confidence category ####
print('13 Influence strength by confidence category')

tmp <- aggregate(influence ~ confidenceCategory + pid, data = trials, FUN = mean)
gg.xiii <- ggplot(tmp, aes(x = confidenceCategory, y = influence)) + 
  geom_point(aes(colour = as.factor(pid)), alpha = 0.5) + 
  geom_smooth(method = 'lm', 
              aes(group = as.factor(pid), colour = as.factor(pid)),
              se = F,
              alpha = 0.2) +
  stat_summary(geom = 'errorbar', fun.data = mean_cl_boot) +
  style.long
gg.xiii

summary(aov(influence ~ confidenceCategory, data = tmp))

# 14) Confidence autocorrelation plots by participant ####
for(pid in unique(trials$pid)) {
  tmp <- trials[trials$pid == pid, ]
  ggplot(tmp, aes(x = initialConfSpan, y = finalConfSpan)) +
    geom_polygon(data = df.poly1, aes(x,y), fill = 'grey', alpha = 0.2) +
    geom_polygon(data = df.poly2, aes(x,y), fill = 'grey', alpha = 0.2) +
    geom_point(alpha = 0.2, aes(color = factor(finalCorrect))) +
    geom_abline(slope = 1, intercept = 0, linetype = 'dashed', size = 1, color = 'black') +
    scale_color_discrete(name = 'Final judgement', labels = c('Incorrect', 'Correct')) +
    scale_x_continuous(limits = c(-50,50), expand = c(0,0)) +
    scale_y_continuous(limits = c(-50,50), expand = c(0,0)) +
    facet_grid(~advisorAgrees, labeller = as_labeller(c('FALSE'='Disagree', 'TRUE'='Agree'))) +
    labs(title = paste('PID:', pid, 'Initial vs final confidence'),
         legend = NULL,
         x = 'Initial confidence',
         y = "Final confidence") +
    coord_fixed() +
    style + 
    theme(panel.spacing = unit(1.5, 'lines'),
          plot.margin = unit(c(0,1,0,0.5), 'lines'))
  #ggsave(paste0('explore/autocorrelations/pid', pid, '.png'), width = 8.96, height = 5.97, units = 'in')
}

# 15) Examining dot difference ####
library(gganimate)
g <- ggplot(trials, aes(x = id, y = dotDifference)) +
  geom_line() +
  geom_smooth(method = 'lm') +
  scale_x_continuous(limits = c(60,246)) +
  style.long +
  labs(title = 'Participant {frame_time}') +
  transition_time(pid)

#animate(g, fps = 1)  
