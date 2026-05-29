import { addToast } from '@heroui/toast';

export function showSuccessToast(description: string) {
  addToast({
    title: 'Success',
    description,
    color: 'success',
    severity: 'success',
    variant: 'solid',
    timeout: 3500,
    shouldShowTimeoutProgress: true,
  });
}

export function showWarningToast(description: string) {
  addToast({
    title: 'Validation Error',
    description,
    color: 'warning',
    severity: 'warning',
    variant: 'solid',
    timeout: 4500,
    shouldShowTimeoutProgress: true,
  });
}

export function showErrorToast(description: string) {
  addToast({
    title: 'Server Error',
    description,
    color: 'danger',
    severity: 'danger',
    variant: 'solid',
    timeout: 5000,
    shouldShowTimeoutProgress: true,
  });
}
