#' Agents update their beliefs according to a Bayesian approximation: They weigh
#' advice evenly, then use the difference between their initial opinion and the
#' advice to update the weight afforded to future pieces of advice.

library(tidyverse)
library(igraph)
# library(animation)

#' Run the simulation
#' @param n list of numbers (participants and decisions) to simulate
#' @param conf whether or not agents use confidence to update trust
#' @param biasMean the mean for the agents' bias distribution (agents' biases
#'   are drawn from normal distributions with mean +/- biasMean)
#' @param biasSD standard deviation for the bias distribution
#' @param sensitivitySD standard deviation for distribution of agents'
#'   sensitivity (mean is 1)
#' @param learningRate size of the trust update at each time step
#' 
runSimulation <- function(
  n = list(p = 6, d = 200), 
  conf = T,
  biasMean = 1,
  biasSD = 1, 
  sensitivitySD = 1,
  learningRate = .1
  ) {
  
  # print(paste0(
  #   "Running simulation: ",
  #   "; AgentCount = ", n$p,
  #   "; DecisionCount = ", n$d,
  #   "; BiasMean = ", biasMean,
  #   " (SD = ", biasSD, ")",
  #   "; sensitivitySD = ", sensitivitySD,
  #   "; learningRate = ", learningRate
  # ))
  
  out <- list(
    times = list(
      start = Sys.time()
    ),
    parameters = list(
      n = n,
      conf = conf,
      biasMean = biasMean,
      biasSD = biasSD,
      sensitivitySD = sensitivitySD,
      learningRate = learningRate
    )
  )

  # Construct the agents
  out$model <- makeAgents(
    n = n, biasMean = biasMean, biasSD = biasSD, sensitivitySD = sensitivitySD
    )
  
  out$times$agentsCreated <- Sys.time()
  
  # Run the model
  for (d in 1:n$d) {
    out <- simulationStep(out, d)
  }
  
  out$times$end <- Sys.time()
  
  detailGraphs(out)
  
}

#' Run a suite of simulations defined by params
#' @param params dataframe of parameters for simulations (see \code{runSimulation()} for details)
#' @param seed random seed to use for each simulation, or list of seeds to use for each simulation (recycled as necessary)
#' 
#' @details NA for any parameter or the seed will result in default values being used. For the seed the default is not to set one.
runSimulations <- function(
  params, 
  seed = NA
) {
  out <- list()
  
  for (i in 1:nrow(params)) {
    args <- list()
    p <- params[i, ]
    
    for (a in names(p)) {
      if (!(is.null(p[[a]]) | is.na(p[[a]]))) {
        if (is_list(p[[a]]) & length(p[[a]]) == 1) {
          args[[a]] <- p[[a]][[1]]
        } else {
          args[[a]] <- p[[a]]
        }
      }
    }
    
    n <- i %% length(seed)
    if (n != 0 & is.na(seed[i])) {
      set.seed(seed[i])
    }
    
    # print(args)
    
    out[[length(out) + 1]] <- do.call(runSimulation, args)
  }
  
  out
}

# Agent construction ------------------------------------------------------

#' Agents are constructed with a bias on their binary decision (constant over
#' time) and a set of weights governing how seriously the advice of other agents
#' is taken (modified over time). 
#' @param n list of numbers (participants and decisions) to simulate
#' @param biasMean the mean for the agents' bias distribution (agents' biases
#'   are drawn from normal distributions with mean +/- biasMean)
#' @param biasSD standard deviation for the bias distribution
#' @param sensitivitySD standard deviation for distribution of agents'
#'   sensitivity (mean is 1)
#'   
#' @return list(
#'   agents = tibble of agents' decisions, advice, etc. at each time point
#'   graphs = list([[1]] = initial graph of agents' trust matrix)
#' )
makeAgents <- function(
  n = list(p = 6, d = 200), 
  biasMean = 1,
  biasSD = 1, 
  sensitivitySD = 1
) {
  bias <- ifelse(runif(n$p) > .5, 
                 rnorm(n$p, biasMean, biasSD), 
                 rnorm(n$p, -biasMean, biasSD))
  
  agents <- tibble(id = rep(1:n$p, n$d),
                   decision = rep(1:n$d, each = n$p),
                   sensitivity = pmax(
                     abs(rep(rnorm(n$p, 1, sensitivitySD), n$d)), 
                     .00001
                     ),
                   bias = rep(bias[order(bias)], n$d),
                   truth = NA,
                   initial = NA,
                   advisor = NA,
                   advice = NA,
                   weight = NA,
                   final = NA)
  
  graphs <- list(matrix(as.numeric(cut(runif(n$p ^ 2), 3))/3, n$p, n$p))
  diag(graphs[[1]]) <- 0
  
  list(agents = agents, graphs = graphs)
}

