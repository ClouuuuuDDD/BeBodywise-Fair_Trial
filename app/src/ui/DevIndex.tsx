import { Link } from 'react-router-dom';
import { allScreenRoutes } from '../routes';
import type { ScreenHandle } from './routeMeta';

/** /dev: every route with its screen number and owner. A build aid, not a product screen. */
export default function DevIndex() {
  return (
    <section style={{ paddingBlock: 'var(--space-6)' }}>
      <h1 style={{ fontSize: 'var(--fs-title)' }}>All screens</h1>
      <ul style={{ paddingLeft: 0, listStyle: 'none' }}>
        {allScreenRoutes.map((r) => {
          const h = r.handle as ScreenHandle;
          const to = (r.path ?? '/').replace(':step', '2');
          return (
            <li key={r.path} style={{ minHeight: 'var(--tap-min)' }}>
              <Link to={to}>
                {h.screen} {h.title}
              </Link>{' '}
              <span style={{ color: 'var(--ink-muted)' }}>
                {r.path} · {h.owner}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
