import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'ghost' | 'onDark' | 'gold';

const base =
  'inline-flex items-center justify-center gap-3 rounded-full border-0 px-6 py-3.5 text-[13px] font-extrabold transition duration-200 cursor-pointer';

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-white shadow-lift hover:-translate-y-0.5 hover:bg-brand-600',
  ghost: 'border border-[#c9d1ca] bg-transparent text-brand hover:bg-brand hover:text-white',
  onDark: 'bg-white text-brand hover:-translate-y-0.5 hover:bg-gold',
  gold: 'bg-gold text-brand-900 hover:-translate-y-0.5 hover:bg-gold-soft',
};

interface CommonProps {
  variant?: Variant;
  children: ReactNode;
  className?: string;
}

export function ButtonLink({
  href,
  variant = 'primary',
  children,
  className = '',
}: CommonProps & { href: string }) {
  return (
    <a href={href} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </a>
  );
}

export function Button({
  variant = 'primary',
  children,
  className = '',
  ...props
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`${base} ${variants[variant]} disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 ${className}`}
    >
      {children}
    </button>
  );
}
