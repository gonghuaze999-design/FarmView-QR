import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={`animate-pulse bg-zinc-200 rounded-lg ${className}`}></div>
  );
};