# Simulation --------------------------------------------------------------

#' Each timestep agents are asked for a binary decision about whether a variable
#' is > 0. They form a noisy initial decision based on the true value plus their
#' bias plus noise. They then give their opinion to another agent, and receive
#' another agent's opinion as advice. The advice is integrated according to the
#' current weight placed on the other agent's trustworthiness. This weight is
#' then updated according to whether the agents agree, weighted by the
#' confidence of the deciding agent.
#' @param model to simulate the step for
#' @param d decision to simulate
#' 
#' @return model updated to include values for decision d
simulationStep <- function(model, d) {
  # identify the agent tibble rows corresponding to decision d
  rows <- (((d - 1) * model$parameters$n$p):(d * model$parameters$n$p - 1)) + 1
  
  agents <- model$model$agents[rows, ]
  
  # Truth
  agents$truth <- rnorm(1)  # single true value for all agents
  
  # Initial decisions
  agents$initial <- 
    agents$truth +    # true value
    agents$bias +     # bias
    rnorm(model$parameters$n$p, 0, 1/agents$sensitivity) # normally distributed noise with sd = 1/sensitivity
  
  # Advice
  agents$advisor <- sapply(agents$id, function(i) 
    base::sample((1:model$parameters$n$p)[-i], # never ask yourself!
                 1))
  
  agents$weight <- diag(model$model$graphs[[d]][agents$advisor, ])
  
  agents$advice <- 
    agents$initial[agents$advisor]
  
  agents$final <- 
    (agents$initial * (1 - agents$weight)) +
    (agents$advice * agents$weight)
  
  # Write output to the model
  model$model$agents[rows, ] <- agents
  
  # Updating weights
  newWeights <- as.vector(model$model$graphs[[d]])
  if (model$parameters$conf) {
    newWeights[(agents$id - 1) * model$parameters$n$p + agents$advisor] <- 
      newWeights[(agents$id - 1) * model$parameters$n$p + agents$advisor] +
      ifelse((agents$initial > 0) == (agents$advice > 0),
             model$parameters$learningRate * abs(agents$initial), # agree
             -model$parameters$learningRate * abs(agents$initial)) # disagree
  } else {
    newWeights[(agents$id - 1) * model$parameters$n$p + agents$advisor] <- 
      newWeights[(agents$id - 1) * model$parameters$n$p + agents$advisor] + 
      ifelse((agents$initial > 0) == (agents$advice > 0),
             model$parameters$learningRate, -model$parameters$learningRate)
  }
  newWeights <- pmax(0.0001, pmin(1, newWeights))
  newWeights <- matrix(newWeights, model$parameters$n$p, model$parameters$n$p)
  diag(newWeights) <- 0
  model$model$graphs[[d + 1]] <- newWeights
  
  model
}

detailGraphs <- function(model) {
  # Need to check the iGraph node numbers follow the agents$id/graph ones
  agents <- model$model$agents
  N <- model$parameters$n
  
  # transpose
  g <- lapply(model$model$graphs, t)
  g <- lapply(g, graph_from_adjacency_matrix, weighted = T)
  
  for (i in 1:N$d) {
    
    active <- rep(0, N$p * N$p)
    # fill in colour for active advice (vectorised)
    active[0:(N$p - 1) * N$p + agents$advisor[agents$decision == i]] <- 'green'
    
    active <- matrix(active, N$p, N$p)
    active <- t(active)
    active <- as.character(active)
    # drop reciprocal connections
    active <- active[-(seq(1, N$p * N$p, N$p) + 0:(N$p - 1))]
    # overwrite active connections
    E(g[[i]])$active[active != 0] <- active[active != 0]
    
    # Sensitivity
    E(g[[i]])$sensitivity <- agents$sensitivity[head_of(g[[i]], E(g[[i]]))]
    
    # Bias difference
    E(g[[i]])$headBias <- agents$bias[head_of(g[[i]], E(g[[i]]))]
    E(g[[i]])$tailBias <- agents$bias[tail_of(g[[i]], E(g[[i]]))]
    E(g[[i]])$sharedBias <- abs(E(g[[i]])$headBias) + 
      abs(E(g[[i]])$tailBias) * 
      ifelse((E(g[[i]])$headBias < 0) == (E(g[[i]])$tailBias < 0), 1, -1)
    
    # colour vertices by bias
    V(g[[i]])$bias <- agents$bias[1:N$p]
    V(g[[i]])$biasColour <- ifelse(agents$bias[1:N$p] > 0, 
                                   biasToColourString(agents$bias[1:N$p], 'b'),
                                   biasToColourString(agents$bias[1:N$p], 'r'))
  }
  
  model$model$graphs <- g
  
  model
  
}

