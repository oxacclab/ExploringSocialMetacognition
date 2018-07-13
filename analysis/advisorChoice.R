## Analysis script for AdvisorChoice web data ##############################################
# Matt Jaquiery, March 2018 (matt.jaquiery@psy.ox.ac.uk)
#
# 0) Support
#   0.i) Libraries
#   0.ii) Functions
#   0.iii) Globals
# 1) Load data 
#   1.i) Load data
#   1.ii) Calculate utility variables
#   1.iii) Split off real trials
# 2) Demographics
# 3) Manipulation checks
#   3.i) Overall agreement by contingency
#   3.ii) Graph: overall agreement by contingency
#   3.iii) Initial block agreement by contingency
#   3.iv) Graph: initial block agreement by contingency
#   3.v) Trial count by contingency
#   3.vi) Graph: trial count by contingency
# 4) Exclusions
# 5) Descriptives
#   5.i) Proportion correct
#   5.ii) Agreement rate
#   5.iii) Mean confidence
#   5.iv) Graph: Initial vs Final confidence
#   5.v) Questionnaire responses
# 6) Is the AiC advisor selected more often?
#   6.i) Overall
#   6.ii) Medium-confidence trials
#   6.iii) Graph: Advisor preference by confidence category
# 7) ANOVA investigating influence
#   7.i) Adjusted influence, all trials
#   7.ii) Graph: Adjusted Advice influence, all trials
#   7.iii) Adjusted influence, medium-confidence trials
#   7.iv) Raw influence, all trials
# 8) Trust questionnaire answers
#   8.i) Multivariate hierachical multiple regression
#     8.i.a) Control model
#     8.i.b) Advice type
#   8.ii) Graph: Pro/retrospective assessments by advice type and dimension
# 9) Do participants simply prefer agreement?
#   9.i) Pick rate in low- vs high-confidence trials
# 10) Subjective-objective correlation
#   10.i) Questionnaire-influence correlation
#   10.ii) Graph: Questionnaire-influence correlation

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

#   0.ii) Functions ####

# Print the results of a t-test as we would like to see them reported in a paper
prettyPrint <- function(results) {
  print(paste0('t(',results$parameter,')=',round(results$statistic,2),
               ' [',round(attr(results$conf.int, "conf.level")*100),'%CI: ',
               round(results$conf.int[[1]],2), ', ', round(results$conf.int[[2]],2),'],',
               ' p=',round(results$p.value,3)))
}
# Return the id of the advisor with adviceType for participant
getAdvisorIdByType <- function(pid, type, advisor.data.frame) {
  rows <- advisor.data.frame[which(advisor.data.frame$participantId==pid),] 
  row <- rows[which(rows$adviceType==type),]
  if (length(row) > 0)
    return(row$id)
  return(NA)
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
  # shortcut if we already calculated this
  if('confidenceShift' %in% colnames(t) && !forceRecalculate)
    return(t$confidenceShift)
  out <- vector(length=dim(t)[1])
  for (i in seq(length(out))) {
    if (is.na(t$finalConfidence[i])) { # no advisor
      out[i] <- NA
    } else {
      max.shift <- 100 - t$initialConfidence[i]
      if(t$initialAnswer[i]==t$finalAnswer[i])
        out[i] <- t$finalConfidence[i]-t$initialConfidence[i] # same side
      else
        out[i] <- t$finalConfidence[i]+t$initialConfidence[i] # switched sliders, so went to 0 on the first one
      out[i] <- ifelse(abs(out[i] > max.shift), max.shift*sign(out[i]), out[i])
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
      if (t$advisorAgrees[i]){
        if(t$initialAnswer[i]==t$finalAnswer[i])
          out[i] <- getConfidenceShift(t[i,], rawShift, forceRecalculate) # agrees and answer stays the same
        else
          out[i] <- -1 * getConfidenceShift(t[i,], rawShift, forceRecalculate) # agrees but answer switches
      } else {
        if(t$initialAnswer[i]==t$finalAnswer[i]) 
          out[i] <- -1 * getConfidenceShift(t[i,], rawShift, forceRecalculate) # disagrees but answer stays the same
        else
          out[i] <- getConfidenceShift(t[i,], rawShift, forceRecalculate) # disagrees and answer switches    
      }
    }
  }
  return(out)
}
# Find the proportion A/B while allowing for A and B to be 0
findProportion <- function (A, B) {
  out <- vector(length = length(A))
  for (i in 1:length(A)) {
    if (B[i] == 0) {
      if (A[i] == 0) # both 0
        out[i] <- NaN
      else
        out[i] <- 1 # x/0 = 1. It's official
    } else {
      if (A[i] == 0)
        out[i] <- 0 # 0/x = 0. Also official now
      else
        out[i] <- A[i]/B[i]
    }
  }
  return(out)
}

