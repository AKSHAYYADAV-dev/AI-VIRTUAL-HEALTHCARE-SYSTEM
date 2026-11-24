import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import http from 'http';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { spawn, ChildProcess } from 'child_process';
import dotenv from 'dotenv';
import {
  createNodeApiFallbackRouter,
  verifySessionTokenWithSecret,
  extractSessionTokenFromHeaders,
  lookupUserById,
  isCsrfValidForRequest,
} from './backend/nodeFallback';
import { attachConsultationWebSocket } from './backend/consultationWs';

dotenv.config();

const app = express();
const PORT = 3000;
const PYTHON_HOST = process.env.PYTHON_BACKEND_HOST || '127.0.0.1';
const PYTHON_PORT = Number(process.env.PYTHON_BACKEND_PORT) || 8001;

// Shared in-memory signing secret for Node, WebSockets, and the Python child process.
// Never hardcoded and never written to disk.
const RUNTIME_SESSION_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16
    ? process.env.SESSION_SECRET.trim()
    : crypto.randomBytes(32).toString('hex');

let pythonProcess: ChildProcess | null = null;
let pythonAvailable = false;
let pythonSpawnDisabled = false;
let shuttingDown = false;

const nodeFallbackRouter = createNodeApiFallbackRouter({
  sessionSecret: RUNTIME_SESSION_SECRET,
});

// Baseline security headers (preserve iframe embedding for AI Studio preview)
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

let broadcastRoomRxNotice:
  | ((
      roomId: string,
      payload: {
        rxId: string;
        diagnosisSummary: string;
        medicinesCount: number;
        doctorName: string;
      }
    ) => void)
  | null = null;
let emitRealtimeUserEvent:
  | ((userId: string, event: string, payload: Record<string, unknown>) => void)
  | null = null;

function isTrackedRealtimeMutation(method: string, urlPath: string): boolean {
  const pathOnly = urlPath.split('?')[0];
  if (method === 'POST' && pathOnly === '/api/appointments') return true;
  if (method === 'PATCH' && /^\/api\/appointments\/[^/]+$/.test(pathOnly)) return true;
  if (method === 'POST' && pathOnly === '/api/eprescriptions') return true;
  if (method === 'PATCH' && /^\/api\/admin\/doctors\/[^/]+\/approval$/.test(pathOnly)) return true;
  return false;
}

function dispatchRealtimeApiEvents(
  method: string,
  urlPath: string,
  data: Record<string, any> | null
) {
  if (!emitRealtimeUserEvent || !data) return;
  const pathOnly = urlPath.split('?')[0];

  if (method === 'POST' && pathOnly === '/api/appointments' && data.appointment) {
    const apt = data.appointment;
    if (apt.doctorId) {
      emitRealtimeUserEvent(apt.doctorId, 'appointment:created', { appointment: apt });
      if (data.notification) {
        emitRealtimeUserEvent(apt.doctorId, 'notification:new', { notification: data.notification });
      }
    }
    if (apt.patientId) {
      emitRealtimeUserEvent(apt.patientId, 'appointment:created', { appointment: apt });
    }
    return;
  }

  if (method === 'PATCH' && /^\/api\/appointments\/[^/]+$/.test(pathOnly) && data.appointment) {
    const apt = data.appointment;
    if (apt.patientId) {
      emitRealtimeUserEvent(apt.patientId, 'appointment:updated', { appointment: apt });
      if (data.notification) {
        emitRealtimeUserEvent(apt.patientId, 'notification:new', { notification: data.notification });
      }
    }
    if (apt.doctorId) {
      emitRealtimeUserEvent(apt.doctorId, 'appointment:updated', { appointment: apt });
    }
    return;
  }

  if (method === 'POST' && pathOnly === '/api/eprescriptions' && data.eprescription) {
    const rx = data.eprescription;
    if (rx.patientId) {
      emitRealtimeUserEvent(rx.patientId, 'eprescription:created', { eprescription: rx });
      if (data.notification) {
        emitRealtimeUserEvent(rx.patientId, 'notification:new', { notification: data.notification });
      }
    }
    if (rx.doctorId) {
      emitRealtimeUserEvent(rx.doctorId, 'eprescription:created', { eprescription: rx });
    }
    return;
  }

  if (
    method === 'PATCH' &&
    /^\/api\/admin\/doctors\/[^/]+\/approval$/.test(pathOnly) &&
    data.doctor
  ) {
    const doc = data.doctor;
    if (doc.id) {
      emitRealtimeUserEvent(doc.id, 'doctor:approval_updated', { doctor: doc });
      if (data.notification) {
        emitRealtimeUserEvent(doc.id, 'notification:new', { notification: data.notification });
      }
    }
  }
}

