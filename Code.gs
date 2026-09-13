const CFG = {
  sheetId: '1WGO43JvYJBDpUvT9jU5VN8sApkAIY4Newa4Ldo23qis',
  studentsGid: 0, subjectsGid: 1914855142,
  studentsCSV: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSYeADjY6U7CEDdwhq-E2QXyO8tXORTtZSz96q805619gfOg0qWbxt2DjFPteKBOYmIF03pcPnJhyYo/pub?gid=0&single=true&output=csv',
  subjectsCSV: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSYeADjY6U7CEDdwhq-E2QXyO8tXORTtZSz96q805619gfOg0qWbxt2DjFPteKBOYmIF03pcPnJhyYo/pub?gid=1914855142&single=true&output=csv'
};
function doGet() { return HtmlService.createHtmlOutputFromFile('Index').setTitle('KAFA AN NUR — Analisis Peperiksaan'); }
function book_() { return SpreadsheetApp.openById(CFG.sheetId); }
function norm_(v) { return String(v||'').toLowerCase().replace(/[^a-z0-9]/g,''); }
function ic_(v) { return String(v||'').replace(/\D/g,''); }
function hash_(s) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join(''); }
// Jalankan dari editor Apps Script. Fungsi berakhir '_' tidak boleh dipanggil dari pelayar.
function setup_() {
  sheet_('KAFA_Rekod',['Kunci','ID Murid','Jenis','Pentaksiran','Subjek','Markah','Dikemas Kini']);
  sheet_('KAFA_Slip',['Kunci','ID Murid','Pentaksiran','Kehadiran','Ulasan Jawi']);
}
function sheet_(name,headers) {let s=book_().getSheetByName(name);if(!s){s=book_().insertSheet(name);s.appendRow(headers);s.setFrozenRows(1);}return s;}
function source_(gid) {const s=book_().getSheetById(gid);if(!s)throw Error('Tab sumber tidak ditemui: '+gid);return s.getDataRange().getDisplayValues();}
function catalog_() {
 const rows=source_(CFG.studentsGid), h=rows.shift().map(norm_);
 const idx=(names,required=true)=>{const i=h.findIndex(x=>names.includes(x));if(i<0&&required)throw Error('Kolum sumber diperlukan: '+names[0]);return i;};
 const ni=idx(['namamurid','namapelajar','nama']),ki=idx(['kelas','namakelas']),ci=idx(['nokadpengenalan','nokp','nokpmurid','ic','mykid','nomorkadpengenalan','nomborkadpengenalan']),ji=idx(['namajawi','namamuridjawi'],false),ti=idx(['tahun','darjah'],false);
 const seen={};const students=rows.filter(r=>r[ni]&&r[ki]).map(r=>{const id=ic_(r[ci]);if(!/^\d{12}$/.test(id))throw Error('No KP mesti 12 digit. Semak format Plain text pada sumber.');if(seen[id])throw Error('No KP berulang dalam sumber.');seen[id]=1;return {id,name:r[ni],kelas:r[ki],jawi:ji<0?'':r[ji],tahun:ti<0?((r[ki].match(/\d+/)||[''])[0]):r[ti]};});
 const sr=source_(CFG.subjectsGid),sh=sr.shift().map(norm_);const pi=sh.findIndex(x=>['pentaksiran','namapentaksiran','peperiksaan'].includes(x)),si=sh.findIndex(x=>['subjek','namasubjek','matapelajaran'].includes(x)),sj=sh.findIndex(x=>['subjekjawi','namasubjekjawi'].includes(x)),pj=sh.findIndex(x=>['pentaksiranjawi','namapentaksiranjawi'].includes(x));
 if(pi<0||si<0)throw Error('Tab subjek memerlukan tajuk Pentaksiran dan Subjek.');
 const subjects=[...new Set(sr.map(r=>r[si]).filter(Boolean))],pens=[...new Set(sr.map(r=>r[pi]).filter(Boolean))],jawi={},penJawi={};
 sr.forEach(r=>{if(sj>=0&&r[sj])jawi[r[si]]=r[sj];if(pj>=0&&r[pj])penJawi[r[pi]]=r[pj];});
 if(!subjects.length||!pens.length)throw Error('Senarai subjek atau pentaksiran kosong.');return {students,subjects,pens,jawi,penJawi};
}
function session_(token,teacher) {const raw=CacheService.getScriptCache().get('s:'+token);if(!raw)throw Error('Sesi tamat. Sila log masuk semula.');const s=JSON.parse(raw);if(teacher&&s.role!=='guru')throw Error('Akses guru diperlukan.');return s;}
function login(role,user,password) {
 const cache=CacheService.getScriptCache(),key='attempt:'+hash_(role==='guru'?'guru':ic_(user)),n=Number(cache.get(key)||0);if(n>=8)throw Error('Terlalu banyak cubaan. Cuba selepas 10 minit.');cache.put(key,String(n+1),600);
 let s;
 if(role==='guru'){if(hash_(String(password))!=='635b3393c7337455f88ffd2ac80948a0d07767ddc0aa6655230ef5371ffde17b')throw Error('Kata laluan guru tidak sah.');s={role:'guru'};}
 else if(role==='ibu'){const id=ic_(user);if(!/^\d{12}$/.test(id)||!catalog_().students.some(x=>x.id===id))throw Error('Maklumat log masuk tidak sah.');s={role:'ibu',id};}else throw Error('Peranan tidak sah.');
 const token=Utilities.getUuid()+Utilities.getUuid();cache.put('s:'+token,JSON.stringify(s),21600);cache.remove(key);return {token,role:s.role};
}
function logout(token){CacheService.getScriptCache().remove('s:'+token);}
function records_(){const s=book_().getSheetByName('KAFA_Rekod');if(!s)throw Error('Jalankan setup_ dahulu.');return s.getDataRange().getDisplayValues().slice(1).filter(r=>r[0]);}
function grade_(v){if(v==='TH')return 'TH';if(v===''||v==null)return '';const n=Number(v);if(!Number.isFinite(n)||n<1||n>70)return '';return n>=53?'A':n>=35?'B':n>=17?'C':'D';}
function summary_(student,pen,c,rows){const rs=rows.filter(r=>r[1]===student.id&&r[2]==='akademik'&&r[3]===pen&&c.subjects.includes(r[4]));const complete=c.subjects.every(sub=>rs.some(r=>r[4]===sub&&(grade_(r[5])!=='')));const total=rs.reduce((a,r)=>a+(r[5]==='TH'?0:Number(r[5])||0),0),max=c.subjects.length*70;return {total,max,pct:max?total/max*100:0,complete,grade:complete?(rs.every(r=>r[5]==='TH')?'TH':grade_(Math.max(1,total/c.subjects.length))):''};}
function rank_(student,pen,c,rows,scope){const pool=c.students.filter(x=>scope==='kelas'?x.kelas===student.kelas:x.tahun===student.tahun).map(x=>({id:x.id,...summary_(x,pen,c,rows)})).filter(x=>x.complete);const t=pool.find(x=>x.id===student.id);return t?String(1+pool.filter(x=>x.total>t.total).length)+' / '+pool.length:'—';}
function getData(token){
 const session=session_(token),c=catalog_(),rows=records_();const ids=session.role==='guru'?new Set(c.students.map(x=>x.id)):new Set([session.id]);
 const slips=book_().getSheetByName('KAFA_Slip').getDataRange().getDisplayValues().slice(1).filter(r=>ids.has(r[1]));
 const own=c.students.filter(x=>ids.has(x.id));const summaries={};own.forEach(s=>c.pens.forEach(p=>{summaries[s.id+'_'+p]={...summary_(s,p,c,rows),rankClass:rank_(s,p,c,rows,'kelas'),rankYear:rank_(s,p,c,rows,'tahun')};}));
 return {...c,students:own,records:rows.filter(r=>ids.has(r[1])),slips,summaries};
}
function saveData(token,records){session_(token,true);if(!Array.isArray(records)||records.length>1000)throw Error('Saiz rekod tidak sah.');const c=catalog_();
 const clean=records.map(r=>{if(!c.students.some(s=>s.id===r.id)||!c.pens.includes(r.pentaksiran)||!['akademik','sahsiah'].includes(r.jenis))throw Error('Rekod tidak dikenali.');let v=String(r.markah).trim().toUpperCase();if(r.jenis==='akademik'){if(!c.subjects.includes(r.subjek)||!(v===''||v==='TH'||(/^\d+$/.test(v)&&Number(v)>=1&&Number(v)<=70)))throw Error('Markah akademik mestilah 1–70, TH atau kosong.');}else if(v!==''&&!(/^\d+$/.test(v)&&Number(v)>=0&&Number(v)<=100))throw Error('Sahsiah mesti 0–100.');const sub=r.jenis==='akademik'?r.subjek:'';return [JSON.stringify([r.id,r.jenis,r.pentaksiran,sub]),r.id,r.jenis,r.pentaksiran,sub,v,new Date().toISOString()];});
 const lock=LockService.getScriptLock();lock.waitLock(30000);try{const s=book_().getSheetByName('KAFA_Rekod'),existing=records_(),map=new Map(existing.map(r=>[r[0],r]));clean.forEach(r=>map.set(r[0],r));const out=[...map.values()];if(out.length)s.getRange(2,1,out.length,7).setNumberFormat('@').setValues(out.map(r=>r.map(safeCell_)));SpreadsheetApp.flush();return {saved:clean.length};}finally{lock.releaseLock();}
}
function safeCell_(v){v=String(v);return /^[=+@-]/.test(v)?"'"+v:v;}
function saveSlip(token,id,pen,attendance,comment){session_(token,true);const c=catalog_();if(!c.students.some(x=>x.id===id)||!c.pens.includes(pen)||String(comment).length>500||String(attendance).length>30)throw Error('Maklumat slip tidak sah.');const lock=LockService.getScriptLock();lock.waitLock(30000);try{const s=book_().getSheetByName('KAFA_Slip'),rows=s.getDataRange().getDisplayValues(),key=JSON.stringify([id,pen]),i=rows.findIndex(r=>r[0]===key);s.getRange(i<0?s.getLastRow()+1:i+1,1,1,5).setNumberFormat('@').setValues([[key,id,pen,attendance,comment].map(safeCell_)]);return {saved:1};}finally{lock.releaseLock();}}

// Endpoint untuk GitHub Pages. Kekalkan semakan sesi dalam setiap fungsi asal.
function doPost(e) {
 try {
  if(!e || !e.postData || !e.postData.contents)throw Error('Permintaan kosong.');
  if(e.postData.contents.length>500000)throw Error('Permintaan terlalu besar.');
  const req=JSON.parse(e.postData.contents);
  if(req.version!==1 || !Array.isArray(req.args))throw Error('Format permintaan tidak sah.');
  const actions={login:{fn:login,n:3},logout:{fn:logout,n:1},getData:{fn:getData,n:1},saveData:{fn:saveData,n:2},saveSlip:{fn:saveSlip,n:5}};
  if(!Object.prototype.hasOwnProperty.call(actions,req.action))throw Error('Tindakan tidak dibenarkan.');
  const action=actions[req.action];
  if(req.args.length!==action.n)throw Error('Parameter tidak lengkap.');
  const data=action.fn.apply(null,req.args);
  return jsonResponse_({ok:true,data:data===undefined?null:data});
 }catch(err){return jsonResponse_({ok:false,error:String(err.message||'Ralat pelayan.').slice(0,1000)});}
}
function jsonResponse_(data) {return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);}
