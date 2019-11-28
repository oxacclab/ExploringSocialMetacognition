#' Agents update their beliefs according to a Bayesian approximation: They weigh
#' advice evenly, then use the difference between their initial opinion and the
#' advice to update the weight afforded to future pieces of advice.

library(tidyverse)
library(igraph)
library(animation)

# Agent construction ------------------------------------------------------

#' Agents are constructed with a bias on their binary decision (constant over
#' time) and a set of weights governing how seriously the advice of other agents
#' is taken (modified over time). 

setParams <- function() {
  # numbers of participants and decisions
  if (!any(grepl('^N$', ls(envir = .GlobalEnv)))) {
    assign('N', list(p = 6, d = 200), envir = .GlobalEnv)   
  }
  
  # whether to use confidence-weighted advisor update
  if (!any(grepl('^CONF$', ls(envir = .GlobalEnv)))) {
    assign('CONF', T, envir = .GlobalEnv)                 
  }
  
  # +/- mean for bias distributions
  if (!any(grepl('^BIAS_MEAN$', ls(envir = .GlobalEnv)))) {
    assign('BIAS_MEAN', 1, envir = .GlobalEnv)             
  }
  
  # sd for bias distributions
  if (!any(grepl('^BIAS_SD$', ls(envir = .GlobalEnv)))) {
    assign('BIAS_SD', 1, envir = .GlobalEnv)             
  }
    
  # sd of (1/)noise sds for agents
  if (!any(grepl('^SENSITIVITY_SD$', ls(envir = .GlobalEnv)))) {
    assign('SENSITIVITY_SD', 1, envir = .GlobalEnv)          
  }
    
  # learning rate
  if (!any(grepl('^LEARNING_RATE$', ls(envir = .GlobalEnv)))) {
    assign('LEARNING_RATE', .1, envir = .GlobalEnv)              
  }
    
  # whether to save an animation
  if (!any(grepl('^SAVE_ANIMATION$', ls(envir = .GlobalEnv)))) {
      assign('SAVE_ANIMATION', F, envir = .GlobalEnv)        
  }
    
  # output controls
  if (!any(grepl('^OUTPUTS$', ls(envir = .GlobalEnv)))) {
    assign('OUTPUTS', c(
      'BIAS_X_WEIGHT',            # graph of shared bias x weight correlation
      'SENSITIVITY_X_WEIGHT'      # graph of sensitivity x mean degree weight
    ), envir = .GlobalEnv)
    if (SAVE_ANIMATION) {
      OUTPUTS <- c(OUTPUTS, 'NETWORK_GRAPH')   # network graphs at start and end 
    }
  }
  
  if (!any(grepl('^OVERRIDE_THEME$', ls(envir = .GlobalEnv))) || 
      !OVERRIDE_THEME) {
    theme_set(
      theme_light() + 
        theme(
          panel.grid.minor = element_blank(),
          panel.grid.major.x = element_blank(),
          legend.position = 'top'
        ))
  }
    
  (NULL)
}

setParams()


timeStart <- Sys.time()

settingsStr <- function() {
  paste0('Model parameters:\n',
         'Agents = ', N$p, '; Decision = ', N$d, '; ',
         'ConfidenceWeighted = ', CONF, '; \n',
         'Sensitivity SD = ', SENSITIVITY_SD, '; ',
         'Bias mean (SD) = +/-', BIAS_MEAN, ' (', BIAS_SD, '); ',
         'Learning rate = ', LEARNING_RATE, '\n',
         'Model run ', format(timeStart, "%F_%H-%M-%S"), ' (',
         'runtime = ', round(as.numeric(timeElapsed), 1), 's)')
}

bias <- ifelse(runif(N$p) > .5, 
               rnorm(N$p, BIAS_MEAN, BIAS_SD), 
               rnorm(N$p, -BIAS_MEAN, BIAS_SD))

