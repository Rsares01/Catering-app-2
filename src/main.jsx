import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import { jsPDF } from 'jspdf';

const steps = [
  { key:'date', title:'Für welchen Tag ist die Abrechnung?', help:'Das Datum wird auf die PDF gedruckt.', type:'date' },
  { key:'employee', title:'Wer macht die Abendabrechnung?', help:'Optional – Name der Mitarbeiterin oder des Mitarbeiters.', type:'text', label:'Name (optional)', placeholder:'Mitarbeiter/in' },
  { key:'floatConfirmed', title:'Sind zuerst 120,00 € ins Kellnerportemonnaie gelegt?', help:'Lege zuerst genau 120,00 € beiseite. Dieser Betrag wird nicht noch einmal abgezogen.', type:'confirm' },
  { key:'cashLeft', title:'Wie viel Bargeld ist danach übrig?', help:'Zähle nur das übrige Bargeld, nachdem die 120,00 € im Kellnerportemonnaie liegen.', type:'money' },
  { key:'items', title:'Welche Speisen und Getränke wurden verkauft?', help:'Gib die Stückzahlen ein. Der Tagesumsatz wird automatisch aus den Artikelpreisen berechnet.', type:'items' },
  { key:'card', title:'Wie hoch sind die EC-/Kartenzahlungen?', type:'money' },
  { key:'clubkasse', title:'Clubkasse Rotary', help:'Diese Rechnung wird separat dokumentiert und nicht in die Trinkgeldberechnung eingerechnet.', type:'clubkasse' },
  { key:'payouts', title:'Wie viel wurde an Aushilfen ausgezahlt?', help:'Summe aller Aushilfen und sonstigen Auszahlungen.', type:'money' },
  { key:'vouchers', title:'Wie hoch ist der Wert der heute eingelösten Gutscheine?', help:'Trage hier ausschließlich Gutscheine ein, die heute tatsächlich eingelöst wurden. Wenn ein eingelöster Gutschein mit EC bezahlt worden war: Den EC-Beleg aus dem Gutschein nehmen, den gleichen Geldbetrag in den Gutschein hineinlegen und den Gutschein separat aufbewahren. Den Gutschein nicht ein zweites Mal abrechnen. Nicht eingelöste Gutscheine gehören nicht in dieses Feld.', type:'money' },
  { key:'receipts', title:'Wie hoch ist die Summe der Quittungen?', help:'Wenn keine Quittungen vorliegen, 0,00 € eingeben.', type:'money' },
];
const euro = n => new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(Number(n)||0);
const today = () => new Date().toLocaleDateString('sv-SE');
function App(){
 const [answers,setAnswers] = useState({date:today(),employee:'',floatConfirmed:false,cashLeft:'0,00',sales:'0,00',card:'0,00',payouts:'0,00',vouchers:'0,00',other:'0,00',receipts:'0,00'}); const [itemQty,setItemQty] = useState([0,0,0,0,0,0,0,0]); const menuItems=[{name:'Hauptgang (Standard)',price:24.50},{name:'Hauptgang klein',price:22.50},{name:'Salat Hähnchen',price:22.50},{name:'Salat Hähnchen klein',price:20.50},{name:'Salat Veggie',price:20.50},{name:'Salat Veggie klein',price:18.50},{name:'Wasser groß',price:7.50},{name:'Wasser klein',price:3.00}]; const itemSalesTotal=menuItems.reduce((sum,item,i)=>sum+item.price*(Number(itemQty[i])||0),0);
 const [step,setStep] = useState(0); const [done,setDone] = useState(false); const [kind,setKind] = useState(null); const [archiveOpen,setArchiveOpen] = useState(false); const [archiveItems,setArchiveItems] = useState([]); const [archiveError,setArchiveError] = useState(''); const [archiveSaving,setArchiveSaving] = useState(false); const [archiveSaved,setArchiveSaved] = useState(false); const [archiveNumber,setArchiveNumber] = useState(''); const [clubkasseAmount,setClubkasseAmount] = useState('0,00');
  const set = (k,v)=>setAnswers(a=>({...a,[k]:v}));
 const amount = k => Number(String(answers[k]??0).replace(/\s/g,'').replace(/\./g,'').replace(',','.'))||0;
 const result = useMemo(()=>amount('cashLeft')+amount('card')+amount('payouts')+amount('vouchers')+amount('other')+amount('receipts')-itemSalesTotal,[answers,itemSalesTotal]);
 const moneyLabel = {cashLeft:'Übriges Bargeld',sales:'Tagesumsatz laut Kasse',card:'EC-/Kartenzahlungen',payouts:'Aushilfen / Auszahlungen',vouchers:'Eingelöste Gutscheine',other:'Sonstige Beträge',receipts:'Quittungen'};
 const makePdfBase64 = () => {
  const doc = new jsPDF();
  const lines = ['GO RESTAURANT – ABRECHNUNG','Art: '+(kind==='rotary'?'Montags Rotary':'Abendkasse'),'Datum: '+answers.date,'Mitarbeiter/in: '+(answers.employee||'—'),'','Tagesumsatz aus Artikeln: '+euro(itemSalesTotal),'Übriges Bargeld: '+euro(amount('cashLeft')),'EC-/Kartenzahlungen: '+euro(amount('card')),'Clubkasse Rotary (separat, nicht verrechnet): '+euro(Number(String(clubkasseAmount||0).replace(/\s/g,'').replace(/\./g,'').replace(',','.'))||0)];
  lines.push('Aushilfen / Auszahlungen: '+euro(amount('payouts')),'Eingelöste Gutscheine: '+euro(amount('vouchers')),'Quittungen: '+euro(amount('receipts')),'','Trinkgeld / Differenz: '+euro(result),'Auszahlbares Trinkgeld: '+euro(Math.max(0,result)));
  let y=18; lines.forEach(line=>{const wrapped=doc.splitTextToSize(line,180);if(y+wrapped.length*7>280){doc.addPage();y=18;}doc.text(wrapped,15,y);y+=wrapped.length*7;});
  return doc.output('datauristring').split(',')[1];
 };
 const loadArchive = async () => { setArchiveError(''); try { const r=await fetch('/api/archive'); const d=await r.json(); if(!r.ok)throw new Error(d.error||'Archivzugriff fehlgeschlagen.');setArchiveItems(d.records||[]); } catch(e){setArchiveError(e.message||'Archivzugriff fehlgeschlagen.');} };
 const saveArchiveRecord = async () => { if(archiveSaved||archiveSaving)return;setArchiveSaving(true);setArchiveError('');try{const pdfBase64=makePdfBase64();const r=await fetch('/api/archive',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date:answers.date,kind:kind==='rotary'?'Montags Rotary':'Abendkasse',employee:answers.employee||'',amount:euro(result),pdfBase64})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Speichern fehlgeschlagen.');setArchiveNumber(d.record.number);setArchiveSaved(true);}catch(e){setArchiveError(e.message||'Speichern fehlgeschlagen.');}finally{setArchiveSaving(false);} };
 const downloadArchivedPdf = item => {const a=document.createElement('a');a.href='data:application/pdf;base64,'+item.pdfBase64;a.download=item.filename||('Abrechnung-'+item.number+'.pdf');a.click();};

 const pdf = () => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const lines = [
   'GO RESTAURANT – ABRECHNUNG',
   'Art: '+(kind==='rotary'?'Montags Rotary':'Abendkasse'),
   'Datum: '+answers.date,
   'Mitarbeiter/in: '+(answers.employee||'—'),
   '',
   'KELLNERPORTEMONNAIE',
   '120,00 € wurden zuerst beiseitegelegt: '+(answers.floatConfirmed?'Ja':'Nicht bestätigt'),
   '',
   'UMSATZ UND ABZÜGE',
   'Tagesumsatz aus Artikeln: '+euro(itemSalesTotal),
   'Übriges Bargeld / Barzahlungen: '+euro(amount('cashLeft')),
   'EC-/Kartenzahlungen: '+euro(amount('card')),
   'Clubkasse Rotary (separat, nicht verrechnet): '+euro(Number(String(clubkasseAmount||0).replace(/\s/g,'').replace(/\./g,'').replace(',','.'))||0)
  ];
  lines.push(
   'Aushilfen / Auszahlungen: '+euro(amount('payouts')),
   'Eingelöste Gutscheine: '+euro(amount('vouchers')),
   'Sonstige Beträge: '+euro(amount('other')),
   'Quittungen: '+euro(amount('receipts')),
   '',
   'ERGEBNIS',
   'Trinkgeld / Differenz: '+euro(result),
   'Auszahlbares Trinkgeld: '+euro(Math.max(0,result)),
   '',
   'Rechenweg: Bargeld + EC/Kartenzahlungen + Auszahlungen + eingelöste Gutscheine + sonstige Beträge + Quittungen minus Artikelumsatz. Clubkasse Rotary wird separat dokumentiert und nicht verrechnet.',
   'Die 120,00 € im Kellnerportemonnaie werden nicht noch einmal abgezogen.'
  );
  let y = 18;
  for (const line of lines) {
   const wrapped = doc.splitTextToSize(line, 180);
   const needed = Math.max(6, wrapped.length * 6);
   if (y + needed > 280) { doc.addPage(); y = 18; }
   doc.setFont('helvetica', line.startsWith('GO RESTAURANT') || line==='UMSATZ UND ABZÜGE' || line==='ERGEBNIS' ? 'bold' : 'normal');
   doc.setFontSize(line.startsWith('GO RESTAURANT') ? 14 : 10);
   doc.text(wrapped, 15, y);
   y += needed;
  }
  const filename = (kind==='rotary'?'Montags_Rotary_':'Abendkasse_')+answers.date+'.pdf';
  doc.save(filename);
 };
 const current = steps[step];
 if (archiveOpen) return <main><header><button className="back-home secondary" onClick={()=>setArchiveOpen(false)}>Zurück zur Auswahl</button><h1>Abrechnungsarchiv</h1><p className="muted">Gespeicherte Monats-PDFs</p></header><section className="panel">{archiveItems.length===0?<p>Noch keine Abrechnungen gespeichert.</p>:Object.entries(archiveItems.reduce((g,x)=>{(g[x.month||'Ohne Datum']??=[]).push(x);return g;},{})).sort(([a],[b])=>b.localeCompare(a)).map(([m,items])=><div className="invoice-row" key={m}><h3>{m}</h3>{items.map(x=><div className="known-company" key={x.number}><span><b>{x.number}</b> · {x.date} · {x.kind} · {x.amount}</span><button className="small secondary" onClick={()=>downloadArchivedPdf(x)}>PDF öffnen</button></div>)}</div>)}{archiveError&&<p className="help">{archiveError}</p>}</section></main>;

 if (!kind) return <main><header><span className="logo">GO</span><span className="eyebrow">RESTAURANT</span><h1>Abrechnung auswählen</h1><p className="muted">Wähle aus, welche Abrechnung du durchführen möchtest.</p></header><section className="panel picker"><button className="choice" onClick={()=>{setKind('evening');setStep(0);setDone(false)}}><strong>Abendkasse</strong><span>Normale Tages- und Kassenabrechnung</span></button><button className="choice rotary" onClick={()=>{setKind('rotary');setStep(0);setDone(false)}}><strong>Montags Rotary</strong><span>Separate Abrechnung für Montags Rotary</span></button><button className="choice" onClick={()=>{setArchiveItems([]);setArchiveOpen(true);loadArchive()}}><strong>Abrechnungsarchiv</strong><span>Monats-PDFs aufrufen</span></button></section></main>;
 return <main><header><button className="back-home secondary" onClick={()=>{setKind(null);setStep(0);setDone(false)}}>Zurück zur Auswahl</button><span className="logo">GO</span><span className="eyebrow">RESTAURANT</span><h1>{kind==='rotary'?'Montags Rotary':'Abendkasse'}</h1><p className="muted">Schritt {done?12:step+1} von 12 · Die Angaben werden nicht gespeichert.</p><div className="progress"><i style={{width:done?'100%':((step+1)/12*100)+'%'}}/></div></header>
 {!done ? <section className="panel"><h2>{current.title}</h2>{current.help&&<p className="help">{current.help}</p>}
 {current.type==='date'&&<label>Datum<input type="date" value={answers.date} onChange={e=>set('date',e.target.value)}/></label>}
 {current.type==='text'&&<label>{current.label}<input value={answers.employee} placeholder={current.placeholder} onChange={e=>set('employee',e.target.value)}/></label>}
 {current.type==='confirm'&&<label className="check"><input type="checkbox" checked={answers.floatConfirmed} onChange={e=>set('floatConfirmed',e.target.checked)}/>120,00 € liegen im Kellnerportemonnaie</label>}
 {current.type==='money'&&<label>Betrag in Euro<input inputMode="decimal" value={answers[current.key]} onChange={e=>set(current.key,e.target.value)} placeholder="0,00"/></label>}
 {current.type==='items'&&<div className="invoice-list">{menuItems.map((item,i)=><div className="invoice-row" key={item.name}><label>{item.name} · {euro(item.price)}<input type="number" min="0" step="1" inputMode="numeric" value={itemQty[i]} onChange={e=>setItemQty(q=>q.map((n,index)=>index===i?Math.max(0,Number(e.target.value)||0):n))} placeholder="Menge"/></label><p>Zwischensumme: <strong>{euro(item.price*(Number(itemQty[i])||0))}</strong></p></div>)}<p className="invoice-total">Artikelumsatz gesamt: <strong>{euro(itemSalesTotal)}</strong></p></div>}
 {current.type==='clubkasse'&&<div className="invoice-list"><label>Name<input value="Rotary" readOnly/></label><label>Clubkasse Rotary – Betrag in Euro<input inputMode="decimal" value={clubkasseAmount} onChange={e=>setClubkasseAmount(e.target.value)} placeholder="0,00"/></label><p className="help">Wird separat gespeichert und nicht gegengerechnet.</p></div>}
 <nav><button className="secondary" onClick={()=>step===0?location.reload():setStep(s=>s-1)}>Zurück</button><button onClick={()=>{if(current.type==='confirm'&&!answers.floatConfirmed){alert('Bitte bestätige zuerst, dass die 120,00 € im Kellnerportemonnaie liegen.');return;} if(step===steps.length-1){setDone(true);saveArchiveRecord()}else setStep(s=>s+1)}}>Weiter</button></nav>
 <p className="privacy">Die Abrechnung wird beim Abschluss automatisch als PDF im Archiv gespeichert.</p></section>
 : <section className="panel"><h2>Abrechnung fertig</h2><p className="help">{archiveSaved?("Gespeichert als "+archiveNumber+".pdf"):archiveSaving?"PDF wird gespeichert …":"Abrechnung als PDF im Archiv speichern."}</p>{archiveError&&<p className="help">{archiveError}</p>}{!archiveSaved&&<button className="wide" disabled={archiveSaving} onClick={saveArchiveRecord}>{archiveSaving?"Wird gespeichert …":"Abrechnung abschließen und archivieren"}</button>}<div className="result"><b>Ergebnis der Abrechnung</b><p>Trinkgeld / Differenz: <strong>{euro(result)}</strong></p><p>Auszahlbares Trinkgeld: <strong>{euro(Math.max(0,result))}</strong></p><button className="wide" onClick={pdf}>Abrechnung als Datei herunterladen</button><button className="wide secondary" onClick={()=>{if(navigator.share)navigator.share({title:'Abendkasse',text:'Abendkasse '+answers.date+' – '+euro(result)}).catch(()=>{});else alert('Bitte zuerst die Abrechnung als Datei herunterladen und anschließend über WhatsApp teilen.')}}>Abschicken / Teilen</button></div><nav><button className="secondary" onClick={()=>{setDone(false);setStep(0)}}>Neue Abrechnung</button><button onClick={()=>{setDone(false);setStep(steps.length-1)}}>Zurück zu den Angaben</button></nav><p className="privacy">Die Abrechnung wurde automatisch archiviert.</p></section>}
 </main>
}
createRoot(document.getElementById('root')).render(<App/>);
