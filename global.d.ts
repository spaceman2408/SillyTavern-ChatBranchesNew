export {};
import '../../../../../public/global';

declare global {
  const toastr: {
    clear(toast?: any, options?: { force: boolean }): void;
    error(message: string, title?: string, options?: any): any;
    info(message: string, title?: string, options?: any): any;
    remove(toast?: any): void;
    success(message: string, title?: string, options?: any): any;
    warning(message: string, title?: string, options?: any): any;
    // Add other methods if you use them
  };
}