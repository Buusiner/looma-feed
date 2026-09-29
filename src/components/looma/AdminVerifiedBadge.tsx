export function AdminVerifiedBadge() {
  return (
    <span className="admin-verified-badge" role="img" aria-label="Perfil administrativo verificado">
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <path
          fill="currentColor"
          d="M10 1.15c1.12 0 1.75 1.1 2.74 1.52 1.02.43 2.25.08 3.03.86.79.79.43 2.01.86 3.03.42.99 1.52 1.62 1.52 2.74s-1.1 1.75-1.52 2.74c-.43 1.02-.08 2.25-.86 3.03-.79.79-2.01.43-3.03.86-.99.42-1.62 1.52-2.74 1.52s-1.75-1.1-2.74-1.52c-1.02-.43-2.25-.08-3.03-.86-.79-.79-.43-2.01-.86-3.03C2.95 11.75 1.85 11.12 1.85 10s1.1-1.75 1.52-2.74c.43-1.02.08-2.25.86-3.03.79-.79 2.01-.43 3.03-.86C8.25 2.95 8.88 1.85 10 1.15Z"
        />
        <path
          d="m6.4 10 2.14 2.14 5.06-5.06"
          fill="none"
          stroke="var(--verified-badge-check)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.9"
        />
      </svg>
    </span>
  );
}
