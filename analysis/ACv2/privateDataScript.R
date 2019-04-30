# Support script for ACv2/coreAnalysis.Rmd

# Read private data and provide a list of proper study ids to the main analysis
# script

key <- read.csv(paste0("../data/private/datesStudy_v", version,
                       "_participant-metadata.csv"))

# Simple regex matching for something that looks like a prolificId
key$isOkay <- grepl("^[0-9a-f]{24}$", key$prolificId)

okay <- data.frame(pid = key$pid, okay = key$isOkay)

write.csv(okay, paste0("../data/public/datesStudy_v", version,
                                      "_okayIds.csv"))

rm("key", "okay")
