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
library(parallel)


# cluster variables -------------------------------------------------------

effectSizes <- list()
es <- c(.1, .3, .7)
ns <- c(20, 50, 100, 500)
for (a in es) {
  for (b in es) {
    for (n in ns) {
      effectSizes[[length(effectSizes) + 1]] <- tibble(a, b, n)
    }
  }
}


# cluster function --------------------------------------------------------

runSim <- function(props) {
  d <- tibble::tibble(p = rep(seq(props$n), each = 2), # participant numbers
                      sigma = rep(abs(rnorm(props$n)), each = 2), # each participant gets idiosynratic noise
                      Group = rep(seq(2), times = props$n) - 1,
                      Q = rep(rnorm(props$n), each = 2) + # intercept
                        props$a * Group + # group effect
                        rnorm(props$n * 2, sd = sigma), # error
                      WoA = rep(rnorm(props$n), each = 2) + 
                        props$b * Q +
                        rnorm(props$n * 2, sd = sigma))
  
  # mediation analysis
  result <- BayesMed::jzs_med(independent = d$Group, 
                              dependent = d$WoA, 
                              mediator = d$Q)
  
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
  grid <- rbind(grid, tibble(a = x$props$a, b = x$props$b, n = x$props$n,
                             bf = x$result$main_result$BF[4]))
}

# heatmap 
for (n in unique(grid$n)) {
  print(
    ggplot(grid[grid$n == n, ], aes(a, b, fill = log(bf))) +
      geom_tile(colour = "white") +
      scale_fill_gradient2() +
      labs(x = "Group -> Q", y = "Q -> WoA",
           title = "BF for mediation of Group -> WoA relationship",
           subtitle = paste("n =", n))
  )
}

