## Bonus calculation script for AdvisorChoice web data ##############################################
# Matt Jaquiery, July 2018 (matt.jaquiery@psy.ox.ac.uk)
#
if(!require(scoring)) {
  install.packages('scoring')
  library(scoring)  
}
citation('scoring')

if(!require(digest)) {
  install.packages('digest')
  library(digest)  
}
citation('digest')

# We use the Brier score
tmp <- all.trials[,c('initialCorrect', 'initialConfidence', 'pid')]
tmp$initialCorrect <- as.numeric(tmp$initialCorrect)
tmp$initialConfidence <- tmp$initialConfidence/50
scores <- brierscore(initialCorrect ~ initialConfidence, data = tmp, group = 'pid')
scores$brieravg

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
    proId <- names(prolificIdHashes)[prolificIdHashes %in% all.participants$id[all.participants$pid==pid]]
    if(length(proId)>0)
      tmp <- rbind(tmp, data.frame(pid,
                                   prolificId = proId,
                                   brieravg = scores$brieravg[i],
                                   excluded = all.participants$excluded[all.participants$pid==pid],
                                   extra = all.participants$debriefComments[all.participants$pid==pid]))
    else
      print(paste('PID',pid,'has no prolific hash associated'))
  }
  markers <- quantile(tmp$brieravg[tmp$excluded==F])
  for(i in 1:nrow(tmp)) {
    tmp$quantile[i] <- which(markers >= tmp$brieravg[i])[1]
    tmp$reward[i] <- round(2 - 2/(length(markers)-1)*(tmp$quantile[i]-1),2)
  }
  tmp$reward[tmp$excluded!=F] <- 0 # no bonus for excluded participants
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
