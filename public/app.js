const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>'$'+Number(n).toFixed(2);
async function api(url,o={}){
  const opt={method:o.method||'GET',headers:{},credentials:'same-origin'};
  if(o.body instanceof FormData)opt.body=o.body;else if(o.body){opt.headers['Content-Type']='application/json';opt.body=JSON.stringify(o.body)}
  const r=await fetch(url,opt),d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Something went wrong ('+r.status+')');return d;
}
const run=async fn=>{try{await fn()}catch(e){toast(e.message)}};
let me,socket,cfg={},page='shop',convos=[],active=null,msgs={},rm=null,notes=[],unseen=0,chatUnread=0,salesUnread=0,panelOpen=false;

const LOGO='<svg class="logo" width="26" height="26" viewBox="0 0 28 28" aria-hidden="true"><rect x="2.5" y="7" width="15" height="19" rx="3" fill="#0071e3" opacity=".3" transform="rotate(-12 10 16.5)"/><rect x="8.5" y="3" width="16" height="20" rx="3.2" fill="#0071e3"/><path d="M16.5 9.2l3.2 4.3-3.2 4.3-3.2-4.3z" fill="#fff"/></svg>';
const BELL='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';
const ST={pending:'Waiting for seller',accepted:'Accepted',declined:'Declined',won:'You won',lost:'Another buyer won',closed:'Closed',completed:'Purchased'};
const pill=(s,label)=>`<span class="pill ${s}">${label||ST[s]||s}</span>`;
const section=(t,a,empty='Nothing here yet.')=>`<h3 class="sec">${t}</h3>`+(a.join('')||`<p class="muted">${empty}</p>`);
const ago=t=>{const m=Math.round((Date.now()-t)/6e4);return m<1?'now':m<60?m+' min':Math.round(m/60)+' h'};

// ---------- toasts, notifications ----------
function toast(text,o={}){
  const d=document.createElement('div');d.className='toast';d.innerHTML=`<b>${esc(o.title||'CardVault')}</b><div>${esc(text)}</div>`;
  if(o.actions?.length){const r=document.createElement('div');r.className='row';
    o.actions.forEach(a=>{const b=document.createElement('button');b.textContent=a.label;if(a.alt)b.className='alt';b.onclick=()=>{a.fn();d.remove()};r.append(b)});d.append(r)}
  $('#toasts').append(d);setTimeout(()=>d.remove(),o.ms||7000);
}
function osNotify(title,body){
  if('Notification' in window&&Notification.permission==='granted'&&navigator.serviceWorker)
    navigator.serviceWorker.ready.then(r=>r.showNotification(title,{body})).catch(()=>{});
}
function alertUser(text,o={}){
  notes.unshift({text,to:o.to,t:Date.now()});notes.length=Math.min(notes.length,30);unseen++;
  if(o.to==='chat'&&page!=='chat')chatUnread++;if(o.to==='sells'&&page!=='sells')salesUnread++;
  nav();if(panelOpen)renderPanel();toast(text,o);osNotify('CardVault',text);
}
function renderPanel(){
  let p=$('#np');if(!panelOpen){p?.remove();return}
  if(!p){p=document.createElement('div');p.id='np';p.className='panel';document.body.append(p);
    p.onclick=e=>{const b=e.target.closest('.ni');if(b){const n=notes[+b.dataset.i];panelOpen=false;renderPanel();go(n.to||'shop')}}}
  p.innerHTML='<div class="ph">Notifications</div>'+(notes.length?notes.map((n,i)=>`<button class="ni" data-i="${i}"><span>${esc(n.text)}</span><small>${ago(n.t)}</small></button>`).join(''):'<p class="empty2">You are all caught up.</p>');
}
document.addEventListener('click',e=>{if(panelOpen&&!e.target.closest('#np,#bell')){panelOpen=false;renderPanel()}});

function modal(html){
  const m=document.createElement('div');m.className='modal';m.innerHTML=`<div class="box"><button class="x" aria-label="Close">&times;</button>${html}</div>`;
  m.onclick=e=>{if(e.target===m||e.target.classList.contains('x'))m.remove()};document.body.append(m);return m;
}

