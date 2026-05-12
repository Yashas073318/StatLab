import { createSlice } from '@reduxjs/toolkit';

const cleaningSlice = createSlice({
  name: 'cleaning',
  initialState: {
    selectedColumns: [],
    strategies: {}, // { colName: 'mean' | 'median' | 'custom' | 'skip' }
    customValues: {}, // { colName: value }
    previewMode: false,
    diffRows: [],
    undoHistory: [],
    normalizationCols: [],
    normalizationStats: {}, // { colName: { mean, std } }
    outlierThreshold: 3,
    outlierActions: {}, // { colName: 'remove' | 'cap' | 'keep' }
    boxplotActiveColumn: null,
    groupByColumn: null,
  },
  reducers: {
    setCleaningColumns(state, { payload }) { state.selectedColumns = payload; },
    setStrategy(state, { payload: { col, strategy } }) { state.strategies[col] = strategy; },
    setCustomValue(state, { payload: { col, value } }) { state.customValues[col] = value; },
    setPreviewMode(state, { payload }) { state.previewMode = payload; },
    setDiffRows(state, { payload }) { state.diffRows = payload; },
    pushUndo(state, { payload }) {
      state.undoHistory.push(payload);
      if (state.undoHistory.length > 20) state.undoHistory.shift();
    },
    setNormalizationCols(state, { payload }) { state.normalizationCols = payload; },
    setNormalizationStats(state, { payload }) { state.normalizationStats = payload; },
    setOutlierThreshold(state, { payload }) { state.outlierThreshold = payload; },
    setOutlierAction(state, { payload: { col, action } }) { state.outlierActions[col] = action; },
    setBoxplotActiveColumn(state, { payload }) { state.boxplotActiveColumn = payload; },
    setGroupByColumn(state, { payload }) { state.groupByColumn = payload; },
  },
});

export const {
  setCleaningColumns, setStrategy, setCustomValue, setPreviewMode, setDiffRows,
  pushUndo, setNormalizationCols, setNormalizationStats, setOutlierThreshold,
  setOutlierAction, setBoxplotActiveColumn, setGroupByColumn,
} = cleaningSlice.actions;
export default cleaningSlice.reducer;
