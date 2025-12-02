'use client';

interface RecordButtonProps {
  isRecording: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export function RecordButton({ isRecording, onClick, disabled }: RecordButtonProps) {
  return (
    <div className="relative flex items-center justify-center">
      {/* Pulse rings when recording */}
      {isRecording && (
        <>
          <div className="absolute w-40 h-40 rounded-full bg-red-500/20 animate-pulse-ring" />
          <div className="absolute w-48 h-48 rounded-full bg-red-500/10 animate-pulse-ring" style={{ animationDelay: '0.5s' }} />
        </>
      )}

      {/* Main button */}
      <button
        onClick={onClick}
        disabled={disabled}
        className={`
          relative w-28 h-28 rounded-full flex items-center justify-center
          transition-all duration-300 ease-out
          ${isRecording
            ? 'bg-gradient-to-br from-red-500 to-red-600 scale-110'
            : 'bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 hover:scale-105'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}
          shadow-2xl
        `}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
      >
        {/* Inner glow */}
        <div className={`
          absolute inset-2 rounded-full
          ${isRecording
            ? 'bg-gradient-to-br from-red-400/30 to-transparent'
            : 'bg-gradient-to-br from-white/20 to-transparent'
          }
        `} />

        {/* Icon */}
        {isRecording ? (
          <div className="relative w-10 h-10 bg-white rounded-lg" />
        ) : (
          <MicIcon className="relative w-12 h-12 text-white" />
        )}
      </button>

      {/* Status text */}
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2">
        <span className={`
          text-sm font-medium
          ${isRecording ? 'text-red-600' : 'text-gray-500'}
        `}>
          {isRecording ? 'Tap to stop' : 'Tap to record'}
        </span>
      </div>
    </div>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
    </svg>
  );
}
