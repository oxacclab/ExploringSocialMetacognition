## Exploring Social Metacognition
## ACv2 Analysis 
## Matt Jaquiery
## 14 May 2019

## Exclusions

# dependencies ------------------------------------------------------------


isSet <- function(v) {
  length(grep(paste0("^", v, "$"), ls(parent.frame())))
}

if (!isSet('httpPath')) {
  httpPath <- "./"
}

if (!isSet("skipLoadData") || !skipLoadData) {
  source(paste0(httpPath, "src/01_Load-data.R"))
} else {
  source(paste0(httpPath, "src/00_Functions.R"))
  markerList <- getMarkerList()
}

if (isSet("overrideMarkerList")) {
  markerList <- overrideMarkerList
}


library(tibble)
library(dplyr)

# required variables ------------------------------------------------------

# Ensure there are some exlcusion rules to apply

if (!isSet("exclude")) {
  print(tribble(~variable, ~type, ~description,
                "maxAttnCheckFails", "int", "Maximum attention check failures allowed",
                "requireGroupAttnCheck", "bool", "Remove participants failing the 'which group were you in' debrief question",
                "requireComplete", "bool", "Remove participants who did not complete experiment",
                "maxTrialRT", "int", "Remove trials with long response times",
                "minTrials", "int", "Remove participants with too few trials",
                "minOffBrandTrials", "int", "Remove participants with too few offbrand trials",
                "minChangePercent", "int", "Remove participants who change response on too few trials",
                "participantOutliers", "dataframe", "Remove participants by abs(scale(df$varName)) > .$zThresh",
                "multipleAttempts", "bool", "Remove participants who saw feedback on questions in previous attempts",
                "manual", "vector", "Remove participants by logical mask",
                "maxPerCondition", "int", "Remove excess participants by condition",
                "badMarker", "bool", "Remove participants with some bad markers",
                "custom", "list", "Remove participants based on named custom functions."))
  
  stop("No criteria for exclusion ([exclude] variable not set). See above for a list of options.")
}

mainDFName <- if (isSet('AdvisedTrialWithConf')) 
  'AdvisedTrialWithConf' else 'AdvisedTrial'

mainDF <- get(mainDFName)

referenceTrialList <- mainDF

# output variables --------------------------------------------------------

exclusions <- tibble(pid = unique(mainDF$pid))
exclusions$studyVersion <- sapply(exclusions$pid, function(x) 
  mainDF$studyVersion[mainDF$pid == x][1])
exclusions$excluded <- F

# attention checks --------------------------------------------------------

if (!is.null(exclude$maxAttnCheckFails) && !is.na(exclude$maxAttnCheckFails)) {
  for (p in unique(exclusions$pid)) {
    tmp <- Trial[Trial$pid == p, ]
    
    if (sum(tmp$responseCorrect == F) > exclude$maxAttnCheckFails)
      exclusions$excluded[exclusions$pid == p] <- 
        addExclusion(exclusions$excluded[exclusions$pid == p], "attnCheckYear")
    
    if ("responseMarkerWidth" %in% names(tmp)) {
      smallest <- min(Trial$responseMarkerWidth[Trial$studyVersion == 
                                                  tmp$studyVersion[1]])
      
      if (sum(tmp$responseMarkerWidth != smallest) > 
          exclude$maxAttnCheckFails)
        exclusions$excluded[exclusions$pid == p] <- 
          addExclusion(exclusions$excluded[exclusions$pid == p], "attnCheckWidth")
    }
  }
  
  # Drop excluded participants' trials
  tmp <- NULL
  for (i in 1:nrow(mainDF))
    if (exclusions$excluded[exclusions$pid == mainDF$pid[i]] == F)
      tmp <- rbind(tmp, mainDF[i, ])
  
  mainDF <- tmp
}

if (!is.null(exclude$requireGroupAttnCheck) && !is.na(exclude$requireGroupAttnCheck)) {
  for (p in unique(exclusions$pid)) {
    tmp <- debrief.form
    
    if (length(tmp$group[tmp$pid == p]) && tmp$group[tmp$pid == p] == 0)
      exclusions$excluded[exclusions$pid == p] <- 
        addExclusion(exclusions$excluded[exclusions$pid == p], "groupAttnCheck")
  }
  
  # Drop excluded participants' trials
  tmp <- NULL
  for (i in 1:nrow(mainDF))
    if (exclusions$excluded[exclusions$pid == mainDF$pid[i]] == F)
      tmp <- rbind(tmp, mainDF[i, ])
  
  mainDF <- tmp
}

# incomplete --------------------------------------------------------------

if (!is.null(exclude$requireComplete) &&
    !is.na(exclude$requireComplete) && 
    exclude$requireComplete) {
  for (p in unique(exclusions$pid)) {
    if (!(p %in% debrief.advisors$pid)) {
      exclusions$excluded[exclusions$pid == p] <-
        addExclusion(exclusions$excluded[exclusions$pid == p], "incomplete")
    }
  }
}


