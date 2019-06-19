## Exploring Social Metacognition
## ACv2 Analysis 
## Matt Jaquiery
## 14 May 2019

## Exclusions

# dependencies ------------------------------------------------------------

isSet <- function(v) {
  length(grep(paste0("^", v, "$"), ls(parent.frame())))
}

if (!isSet("skipLoadData") || !skipLoadData)
  source("./src/01 Load data.R")

library(tibble)

# required variables ------------------------------------------------------

# Ensure there are some exlcusion rules to apply

if (!isSet("exclude")) {
  print(tribble(~variable, ~ifTRUE,
                "skipAttnCheck", "Retain participants who failed one or more attention checks",
                "incomplete", "Remove participants who did not complete experiment",
                "outlyingTrials", "Remove trials with response times > [maxTime]ms",
                "outlyingTrialCount", "Remove participants with > [maxOutliers] outlying trials",
                "offBrandOutliers", "Remove participants with any offbrand outlier trials",
                "minChange", "Remove participants who change response on < [minChangePercent] trials",
                "participantOutliers", "Remove participants by [checkList] z-score > abs([zThresh])",
                "multipleAttempts", "Remove participants who saw feedback on questions in previous attempts",
                "manual", "Remove participants by logical mask [guessedManipulation]",
                "badMarker", "Remove participants whose responsese contain an invalid marker width",
                "excess", "Remove participants whose data were collected by mistake"))
  
  stop("No criteria for exclusion ([exclude] variable not set). See above for a list of options.")
}


# output variables --------------------------------------------------------

exclusions <- tibble(pid = unique(AdvisedTrial$pid))
exclusions$excluded <- F

# attention checks --------------------------------------------------------

if (!exclude$skipAttnCheck) {
  for (p in unique(exclusions$pid)) {
    tmp <- Trial[Trial$pid == p, ]
    
    if (any(tmp$responseCorrect == F))
      exclusions$excluded[exclusions$pid == p] <- 
        addExclusion(exclusions$excluded[exclusions$pid == p], "attnCheckYear")
    
    if (any(tmp$responseMarkerWidth != min(markerList)))
      exclusions$excluded[exclusions$pid == p] <- 
        addExclusion(exclusions$excluded[exclusions$pid == p], "attnCheckWidth")
  }
  
  # Drop excluded participants' trials
  tmp <- NULL
  for (i in 1:nrow(AdvisedTrial))
    if (exclusions$excluded[exclusions$pid == AdvisedTrial$pid[i]] == F)
      tmp <- rbind(tmp, AdvisedTrial[i, ])
  
  AdvisedTrial <- tmp
}


# incomplete --------------------------------------------------------------

if (exclude$incomplete) {
  for (p in unique(exclusions$pid)) {
    if (!(p %in% debrief.advisors$pid)) {
      exclusions$excluded[exclusions$pid == p] <-
        addExclusion(exclusions$excluded[exclusions$pid == p], "incomplete")
    }
  }
}


# outlying trials ---------------------------------------------------------

if (exclude$outlyingTrials) {
  if (!isSet("maxTime"))
    stop("[maxTime] must be set when excluding outlying trials.")
  
  outliers <- AdvisedTrial[AdvisedTrial$timeEnd > maxTime, ]
  AdvisedTrial <- AdvisedTrial[AdvisedTrial$timeEnd <= maxTime, ]
}


# outlying trial count ----------------------------------------------------

if (exclude$outlyingTrialCount) {
  
  if (!isSet("maxOutliers"))
    stop("[maxOutliers] must be set when excluding participants for outlying trial counts.")
  
  for (p in unique(exclusions$pid)) {
    if (sum(outliers$pid == p) > maxOutliers)
      exclusions$excluded[exclusions$pid == p] <- 
        addExclusion(exclusions$excluded[exclusions$pid == p], "outlyingTrials")
  }
  
  # Drop excluded participants' trials
  tmp <- NULL
  for (i in 1:nrow(AdvisedTrial))
    if (exclusions$excluded[exclusions$pid == AdvisedTrial$pid[i]] == F)
      tmp <- rbind(tmp, AdvisedTrial[i, ])
  
  AdvisedTrial <- tmp
}

# offbrand outliers -------------------------------------------------------

if (exclude$offBrandOutliers) {
  
  for (p in unique(exclusions$pid)) {
    if (any(outliers$advisor0offBrand[outliers$pid == p]))
      exclusions$excluded[exclusions$pid == p] <- 
        addExclusion(exclusions$excluded[exclusions$pid == p], "outlyingTrials")
  }
  
  # Drop excluded participants' trials
  tmp <- NULL
  for (i in 1:nrow(AdvisedTrial))
    if (exclusions$excluded[exclusions$pid == AdvisedTrial$pid[i]] == F)
      tmp <- rbind(tmp, AdvisedTrial[i, ])
  
  AdvisedTrial <- tmp
}

# min change percent ------------------------------------------------------