agents <- tibble(id = rep(1:N$p, N$d),
                 decision = rep(1:N$d, each = N$p),
                 sensitivity = pmax(
                   abs(rep(rnorm(N$p, 1, SENSITIVITY_SD), N$d)), 
                   .00001
                   ),
                 bias = rep(bias[order(bias)], N$d),
                 truth = NA,
                 initial = NA,
                 advisor = NA,
                 advice = NA,
                 weight = NA,
                 final = NA)

graph <- list(matrix(as.numeric(cut(runif(N$p ^ 2), 3))/3, N$p, N$p))
diag(graph[[1]]) <- 0

# Simulation --------------------------------------------------------------

#' Each timestep agents are asked for a binary decision about whether a variable
#' is > 0. They form a noisy initial decision based on the true value plus their
#' bias plus noise. They then give their opinion to another agent, and receive
#' another agent's opinion as advice. The advice is integrated according to the
#' current weight placed on the other agent's trustworthiness. This weight is
#' then updated according to whether the agents agree, weighted by the
#' confidence of the deciding agent.

for (d in 1:N$d) {
  rows <- (((d - 1) * N$p):(d * N$p - 1)) + 1
  
  # Truth
  agents$truth[rows] <- rnorm(1)  # single true value for all agents
  
  # Initial decisions
  agents$initial[rows] <- 
    agents$truth[rows] +    # true value
    agents$bias[rows] +     # bias
    rnorm(N$p, 0, 1/agents$sensitivity[rows]) # normally distributed noise with sd = 1/sensitivity
  
  # Advice
  agents$advisor[rows] <- sapply(agents$id[rows], function(i) 
    base::sample((1:N$p)[-i], # never ask yourself!
                 1))
  
  agents$weight[rows] <- diag(graph[[d]][agents$advisor[rows], ])
  
  agents$advice[rows] <- agents$initial[((d - 1) * N$p) + agents$advisor[rows]]
  
  agents$final[rows] <- (agents$initial[rows] * (1 - agents$weight[rows])) +
    (agents$advice[rows] * agents$weight[rows])
  
  # Updating
  newWeights <- as.vector(graph[[d]])
  if (CONF) {
    newWeights[(agents$id[rows] - 1) * N$p + agents$advisor[rows]] <- 
      newWeights[(agents$id[rows] - 1) * N$p + agents$advisor[rows]] +
      ifelse((agents$initial[rows] > 0) == (agents$advice[rows] > 0),
             LEARNING_RATE * abs(agents$initial[rows]), # agree
             -LEARNING_RATE * abs(agents$initial[rows])) # disagree
  } else {
    newWeights[(agents$id[rows] - 1) * N$p + agents$advisor[rows]] <- 
      newWeights[(agents$id[rows] - 1) * N$p + agents$advisor[rows]] + 
      ifelse((agents$initial[rows] > 0) == (agents$advice[rows] > 0),
             LEARNING_RATE, -LEARNING_RATE)
  }
  newWeights <- pmax(0.0001, pmin(1, newWeights))
  newWeights <- matrix(newWeights, N$p, N$p)
  diag(newWeights) <- 0
  graph[[d + 1]] <- newWeights
}

# Results -----------------------------------------------------------------

# Need to check the iGraph node numbers follow the agents$id/graph ones

# transpose
g <- lapply(graph, t)
g <- lapply(graph, graph_from_adjacency_matrix, weighted = T)

