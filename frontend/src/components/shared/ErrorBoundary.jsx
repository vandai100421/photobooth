import { Component } from 'react';
import Button from '../ui/Button';
import { captureException } from '../../utils/sentry';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
    captureException(error, { componentStack: info?.componentStack });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleRetry);
      }
      return (
        <div className="flex min-h-[60vh] w-full items-center justify-center p-6">
          <div className="w-full max-w-md rounded-xl border border-red-200 bg-white p-6 text-center shadow-sm">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-2xl">
              <span aria-hidden="true">⚠️</span>
            </div>
            <h2 className="text-lg font-semibold text-gray-800">
              Đã xảy ra lỗi
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Ứng dụng gặp lỗi không mong muốn. Vui lòng thử lại.
            </p>
            {this.state.error?.message && (
              <pre className="mt-3 max-h-32 overflow-auto rounded-lg bg-gray-50 p-2 text-left text-xs text-gray-500">
                {this.state.error.message}
              </pre>
            )}
            <div className="mt-4">
              <Button onClick={this.handleRetry}>Thử lại</Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
