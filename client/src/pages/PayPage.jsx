import { Link } from 'react-router-dom';
import styles from './PayPage.module.css';

const MONZO_URL = 'https://monzo.me/hareshvekriya/6.00?h=5sjQkW&d=Goals';

export default function PayPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/" className={styles.back}>← Home</Link>
        <h1 className={styles.title}>Pay for Goals</h1>
        <p className={styles.sub}>
          Pay your session fee securely with Monzo.me. After paying, the organiser can mark you as paid on the team sheet.
        </p>
      </header>

      <section className={styles.card}>
        <p className={styles.amount}>Payment amount: £6.00</p>
        <a href={MONZO_URL} className={styles.monzoBtn} target="_blank" rel="noopener noreferrer">
          Pay now via Monzo
        </a>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => navigator.clipboard.writeText(MONZO_URL)}
        >
          Copy payment link
        </button>
        <p className={styles.note}>
          You will leave this site to complete payment on{' '}
          <span className={styles.mono}>monzo.me</span>. UK Monzo users only — see Monzo for terms.
        </p>
      </section>
    </div>
  );
}
