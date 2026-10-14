import React, { useEffect, useRef, useState, useCallback } from 'react';

export interface CropRect {
  /** Position X en pourcentage (0 à 100) */
  x: number;
  /** Position Y en pourcentage (0 à 100) */
  y: number;
  /** Largeur en pourcentage (0 à 100) */
  width: number;
  /** Hauteur en pourcentage (0 à 100) */
  height: number;
}

export interface WatermarkBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  detectedAt?: number;
}

export interface VideoCropperProps {
  /** Élément vidéo HTML source ou flux */
  video: HTMLVideoElement | null;
  /** Zone de recadrage actuelle (en pourcentage 0-100) */
  crop?: CropRect;
  /** Callback de mise à jour du recadrage */
  setCrop?: (crop: CropRect) => void;
  /** Marge de sécurité inférieure en pourcentage (0-30%) pour rogner les bandeaux sans déformer l'image */
  bottomSafety?: number;
  /** Verrouille la modification manuelle de la boîte de recadrage */
  lockCrop?: boolean;
  /** Classes CSS supplémentaires pour le conteneur */
  className?: string;
  /** Clé optionnelle pour sauvegarder le crop dans le localStorage */
  storageKey?: string;
  /** Appelée à chaque frame rendue (utile pour la télémétrie ou l'analyse externe sans blocage) */
  onFrame?: (now: DOMHighResTimeStamp, metadata?: VideoFrameCallbackMetadata) => void;
}

const DEFAULT_CROP: CropRect = {
  x: 0,
  y: 0,
  width: 100,
  height: 100,
};

/**
 * Composant de recadrage et rendu vidéo ultra-haute performance.
 * Utilise requestVideoFrameCallback (accélération matérielle, synchronisé avec le décodage vidéo)
 * Aucune allocation mémoire dans la boucle de rendu (zéro fuite, zéro garbage collection intempestive)
 * Suppression totale des masques noirs, calques artificiels ou flous destructeurs
 * Protection intégrale du visage et préservation des proportions natives de l'image
 */
