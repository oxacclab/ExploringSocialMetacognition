if(!require(gganimate)) {
  # Set path of Rtools
  Sys.setenv(PATH = paste(Sys.getenv("PATH"), "*InstallDirectory*/Rtools/bin/",
                          "*InstallDirectory*/Rtools/mingw_64/bin", sep = ";")) #for 64 bit version
  Sys.setenv(BINPREF = "*InstallDirectory*/Rtools/mingw_64/bin")
  library(devtools)
  
  #Manually "force" version to be accepted 
  assignInNamespace("version_info", c(devtools:::version_info, list("3.5" = list(version_min = "3.3.0", version_max = "99.99.99", path = "bin"))), "devtools")
  find_rtools() # is TRUE now
  
  # Now you can install transformr then gganimate
  devtools::install_github("thomasp85/transformr")
  devtools::install_github("dgrtwo/gganimate")
}


# Work out what's going on with the poorly differentiated agreement rates in the forced trials
tmp <- trials
for(v in c('pid','confidenceCategory','adviceType'))
  tmp[ ,v] <- as.factor(tmp[ ,v])

tmp$early <- tmp$id < 150
tmp$when <- sapply(tmp$pid, 
                   function(x) format(as.POSIXct(participants$timeStart[participants$pid==x], 
                                                 origin = "1970-01-01"), "%d"))
tmp$when <- as.factor(tmp$when)

# the problem: poorly differentiated aggreement rates in forced trials ####
ggplot(tmp, 
       aes(x = confidenceCategory, y = as.numeric(advisorAgrees), 
           colour = adviceType, fill = adviceType)) +
  stat_summary(geom = 'point', fun.y = mean, size = 2, alpha = 0.5) +
  stat_summary(geom = 'errorbar', fun.data = mean_cl_boot, width = 0.25) + 
  facet_wrap(typeName ~ ., labeller = label_both) +
  style
  
# animated version of the problem ####
tmp.2 <- NULL
for(i in 1:60) {
  for(choice in unique(tmp$type)){
    type = ifelse(choice==1, 'Forced', 'Choice')
    for(early in unique(tmp$early)) {
      for(cc in unique(tmp$confidenceCategory)) {
        for(adviceType in unique(tmp$adviceType)) {
          order = ifelse(early, 'First', 'Last')
          v <- tmp[tmp$type == choice & tmp$early == early & tmp$confidenceCategory==cc & tmp$adviceType==adviceType, 
                   c('id', 'advisorAgrees')]
          v <- v[order(v$id), ]
          v <- v[1:i,'advisorAgrees']
          meanAgreement <- mean(as.numeric(v))
          cl <- mean_cl_boot(v)
          tmp.2 <- rbind(tmp.2, data.frame(trialNum = i,
                                           confidenceCategory = cc,
                                           type,
                                           order,
                                           adviceType = getAdviceTypeName(adviceType),
                                           meanAgreement,
                                           ymin = cl$ymin,
                                           ymax = cl$ymax))
        }
      }
    }
  }
}
g <- ggplot(tmp.2, aes(x = confidenceCategory, y = meanAgreement, colour = adviceType)) +
  geom_point(shape = 18, size = 4) +
  geom_errorbar(aes(ymin = ymin, ymax = ymax)) +
  facet_grid(type ~ order, labeller = label_both) +
  scale_x_discrete(name='Confidence category', labels = c('Low', 'Med', 'High')) +
  scale_y_continuous(name= 'Mean agreement') +
  scale_color_discrete(name= 'Advice type', labels = c('Agree-in-uncertainty', 'Agree-in-confidence')) +
  style +
  labs(title = 'Trials 1:{frame_time}') +
  transition_time(trialNum) +
  enter_fade() +
  ease_aes('sine-in-out')
animate(g,nframes = 600, fps = 20, detail = 10)

# static version
ggplot(tmp.2, 
       aes(x = trialNum, y = meanAgreement, colour = confidenceCategory, shape = adviceType)) +
  geom_point() +
  facet_grid(type ~ order, label = label_both) +
  style

