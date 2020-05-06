# Presentation figures for confirmation of status

library(tidyverse)
setwd("ACv2")
src <- "src/02_Exclusions.R"
skipLoadData <- F
dfs <- list()

# Collate the info for each of the egocentric discounting studies

studyName <- "minGroups"
studyVersion <- c("1-2-0", "2-0-1")

exclude <- list(
    maxAttnCheckFails = 0, # pass all attn checks
    requireGroupAttnCheck = T, # get the which group Q right
    requireComplete = T,   # complete experiment
    maxTrialRT = 60000,    # trials take < 1 minute
    minTrials = 11,        # at least 11 trials completed
    minChangeRate = .1,    # some advice taken on 10%+ of trials
    participantOutliers = data.frame(
      varName = c("timeEnd", "responseError", "responseCorrect"),
      zThresh = 3),        # |z-score| for these variables < 3
    multipleAttempts = T)  # exclude multiple attempts

source(src)
AdvisedTrial$study <- "Minimal groups"
dfs$minGroups <- AdvisedTrial
rm('AdvisedTrial')

studyName <- "directBenevolence"
studyVersion <- c("1-3-0", "2-0-0", "2-1-0")

exclude <- list(
  maxAttnCheckFails = 0, # pass all attn checks
  maxTrialRT = 60000,    # trials take < 1 minute
  minTrials = 11,        # at least 11 trials completed
  minChangeRate = .1,    # some advice taken on 10%+ of trials
  multipleAttempts = T   # exclude multiple attempts
) 

overrideMarkerList <- c(11)
source(src)
AdvisedTrial$study <- "Direct"
dfs$directBenevolence <- AdvisedTrial
rm('AdvisedTrial')

# Direct benevolence with questionnaires for advice ratings
studyVersion <- c("3-0-0", "3-0-1")
exclude$qqLableWhitelist = c(  # Advice questionnaire responses must be one of:
  'Deceptive',
  'Possibly Deceptive',
  'Honest'
)
source(src)
AdvisedTrial$study <- "Advice ratings"
dfs$directBenevolenceQ <- AdvisedTrial
rm('AdvisedTrial')

studyVersion <- c("0-0-1")
studyName <- "directBenevolenceContexts"
source(src)
AdvisedTrial$study <- "Context"
# Doesn't bind nicely, so don't bind but instead we'll keep it in the workspace as AdvisedTrial
# dfs$directBenevolenceContext <- AdvisedTrial
# rm('AdvisedTrial')

setwd('..')

# Trim data frames and combine
d <- NULL
for (x in rev(dfs)) 
  d <- bind_rows(d, x)

d$studyUID <- paste0(d$studyId, 'v', d$studyVersion)

d <- d %>% 
  filter(!feedback) %>%
  mutate(
    Study = factor(study, levels = c("Minimal groups", "Direct", "Advice ratings", "Context")),
    Advisor = advisor0idDescription,
    Feedback = if_else(feedback, "Feedback", "No feedback"),
    Feedback = factor(Feedback, levels = c("No feedback", "Feedback")),
    Honest = if_else(advisor0questionnaireHonestyLabel == "Honest", "Honest", "Other"),
    pid = paste0(pid, '.', studyUID),
    woa = advisor0woa
    ) %>%
  select(pid, studyUID, studyVersion, Study, Advisor, Feedback, woa, Honest)

theme_set(theme_light() +
            theme(
              panel.grid = element_blank(),
              legend.position = 'top'
            ))

for (s in unique(d$Study)) {
  gg <- d %>%
    filter(Study == s) %>%
    group_by(pid, studyUID, studyVersion, Study, Advisor, Feedback) %>%
    summarise(woa = mean(woa, na.rm = T)) %>%
    ggplot(aes(x = Advisor, y = woa)) +
    geom_violin(colour = NA, fill = "grey90") +
    geom_boxplot(fill = "white", outlier.color = NA, width = .15, size = 1.25) +
    geom_line(alpha = .25, aes(group = pid)) + 
    stat_summary(geom = 'line', aes(group = 1, linetype = "Mean"), 
                 fun.y = mean, size = 1.25) +
    scale_y_continuous(limits = c(0, 1)) +
    scale_linetype_manual(values = "dotted") +
    facet_grid(Feedback ~ Study + studyVersion) +
    theme(text = element_text(size = 16),
          axis.text.x = element_text(size = 10),
          panel.grid = element_blank(),
          legend.position = "top") +
    labs(x = "Advisor", y = "Weight on advice")
  print(gg)
}

