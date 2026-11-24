import type { Server as HttpServer, IncomingMessage } from 'http';
import crypto from 'crypto';
import { WebSocketServer, WebSocket, RawData } from 'ws';
import {
  extractSessionTokenFromHeaders,
  verifySessionTokenWithSecret,
  lookupUserById,
  canUserAccessRoom,
} from './nodeFallback';

export type ConsultUserRole = 'patient' | 'doctor' | 'admin';

export interface RoomUserInfo {
  id: string;
  name: string;
  role: ConsultUserRole;
  specialty?: string;
}

export interface RoomParticipant {
  socketId: string;
  clientInstanceId: string;
  user: RoomUserInfo;
  cameraOn: boolean;
  micOn: boolean;
  hasVideoTrack: boolean;
  hasAudioTrack: boolean;
  joinedAt: string;
}

export interface RoomChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: ConsultUserRole | 'system';
  text: string;
  timestamp: string;
  kind?: 'chat' | 'system' | 'eprescription';
}

export interface RoomRxNotice {
  rxId: string;
  diagnosisSummary: string;
  medicinesCount: number;
  doctorName: string;
  issuedAt: string;
}

interface AuthenticatedWsUser {
  id: string;
  name: string;
  role: ConsultUserRole;
  specialty?: string;
  approved?: boolean;
}

interface ConnectedSocketMeta {
  socketId: string;
  ws: WebSocket;
  authUser: AuthenticatedWsUser | null;
  roomId: string | null;
  clientInstanceId: string | null;
  subscribedUserId: string | null;
  isAlive: boolean;
  authTimeout?: ReturnType<typeof setTimeout>;
}

interface ConsultationRoom {
  roomId: string;
  appointmentId: string;
  participants: Map<string, RoomParticipant>; // keyed by socketId
  sockets: Map<string, WebSocket>; // keyed by socketId
  messages: RoomChatMessage[];
  seenMessageIds: Set<string>;
  clinicalNotes: string;
  notesUpdatedBy: string | null;
  notesUpdatedAt: string | null;
  callStatus: 'waiting' | 'active' | 'ended';
  startedAt: string | null;
  endedAt: string | null;
  latestRxNotice: RoomRxNotice | null;
}

const MAX_ROOM_MESSAGES = 250;
const AUTH_HANDSHAKE_TIMEOUT_MS = 6000;

function normalizeRoomId(raw: unknown): string {
  const cleaned = String(raw || '').trim().toUpperCase();
  return cleaned || 'MED-ROOM-LIVE';
}

function safeSend(ws: WebSocket, event: string, payload: Record<string, unknown>) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ event, payload }));
  }
}

function resolveAuthenticatedUserFromToken(
  token: string | null | undefined,
  sessionSecret: string
): AuthenticatedWsUser | null {
  const userId = verifySessionTokenWithSecret(token, sessionSecret);
  if (!userId) return null;
  const user = lookupUserById(userId);
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    specialty: user.specialty,
    approved: user.approved,
  };
}