// ---------- sign in ----------
function authView(mode='login',msg=''){
  const su=mode==='signup';
  $('#nav').innerHTML=`<div class="navin"><span class="brand-l">${LOGO}<span>CardVault</span></span></div>`;
  $('#app').innerHTML=`<div class="auth"><h1>${su?'Create your account':'Sign in'}</h1><p class="sub">${su?'Choose the username other people will see.':'Welcome back.'}</p>
  ${msg?`<div class="note ok">${esc(msg)}</div>`:''}
  <label>Email<input id="em" type="email" autocomplete="email"></label>
  ${su?'<label>Username<input id="un" autocomplete="username" placeholder="3 to 20 letters, numbers or _"></label>':''}
  <label>Password<input id="pw" type="password" autocomplete="${su?'new-password':'current-password'}" placeholder="At least 8 characters"></label>
  <button id="go" class="wide">${su?'Create account':'Sign in'}</button><div class="or"><span>or</span></div><div id="gbtn"></div>
  <p class="sub c">${su?'Already have an account?':'New here?'} <a href="#" id="sw">${su?'Sign in':'Create an account'}</a></p></div>`;
  $('#sw').onclick=e=>{e.preventDefault();authView(su?'login':'signup')};
  const submit=()=>run(async()=>{
    const body={email:$('#em').value,password:$('#pw').value};if(su)body.username=$('#un').value;
    const r=await api(su?'/api/signup':'/api/login',{method:'POST',body});
    if(su)authView('login','Account created. Check your email and click the verification link, then sign in.');else{me=r;start()}
  });
  $('#go').onclick=submit;document.querySelectorAll('.auth input').forEach(i=>i.onkeydown=e=>{if(e.key==='Enter')submit()});
  const tryG=()=>{if(!window.google)return setTimeout(tryG,400);
    google.accounts.id.initialize({client_id:cfg.googleClientId,callback:onGoogle});
    google.accounts.id.renderButton($('#gbtn'),{theme:'outline',size:'large',shape:'pill',text:'continue_with',width:380})};
  if(cfg.googleClientId)tryG();else $('#gbtn').innerHTML='<p class="sub c">Google sign-in is not set up yet. Add GOOGLE_CLIENT_ID to the .env file (the seller needs it).</p>';
}
function onGoogle(resp){run(async()=>{
  const r=await api('/api/google',{method:'POST',body:{credential:resp.credential}});
  if(r.needUsername){
    $('#app').innerHTML=`<div class="auth"><h1>Choose a username</h1><p class="sub">This is the name other people will see.</p><label>Username<input id="un" placeholder="3 to 20 letters, numbers or _"></label><button id="ok" class="wide">Continue</button></div>`;
    $('#ok').onclick=()=>run(async()=>{me=await api('/api/google/username',{method:'POST',body:{pending:r.pending,username:$('#un').value}});start()});
  }else{me=r;start()}
})}
async function logout(){await api('/api/logout',{method:'POST'});location.reload()}

// ---------- shell ----------
function nav(){
  const it=[['shop','Shop'],['purchases','My Orders'],['chat','Messages']];
  if(me.role==='admin')it.push(['sells','Sales'],['add','Add Card']);it.push(['account','Account']);
  const dot=k=>(k==='chat'&&chatUnread)||(k==='sells'&&salesUnread)?'<i class="dot"></i>':'';
  $('#nav').innerHTML=`<div class="navin"><a href="#" class="brand-l" data-p="shop">${LOGO}<span>CardVault</span></a><div class="links">`+
   it.map(([k,v])=>`<a href="#" data-p="${k}" class="${k===page?'on':''}">${v}${dot(k)}</a>`).join('')+
   `</div><div class="right"><button class="bell" id="bell" aria-label="Notifications">${BELL}${unseen?`<i class="dot">${unseen>9?'9+':unseen}</i>`:''}</button><a href="#" id="lo">Sign out</a></div></div>`;
  document.title=(unseen?`(${unseen}) `:'')+'CardVault';
}
$('#nav').onclick=e=>{
  if(e.target.closest('#bell')){panelOpen=!panelOpen;if(panelOpen)unseen=0;nav();renderPanel();return}
  const a=e.target.closest('a');if(!a)return;e.preventDefault();a.id==='lo'?logout():go(a.dataset.p);
};
function go(p){
  page=p;if(p==='chat')chatUnread=0;if(p==='sells')salesUnread=0;
  nav();$('#app').onclick=null;run(()=>({shop,purchases,chat,sells,add,account})[p]());
}

