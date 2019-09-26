# It's possible the advisor labels are the wrong way around for conditions 3 and
# 4. We investigate the plausibility of this by looking to see if the effect we
# expect is present when those labels are switched. The code is pretty robust,
# but it's worth investing some time to be sure.

# Weight on Advice --------------------------------------------------------

# put condition into the trials
both <- AdvisedTrial %>% 
  left_join(okayIds, by = "pid")

# flip labels for conditions 3 & 4
tmp <- both %>%
  filter(condition >= 3) %>%
  mutate(advisor0idDescription = 3 - as.numeric(advisor0idDescription)) %>%
  mutate(advisor0idDescription = factor(advisor0idDescription, 
                                        labels = c("inGroup", "outGroup")))

# rejoin
fixed <- both %>%
  filter(condition <= 2) %>% 
  rbind(tmp)

# summarise WoA
byP <- fixed %>%
  group_by(advisor0idDescription, condition, pid) %>%
  mutate(advisor0woaRaw = max(0, min(1, advisor0woaRaw))) %>%
  summarise(woaRaw = mean(advisor0woaRaw, na.rm = T))

# uncorrected stats
bothP <- both %>%
  group_by(advisor0idDescription, condition, pid) %>%
  mutate(advisor0woaRaw = max(0, min(1, advisor0woaRaw))) %>%
  summarise(woaRaw = mean(advisor0woaRaw, na.rm = T))
  
md.ttest(bothP$woaRaw[bothP$advisor0idDescription == "inGroup"], 
         bothP$woaRaw[bothP$advisor0idDescription == "outGroup"]) %>% 
  cat()

# stats
md.ttest(byP$woaRaw[byP$advisor0idDescription == "inGroup"], 
         byP$woaRaw[byP$advisor0idDescription == "outGroup"]) %>% 
  cat()


# Questionnaires ----------------------------------------------------------

# Looks like the results are pretty similar - generally indicative of no
# difference between ingroup and outgroup advisors. We should also check the
# questionnaire responses, however.

both_a <- debrief.advisors[complete.cases(debrief.advisors), ] %>%
  left_join(okayIds, by = "pid")

tmp <- both_a %>%
  filter(condition >= 3) %>%
  mutate(advisorIdDescription = 3 - as.numeric(advisorIdDescription)) %>%
  mutate(advisorIdDescription = factor(advisorIdDescription, 
                                        labels = c("inGroup", "outGroup")))

# rejoin
fixed_a <- both_a %>%
  filter(condition <= 2) %>% 
  rbind(tmp) %>%
  drop_na(advisorIdDescription)

for (v in c("knowledge", "consistency", "helpfulness", "trustworthiness")) {
  cat("\n")
  cat(paste0(v, "\n"))
  
  cat('uncorrected:\n')
  md.ttest(both_a[[v]][both_a$advisorIdDescription == "inGroup"],
           both_a[[v]][both_a$advisorIdDescription == "outGroup"]) %>% cat()
  
  cat('\n"corrected":\n')
  md.ttest(fixed_a[[v]][fixed_a$advisorIdDescription == "inGroup"],
           fixed_a[[v]][fixed_a$advisorIdDescription == "outGroup"]) %>% cat()
  cat("\n")
}


# Investigation -----------------------------------------------------------

# look at the condition/pGroup/advisor info
info <- AdvisedTrial %>% 
  left_join(okayIds, by = "pid") %>%
  left_join(debrief.advisors, by = c("pid" = "pid", "advisor0id" = "advisorId"))

info %>%
  group_by(pid, advisor0id) %>%
  select(pid, advisor0id, pGroup, advisor0group, 
         advisor0sameGroup, advisor0idDescription, 
         advisorIdDescription, condition) %>%
  unique() %>%
  View()

info_ag <- info %>%
  group_by(pid, advisor0id, advisor0idDescription, 
           condition, advisor0position) %>%
  summarise(woa = mean(advisor0woa),
            trustworthiness = mean(trustworthiness))

t.test(woa ~ advisor0idDescription, info_ag)
t.test(trustworthiness ~ advisor0idDescription, info_ag)
t.test(woa ~ advisor0id, info_ag)
t.test(trustworthiness ~ advisor0id, info_ag)
t.test(woa ~ condition < 3, info_ag)
t.test(trustworthiness ~ condition < 3, info_ag)

info_ag %>% ggplot(aes(x = factor(advisor0id), y = trustworthiness,
                       fill = factor(advisor0id))) +
  geom_boxplot() +
  geom_point(position = position_jitterdodge(.1),
             aes(colour = factor(condition))) + 
  scale_fill_manual(values = c("#17d345", "#dc84ff")) +
  scale_colour_viridis_d()

# Advisor trustworthiness appears to be predicted by advisor group rather than
# whether the advisor is in the same group as the participant. We'll test this
# hypothesis by simply switching the colours of the groups keeping everything
# else the same.

  