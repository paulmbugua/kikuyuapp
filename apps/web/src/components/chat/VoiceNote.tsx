import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, Play, Pause, Send, Trash2 } from 'lucide-react';

interface VoiceNoteProps {
  onSend: (duration: number) => void;
}

const VoiceNote = ({ onSend }: VoiceNoteProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [hasRecording, setHasRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [waveform, setWaveform] = useState<number[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const playTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Generate waveform bars as we record
  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(() => {
      setWaveform(prev => [...prev, 15 + Math.random() * 85].slice(-40));
    }, 100);
    return () => clearInterval(interval);
  }, [isRecording]);

  const startRecording = () => {
    setIsRecording(true);
    setRecordingTime(0);
    setWaveform([]);
    setHasRecording(false);
    timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
  };

  const stopRecording = () => {
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    setHasRecording(true);
  };

  const discard = () => {
    setHasRecording(false);
    setRecordingTime(0);
    setWaveform([]);
    setPlaybackProgress(0);
  };

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    } else {
      setIsPlaying(true);
      setPlaybackProgress(0);
      const totalSteps = recordingTime * 20;
      let step = 0;
      playTimerRef.current = setInterval(() => {
        step++;
        setPlaybackProgress(step / totalSteps);
        if (step >= totalSteps) {
          setIsPlaying(false);
          setPlaybackProgress(0);
          if (playTimerRef.current) clearInterval(playTimerRef.current);
        }
      }, 50);
    }
  };

  const handleSend = () => {
    onSend(recordingTime);
    discard();
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  // Recording state
  if (isRecording) {
    return (
      <div className="flex items-center gap-3 p-3 bg-destructive/10 rounded-2xl animate-pulse-border">
        <div className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
        <div className="flex-1 flex items-end gap-[2px] h-8 overflow-hidden">
          {waveform.map((h, i) => (
            <div
              key={i}
              className="w-1 rounded-full bg-destructive/70 transition-all duration-100"
              style={{ height: `${h}%`, minHeight: 3 }}
            />
          ))}
        </div>
        <span className="text-sm font-mono text-destructive font-bold min-w-[40px]">{formatTime(recordingTime)}</span>
        <button onClick={stopRecording} className="w-9 h-9 rounded-full bg-destructive flex items-center justify-center text-destructive-foreground shadow-md">
          <Square className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Has recording - show playback
  if (hasRecording) {
    return (
      <div className="flex items-center gap-2 p-3 bg-muted rounded-2xl">
        <button onClick={discard} className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center text-destructive hover:bg-destructive/20 transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
        <button onClick={togglePlay} className="w-9 h-9 rounded-full thutha-gradient flex items-center justify-center text-primary-foreground shadow-md">
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>
        <div className="flex-1 flex items-center gap-[2px] h-8 overflow-hidden">
          {waveform.map((h, i) => {
            const barProgress = i / waveform.length;
            const isActive = barProgress <= playbackProgress;
            return (
              <div
                key={i}
                className={`w-1 rounded-full transition-colors duration-150 ${isActive ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                style={{ height: `${h}%`, minHeight: 3 }}
              />
            );
          })}
        </div>
        <span className="text-xs font-mono text-muted-foreground min-w-[36px]">{formatTime(recordingTime)}</span>
        <button onClick={handleSend} className="w-9 h-9 rounded-full thutha-gradient flex items-center justify-center text-primary-foreground shadow-md">
          <Send className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Default - mic button
  return (
    <button
      onClick={startRecording}
      className="p-2.5 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-accent"
      title="Record voice note"
    >
      <Mic className="w-5 h-5" />
    </button>
  );
};

export default VoiceNote;