function checkPythonHealth(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(
      {
        host: PYTHON_HOST,
        port: PYTHON_PORT,
        path: '/api/health',
        timeout: 800,
      },
      (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      }
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function startPythonBackendInBackground(): Promise<void> {
  if (await checkPythonHealth()) {
    pythonAvailable = true;
    console.log(`Connected to existing Python backend at http://${PYTHON_HOST}:${PYTHON_PORT}`);
    return;
  }

  const backendScript = path.resolve(process.cwd(), 'backend', 'server.py');
  if (!fs.existsSync(backendScript)) {
    console.warn('backend/server.py not found; using built-in Node API fallback.');
    pythonSpawnDisabled = true;
    return;
  }

  const pythonBin = process.env.PYTHON_BIN || 'python3';

  const launchChild = () => {
    if (shuttingDown || pythonSpawnDisabled) return;

    try {
      pythonProcess = spawn(pythonBin, [backendScript], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          SESSION_SECRET: RUNTIME_SESSION_SECRET,
          PYTHON_BACKEND_HOST: PYTHON_HOST,
          PYTHON_BACKEND_PORT: String(PYTHON_PORT),
          PYTHON_PARENT_PID: String(process.pid),
        },
        stdio: ['ignore', 'inherit', 'inherit'],
      });
    } catch (err: any) {
      console.warn(`Unable to spawn ${pythonBin}: ${err?.message || err}. Using Node API fallback.`);
      pythonAvailable = false;
      pythonSpawnDisabled = true;
      return;
    }

    pythonProcess.on('error', (err: NodeJS.ErrnoException) => {
      pythonProcess = null;
      pythonAvailable = false;
      if (err.code === 'ENOENT') {
        console.warn(
          `${pythonBin} is not installed in this runtime container; using built-in Node API fallback.`
        );
        pythonSpawnDisabled = true;
      } else {
        console.warn(`Python backend spawn error (${err.message}); using Node API fallback.`);
      }
    });

    pythonProcess.on('exit', (code, signal) => {
      pythonProcess = null;
      pythonAvailable = false;
      if (!shuttingDown && !pythonSpawnDisabled) {
        console.warn(
          `Python backend exited (code=${code}, signal=${signal}); restarting in 1000ms...`
        );
        setTimeout(launchChild, 1000);
      }
    });

    // Poll briefly until Python HTTP server is accepting connections
    const startedAt = Date.now();
    const pollReady = async () => {
      while (!shuttingDown && !pythonSpawnDisabled && Date.now() - startedAt < 8000) {
        if (await checkPythonHealth()) {
          pythonAvailable = true;
          return;
        }
        await new Promise((r) => setTimeout(r, 150));
      }
    };
    void pollReady();
  };

  launchChild();
}

function stopPythonBackend() {
  shuttingDown = true;
  if (pythonProcess && !pythonProcess.killed) {
    try {
      pythonProcess.kill('SIGTERM');
    } catch {
      // ignore
    }
    pythonProcess = null;
  }
}

process.on('SIGINT', () => {
  stopPythonBackend();
  process.exit(0);
});
process.on('SIGTERM', () => {
  stopPythonBackend();
  process.exit(0);
});
process.on('exit', () => {
  stopPythonBackend();
});

// ============================================================================
// REAL-TIME CONSULTATION ROOM NOTIFICATION ENDPOINT (DOCTOR/ADMIN ONLY)
// ============================================================================
app.post('/api/consultation-room/notify-rx', express.json(), (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!isCsrfValidForRequest(req)) {
    res.status(403).json({ error: 'Cross-site request rejected.' });
    return;
  }
  const token = extractSessionTokenFromHeaders(req.headers);
  const verifiedUserId = verifySessionTokenWithSecret(token, RUNTIME_SESSION_SECRET);
  if (!verifiedUserId) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const authUser = lookupUserById(verifiedUserId);
  if (!authUser) {
    res.status(401).json({ error: 'Invalid session.' });
    return;
  }
  const isApprovedDoctor = authUser.role === 'doctor' && Boolean(authUser.approved);
  if (!isApprovedDoctor && authUser.role !== 'admin') {
    res.status(403).json({ error: 'Only approved doctors can broadcast prescription notices.' });
    return;
  }

  const { roomId, rxId, diagnosisSummary, medicinesCount, doctorName } = req.body || {};
  if (!roomId || !rxId) {
    res.status(400).json({ error: 'roomId and rxId are required.' });
    return;
  }
  if (broadcastRoomRxNotice) {
    broadcastRoomRxNotice(String(roomId), {
      rxId: String(rxId).slice(0, 80),
      diagnosisSummary: String(diagnosisSummary || 'Clinical E-Prescription').slice(0, 300),
      medicinesCount: Math.max(0, Math.min(50, Number(medicinesCount || 0) || 0)),
      doctorName:
        authUser.role === 'doctor'
          ? authUser.name
          : String(doctorName || authUser.name || 'Attending Physician').slice(0, 120),
    });
  }
  res.json({ ok: true });
});

