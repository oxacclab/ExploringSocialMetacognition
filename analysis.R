## Analysis script for AdvisorChoice web data ##############################################
# Matt Jaquiery, March 2018 (matt.jaquiery@psy.ox.ac.uk)
#
# 0) Support
#   i) Libraries
#   ii) Functions
#   iii) Globals
# 1) Load data
# 2) Demographics
# 3) Is the agree-in-confidence advisor selected more often?
# 4) ANOVA investigating influence
# 5) Trust questionnaire answers
#   i) Trust for each advisor
# 6) Do participants simply prefer agreement?
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
  if (dim(t)[1]<=1)
    out <- list()
  else
    out <- vector(length=dim(t)[1])
  for (i in seq(length(out))) {
    pid <- t$participantId[i]
    out[i] <- getAdviceTypeById(t$advisorId[i], pid, advisor.data.frame)
  }
  return(out)
}
# Return a vector of confidence shifts for trial list t
getConfidenceShift <- function (t, forceRecalculate = FALSE) {
  # shortcut if we already calculated this
  if('confidenceShift' %in% colnames(t) && !forceRecalculate)
    return(t$confidenceShift)
  if (dim(t)[1]<=1)
    out <- list()
  else
    out <- vector(length=dim(t)[1])
  for (i in seq(length(out))) {
    if(t$initialAnswer[i]==t$finalAnswer[i])
      out[i] <- t$finalConfidence[i]-t$initialConfidence[i] # same side
    else
      out[i] <- t$finalConfidence[i]+t$initialConfidence[i] # switched sliders, so went to 0 on the first one
  }
  return(out)
}
# Return a vector of influence for trial list t
getInfluence <- function (t, forceRecalculate = FALSE) {
  # shortcut if we already calculated this
  if('influence' %in% colnames(t) && !forceRecalculate)
    return(t$influence)
  if (dim(t)[1]<=1)
    out <- list()
  else
    out <- vector(length=dim(t)[1])
  for (i in seq(length(out))) {
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
  return(out)
}

##  iii) globals
# advice types: neutral, agree-in-confidence, and agree-in-uncertainty
adviceTypes <- list(neutral=0, AiC=1, AiU=2)
trialTypes <- list(catch=0, force=1, choice=2)
confidenceCategories <- list(low=0, medium=1, high=2)

## 1) Load data
if(exists('trials'))
  rm(trials)
if(exists('participants'))
  rm(participants)
if(exists('advisors'))
  rm(advisors)
if(exists('questionnaires'))
  rm(questionnaires)
folderName <- 'F:/www/vhosts/localhost/ExploringSocialMetacognition/data/processed/'
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
  
all.trials <- trials
trials <- trials[which(!trials$practice),]


## 2) Demographics
print('## 2) Demographics ###############################################################')
print('Skipping while we await demographic data collection framework')

## 3) Is the agree-in-confidence advisor selected more often?
print('## 3) TEST Preferential selection for agree-in-confidence advisor? ###############')

#We want to know whether the advisor who agrees with the participant when the
#participant expresses higher confidence is selected more often by the
#participant when a choice is offered.
#
#We will find this out by taking the number of times each participant selected
#the agree-in-confidence advisor and dividing by the total number of choice
#trials for that participant (should be the same for all participants). We can
#then take the mean of this proportion across participants and test it for
#significant versus the null hypothesis of random picking (0.5).

selection <- data.frame(N=integer(), AiC=integer(), AiU=integer())
selection.70 <- selection
for(p in seq(dim(participants)[1])) {
  # participant's trials
  t <- trials[which(trials$participantId==participants$id[p]),]
  # ...which had a choice
  t <- t[which(t$type==trialTypes$choice),]
  # and also store those with middling confidence (i.e. where advisors are equivalent)
  t.70 <- t[which(t$confidenceCategory==confidenceCategories$medium),]
  # Find proportion of these which selected agree-in-confidence
  aicAdvisorId <- getAdvisorIdByType(participants$id[p], adviceTypes$AiC, advisors)
  aiuAdvisorId <- getAdvisorIdByType(participants$id[p], adviceTypes$AiU, advisors)
  selection <- rbind(selection, data.frame(N=dim(t)[1], 
                                           AiC=length(which(t$advisorId==aicAdvisorId)), 
                                           AiU=length(which(t$advisorId==aiuAdvisorId))))
  selection.70 <- rbind(selection, data.frame(N=dim(t.70)[1], 
                                           AiC=length(which(t.70$advisorId==aicAdvisorId)), 
                                           AiU=length(which(t.70$advisorId==aiuAdvisorId))))
}
selection$AiC.proportion <- selection$AiC/selection$N
selection.70$AiC.proportion <- selection.70$AiC/selection.70$N
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

## 4) ANOVA investigating influence
print('## 4) ANOVA investigating influence ##############################################')

#Influence is defined as the extent to which the judge's (participant's) final
#decision has moved from their initial decision in the direction of the advice
#received.
# We begin by calculating influence for all trials and saving that information
# since it will come in handy for looking at influence on subsets of trials
# later. Below, we run an ANOVA using the influence data.

print('Calculating influence on each trial')
     
trials$adviceType <- getAdviceType(trials, participants, advisors)
trials$confidenceShift <- getConfidenceShift(trials) #  amount the confidence changes
trials$influence <- getInfluence(trials) # amount the confidence changes in the direction of the advice

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

## 5) Trust questionnaire answers
##   i) Trust for each advisor
## 6) Do participants simply prefer agreement?
