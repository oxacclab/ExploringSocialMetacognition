## Exploring Social Metacognition
## ACv2 Analysis 
## Matt Jaquiery
## 14 May 2019

## Load data

# dependencies ------------------------------------------------------------

isSet <- function(v) {
  length(grep(paste0("^", v, "$"), ls(parent.frame())))
}

source("./src/00 Functions.R")

library(tibble)


# required variables ------------------------------------------------------

if (!isSet("studyVersion")) {
  stop("Analysis requires the [studyVersion] variable to be set.")
}


# load data ---------------------------------------------------------------

files <- listServerFiles(version = studyVersion)

# Screen for acceptable IDs
f <- files[grep("metadata", files)]
okayIds <- read.csv(f)

okayIds$okay <- grepl("prolific", okayIds$tags)

files <- files[grep("metadata", files, invert = T)]

# convert CSV files to tibbles
for (f in files) {
  tmp <- as.tibble(read.csv(f))
  
  # screen out non-okay ids
  if ("pid" %in% names(tmp))
    tmp <- tmp[tmp$pid %in% okayIds$pid[okayIds$okay], ]
  
  # clean up stimulus text
  if ("stimHTML" %in% names(tmp)) {
    tmp$stimHTML <- stripTags(tmp$stimHTML)
  }
  
  # type coersion
  if ("comment" %in% names(tmp))
    tmp$comment <- as.character(tmp$comment)
  
  n <- grep("advisor[0-9]+(name|validTypes|nominalType|actualType)$", 
            names(tmp), value = T)
  for (x in n)
    tmp[, x] <- lapply(tmp[, x], as.character)
  
  n <- grep("responseEstimateLabel", names(tmp), value = T)
  for (x in n)
    tmp[, x] <- lapply(tmp[, x], function(y) 
      as.numeric(stripTags((as.character(y)))))
  
  if ("responseMarkerWidth" %in% names(tmp))
    tmp$responseMarker <- factor(tmp[["responseMarkerWidth"]])
  if ("responseMarkerWidthFinal" %in% names(tmp))
    tmp$responseMarkerFinal <- factor(tmp[["responseMarkerWidthFinal"]])
  
  # assign to workspace
  name <- reFirstMatch("([^_]+)\\.csv", f)
  name <- sub("-", ".", name)
  assign(name, tmp)
}

# reference varaibles -----------------------------------------------------

# Gather a list of advisor names and advice types
# This is more complex than it needs to be because it handles a wider range of
# inputs than we give it here

names <- NULL
types <- NULL
i <- 0
while (T) {
  if (!length(grep(paste0("advisor", i), names(AdvisedTrial)))) {
    break()
  }
  names <- unique(c(names, 
                    unique(AdvisedTrial[, paste0("advisor", i, 
                                                 "idDescription")])))
  types <- unique(c(types,
                    unique(AdvisedTrial[, paste0("advisor", i, 
                                                 "actualType")]),
                    unique(AdvisedTrial[, paste0("advisor", i,
                                                 "nominalType")])))
  i <- i + 1
}
advisorNames <- unlist(names)
adviceTypes <- unlist(types)

adviceTypes <- adviceTypes[nchar(adviceTypes) > 0]


# trial variables ---------------------------------------------------------

# Check trials which are supposed to have feedback actually have it
AdvisedTrial$feedback[is.na(AdvisedTrial$feedback)] <- 0
AdvisedTrial$feedback <- as.logical(AdvisedTrial$feedback)

expect_equal(!is.na(AdvisedTrial$timeFeedbackOn), AdvisedTrial$feedback)

AdvisedTrial$responseCorrect <- 
  AdvisedTrial$correctAnswer >= AdvisedTrial$responseEstimateLeft &
  AdvisedTrial$correctAnswer <= AdvisedTrial$responseEstimateLeft + 
  AdvisedTrial$responseMarkerWidth

AdvisedTrial$responseCorrectFinal <- 
  AdvisedTrial$correctAnswer >= AdvisedTrial$responseEstimateLeftFinal &
  AdvisedTrial$correctAnswer <= AdvisedTrial$responseEstimateLeftFinal + 
  AdvisedTrial$responseMarkerWidthFinal

Trial$responseCorrect <- 
  Trial$correctAnswer >= Trial$responseEstimateLeft &
  Trial$correctAnswer <= Trial$responseEstimateLeft + 
  Trial$responseMarkerWidth

AdvisedTrial$responseError <- abs(AdvisedTrial$correctAnswer - 
                                    AdvisedTrial$responseEstimateLeft + 
                                    (AdvisedTrial$responseMarkerWidth / 2))

AdvisedTrial$responseErrorFinal <- abs(AdvisedTrial$correctAnswer - 
                                         AdvisedTrial$responseEstimateLeftFinal 
                                       + (AdvisedTrial$responseMarkerWidthFinal 
                                          / 2))

AdvisedTrial$errorReduction <- AdvisedTrial$responseError - 
  AdvisedTrial$responseErrorFinal

AdvisedTrial$responseScore <- 
  ifelse(AdvisedTrial$responseCorrect, 
         27 / AdvisedTrial$responseMarkerWidth, 0)

AdvisedTrial$responseScoreFinal <- 
  ifelse(AdvisedTrial$responseCorrectFinal, 
         27 / AdvisedTrial$responseMarkerWidthFinal, 0)

AdvisedTrial$accuracyChange <- AdvisedTrial$responseCorrectFinal -
  AdvisedTrial$responseCorrect

AdvisedTrial$scoreChange <- AdvisedTrial$responseScoreFinal -
  AdvisedTrial$responseScore

