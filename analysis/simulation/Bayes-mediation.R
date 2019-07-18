# Simulations for questionnaire data mediating group->WoA relationship
# Matt Jaquiery, July 2019

# Simulation is of a mediation analysis with following paths 
# (notation following Kenney, 2018: http://davidakenny.net/cm/mediate.htm):
# 
# a: effect of Group on Questionnaire Rating
# b: effect of Questionnaire Rating on Weight on Advice
# c: effect of Group on Weight on Advice (unadjusted)
# cPrime: effect of Group on Weight on Advice (adjusted for mediation)
#
# Note: 'Group' refers to whether the advisor has the same group as the judge

# dependencies ------------------------------------------------------------
library(BayesMed)
library(tibble)
library(ggplot2)
library(scales)
library(parallel)


# cluster variables -------------------------------------------------------

effectSizes <- list()
es <- c(.1, .3, .7)
ns <- c(20, 50, 100, 200)
reps <- 20
for (a in es) {
  for (b in es) {
    for (cPrime in es[1:2]) { # we don't expect a strong effect here
      for (n in ns) {
        for (i in seq(reps)) {
          effectSizes[[length(effectSizes) + 1]] <- tibble(a, b, cPrime, n, i)
        }
      }
    }
  }
}


# cluster function --------------------------------------------------------

runSim <- function(props) {
  
  print(props)
  
  # Assumptions about data structure
  qMean <- 45
  qSD <- 20
  woaMean <- .48
  woaSD <- .40
  
  d <- tibble::tibble(p = rep(seq(props$n), each = 2), # participant numbers
                      Group = rep(seq(2), times = props$n) - 1,
                      Q = qMean + # intercept 
                        props$a * Group * qSD + # group effect
                        rnorm(props$n * 2, sd = qSD), # random error
                      WoA = woaMean + 
                        props$cPrime * Group * woaSD + 
                        props$b * scale(Q)[, 1] * woaSD +
                        rnorm(props$n * 2, sd = woaSD))
  
  # cap WoA scores
  d$WoA[d$WoA < 0] <- 0
  d$WoA[d$WoA > 1] <- 1
  
  d$Q[d$Q < 0] <- 0
  d$Q[d$Q > 100] <- 100
  
  # mediation analysis
  result <- NULL
  maxTries <- 10
  
  for (i in seq(maxTries)) {
    tryCatch(
      result <- BayesMed::jzs_med(independent = d$Group, 
                                  dependent = d$WoA, 
                                  mediator = d$Q,
                                  standardize = T),
      error = function(e) print(paste("Error:", e)),
      silent = T
    )
    
    if (!is.null(result))
      break()
  }

  if (is.null(result)) 
    stop(paste("Maximum tries exceeded for simulation with data:\n",
               "a =", props$a, "\nb =", props$b, "\ncPrime =", props$cPrime,
               "\nn =", props$n))
  
  list(props = props, data = d, result = result)
}


# run in parallel ---------------------------------------------------------

nCores <- detectCores() - 4
cl <- makeCluster(nCores)

startTime <- Sys.time()
output <- clusterApply(cl, effectSizes, fun = runSim)
print(paste0("Time elapsed: ", Sys.time() - startTime))

# show results ------------------------------------------------------------

grid <- NULL

for (x in output) {
  grid <- rbind(grid, tibble(a = x$props$a, 
                             b = x$props$b, 
                             cPrime = x$props$cPrime,
                             n = x$props$n,
                             bf = x$result$main_result$BF[4]))
}

grid <- aggregate(bf ~ ., grid, mean)

# heatmap 
ggplot(grid, aes(a, b, fill = log(bf))) +
  geom_tile(colour = "white") +
  scale_fill_gradient2(limits = c(-3, 3), oob = squish) +
  facet_grid(cPrime ~ n, labeller = label_both) +
  labs(x = "Group -> Q", y = "Q -> WoA",
       title = "BF for mediation of Group -> WoA relationship",
       subtitle = "[log(1/3) = -1.1; log(3) = 1.1]")

