// One shape for every AI provider, so the studio does not care who runs Lucy 2.5.

export type AiProvider = "decart" | "fal";

export type EngineState = "connecting" | "connected" | "generating" | "reconnecting" | "disconnected";

export type EngineQuality = { quality: "good" | "fair" | "poor" | "critical"; fps: number | null };

export type EngineEvents = {
  onRemoteStream: (stream: MediaStream) => void;
  onState: (state: EngineState) => void;
  onSeconds: (seconds: number) => void; // seconds of active AI generation
  onQueue?: (queue: { position: number; queueSize: number }) => void;
  onQuality?: (quality: EngineQuality) => void;
  onError: (message: string) => void; // non-fatal problem worth showing
  onEnded: (reason: string) => void; // the provider ended the session
};

export type EngineInput = {
  prompt: string;
  image: Blob; // prepared JPEG of the character
};

export type EngineSession = {
  provider: AiProvider;
  // Decart can put the stream on the channel link / OBS source. fal cannot (yet).
  supportsChannel: boolean;
  set: (input: EngineInput) => Promise<void>;
  disconnect: () => void;
  getSubscribeToken: () => string | null;
};
