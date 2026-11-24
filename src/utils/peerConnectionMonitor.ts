export type PeerHealthStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'restarting-ice'
  | 'reinitializing'
  | 'failed';

export interface PeerStateSnapshot {
  remoteSocketId: string;
  iceConnectionState: RTCIceConnectionState;
  connectionState: RTCPeerConnectionState;
  iceGatheringState: RTCIceGatheringState;
  signalingState: RTCSignalingState;
  status: PeerHealthStatus;
  iceRestartCount: number;
  reinitCount: number;
}

export interface PeerConnectionCleanupOptions {
  /** Peer connection container whose `.current` will be explicitly set to `null`. */
  connectionRef?: { current: RTCPeerConnection | null };
  /** Peer connection instance to tear down (falls back to `connectionRef.current`). */
  peerConnection?: RTCPeerConnection | null;
  /** Remote stream associated with this peer whose tracks will be explicitly stopped. */
  remoteStream?: MediaStream | null;
  /** Optional local stream to stop (set `stopLocalTracks: true` only on full call end / unmount). */
  localStream?: MediaStream | null;
  stopLocalTracks?: boolean;
  /** Optional media elements to detach `srcObject = null` from. */
  mediaElements?: Array<HTMLMediaElement | null | undefined>;
  /** Optional monitor instance to dispose before closing the connection. */
  monitor?: PeerConnectionStateMonitor | null;
}

export interface PeerConnectionMonitorCallbacks {
  onStateChange?: (snapshot: PeerStateSnapshot) => void;
  /** Triggered immediately after `peerConnection.restartIce()` to send an ICE-restart SDP offer. */
  onIceRestartOffer: (remoteSocketId: string) => Promise<void> | void;
  /** Triggered when ICE restart attempts fail/stall and a full cleanup-to-null + re-init is needed. */
  onRequestReinitialize: (remoteSocketId: string, reason: string) => Promise<void> | void;
  /** Triggered once both ICE restarts and full re-initializations are exhausted. */
  onRecoveryExhausted?: (remoteSocketId: string, reason: string) => void;
}

export interface PeerConnectionMonitorOptions {
  /** Grace window (ms) before escalating `disconnected` to `restartIce()`. Default: 3000ms. */
  disconnectedGraceMs?: number;
  /** Timeout (ms) waiting for `restartIce()` to recover before full re-initialization. Default: 5000ms. */
  restartRecoveryTimeoutMs?: number;
  /** Maximum in-place `peerConnection.restartIce()` attempts before full re-init. Default: 2. */
  maxIceRestarts?: number;
  /** Maximum full cleanup-to-null + re-init cycles before surfacing an error. Default: 2. */
  maxReinits?: number;
  /** Initial reinit counter carried across re-initialized peer connections. */
  initialReinitCount?: number;
}

/**
 * Robustly tears down a WebRTC RTCPeerConnection:
 * 1. Disposes state monitor timers and detaches all peer event handlers.
 * 2. Explicitly stops remote stream tracks and receiver tracks (and local tracks when requested).
 * 3. Detaches senders/transceivers and closes the RTCPeerConnection.
 * 4. Explicitly sets the connection reference to `null` so callers can safely re-initialize.
 */
