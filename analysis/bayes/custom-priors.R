
# Bayes with custom priors ------------------------------------------------

# We'll eventually be playing around with advisor choice data, so we'll load it now
ac <- read.csv('bayes/advisorChoices.csv')

# load some packages
library(rstanarm)
library(insight)
library(bayestestR)
library(tidyverse)
theme_set(theme_light() + 
            theme(panel.grid = element_blank(),
                  legend.position = 'top'))

# Do a basic example following https://easystats.github.io/bayestestR/articles/example1.html (linear model with cat. predictor)
data <- chickwts %>%
  filter(feed %in% c("meatmeal", "sunflower"))
model <- stan_glm(weight ~ feed, data = data)
p <- get_priors(model)
pp <- get_parameters(model)

ggplot(pp, aes(x = feedsunflower)) + geom_density(fill = "red")

hdi(pp$feedsunflower)
p_direction(pp$feedsunflower)

describe_posterior(model)

# Empirical calculation of null model -------------------------------------

n <- ac %>% filter(condition == "Feedback condition") %>% nrow()
iterations <- 100000
# Simulate random (p = .5) picking for n observations many many times
nullData <- tibble(iter = 1:iterations, hits = rbinom(iterations, n, .5)/n)
hist(nullData$hits, breaks = 10)
nullData %>% summarise(mean = mean(hits), sd = sd(hits))

# Prior models ------------------------------------------------------------

# A model with AUC = 1 (i.e. a Probability Density Function) for a y=x slope over the top half of the range
h1 <- function(x) ifelse(x < .5, 0, (x - .5) * 8) / length(x)
# SD selected here is based on the empirical simulation above
h0 <- function(x) dnorm(x, .5, nullData %>% pull(hits) %>% sd()) / length(x)

ggplot(tibble(x = seq(0, 1, length.out = 100)), aes(x = x)) +
  stat_function(fun = h0, aes(colour = 'h0')) +
  stat_function(fun = h1, aes(colour = 'h1'))

# Characterising the hypotheses:
d <- tibble(x = seq(0, 1, length.out = 1000), h0 = h0(x), h1 = h1(x))
print('Integrals')
summarise_at(d, c("h0", "h1"), sum)

print('Expected value') 
d %>% mutate(h0e = h0 * x, h1e = h1 * x) %>% summarise_at(c("h0e", "h1e"), sum)

print('Variance')
E <- list(h0 = sum(d$h0 * d$x), h1 = sum(d$h1 * d$x))
v <- d %>% mutate(h0v = (x - E$h0) ^ 2, h1v = (x - E$h1) ^ 2) %>% summarise_at(c("h0v", "h1v"), mean)
v

print('Standard deviation')
v %>% transmute(h0sd = sqrt(h0v), h1sd = sqrt(h1v))

# HDI
myHDI <- function(x, ci = .89) {
  names(x) <- c('x', 'v')
  x <- x %>% arrange(x)
  ci2 <- (1 - ci) / 2
  s <- 0
  i <- 0
  while (s < ci2) {
    i <- i + 1
    if (i > nrow(x)) break
    s <- s + x$v[i]
  }
  out <- list(ci = ci, low = x$x[i])
  while (s < 1 - ci2) {
    i <- i + 1
    if (i > nrow(x)) break
    s <- s + x$v[i]
  }
  out$high <- x$x[i]
  out
}

HDIofMCMC = function(sampleVec, credMass=0.95) {
  # Computes highest density interval from a sample of representative values,
  # estimated as shortest credible interval.
  # Arguments:
  # sampleVec
  # is a vector of representative values from a probability distribution.
  # credMass
  # is a scalar between 0 and 1, indicating the mass within the credible
  # interval that is to be estimated.
  # Value:
  # HDIlim is a vector containing the limits of the HDI 
  sortedPts = sort(sampleVec)
  ciIdxInc = ceiling(credMass * length(sortedPts))
  nCIs = length(sortedPts) - ciIdxInc
  ciWidth = rep(0, nCIs) 
  for (i in 1:nCIs) {
    ciWidth[i] = sortedPts[i + ciIdxInc] - sortedPts[i]
  }
  HDImin = sortedPts[which.min(ciWidth)]
  HDImax = sortedPts[which.min(ciWidth) + ciIdxInc]
  HDIlim = c(HDImin, HDImax)
  ggplot() + aes(x = name, y = value) + 
    geom_point(data = enframe(sampleVec)) + 
    geom_point(data = enframe(sortedPts), colour = 'red') + 
    geom_point(data = enframe(ciWidth), aes(x = name + ciIdxInc), colour = 'blue') +
    geom_hline(yintercept = HDImax, linetype = 'dashed')
  return(HDIlim)
}

