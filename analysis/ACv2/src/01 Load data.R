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
if (!isSet("studyName")) {
  studyName <- "datesStudy"
}
if (!isSet("rDir")) {
  rDir = "https://acclab.psy.ox.ac.uk/~mj221/ESM/data/public/"
}
if (!isSet("vars")) {
  vars <- list() # variables passed to getDerviedVariables
}


# load data ---------------------------------------------------------------

allFiles <- listServerFiles(study = studyName, version = studyVersion, rDir = rDir)

versions <- unique(reFirstMatch("(v[0-9\\-]+)", allFiles))

for (v in versions) {
  files <- allFiles[grepl(v, allFiles, fixed = T)]
    
  # Screen for acceptable IDs
  f <- files[grep("metadata", files)]
  
  if (length(f) < 1)
    next()
  
  okayIds <- read.csv(f)
  
  if (!isSet("testData")) {
    okayIds$okay <- grepl("prolific", okayIds$tags)
  } else {
    okayIds$okay <- T
  }
  
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
    for (z in n)
      tmp[, z] <- lapply(tmp[, z], as.character)
    
    n <- grep("responseEstimateLabel", names(tmp), value = T)
    for (z in n)
      tmp[, z] <- lapply(tmp[, z], function(y) 
        numerify(stripTags((as.character(y)))))
    
    if ("responseMarkerWidth" %in% names(tmp))
      tmp$responseMarker <- factor(tmp[["responseMarkerWidth"]])
    if ("responseMarkerWidthFinal" %in% names(tmp))
      tmp$responseMarkerFinal <- factor(tmp[["responseMarkerWidthFinal"]])
    
    # assign to workspace
    name <- reFirstMatch("([^_]+)\\.csv", f)
    name <- sub("-", ".", name)
    
    tmp <- getDerivedVariables(tmp, name, vars[[name]])
    
    if (length(versions) > 1 & 
        any(grepl(paste0('^', name, '$'), ls()) == T)) {
      assign(name, safeBind(list(get(name), tmp)))
    } else {
      assign(name, tmp)
    }
  }
}

# additional framing of data ----------------------------------------------
decisions <- byDecision(AdvisedTrial)

PP <- participantSummary(decisions)

# Hoist key variables -----------------------------------------------------

details <- getAdvisorDetails(AdvisedTrial)
advisorNames <- details[["names"]]
adviceTypes <- details[["types"]]

markerList <- getMarkerList()

# cleanup -----------------------------------------------------------------

suppressWarnings(rm("v", "suffix", "files", "name", "f", "names", "tmp"))
