#
# This is a Shiny web application. You can run the application by clicking
# the 'Run App' button above.
#
# Find out more about building applications with Shiny here:
#
#    http://shiny.rstudio.com/
#

library(shiny)
library(tidyverse)
library(gganimate)

# Define UI for application that draws isoaccuracy curves through agreement space
ui <- fluidPage(
   
   # Application title
   titlePanel("Isoaccuracy Curves"),
   
   # Sidebar with a slider input for number of bins 
   sidebarLayout(
      sidebarPanel(
         sliderInput("acc",
                     "Target accuracy:",
                     min = 0.00,
                     max = 1.00,
                     value = 0.80)
      ),
      
      # Show a plot of the generated distribution
      mainPanel(
         plotOutput("distPlot")
      )
   )
)

f <- function(x,z) {
  y <- 1 - (z - 0.71*x)/0.29
}

# Define server logic required to draw the function
server <- function(input, output) {
   
   output$distPlot <- renderPlot({
      # generate plot
     z <- input$acc
     x <- data.frame(x = seq(0.01,.99,0.1))
     ggplot(x, aes(x)) + 
       stat_function(fun = f, args = (z = z)) +
       scale_y_continuous(name = 'P(Agree|Incorrect)', 
                          limits = c(0,1), 
                          breaks = seq(0,1,0.1)) +
       scale_x_continuous(name = 'P(Agree|Correct)', 
                          limits = c(0,1), 
                          breaks = seq(0,1,0.1)) + 
       labs(title = paste0('Line shows accuracy=', z)) + 
       coord_fixed() +
       theme_light()
   })
}

# Run the application 
shinyApp(ui = ui, server = server)

