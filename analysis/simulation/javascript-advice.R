## Advice analysis
## Matt Jaquiery, May 2020
## 
## I finally got around to implementing a data dump in JavaScript to output a 
## summary of advice for each advisor on each trial. We can examine this dump
## to look at advisors' advice pattern statistics.

# Load data
library(jsonlite)
library(tidyverse)
library(ggridges)

json <- fromJSON('simulation/tmp.json') %>% as_tibble() %>%
  select(-blueprint, -log, -adviceProfile) %>%
  filter(idDescription != "Practice",
         blockType == "core")

experiment <- json$studyName[1]
print(paste0("Experiment: ", experiment))

binary <- "correctAnswerSide" %in% names(json)

if ('iteration' %in% names(json)) {
  json$iteration <- factor(json$iteration)
} else {
  json$iteration <- factor(1)
}
  
json$error <- abs(json$correctAnswer - json$adviceCentre)

its <- sample(json$iteration, 10)
json %>% 
  filter(iteration %in% its) %>%
  ggplot(aes(error, iteration)) +
  geom_density_ridges(colour = NA, aes(fill = idDescription), alpha = .5)

if (binary) {
  json$correct <- json$correctAnswerSide == json$adviceSide
  tmp <- json %>% 
    filter(blockNumber == 2) %>%
    group_by(idDescription, iteration) %>% 
    summarise(correct = mean(correct)) 
  
  bad <- tmp %>% 
    ungroup() %>%
    mutate(idDescription = factor(idDescription)) %>%
    spread(idDescription, correct) %>% 
    .[.[, 2] < .[, 3], ]  %>% # select rows where high* < low*
    gather("idDescription", "correct", -iteration)
  
  print(
    ggplot(tmp, aes(x = idDescription, y = correct, colour = idDescription)) +
      geom_line(aes(group = iteration), alpha = .1, colour = 'black') +
      geom_line(aes(group = iteration), alpha = 1, colour = 'black', data = bad) +
      geom_point(alpha = .1) +
      stat_summary(geom = 'point', fun.y = mean, size = 4, shape = 16) +
      stat_summary(geom = 'errorbar', fun.data = mean_cl_normal, width = 0) +
      scale_y_continuous(limits = c(NA, 1)) +
      labs(caption = paste0(
        "iterations: ", nrow(tmp), "; trialsPerAdvisor: ", 
        json %>% 
          filter(blockNumber < 4) %>%
          group_by(iteration, idDescription) %>% 
          summarise(n = n()) %>% 
          pull(n) %>% 
          mean()
      ))
    )
  
  tmp %>% 
    nest(data = -idDescription) %>%
    mutate(mean_correct = map(data, ~ mean_cl_normal(.$correct))) %>% 
    unnest(cols = mean_correct, names_sep = "_") %>%
    select(-data) %>%
    print()
  
  print(paste0('Bad experience rate: ', round(nrow(bad) / nrow(tmp), 4) * 100, "%"))
  
  print('Accuracy difference experience')
  tmp <- tmp %>% 
    nest(data = -iteration) %>%
    mutate(acc_difference = map_dbl(data, function(x) {
      x <- group_by(x, idDescription) %>% 
        summarise(correct = mean(correct)) %>% 
        spread(idDescription, correct) 
      unlist(x[, 1] - x[, 2])
    }) 
    ) %>%
    pull(acc_difference)
  tmp %>% 
    mean_cl_normal()
  print(
    ggplot(enframe(tmp, value = "acc_difference"), aes(x = "", y = acc_difference)) + 
      geom_hline(yintercept = 0, linetype = 'dashed') +
      geom_violin(colour = NA, fill = 'grey85') +
      geom_point(position = position_jitter(.1), alpha = .1)
    )
}

if ('responseAnswerSide' %in% names(json)) {
  json$agree <- json$responseAnswerSide == json$adviceSide
  json$initialCorrect <- json$responseAnswerSide == json$correctAnswerSide
  tmp <- json %>% 
    filter(blockNumber == 2) %>%
    group_by(idDescription, iteration) %>% 
    summarise(agree = mean(agree), n = n()) 
  
  bad <- tmp %>% 
    ungroup() %>%
    mutate(idDescription = factor(idDescription)) %>%
    spread(idDescription, agree) %>% 
    .[.[, 2] < .[, 3], ]  %>% # select rows where high* < low*
    gather("idDescription", "agree", -iteration)
  
  print(
    ggplot(tmp, aes(x = idDescription, y = agree, colour = idDescription)) +
      geom_line(aes(group = iteration), alpha = .1, colour = 'black') +
      geom_line(aes(group = iteration), alpha = 1, colour = 'black', data = bad) +
      geom_point(alpha = .1) +
      stat_summary(geom = 'point', fun.y = mean, size = 4, shape = 16) +
      stat_summary(geom = 'errorbar', fun.data = mean_cl_normal, width = 0) +
      scale_y_continuous(limits = c(0, 1)) +
      labs(caption = paste0(
        "iterations: ", length(unique(tmp$iteration)), "; trialsPerAdvisor: ", 
        json %>% 
          filter(blockNumber < 4) %>%
          group_by(iteration, idDescription) %>% 
          summarise(n = n()) %>% 
          pull(n) %>% 
          mean()
      ))
  )
  
  tmp %>% 
    nest(data = -idDescription) %>%
    mutate(mean_agree = map(data, ~ mean_cl_normal(.$agree)),
           nTrials = map_dbl(data, ~ mean(.$n))) %>% 
    unnest(cols = mean_agree, names_sep = "_") %>%
    select(-data) %>%
    print()
  
  json %>% 
    filter(blockNumber < 4) %>% 
    nest(data = c(-idDescription, -initialCorrect)) %>%
    mutate(mean_agree = map(data, ~ mean_cl_normal(.$agree)),
           nTrials = map_dbl(data, ~ group_by(., iteration) %>% 
                               summarize(n = n()) %>% 
                               pull(n) %>% 
                               mean())
           ) %>% 
    unnest(cols = mean_agree, names_sep = "_") %>%
    select(-data) %>%
    print()
}

# Accuracy by participant accuracy
json %>% 
  filter(blockNumber < 4) %>%
  group_by(idDescription, iteration) %>% 
  summarise(correct = mean(correct), initialCorrect = mean(initialCorrect)) %>%
  ggplot(aes(x = initialCorrect, y = correct, colour = idDescription)) +
  geom_vline(xintercept = .6, linetype = 'dashed') +
  geom_hline(yintercept = .7, linetype = 'dashed') +
  geom_smooth(method = 'lm', alpha = .15) + 
  geom_point(alpha = .1, position = position_jitter(.05, .05)) +
  scale_x_continuous(limits = c(0, 1)) +
  scale_y_continuous(limits = c(0, 1)) +
  coord_fixed() +
  theme_light()
  