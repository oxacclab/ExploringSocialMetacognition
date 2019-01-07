
# Simulate experiment data ------------------------------------------------

#' simulates data for the Advisor Choice experiments. Not designed to be
#' structurally compatible with real data, but designed to be analysed
#' similarly.
#' @param nParticipants number of participants to simulate data for
#' @param aPairs list of advisor pairs to simulate for each participant. Uses
#'   all defined odd-even pairs in \code{adviceTypes} if NA.
#' @param tTypes trial types to simulate for each participant-advisor pair
#'   combo. Uses all defined \code{trialTypes} if NA.
#' @param nTrials number of trials to simulate for each participant-advisor pair
#'   combo
#' @param adviceClasses classes of the advisors (i.e. whether they're represented by arrows or usernames)
#' @param silent whether to suppress all output
#'
#' @note For convenience, all advisors are assumed to have an ID which
#'   corresponds to their adviceType. This may be changed later, but beware that
#'   confusions between these properties in the analysis scripts will not show
#'   up using simulated data.
#'
#'   Relatedly, there is no support for simulating multiple pairs of advisors
#'   with different identities but the same advice types.
#'
#'   Also, all agents use the confidence scale appropriately, which real people
#'   don't do.
#'
#'   Confidence categories are drawn from all trial, not just correct ones.
#'
#'   Disagreement adjustment is drawn from a constant distribution (mean doesn't
#'   vary by participant)
simulateAdvisorChoice <- function(nParticipants, aPairs = NA, tTypes = NA, nTrials = 60, 
                                  adviceClasses = c('Advisor', 'Cue'), silent = F) {
  
  if(is.na(aPairs))
    aPairs <- list('meta' = c(3,4), 'acc' = c(5,6), 'agr' = c(7,8))
  if(is.na(tTypes))
    tTypes <- trialTypes
  
  tStart <- Sys.time()
  if(!silent) {
    print('##--- Simulating Advisor Choice data ---##')
    print(paste('Simulating', length(tTypes) * length(aPairs) * nTrials * nParticipants, 
                'trials from', nParticipants, 'participants.'))
  }
  
  participants <- NULL
  genTrustQ <- NULL
  advisors <- NULL
  questionnaires <- NULL
  trials <- NULL
  behaviours <- NULL
  for(pid in 1:nParticipants) {
    tId <- 0
    block <- 0
    # generate participant behaviour from normal distributions around the population values
    behaviour <- data.frame(pid,
                            adviceType = populationPickRate$adviceType,
                            pickRateMean = sapply(1:nrow(populationPickRate),
                                                  function(i) rnorm(1,
                                                                    populationPickRate$pickRateMean[i],
                                                                    populationPickRate$pickRateSD[i])),
                            influenceMean = sapply(1:nrow(populationPickRate),
                                                   function(i) rnorm(1,
                                                                     populationPickRate$influenceMean[i],
                                                                     populationPickRate$influenceSD[i])),
                            influenceSD = sapply(1:nrow(populationPickRate),
                                                 function(i) rnorm(1, populationPickRate$influenceSD[i])),
                            advisorClass = populationPickRate$advisorClass)
    
    # participant and generalised trust data
    participants <- rbind(participants, simulateParticipant(pid))
    genTrustQ <- rbind(genTrustQ, simulateGenTrustQ(pid))
    
    for(aC in adviceClasses) {
      for(pair in aPairs) {
        # advisors and questionnaires data
        advisors <- rbind(advisors, simulateAdvisor(pid, pair, aC))
        questionnaires <- rbind(questionnaires, simulateQuestionnaire(pid, pair, aC))
        for(type in tTypes) {
          block <- block + 1
          for(i in 1:nTrials) {
            # trials data
            trials <- rbind(trials, simulateTrial(pid, tId, block, type, pair, pair[(i%%2)+1], 
                                                  behaviour[behaviour$advisorClass == aC, ],
                                                  trials$initialConfidence[trials$pid == pid]))
            tId <- tId + 1
          }
        }
      }
    }
    
    behaviours <- rbind(behaviours, behaviour)
  }
  
  tEnd <- Sys.time()
  if(!silent) {
    print(paste0('##--- Completed in ', round(tEnd-tStart, 2), 's ---##'))
  }
  
  return(list(participants = participants, 
              all.trials = trials,
              trials = trials, 
              advisors = advisors,
              questionnaires = questionnaires,
              genTrustQ = genTrustQ,
              behaviours = behaviours))
}

