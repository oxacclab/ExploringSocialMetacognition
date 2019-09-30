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
  n <- list(p = 6, d = 200) # numbers of participants and decisions
  conf <- T                 # whether to use confidence-weighted adivsor update
  biasMean <- 1             # +/- mean for bias distributions
  lambda <- .1              # learning rate
  saveAnimation <- T        # whether to save an animation
  NULL
}

if (!any(grepl('^conf$', ls()))) {
  setParams()
}

timeRun <- format(Sys.time(), "%F_%H-%M-%S")

settingsStr <- function() {
  paste0('Model parameters:\n',
         'Agents = ', n$p, '; Decision = ', n$d, '; ',
         'ConfidenceWeighted = ', conf, '; ',
         'BiasMean = +/-', biasMean, '; ',
         'Learning rate = ', lambda, '\n',
         'Model run ', timeRun)
}

bias <- ifelse(runif(n$p) > .5, rnorm(n$p, biasMean), rnorm(n$p, -biasMean))

agents <- tibble(id = rep(1:n$p, n$d),
                 decision = rep(1:n$d, each = n$p),
                 bias = rep(bias[order(bias)], n$d),
                 truth = NA,
                 initial = NA,
                 advisor = NA,
                 advice = NA,
                 weight = NA,
                 final = NA)

graph <- list(matrix(as.numeric(cut(runif(n$p ^ 2), 3))/3, n$p, n$p))
diag(graph[[1]]) <- 0

# Simulation --------------------------------------------------------------

#' Each timestep agents are asked for a binary decision about whether a variable
#' is > 0. They form a noisy initial decision based on the true value plus their
#' bias plus noise. They then give their opinion to another agent, and receive
#' another agent's opinion as advice. The advice is integrated according to the
#' current weight placed on the other agent's trustworthiness. This weight is
#' then updated according to whether the agents agree, weighted by the
#' confidence of the deciding agent.

for (d in 1:n$d) {
  rows <- (((d - 1) * n$p):(d * n$p - 1)) + 1
  
  # Truth
  agents$truth[rows] <- rnorm(1)
  
  # Initial decisions
  agents$initial[rows] <- agents$truth[rows] + agents$bias[rows] + rnorm(n$p)
  
  # Advice
  agents$advisor[rows] <- sapply(agents$id[rows], function(i) 
    base::sample((1:n$p)[-i], # never ask yourself!
                 1))
  
  agents$weight[rows] <- diag(graph[[d]][agents$advisor[rows], ])
  
  agents$advice[rows] <- agents$initial[((d - 1) * n$p) + agents$advisor[rows]]
  
  agents$final[rows] <- (agents$initial[rows] * (1 - agents$weight[rows])) +
    (agents$advice[rows] * agents$weight[rows])
  
  # Updating
  newWeights <- as.vector(graph[[d]])
  if (conf) {
    newWeights[(agents$id[rows] - 1) * n$p + agents$advisor[rows]] <- 
      newWeights[(agents$id[rows] - 1) * n$p + agents$advisor[rows]] +
      ifelse((agents$initial[rows] > 0) == (agents$advice[rows] > 0),
             lambda * abs(agents$initial[rows]), # agree
             -lambda * abs(agents$initial[rows])) # disagree
  } else {
    newWeights[(agents$id[rows] - 1) * n$p + agents$advisor[rows]] <- 
      newWeights[(agents$id[rows] - 1) * n$p + agents$advisor[rows]] + 
      ifelse((agents$initial[rows] > 0) == (agents$advice[rows] > 0),
             lambda, -lambda)
  }
  newWeights <- pmax(0.0001, pmin(1, newWeights))
  newWeights <- matrix(newWeights, n$p, n$p)
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

biasToColourString <- function(b, colour = c('r', 'g', 'b'), 
                               maxVal = 2.5, minVal = 0,
                               minSaturation = .1, maxSaturation = .9) {
  x <- abs(b) %>%
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
       edge.width = weight / n$p * 5,
       edge.lty = lines[weight],
       edge.color = E(g[[i]])$active,
       edge.curved = 1 / n$p)
}

for (i in 1:n$d) {
  
  active <- rep(0, n$p * n$p)
  # fill in colour for active advice (vectorised)
  active[0:(n$p - 1) * n$p + agents$advisor[agents$decision == i]] <- 'green'
  
  active <- matrix(active, n$p, n$p)
  active <- t(active)
  active <- as.character(active)
  # drop reciprocal connections
  active <- active[-(seq(1, n$p * n$p, n$p) + 0:(n$p - 1))]
  # overwrite active connections
  E(g[[i]])$active[active != 0] <- active[active != 0]
  
  # Bias difference
  E(g[[i]])$headBias <- agents$bias[head_of(g[[i]], E(g[[i]]))]
  E(g[[i]])$tailBias <- agents$bias[tail_of(g[[i]], E(g[[i]]))]
  E(g[[i]])$sharedBias <- abs(E(g[[i]])$headBias) + 
    abs(E(g[[i]])$tailBias) * 
    ifelse((E(g[[i]])$headBias < 0) == (E(g[[i]])$tailBias < 0), 1, -1)
  
  # colour vertices by bias
  V(g[[i]])$bias <- agents$bias[1:n$p]
  V(g[[i]])$biasColour <- ifelse(agents$bias[1:n$p] > 0, 
                                 biasToColourString(agents$bias[1:n$p], 'b'),
                                 biasToColourString(agents$bias[1:n$p], 'r'))
}

# Correlation between bias and tie strength
cors <- NULL
for (d in 1:n$d) {
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
  geom_point() +
  geom_errorbar(width = 0) +
  scale_y_continuous(limits = c(-1, 1)) +
  labs(title = 'Shared bias x Advice weight',
       subtitle = ifelse(conf, 
                         'Confidence-weighted advisor updating',
                         'Agreement-only advisor updating'),
       caption = settingsStr()) 

print(corPlot)

# Animation ---------------------------------------------------------------

if (saveAnimation) {
  filename <- paste0(getwd(), '/ACv2/animation/',
                     timeRun,
                     '_agreement-effects.gif')
  
  saveGIF({
    for (i in 1:n$d) plotGraph(i)
    }, 
    movie.name = filename, 
    ani.width = 1024,
    ani.height = 1024,
    # ani.res = 300,
    interval = 0.25, 
    loop = 0)
}

par(mfrow = c(1,2))
plotGraph(1, activeColours = F)
plotGraph(n$d, activeColours = F)


     