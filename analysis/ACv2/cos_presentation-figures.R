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
    labs(x = "Advice rating", y = "Weight on advice")
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
    labs(x = "Advice rating", y = "Weight on advice")
  print(gg)
}

