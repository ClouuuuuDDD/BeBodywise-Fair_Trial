import { Link } from 'react-router-dom';
import { DrMehr, Icon, Mascot, Sparkle } from '../../ui';
import { common, door } from './copy';
import styles from './ProductDoor.module.css';

/** Screen 01: Product page door. A mock of a Bodywise product page; Add to cart sits directly under the price; the check card sits below it and never replaces it (decisions AC-01-1). */
export default function ProductDoor() {
  return (
    <div className={styles.page} data-screen="01">
      <div className={styles.store}>
        <span>{door.pageLabel}</span>
        <span className={styles.concept}>{common.conceptLabel}</span>
      </div>
      <div className={styles.shot}>
        <Mascot id="rollon" size={150} alt="4% roll-on" style={{ opacity: 0.92 }} />
      </div>
      <div className={styles.info}>
        <h1 data-fit="keep" className={styles.name}>{door.product}</h1>
        <p className={styles.sub}>{door.sub}</p>
        <p className={styles.price}>{door.price}</p>
      </div>
      <button type="button" className={styles.cart} aria-disabled="true" data-testid="add-to-cart" onClick={(e) => e.preventDefault()}>
        {door.addToCart}
      </button>
      <Link to="/?src=bodywise-product-page" className={styles.door} data-testid="door-card">
        <DrMehr pose="avatar" size={64} alt="Dr. Mehr" className={styles.avatar} />
        <span className={styles.text}>
          <span className={styles.title}>{door.cardTitle}</span>
          <span className={styles.body}>{door.cardBody}</span>
        </span>
        <span className={styles.go}>
          <Icon name="chevron" size={20} />
        </span>
        <Sparkle size={20} className={styles.spark} />
      </Link>
      <p className={styles.note}>{door.note}</p>
    </div>
  );
}
