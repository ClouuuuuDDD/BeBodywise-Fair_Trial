import { useLocation } from 'react-router-dom';

interface Props {
  /** Screen number, e.g. "03b". */
  screen: string;
  /** Screen name. */
  title: string;
  /** Route pattern, e.g. "/check/:step". */
  route: string;
}

/** Stand-in for a screen that is not built yet: title + route name. Delete when the screen lands. */
export function ScreenPlaceholder({ screen, title, route }: Props) {
  const { pathname } = useLocation();
  return (
    <section aria-labelledby="screen-title" style={{ paddingBlock: 'var(--space-6)' }}>
      <p className="micro-label">
        Fair Trial · Concept for Be Bodywise · Screen {screen}
      </p>
      <h1 id="screen-title" style={{ fontSize: 'var(--fs-title)', marginBlock: 'var(--space-4)' }}>
        {title}
      </h1>
      <p style={{ color: 'var(--ink-muted)' }}>
        Route <code>{route}</code>
        {pathname !== route ? (
          <>
            {' '}
            (at <code>{pathname}</code>)
          </>
        ) : null}
      </p>
    </section>
  );
}
