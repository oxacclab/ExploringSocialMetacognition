#include <Rcpp.h>
using namespace Rcpp;

/* 
  This file should also supply a function to allow surface mapping for 
 some functions so its functionality can be verified. 
*/

/**
* @brief Take a set of trials, run gradient descent on them for a family of models,
* and return the parameters which generate the lowest mean squared error for
* each model, along with the errors associated with those parameters.
*
* @param trials a data frame of trials with 4 columns (names may vary):
*  * initialConfidence - initial confidence rating (standardized)
*  * advisorAgrees - whether Advisor A agrees (NA if no advice provided)
*  * otherAdvisorAgrees - whether Advisor B agrees (NA if no advice provided)
*  * confidenceShift - amount confidence shifted from initial to final judgement (standardized)
*
* @param testSetMask mask of length nrow(trials) specifying which trials should be used
*  for calculating the best parameters. Defaults to all.
*
* @param nStartingLocations how many different starting locations should be tried for each model
* 
* @param learnRate the learning rate for the models (size of the gradient descent steps)
* 
* @return List(parameters, errors)
*/
List gradientDescent(DataFrame trials, NumericVector testSetMask, int nStartingLocations, double learnRate);

/**
 * Structure for storing information from the R dataframe
 */
struct Trials {
  NumericVector initialConf;
  NumericVector advisorAgrees[2];
  NumericVector confidenceShift;
};

/**
 * Parameters for the model estimated by the learning process
 */
struct Parameters {
  double confWeight;
  double advisorTrust[2];
  double trustShift;
  double trustDecay;
};

/**
 * Output of the model - parameters producing the lowest mean squared error, and those errors
 */
struct ModelResult {
  NumericVector errors;
  Parameters params;
};

/**
 * Pointer to a given model of trust update. These models return parameters with adjusted advisorTrust
 */
typedef double (*ModelFun)(double initialConf, int advisorAgrees, Parameters params, int advisorIndex);

/**
 * @brief Function which runs a model on all trials in the dataset and returns the errors
 * 
 * @param model the trust update model to be used
 * @param trials the real trial data to be fit
 * @param params the parameters of the model
 * @param learnRate the learning rate of the model
 * 
 * @return fit errors for each trial in trials
 */
NumericVector doModel(ModelFun model, Trials trials, Parameters params);

/**
 * @brief Find the mean squared errror of errors
 * 
 * @param errors
 * @param testSetMask vector identifying which errors count towards the MSE
 */
double getMSE(NumericVector errors, NumericVector testSetMask);

/**
 * @brief Run a specific statistical model against a set of values from trials,
 * adjust the parameters using gradient descent, and return the best parameter values
 * and their model fit error for each trial
 *
 * @param initialConfidence initial confidence scores for each trial
 * @param advisorId id of the advisor giving advice on the trial
 * @param advisorAgrees advice of the advisor
 * @param otherAdvisorAgrees advice of a second advisor if present
 * @param confidenceShift change in confidence between participant's initial and final responses
 * @param initialConfWeight how much each initial confidence point adjusts the confidence shift
 * @param startingTrust how much the advisors' agreement adjusts the confidence to begin with
 * @param trustShift learning rate for updating trust in the advisors
 * @param trustDecay how much trust decays on a given trial (counters the learning rate)
 * @param learningRate stepsize for the gradient descent search
 * 
 * @return ModelResult model parameters and fit errors on each trial
 */
ModelResult findParams(ModelFun model, Trials trials, Parameters params, double learnRate, NumericVector testSetMask);

/**
 * Return a NumericVector of parameters flattened for iteration
 */
NumericVector spreadParams(Parameters params);

/**
 * Return a Parameters representation of flattened parameters
 */
Parameters gatherParams(NumericVector params);

/**
 * @brief Generate a random float [0, 1]
 * @param allowNegative whether to extend the range to [-1, 1]
 */
double rRand(bool allowNegative = TRUE) {
  double r = (double)rand() / (RAND_MAX);
  if(!allowNegative)
    return r;
  return ((double)rand() / RAND_MAX) > .5? r : r * -1;
}


