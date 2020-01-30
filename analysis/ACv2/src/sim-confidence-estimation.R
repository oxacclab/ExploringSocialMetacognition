
# Simulate initial and final answers in confidence estimation task --------

# NB: Expects data loaded as by analysis/ACv2/confidenceEstimation_*.Rmd

#' Simulate confidence estimation answers from existing CE task data. This
#' allows for the JS task to generate advice as it would for participants while
#' replacing the random integration testing answers with simulated ones.
#'
#' @note Agents do not learn about advisors throughout the course of the
#'   experiment, meaning that they are at best only a rough approximation of
#'   real participants. There is also no correlation between confidence and
#'   compliance. There is no differential influence effect of dis/agreement.
#'
#' @param AdvisedTrial tibble of CE task answers.
#' @param nAgents NA to use the agents supplied in AdvisedTrial (but recalculate
#'   their answers). A number to produce that many agents by bootstrapping from
#'   the trials in AdvisedTrial
#' @param agentInsensitivitySD sd of agent error distribution (always positive)
#' @param agentConfidence mean of distribution of increase in agent confidence
#'   for each year between best guess and anchor date (always positive)
#' @param agentConfidenceSD standard deviation of above
#' @param agentEgoBias mean of distribution for how heavily agents discount
#'   advice
#' @param agentEgoBiasSD standard deviation of above
#' @param agentEffectSize mean of distribution of how much more agents are
#'   influenced by advisors whose confidence calibration they know (single
#'   advisors). This alters the agent's egoBias
#' @param agentEffectSizeSD standard deviation of above
#' @return AdvisedTrial modified to use simulated answers
simulateCE <- function(
  AdvisedTrial,
  nAgents = NA,
  agentInsensitivitySD = 8,
  agentConfidence = 2,
  agentConfidenceSD = 4,
  agentEgoBias = .7, 
  agentEgoBiasSD = .2,
  agentEffectSize = .1,
  agentEffectSizeSD = .05
) {
  require(tidyverse)
  
  if (is.na(nAgents)) {
    pids <- unique(AdvisedTrial$pid)
  } else {
    pids <- paste0('simAgent_', sprintf('%03d', 1:nAgents))
  }
  
  # Simulated answers will assume that each agent has a sensitivity, and that 
  # this sensitivity is affected by the objective difficulty of the question, 
  # i.e. the distance between the anchor and the correct answer. 
  agents <- tibble(
    pid = pids,
    error = abs(rnorm(length(pid), sd = agentInsensitivitySD)),
    confidence = abs(rnorm(length(pid), agentConfidence, agentConfidenceSD)),
    egoBias = rnorm(length(pid), agentEgoBias, agentEgoBiasSD),
    es = rnorm(length(pid), agentEffectSize, agentEffectSizeSD)
  ) %>%
    mutate(
      egoBias = pmax(0, pmin(1, egoBias)),
      es = pmax(0, pmin(1, es))
    )
  
  out <- NULL
  for (a in agents$pid) {
    agent <- agents %>% dplyr::filter(pid == a)
    tmp <- AdvisedTrial %>% dplyr::filter(pid == a)
    
    if (!nrow(tmp)) {
      # bootstrap new trial set modelled on the first participant, split by each
      # advisor
      n <- AdvisedTrial %>% 
        dplyr::filter(pid == unique(pid)[1]) %>%
        group_by(advisor0idDescription, feedback) %>%
        summarise(n = n())
      
      for (i in 1:nrow(n)) {
        tmp <- rbind(
          tmp,
          AdvisedTrial %>% 
            dplyr::filter(
              advisor0idDescription == n$advisor0idDescription[i],
              feedback == n$feedback[i],
              !(stimHTML %in% tmp$stimHTML)
            ) %>%
            sample_n(n$n[i])
        )
      }
      
      tmp$pid <- a
    }
    
    tmp <- tmp %>% 
      mutate(
        # initial estimate
        bestAns = correctAnswer + rnorm(1, sd = agent$error),
        responseAnswerSide = if_else(bestAns < anchorDate, 0, 1),
        responseConfidence = abs(anchorDate - bestAns) * agent$confidence,
        responseConfidence = pmax(0, pmin(100, responseConfidence)),
        # advice
        agree = advisor0adviceSide == responseAnswerSide,
        nudge = if_else(agree & advisor0adviceConfidence >= responseConfidence,
                        rnorm(1, sd = agent$es), -rnorm(1, sd = agent$es)),
        # final response
        # average confidence
        responseConfidenceFinal = getAdjustedConfidence(
          responseConfidence, 
          advisor0adviceConfidence,
          agree,
          advisor0idDescription,
          agent
        ),
        responseConfidenceFinalAvg = getAdjustedConfidence(
          responseConfidence, 
          advisor0adviceConfidence,
          agree,
          advisor0idDescription,
          agent,
          'avg'
        ),
        # negative confidence indicates a switch of sides
        responseAnswerSideFinal = if_else(responseConfidenceFinal > 0,
                                          responseAnswerSide,
                                          1 - responseAnswerSide),
        responseAnswerSideFinalAvg = if_else(responseConfidenceFinalAvg > 0,
                                             responseAnswerSide,
                                             1 - responseAnswerSide),
        responseConfidenceFinal = abs(responseConfidenceFinal),
        responseConfidenceFinal = pmax(0, pmin(100, responseConfidenceFinal)),
        responseConfidenceFinalAvg = abs(responseConfidenceFinalAvg),
        responseConfidenceFinalAvg = pmax(0, pmin(100, responseConfidenceFinalAvg)),
        # marking
        responseCorrect = responseAnswerSide == correctAnswerSide,
        responseCorrectFinal = responseAnswerSideFinal == correctAnswerSide
      ) 
    
    # backfilling key derived advisor properties
    for (adv in unique(tmp$advisor0idDescription)) {
      x <- tmp %>% dplyr::filter(advisor0idDescription == adv)
      names(x) <- str_replace(names(x), paste0(adv, "\\."), "adv\\.")
      
      x <- x %>% 
        # strip labels
        mutate_if(is.numeric, as.numeric) %>%
        mutate(
          switch = responseAnswerSide != responseAnswerSideFinal,
          adv.agree = agree,
          adv.influence = case_when(
            agree & !switch ~ responseConfidenceFinal - responseConfidence,
            agree & switch ~ -(responseConfidence + responseConfidenceFinal),
            !agree & !switch ~ -(responseConfidence - responseConfidenceFinal),
            !agree & switch ~ responseConfidence + responseConfidenceFinal
          ),
          adv.distance = if_else(agree, abs(responseConfidence - 
                                              adv.adviceConfidence),
                                 responseConfidence + adv.adviceConfidence),
          adv.distanceFinal = if_else(agree,
                                      abs(responseConfidenceFinal - 
                                            adv.adviceConfidence),
                                      responseConfidenceFinal + 
                                        adv.adviceConfidence)
        ) %>%
        select(-bestAns, -agree, -switch, -nudge)
      
      names(x) <- str_replace(names(x), "adv\\.", paste0(adv, "\\."))
      out <- rbind(out, x)
    }
  }
  
  list(
    trials = out, 
    agents = agents,
    params = list(
      agentInsensitivitySD = agentInsensitivitySD,
      agentConfidence = agentConfidence,
      agentConfidenceSD = agentConfidenceSD,
      agentEgoBias = agentEgoBias,
      agentEgoBiasSD = agentEgoBiasSD,
      agentEffectSize = agentEffectSize,
      agentEffectSizeSD = agentEffectSizeSD
    )
  )
}

