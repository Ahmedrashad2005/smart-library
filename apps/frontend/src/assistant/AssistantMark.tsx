export function AssistantMark(): JSX.Element {
  return (
    <span className="assistant-mark" aria-hidden="true">
      <svg viewBox="0 0 48 48" fill="none">
        <path d="M8 11.5A6.5 6.5 0 0 1 14.5 5h18A6.5 6.5 0 0 1 39 11.5v15a6.5 6.5 0 0 1-6.5 6.5H24l-8.5 7v-7h-1A6.5 6.5 0 0 1 8 26.5v-15Z" />
        <path d="M17 13.5h14M17 19h10M17 24.5h7" />
        <path
          className="assistant-mark__spark"
          d="m36 3 1.3 4.2 4.2 1.3-4.2 1.3L36 14l-1.3-4.2-4.2-1.3 4.2-1.3L36 3Z"
        />
      </svg>
    </span>
  );
}