export function attachConsultationWebSocket(
  httpServer: HttpServer,
  options?: { sessionSecret?: string }
) {
  const sessionSecret =
    options?.sessionSecret ||
    process.env.SESSION_SECRET?.trim() ||
    crypto.randomBytes(32).toString('hex');

  const wss = new WebSocketServer({ noServer: true, maxPayload: 128 * 1024 });
  const rooms = new Map<string, ConsultationRoom>();
  const socketMetas = new Map<WebSocket, ConnectedSocketMeta>();
  const userSubscribers = new Map<string, Set<WebSocket>>();

  const removeUserSubscription = (meta: ConnectedSocketMeta) => {
    if (!meta.subscribedUserId) return;
    const set = userSubscribers.get(meta.subscribedUserId);
    if (set) {
      set.delete(meta.ws);
      if (set.size === 0) {
        userSubscribers.delete(meta.subscribedUserId);
      }
    }
    meta.subscribedUserId = null;
  };

  const getOrCreateRoom = (roomId: string, appointmentId = 'DIRECT-CONSULT'): ConsultationRoom => {
    let room = rooms.get(roomId);
    if (!room) {
      room = {
        roomId,
        appointmentId,
        participants: new Map(),
        sockets: new Map(),
        messages: [],
        seenMessageIds: new Set(),
        clinicalNotes: '',
        notesUpdatedBy: null,
        notesUpdatedAt: null,
        callStatus: 'waiting',
        startedAt: null,
        endedAt: null,
        latestRxNotice: null,
      };
      rooms.set(roomId, room);
    } else if (appointmentId && appointmentId !== 'DIRECT-CONSULT') {
      room.appointmentId = appointmentId;
    }
    return room;
  };

  const serializeParticipants = (room: ConsultationRoom): RoomParticipant[] => {
    return Array.from(room.participants.values());
  };

  const broadcastToRoom = (
    room: ConsultationRoom,
    event: string,
    payload: Record<string, unknown>,
    excludeSocketId?: string
  ) => {
    for (const [sid, clientWs] of room.sockets.entries()) {
      if (excludeSocketId && sid === excludeSocketId) continue;
      safeSend(clientWs, event, payload);
    }
  };

  const appendSystemMessage = (room: ConsultationRoom, text: string) => {
    const msg: RoomChatMessage = {
      id: `sys-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      senderId: 'system',
      senderName: 'System',
      senderRole: 'system',
      text,
      timestamp: new Date().toISOString(),
      kind: 'system',
    };
    room.messages.push(msg);
    if (room.messages.length > MAX_ROOM_MESSAGES) {
      room.messages = room.messages.slice(-MAX_ROOM_MESSAGES);
    }
    room.seenMessageIds.add(msg.id);
    return msg;
  };

  const removeParticipantFromRoom = (
    meta: ConnectedSocketMeta,
    reason: 'left' | 'disconnected' = 'left'
  ) => {
    if (!meta.roomId) return;
    const room = rooms.get(meta.roomId);
    if (!room) {
      meta.roomId = null;
      return;
    }

    const participant = room.participants.get(meta.socketId);
    room.participants.delete(meta.socketId);
    room.sockets.delete(meta.socketId);

    const remainingParticipants = serializeParticipants(room);
    if (remainingParticipants.length < 2 && room.callStatus === 'active') {
      room.callStatus = 'waiting';
    }

    if (participant) {
      const sysMsg = appendSystemMessage(
        room,
        `${participant.user.name} (${participant.user.role === 'doctor' ? 'Doctor' : 'Patient'}) ${
          reason === 'left' ? 'left' : 'disconnected from'
        } the consultation room.`
      );
      broadcastToRoom(room, 'presence:left', {
        roomId: room.roomId,
        socketId: meta.socketId,
        user: participant.user,
        participants: remainingParticipants,
        callStatus: room.callStatus,
        systemMessage: sysMsg,
      });
    }

    meta.roomId = null;

    if (
      room.participants.size === 0 &&
      room.messages.length === 0 &&
      !room.clinicalNotes.trim()
    ) {
      rooms.delete(room.roomId);
    }
  };

  httpServer.on('upgrade', (request: IncomingMessage, socket, head) => {
    try {
      const host = request.headers.host || 'localhost:3000';
      const parsedUrl = new URL(request.url || '/', `http://${host}`);
      if (parsedUrl.pathname !== '/ws/consultation') {
        return;
      }

      // Cross-site WebSocket hijacking guard: if Origin header is present, require matching host
      const originHeader = request.headers.origin;
      if (originHeader) {
        try {
          const originHost = new URL(originHeader).host.toLowerCase();
          const expectedHost = String(
            request.headers['x-forwarded-host'] || request.headers.host || ''
          )
            .split(',')[0]
            .trim()
            .toLowerCase();
          if (expectedHost && originHost !== expectedHost) {
            socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
            socket.destroy();
            return;
          }
        } catch {
          socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
          socket.destroy();
          return;
        }
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } catch {
      socket.destroy();
    }
  });

  wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
    const socketId = `sock-${crypto.randomUUID()}`;
    const upgradeToken = extractSessionTokenFromHeaders(request?.headers || {});
    const initialAuthUser = resolveAuthenticatedUserFromToken(upgradeToken, sessionSecret);

    const meta: ConnectedSocketMeta = {
      socketId,
      ws,
      authUser: initialAuthUser,
      roomId: null,
      clientInstanceId: null,
      subscribedUserId: null,
      isAlive: true,
    };

    if (!meta.authUser) {
      meta.authTimeout = setTimeout(() => {
        if (!meta.authUser) {
          safeSend(ws, 'error', { code: 'UNAUTHORIZED', message: 'Authentication required.' });
          try {
            ws.close(4401, 'Unauthorized');
          } catch {
            // ignore
          }
        }
      }, AUTH_HANDSHAKE_TIMEOUT_MS);
    }

    socketMetas.set(ws, meta);

    ws.on('pong', () => {
      meta.isAlive = true;
    });

    ws.on('message', (raw: RawData) => {
      let parsed: { event?: string; payload?: Record<string, any> } | null = null;
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        safeSend(ws, 'error', { code: 'INVALID_JSON', message: 'Invalid WebSocket JSON payload.' });
        return;
      }

      if (!parsed || typeof parsed.event !== 'string') {
        safeSend(ws, 'error', { code: 'INVALID_EVENT', message: 'Missing WebSocket event name.' });
        return;
      }

      const event = parsed.event;
      const payload = parsed.payload || {};

      if (event === 'ping') {
        safeSend(ws, 'pong', { serverTime: new Date().toISOString() });
        return;
      }

      // Allow explicit token handshake when third-party cookies are blocked in an iframe
      if (event === 'auth:authenticate') {
        const token = typeof payload.token === 'string' ? payload.token : null;
        const verified = resolveAuthenticatedUserFromToken(token, sessionSecret);
        if (!verified) {
          safeSend(ws, 'error', { code: 'UNAUTHORIZED', message: 'Invalid session token.' });
          try {
            ws.close(4401, 'Unauthorized');
          } catch {
            // ignore
          }
          return;
        }
        meta.authUser = verified;
        if (meta.authTimeout) {
          clearTimeout(meta.authTimeout);
          meta.authTimeout = undefined;
        }
        safeSend(ws, 'auth:ok', { userId: verified.id, role: verified.role });
        return;
      }

      // Reject all operational events until the socket has a verified user session
      if (!meta.authUser) {
        safeSend(ws, 'error', {
          code: 'UNAUTHORIZED',
          message: 'Please sign in before connecting to live consultation channels.',
        });
        return;
      }

      if (event === 'user:subscribe') {
        const requestedUserId = String(payload.userId || meta.authUser.id).trim();
        if (requestedUserId !== meta.authUser.id) {
          safeSend(ws, 'error', {
            code: 'FORBIDDEN',
            message: 'You can only subscribe to your own real-time notifications.',
          });
          return;
        }
        const userId = meta.authUser.id;
        if (meta.subscribedUserId && meta.subscribedUserId !== userId) {
          removeUserSubscription(meta);
        }
        meta.subscribedUserId = userId;
        let set = userSubscribers.get(userId);
        if (!set) {
          set = new Set();
          userSubscribers.set(userId, set);
        }
        set.add(ws);
        safeSend(ws, 'user:subscribed', { userId });
        return;
      }

      if (event === 'room:join') {
        const targetRoomId = normalizeRoomId(payload.roomId);

        // Verify the authenticated user is authorized for this appointment room
        if (!canUserAccessRoom(meta.authUser.id, meta.authUser.role, targetRoomId)) {
          safeSend(ws, 'error', {
            code: 'FORBIDDEN',
            message: 'You are not authorized to join this consultation room.',
          });
          return;
        }

        // Always derive identity from the server-verified user record — never trust client payload.user
        const user: RoomUserInfo = {
          id: meta.authUser.id,
          name: meta.authUser.name,
          role: meta.authUser.role,
          specialty: meta.authUser.specialty,
        };
        const clientInstanceId = String(payload.clientInstanceId || socketId).slice(0, 120);
        meta.clientInstanceId = clientInstanceId;

        if (meta.roomId && meta.roomId !== targetRoomId) {
          removeParticipantFromRoom(meta, 'left');
        }

        const room = getOrCreateRoom(targetRoomId, String(payload.appointmentId || 'DIRECT-CONSULT'));

        for (const [existingSid, existingParticipant] of Array.from(room.participants.entries())) {
          const isSameTab = existingParticipant.clientInstanceId === clientInstanceId;
          const isSameUserRole =
            existingParticipant.user.id === user.id && existingParticipant.user.role === user.role;

          if (existingSid !== socketId && (isSameTab || isSameUserRole)) {
            const oldWs = room.sockets.get(existingSid);
            room.participants.delete(existingSid);
            room.sockets.delete(existingSid);
            if (oldWs && oldWs !== ws) {
              const oldMeta = socketMetas.get(oldWs);
              if (oldMeta) oldMeta.roomId = null;
              try {
                oldWs.close(4001, 'Replaced by reconnected session');
              } catch {
                // ignore
              }
            }
            broadcastToRoom(
              room,
              'presence:left',
              {
                roomId: room.roomId,
                socketId: existingSid,
                user: existingParticipant.user,
                participants: serializeParticipants(room),
                callStatus: room.callStatus,
              },
              socketId
            );
          }
        }

        const media = payload.media || {};
        const participant: RoomParticipant = {
          socketId,
          clientInstanceId,
          user,
          cameraOn: Boolean(media.cameraOn),
          micOn: Boolean(media.micOn),
          hasVideoTrack: Boolean(media.hasVideoTrack),
          hasAudioTrack: Boolean(media.hasAudioTrack),
          joinedAt: new Date().toISOString(),
        };

        const alreadyPresent = room.participants.has(socketId);
        meta.roomId = targetRoomId;
        room.participants.set(socketId, participant);
        room.sockets.set(socketId, ws);

        const participantsList = serializeParticipants(room);
        const hasDoctor = participantsList.some((p) => p.user.role === 'doctor');
        const hasPatient = participantsList.some((p) => p.user.role === 'patient');
        if (participantsList.length >= 2 || (hasDoctor && hasPatient)) {
          room.callStatus = 'active';
          if (!room.startedAt) {
            room.startedAt = new Date().toISOString();
          }
          room.endedAt = null;
        } else if (room.callStatus === 'ended') {
          room.callStatus = 'waiting';
          room.endedAt = null;
        }

        let joinSysMsg: RoomChatMessage | null = null;
        if (!alreadyPresent) {
          joinSysMsg = appendSystemMessage(
            room,
            `${user.name} (${user.role === 'doctor' ? 'Doctor' : 'Patient'}) joined consultation room ${room.roomId}.`
          );
        }

        safeSend(ws, 'room:sync', {
          roomId: room.roomId,
          selfSocketId: socketId,
          participants: participantsList,
          messages: room.messages,
          clinicalNotes: room.clinicalNotes,
          notesUpdatedBy: room.notesUpdatedBy,
          notesUpdatedAt: room.notesUpdatedAt,
          callStatus: room.callStatus,
          startedAt: room.startedAt,
          endedAt: room.endedAt,
          latestRxNotice: room.latestRxNotice,
        });

        broadcastToRoom(
          room,
          'presence:joined',
          {
            roomId: room.roomId,
            participant,
            participants: participantsList,
            callStatus: room.callStatus,
            startedAt: room.startedAt,
            systemMessage: joinSysMsg,
          },
          socketId
        );
        return;
      }

      if (event === 'room:leave') {
        removeParticipantFromRoom(meta, 'left');
        return;
      }

      if (!meta.roomId) {
        safeSend(ws, 'error', { code: 'NOT_IN_ROOM', message: 'Join a consultation room first.' });
        return;
      }
      const room = rooms.get(meta.roomId);
      const participant = room?.participants.get(socketId);
      if (!room || !participant) {
        safeSend(ws, 'error', { code: 'ROOM_NOT_FOUND', message: 'Active room session not found.' });
        return;
      }

      if (event === 'chat:send') {
        const text = String(payload.text || '').trim();
        if (!text) return;

        const messageId = String(
          payload.id || `msg-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`
        ).slice(0, 100);
        if (room.seenMessageIds.has(messageId)) {
          return;
        }
        room.seenMessageIds.add(messageId);

        const message: RoomChatMessage = {
          id: messageId,
          senderId: participant.user.id,
          senderName: participant.user.name,
          senderRole: participant.user.role,
          text: text.slice(0, 2000),
          timestamp: new Date().toISOString(),
          kind: 'chat',
        };
        room.messages.push(message);
        if (room.messages.length > MAX_ROOM_MESSAGES) {
          room.messages = room.messages.slice(-MAX_ROOM_MESSAGES);
        }

        broadcastToRoom(room, 'chat:message', {
          roomId: room.roomId,
          message,
        });
        return;
      }

      if (event === 'media:state') {
        if (typeof payload.cameraOn === 'boolean') participant.cameraOn = payload.cameraOn;
        if (typeof payload.micOn === 'boolean') participant.micOn = payload.micOn;
        if (typeof payload.hasVideoTrack === 'boolean') participant.hasVideoTrack = payload.hasVideoTrack;
        if (typeof payload.hasAudioTrack === 'boolean') participant.hasAudioTrack = payload.hasAudioTrack;

        broadcastToRoom(room, 'media:updated', {
          roomId: room.roomId,
          socketId,
          cameraOn: participant.cameraOn,
          micOn: participant.micOn,
          hasVideoTrack: participant.hasVideoTrack,
          hasAudioTrack: participant.hasAudioTrack,
          participants: serializeParticipants(room),
        });
        return;
      }

      if (event === 'notes:update') {
        const canEditNotes =
          (meta.authUser.role === 'doctor' && Boolean(meta.authUser.approved)) ||
          meta.authUser.role === 'admin';
        if (!canEditNotes) {
          safeSend(ws, 'error', {
            code: 'FORBIDDEN',
            message: 'Only approved doctors can update clinical consultation notes.',
          });
          return;
        }
        const clinicalNotes = String(payload.clinicalNotes ?? '').slice(0, 8000);
        room.clinicalNotes = clinicalNotes;
        room.notesUpdatedBy = participant.user.name;
        room.notesUpdatedAt = new Date().toISOString();

        broadcastToRoom(
          room,
          'notes:updated',
          {
            roomId: room.roomId,
            clinicalNotes: room.clinicalNotes,
            notesUpdatedBy: room.notesUpdatedBy,
            notesUpdatedAt: room.notesUpdatedAt,
          },
          socketId
        );
        return;
      }

      if (event === 'eprescription:issued') {
        const canIssueRx =
          (meta.authUser.role === 'doctor' && Boolean(meta.authUser.approved)) ||
          meta.authUser.role === 'admin';
        if (!canIssueRx) {
          safeSend(ws, 'error', {
            code: 'FORBIDDEN',
            message: 'Only approved doctors can broadcast e-prescription notices.',
          });
          return;
        }
        const notice: RoomRxNotice = {
          rxId: String(payload.rxId || `erx-${Date.now()}`).slice(0, 80),
          diagnosisSummary: String(
            payload.diagnosisSummary || 'Clinical Consultation E-Prescription'
          ).slice(0, 300),
          medicinesCount: Math.max(0, Math.min(50, Number(payload.medicinesCount || 0) || 0)),
          doctorName: participant.user.name,
          issuedAt: new Date().toISOString(),
        };
        room.latestRxNotice = notice;
        const rxMsg: RoomChatMessage = {
          id: `rx-msg-${notice.rxId}`,
          senderId: participant.user.id,
          senderName: notice.doctorName,
          senderRole: 'doctor',
          text: `Issued Digital E-Prescription (${notice.rxId.toUpperCase()}): ${notice.diagnosisSummary} (${notice.medicinesCount} medication${
            notice.medicinesCount === 1 ? '' : 's'
          }).`,
          timestamp: notice.issuedAt,
          kind: 'eprescription',
        };
        if (!room.seenMessageIds.has(rxMsg.id)) {
          room.seenMessageIds.add(rxMsg.id);
          room.messages.push(rxMsg);
          if (room.messages.length > MAX_ROOM_MESSAGES) {
            room.messages = room.messages.slice(-MAX_ROOM_MESSAGES);
          }
        }
        broadcastToRoom(room, 'eprescription:notice', {
          roomId: room.roomId,
          notice,
          message: rxMsg,
        });
        return;
      }

      if (event === 'call:end') {
        room.callStatus = 'ended';
        room.endedAt = new Date().toISOString();
        const durationSeconds = Number(payload.durationSeconds || 0);
        const sysMsg = appendSystemMessage(
          room,
          `${participant.user.name} ended the consultation session.`
        );
        broadcastToRoom(room, 'call:ended', {
          roomId: room.roomId,
          endedBy: participant.user,
          durationSeconds,
          endedAt: room.endedAt,
          systemMessage: sysMsg,
        });
        return;
      }

      if (event === 'call:rejoin') {
        room.callStatus = room.participants.size >= 2 ? 'active' : 'waiting';
        room.endedAt = null;
        if (!room.startedAt && room.callStatus === 'active') {
          room.startedAt = new Date().toISOString();
        }
        safeSend(ws, 'room:sync', {
          roomId: room.roomId,
          selfSocketId: socketId,
          participants: serializeParticipants(room),
          messages: room.messages,
          clinicalNotes: room.clinicalNotes,
          notesUpdatedBy: room.notesUpdatedBy,
          notesUpdatedAt: room.notesUpdatedAt,
          callStatus: room.callStatus,
          startedAt: room.startedAt,
          endedAt: room.endedAt,
          latestRxNotice: room.latestRxNotice,
        });
        return;
      }

      if (
        event === 'rtc:ready' ||
        event === 'rtc:offer' ||
        event === 'rtc:answer' ||
        event === 'rtc:ice-candidate'
      ) {
        const targetSocketId = payload.targetSocketId ? String(payload.targetSocketId) : null;
        const forwardPayload: Record<string, unknown> = {
          roomId: room.roomId,
          fromSocketId: socketId,
          fromUser: participant.user,
        };
        if (payload.sdp !== undefined) forwardPayload.sdp = payload.sdp;
        if (payload.candidate !== undefined) forwardPayload.candidate = payload.candidate;

        if (targetSocketId) {
          const targetWs = room.sockets.get(targetSocketId);
          if (targetWs) {
            safeSend(targetWs, event, forwardPayload);
          }
        } else {
          broadcastToRoom(room, event, forwardPayload, socketId);
        }
        return;
      }
    });

    const cleanupSocket = () => {
      if (meta.authTimeout) {
        clearTimeout(meta.authTimeout);
        meta.authTimeout = undefined;
      }
      removeParticipantFromRoom(meta, 'disconnected');
      removeUserSubscription(meta);
      socketMetas.delete(ws);
    };

    ws.on('close', cleanupSocket);
    ws.on('error', cleanupSocket);
  });

  const heartbeatInterval = setInterval(() => {
    for (const [ws, meta] of socketMetas.entries()) {
      if (!meta.isAlive) {
        try {
          ws.terminate();
        } catch {
          // ignore
        }
        if (meta.authTimeout) {
          clearTimeout(meta.authTimeout);
          meta.authTimeout = undefined;
        }
        removeParticipantFromRoom(meta, 'disconnected');
        removeUserSubscription(meta);
        socketMetas.delete(ws);
        continue;
      }
      meta.isAlive = false;
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }
  }, 25000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  const broadcastRxNoticeToRoom = (
    rawRoomId: string,
    payload: {
      rxId: string;
      diagnosisSummary: string;
      medicinesCount: number;
      doctorName: string;
    }
  ) => {
    const targetRoomId = normalizeRoomId(rawRoomId);
    const room = getOrCreateRoom(targetRoomId);
    const notice: RoomRxNotice = {
      rxId: String(payload.rxId || `erx-${Date.now()}`),
      diagnosisSummary: String(payload.diagnosisSummary || 'Clinical Consultation E-Prescription'),
      medicinesCount: Number(payload.medicinesCount || 0),
      doctorName: String(payload.doctorName || 'Attending Physician'),
      issuedAt: new Date().toISOString(),
    };
    room.latestRxNotice = notice;

    const rxMsg: RoomChatMessage = {
      id: `rx-msg-${notice.rxId}`,
      senderId: 'doctor-rx',
      senderName: notice.doctorName,
      senderRole: 'doctor',
      text: `Issued Digital E-Prescription (${notice.rxId.toUpperCase()}): ${notice.diagnosisSummary} (${notice.medicinesCount} medication${
        notice.medicinesCount === 1 ? '' : 's'
      }).`,
      timestamp: notice.issuedAt,
      kind: 'eprescription',
    };
    if (!room.seenMessageIds.has(rxMsg.id)) {
      room.seenMessageIds.add(rxMsg.id);
      room.messages.push(rxMsg);
      if (room.messages.length > MAX_ROOM_MESSAGES) {
        room.messages = room.messages.slice(-MAX_ROOM_MESSAGES);
      }
    }

    broadcastToRoom(room, 'eprescription:notice', {
      roomId: room.roomId,
      notice,
      message: rxMsg,
    });
  };

  const emitUserEvent = (
    userId: string,
    event: string,
    payload: Record<string, unknown>
  ) => {
    const subs = userSubscribers.get(String(userId));
    if (!subs) return;
    for (const clientWs of subs) {
      safeSend(clientWs, event, payload);
    }
  };

  return { wss, broadcastRxNoticeToRoom, emitUserEvent };
}
