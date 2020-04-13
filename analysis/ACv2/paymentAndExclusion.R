# Payments and data rejections for ACv2


# Load data ---------------------------------------------------------------

if (is.null(studyVersion))
  studyVersion <- version

if (is.null(studyName))
  studyName <- "datesStudy"

fName <- paste0("../data/private/", studyName, "_v", 
                       gsub('.', '-', studyVersion, fixed = T),
                       "_participant-metadata.csv")

key <- NULL

for (f in fName)
  key <- rbind(key, read.csv(f))

# Incomplete --------------------------------------------------------------

pids <- Trial %>% filter(!responseCorrect) %>% pull(pid) %>% unique()

key %>% 
  filter(pid %in% pids) %>% 
  select(prolificId, pid) %>%
  mutate(exclude = 'attention check fail') %>%
  as.data.frame()


# Exclusions --------------------------------------------------------------

dropped <- key[!(key$pid %in% exclusions$pid), ]
print("Dropped:")
print(as.character(dropped$prolificId))

key <- key[key$pid %in% exclusions$pid, ]

key$excluded <- sapply(key$pid, function(x) 
  exclusions$excluded[as.character(exclusions$pid) == as.character(x)])

print(paste("Exclusions: ", sum(key$excluded != F)))
key[key$excluded != F, c("prolificId", "pid", "excluded")]

for (i in grep("attnCheck", key$excluded)) {
  # skip excluding participants who also return a good version
  if (key$prolificId[i] %in% key$prolificId[key$excluded == F])
    next()
  
  x <- Trial[Trial$pid %in% key$pid[i], c("pid", "stimHTML", 
                                          "responseMarkerWidth", 
                                          "responseEstimateLeft")]
  x$stimHTML <- sub("for this question use the smallest marker to cover the year ", 
                    "...", x$stimHTML)
  x$stimHTML <- sub("for this question use the marker to cover the year ", 
                    "...", x$stimHTML)
  
  print(x)
}


# Bonus payments ----------------------------------------------------------

key <- key[key$excluded == F, ]

data <- aggregate(cbind(timeEnd, 
                        responseCorrect, 
                        responseError, 
                        responseScore) ~ pid, 
                  decisions[decisions$decision == "last", ], mean)

data <- data[data$pid %in% key$pid, ]
data[, 2:5] <- scale(data[, 2:5])

# While there is some correlation in response stats, it's not strong enough
# that we would expect participants scoring highly on one to score especially
# highly on others, so we pay bonuses based on the sum of the z-scores
data$sum <- apply(data[, 2:5], 1, sum)

maxBonus <- .5

data$bonusFactor <- round(maxBonus / data$sum ^ 2, 2)
data$bonus <- sapply(data$bonusFactor, function(x) min(maxBonus, x))

for (i in 1:nrow(data)) {
  tmp <- data[i, ]
  if (tmp$bonus > 0)
    cat(paste0(key$prolificId[key$pid %in% tmp$pid], ", ", tmp$bonus, "\n"))
}

# Cleanup -----------------------------------------------------------------

rm("key", "dropped", "data", "maxBonus")