#' Returns a data frame of simulated data for a participant
#' @param pid participant ID
simulateParticipant <- function(pid) {
  theTime <- as.numeric(Sys.time())*1000
  return(data.frame(pid, blockCount = NA, catchPerBlock = NA, forcePerBlock = NA, 
                    practiceCatchPerBlock = NA, practiceForcePerBlock = NA, 
                    practiceChoicePerBlock = NA, difficultyStep = NA, dotCount = 200, 
                    preTrialInterval = NA, preStimulusInterval = NA, stimulusDuration = NA, 
                    feedbackDuration = NA, timeStart = theTime, timeEnd = theTime, experimentDuration = 0, 
                    manipulationQuestion = "I'm a bot", debriefComments = NA))
}

#' Returns a data frame of simulated generalised trust questionnaire responses
#' @param pid participant ID
simulateGenTrustQ <- function(pid) {
  if(length(pid) > 1) {
    out <- NULL
    for(p in pid)
      out <- rbind(out, simulateGenTrustQ(p))
    return(out)
  }
  theTime <- as.numeric(Sys.time())*1000
  baseAnswer <- runif(1, max = 100)
  genTrust <- NULL
  for(q in 1:6) {
    answer <- rnorm(1, baseAnswer, 5)
    answer <- round(max(100, min(0, answer)))
    genTrust <- rbind(genTrust, data.frame(order = q-1, answer, prompt = paste('testQ', q), 
                                           lastChangedTime = theTime))
  }
  genTrust <- cbind(data.frame(pid, timeStart = theTime, timeResponseStart = theTime, 
                               timeEnd = theTime, duration = 0),
                    genTrust)
  return(genTrust)
}

#' Return a data frame of simulated advisor data
#' @param pid participant ID
#' @param advisor advisor advice Type (also functions as ID)
#' @param advisorClass advisor's JavaScript class which indicates if it's represented as a cue or advisor
simulateAdvisor <- function(pid, advisor, advisorClass) {
  if(length(pid) > 1) {
    out <- NULL
    for(i in 1:length(pid))
      out <- rbind(out, simulateAdvisor(pid[i], advisor[i]))
    return(out)
  }
  if(length(advisor) > 1) {
    out <- NULL
    for(a in advisor)
      out <- rbind(out, simulateAdvisor(pid, a))
    return(out)
  }
  
  return(data.frame(pid, id = advisor, adviceType = advisor,
                    name = 'NA', portraitSrc = NA, voiceId = NA, 
                    styleClass = NA, advisorClass))
}

#' Return a data frame of simulated questionnaire data
#' @param pid participant ID
#' @param advisor advisor advice Type (also functions as ID)
#' @param advisorClass advisor's JavaScript class which indicates if it's represented as a cue or advisor
simulateQuestionnaire <- function(pid, advisor, advisorClass) {
  if(length(pid) > 1) {
    out <- NULL
    for(i in 1:length(pid))
      out <- rbind(out, simulateAdvisor(pid[i], advisor[i]))
    return(out)
  }
  if(length(advisor) > 1) {
    out <- NULL
    for(a in advisor)
      out <- rbind(out, simulateAdvisor(pid, a))
    return(out)
  }
  
  theTime <- as.numeric(Sys.time())*1000
  return(data.frame(pid, advisorId = advisor, afterTrial = advisor,
                    timeStart = theTime, timeResponseStart = theTime, 
                    timeEnd = theTime, duration = 0, 
                    ability = round(runif(1, max = 100)),
                    likeability = round(runif(1, max = 100)),
                    benevolence= round(runif(1, max = 100))))
}

