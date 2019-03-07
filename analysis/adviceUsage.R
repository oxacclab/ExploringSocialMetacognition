
# Load required packages etc ----------------------------------------------

source('src/ESM_core.R')


# Folder crawling ---------------------------------------------------------

path <- "G:/Documents/University/Google Drive/Project Documents/AdvisorChoice/results"
folders <- list.dirs(path, recursive = T)
folders <- folders[grepl("processed$", folders)]

tmp <- NULL

for (folderName in folders) {
  print(paste('Extracting', length(list.files(folderName)), 'files from', folderName))
  
  if (!length(list.files(folderName)))
    next()
  results <- loadFilesFromFolder(folderName)
  results <- removeParticipantIds(results)
  
  # unpack results
  for (i in 1:length(results))
    assign(names(results)[i], results[i][[1]])
    
  trials <- cbind(trials, trialUtilityVariables(results))
  trials <- trials[trials$practice == F, ]
  
  # merge columns
  if (!is.null(tmp)) {
    x <- list(names(tmp), names(trials))
    if (!all(x[[1]] %in% x[[2]]))
      trials[, x[[1]][!(x[[1]] %in% x[[2]])]] <- NA
    if (!all(x[[2]] %in% x[[1]]))
      tmp[, names(tmp)[!(x[[2]] %in% x[[1]])]] <- NA
  }
  
  trials$folderName <- folderName
  
  # pad the PIDs so they don't overlap
  trials$pid <- trials$pid + 100 * (which(folders == folderName) - 1)
  
  tmp <- rbind(tmp, trials)
}
  


# Produce graph ----------------------------------------------------------

tmp <- tmp[!is.na(tmp$finalConfidence), ]

# fix for older trials sometimes having wrong advisorAgrees variable
tmp$advisorAgrees <- tmp$adviceSide == tmp$initialAnswer
    
tmp$pre <- tmp$initialConfidence
tmp$post <- ifelse(tmp$initialAnswer == 1, tmp$finalConfSpan, tmp$finalConfSpan * -1)
tmp$weight <- tmp$post / tmp$pre

tmp$pre <- (tmp$pre + 1) / 52
tmp$post <- (tmp$post + 1) / 52

tmp$weight <- tmp$post / tmp$pre

ggplot(tmp, aes(log(post / pre), fill = advisorAgrees)) +
  geom_histogram(bins = 100, aes(y = ..ncount..), position = "dodge") + 
  # geom_freqpoly(bins = 100, aes(colour = factor(pid), y = ..ncount..)) +
  facet_wrap(~advisorAgrees, labeller = label_both) +
  style.long + 
  labs(title = 'Data from all participants',
       subtitle = paste('Participants =', length(unique(tmp$pid)),
                       'Trials =', nrow(tmp)))
  # labs(title = regmatches(folderName, regexpr("([0-9\\-]+[a-zA-Z0-9 ]*)/", folderName)))

ggplot(tmp, aes(advisorInfluenceRaw, fill = advisorAgrees)) + 
  geom_histogram(bins = 100, aes(y = ..ncount..)) +
    facet_wrap(~advisorAgrees, labeller = label_both) +
    style.long +
    labs(title = 'Data from all participants',
         subtitle = paste('Participants =', length(unique(tmp$pid)),
                          'Trials =', nrow(tmp)))

table(round(tmp$weight))
hist(round(tmp$weight))


# WoA analysis ------------------------------------------------------------

#' We can construct a weight-on-advice type measure by assuming that advice
#' always recommends 100% certain in the advice direction. 

# WoA = (final - initial) / (advice - initial) 

tmp$adviceSpan <- ifelse(tmp$adviceSide == 0, -50, 50)

tmp$WoA <- (tmp$finalConfSpan - tmp$initialConfSpan) / 
  (tmp$adviceSpan - tmp$initialConfSpan)

# truncate bad values
tmp$WoA[tmp$WoA < 0] <- 0
tmp$WoA[tmp$WoA > 1] <- 1

tmp <- tmp[!is.na(tmp$WoA), ]

# histogram
tmp$WoA_f <- cut(tmp$WoA, 10)
ggplot(tmp, aes(WoA_f, fill = advisorAgrees)) +
  geom_histogram(stat = "count", position = "dodge") + 
  # facet_wrap(~advisorAgrees, labeller = label_both) +
  style.long + 
  labs(title = 'Data from all participants',
       subtitle = paste('Participants =', length(unique(tmp$pid)),
                        'Trials =', nrow(tmp)))
  

# Individual participants animation ---------------------------------------

library(gganimate)
a <- ggplot(tmp[tmp$pid < 50, ], aes(advisorInfluenceRaw, fill = advisorAgrees)) + 
  geom_histogram(bins = 100, aes(y = ..ncount..)) +
  facet_wrap(~advisorAgrees, labeller = label_both) +
  style.long +
  labs(title = 'Participant {closest_state}',
       subtitle = paste('Participants =', length(unique(tmp$pid)),
                        'Trials =', nrow(tmp))) +
  # enter_appear() +
  transition_states(pid, transition_length = .5, state_length = 3)

animate(a)
