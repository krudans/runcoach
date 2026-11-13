/* cap add android 로 만든 프로젝트에 가지런 설정을 입힌다(버전·알림 아이콘·이름). */
const fs=require('fs'), path=require('path');
const here=path.join(__dirname,'..'), app=path.join(here,'android/app');
const v=fs.readFileSync(path.join(here,'.appver'),'utf8').trim();
const [a,b]=v.split('.').map(Number); const code=a*1000+(b||0);           /* 20.56 → 20056 */
let g=fs.readFileSync(path.join(app,'build.gradle'),'utf8');
g=g.replace(/versionCode \d+/,'versionCode '+code).replace(/versionName "[^"]*"/,'versionName "'+v+'"');
/* 시험용 서명 — 빌드할 때마다 서명이 바뀌면 폰에서 덮어 설치가 안 되고 기록이 지워진다. 열쇠 하나를 고정해 쓴다.
   열쇠와 비밀번호는 저장소에 두지 않는다 — GitHub Actions 비밀값(KEYSTORE_B64 · KEYSTORE_PASS)에서 받는다.
   (예전엔 열쇠 파일과 비밀번호가 공개 저장소에 있어 누구나 같은 서명으로 앱을 만들 수 있었다. 2026-11-13 교체)
   스토어 출시용 열쇠는 이것과 별개이며 역시 저장소에 넣지 않는다. */
const kb=(process.env.KEYSTORE_B64||'').replace(/\s+/g,''), kp=process.env.KEYSTORE_PASS||'';
if(!kb||!kp){ console.error('서명 열쇠 비밀값이 없습니다 — 저장소 Settings › Secrets and variables › Actions 에 KEYSTORE_B64, KEYSTORE_PASS 를 넣어 주세요'); process.exit(1); }
if(!/signingConfigs/.test(g)){
  fs.writeFileSync(path.join(here,'signing.keystore'),Buffer.from(kb,'base64'));
  g=g.replace(/android \{/,`android {
    signingConfigs {
        debug {
            storeFile file('../../signing.keystore')
            storePassword System.getenv('KEYSTORE_PASS')
            keyAlias 'gajirun'
            keyPassword System.getenv('KEYSTORE_PASS')
        }
    }`);
}
fs.writeFileSync(path.join(app,'build.gradle'),g);
const res=path.join(app,'src/main/res');
let s=fs.readFileSync(path.join(res,'values/strings.xml'),'utf8');
if(!/capacitor_background_geolocation_notification_icon/.test(s)){
  s=s.replace('</resources>',
`    <string name="capacitor_background_geolocation_notification_channel_name">달리기 기록</string>
    <string name="capacitor_background_geolocation_notification_icon">drawable/ic_tracking</string>
    <string name="capacitor_background_geolocation_notification_color">#5B2D86</string>
</resources>`);
  fs.writeFileSync(path.join(res,'values/strings.xml'),s);
}
fs.mkdirSync(path.join(res,'drawable'),{recursive:true});
fs.writeFileSync(path.join(res,'drawable/ic_tracking.xml'),
`<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">
  <path android:fillColor="#FFFFFFFF" android:pathData="M12,2C8.1,2 5,5.1 5,9c0,5.2 7,13 7,13s7,-7.8 7,-13C19,5.1 15.9,2 12,2zM12,11.5A2.5,2.5 0,1 1,12 6.5a2.5,2.5 0,0 1,0 5z"/>
</vector>
`);
console.log('안드로이드 설정 적용 — versionName',v,'versionCode',code);
