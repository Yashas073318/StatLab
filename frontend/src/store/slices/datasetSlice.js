import { createSlice } from '@reduxjs/toolkit';

const datasetSlice = createSlice({
  name: 'datasets',
  initialState: {
    list: [],
    activeId: null,
    activeDataset: null,
    selectedColumns: [],
    uploadProgress: 0,
    uploadStatus: 'idle', // idle | uploading | success | error
  },
  reducers: {
    setDatasets(state, { payload }) { state.list = payload; },
    setActiveId(state, { payload }) { state.activeId = payload; },
    setActiveDataset(state, { payload }) { state.activeDataset = payload; },
    setSelectedColumns(state, { payload }) { state.selectedColumns = payload; },
    toggleColumn(state, { payload }) {
      const idx = state.selectedColumns.indexOf(payload);
      if (idx === -1) state.selectedColumns.push(payload);
      else state.selectedColumns.splice(idx, 1);
    },
    setUploadProgress(state, { payload }) { state.uploadProgress = payload; },
    setUploadStatus(state, { payload }) { state.uploadStatus = payload; },
    addDataset(state, { payload }) { state.list.unshift(payload); },
    removeDataset(state, { payload }) {
      state.list = state.list.filter(d => d._id !== payload);
      if (state.activeId === payload) { state.activeId = null; state.activeDataset = null; }
    },
  },
});

export const {
  setDatasets, setActiveId, setActiveDataset, setSelectedColumns,
  toggleColumn, setUploadProgress, setUploadStatus, addDataset, removeDataset,
} = datasetSlice.actions;
export default datasetSlice.reducer;
