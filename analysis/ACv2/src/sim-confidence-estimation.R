
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
#' @param strategy strategy to use as the default answer
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
  agentEffectSizeSD = .05,
  strategy = 'Add'
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
  
  trials <- simulateAgentAnswers(AdvisedTrial, agents, 
                                 getAdjustedConfidence, strategy)
  
  list(
    trials = trials, 
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

#' Simulate answers and confidence
#' @param AdvisedTrial tbl of trials
#' @param agents tbl of agents to complete the trials
#' @param finalAnswerFun function used to compute final answers and confidence
#' @param strategy strategy to use for calculating the default advice variables
simulateAgentAnswers <- function(AdvisedTrial, agents, 
                                 finalAnswerFun, strategy) {
  AdvisedTrial <- expandForN(AdvisedTrial, agents)
  
  out <- NULL
  for (a in agents$pid) {
    agent <- agents %>% dplyr::filter(pid == a)
    tmp <- AdvisedTrial %>% dplyr::filter(pid == a)
    
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
                        rnorm(1, sd = agent$es), -rnorm(1, sd = agent$es))
      ) %>% 
      finalAnswerFun(agent, strategy) 
    
    for (n in grep('responseConfidenceFinal', names(tmp), value = T)) {
      suffix <- reFirstMatch('responseAnswerSideFinal([\\w\\W]*)$', n)
      tmp[, paste0('responseAnswerSideFinal', suffix)] <-
        if_else(pull(tmp, paste0('responseConfidenceFinal', suffix)) > 0,
                pull(tmp, paste0('responseAnswerSide', suffix)),
                1 - pull(tmp, paste0('responseAnswerSide', suffix)))
      tmp[, paste0('responseConfidenceFinal', suffix)] <-
        pmin(100, pmax(0, abs(pull(tmp, paste0('responseConfidenceFinal', suffix)))))
      tmp[, paste0('responseCorrectFinal', suffix)] <- 
        pull(tmp, paste0('responseAnswerSideFinal', suffix)) == tmp$correctAnswerSide
    }
    
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
  
  out
}

#' Add rows to trial dataframe to simulate the necessary number of agents
expandForN <- function(AdvisedTrial, agents) {
  out <- NULL
  for (a in agents$pid) {
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
    out <- rbind(out, tmp)
  }
  out
}

