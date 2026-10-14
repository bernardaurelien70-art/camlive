export type LogLevel = 'info' | 'success' | 'warn' | 'error';

export type DiagnosticSource =
  | 'WEBRTC_SIMLI'
  | 'DECART_CLIENT'
  | 'AUDIO_SYS'
  | 'CAMERA_SYS'
  | 'VIDEOCROPPER'
  | 'SERVER_API'
  | 'AUTH_ADMIN'
  | 'SYSTEM'
  | string;

export interface DiagnosticLog {
  id: string;
  timestamp: number;
  level: LogLevel;
  source: string;
  message: string;
  details?: unknown;
  targetScript?: string;
  recommendedAction?: string;
}

export interface SubsystemHealth {
  name: string;
  category: 'api' | 'webrtc' | 'media' | 'canvas' | 'auth';
  status: 'healthy' | 'warning' | 'error' | 'idle';
  latencyMs?: number;
  lastChecked: Date;
  summary: string;
  targetFile: string;
  diagnosticAdvice?: string;
}

type HealthListener = (health: Record<string, SubsystemHealth>) => void;

export class DiagnosticLogger {
  private logs: DiagnosticLog[] = [];
  private listeners: ((logs: DiagnosticLog[]) => void)[] = [];
  private healthListeners: Set<HealthListener> = new Set();
  private maxLogs = 200;

  private healthState: Record<string, SubsystemHealth> = {
    simliApi: {
      name: 'API Audio & Voix (Simli Engine)',
      category: 'api',
      status: 'idle',
      lastChecked: new Date(),
      summary: 'Non initialisé',
      targetFile: 'server.ts (/api/simli-status, /api/simli-session)',
      diagnosticAdvice: 'Vérifier la présence de la variable Simli ou SIMLI_API_KEY.',
    },
    decartApi: {
      name: 'API Transformation GPU (Decart AI)',
      category: 'api',
      status: 'idle',
      lastChecked: new Date(),
      summary: 'Non initialisé',
      targetFile: 'server.ts (/api/decart-status, /api/realtime-token)',
      diagnosticAdvice: 'Vérifier les crédits sur api.decart.ai et la variable Live/DECART_API_KEY.',
    },
    audioInput: {
      name: 'Entrée Micro & AudioContext',
      category: 'media',
      status: 'idle',
      lastChecked: new Date(),
      summary: 'En attente d’activation',
      targetFile: 'src/App.tsx (startSimliMicrophone)',
      diagnosticAdvice: 'Autoriser l’accès au micro dans le navigateur (icône cadenas à gauche de l’URL).',
    },
    cameraInput: {
      name: 'Flux Vidéo Caméra Locale',
      category: 'media',
      status: 'idle',
      lastChecked: new Date(),
      summary: 'En attente d’activation',
      targetFile: 'src/App.tsx (toggleCamera)',
      diagnosticAdvice: 'Brancher une webcam USB ou vérifier les autorisations caméra.',
    },
    webrtcStream: {
      name: 'Connexion WebRTC & Flux Distant',
      category: 'webrtc',
      status: 'idle',
      lastChecked: new Date(),
      summary: 'Aucune session active',
      targetFile: 'src/simliWebrtc.ts / @decartai/sdk',
      diagnosticAdvice: 'Vérifier la connectivité UDP / serveurs STUN/TURN.',
    },
    videoCropper: {
      name: 'Moteur de Rendu & Anti-Filigrane',
      category: 'canvas',
      status: 'healthy',
      lastChecked: new Date(),
      summary: 'Accélération matérielle active',
      targetFile: 'src/VideoCropper.tsx',
      diagnosticAdvice: 'requestVideoFrameCallback opérationnel, double-buffering GPU actif.',
    },
  };

  constructor() {
    this.log({
      level: 'info',
      source: 'SYSTEM',
      message: 'Console de diagnostic système initialisée en mode sécurisé.',
      targetScript: 'src/diagnosticLogger.ts',
    });
  }

  public log(entry: Omit<DiagnosticLog, 'id' | 'timestamp'>): DiagnosticLog {
    const newLog: DiagnosticLog = {
      ...entry,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
    };
    this.logs = [newLog, ...this.logs].slice(0, this.maxLogs);
    this.notifyListeners();
    return newLog;
  }

  public getLogs(): DiagnosticLog[] {
    return this.logs;
  }

  public clear() {
    this.logs = [];
    this.notifyListeners();
  }

  public clearLogs() {
    this.clear();
  }

