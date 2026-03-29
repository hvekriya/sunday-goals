/** Sent with mutating requests after admin unlock (same value as ADMIN_PASSWORD on server). */
export function adminHeaders() {
  try {
    const p = sessionStorage.getItem('adminPassword');
    return p ? { 'X-Admin-Password': p } : {};
  } catch {
    return {};
  }
}
