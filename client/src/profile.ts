import {
  AVATARS,
  type AvatarId,
  getItem,
  OUTFIT_SLOTS,
  type Contact,
  type SocialAction,
  type Outfit,
  type PublicProfile,
} from '@oficina/shared';
import { auth, session } from './session.ts';
let modal: HTMLDialogElement | null = null;
let cancel: (() => void) | null = null;
const slots = { head: 'Acessório', body: 'Roupa', hand: 'Arma' };
const duration = (ms: number) => {
  const m = Math.floor(ms / 60000);
  return m >= 60 ? Math.floor(m / 60) + 'h ' + (m % 60) + 'min' : m + 'min ' + (Math.floor(ms / 1000) % 60) + 's';
};
const date = (ms: number) => new Date(ms).toLocaleDateString('pt-BR');
function el<K extends keyof HTMLElementTagNameMap>(tag: K, value = '', cls = '') {
  const e = document.createElement(tag);
  e.textContent = value;
  e.className = cls;
  return e;
}
function item(id: string | null) {
  const e = el('div', '', 'profile-item'),
    def = getItem(id);
  if (def) {
    const img = el('img');
    img.src = 'assets/items/' + def.id + '.png';
    img.alt = '';
    e.append(img);
  }
  e.append(el('span', def?.name ?? 'Nenhum'));
  return e;
}
function outfit(set: Outfit) {
  const row = el('div', '', 'profile-grid');
  for (const slot of OUTFIT_SLOTS) row.append(item(set[slot]));
  return row;
}
export function closeProfile() {
  refresh = null;
  cancel?.();
  cancel = null;
  if (modal) {
    const d = modal;
    modal = null;
    d.remove();
  }
}
function render(body: HTMLElement, p: PublicProfile) {
  body.replaceChildren();
  const top = el('div', '', 'profile-top'),
    character = el('img'),
    info = el('div');
  character.src = 'assets/avatars/' + (p.avatar ?? 'padrao') + '.png';
  character.alt = p.avatar ? AVATARS[p.avatar] : 'Boneco cinza (padrão)';
  info.append(
    el('h2', p.name),
    el('p', 'Conta criada em ' + date(p.createdAt)),
    el('p', 'Tempo registrado em PvP: ' + duration(p.playMs)),
  );
  top.append(character, info);
  body.append(top);
  info.append(el('p', p.rank ? 'Ranking PvP · ' + p.rank + 'º' : 'Ainda sem posição no ranking'));
  const stats = el('div', '', 'profile-grid');
  for (const [label, value] of [
    ['Vitórias', String(p.wins)],
    ['Derrotas', String(p.losses)],
    ['Empates registrados', String(p.draws)],
    [
      'Taxa de vitórias (decisivas)',
      p.wins + p.losses ? Math.round((p.wins / (p.wins + p.losses)) * 100) + '%' : '—',
    ],
  ]) {
    const cell = el('div', '', 'profile-stat');
    cell.append(el('strong', value), el('span', label));
    stats.append(cell);
  }
  if (p.name === session.name) {
    const actions = el('div');
    actions.append(button('Escolher ícone', () => chooseAvatar(p)), button('Amigos e convites', openContacts));
    top.append(actions);
  }
  body.append(stats, el('h3', 'Set atual'), outfit(p.outfit), el('h3', 'Equipamentos mais utilizados'));
  const fav = el('div', '', 'profile-grid');
  for (const slot of OUTFIT_SLOTS) {
    const f = p.favorites[slot],
      cell = el('div', '', 'profile-stat');
    cell.append(
      el('span', slots[slot]),
      item(f?.id ?? null),
      el('small', f ? f.count + ' partidas' : 'Sem registro'),
    );
    fav.append(cell);
  }
  body.append(
    fav,
    el(
      'p',
      'Tempo, empates e frequência de equipamentos registrados a partir da atualização. Vitórias e derrotas anteriores preservadas.',
      'profile-note',
    ),
    el('h3', 'Últimas partidas PvP'),
  );
  if (!p.history.length) body.append(el('p', 'Nenhuma partida registrada nesta atualização.'));
  for (const row of p.history) {
    const box = el('article', '', 'profile-match');
    box.append(
      el('strong', row.result === 'win' ? 'Vitória' : row.result === 'loss' ? 'Derrota' : 'Empate', row.result),
      el('span', ' · ' + row.opponent + ' · ' + date(row.at)),
      outfit(row.outfit),
    );
    body.append(box);
  }
}
function chooseAvatar(profile: PublicProfile) {
  const { body } = dialog('Escolher ícone de perfil');
  const grid = el('div', '', 'avatar-grid');
  const status = el('p');
  status.setAttribute('role', 'status');
  let saving = false;
  const save = (avatar: AvatarId | null) => {
    if (saving) return;
    saving = true;
    status.textContent = 'Salvando…';
    const off = session.net.on(msg => {
      if (msg.t !== 'avatarSaved' || msg.avatar !== avatar) return;
      openProfile(session.name);
    });
    const timer = setTimeout(() => {
      off();
      saving = false;
      status.textContent = 'Sem confirmação do servidor. Tente novamente.';
    }, 8000);
    cancel = () => { off(); clearTimeout(timer); };
    session.net.send({ t: 'saveAvatar', avatar });
  };
  const choices: (AvatarId | null)[] = [null, ...Object.keys(AVATARS) as AvatarId[]];
  for (const id of choices) {
    const b = button(id ? AVATARS[id] : 'Boneco cinza (padrão)', () => save(id));
    const img = el('img');
    img.src = 'assets/avatars/' + (id ?? 'padrao') + '.png';
    img.alt = '';
    b.prepend(img);
    b.setAttribute('aria-pressed', String((profile.avatar ?? null) === id));
    grid.append(b);
  }
  body.replaceChildren(grid, status);
}

