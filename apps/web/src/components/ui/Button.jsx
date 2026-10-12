import React from 'react';

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  icon: Icon,
  iconPosition = 'left',
  disabled = false,
  onClick,
  type = 'button',
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-relay-950 disabled:opacity-50 disabled:cursor-not-allowed select-none';

  const sizeStyles = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2 gap-2',
    lg: 'text-base px-6 py-3 gap-2.5',
  };

  const variantStyles = {
    primary:
      'bg-brand hover:bg-brand-hover text-white shadow-lg shadow-brand/20 hover:shadow-brand/35 focus:ring-brand active:scale-[0.98]',
    secondary:
      'bg-relay-800 hover:bg-relay-750 text-relay-100 border border-relay-700 hover:border-relay-600 focus:ring-relay-600 active:scale-[0.98]',
    outline:
      'bg-transparent hover:bg-relay-800 text-relay-300 hover:text-white border border-relay-700 hover:border-relay-600 focus:ring-brand',
    ghost:
      'bg-transparent hover:bg-relay-800/60 text-relay-300 hover:text-white focus:ring-relay-700',
    danger: 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20 focus:ring-red-500',
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {Icon && iconPosition === 'left' && <Icon className="w-4 h-4 shrink-0" />}
      <span>{children}</span>
      {Icon && iconPosition === 'right' && <Icon className="w-4 h-4 shrink-0" />}
    </button>
  );
};
