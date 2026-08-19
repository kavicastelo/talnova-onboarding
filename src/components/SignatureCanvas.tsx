import React, { useRef, useState, useEffect } from 'react';
import { Button } from './Button';
import { Input } from './Input';
import { Eraser, PenTool, Type } from 'lucide-react';

interface SignatureCanvasProps {
  onSave: (data: { type: 'draw' | 'type'; signatureDataUrl?: string; signerName: string }) => void;
  defaultSignerName?: string;
}

export const SignatureCanvas: React.FC<SignatureCanvasProps> = ({ onSave, defaultSignerName = '' }) => {
  const [activeTab, setActiveTab] = useState<'draw' | 'type'>('draw');
  const [signerName, setSignerName] = useState(defaultSignerName);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    if (activeTab === 'draw' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, [activeTab]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    setHasDrawn(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleConfirm = () => {
    if (!signerName.trim()) {
      alert('Please enter your full legal name.');
      return;
    }

    if (activeTab === 'draw') {
      const canvas = canvasRef.current;
      if (!canvas || !hasDrawn) {
        alert('Please draw your signature on the canvas.');
        return;
      }
      const dataUrl = canvas.toDataURL('image/png');
      onSave({ type: 'draw', signatureDataUrl: dataUrl, signerName });
    } else {
      onSave({ type: 'type', signerName });
    }
  };

  return (
    <div className="space-y-4">
      {/* Mode Switcher Tabs */}
      <div className="flex border-b text-sm font-medium">
        <button
          className={`py-2 px-4 border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'draw'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('draw')}
        >
          <PenTool className="h-4 w-4" /> Draw Signature
        </button>
        <button
          className={`py-2 px-4 border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'type'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('type')}
        >
          <Type className="h-4 w-4" /> Type Signature
        </button>
      </div>

      {/* Signer Legal Name Input */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground block mb-1">
          Full Legal Name (Required)
        </label>
        <Input
          placeholder="e.g. John Doe"
          value={signerName}
          onChange={(e: any) => setSignerName(e.target.value)}
        />
      </div>

      {/* Mode Body */}
      {activeTab === 'draw' ? (
        <div className="space-y-2">
          <div className="border-2 border-dashed rounded-lg bg-card p-2 relative text-center">
            <canvas
              ref={canvasRef}
              width={500}
              height={180}
              className="w-full h-44 cursor-crosshair touch-none bg-white rounded"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
            <div className="text-[11px] text-muted-foreground mt-1">
              Draw your signature above using mouse or touch
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={clearCanvas} className="text-xs text-muted-foreground">
              <Eraser className="h-3.5 w-3.5 mr-1" /> Clear Canvas
            </Button>
          </div>
        </div>
      ) : (
        <div className="border-2 border-dashed rounded-lg p-6 bg-white text-center">
          <div className="text-3xl font-serif italic text-slate-800 tracking-wide select-none py-4">
            {signerName || 'Your Signature Preview'}
          </div>
          <p className="text-xs text-muted-foreground">
            Typed signature formatted with legal timestamp verification.
          </p>
        </div>
      )}

      {/* Action Footer */}
      <div className="pt-2 flex justify-end gap-2">
        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white w-full sm:w-auto" onClick={handleConfirm}>
          Apply E-Signature
        </Button>
      </div>
    </div>
  );
};

export default SignatureCanvas;
