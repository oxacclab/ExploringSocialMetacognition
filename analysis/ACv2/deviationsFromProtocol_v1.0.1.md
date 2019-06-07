# Deviations from protocol

The study was preregistered at [https://osf.io/fgmdw](https://osf.io/fgmdw). There were minor deviations from the registration, primarily in data collection. It is not felt that any of these deviations are either unwarranted or grounds for reducing reliance on the results obtained.

1. Data collection
    1. Data collection could not be made over the course of a single day, as intended, and were instead collected over a week (Wed 29th May 2019 to Wed 5th June 2019) because the researcher responsible for data collection (MJ) was absent for an extended weekend that week.
    2. The code which allows for specific assignation of participants to conditions failed to work, meaning that missing experimental condition cases had to be filled by recruiting using the inbuilt pseudo-random assignment of conditions. This meant that several conditions had more data collected than were registered. These excess participants were excluded from analysis.

 2. Data analysis script
    1. The script uploaded as part of the registration has had minor tweaks during data analysis as detailed in its [GitHub version history](https://github.com/oxacclab/ExploringSocialMetacognition/commits/master/analysis/ACv2/confirmatoryAnalyses.Rmd)
    2. Participants who give the same answer on 90+% of trials are excluded in line with previous studies.
    3. The reshaping of data is moved later in the script to reduce redundancy.
    4. Replaced using the calculated hasFeedback variable with one directly supplied by the data.
        1. Fixed NA values for the feedback variable.
    5. Cleaned firstAdvisor logic.
    6. Pruning of excess participants.
    7. Manual exclusions of participants who guessed the manipulation (mentioned that one advisor agreed with them or followed their responses).

All changes were made prior to the hypothesis tests and descriptive statistics being run (the script was run periodically up to the end of participant exclusions in order to ascertain the number of participants in each experimental condition who had provided valid data).