#' Returns a data frame of simulated data for a trial
#' @param pid participant id
#' @param tid trial id
#' @param block trial block
#' @param type of trial
#' @param pair of advisors
#' @param defaultAdvisor the advisor offered by the experiment on forced and change trials
#' @param pickRateMean the mean pick rate for the participant on this trial type
#' @param prevConf previous confidence rating given by this participant (used for confidenceCategory)
simulateTrial <- function(pid, tid, block, type, pair, defaultAdvisor, participantBehaviour, prevConf) {
  disagreeBuffMean <- 1.25
  disagreeBuffSD <- 0.1
  # pre-trial values
  ans <- runif(1) < .5
  theTime <- as.numeric(Sys.time())*1000
  out <- data.frame(pid, id = tid, block, practice = F, type, typeName = getTrialTypeName(type),
                    dotDifference = 10, correctAnswer = ans, initialAnswer = NA,
                    finalAnswer = NA, initialConfidence = NA, finalConfidence = NA,
                    confidenceCategory = NA, hasChoice = NA, choice0 = NA, choice1 = NA,
                    advisorId = NA, advisorAgrees = NA, adviceSide = NA, adviceString = "", 
                    advisor0id = NA, advisor0adviceSide = NA, advisor0agrees = NA, advisor0adviceString = "",
                    advisor1id = NA, advisor1adviceSide = NA, advisor1agrees = NA, advisor1adviceString = "",
                    defaultAdvisor = NA, feedback = F, warnings = "", timeInitialStart = theTime, 
                    timeInitialFixation = theTime, timeInitialStimOn = theTime, timeInitialStimOff = theTime, 
                    timeInitialResponse = theTime, durationAdvisorChoice = 10, durationAdviceDuration = 10, 
                    timeFinalStart = theTime, timeFinalFixation = theTime, timeFinalStimOn = theTime, 
                    timeFinalStimOff = theTime, timeFinalResponse = theTime)
  
  # initial decision
  iCorrect <- runif(1) < .71
  if(iCorrect) out$initialAnswer <- ans
  else out$initialAnswer <- 1 - ans
  out$initialConfidence <- rnorm(1, 25, 10)
  out$initialConfidence <- round(max(1, min(50, out$initialConfidence)))
  out$confidenceCategory <- getConfCat(out$initialConfidence, prevConf)
  
  # advice and final decision
  if(type == trialTypes$catch)
    return(out)
  
  if(type == trialTypes$dual) {
    # dual trials are different because multiple influence sources need considering
    if(runif(1) < .5) {
      out$advisor0id <- pair[1]
      out$advisor1id <- pair[2]
    } else {
      out$advisor0id <- pair[2]
      out$advisor1id <- pair[1]
    }
    influence <- 0
    for(a in 0:1) {
      prefix <- paste0('advisor', a)
      out[ , paste0(prefix, 'adviceSide')] <- getAdvice(out[ , paste0(prefix, 'id')], out$initialAnswer, 
                                                        out$correctAnswer, out$confidenceCategory)
      out[ , paste0(prefix, 'agrees')] <- out[ , paste0(prefix, 'adviceSide')] == out$initialAnswer
      advisorInfluence <- rnorm(1, 
                         participantBehaviour$influenceMean[participantBehaviour$adviceType 
                                                            == out[ , paste0(prefix, 'id')]], 
                         participantBehaviour$influenceSD[participantBehaviour$adviceType 
                                                          == out[ , paste0(prefix, 'id')]])
      if(!out[ , paste0(prefix, 'agrees')]) # increased influence on disagreement trials
        advisorInfluence <- -1 * advisorInfluence * rnorm(1, disagreeBuffMean, disagreeBuffSD) 
      influence <- influence + advisorInfluence
    }
  } else {
    if(type == trialTypes$force) {
      advisor <- defaultAdvisor
    }
    if(type == trialTypes$choice) {
      if(runif(1) < .5) {
        out$choice0 <- pair[1]
        out$choice1 <- pair[2]
      } else {
        out$choice0 <- pair[2]
        out$choice1 <- pair[1]
      }
      if(runif(1) < participantBehaviour$pickRateMean[participantBehaviour$adviceType == defaultAdvisor]) 
        advisor <- defaultAdvisor
      else advisor <- pair[pair != defaultAdvisor]
    }
    if(type == trialTypes$change) {
      out$defaultAdvisor <- defaultAdvisor
      if(runif(1) < .5) {
        out$advisor0id <- pair[1]
        out$advisor1id <- pair[2]
      } else {
        out$advisor0id <- pair[2]
        out$advisor1id <- pair[1]
      }
      if(runif(1) < participantBehaviour$pickRateMean[participantBehaviour$adviceType == defaultAdvisor]) 
        advisor <- defaultAdvisor
      else advisor <- pair[pair != defaultAdvisor]
    }

    # advice
    out$advisorId <- advisor
    out$adviceSide <- getAdvice(out$advisorId, out$initialAnswer, out$correctAnswer, out$confidenceCategory)
    out$advisorAgrees <- out$adviceSide == out$initialAnswer
    # influence
    influence <- rnorm(1, 
                       participantBehaviour$influenceMean[participantBehaviour$adviceType == out$advisorId], 
                       participantBehaviour$influenceSD[participantBehaviour$adviceType == out$advisorId])
    if(!out$advisorAgrees) # increased influence on disagreement trials
      influence <- -1 * influence * rnorm(1, disagreeBuffMean, disagreeBuffSD) 
  }

  # final Decision
  if(influence + out$initialConfidence < 1) {
    out$finalAnswer <- 1 - out$initialAnswer # changed mind
    out$finalConfidence <- -1 * (influence + out$initialConfidence)
  } else {
    out$finalAnswer <- out$initialAnswer
    out$finalConfidence <- out$initialConfidence + influence
  }
  out$finalConfidence <- round(max(1, min(50, out$finalConfidence)))
    
  return(out)
}

