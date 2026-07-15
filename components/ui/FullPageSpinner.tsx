interface FullPageSpinnerProps {
  className?: string;
}

export function FullPageSpinner({ className = '' }: FullPageSpinnerProps) {
  return (
    <div className={`min-h-screen flex items-center justify-center ${className}`.trim()}>
      <div className="animate-spin rounded-full h-16 w-16 border-4 border-[var(--accent-color)] border-t-transparent"></div>
    </div>
  );
}
