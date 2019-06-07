
# Export dots task data ---------------------------------------------------

# load data
source('./adviceUsage.R')

# drop unwanted columns
trials <- tmp[, c("pid", "dotDifference", "correctAnswer", 
                  "initialAnswer", "initialConfidence", 
                  "timeInitialStimOn", "timeInitialResponse",
                  "initialCorrect", "practice",
                  "id", "block", "folderName")]

trials$subjectId <- as.numeric(as.factor(trials$pid))

# Doby's confidence database format ---------------------------------------

# separate by experiment name
ex <- list()

for (n in unique(trials$folderName))
  ex[[n]] <- trials[trials$folderName == n, ]


data <- NULL
for (df in ex) {
  out <- data.frame(Subj_idx = df$subjectId)
  out$Stimulus <- df$correctAnswer
  out$Response <- df$initialAnswer
  out$Confidence <- df$initialConfidence
  out$RT_decConf <- (df$timeInitialResponse - df$timeInitialStimOn) / 1000
  out$Difficulty <- df$dotDifference
  out$Accuracy <- df$initialCorrect
  out$Training <- df$practice
  out$Trial_in_block <- sapply(seq(nrow(df)), function(i) {
    tmp <- df[1:i, ]
    tmp <- tmp[tmp$pid == tmp$pid[i] & tmp$block == tmp$block[i], ]
    nrow(tmp)
  })
  
  data <- rbind(data, out)
}

# save csv file
write.csv(data, "../data/data_Jaquiery_unpub.csv", row.names = F)


# Joshua's format ---------------------------------------------------------


