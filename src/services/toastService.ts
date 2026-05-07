import { ToastRef } from '../components/Toast';

export const toastService = {
  ref: null as ToastRef | null,
  
  show: (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    toastService.ref?.show(message, type);
  }
};