function start(){
  document.addEventListener('click',()=>{if('Notification' in window&&Notification.permission==='default')Notification.requestPermission()},{once:true});
  if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js');
  socket=io({transports:['websocket','polling']});
  socket.on('notify',d=>alertUser(d.text,{to:d.to}));
  socket.on('listings:changed',()=>{if(page==='shop'||page==='sells')go(page)});
  socket.on('chat:invite',d=>{
    alertUser(`@${d.from} wants to talk to you (${d.topic})`,{to:'chat',ms:60000,
      actions:[{label:'Accept',fn:()=>socket.emit('chat:respond',{convoId:d.convoId,accept:true})},{label:'Decline',alt:1,fn:()=>socket.emit('chat:respond',{convoId:d.convoId,accept:false})}]});
    if(page==='chat')chat();
  });
  socket.on('chat:accepted',d=>{active=d.convoId;if(d.by!==me.username)alertUser(`Chat started with @${d.by}`,{to:'chat'});if(page==='chat')chat()});
  socket.on('chat:declined',d=>{if(d.by!==me.username)alertUser(`@${d.by} declined your chat request`,{to:'chat'});if(page==='chat')chat()});
  socket.on('chat:msg',m=>{
    if(msgs[m.convoId])msgs[m.convoId].push(m);
    if(page==='chat'&&active===m.convoId)renderMsgs();
    else if(m.from!==me.id)alertUser(`@${m.fromName}: ${m.text}`,{to:'chat'});
  });
  socket.on('rps:start',d=>{
    rm?.remove();osNotify('CardVault','Rock paper scissors for '+d.listing);
    rm=modal(`<h2>Rock Paper Scissors</h2><p class="desc">Someone else wants <b>${esc(d.listing)}</b> too. Play to decide: the winner gets first chance to buy.<br>Players: ${d.players.map(p=>'@'+esc(p)).join(', ')}</p>
    <div id="rs">${['rock','paper','scissors'].map(c=>`<button data-c="${c}" class="alt">${c[0].toUpperCase()+c.slice(1)}</button>`).join('')}</div><p id="rt" class="muted c">You have 20 seconds to choose.</p>`);
    rm.gid=d.gameId;
    rm.querySelector('#rs').onclick=e=>{const b=e.target.closest('button');if(!b)return;
      socket.emit('rps:pick',{gameId:rm.gid,choice:b.dataset.c});rm.querySelectorAll('#rs button').forEach(x=>x.disabled=true);rm.querySelector('#rt').textContent='Waiting for the other player…'};
  });
  socket.on('rps:round',d=>{if(!rm)return;
    rm.querySelector('#rt').textContent='Tie. '+Object.entries(d.reveal).map(([n,c])=>`@${n}: ${c}`).join(', ')+(d.canPlay?'. Choose again.':'. You are out.');
    rm.querySelectorAll('#rs button').forEach(x=>x.disabled=!d.canPlay)});
  socket.on('rps:end',d=>{if(!rm)return;rm.querySelector('#rs').remove();
    rm.querySelector('#rt').innerHTML=(d.you?'<b>You won.</b> The seller will message you about the meetup.':`@${esc(d.winner)} won this round.`)+'<br><small>'+Object.entries(d.reveal).map(([n,c])=>`@${esc(n)}: ${esc(c)}`).join(', ')+'</small>'});
  go('shop');
}