# outlying trials ---------------------------------------------------------

if (!is.null(exclude$maxTrialRT) &&
    !is.na(exclude$maxTrialRT) && exclude$maxTrialRT > 0) {
  mainDF <- mainDF[mainDF$timeEnd <= exclude$maxTrialRT, ]
}


# outlying trial count ----------------------------------------------------

if (!is.null(exclude$minTrials) &&
    !is.na(exclude$minTrials) && exclude$minTrials > 0) {
  
  for (p in unique(exclusions$pid)) {
    if (sum(mainDF$pid == p) < exclude$minTrials)
      exclusions$excluded[exclusions$pid == p] <- 
        addExclusion(exclusions$excluded[exclusions$pid == p], "outlyingTrials")
  }
  
  # Drop excluded participants' trials
  tmp <- NULL
  for (i in 1:nrow(mainDF))
    if (exclusions$excluded[exclusions$pid == mainDF$pid[i]] == F)
      tmp <- rbind(tmp, mainDF[i, ])
  
  mainDF <- tmp
}

# offbrand outliers -------------------------------------------------------

if (!is.null(exclude$minOffBrandTrials) &&
    !is.na(exclude$minOffBrandTrials) && 
    exclude$minOffBrandTrials > 0) {
  
  for (p in unique(exclusions$pid)) {
    if (sum(mainDF$advisor0offBrand[mainDF$pid == p]) < 
        exclude$minOffBrandTrials)
      exclusions$excluded[exclusions$pid == p] <- 
        addExclusion(exclusions$excluded[exclusions$pid == p], "offBrandOutliers")
  }
  
  # Drop excluded participants' trials
  tmp <- NULL
  for (i in 1:nrow(mainDF))
    if (exclusions$excluded[exclusions$pid == mainDF$pid[i]] == F)
      tmp <- rbind(tmp, mainDF[i, ])
  
  mainDF <- tmp
}

# min change percent ------------------------------------------------------

if (!is.null(exclude$minChangeRate) && 
    !is.na(exclude$minChangeRate) && 
    exclude$minChangeRate) {
  changes <- tibble(pid = exclusions$pid, pChange = 0)
  
  for (p in exclusions$pid) {
    tmp <- mainDF[mainDF$pid %in% p, ]
    
    null <- F
    
    if (is.null(tmp)) {
      null <- T
    } else {
      null <- nrow(tmp) == 0
    }
    
    if (null) {
      changes <- changes[!(changes$pid %in% p), ]
      next()
    }
    
    if ("responseEstimateLeft" %in% names(tmp)) {
      x <- mean(tmp$responseEstimateLeft != tmp$responseEstimateLeftFinal |
                  tmp$responseMarkerWidth != tmp$responseMarkerWidthFinal)
    } 
    if ("responseConfidence" %in% names(tmp)) {
      x <- mean(tmp$responseConfidence != tmp$responseConfidenceFinal |
                  tmp$responseAnswerSide != tmp$responseAnswerSideFinal)
    }
    
    
    changes$pChange[changes$pid %in% p] <- x
    
    if (x < exclude$minChangeRate) {
      exclusions$excluded[exclusions$pid %in% p] <- 
        addExclusion(exclusions$excluded[exclusions$pid %in% p], "pChange")
    }
  }
}


# outlying participants ---------------------------------------------------

if (!is.null(exclude$participantOutliers) &&
    !is.na(exclude$participantOutliers) &&
    !is.na(exclude$participantOutliers) && 
    nrow(exclude$participantOutliers) > 0) {
  if (!("varName" %in% names(exclude$participantOutliers)))
    stop("exclude$participantOutliers must contain column varName")
  
  if (!("zThresh" %in% names(exclude$participantOutliers)))
    stop("exclude$participantOutliers must contain column zThresh")
  
  tmp <- exclude$participantOutliers
  
  for (i in seq(nrow(tmp))) {
    v <- as.character(tmp$varName[i])
    p <- aggregate(as.formula(paste(v, "~ pid + feedback")), 
                   mainDF, 
                   mean)
    p[, v] <- abs(scale(p[, v])) # convert to z-scores
    
    for (j in 1:nrow(p)) {
      if (p[j, v] <= tmp$zThresh[i])
        next()
      
      exclusions$excluded[exclusions$pid == p$pid[i]] <- 
        addExclusion(exclusions$excluded[exclusions$pid == p$pid[i]], v)
    }
  }
}

# multiple attempts -------------------------------------------------------

# In later study versions repetitions are forbidden web-side for prolific
# participants