# agreement and appearence count ####
tmp.3 <- NULL
for(aT in unique(tmp$adviceType)) {
  for(cc in unique(tmp$confidenceCategory)) {
    for(type in unique(tmp$typeName)) {
      v <- trials[trials$adviceType==aT & trials$confidenceCategory==cc & trials$typeName==type, ]
      tmp.3 <- rbind(tmp.3, data.frame(adviceType = getAdviceTypeName(aT),
                                       confidenceCategory = cc,
                                       type,
                                       n = nrow(v),
                                       agreement = mean(as.numeric(v$advisorAgrees))))
    }
  }
}
ggplot(tmp.3, aes(x = n, y = agreement, colour = adviceType, shape = confidenceCategory)) + 
  geom_point(size = 4) +
  facet_wrap(type ~ ., labeller = label_both) +
  style


# confidence categories by time ####
ggplot(tmp[tmp$initialCorrect, ],
       aes(x = confidenceCategory, colour = typeName)) +
  geom_freqpoly(stat = 'count', aes(group = typeName)) + 
  facet_wrap(early ~ ., labeller = label_both) +
  style

ggplot(tmp[tmp$initialCorrect & tmp$type==1, ],
       aes(x = pid, fill = pid)) +
  geom_bar() +
  facet_grid(early ~ confidenceCategory, labeller = label_both) +
  labs(title = 'Confidence categories on Forced trials') +
  style.long

ggplot(tmp[tmp$initialCorrect & tmp$type==2, ],
       aes(x = pid, fill = pid)) +
  geom_bar() +
  facet_grid(early ~ confidenceCategory, labeller = label_both) +
  labs(title = 'Confidence categories on Forced trials') +
  style.long

# confidence by time ####
d <- 0.5
ggplot(tmp[tmp$initialCorrect, ],
       aes(x = confidenceCategory, y = initialConfidence)) +
  geom_smooth(aes(colour = pid, group = pid), method = 'lm', alpha = 0.1, se = F) +
  stat_summary(geom = 'point', fun.y = mean, shape = 18, size = 2) +
  stat_summary(geom = 'errorbar', fun.data = mean_cl_boot, width = 0.2, size = 1) +
  facet_grid(early ~ typeName, labeller = label_both) +
  style.long

# bunches of confidence distribution graphs ####
pids <- unique(tmp$pid)
ps <- NULL
for(p in pids) {
  ps <- c(ps, p)
  if(length(ps) < 4 & !(p == pids[length(pids)]))
    next()
  # draw the graph
  ggplot(tmp[tmp$pid==ps[1]:ps[length(ps)],], 
         aes(x = initialConfidence, fill = typeName, colour = typeName, linetype = early)) +
    geom_freqpoly(binwidth = 5) +
    labs(title = 'Conf distribution') +
    facet_wrap(pid ~ ., labeller = label_both) +
    style
  ggsave(paste0('explore/confDists',ps[1],'-',ps[length(ps)],'.png'))
  ps <- NULL
}

ggplot(tmp[tmp$type==1, ],
       aes(x = confidenceCategory, fill = early)) +
  geom_bar() +
  labs(title = 'Confidence categories') +
  style

mean(as.numeric(tmp$adviceType[tmp$early & tmp$type==1]))

# exploring confidence category calculation ####

#' We want to look at how different methods of calculating confidence alter the
#' distribution of confidence categories. Ideally we're aiming for 30/40/30, and
#' we only really care about initially correct trials.
#'
#' We start by stepping through some different lag sets: we select different
#' numbers of previous trials to examine, and calculate the confidence as
#' fitting in to the confidence distribution from those trials
#' 
lags <- c(5,10,20,40,60,120,Inf)
df.lags <- NULL
# For each lag setting 
print('Calculating trial confidence categories at various lag settings')
pb <- txtProgressBar(min = 0, max = length(lags) * nrow(participants))
for(lag in lags) {
  # For each participant
  for(pid in unique(participants$pid)) {
    # for each trial calculate the confidence category using the lag
    ts <- all.trials[all.trials$pid == pid, ]
    ts$initialConfidence[!ts$initialCorrect] <- NaN # void confidence for incorrect trials
    for(i in (min(ts$id)+1):max(ts$id)) {
      trial <- ts[ts$id == i, ]
      low <- i - lag
      low <- ifelse(low < min(ts$id), min(ts$id), low)
      testSet <- ts[ts$id %in% low:(i-1) & !is.nan(ts$initialConfidence), ]
      # markers <- quantile(testSet$initialConfidence, c(.3,.7)) # nice approach, but not used in JS version
      testSet <- testSet[order(testSet$initialConfidence),]
      markers <- testSet$initialConfidence[c(round(nrow(testSet)*.3), round(nrow(testSet)*.7))]
      trial$confidenceCategory <- sum(markers < trial$initialConfidence)
      ts[ts$id == i, ] <- trial
    }
    # calculate confidence category proportions
    ts <- ts[!ts$practice, ]
    for(confCat in confidenceCategories) {
      df.lags <- rbind(df.lags, data.frame(lag,
                                           pid,
                                           confCat,
                                           prop = mean(ts$confidenceCategory==confCat, na.rm = T)))
    }
    setTxtProgressBar(pb, getTxtProgressBar(pb) + 1)
  }
}
close(pb)