#' Return the confidence category of conf
#' @param conf confidence rating for current trial
#' @param prevConf vector of confidence ratings on previous trials
getConfCat <- function(conf, prevConf) {
  if(length(prevConf) < 2)
    return(confidenceCategories$medium)
  prevConf <- prevConf[order(prevConf)]
  low <- prevConf[round(length(prevConf)/3)]
  if(conf < low)
    return(confidenceCategories$low)
  med <- prevConf[round(length(prevConf)*2/3)]
  if(conf < med)
    return(confidenceCategories$medium)
  return(confidenceCategories$high)
}

#' Return the advisor's recommendation
#' @param adviceType of the advisor
#' @param initialAnswer from the participant
#' @param correctAnswer for the trial
#' @param confidenceCategory of the advisor 
getAdvice <- function(adviceType, initialAnswer = NA, correctAnswer = NA, confidenceCat = NA) {
  p <- runif(1)
  if(adviceType == adviceTypes$neutral) {
    if(initialAnswer != correctAnswer) {
      if(p < .3) return(initialAnswer)
      else return(1 - initialAnswer)
    }
    if(p < .7) return(correctAnswer)
    else return(1 - correctAnswer)
  }
  if(adviceType == adviceTypes$AiC) {
    if(initialAnswer != correctAnswer) {
      if(p < .3) return(initialAnswer)
      else return(1 - initialAnswer)
    }
    if(confidenceCat == confidenceCategories$low) {
      if(p < .5) return(initialAnswer)
      else return(1 - initialAnswer)
    }
    if(confidenceCat == confidenceCategories$medium) {
      if(p < .7) return(initialAnswer)
      else return(1 - initialAnswer)
    }
    if(confidenceCat == confidenceCategories$high) {
      if(p < .9) return(initialAnswer)
      else return(1 - initialAnswer)
    }
  }
  if(adviceType == adviceTypes$AiU) {
    if(initialAnswer != correctAnswer) {
      if(p < .3) return(initialAnswer)
      else return(1 - initialAnswer)
    }
    if(confidenceCat == confidenceCategories$low) {
      if(p < .9) return(initialAnswer)
      else return(1 - initialAnswer)
    }
    if(confidenceCat == confidenceCategories$medium) {
      if(p < .7) return(initialAnswer)
      else return(1 - initialAnswer)
    }
    if(confidenceCat == confidenceCategories$high) {
      if(p < .5) return(initialAnswer)
      else return(1 - initialAnswer)
    }
  }
  if(adviceType == adviceTypes$HighAcc) {
    if(p < .79) return(correctAnswer)
    else return(1 - correctAnswer)
  }
  if(adviceType == adviceTypes$LowAcc) {
    if(p < .60) return(correctAnswer)
    else return(1 - correctAnswer)
  }
  if(adviceType == adviceTypes$HighAgr) {
    if(initialAnswer == correctAnswer) {
      if(p < .83) return(initialAnswer)
      else return(1 - initialAnswer)
    }
    if(p < .62) return(initialAnswer)
    else return(1 - initialAnswer)
  }
  if(adviceType == adviceTypes$LowAgr) {
    if(initialAnswer == correctAnswer) {
      if(p < .66) return(initialAnswer)
      else return(1 - initialAnswer)
    }
    if(p < .16) return(initialAnswer)
    else return(1 - initialAnswer)
  }
  return(NA)
}

# Constants ---------------------------------------------------------------

populationPickRate <- data.frame(adviceType = unlist(adviceTypes), 
                                 pickRateMean = c(.5, .51, 1-.51, .57, 1-.57, .61, 1-.61),
                                 pickRateSD = .2,
                                 influenceMean = c(5, 10, 0, 15, 0, 20, -5),
                                 influenceSD = 5,
                                 advisorClass = "Advisor")
populationPickRate <- rbind(populationPickRate, 
                            data.frame(cbind(populationPickRate[ ,1:3], 
                                             influenceMean = round(populationPickRate$influenceMean * .8),
                                             influenceSD = populationPickRate$influenceSD,
                                             advisorClass = "Cue")))
