
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
#' @param adviceClasses classes of the advisors (i.e. whether they're
#'   represented by arrows or usernames). Assigned randomly from the available
#'   options.
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
                                  advisorClasses = c('Advisor', 'Cue'), silent = F) {
  
  if(anyNA(aPairs))
    aPairs <- list('meta' = c(3,4), 'acc' = c(5,6), 'agr' = c(7,8))
  if(anyNA(tTypes))
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
                            advisorClass = populationPickRate$advisorClass,
                            calibration = min(max(rnorm(1, .71, .2), 0), 1),
                            bias = min(max(round(rnorm(1, 0, 3)), -10), 10),
                            volatility = min(max(rnorm(1, 3, 1), 0), 6))
    
    # bestween-subjects advisor class is assigned randomly
    behaviour <- behaviour[behaviour$advisorClass == 
                             advisorClasses[ceiling(runif(1, max = length(advisorClasses)))], ]
    
    # participant and generalised trust data
    participants <- rbind(participants, simulateParticipant(pid, behaviour$advisorClass[1]))
    genTrustQ <- rbind(genTrustQ, simulateGenTrustQ(pid))
    
    for(pair in aPairs) {
      # advisors and questionnaires data
      advisors <- rbind(advisors, simulateAdvisor(pid, pair, behaviour$advisorClass[1]))
      questionnaires <- rbind(questionnaires, simulateQuestionnaire(pid, pair, behaviour$advisorClass[1]))
      for(type in tTypes) {
        block <- block + 1
        for(i in 1:nTrials) {
          # trials data
          trials <- rbind(trials, simulateTrial(pid, tId, block, type, pair, pair[(runif(1) < .5)+1], 
                                                behaviour[behaviour$advisorClass == behaviour$advisorClass[1], ],
                                                trials$initialConfidence[trials$pid == pid]))
          tId <- tId + 1
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
#' @param advisorClass whether this participant saw Advisors or Cues
simulateParticipant <- function(pid, advisorClass) {
  theTime <- as.numeric(Sys.time())*1000
  return(data.frame(pid, blockCount = NA, catchPerBlock = NA, forcePerBlock = NA, 
                    practiceCatchPerBlock = NA, practiceForcePerBlock = NA, 
                    practiceChoicePerBlock = NA, difficultyStep = NA, dotCount = 200, 
                    preTrialInterval = NA, preStimulusInterval = NA, stimulusDuration = NA, 
                    feedbackDuration = NA, timeStart = theTime, timeEnd = theTime, experimentDuration = 0, 
                    manipulationQuestion = "I'm a bot", debriefComments = NA, changeDuration = 1500, advisorClass))
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
      out <- rbind(out, simulateAdvisor(pid[i], advisor[i], advisorClass[i]))
    return(out)
  }
  if(length(advisor) > 1) {
    out <- NULL
    for(a in advisor)
      out <- rbind(out, simulateAdvisor(pid, a, advisorClass))
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
      out <- rbind(out, simulateQuestionnaire(pid[i], advisor[i], advisorClass[i]))
    return(out)
  }
  if(length(advisor) > 1) {
    out <- NULL
    for(a in advisor)
      out <- rbind(out, simulateQuestionnaire(pid, a, advisorClass))
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
#' @param participantBehaviour the participant's behaviours used to determine performance
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
                    defaultAdvisor = NA, feedback = F, grid = NA, stimulusParent = NA, warnings = "", 
                    timeInitialStart = theTime, 
                    timeInitialFixation = theTime, timeInitialStimOn = theTime, timeInitialStimOff = theTime, 
                    timeInitialResponse = theTime, durationAdvisorChoice = 10, durationAdviceDuration = 10, 
                    timeFinalStart = theTime, timeFinalFixation = theTime, timeFinalStimOn = theTime, 
                    timeFinalStimOff = theTime, timeFinalResponse = theTime)
  
  # initial decision
  iCorrect <- runif(1) < .71
  if(iCorrect) out$initialAnswer <- ans
  else out$initialAnswer <- 1 - ans
  out$initialConfidence <- getConfidence(iCorrect, participantBehaviour$calibration[1],
                                         participantBehaviour$bias[1], participantBehaviour$volatility[1])
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

#' Calculate the confidence given as a function of correctness. These
#' confidences will aggregate such that greater confidence will associate with
#' greater probability of being correct, attendant on calibration.
#' @param correct whether the decision was correct
#' @param calibration the metacognitive calibration score for the participant
#' @param bias the extent to which confidence scores are inflated (+ve) or reduced (-ve)
#' @param volatility the SD of confidence values
getConfidence <- function(correct, calibration, bias, volatility) {
  if(correct && runif(1) < calibration || (!correct && runif(1) >= calibration)) 
    out <- rnorm(1, 32 + bias, volatility)
  else
    out <- rnorm(1, 18 + bias, volatility)
  round(max(1, min(50, out)))
}

#' Return the advisor chosen
#' @param pair advisor pair to choose between
#' @param refAdvisor advisor to use as the reference
#' @param behaviour dataframe of behaviour variables for the participant
getAdvisorChoice <- function(pair, refAdvisor, behaviour) {
  if(runif(1) < behaviour$trust[behaviour$adviceType == refAdvisor])
    return(refAdvisor)
  else
    return(pair[pair != refAdvisor])
}

#' Return the updated behaviour dataframe with new values for trust for advisor pair
#' @param pair oppositional pair of advisors being updated
#' @param refAdvisor one of the pair whose new trust rating is specified
#' @param newTrust new trust rating for the refAdvisor
#' @param behaviour data frame of participant behaviour
updateAdvisorTrust <- function (pair, refAdvisor, newTrust, behaviour) {
  behaviour$trust[behaviour$adviceType == refAdvisor] <- newTrust
  behaviour$trust[behaviour$adviceType == pair[pair != refAdvisor]] <- 1 - newTrust
  return(behaviour)
}

#' Return the updated trust in an advisor (trust is essentially the probability of being picked)
#' @param trust current trust
#' @param conf initial confidence of participant's answer
#' @param adviceAgrees boolean whether the advisor agreed with participant's initial decision
#' @param behaviour data frame of participant behaviour
#' @param trustModel which of the trustModels to use
getUpdatedTrust <- function(trust, conf, adviceAgrees, behaviour, trustModel) {
  
  if(trustModel == trustModels$flat)
    return(trust)
  
  if(trustModel == trustModels$agreement)
    behaviour$trustMeta <- 1/conf
  
  # deltaTrust = b0 * agree * b1 * conf - decay
  trust - behaviour$trustDecay + (behaviour$trustAgree * adviceAgrees) * (behaviour$trustMeta * conf)
}

# Constants ---------------------------------------------------------------

trustModels <- list(flat = 1, agreement = 2, metacog = 3)

populationPickRate <- data.frame(adviceType = unlist(adviceTypes), 
                                 pickRateMean = c(.5, .51, 1-.51, .57, 1-.57, .61, 1-.61),
                                 pickRateSD = .2,
                                 influenceMean = c(5, 10, 0, 15, 0, 20, -5),
                                 influenceSD = 5,
                                 advisorClass = "Advisor")
populationPickRate <- rbind(populationPickRate, 
                            data.frame(adviceType = populationPickRate$adviceType,
                                       pickRateMean = .5 + (populationPickRate$pickRateMean - .5) * .8,
                                       pickRateSD = populationPickRate$pickRateSD * .8,
                                       influenceMean = round(populationPickRate$influenceMean * .8),
                                       influenceSD = populationPickRate$influenceSD * .8,
                                       advisorClass = "Cue"))