function dialog(title: string) {
  closeProfile();
  const d = el('dialog', '', 'shonen-profile');
  modal = d;
  const header = el('header'),
    close = el('button', 'Fechar'),
    body = el('section', 'Carregando…');
  close.type = 'button';
  close.onclick = closeProfile;
  d.setAttribute('aria-label', title);
  header.append(el('strong', title), close);
  d.append(header, body);
  document.body.append(d);
  d.addEventListener('cancel', (e) => {
    e.preventDefault();
    closeProfile();
  });
  d.showModal();
  return { d, body };
}
export function openProfile(name: string) {
  const { d, body } = dialog('Perfil do jogador');
  if (auth.isGuest) {
    body.textContent = 'Crie uma conta para acessar perfis.';
    return;
  }
  const off = session.net.on((msg) => {
    if (msg.t === 'profile' && msg.profile.name.toLowerCase() === name.toLowerCase()) {
      cancel?.();
      cancel = null;
      render(body, msg.profile);
    }
    if (msg.t === 'profileError' && msg.name.toLowerCase() === name.toLowerCase()) {
      cancel?.();
      cancel = null;
      body.textContent = msg.message;
    }
  });
  const timer = setTimeout(() => {
    off();
    if (modal === d) body.textContent = 'Sem resposta do servidor. Feche e tente novamente.';
    cancel = null;
  }, 8000);
  cancel = () => {
    clearTimeout(timer);
    off();
  };
  session.net.send({ t: 'profile', name });
}
let contacts: Contact[] = [];
const invites = new Map<string, number>();
let refresh: (() => void) | null = null;

function button(label: string, run: () => void) {
  const b = el('button', label);
  b.type = 'button';
  b.onclick = run;
  return b;
}
function relation(name: string, action: SocialAction) {
  session.net.send({ t: 'relationship', name, action });
}

export function openPlayerActions(name: string) {
  if (name === session.name) return openProfile(name);
  const { body } = dialog(name);
  const renderActions = () => {
    body.replaceChildren(button('Ver perfil', () => openProfile(name)));
    const state = contacts.find((c) => c.name === name)?.state;
    if (auth.isGuest) return;
    if (state === 'blocked') {
      body.append(button('Desbloquear', () => relation(name, 'unblock')));
      return;
    }
    if (state === 'friend') {
      body.append(
        button('Convidar para duelo', () => session.net.send({ t: 'duel', name })),
        button('Remover amizade', () => relation(name, 'remove')),
      );
    } else if (state === 'incoming') {
      body.append(
        button('Aceitar amizade', () => relation(name, 'accept')),
        button('Recusar', () => relation(name, 'remove')),
      );
    } else if (state === 'outgoing') {
      body.append(button('Cancelar solicitação', () => relation(name, 'remove')));
    } else {
      body.append(button('Adicionar amigo', () => relation(name, 'request')));
    }
    body.append(button('Bloquear', () => relation(name, 'block')));
    if (state === 'friend' && (invites.get(name) ?? 0) > Date.now()) {
      body.append(button('Aceitar duelo', () => session.net.send({ t: 'duel', name, accept: true })));
    }
  };
  refresh = renderActions;
  renderActions();
}

