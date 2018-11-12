# General utility functions -----------------------------------------------

# Presentation functions --------------------------------------------------

#' Format proportion to be a string beginning with a decimal point.
#' Does not respect scientific notation options
#' @param proportion number to convert to string
#' @param precision decimal places to preserve
#' @param truncateZeros whether to strip trailing 0s
#' @return \{code}proportion stripped of leading 0s and rounded to \{code}precision decimal places
prop2str <- function(proportion, precision = 2, truncateZeros = F) {
  if(length(proportion) > 1)
    return(sapply(proportion, function(x) prop2str(x, precision, truncateZeros)))
  if(is.nan(proportion))
    return(as.character(proportion))
  proportion <- round(as.numeric(proportion), precision)
  # if we hit scientific notation then give up!
  if(grepl('e', proportion, fixed = T))
    return(as.character(proportion))
  if(abs(proportion) < 1)
    x <- sub('^-?0\\.', ifelse(proportion < 0, '-.', '.'), as.character(proportion))
  else 
    x <- as.character(proportion)
  if(truncateZeros)
    return(x)
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

#' Format number to be a string beginning with a decimal point.
#' Does not respect scientific notation options
#' @param num number to convert to string
#' @param precision decimal places to preserve
#' @param truncateZeros whether to strip trailing 0s
#' @return \{code}num stripped of leading 0s and rounded to \{code}precision decimal places
num2str <- function(num, precision = 2, truncateZeros = F) {
  if(length(num) > 1)
    return(sapply(num, function(x) num2str(x, precision, truncateZeros)))
  if(is.nan(num))
    return(as.character(num))
  num <- round(as.numeric(num), precision)
  # string manipulation to pad 0s
  x <- as.character(num)
  if(truncateZeros)
    return(x)
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
#' @param isProportion whether to print the values as proportions (strip leading 0)
#' @return string representation of the mean, CIs, and range of the \{code}vector
printMean <- function(vector, label = 'Mean', doPrint = T, conf.int = .95, na.rm = F, decimals = 2, isProportion = F) {
  precisionFun <- ifelse(isProportion, prop2str, num2str)
  mu <- mean(vector, na.rm = na.rm)
  s <- sd(vector, na.rm = na.rm)
  n <- length(vector)
  ci <- ciMean(vector, conf = conf.int) # lsr::ciMean()
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

style <- theme_light() +
  theme(panel.grid.minor = element_blank(),
        panel.grid.major.x = element_blank(),
        text = element_text(size = gg.font.med),
        plot.title = element_text(size = gg.font.large, margin=margin(0,0,gg.font.large,0)),
        legend.position = 'top')

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
  obj$F <- num2str(obj$F)
  obj$p <- prop2str(obj$p, 3)
  obj$ges <- prop2str(obj$ges, 4)
  return(obj)  
}
