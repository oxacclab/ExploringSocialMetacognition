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
            numericInput("n",
                         "N",
                         value = 10000,
                         step = 1000),
            numericInput("xm",
                        "mean x",
                        value = 0,
                        step = 0.1),
            numericInput("xsd",
                         "sd x",
                         value = 2,
                         step = 0.1),
            numericInput("ym",
                         "mean y",
                         value = 0,
                         step = 0.1),
            numericInput("ysd",
                         "sd y",
                         value = 2,
                         step = 0.1),
            numericInput("xy",
                         "xy cor",
                         value = 0,
                         step = 0.1),
            numericInput("w",
                         "x weight",
                         value = 0.5,
                         step = 0.1),
            checkboxInput("use_th",
                          "Use threshold"),
            numericInput("th",
                         "error threshold",
                         value = 0.5,
                         step = 0.1),
            checkboxInput("gain",
                          "Show combined improvement over x"),
            textOutput("debug")
            ),

        # Show a plot of the generated distribution
        mainPanel(
            plotOutput("splitPlot"),
            plotOutput("gainPlot"))
        )
)

# Define server logic required to draw a histogram
server <- function(input, output) {
    
    combine <- function(x, y, wx) {(wx * x + (1 - wx) * y) / 2}
    

    # collate inputs
    d <- reactive({
        d <- tibble(x = rnorm(input$n, input$xm, input$xsd),
               y = rnorm(input$n, input$ym, input$ysd) + (x * input$xy))
        
        d$colour <- abs(combine(d$x, d$y, input$w))
        
        if (input$gain)
            d$colour <- d$colour - abs(d$x) 
        
        if (input$use_th) 
            if (input$gain)
                d$colour <- factor(d$colour < input$th)
        else
            d$colour <- factor(ifelse(d$colour < input$th, "Correct", "Error"))
        
        d
    })
    
    output$debug <- renderText({
        paste("n =", input$n)
    })
    
    output$splitPlot <- renderPlot({
        size <- 5
        
        lim <- c(min(min(d()$x), min(d()$y)), 
                 max(max(d()$x), max(d()$y)))
        
        lim <- c(-size, size)

        # Scatter plot coloured by groups
        sp <- ggscatter(d(), x = "x", y = "y", color = "colour",
                        size = .1, alpha = 0.25) +
            coord_equal() +
            scale_x_continuous(limits = lim, expand = c(0, .25)) +
            scale_y_continuous(limits = lim, expand = c(0, .25)) +
            (if (input$use_th) scale_colour_discrete(
                name = paste0("|Err(Combined)|",
                              if (input$gain) " - |Err(x)|" else "",
                              " < ", 
                              input$th)
            )
            else scale_colour_gradient(
                limits = 
                    if (input$gain) c(-size, size)
                    else c(0, sqrt(size)), 
                low = "blue",
                high = "red",
                name = if (input$gain) "|Err(Combined)| - |Err(x)|" else "|Err(Combined)|")
            ) +
            geom_point(data = tibble(x = 0, y = 0), colour = "black", size = 5,
                       shape = 3) + 
            geom_point(data = tibble(x = input$xm, y = input$xm), 
                       colour = "black", size = 5, shape = 1) + 
            geom_point(data = tibble(x = input$ym, y = input$ym), 
                       colour = "black", size = 5, shape = 5) + 
            border() +
            theme(legend.position = 'bottom')

        # Marginal density plot of x (top panel) and y (right panel)
        xplot <- ggdensity(d(), "x", fill = NA) + 
            scale_x_continuous(limits = lim)
        yplot <- ggdensity(d(), "y", fill = NA) + 
            scale_x_continuous(limits = lim) +
            rotate()

        # Cleaning the plots
        # sp <- sp + rremove("legend")
        yplot <- yplot + clean_theme() + rremove("legend")
        xplot <- xplot + clean_theme() + rremove("legend")
        # Arranging the plot using cowplot
        plot_grid(xplot, NULL, sp, yplot, ncol = 2, align = "hv",
                  rel_widths = c(2, 1), rel_heights = c(1, 2))
    })
    
    output$gainPlot <- renderPlot({
        tmp <- tibble(x = seq(0, 1, 0.05),
                      y = purrr::map_dbl(x, ~ mean(abs(combine(d()$x, d()$y, .)))))
        ggplot(tmp, aes(x, y)) +
            geom_vline(xintercept = input$w) +
            geom_point() +
            geom_hline(yintercept = mean(abs(d()$x)) / 2, linetype = 'dashed') +
            geom_label(aes(label = paste0("Mean(|Err(x)|)/2 = ", round(y, 2))), 
                       data = tibble(x = .5, y = mean(abs(d()$x)) / 2)) +
            labs(x = "Weight(x)", y = "Mean(|Err(Combined)|)")
    })
}

# Run the application 
shinyApp(ui = ui, server = server)