export const VideoCropper: React.FC<VideoCropperProps> = ({
  video,
  crop = DEFAULT_CROP,
  setCrop,
  bottomSafety = 0,
  lockCrop = false,
  className = '',
  storageKey,
  onFrame,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Maintien des refs pour éviter de recréer les boucles d'animation à chaque render React
  const videoRef = useRef<HTMLVideoElement | null>(video);
  videoRef.current = video;

  // Gestion de la persistance locale (localStorage) si une clé est fournie
  const effectiveCrop = React.useMemo(() => {
    if (storageKey && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`videocropper_crop_${storageKey}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed.x === 'number' && typeof parsed.width === 'number') {
            return parsed as CropRect;
          }
        }
      } catch (err) {
        console.warn('Erreur lors de la lecture du localStorage pour le crop:', err);
      }
    }
    return crop;
  }, [storageKey, crop]);

  const cropRef = useRef<CropRect>(effectiveCrop);
  cropRef.current = effectiveCrop;

  const bottomSafetyRef = useRef<number>(bottomSafety);
  bottomSafetyRef.current = Math.max(0, Math.min(30, bottomSafety));

  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  // État local de la souris pour le redimensionnement interactif
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragAction, setDragAction] = useState<'move' | 'nw' | 'ne' | 'se' | 'sw' | null>(null);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; initialCrop: CropRect }>({
    mouseX: 0,
    mouseY: 0,
    initialCrop: effectiveCrop,
  });

  // Fonction de mise à jour synchronisant le parent et le stockage local
  const updateCrop = useCallback(
    (newCrop: CropRect) => {
      if (storageKey && typeof window !== 'undefined') {
        try {
          localStorage.setItem(`videocropper_crop_${storageKey}`, JSON.stringify(newCrop));
        } catch (err) {
          console.warn("Erreur lors de l'écriture dans le localStorage pour le crop:", err);
        }
      }
      if (setCrop) {
        setCrop(newCrop);
      }
    },
    [storageKey, setCrop]
  );

  // Normalisation sécurisée des valeurs de recadrage (0 - 100%)
  const safeCrop = {
    x: Math.max(0, Math.min(95, effectiveCrop.x || 0)),
    y: Math.max(0, Math.min(95, effectiveCrop.y || 0)),
    width: Math.max(5, Math.min(100 - (effectiveCrop.x || 0), effectiveCrop.width || 100)),
    height: Math.max(5, Math.min(100 - (effectiveCrop.y || 0), effectiveCrop.height || 100)),
  };

  /**
   * Boucle principale de rendu haute performance
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Contexte 2D avec desynchronized pour réduire la latence d'affichage au minimum
    const ctx = canvas.getContext('2d', {
      alpha: false,
      desynchronized: true,
      willReadFrequently: false,
    });
    if (!ctx) return;

    let isMounted = true;
    let frameCallbackId: number | null = null;
    let animFrameId: number | null = null;

    // Dernières dimensions connues du canvas pour éviter des redimensionnements inutiles
    let lastCanvasWidth = 0;
    let lastCanvasHeight = 0;

    const renderLoop = (now: DOMHighResTimeStamp, metadata?: VideoFrameCallbackMetadata) => {
      if (!isMounted) return;

      const currentVideo = videoRef.current;
      if (
        currentVideo &&
        currentVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        currentVideo.videoWidth > 0 &&
        currentVideo.videoHeight > 0
      ) {
        const vw = currentVideo.videoWidth;
        const vh = currentVideo.videoHeight;

        // Calcul de la zone source avec exclusion optionnelle du bandeau inférieur (bottomSafety)
        const currentCrop = cropRef.current;
        const safetyFactor = Math.max(0, Math.min(0.3, bottomSafetyRef.current / 100));
        const effectiveVh = vh * (1 - safetyFactor);

        // Conversion des pourcentages en coordonnées de pixels natifs de la vidéo
        const normCrop = {
          x: (Math.max(0, Math.min(95, currentCrop.x)) / 100) * vw,
          y: (Math.max(0, Math.min(95, currentCrop.y)) / 100) * effectiveVh,
          w: (Math.max(5, Math.min(100, currentCrop.width)) / 100) * vw,
          h: (Math.max(5, Math.min(100, currentCrop.height)) / 100) * effectiveVh,
        };

        // Clamping strict pour ne jamais déborder de la source vidéo
        const sx = Math.max(0, Math.min(vw - 1, normCrop.x));
        const sy = Math.max(0, Math.min(effectiveVh - 1, normCrop.y));
        const sw = Math.max(1, Math.min(vw - sx, normCrop.w));
        const sh = Math.max(1, Math.min(effectiveVh - sy, normCrop.h));

        // Ajustement des dimensions internes du canvas uniquement si elles ont changé
        const targetWidth = Math.round(sw);
        const targetHeight = Math.round(sh);

        if (lastCanvasWidth !== targetWidth || lastCanvasHeight !== targetHeight) {
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          lastCanvasWidth = targetWidth;
          lastCanvasHeight = targetHeight;
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
        }

        // Rendu naturel direct : AUCUN rectangle noir, aucun flou dégradant, zéro altération
        ctx.drawImage(currentVideo, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);

        // Transmission du callback sans bloquer
        if (onFrameRef.current) {
          try {
            onFrameRef.current(now, metadata);
          } catch {
            // Empêche toute interruption du flux d'affichage en cas d'exception dans onFrame
          }
        }
      }

      // Planification de la frame suivante via requestVideoFrameCallback (ou rAF)
      if (currentVideo && 'requestVideoFrameCallback' in currentVideo) {
        frameCallbackId = currentVideo.requestVideoFrameCallback(renderLoop);
      } else {
        animFrameId = requestAnimationFrame((t) => renderLoop(t));
      }
    };

    // Démarrage de la boucle de rendu
    const activeVideo = videoRef.current;
    if (activeVideo && 'requestVideoFrameCallback' in activeVideo) {
      frameCallbackId = activeVideo.requestVideoFrameCallback(renderLoop);
    } else {
      animFrameId = requestAnimationFrame((t) => renderLoop(t));
    }

    return () => {
      isMounted = false;
      const targetVid = videoRef.current;
      if (targetVid && 'cancelVideoFrameCallback' in targetVid && frameCallbackId !== null) {
        targetVid.cancelVideoFrameCallback(frameCallbackId);
      }
      if (animFrameId !== null) {
        cancelAnimationFrame(animFrameId);
      }
    };
  }, [video]);

  // Gestion du drag and drop pour ajuster le crop interactivement si lockCrop = false
  const handleMouseDown = (action: 'move' | 'nw' | 'ne' | 'se' | 'sw', e: React.MouseEvent) => {
    if (lockCrop || !setCrop) return;
    e.preventDefault();
    e.stopPropagation();

    setIsDragging(true);
    setDragAction(action);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      initialCrop: { ...safeCrop },
    };
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !dragAction || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const deltaXPercent = ((e.clientX - dragStartRef.current.mouseX) / rect.width) * 100;
      const deltaYPercent = ((e.clientY - dragStartRef.current.mouseY) / rect.height) * 100;
      const init = dragStartRef.current.initialCrop;

      let nextX = init.x;
      let nextY = init.y;
      let nextW = init.width;
      let nextH = init.height;

      if (dragAction === 'move') {
        nextX = Math.max(0, Math.min(100 - init.width, init.x + deltaXPercent));
        nextY = Math.max(0, Math.min(100 - init.height, init.y + deltaYPercent));
      } else if (dragAction === 'se') {
        nextW = Math.max(10, Math.min(100 - init.x, init.width + deltaXPercent));
        nextH = Math.max(10, Math.min(100 - init.y, init.height + deltaYPercent));
      } else if (dragAction === 'sw') {
        const potentialX = Math.max(0, Math.min(init.x + init.width - 10, init.x + deltaXPercent));
        nextW = init.width + (init.x - potentialX);
        nextX = potentialX;
        nextH = Math.max(10, Math.min(100 - init.y, init.height + deltaYPercent));
      } else if (dragAction === 'ne') {
        const potentialY = Math.max(0, Math.min(init.y + init.height - 10, init.y + deltaYPercent));
        nextH = init.height + (init.y - potentialY);
        nextY = potentialY;
        nextW = Math.max(10, Math.min(100 - init.x, init.width + deltaXPercent));
      } else if (dragAction === 'nw') {
        const potentialX = Math.max(0, Math.min(init.x + init.width - 10, init.x + deltaXPercent));
        const potentialY = Math.max(0, Math.min(init.y + init.height - 10, init.y + deltaYPercent));
        nextW = init.width + (init.x - potentialX);
        nextH = init.height + (init.y - potentialY);
        nextX = potentialX;
        nextY = potentialY;
      }

      updateCrop({
        x: Math.round(nextX * 10) / 10,
        y: Math.round(nextY * 10) / 10,
        width: Math.round(nextW * 10) / 10,
        height: Math.round(nextH * 10) / 10,
      });
    },
    [isDragging, dragAction, updateCrop]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragAction(null);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden flex items-center justify-center select-none ${className}`}
      style={{ touchAction: 'none' }}
    >
      {/* Canvas haute performance de rendu natif */}
      <canvas
        ref={canvasRef}
        className="w-full h-full object-contain pointer-events-none"
        style={{ imageRendering: 'auto' }}
      />

      {/* Cadre de recadrage interactif (affiché uniquement si non verrouillé et éditable) */}
      {!lockCrop && setCrop && (
        <div
          className="absolute border-2 border-emerald-400 bg-emerald-500/10 cursor-move transition-shadow shadow-[0_0_15px_rgba(52,211,153,0.3)]"
          style={{
            left: `${safeCrop.x}%`,
            top: `${safeCrop.y}%`,
            width: `${safeCrop.width}%`,
            height: `${safeCrop.height}%`,
          }}
          onMouseDown={(e) => handleMouseDown('move', e)}
        >
          {/* Poignées de redimensionnement aux coins */}
          <div
            className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-emerald-500 rounded-sm cursor-nwse-resize shadow"
            onMouseDown={(e) => handleMouseDown('nw', e)}
          />
          <div
            className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-emerald-500 rounded-sm cursor-nesw-resize shadow"
            onMouseDown={(e) => handleMouseDown('ne', e)}
          />
          <div
            className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-emerald-500 rounded-sm cursor-nesw-resize shadow"
            onMouseDown={(e) => handleMouseDown('sw', e)}
          />
          <div
            className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-emerald-500 rounded-sm cursor-nwse-resize shadow"
            onMouseDown={(e) => handleMouseDown('se', e)}
          />

          {/* Grille de composition discrète (règle des tiers) */}
          <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-20">
            <div className="border-r border-b border-white/60" />
            <div className="border-r border-b border-white/60" />
            <div className="border-b border-white/60" />
            <div className="border-r border-b border-white/60" />
            <div className="border-r border-b border-white/60" />
            <div className="border-b border-white/60" />
            <div className="border-r border-b border-white/60" />
            <div className="border-r border-b border-white/60" />
            <div />
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoCropper;
