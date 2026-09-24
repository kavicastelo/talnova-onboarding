import React from 'react';

interface DemoWatermarkProps {
  watermarkText?: string;
}

export const DemoWatermark: React.FC<DemoWatermarkProps> = ({ watermarkText }) => {
  const defaultText = `TALNOVA DEMO | SYNTHETIC ENVIRONMENT | ${new Date().toLocaleDateString()} | CONFIDENTIAL`;
  const text = watermarkText || defaultText;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9999,
        overflow: 'hidden',
        display: 'flex',
        flexWrap: 'wrap',
        alignContent: 'space-around',
        justifyContent: 'space-around',
        opacity: 0.045,
        userSelect: 'none',
      }}
    >
      {Array.from({ length: 48 }).map((_, idx) => (
        <div
          key={idx}
          style={{
            transform: 'rotate(-25deg)',
            padding: '24px 32px',
            fontSize: '13px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: '#0f172a',
            whiteSpace: 'nowrap',
            fontFamily: 'monospace',
          }}
        >
          {text}
        </div>
      ))}
    </div>
  );
};

export default DemoWatermark;