# Results -----------------------------------------------------------------

#' A neat string of the parameters for a model for inclusion in graphs
#' @param model a simulation result model
settingsStr <- function(model) {
  timeElapsed <- difftime(model$times$end, model$times$start)
  
  paste0('Model parameters:\n',
         'Agents = ', model$parameters$n$p, 
         '; Decision = ', model$parameters$n$d, '; ',
         'ConfidenceWeighted = ', model$parameters$conf, '; \n',
         'Sensitivity SD = ', model$sensitivitySD, '; ',
         'Bias mean (SD) = +/-', model$parameters$biasMean, 
         ' (', model$parameters$biasSD, '); ',
         'Learning rate = ', model$parameters$learningRate, '\n',
         'Model run ', format(model$times$start, "%F_%H-%M-%S"), ' (',
         'runtime = ', round(as.numeric(timeElapsed), 1), 's)')
}

weightToColourString <- function(graph) {
  colours <- E(graph)$weight
  
  limits <- list(low = .05 * 255, high = .95 * 255)
  colours <- 255 * colours
  colours <- 255 - round(pmin(limits$high, pmax(limits$low, colours)))
  
  colours <- paste0('#', 
                    sprintf("%02X", colours), 
                    sprintf("%02X", colours), 
                    sprintf("%02X", colours))
  colours
}

#' Return a colour string made up of r/g/b as desired with saturation scaled by
#' b
#' @param b vector of values to use for saturations
#' @param colour any of 'r', 'g', and 'b' to show channels used for saturation
#'   (other channels are filled with FF)
#' @param maxVal maximum value for b
#' @param minVal minimum value for b
#' @param minSaturation minimum saturation value corresponding to minVal
#' @param maxSaturation maximum saturation value corresponding to maxVal
#' @return character vector same length as b containing colour strings
biasToColourString <- function(b, colour = c('r', 'g', 'b'), 
                               maxVal = 2.5, minVal = 0,
                               minSaturation = .1, maxSaturation = .9) {
  # take the reciprocal of b so that more pronounced biases are more saturated
  x <- abs(1/b) %>%
    pmin(maxVal) %>%
    pmax(minVal)
  
  x <- x / maxVal
  
  x <- pmax(x * 255 * maxSaturation, 255 * minSaturation)
  
  x <- sprintf('%02X', round(x))
  
  out <- rep('#', length(b))
  
  for (clr in c('r', 'g', 'b')) {
    
    if (clr == colour) {
      out <- paste0(out, 'FF')
    } else {
      out <- paste0(out, x)
    }
  }
  
  out
}

plotGraph <- function(model, i, activeColours = T) {
  
  title <- paste("Advice weights after decision", i - 1)
  
  lines <- c(3, 4, 5, 1) # line weights light->heavy
  cuts <- length(lines)
  
  # discrete weight categories for edges
  weight <- as.numeric(cut(E(model$model$graphs[[i]])$weight, cuts))
  
  # colour lines currently undergoing advice-taking
  # by default use the weight of the connection
  E(model$model$graphs[[i]])$active <- 
    weightToColourString(model$model$graphs[[i]])
  
  plot(model$model$graphs[[i]], 
       main = title,
       layout = layout_in_circle,
       vertex.color = V(model$model$graphs[[i]])$biasColour,
       edge.arrow.size = 0.5,
       edge.width = weight / model$parameters$n$p * 5,
       edge.lty = lines[weight],
       edge.color = E(model$model$graphs[[i]])$active,
       edge.curved = 1 / model$parameters$n$p)
}

networkGraph <- function(model) {
  par(mfrow = c(1,2))
  plotGraph(model, 1, activeColours = F)
  plotGraph(model, model$parameters$n$d, activeColours = F)
  invisible(NULL)
}

