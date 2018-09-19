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
   titlePanel("Isoaccuracy Plots"),
   
   # Sidebar with a slider input for number of bins 
   sidebarLayout(
      sidebarPanel(
        sliderInput("acc",
                    "Target accuracy:",
                    min = 0.00,
                    max = 1.00,
                    value = 0.80),
        sliderInput("p",
                    "P(correct):",
                    min = 0.00,
                    max = 1.00,
                    value = 0.71),
        sliderInput("agrC",
                    "P(agree|correct):",
                    min = 0.00,
                    max = 1.00,
                    value = 0.80),
        sliderInput("agrI",
                    "P(agree|incorrect):",
                    min = 0.00,
                    max = 1.00,
                    value = 0.20)
      ),
      
      # Show a plot of the generated distribution
      mainPanel(
         plotOutput("distPlot"),
         textOutput("calcShow"),
         textOutput("calcShow2")
      )
   )
)

f <- function(x,z,p) {
  y <- 1 - (z - p*x)/(1-p)
}

# Define server logic required to draw the function
server <- function(input, output) {
   
   output$distPlot <- renderPlot({
      # generate plot
     x <- data.frame(x = seq(0.01,.99,0.1))
     ggplot(x, aes(x)) + 
       stat_function(fun = f, args = list(z = input$acc, p = input$p)) +
       scale_y_continuous(name = 'P(Agree|Incorrect)', 
                          limits = c(0,1), 
                          breaks = seq(0,1,0.1)) +
       scale_x_continuous(name = 'P(Agree|Correct)', 
                          limits = c(0,1), 
                          breaks = seq(0,1,0.1)) + 
       labs(title = paste0('Line shows accuracy=', input$acc)) + 
       coord_fixed() +
       theme_light()
   })
   
   output$calcShow <- renderText({
     paste('P(GoodAdvice) =', (input$agrC*input$p + (1-input$agrI)*(1-input$p)))
   })
   
   output$calcShow2 <- renderText({
     paste('P(Agree) = ', (input$agrC*input$p + input$agrI*(1-input$p)))
   })
}

# Run the application 
shinyApp(ui = ui, server = server)

