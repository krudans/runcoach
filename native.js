/* 가지런 — 안드로이드 앱 전용 다리(bridge).
   앱 껍데기 안에서만 브라우저 기능을 휴대폰 기능으로 바꿔 끼운다.
   앱은 웹 주소의 화면을 그대로 불러오므로, 화면·규칙을 고치면 재설치 없이 반영된다.
   브라우저로 열었을 때는 index.html이 이 파일을 싣지 않는다. */
(function(){
  'use strict';
  var C=window.Capacitor;
  if(!C||!C.isNativePlatform||!C.isNativePlatform()||!C.nativePromise||window.GAJI_NATIVE)return;
  /* 휴대폰 기능 부르기 — 앱 껍데기가 넣어 준 다리(Capacitor)만 쓴다. 따로 실을 라이브러리가 없다. */
  var reg=function(name){ return new Proxy({},{get:function(_,m){ return function(o,cb){
      if(typeof cb==='function')return Promise.resolve(C.nativeCallback(name,m,o||{},cb));
      return C.nativePromise(name,m,o||{}); }; }}); };
  var BG=reg('BackgroundGeolocation'), TTS=reg('TextToSpeech'), LN=reg('LocalNotifications'), KA=reg('KeepAwake');
  window.GAJI_NATIVE={ver:5,log:[]};
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
  /* 웹은 서비스워커로 알림을 띄운다 — 서비스워커는 그대로 두고(신호 없을 때 앱을 여는 데 쓴다) 알림 띄우기만 바꾼다 */
  try{ if(window.ServiceWorkerRegistration)ServiceWorkerRegistration.prototype.showNotification=function(t,o){ return show(t,o); }; }catch(e){}

  /* ── 4. 화면 켜 두기 ── */
  try{ Object.defineProperty(navigator,'wakeLock',{value:{ request:function(){
        return KA.keepAwake().then(function(){ var l={released:false,release:function(){ l.released=true; return KA.allowSleep().catch(function(){}); },addEventListener:function(){}}; return l; }); } },configurable:true}); }catch(e){}

  /* ── 5. 구글 로그인: 웹의 팝업 로그인은 앱 안에서 바깥 브라우저의 빈 화면으로 빠져 돌아오지 못한다.
        앱에서는 휴대폰의 구글 계정 고르기 창으로 로그인하고, 받은 증표로 웹과 같은 Firebase 계정에 들어간다
        (같은 구글 계정이면 웹앱과 같은 기록·목표를 본다). 로그인 기능이 없는 예전 설치본에서는 안내만 한다. ── */
  var WEB_CLIENT='306293727512-od09dhml33jfn5pqa10e55poh4s8eeu7.apps.googleusercontent.com';
  var SL=reg('SocialLogin'), slInit=null;
  var hasSL=function(){ try{ return (C.PluginHeaders||[]).some(function(h){ return h&&h.name==='SocialLogin'; }); }catch(e){ return false; } };
  var googleCred=function(){
    slInit=slInit||SL.initialize({google:{webClientId:WEB_CLIENT}}).catch(function(e){ slInit=null; throw e; });
    return slInit.then(function(){ return SL.login({provider:'google',options:{}}); }).then(function(r){
      var tok=r&&r.result&&r.result.idToken; if(!tok)throw new Error('구글에서 로그인 증표를 받지 못했어요');
      return firebase.auth.GoogleAuthProvider.credential(tok); }); };
  window.GAJI_NATIVE.canLogin=hasSL;
  window.GAJI_NATIVE.googleCred=googleCred;
  window.addEventListener('load',function(){
    try{ if(typeof FB!=='undefined'&&FB&&FB.signIn){
      var webOut=FB.signOut;
      FB.signIn=function(){
        if(!hasSL()){ try{ toast('앱을 새 버전으로 설치하면 로그인돼요 · 지금은 폰에 저장돼요'); }catch(e){} return Promise.resolve(null); }
        return Promise.resolve(FB.init()).then(function(ok){ if(!ok)throw new Error(FB.err||'Firebase 설정값 먼저');
          return googleCred(); }).then(function(cred){ return firebase.auth().signInWithCredential(cred); })
          .then(function(res){ if(res&&res.user)FB.user=res.user; note('login ok'); return (res&&res.user)||firebase.auth().currentUser||null; },
            function(e){ var m=String(e&&e.message||e); note('login '+m.slice(0,80));
              if(/cancel|취소|closed|dismiss/i.test(m))return null;      /* 계정 고르기 창을 닫은 것 — 오류가 아니다 */
              throw new Error(m); }); };
      FB.signOut=function(){ try{ if(hasSL())SL.logout({provider:'google'}).catch(function(){}); }catch(e){} return webOut.apply(FB,arguments); };
      note(hasSL()?'login native':'login held'); } }catch(e){ note('login patch fail'); }
  });

  /* ── 6. 블루투스 심박: 웹뷰에는 웹 블루투스가 없다 — 휴대폰의 블루투스 기능으로 같은 모양을 만들어 준다.
        앱 본문(index.html)의 심박 연결 코드는 그대로 쓴다. ── */
  try{ if(!navigator.bluetooth){
    var BLE=reg('BluetoothLe'), U=function(s){ return '0000'+s+'-0000-1000-8000-00805f9b34fb'; };
    var NM={heart_rate:U('180d'),heart_rate_measurement:U('2a37'),battery_service:U('180f'),battery_level:U('2a19')};
    var uu=function(s){ return NM[s]||String(s).toLowerCase(); };
    var hex2dv=function(h){ h=String(h||'').replace(/[^0-9a-f]/gi,''); var a=new Uint8Array(h.length>>1);
      for(var i=0;i<a.length;i++)a[i]=parseInt(h.substr(i*2,2),16); return new DataView(a.buffer); };
    var bleInit=null, init=function(){ return bleInit||(bleInit=BLE.initialize({}).catch(function(e){ bleInit=null; note('ble init '+(e&&e.message)); throw e; })); };
    var known=function(){ try{ return JSON.parse(localStorage.getItem('gaji_ble')||'[]'); }catch(e){ return []; } };
    var remember=function(id,name){ try{ var k=known().filter(function(x){ return x.id!==id; }); k.unshift({id:id,name:name||''}); localStorage.setItem('gaji_ble',JSON.stringify(k.slice(0,5))); }catch(e){} };
    var devs={};
    var mkDev=function(id,name){ if(devs[id]){ if(name)devs[id].name=name; return devs[id]; }
      var ls={}, nl={}, dl=null;
      var dev={ id:id, name:name||'',
        addEventListener:function(t,f){ (ls[t]=ls[t]||[]).push(f); },
        removeEventListener:function(t,f){ ls[t]=(ls[t]||[]).filter(function(x){ return x!==f; }); } };
      var fire=function(t){ (ls[t]||[]).slice().forEach(function(f){ try{ f({target:dev}); }catch(e){} }); };
      var mkChar=function(su,cu){ var cl=[], ch={ uuid:cu, value:null,
          addEventListener:function(t,f){ if(t==='characteristicvaluechanged')cl.push(f); },
          removeEventListener:function(t,f){ cl=cl.filter(function(x){ return x!==f; }); },
          startNotifications:function(){ var key='notification|'+id+'|'+su+'|'+cu;
            try{ if(nl[key])nl[key].remove(); }catch(e){}      /* 다시 연결할 때 예전 수신기가 겹쳐 쌓이지 않게 */
            nl[key]=C.addListener('BluetoothLe',key,function(ev){ if(!ev)return; ch.value=hex2dv(ev.value);
              cl.slice().forEach(function(f){ try{ f({target:ch}); }catch(e){} }); });
            return BLE.startNotifications({deviceId:id,service:su,characteristic:cu}).then(function(){ return ch; }); },
          stopNotifications:function(){ return BLE.stopNotifications({deviceId:id,service:su,characteristic:cu}).then(function(){ return ch; }); },
          readValue:function(){ return BLE.read({deviceId:id,service:su,characteristic:cu}).then(function(r){ ch.value=hex2dv(r&&r.value); return ch.value; }); } };
        return ch; };
      dev.gatt={ connected:false, device:dev,
        connect:function(){ return init().then(function(){ return BLE.connect({deviceId:id,timeout:15000}); }).then(function(){
            dev.gatt.connected=true; note('ble on '+(dev.name||id));
            if(!dl)dl=C.addListener('BluetoothLe','disconnected|'+id,function(){ if(!dev.gatt.connected)return; dev.gatt.connected=false; note('ble off'); fire('gattserverdisconnected'); });
            return dev.gatt; }); },
        disconnect:function(){ var was=dev.gatt.connected; dev.gatt.connected=false; BLE.disconnect({deviceId:id}).catch(function(){}); if(was)fire('gattserverdisconnected'); },
        getPrimaryService:function(s){ var su=uu(s);
          return BLE.getServices({deviceId:id}).then(function(r){
            var has=((r&&r.services)||[]).some(function(x){ return String(x.uuid).toLowerCase()===su; });
            if(!has){ var e=new Error('service not found'); e.name='NotFoundError'; throw e; }
            return { uuid:su, getCharacteristic:function(c){ return Promise.resolve(mkChar(su,uu(c))); } }; }); } };
      devs[id]=dev; return dev; };
    var bt={
      getAvailability:function(){ return Promise.resolve(true); },
      /* 기기 고르기 — 휴대폰이 주변 기기 목록을 띄운다. 심박 서비스를 알리지 않는 워치가 많아 이름·서비스로 거르지 않는다 */
      requestDevice:function(){ return init().then(function(){ return BLE.requestDevice({optionalServices:[NM.heart_rate,NM.battery_service]}); })
        .then(function(d){ if(!d||!d.deviceId){ var e=new Error('cancelled'); e.name='NotFoundError'; throw e; }
          remember(d.deviceId,d.name); return mkDev(d.deviceId,d.name); },
          function(e){ note('ble pick '+(e&&e.message)); var x=new Error(String(e&&e.message||'cancelled')); x.name='NotFoundError'; throw x; }); },
      getDevices:function(){ var k=known(); if(!k.length)return Promise.resolve([]);
        return init().then(function(){ return k.map(function(x){ return mkDev(x.id,x.name); }); }); } };
    Object.defineProperty(navigator,'bluetooth',{value:bt,configurable:true}); note('ble shim');
  } }catch(e){ note('ble define fail'); }

  /* ── 7. 종료: 웹의 창 닫기(window.close)는 앱 화면에서 아무 일도 하지 않는다 — 종료 단추가 앱을 실제로 끝내게 한다 ── */
  try{ var APP=reg('App'); window.close=function(){ note('exit'); APP.exitApp().catch(function(e){ note('exit '+(e&&e.message)); }); }; }catch(e){ note('exit define fail'); }

  note('native bridge ready');
})();
