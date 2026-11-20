import React, { useState } from 'react';

export default function QrImage({ qid, alt = 'QR code', style, className }) {
  const [retryCount, setRetryCount] = useState(0);

  const handleError = () => {
    if (retryCount < 4) {
      setTimeout(() => {
        setRetryCount(prev => prev + 1);
      }, 1200);
    }
  };

  if (!qid) return null;

  const src = retryCount > 0
    ? `/api/questions/${qid}/qr.svg?r=${retryCount}`
    : `/api/questions/${qid}/qr.svg`;

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={handleError}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        ...style
      }}
    />
  );
}
