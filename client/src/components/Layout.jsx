import { NavLink, Outlet } from 'react-router-dom';
import styles from './Layout.module.css';

export default function Layout() {
  return (
    <div className={styles.shell}>
      <nav className={styles.nav} aria-label="Main">
        <NavLink to="/" className={({ isActive }) => (isActive ? styles.active : undefined)} end>
          Balancer
        </NavLink>
        <NavLink to="/players" className={({ isActive }) => (isActive ? styles.active : undefined)}>
          Players
        </NavLink>
        <NavLink to="/sessions" className={({ isActive }) => (isActive ? styles.active : undefined)}>
          Sessions
        </NavLink>
        <NavLink to="/pay" className={({ isActive }) => (isActive ? styles.active : undefined)}>
          Pay
        </NavLink>
      </nav>
      <Outlet />
    </div>
  );
}