// ---------- shop ----------
let shopQ='',hideSold=false;
async function shop(){
  const ls=await api('/api/listings');
  $('#app').innerHTML=`<h1>Shop</h1><p class="sub">Tap a card to make an offer or buy it. All sales are final, no refunds.</p>
  <div class="toolbar"><input id="sq" type="search" placeholder="Search cards" value="${esc(shopQ)}"><label class="chk"><input type="checkbox" id="hs" ${hideSold?'checked':''}> Hide sold</label></div><div class="grid" id="gr"></div>`;
  const draw=()=>{const q=shopQ.toLowerCase();
    const v=ls.filter(l=>(!hideSold||!l.sold)&&(l.title+' '+l.description).toLowerCase().includes(q));
    $('#gr').innerHTML=v.map(l=>`<div class="card tile" data-id="${l.id}"><div class="imgw"><img class="thumb" loading="lazy" decoding="async" src="${esc(l.image)}" alt="${esc(l.title)}">${l.sold?'<span class="badge">Sold</span>':''}</div><h3>${esc(l.title)}</h3><div class="price">${money(l.price)}</div></div>`).join('')||'<div class="empty">No cards found.</div>';
    document.querySelectorAll('.tile').forEach(t=>t.onclick=()=>detail(ls.find(l=>l.id===t.dataset.id)))};
  $('#sq').oninput=e=>{shopQ=e.target.value;draw()};$('#hs').onchange=e=>{hideSold=e.target.checked;draw()};draw();
}
function chatReq(to,topic){socket.emit('chat:request',{to,topic},r=>toast(r?.error==='User not found'&&to==='admin'?'The seller has not signed in yet. Try again later.':(r?.error||r?.note||'Sent')))}
function detail(l){
  const admin=me.role==='admin',can=!l.sold&&!admin;
  const m=modal(`<div class="detail"><img class="big" src="${esc(l.image)}" alt="${esc(l.title)}"><div class="info"><h2>${esc(l.title)}</h2>
  <div class="price">${money(l.price)}${l.sold?' '+pill('closed','Sold'):''}</div><p class="desc">${esc(l.description)||'No description.'}</p><div class="note">No refunds. All sales are final.</div>`+
  (can?`<button id="bb" class="wide">Buy now</button><p class="muted" style="margin:0"><small>The seller will message you with the meetup spot.</small></p>
   <label>Or make an offer<div class="row" style="margin:0"><input id="oa" type="number" min="1" step="0.01" placeholder="Your price in $"><button id="ob" class="alt">Send offer</button></div></label>
   <div class="row"><button class="alt" id="mb">Message seller</button><button class="alt" id="tb">Trade cards</button></div>`:'')+`</div></div>`);
  if(!can)return;
  m.querySelector('#ob').onclick=()=>run(async()=>{await api(`/api/listings/${l.id}/offer`,{method:'POST',body:{amount:m.querySelector('#oa').value}});toast('Offer sent. You will be notified when the seller answers.');m.remove()});
  m.querySelector('#bb').onclick=()=>{if(!confirm(`Buy "${l.title}" for ${money(l.price)}?\nNo refunds. The seller will message you the meetup details.`))return;
    run(async()=>{const r=await api(`/api/listings/${l.id}/buy`,{method:'POST'});toast(r.message,{ms:12000});m.remove()})};
  m.querySelector('#mb').onclick=()=>chatReq('admin','About '+l.title);
  m.querySelector('#tb').onclick=()=>chatReq('admin','Trade for '+l.title);
}
async function purchases(){
  const d=await api('/api/purchases');
  $('#app').innerHTML='<h1>My Orders</h1><p class="sub">Cards you bought, your offers and your buy requests.</p>'+
    section('Cards you own',d.bought.map(l=>`<div class="item"><img class="mini" src="${esc(l.image)}" alt=""><span><b>${esc(l.title)}</b><small>Paid ${money(l.soldPrice)}</small></span></div>`),'No purchases yet.')+
    section('Your offers',d.offers.map(o=>`<div class="item"><span><b>${esc(o.title)}</b><small>Your offer: ${money(o.amount)}</small></span>${pill(o.status)}</div>`),'You have not made any offers.')+
    section('Buy requests',d.buys.map(b=>`<div class="item"><span><b>${esc(b.title)}</b></span>${pill(b.status)}</div>`),'No buy requests.');
}

