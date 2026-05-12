import { createSlice } from '@reduxjs/toolkit';

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    activeModule: 'datasets', // datasets | clean | ttest | pearson | spearman | explorer | regression | multiregression
    sidebarOpen: true,
    uploadModalOpen: false,
    theme: localStorage.getItem('statlab_theme') || 'light',
    notification: null, // { type: 'success'|'error'|'info', message, id }
  },
  reducers: {
    setActiveModule(state, { payload }) { state.activeModule = payload; },
    toggleTheme(state) {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('statlab_theme', state.theme);
    },
    toggleSidebar(state) { state.sidebarOpen = !state.sidebarOpen; },
    setSidebarOpen(state, { payload }) { state.sidebarOpen = payload; },
    openUploadModal(state) { state.uploadModalOpen = true; },
    closeUploadModal(state) { state.uploadModalOpen = false; },
    showNotification(state, { payload }) { state.notification = { ...payload, id: Date.now() }; },
    clearNotification(state) { state.notification = null; },
  },
});

export const {
  setActiveModule, toggleSidebar, setSidebarOpen, toggleTheme,
  openUploadModal, closeUploadModal, showNotification, clearNotification,
} = uiSlice.actions;
export default uiSlice.reducer;
