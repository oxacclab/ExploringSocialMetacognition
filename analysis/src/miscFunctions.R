# General utility functions -----------------------------------------------

# Presentation functions --------------------------------------------------

if(!require(prettyMD)) {
  devtools::install_github('mjaquiery/prettyMD')
  library(prettyMD)
}

#' Print the results of a t-test as we would like to see them reported in a paper
#' @param results t.test result to print
#' @param d cohensD of the t.test
#' @param doPrint whether to call print() on the output
#' @return string with neatly printed mean
prettyPrint <- function(results, d = NULL, doPrint = T) {
  es <- NULL
  if(!is.null(d))
    es <- paste0(' , d = ', round(d,2))
  out <- paste0('t(',results$parameter,') = ',round(results$statistic,2),
                ' [',round(attr(results$conf.int, "conf.level")*100),'%CI: ',
                round(results$conf.int[[1]],2), ', ', round(results$conf.int[[2]],2),'],',
                ' p = ',prop2str(results$p.value,3), es)
  if(doPrint)
    print(out)
  return(out)
}

#' Print the mean and CIs of a vector
#' @param vector data in
#' @param label prefix for the stats
#' @param doPrint whether to call print() on the output
#' @param conf.int width of the confidence intervals
#' @param na.rm whether NA values are removed before averaging
#' @param decimals decimal places to round to
#' @param isProportion whether to print the values as proportions (strip leading 0)
#' @return string representation of the mean, CIs, and range of the \{code}vector
printMean <- function(vector, label = 'Mean', doPrint = T, conf.int = .95, na.rm = F, decimals = 2, isProportion = F) {
  precisionFun <- ifelse(isProportion, prop2str, num2str)
  mu <- mean(vector, na.rm = na.rm)
  s <- sd(vector, na.rm = na.rm)
  n <- length(vector)
  ci <- ciMean(vector, conf = conf.int, na.rm = na.rm) # lsr::ciMean()
  ci.low <- ci[1]
  ci.high <- ci[2]
  r <- precisionFun(range(vector, na.rm = na.rm), decimals)
  out <- paste0(label,'=', precisionFun(mu,decimals), ' [', precisionFun(conf.int*100,decimals,F), '%CI: ',
                precisionFun(ci.low,decimals), ', ', precisionFun(ci.high,decimals),'] [Range: ',
               r[[1]], ', ', r[[2]], ']')
  if(doPrint)
    print(out)
  return(out)
}

#' Quickly get t-test and bayes factor, and means for two vectors
#' @param v1 first vector
#' @param v2 second vector
#' @param label1 label of the first vector
#' @param label2 label of the second vector
#' @param paried whether the vectors are paired observations
#' @param doPrint whether to print the results while running
#' @return string with neat details of the comparison
quickCompareVectors <- function(v1, v2, label1 = 'Vector 1', label2 = 'Vector2', paired = F, doPrint = T) {
  result <- t.test(v1, v2, paired = paired)
  d <- cohensD(v1, v2)
  bf <- ttestBF(v1, v2, paired = paired)
  out <- paste0(printMean(v1, label1, F), ' \n', printMean(v2, label2, F))
  out <- paste0(out, ' \n', prettyPrint(result, d, doPrint = F), ', BF = ', round(exp(bf@bayesFactor$bf),3))
  if(doPrint) {
    printMean(v1, label1)
    printMean(v2, label2)
    print(paste0(prettyPrint(result, d, doPrint = F), ', BF = ', round(exp(bf@bayesFactor$bf),3)))
  }
  return(out)
}

# ggplot Presentation -----------------------------------------------------

gg.font.small <- 16
gg.font.med <- 20
gg.font.large <- 24

# ggplot styles adapted from the BBC's bbplot package

style <- theme_light() +
  theme(plot.title = element_text(size = 28, face = "bold", color = "#222222"), 
        plot.subtitle = element_text(size = 22, margin = margin(9, 0, 9, 0)), 
        plot.caption = element_blank(), 
        legend.position = "top", 
        legend.text.align = 0, 
        legend.background = element_blank(), 
        legend.title = element_blank(), 
        legend.key = element_blank(), 
        legend.text = element_text(size = 18, color = "#222222"), 
        axis.title = element_text(size = 18, color = "#222222"),
        axis.text = element_text(size = 18, color = "#222222"), 
        # axis.text.x = element_text(margin = margin(5, b = 10)), 
        axis.ticks = element_blank(), 
        axis.line = element_blank(), 
        panel.grid.minor = element_blank(), 
        panel.grid.major.y = element_line(color = "#cbcbcb"), 
        panel.grid.major.x = element_blank(), 
        panel.background = element_blank(), 
        strip.background = element_rect(fill = "grey75"), 
        strip.text = element_text(size = 16))

# style <- theme_light() +
#   theme(panel.grid.minor = element_blank(),
#         panel.grid.major.x = element_blank(),
#         text = element_text(size = gg.font.med),
#         plot.title = element_text(size = gg.font.large, margin=margin(0,0,gg.font.large,0)),
#         legend.position = 'top') 

style.long <- style + theme(legend.position = 'none')

# Utility functions -------------------------------------------------------

#' Find missing values in an aggreagated data frame
#' @param df data frame to investigate
#' @param id.colName column of ids to check for missing rows
#' @param factor.colNames list of factor columns which must be present for all
#'   ids at all factor level combinations
#'
#' @return vector of id.colName values which do not have values at all levels
#'   for all factors. 
#'  
#' WARNING: Just tests numbers, not actual values!
aggregateMissing <- function(df, id.colName, factor.colNames) {
  out <- NULL
  lvls <- 1
  for(x in factor.colNames) {
    lvls <- lvls * length(levels(df[ , x]))
  }
  for(id in unique(df[ , id.colName])) {
    if(sum(df[ , id.colName] == id) < lvls)
      out <- c(out, id)
  }
  return(out)
}


# Specific package tweaks -------------------------------------------------

#' Make ezANOVA's $ANOVA output neater by rounding appropriately
#' @param obj ezANOVA output (supports return_aov = T|F)
prettifyEZ <- function(obj) {
  # if there's a $ANOVA item use that instead
  if(!is.null(obj$ANOVA))
    return(prettifyEZ(obj$ANOVA))
  okayCols <- c('F', 'p', 'ges') %in% colnames(obj)
  if(!all(okayCols)) {
    colString <- paste0(c('F', 'p', 'ges')[!okayCols], collapse = ', ')
    msg <- paste0('Expected column', ifelse(sum(!okayCols) < 2, ' (', 's ('),
                  colString, 
                  ') not found; supplied object does not appear to be an ezANOVA output.')
    stop(msg)
  }
  obj$F <- num2str(obj$F)
  obj$p <- prop2str(obj$p, 3)
  obj$ges <- prop2str(obj$ges, 4)
  return(obj)  
}