#' Get the name of the advice type 
#' @param adviceType the advice type to fetch the name for
#' @param long whether to return the long name
#' @return string of the advice type, or NA by default
getAdviceTypeName <- function(adviceType, long = FALSE) {
  if(adviceType==adviceTypes$neutral)
    return(ifelse(long, 'neutral', 'Ntl'))
  if(adviceType==adviceTypes$AiC)
    return(ifelse(long,'Agree-in-confidence', 'AiC'))
  if(adviceType==adviceTypes$AiU)
    return(ifelse(long,'Agree-in-uncertainty', 'AiU'))
  return(ifelse(long, 'None', NA))
}

#   0.iii) Globals ####

# advice types: neutral, agree-in-confidence, and agree-in-uncertainty
adviceTypes <- list(neutral=0, AiC=3, AiU=4)
trialTypes <- list(catch=0, force=1, choice=2)
confidenceCategories <- list(low=0, medium=1, high=2)

# Advisor questionnaire dimensions
questionnaireDimensions <- list(accurate=1,
                                like=2,
                                trust=3,
                                influence=4)
# styling for ggplots
style <- theme_light() +
  theme(panel.grid.minor = element_blank(),
        panel.grid.major.x = element_blank(),
        legend.position = 'top')

# 1) Load data  ####

#   1.i) Load data ####

print('## Load Data ##################################################################')
if(exists('trials'))
  rm(trials)
if(exists('participants'))
  rm(participants)
if(exists('advisors'))
  rm(advisors)
if(exists('questionnaires'))
  rm(questionnaires)
folderName <- '../AdvisorChoice/data/processed/'
files <- list.files(folderName)
participants <- NULL
trials <- NULL
advisors <- NULL
questionnaires <- NULL
for (i in seq(length(files))) {
  fileName <- paste(folderName, files[[i]], sep='/')
  json <- readChar(fileName, file.info(fileName)$size)
  jsonData <- fromJSON(json, simplifyVector = T, simplifyMatrix = T, simplifyDataFrame = T)
  # store all columns in participants table except the three last 
  # (trials, advisors, and questionnaires are stored separately)
  # Patch for missing data in practice
  if(!('debriefComments' %in% names(jsonData)))
    jsonData <- c(list(debriefComments = 'NA'), jsonData)
  participants <- rbind(participants, as.data.frame(t(jsonData[1:(length(names(jsonData))-3)])))
  # store the trials in the trials table
  trials <- rbind(trials, jsonData$trials)
  advisors <- rbind(advisors, jsonData$advisors)
  questionnaires <- rbind(questionnaires, jsonData$questionnaires)
}
rm(jsonData, files, fileName, folderName, json)
  
#   1.ii) Calculate utility variables ####
print('> calculate utility variables')
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
# For convenience the long participant Id is shortened to a simple number:
participants$pid <- which(as.character(participants$id) == participants$id)
trials$pid <- sapply(trials$participantId, function(x)participants$pid[which(participants$id == x)])
questionnaires$pid <- sapply(questionnaires$participantId, function(x)participants$pid[which(participants$id == x)])
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

#   1.iii) Split off real trials ####
all.trials <- trials
trials <- trials[which(!trials$practice),]
all.questionnaires <- questionnaires
questionnaires <- questionnaires[which(questionnaires$adviceType!=0),]
all.advisors <- advisors
advisors <- advisors[which(advisors$adviceType!=0),]

# 2) Demographics ####

#MISSING!!!!####
print('## Demographics ###############################################################')
print('Skipping while we await demographic data collection framework')

# 3) Manipulation checks ####

print('## Manipulation checks ########################################################')

#   3.i) Overall agreement by contingency ####