double getMSE(NumericVector errors, NumericVector testSetMask = NumericVector::create(0)) {
  bool includeAll = testSetMask.size() == 1 && testSetMask[0] == 0;
  
  int len = errors.size();
  int n = 0;
  double sumSq = 0;
  for(int i = 0; i < len; i++) {
    if(includeAll || testSetMask[i] > 0) {
      sumSq += errors[i] * errors[i];
      n++;
    }
  }
  return sumSq / n;
}


NumericVector spreadParams(Parameters params) {
  return NumericVector::create(params.confWeight, params.advisorTrust[0], params.advisorTrust[1],
                               params.trustShift, params.trustDecay);
}

Parameters gatherParams(NumericVector params) {
  Parameters out;
  out.confWeight = params[0];
  out.advisorTrust[0] = params[1]; 
  out.advisorTrust[1] = params[2];
  out.trustShift = params[3];
  out.trustDecay = params[4];
  return out;
}

NumericVector doModel(ModelFun model, Trials trials, Parameters params) {
  
  int trialCount = trials.initialConf.size();
  int advisorCount = sizeof(trials.advisorAgrees) / sizeof(trials.advisorAgrees[0]);
  NumericVector errors(trialCount);
  double minConf = min(trials.initialConf); // used to prevent confidence z-scores being negative
  
  // Perform the actual model
  for(int t = 0; t < trialCount; t++) {
    
    // Estimate confidence shift
    double shift = 0;
    
    shift += (trials.initialConf[t] * params.confWeight);
    for(int a = 0; a < advisorCount; a++) {
      if(!Rcpp::NumericVector::is_na(trials.advisorAgrees[a][t])) {
        shift += trials.advisorAgrees[a][t] * params.advisorTrust[a];
        
        // Update trust in advisor
        params.advisorTrust[a] = model(trials.initialConf[t] + minConf, trials.advisorAgrees[a][t], params, a);
      }
    }
    
    errors[t] = shift - (double)trials.confidenceShift[t];
  }
  
  return errors;
}


/**
* Trust update model in which trust does not change from an initial value
*/
double model0(double initialConf, int advisorAgrees, Parameters params, int advisorIndex) {
  return params.advisorTrust[advisorIndex];
}


/**
* Trust update model in which trust changes based on agreement
*/
double model1(double initialConf, int advisorAgrees, Parameters params, int advisorIndex) {
  
  int trust = params.advisorTrust[advisorIndex] - params.trustDecay;
  
  if(advisorAgrees <= 0)
    return trust;
  
  return trust + params.trustShift;
}


/**
* Trust update model in which trust changes based on agreement, weighted by confidence
*/
double model2(double initialConf, int advisorAgrees, Parameters params, int advisorIndex) {
  
  int trust = params.advisorTrust[advisorIndex] - params.trustDecay;
  
  if(advisorAgrees <= 0)
    return trust;
  
  return trust + (params.trustShift * initialConf);
}


ModelResult findParams(ModelFun model, Trials trials, Parameters params, 
                       double learnRate = 0.05, NumericVector testSetMask = NumericVector::create(0)) {

  int trialCount = trials.initialConf.size();
  Parameters bestParams = params;
  Parameters testParams = params;
	
	double mse;
	double bestMSE = INFINITY;
	
	NumericVector errors(trialCount);
	NumericVector bestErrors(trialCount);

	int cycles = 0;
	int stalemate = 0;
	
	// Gradient descent
	while(TRUE) {
  	
  	// Perform the actual model
  	errors = doModel(model, trials, testParams);
  	mse = getMSE(errors, testSetMask);
  	
  	// Check for MSE improvement
  	if(bestMSE > mse) {
    	// Store model
    	bestMSE = mse;
  	  bestErrors = errors;
  	  bestParams = testParams;
  	  
    	stalemate = 0;
  	} else {
  	  // Check for stalemate overall (i.e. solution)
  	  if(++stalemate > 10)
  	    break;
  	}
  	
  	if(cycles++ > 100000) 
  	  break;
  	
  	// Update parameters using partial derivatives
  	NumericVector spread = spreadParams(testParams);
  	NumericVector gradients(spread.size());
  	for(int i = 0; i < spread.size(); i++) { 
  	  NumericVector partialParams = spread; 
  	 
  	  // add a little to the parameter being tested
  	  partialParams[i] += learnRate;
  	  
  	  // find the new error
  	  NumericVector partialErrors = doModel(model, trials, gatherParams(partialParams));
  	  double partialError = getMSE(partialErrors, testSetMask);
  	  
  	  // Follow the direction of the gradient for this parameter
  	  // should probably scale this across all parameters to go faster down larger gradients
  	  gradients[i] = (mse - partialError) / learnRate;
  	}
    // Normalise gradients
    double gradSum = sum(gradients);
  	for(int i = 0; i < gradients.size(); i++) {
  	  gradients[i] *= gradients[i] / gradSum;
  	  // Update parameters
  	  if(gradients[i] > 0)
  	    spread[i] -= learnRate;
  	  else 
  	    spread[i] += learnRate;
	  }
  	
  	testParams = gatherParams(spread);
	}
	
	ModelResult out = {bestErrors, bestParams};
	return out;
}