# Plot with standard deviations drawn in
ggplot(tibble(x = seq(0, 1, length.out = 100)), aes(x = x)) +
  stat_function(fun = h0, aes(colour = 'h0')) +
  stat_function(fun = h1, aes(colour = 'h1')) +
  annotate(geom = 'errorbarh',
           xmin = E$h0 - sqrt(v$h0v)/2, xmax = E$h0 + sqrt(v$h0v)/2, 
           y = .015, height = 0) +
  annotate(geom = 'errorbarh',
           xmin = myHDI(select(d, x, h0))$low, 
           xmax = myHDI(select(d, x, h0))$high, 
           y = .016, height = 0, linetype = 'dashed') +
  annotate(geom = 'label', y = .015, label = round(E$h0, 3), x = E$h0) +
  annotate(geom = 'errorbarh',
           xmin = myHDI(select(d, x, h1))$low, 
           xmax = myHDI(select(d, x, h1))$high, 
           y = .021, height = 0, linetype = 'dashed') +
  annotate(geom = 'errorbarh',
           xmin = E$h1 - sqrt(v$h1v)/2, xmax = E$h1 + sqrt(v$h1v)/2, 
           y = .02, height = 0) +
  annotate(geom = 'label', y = .02, label = round(E$h1, 3), x = E$h1) +
  geom_rug(aes(x = pAccurate), data = ac %>% filter(condition == "Feedback condition"), alpha = .25)
  
# Likelihood of the models is given by taking the height of the curve at each of the observed data points
e <- 1e-10  # tiny nudge to stop getting log(0)
ac <- ac %>%
  mutate(LLh0 = log(h0(pAccurate) + e), LLh1 = log(h1(pAccurate) + e))

ac %>% 
  group_by(condition) %>% 
  summarise(LLh0 = sum(LLh0), LLh1 = sum(LLh1)) %>%
  mutate(LRatioh1h0 = exp(LLh1 - LLh0))


# Better models -----------------------------------------------------------

# We can define better models which are designed to model individual participant means rather than the distributions for the mean of participant means (above)
# These models allow for some weird behaviour from some participants

# The null model offers a flat prior over the whole preference space: 
# Some participants have strong preferences, others weak preferences, and they go both ways.
h0p <- function(x) case_when(
  x < 0 | x > 1 ~ 0,
  TRUE ~ 1/length(x)
)

# The preference model has two flat blocks, the preferred side gets 95% of the mass
h1p <- function(x) case_when(
  x < 0 | x > 1 ~ 0,
  x <= .5 ~ .05 / length(x),
  x > .5 ~ (2 - .05) / length(x)
)

ggplot(tibble(x = seq(0, 1, length.out = 10000)), aes(x = x)) +
  geom_hline(yintercept = 0, colour = "grey75") +
  stat_function(fun = h0p, colour = NA, alpha = .25, aes(fill = "Null model"), size = 1.25, geom = 'area') +
  stat_function(fun = h1p, colour = NA, alpha = .25, aes(fill = 'Prefer Accurate model'), size = 1.25, geom = 'area') +
  # geom_rug(aes(x = pAccurate, colour = condition), data = ac, alpha = .25, size = 1.25) +
  labs(x = "Mean Accurate advisor pick proportion", y = "Likelihood") +
  scale_fill_discrete(name = "") +
  theme(text = element_text(size = 16),
        axis.text.y = element_blank(),
        axis.ticks.y = element_blank()) 

# Characterising the hypotheses:
d <- tibble(x = seq(0, 1, length.out = 1000), h0p = h0p(x), h1p = h1p(x))
print('Integrals')
summarise_at(d, c("h0p", "h1p"), sum)

print('Expected value') 
d %>% mutate(h0e = h0p * x, h1e = h1p * x) %>% summarise_at(c("h0e", "h1e"), sum)

print('Variance')
E <- list(h0p = sum(d$h0p * d$x), h1p = sum(d$h1p * d$x))
v <- d %>% mutate(h0v = (x - E$h0p) ^ 2, h1v = (x - E$h1p) ^ 2) %>% summarise_at(c("h0v", "h1v"), mean)
v

print('Standard deviation')
v %>% transmute(h0sd = sqrt(h0v), h1sd = sqrt(h1v))

# Likelihood of the models is given by taking the height of the curve at each of the observed data points
e <- 1e-10  # tiny nudge to stop getting log(0)
ac <- ac %>%
  mutate(LLh0p = log(h0p(pAccurate) + e), LLh1p = log(h1p(pAccurate) + e))

ac %>% 
  group_by(condition) %>% 
  summarise(LLh0p = sum(LLh0p), LLh1p = sum(LLh1p)) %>%
  mutate(LRatioh1ph0p = exp(LLh1p - LLh0p))