# We need to check the advisors did what they were supposed to do, i.e. that the
# AiC advisors agreed more on confident trials, and the AiU advisors agreed more
# on unconfident trials. We'll do this using agreement rate as the outcome of an
# ANOVA, and plugging in confidence, correctness, and advice type as predictors.
# We should see no main effect of advice type, but an interaction between
# confidence and advice type. Correctness should have a strong main effect.
tmp <- aggregate(advisorAgrees ~ pid + confidenceCategory + adviceType + initialCorrect, data = trials, FUN = mean)
tmp.aov <- aov(advisorAgrees ~ confidenceCategory * adviceType * initialCorrect + 
             Error(pid / (confidenceCategory + adviceType + initialCorrect)), data = tmp)
summary(tmp.aov)

#   3.ii) Graph: overall agreement by contingency ####

w <- 0.8
ggplot(tmp, aes(y = advisorAgrees, x = as.factor(confidenceCategory), colour = as.factor(adviceType))) +
  stat_summary(geom = 'point', size = 3, fun.y = mean, position = position_dodge(w)) +
  stat_summary(geom = 'errorbar', fun.data = mean_cl_boot, position = position_dodge(w), size = 0.2) +
  geom_point(alpha = 0.5, position = position_dodge(w)) +
  facet_wrap(~initialCorrect, labeller = label_both) +
  scale_x_discrete(name = 'Confidence Category', labels = c('Low', 'Med', 'High')) +
  scale_color_discrete(name = 'Advice Type', labels = c('AiC', 'AiU')) +
  scale_y_continuous(name = 'Advisor Agreement') +
  labs(title = 'Observed agreement rate for each advisor by initial decision confidence and correctness') +
  style

#   3.iii) Initial block agreement by contingency ####

# Initial block is forced trials
tmp <- aggregate(advisorAgrees ~ pid + confidenceCategory + adviceType + initialCorrect, 
                 data = trials[trials$type==trialTypes$force, ], FUN = mean)
tmp.aov <- aov(advisorAgrees ~ confidenceCategory * adviceType * initialCorrect + 
                 Error(pid / (confidenceCategory + adviceType + initialCorrect)), data = tmp)
summary(tmp.aov)

#   3.iv) Graph: initial block agreement by contingency ####

ggplot(tmp, aes(y = advisorAgrees, x = as.factor(confidenceCategory), colour = as.factor(adviceType))) +
  stat_summary(geom = 'point', size = 3, fun.y = mean, position = position_dodge(w)) +
  stat_summary(geom = 'errorbar', fun.data = mean_cl_boot, position = position_dodge(w), size = 0.2) +
  geom_point(alpha = 0.5, position = position_dodge(w)) +
  facet_wrap(~initialCorrect, labeller = label_both) +
  scale_x_discrete(name = 'Confidence Category', labels = c('Low', 'Med', 'High')) +
  scale_color_discrete(name = 'Advice Type', labels = c('AiC', 'AiU')) +
  scale_y_continuous(name = 'Advisor Agreement') +
  labs(title = 'Observed agreement rate for each advisor by initial decision confidence and correctness\n on forced trials') +
  style

#   3.v) Trial count by contingency ####

# Let's also check we got appropriate numbers of trials in each of the bins for
# each participant
tmp <- aggregate(practice ~ 
                   pid + confidenceCategory + adviceType + initialCorrect + advisorAgrees, 
                 data = trials, FUN = length)

#   3.vi) Graph: trial count by contingency ####