#' Confidence adjusted by advice
#' @param AdvisedTrialSubset tbl of trials for agent
#' @param agent tbl of agent's properties
#' @param strategy which strategy to promote to the main result
#'
#' @details Final confidence is an average of initial confidence on one side,
#'   and advice (signed by agreement) on the other. The average is weighted by
#'   the agent's egoBias. Where the advisor is a single advisor, the egocentric
#'   discounting is reduced by the agent's effectSize.
#'
#' @return tbl of trials for agent with appropriate responseConfidenceFinal
getAdjustedConfidence <- function(AdvisedTrialSubset, agent, strategy = 'Add') {
  initial <- AdvisedTrialSubset$responseConfidence
  advice <- AdvisedTrialSubset$advisor0adviceConfidence
  agree <- AdvisedTrialSubset$agree
  advisor <- AdvisedTrialSubset$advisor0idDescription
  
  advice <- ifelse(agree, advice, -advice)
  egoBias <- ifelse(advisor == "single", 
                    agent$egoBias - agent$es, 
                    agent$egoBias)
  
  AdvisedTrialSubset$responseConfidenceFinalAvg <- 
    (initial * egoBias) + (advice * (1 - egoBias))
  AdvisedTrialSubset$responseConfidenceFinalAdd <- 
    initial + (advice * (1 - egoBias))
  
  if (has_name(AdvisedTrialSubset, paste0('responseConfidenceFinal', strategy))) {
    AdvisedTrialSubset$responseConfidenceFinal <- 
      pull(AdvisedTrialSubset, paste0('responseConfidenceFinal', strategy))
  } else {
    AdvisedTrialSubset$responseConfidenceFinal <-
      AdvisedTrialSubset$responseConfidenceFinalAdd
  }
  
  AdvisedTrialSubset
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


# Simulate initial and final answers in calibration knowledge task --------

#' Simulate confidence from existing CK task data. This
#' allows for the JS task to generate advice as it would for participants while
#' replacing the random integration testing answers with simulated ones.
#'
#' @param AdvisedTrial tibble of CK task answers.
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
#' @param strategy to use for calculating the default response variables
#' @return AdvisedTrial modified to use simulated answers
simulateCK <- function(
  AdvisedTrial,
  nAgents = NA,
  agentInsensitivitySD = 8,
  agentConfidence = 2,
  agentConfidenceSD = 4,
  agentEgoBias = .7, 
  agentEgoBiasSD = .2,
  agentEffectSize = .1,
  agentEffectSizeSD = .05,
  strategy = 'LeastPref'
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
    es = rnorm(length(pid), agentEffectSize, agentEffectSizeSD),
    preferredAdvisor = sample(unique(AdvisedTrial$advisor0id), length(pid), replace = T)
  ) %>%
    mutate(
      egoBias = pmax(0, pmin(1, egoBias)),
      es = pmax(0, pmin(1, es))
    )
  
  trials <- simulateAgentAnswers(AdvisedTrial, agents, 
                                 getAdjustedConfidence.CK, strategy)
  
  list(
    trials = trials, 
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
#' @param AdvisedTrialSubset tbl of trials for agent
#' @param agent tbl of agent's properties
#' @param strategy to use for calculating the default response variables
#'
#' @details Final confidence is an average of initial confidence on one side,
#'   and advice (signed by agreement) on the other. The average is weighted by
#'   the agent's egoBias. Where the advisor is a single advisor, the egocentric
#'   discounting is reduced by the agent's effectSize.
#'
#' @return tbl of trials for agent with appropriate responseConfidenceFinal
getAdjustedConfidence.CK <- function(AdvisedTrialSubset, agent, strategy) {
  initial <- AdvisedTrialSubset$responseConfidence
  advice <- AdvisedTrialSubset$advisor0adviceConfidence
  agree <- AdvisedTrialSubset$agree
  advisor <- AdvisedTrialSubset$advisor0id
  hybrid <- AdvisedTrialSubset$advisor0hybridIds != ""
  
  # correct advice for agreement
  advice <- ifelse(agree, advice, -advice)
  
  # Treat the hybrid as the least preferred advisor
  egoBias <- ifelse(advisor == agent$preferredAdvisor & !hybrid,
                    agent$egoBias - agent$es,
                    agent$egoBias)
  AdvisedTrialSubset$responseConfidenceFinalLeastPref <- 
    initial + (advice * (1 - egoBias))
  
  # Prefer the least preferred advisor to the hybrid
  # Hybrid = egoBias, non-preferred = egoBias - es, preferred = egoBias - 2es
  egoBias <- agent$egoBias + 
    (hybrid * agent$es) -
    (advisor == agent$preferredAdvisor) * agent$es * !hybrid
  AdvisedTrialSubset$responseConfidenceFinalPreferWorst <-  
    initial + (advice * (1 - egoBias))
  
  # Weighted average of advisors' influence by likelihood they gave the advice
  # Break the scale into thirds and calculate p(advisor|confidence) for each 
  # third based on training trials.
  tmp <- AdvisedTrialSubset %>% 
    ungroup() %>%
    mutate(
      confCat = 
        map_int(advisor0adviceConfidence, ~ min(which(c(25, 75, Inf) >= .)))
    ) 
  
  confCat <- tmp %>% pull(confCat)
  pPreferred <- tmp %>% 
    dplyr::filter(feedback) %>%
    group_by(confCat) %>%
    summarise(x = mean(advisor0id == agent$preferredAdvisor)) %>%
    pull(x)
  
  egoBias <- ifelse(
    hybrid,
    (agent$egoBias * (1 - pPreferred[confCat]) + (agent$egoBias - agent$es) * pPreferred[confCat]) / 2,
    ifelse(advisor == agent$preferredAdvisor, agent$egoBias - agent$es, agent$egoBias)
    )
  AdvisedTrialSubset$responseConfidenceFinalLikelihoodWeighted <- 
    initial + (advice * (1 - egoBias))
  
  if (has_name(AdvisedTrialSubset, paste0('responseConfidenceFinal', strategy))) {
    AdvisedTrialSubset$responseConfidenceFinal <- 
      pull(AdvisedTrialSubset, paste0('responseConfidenceFinal', strategy))
  }  else {
    AdvisedTrialSubset$responseConfidenceFinal <-
      AdvisedTrialSubset$responseConfidenceFinalLeastPref
  }
  
  AdvisedTrialSubset
}
