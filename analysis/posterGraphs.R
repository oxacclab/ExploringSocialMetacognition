# Graphs for poster ####
# matt.jaquiery@psy.ox.ac.uk
# 21/09/2018

library(ggplot2)
library(jsonlite)

# Styling ####
style <- theme_light() +
  theme(panel.grid.minor = element_blank(),
        panel.grid.major.x = element_blank(),
        legend.position = 'top')
style.long <- style + theme(legend.position = 'none')

# Load all data ####
print('Load data')
study <- list()
folderNames <- list()
studyNames <- c('accuracy', 'agreement', 'metacog')
# for(studyName in c('accuracy', 'agreement', 'metacogntion'))
#   folderNames[studyName] <- choose.dir(caption = paste('Folder for', studyName, 'experiment'))
folderNames <- list('accuracy' = "G:\\Documents\\University\\Google Drive\\Project Documents\\AdvisorChoice\\results\\Accuracy\\2018-09-17 120 practice trials\\processed",
                    'agreement' = "G:\\Documents\\University\\Google Drive\\Project Documents\\AdvisorChoice\\results\\Agreement\\processed",
                    'metacognition' = "G:\\Documents\\University\\Google Drive\\Project Documents\\AdvisorChoice\\results\\MetaCog\\2018-09-18 2c Fixed\\processed")
for(folderName in folderNames) {
  studyName <- 'unknown'
  for(name in studyNames) {
    if(grepl(name,folderName,ignore.case=T)) {
      studyName <- name
    }
  }
  print(paste('Processing study:',studyName))
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
  #rm(jsonData, files, fileName, folderName, json)
  
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
  
  print('Running exclusions')
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
    # All confidence categories must have at least 5% of the number of trials
    if(any(cCs$pid < length(ts)*.05))
      return('Confidence.cat')
    return(F)
  })
  # exclude on the basis of collecting too much data
  if(sum(participants$excluded == F) > 50) {
    tmp <- participants[participants$excluded == F, c('id', 'timeStart')]
    tmp <- tmp$id[order(tmp$timeStart)]
    tmp <- tmp[1:50]
    participants$excluded[!(participants$id %in% tmp)] <- 'Excess.data'
  }
  all.participants <- participants
  participants <- participants[participants$excluded==F, ]
  # Remove excluded participants' data from other data frames
  trials <- trials[trials$pid %in% participants$pid, ]
  advisors <- advisors[advisors$pid %in% participants$pid, ]
  questionnaires <- questionnaires[questionnaires$pid %in% participants$pid, ]
  all.genTrustQ <- genTrustQ
  genTrustQ <- genTrustQ[genTrustQ$pid %in% participants$pid, ]
  
  print('Storing study data')
  study[[studyName]] <- list()
  study[[studyName]][['trials']] <- trials
}
print('Data loading complete')

# Choice ####
trials <- study$accuracy$trials
tmp <- aggregate(adviceType ~ pid,
                 data = trials[trials$type == trialTypes$choice, ],
                 FUN = function(x)sum(x%%2)/length(x))
ggplot(tmp, aes(x = 0, y = adviceType)) +
  geom_hline(linetype = "dashed", color = "black", yintercept = .5, size = 1) +
  geom_point(position = position_jitter(w=0.5, h=0), alpha = .5) +
  stat_summary(geom = "errorbar", fun.data = "mean_cl_boot", width = 0, size = 1) +
  stat_summary(geom = "point", fun.y = "mean", shape = 23, fill = "black", size = 6) +
  scale_y_continuous(limits = c(0,1), expand = c(0.05,0)) +
  scale_x_continuous(expand = c(0,.2), name = '60% accuracte\nAdvisor', 
                   sec.axis = dup_axis(name = '80% accurate\nAdvisor')) +
  scale_color_discrete(name = 'Participant') +
  labs(y = "P(High Accuracy chosen)") +
  coord_flip() +
  theme_light() +
  theme(panel.grid = element_blank(),
        panel.border = element_blank(),
        axis.line = element_blank(),
        axis.text = element_blank(),
        axis.ticks = element_blank(),
        legend.position = 'top')