ggplot(tmp, aes(y = practice, x = as.factor(confidenceCategory), 
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

# 4) Exclusions ####

print('## Running exclusions #########################################################')
# Exclusion rules:
# Proportion of correct initial judgements must be (.60 < cor1/n < .90) 
#NB:practice trials are INCLUDED in this since they are used in part for
#determining confidence calibration
participants$excluded <- sapply(participants$pid, function(pid){
  ts <- which(all.trials$pid == pid)
  # overall accuracy of initial decisions
  v <- all.trials$initialAnswer[ts] == all.trials$correctAnswer[ts]
  m <- mean(as.numeric(v), na.rm = T)
  if(m < .6 | m > .9)
    return('Accuracy')
  # varied use of confidence scale
  ts <- which(trials$pid == pid)
  cCs <- aggregate(pid ~ confidenceCategory, data = trials[ts, ], FUN = length)
  # All confidence categories must be used
  if(nrow(cCs) < 3)
    return ('Confidence')
  return(F)
  # TODO ####
  # Clarify the numbers on the rules below
  # Between 30 and 50% of trials must be medium confidence
  if(cCs$pid[cCs$confidenceCategory==confidenceCategories$medium] < length(ts)*.3 
     | cCs$pid[cCs$confidenceCategory==confidenceCategories$medium] > length(ts)*.5)
    return('Confidence.med')
  # Other categories must contain between 20 and 40% of trials
  cCs[cCs$confidenceCategory==confidenceCategories$medium, ] <- NULL
  if(any(cCs$pid < length(ts)*.2) | any(cCs$pid > length(ts)*.4))
    return('Confidence.hiLow')
  return(F)
  })
all.participants <- participants
participants <- participants[participants$excluded==F, ]
# Remove excluded participants' data from other data frames
trials <- trials[trials$pid %in% participants$pid, ]
advisors <- advisors[advisors$pid %in% participants$pid, ]
questionnaires <- questionnaires[questionnaires$pid %in% participants$pid, ]

# 5) Descriptives ####

#   5.i) Proportion correct ####
tmp <- NULL
for(col in c('initial', 'final')) {
  for(aT in adviceTypes) {
    colName <- paste0(col,'Correct')
    if(aT==adviceTypes$neutral)
      aT <- c(adviceTypes$AiC, adviceTypes$AiU) # hack for including the total
    x <- as.numeric(trials[trials$adviceType %in% aT, colName])
    m <- mean(x)
    cl <- mean_cl_normal <- mean_cl_normal(x)
    rn <- range(aggregate(trials[trials$adviceType %in% aT, c(colName,'pid','adviceType')], by = list(trials$pid[trials$adviceType %in% aT]), 
                          FUN = function(x){sum(as.numeric(x))/length(x)})[,colName])
    tmp <- rbind(tmp, data.frame(decision = col,
                                 adviceType = ifelse(length(aT)>1,'Total',getAdviceTypeName(aT)), # hack to label total
                                 target = ifelse(col=='initial',.71,NA),
                                 meanCorrect = m,
                                 cl95Min = cl$ymin,
                                 cl95Max = cl$ymax,
                                 rangeMin = rn[1],
                                 rangeMax = rn[2]))
  }
}
tmp[,-(1:2)] <- round(tmp[,-(1:2)],2)
print('Descriptives: judgement correctness')
tmp


#   5.ii) Agreement rate ####
tmp <- NULL
for(aT in adviceTypes) {
  if(aT==adviceTypes$neutral)
    next()
  ts <- trials[trials$adviceType==aT, ]
  for(i in 1:(length(confidenceCategories)+3)) {
    if(i <= length(confidenceCategories)) {
      x <- ts[ts$confidenceCategory==confidenceCategories[i], ]
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
    cl <- mean_cl_normal <- mean_cl_normal(as.numeric(x$advisorAgrees))
    rn <- range(aggregate(advisorAgrees ~ pid, data = x,
                          FUN = function(x){sum(as.numeric(x))/length(x)})$advisorAgrees)
    tmp <- rbind(tmp, data.frame(adviceType = getAdviceTypeName(aT), # hack to label totalname,
                                 name,
                                 probAgree = m,
                                 cl95Min = cl$ymin,
                                 cl95Max = cl$ymax,
                                 rangeMin = rn[1],
                                 rangeMax = rn[2]))
  }
}
tmp[,-(1:2)] <- round(tmp[,-(1:2)],2)
print('Descriptives: agreement rates')
tmp

#   5.iii) Mean confidence ####
tmp <- NULL
for(col in c('initial', 'final')) {
  for(correct in list(T,F,c(T,F))) {
    colName <- paste0(col,'Confidence')
    x <- trials[trials[,paste0(col,'Correct')] %in% correct, ]
    m <- mean(x[,colName])
    cl <- mean_cl_normal <- mean_cl_normal(x[,colName])
    rn <- range(aggregate(trials[trials[,paste0(col,'Correct')] %in% correct, c(colName,'pid','adviceType')], 
                          by = list(trials$pid[trials[,paste0(col,'Correct')] %in% correct]), 
                          FUN = function(x){sum(as.numeric(x))/length(x)})[,colName])
    tmp <- rbind(tmp, data.frame(decision = col,
                                 correct = ifelse(length(correct)>1,'Both',correct), # hack to label total
                                 meanCorrect = m,
                                 cl95Min = cl$ymin,
                                 cl95Max = cl$ymax,
                                 rangeMin = rn[1],
                                 rangeMax = rn[2]))
  }
}
tmp[,-(1:2)] <- round(tmp[,-(1:2)],2)
print('Descriptives: decision confidence')
tmp

# As above by dis/agreement and advice type
tmp <- NULL
for(agree in c(T,F)) {
  for(aT in adviceTypes) {
    if(aT==adviceTypes$neutral)
      aT <- c(adviceTypes$AiC, adviceTypes$AiU)
    x <- trials[trials$advisorAgrees & trials$adviceType %in% aT, ]
    m <- mean(x$finalConfidence)
    cl <- mean_cl_normal <- mean_cl_normal(x$finalConfidence)
    rn <- range(aggregate(finalConfidence ~ pid, data = x,
                          FUN = function(x){sum(as.numeric(x))/length(x)})$finalConfidence)
    tmp <- rbind(tmp, data.frame(agree,
                                 advisor = ifelse(length(aT)>1,'Both',getAdviceTypeName(aT)), # hack to label total
                                 meanCorrect = m,
                                 cl95Min = cl$ymin,
                                 cl95Max = cl$ymax,
                                 rangeMin = rn[1],
                                 rangeMax = rn[2]))
  }
}
tmp[,-(1:2)] <- round(tmp[,-(1:2)],2)
print('Descriptives: final decision confidence')
tmp

#   5.iv) Graph: Initial vs Final confidence ####

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
  x=c(-100, 0, 0),
  y=c(-100, -100, 100)
)
df.poly2 <- df.poly1 * -1
ggplot(trials, aes(x = initialConfSpan, y = finalConfSpan)) +
  geom_polygon(data = df.poly1, aes(x,y), fill = 'grey', alpha = 0.2) +
  geom_polygon(data = df.poly2, aes(x,y), fill = 'grey', alpha = 0.2) +
  geom_point(alpha = 0.2, aes(color = factor(finalCorrect))) +
  geom_abline(slope = 1, intercept = 0, linetype = 'dashed', size = 1, color = 'black') +
  scale_color_discrete(name = 'Final judgement', labels = c('Incorrect', 'Correct')) +
  scale_x_continuous(limits = c(-100,100), expand = c(0,0)) +
  scale_y_continuous(limits = c(-100,100), expand = c(0,0)) +
  facet_grid(~advisorAgrees, labeller = as_labeller(c('FALSE'='Disagree', 'TRUE'='Agree'))) +
  labs(title = "Initial vs final confidence",
       legend = NULL,
       x = 'Initial confidence',
       y = "Final confidence") +
  coord_fixed() +
  style + 
  theme(panel.spacing = unit(1.5, 'lines'),
        plot.margin = unit(c(0,1,0,0.5), 'lines'))

#   5.v) Questionnaire responses ####
tmp <- NULL
for(tp in unique(questionnaires$timepoint)) {
  for(colName in c('likeability', 'ability', 'benevolence')) {
    for(aT in adviceTypes) {
      if(aT == adviceTypes$neutral)
        next()
      x <- questionnaires[questionnaires$adviceType==aT & questionnaires$timepoint==tp, ]
      m <- mean(x[,colName])
      cl <- mean_cl_normal <- mean_cl_normal(x[,colName])
      rn <- range(aggregate(x[,c('pid',colName)], 
                            by = list(questionnaires$pid[questionnaires$adviceType==aT 
                                                         & questionnaires$timepoint==tp]), 
                            FUN = function(x){sum(as.numeric(x))/length(x)})[,colName])
      tmp <- rbind(tmp, data.frame(question = colName,
                                   adviceType = getAdviceTypeName(aT),
                                   meanCorrect = m,
                                   cl95Min = cl$ymin,
                                   cl95Max = cl$ymax,
                                   rangeMin = rn[1],
                                   rangeMax = rn[2]))
    }
  }
}
tmp[,-(1:2)] <- round(tmp[,-(1:2)],2)
print('Descriptives: questionnaire responses')
tmp

# 6) Is the AiC advisor selected more often? ####

print('## TEST Preferential selection for agree-in-confidence advisor? ###############')

#   6.i) Overall ####

# We want to know whether the advisor who agrees with the participant when the
# participant expresses higher confidence is selected more often by the
# participant when a choice is offered.
# 
# We will find this out by taking the number of times each participant selected
# the agree-in-confidence advisor and dividing by the total number of choice
# trials for that participant (should be the same for all participants). We can
# then take the mean of this proportion across participants and test it for
# significant versus the null hypothesis of random picking (0.5).
tmp <- aggregate(adviceType ~ pid, 
                 data = trials[trials$type==trialTypes$choice, ],
                 FUN = function(x)sum(x==adviceTypes$AiC)/length(x))
selection.test <- t.test(tmp$adviceType, mu=0.5)
selection.test.b <- ttestBF(tmp$adviceType, mu = 0.5)

print('>>(selection.test) choice proportion Agree-in-confidence vs. chance level (.5)')
prettyPrint(selection.test)
print('>>(selection.test.b) bayesian examination of above (prior = mean of 0.5, sd as empirically observed)')
print(selection.test.b)
print(paste0('Evidence strength for preferential AiC picking: BF=', round(exp(selection.test.b@bayesFactor$bf),3)))

#   6.ii) Medium-confidence trials ####

# And the same with mid-confidence trials only:
tmp <- aggregate(adviceType ~ pid, 
                 data = trials[trials$type==trialTypes$choice 
                               & trials$confidenceCategory==confidenceCategories$medium, ],
                 FUN = function(x)sum(x==adviceTypes$AiC)/length(x))
selection.med.test <- t.test(tmp$adviceType, mu=0.5)
selection.med.test.b <- ttestBF(tmp$adviceType, mu = 0.5)

print('>>(selection.med.test) choice proportion Agree-in-confidence vs. chance level (.5)')
prettyPrint(selection.med.test)
print('>>(selection.med.test.b) bayesian examination of above (prior = mean of 0.5, sd as empirically observed)')
print(selection.med.test.b)
print(paste0('Evidence strength for preferential AiC picking: BF=', round(exp(selection.med.test.b@bayesFactor$bf),3)))

#   6.iii) Graph: Advisor preference by confidence category ####

# Proportion of the time each participant picked the agree-in-confidence
# advisor. Connected points of a colour indicate data from a single participant,
# while the diamond indicates the mean proportion across all participants. The
# dashed reference line indicates picking both advisors equally, as would be
# expected by chance. Error bars give 95% bootstrapped confidence intervals.
tmp <- aggregate(adviceType ~ pid + confidenceCategory,
                 data = trials[trials$type==trialTypes$choice, ],
                 FUN = function(x)sum(x==adviceTypes$AiC)/length(x))
tmp.2 <- aggregate(adviceType ~ pid,
                   data = trials[trials$type == trialTypes$choice, ],
                   FUN = function(x)sum(x==adviceTypes$AiC)/length(x) )
ggplot(tmp, aes(x = factor(confidenceCategory), y = adviceType)) +
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
       y = "P(Agree-in-confidence advisor is chosen)") +
  style

# 7) ANOVA investigating influence ####

print('## ANOVA investigating influence ##############################################')

#   7.i) Adjusted influence, all trials ####

#Influence is defined as the extent to which the judge's (participant's) final
#decision has moved from their initial decision in the direction of the advice
#received.
# We begin by calculating influence for all trials and saving that information
# since it will come in handy for looking at influence on subsets of trials
# later. Below, we run an ANOVA using the influence data.

# 2x2x2 ANOVA investigating effects of advisor type
# (agree-in-confidence/uncertainty), choice (un/forced), and agreement
# (dis/agree) on influence. These are all within-subjects manipulations.
tmp <- aggregate(influence ~ adviceType + hasChoice + advisorAgrees + pid, data = trials, FUN = mean)
print('Running ANOVAs')
anova.AdviceTypexTrialTypexAgreement <- aov(influence ~ adviceType * hasChoice * advisorAgrees + 
                                              Error(pid / (adviceType + hasChoice + advisorAgrees)), 
                                            data=tmp)
print('>>(anova.AdviceTypexTrialTypexAgreement)')
print(summary(anova.AdviceTypexTrialTypexAgreement))


#   7.ii) Graph: Adjusted Advice influence, all trials ####

# Influence of advice under varied conditions. Points indicate mean values for a
# participant, while diamonds indicate the mean of participant means, with error
# bars specifying 95% confidence intervals.
tmp$adviceType <- factor(tmp$adviceType)
ggplot(tmp, aes(advisorAgrees, influence, color = adviceType, fill = adviceType)) +
  geom_point(position = position_jitter(w=0.1, h=0)) +
  stat_summary(geom = "errorbar",
               fun.data = "mean_cl_boot",
               width = 0.2) +
  stat_summary(geom = "point",
               fun.y = "mean",
               shape = 23, size = 5) +
  stat_summary(aes(group = adviceType), fun.y=mean, geom="line") + 
  facet_grid(.~hasChoice, 
             labeller = as_labeller(c('FALSE'='Forced trials','TRUE'='Choice trials'))) +
  scale_color_discrete(name = 'Advisor type', labels = c('Agree-in-confidence', 'Agree-in-uncertainty')) +
  scale_fill_discrete(name = 'Advisor type', labels = c('Agree-in-confidence', 'Agree-in-uncertainty')) +
  scale_x_discrete(name = 'Judge-advisor agreement', labels = c('Agree', 'Disagree')) +
  labs(title = "Advice Influence",
       legend = NULL,
       y = "Influence of the advice") +
  style
#   7.iii) Adjusted influence, medium-confidence trials ####

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
anova.AdviceTypexTrialTypexAgreement.70 <- aov(influence ~ adviceType * hasChoice * advisorAgrees + 
                                                 Error(pid / (adviceType + hasChoice + advisorAgrees)), 
                                               data=tmp)
print('>>(anova.AdviceTypexTrialTypexAgreement.70) Looking at only trials where intial decision was correct and made with middle confidence:')
print(summary(anova.AdviceTypexTrialTypexAgreement.70))

#   7.iv) Raw influence, all trials ####

# 2x2x2 ANOVA investigating effects of advisor type
# (agree-in-confidence/uncertainty), choice (un/forced), and agreement
# (dis/agree) on influence. These are all within-subjects manipulations.
tmp <- aggregate(rawInfluence ~ adviceType + hasChoice + advisorAgrees + pid, data = trials, FUN = mean)
print('Running ANOVAs')
anova.AdviceTypexTrialTypexAgreement <- aov(rawInfluence ~ adviceType * hasChoice * advisorAgrees + 
                                              Error(pid / (adviceType + hasChoice + advisorAgrees)), 
                                            data=tmp)
print('>>(anova.AdviceTypexTrialTypexAgreement)')
print(summary(anova.AdviceTypexTrialTypexAgreement))

# 8) Trust questionnaire answers ####

#   8.i) Multivariate hierachical multiple regression ####

#     8.i.a) Control model ####
#MISSING!!!!####

#     8.i.b) Advice type ####
#MISSING!!!!####

#   8.ii) Graph: Pro/retrospective assessments by advice type and dimension ####

# TODO ####
# tidy the hell out of this graph. Should allow easy discrimination
# between advice type assessment changes over time.
tmp <- aggregate(cbind(likeability, ability, benevolence) ~ adviceType + timepoint + pid, 
                 data = questionnaires, FUN = mean)
tmp <- melt(tmp, id.vars = c('adviceType', 'timepoint', 'pid'))
ggplot(tmp, aes(x = variable, y = value, colour = as.factor(timepoint))) +
  geom_boxplot() +
  scale_y_continuous(limits = c(0,100)) +
  facet_grid(~ adviceType) + 
  style

# 9) Do participants simply prefer agreement? ####

print('## Do participants simply prefer agreement? ###################################')

#   9.i) Pick rate in low- vs high-confidence trials ####

# If so, we should see that participants preferentially pick agree-in-confidence
# advisor when their initial confidence is high, and agreee-in-uncertainty when
# their initial confidence is low. We can t-test aic pick proportion in
# high-confidence vs aic pick proportion in low-confidence.
tmp <- aggregate(adviceType ~ pid + confidenceCategory,
                 data = trials[trials$type==trialTypes$choice, ],
                 FUN = function(x)sum(x==adviceTypes$AiC)/length(x))
t.test(tmp$adviceType[tmp$confidenceCategory==confidenceCategories$low],
       tmp$adviceType[tmp$confidenceCategory==confidenceCategories$high],
       paired = T)
ttestBF(tmp$adviceType[tmp$confidenceCategory==confidenceCategories$low],
        tmp$adviceType[tmp$confidenceCategory==confidenceCategories$high],
        paired = T)

# 10) Subjective-objective correlation ####

#   10.i) Questionnaire-influence correlation ####
#MISSING!!!!####

#   10.ii) Graph: Questionnaire-influence correlation ####
#MISSING!!!!####
