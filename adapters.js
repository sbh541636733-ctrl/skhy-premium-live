/* Public market-data adapters. No API keys or account access. */
export const EXCHANGES = {hl:'Hyperliquid',okx:'OKX',bn:'Binance · BN',gate:'Gate',bybit:'Bybit',bitget:'Bitget'};
export const RANGES = {'1D':{days:1,interval:'5m',ms:300000},'7D':{days:7,interval:'1h',ms:3600000},'30D':{days:30,interval:'4h',ms:14400000},'90D':{days:90,interval:'1d',ms:86400000}};
const roots={hl:'https://api.hyperliquid.xyz',okx:'https://www.okx.com',bn:'https://api.binance.com',gate:'https://api.gateio.ws',bybit:'https://api.bybit.com',bitget:'https://api.bitget.com'};
export const positive=v=>v!==''&&v!=null&&Number.isFinite(+v)&&+v>0?+v:NaN;
export function premium(a,b,ratio=1,fx=1){return [a,b,ratio,fx].every(x=>Number.isFinite(x)&&x>0)?(b*ratio*fx/a-1)*100:NaN}
export async function json(url,body){const c=new AbortController(),t=setTimeout(()=>c.abort(),12000);try{const r=await fetch(url,{signal:c.signal,cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});if(!r.ok)throw Error(`HTTP ${r.status}`);const d=await r.json();if(d.code!=null&&!['0','00000'].includes(String(d.code)))throw Error(d.msg||d.message||`API ${d.code}`);if(d.retCode)throw Error(d.retMsg||`API ${d.retCode}`);return d}catch(e){if(e.name==='AbortError')throw Error('请求超时（12 秒）');if(e instanceof TypeError)throw Error('无法连接行情接口，请检查网络或地区限制');throw e}finally{clearTimeout(t)}}
const info=body=>json(roots.hl+'/info',body);
const url=(e,path,p={})=>roots[e]+path+'?'+new URLSearchParams(p);
const get=(e,path,p)=>json(url(e,path,p));
const bin=(type,path,p)=>json((type==='perp'?'https://fapi.binance.com/fapi/v1/':roots.bn+'/api/v3/')+path+'?'+new URLSearchParams(p));
const m=(exchange,type,id,base,quote,extra={})=>({exchange,type,id,base,quote,...extra});
const memo=new Map();
export async function catalog(exchange,type){const key=exchange+type;if(memo.has(key))return memo.get(key);const promise=loadCatalog(exchange,type).then(rows=>{if(!rows.length)throw Error('没有可用市场');return rows.sort((a,b)=>a.base.localeCompare(b.base)||a.id.localeCompare(b.id))}).catch(e=>{memo.delete(key);throw e});memo.set(key,promise);return promise}
async function loadCatalog(e,type){const spot=type==='spot';
 if(e==='hl'){
  if(spot){const d=await info({type:'spotMeta'}),tokens=new Map(d.tokens.map(x=>[x.index,x]));return d.universe.flatMap(x=>{const b=tokens.get(x.tokens[0]),q=tokens.get(x.tokens[1]);return b&&q&&['USDC','USDT','USDH'].includes(q.name)?[m(e,type,x.name,b.name,q.name)]:[]})}
  const metas=await info({type:'allPerpMetas'});return metas.map(d=>Array.isArray(d)?d[0]:d).flatMap(d=>d.universe.filter(x=>!x.isDelisted).map(x=>m(e,type,x.name,x.name.split(':').pop(),'USD',{dex:x.name.includes(':')?x.name.split(':')[0]:''})));
 }
 if(e==='bn'){const d=await bin(type,'exchangeInfo',{});return d.symbols.filter(x=>x.status==='TRADING'&&['USDT','USDC'].includes(x.quoteAsset)&&(spot||x.contractType==='PERPETUAL')).map(x=>m(e,type,x.symbol,x.baseAsset,x.quoteAsset))}
 if(e==='okx'){const d=await get(e,'/api/v5/public/instruments',{instType:spot?'SPOT':'SWAP'});return d.data.filter(x=>x.state==='live'&&['USDT','USDC'].includes(spot?x.quoteCcy:x.settleCcy)&& (spot||x.ctType==='linear')).map(x=>m(e,type,x.instId,spot?x.baseCcy:x.ctValCcy,spot?x.quoteCcy:x.settleCcy))}
 if(e==='bybit'){let rows=[],cursor='';do{const d=await get(e,'/v5/market/instruments-info',{category:spot?'spot':'linear',limit:'1000',...(cursor?{cursor}:{})});rows.push(...d.result.list);cursor=spot?'':d.result.nextPageCursor}while(cursor);return rows.filter(x=>x.status==='Trading'&&['USDT','USDC'].includes(x.quoteCoin)&&(spot||x.contractType==='LinearPerpetual')).map(x=>m(e,type,x.symbol,x.baseCoin,x.quoteCoin))}
 if(e==='gate'){const d=await get(e,spot?'/api/v4/spot/currency_pairs':'/api/v4/futures/usdt/contracts',{});return d.filter(x=>spot?x.trade_status==='tradable'&&['USDT','USDC'].includes(x.quote):!x.in_delisting).map(x=>m(e,type,spot?x.id:x.name,spot?x.base:x.name.replace(/_USDT$/,''),spot?x.quote:'USDT'))}
 if(e==='bitget'){const d=await get(e,spot?'/api/v2/spot/public/symbols':'/api/v2/mix/market/contracts',spot?{}:{productType:'USDT-FUTURES'});return d.data.filter(x=>['USDT','USDC'].includes(x.quoteCoin)&&(spot?x.status==='online':x.symbolStatus==='normal'&&(!x.symbolType||x.symbolType==='perpetual'))).map(x=>m(e,type,x.symbol,x.baseCoin,x.quoteCoin))}
 throw Error('不支持的交易所');
}
function quote(bid,ask,extra={}){const b=positive(bid),a=positive(ask);return {bid:b,ask:a,mid:b<=a?(b+a)/2:NaN,received:Date.now(),...extra}}
export async function ticker(market){const {exchange:e,type,id}=market,spot=type==='spot';
 if(e==='hl'){const d=await info({type:'l2Book',coin:id});return quote(d.levels?.[0]?.[0]?.px,d.levels?.[1]?.[0]?.px,{time:+d.time})}
 if(e==='bn'){const d=await bin(type,'ticker/bookTicker',{symbol:id});return quote(d.bidPrice,d.askPrice,{time:+d.time||null})}
 if(e==='okx'){const d=(await get(e,'/api/v5/market/ticker',{instId:id})).data[0];if(!d)throw Error('未返回该市场');return quote(d.bidPx,d.askPx,{time:+d.ts,last:+d.last,volume:+d.volCcy24h*(spot?1:+d.last)})}
 if(e==='bybit'){const d=await get(e,'/v5/market/tickers',{category:spot?'spot':'linear',symbol:id}),t=d.result.list[0];if(!t)throw Error('未返回该市场');return quote(t.bid1Price,t.ask1Price,{time:+d.time,last:+t.lastPrice,mark:positive(t.markPrice),oracle:positive(t.indexPrice),funding:t.fundingRate?+t.fundingRate:NaN,fundingHours:positive(t.fundingIntervalHour),volume:+t.turnover24h})}
 if(e==='gate'){const d=(await get(e,spot?'/api/v4/spot/tickers':'/api/v4/futures/usdt/tickers',spot?{currency_pair:id}:{contract:id}))[0];if(!d)throw Error('未返回该市场');return quote(d.highest_bid,d.lowest_ask,{time:null,last:+d.last,mark:positive(d.mark_price),oracle:positive(d.index_price),funding:d.funding_rate?+d.funding_rate:NaN,volume:+(spot?d.quote_volume:d.volume_24h_quote)})}
 if(e==='bitget'){const d=(await get(e,spot?'/api/v2/spot/market/tickers':'/api/v2/mix/market/ticker',spot?{symbol:id}:{symbol:id,productType:'USDT-FUTURES'})).data[0];if(!d)throw Error('未返回该市场');return quote(d.bidPr,d.askPr,{time:+d.ts,last:+d.lastPr,mark:positive(d.markPrice),oracle:positive(d.indexPrice),funding:d.fundingRate?+d.fundingRate:NaN,volume:+d.quoteVolume})}
}
export async function details(market){const {exchange:e,type,id,dex}=market;if(e==='hl'){const d=await info({type:type==='spot'?'spotMetaAndAssetCtxs':'metaAndAssetCtxs',...(dex?{dex}:{})}),i=d[0].universe.findIndex(x=>x.name===id),c=d[1][i];if(!c)return {};return {mark:positive(c.markPx),oracle:positive(c.oraclePx),funding:c.funding?+c.funding:NaN,fundingHours:1,volume:+c.dayNtlVlm,prev:+c.prevDayPx}}
 if(e==='bn'){const [d,c]=await Promise.all([bin(type,'ticker/24hr',{symbol:id}),type==='perp'?bin(type,'premiumIndex',{symbol:id}):Promise.resolve({})]);return {volume:+d.quoteVolume,prev:+d.openPrice,mark:positive(c.markPrice),oracle:positive(c.indexPrice),funding:c.lastFundingRate?+c.lastFundingRate:NaN}}
 const q=await ticker(market);const {bid,ask,mid,time,received,...rest}=q;return rest;
}
export async function candles(market,range){const {exchange:e,type,id}=market,c=RANGES[range],end=Date.now(),start=end-c.days*86400000,spot=type==='spot';let rows;
 if(e==='hl'){const d=await info({type:'candleSnapshot',req:{coin:id,interval:c.interval,startTime:start,endTime:end}});rows=d.map(x=>({t:+x.t,c:+x.c}))}
 if(e==='bn'){const d=await bin(type,'klines',{symbol:id,interval:c.interval,startTime:String(start),endTime:String(end),limit:'1000'});rows=d.map(x=>({t:+x[0],c:+x[4]}))}
 if(e==='okx'){const bar={'5m':'5m','1h':'1H','4h':'4H','1d':'1Dutc'}[c.interval];const d=await get(e,'/api/v5/market/history-candles',{instId:id,bar,after:String(end),limit:'300'});rows=d.data.map(x=>({t:+x[0],c:+x[4]}))}
 if(e==='bybit'){const interval={'5m':'5','1h':'60','4h':'240','1d':'D'}[c.interval];const d=await get(e,'/v5/market/kline',{category:spot?'spot':'linear',symbol:id,interval,start:String(start),end:String(end),limit:'1000'});rows=d.result.list.map(x=>({t:+x[0],c:+x[4]}))}
 if(e==='gate'){const d=await get(e,spot?'/api/v4/spot/candlesticks':'/api/v4/futures/usdt/candlesticks',{...(spot?{currency_pair:id}:{contract:id}),interval:c.interval,from:String(Math.floor(start/1000)),to:String(Math.floor(end/1000))});rows=d.map(x=>spot?{t:+x[0]*1000,c:+x[2]}:{t:+x.t*1000,c:+x.c})}
 if(e==='bitget'){const granularity=spot?{'5m':'5min','1h':'1h','4h':'4h','1d':'1day'}[c.interval]:{'5m':'5m','1h':'1H','4h':'4H','1d':'1Dutc'}[c.interval];let out=[],cursor=end;for(let page=0;page<2;page++){const d=await get(e,spot?'/api/v2/spot/market/history-candles':'/api/v2/mix/market/history-candles',{symbol:id,...(!spot?{productType:'USDT-FUTURES'}:{}),granularity,endTime:String(cursor),limit:'200'});if(!d.data?.length)break;out.push(...d.data);const oldest=Math.min(...d.data.map(x=>+x[0]));if(oldest<=start)break;cursor=oldest-1}rows=out.map(x=>({t:+x[0],c:+x[4]}))}
 return [...new Map((rows||[]).filter(x=>x.t>=start&&x.t+c.ms<=end&&positive(x.c)>0).map(x=>[x.t,x])).values()].sort((a,b)=>a.t-b.t);
}
export function matchHistory(a,b,ratio,fx){const mb=new Map(b.map(x=>[x.t,x.c]));return a.flatMap(x=>{const y=mb.get(x.t),p=premium(x.c,y,ratio,fx);return Number.isFinite(p)?[{t:x.t,a:x.c,b:y,premium:p}]:[]})}
// Streams reconnect independently. Polling remains active as a fallback.
export function stream(market,onQuote,onStatus){let ws,timer,heartbeat,stopped=false,attempt=0,merged={};const {exchange:e,type,id}=market,spot=type==='spot';
 function connect(){if(stopped)return;let endpoint,sub;
  if(e==='hl'){endpoint='wss://api.hyperliquid.xyz/ws';sub={method:'subscribe',subscription:{type:'l2Book',coin:id}}}
  if(e==='bn')endpoint=(spot?'wss://stream.binance.com:9443/ws/':'wss://fstream.binance.com/ws/')+id.toLowerCase()+'@bookTicker';
  if(e==='okx'){endpoint='wss://ws.okx.com:8443/ws/v5/public';sub={op:'subscribe',args:[{channel:'tickers',instId:id}]}}
  if(e==='bybit'){endpoint='wss://stream.bybit.com/v5/public/'+(spot?'spot':'linear');sub={op:'subscribe',args:['tickers.'+id]}}
  if(e==='bitget'){endpoint='wss://ws.bitget.com/v2/ws/public';sub={op:'subscribe',args:[{instType:spot?'SPOT':'USDT-FUTURES',channel:'ticker',instId:id}]}}
  if(e==='gate'){endpoint=spot?'wss://api.gateio.ws/ws/v4/':'wss://fx-ws.gateio.ws/v4/ws/usdt';sub={time:Math.floor(Date.now()/1000),channel:spot?'spot.book_ticker':'futures.book_ticker',event:'subscribe',payload:[id]}}
  try{ws=new WebSocket(endpoint)}catch{onStatus('poll');return}
  ws.onopen=()=>{attempt=0;merged={};if(sub)ws.send(JSON.stringify(sub));heartbeat=setInterval(()=>{if(ws.readyState!==1)return;if(['okx','bitget'].includes(e))ws.send('ping');if(e==='bybit')ws.send(JSON.stringify({op:'ping'}));if(e==='hl')ws.send(JSON.stringify({method:'ping'}));},20000)};
  ws.onmessage=event=>{if(event.data==='pong')return;try{const d=JSON.parse(event.data);let q;
   if(e==='hl'&&d.channel==='l2Book')q=quote(d.data.levels[0][0]?.px,d.data.levels[1][0]?.px,{time:+d.data.time});
   if(e==='bn'&&d.b&&d.a)q=quote(d.b,d.a,{time:+d.E||null});
   if(e==='okx'&&d.data?.[0]){const x=d.data[0];q=quote(x.bidPx,x.askPx,{time:+x.ts})}
   if(e==='bybit'&&d.topic==='tickers.'+id){merged={...merged,...d.data};q=quote(merged.bid1Price,merged.ask1Price,{time:+d.ts})}
   if(e==='bitget'&&d.data?.[0]){const x=d.data[0];q=quote(x.bidPr,x.askPr,{time:+x.ts})}
   if(e==='gate'&&d.event==='update'&&d.result){const x=d.result;q=quote(x.b,x.a,{time:+x.t||+d.time_ms||null})}
   if(q){onQuote(q,'ws');onStatus('ws')}
  }catch{/* Ignore control frames. */}};
  ws.onerror=()=>onStatus('poll');ws.onclose=()=>{clearInterval(heartbeat);if(!stopped){onStatus('poll');timer=setTimeout(connect,Math.min(30000,2000*2**attempt++))}};
 }
 connect();return ()=>{stopped=true;clearTimeout(timer);clearInterval(heartbeat);if(ws){ws.onclose=null;ws.close()}};
}
