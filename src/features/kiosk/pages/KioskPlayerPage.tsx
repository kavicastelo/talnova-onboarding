import React from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { KioskPlayerProvider } from '../context/KioskPlayerContext';
import { KioskPlayer } from '../components/KioskPlayer';

export const KioskPlayerPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  if (!id) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-950 text-white">
        <p className="text-lg font-medium text-rose-400">Invalid Playback ID</p>
      </div>
    );
  }

  // Parse signed playback credentials
  const o = searchParams.get('o') || '';
  const exp = searchParams.get('exp') || '';
  const sig = searchParams.get('sig') || '';

  const signedParams = o && exp && sig ? { o, exp, sig } : undefined;

  const handleExit = () => {
    navigate(-1); // Back to previous page or dashboard
  };

  return (
    <KioskPlayerProvider>
      <KioskPlayer 
        journeyId={id} 
        signedParams={signedParams}
        onExit={handleExit}
        isAdminPreview={!signedParams} // If it's not signed, it's administrative preview inside the console
      />
    </KioskPlayerProvider>
  );
};
