/* 가지런 — 안드로이드 앱 전용 다리(bridge).
   웹앱(index.html)은 그대로 두고, 앱 껍데기 안에서만 브라우저 기능을 휴대폰 기능으로 바꿔 끼운다.
   웹 주소로 열었을 때는 이 파일이 실리지 않는다. */
(function(){
  'use strict';
  var C=window.Capacitor, X=window.capacitorExports;
  if(!C||!X||!C.isNativePlatform||!C.isNativePlatform())return;
  var reg=X.registerPlugin;
  var BG=reg('BackgroundGeolocation'), TTS=reg('TextToSpeech'), LN=reg('LocalNotifications'), KA=reg('KeepAwake');
  window.GAJI_NATIVE={ver:1,log:[]};
  var note=function(m){ try{ var L=window.GAJI_NATIVE.log; L.push(new Date().toISOString().slice(11,19)+' '+m); if(L.length>60)L.shift(); }catch(e){} };

  /* ── 1. 위치: 화면이 꺼져도 계속 받는다(달리는 동안 알림 표시) ── */
  var watchers={}, seq=0;
  var toPos=function(l){ return { coords:{ latitude:l.latitude, longitude:l.longitude, accuracy:l.accuracy,
      altitude:l.altitude, altitudeAccuracy:l.altitudeAccuracy, heading:l.bearing, speed:l.speed }, timestamp:l.time||Date.now() }; };
  var geo={
    watchPosition:function(ok,err){
      var id=++seq; watchers[id]={native:null,dead:false};
      BG.addWatcher({ backgroundTitle:'가지런 · 기록 중', backgroundMessage:'달리는 동안 위치를 기록해요',
                      requestPermissions:true, stale:false, distanceFilter:0 },
        function(loc,e){
          var w0=watchers[id]; if(!w0||w0.dead)return;
          if(e){ note('geo err '+(e.code||e.message)); if(err)err({code:e.code==='NOT_AUTHORIZED'?1:2,message:e.message||''}); return; }
          if(loc&&ok)ok(toPos(loc));
        }).then(function(nid){ var w=watchers[id]; if(!w)return; w.native=nid; note('geo on');
          if(w.dead){ BG.removeWatcher({id:nid}); delete watchers[id]; } })
        .catch(function(e){ note('geo fail '+(e&&e.message)); if(err)err({code:2,message:String(e&&e.message||e)}); });
      return id;
    },
    clearWatch:function(id){ var w=watchers[id]; if(!w)return; w.dead=true;
      if(w.native){ BG.removeWatcher({id:w.native}).catch(function(){}); delete watchers[id]; note('geo off'); } },
    getCurrentPosition:function(ok,err){
      var done=false, id=geo.watchPosition(function(p){ if(done)return; done=true; geo.clearWatch(id); ok&&ok(p); },
                                           function(e){ if(done)return; done=true; geo.clearWatch(id); err&&err(e); });
      setTimeout(function(){ if(done)return; done=true; geo.clearWatch(id); err&&err({code:3,message:'timeout'}); },20000);
    }
  };
  try{ Object.defineProperty(navigator,'geolocation',{value:geo,configurable:true}); }catch(e){ note('geo define fail'); }

  /* ── 2. 음성 안내: 휴대폰의 말하기 기능을 쓴다(웹뷰에는 말하기가 없다) ── */
  var q=0;
  var synth={ speaking:false, pending:false, paused:false, onvoiceschanged:null,
    getVoices:function(){ return [{lang:'ko-KR',name:'기본 한국어',default:true,localService:true,voiceURI:'native-ko'}]; },
    speak:function(u){ if(!u||!u.text)return; var my=++q; synth.speaking=true;
      var end=function(ev){ if(my!==q)return; synth.speaking=false; try{ var f=u[ev]; if(typeof f==='function')f({}); }catch(e){} };
      TTS.speak({ text:String(u.text), lang:u.lang||'ko-KR', rate:Math.max(0.5,Math.min(2,u.rate||1)), pitch:u.pitch||1, volume:u.volume==null?1:u.volume, category:'playback' })
        .then(function(){ end('onend'); }).catch(function(e){ note('tts '+(e&&e.message)); end('onerror'); }); },
    cancel:function(){ q++; synth.speaking=false; TTS.stop().catch(function(){}); },
    pause:function(){}, resume:function(){}, addEventListener:function(){}, removeEventListener:function(){} };
  function Utter(t){ this.text=t||''; this.lang=''; this.rate=1; this.pitch=1; this.volume=1; this.voice=null; this.onend=null; this.onerror=null; }
  try{ Object.defineProperty(window,'speechSynthesis',{value:synth,configurable:true}); window.SpeechSynthesisUtterance=Utter; }catch(e){ note('tts define fail'); }

  /* ── 3. 알림 ── */
  var perm='default', nid=1000;
  var show=function(title,o){ o=o||{}; nid++;
    return LN.schedule({notifications:[{ id:nid, title:String(title||'가지런'), body:String(o.body||'') }]}).catch(function(e){ note('noti '+(e&&e.message)); }); };
  function Noti(title,o){ show(title,o); }
  Object.defineProperty(Noti,'permission',{get:function(){ return perm; }});
  Noti.requestPermission=function(){ return LN.requestPermissions().then(function(r){ perm=r.display==='granted'?'granted':'denied'; return perm; }); };
  LN.checkPermissions().then(function(r){ perm=r.display==='granted'?'granted':(r.display==='denied'?'denied':'default'); }).catch(function(){});
  try{ window.Notification=Noti; }catch(e){}
  /* 웹은 서비스워커로 알림을 띄운다 — 앱에는 서비스워커가 필요 없으니 같은 모양의 대역을 둔다 */
  var swReg={ showNotification:function(t,o){ return show(t,o); }, unregister:function(){ return Promise.resolve(true); }, update:function(){ return Promise.resolve(); } };
  try{ Object.defineProperty(navigator,'serviceWorker',{value:{ ready:Promise.resolve(swReg),
        register:function(){ return Promise.resolve(swReg); }, getRegistrations:function(){ return Promise.resolve([]); },
        addEventListener:function(){}, controller:null },configurable:true}); }catch(e){}

  /* ── 4. 화면 켜 두기 ── */
  try{ Object.defineProperty(navigator,'wakeLock',{value:{ request:function(){
        return KA.keepAwake().then(function(){ var l={released:false,release:function(){ l.released=true; return KA.allowSleep().catch(function(){}); },addEventListener:function(){}}; return l; }); } },configurable:true}); }catch(e){}

  /* ── 5. 로그인: 웹의 팝업 로그인은 앱 안에서 바깥 브라우저의 빈 화면으로 빠져 돌아오지 못한다.
        앱용 로그인을 붙일 때까지는 막고 안내만 한다(기록은 폰에 저장). ── */
  window.addEventListener('load',function(){
    try{ if(typeof FB!=='undefined'&&FB&&FB.signIn){ FB.signIn=function(){
           try{ toast('앱 로그인은 준비 중이에요 · 지금은 폰에 저장돼요'); }catch(e){}
           return Promise.resolve(null); }; note('login held'); } }catch(e){ note('login patch fail'); }
  });

  note('native bridge ready');
})();