// ---------- messages ----------
async function chat(){convos=await api('/api/convos');renderChat()}
function renderChat(){
  if(page!=='chat')return;
  $('#app').innerHTML=`<h1>Messages</h1><p class="sub">Talk about a deal or a trade. The other person has to accept your request first.</p><div class="chat"><div class="side">
  ${me.role!=='admin'?'<button id="qs" class="wide">Message the seller</button><div class="or muted"><small>or message someone</small></div>':''}
  <div class="newmsg"><input id="lk" placeholder="Username, e.g. admin"><select id="tp"><option>Deal</option><option>Trade cards</option><option>Question</option></select><button id="rq" class="alt">Send request</button></div>
  <h3 class="sec" style="margin:14px 0 2px">Conversations</h3>`+
  (convos.map(c=>`<div class="ci ${c.id===active?'on':''}" data-id="${c.id}"><span>@${esc(c.other)}</span><small>${c.status==='pending'?(c.incoming?'Wants to talk':'Waiting'):c.status==='declined'?'Declined':''}</small></div>`).join('')||'<p class="muted"><small>No conversations yet.</small></p>')+
  `</div><div class="main" id="cm"><p class="muted">Choose a conversation, or send a request to start a new one.</p></div></div>`;
  $('#rq').onclick=()=>{const v=$('#lk').value.trim();if(v)chatReq(v,$('#tp').value)};
  const qs=$('#qs');if(qs)qs.onclick=()=>chatReq('admin','Question');
  document.querySelectorAll('.ci').forEach(e=>e.onclick=()=>run(()=>openConvo(e.dataset.id)));
  if(active&&convos.some(c=>c.id===active))run(()=>openConvo(active));
}
async function openConvo(cid){
  active=cid;const c=convos.find(c=>c.id===cid),box=$('#cm');
  document.querySelectorAll('.ci').forEach(e=>e.classList.toggle('on',e.dataset.id===cid));
  if(c.status==='pending'&&c.incoming){
    box.innerHTML=`<h2>@${esc(c.other)}</h2><p class="desc">wants to talk to you about: ${esc(c.topic)}</p><div class="row"><button id="ac">Accept</button><button class="alt" id="de">Decline</button></div>`;
    $('#ac').onclick=()=>socket.emit('chat:respond',{convoId:cid,accept:true});$('#de').onclick=()=>socket.emit('chat:respond',{convoId:cid,accept:false});return;
  }
  if(c.status!=='accepted'){box.innerHTML=`<p class="muted">${c.status==='declined'?'This request was declined.':'Waiting for @'+esc(c.other)+' to accept.'}</p>`;return}
  msgs[cid]=await api(`/api/convos/${cid}/messages`);
  box.innerHTML=`<h2>@${esc(c.other)}</h2><small>${esc(c.topic)}</small><div id="ml"></div><div class="row"><input id="mi" placeholder="Message"><button id="ms">Send</button></div>`;
  const send=()=>{const v=$('#mi').value.trim();if(v){socket.emit('chat:msg',{convoId:cid,text:v});$('#mi').value=''}};
  $('#ms').onclick=send;$('#mi').onkeydown=e=>{if(e.key==='Enter')send()};renderMsgs();
}
function renderMsgs(){const ml=$('#ml');if(!ml)return;
  ml.innerHTML=(msgs[active]||[]).map(m=>`<div class="m ${m.from===me.id?'me':''}"><small>@${esc(m.fromName)}</small>${esc(m.text)}</div>`).join('');ml.scrollTop=ml.scrollHeight}