for (s in "Advice ratings") {
  gg <- d %>%
    filter(Study == s,
           Honest == "Honest") %>%
    group_by(pid, studyUID, studyVersion, Study, Advisor, Feedback, Honest) %>%
    summarise(woa = mean(woa, na.rm = T)) %>%
    ggplot(aes(x = Advisor, y = woa)) +
    geom_violin(colour = NA, fill = "grey90") +
    geom_boxplot(fill = "white", outlier.color = NA, width = .15, size = 1.25) +
    geom_line(alpha = .25, aes(group = pid)) +
    stat_summary(geom = 'line', aes(group = 1, linetype = "Mean"),
                 fun.y = mean, size = 1.25) +
    scale_y_continuous(limits = c(0, 1)) +
    scale_linetype_manual(values = "dotted") +
    facet_grid(Feedback ~ Study + studyVersion + Honest) +
    theme(text = element_text(size = 16),
          axis.text.x = element_text(size = 10),
          panel.grid = element_blank(),
          legend.position = "top") +
    labs(x = "Advisor", y = "Weight on advice")
  print(gg)
}

AdvisedTrial <- AdvisedTrial %>%
  mutate(
    Advisor = advisor0idDescription,
    Feedback = if_else(feedback, "Feedback", "No feedback"),
    Feedback = factor(Feedback, levels = c("No feedback", "Feedback")),
    Honest = if_else(advisor0questionnaireHonestyLabel == "Honest", "Honest", "Other"),
    woa = advisor0woa
  ) 

AdvisedTrial %>%
  group_by(pid, studyId, studyVersion, Advisor, Feedback, Honest) %>%
  summarise(woa = mean(woa, na.rm = T)) %>%
  ggplot(aes(x = Advisor, y = woa)) +
  geom_violin(colour = NA, fill = "grey90") +
  geom_boxplot(fill = "white", outlier.color = NA, width = .15, size = 1.25) +
  geom_line(alpha = .25, aes(group = pid)) +
  stat_summary(geom = 'line', aes(group = 1, linetype = "Mean"),
               fun.y = mean, size = 1.25) +
  scale_y_continuous(limits = c(0, 1)) +
  scale_linetype_manual(values = "dotted") +
  facet_grid(Feedback ~ studyId + studyVersion) +
  theme(text = element_text(size = 16),
        axis.text.x = element_text(size = 10),
        panel.grid = element_blank(),
        legend.position = "top") +
  labs(x = "Advisor", y = "Weight on advice")

AdvisedTrial %>%
  filter(Honest == "Honest") %>%
  group_by(pid, studyId, studyVersion, Advisor, Feedback, Honest) %>%
  summarise(woa = mean(woa, na.rm = T)) %>%
  ggplot(aes(x = Advisor, y = woa)) +
  geom_violin(colour = NA, fill = "grey90") +
  geom_boxplot(fill = "white", outlier.color = NA, width = .15, size = 1.25) +
  geom_line(alpha = .25, aes(group = pid)) +
  stat_summary(geom = 'line', aes(group = 1, linetype = "Mean"),
               fun.y = mean, size = 1.25) +
  scale_y_continuous(limits = c(0, 1)) +
  scale_linetype_manual(values = "dotted") +
  facet_grid(Feedback ~ studyId + studyVersion + Honest) +
  theme(text = element_text(size = 16),
        axis.text.x = element_text(size = 10),
        panel.grid = element_blank(),
        legend.position = "top") +
  labs(x = "Advisor", y = "Weight on advice")

# Bayes factors for key comparisons

f <- function(x) {
  require(BayesFactor)
  x <- x %>% 
    group_by(pid, Advisor) %>% 
    summarise(woa = mean(woa, na.rm = T))
  out <- tibble(n = nrow(x))
  tmp <- list()
  for (i in 1:length(unique(x$Advisor))) {
    a <- unique(x$Advisor)[i]
    out[, paste0('advisor.', i)] <- a
    tmp[[i]] <- x %>% filter(Advisor == a)
    out[, paste0('mean.', i)] <- tmp[[i]] %>% pull(woa) %>% mean(na.rm = T)
  }
  # ensure paired
  okay <- base::intersect(pull(tmp[[1]], pid), pull(tmp[[2]], pid))
  nDrop <- length(unique(x$pid)) - length(okay)
  if (nDrop) {
    warning(paste0("Dropping ", nDrop, " participants lacking paired observations."))
    for (i in 1:length(tmp))
      tmp[[i]] <- tmp[[i]] %>% filter(pid %in% okay)
  }
  out$n <- length(unique(tmp[[1]]$pid))
  
  bf <- ttestBF(pull(tmp[[1]], woa), pull(tmp[[2]], woa), paired = T)
  out$bf <- exp(bf@bayesFactor$bf)
  out
}

