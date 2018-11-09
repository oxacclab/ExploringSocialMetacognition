# General utility functions -----------------------------------------------

# Presentation functions --------------------------------------------------

#' Format proportion to be a string beginning with a decimal point.
#' Does not respect scientific notation options
#' @param proportion number to convert to string
#' @param precision decimal places to preserve
#' @return \{code}proportion stripped of leading 0s and rounded to \{code}precision decimal places
prop2str <- function(proportion, precision = 2) {
  if(length(proportion) > 1)
    return(sapply(proportion, prop2str))
  if(is.nan(proportion))
    return(as.character(proportion))
  proportion <- round(proportion, precision)
  if(abs(proportion) < 1)
    x <- sub('^-?0\\.', ifelse(proportion < 0, '-.', '.'), as.character(proportion))
  else 
    x <- as.character(proportion)
  dot <- regexpr('.', x, fixed = T)
  if(dot == -1) {
    x <- paste0(x,'.')
    dot <- regexpr('.', x, fixed = T)
  }
  right <- substr(x, dot, dot+precision) # portion of x after 0
  right <- paste0(right, strrep('0',precision-nchar(right)+1))
  x <- paste0(substr(x, 1, dot-1), right)
  return(x)
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
#' @return string representation of the mean, CIs, and range of the \{code}vector
printMean <- function(vector, label = 'Mean', doPrint = T, conf.int = .95, na.rm = F, decimals = 2) {
  mu <- mean(vector, na.rm = na.rm)
  s <- sd(vector, na.rm = na.rm)
  n <- length(vector)
  error <- qnorm(1-(1-conf.int)/2)*s/sqrt(n) # 95% confidence interval width
  ci.low <- mu - error
  ci.high <- mu + error
  r <- round(range(vector, na.rm = na.rm), decimals)
  out <- paste0(label,'=', round(mu,decimals), ' [', round(conf.int,decimals)*100, '%CI: ',
               round(ci.low,decimals), ', ', round(ci.high,decimals),'] [Range: ',
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

style <- theme_light() +
  theme(panel.grid.minor = element_blank(),
        panel.grid.major.x = element_blank(),
        text = element_text(size = gg.font.small),
        plot.title = element_text(size = gg.font.med),
        legend.position = 'top')

style.long <- style + theme(legend.position = 'none')

# Utility functions -------------------------------------------------------

