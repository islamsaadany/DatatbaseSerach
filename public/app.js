// Directory page. The UI adapts to the role's capabilities returned by /api/me,
// but the server is the real gate — this only tailors what's shown.
let me = null;
let caps = {};

const searchInput = document.getElementById('search');
const resultsEl = document.getElementById('results');
const addForm = document.getElementById('add-form');
const toastEl = document.getElementById('toast');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const initials = (n) => n.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 1800);
}

const trashSvg = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';

function memberCard(m) {
  const sub = [m.title, m.department].filter(Boolean).map(esc).join(' · ');
  let sensitive = '';
  if (caps.viewSensitive) {
    sensitive = `<div class="sensitive">📞 ${esc(m.phone || '—')} &nbsp;·&nbsp; 💰 ${esc(m.salary || '—')}</div>`;
  }
  const call = caps.viewSensitive && m.phone
    ? `<a class="call-btn" href="tel:${esc(m.phone.replace(/\s+/g, ''))}">Call</a>` : '';
  const del = caps.deleteMember
    ? `<button class="icon-btn danger" data-del="${m.id}" title="Delete" aria-label="Delete ${esc(m.name)}">${trashSvg}</button>` : '';
  return `<div class="card">
    <div class="avatar">${esc(initials(m.name))}</div>
    <div class="info">
      <div class="name">${esc(m.name)}</div>
      ${sub ? `<div class="meta">${sub}</div>` : ''}
      ${sensitive}
    </div>
    <div class="actions">${call}${del}</div>
  </div>`;
}

async function loadMembers() {
  const q = searchInput.value.trim();
  const res = await fetch('/api/members?q=' + encodeURIComponent(q));
  if (res.status === 401) { window.location.href = '/login.html'; return; }
  const list = await res.json();
  resultsEl.innerHTML = list.length
    ? list.map(memberCard).join('')
    : '<div class="empty">No team members found.</div>';
}

async function init() {
  const res = await fetch('/api/me');
  if (res.status === 401) { window.location.href = '/login.html'; return; }
  const data = await res.json();
  me = data.user; caps = data.capabilities || {};

  document.getElementById('whoami').innerHTML =
    `${esc(me.username)}<span class="badge">${esc(me.role)}</span>`;
  if (caps.adminSection) document.getElementById('admin-link').style.display = '';
  if (caps.createMember) addForm.style.display = '';

  const note = document.getElementById('role-note');
  if (caps.viewSensitive) note.textContent = 'Search by name or phone. You can see all fields.';
  else note.textContent = 'Search team members by name. Sensitive fields are hidden for your role.';

  // Non-admins should not see the phone input in the add form.
  if (!caps.editSensitive) {
    const p = document.getElementById('new-phone');
    if (p) p.remove();
  }

  loadMembers();
}

searchInput.addEventListener('input', loadMembers);

addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    name: document.getElementById('new-name').value.trim(),
    title: document.getElementById('new-title').value.trim(),
  };
  const phoneEl = document.getElementById('new-phone');
  if (phoneEl) body.phone = phoneEl.value.trim();
  if (!body.name) return;
  const res = await fetch('/api/members', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.ok) {
    addForm.reset();
    toast('Member added');
    loadMembers();
  } else {
    const d = await res.json().catch(() => ({}));
    toast(d.error || 'Could not add member');
  }
});

resultsEl.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-del]');
  if (!btn) return;
  const id = btn.getAttribute('data-del');
  if (!confirm('Delete this member?')) return;
  const res = await fetch('/api/members/' + id, { method: 'DELETE' });
  if (res.ok) { toast('Member deleted'); loadMembers(); }
  else { const d = await res.json().catch(() => ({})); toast(d.error || 'Could not delete'); }
});

document.getElementById('logout').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/login.html';
});

init();
