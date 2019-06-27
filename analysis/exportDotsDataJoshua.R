
# Export dots task data ---------------------------------------------------

# load data
source('./adviceUsage.R')

# drop unwanted columns
trials <- tmp[, c("pid", "dotDifference", "correctAnswer", 
                  "initialAnswer", "initialConfidence", 
                  "timeInitialStimOn", "timeInitialStimOff",
                  "timeInitialResponse",
                  "initialCorrect", "practice",
                  "id", "block", "folderName")]

trials$pid <- as.numeric(as.factor(trials$pid))

trials <- trials[complete.cases(trials), ]

# Joshua's confidence database format ---------------------------------------

Datasets <- data.frame(
  "Dataset key" = 0,
  "Dataset name" = "Matt",
  "Researcher" = "Matt Jaquiery",
  "Notes" = "Data come from initial decisions on the dots task, as used in the Exploring Social Metacognition study (https://osf.io/qtngm/). Confidence and decision are made simultaneously, by indicating the extent to which the participant is sure there were more dots on the right/left.",
  "Frames per second" = NA,
  "Confidence scale lower limit" = 1,
  "Num confidence options" = 50
)

Trials <- data.frame(
  "Dataset key" = integer(),
  "Trial key" = integer(),
  "Participant num" = integer(),
  "Block num" = integer(),
  "Trial num" = integer(),
  "Stimulus category" = integer(),
  "Response" = integer(),
  "Accuracy" = integer(),
  "Confidence" = integer(),
  "Response time" = double(),
  "Stimulus presentation time" = double(),
  "Confidence time" = double(),
  "Minimum decision time" = integer(),
  "Maximum decision time" = integer()
)

Evidence <- data.frame(
  "Trial key" = integer(),
  "Frame number" = integer(),
  "Evidence for stim 1" = integer(),
  "Evidence for stim 2" = integer()
)

# separate by experiment name
ex <- list()

for (n in unique(trials$folderName))
  ex[[n]] <- trials[trials$folderName == n, ]

i <- 0

# Could paralleize this if necessary (stitch back together adjusting trial keys)
for (df in ex) {
  
  out <- data.frame(
    "Dataset key" = 0,
    "Trial key" = i + seq(nrow(df)),
    "Participant num" = df$pid,
    "Block num" = df$block,
    "Trial num" = df$id,
    "Stimulus category" = df$correctAnswer + 1,
    "Response" = df$initialAnswer + 1,
    "Accuracy" = as.numeric(df$correctAnswer == df$initialAnswer),
    "Confidence" = df$initialConfidence,
    "Response time" = (df$timeInitialResponse - df$timeInitialStimOn) / 1000,
    "Stimulus presentation time" = (df$timeInitialStimOff - df$timeInitialStimOn) / 1000,
    "Confidence time" = (df$timeInitialResponse - df$timeInitialStimOn) / 1000,
    "Minimum decision time" = NA,
    "Maximum decision time" = NA
  )
  
  # Evidence
  left <- ifelse(df$correctAnswer, 
                 200 + df$dotDifference, 
                 200 - df$dotDifference)
  right <- ifelse(df$correctAnswer, 
                  200 - df$dotDifference, 
                  200 + df$dotDifference)
  
  tmp <- data.frame(
    "Trial key" = i + seq(nrow(df)),
    "Frame number" = 0,
    "Evidence for stim 1" = left,
    "Evidence for stim 2" = right
  )
  
  Trials <- rbind(Trials, out)
  Evidence <- rbind(Evidence, tmp)
  
  i <- i + nrow(df)
}

# save csv file
write.csv(Datasets, "../data/Joshua_dotsdata_Matt_datasets.csv", 
          row.names = F, na = "")
write.csv(Trials, "../data/Joshua_dotsdata_Matt_trials.csv", 
          row.names = F, na = "")
write.csv(Evidence, "../data/Joshua_dotsdata_Matt_evidence.csv", 
          row.names = F, na = "")