AdvisedTrial$estimateLeftChange <- abs(AdvisedTrial$responseEstimateLeftFinal -
                                         AdvisedTrial$responseEstimateLeft)

AdvisedTrial$changed <- AdvisedTrial$estimateLeftChange > 0

AdvisedTrial$confidenceChange <- 
  (4 - as.numeric(AdvisedTrial$responseMarkerFinal)) -
  (4 - as.numeric(AdvisedTrial$responseMarker))


tmp <- AdvisedTrial[order(AdvisedTrial$number), ]

AdvisedTrial$firstAdvisor <- unlist(sapply(AdvisedTrial$pid, 
                                           function(x) 
                                             tmp[
                                               tmp$pid == x,
                                               "advisor0idDescription"][1, ]))

AdvisedTrial$advisor0offBrand <- AdvisedTrial$advisor0actualType == 
  "disagreeReflected"


# by advisor name variables -----------------------------------------------

# Produce equivalents of the advisor1|2... variables which are named for the 
# advisor giving the advice

for (v in names(AdvisedTrial)[grepl("advisor0", names(AdvisedTrial))]) {
  suffix <- reFirstMatch("advisor0(\\S+)", v)
  for (a in advisorNames) {
    
    s <- paste0(a, ".", suffix)
    AdvisedTrial[, s] <- NA
    
    for (i in 1:nrow(AdvisedTrial)) {
      x <- 0
      while (T) {
        if (!length(grep(paste0("advisor", x), 
                         names(AdvisedTrial)))) {
          break()
        }
        
        if (AdvisedTrial[i, paste0("advisor", x, "idDescription")] == a) {
          AdvisedTrial[i, s] <- AdvisedTrial[i, paste0("advisor", x, suffix)]
          break()
        }
        
        x <- x + 1
      }
      
    }
  }
}

# Trials - advisor-specific variables
for (a in advisorNames) {
  # Accuracy
  AdvisedTrial[, paste0(a, ".accurate")] <- 
    (AdvisedTrial[, paste0(a, ".advice")] - 
       (AdvisedTrial[, paste0(a, ".adviceWidth")] / 2)) <= 
    AdvisedTrial[, "correctAnswer"] &
    (AdvisedTrial[, paste0(a, ".advice")] + 
       (AdvisedTrial[, paste0(a, ".adviceWidth")] / 2)) >= 
    AdvisedTrial[, "correctAnswer"]
  
  # Error
  AdvisedTrial[, paste0(a, ".error")] <- 
    abs(AdvisedTrial[, paste0(a, ".advice")] - AdvisedTrial[, "correctAnswer"])
  
  # Weight on Advice
  i <- AdvisedTrial[, "responseEstimateLeft"] + 
    (AdvisedTrial[, "responseMarkerWidth"] - 1) / 2
  f <- AdvisedTrial[, "responseEstimateLeftFinal"] + 
    (AdvisedTrial[, "responseMarkerWidthFinal"] - 1) / 2
  adv <- AdvisedTrial[, paste0(a, ".advice")]
  
  x <- ((f - i) / (adv - i))
  AdvisedTrial[, paste0(a, ".woaRaw")] <- x
  
  x[x < 0] <- 0
  x[x > 1] <- 1
  
  AdvisedTrial[, paste0(a, ".woa")] <- x
  
  # Agreement
  for (d in c("", "Final")) {
    minA <- AdvisedTrial[, paste0(a, ".advice")] - 
      (AdvisedTrial[, paste0(a, ".adviceWidth")] / 2)
    maxA <- AdvisedTrial[, paste0(a, ".advice")] + 
      (AdvisedTrial[, paste0(a, ".adviceWidth")] / 2)
    
    minP <- AdvisedTrial[, paste0("responseEstimateLeft", d)]
    maxP <- minP + AdvisedTrial[, paste0("responseMarkerWidth", d)]
    
    AdvisedTrial[, paste0(a, ".agree", d)] <- 
      ((minA >= minP) & (minA <= maxP)) | ((maxA >= minP) & (maxA <= minP))  
    
    # Distance
    reMid <- minP + (maxP - minP) / 2
    advice <- AdvisedTrial[, paste0(a, ".advice")]
    AdvisedTrial[, paste0(a, ".distance", d)] <- abs(reMid - advice)
  }
  
  # Agreement change
  AdvisedTrial[, paste0(a, ".agreementChange")] <- 
    AdvisedTrial[, paste0(a, ".agreeFinal")] - 
    AdvisedTrial[, paste0(a, ".agree")]
}


# backfilling advisor0 properties -----------------------------------------

low <- 0
high <- 1
n <- 11

AdvisedTrial$woa <- ""
for (x in c("woa", "woaRaw")) {
  AdvisedTrial[, paste0("advisor0", x)] <- 
    sapply(1:nrow(AdvisedTrial), function(i)
      unlist(
        AdvisedTrial[i, 
                     paste0(as.character(AdvisedTrial$advisor0idDescription[i]), 
                            ".", x)]))
}

AdvisedTrial$woa[AdvisedTrial$advisor0woaRaw >= 1] <- ">=1"
for (x in rev(seq(low, high, length.out = n))) {
  AdvisedTrial$woa[AdvisedTrial$advisor0woaRaw < x] <- paste0("<", x)
}
AdvisedTrial$woa <- factor(AdvisedTrial$woa)



# additional framing of data ----------------------------------------------

decisions <- byDecision(AdvisedTrial)

PP <- participantSummary(decisions)


# cleanup -----------------------------------------------------------------

suppressWarnings(rm("a", "d", "n", "s", "v", "suffix", "files", "name",
                    "adv", "advice", "f", "i", "maxA", "maxP", "minA", "minP", 
                    "names", "reMid", "tmp", "types", "x", "low", "high"))
