# Staircase procedure debugging
library(ggplot2)
graph <- function(df) {
  ggplot(df, aes(x=gen, y=pCorrect, colour=id)) + 
    geom_line(alpha = 0.25) + 
    stat_summary(geom = 'line', fun.y = mean, colour = 'red') +
    stat_summary(geom = 'ribbon', fun.data = mean_cl_normal, colour = NA, fill = 'red', alpha = 0.1) +
    scale_y_continuous(limits=c(0,1),breaks=seq(0,1,.05)) +
    stat_summary(geom = 'ribbon', fun.data = mean_cl_normal, colour = NA, fill = 'red', alpha = 0.05) +
    annotate(geom = 'text', label = c('Mean', 'CL95% Low', 'CL95% High'),
             y = c(.175,.075,.025), x = 230, hjust = 1) +
    annotate(geom = 'text', 
             label = paste(round(mean_cl_normal(df$pCorrect[df$gen==max(df$gen)]),3)),
             y = c(.175,.075,.025), x = 240) +
    theme_light() +
    theme(panel.grid.minor = element_blank(),
          panel.grid.major.x = element_blank(),
          legend.position = 'top') + 
    theme(legend.position = 'none') +
    labs(title = 'Cumulative accuracy plot for simulated agents')
}


## Simulation ####
# first answer is always correct
# 10,000 agents
nAgents <- 20
pCorrect <- rep(1, nAgents) 
agents <- data.frame(id = as.factor(1:nAgents), gen = rep(0, nAgents), pCorrect, correct)
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
                       & agents$correct[agents$gen==(i-1)]
                       & agents$pCorrect[mask] == agents$pCorrect[agents$gen==(i-1)]] <- newAgents$pCorrect[agents$correct[mask] 
                                                                                  & agents$correct[agents$gen==(i-1)]
                                                                                  & agents$pCorrect[mask] == agents$pCorrect[agents$gen==(i-1)]] - .01
    newAgents$pCorrect[newAgents$pCorrect < 0.00] <- 0.00
    newAgents$pCorrect[newAgents$pCorrect > 1.00] <- 1.00
  }
  agents <- rbind(agents, newAgents)
}

ggplot2::mean_cl_normal(agents$pCorrect[agents$gen==max(agents$gen)])
graph(agents)

## Simulation 2 - sigmoid agents ####
sigmoid <- function(s) 1 / (1 + exp(-s))

nAgents <- 20
difficulty <- rep(-1,nAgents)
agents <- data.frame(id=as.factor(1:nAgents), gen=rep(0,nAgents), difficulty)

for(i in 0:250) {
  mask <- agents$gen == i
  agents$correct[mask] <- runif(length(mask)) > sigmoid(agents$difficulty[mask])
  agents$pCorrect[mask] <- sapply(agents$id[mask], function(id) mean(agents$correct[agents$id==id]))
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
                           & agents$correct[agents$gen==(i-1)]] + .1
  }
  agents <- rbind(agents, newAgents)
}
ggplot2::mean_cl_normal(aggregate(correct ~ id, agents, mean)$correct)
graph(agents)


# Simulation 3 - Sigmoid + discrete steps
nAgents <- 20
difficulty <- rep(-1,nAgents)
agents <- data.frame(id=as.factor(1:nAgents), gen=rep(0,nAgents), difficulty)

for(i in 0:250) {
  mask <- agents$gen == i
  agents$correct[mask] <- runif(length(mask)) > sigmoid(agents$difficulty[mask])
  agents$pCorrect[mask] <- sapply(agents$id[mask], function(id) mean(agents$correct[agents$id==id]))
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
                           & agents$difficulty[mask] == agents$difficult[agents$gen==(i-1)]] + .1
  }
  agents <- rbind(agents, newAgents)
}
ggplot2::mean_cl_normal(aggregate(correct ~ id, agents, mean)$correct)
graph(agents)


#Learning effects?