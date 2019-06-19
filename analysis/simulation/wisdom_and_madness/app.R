#
# This is a Shiny web application. You can run the application by clicking
# the 'Run App' button above.
#
# Find out more about building applications with Shiny here:
#
#    http://shiny.rstudio.com/
#

library(shiny)
library(ggplot2)
library(tibble)
library(scales)
library(ggpubr)
library(cowplot)

# Define UI for application that draws a histogram
ui <- fluidPage(

    # Application title
    titlePanel("Judge-advisor system simulations"),

    # Sidebar with a slider input for number of bins 
    sidebarLayout(
        sidebarPanel(
            numericInput("xm",
                        "mean x",
                        value = 0,
                        step = 0.1),
            numericInput("xsd",
                         "sd x",
                         value = 1,
                         step = 0.1),
            numericInput("ym",
                         "mean y",
                         value = 0,
                         step = 0.1),
            numericInput("ysd",
                         "sd y",
                         value = 1,
                         step = 0.1),
            numericInput("xy",
                         "xy cor",
                         value = 0,
                         step = 0.1),
            textOutput("debug")
            ),

        # Show a plot of the generated distribution
        mainPanel(
            plotOutput("splitPlot"))
        )
)

# Define server logic required to draw a histogram
server <- function(input, output) {
    
    n <- 10000
    size <- 10
    
    output$debug <- renderText({
        paste("n =", n)
    })

    output$splitPlot <- renderPlot({
        
        # collate inputs
        d <- tibble(x = rnorm(n, input$xm, input$xsd),
                    y = rnorm(n, input$ym, input$ysd) + (x * input$xy))
        
        d$colour <- abs((d$x + d$y) / 2)
        
        lim <- c(min(min(d$x), min(d$y)), 
                 max(max(d$x), max(d$y)))
        
        lim <- c(-size, size)

        # Scatter plot colored by groups ("Species")
        sp <- ggscatter(d, x = "x", y = "y", color = "colour",
                        size = .1, alpha = 0.25) +
            coord_equal() +
            scale_x_continuous(limits = lim, expand = c(0, .25)) +
            scale_y_continuous(limits = lim, expand = c(0, .25)) +
            scale_colour_gradient(limits = c(0, size), low = muted("blue"),
                                  high = "red") +
            geom_point(data = tibble(x = 0, y = 0), colour = "black", size = 5,
                       shape = 3) + 
            geom_point(data = tibble(x = input$xm, y = input$xm), 
                       colour = "black", size = 5, shape = 1) + 
            geom_point(data = tibble(x = input$ym, y = input$ym), 
                       colour = "black", size = 5, shape = 5) + 
            border()

        # Marginal density plot of x (top panel) and y (right panel)
        xplot <- ggdensity(d, "x", fill = NA) + 
            scale_x_continuous(limits = lim)
        yplot <- ggdensity(d, "y", fill = NA) + 
            scale_x_continuous(limits = lim) +
            rotate()

        # Cleaning the plots
        sp <- sp + rremove("legend")
        yplot <- yplot + clean_theme() + rremove("legend")
        xplot <- xplot + clean_theme() + rremove("legend")
        # Arranging the plot using cowplot
        plot_grid(xplot, NULL, sp, yplot, ncol = 2, align = "hv",
                  rel_widths = c(2, 1), rel_heights = c(1, 2))
    })
}

# Run the application 
shinyApp(ui = ui, server = server)
