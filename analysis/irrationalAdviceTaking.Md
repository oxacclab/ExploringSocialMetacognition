# Advice taking direction

The 120 practice trial cohort seem to be throwing out a lot of irrational responses to advice. Here they're compared to the 60 practice trial cohort as the closest existing comparison.

## General direction

### 60 practice trials  
|advisorAgrees | increaseConfPerC| noChangePerC| decreaseConfPerC|
|:-------------|----------------:|------------:|----------------:|
|TRUE          |        0.5398475|    0.3458073|    **0.1143451**|
|FALSE         |    **0.1954023**|    0.2142111|        0.5903866|

### 120 practice trials  
|advisorAgrees | increaseConfPerC| noChangePerC| decreaseConfPerC|
|:-------------|----------------:|------------:|----------------:|
|TRUE          |        0.5986137|    0.1140517|    **0.2873346**|
|FALSE         |    **0.0417854**|    0.0455840|        0.9126306|

## Direction by participant ID  
This is the above summary split by individual participant ID.  

### 60 practice trials  
| pid|advisorAgrees | increasConfPerC| noChangePerC| decreaseConfPerC| totalN|
|---:|:-------------|---------------:|------------:|----------------:|------:|
|   1|TRUE          |       0.0729927|    0.9124088|        0.0145985|    137|
|   2|TRUE          |       0.3426573|    0.3566434|        0.3006993|    143|
|   3|TRUE          |       0.9513889|    0.0277778|        0.0208333|    144|
|   4|TRUE          |       0.1888112|    0.6713287|        0.1398601|    143|
|   5|TRUE          |       0.6439394|    0.3257576|        0.0303030|    132|
|   6|TRUE          |       0.9466667|    0.0400000|        0.0133333|    150|
|   7|TRUE          |       0.4473684|    0.2697368|        0.2828947|    152|
|   8|TRUE          |       0.7361111|    0.1319444|        0.1319444|    144|
|   9|TRUE          |       0.4539877|    0.3803681|        0.1656442|    163|
|  10|TRUE          |       0.6000000|    0.3851852|        0.0148148|    135|
|   1|FALSE         |       0.0097087|    0.3106796|        0.6796117|    103|
|   2|FALSE         |       0.2783505|    0.1855670|        0.5360825|     97|
|   3|FALSE         |       0.0520833|    0.0520833|        0.8958333|     96|
|   4|FALSE         |       0.0824742|    0.6907216|        0.2268041|     97|
|   5|FALSE         |       0.1481481|    0.2685185|        0.5833333|    108|
|   6|FALSE         |       0.6555556|    0.0888889|        0.2555556|     90|
|   7|FALSE         |       0.1704545|    0.0568182|        0.7727273|     88|
|   8|FALSE         |       0.1875000|    0.1562500|        0.6562500|     96|
|   9|FALSE         |       0.4545455|    0.2857143|        0.2597403|     77|
|  10|FALSE         |       0.0285714|    0.0380952|        0.9333333|    105|

### 120 practice trials  
| pid|advisorAgrees | increasConfPerC| noChangePerC| decreaseConfPerC| totalN|
|---:|:-------------|---------------:|------------:|----------------:|------:|
|   1|TRUE          |       0.0135135|    0.0000000|        0.9864865|    148|
|   2|TRUE          |       0.4701987|    0.1192053|        0.4105960|    151|
|   3|TRUE          |       1.0000000|    0.0000000|        0.0000000|    140|
|   4|TRUE          |       1.0000000|    0.0000000|        0.0000000|    139|
|   5|TRUE          |       0.9928571|    0.0071429|        0.0000000|    140|
|   6|TRUE          |       0.7655172|    0.0896552|        0.1448276|    145|
|   7|TRUE          |       0.0555556|    0.6388889|        0.3055556|    144|
|   8|TRUE          |       0.9210526|    0.0460526|        0.0328947|    152|
|   9|TRUE          |       0.3741497|    0.2789116|        0.3469388|    147|
|  10|TRUE          |       0.0220588|    0.0588235|        0.9191176|    136|
|  11|TRUE          |       0.9793103|    0.0068966|        0.0137931|    145|
|   1|FALSE         |       0.0000000|    0.0000000|        1.0000000|     92|
|   2|FALSE         |       0.0898876|    0.0000000|        0.9101124|     89|
|   3|FALSE         |       0.0000000|    0.0000000|        1.0000000|    100|
|   4|FALSE         |       0.0297030|    0.0396040|        0.9306931|    101|
|   5|FALSE         |       0.0000000|    0.0100000|        0.9900000|    100|
|   6|FALSE         |       0.1473684|    0.1157895|        0.7368421|     95|
|   7|FALSE         |       0.0000000|    0.0000000|        1.0000000|     96|
|   8|FALSE         |       0.0909091|    0.0568182|        0.8522727|     88|
|   9|FALSE         |       0.0967742|    0.2150538|        0.6881720|     93|
|  10|FALSE         |       0.0096154|    0.0673077|        0.9230769|    104|
|  11|FALSE         |       0.0105263|    0.0000000|        0.9894737|     95|

## Influence by participant ID  
Influence is confidence shift in the direction of advice - if advisors are thought to be acting in good faith it should be positive for both agreement and disagreement. 

### 60 practice trials  
|advisorAgrees | pid| rawInfluence|
|:-------------|---:|------------:|
|FALSE         |   1|   58.2330097|
|FALSE         |   2|    8.8453608|
|FALSE         |   3|    9.6041667|
|FALSE         |   4|   10.5257732|
|FALSE         |   5|    1.9814815|
|FALSE         |   6|   -1.6111111|
|FALSE         |   7|   52.0113636|
|FALSE         |   8|    4.3750000|
|FALSE         |   9|    2.8831169|
|FALSE         |  10|   39.1523810|
|TRUE          |   1|    1.4306569|
|TRUE          |   2|    0.0139860|
|TRUE          |   3|   12.4583333|
|TRUE          |   4|    0.2447552|
|TRUE          |   5|    4.1439394|
|TRUE          |   6|    8.2800000|
|TRUE          |   7|    0.1776316|
|TRUE          |   8|   11.7847222|
|TRUE          |   9|    1.2208589|
|TRUE          |  10|   13.9333333|

### 120 practice trials  
| pid|advisorAgrees | rawInfluence|
|---:|:-------------|------------:|
|   1|FALSE         |   18.0326087|
|   2|FALSE         |   46.2022472|
|   3|FALSE         |    8.2800000|
|   4|FALSE         |    4.1188119|
|   5|FALSE         |    8.8200000|
|   6|FALSE         |    9.3052632|
|   7|FALSE         |   15.6875000|
|   8|FALSE         |    7.3863636|
|   9|FALSE         |    1.7634409|
|  10|FALSE         |    5.9807692|
|  11|FALSE         |   31.2947368|
|   1|TRUE          |   -4.5675676|
|   2|TRUE          |   -0.0993377|
|   3|TRUE          |    6.0500000|
|   4|TRUE          |   26.0647482|
|   5|TRUE          |    5.0928571|
|   6|TRUE          |    6.6827586|
|   7|TRUE          |   -0.7013889|
|   8|TRUE          |    5.0657895|
|   9|TRUE          |    0.0680272|
|  10|TRUE          |   -6.4411765|
|  11|TRUE          |    7.8620690|