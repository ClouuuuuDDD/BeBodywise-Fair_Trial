import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { BodyArea, UseTime } from '../../contracts';
import { track } from '../../state';
import { removeShelfItem, updateShelfItem, useRightStart } from '../../state/rightStart';
import { AppShell, BottomBar, CheckChip, Icon, PrimaryButton, Sheet, TextLink } from '../../ui';
import { ShelfRow } from './components/ShelfRow';
import { ShelfStrip } from './components/ShelfStrip';
import { confirm, shelf as t } from './copy';
import styles from './Shelf.module.css';

/** Screen 04: Your shelf. Her exact products as a cast; empty is fine, the check still runs. */
export default function Shelf() {
  const s = useRightStart();
  const location = useLocation();
  const justAdded = (location.state as { added?: string } | null)?.added;
  const [editId, setEditId] = useState<string | undefined>();
  const editing = s.shelf.find((i) => i.id === editId);

  function toggleArea(area: BodyArea, on: boolean) {
    if (!editing) return;
    const areas = on ? [...editing.areas, area] : editing.areas.filter((a) => a !== area);
    if (areas.length === 0) return;
    void updateShelfItem(editing.id, { areas });
    track('shelf_item_edited', '04', { field: 'areas', classes: editing.classes });
  }

  async function remove() {
    if (!editing) return;
    const id = editing.id;
    setEditId(undefined);
    const gone = await removeShelfItem(id);
    if (gone) track('shelf_item_removed', '04', { source: gone.source, classes: gone.classes });
  }

  if (!s.ready) return null;

  return (
    <AppShell screen="04" header={{ back: '/check/5', title: t.runningHead, step: { current: 4, total: 5 } }}>
      <div className={styles.intro}>
        <h1 className={styles.title}>{t.title}</h1>
        <p className={styles.lead}>{t.lead}</p>
      </div>
      <ShelfStrip items={s.shelf} justAdded={justAdded} />
      <div className={styles.list}>
        {s.shelf.length === 0 ? <p className={styles.empty}>{t.empty}</p> : null}
        {s.shelf.map((item) => (
          <ShelfRow key={item.id} item={item} onOpen={() => setEditId(item.id)} />
        ))}
        <Link to="/check/shelf/add" className={styles.add} data-testid="add-product">
          <Icon name="plus" size={20} />
          {t.add}
        </Link>
      </div>
      <BottomBar>
        <PrimaryButton to="/check/shelf/answer">{t.primary}</PrimaryButton>
      </BottomBar>

      <Sheet
        open={editing !== undefined}
        onClose={() => setEditId(undefined)}
        title={editing?.product ?? t.edit}
        footer={
          <TextLink tone="muted" onClick={() => void remove()} data-testid="remove-item">
            {t.remove}
          </TextLink>
        }
      >
        {editing ? (
          <div className={styles.sheetBody}>
            <p className={styles.q}>{confirm.where}</p>
            <div className={styles.chips}>
              {confirm.whereOptions.map((o) => (
                <CheckChip
                  key={o.value}
                  value={o.value}
                  label={o.label}
                  checked={editing.areas.includes(o.value as BodyArea)}
                  onChange={(on) => toggleArea(o.value as BodyArea, on)}
                />
              ))}
            </div>
            <p className={styles.q}>{confirm.when}</p>
            <div className={styles.chips}>
              {confirm.whenOptions.map((o) => (
                <CheckChip
                  key={o.value}
                  value={o.value}
                  label={o.label}
                  checked={editing.times === o.value}
                  onChange={() => {
                    if (editing.times === o.value) return;
                    void updateShelfItem(editing.id, { times: o.value as UseTime });
                    track('shelf_item_edited', '04', { field: 'time', classes: editing.classes });
                  }}
                />
              ))}
            </div>
          </div>
        ) : null}
      </Sheet>
    </AppShell>
  );
}