// ---------- seller ----------
function sellModal(l,done){
  const m=modal(`<h2>Mark as sold</h2><p class="desc">${esc(l.title)}</p>
  <label>Buyer username <small>(leave empty if sold somewhere else)</small><input id="sb" placeholder="e.g. buyer1"></label>
  <label>Sold price ($)<input id="sp" type="number" step="0.01" value="${l.price}"></label><button class="wide" id="sg">Mark as sold</button>`);
  m.querySelector('#sg').onclick=()=>run(async()=>{await api(`/api/listings/${l.id}/sold`,{method:'POST',body:{buyer:m.querySelector('#sb').value,price:m.querySelector('#sp').value}});m.remove();done()});
}
async function sells(){
  const d=await api('/api/admin/overview'),L=d.listings,act=L.filter(l=>!l.sold&&!l.removed),sold=L.filter(l=>l.sold);
  const openOffers=d.offers.filter(o=>['pending','accepted'].includes(o.status)),openBuys=d.buys.filter(b=>['pending','won'].includes(b.status));
  $('#app').innerHTML='<h1>Sales</h1><p class="sub">Your listings, offers and buy requests in one place.</p><div class="stats">'+
   [[act.length,'Cards for sale'],[d.offers.filter(o=>o.status==='pending').length,'New offers'],[openBuys.length,'Buy requests'],[money(sold.reduce((a,l)=>a+(l.soldPrice||0),0)),'Total sold']].map(([n,t])=>`<div class="stat"><b>${n}</b>${t}</div>`).join('')+'</div>'+
   section('Offers',openOffers.map(o=>`<div class="item"><span><b>@${esc(o.username)} offered ${money(o.amount)}</b><small>${esc(o.title)}</small></span>${pill(o.status)}
     ${o.status==='pending'?`<button data-oa="${o.id}">Accept</button><button class="alt" data-od="${o.id}">Decline</button>`:''}
     <button class="alt" data-sell="${o.listingId}|${o.username}|${o.amount}">Sell at ${money(o.amount)}</button><button class="alt" data-msg="${o.username}">Message</button></div>`),'No open offers.')+
   section('Buy requests',openBuys.map(b=>{const l=L.find(x=>x.id===b.listingId);return `<div class="item"><span><b>@${esc(b.username)} wants to buy</b><small>${esc(b.title)}</small></span>${pill(b.status,b.status==='won'?'Won rock paper scissors':'Waiting')}
     <button data-sell="${b.listingId}|${b.username}|${l?l.price:0}">Sell at ${money(l?l.price:0)}</button><button class="alt" data-msg="${b.username}">Message</button></div>`}),'No buy requests.')+
   section('Cards for sale',act.map(l=>`<div class="item"><img class="mini" src="${esc(l.image)}" alt=""><span><b>${esc(l.title)}</b><small>${money(l.price)}</small></span><button class="alt" data-sold="${l.id}">Mark as sold</button></div>`),'No cards listed. Use Add Card.')+
   section('Sold',sold.map(l=>`<div class="item"><img class="mini" src="${esc(l.image)}" alt=""><span><b>${esc(l.title)}</b><small>${money(l.soldPrice)} to ${l.buyerName?'@'+esc(l.buyerName):'someone outside the site'}</small></span>${l.removed?pill('closed','Removed'):`<button class="danger" data-rm="${l.id}">Remove from shop</button>`}</div>`),'Nothing sold yet.');
  $('#app').onclick=e=>{const b=e.target.closest('button');if(!b)return;const D=b.dataset;
    run(async()=>{
      if(D.sold)return sellModal(L.find(x=>x.id===D.sold),sells);
      if(D.oa||D.od)await api('/api/offers/'+(D.oa||D.od),{method:'POST',body:{status:D.oa?'accepted':'declined'}});
      else if(D.sell){const [lid,u,p]=D.sell.split('|');if(!confirm(`Mark sold to @${u} for ${money(p)}?`))return;await api(`/api/listings/${lid}/sold`,{method:'POST',body:{buyer:u,price:p}})}
      else if(D.msg){chatReq(D.msg,'About your order');return}
      else if(D.rm){if(!confirm('Remove this sold card from the shop?'))return;await api('/api/listings/'+D.rm,{method:'DELETE'})}
      sells()})};
}
async function shrink(file,max=1400){
  try{if(file.type==='image/gif')return file;const bmp=await createImageBitmap(file),k=Math.min(1,max/Math.max(bmp.width,bmp.height));
    const c=document.createElement('canvas');c.width=Math.round(bmp.width*k);c.height=Math.round(bmp.height*k);c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);
    const b=await new Promise(r=>c.toBlob(r,'image/jpeg',.86));return b?new File([b],'card.jpg',{type:'image/jpeg'}):file}catch{return file}
}
function add(){
  $('#app').innerHTML=`<h1>Add a card</h1><p class="sub">Upload a clear photo, then add a title and price.</p><div class="card form">
  <label>Photo<input id="f" type="file" accept="image/*"></label><img id="pv" class="pv" alt="" hidden>
  <label>Title<input id="t"></label><label>Description<textarea id="d" rows="4"></textarea></label><label>Price ($)<input id="p" type="number" step="0.01" min="1"></label>
  <button id="go">Publish card</button></div>`;
  $('#f').onchange=e=>{const f=e.target.files[0];if(f){$('#pv').src=URL.createObjectURL(f);$('#pv').hidden=false}};
  $('#go').onclick=()=>run(async()=>{const b=$('#go');b.disabled=true;
    try{const fd=new FormData();fd.append('title',$('#t').value);fd.append('description',$('#d').value);fd.append('price',$('#p').value);
      const f=$('#f').files[0];if(f)fd.append('photo',await shrink(f));await api('/api/listings',{method:'POST',body:fd});toast('Card published.');go('shop')}finally{b.disabled=false}});
}
function account(){
  $('#app').innerHTML=`<h1>Account</h1><p class="sub">@${esc(me.username)} &middot; ${esc(me.email)}</p>
  ${me.role==='admin'?'<div class="note">You are signed in as the seller (admin). This account cannot be deleted.</div>':
  '<div class="card form"><h3>Delete account</h3><p class="desc">This permanently removes your account, offers and chats. Cards you already bought stay on record.</p><div><button class="danger" id="del">Delete my account</button></div></div>'}`;
  const d=$('#del');if(d)d.onclick=()=>{if(confirm('Delete your account for good? This cannot be undone.'))run(async()=>{await api('/api/me',{method:'DELETE'});location.reload()})};
}

// ---------- boot ----------
(async()=>{
  cfg=await api('/api/config');
  try{me=await api('/api/me');start()}catch{authView()}
  if(location.search.includes('verified=1')){toast('Email verified. You can sign in now.');history.replaceState({},'','/')}
})();