d %>% 
  filter(Feedback == "No feedback") %>%
  nest(data = c(-studyUID)) %>%
  mutate(data = map(data, f)) %>%
  unnest(data)

d %>% 
  filter(Feedback == "No feedback", Honest == "Honest") %>%
  nest(data = c(-studyUID)) %>%
  mutate(data = map(data, f)) %>%
  unnest(data)

f(AdvisedTrial)
f(AdvisedTrial %>% filter(Honest == "Honest"))


# Calibration knowledge figures -------------------------------------------
if (F) {
  setwd("ACv2")
  rm('AdvisedTrial')
  
  studyVersion <- "0-0-10"
  studyName <- "confidenceExploration"
  
  exclude <- list(
    maxTrialRT = 60000,    # trials take < 1 minute
    minTrials = 11,        # at least 11 trials completed
    minChangeRate = .1     # some advice taken on 10%+ of trials
  ) 
  
  source(src)
  AdvisedTrial$study <- "SingleMass"
  df <- bind_rows(AdvisedTrial)
  rm('AdvisedTrial')
  
  studyVersion <- c("0-0-18", "0-1-3")
  studyName <- "calibrationKnowledge"
  
  exclude <- list(
    maxTrialRT = 60000,    # trials take < 1 minute
    minTrials = 11,        # at least 11 trials completed
    minChangeRate = .1,    # some advice taken on 10%+ of trials
    custom = list(
      keyTrialCount = 
        # Each participant should have 16 Key trials
        function(x) {
          # Handle Apple mixing up the actualType and actualTypeFlag columns!
          x %>% 
            filter(str_detect(paste0(advisor0actualType, advisor0actualTypeFlag), # Safari switched type and flag fields in v0.1.3  
                              "binary-(dis)?agree-cheat-confidence")) %>%
            summarise(n = n()) %>%
            pull() != 16
        }
    )
  ) 
  
  source(src)
  AdvisedTrial$study <- "Calibration"
  
  tmp <- AdvisedTrial %>% 
    transmute(type = if_else(str_detect(advisor0actualType, 'binary'),
                             advisor0actualType, advisor0actualTypeFlag),
              flag = if_else(str_detect(advisor0actualType, 'binary'),
                             as.numeric(advisor0actualTypeFlag), 
                             as.numeric(advisor0actualType)))
  AdvisedTrial <- AdvisedTrial %>% 
    select(-contains('Type')) %>% 
    mutate(
      advisor0actualType = tmp$type,
      advisor0actualTypeFlag = tmp$flag
    )
  
  df <- bind_rows(df, AdvisedTrial)
  
  setwd("..")
  
  df <- df %>%
    mutate(
      Advisor = advisor0idDescription,
      Feedback = if_else(feedback, "Feedback", "No feedback"),
      Feedback = factor(Feedback, levels = c("No feedback", "Feedback"))
    ) 
  # obtain advisor0influence values from discrete advisor values
  df$influence <- unlist(
    sapply(1:nrow(df), 
           function(i) df[i, paste0(df$advisor0idDescription[i], '.influence')])
  )
  
  
  df %>%
    group_by(pid, studyId, studyVersion, Advisor, Feedback) %>%
    summarise(influence = mean(influence, na.rm = T)) %>%
    ggplot(aes(x = Advisor, y = influence)) +
    geom_violin(colour = NA, fill = "grey90") +
    geom_boxplot(fill = "white", outlier.color = NA, width = .15, size = 1.25) +
    geom_line(alpha = .25, aes(group = pid)) +
    stat_summary(geom = 'line', aes(group = 1, linetype = "Mean"),
                 fun.y = mean, size = 1.25) +
    scale_y_continuous(limits = c(0, 1)) +
    scale_linetype_manual(values = "dotted") +
    facet_grid(Feedback ~ studyId + studyVersion) +
    theme(text = element_text(size = 16),
          axis.text.x = element_text(size = 10),
          panel.grid = element_blank(),
          legend.position = "top") +
    labs(x = "Advisor", y = "Influence")
}

