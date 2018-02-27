## Analysis of web data
#
# 0. libraries
# 1. load data
#

## 0. libraries
if(!require(jsonlite))
  install.packages("jsonlite")
library(jsonlite)

## 1. load data
fileName <- 'participantData.JSON'
json <- readChar(fileName, file.info(fileName)$size)
myData <- fromJSON(json, simplifyVector = T, simplifyMatrix = T, simplifyDataFrame = T)
