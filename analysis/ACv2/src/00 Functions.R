## Exploring Social Metacognition
## ACv2 Analysis 
## Matt Jaquiery
## 14 May 2019

## Functions


# libraries ---------------------------------------------------------------

library(testthat) # unit tests
library(curl) # fetching files from server

# constants ---------------------------------------------------------------

markerList <- {
  if (studyName == "datesStudy") 
    c(1, 3, 9, 11, 21, 27)
  else
    c(11)
}

# loading functions -------------------------------------------------------

#' List the files on the server matching the specified version
#' @param study to fetch data for. Default for back-compatability
#' @param version version of the experiment to use, or all for all
listServerFiles <- function(study = "datesStudy", version = "all") {
  rDir <- "https://acclab.psy.ox.ac.uk/~mj221/ESM/data/public/"
  
  if (version == "all") {
    version <- "[0-9\\-]+"
  }
  
  out <- NULL
  
  con <- curl(rDir)
  open(con, "rb")
  while (isIncomplete(con)) {
    buffer <- readLines(con, n = 1)
    if (length(buffer)) {
      f <- reFirstMatch(paste0(">(", study, "_v", version, "_[^<]+)"),
                        buffer)
      if (nchar(f)) {
        out <- c(out, paste0(rDir, f))
      }
    }
  }
  close(con)
  
  out
}


# processing functions ----------------------------------------------------

#' Add an additional reason for excluding a participant
#' @param current reason for exclusion
#' @param reason to add to the list
#' @return combined set of reasons
addExclusion <- function(current, reason) {
  if (current == F)
    reason
  else 
    paste(current, reason, collapse = ", ")
}


# wrangling functions -----------------------------------------------------

#' strip newlines and html tags from string
stripTags <- function(s) {
  s <- gsub("[\r\n]", "", s)
  
  while (any(grepl("  ", s, fixed = T)))
    s <- gsub("  ", " ", s, fixed = T)
  
  s <- gsub("^ ", "", s, perl = T)
  s <- gsub(" $", "", s, perl = T)
  
  while (any(grepl("<([^\\s>]+)[^>]*>([\\s\\S]*?)<\\/\\1>", s, perl = T)))
    s <- gsub("<([^\\s>]+)[^>]*>([\\s\\S]*?)<\\/\\1>", "\\2", s, perl = T)
  
  s <- gsub("<[^>]+\\/>", "", s)
  s
}

#' Return the first match for a regexpr
reFirstMatch <- function(pattern, str, ...) {
  re <- regexpr(pattern, str, ..., perl = T)
  name <- substr(str, attr(re, "capture.start"), 
                 attr(re, "capture.start") + attr(re, "capture.length") - 1)
  name
}

expect_equal(reFirstMatch("\\w+\\W+(\\w+)", "First, Second, Third"), "Second")

#' rbind with NA padding for missing columns
#' @params x list of data frames to join
#' @params padWith value for missing entries
safeBind <- function(x, padWith = NA) {
  
  out <- NULL
  first <- T
  
  for (y in x) {
    
    if (!is.data.frame(y))
      y <- as.data.frame(y)
    
    if (first) {
      out <- y
      first <- F
    } else {
      y[, names(out)[names(out) %in% names(y) == F]] <- padWith
      out[, names(y)[names(y) %in% names(out) == F]] <- padWith
      out <- rbind(out, y)
    }
  }
  
  out
}

expect_equal(dim(safeBind(list(data.frame(x = 1:5, y = runif(5), rnorm(5)),
                               data.frame(x = 6:10, z = 1:5)))),
             c(10, 4))

#' List the unique values of a vector and a "total" item with all unique values
#' Designed for outputting aggregate counts and totals
uniqueTotal <- function(x) {
  out <- as.list(unique(x))
  out[[length(out) + 1]] <- unique(x)
  out
}

expect_equal(uniqueTotal(c("a", "b", "c")), 
             list("a", "b", "c", c("a", "b", "c")))

#' Return a version of df with only the trials with a single advisor, 
#' and with all advice columns accessible as advisor0x where x is the 
#' name of the advisor column.
#' @param df data frame to process
singleAdvisorTrials <- function(df) {
  # Find the number of advisors by counting advisorXadvice columns
  df$advisorCount <- 0
  for (r in 1:nrow(df)) {
    i <- 0
    while (T) {
      if (!length(grep(paste0("advisor", i), names(df)))) {
        break()
      }
      
      i <- i + 1
    }
    df$advisorCount[r] <- i
  }
  
  # Only keep trials with a single advisor
  out <- df[df$advisorCount == 1, ]
  
  # fill in missing column names using the advisor's description + varname
  advCols <- unique(reFirstMatch(paste0("(?:",
                                        paste(advisorNames, collapse = "|"),
                                        ")\\.(\\S+)$"), names(df)))
  advCols <- advCols[!(advCols %in% unique(reFirstMatch("advisor0(\\S+)$", 
                                                        names(df))))]
  for (i in 1:nrow(out)) {
    for (v in advCols) {
      out[i, paste0("advisor0", v)] <- 
        out[i, paste0(out$advisor0idDescription[i], ".", v)]
    }
  }
  
  out
}

