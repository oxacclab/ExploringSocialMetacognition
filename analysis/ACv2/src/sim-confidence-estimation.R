
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
  agentInsensitivitySD = 8,
  agentConfidence = 2,
  agentConfidenceSD = 4,
  agentEgoBias = .7, 
  agentEgoBiasSD = .2,
  agentEffectSize = .1,
  agentEffectSizeSD = .05
  ) {
  
  # Simulated answers will assume that each agent has a sensitivity, and that 
  # this sensitivity is affected by the objective difficulty of the question, 
  # i.e. the distance between the anchor and the correct answer. 
  agents <- tibble(
    pid = unique(AdvisedTrial$pid),
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
        # negative confidence indicates a switch of sides
        responseAnswerSideFinal = if_else(responseConfidenceFinal > 0,
                                          responseAnswerSide,
                                          1 - responseAnswerSide),
        responseConfidenceFinal = abs(responseConfidenceFinal),
        responseConfidenceFinal = pmax(0, pmin(100, responseConfidenceFinal)),
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
                                  agent) {
  advice <- ifelse(agree, advice, -advice)
  egoBias <- ifelse(advisor == "single", 
                    agent$egoBias - agent$es, 
                    agent$egoBias)
  final <- initial + advice * (1 - egoBias)
  final
}