weightToColourString <- function() {
  colours <- E(g[[i]])$weight
  
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

plotGraph <- function(i, activeColours = T) {
  
  title <- paste("Advice weights after decision", i - 1)
  
  cuts <- 4
  lines <- c(3, 4, 5, 1) # line weights light->heavy
  
  # discrete weight categories for edges
  weight <- as.numeric(cut(E(g[[i]])$weight, cuts))
  
  # colour lines currently undergoing advice-taking
  # by default use the weight of the connection
  E(g[[i]])$active <- weightToColourString()
  
  plot(g[[i]], 
       main = title,
       layout = layout_in_circle,
       vertex.color = V(g[[i]])$biasColour,
       edge.arrow.size = 0.5,
       edge.width = weight / N$p * 5,
       edge.lty = lines[weight],
       edge.color = E(g[[i]])$active,
       edge.curved = 1 / N$p)
}

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

timeElapsed <- difftime(Sys.time(), timeStart, units = "secs")


printNetworkGraph <- function() {
  par(mfrow = c(1,2))
  plotGraph(1, activeColours = F)
  plotGraph(N$d, activeColours = F)
  invisible(NULL)
}

# Correlation between bias and tie strength
printBiasGraph = function() {
  cors <- NULL
  for (d in 1:N$d) {
    tmp <- g[[d]]
    
    test <- cor.test(as.numeric(tmp[attr = 'sharedBias']), 
                     as.numeric(tmp[attr = 'weight'])) 
    
    cors <- rbind(cors, tibble(decision = d, 
                               r = test$estimate, 
                               p = test$p.value,
                               ciL = test$conf.int[1],
                               ciH = test$conf.int[2]))
  }
  
  # Plot correlation
  corPlot <- cors %>% ggplot(aes(x = decision, 
                                 y = r, ymin = ciL, ymax = ciH,
                                 colour = p < .05)) +
    geom_hline(yintercept = 0, linetype = 'dashed') +
    geom_point() +
    geom_errorbar(width = 0) +
    scale_y_continuous(limits = c(-1, 1)) +
    labs(title = 'Shared bias x Advice weight',
         subtitle = ifelse(CONF, 
                           'Confidence-weighted advisor updating',
                           'Agreement-only advisor updating'),
         caption = settingsStr()) 
  
  print(corPlot)
}

# Correlation between sensitivity and tie strength
printSensitivityGraph <- function() {
  sens <- NULL
  for (d in 1:N$d) {
    tmp <- g[[d]]
    
    # rows give outdegree, columns indegree
    outdeg <- sapply(1:N$p, function(i) {
      w <- tmp[attr = "weight"]
      w <- w[i, ]
      mean(w[-i]) # don't include self weight in average
    })
    indeg <- sapply(1:N$p, function(i) {
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
  
  sensitivityPlot <- sens %>% ggplot(aes(x = decision, 
                                         y = r, ymin = ciL, ymax = ciH,
                                         fill = direction, colour = direction)) +
    geom_hline(yintercept = 0, linetype = 'dashed') +
    geom_ribbon(alpha = .25, colour = NA) +
    geom_line() + 
    # rug plots to show significant divergences from 0 
    geom_rug(data = sens %>% 
               dplyr::filter(p < .05, direction == 'In'), 
             sides = 't', size = N$d / 100 + 1) +
  geom_rug(data = sens %>% 
             dplyr::filter(p < .05, direction == 'Out'), 
           sides = 'b', size = N$d / 100 + 1) +
    scale_y_continuous(limits = c(-1, 1)) +
    labs(title = 'Sensitivity x Mean advice weight',
         subtitle = paste0(ifelse(CONF, 
                                  'Confidence-weighted advisor updating',
                                  'Agreement-only advisor updating'),
                           '\nRug marks show where p < .05'),
         caption = settingsStr())
  
  print(sensitivityPlot)
}

if ('BIAS_X_WEIGHT' %in% OUTPUTS) {
  printBiasGraph()
}

if ('SENSITIVITY_X_WEIGHT' %in% OUTPUTS) {
  printSensitivityGraph()
}

# Animation ---------------------------------------------------------------

if (SAVE_ANIMATION) {
  filename <- paste0(getwd(), '/ACv2/animation/',
                     timeRun,
                     '_agreement-effects.gif')
  
  saveGIF({
    for (i in 1:N$d) plotGraph(i)
    }, 
    movie.name = filename, 
    ani.width = 1024,
    ani.height = 1024,
    # ani.res = 300,
    interval = 0.25, 
    loop = 0)
}

if ('NETWORK_GRAPH' %in% OUTPUTS) {
  printNetworkGraph()
}



     