#' Produce a data frame of the trials where each decision gets a unique row
#' @param df trials with initial and final decisions
#' @return copy of df with a row per decision rather than per trial
byDecision <- function(df) {
  out <- df[, !grepl("^response(?=\\S+Final$)", names(df), perl = T)]
  
  out <- rbind(out, out)
  
  n <- nrow(df)
  
  out$decision <- sapply(1:nrow(out), 
                               function(x) 
                                 if (x <= n) "first" else "last")
  
  for (i in (n + 1):nrow(out)) {
    for (v in names(out)[grepl("^response", names(out), perl = T)]) {
      out[i, v] <- AdvisedTrial[i - n, paste0(v, "Final")]
    }
  }
  
  out
}

#' Extract participant summary variables
#' @param df trials to process
#' @param extract vector of numeric variables to extract (NULL for default)
#' @param by vector of categorical variables to aggregate by
#' @return table of participant summary stats
participantSummary <- function(df, extract = NULL, by = NULL) {
  
  if (is.null(extract))
    extract <- c("timeEnd", "responseCorrect", "responseError", "number")
  if (is.null(by))
    by <- c("pid", "responseMarker", "feedback", "decision")
  
  eq <- paste0("cbind(", paste(extract, collapse = ", "), ") ~ ", 
               paste(by, collapse = " + "))
  
  PP <- as.tibble(aggregate(as.formula(eq), df, mean))
  
  # record the n of each row so weighted averaging can be used later
  PP$number <- aggregate(as.formula(paste("number ~", 
                                          paste(by, collapse = " +"))), 
                         df, length)$number
  
  # Calculate the proportion of trials each breakdown in PP accounts for
  PP$proportion <- sapply(1:nrow(PP), 
                          function(i) 
                            length(unique(PP$decision)) * PP$number[i] / 
                            sum(PP$number[PP$pid == PP$pid[i]]))
  
  # Pad out the proportions with 0s
  for (p in unique(PP$pid)) {
    for (d in unique(PP$decision))
      for (m in unique(decisions$responseMarker))
        if (nrow(PP[PP$pid == p & 
                    PP$decision == d &
                    PP$responseMarker == m, ]) == 0)
          PP <- safeBind(list(PP, 
                              tibble(pid = p,
                                     responseMarker = m,
                                     feedback = PP$feedback[PP$pid == p][1],
                                     decision = d,
                                     number = 0,
                                     proportion = 0)))
  }
  
  PP
}

# analysis functions ------------------------------------------------------

#' Means of v for each marker after converting df entries to participant means
#' @params v column
#' @params df dataframe containing v
markerBreakdown <- function(v, df, hideMarkerTotal = F, missingValue = NA, ...) {
  v <- substitute(v)
  
  markerList <- markerList[markerList %in% df$responseMarker]
  
  fun <- function(x) {
    if (!nrow(x))
      return(missingValue)
    eq <- as.formula(paste(ensym(v), "~ + pid"))
    tmp <- aggregate(eq, x, mean, ...)
    mean(tmp[, ncol(tmp)])
  }
  
  # rename total fields
  n <- function(x, alt = NA) if (length(x) == 1) x else alt
  
  out <- list()
  for (d in uniqueTotal(df$decision)) {
    if (length(d) != 1)
      next()
    
    for (f in uniqueTotal(df$feedback)) {
      tmp <- tibble(decision = n(d), feedback = n(f))
      
      for (m in uniqueTotal(markerList)) {
        if (length(m) != 1 && hideMarkerTotal)
          next()
        
        x <- fun(df[df$decision %in% d & 
                      df$feedback %in% f &
                      df$responseMarker %in% m, ])
        
        if (is.na(n(m)))
          tmp$mean <- x
        else
          tmp[paste0("mean|m=", m)] <- x
      }
      
      out[[d]] <- rbind(out[[d]], tmp)
    }
  }
  
  out
}

#' Number of points a marker is worth
#' @param width of the marker
#' @return points the marker is worth
markerPoints <- function(width) 27 / width
