import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <section data-screen="404" style={{ paddingBlock: 'var(--space-6)' }}>
      <h1 style={{ fontSize: 'var(--fs-title)' }}>This page isn't here</h1>
      <p>
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44 }}>
          Back to the start
        </Link>
      </p>
    </section>
  );
}
