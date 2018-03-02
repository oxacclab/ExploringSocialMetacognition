## Analysis script for AdvisorChoice web data ##############################################
# Matt Jaquiery, March 2018 (matt.jaquiery@psy.ox.ac.uk)
#
# 0. libraries
# 1. load data
#

## 0. libraries
if(!require(jsonlite))
  install.packages("jsonlite")
library(jsonlite)

## 1. load data
if(exists('trials'))
  rm(trials)
if(exists('participants'))
  rm(participants)
jsonList <- list()
folderName <- 'F:/www/vhosts/localhost/ExploringSocialMetacognition/data/processed/'
files <- list.files(folderName)
for (i in seq(length(files))) {
  fileName <- paste(folderName, files[[i]], sep='/')
  json <- readChar(fileName, file.info(fileName)$size)
  jsonList[[i]] <- fromJSON(json, simplifyVector = T, simplifyMatrix = T, simplifyDataFrame = T)
  # store columns 1:17 in participants table (drop advisors and trials)
  if(!exists('participants'))
    participants <- as.data.frame(t(jsonList[[i]][1:17]))
  else
    participants <- rbind(participants, as.data.frame(t(jsonList[[i]][1:17])))
  # store the trials in the trials table
  if(!exists('trials'))
    trials <- jsonList[[i]]$trials
  else
    trials <- rbind(trials, participants[[i]]$trials)
}
  