// ============================================================================
// GOOGLE MAPS RUNTIME CONFIGURATION ENDPOINT
// ============================================================================
app.get('/api/config/maps', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  const apiKey =
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    process.env.MAPS_API_KEY ||
    '';
  res.json({
    configured: Boolean(apiKey),
    apiKey,
  });
});

// ============================================================================
// PROXY ALL /api/* REQUESTS TO PYTHON BACKEND (WITH NODE FALLBACK)
// ============================================================================
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', 'no-store');
  const trackMutation = isTrackedRealtimeMutation(req.method, req.originalUrl);

  if (!pythonAvailable || pythonSpawnDisabled) {
    if (trackMutation) {
      const origJson = res.json.bind(res);
      res.json = ((body: any) => {
        if (res.statusCode >= 200 && res.statusCode < 300 && body && typeof body === 'object') {
          dispatchRealtimeApiEvents(req.method, req.originalUrl, body);
        }
        return origJson(body);
      }) as Response['json'];
    }
    nodeFallbackRouter(req, res, next);
    return;
  }

  const targetHeaders: http.OutgoingHttpHeaders = { ...req.headers };
  if (!targetHeaders['x-forwarded-host'] && req.headers.host) {
    targetHeaders['x-forwarded-host'] = req.headers.host;
  }
  targetHeaders.host = `${PYTHON_HOST}:${PYTHON_PORT}`;
  delete targetHeaders.connection;

  const proxyReq = http.request(
    {
      hostname: PYTHON_HOST,
      port: PYTHON_PORT,
      path: req.originalUrl,
      method: req.method,
      headers: targetHeaders,
    },
    (proxyRes) => {
      const responseHeaders: http.OutgoingHttpHeaders = { ...proxyRes.headers };
      delete responseHeaders['transfer-encoding'];

      res.writeHead(proxyRes.statusCode || 502, responseHeaders);

      const contentType = String(proxyRes.headers['content-type'] || '');
      if (contentType.includes('text/event-stream')) {
        res.flushHeaders?.();
      }

      const shouldInspectJson =
        trackMutation &&
        (proxyRes.statusCode || 500) >= 200 &&
        (proxyRes.statusCode || 500) < 300;
      const chunks: Buffer[] = [];

      proxyRes.on('data', (chunk) => {
        if (shouldInspectJson) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        res.write(chunk);
      });
      proxyRes.on('end', () => {
        if (shouldInspectJson && chunks.length > 0) {
          try {
            const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            dispatchRealtimeApiEvents(req.method, req.originalUrl, parsed);
          } catch {
            // ignore non-json
          }
        }
        res.end();
      });
    }
  );

  proxyReq.on('error', (err) => {
    console.warn('Python backend proxy unavailable:', err.message);
    pythonAvailable = false;
    if (!res.headersSent) {
      res.status(503).json({
        error: 'Backend is warming up. Please retry in a moment.',
      });
    } else {
      res.end();
    }
  });

  req.pipe(proxyReq, { end: true });
});

// ============================================================================
// VITE MIDDLEWARE / STATIC ASSETS MOUNTING
// ============================================================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const httpServer = http.createServer(app);
  const wsHub = attachConsultationWebSocket(httpServer, {
    sessionSecret: RUNTIME_SESSION_SECRET,
  });
  broadcastRoomRxNotice = wsHub.broadcastRxNoticeToRoom;
  emitRealtimeUserEvent = wsHub.emitUserEvent;

  // Bind port 3000 immediately so Cloud Run health checks succeed without waiting
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(
      `AI Virtual Healthcare Assistant server running on http://0.0.0.0:${PORT} (WebSocket /ws/consultation ready)`
    );
    void startPythonBackendInBackground();
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  stopPythonBackend();
  process.exit(1);
});
