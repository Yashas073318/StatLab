import { createSlice } from '@reduxjs/toolkit';

const statsSlice = createSlice({
  name: 'stats',
  initialState: {
    // T-Test
    ttest: {
      col1: '', col2: '', alpha: 0.05, tail: 'two', result: null, showSteps: false,
    },
    // Pearson
    correlation: {
      mode: 'pairwise',
      col1: '', col2: '',
      selectedCols: [],
      result: null,
      matrixResult: null,
      showMatrix: false,
      spearmanResult: null,
      compareMode: false,
      outlierDemoActive: false,
      // Explorer
      sliderValue: 0,
      syntheticData: null,
      guessGame: { score: 0, round: 0, current: null, answered: false, guess: null },
      activeGallery: null,
    },
    // Regression
    regression: {
      xCol: '', yCol: '',
      result: null,
      predictionInput: '',
      showResiduals: false,
      showAnimation: false,
      // Multiple
      multiplePredictors: [],
      savedModels: [],
      activeModelComparison: [],
      stepwiseResult: null,
      multipleResult: null,
    },
  },
  reducers: {
    // T-Test
    setTTestField(state, { payload: { key, value } }) { state.ttest[key] = value; },
    setTTestResult(state, { payload }) { state.ttest.result = payload; },
    toggleTTestSteps(state) { state.ttest.showSteps = !state.ttest.showSteps; },

    // Correlation
    setCorrelationField(state, { payload: { key, value } }) { state.correlation[key] = value; },
    setCorrelationResult(state, { payload }) { state.correlation.result = payload; },
    setMatrixResult(state, { payload }) { state.correlation.matrixResult = payload; },
    setSpearmanResult(state, { payload }) { state.correlation.spearmanResult = payload; },
    setSliderValue(state, { payload }) { state.correlation.sliderValue = payload; },
    setSyntheticData(state, { payload }) { state.correlation.syntheticData = payload; },
    updateGuessGame(state, { payload }) { state.correlation.guessGame = { ...state.correlation.guessGame, ...payload }; },

    // Regression
    setRegressionField(state, { payload: { key, value } }) { state.regression[key] = value; },
    setRegressionResult(state, { payload }) { state.regression.result = payload; },
    setMultipleResult(state, { payload }) { state.regression.multipleResult = payload; },
    setStepwiseResult(state, { payload }) { state.regression.stepwiseResult = payload; },
    addSavedModel(state, { payload }) {
      state.regression.savedModels.push(payload);
      if (state.regression.savedModels.length > 3) state.regression.savedModels.shift();
    },
    toggleModelComparison(state, { payload }) {
      const idx = state.regression.activeModelComparison.findIndex(m => m.id === payload.id);
      if (idx === -1) state.regression.activeModelComparison.push(payload);
      else state.regression.activeModelComparison.splice(idx, 1);
    },
  },
});

export const {
  setTTestField, setTTestResult, toggleTTestSteps,
  setCorrelationField, setCorrelationResult, setMatrixResult, setSpearmanResult,
  setSliderValue, setSyntheticData, updateGuessGame,
  setRegressionField, setRegressionResult, setMultipleResult, setStepwiseResult,
  addSavedModel, toggleModelComparison,
} = statsSlice.actions;
export default statsSlice.reducer;