export function openContacts() {
  const { body } = dialog('Amigos e convites');
  const draw = () => {
    const labels = {
      friend: 'Amigo',
      incoming: 'Quer sua amizade',
      outgoing: 'Solicitação enviada',
      blocked: 'Bloqueado',
    };
    body.replaceChildren();
    if (!contacts.length) body.append(el('p', 'Clique no nome de um jogador no chat para adicionar um amigo.'));
    for (const c of contacts) {
      const row = el('div', '', 'contact-row');
      row.append(
        button(c.name, () => openPlayerActions(c.name)),
        el('span', labels[c.state]),
      );
      if (c.state === 'friend' && (invites.get(c.name) ?? 0) > Date.now())
        row.append(button('Aceitar duelo', () => session.net.send({ t: 'duel', name: c.name, accept: true })));
      body.append(row);
    }
  };
  refresh = draw;
  draw();
  session.net.send({ t: 'social' });
}

session.net.on((msg) => {
  if (msg.t === 'social') {
    contacts = msg.contacts;
    for (const name of invites.keys())
      if (!contacts.some((c) => c.name === name && c.state === 'friend')) invites.delete(name);
    refresh?.();
  } else if (msg.t === 'duelInvite') {
    invites.set(msg.from, Date.now() + 60000);
    refresh?.();
    window.dispatchEvent(new Event('shonen-invite'));
  } else if (msg.t === 'socialNotice' && modal) {
    modal.querySelector('[role=status]')?.remove();
    const line = el('p', msg.message);
    line.setAttribute('role', 'status');
    modal.querySelector('section')?.append(line);
  } else if (msg.t === 'match') {
    invites.clear();
    closeProfile();
  }
});
const style = el('style');
style.textContent = `
.shonen-profile{box-sizing:border-box;width:min(760px,92vw);max-height:88dvh;overflow:auto;color:#fff3dc;background:#21182f;border:4px solid #e8a32b;box-shadow:0 0 0 4px #39180b;border-radius:12px;padding:0;font:16px system-ui,sans-serif}
.shonen-profile::backdrop{background:#0d0a14bb}.shonen-profile header{display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;padding:12px 16px;background:#4b3158;border-bottom:2px solid #e8a32b;color:#ffe28a;z-index:1}
.shonen-profile button{font:inherit;color:#311508;background:#ffc448;border:2px solid #9e4210;padding:6px 12px;cursor:pointer}.shonen-profile section{padding:16px}.shonen-profile h2,.shonen-profile h3{color:#ffe28a;margin:10px 0}.shonen-profile p{margin:6px 0}
.avatar-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(95px,1fr));gap:6px}.avatar-grid button{display:grid;justify-items:center;background:#362749;color:#fff3dc;font-size:14px}.avatar-grid button[aria-pressed=true]{border-color:#ffd45a}.avatar-grid img{width:68px;height:68px;image-rendering:pixelated}.profile-top{display:flex;align-items:center;gap:20px}.profile-top>img{width:96px;height:128px;object-fit:contain;image-rendering:pixelated}
.profile-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(105px,1fr));gap:8px;margin:10px 0}.profile-item,.profile-stat{min-width:0;padding:8px;background:#362749;border:1px solid #85649a;text-align:center;display:flex;flex-direction:column;align-items:center;gap:4px;overflow-wrap:anywhere}
.contact-row{display:flex;align-items:center;gap:12px;padding:8px;border-bottom:1px solid #765383}.shonen-profile section button{margin:4px}.profile-top{flex-wrap:wrap}.profile-item img{width:48px;height:48px;object-fit:contain;image-rendering:pixelated}.profile-stat strong{font-size:26px;color:#ffe28a}.profile-stat>.profile-item{border:0;padding:3px}.profile-note{font-size:13px;color:#d2c0dd}.profile-match{padding:10px;border-top:1px solid #765383}.profile-match .win{color:#7fe0a0}.profile-match .loss{color:#ff9999}.profile-match .draw{color:#ffe28a}
`;
document.head.append(style);