#' Confidence adjusted by advice
#' @param initial estimate confidence
#' @param advice confidence
#' @param agree whether answers are on the same side of the scale
#' @param advisor name of the advisor
#' @param agent responsible for initial estimate
#' @param strategy whether to 'add' or 'avg' advice and initial estimate
#'
#' @details Final confidence is an average of initial confidence on one side,
#'   and advice (signed by agreement) on the other. The average is weighted by
#'   the agent's egoBias. Where the advisor is a single advisor, the egocentric
#'   discounting is reduced by the agent's effectSize.
#'
#' @return vector of final confidence judgements, where negative numbers
#'   indicate a switch in answer side
getAdjustedConfidence <- function(initial, 
                                  advice, 
                                  agree,  
                                  advisor, 
                                  agent, 
                                  strategy = 'add') {
  advice <- ifelse(agree, advice, -advice)
  egoBias <- ifelse(advisor == "single", 
                    agent$egoBias - agent$es, 
                    agent$egoBias)
  if (strategy == 'avg') 
    final <- (initial * egoBias) + (advice * (1 - egoBias))
  else
    final <- initial + (advice * (1 - egoBias))
  final
}

#' Power analysis for Confidence Estimation task.
#'
#' @param AdvisedTrial tibble of CE task answers used for simulating data.
#' @param parameters tibble of parameters settings to explore
#' @param nCores number of cores to use in parallel processing
#' 
#' @return list with input, calculated data, and summary stats
powerAnalysisCE <- function(
  AdvisedTrial, 
  parameters, 
  nCores = detectCores() - 2
) {
  
  out <- list(
    seedData = AdvisedTrial,
    parameters = parameters,
    models = list(
      data = NULL,
      analysis = NULL
    ),
    nCores = nCores
  )
  
  cl <- makeCluster(nCores)
  
  #' Unpack arguments into a neat list from a singleton and a vector
  unpacker <- function(vec, df) {
    do.call(simulateCE, c(list(AdvisedTrial = df), vec))
  }
  
  # out$models$data <- apply(parameters, 1, unpacker, 
  #                          x = AdvisedTrial, f = simulateCE)
  
  clusterExport(cl, c("getAdjustedConfidence", "simulateCE"))
  out$models$data <- parRapply(cl, x = parameters, unpacker,
                               df = AdvisedTrial)
  
  stopCluster(cl)
  
  out$models$analysis <- analyseCE(out$models$data)
  
  out
}

#' Analysis of effects for model data
#' @param x list of model data
#' @return tibble of t-test output plus BayesFactor for single vs mass advisor
#'   influence on no-feedback trials
analyseCE <- function(x) {
  out <- list()
  
  # Analyse the data
  for (i in 1:length(x)) {
    d <- x[i][[1]]
    
    # prep data
    tmp <- d$trials %>% 
      filter(feedback == F) %>%
      select(pid, advisor0idDescription, mass.influence, single.influence) %>%
      mutate(advisor0influence = if_else(advisor0idDescription == 'single',
                                         single.influence, mass.influence)) %>%
      group_by(pid, advisor0idDescription) %>%
      summarise(influence = mean(advisor0influence)) %>%
      spread(advisor0idDescription, influence) 
    
    # ttests
    t <- t.test(tmp$single, tmp$mass, paired = T)
    bf <- ttestBF(tmp$single, tmp$mass, paired = T)
    
    out[[i]] <- tidy(t)
    out[[i]]$BF <- exp(bf@bayesFactor$bf)
  }
  
  out
}
