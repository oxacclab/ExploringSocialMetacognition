## Binary dates task - participant accuracy and agreeing advisor accuracy
## Matt Jaquiery
## May 2020

# We want to know how accurate participants have been historically on the binary
# version of the dates task. We can then use this information to roughly balance
# dis/agreeing advisors for accuracy.

library(tidyverse)

source("./ACv2/src/00_Functions.R")

theme_set(theme_light())

pattern <- "_AdvisedTrial.csv$"

fs <- listServerFiles(c("calibrationKnowledge", "confidenceEstimation"))
fs <- fs[str_detect(fs, pattern)]

d <- NULL

for (f in fs) {
  tmp <- read.csv(f) %>% 
    as_tibble() %>%
    filter(responseAnswerSide %in% c(0, 1)) %>%
    transmute(
      studyId, 
      studyVersion, 
      study = paste0(studyId, '_', studyVersion),
      pid, 
      uid = paste0(study, '_', pid),
      responseAnswerSide = as.numeric(as.character(responseAnswerSide)), 
      correctAnswerSide = as.numeric(as.character(correctAnswerSide)), 
      stimHTML, 
      anchorDate = as.numeric(as.character(anchorDate)), 
      correctAnswer = as.numeric(as.character(correctAnswer)),
      difference = abs(anchorDate - correctAnswer),
      correct = responseAnswerSide == correctAnswerSide
    )
    
  d <- bind_rows(
    d,
    tmp
  )
}

d %>% summarise_if(~ is.numeric(.) | is.logical(.), mean)

tmp <- d %>% group_by(uid) %>%
  summarise(mean_correct = mean(correct), n = n()) 

ggplot(tmp, aes(x = "", y = mean_correct)) +
  geom_violin(fill = 'black', colour = NA, alpha = .1) +
  geom_boxplot(width = .2, outlier.color = NA) +
  geom_point(position = position_jitter(width = .5), alpha = .25,
             aes(size = n)) +
  geom_hline(yintercept = mean(tmp$mean_correct), linetype = 'dashed') +
  annotate(geom = 'label', 
           label = paste0('mean = ', round(mean(tmp$mean_correct), 3)), 
           x = Inf, y = mean(tmp$mean_correct), hjust = 1) +
  scale_y_continuous(limits = c(0, 1))


# Simulate advisor agreement matched for accuracy -------------------------

# weighted accuracy is pretty similar to unweighted
pAccW <- sum(tmp$mean_correct * tmp$n) / sum(tmp$n) 
# so we'll use unweighted
pAcc <- mean(tmp$mean_correct)

s <- crossing(
  agreeCor = seq(0, 1, 0.05),
  agreeIncor = seq(0, 1, 0.05)
) %>%
  mutate(pCor = pAcc * agreeCor + (1 - pAcc) * (1 - agreeIncor),
         totalAgr = agreeCor * pAcc + (1 - pAcc) * agreeIncor)

targetAcc <- .70
tolerance <- .02

# pCorrect of advisors
ggplot(s, aes(x = agreeCor, y = agreeIncor)) + 
  geom_tile(aes(fill = pCor > targetAcc - tolerance & pCor < targetAcc + tolerance)) +
  geom_text(aes(label = round(pCor, 2)), size = 3) +
  theme(legend.position = 'top') +
  coord_fixed()

s %>% filter(
  pCor > targetAcc - tolerance & pCor < targetAcc + tolerance
) %>% 
  ggplot(aes(x = agreeCor, y = agreeIncor)) +
  geom_tile(aes(fill = totalAgr)) + 
  geom_text(aes(label = round(totalAgr, 3))) 

# A nice balance is obtained by using advisors who agree contingent on correctness
# and have an overall accuracy of around 70%. 
#
# The advisors' agreements are:
# Cor | InCor | Total
# .75 | .35   | .59
# .90 | .65   | .80

ggplot(s, aes(x = agreeCor, y = agreeIncor)) + 
  geom_tile(aes(fill = pCor)) +
  geom_text(aes(label = round(pCor, 2)), size = 3) +
  coord_fixed()
ggplot(s, aes(x = agreeCor, y = agreeIncor)) + 
  geom_tile(aes(fill = totalAgr)) +
  geom_text(aes(label = round(totalAgr, 2)), size = 3) +
  coord_fixed()
