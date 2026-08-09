// Admin panel logic. Server enforces admin-only; this page also redirects
// non-admins away as a courtesy.
let me = null;
const ROLES = ['viewer', 'member', 'admin'];

const usersBody = document.getElementById('users-body');
const toastEl = document.getElementById('toast');
const createForm = document.getElementById('create-form');
const createError = document.getElementById('create-error');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 1800);
}

function roleOptions(selected) {
  return ROLES.map((r) => `<option value="${r}" ${r === selected ? 'selected' : ''}>${r}</option>`).join('');
}

function userRow(u) {
  const isSelf = me && u.id === me.id;
  return `<tr data-id="${u.id}">
    <td>${esc(u.username)}${isSelf ? ' <span class="badge">you</span>' : ''}</td>
    <td><select data-role>${roleOptions(u.role)}</select></td>
    <td>${u.active ? 'Active' : 'Inactive'}</td>
    <td>${esc(u.created_at || '')}</td>
    <td class="row-actions">
      <button class="btn small secondary" data-action="save">Save role</button>
      <button class="btn small secondary" data-action="reset">Reset password</button>
      <button class="btn small secondary" data-action="toggle">${u.active ? 'Deactivate' : 'Activate'}</button>
      <button class="btn small danger" data-action="delete">Delete</button>
    </td>
  </tr>`;
}

async function loadUsers() {
  const res = await fetch('/api/admin/users');
  if (res.status === 401) { window.location.href = '/login.html'; return; }
  if (res.status === 403) { window.location.href = '/index.html'; return; }
  const users = await res.json();
  usersBody.innerHTML = users.map(userRow).join('');
}

async function init() {
  const res = await fetch('/api/me');
  if (res.status === 401) { window.location.href = '/login.html'; return; }
  const data = await res.json();
  me = data.user;
  if (!data.capabilities?.adminSection) { window.location.href = '/index.html'; return; }
  document.getElementById('whoami').innerHTML = `${esc(me.username)}<span class="badge">${esc(me.role)}</span>`;
  loadUsers();
}

createForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  createError.classList.remove('show');
  const body = {
    username: document.getElementById('c-username').value.trim(),
    role: document.getElementById('c-role').value,
    password: document.getElementById('c-password').value,
  };
  const res = await fetch('/api/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) { createError.textContent = d.error || 'Could not create user.'; createError.classList.add('show'); return; }
  createForm.reset();
  toast('User created');
  loadUsers();
});

usersBody.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const tr = btn.closest('tr');
  const id = tr.getAttribute('data-id');
  const action = btn.getAttribute('data-action');

  if (action === 'save') {
    const role = tr.querySelector('[data-role]').value;
    await send(id, { role }, 'Role updated');
  } else if (action === 'reset') {
    const pw = prompt('New password (min 8 characters):');
    if (pw == null) return;
    await send(id, { password: pw }, 'Password reset');
  } else if (action === 'toggle') {
    const isActive = btn.textContent.trim() === 'Deactivate';
    await send(id, { active: !isActive }, isActive ? 'User deactivated' : 'User activated');
  } else if (action === 'delete') {
    if (!confirm('Delete this user?')) return;
    const res = await fetch('/api/admin/users/' + id, { method: 'DELETE' });
    const d = await res.json().catch(() => ({}));
    toast(res.ok ? 'User deleted' : (d.error || 'Could not delete'));
    loadUsers();
  }
});

async function send(id, body, okMsg) {
  const res = await fetch('/api/admin/users/' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const d = await res.json().catch(() => ({}));
  toast(res.ok ? okMsg : (d.error || 'Update failed'));
  loadUsers();
}

document.getElementById('logout').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/login.html';
});

init();