# Calculation of bias-tie strength correlations
.biasCorrelation <- function(model) {
  cors <- NULL
  for (d in 1:model$parameters$n$d) {
    tmp <- model$model$graphs[[d]]
    
    test <- cor.test(as.numeric(tmp[attr = 'sharedBias']), 
                     as.numeric(tmp[attr = 'weight'])) 
    
    cors <- rbind(cors, tibble(decision = d, 
                               r = test$estimate, 
                               p = test$p.value,
                               ciL = test$conf.int[1],
                               ciH = test$conf.int[2]))
  }
  
  cors
}

# Correlation between bias and tie strength
biasGraph <- function(model) {
  cors <- .biasCorrelation(model)
  
  # Plot correlation
  cors %>% ggplot(aes(x = decision, 
                                 y = r, ymin = ciL, ymax = ciH,
                                 colour = p < .05)) +
    geom_hline(yintercept = 0, linetype = 'dashed') +
    geom_point() +
    geom_errorbar(width = 0) +
    scale_y_continuous(limits = c(-1, 1)) +
    labs(title = 'Shared bias x Advice weight',
         subtitle = ifelse(model$parameters$conf, 
                           'Confidence-weighted advisor updating',
                           'Agreement-only advisor updating'),
         caption = settingsStr(model)) 
}

# Calculate the strength of the sensitivity-advice weight correlation for in- and out-degree
.sensitivityCorrelation <- function(model) {
  sens <- NULL
  for (d in 1:model$parameters$n$d) {
    tmp <- model$model$graphs[[d]]
    
    # rows give outdegree, columns indegree
    outdeg <- sapply(1:model$parameters$n$p, function(i) {
      w <- tmp[attr = "weight"]
      w <- w[i, ]
      mean(w[-i]) # don't include self weight in average
    })
    indeg <- sapply(1:model$parameters$n$p, function(i) {
      w <- tmp[attr = "weight"]
      w <- w[, i]
      mean(w[-i])
    })
    
    # Pull out the sensitivity from the columns of the graph edges
    sensVec <- c(tmp[attr = "sensitivity"][2, 1],
                 tmp[attr = "sensitivity"][1, -1])
    
    testOut <- cor.test(sensVec, outdeg)
    testIn <- cor.test(sensVec, indeg)
    
    sens <- rbind(sens, tibble(decision = d,
                               direction = "In",
                               r = testIn$estimate, 
                               p = testIn$p.value,
                               ciL = testIn$conf.int[1],
                               ciH = testIn$conf.int[2]))
    sens <- rbind(sens, tibble(decision = d,
                               direction = "Out",
                               r = testOut$estimate, 
                               p = testOut$p.value,
                               ciL = testOut$conf.int[1],
                               ciH = testOut$conf.int[2]))
  }
  
  sens
}

# Correlation between sensitivity and tie strength
sensitivityGraph <- function(model) {
  sens <- .sensitivityCorrelation(model)
  
  sens %>% ggplot(aes(x = decision, 
                      y = r, ymin = ciL, ymax = ciH,
                      fill = direction, colour = direction)) +
    geom_hline(yintercept = 0, linetype = 'dashed') +
    geom_ribbon(alpha = .25, colour = NA) +
    geom_line() + 
    # rug plots to show significant divergences from 0 
    geom_rug(data = sens %>% 
             dplyr::filter(p < .05, direction == 'In'), 
             sides = 't', size = model$parameters$n$d / 100 + 1) +
    geom_rug(data = sens %>% 
             dplyr::filter(p < .05, direction == 'Out'),
             sides = 'b', size = model$parameters$n$d / 100 + 1) +
    scale_y_continuous(limits = c(-1, 1)) +
    labs(title = 'Sensitivity x Mean advice weight',
         subtitle = paste0(ifelse(model$parameters$conf, 
                                  'Confidence-weighted advisor updating',
                                  'Agreement-only advisor updating'),
                           '\nRug marks show where p < .05'),
         caption = settingsStr(model))
}

allOutput <- function(model) {
  print(biasGraph(model))
  print(sensitivityGraph(model))
  filename <- paste0(getwd(), '/ACv2/animation/',
                     timeRun,
                     '_agreement-effects.gif')
  
  saveGIF({
    for (i in 1:N$d) plotGraph(model, i)
    }, 
    movie.name = filename, 
    ani.width = 1024,
    ani.height = 1024,
    # ani.res = 300,
    interval = 0.25, 
    loop = 0)
  
  print(networkGraph(model))
  
}


     