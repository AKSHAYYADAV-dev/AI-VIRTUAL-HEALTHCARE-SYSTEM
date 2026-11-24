import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  MessageSquare,
  FilePlus,
  Send,
  ShieldCheck,
  User as UserIcon,
  RefreshCw,
  ArrowLeftRight,
  FlipHorizontal,
  Camera,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
  Wifi,
  WifiOff,
  Copy,
  Check,
  ClipboardEdit,
  Stethoscope,
  Users,
} from 'lucide-react';
import { Appointment, User } from '../types/healthcare';
import {
  PeerConnectionStateMonitor,
  PeerHealthStatus,
  cleanupPeerConnection,
} from '../utils/peerConnectionMonitor';

interface RoomParticipant {
  socketId: string;
  clientInstanceId: string;
  user: {
    id: string;
    name: string;
    role: 'patient' | 'doctor' | 'admin';
    specialty?: string;
  };
  cameraOn: boolean;
  micOn: boolean;
  hasVideoTrack: boolean;
  hasAudioTrack: boolean;
  joinedAt: string;
}

interface RoomChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'patient' | 'doctor' | 'admin' | 'system';
  text: string;
  timestamp: string;
  kind?: 'chat' | 'system' | 'eprescription';
}

interface RoomRxNotice {
  rxId: string;
  diagnosisSummary: string;
  medicinesCount: number;
  doctorName: string;
  issuedAt: string;
}

interface VideoConsultationProps {
  currentUser: User;
  appointments: Appointment[];
  activeAppointment: Appointment | null;
  onSelectAppointment: (apt: Appointment) => void;
  onWriteEPrescription?: (apt: Appointment) => void;
  onExitCall: () => void;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
  iceCandidatePoolSize: 6,
};

function findTransceiverByKind(
  pc: RTCPeerConnection,
  kind: 'video' | 'audio'
): RTCRtpTransceiver | undefined {
  return pc.getTransceivers().find((t) => {
    const stopped = Boolean((t as any).stopped) || t.currentDirection === 'stopped';
    if (stopped) return false;
    return t.receiver?.track?.kind === kind || t.sender?.track?.kind === kind;
  });
}

