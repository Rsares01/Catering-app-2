import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const steps = [
  { key:'date', title:'Für welchen Tag ist die Abrechnung?', help:'Das Datum wird auf die PDF gedruckt.', type:'date' },
  { key:'employee', title:'Wer macht die Abendabrechnung?', help:'Optional – Name der Mitarbeiterin oder des Mitarbeiters.', type:'text', label:'Name (optional)', placeholder:'Mitarbeiter/in' },
  { key:'floatConfirmed', title:'Sind zuerst 120,00 € ins Kellnerportemonnaie gelegt?', help:'Lege zuerst genau 120,00 € beiseite. Dieser Betrag wird nicht noch einmal abgezogen.', type:'confirm' },
  { key:'cashLeft', title:'Wie viel Bargeld ist danach übrig?', help:'Zähle nur das übrige Bargeld, nachdem die 120,00 € im Kellnerportemonnaie liegen.', type:'money' },
  { key:'sales', title:'Wie hoch ist der Tagesumsatz laut Kasse?', type:'money' },
  { key:'card', title:'Wie hoch sind die EC-/Kartenzahlungen?', type:'money' },
  { key:'openInvoices', title:'Wie hoch sind die nicht bezahlten Rechnungen?', help:'Nur Rechnungen eintragen, die noch nicht bezahlt wurden.', type:'money', extra:true },
  { key:'payouts', title:'Wie viel wurde an Aushilfen ausgezahlt?', help:'Summe aller Aushilfen und sonstigen Auszahlungen.', type:'money' },
  { key:'vouchers', title:'Wie hoch ist der Wert der eingelösten Gutscheine?', help:'Nur eingelöste Gutscheine eintragen. Gutscheine mit Geldwert, die nicht eingelöst wurden, einfach zur Abrechnung dazulegen – nicht eintragen und nicht berechnen.', type:'money' },
  { key:'other', title:'Wie hoch sind die sonstigen Abzüge?', help:'Wenn keine sonstigen Abzüge vorliegen, 0,00 € eingeben.', type:'money' },
  { key:'receipts', title:'Wie hoch ist die Summe der Quittungen?', help:'Wenn keine Quittungen vorliegen, 0,00 € eingeben.', type:'money' },
];
const euro = n => new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(Number(n)||0);
const today = () => new Date().toLocaleDateString('sv-SE');
function App(){
 const [answers,setAnswers] = useState({date:today(),employee:'',floatConfirmed:false,cashLeft:'0,00',sales:'0,00',card:'0,00',openInvoices:'0,00',payouts:'0,00',vouchers:'0,00',other:'0,00',receipts:'0,00'});
 const [step,setStep] = useState(0); const [done,setDone] = useState(false);
 const set = (k,v)=>setAnswers(a=>({...a,[k]:v}));
 const amount = k => Number(String(answers[k]??0).replace(/\s/g,'').replace(/\./g,'').replace(',','.'))||0;
 const result = useMemo(()=>amount('cashLeft')+amount('card')+amount('openInvoices')+amount('payouts')+amount('vouchers')+amount('other')+amount('receipts')-amount('sales'),[answers]);
 const moneyLabel = {cashLeft:'Übriges Bargeld',sales:'Tagesumsatz laut Kasse',card:'EC-/Kartenzahlungen',openInvoices:'Nicht bezahlte Rechnungen',payouts:'Aushilfen / Auszahlungen',vouchers:'Eingelöste Gutscheine',other:'Sonstige Beträge',receipts:'Quittungen'};
 const pdf = async()=>{
  const text = `ABENDKASSE – TAGESABRECHNUNG\nRestaurant · Kassenabschluss und Trinkgeldermittlung\n\nDatum: ${answers.date}\nMitarbeiter/in: ${answers.employee||'—'}\n\nKellnerportemonnaie: 120,00 € zuerst beiseitegelegt: Ja\n\nUmsatz und Abzüge\nTagesumsatz laut Kasse: ${euro(amount('sales'))}\nÜbriges Bargeld / Barzahlungen: ${euro(amount('cashLeft'))}\nEC-/Kartenzahlungen: ${euro(amount('card'))}\nNicht bezahlte Rechnungen: ${euro(amount('openInvoices'))}\nAushilfen / Auszahlungen: ${euro(amount('payouts'))}\nNur eingelöste Gutscheine: ${euro(amount('vouchers'))}\nSonstige Beträge: ${euro(amount('other'))}\nQuittungen: ${euro(amount('receipts'))}\n\nTrinkgeld / Differenz: ${euro(result)}\nAuszahlbares Trinkgeld: ${euro(Math.max(0,result))}\n\nRechenweg: Bargeld + EC/Kartenzahlungen + offene Rechnungen + Auszahlungen + eingelöste Gutscheine + sonstige Beträge + Quittungen minus Tagesumsatz.\nDie 120,00 € im Kellnerportemonnaie werden nicht noch einmal abgezogen.`;
  const blob = new Blob([text],{type:'text/plain;charset=utf-8'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='Abendkasse_'+answers.date+'.txt'; a.click(); URL.revokeObjectURL(url);
 };
 const current = steps[step];
 return <main><header><span className="logo">GO</span><span className="eyebrow">RESTAURANT</span><h1>Abendkasse</h1><p className="muted">Schritt {done?12:step+1} von 12 · Die Angaben werden nicht gespeichert.</p><div className="progress"><i style={{width:done?'100%':((step+1)/12*100)+'%'}}/></div></header>
 {!done ? <section className="panel"><h2>{current.title}</h2>{current.help&&<p className="help">{current.help}</p>}
 {current.type==='date'&&<label>Datum<input type="date" value={answers.date} onChange={e=>set('date',e.target.value)}/></label>}
 {current.type==='text'&&<label>{current.label}<input value={answers.employee} placeholder={current.placeholder} onChange={e=>set('employee',e.target.value)}/></label>}
 {current.type==='confirm'&&<label className="check"><input type="checkbox" checked={answers.floatConfirmed} onChange={e=>set('floatConfirmed',e.target.checked)}/>120,00 € liegen im Kellnerportemonnaie</label>}
 {current.type==='money'&&<label>Betrag in Euro<input inputMode="decimal" value={answers[current.key]} onChange={e=>set(current.key,e.target.value)} placeholder="0,00"/></label>}
 <nav><button className="secondary" onClick={()=>step===0?location.reload():setStep(s=>s-1)}>Zurück</button><button onClick={()=>{if(current.type==='confirm'&&!answers.floatConfirmed){alert('Bitte bestätige zuerst, dass die 120,00 € im Kellnerportemonnaie liegen.');return;} if(step===steps.length-1)setDone(true);else setStep(s=>s+1)}}>Weiter</button></nav>
 <p className="privacy">Datenschutz: Die Eingaben bleiben nur während dieser Sitzung im Arbeitsspeicher. Es wird kein Datensatz in einer Datenbank angelegt.</p></section>
 : <section className="panel"><h2>Abrechnung fertig</h2><p className="help">Die Angaben wurden verrechnet. Es wurde noch nichts gespeichert.</p><div className="result"><b>Ergebnis der Abrechnung</b><p>Trinkgeld / Differenz: <strong>{euro(result)}</strong></p><p>Auszahlbares Trinkgeld: <strong>{euro(Math.max(0,result))}</strong></p><button className="wide" onClick={pdf}>Abrechnung als Datei herunterladen</button><button className="wide secondary" onClick={()=>{if(navigator.share)navigator.share({title:'Abendkasse',text:'Abendkasse '+answers.date+' – '+euro(result)}).catch(()=>{});else alert('Bitte zuerst die Abrechnung als Datei herunterladen und anschließend über WhatsApp teilen.')}}>Abschicken / Teilen</button></div><nav><button className="secondary" onClick={()=>{setDone(false);setStep(0)}}>Neue Abrechnung</button><button onClick={()=>{setDone(false);setStep(steps.length-1)}}>Zurück zu den Angaben</button></nav><p className="privacy">Hinweis: Diese erste Version speichert keine Abrechnungen dauerhaft.</p></section>}
 </main>
}
createRoot(document.getElementById('root')).render(<App/>);
