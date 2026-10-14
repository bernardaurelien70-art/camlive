import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  LogOut,
  Terminal,
  Settings,
  ShieldCheck,
  Cpu,
  Layers,
  Wrench,
  Copy,
  Download,
  Trash2,
  Search,
  ExternalLink,
} from 'lucide-react';
import {
  diagnosticLogger,
  type DiagnosticLog,
  type SubsystemHealth,
  type LogLevel,
  type DiagnosticSource,
} from './diagnosticLogger';

interface AdminDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  simliStatus: {
    configured: boolean;
    secretName: string | null;
    keyPrefix: string | null;
    valid: boolean;
    serverMessage: string | null;
  };
  decartStatus: {
    configured: boolean;
    keyPrefix: string | null;
    apiKeyName?: string | null;
    creditsOk?: boolean;
    serverError?: string | null;
    pool?: string | null;
  };
  onRefreshStatuses: () => Promise<void>;
  // Paramètres avancés
  activeEngine: 'simli' | 'decart';
  setActiveEngine: (engine: 'simli' | 'decart') => void;
  simliFaceId: string;
  setSimliFaceId: (id: string) => void;
  simliModel: 'fasttalk' | 'artalk';
  setSimliModel: (model: 'fasttalk' | 'artalk') => void;
  simliTransport: 'p2p' | 'livekit';
  setSimliTransport: (t: 'p2p' | 'livekit') => void;
  decartModel: string;
  setDecartModel: (model: any) => void;
  onSendVoicePulse?: () => void;
}

