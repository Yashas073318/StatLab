import { configureStore } from '@reduxjs/toolkit';
import datasetReducer from './slices/datasetSlice';
import uiReducer from './slices/uiSlice';
import cleaningReducer from './slices/cleaningSlice';
import statsReducer from './slices/statsSlice';

export const store = configureStore({
  reducer: {
    datasets: datasetReducer,
    ui: uiReducer,
    cleaning: cleaningReducer,
    stats: statsReducer,
  },
});

export default store;