  public subscribe(listener: (logs: DiagnosticLog[]) => void) {
    this.listeners.push(listener);
    // Notification immédiate avec l'état actuel
    try {
      listener(this.logs);
    } catch (err) {
      console.error('Error in initial diagnostic listener call:', err);
    }
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public subscribeLogs(listener: (logs: DiagnosticLog[]) => void) {
    return this.subscribe(listener);
  }

  public updateHealth(key: string, patch: Partial<SubsystemHealth>) {
    if (this.healthState[key]) {
      this.healthState[key] = {
        ...this.healthState[key],
        ...patch,
        lastChecked: new Date(),
      };
      this.notifyHealthListeners();
    }
  }

  public getHealth(): Record<string, SubsystemHealth> {
    return { ...this.healthState };
  }

  public subscribeHealth(listener: HealthListener): () => void {
    this.healthListeners.add(listener);
    listener({ ...this.healthState });
    return () => this.healthListeners.delete(listener);
  }

  private notifyListeners() {
    const copy = [...this.logs];
    this.listeners.forEach((listener) => {
      try {
        listener(copy);
      } catch (err) {
        console.error('Diagnostic listener error:', err);
      }
    });
  }

  private notifyHealthListeners() {
    const copy = { ...this.healthState };
    for (const l of this.healthListeners) {
      try {
        l(copy);
      } catch (e) {
        console.error('Error notifying health listener:', e);
      }
    }
  }

  public async runFullSystemProbe(): Promise<{
    simli: boolean;
    decart: boolean;
    audio: boolean;
    camera: boolean;
  }> {
    this.log({
      level: 'info',
      source: 'SERVER_API',
      message: 'Lancement de l’analyse complète des sous-systèmes…',
      targetScript: 'src/diagnosticLogger.ts -> runFullSystemProbe()',
    });

    let simliOk = false;
    let decartOk = false;

    // Test Simli
    const t0 = performance.now();
    try {
      const res = await fetch('/api/simli-status');
      const latency = Math.round(performance.now() - t0);
      const data = await res.json();
      if (res.ok && data.configured && data.valid) {
        simliOk = true;
        this.updateHealth('simliApi', {
          status: 'healthy',
          latencyMs: latency,
          summary: `Prête (${data.secretName || 'Simli'}, latence ${latency}ms)`,
          diagnosticAdvice: 'Aucune action requise. Clé API valide et vérifiée sur api.simli.ai.',
        });
        this.log({
          level: 'success',
          source: 'SERVER_API',
          message: `API Simli opérationnelle (${latency}ms, clé: ${data.secretName})`,
          details: data,
          targetScript: 'server.ts (/api/simli-status)',
        });
      } else {
        this.updateHealth('simliApi', {
          status: 'warning',
          latencyMs: latency,
          summary: data.serverMessage || 'Clé manquante ou rejetée',
          diagnosticAdvice:
            'Aller dans vos secrets et vérifier la variable Simli ou SIMLI_API_KEY.',
        });
        this.log({
          level: 'warn',
          source: 'SERVER_API',
          message: `Problème API Simli : ${data.serverMessage || 'Clé non configurée'}`,
          targetScript: 'server.ts (getSimliApiKey)',
          recommendedAction:
            'Ajouter une clé API Simli valide sur app.simli.com dans les secrets.',
        });
      }
    } catch (e) {
      this.updateHealth('simliApi', {
        status: 'error',
        summary: 'Échec de connexion réseau au serveur local',
        diagnosticAdvice: 'Vérifier que server.ts tourne correctement sur le port 3000.',
      });
      this.log({
        level: 'error',
        source: 'SERVER_API',
        message: 'Impossible de joindre /api/simli-status',
        details: e instanceof Error ? e.message : e,
        targetScript: 'server.ts (/api/simli-status)',
      });
    }

    // Test Decart
    const t1 = performance.now();
    try {
      const res = await fetch('/api/decart-status');
      const latency = Math.round(performance.now() - t1);
      const data = await res.json();
      if (res.ok && data.configured && data.creditsOk) {
        decartOk = true;
        this.updateHealth('decartApi', {
          status: 'healthy',
          latencyMs: latency,
          summary: `Opérationnelle (${data.pool || 'gpu-cluster'}, ${latency}ms)`,
          diagnosticAdvice: 'Aucune action requise. Cluster GPU actif et crédits disponibles.',
        });
        this.log({
          level: 'success',
          source: 'SERVER_API',
          message: `API Decart connectée avec succès (${latency}ms, pool: ${data.pool})`,
          details: data,
          targetScript: 'server.ts (/api/decart-status)',
        });
      } else {
        const errMsg = data.serverError || 'Crédits 0,00$ ou clé non trouvée';
        this.updateHealth('decartApi', {
          status: 'error',
          latencyMs: latency,
          summary: errMsg,
          diagnosticAdvice:
            'Vérifier le solde de crédits sur https://api.decart.ai ou la clé dans le secret "Live".',
        });
        this.log({
          level: 'error',
          source: 'DECART_CLIENT',
          message: `Erreur API Decart : ${errMsg}`,
          targetScript: 'server.ts (/api/decart-status)',
          recommendedAction:
            'Recharger les crédits sur Decart AI ou utiliser le moteur vocal Simli.',
        });
      }
    } catch (e) {
      this.updateHealth('decartApi', {
        status: 'error',
        summary: 'Erreur réseau vers le backend',
        diagnosticAdvice: 'Vérifier la réponse du serveur Express dans server.ts.',
      });
      this.log({
        level: 'error',
        source: 'SERVER_API',
        message: 'Impossible de joindre /api/decart-status',
        details: e instanceof Error ? e.message : e,
        targetScript: 'server.ts (/api/decart-status)',
      });
    }

    // Test Micro / Caméra
    let audioOk = false;
    let cameraOk = false;
    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        audioOk = devices.some((d) => d.kind === 'audioinput');
        cameraOk = devices.some((d) => d.kind === 'videoinput');
        this.log({
          level: 'info',
          source: 'SYSTEM',
          message: `Périphériques détectés : Microphones=${devices.filter((d) => d.kind === 'audioinput').length}, Webcams=${devices.filter((d) => d.kind === 'videoinput').length}`,
          targetScript: 'navigator.mediaDevices.enumerateDevices()',
        });
      } catch (err) {
        this.log({
          level: 'warn',
          source: 'SYSTEM',
          message: 'Impossible d’énumérer les périphériques multimédias.',
          details: err,
        });
      }
    }

    return { simli: simliOk, decart: decartOk, audio: audioOk, camera: cameraOk };
  }
}

export const diagnosticLogger = new DiagnosticLogger();
