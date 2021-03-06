## Exploring Social Metacognition
## ACv2 Analysis 
## Matt Jaquiery
## 14 May 2019

## Load data

# dependencies ------------------------------------------------------------

isSet <- function(v) {
  length(grep(paste0("^", v, "$"), ls(parent.frame())))
}

if (!isSet('httpPath')) {
  httpPath <- "./"
}

source(paste0(httpPath, "src/00_Functions.R"))

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
if (!isSet("useRawTrialData")) {
  useRawTrialData <- F
}
if (!isSet("preserveWorkspaceVars")) {
  preserveWorkspaceVars <- F
}


# load data ---------------------------------------------------------------

allFiles <- listServerFiles(study = studyName, version = studyVersion, rDir = rDir)

studies <- unique(reFirstMatch("/([\\w-]*)_v[0-9\\-]+_[\\w-]+.csv$", allFiles))

for (study in studies) {
  studyFiles <- allFiles[grepl(study, allFiles)]
  versions <- unique(reFirstMatch("(v[0-9\\-]+)", studyFiles))
  
  for (v in versions) {
    files <- studyFiles[grepl(v, studyFiles, fixed = T)]
      
    # Screen for acceptable IDs
    f <- files[grep("metadata", files)]
    
    if (length(f) < 1)
      next()
    
    tmp <- read.csv(f)
    
    if (!isSet("testData")) {
      tmp$okay <- grepl("prolific", tmp$tags)
    } else {
      tmp$okay <- T
    }
    
    tmp$studyVersion <- v
    
    name <- "okayIds"
    # Bind to existing okayIds in workspace
    if ((length(versions) > 1 | preserveWorkspaceVars) & 
        any(grepl(paste0('^', name, '$'), ls()) == T)) {
      assign(name, safeBind(list(get(name), tmp)))
    } else {
      assign(name, tmp)
    }
    
    
    files <- files[grep("metadata", files, invert = T)]
    
    # convert CSV files to tibbles
    for (f in files) {
      
      name <- reFirstMatch("([^_]+)\\.csv", f)
      # Make name r-safe
      name <- sub("-", ".", name)
      
      tmp <- as_tibble(read.csv(f))
      
      x <- removeMismatchedRows(tmp)
      if (nrow(x$drop)) {
        warning(paste0("Dropping ", nrow(x$drop), " rows with mismatched headers."))
        # Quickest way to repair all the misapplied interpretations caused by header mismatch is to reload
        .lastDropped <- x$drop
        tmpFile <- tempfile()
        write.csv(x$keep, tmpFile, row.names = F)
        tmp <- read.csv(tmpFile) %>% as_tibble()
      }
      
      if (name == "Trial" || name == "AdvisedTrial") {
        if (useRawTrialData) 
          tmp <- suppressWarnings(
            patchTrialDataFromRaw(tmp, 
                                  studyName = studyName,
                                  studyVersion = studyVersion,
                                  rDir = rDir)
          )
      }
      
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
      
      # add labels to the columns from the associated data dictionaries
      tmp <- getLabels(tmp, str_replace(name, '\\.', '-'), 
                       rDir = rDir, warnOnMissing = 'variable')
  
      tmp <- getDerivedVariables(tmp, name, vars[[name]])
      
      # Check all variables have labels
      for (variable in names(tmp)) {
        if (label(tmp[variable]) == "") {
          print(paste(name, '-', variable))
          warning(paste0("Empty label for variable '", variable, "'\n"))
        }
      }
      
      # assign to workspace
      if ((max(length(studies), length(versions)) > 1 |
           preserveWorkspaceVars) & 
          any(grepl(paste0('^', name, '$'), ls()) == T)) {
        assign(name, safeBind(list(get(name), tmp)))
      } else {
        assign(name, tmp)
      }
    }
  }
}


mainDF <- if (isSet('AdvisedTrialWithConf')) 
  AdvisedTrialWithConf else AdvisedTrial

# additional framing of data ----------------------------------------------
decisions <- byDecision(mainDF)

if ("responseEstimateLeft" %in% names(mainDF)) {
  PP <- participantSummary(decisions)
}

# Hoist key variables -----------------------------------------------------

details <- getAdvisorDetails(mainDF)
advisorNames <- details[["names"]]
adviceTypes <- details[["types"]]

markerList <- getMarkerList()

# cleanup -----------------------------------------------------------------

suppressWarnings(rm("v", "suffix", "files", "name", "f", "names", "tmp"))