trials <- study$agreement$trials
tmp <- aggregate(adviceType ~ pid,
                 data = trials[trials$type == trialTypes$choice, ],
                 FUN = function(x)sum(x%%2)/length(x))
ggplot(tmp, aes(x = 0, y = adviceType)) +
  geom_hline(linetype = "dashed", color = "black", yintercept = .5, size = 1) +
  geom_violin() +
  geom_point(position = position_jitter(w=0.5, h=0), alpha = .5) +
  stat_summary(geom = "errorbar", fun.data = "mean_cl_boot", width = 0, size = 1) +
  stat_summary(geom = "point", fun.y = "mean", shape = 23, fill = "black", size = 6) +
  scale_y_continuous(limits = c(0,1), expand = c(0.05,0)) +
  scale_x_continuous(expand = c(0,.2), name = '52% agreement\nAdvisor', 
                     sec.axis = dup_axis(name = '77% agreement\nAdvisor')) +
  scale_color_discrete(name = 'Participant') +
  labs(y = "P(High Agreement chosen)") +
  coord_flip() +
  theme_light() +
  theme(panel.grid = element_blank(),
        panel.border = element_blank(),
        axis.line = element_blank(),
        axis.text = element_blank(),
        axis.ticks = element_blank(),
        legend.position = 'top')

trials <- study$metacog$trials
tmp <- aggregate(adviceType ~ pid,
                 data = trials[trials$type == trialTypes$choice, ],
                 FUN = function(x)sum(x%%2)/length(x))
ggplot(tmp, aes(x = 0, y = adviceType)) +
  geom_hline(linetype = "dashed", color = "black", yintercept = .5, size = 1) +
  geom_point(position = position_jitter(w=0.5, h=0), alpha = .5) +
  stat_summary(geom = "errorbar", fun.data = "mean_cl_boot", width = 0, size = 1) +
  stat_summary(geom = "point", fun.y = "mean", shape = 23, fill = "black", size = 6) +
  scale_y_continuous(limits = c(0,1), expand = c(0.05,0)) +
  scale_x_continuous(expand = c(0,.2), name = 'Anti-bias\nAdvisor', 
                     sec.axis = dup_axis(name = 'Bias-sharing\nAdvisor')) +
  scale_color_discrete(name = 'Participant') +
  labs(y = "P(Bias-sharing chosen)") +
  coord_flip() +
  theme_light() +
  theme(panel.grid = element_blank(),
        panel.border = element_blank(),
        axis.line = element_blank(),
        axis.text = element_blank(),
        axis.ticks = element_blank(),
        legend.position = 'top')

# Preference-influence correlation ####
tmp <- NULL
for(studyName in studyNames) {
  trials <- study[[studyName]]$trials
  for(pid in unique(trials$pid)) {
    tmp.2 <- trials[trials$type==trialTypes$choice & trials$pid==pid, ]
    tmp <- rbind(tmp, data.frame(studyName,
                                 pid,
                                 HighAgrPref=mean(tmp.2$adviceType%%2),
                                 InfluenceDiff=(sum(tmp.2$influence[tmp.2$adviceType%%2]) -
                                                  sum(tmp.2$influence[!tmp.2$adviceType%%2]))/nrow(tmp.2)))
  }
}


ggplot(tmp, aes(x = HighAgrPref, y = InfluenceDiff, colour = studyName, fill = studyName)) +
  geom_vline(linetype = "dashed", color = "black", xintercept = .5, size = 1) +
  geom_smooth(method = 'lm', alpha = .1) +
  geom_point(alpha = .25) +
  scale_colour_manual(name = 'Study', values = c('#002147', '#4A8EF2', '#5AA2AE')) +
  scale_fill_manual(name = 'Study', values = c('#002147', '#4A8EF2', '#5AA2AE')) +
  scale_x_continuous(name = 'Preference strength') +
  scale_y_continuous(name = 'Influence difference') +
  theme_light() +
  theme(panel.grid.major.x = element_blank(),
        panel.grid.minor = element_blank(),
        panel.border = element_blank(),
        axis.line = element_line(size = rel(1), colour = 'grey70'))
  

