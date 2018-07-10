## Analysis script for AdvisorChoice web data ##############################################
# Matt Jaquiery, March 2018 (matt.jaquiery@psy.ox.ac.uk)
#
# 0) Support
#   i) Libraries
#   ii) Functions
#   iii) Globals
# 1) Load data 
# 2) Demographics
# 3) Manipulation checks
# 4) Is the agree-in-confidence advisor selected more often?
# 5) ANOVA investigating influence
# 6) Trust questionnaire answers
#   i) Trust for each advisor
# 7) Do participants simply prefer agreement?
#

## 0) Support
##  i) Libraries
if(!require(jsonlite)) {
  install.packages("jsonlite")
  library(jsonlite)
}
  
if(!require(BayesFactor)) {
  install.packages('BayesFactor')
  library(BayesFactor)
}

##  ii) Functions
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
# Return a vector of confidence shifts for trial list t
getConfidenceShift <- function (t, forceRecalculate = FALSE) {
  # shortcut if we already calculated this
  if('confidenceShift' %in% colnames(t) && !forceRecalculate)
    return(t$confidenceShift)
  out <- vector(length=dim(t)[1])
  for (i in seq(length(out))) {
    if (is.na(t$finalConfidence[i])) { # no advisor
      out[i] <- NA
    } else {
      if(t$initialAnswer[i]==t$finalAnswer[i])
      out[i] <- t$finalConfidence[i]-t$initialConfidence[i] # same side
    else
      out[i] <- t$finalConfidence[i]+t$initialConfidence[i] # switched sliders, so went to 0 on the first one
    }
  }
  return(out)
}
# Return a vector of influence for trial list t
getInfluence <- function (t, forceRecalculate = FALSE) {
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
        out[i] <- getConfidenceShift(t[i,]) # agrees and answer stays the same
      else
        out[i] <- -1 * getConfidenceShift(t[i,]) # agrees but answer switches
      } else {
        if(t$initialAnswer[i]==t$finalAnswer[i]) 
          out[i] <- -1 * getConfidenceShift(t[i,]) # disagrees but answer stays the same
        else
          out[i] <- getConfidenceShift(t[i,]) # disagrees and answer switches    
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

##  iii) globals
# advice types: neutral, agree-in-confidence, and agree-in-uncertainty
adviceTypes <- list(neutral=0, AiC=1, AiU=2)
trialTypes <- list(catch=0, force=1, choice=2)
confidenceCategories <- list(low=0, medium=1, high=2)

## 1) Load data ####
print('## 1) Load Data ##################################################################')
if(exists('trials'))
  rm(trials)
if(exists('participants'))
  rm(participants)
if(exists('advisors'))
  rm(advisors)
if(exists('questionnaires'))
  rm(questionnaires)
folderName <- 'F:/www/vhosts/localhost/ExploringSocialMetacognition/data/raw/'
files <- list.files(folderName)
for (i in seq(length(files))) {
  fileName <- paste(folderName, files[[i]], sep='/')
  json <- readChar(fileName, file.info(fileName)$size)
  jsonData <- fromJSON(json, simplifyVector = T, simplifyMatrix = T, simplifyDataFrame = T)
  # store all columns in participants table except the three last 
  # (trials, advisors, and questionnaires are stored separately)
  if(!exists('participants'))
    participants <- as.data.frame(t(jsonData[1:(length(names(jsonData))-3)]))
  else
    participants <- rbind(participants, as.data.frame(t(jsonData[1:(length(names(jsonData))-3)])))
  # store the trials in the trials table
  if(!exists('trials'))
    trials <- jsonData$trials
  else
    trials <- rbind(trials, jsonData$trials)
  if(!exists('advisors'))
    advisors <- jsonData$advisors
  else
    advisors <- rbind(advisors, jsonData$advisors)
  if(!exists('questionnaires'))
    questionnaires <- jsonData$questionnaires
  else
    questionnaires <- rbind(questionnaires, jsonData$questionnaires)
}
rm(jsonData, files, fileName, folderName, json)
  
# calculate utility variables
print('> calculate utility variables')
trials$adviceType <- getAdviceType(trials, participants, advisors) # adviceType > trials table
trials$confidenceShift <- getConfidenceShift(trials) #  amount the confidence changes
trials$influence <- getInfluence(trials) # amount the confidence changes in the direction of the advice
# adviceType > questionnaire table
aT <- vector(length = dim(questionnaires)[1]) 
for (i in 1:dim(questionnaires)[1]) {
  aT[[i]] <- getAdviceTypeById(questionnaires$advisorId[i], questionnaires$participantId[i], advisors)
}
questionnaires$adviceType <- aT
# questionnaire timepoint (unify afterTrial across different participants; should be the same, but whatever)
timepoints <- vector(length = dim(questionnaires)[1])
for (i in 1:dim(questionnaires)[1]) {
  myQs <- questionnaires[which(questionnaires$participantId==questionnaires$participantId[i]),]
  timepoints[i] <- which(unique(myQs$afterTrial)==questionnaires$afterTrial[i])
}
questionnaires$timepoint <- timepoints

# split by practice/real
all.trials <- trials
trials <- trials[which(!trials$practice),]
all.questionnaires <- questionnaires
questionnaires <- questionnaires[which(questionnaires$adviceType!=0),]
all.advisors <- advisors
advisors <- advisors[which(advisors$adviceType!=0),]


## 2) Demographics ####
print('## 2) Demographics ###############################################################')
print('Skipping while we await demographic data collection framework')


## 3) Manipulation checks ####
print('## 3) Manipulation checks ########################################################')


## 4) Is the agree-in-confidence advisor selected more often? ####
print('## 4) TEST Preferential selection for agree-in-confidence advisor? ###############')

#We want to know whether the advisor who agrees with the participant when the
#participant expresses higher confidence is selected more often by the
#participant when a choice is offered.
#
#We will find this out by taking the number of times each participant selected
#the agree-in-confidence advisor and dividing by the total number of choice
#trials for that participant (should be the same for all participants). We can
#then take the mean of this proportion across participants and test it for
#significant versus the null hypothesis of random picking (0.5).

selection <- data.frame(N=integer(), 
                        AiC=double(), 
                        AiU=double(),
                        N.low=integer(),
                        AiC.low=double(),
                        AiU.low=double(),
                        N.med=integer(),
                        AiC.med=double(),
                        AiU.med=double(),
                        N.high=integer(),
                        AiC.high=double(),
                        AiU.high=double())
for(p in seq(dim(participants)[1])) {
  # participant's trials
  t <- trials[which(trials$participantId==participants$id[p]),]
  # ...which had a choice
  t <- t[which(t$type==trialTypes$choice),]
  # and also store those with middling confidence (i.e. where advisors are equivalent)
  t.low <- t[which(t$confidenceCategory==confidenceCategories$low),]
  t.med <- t[which(t$confidenceCategory==confidenceCategories$medium),]
  t.high <- t[which(t$confidenceCategory==confidenceCategories$high),]
  # Find proportion of these which selected agree-in-confidence
  aicAdvisorId <- getAdvisorIdByType(participants$id[p], adviceTypes$AiC, advisors)
  aiuAdvisorId <- getAdvisorIdByType(participants$id[p], adviceTypes$AiU, advisors)
  selection <- rbind(selection, data.frame(N=dim(t)[1], 
                                           AiC=length(which(t$advisorId==aicAdvisorId)), 
                                           AiU=length(which(t$advisorId==aiuAdvisorId)),
                                           N.low=dim(t.low)[1],
                                           AiC.low=length(which(t.low$advisorId==aicAdvisorId)),
                                           AiU.low=length(which(t.low$advisorId==aiuAdvisorId)),
                                           N.med=dim(t.med)[1],
                                           AiC.med=length(which(t.med$advisorId==aicAdvisorId)),
                                           AiU.med=length(which(t.med$advisorId==aiuAdvisorId)),
                                           N.high=dim(t.high)[1],
                                           AiC.high=length(which(t.high$advisorId==aicAdvisorId)),
                                           AiU.high=length(which(t.high$advisorId==aiuAdvisorId))))
}
# Calculate proportions while guarding against div0 results:
selection$AiC.proportion <- findProportion(selection$AiC, selection$N)
selection$AiC.proportion.low <- findProportion(selection$AiC.low, selection$N.low)
selection$AiC.proportion.med <- findProportion(selection$AiC.med, selection$N.med)
selection$AiC.proportion.high <- findProportion(selection$AiC.high, selection$N.high)
print(paste0('AiC selection proportion mean = ',round(mean(selection$AiC.proportion),3), 
             ' sd(',round(sd(selection$AiC.proportion),3),')'))
print(paste0('Mid-confidence trials: AiC selection proportion mean = ',round(mean(selection.70$AiC.proportion),3), 
             ' sd(',round(sd(selection.70$AiC.proportion),3),')'))

selection.test <- t.test(selection$AiC.proportion, mu=0.5) # testing the proportions versus the null hypothesis of 0.5 (chance selection)
print('>>(selection.test) choice proportion Agree-in-confidence vs. chance level (.5)')
prettyPrint(selection.test)
print('>>(selection.test.b) bayesian examination of above (prior = mean of 0.5, sd as empirically observed)')
selection.test.b <- ttestBF(selection$AiC.proportion, mu = 0.5)
print(selection.test.b)
print(paste0('Evidence strength for preferential AiC picking: BF=', round(exp(selection.test.b@bayesFactor$bf),3)))

selection.70.test <- t.test(selection.70$AiC.proportion, mu=0.5) # testing the proportions versus the null hypothesis of 0.5 (chance selection)
print('>>(selection.70.test) choice proportion Agree-in-confidence vs. chance level (.5)')
prettyPrint(selection.70.test)
print('>>(selection.70.test.b) bayesian examination of above (prior = mean of 0.5, sd as empirically observed)')
selection.70.test.b <- ttestBF(selection.70$AiC.proportion, mu = 0.5)
print(selection.70.test.b)
print(paste0('Evidence strength for preferential AiC picking: BF=', round(exp(selection.70.test.b@bayesFactor$bf),3)))

## 5) ANOVA investigating influence ####
print('## 5) ANOVA investigating influence ##############################################')

#Influence is defined as the extent to which the judge's (participant's) final
#decision has moved from their initial decision in the direction of the advice
#received.
# We begin by calculating influence for all trials and saving that information
# since it will come in handy for looking at influence on subsets of trials
# later. Below, we run an ANOVA using the influence data.

# 2x2x2 ANOVA investigating effects of advisor type
# (agree-in-confidence/uncertainty), choice (un/forced), and agreement
# (dis/agree) on influence. These are all within-subjects manipulations.
print('Running ANOVAs')
anova.AdviceTypexTrialTypexAgreement <- aov(formula = influence ~ 
                                              adviceType * hasChoice * advisorAgrees + 
                                              Error(participantId), 
                                            data=trials)
print('>>(anova.AdviceTypexTrialTypexAgreement)')
print(summary(anova.AdviceTypexTrialTypexAgreement))

# The bias-sharing advisor and anti-bias advisors differ in their frequency with
# which they agree with the participant as a  function of participant confidence
# (by design). To control for background effects where people are influenced
# different amounts depending on their own initial confidence, we also look at
# only those trials where participant confidence was in the mid-range (i.e.
# where both advisors agree 70% of the time, and thus where agreement and
# confidence balance out). This subset only includes trials on which the
# participant was CORRECT. Where incorrect, advisors also agree equally often 
# (30% of the time), so these trials could be included. 
t.70 <- trials[which(trials$confidenceCategory==1),]
t.70 <- t.70[which(t.70$initialAnswer==t.70$correctAnswer),]
anova.AdviceTypexTrialTypexAgreement.70 <- aov(formula = influence ~ 
                                                 adviceType * hasChoice * advisorAgrees + 
                                                 Error(participantId), 
                                               data=t.70)
print('>>(anova.AdviceTypexTrialTypexAgreement.70) Looking at only trials where intial decision was correct and made with middle confidence:')
print(summary(anova.AdviceTypexTrialTypexAgreement.70))

## 6) Trust questionnaire answers ####
print('## 6) Trust questionnaire answers ##########################################################')
#   i. Trust for each advisor

# Questions:
# 1) Advisor accuracy
# 2) Advisor likeability
# 3) Advisor trustworthiness - not yet implemented
# 4) Advisor influence

# We can get a quick overview from an anova looking for main effect of advisor
# and interactions of timepoint and advice type
print('>>(trust.test) ANOVA exploring trust questionnaire responses')
trust.test <- aov(formula = likeability ~ adviceType * timeStart + Error(participantId),
                  data = questionnaires)
print(summary(trust.test))

# Could test the above with advisor accuracy rather than advice type?

# Were the advisors perceived differently to begin with?
questionnaires.t1 <- questionnaires[which(questionnaires$timepoint==1),]
questionnaires.t1.byAdv <- data.frame(pId=integer(), AiC=double(), AiU=double())
for(i in seq(length(unique(questionnaires.t1$participantId)))) {
  pId <- unique(questionnaires.t1$participantId)[i]
  t <- questionnaires.t1[which(questionnaires.t1$participantId==pId),]
  AiC <- t[which(t$adviceType==adviceTypes$AiC),"likeability"]
  AiU <- t[which(t$adviceType==adviceTypes$AiU),"likeability"]
  df <- data.frame(pId, AiC, AiU)
  questionnaires.t1.byAdv <- rbind(questionnaires.t1.byAdv, df)
}
#trust.test.t1 <- t.test(questionnaires.t1.byAdv$AiC, questionnaires.t1.byAdv$AiU)
print('>>(trust.test.t1) Testing whether advisors are trusted differentially at the beginning of the experiment')
print('>>Not run - minimal N')
#prettyPrint(trust.test.t1)
print('>>(trust.test.t1.b) bayesian examination of above')
trust.test.t1.b <- ttestBF(questionnaires.t1.byAdv$AiC, questionnaires.t1.byAdv$AiU)
print(trust.test.t1.b)
print(paste0('Evidence strength for higher AiC trust: BF=', round(exp(trust.test.t1.b@bayesFactor$bf),3)))

# Were they perceived differently at the end?
questionnaires.last <- questionnaires[which(questionnaires$timepoint==max(questionnaires$timepoint))]
questionnaires.last.byAdv <- data.frame(pId=integer(), AiC.like=integer(), AiU.like=integer());
for(i in seq(length(unique(questionnaires.t1$participantId)))) {
  pId <- unique(questionnaires.t1$participantId)[i]
  t <- questionnaires.t1[which(questionnaires.t1$participantId==pId),]
  AiC.like <- t[which(t$adviceType==adviceTypes$AiC),"likeability"]
  AiU.like <- t[which(t$adviceType==adviceTypes$AiU),"likeability"]
  df <- data.frame(pId, AiC.like, AiU.like)
  questionnaires.last.byAdv <- rbind(questionnaires.last.byAdv, df)
}
#trust.test.last <- t.test(questionnaires.last.byAdv$AiC, questionnaires.last.byAdv$AiU)
print('>>(trust.test.last) Testing whether advisors are trusted differentially at the beginning of the experiment')
print('>>Not run - minimal N')
#prettyPrint(trust.test.last)
print('>>(trust.test.last.b) bayesian examination of above')
trust.test.last.b <- ttestBF(questionnaires.last.byAdv$AiC, questionnaires.last.byAdv$AiU)
print(trust.test.last.b)
print(paste0('Evidence strength for higher AiC trust: BF=', round(exp(trust.test.last.b@bayesFactor$bf),3)))


## 7) Do participants simply prefer agreement? ####
print('## 7) Do participants simply prefer agreement? ###################################')

# If so, we should see that participants preferentially pick agree-in-confidence
# advisor when their initial confidence is high, and agreee-in-uncertainty when
# their initial confidence is low. We can t-test aic pick proportion in
# high-confidence vs aic pick proportion in low-confidence.

aic.byConf.test <- t.test(selection$AiC.proportion.low, y=selection$AiC.proportion.high) # do selection proportions differ by initial confidence?
print('>>(aic.byConf.test) choice proportion Agree-in-confidence in low vs. high inital confidence')
prettyPrint(aic.byConf.test)
print('>>(aic.byConf.test.b) bayesian examination of above (prior = mean of 0.5, sd as empirically observed)')
aic.byConf.test.b <- ttestBF(selection$AiC.proportion.low, y=selection$AiC.proportion.high)
print(aic.byConf.test.b)
print(paste0('Evidence strength for differential AiC picking: BF=', round(exp(aic_test_b@bayesFactor$bf),3)))
