/**
 * Minimal pagination control.
 *
 * props:
 *   page       1-indexed current page
 *   totalPages
 *   onChange(nextPage)
 */
export default function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;

  const go = (n) => onChange(Math.max(1, Math.min(totalPages, n)));

  // Render a compact list: 1 … (page-1) page (page+1) … last
  const pages = [];
  const push = (n) => pages.push(n);
  const ellipsis = '…';

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) push(i);
  } else {
    push(1);
    if (page > 3) push(ellipsis);
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) push(i);
    if (page < totalPages - 2) push(ellipsis);
    push(totalPages);
  }

  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        type="button"
        className="page-btn"
        onClick={() => go(page - 1)}
        disabled={page === 1}
        aria-label="Previous page"
      >
        ‹ Prev
      </button>
      {pages.map((p, i) => (
        p === ellipsis ? (
          <span key={`e${i}`} className="page-ellipsis">{ellipsis}</span>
        ) : (
          <button
            key={p}
            type="button"
            className={`page-btn ${p === page ? 'active' : ''}`}
            onClick={() => go(p)}
            aria-current={p === page ? 'page' : undefined}
          >
            {p}
          </button>
        )
      ))}
      <button
        type="button"
        className="page-btn"
        onClick={() => go(page + 1)}
        disabled={page === totalPages}
        aria-label="Next page"
      >
        Next ›
      </button>
    </nav>
  );
}