export const AdminDashboardModal: React.FC<AdminDashboardModalProps> = ({
  isOpen,
  onClose,
  onLogout,
  simliStatus,
  decartStatus,
  onRefreshStatuses,
  activeEngine,
  setActiveEngine,
  simliFaceId,
  setSimliFaceId,
  simliModel,
  setSimliModel,
  simliTransport,
  setSimliTransport,
  decartModel,
  setDecartModel,
  onSendVoicePulse,
}) => {
  const [activeTab, setActiveTab] = useState<'health' | 'logs' | 'config' | 'labs'>('health');
  const [logs, setLogs] = useState<DiagnosticLog[]>([]);
  const [health, setHealth] = useState<Record<string, SubsystemHealth>>({});
  const [isProbing, setIsProbing] = useState(false);
  const [logFilterLevel, setLogFilterLevel] = useState<LogLevel | 'all'>('all');
  const [logFilterSource, setLogFilterSource] = useState<DiagnosticSource | 'all'>('all');
  const [logSearch, setLogSearch] = useState('');
  const [copied, setCopied] = useState(false);
  const [labsFeedback, setLabsFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const unsubLogs = diagnosticLogger.subscribeLogs((newLogs) => setLogs(newLogs));
    const unsubHealth = diagnosticLogger.subscribeHealth((newHealth) => setHealth(newHealth));

    // Lancement de sonde initial
    diagnosticLogger.runFullSystemProbe();

    return () => {
      unsubLogs();
      unsubHealth();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRunProbe = async () => {
    setIsProbing(true);
    try {
      await diagnosticLogger.runFullSystemProbe();
      await onRefreshStatuses();
    } finally {
      setIsProbing(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (logFilterLevel !== 'all' && log.level !== logFilterLevel) return false;
    if (logFilterSource !== 'all' && log.source !== logFilterSource) return false;
    if (logSearch.trim()) {
      const q = logSearch.toLowerCase();
      const matchMsg = log.message.toLowerCase().includes(q);
      const matchTarget = log.targetScript?.toLowerCase().includes(q) || false;
      const matchSource = log.source.toLowerCase().includes(q);
      if (!matchMsg && !matchTarget && !matchSource) return false;
    }
    return true;
  });

  const errorsCount = logs.filter((l) => l.level === 'error').length;
  const warningsCount = logs.filter((l) => l.level === 'warn').length;

  const handleCopyLogs = () => {
    const text = logs
      .map(
        (l) =>
          `[${new Date(l.timestamp).toISOString()}] [${l.level.toUpperCase()}] [${l.source}] ${l.message}${
            l.targetScript ? ` (Script: ${l.targetScript})` : ''
          }${l.recommendedAction ? ` [Remède: ${l.recommendedAction}]` : ''}`
      )
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `facevo-diagnostic-${new Date().toISOString().slice(0, 19)}.json`;
    a.click();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl h-[88vh] max-h-[820px] rounded-2xl border border-white/15 bg-[#0F131C] shadow-2xl flex flex-col overflow-hidden text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <header className="h-16 px-5 border-b border-white/10 bg-[#141A26] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FF5734] flex items-center justify-center text-white font-bold shadow-md">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-wide">
                  Console d'Administration & Diagnostic Technique
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-semibold">
                  SÉCURISÉ
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Surveillance temps réel des sous-systèmes, diagnostics de pannes et configurations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRunProbe}
              disabled={isProbing}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-white flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isProbing ? 'animate-spin' : ''}`} />
              <span>Sonde Système</span>
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-xs font-semibold text-rose-300 flex items-center gap-1.5 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Déconnexion</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl border border-white/10 text-slate-400 hover:text-white text-xs font-medium hover:bg-white/5 transition-colors"
            >
              Fermer
            </button>
          </div>
        </header>

        {/* Tab Selector */}
        <div className="px-5 border-b border-white/10 bg-[#111622] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('health')}
              className={`px-4 py-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
                activeTab === 'health'
                  ? 'border-[#FF5734] text-white bg-white/[0.02]'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Activity className="w-4 h-4 text-[#FF5734]" />
              <span>Santé & Diagnostic des Pannes</span>
              {errorsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-mono">
                  {errorsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
                activeTab === 'logs'
                  ? 'border-[#FF5734] text-white bg-white/[0.02]'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span>Journal des Événements & Logs ({logs.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('config')}
              className={`px-4 py-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
                activeTab === 'config'
                  ? 'border-[#FF5734] text-white bg-white/[0.02]'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Settings className="w-4 h-4 text-sky-400" />
              <span>Réglages Techniques & Clés</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('labs')}
              className={`px-4 py-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
                activeTab === 'labs'
                  ? 'border-[#FF5734] text-white bg-white/[0.02]'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Wrench className="w-4 h-4 text-amber-400" />
              <span>Labs (Monitoring & Expérimentations)</span>
            </button>
          </div>

          <div className="text-[11px] font-mono text-slate-400 hidden sm:flex items-center gap-3">
            <span>Erreurs : <strong className="text-rose-400">{errorsCount}</strong></span>
            <span>Alertes : <strong className="text-amber-400">{warningsCount}</strong></span>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5 bg-[#0B0D11]">
          {/* TAB 1: SANTE & DIAGNOSTIC */}
          {activeTab === 'health' && (
            <div className="space-y-5">
              {/* Synthèse des dysfonctionnements actifs */}
              {errorsCount > 0 ? (
                <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-rose-300 font-bold text-xs uppercase tracking-wider">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span>Dysfonctionnements identifiés ({errorsCount})</span>
                  </div>
                  <p className="text-xs text-slate-200">
                    Le moteur de diagnostic a identifié des anomalies nécessitant une intervention.
                    Consultez ci-dessous les composants et fichiers exacts concernés :
                  </p>
                  <div className="space-y-2 mt-2">
                    {logs
                      .filter((l) => l.level === 'error')
                      .slice(0, 4)
                      .map((err) => (
                        <div
                          key={err.id}
                          className="p-3 rounded-lg bg-[#0F131C] border border-rose-500/20 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-rose-300">
                              [{err.source}] {err.message}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              {new Date(err.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          {err.targetScript && (
                            <p className="text-[11px] text-amber-300 font-mono">
                              Script / Composant à modifier :{' '}
                              <span className="text-white bg-black/40 px-1 py-0.5 rounded">
                                {err.targetScript}
                              </span>
                            </p>
                          )}
                          {err.recommendedAction && (
                            <p className="text-[11px] text-slate-300">
                              Action corrective : {err.recommendedAction}
                            </p>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-xs text-emerald-300">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span>
                      Aucune anomalie bloquante détectée. Tous les sous-systèmes critiques sont en bon état de fonctionnement.
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    Vérifié à {new Date().toLocaleTimeString()}
                  </span>
                </div>
              )}

              {/* Grille des sous-systèmes */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Matrice de Santé des Sous-Systèmes
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(health).map(([key, sub]) => {
                    const isOk = sub.status === 'healthy';
                    const isErr = sub.status === 'error';
                    const isWarn = sub.status === 'warning';
                    return (
                      <div
                        key={key}
                        className={`p-3.5 rounded-xl border transition-all ${
                          isOk
                            ? 'bg-[#121622] border-emerald-500/30 hover:border-emerald-500/50'
                            : isErr
                            ? 'bg-[#1a1215] border-rose-500/40 hover:border-rose-500/60'
                            : isWarn
                            ? 'bg-[#1a1712] border-amber-500/40 hover:border-amber-500/60'
                            : 'bg-[#121622] border-white/10'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            {isOk && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                            {isErr && <XCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                            {isWarn && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
                            {!isOk && !isErr && !isWarn && (
                              <Activity className="w-4 h-4 text-slate-400 shrink-0" />
                            )}
                            <div>
                              <h4 className="text-xs font-bold text-white">{sub.name}</h4>
                              <p className="text-[10px] text-slate-400 font-mono">
                                {sub.targetFile}
                              </p>
                            </div>
                          </div>
                          {sub.latencyMs !== undefined && (
                            <span className="px-1.5 py-0.5 rounded bg-black/40 text-[10px] font-mono text-slate-300">
                              {sub.latencyMs} ms
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-300 mb-2 leading-relaxed">
                          {sub.summary}
                        </div>

                        {sub.diagnosticAdvice && (
                          <div className="pt-2 border-t border-white/5 text-[11px] text-slate-400">
                            <span className="text-[#FF5734] font-semibold">Conseil d'intervention : </span>
                            {sub.diagnosticAdvice}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Guide rapide d'intervention script par script */}
              <div className="rounded-xl border border-white/10 bg-[#121622] p-4 space-y-3">
                <h3 className="text-xs font-bold text-white flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-[#FF5734]" />
                  <span>Guide Pratique : Quel script modifier en cas d'erreur ?</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-lg bg-[#0B0D11] border border-white/5 space-y-1">
                    <p className="font-semibold text-emerald-300">Moteur Vocal & Lip-Sync</p>
                    <p className="text-[11px] font-mono text-slate-400">src/simliWebrtc.ts</p>
                    <p className="text-[10px] text-slate-400">
                      Gère l'AudioWorklet, le WebSocket P2P et la connexion LiveKit à Simli.
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#0B0D11] border border-white/5 space-y-1">
                    <p className="font-semibold text-sky-300">Recadrage & Anti-Filigrane</p>
                    <p className="text-[11px] font-mono text-slate-400">src/VideoCropper.tsx</p>
                    <p className="text-[10px] text-slate-400">
                      Gère le rendu GPU 60 FPS, le double-buffer de textures et la détection.
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#0B0D11] border border-white/5 space-y-1">
                    <p className="font-semibold text-[#FF5734]">Serveur Backend & Clés</p>
                    <p className="text-[11px] font-mono text-slate-400">server.ts</p>
                    <p className="text-[10px] text-slate-400">
                      Gère la vérification des clés Simli / Decart et l'échange de jetons WebRTC.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LOGS EN TEMPS REEL */}
          {activeTab === 'logs' && (
            <div className="space-y-3 flex flex-col h-full">
              {/* Barre d'outils des logs */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 bg-[#121622] p-2.5 rounded-xl border border-white/10 shrink-0">
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                    <input
                      type="text"
                      value={logSearch}
                      onChange={(e) => setLogSearch(e.target.value)}
                      placeholder="Filtrer par mot-clé, composant ou script…"
                      className="w-full bg-[#0B0D11] border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#FF5734]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <select
                    value={logFilterLevel}
                    onChange={(e) => setLogFilterLevel(e.target.value as any)}
                    className="bg-[#0B0D11] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
                  >
                    <option value="all">Tous les niveaux</option>
                    <option value="error">Erreurs uniquement</option>
                    <option value="warn">Avertissements</option>
                    <option value="success">Succès</option>
                    <option value="info">Informations</option>
                  </select>

                  <select
                    value={logFilterSource}
                    onChange={(e) => setLogFilterSource(e.target.value as any)}
                    className="bg-[#0B0D11] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
                  >
                    <option value="all">Toutes sources</option>
                    <option value="WEBRTC_SIMLI">WebRTC Simli</option>
                    <option value="DECART_CLIENT">Decart GPU</option>
                    <option value="SERVER_API">API Serveur</option>
                    <option value="AUDIO_SYS">Audio / Micro</option>
                    <option value="CAMERA_SYS">Caméra</option>
                    <option value="VIDEOCROPPER">VideoCropper</option>
                    <option value="AUTH_ADMIN">Auth Admin</option>
                  </select>

                  <button
                    type="button"
                    onClick={handleCopyLogs}
                    className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-[#0B0D11] text-xs text-slate-300 hover:text-white flex items-center gap-1"
                    title="Copier les logs"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copied ? 'Copié !' : 'Copier'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportJson}
                    className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-[#0B0D11] text-xs text-slate-300 hover:text-white flex items-center gap-1"
                    title="Télécharger JSON"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>JSON</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => diagnosticLogger.clearLogs()}
                    className="p-1.5 rounded-lg border border-white/10 bg-[#0B0D11] text-slate-400 hover:text-rose-400"
                    title="Vider la console"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Liste défilante des logs */}
              <div className="flex-1 overflow-y-auto space-y-1.5 font-mono text-xs pr-1 min-h-[350px]">
                {filteredLogs.length === 0 ? (
                  <div className="h-40 flex items-center justify-center text-slate-500 text-xs">
                    Aucun événement correspondant aux filtres.
                  </div>
                ) : (
                  filteredLogs.map((log) => {
                    const isErr = log.level === 'error';
                    const isWarn = log.level === 'warn';
                    const isSuccess = log.level === 'success';
                    return (
                      <div
                        key={log.id}
                        className={`p-2.5 rounded-lg border leading-relaxed ${
                          isErr
                            ? 'bg-rose-950/20 border-rose-500/40 text-rose-200'
                            : isWarn
                            ? 'bg-amber-950/20 border-amber-500/40 text-amber-200'
                            : isSuccess
                            ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                            : 'bg-[#121622] border-white/5 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] mb-1 opacity-80">
                          <div className="flex items-center gap-2">
                            <span className="font-bold">[{log.source}]</span>
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-black/40">
                              {log.level}
                            </span>
                            {log.targetScript && (
                              <span className="text-slate-400 text-[10px]">
                                {log.targetScript}
                              </span>
                            )}
                          </div>
                          <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-xs">{log.message}</p>
                        {log.recommendedAction && (
                          <p className="mt-1 text-[11px] text-[#FF5734] font-sans">
                            💡 Remède : {log.recommendedAction}
                          </p>
                        )}
                        {log.details ? (
                          <pre className="mt-1 p-1.5 rounded bg-black/60 text-[10px] overflow-x-auto text-slate-400">
                            {typeof log.details === 'object'
                              ? JSON.stringify(log.details, null, 2)
                              : String(log.details)}
                          </pre>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 3: CONFIGURATION TECHNIQUE */}
          {activeTab === 'config' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl border border-white/10 bg-[#121622] space-y-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Settings className="w-4 h-4 text-sky-400" />
                  <span>Moteur Actif & Sélection d'Architecture</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setActiveEngine('simli')}
                    role="button"
                    tabIndex={0}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      activeEngine === 'simli'
                        ? 'border-[#FF5734] bg-[#FF5734]/10'
                        : 'border-white/10 bg-[#0B0D11] hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white">Moteur 1 : Simli WebRTC</span>
                      {activeEngine === 'simli' && (
                        <span className="px-2 py-0.5 rounded bg-[#FF5734] text-[10px] font-bold text-white">
                          ACTIF
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Animation labiale en temps réel basée sur le flux audio du microphone.
                    </p>
                  </div>

                  <div
                    onClick={() => setActiveEngine('decart')}
                    role="button"
                    tabIndex={0}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      activeEngine === 'decart'
                        ? 'border-[#FF5734] bg-[#FF5734]/10'
                        : 'border-white/10 bg-[#0B0D11] hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white">Moteur 2 : Decart AI Lucy</span>
                      {activeEngine === 'decart' && (
                        <span className="px-2 py-0.5 rounded bg-[#FF5734] text-[10px] font-bold text-white">
                          ACTIF
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Transformation vidéo par flux WebRTC direct et modèle de diffusion temps réel.
                    </p>
                  </div>
                </div>
              </div>

              {/* Détails Clés API */}
              <div className="p-4 rounded-xl border border-white/10 bg-[#121622] space-y-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Clés API & Secrets d'Environnement Détectés
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-[#0B0D11] border border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">Clé Simli</span>
                      {simliStatus.configured && simliStatus.valid ? (
                        <span className="text-[10px] text-emerald-400 font-bold">VALIDE ✓</span>
                      ) : (
                        <span className="text-[10px] text-rose-400 font-bold">NON RECONNUE</span>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-slate-400">
                      Nom variable : {simliStatus.secretName || 'Aucun secret trouvé'}
                    </p>
                    <p className="text-[11px] font-mono text-slate-400">
                      Préfixe clé : {simliStatus.keyPrefix || '—'}
                    </p>
                    {simliStatus.serverMessage && (
                      <p className="text-[10px] text-amber-300">{simliStatus.serverMessage}</p>
                    )}
                  </div>

                  <div className="p-3 rounded-lg bg-[#0B0D11] border border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">Clé Decart AI</span>
                      {decartStatus.configured && decartStatus.creditsOk ? (
                        <span className="text-[10px] text-emerald-400 font-bold">VALIDE ✓</span>
                      ) : (
                        <span className="text-[10px] text-rose-400 font-bold">CRÉDITS ÉPUISÉS / OFF</span>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-slate-400">
                      Nom licence : {decartStatus.apiKeyName || 'Live'}
                    </p>
                    <p className="text-[11px] font-mono text-slate-400">
                      Préfixe clé : {decartStatus.keyPrefix || '—'}
                    </p>
                    {decartStatus.serverError && (
                      <p className="text-[10px] text-rose-300">{decartStatus.serverError}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Paramètres avancés des modèles */}
              <div className="p-4 rounded-xl border border-white/10 bg-[#121622] space-y-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Paramètres Spécifiques du Moteur
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">
                      Simli FaceID Personnalisé
                    </label>
                    <input
                      type="text"
                      value={simliFaceId}
                      onChange={(e) => setSimliFaceId(e.target.value)}
                      className="w-full bg-[#0B0D11] border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#FF5734]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">
                      Modèle Lip-Sync Simli
                    </label>
                    <select
                      value={simliModel}
                      onChange={(e) => setSimliModel(e.target.value as any)}
                      className="w-full bg-[#0B0D11] border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none"
                    >
                      <option value="fasttalk">FastTalk (Optimisé vitesse)</option>
                      <option value="artalk">ArtTalk (Optimisé expression)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">
                      Canal de Transport WebRTC
                    </label>
                    <select
                      value={simliTransport}
                      onChange={(e) => setSimliTransport(e.target.value as any)}
                      className="w-full bg-[#0B0D11] border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none"
                    >
                      <option value="p2p">P2P SFU (Faible latence)</option>
                      <option value="livekit">LiveKit Cloud Relay</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">
                      Modèle Decart GPU
                    </label>
                    <select
                      value={decartModel}
                      onChange={(e) => setDecartModel(e.target.value)}
                      className="w-full bg-[#0B0D11] border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none"
                    >
                      <option value="lucy-2.1">Lucy 2.1 (Ultra-Fluide · 30 FPS)</option>
                      <option value="lucy-2.5">Lucy 2.5 (HD Photoréaliste)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: LABS (MONITORING & EXPÉRIMENTATIONS) */}
          {activeTab === 'labs' && (
            <div className="space-y-4">
              {/* Message de statut feedback en direct (sans alert bloquant) */}
              {labsFeedback && (
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs animate-in fade-in duration-150 ${
                    labsFeedback.type === 'success'
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                      : labsFeedback.type === 'error'
                      ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                      : 'bg-sky-500/15 border-sky-500/30 text-sky-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {labsFeedback.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    {labsFeedback.type === 'error' && <XCircle className="w-4 h-4 text-rose-400" />}
                    {labsFeedback.type === 'info' && <Activity className="w-4 h-4 text-sky-400" />}
                    <span>{labsFeedback.text}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLabsFeedback(null)}
                    className="text-[11px] opacity-70 hover:opacity-100 underline ml-3"
                  >
                    Effacer
                  </button>
                </div>
              )}

              {/* Panneau Suivi & Télémétrie en Direct */}
              <div className="p-4 rounded-xl border border-white/10 bg-[#121622] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Activity className="w-4 h-4 text-[#FF5734]" />
                      Tableau de Bord de Suivi & Monitoring Labs
                    </h3>
                    <p className="text-xs text-slate-400">
                      Surveillance temps réel de l'environnement d'exécution, latences et flux multimédias.
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold">
                    TÉLÉMÉTRIE ACTIVE
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                  <div className="p-3 rounded-xl bg-[#0B0D11] border border-white/10">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Moteur En Direct</p>
                    <p className="text-sm font-bold text-white mt-0.5">
                      {activeEngine === 'simli' ? 'Studio Voix (Simli)' : 'Studio Vidéo (Decart)'}
                    </p>
                    <p className="text-[10px] text-emerald-400 mt-0.5">
                      {activeEngine === 'simli' ? `FaceID: ${simliFaceId}` : `Modèle: ${decartModel}`}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-[#0B0D11] border border-white/10">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">État Clé Simli</p>
                    <p className="text-sm font-bold mt-0.5">
                      {simliStatus.configured ? (
                        <span className="text-emerald-400">Configurée ✓</span>
                      ) : (
                        <span className="text-amber-400">Absente</span>
                      )}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                      {simliStatus.keyPrefix || 'Aucun préfixe'}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-[#0B0D11] border border-white/10">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">État Clé Decart</p>
                    <p className="text-sm font-bold mt-0.5">
                      {decartStatus.configured ? (
                        <span className="text-emerald-400">Configurée ✓</span>
                      ) : (
                        <span className="text-amber-400">Absente</span>
                      )}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                      {decartStatus.creditsOk === false ? 'Solde: 0,00 $' : 'Prête pour live'}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-[#0B0D11] border border-white/10">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Logs Enregistrés</p>
                    <p className="text-sm font-bold text-white mt-0.5 font-mono">{logs.length}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {errorsCount} anomalie(s)
                    </p>
                  </div>
                </div>
              </div>

              {/* Module d'expérimentation et d'actions rapides */}
              <div className="p-4 rounded-xl border border-white/10 bg-[#121622] space-y-3">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-amber-400" />
                  Expérimentations & Déclencheurs de Test
                </h3>
                <p className="text-xs text-slate-400">
                  Déclenchez des tests ciblés pour vérifier individuellement chaque flux avant une démonstration ou pour isoler une anomalie :
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (onSendVoicePulse) onSendVoicePulse();
                      diagnosticLogger.log({
                        level: 'info',
                        source: 'AUDIO_SYS',
                        message: 'Impulsion vocale de test de 1,5s envoyée vers le modèle.',
                        targetScript: 'src/App.tsx (sendSimliDemoVoicePulse)',
                      });
                      setLabsFeedback({
                        type: 'info',
                        text: 'Impulsion vocale sinusoïdale 1,5s envoyée vers le modèle.',
                      });
                    }}
                    className="p-3 rounded-xl border border-white/10 bg-[#0B0D11] hover:bg-white/5 text-left text-xs space-y-1 transition-colors"
                  >
                    <p className="font-bold text-white">Tester l'Impulsion Vocale Simli</p>
                    <p className="text-[11px] text-slate-400">
                      Génère un signal sinusoïdal de test pour faire bouger les lèvres sans micro.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                        stream.getTracks().forEach((t) => t.stop());
                        diagnosticLogger.log({
                          level: 'success',
                          source: 'AUDIO_SYS',
                          message: 'Test Micro RÉUSSI : microphone accessible et autorisé.',
                          targetScript: 'navigator.mediaDevices.getUserMedia({ audio: true })',
                        });
                        setLabsFeedback({
                          type: 'success',
                          text: 'Microphone accessible et opérationnel ✓',
                        });
                      } catch (err) {
                        diagnosticLogger.log({
                          level: 'error',
                          source: 'AUDIO_SYS',
                          message: `Test Micro ÉCHOUÉ : ${err instanceof Error ? err.message : err}`,
                          targetScript: 'src/App.tsx (startSimliMicrophone)',
                          recommendedAction: 'Autoriser le micro dans les paramètres du navigateur.',
                        });
                        setLabsFeedback({
                          type: 'error',
                          text: 'Échec accès microphone. Consultez les logs administrateur.',
                        });
                      }
                    }}
                    className="p-3 rounded-xl border border-white/10 bg-[#0B0D11] hover:bg-white/5 text-left text-xs space-y-1 transition-colors"
                  >
                    <p className="font-bold text-white">Tester l'Autorisation Micro</p>
                    <p className="text-[11px] text-slate-400">
                      Vérifie l'accès du navigateur au matériel audio local.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                        stream.getTracks().forEach((t) => t.stop());
                        diagnosticLogger.log({
                          level: 'success',
                          source: 'CAMERA_SYS',
                          message: 'Test Caméra RÉUSSI : webcam accessible.',
                          targetScript: 'navigator.mediaDevices.getUserMedia({ video: true })',
                        });
                        setLabsFeedback({
                          type: 'success',
                          text: 'Caméra accessible et opérationnelle ✓',
                        });
                      } catch (err) {
                        diagnosticLogger.log({
                          level: 'error',
                          source: 'CAMERA_SYS',
                          message: `Test Caméra ÉCHOUÉ : ${err instanceof Error ? err.message : err}`,
                          targetScript: 'src/App.tsx (toggleCamera)',
                          recommendedAction: 'Brancher une webcam ou autoriser la vidéo.',
                        });
                        setLabsFeedback({
                          type: 'error',
                          text: 'Échec accès caméra. Consultez les logs administrateur.',
                        });
                      }
                    }}
                    className="p-3 rounded-xl border border-white/10 bg-[#0B0D11] hover:bg-white/5 text-left text-xs space-y-1 transition-colors"
                  >
                    <p className="font-bold text-white">Tester l'Autorisation Caméra</p>
                    <p className="text-[11px] text-slate-400">
                      Vérifie l'accès du navigateur au capteur vidéo.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      diagnosticLogger.log({
                        level: 'error',
                        source: 'WEBRTC_SIMLI',
                        message: 'Test simulé : Échec négociation SDP Offer/Answer',
                        targetScript: 'src/simliWebrtc.ts (line 145)',
                        recommendedAction:
                          'Vérifier que les serveurs ICE renvoyés par /api/simli-session sont joignables.',
                      });
                      setLabsFeedback({
                        type: 'info',
                        text: 'Anomalie de test injectée. Consultez l\'onglet "Santé & Diagnostic".',
                      });
                      setActiveTab('health');
                    }}
                    className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-left text-xs space-y-1 transition-colors"
                  >
                    <p className="font-bold text-rose-300">Simuler une Erreur Diagnostic</p>
                    <p className="text-[11px] text-slate-300">
                      Injecte une anomalie factice pour tester le tableau d'identification des pannes.
                    </p>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
