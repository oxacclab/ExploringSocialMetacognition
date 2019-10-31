# Analysis of overall marker usage for participants in date estimation
# Matt Jaquiery
# July 2019

library(tidyverse)
library(beepr)

theme_set(theme_light())

old <- setwd("./ACv2")

# datesStudy --------------------------------------------------------------

studyName <- "datesStudy"
studyVersion <- "all"
vars <- list(
  AdvisedTrial = list(skipFeedbackCheck = T)
  )

source("./src/01_Load-Data.R")

setwd(old)


# Split versions by available markers -------------------------------------
df <- NULL
minimumN <- 30

for (v in unique(AdvisedTrial$studyVersion)) {
  mask <- AdvisedTrial$studyVersion == v
  tmp <- AdvisedTrial[mask, ]
  
  markers <- unique(c(tmp$responseMarkerWidth, tmp$responseMarkerWidthFinal))
  markers <- markers[order(markers)]
  
  # Calculate marker usage 
  for (p in unique(tmp$pid)) {
    x <- tmp[tmp$pid == p, ]
    n <- nrow(x)
    
    if (n < minimumN) {
      next()
    }
    
    for (m in markers) {
      i <- sum(x$responseMarkerWidth == m) / n
      f <- sum(x$responseMarkerWidthFinal == m) / n
      
      if (is.na(i)) i <- 0
      if (is.na(f)) f <- 0
      
      df <- rbind(df, tibble(pid = p, studyName = unique(x$studyId),
                             studyVersion = unique(x$studyVersion),
                             markers = paste(markers, collapse = ", "), 
                             marker = factor(m), first = i, last = f, 
                             n = factor(n)))
    }
  }
}

df <- gather(df, "decision", "proportion", c("first", "last"))

for (m in unique(df$markers)) {
  tmp <- df[df$markers == m, ]
  
  print(
    ggplot(tmp, aes(x = marker, y = proportion, group = pid)) +
      geom_hline(yintercept = 1 / length(unique(tmp$marker)), 
                 linetype = "dashed", size = 1) + 
      geom_line(alpha = .15, size = 1.5) +
      geom_point(aes(colour = pid)) +
      scale_color_discrete(guide = F) +
      facet_wrap(~decision, labeller = label_both) +
      theme_light() + 
      theme(panel.grid.major.x = element_blank(),
            panel.grid.minor = element_blank()) +
      labs(x = "marker width", y = "usage proportion")
  )
}

beep("coin")
