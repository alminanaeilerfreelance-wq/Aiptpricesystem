import React from 'react';
import clsx from 'clsx';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: string;
  style?: React.CSSProperties;
}

const Card: React.FC<CardProps> = ({
  children,
  className,
  padding = 'p-6',
  style,
}) => {
  return (
    <div className={clsx('card', padding, className)} style={style}>
      {children}
    </div>
  );
};

export default Card;