if (!is.null(exclude$multipleAttempts) &&
    !is.na(exclude$multipleAttempts) && 
    exclude$multipleAttempts) {
  
  # by hash of prolific id
  for (uid in unique(okayIds$uidHash)) {
    
    ids <- okayIds$pid[okayIds$uidHash == uid]
    
    # participants who have multiple attempts at core trials
    if (length(ids[ids %in% referenceTrialList[["pid"]]]) > 1) {
      tmp <- exclusions[exclusions$pid %in% ids, ]
      
      tmp$excluded <- addExclusion(tmp$excluded, "multipleAttempts")
      
      exclusions$excluded[exclusions$pid %in% ids] <- tmp$excluded
    }
    
    # participants who have answered the same question twice
    tmp <- c(referenceTrialList$stimHTML[referenceTrialList$pid %in% ids],
             practiceTrial$stimHTML[practiceTrial$pid %in% ids],
             practiceAdvisedTrial$stimHTML[practiceAdvisedTrial$pid %in% ids])
    
    if (length(tmp) > length(unique(tmp))) {
      tmp <- exclusions[exclusions$pid %in% ids, ]
      
      tmp$excluded <- addExclusion(tmp$excluded == F, "repeatedQuestion")
      
      exclusions$excluded[exclusions$pid %in% ids] <- tmp$excluded
    }
  }
}

# manual exclusions -------------------------------------------------------

if (!is.null(exclude$manual) &&
    !is.na(exclude$manual) && 
    length(exclude$manual) > 0) {
  
  if (length(exclude$manual) != 1 && 
       length(exclude$manual) != nrow(debrief.form)) {
    debrief.form[, c("pid", "comment")]
    stop("exclude$manual vector must be of length 1 or equal to the number of participants")
  }
  
  debrief.form$manualExclusion <- exclude$manual
  
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

if (!is.null(exclude$badMarker) && !is.na(exclude$badMarker)) {
  # Check for erroneous marker values
  for (p in unique(mainDF$pid)) {
    tmp <- mainDF[mainDF$pid == p, ]
    if (!all(tmp$responseMarkerWidth %in% markerList) |
        !all(tmp$responseMarkerWidthFinal %in% markerList)) {
      if (p %in% exclusions$pid) {
        exclusions$excluded[exclusions$pid == p] <-
          addExclusion(exclusions$excluded[exclusions$pid == p], "badMarker")
      }
    }
  }
}


# bad honesty questionnaire responses -------------------------------------

if (!is.null(exclude$qqLableWhitelist) && 
    length(exclude$qqLableWhitelist) > 0) {
  # Exclude participants who didn't use the right labels (e.g. translations) for
  # the questionnaire about advice honesty
  tmp <- AdvisedTrial %>% 
    dplyr::filter(!(advisor0questionnaireHonestyLabel %in% 
                      exclude$qqLableWhitelist)) %>%
    group_by(pid) %>%
    summarise(n = n()) %>%
    pull(pid) 
  
  exclusions$excluded[exclusions$pid %in% tmp] <- 
    addExclusion(exclusions$excluded[exclusions$pid %in% tmp], 
                 'badQQLabels')
}


# excess ------------------------------------------------------------------

if (!is.null(exclude$maxPerCondition) &&
    !is.na(exclude$maxPerCondition) && 
    exclude$maxPerCondition > 0) {
  
  for (x in unique(okayIds$condition)) {
    i <- 0
    
    for (p in exclusions$pid[exclusions$excluded == F]) {
      if (okayIds$condition[okayIds$pid %in% p] == x) {
        if (i >= exclude$maxPerCondition) {
          exclusions$excluded[exclusions$pid == p] <- "excess"
        } else {
          i <- i + 1
        }
      }
    }
  }
}

# custom ------------------------------------------------------------------

# Custom exclusion functions take a participant's mainDF trials as input and 
# return T if that participant should be excluded.

# Loop through custom exclusion functions and execute them.
if (!is.null(exclude$custom)) {
  for (i in 1:length(exclude$custom)) {
    r <- names(exclude$custom)[i]
    f <- exclude$custom[[i]]
    for (p in unique(mainDF$pid)) {
      tmp <- mainDF %>% filter(pid == p)
      if (f(tmp)) {
        if (p %in% exclusions$pid) {
          exclusions$excluded[exclusions$pid == p] <-
            addExclusion(exclusions$excluded[exclusions$pid == p], r)
        }
      }
    }
  }
}


# do exclusions -----------------------------------------------------------


mainDF <- mainDF[mainDF$pid %in% exclusions$pid[exclusions$excluded == F], ]
assign(mainDFName, mainDF)
decisions <- byDecision(mainDF)

if ("responseEstimateLeft" %in% names(mainDF)) {
  PP <- participantSummary(decisions)
}

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

suppressWarnings(rm("tmp", "p", "i", "x", "n", "uid", "null",
                    "outliers", "v", "dirty", "ids", "referenceTrialList"))
