# Payment script for dateEstimation
# Run after running dateEstimation.Rmd to generate the DE.pSummary data frame

DE.id <- as.tibble(read.csv("../../data/private/dateCheck_participant-metadata.csv"))

# # Bonuses start at 80% good answers and improve up to £0.50 at 100%
# DE.pSummary$bonus <- round((DE.pSummary$goodAnswerRate - .80) * 2.5, 2) 
# DE.pSummary$bonus[DE.pSummary$bonus < 0] <- 0

maxBonus <- 0.5

# Bonuses paid for doing reasonably well:
# * clustering around the mean error and rt
# Bonuses are sliced by quantile for each
tmp <- tibble(id = DE.pSummary$id)
tmp$me <- as.numeric(quantileCut(DE.pSummary$meanError, 
                                 10, 
                                 ordered_result = T))
tmp$rt <- as.numeric(quantileCut(DE.pSummary$meanRT, 
                                 10, 
                                 ordered_result = T))
me <- 5 - abs(5 - tmp$me)
rt <- 5 - abs(5 - tmp$rt)

tmp$bonus <- (me + rt) / 10 * maxBonus

ggplot(tmp, aes(x = scale(me), y = scale(rt), color = id, size = bonus)) + 
  geom_point() + 
  coord_fixed() +
  theme_light()

table(tmp$bonus)
sum(tmp$bonus)

for (id in unique(DE.pSummary$id[DE.pSummary$bonus > 0])) {
  cat(paste0(DE.id$prolificId[DE.id$id == id], ", ",
            DE.pSummary$bonus[DE.pSummary$id == id], "\n"))
}

rm("DE.id")