# plot results
ggplot(df.lags, aes(x = as.factor(lag), y = prop, colour = as.factor(confCat))) + 
  geom_hline(yintercept = .4, linetype = 'dashed') +
  geom_hline(yintercept = .3, linetype = 'dashed') +
  stat_summary(geom = 'point', fun.y = mean) +
  stat_summary(geom = 'errorbar', fun.data = mean_cl_boot)

#' 
#' Now we look at using the last n practice trials to determine the confidence distribution
#' 
lags <- c(5,10,20,40,60,Inf)
df.lags <- NULL
# For each lag setting 
print('Calculating trial confidence categories at various lag settings')
pb <- txtProgressBar(min = 0, max = length(lags) * nrow(participants))
for(lag in lags) {
  # For each participant
  for(pid in unique(participants$pid)) {
    # for each trial calculate the confidence category using the lag
    ts <- all.trials[all.trials$pid == pid, ]
    ts$initialConfidence[!ts$initialCorrect] <- NaN # void confidence for incorrect trials
    testSet <- ts[ts$practice & ts$id > (max(ts$id[ts$practice])-lag), ]
    # markers <- quantile(testSet$initialConfidence, c(.3,.7)) # nice approach, but not used in JS version
    testSet <- testSet[order(testSet$initialConfidence),]
    markers <- testSet$initialConfidence[c(round(nrow(testSet)*.3), round(nrow(testSet)*.7))]
    ts <- ts[!ts$practice & ts$initialCorrect, ]
    for(i in ts$id) {
      ts$confidenceCategory[ts$id == i] <- sum(markers < ts$initialConfidence[ts$id == i])
    }
    # calculate confidence category proportions
    for(confCat in confidenceCategories) {
      df.lags <- rbind(df.lags, data.frame(lag,
                                           pid,
                                           confCat,
                                           prop = mean(ts$confidenceCategory==confCat, na.rm = T)))
    }
    setTxtProgressBar(pb, getTxtProgressBar(pb) + 1)
  }
}
close(pb)

# plot results
ggplot(df.lags, aes(x = as.factor(lag), y = prop, colour = as.factor(confCat))) + 
  geom_hline(yintercept = .4, linetype = 'dashed') +
  geom_hline(yintercept = .3, linetype = 'dashed') +
  stat_summary(geom = 'point', fun.y = mean) +
  stat_summary(geom = 'errorbar', fun.data = mean_cl_boot)

# Do people just become less confident over time ####

ggplot(trials[!trials$practice & trials$initialCorrect, ], 
       aes(x = id, y = initialConfidence, colour = as.factor(pid))) +
  geom_point(alpha = 0.1) +
  geom_smooth(method = 'lm', se = F)

df.conf <- NULL
for(pid in unique(trials$pid)) {
  m <- lm(initialConfidence ~ id, trials[!trials$practice & trials$initialCorrect & trials$pid == pid, ])
  df.conf <- rbind(df.conf, data.frame(pid,
                                       coef = m$coefficients[2]))
}
ggplot(df.conf, aes(x = "", y = coef)) +
  geom_violin(alpha = 0.5, colour = NA, fill = 'lightgrey') + 
  geom_point(alpha = 0.25, position = position_jitter(), aes(colour = as.factor(pid))) +
  stat_summary(geom = 'point', fun.y = mean) +
  stat_summary(geom = 'errorbar', fun.data = mean_cl_boot) +
  theme_light()

