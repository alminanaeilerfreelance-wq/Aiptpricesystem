import React from 'react';
import clsx from 'clsx';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: string;
}

const Card: React.FC<CardProps> = ({ children, className, padding = 'p-6' }) => {
  return (
    <div className={clsx('card', padding, className)}>
      {children}
    </div>
  );
};

export default Card;