// [[Rcpp::export]]
List gradientDescent(DataFrame trials, NumericVector testSetMask = NumericVector::create(0), 
                     int nStartingLocations = 5, double learnRate = 0.05) {

  Trials trialData;
  trialData.initialConf = as<NumericVector>(trials[0]);
  trialData.advisorAgrees[0] = as<NumericVector>(trials[1]);
  trialData.advisorAgrees[1] = as<NumericVector>(trials[2]);
  trialData.confidenceShift = as<NumericVector>(trials[3]);
  
  ModelFun modelFuns[3] = {model0, model1, model2};
  ModelResult modelResults[3];
  
  for(int i = 0; i < nStartingLocations; i++) {
    // Loop through the models and look for the paramters which give the lowest MSE after
    // undergoing gradient descent
    int len = sizeof(modelFuns) / sizeof(modelFuns[0]);
    for(int m = 0; m < len; m++) {
      // Randomize starting parameters
      Parameters params;
      params.confWeight = rRand();
      params.advisorTrust[0] = rRand();
      params.advisorTrust[1] = rRand();
      params.trustShift = rRand(FALSE);
      params.trustDecay = rRand(FALSE);
      
      double bestMSE = INFINITY;
      
      // // Run the model
      ModelResult tmp = findParams(modelFuns[m], trialData, params, learnRate, testSetMask);

      modelResults[m] = tmp;
      
      // Save if this is the best model
      if(bestMSE < getMSE(tmp.errors, testSetMask)) {
        modelResults[m] = tmp;
        bestMSE = getMSE(tmp.errors, testSetMask);
      }
    }
  }
    
  DataFrame models = DataFrame::create(
    Named("model") = NumericVector::create(1, 2, 3),
    Named("initialConfidenceWeight") = 
      NumericVector::create(modelResults[0].params.confWeight, 
                            modelResults[1].params.confWeight, 
                            modelResults[2].params.confWeight),
    Named("trustStart") = 
      NumericVector::create(modelResults[0].params.advisorTrust[0], 
                            modelResults[1].params.advisorTrust[0],
                            modelResults[2].params.advisorTrust[0]),
    Named("trustStartOther") = 
      NumericVector::create(modelResults[0].params.advisorTrust[1],
                            modelResults[1].params.advisorTrust[1],
                            modelResults[2].params.advisorTrust[1]),
    Named("trustShift") = 
      NumericVector::create(modelResults[0].params.trustShift,
                            modelResults[1].params.trustShift,
                            modelResults[2].params.trustShift),
    Named("trustDecay") = 
      NumericVector::create(modelResults[0].params.trustDecay,
                            modelResults[1].params.trustDecay,
                            modelResults[2].params.trustDecay)
  );
  
  DataFrame errors = DataFrame::create(
    Named("Model1") = modelResults[0].errors,
    Named("Model2") = modelResults[1].errors,
    Named("Model3") = modelResults[2].errors
  );
  
  NumericVector all (trialData.initialConf.size(), 1.0);
  DataFrame mse = DataFrame::create(
    Named("Model1") = getMSE(modelResults[0].errors, all),
    Named("Model2") = getMSE(modelResults[1].errors, all),
    Named("Model3") = getMSE(modelResults[2].errors, all)
  );
  
  return List::create(
    _["parameters"] = models,
    _["errors"] = errors,
    _["MSE"] = mse
  );
}

// You can include R code blocks in C++ files processed with sourceCpp
// (useful for testing and development). The R code will be automatically 
// run after the compilation.
//

/*** R

*/