export function cleanupPeerConnection(options: PeerConnectionCleanupOptions): null {
  const {
    connectionRef,
    remoteStream,
    localStream,
    stopLocalTracks = false,
    mediaElements = [],
    monitor,
  } = options;

  if (monitor) {
    try {
      monitor.dispose();
    } catch {
      // ignore monitor cleanup errors
    }
  }

  const pc = options.peerConnection ?? connectionRef?.current ?? null;

  // 1. Explicitly stop all remote MediaStream tracks and strip track callbacks
  if (remoteStream) {
    for (const track of remoteStream.getTracks()) {
      try {
        track.onended = null;
        track.onmute = null;
        track.onunmute = null;
        track.stop();
      } catch {
        // ignore
      }
    }
  }

  // 2. Optionally stop local hardware tracks (call end / unmount)
  if (stopLocalTracks && localStream) {
    for (const track of localStream.getTracks()) {
      try {
        track.onended = null;
        track.onmute = null;
        track.onunmute = null;
        track.stop();
      } catch {
        // ignore
      }
    }
  }

  // 3. Detach media elements cleanly
  for (const el of mediaElements) {
    if (el && el.srcObject) {
      try {
        el.pause();
        el.srcObject = null;
      } catch {
        // ignore
      }
    }
  }

  // 4. Strip all RTCPeerConnection listeners, close tracks/transceivers, and close connection
  if (pc) {
    try {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.oniceconnectionstatechange = null;
      pc.onicegatheringstatechange = null;
      pc.onsignalingstatechange = null;
      pc.onnegotiationneeded = null;
      pc.ondatachannel = null;
    } catch {
      // ignore
    }

    // Stop all receiver tracks
    try {
      for (const receiver of pc.getReceivers()) {
        if (receiver.track) {
          try {
            receiver.track.onended = null;
            receiver.track.onmute = null;
            receiver.track.onunmute = null;
            receiver.track.stop();
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore
    }

    // Detach sender tracks (and stop them only when stopLocalTracks is explicitly requested)
    try {
      for (const sender of pc.getSenders()) {
        if (stopLocalTracks && sender.track) {
          try {
            sender.track.stop();
          } catch {
            // ignore
          }
        }
        try {
          if (pc.signalingState !== 'closed') {
            void sender.replaceTrack(null).catch(() => {});
          }
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }

    // Stop all active transceivers
    try {
      for (const transceiver of pc.getTransceivers()) {
        try {
          if (transceiver.currentDirection !== 'stopped') {
            transceiver.stop();
          }
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }

    // Close the RTCPeerConnection
    try {
      if (pc.signalingState !== 'closed') {
        pc.close();
      }
    } catch {
      // ignore
    }
  }

  // 5. Explicitly null out the connection reference before any re-initialization
  if (connectionRef) {
    connectionRef.current = null;
  }

  return null;
}

/**
 * Monitors an RTCPeerConnection's ICE, connection, gathering, and signaling states.
 * Automatically detects `iceConnectionState === 'failed'` (or persistent `disconnected`),
 * invokes a clean `peerConnection.restartIce()`, and escalates to full cleanup-to-null
 * + re-initialization if ICE restart does not recover within bounded limits.
 */
export class PeerConnectionStateMonitor {
  private readonly remoteSocketId: string;
  private peerConnection: RTCPeerConnection | null;
  private readonly callbacks: PeerConnectionMonitorCallbacks;
  private readonly disconnectedGraceMs: number;
  private readonly restartRecoveryTimeoutMs: number;
  private readonly maxIceRestarts: number;
  private readonly maxReinits: number;

  private iceRestartCount = 0;
  private reinitCount: number;
  private isRestartingIce = false;
  private isDisposed = false;
  private status: PeerHealthStatus = 'connecting';

  private disconnectedTimer: ReturnType<typeof setTimeout> | null = null;
  private restartTimeoutTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    remoteSocketId: string,
    peerConnection: RTCPeerConnection,
    callbacks: PeerConnectionMonitorCallbacks,
    options: PeerConnectionMonitorOptions = {}
  ) {
    this.remoteSocketId = remoteSocketId;
    this.peerConnection = peerConnection;
    this.callbacks = callbacks;
    this.disconnectedGraceMs = options.disconnectedGraceMs ?? 3000;
    this.restartRecoveryTimeoutMs = options.restartRecoveryTimeoutMs ?? 5000;
    this.maxIceRestarts = options.maxIceRestarts ?? 2;
    this.maxReinits = options.maxReinits ?? 2;
    this.reinitCount = options.initialReinitCount ?? 0;

    this.attachListeners();
    this.emitState('connecting');
  }

  private attachListeners(): void {
    const pc = this.peerConnection;
    if (!pc) return;

    pc.addEventListener('iceconnectionstatechange', this.handleIceConnectionStateChange);
    pc.addEventListener('connectionstatechange', this.handleConnectionStateChange);
    pc.addEventListener('icegatheringstatechange', this.handleAuxStateChange);
    pc.addEventListener('signalingstatechange', this.handleAuxStateChange);
  }

  private clearTimers(): void {
    if (this.disconnectedTimer) {
      clearTimeout(this.disconnectedTimer);
      this.disconnectedTimer = null;
    }
    if (this.restartTimeoutTimer) {
      clearTimeout(this.restartTimeoutTimer);
      this.restartTimeoutTimer = null;
    }
  }

  private emitState(nextStatus: PeerHealthStatus): void {
    this.status = nextStatus;
    const pc = this.peerConnection;
    if (!pc || this.isDisposed) return;

    this.callbacks.onStateChange?.({
      remoteSocketId: this.remoteSocketId,
      iceConnectionState: pc.iceConnectionState,
      connectionState: pc.connectionState,
      iceGatheringState: pc.iceGatheringState,
      signalingState: pc.signalingState,
      status: this.status,
      iceRestartCount: this.iceRestartCount,
      reinitCount: this.reinitCount,
    });
  }

  private handleAuxStateChange = (): void => {
    if (this.isDisposed || !this.peerConnection) return;
    this.emitState(this.status);
  };

  private handleIceConnectionStateChange = (): void => {
    const pc = this.peerConnection;
    if (this.isDisposed || !pc) return;

    const iceState = pc.iceConnectionState;

    if (iceState === 'connected' || iceState === 'completed') {
      this.clearTimers();
      this.isRestartingIce = false;
      this.iceRestartCount = 0;
      this.emitState('connected');
      return;
    }

    if (iceState === 'checking' || iceState === 'new') {
      this.emitState(this.isRestartingIce ? 'restarting-ice' : 'connecting');
      return;
    }

    if (iceState === 'disconnected') {
      this.emitState('disconnected');
      if (!this.disconnectedTimer) {
        this.disconnectedTimer = setTimeout(() => {
          this.disconnectedTimer = null;
          if (this.isDisposed || !this.peerConnection) return;
          const currentIce = this.peerConnection.iceConnectionState;
          if (currentIce === 'disconnected' || currentIce === 'failed') {
            this.triggerIceRestart('ICE connection remained disconnected');
          }
        }, this.disconnectedGraceMs);
      }
      return;
    }

    if (iceState === 'failed') {
      this.clearTimers();
      this.triggerIceRestart('ICE connection entered failed state');
      return;
    }

    if (iceState === 'closed') {
      this.clearTimers();
      this.isRestartingIce = false;
      this.emitState('idle');
    }
  };

  private handleConnectionStateChange = (): void => {
    const pc = this.peerConnection;
    if (this.isDisposed || !pc) return;

    const connState = pc.connectionState;

    if (connState === 'connected') {
      this.clearTimers();
      this.isRestartingIce = false;
      this.iceRestartCount = 0;
      this.emitState('connected');
      return;
    }

    if (connState === 'failed') {
      this.clearTimers();
      this.triggerIceRestart('Peer connection entered failed state');
      return;
    }

    if (connState === 'disconnected') {
      this.emitState('disconnected');
      return;
    }

    if (connState === 'connecting' || connState === 'new') {
      this.emitState(this.isRestartingIce ? 'restarting-ice' : 'connecting');
    }
  };

  /**
   * Executes a clean `peerConnection.restartIce()` call followed by an ICE-restart SDP offer.
   * Escalates to full cleanup-to-null + re-initialization when restart attempts are exhausted or stall.
   */
  public triggerIceRestart(reason: string): void {
    const pc = this.peerConnection;
    if (this.isDisposed || !pc || pc.signalingState === 'closed') return;
    if (this.isRestartingIce) return;

    if (this.iceRestartCount >= this.maxIceRestarts) {
      this.escalateToReinitialize(
        `${reason} (ICE restart limit of ${this.maxIceRestarts} reached)`
      );
      return;
    }

    this.iceRestartCount += 1;
    this.isRestartingIce = true;
    this.emitState('restarting-ice');

    // Explicit WebRTC ICE restart call before generating the restart SDP offer
    try {
      if (typeof pc.restartIce === 'function') {
        pc.restartIce();
      }
    } catch {
      // Fallback still proceeds with createOffer({ iceRestart: true })
    }

    Promise.resolve(this.callbacks.onIceRestartOffer(this.remoteSocketId)).catch(() => {
      // Handled by recovery timeout below
    });

    // Guard against stalled ICE restart by escalating to full cleanup-to-null + re-init
    if (this.restartTimeoutTimer) {
      clearTimeout(this.restartTimeoutTimer);
    }
    this.restartTimeoutTimer = setTimeout(() => {
      this.restartTimeoutTimer = null;
      if (this.isDisposed || !this.peerConnection) return;
      this.isRestartingIce = false;
      const currentIce = this.peerConnection.iceConnectionState;
      if (currentIce !== 'connected' && currentIce !== 'completed') {
        if (this.iceRestartCount < this.maxIceRestarts) {
          this.triggerIceRestart('Previous ICE restart timed out');
        } else {
          this.escalateToReinitialize('ICE restart timed out without recovery');
        }
      }
    }, this.restartRecoveryTimeoutMs);
  }

  private escalateToReinitialize(reason: string): void {
    if (this.isDisposed) return;
    this.clearTimers();
    this.isRestartingIce = false;

    if (this.reinitCount >= this.maxReinits) {
      this.emitState('failed');
      this.callbacks.onRecoveryExhausted?.(this.remoteSocketId, reason);
      return;
    }

    this.emitState('reinitializing');
    Promise.resolve(this.callbacks.onRequestReinitialize(this.remoteSocketId, reason)).catch(
      () => {}
    );
  }

  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.clearTimers();
    if (this.peerConnection) {
      try {
        this.peerConnection.removeEventListener(
          'iceconnectionstatechange',
          this.handleIceConnectionStateChange
        );
        this.peerConnection.removeEventListener(
          'connectionstatechange',
          this.handleConnectionStateChange
        );
        this.peerConnection.removeEventListener(
          'icegatheringstatechange',
          this.handleAuxStateChange
        );
        this.peerConnection.removeEventListener(
          'signalingstatechange',
          this.handleAuxStateChange
        );
      } catch {
        // ignore
      }
      this.peerConnection = null;
    }
  }
}
