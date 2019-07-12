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

# make data ---------------------------------------------------------------

effectSizes <- tibble(a = c(.1, .3, .7),
                      b = c(.1, .3, .7),
                      c = c(.1, .3, .7))

n <- 500

simData <- tibble(p = rep(seq(n), each = 2), # participant numbers
                  sigma = rep(abs(rnorm(n)), each = 2), # each participant gets idiosynratic noise
                  Group = rep(seq(2), times = n),
                  Q = rep(rnorm(n), each = 2) + # intercept
                    effectSizes$a[2] * Group + # group effect
                    rnorm(n * 2, sigma), # error
                  WoA = rep(rnorm(n), each = 2) + 
                    effectSizes$b[2] * Q +
                    effectSizes$c[2] * Group +
                    rnorm(n * 2, sigma))

# run bayes ---------------------------------------------------------------


# show results ------------------------------------------------------------


