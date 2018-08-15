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
ggplot(tmp[tmp$initialCorrect & tmp$when=="10", ], 
       aes(x = confidenceCategory, y = as.numeric(advisorAgrees), 
           colour = adviceType, fill = adviceType)) +
  stat_summary(geom = 'point', fun.y = mean, size = 2, alpha = 0.5) +
  stat_summary(geom = 'errorbar', fun.data = mean_cl_boot, width = 0.25) + 
  facet_grid(early ~ type, labeller = label_both) +
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


# agreement and appearence count ####
ggplot(tmp.2[tmp.2$trialNum==60, ], 
       aes(x = n, y = meanAgreement, colour = confidenceCategory, shape = adviceType)) +
  geom_point() +
  facet_grid(type ~ order, label = label_both) +
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