function getTabInstanceId(): string {
  try {
    const key = 'medassist_tab_consult_id';
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem(key, id);
    }
    return id;
  } catch {
    return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

export const VideoConsultation: React.FC<VideoConsultationProps> = ({
  currentUser,
  appointments,
  activeAppointment,
  onSelectAppointment,
  onWriteEPrescription,
  onExitCall,
}) => {
  const availableAppointments = appointments.filter((a) => a.status !== 'Rejected');

  const fallbackInstantAppointment: Appointment = useMemo(
    () => ({
      id: 'apt-live-instant',
      patientId: currentUser.role === 'patient' ? currentUser.id : 'pat-1',
      patientName: currentUser.role === 'patient' ? currentUser.name : 'Rohan Verma',
      patientEmail: currentUser.role === 'patient' ? currentUser.email : 'rohan@patient.in',
      doctorId: currentUser.role === 'doctor' ? currentUser.id : 'doc-1',
      doctorName: currentUser.role === 'doctor' ? currentUser.name : 'Dr. Aarav Mehta',
      doctorSpecialty:
        currentUser.role === 'doctor'
          ? currentUser.specialty || 'General & Internal Medicine'
          : 'General & Internal Medicine',
      date: new Date().toISOString().split('T')[0],
      timeSlot: 'Live Instant Consult',
      symptoms: 'General telemedicine health consultation & symptom review',
      status: 'Confirmed',
      meetingRoomId: 'MED-ROOM-101',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    [currentUser]
  );

  const currentApt =
    activeAppointment ||
    availableAppointments.find((a) => ['Confirmed', 'Rescheduled'].includes(a.status)) ||
    availableAppointments[0] ||
    fallbackInstantAppointment;

  const roomId = (currentApt.meetingRoomId || 'MED-ROOM-101').trim().toUpperCase();

  // Call & media state
  const [inCall, setInCall] = useState<boolean>(true);
  const [cameraOn, setCameraOn] = useState<boolean>(true);
  const [micOn, setMicOn] = useState<boolean>(true);
  const [mirrorVideo, setMirrorVideo] = useState<boolean>(true);
  const [selfInMainStage, setSelfInMainStage] = useState<boolean>(true);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [lastCallDurationSeconds, setLastCallDurationSeconds] = useState<number>(0);
  const [showCallSummary, setShowCallSummary] = useState<boolean>(false);
  const [cameraStreamActive, setCameraStreamActive] = useState<boolean>(false);
  const [audioStreamActive, setAudioStreamActive] = useState<boolean>(false);
  const [cameraLoading, setCameraLoading] = useState<boolean>(false);
  const [mediaNotice, setMediaNotice] = useState<string | null>(null);

  // Real-time WebSocket & Peer state
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'reconnecting' | 'disconnected'>('connecting');
  const [selfSocketId, setSelfSocketId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [roomMessages, setRoomMessages] = useState<RoomChatMessage[]>([]);
  const [clinicalNotes, setClinicalNotes] = useState<string>('');
  const [notesUpdatedBy, setNotesUpdatedBy] = useState<string | null>(null);
  const [notesUpdatedAt, setNotesUpdatedAt] = useState<string | null>(null);
  const [latestRxNotice, setLatestRxNotice] = useState<RoomRxNotice | null>(null);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'chat' | 'notes'>('chat');
  const [chatInput, setChatInput] = useState('');
  const [copiedInvite, setCopiedInvite] = useState(false);

  // WebRTC Remote stream & peer connection state monitor status
  const [remoteStreamVersion, setRemoteStreamVersion] = useState<number>(0);
  const [rtcConnectionState, setRtcConnectionState] = useState<PeerHealthStatus | string>('idle');
  const [connectionRecoveryError, setConnectionRecoveryError] = useState<string | null>(null);

  const clientInstanceIdRef = useRef<string>(getTabInstanceId());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef<number>(0);
  const selfSocketIdRef = useRef<string | null>(null);
  const participantsRef = useRef<RoomParticipant[]>([]);
  const notesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const autoSwitchedToRemoteRef = useRef<boolean>(false);
  const roomIdRef = useRef<string>(roomId);
  roomIdRef.current = roomId;

  // Dedicated local & remote video element refs (prevents ref collision when swapping Main/PiP)
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRequestIdRef = useRef<number>(0);

  // WebRTC Peer connections (nullable slot refs so cleanup explicitly sets connection object to null before re-init)
  const peerConnectionsRef = useRef<Map<string, { current: RTCPeerConnection | null }>>(new Map());
  const peerMonitorsRef = useRef<Map<string, PeerConnectionStateMonitor>>(new Map());
  const peerReinitCountsRef = useRef<Map<string, number>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const makingOfferRef = useRef<Map<string, boolean>>(new Map());
  const ignoreOfferRef = useRef<Map<string, boolean>>(new Map());
  const peerQueueRef = useRef<Map<string, Promise<void>>>(new Map());
  const fallbackOfferTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const attachStreamsRef = useRef<() => void>(() => {});
  const renegotiateRef = useRef<
    (remoteSocketId: string, opts?: { iceRestart?: boolean }) => Promise<void>
  >(async () => {});
  const reinitializePeerRef = useRef<(remoteSocketId: string, resetCounters?: boolean) => void>(
    () => {}
  );

  // Keep latest media flags in refs for WebSocket callbacks
  const mediaFlagsRef = useRef({
    cameraOn,
    micOn,
    hasVideoTrack: false,
    hasAudioTrack: false,
  });
  mediaFlagsRef.current.cameraOn = cameraOn;
  mediaFlagsRef.current.micOn = micOn;

  const remoteParticipants = useMemo(
    () => participants.filter((p) => p.socketId !== selfSocketId),
    [participants, selfSocketId]
  );

  // Prefer the opposite role participant if multiple exist
  const primaryRemotePeer = useMemo(() => {
    if (remoteParticipants.length === 0) return null;
    const oppositeRole = currentUser.role === 'doctor' ? 'patient' : 'doctor';
    return (
      remoteParticipants.find((p) => p.user.role === oppositeRole) || remoteParticipants[0]
    );
  }, [remoteParticipants, currentUser.role]);

  const primaryRemoteStream = useMemo(() => {
    void remoteStreamVersion;
    return primaryRemotePeer
      ? remoteStreamsRef.current.get(primaryRemotePeer.socketId) || null
      : null;
  }, [primaryRemotePeer, remoteStreamVersion]);

  const remoteVideoTracks = primaryRemoteStream?.getVideoTracks() || [];
  const remoteHasLiveTrack = remoteVideoTracks.some((t) => t.readyState === 'live');
  const remoteHasUnmutedVideo = remoteVideoTracks.some(
    (t) => t.readyState === 'live' && !t.muted
  );

  const remoteHasLiveVideo = Boolean(
    primaryRemoteStream &&
      remoteHasLiveTrack &&
      (primaryRemotePeer?.cameraOn !== false || remoteHasUnmutedVideo)
  );

  const sendWsEvent = useCallback((event: string, payload: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event, payload }));
      return true;
    }
    return false;
  }, []);

  // Automatically bring remote participant onto main stage once their live video arrives
  useEffect(() => {
    if (remoteHasLiveVideo && !autoSwitchedToRemoteRef.current) {
      autoSwitchedToRemoteRef.current = true;
      setSelfInMainStage(false);
    } else if (!primaryRemotePeer) {
      autoSwitchedToRemoteRef.current = false;
      setSelfInMainStage(true);
    }
  }, [remoteHasLiveVideo, primaryRemotePeer]);

  // Attach local & remote MediaStreams reliably to dedicated <video> / <audio> elements.
  // Keep remoteStream attached whenever a live remote track exists (even before first keyframe unmutes it)
  // so the browser decoder immediately renders the first video frame without deadlocking!
  const attachStreamsToElements = useCallback(() => {
    const localStream = mediaStreamRef.current;
    const remoteStream = primaryRemoteStream;

    const localTarget = localVideoRef.current;
    const remoteTarget = remoteVideoRef.current;

    if (localTarget) {
      if (localStream && cameraStreamActive) {
        if (localTarget.srcObject !== localStream) {
          localTarget.srcObject = localStream;
        }
        localTarget.muted = true;
        localTarget.play().catch(() => {});
      } else if (localTarget.srcObject) {
        localTarget.srcObject = null;
      }
    }

    if (remoteTarget) {
      if (remoteStream && remoteHasLiveTrack) {
        if (remoteTarget.srcObject !== remoteStream) {
          remoteTarget.srcObject = remoteStream;
        }
        remoteTarget.muted = true; // Audio plays reliably via dedicated <audio> element
        remoteTarget.play().catch(() => {});
      } else if (remoteTarget.srcObject) {
        remoteTarget.srcObject = null;
      }
    }

    if (remoteAudioRef.current) {
      if (remoteStream && remoteStream.getAudioTracks().some((t) => t.readyState === 'live')) {
        if (remoteAudioRef.current.srcObject !== remoteStream) {
          remoteAudioRef.current.srcObject = remoteStream;
        }
        remoteAudioRef.current.play().catch(() => {
          const unlock = () => {
            remoteAudioRef.current?.play().catch(() => {});
            window.removeEventListener('pointerdown', unlock);
          };
          window.addEventListener('pointerdown', unlock, { once: true });
        });
      } else if (remoteAudioRef.current.srcObject) {
        remoteAudioRef.current.srcObject = null;
      }
    }
  }, [cameraStreamActive, primaryRemoteStream, remoteHasLiveTrack]);

  attachStreamsRef.current = attachStreamsToElements;

  useEffect(() => {
    attachStreamsToElements();
  }, [attachStreamsToElements, selfInMainStage, remoteStreamVersion, inCall]);

  // Serialize async signaling tasks per peer so SDP/ICE operations never race or throw InvalidStateError
  const enqueuePeerTask = useCallback((remoteSocketId: string, task: () => Promise<void>) => {
    const prev = peerQueueRef.current.get(remoteSocketId) || Promise.resolve();
    const next = prev.then(task).catch(() => {});
    peerQueueRef.current.set(remoteSocketId, next);
  }, []);

  const getActivePeerConnection = useCallback((remoteSocketId: string): RTCPeerConnection | null => {
    const slot = peerConnectionsRef.current.get(remoteSocketId);
    const pc = slot?.current ?? null;
    if (!pc || pc.signalingState === 'closed') return null;
    return pc;
  }, []);

  // Robust cleanup for a single peer connection: explicitly stops tracks, closes PC, and sets connection object to null
  const closePeerConnection = useCallback(
    (
      targetSocketId: string,
      opts?: { preserveReinitCount?: boolean; stopLocalTracks?: boolean }
    ) => {
      const fallbackTimer = fallbackOfferTimersRef.current.get(targetSocketId);
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
        fallbackOfferTimersRef.current.delete(targetSocketId);
      }

      const monitor = peerMonitorsRef.current.get(targetSocketId) || null;
      peerMonitorsRef.current.delete(targetSocketId);

      const connectionSlot = peerConnectionsRef.current.get(targetSocketId);
      const remoteStream = remoteStreamsRef.current.get(targetSocketId) || null;

      cleanupPeerConnection({
        connectionRef: connectionSlot,
        peerConnection: connectionSlot?.current ?? null,
        remoteStream,
        localStream: opts?.stopLocalTracks ? mediaStreamRef.current : null,
        stopLocalTracks: Boolean(opts?.stopLocalTracks),
        mediaElements:
          remoteStreamsRef.current.size <= 1
            ? [remoteVideoRef.current, remoteAudioRef.current]
            : [],
        monitor,
      });

      // Connection slot `.current` is now explicitly `null`
      if (connectionSlot) {
        connectionSlot.current = null;
      }
      peerConnectionsRef.current.delete(targetSocketId);
      remoteStreamsRef.current.delete(targetSocketId);
      pendingIceRef.current.delete(targetSocketId);
      makingOfferRef.current.delete(targetSocketId);
      ignoreOfferRef.current.delete(targetSocketId);
      peerQueueRef.current.delete(targetSocketId);
      if (!opts?.preserveReinitCount) {
        peerReinitCountsRef.current.delete(targetSocketId);
      }
      setRemoteStreamVersion((v) => v + 1);
    },
    []
  );

  const closeAllPeerConnections = useCallback(
    (stopLocalTracks = false) => {
      for (const sid of Array.from(peerConnectionsRef.current.keys())) {
        closePeerConnection(sid, { stopLocalTracks });
      }
      if (stopLocalTracks && mediaStreamRef.current) {
        cleanupPeerConnection({
          localStream: mediaStreamRef.current,
          stopLocalTracks: true,
          mediaElements: [localVideoRef.current, remoteVideoRef.current, remoteAudioRef.current],
        });
        mediaStreamRef.current = null;
      }
      pendingIceRef.current.clear();
      peerReinitCountsRef.current.clear();
      setConnectionRecoveryError(null);
      setRtcConnectionState('idle');
    },
    [closePeerConnection]
  );

  // Sync local tracks + stream association onto negotiated Unified Plan transceivers.
  // CRITICAL: Only add new transceivers when `allowAddTransceiver` is true (offerer).
  // Answerer reuses the exact video & audio transceivers created by setRemoteDescription(offer)!
  const syncLocalTracksToPeer = useCallback(
    async (pc: RTCPeerConnection, allowAddTransceiver = false): Promise<boolean> => {
      const stream = mediaStreamRef.current;
      const videoTrack =
        stream?.getVideoTracks().find((t) => t.readyState === 'live') || null;
      const audioTrack =
        stream?.getAudioTracks().find((t) => t.readyState === 'live') || null;

      let needsRenegotiation = false;

      const applyKind = async (kind: 'video' | 'audio', track: MediaStreamTrack | null) => {
        let transceiver = findTransceiverByKind(pc, kind);
        if (!transceiver && allowAddTransceiver) {
          transceiver = pc.addTransceiver(kind, {
            direction: 'sendrecv',
            streams: stream ? [stream] : [],
          });
          needsRenegotiation = true;
        }
        if (!transceiver) return;

        if (transceiver.direction !== 'sendrecv') {
          try {
            transceiver.direction = 'sendrecv';
            if (
              transceiver.currentDirection &&
              transceiver.currentDirection !== 'sendrecv' &&
              transceiver.currentDirection !== 'sendonly'
            ) {
              needsRenegotiation = true;
            }
          } catch {
            // ignore
          }
        }

        if (transceiver.sender.track !== track) {
          try {
            await transceiver.sender.replaceTrack(track);
          } catch {
            // ignore replaceTrack race
          }
        }

        if (stream && typeof transceiver.sender.setStreams === 'function') {
          try {
            transceiver.sender.setStreams(stream);
          } catch {
            // ignore
          }
        }
      };

      await applyKind('video', videoTrack);
      await applyKind('audio', audioTrack);
      return needsRenegotiation;
    },
    []
  );

  const flushPendingIce = useCallback(async (remoteSocketId: string, pc: RTCPeerConnection) => {
    if (!pc.remoteDescription?.type) return;
    const queued = pendingIceRef.current.get(remoteSocketId);
    if (!queued || queued.length === 0) return;
    pendingIceRef.current.delete(remoteSocketId);
    for (const cand of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch {
        // ignore stale candidate
      }
    }
  }, []);

  const initiateOfferToPeer = useCallback(
    async (remoteSocketId: string, opts?: { iceRestart?: boolean }) => {
      const mySid = selfSocketIdRef.current;
      if (!mySid || mySid === remoteSocketId) return;

      enqueuePeerTask(remoteSocketId, async () => {
        const pc = getActivePeerConnection(remoteSocketId);
        if (!pc) return;

        const fb = fallbackOfferTimersRef.current.get(remoteSocketId);
        if (fb) {
          clearTimeout(fb);
          fallbackOfferTimersRef.current.delete(remoteSocketId);
        }

        await syncLocalTracksToPeer(pc, true);

        if (makingOfferRef.current.get(remoteSocketId)) {
          return;
        }

        try {
          makingOfferRef.current.set(remoteSocketId, true);

          // If restarting ICE while stuck in a non-stable local offer, roll back cleanly first
          if (opts?.iceRestart && pc.signalingState === 'have-local-offer') {
            await pc.setLocalDescription({ type: 'rollback' });
          }
          if (pc.signalingState !== 'stable') return;

          if (opts?.iceRestart && typeof pc.restartIce === 'function') {
            pc.restartIce();
          }

          const offer = await pc.createOffer({
            iceRestart: Boolean(opts?.iceRestart),
          });
          if (pc.signalingState !== 'stable') return;
          await pc.setLocalDescription(offer);
          if (pc.localDescription) {
            sendWsEvent('rtc:offer', {
              roomId: roomIdRef.current,
              targetSocketId: remoteSocketId,
              sdp: {
                type: pc.localDescription.type,
                sdp: pc.localDescription.sdp,
              },
            });
          }
        } catch {
          // ignore transient signaling error
        } finally {
          makingOfferRef.current.set(remoteSocketId, false);
        }
      });
    },
    [enqueuePeerTask, getActivePeerConnection, sendWsEvent, syncLocalTracksToPeer]
  );

  renegotiateRef.current = initiateOfferToPeer;

  const createOrGetPeerConnection = useCallback(
    (remoteSocketId: string): RTCPeerConnection => {
      const existing = getActivePeerConnection(remoteSocketId);
      if (existing) return existing;

      // Ensure any stale closed connection slot is cleaned up and explicitly nulled before initializing
      if (peerConnectionsRef.current.has(remoteSocketId)) {
        closePeerConnection(remoteSocketId, { preserveReinitCount: true });
      }

      // Do NOT pre-add transceivers here! Offerer adds them in initiateOfferToPeer;
      // answerer reuses the offer's transceivers after setRemoteDescription(offer).
      const pc = new RTCPeerConnection(RTC_CONFIG);
      const slot: { current: RTCPeerConnection | null } = { current: pc };
      peerConnectionsRef.current.set(remoteSocketId, slot);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendWsEvent('rtc:ice-candidate', {
            roomId: roomIdRef.current,
            targetSocketId: remoteSocketId,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.ontrack = (event) => {
        const prevStream = remoteStreamsRef.current.get(remoteSocketId);
        const tracks = prevStream
          ? prevStream.getTracks().filter((t) => t.readyState !== 'ended')
          : [];

        const incomingTracks =
          event.streams && event.streams[0]
            ? event.streams[0].getTracks()
            : event.track
            ? [event.track]
            : [];

        for (const track of incomingTracks) {
          // Replace any older track of the same kind so fresh video/audio renders immediately
          for (let i = tracks.length - 1; i >= 0; i -= 1) {
            if (tracks[i].kind === track.kind && tracks[i].id !== track.id) {
              tracks.splice(i, 1);
            }
          }
          if (!tracks.some((t) => t.id === track.id)) {
            tracks.push(track);
          }

          track.onended = () => setRemoteStreamVersion((v) => v + 1);
          track.onmute = () => setRemoteStreamVersion((v) => v + 1);
          track.onunmute = () => {
            setRemoteStreamVersion((v) => v + 1);
            attachStreamsRef.current();
          };
        }

        // Create a fresh MediaStream snapshot so <video>.srcObject updates reliably
        const freshStream = new MediaStream(tracks);
        remoteStreamsRef.current.set(remoteSocketId, freshStream);
        setRemoteStreamVersion((v) => v + 1);
      };

      // Attach Peer Connection State Monitor: detects ICE 'failed', invokes clean pc.restartIce(),
      // and performs full track cleanup + connection null-out before re-initializing if needed.
      const monitor = new PeerConnectionStateMonitor(
        remoteSocketId,
        pc,
        {
          onStateChange: (snapshot) => {
            setRtcConnectionState(snapshot.status);
            if (snapshot.status === 'connected') {
              peerReinitCountsRef.current.set(remoteSocketId, 0);
              setConnectionRecoveryError(null);
            }
          },
          onIceRestartOffer: (sid) => {
            void renegotiateRef.current(sid, { iceRestart: true });
          },
          onRequestReinitialize: (sid) => {
            reinitializePeerRef.current(sid, false);
          },
          onRecoveryExhausted: () => {
            setConnectionRecoveryError(
              'Video peer connection dropped after automatic ICE restarts. Click "Reconnect Video" to re-initialize.'
            );
          },
        },
        {
          disconnectedGraceMs: 3000,
          restartRecoveryTimeoutMs: 5000,
          maxIceRestarts: 2,
          maxReinits: 2,
          initialReinitCount: peerReinitCountsRef.current.get(remoteSocketId) || 0,
        }
      );
      peerMonitorsRef.current.set(remoteSocketId, monitor);

      return pc;
    },
    [closePeerConnection, getActivePeerConnection, sendWsEvent]
  );

  // Full peer recovery: explicitly close tracks & null out connection object BEFORE re-initializing
  const reinitializePeerConnection = useCallback(
    (remoteSocketId: string, resetCounters = false) => {
      if (resetCounters) {
        peerReinitCountsRef.current.set(remoteSocketId, 0);
        setConnectionRecoveryError(null);
      } else {
        const nextCount = (peerReinitCountsRef.current.get(remoteSocketId) || 0) + 1;
        peerReinitCountsRef.current.set(remoteSocketId, nextCount);
      }

      setRtcConnectionState('reinitializing');

      // Step 1: Explicitly close tracks, tear down monitor, and set connection ref to null
      closePeerConnection(remoteSocketId, { preserveReinitCount: true });

      // Step 2: Re-initialize a brand-new RTCPeerConnection only if the peer is still in the room
      const stillPresent = participantsRef.current.some((p) => p.socketId === remoteSocketId);
      if (!stillPresent || wsRef.current?.readyState !== WebSocket.OPEN) {
        setRtcConnectionState('idle');
        return;
      }

      createOrGetPeerConnection(remoteSocketId);
      void initiateOfferToPeer(remoteSocketId, { iceRestart: true });
    },
    [closePeerConnection, createOrGetPeerConnection, initiateOfferToPeer]
  );

  reinitializePeerRef.current = reinitializePeerConnection;

  // Stop local webcam/mic hardware tracks and notify peers
  const stopLocalMedia = useCallback(() => {
    mediaRequestIdRef.current += 1;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    mediaFlagsRef.current.hasVideoTrack = false;
    mediaFlagsRef.current.hasAudioTrack = false;
    setCameraStreamActive(false);
    setAudioStreamActive(false);

    for (const [remoteSid, slot] of peerConnectionsRef.current.entries()) {
      const pc = slot.current;
      if (!pc || pc.signalingState === 'closed') continue;
      enqueuePeerTask(remoteSid, async () => {
        const currentPc = getActivePeerConnection(remoteSid);
        if (!currentPc) return;
        await syncLocalTracksToPeer(currentPc, false);
      });
    }

    sendWsEvent('media:state', {
      roomId: roomIdRef.current,
      cameraOn: false,
      micOn: mediaFlagsRef.current.micOn,
      hasVideoTrack: false,
      hasAudioTrack: false,
    });
  }, [enqueuePeerTask, getActivePeerConnection, sendWsEvent, syncLocalTracksToPeer]);

  // Start or update local camera & microphone cleanly WITHOUT killing live audio when toggling video
  const startLocalMedia = useCallback(
    async (wantVideo: boolean) => {
      const reqId = ++mediaRequestIdRef.current;
      setCameraLoading(true);
      setMediaNotice(null);

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setMediaNotice(
            'Browser camera/microphone API is unavailable in this context. You can still receive peer video, chat, and share clinical notes live.'
          );
          setCameraStreamActive(false);
          setAudioStreamActive(false);
          return;
        }

        const existingStream = mediaStreamRef.current;
        const existingAudio =
          existingStream?.getAudioTracks().find((t) => t.readyState === 'live') || null;
        const existingVideo =
          existingStream?.getVideoTracks().find((t) => t.readyState === 'live') || null;

        let captured: MediaStream | null = null;
        let fallbackMessage: string | null = null;

        // Fast-opening, low-latency camera constraints for instant face display
        const fastVideoConstraint: MediaTrackConstraints = {
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 24, max: 30 },
          facingMode: 'user',
        };

        if (wantVideo) {
          if (existingVideo && existingAudio) {
            captured = null; // Already have live video & audio
          } else if (existingAudio) {
            // Keep existing live audio untouched; only acquire video
            try {
              captured = await navigator.mediaDevices.getUserMedia({
                video: fastVideoConstraint,
                audio: false,
              });
            } catch (videoErr: any) {
              const errName = String(videoErr?.name || videoErr?.message || '');
              fallbackMessage =
                errName.includes('NotReadable') || errName.includes('Abort')
                  ? 'Camera is already in use by another tab/app — joined with live microphone audio & remote video.'
                  : 'No webcam detected or camera permission blocked — joined with live microphone audio & remote video.';
            }
          } else {
            try {
              captured = await navigator.mediaDevices.getUserMedia({
                video: fastVideoConstraint,
                audio: {
                  echoCancellation: true,
                  noiseSuppression: true,
                  autoGainControl: true,
                },
              });
            } catch {
              try {
                captured = await navigator.mediaDevices.getUserMedia({
                  video: true,
                  audio: false,
                });
                fallbackMessage = 'Microphone unavailable — connected with live video only.';
              } catch (videoErr: any) {
                const errName = String(videoErr?.name || videoErr?.message || '');
                try {
                  captured = await navigator.mediaDevices.getUserMedia({
                    video: false,
                    audio: true,
                  });
                  fallbackMessage =
                    errName.includes('NotReadable') || errName.includes('Abort')
                      ? 'Camera is already in use by another tab/app — joined with live microphone audio & remote video.'
                      : 'No webcam detected or camera permission blocked — joined with live microphone audio & remote video.';
                } catch {
                  fallbackMessage =
                    errName.includes('NotAllowed') || errName.includes('PermissionDenied')
                      ? 'Camera & microphone permissions blocked — joined in receive-only mode (live chat, clinical notes & incoming video active).'
                      : 'Camera/microphone unavailable on this device — joined in receive-only mode (live chat, clinical notes & incoming video active).';
                }
              }
            }
          }
        } else {
          // Turning camera OFF: stop ONLY video tracks and keep microphone audio running!
          if (existingVideo) {
            existingVideo.stop();
          }
          if (!existingAudio) {
            try {
              captured = await navigator.mediaDevices.getUserMedia({
                video: false,
                audio: true,
              });
            } catch {
              captured = null;
            }
          }
        }

        // Discard stale async getUserMedia results so camera hardware never leaks
        if (reqId !== mediaRequestIdRef.current) {
          captured?.getTracks().forEach((t) => t.stop());
          return;
        }

        const nextTracks: MediaStreamTrack[] = [];
        const newVideo = captured?.getVideoTracks()[0] || null;
        if (wantVideo && newVideo) {
          if (existingVideo && existingVideo.id !== newVideo.id) existingVideo.stop();
          nextTracks.push(newVideo);
        } else if (wantVideo && existingVideo) {
          nextTracks.push(existingVideo);
        }

        const newAudio = captured?.getAudioTracks()[0] || null;
        if (newAudio) {
          if (existingAudio && existingAudio.id !== newAudio.id) existingAudio.stop();
          newAudio.enabled = mediaFlagsRef.current.micOn;
          nextTracks.push(newAudio);
        } else if (existingAudio) {
          existingAudio.enabled = mediaFlagsRef.current.micOn;
          nextTracks.push(existingAudio);
        }

        const stream = nextTracks.length > 0 ? new MediaStream(nextTracks) : null;
        mediaStreamRef.current = stream;
        const hasVideo = Boolean(stream && stream.getVideoTracks().length > 0);
        const hasAudio = Boolean(stream && stream.getAudioTracks().length > 0);
        mediaFlagsRef.current.hasVideoTrack = hasVideo;
        mediaFlagsRef.current.hasAudioTrack = hasAudio;

        setCameraStreamActive(hasVideo);
        setAudioStreamActive(hasAudio);
        setMediaNotice(fallbackMessage);

        // Push tracks directly onto existing negotiated senders via replaceTrack (instant, zero drop!)
        for (const [remoteSid, slot] of peerConnectionsRef.current.entries()) {
          if (!slot.current || slot.current.signalingState === 'closed') continue;
          enqueuePeerTask(remoteSid, async () => {
            const pc = getActivePeerConnection(remoteSid);
            if (!pc) return;
            const needsRenegotiate = await syncLocalTracksToPeer(pc, false);
            if (needsRenegotiate && pc.signalingState === 'stable') {
              void renegotiateRef.current(remoteSid);
            }
          });
        }

        sendWsEvent('media:state', {
          roomId: roomIdRef.current,
          cameraOn: wantVideo && hasVideo,
          micOn: mediaFlagsRef.current.micOn && hasAudio,
          hasVideoTrack: hasVideo,
          hasAudioTrack: hasAudio,
        });

        attachStreamsRef.current();
      } finally {
        if (reqId === mediaRequestIdRef.current) {
          setCameraLoading(false);
        }
      }
    },
    [enqueuePeerTask, getActivePeerConnection, sendWsEvent, syncLocalTracksToPeer]
  );

  // Start/update local media ONLY when call status or cameraOn toggle changes
  useEffect(() => {
    if (inCall) {
      void startLocalMedia(cameraOn);
    } else {
      stopLocalMedia();
    }
  }, [inCall, cameraOn, startLocalMedia, stopLocalMedia]);

  // Cleanup hardware tracks and detach media elements on unmount
  useEffect(() => {
    return () => {
      cleanupPeerConnection({
        localStream: mediaStreamRef.current,
        stopLocalTracks: true,
        mediaElements: [localVideoRef.current, remoteVideoRef.current, remoteAudioRef.current],
      });
      mediaStreamRef.current = null;
    };
  }, []);

  // Toggle microphone track enabled state & sync to peer
  useEffect(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = micOn;
      });
    }
    sendWsEvent('media:state', {
      roomId: roomIdRef.current,
      cameraOn: cameraOn && mediaFlagsRef.current.hasVideoTrack,
      micOn: micOn && mediaFlagsRef.current.hasAudioTrack,
      hasVideoTrack: mediaFlagsRef.current.hasVideoTrack,
      hasAudioTrack: mediaFlagsRef.current.hasAudioTrack,
    });
  }, [micOn, cameraOn, sendWsEvent]);

  // Authoritative Real-Time WebSocket Room Connection
  useEffect(() => {
    let unmounted = false;

    const connectSocket = () => {
      if (unmounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/consultation`;

      setWsStatus(reconnectAttemptRef.current > 0 ? 'reconnecting' : 'connecting');
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (unmounted) {
          ws.close();
          return;
        }
        reconnectAttemptRef.current = 0;
        setWsStatus('connected');

        ws.send(
          JSON.stringify({
            event: 'room:join',
            payload: {
              roomId,
              appointmentId: currentApt.id,
              clientInstanceId: clientInstanceIdRef.current,
              user: {
                id: currentUser.id,
                name: currentUser.name,
                role: currentUser.role,
                specialty: currentUser.specialty,
              },
              media: {
                cameraOn: mediaFlagsRef.current.cameraOn && mediaFlagsRef.current.hasVideoTrack,
                micOn: mediaFlagsRef.current.micOn && mediaFlagsRef.current.hasAudioTrack,
                hasVideoTrack: mediaFlagsRef.current.hasVideoTrack,
                hasAudioTrack: mediaFlagsRef.current.hasAudioTrack,
              },
            },
          })
        );
      };

      ws.onmessage = async (event) => {
        let parsed: { event?: string; payload?: Record<string, any> } | null = null;
        try {
          parsed = JSON.parse(event.data);
        } catch {
          return;
        }
        if (!parsed?.event) return;
        const { event: evtName, payload = {} } = parsed;

        if (evtName === 'room:sync') {
          const mySid = String(payload.selfSocketId || '');
          selfSocketIdRef.current = mySid;
          setSelfSocketId(mySid);

          const serverParticipants: RoomParticipant[] = Array.isArray(payload.participants)
            ? payload.participants
            : [];
          participantsRef.current = serverParticipants;
          setParticipants(serverParticipants);

          if (Array.isArray(payload.messages)) {
            setRoomMessages(payload.messages);
          }
          if (typeof payload.clinicalNotes === 'string') {
            setClinicalNotes(payload.clinicalNotes);
          }
          setNotesUpdatedBy(payload.notesUpdatedBy || null);
          setNotesUpdatedAt(payload.notesUpdatedAt || null);
          setLatestRxNotice(payload.latestRxNotice || null);

          // Prune stale PCs not in participant list
          const activeRemoteIds = new Set(
            serverParticipants.filter((p) => p.socketId !== mySid).map((p) => p.socketId)
          );
          for (const existingSid of Array.from(peerConnectionsRef.current.keys())) {
            if (!activeRemoteIds.has(existingSid)) {
              closePeerConnection(existingSid);
            }
          }

          // Deterministic offer initiation + fast fallback so late/simultaneous joins connect immediately
          for (const remoteSid of activeRemoteIds) {
            createOrGetPeerConnection(remoteSid);
            if (mySid < remoteSid) {
              void initiateOfferToPeer(remoteSid);
            } else if (!fallbackOfferTimersRef.current.has(remoteSid)) {
              fallbackOfferTimersRef.current.set(
                remoteSid,
                setTimeout(() => {
                  fallbackOfferTimersRef.current.delete(remoteSid);
                  const pc = getActivePeerConnection(remoteSid);
                  if (pc && pc.signalingState === 'stable' && !pc.remoteDescription) {
                    void initiateOfferToPeer(remoteSid);
                  }
                }, 1200)
              );
            }
          }
          return;
        }

        if (evtName === 'presence:joined') {
          const list: RoomParticipant[] = Array.isArray(payload.participants)
            ? payload.participants
            : [];
          participantsRef.current = list;
          setParticipants(list);

          if (payload.systemMessage) {
            setRoomMessages((prev) =>
              prev.some((m) => m.id === payload.systemMessage.id)
                ? prev
                : [...prev, payload.systemMessage]
            );
          }

          const joinedSid = payload.participant?.socketId;
          const mySid = selfSocketIdRef.current;
          if (joinedSid && mySid && joinedSid !== mySid) {
            createOrGetPeerConnection(joinedSid);
            if (mySid < joinedSid) {
              void initiateOfferToPeer(joinedSid);
            } else if (!fallbackOfferTimersRef.current.has(joinedSid)) {
              fallbackOfferTimersRef.current.set(
                joinedSid,
                setTimeout(() => {
                  fallbackOfferTimersRef.current.delete(joinedSid);
                  const pc = getActivePeerConnection(joinedSid);
                  if (pc && pc.signalingState === 'stable' && !pc.remoteDescription) {
                    void initiateOfferToPeer(joinedSid);
                  }
                }, 1200)
              );
            }
          }
          return;
        }

        if (evtName === 'presence:left') {
          const list: RoomParticipant[] = Array.isArray(payload.participants)
            ? payload.participants
            : [];
          participantsRef.current = list;
          setParticipants(list);
          if (payload.socketId) {
            closePeerConnection(String(payload.socketId));
          }
          if (payload.systemMessage) {
            setRoomMessages((prev) =>
              prev.some((m) => m.id === payload.systemMessage.id)
                ? prev
                : [...prev, payload.systemMessage]
            );
          }
          return;
        }

        if (evtName === 'media:updated') {
          if (Array.isArray(payload.participants)) {
            participantsRef.current = payload.participants;
            setParticipants(payload.participants);
          }
          setRemoteStreamVersion((v) => v + 1);
          return;
        }

        if (evtName === 'chat:message' && payload.message) {
          const msg = payload.message as RoomChatMessage;
          setRoomMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
          return;
        }

        if (evtName === 'notes:updated') {
          setClinicalNotes(String(payload.clinicalNotes || ''));
          setNotesUpdatedBy(payload.notesUpdatedBy || null);
          setNotesUpdatedAt(payload.notesUpdatedAt || null);
          return;
        }

        if (evtName === 'eprescription:notice') {
          if (payload.notice) {
            setLatestRxNotice(payload.notice as RoomRxNotice);
          }
          if (payload.message) {
            const msg = payload.message as RoomChatMessage;
            setRoomMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
          }
          return;
        }

        if (evtName === 'call:ended') {
          if (payload.systemMessage) {
            const msg = payload.systemMessage as RoomChatMessage;
            setRoomMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
          }
          return;
        }

        // Serialized WebRTC Perfect Negotiation Signaling Handlers
        if (evtName === 'rtc:offer' && payload.fromSocketId && payload.sdp) {
          const remoteSid = String(payload.fromSocketId);
          const mySid = selfSocketIdRef.current || '';
          createOrGetPeerConnection(remoteSid);

          enqueuePeerTask(remoteSid, async () => {
            const pc = getActivePeerConnection(remoteSid);
            if (!pc) return;

            const fb = fallbackOfferTimersRef.current.get(remoteSid);
            if (fb) {
              clearTimeout(fb);
              fallbackOfferTimersRef.current.delete(remoteSid);
            }

            const polite = mySid > remoteSid;
            const offerCollision =
              Boolean(makingOfferRef.current.get(remoteSid)) || pc.signalingState !== 'stable';
            const ignoreOffer = !polite && offerCollision;
            ignoreOfferRef.current.set(remoteSid, ignoreOffer);

            if (ignoreOffer) {
              return;
            }

            try {
              if (offerCollision && pc.signalingState === 'have-local-offer') {
                await pc.setLocalDescription({ type: 'rollback' });
              }
              await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
              // Attach local tracks onto the offer's exact negotiated transceivers (never duplicate!)
              await syncLocalTracksToPeer(pc, false);
              await flushPendingIce(remoteSid, pc);

              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              if (pc.localDescription) {
                sendWsEvent('rtc:answer', {
                  roomId: roomIdRef.current,
                  targetSocketId: remoteSid,
                  sdp: {
                    type: pc.localDescription.type,
                    sdp: pc.localDescription.sdp,
                  },
                });
              }
            } catch {
              // ignore transient signaling error
            }
          });
          return;
        }

        if (evtName === 'rtc:answer' && payload.fromSocketId && payload.sdp) {
          const remoteSid = String(payload.fromSocketId);
          enqueuePeerTask(remoteSid, async () => {
            const pc = getActivePeerConnection(remoteSid);
            if (!pc || pc.signalingState !== 'have-local-offer') return;
            try {
              ignoreOfferRef.current.set(remoteSid, false);
              await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
              await flushPendingIce(remoteSid, pc);
            } catch {
              // ignore
            }
          });
          return;
        }

        if (evtName === 'rtc:ice-candidate' && payload.fromSocketId && payload.candidate) {
          const remoteSid = String(payload.fromSocketId);
          const cand = payload.candidate as RTCIceCandidateInit;
          const pc = getActivePeerConnection(remoteSid);

          // Buffer unconditionally even if PC isn't created yet!
          if (!pc) {
            const list = pendingIceRef.current.get(remoteSid) || [];
            list.push(cand);
            pendingIceRef.current.set(remoteSid, list);
            return;
          }

          enqueuePeerTask(remoteSid, async () => {
            const currentPc = getActivePeerConnection(remoteSid);
            if (!currentPc) return;
            if (ignoreOfferRef.current.get(remoteSid)) return;
            if (!currentPc.remoteDescription || !currentPc.remoteDescription.type) {
              const list = pendingIceRef.current.get(remoteSid) || [];
              list.push(cand);
              pendingIceRef.current.set(remoteSid, list);
            } else {
              await currentPc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
            }
          });
        }
      };

      ws.onclose = () => {
        if (unmounted) return;
        setWsStatus('reconnecting');
        const delay = Math.min(8000, 1000 * Math.pow(2, reconnectAttemptRef.current));
        reconnectAttemptRef.current += 1;
        reconnectTimerRef.current = setTimeout(connectSocket, delay);
      };

      ws.onerror = () => {
        // onclose will trigger backoff reconnect
      };
    };

    connectSocket();

    return () => {
      unmounted = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        try {
          if (wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ event: 'room:leave', payload: { roomId } }));
          }
          wsRef.current.onclose = null;
          wsRef.current.close();
        } catch {
          // ignore
        }
        wsRef.current = null;
      }
      closeAllPeerConnections(false);
      setWsStatus('disconnected');
    };
  }, [
    roomId,
    currentApt.id,
    currentUser.id,
    currentUser.name,
    currentUser.role,
    currentUser.specialty,
    closeAllPeerConnections,
    closePeerConnection,
    createOrGetPeerConnection,
    enqueuePeerTask,
    flushPendingIce,
    getActivePeerConnection,
    initiateOfferToPeer,
    sendWsEvent,
    syncLocalTracksToPeer,
  ]);

  // Listen for live E-Prescription creation events dispatched in-app so the room gets notified instantly
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      sendWsEvent('eprescription:issued', {
        roomId,
        rxId: detail.id,
        diagnosisSummary: detail.diagnosisSummary,
        medicinesCount: Array.isArray(detail.medicines) ? detail.medicines.length : 0,
        doctorName: detail.doctorName || currentUser.name,
      });
    };
    window.addEventListener('medassist:eprescription-issued', handler);
    return () => window.removeEventListener('medassist:eprescription-issued', handler);
  }, [roomId, currentUser.name, sendWsEvent]);

  // Auto-scroll chat history when new real-time messages arrive
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [roomMessages, activeSidebarTab]);

  // Call duration timer (ticks while in call)
  useEffect(() => {
    if (!inCall) {
      setElapsedSeconds(0);
      return;
    }
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [inCall]);

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  const handleSendRoomChat = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed) return;

    const msgId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const sent = sendWsEvent('chat:send', {
      roomId,
      id: msgId,
      text: trimmed,
    });

    if (sent) {
      setChatInput('');
    }
  };

  const handleNotesChange = (value: string) => {
    setClinicalNotes(value);
    setNotesUpdatedBy(currentUser.name);
    setNotesUpdatedAt(new Date().toISOString());

    if (notesDebounceRef.current) {
      clearTimeout(notesDebounceRef.current);
    }
    notesDebounceRef.current = setTimeout(() => {
      sendWsEvent('notes:update', {
        roomId,
        clinicalNotes: value,
      });
    }, 200);
  };

  const handleCopyInviteLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomId);
    navigator.clipboard?.writeText(url.toString()).catch(() => {});
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  const expectedRemoteName =
    currentUser.role === 'patient' ? currentApt.doctorName : currentApt.patientName;
  const expectedRemoteSubtitle =
    currentUser.role === 'patient'
      ? currentApt.doctorSpecialty
      : `Patient · Reported: ${currentApt.symptoms}`;

  const remoteDisplayName = primaryRemotePeer?.user.name || expectedRemoteName;
  const remoteDisplaySubtitle =
    primaryRemotePeer?.user.specialty || expectedRemoteSubtitle;

  const isBothConnected = Boolean(primaryRemotePeer);

  // Reusable Remote Stage Renderer (works cleanly in either Main Stage or PiP corner)
  const renderRemoteFeed = (isMainStage: boolean) => {
    return (
      <div className="relative w-full h-full bg-[#064734] flex flex-col items-center justify-center overflow-hidden">
        <video
          key={isMainStage ? 'remote-main-video' : 'remote-pip-video'}
          ref={(node) => {
            if (!node) return;
            remoteVideoRef.current = node;
            if (primaryRemoteStream && remoteHasLiveTrack && node.srcObject !== primaryRemoteStream) {
              node.srcObject = primaryRemoteStream;
              node.muted = true;
              node.play().catch(() => {});
            }
          }}
          onLoadedMetadata={(e) => {
            e.currentTarget.play().catch(() => {});
          }}
          onCanPlay={(e) => {
            e.currentTarget.play().catch(() => {});
          }}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover transition-opacity duration-200 ${
            remoteHasLiveVideo ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        />

        {/* Fallback avatar card when remote peer hasn't joined yet or has camera off */}
        {!remoteHasLiveVideo && (
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center text-center ${
              isMainStage ? 'p-6 bg-[#064734]' : 'p-2.5 bg-[#064734] group-hover:bg-[#085c44] transition-colors'
            }`}
          >
            <div
              className={`${
                isMainStage ? 'w-20 h-20 mb-3' : 'w-10 h-10 mb-1.5'
              } rounded-full bg-[var(--color-leaf)]/20 border border-[var(--color-leaf)] flex items-center justify-center text-[var(--color-leaf)]`}
            >
              {primaryRemotePeer?.user.role === 'doctor' ? (
                <Stethoscope className={isMainStage ? 'w-9 h-9' : 'w-5 h-5'} />
              ) : (
                <UserIcon className={isMainStage ? 'w-10 h-10' : 'w-5 h-5'} />
              )}
            </div>
            <div
              className={`${
                isMainStage ? 'text-base' : 'text-xs'
              } font-bold text-white truncate max-w-full`}
            >
              {remoteDisplayName}
            </div>
            <div
              className={`${
                isMainStage ? 'text-xs mt-0.5' : 'text-[10px]'
              } text-[var(--color-leaf)] font-medium truncate max-w-full`}
            >
              {remoteDisplaySubtitle}
            </div>
            {isMainStage ? (
              <div className="mt-3 text-[11px] font-semibold text-white bg-[#043224]/90 px-4 py-2 rounded-xl border border-white/20 flex items-center gap-2">
                {isBothConnected ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-leaf)]" />
                    <span>
                      Connected Live ·{' '}
                      {primaryRemotePeer?.cameraOn
                        ? `Negotiating Video (${rtcConnectionState})`
                        : 'Camera Off (Audio & Chat Active)'}
                    </span>
                  </>
                ) : (
                  <>
                    <Clock className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                    <span>
                      Waiting for {remoteDisplayName} to join Room {roomId}...
                    </span>
                  </>
                )}
              </div>
            ) : (
              <span className="mt-1.5 px-2 py-0.5 rounded-md bg-[#043224] text-[10px] font-semibold text-white/90 border border-white/15">
                {isBothConnected ? 'Live · Swap View' : 'Waiting · Swap View'}
              </span>
            )}
          </div>
        )}

        {/* Remote status overlay badge when main stage shows live remote video */}
        {isMainStage && isBothConnected && (
          <div className="absolute bottom-4 left-4 px-3.5 py-2 rounded-xl bg-[#043224]/90 border border-white/20 text-white text-xs flex items-center gap-2 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold">{remoteDisplayName}</span>
            <span className="text-[10px] text-[var(--color-leaf)] font-semibold">
              {primaryRemotePeer?.micOn ? 'Mic Active' : 'Mic Muted'}
            </span>
          </div>
        )}
      </div>
    );
  };

  // Reusable Self Stage Renderer (works cleanly in either Main Stage or PiP corner)
  const renderSelfFeed = (isMainStage: boolean) => {
    return (
      <div className="relative w-full h-full bg-[#032419] flex items-center justify-center overflow-hidden">
        <video
          key={isMainStage ? 'local-main-video' : 'local-pip-video'}
          ref={(node) => {
            if (!node) return;
            localVideoRef.current = node;
            if (mediaStreamRef.current && cameraStreamActive && node.srcObject !== mediaStreamRef.current) {
              node.srcObject = mediaStreamRef.current;
              node.muted = true;
              node.play().catch(() => {});
            }
          }}
          onLoadedMetadata={(e) => {
            e.currentTarget.play().catch(() => {});
          }}
          onCanPlay={(e) => {
            e.currentTarget.play().catch(() => {});
          }}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover transition-opacity duration-200 ${
            cameraOn && cameraStreamActive ? 'opacity-100' : 'opacity-0 pointer-events-none'
          } ${mirrorVideo ? '-scale-x-100' : ''}`}
        />

        {(!cameraOn || !cameraStreamActive) && (
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center text-center bg-[#043224] ${
              isMainStage ? 'p-6' : 'p-2'
            }`}
          >
            <div
              className={`${
                isMainStage ? 'w-20 h-20 mb-3 border-2' : 'w-9 h-9 mb-1 border'
              } rounded-full bg-[var(--color-leaf)]/20 border-[var(--color-leaf)] flex items-center justify-center text-[var(--color-leaf)]`}
            >
              <Camera className={isMainStage ? 'w-9 h-9' : 'w-4 h-4'} />
            </div>
            <div className={`${isMainStage ? 'text-base' : 'text-[11px]'} font-bold text-white truncate max-w-full`}>
              {cameraLoading
                ? 'Starting Media...'
                : !cameraOn
                ? 'Your Camera is Paused'
                : `You (${currentUser.name})`}
            </div>
            {isMainStage && (
              <>
                <p className="text-xs text-[var(--color-leaf)] mt-1 max-w-md">
                  {cameraLoading
                    ? 'Please allow camera/microphone access if prompted by your browser.'
                    : audioStreamActive
                    ? 'Microphone audio is live. Click below to retry webcam capture.'
                    : !cameraOn
                    ? 'Click "Start Video" below to resume your live video feed.'
                    : 'Click below to retry webcam access or continue with chat & audio.'}
                </p>
                {!cameraLoading && (
                  <button
                    type="button"
                    onClick={() => {
                      setCameraOn(true);
                      void startLocalMedia(true);
                    }}
                    className="mt-4 px-4 py-2 rounded-xl bg-[var(--color-leaf)] text-[var(--color-forest)] text-xs font-extrabold shadow-xs hover:bg-white transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Video className="w-4 h-4" />
                    <span>Enable Live Camera</span>
                  </button>
                )}
              </>
            )}
          </div>
        )}

        <div
          className={`absolute ${
            isMainStage
              ? 'bottom-4 left-4 px-3.5 py-2 rounded-xl text-xs'
              : 'bottom-1.5 left-2 px-2 py-0.5 rounded text-[10px]'
          } bg-[#043224]/90 border border-white/20 text-white flex items-center gap-2 shadow-sm`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              cameraOn && cameraStreamActive
                ? 'bg-[#E0FFC2] animate-pulse'
                : audioStreamActive && micOn
                ? 'bg-emerald-400'
                : 'bg-amber-400'
            }`}
          />
          <span className="font-bold">You ({currentUser.role === 'doctor' ? 'Doctor' : 'Patient'})</span>
          {isMainStage && (
            <span className="text-[10px] text-[var(--color-leaf)] font-semibold">
              {cameraOn && cameraStreamActive
                ? 'Live HD Video'
                : audioStreamActive
                ? 'Audio Only'
                : 'Standby'}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fade-slide-up space-y-6">
      {/* Hidden <audio> element for crisp two-way WebRTC remote audio */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* Consultation Room Selector & Live Presence Bar */}
      <div className="bg-white border border-[var(--color-leaf-border)] rounded-3xl shadow-xs p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-xs font-bold text-[var(--color-forest)]">
            Consultation Rooms:
          </span>
          {(availableAppointments.length > 0 ? availableAppointments : [fallbackInstantAppointment]).map(
            (apt) => (
              <button
                key={apt.id}
                type="button"
                onClick={() => {
                  onSelectAppointment(apt);
                  setShowCallSummary(false);
                  setInCall(true);
                }}
                className={`btn-hover-lift px-3.5 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                  currentApt.id === apt.id
                    ? 'bg-[var(--color-forest)] text-white border-[var(--color-forest)] shadow-2xs'
                    : 'bg-[var(--color-leaf-soft)] text-[var(--color-text-dark)] border-[var(--color-leaf-border)] hover:bg-[var(--color-leaf)]'
                }`}
              >
                {currentUser.role === 'patient' ? apt.doctorName : apt.patientName} · {apt.timeSlot}
              </button>
            )
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Real-time WebSocket & Peer Presence Indicator */}
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold tabular-nums border ${
              wsStatus === 'connected'
                ? isBothConnected
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                  : 'bg-[var(--color-leaf)] text-[var(--color-forest)] border-[var(--color-leaf-border)]'
                : 'bg-amber-50 text-amber-900 border-amber-300'
            }`}
          >
            {wsStatus === 'connected' ? (
              <Wifi className="w-3.5 h-3.5 text-emerald-700" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-amber-700" />
            )}
            <span>
              {wsStatus !== 'connected'
                ? 'Reconnecting Server...'
                : isBothConnected
                ? `Live: ${participants.length} in Room`
                : `Server Connected · Waiting for ${
                    currentUser.role === 'patient' ? 'Doctor' : 'Patient'
                  }`}
            </span>
          </span>

          <button
            type="button"
            onClick={handleCopyInviteLink}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--color-leaf-soft)] hover:bg-[var(--color-leaf)] border border-[var(--color-leaf-border)] text-xs font-bold text-[var(--color-forest)] cursor-pointer transition-colors"
            title="Copy direct room invite link to open in another tab or device"
          >
            {copiedInvite ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedInvite ? 'Room Link Copied' : `Room ${roomId}`}</span>
          </button>
        </div>
      </div>

      {/* Live E-Prescription Alert Banner (pushed in real time when doctor issues Rx) */}
      {latestRxNotice && (
        <div className="p-4 rounded-2xl bg-[var(--color-leaf)] border-2 border-[var(--color-forest)] text-xs text-[var(--color-forest)] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-[var(--color-forest)] shrink-0" />
            <div>
              <strong>
                Digital E-Prescription Issued ({latestRxNotice.rxId.toUpperCase()}) by{' '}
                {latestRxNotice.doctorName}
              </strong>
              <div className="text-[11px] text-[var(--color-text-dark)]">
                Diagnosis: {latestRxNotice.diagnosisSummary} · {latestRxNotice.medicinesCount}{' '}
                medication(s)
              </div>
            </div>
          </div>
          {onWriteEPrescription && (
            <button
              type="button"
              onClick={() => onWriteEPrescription(currentApt)}
              className="btn-forest-primary px-4 py-2 text-xs font-bold rounded-xl cursor-pointer"
            >
              Open E-Prescription
            </button>
          )}
        </div>
      )}

      {/* Non-blocking Peer Connection Recovery Notice */}
      {connectionRecoveryError && primaryRemotePeer && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <span>{connectionRecoveryError}</span>
          </div>
          <button
            type="button"
            onClick={() => reinitializePeerConnection(primaryRemotePeer.socketId, true)}
            className="btn-forest-primary inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl cursor-pointer shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reconnect Video</span>
          </button>
        </div>
      )}

      {/* Non-blocking Camera / Mic Notice */}
      {mediaNotice && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <span>{mediaNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setCameraOn(true);
              void startLocalMedia(true);
            }}
            className="btn-forest-primary inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl cursor-pointer shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Camera &amp; Mic</span>
          </button>
        </div>
      )}

      {/* Main Video Room Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
        {/* Left: Live Video Stage & Call Controls */}
        <div className="lg:col-span-8 bg-[#043224] rounded-2xl sm:rounded-3xl overflow-hidden border border-[var(--color-forest)] shadow-sm flex flex-col">
          {/* Top Call Bar */}
          <div className="px-3.5 sm:px-6 py-3 sm:py-4 bg-[var(--color-forest)] border-b border-white/15 flex flex-wrap items-center justify-between gap-2 text-xs text-white">
            <div className="flex items-center gap-2.5">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isBothConnected ? 'bg-emerald-400 animate-pulse' : 'bg-[#E0FFC2] animate-pulse'
                }`}
              />
              <span className="font-bold text-white">
                {currentUser.role === 'patient'
                  ? `Consultation with ${currentApt.doctorName} (${currentApt.doctorSpecialty})`
                  : `Consultation with Patient: ${currentApt.patientName}`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {inCall && (
                <>
                  <button
                    type="button"
                    onClick={() => setSelfInMainStage((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#043224] hover:bg-white/15 text-[var(--color-leaf)] border border-white/15 text-[11px] font-semibold cursor-pointer transition-colors"
                    title="Swap Main Video and Picture-in-Picture"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    <span>{selfInMainStage ? 'Main: You' : `Main: ${remoteDisplayName}`}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMirrorVideo((prev) => !prev)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#043224] hover:bg-white/15 text-white border border-white/15 text-[11px] font-semibold cursor-pointer transition-colors"
                    title="Flip/Mirror Your Camera Horizontally"
                  >
                    <FlipHorizontal className="w-3.5 h-3.5" />
                    <span>Mirror</span>
                  </button>
                </>
              )}
              <div className="tabular-nums text-[var(--color-leaf)] font-bold pl-1">
                {inCall ? `Live · ${formatDuration(elapsedSeconds)}` : 'Call Ended'}
              </div>
            </div>
          </div>

          {/* Active Participants Strip */}
          <div className="px-5 py-2 bg-[#032419] border-b border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/85">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[var(--color-leaf)] font-bold">
                <Users className="w-3.5 h-3.5" />
                <span>In Room:</span>
              </span>
              {participants.length === 0 ? (
                <span className="text-white/60">Connecting to room {roomId}...</span>
              ) : (
                participants.map((p) => (
                  <span
                    key={p.socketId}
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-white/10 border border-white/15 text-white"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="font-semibold">
                      {p.user.name}
                      {p.socketId === selfSocketId ? ' (You)' : ''}
                    </span>
                    <span className="text-[10px] text-[var(--color-leaf)] capitalize">
                      · {p.user.role}
                    </span>
                  </span>
                ))
              )}
            </div>
            <span className="text-[10px] text-white/60">
              {isBothConnected
                ? 'Two-way WebRTC + Live Sync Active'
                : 'Open Patient in Tab 1 & Doctor in Tab 2 to consult live'}
            </span>
          </div>

          {/* Video Stage */}
          <div className="relative h-[280px] sm:h-[380px] lg:h-[430px] xl:h-[480px] bg-[#043224] flex items-center justify-center overflow-hidden">
            {!inCall ? (
              showCallSummary ? (
                <div className="w-full max-w-lg mx-4 rounded-2xl bg-white text-[var(--color-text-dark)] p-6 shadow-xl border border-[var(--color-leaf-border)] space-y-4">
                  <div className="flex items-start justify-between gap-3 border-b border-[var(--color-leaf-border)] pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-[var(--color-leaf)] text-[var(--color-forest)] flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-[var(--color-forest)]">
                          Consultation Summary
                        </h3>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          Session completed with {remoteDisplayName}
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--color-leaf-soft)] border border-[var(--color-leaf-border)] text-xs font-semibold text-[var(--color-forest)] tabular-nums">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDuration(lastCallDurationSeconds)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-[var(--color-leaf-soft)] border border-[var(--color-leaf-border)]">
                      <div className="text-[11px] font-medium text-[var(--color-text-muted)]">
                        {currentUser.role === 'patient' ? 'Consulting Specialist' : 'Patient'}
                      </div>
                      <div className="font-bold text-[var(--color-forest)] mt-0.5">
                        {remoteDisplayName}
                      </div>
                      <div className="text-[11px] text-[var(--color-text-dark)]">
                        {currentUser.role === 'patient'
                          ? currentApt.doctorSpecialty
                          : currentApt.patientEmail}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-[var(--color-leaf-soft)] border border-[var(--color-leaf-border)]">
                      <div className="text-[11px] font-medium text-[var(--color-text-muted)]">
                        Consultation Date &amp; Room
                      </div>
                      <div className="font-bold text-[var(--color-forest)] tabular-nums mt-0.5">
                        {currentApt.date} · {currentApt.timeSlot}
                      </div>
                      <div className="text-[11px] text-[var(--color-text-dark)]">Room {roomId}</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[var(--color-leaf-soft)] border border-[var(--color-leaf-border)] text-xs space-y-1">
                    <div>
                      <span className="font-bold text-[var(--color-forest)]">Chief Complaint: </span>
                      <span>{currentApt.symptoms}</span>
                    </div>
                    {clinicalNotes.trim() && (
                      <div>
                        <span className="font-bold text-[var(--color-forest)]">
                          Shared Consult Notes:{' '}
                        </span>
                        <span>{clinicalNotes}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCallSummary(false);
                        setInCall(true);
                        setCameraOn(true);
                        sendWsEvent('call:rejoin', { roomId });
                      }}
                      className="btn-forest-secondary inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl cursor-pointer"
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>Rejoin Video Room</span>
                    </button>
                    {onWriteEPrescription && (
                      <button
                        type="button"
                        onClick={() => onWriteEPrescription(currentApt)}
                        className="btn-forest-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>
                          {currentUser.role === 'doctor'
                            ? 'Issue E-Prescription'
                            : 'View E-Prescription'}
                        </span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onExitCall}
                      className="px-4 py-2 text-xs font-semibold rounded-xl border border-[var(--color-leaf-border)] text-[var(--color-text-dark)] hover:bg-[var(--color-leaf-soft)] cursor-pointer"
                    >
                      Back to Appointments
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-4 max-w-md p-6">
                  <div className="w-16 h-16 rounded-2xl bg-[var(--color-forest)] border border-[var(--color-leaf-border)] text-[var(--color-leaf)] flex items-center justify-center mx-auto">
                    <Video className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-white">
                    Rejoin Consultation Room {roomId}?
                  </h3>
                  <p className="text-xs text-white/85 leading-relaxed">
                    Click below to restart your live video and microphone connection.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCallSummary(false);
                      setInCall(true);
                      setCameraOn(true);
                    }}
                    className="btn-hover-lift px-6 py-3 bg-[var(--color-leaf)] hover:bg-white text-[var(--color-forest)] text-xs font-extrabold rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    Start Live Video Consultation
                  </button>
                </div>
              )
            ) : (
              <>
                {/* MAIN VIDEO STAGE */}
                {selfInMainStage ? renderSelfFeed(true) : renderRemoteFeed(true)}

                {/* PICTURE-IN-PICTURE (PiP) CORNER OVERLAY (Click to Swap) */}
                <div
                  onClick={() => setSelfInMainStage((prev) => !prev)}
                  title="Click to swap main stage and Picture-in-Picture"
                  className="absolute bottom-2.5 right-2.5 sm:bottom-4 sm:right-4 w-28 h-20 sm:w-44 sm:h-28 lg:w-52 lg:h-36 rounded-xl sm:rounded-2xl bg-[#043224] border-2 border-[var(--color-leaf)]/60 overflow-hidden flex flex-col items-center justify-center shadow-lg cursor-pointer group"
                >
                  {selfInMainStage ? renderRemoteFeed(false) : renderSelfFeed(false)}
                </div>
              </>
            )}
          </div>

          {/* Bottom Control Bar */}
          <div className="px-3.5 sm:px-6 py-3 sm:py-4 bg-[var(--color-forest)] border-t border-white/15 flex flex-wrap items-center justify-between gap-3 sm:gap-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setMicOn(!micOn)}
                className={`btn-hover-lift inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  micOn
                    ? 'bg-[#043224] text-white border border-white/20 hover:bg-white/15'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                <span>{micOn ? 'Mute Mic' : 'Unmute Mic'}</span>
              </button>

              <button
                type="button"
                onClick={() => setCameraOn(!cameraOn)}
                className={`btn-hover-lift inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  cameraOn
                    ? 'bg-[#043224] text-white border border-white/20 hover:bg-white/15'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {cameraOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                <span>{cameraOn ? 'Stop Video' : 'Start Video'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCameraOn(true);
                  void startLocalMedia(true);
                }}
                className="btn-hover-lift inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#043224] text-[var(--color-leaf)] border border-white/20 hover:bg-white/15 transition-all cursor-pointer"
                title="Refresh Camera & Microphone Stream"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${cameraLoading ? 'animate-spin' : ''}`} />
                <span>Refresh Media</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {onWriteEPrescription && (
                <button
                  type="button"
                  onClick={() => onWriteEPrescription(currentApt)}
                  className="btn-hover-lift inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--color-leaf)] hover:bg-white text-[var(--color-forest)] text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  <FilePlus className="w-4 h-4" />
                  <span>
                    {currentUser.role === 'doctor'
                      ? `Write E-Prescription for ${currentApt.patientName}`
                      : 'View / Download E-Prescription'}
                  </span>
                </button>
              )}

              {inCall && (
                <button
                  type="button"
                  onClick={() => {
                    setLastCallDurationSeconds(elapsedSeconds);
                    sendWsEvent('call:end', { roomId, durationSeconds: elapsedSeconds });
                    stopLocalMedia();
                    setInCall(false);
                    setShowCallSummary(true);
                  }}
                  className="btn-hover-lift inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer"
                >
                  <PhoneOff className="w-4 h-4" />
                  <span>End Call &amp; View Summary</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right: Real-Time Room Chat & Live Shared Clinical Notes */}
        <div className="lg:col-span-4 bg-white border border-[var(--color-leaf-border)] rounded-2xl sm:rounded-3xl shadow-xs flex flex-col h-[440px] sm:h-[500px] lg:h-[595px] xl:h-[640px] overflow-hidden">
          <div className="p-4 border-b border-[var(--color-leaf-border)] bg-[var(--color-leaf-soft)] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[var(--color-forest)]">
                <ShieldCheck className="w-4 h-4 text-[var(--color-forest)]" />
                <span>Live Consultation Workspace</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-[var(--color-leaf-border)] text-[var(--color-forest)]">
                {wsStatus === 'connected' ? 'Synced' : 'Offline'}
              </span>
            </div>

            <p className="text-[11px] text-[var(--color-text-dark)]">
              Chief Complaint: {currentApt.symptoms}
            </p>

            {/* Chat vs Shared Notes Switcher */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-white rounded-xl border border-[var(--color-leaf-border)]">
              <button
                type="button"
                onClick={() => setActiveSidebarTab('chat')}
                className={`inline-flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeSidebarTab === 'chat'
                    ? 'bg-[var(--color-forest)] text-white shadow-2xs'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-forest)]'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Live Chat ({roomMessages.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSidebarTab('notes')}
                className={`inline-flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeSidebarTab === 'notes'
                    ? 'bg-[var(--color-forest)] text-white shadow-2xs'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-forest)]'
                }`}
              >
                <ClipboardEdit className="w-3.5 h-3.5" />
                <span>Shared Notes</span>
              </button>
            </div>
          </div>

          {activeSidebarTab === 'chat' ? (
            <>
              <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {roomMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-2 text-xs text-[var(--color-text-muted)]">
                    <MessageSquare className="w-7 h-7 text-[var(--color-forest)]/40" />
                    <p>
                      Connected to room <strong>{roomId}</strong>. Messages sent here appear
                      instantly for both doctor and patient.
                    </p>
                  </div>
                ) : (
                  roomMessages.map((m) => {
                    const isMe = m.senderId === currentUser.id && m.senderRole !== 'system';
                    const timeLabel = new Date(m.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <div
                        key={m.id}
                        className={`p-3.5 rounded-2xl text-xs ${
                          m.kind === 'eprescription'
                            ? 'bg-[var(--color-leaf)] text-[var(--color-forest)] border-2 border-[var(--color-forest)] font-semibold'
                            : m.senderRole === 'system'
                            ? 'bg-[var(--color-leaf-soft)] text-[var(--color-text-muted)] border border-[var(--color-leaf-border)]'
                            : isMe
                            ? 'bg-[var(--color-forest)] text-white ml-4 rounded-br-md'
                            : 'bg-[var(--color-leaf)]/60 border border-[var(--color-leaf-border)] text-[var(--color-text-dark)] mr-4 rounded-bl-md'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] opacity-80 mb-1 tabular-nums">
                          <span className="font-semibold">
                            {m.senderName}
                            {m.senderRole === 'doctor'
                              ? ' · Doctor'
                              : m.senderRole === 'patient'
                              ? ' · Patient'
                              : ''}
                          </span>
                          <span>{timeLabel}</span>
                        </div>
                        <p className="leading-relaxed break-words">{m.text}</p>
                      </div>
                    );
                  })
                )}
              </div>

              <form
                onSubmit={handleSendRoomChat}
                className="p-3.5 border-t border-[var(--color-leaf-border)] flex items-center gap-2 bg-white"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={wsStatus !== 'connected'}
                  placeholder={
                    wsStatus === 'connected'
                      ? 'Send live message to room...'
                      : 'Connecting to room...'
                  }
                  className="flex-1 px-3.5 py-2.5 text-xs bg-white border border-[var(--color-leaf-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-forest)] disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={wsStatus !== 'connected' || !chatInput.trim()}
                  className="btn-forest-primary p-2.5 rounded-xl cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col p-4 space-y-3">
              <div className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
                Real-time collaborative consultation pad synced between{' '}
                <strong>{currentApt.doctorName}</strong> and{' '}
                <strong>{currentApt.patientName}</strong>.
              </div>
              <textarea
                value={clinicalNotes}
                onChange={(e) => handleNotesChange(e.target.value)}
                placeholder="Type clinical observations, vitals discussed, or care instructions here — updates sync live for both participants..."
                className="flex-1 w-full p-3.5 text-xs bg-[var(--color-leaf-soft)]/50 border border-[var(--color-leaf-border)] rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-forest)] leading-relaxed"
              />
              <div className="text-[10px] text-[var(--color-text-muted)] flex items-center justify-between tabular-nums">
                <span>
                  {notesUpdatedBy ? `Last updated by ${notesUpdatedBy}` : 'No shared notes yet'}
                </span>
                {notesUpdatedAt && (
                  <span>
                    {new Date(notesUpdatedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
