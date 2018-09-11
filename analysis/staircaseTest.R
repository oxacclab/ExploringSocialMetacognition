# Staircase procedure debugging

## Simulation ####
# first answer is always correct
# 10,000 agents
nAgents <- 1000
pCorrect <- rep(1, nAgents) 
agents <- data.frame(id = 1:nAgents, gen = rep(0, nAgents), pCorrect, correct)
# 250 trials
for(i in 0:250) {
  mask <- agents$gen == i
  agents$correct[mask] <- runif(nAgents) < agents$pCorrect[mask]
  newAgents <- agents[mask, ]
  newAgents$gen <- i+1
  if(i > 0) {
    # staircase
    # mistake - make easier
    newAgents$pCorrect[!newAgents$correct] <- newAgents$pCorrect[!newAgents$correct] + .01
    # 2 hits - make harder
    newAgents$pCorrect[agents$correct[mask] 
                       & agents$correct[agents$gen==(i-1)]] <- newAgents$pCorrect[agents$correct[mask] 
                                                                                  & agents$correct[agents$gen==(i-1)]] - .01
    newAgents$pCorrect[newAgents$pCorrect < 0.00] <- 0.00
    newAgents$pCorrect[newAgents$pCorrect > 1.00] <- 1.00
  }
  agents <- rbind(agents, newAgents)
}

ggplot2::mean_cl_normal(agents$pCorrect[agents$gen==max(agents$gen)])

## Simulation 2 - sigmoid agents ####
sigmoid <- function(s) 1 / (1 + exp(-s))

nAgents <- 1000
difficulty <- rep(-1,nAgents)
agents <- data.frame(id=1:nAgents, gen=rep(0,nAgents), difficulty)

for(i in 0:250) {
  mask <- agents$gen == i
  agents$correct[mask] <- runif(length(mask)) > sigmoid(agents$difficulty[mask])
  newAgents <- agents[mask, ]
  newAgents$gen <- i+1
  if(i > 0) {
    # staircase
    # mistake - make easier
    newAgents$difficulty[!newAgents$correct] <- newAgents$difficulty[!newAgents$correct] - .1
    # 2 hits - make harder
    newAgents$difficulty[agents$correct[mask] 
                         & agents$correct[agents$gen==(i-1)]] <- 
      newAgents$difficulty[agents$correct[mask]
                           & agents$correct[agents$gen==(i-1)]] + .11
  }
  agents <- rbind(agents, newAgents)
}
ggplot2::mean_cl_normal(aggregate(correct ~ id, agents, mean)$correct)


# Simulation 3 - Sigmoid + discrete steps
nAgents <- 1000
difficulty <- rep(-1,nAgents)
agents <- data.frame(id=1:nAgents, gen=rep(0,nAgents), difficulty)

for(i in 0:250) {
  mask <- agents$gen == i
  agents$correct[mask] <- runif(length(mask)) > sigmoid(agents$difficulty[mask])
  newAgents <- agents[mask, ]
  newAgents$gen <- i+1
  if(i > 0) {
    # staircase
    # mistake - make easier
    newAgents$difficulty[!newAgents$correct] <- newAgents$difficulty[!newAgents$correct] - .1
    # 2 hits - make harder
    newAgents$difficulty[agents$correct[mask] 
                         & agents$correct[agents$gen==(i-1)]
                         & agents$difficulty[mask] == agents$difficult[agents$gen==(i-1)]] <- 
      newAgents$difficulty[agents$correct[mask]
                           & agents$correct[agents$gen==(i-1)]
                           & agents$difficulty[mask] == agents$difficult[agents$gen==(i-1)]] + .11
  }
  agents <- rbind(agents, newAgents)
}
ggplot2::mean_cl_normal(aggregate(correct ~ id, agents, mean)$correct)
