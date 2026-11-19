import { CHAT_MAX_LENGTH } from '@oficina/shared';
import { session } from './session.ts';
import { openPlayerActions, openContacts, closeProfile } from './profile.ts';

/**
 * Chat global (todos os jogadores conectados). Fica num canto da tela, por cima do jogo, nas telas de
 * menu; some no login e na batalha. Começa fechado: um botão com o número de pessoas online e um
 * aviso de mensagens novas.
 */
const STYLE = `
#chat { position: fixed; left: 12px; bottom: 12px; z-index: 20; font-family: 'GameFont', monospace; color: #f4ecd8; }
#chat.hidden { display: none; }
#chat .toggle { background: #1c1a3a; border: 3px solid #f0a830; border-radius: 6px; color: #ffe28a; font: inherit; font-size: 15px;
  padding: 6px 12px; cursor: pointer; box-shadow: 0 3px 0 #0d0a14; }
#chat .toggle .badge { background: #e05050; color: #fff; border-radius: 10px; padding: 0 6px; margin-left: 6px; font-size: 13px; }
#chat .panel { display: none; width: min(360px, calc(100vw - 24px)); height: 300px; background: rgba(20, 18, 40, 0.94);
  border: 3px solid #f0a830; border-radius: 8px; box-shadow: 0 4px 0 #0d0a14; flex-direction: column; margin-bottom: 8px; }
#chat.open .panel { display: flex; }
#chat .head { display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; border-bottom: 2px solid #3a3560;
  color: #ffe28a; font-size: 15px; }
#chat .head button { background: none; border: none; color: #c8d0e8; font: inherit; font-size: 16px; cursor: pointer; }
#chat .list { flex: 1; overflow-y: auto; padding: 6px 10px; font-size: 14px; line-height: 1.35; overflow-wrap: anywhere; }
#chat .list .line { margin: 2px 0; }
#chat .list .who { color: #8fd0ff; background: none; border: 0; padding: 0; font: inherit; cursor: pointer; }
#chat .list .who:hover { text-decoration: underline; }
#chat .list .me .who { color: #7fe0a0; }
#chat .list .time { color: #7f8bb0; font-size: 12px; margin-right: 4px; }
#chat .list .empty { color: #7f8bb0; text-align: center; margin-top: 40px; }
#chat form { display: flex; gap: 6px; padding: 8px; border-top: 2px solid #3a3560; }
#chat input { flex: 1; min-width: 0; background: #0d0a14; border: 2px solid #3a3560; border-radius: 4px; color: #f4ecd8; font: inherit;
  font-size: 14px; padding: 5px 8px; outline: none; }
#chat input:focus { border-color: #f0a830; }
#chat form button { background: #f0a830; border: none; border-radius: 4px; color: #1c1424; font: inherit; font-size: 14px; padding: 0 10px; cursor: pointer; }
`;

let root: HTMLDivElement | null = null;
let list!: HTMLDivElement;
let toggle!: HTMLButtonElement;
let title!: HTMLSpanElement;
let unread = 0;
let online = 0;

function time(at: number) {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function addLine(m: { account?: string; from: string; text: string; at: number }) {
  list.querySelector('.empty')?.remove();
  const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 30;
  const line = document.createElement('div');
  line.className = m.from === session.name ? 'line me' : 'line';
  const t = document.createElement('span');
  t.className = 'time';
  t.textContent = time(m.at);
  const who = document.createElement(m.account ? 'button' : 'span');
  if (who instanceof HTMLButtonElement) {
    who.type = 'button';
    who.addEventListener('click', () => openPlayerActions(m.from));
  }
  who.className = 'who';
  who.textContent = `${m.from}: `;
  const text = document.createElement('span');
  text.textContent = m.text; // textContent: o texto nunca vira HTML
  line.append(t, who, text);
  list.append(line);
  while (list.children.length > 80) list.firstElementChild?.remove();
  if (atBottom || m.from === session.name) list.scrollTop = list.scrollHeight;
}

function refreshLabels() {
  const open = root?.classList.contains('open');
  toggle.innerHTML = '';
  toggle.append(open ? 'Fechar chat' : `Chat · ${online} online`);
  if (!open && unread > 0) {
    const b = document.createElement('span');
    b.className = 'badge';
    b.textContent = String(unread);
    toggle.append(b);
  }
  title.textContent = `Chat global · ${online} online`;
}

function build() {
  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.append(style);

  root = document.createElement('div');
  root.id = 'chat';
  root.className = 'hidden';
  root.innerHTML = `
    <div class="panel">
      <div class="head"><span class="title"></span><button type="button" class="contacts">Amigos</button><button type="button" aria-label="Fechar chat">✕</button></div>
      <div class="list"><div class="empty">Ninguém falou ainda. Diga oi!</div></div>
      <form><input maxlength="${CHAT_MAX_LENGTH}" placeholder="Escreva uma mensagem" aria-label="Mensagem do chat" /><button type="submit">Enviar</button></form>
    </div>
    <button type="button" class="toggle"></button>`;
  document.body.append(root);
  list = root.querySelector('.list')!;
  toggle = root.querySelector('.toggle')!;
  title = root.querySelector('.title')!;
  const input = root.querySelector('input')!;
  const setOpen = (v: boolean) => {
    root!.classList.toggle('open', v);
    if (v) {
      unread = 0;
      list.scrollTop = list.scrollHeight;
      input.focus();
    }
    refreshLabels();
  };
  toggle.addEventListener('click', () => setOpen(!root!.classList.contains('open')));
  const contacts = root.querySelector<HTMLButtonElement>('.contacts')!;
  contacts.onclick = () => { contacts.textContent = 'Amigos'; openContacts(); };
  window.addEventListener('shonen-invite', () => { contacts.textContent = 'Convite de duelo'; unread++; refreshLabels(); });
  root.querySelector('[aria-label="Fechar chat"]')!.addEventListener('click', () => setOpen(false));
  root.querySelector('form')!.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    session.net.send({ t: 'chat', text });
    input.value = '';
  });
  // Teclas digitadas no chat não vão para o jogo.
  input.addEventListener('keydown', (e) => e.stopPropagation());

  session.net.on((m) => {
    if (m.t === 'social') {
      const pending = m.contacts.filter(c => c.state === 'incoming').length;
      contacts.textContent = pending ? 'Amigos (' + pending + ')' : 'Amigos';
    } else if (m.t === 'chatHistory') {
      list.innerHTML = '';
      if (!m.messages.length) list.innerHTML = '<div class="empty">Ninguém falou ainda. Diga oi!</div>';
      for (const line of m.messages) addLine(line);
      list.scrollTop = list.scrollHeight;
    } else if (m.t === 'chat') {
      addLine(m);
      if (!root!.classList.contains('open') && m.from !== session.name) unread++;
      refreshLabels();
    } else if (m.t === 'online') {
      online = m.count;
      refreshLabels();
    }
  });
  refreshLabels();
}

/** Mostra ou esconde o chat (as cenas de menu mostram; login e batalha escondem). */
export function setChatVisible(v: boolean) {
  if (!root) build();
  root!.classList.toggle('hidden', !v);
  if (!v) { root!.classList.remove('open'); closeProfile(); }
  refreshLabels();
}

// Monta logo ao carregar o jogo (escondido), para não perder mensagens que chegam antes da primeira tela.
build();