if (exclude$minChange) {
  changes <- tibble(pid = exclusions$pid, pChange = 0)
  
  for (p in exclusions$pid) {
    tmp <- AdvisedTrial[AdvisedTrial$pid %in% p, ]
    
    if (nrow(tmp) == 0) {
      changes <- changes[!(changes$pid %in% p), ]
      next()
    }
    
    x <- mean(tmp$responseEstimateLeft != tmp$responseEstimateLeftFinal |
                tmp$responseMarkerWidth != tmp$responseMarkerWidthFinal)
    
    changes$pChange[changes$pid %in% p] <- x
    
    if (x < minChangePercent) {
      exclusions$excluded[exclusions$pid %in% p] <- 
        addExclusion(exclusions$excluded[exclusions$pid %in% p], "pChange")
    }
  }
}


# outlying participants ---------------------------------------------------

if (exclude$participantOutliers) {
  if (!isSet("checkList"))
    stop("[checkList] must be set when excluding outlying participants.")
  
  if (!isSet("zThresh"))
    stop("[zThresh] must be set when excluding outlying participants.")
  
  for (v in checkList) {
    p <- aggregate(as.formula(paste(v, "~ pid + feedback")), 
                   AdvisedTrial, 
                   mean)
    p[, v] <- scale(p[, v])
    
    for (i in 1:nrow(p)) {
      if (abs(p[i, v] <= zThresh))
        next()
      
      exclusions$excluded[exclusions$pid == p$pid[i]] <- 
        addExclusion(exclusions$excluded[exclusions$pid == p$pid[i]], v)
    }
  }
}


# multiple attempts -------------------------------------------------------

if (exclude$multipleAttempts) {
  
  # by hash of prolific id
  for (uid in unique(okayIds$uidHash)) {
    
    ids <- okayIds$pid[okayIds$uidHash == uid]
    
    # participants who have multiple attempts at core trials
    if (length(ids[ids %in% AdvisedTrial[["pid"]]]) > 1) {
      tmp <- exclusions[exclusions$pid %in% ids, ]
      
      tmp$excluded <- addExclusion(tmp$excluded, "multipleAttempts")
      
      exclusions$excluded[exclusions$pid %in% ids, ] <- tmp$excluded
    }
    
    # participants who have answered the same question twice
    tmp <- c(AdvisedTrial$stimHTML[AdvisedTrial$pid %in% ids],
             practiceTrial$stimHTML[practiceTrial$pid %in% ids],
             practiceAdvisedTrial$stimHTML[practiceAdvisedTrial$pid %in% ids])
    
    if (length(tmp) > length(unique(tmp))) {
      tmp <- exclusions[exclusions$pid %in% ids, ]
      
      tmp$excluded <- addExclusion(tmp$excluded == F, "repeatedQuestion")
      
      exclusions$excluded[exclusions$pid %in% ids, ] <- tmp$excluded
    }
  }
}


# manual exclusions -------------------------------------------------------

if (exclude$manual) {
  
  if (is.null(manualExclusion) || 
      (length(manualExclusion) != 1 && 
       length(manualExclusion) != nrow(debrief.form))) {
    debrief.form[, c("pid", "comment")]
    stop("[manualExclusion] variable must be set when manually excluding participants")
  }
  
  debrief.form$manualExclusion <- manualExclusion
  
  for (p in exclusions$pid) {
    if (p %in% debrief.form$pid) {
      if (debrief.form$manualExclusion[debrief.form$pid == p]) {
        exclusions$excluded[exclusions$pid == p] <-
          addExclusion(exclusions$excluded[exclusions$pid == p], "manual")
      }
    }
  }
}


# bad marker --------------------------------------------------------------

if (exclude$badMarker) {
  # Check for erroneous marker values
  for (p in unique(AdvisedTrial$pid)) {
    tmp <- AdvisedTrial[AdvisedTrial$pid == p, ]
    if (!all(tmp$responseMarkerWidth %in% markerList) |
        !all(tmp$responseMarkerWidthFinal %in% markerList)) {
      if (p %in% exclusions$pid) {
        exclusions$excluded[exclusions$pid == p] <-
          addExclusion(exclusions$excluded[exclusions$pid == p], "badMarker")
      }
    }
  }
}


# excess ------------------------------------------------------------------

if (exclude$excess) {
  
  if (!isSet("nPerCell")) {
    stop("[nPerCell] must be set when excluding excess participants.")
  }
  
  for (x in unique(okayIds$condition)) {
    i <- 0
    
    for (p in exclusions$pid[exclusions$excluded == F]) {
      if (okayIds$condition[okayIds$pid %in% p] == x) {
        if (i >= nPerCell) {
          exclusions$excluded[exclusions$pid == p] <- "excess"
        } else {
          i <- i + 1
        }
      }
    }
  }
}

# do exclusions -----------------------------------------------------------


AdvisedTrial <- AdvisedTrial[AdvisedTrial$pid %in% 
                               exclusions$pid[exclusions$excluded == F], ]
decisions <- byDecision(AdvisedTrial)
PP <- participantSummary(decisions)

# Drop extraneous factor levels
for (n in ls()) {
  dirty <- F
  x <- get(n)
  if ("data.frame" %in% class(x)) {
    for (i in 1:ncol(x)) {
      if (is.factor(x[[i]])) {
        x[[i]] <- factor(x[[i]]) # renew level assignment
        dirty <- T
      }
    }
  }
  if (dirty) {
    assign(n, x)
  }
}

# cleanup -----------------------------------------------------------------

suppressWarnings(rm("tmp", "p", "i", "x", "n", "uid", "outliers", "v", "dirty", 
                    "ids"))
