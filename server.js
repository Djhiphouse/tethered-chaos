const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = Number(process.env.PORT || 8080);
const ROOT = __dirname;
const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.ico':'image/x-icon'};

const server = http.createServer((req,res)=>{
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const requested = urlPath === '/' ? '/index.html' : urlPath;
  const file = path.resolve(ROOT, `.${requested}`);
  if(!file.startsWith(ROOT + path.sep)){res.writeHead(403);return res.end('Forbidden')}
  fs.readFile(file,(error,data)=>{
    if(error){res.writeHead(error.code === 'ENOENT' ? 404 : 500);return res.end('Not found')}
    res.writeHead(200,{'Content-Type':MIME[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store'});
    res.end(data);
  });
});

const wss = new WebSocketServer({server});
const clients = new Set();
const send = (client,message)=>client.readyState === WebSocket.OPEN && client.send(JSON.stringify(message));
const broadcast = (message,except=null)=>clients.forEach(client=>client!==except&&send(client,message));
const playerCount = ()=>[1,2].filter(slot=>[...clients].some(client=>client.slot===slot&&client.readyState===WebSocket.OPEN)).length;
const roomUpdate = ()=>broadcast({type:'room',players:playerCount(),host:[...clients].some(client=>client.slot===1)});

wss.on('connection',client=>{
  const used = new Set([...clients].map(other=>other.slot));
  client.slot = !used.has(1) ? 1 : !used.has(2) ? 2 : 0;
  clients.add(client);
  send(client,{type:'assign',slot:client.slot});
  roomUpdate();

  client.on('message',raw=>{
    let message;try{message=JSON.parse(raw.toString())}catch{return}
    if(message.type==='input'&&client.slot===2){const host=[...clients].find(other=>other.slot===1);if(host)send(host,{type:'input',input:message.input})}
    if(message.type==='start'&&client.slot===1&&playerCount()===2)broadcast({type:'start'});
    if((message.type==='snapshot'||message.type==='gameover')&&client.slot===1)broadcast(message,client);
  });
  client.on('close',()=>{const oldSlot=client.slot;clients.delete(client);if(oldSlot===1)broadcast({type:'host-left'});roomUpdate()});
  client.on('error',()=>{});
});

server.listen(PORT,'0.0.0.0',()=>{
  console.log('\nTETHERED CHAOS — LAN SERVER');
  console.log(`Dieser Laptop: http://localhost:${PORT}`);
  for(const list of Object.values(os.networkInterfaces()))for(const net of list||[])if(net.family==='IPv4'&&!net.internal)console.log(`Freunde im WLAN: http://${net.address}:${PORT}`);
  console.log('\nBeide öffnen dieselbe WLAN-Adresse. Mit Ctrl+C beenden.\n');
});
