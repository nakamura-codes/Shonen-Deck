import { figureKey, getItem, OUTFIT_SLOTS, type Outfit, type PublicProfile } from '@oficina/shared';
import { auth, session } from './session.ts';
let modal: HTMLDialogElement | null = null;
let cancel: (()=>void) | null = null;
const slots={head:'Acessório',body:'Roupa',hand:'Arma'};
const duration=(ms:number)=>{const m=Math.floor(ms/60000);return m>=60?Math.floor(m/60)+'h '+m%60+'min':m+'min '+Math.floor(ms/1000)%60+'s';};
const date=(ms:number)=>new Date(ms).toLocaleDateString('pt-BR');
function el<K extends keyof HTMLElementTagNameMap>(tag:K,value='',cls=''){const e=document.createElement(tag);e.textContent=value;e.className=cls;return e;}
function item(id:string|null){const e=el('div','','profile-item'),def=getItem(id);if(def){const img=el('img');img.src='assets/items/'+def.id+'.png';img.alt='';e.append(img);}e.append(el('span',def?.name??'Nenhum'));return e;}
function outfit(set:Outfit){const row=el('div','','profile-grid');for(const slot of OUTFIT_SLOTS)row.append(item(set[slot]));return row;}
export function closeProfile(){cancel?.();cancel=null;if(modal){const d=modal;modal=null;d.remove();}}
function render(body:HTMLElement,p:PublicProfile){
  body.replaceChildren();
  const top=el('div','','profile-top'),character=el('img'),info=el('div');
  character.src='assets/character/'+figureKey(p.outfit)+'.png';character.alt='Personagem equipado';
  info.append(el('h2',p.name),el('p','Conta criada em '+date(p.createdAt)),el('p','Tempo registrado em PvP: '+duration(p.playMs)));
  top.append(character,info);body.append(top);
  const stats=el('div','','profile-grid');
  for(const [label,value] of [['Vitórias',String(p.wins)],['Derrotas',String(p.losses)],['Empates registrados',String(p.draws)],['Taxa de vitórias (decisivas)',p.wins+p.losses?Math.round(p.wins/(p.wins+p.losses)*100)+'%':'—']]){
    const cell=el('div','','profile-stat');cell.append(el('strong',value),el('span',label));stats.append(cell);
  }
  body.append(stats,el('h3','Set atual'),outfit(p.outfit),el('h3','Equipamentos mais utilizados'));
  const fav=el('div','','profile-grid');
  for(const slot of OUTFIT_SLOTS){const f=p.favorites[slot],cell=el('div','','profile-stat');cell.append(el('span',slots[slot]),item(f?.id??null),el('small',f?f.count+' partidas':'Sem registro'));fav.append(cell);}
  body.append(fav,el('p','Tempo, empates e frequência de equipamentos registrados a partir da atualização. Vitórias e derrotas anteriores preservadas.','profile-note'),el('h3','Últimas partidas PvP'));
  if(!p.history.length)body.append(el('p','Nenhuma partida registrada nesta atualização.'));
  for(const row of p.history){const box=el('article','','profile-match');box.append(el('strong',row.result==='win'?'Vitória':row.result==='loss'?'Derrota':'Empate',row.result),el('span',' · '+row.opponent+' · '+date(row.at)),el('p',duration(row.durationMs)+' · '+row.turns+' turnos · '+row.arena.replaceAll('_',' ')),outfit(row.outfit));body.append(box);}
}
export function openProfile(name:string){
  closeProfile();const d=el('dialog','','shonen-profile');modal=d;const header=el('header'),close=el('button','Fechar'),body=el('section','Carregando…');
  close.type='button';close.onclick=closeProfile;header.append(el('strong','PERFIL DO JOGADOR'),close);d.append(header,body);document.body.append(d);
  d.addEventListener('cancel',e=>{e.preventDefault();closeProfile();});d.showModal();
  if(auth.isGuest){body.textContent='Crie uma conta para acessar perfis.';return;}
  const off=session.net.on(msg=>{
    if(msg.t==='profile'&&msg.profile.name.toLowerCase()===name.toLowerCase()){cancel?.();cancel=null;render(body,msg.profile);}
    if(msg.t==='profileError'&&msg.name.toLowerCase()===name.toLowerCase()){cancel?.();cancel=null;body.textContent=msg.message;}
  });
  const timer=setTimeout(()=>{off();if(modal===d)body.textContent='Sem resposta do servidor. Feche e tente novamente.';cancel=null;},8000);
  cancel=()=>{clearTimeout(timer);off();};session.net.send({t:'profile',name});
}
const style=el('style');style.textContent=`
.shonen-profile{box-sizing:border-box;width:min(760px,92vw);max-height:88dvh;overflow:auto;color:#fff3dc;background:#21182f;border:4px solid #e8a32b;box-shadow:0 0 0 4px #39180b;border-radius:12px;padding:0;font:16px system-ui,sans-serif}
.shonen-profile::backdrop{background:#0d0a14bb}.shonen-profile header{display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;padding:12px 16px;background:#4b3158;border-bottom:2px solid #e8a32b;color:#ffe28a;z-index:1}
.shonen-profile button{font:inherit;color:#311508;background:#ffc448;border:2px solid #9e4210;padding:6px 12px;cursor:pointer}.shonen-profile section{padding:16px}.shonen-profile h2,.shonen-profile h3{color:#ffe28a;margin:10px 0}.shonen-profile p{margin:6px 0}
.profile-top{display:flex;align-items:center;gap:20px}.profile-top>img{width:96px;height:128px;object-fit:contain;image-rendering:pixelated}
.profile-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(105px,1fr));gap:8px;margin:10px 0}.profile-item,.profile-stat{min-width:0;padding:8px;background:#362749;border:1px solid #85649a;text-align:center;display:flex;flex-direction:column;align-items:center;gap:4px;overflow-wrap:anywhere}
.profile-item img{width:48px;height:48px;object-fit:contain;image-rendering:pixelated}.profile-stat strong{font-size:26px;color:#ffe28a}.profile-stat>.profile-item{border:0;padding:3px}.profile-note{font-size:13px;color:#d2c0dd}.profile-match{padding:10px;border-top:1px solid #765383}.profile-match .win{color:#7fe0a0}.profile-match .loss{color:#ff9999}.profile-match .draw{color:#ffe28a}
`;document.head.append(style);
