import React, { useState, useEffect, useRef } from 'react';
import { Lock, KeyRound, ShieldAlert, X } from 'lucide-react';
import { diagnosticLogger } from './diagnosticLogger';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError(false);
      setErrorMessage('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPwd = password.trim();

    // Mot de passe exact requis : Jebaisebien (sans ponctuation)
    if (cleanPwd === 'Jebaisebien') {
      try {
        sessionStorage.setItem('facevo_admin_auth', 'true');
      } catch {
        // Fallback si sessionStorage est restreint
      }
      diagnosticLogger.log({
        level: 'success',
        source: 'AUTH_ADMIN',
        message: 'Connexion administrateur réussie via le déclencheur discret.',
        targetScript: 'src/AdminLoginModal.tsx',
      });
      onSuccess();
      onClose();
    } else {
      setError(true);
      setErrorMessage('Mot de passe administrateur incorrect.');
      diagnosticLogger.log({
        level: 'warn',
        source: 'AUTH_ADMIN',
        message: 'Tentative d’accès administrateur rejetée.',
        targetScript: 'src/AdminLoginModal.tsx',
        recommendedAction: 'Utiliser le mot de passe maître confidentiel configuré.',
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#11141B] p-6 shadow-2xl relative text-left"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#FF5734]/15 border border-[#FF5734]/30 flex items-center justify-center text-[#FF5734]">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">
              Espace Administrateur
            </h3>
            <p className="text-[11px] text-slate-400">
              Accès réservé à la supervision technique
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1.5">
              Code de sécurité administrateur
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(false);
                }}
                placeholder="Entrez votre mot de passe…"
                className={`w-full rounded-xl border bg-[#0B0D11] px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none transition-colors ${
                  error
                    ? 'border-rose-500/80 focus:border-rose-500'
                    : 'border-white/15 focus:border-[#FF5734]'
                }`}
              />
              <Lock className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-3 pointer-events-none" />
            </div>
            {error && (
              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-rose-400">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl border border-white/10 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#FF5734] hover:bg-[#FF6B4A] text-white text-xs font-semibold shadow-md transition-colors"
            >
              Déverrouiller
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
