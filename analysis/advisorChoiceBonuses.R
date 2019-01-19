## Bonus calculation script for AdvisorChoice web data ##############################################
# Matt Jaquiery, July 2018 (matt.jaquiery@psy.ox.ac.uk)
# Updates Jan 2019 to include final-answer bonuses

library(scoring)  
library(digest)  
source('src/ESM_core.R')

# Load data
folderName <- "G:\\Documents\\University\\Google Drive\\Temp\\data\\processed"
results <- loadFilesFromFolder(folderName)

# unpack results
for(i in 1:length(results))
  assign(names(results)[i], results[i][[1]])

# Calculate some utility variables
trials$finalCorrect <- trials$finalAnswer == trials$correctAnswer
trials$initialCorrect <- trials$initialAnswer == trials$correctAnswer
participants$pid <- sapply(participants$id, function(x) which(unique(participants$id)==x))

accuracy <- aggregate(finalCorrect ~ participantId,
                      data = trials[!is.na(trials$finalCorrect), ],
                      FUN = mean)
if(all(is.na(trials$finalAnswer)))
  accuracy <- aggregate(initialCorrect ~ participantId, data = trials[!is.na(trials$initialCorrect), ], FUN = mean)

# We use the Brier score
tmp <- trials[,c('initialCorrect', 'finalCorrect', 'initialConfidence', 'participantId')]
tmp$initialCorrect <- as.numeric(tmp$initialCorrect)
for(p in unique(tmp$participantId))
  tmp$initialConfidence[tmp$participantId == p] <- scale(tmp$initialConfidence[tmp$participantId == p])
scores <- brierscore(initialCorrect ~ initialConfidence, data = tmp[!is.na(tmp$initialConfidence), ], group = 'participantId')

if(exists('rawString')) {
  prolificIds <- NULL
  matches <- gregexpr('5[a-z0-9]{23}', rawString)
  for(x in matches[[1]])
    prolificIds <- c(prolificIds, substr(rawString, x, x+23))
}

if(exists('prolificIds')) {
  prolificIdHashes <- sapply(prolificIds,digest,algo='sha1',serialize=F)
  tmp <- NULL
  for(i in 1:length(names(scores$brieravg))) {
    pid <- names(scores$brieravg)[i]
    proId <- names(prolificIdHashes)[prolificIdHashes == pid]
    if(length(proId)>0)
      tmp <- rbind(tmp, data.frame(pid,
                                   prolificId = proId,
                                   brieravg = scores$brieravg[i],
                                   accuracy = accuracy[accuracy$participantId == pid, 2],
                                   excluded = F, #participants$excluded[participants$pid==pid],
                                   extra = debrief$answer[debrief$participantId==pid & debrief$id == 2]))
    else
      print(paste('PID',pid,'has no prolific hash associated'))
  }
  # ascribe bonuses based on performance
  tmp$reward <- 0
  for(dim in c('brieravg', 'accuracy')) {
    markers <- quantile(tmp[tmp$excluded==F, dim], na.rm = T)
    for(i in 1:nrow(tmp)) {
      tmp[i, paste0('q', dim)] <- which(markers >= tmp[i, dim])[1]
      tmp$reward[i] <- tmp$reward[i] + round(1 - 1/(length(markers)-1)*(tmp[i, paste0('q', dim)]-1),2)
    }
    tmp$reward[tmp$excluded!=F] <- 0 # no bonus for excluded participants
  }
  
  for(r in 1:nrow(tmp))
    print(paste0(tmp$prolificId[r], ', ', tmp$reward[r]))
  prolificIds[!(prolificIds %in% tmp$prolificId)]
  write.csv(data.frame(id = tmp$prolificId[tmp$reward>0], name = tmp$reward[tmp$reward>0]), 
            'tmp.csv', 
            sep = ',',
            row.names = F,
            col.names = F,
            quote = F)
}
