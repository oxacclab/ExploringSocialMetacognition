install.packages(
  c(
    "testthat",   # unit tests
    "tidyverse",  # data wrangling
    "broom",      # multiple model result unpacking
    "BayesFactor",# Bayes analyses
    "BayesMed",   # Mediation using Bayesian stats
    "ez",         # Simple ANOVA analyses
    "knitr",      # Compiling Rmd to HTML
    "curl",       # fetching files from server
    "beepr",      # beeps for error/complete
    "stringr",    # simpler string manipulation
    "forcats",    # factor manipulation
    "devtools"    # development tools for r
  )
)

devtools::install_github("mjaquiery/prettyMD")  # pretty printouts for results