
# Data scraper ------------------------------------------------------------

# This script will backup data on the server to a local location ./data

library(rvest)
library(httr)
library(stringr)

baseURL <- "https://acclab.psy.ox.ac.uk/~mj221/ESM/data/" 

scrape <- function(
  url, 
  skipLinks = c(
    "Name", 
    "Last modified",
    "Parent Directory",
    "Size", 
    "Description"
    ), 
  rootSaveDir = 'data', 
  overwrite = T,
  verbose = T,
  authentication = c('user', 'pass')) {
  
  # Create save dir if necessary
  localDir <- str_match(url, paste0('/(', rootSaveDir, '/.*)'))[2]
  saveDir <- paste0('./', localDir)
  if (!dir.exists(saveDir)) {
    dir.create(saveDir)
  }
  
  session <- html_session(url)
  
  # Failed to connect - try to authenticate using credentials
  if (session$response$status_code == 401) {
    
    set_config(
      authenticate(authentication[1], authentication[2])
    )
    
    session <- html_session(url)
    
    unsetAuth <- T
  } else {
    unsetAuth <- F
  }
  
  tmp <- read_html(session)
  
  anchors <- html_nodes(tmp, 'a')
  
  for (a in anchors) {
    if (html_text(a) %in% skipLinks) {
      next()
    }
    
    href <- html_attr(a, 'href')
    
    if (!str_detect(href, '/$')) {
      # files
      filename <- paste0(saveDir, href)
      
      if (overwrite | !file.exists(filename)) {
        writeBin(
          jump_to(session, paste0(url, href))$response$content,
          paste0(saveDir, href)
        )
        
        if (verbose) {
          print(paste0("Wrote file '", filename, "'."))
        }
      } else {
        if (verbose) {
          print(paste0("Skipping existing file '", filename, "'."))
        }
      }
      
    } else {
      # directories
      scrape(
        paste0(url, href), 
        skipLinks = skipLinks, 
        rootSaveDir = rootSaveDir,
        overwrite = overwrite,
        verbose = verbose,
        authentication = authentication
        )
    }
  }
  
  if (unsetAuth) {
    reset_config()
  }
}

scrape(baseURL, overwrite = F)

scrape(
  paste0(baseURL, 'private/'), 
  overwrite = F, 
  authentication = c(
    'mj221',
    readline(paste0(baseURL, "> enter password for mj221: "))
    )
  )
