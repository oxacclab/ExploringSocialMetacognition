# Payment script for dateEstimation
# Run after running dateEstimation.Rmd to generate the DE.pSummary data frame

DE.id <- as.tibble(read.csv("../data/private/dateCheck_participant-metadata.csv"))

# Bonuses start at 80% good answers and improve up to £0.50 at 100%
DE.pSummary$bonus <- round((DE.pSummary$goodAnswerRate - .80) * 2.5, 2) 
DE.pSummary$bonus[DE.pSummary$bonus < 0] <- 0

table(DE.pSummary$bonus)
sum(DE.pSummary$bonus)

for (id in unique(DE.pSummary$id[DE.pSummary$bonus > 0])) {
  cat(paste0(DE.id$prolificId[DE.id$id == id], ", ",
            DE.pSummary$bonus[DE.pSummary$id == id], "\n"))
}

rm("DE.id")
