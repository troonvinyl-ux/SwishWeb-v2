import { cn } from '@/lib/utils';

type SwishFlipMarkProps = {
  className?: string;
  compact?: boolean;
  descriptor?: boolean;
  tone?: 'light' | 'dark';
};

/**
 * The master platform mark. It is deliberately vector-based so it remains crisp
 * in the application shell, on the public site and at compact navigation sizes.
 */
export function SwishFlipMark({ className, compact = false, descriptor = false, tone = 'light' }: SwishFlipMarkProps) {
  const swish = tone === 'dark' ? '#071C26' : '#F5F8FA';
  const flip = '#F4C65D';
  const muted = tone === 'dark' ? '#102D39' : '#91A6B2';

  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2', className)}>
      <svg aria-hidden="true" viewBox="0 0 64 64" className="h-9 w-9 shrink-0" fill="none">
        <path d="M15 25V17a2 2 0 0 1 2-2h8M39 15h8a2 2 0 0 1 2 2v8M49 39v8a2 2 0 0 1-2 2h-8M25 49h-8a2 2 0 0 1-2-2v-8" stroke={flip} strokeWidth="3" strokeLinecap="round" />
        <path d="M45.5 20.5c-3.2-3-7.9-4.8-13.1-4.8-8.5 0-15.4 4.3-15.4 9.6 0 5.2 6.5 7.2 14.6 8.5 6.4 1 10.4 2 10.4 5.2 0 3.6-4.9 6.2-11 6.2-6.8 0-11.6-2.7-14.2-6.2" stroke={flip} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M20 42.5c3.1 3.7 7.2 5.8 12.2 5.8 8.7 0 15.8-4.8 15.8-10.8 0-5.3-5.8-7.6-14.3-8.9-6.8-1-10.7-1.9-10.7-5 0-3.4 4.4-5.8 10.1-5.8 5.5 0 9.8 2.1 12.4 5.3" stroke="#19B5AC" strokeWidth="2.1" strokeLinecap="round" opacity=".9" />
      </svg>
      {!compact && <span className="min-w-0 leading-none">
        <span className="block whitespace-nowrap text-[1.16rem] font-extrabold italic tracking-[-.06em] sm:text-xl"><span style={{ color: swish }}>SWISH</span><span style={{ color: flip }}>FLIP</span></span>
        {descriptor && <span className="mt-1 block whitespace-nowrap text-[8px] font-semibold uppercase tracking-[.18em]" style={{ color: muted }}>The intelligent reseller platform</span>}
      </span>}
    </span>
  );
}