# Transfer report graph (forest plot) -------------------------------------

# Load the data from the first study
load("G:\\Documents\\University\\Programming\\nofeedback_trust_matt\\AdvisorChoice\\analysis\\aicPickRate_medConf.Rdata")
exp1 <- tmp
exp1$studyName <- 'exp1'

# prepare the data
tmp <- NULL
for(studyName in studyNames) {
  trials <- study[[studyName]]$trials
  for(pid in unique(trials$pid)) {
    tmp.2 <- trials[trials$type==trialTypes$choice 
                    & trials$pid==pid 
                    & trials$confidenceCategory == confidenceCategories$medium
                    & trials$initialCorrect == T, ]
    tmp <- rbind(tmp, data.frame(studyName,
                                 pid,
                                 A1Pref=mean(tmp.2$adviceType%%2)))
  }
}
tmp <- rbind(tmp, exp1)
allStudyNames <- c(unique(exp1$studyName), studyNames)

# calculate confidence intervals
tmp.CI <- NULL
for(studyName in allStudyNames) {
  cis <- mean_cl_normal(tmp$A1Pref[tmp$studyName==studyName])
  tmp.CI <- rbind(tmp.CI, data.frame(studyName,
                                     ymin = cis$ymin,
                                     ymax = cis$ymax))
}
tmp.CI$labelsL <- c( '1. Agree-in-Uncertainty', '3. Low Accuracy', '4. Low Agreement', '2. Agree-in-Uncertainty')
tmp.CI$labelsR <- c( 'Agree-in-Confidence', 'High Accuracy', 'High Agreement', 'Agree-in-Confidence')
  
ggplot(tmp, aes(x = A1Pref, y = studyName)) +
  geom_vline(linetype = 'dashed', xintercept = .5) +
  geom_point(alpha = 0.5, col = 'black',
             position = position_nudge(x = 0, y = -0.05)) +
  ggridges::geom_density_ridges(panel_scaling = F, scale = .5, 
                                col = NA, fill = '#2299DD', alpha = .75) +
  geom_segment(data = tmp.CI,
               aes(y = studyName, yend = studyName, 
                   x =ymin, xend = ymax),
               size = 1, colour = '#2299DD',
               position = position_nudge(x = 0, y = -0.2)) +
  geom_point(data = aggregate(A1Pref ~ studyName, tmp, mean), size = 4, shape = 18,
             position = position_nudge(x = 0, y = -0.2)) +
  scale_x_continuous(name = 'Pick rate', limits = c(-.5,1.5), expand = c(0,0),
                     breaks = seq(0,1,.5)) +
  scale_y_discrete(limits = c('agreement', 'accuracy', 'metacog', 'exp1')) +
  scale_fill_discrete(name = 'Experiment', labels = c('3', '4', '2', '1')) +
  # label hack
  geom_text(data = tmp.CI, aes(x = 0, label = labelsL), nudge_x = -.1, nudge_y = .15, hjust = 1) +
  geom_text(data = tmp.CI, aes(x = 1, label = labelsR), nudge_x = .1, nudge_y = .15, hjust = 0) +
  annotate(geom = 'rect', xmin = 0, xmax = 1, ymin = -Inf, ymax = Inf,
           alpha = .025, linetype = 'solid', col = 'black') +
  theme_light() +
  theme(panel.grid = element_blank(),
        panel.border = element_blank(),
        axis.line.x = element_line(),
        axis.text.y = element_blank(),
        axis.title.y = element_blank(),
        legend.position = 'top')

