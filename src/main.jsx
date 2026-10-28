import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import { jsPDF } from 'jspdf';

const steps = [
  { key:'date', title:'Für welchen Tag ist die Abrechnung?', help:'Das Datum wird auf die PDF gedruckt.', type:'date' },
  { key:'abschlussnummer', title:'Abschlussnummer laut Z-Abschlag', help:'Bitte die Abschlussnummer vom Z-Abschlag manuell eintragen. Sie erscheint auf dem PDF und wird mit archiviert.', type:'text', label:'Abschlussnummer', placeholder:'Nummer vom Z-Abschlag' },
  { key:'employee', title:'Wer macht die Abendabrechnung?', help:'Optional – Name der Mitarbeiterin oder des Mitarbeiters.', type:'text', label:'Name (optional)', placeholder:'Mitarbeiter/in' },
  { key:'floatConfirmed', title:'Sind zuerst 120,00 € ins Kellnerportemonnaie gelegt?', help:'Lege zuerst genau 120,00 € beiseite. Dieser Betrag wird nicht noch einmal abgezogen.', type:'confirm' },
  { key:'cashLeft', title:'Wie viel Bargeld ist danach übrig?', help:'Zähle nur das übrige Bargeld, nachdem die 120,00 € im Kellnerportemonnaie liegen.', type:'money' },
  { key:'sales', title:'Wie hoch ist der Tagesumsatz laut Kasse?', help:'Trage den Tagesumsatz ein, der auf der Kasse steht.', type:'money' },
  { key:'card', title:'Wie hoch sind die EC-/Kartenzahlungen?', type:'money' },
  { key:'openInvoices', title:'Welche Rechnungen sind heute offen geblieben?', help:'Trage jede Rechnung einzeln ein: Name der Firma und Betrag der Rechnung. Gemeint sind Gäste oder Firmen, die heute nicht direkt bezahlt haben und denen wir die Rechnung später zuschicken – zum Beispiel Vaillant.', type:'invoices', extra:true },
  { key:'payouts', title:'Wie viel wurde an Aushilfen ausgezahlt?', help:'Summe aller Aushilfen und sonstigen Auszahlungen.', type:'money' },
  { key:'vouchers', title:'Wie hoch ist der Wert der heute eingelösten Gutscheine?', help:'Trage hier ausschließlich Gutscheine ein, die heute tatsächlich eingelöst wurden. Wenn ein eingelöster Gutschein mit EC bezahlt worden war: Den EC-Beleg aus dem Gutschein nehmen, den gleichen Geldbetrag in den Gutschein hineinlegen und den Gutschein separat aufbewahren. Den Gutschein nicht ein zweites Mal abrechnen. Nicht eingelöste Gutscheine gehören nicht in dieses Feld.', type:'money' },
  { key:'receipts', title:'Wie hoch ist die Summe der Quittungen?', help:'Wenn keine Quittungen vorliegen, 0,00 € eingeben.', type:'money' },
];
const euro = n => new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(Number(n)||0);
const today = () => new Date().toLocaleDateString('sv-SE');
function App(){
 const [answers,setAnswers] = useState({date:today(),abschlussnummer:'',employee:'',floatConfirmed:false,cashLeft:'0,00',sales:'0,00',card:'0,00',openInvoices:'0,00',payouts:'0,00',vouchers:'0,00',other:'0,00',receipts:'0,00'}); const [receiptRows,setReceiptRows] = useState(['0,00']); const [voucherRows,setVoucherRows] = useState(['0,00']); const [payoutRows,setPayoutRows] = useState([{name:'',amount:'0,00'}]); const [itemQty,setItemQty] = useState([0,0,0,0,0,0,0,0]); const menuItems=[{name:'Hauptgang (Standard)',price:24.50},{name:'Hauptgang klein',price:22.50},{name:'Salat Hähnchen',price:22.50},{name:'Salat Hähnchen klein',price:20.50},{name:'Salat Veggie',price:20.50},{name:'Salat Veggie klein',price:18.50},{name:'Wasser groß',price:7.50},{name:'Wasser klein',price:3.00}]; const itemSalesTotal=menuItems.reduce((sum,item,i)=>sum+item.price*(Number(itemQty[i])||0),0);
 const [rotaryQty,setRotaryQty] = useState([0,0,0,0,0,0,0,0,0,0]); const [rotaryInvoiceQty,setRotaryInvoiceQty] = useState([0,0,0,0,0,0]); const [rotaryDiversePrice,setRotaryDiversePrice] = useState('0,00'); const rotaryMenuItems=[{name:'Hauptgang (Standard)',price:24.50},{name:'Hauptgang klein',price:22.50},{name:'Salat Hähnchen',price:22.50},{name:'Salat Hähnchen klein',price:20.50},{name:'Salat Veggie',price:20.50},{name:'Salat Veggie klein',price:18.50},{name:'Wasser groß',price:7.50},{name:'Wasser klein',price:3.00},{name:'Soft klein',price:3.00},{name:'Soft groß',price:5.50}]; const rotaryDiverseAmount=Number(String(rotaryDiversePrice||'0').replace(/\./g,'').replace(',','.'))||0; const rotaryItemsTotal=rotaryMenuItems.reduce((sum,item,i)=>sum+item.price*(Number(rotaryQty[i])||0),0)+rotaryDiverseAmount; const [step,setStep] = useState(0); const [done,setDone] = useState(false); const [kind,setKind] = useState(null); const [archiveOpen,setArchiveOpen] = useState(false); const [archiveRotaryOnly,setArchiveRotaryOnly] = useState(false); const [archiveItems,setArchiveItems] = useState([]); const [archiveError,setArchiveError] = useState(''); const [archiveSaving,setArchiveSaving] = useState(false); const [archiveSaved,setArchiveSaved] = useState(false); const [archiveNumber,setArchiveNumber] = useState(''); const [invoiceRows,setInvoiceRows] = useState([{company:'',costCenter:'',amount:'',showCostCenter:false}]); const [knownCompanies,setKnownCompanies] = useState(()=>{try{return JSON.parse(localStorage.getItem('restaurant-known-companies')||'[]')}catch{return []}});
 useEffect(()=>{let active=true;fetch('/api/companies').then(r=>r.ok?r.json():Promise.reject()).then(data=>{if(!active)return;const merged=[...new Set([...knownCompanies,...(Array.isArray(data.companies)?data.companies:[])])].sort((a,b)=>a.localeCompare(b,'de'));setKnownCompanies(merged);try{localStorage.setItem('restaurant-known-companies',JSON.stringify(merged))}catch{}}).catch(()=>{});return()=>{active=false}},[]);
 useEffect(()=>{if(!knownCompanies.length)return;fetch('/api/companies',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({companies:knownCompanies})}).then(r=>r.ok?r.json():null).then(data=>{if(data&&Array.isArray(data.companies)){const merged=[...new Set([...knownCompanies,...data.companies])].sort((a,b)=>a.localeCompare(b,'de'));if(merged.length!==knownCompanies.length)setKnownCompanies(merged);}}).catch(()=>{})},[knownCompanies]);
 const set = (k,v)=>setAnswers(a=>({...a,[k]:v}));
 const setInvoice = (i,k,v)=>{setInvoiceRows(rows=>rows.map((row,index)=>index===i?({...row,[k]:v}):row)); if(k==='company'&&v.trim()&&!knownCompanies.some(name=>name.toLocaleLowerCase('de-DE')===v.trim().toLocaleLowerCase('de-DE'))){const next=[...knownCompanies,v.trim()].sort((a,b)=>a.localeCompare(b,'de'));setKnownCompanies(next);try{localStorage.setItem('restaurant-known-companies',JSON.stringify(next))}catch{}}};
 const rememberCompany = name=>{const clean=name.trim();if(!clean)return;const next=knownCompanies.some(n=>n.toLocaleLowerCase('de-DE')===clean.toLocaleLowerCase('de-DE'))?knownCompanies:[...knownCompanies,clean].sort((a,b)=>a.localeCompare(b,'de'));setKnownCompanies(next);try{localStorage.setItem('restaurant-known-companies',JSON.stringify(next))}catch{}};
 const invoiceTotal = invoiceRows.reduce((sum,row)=>sum+(Number(String(row.amount||0).replace(/\s/g,'').replace(/\./g,'').replace(',','.'))||0),0);
 const amount = k => Number(String(answers[k]??0).replace(/\s/g,'').replace(/\./g,'').replace(',','.'))||0;
 const payoutTotal=payoutRows.reduce((sum,row)=>sum+(Number(String(row.amount||'0').replace(/\s/g,'').replace(/\./g,'').replace(',','.'))||0),0); const result = useMemo(()=>amount('cashLeft')+amount('card')+payoutTotal+amount('vouchers')+amount('other')+amount('receipts')-amount('sales'),[answers,payoutTotal]);
 const moneyLabel = {cashLeft:'Übriges Bargeld',sales:'Tagesumsatz laut Kasse',card:'EC-/Kartenzahlungen',openInvoices:'Nicht bezahlte Rechnungen',payouts:'Aushilfen / Auszahlungen',vouchers:'Eingelöste Gutscheine',other:'Sonstige Beträge',receipts:'Quittungen'};
 const rotaryLineItems = rotaryMenuItems.map((item,i)=>({name:item.name,quantity:Number(rotaryQty[i])||0,unitPrice:item.price,total:item.price*(Number(rotaryQty[i])||0)})).filter(item=>item.quantity>0).concat(rotaryDiverseAmount>0?[{name:'Getränke divers',quantity:1,unitPrice:rotaryDiverseAmount,total:rotaryDiverseAmount}]:[]); const rotaryInvoiceFoodItems = rotaryMenuItems.slice(0,6).map((item,i)=>({name:item.name,quantity:Number(rotaryInvoiceQty[i])||0,unitPrice:item.price,total:item.price*(Number(rotaryInvoiceQty[i])||0)})).filter(item=>item.quantity>0); const rotaryInvoiceFoodTotal = rotaryInvoiceFoodItems.reduce((sum,item)=>sum+item.total,0);
 const makePdfBase64 = () => {
  const doc = new jsPDF();
  const lines = ['GO RESTAURANT – ABRECHNUNG','Art: '+(kind==='rotary'?'Montags Rotary':'Abendkasse'),'Datum: '+answers.date,'Abschlussnummer laut Z-Abschlag: '+(answers.abschlussnummer||'—'),'Mitarbeiter/in: '+(answers.employee||'—')]; if(kind==='rotary') { lines.push('','VERKAUFTE SPEISEN UND GETRÄNKE'); rotaryLineItems.forEach(item=>lines.push(item.name+' | Menge: '+item.quantity+' | Einzelpreis: '+euro(item.unitPrice)+' | Gesamt: '+euro(item.total))); lines.push('Artikelumsatz gesamt: '+euro(rotaryItemsTotal)); lines.push('','ESSEN AM ABEND AUF RECHNUNG ROTARY (nur dokumentiert, nicht mitberechnet)'); if(rotaryInvoiceFoodItems.length){rotaryInvoiceFoodItems.forEach(item=>lines.push(item.name+' | Menge: '+item.quantity+' | Einzelpreis: '+euro(item.unitPrice)+' | Gesamt: '+euro(item.total)));lines.push('Dokumentationssumme Essen auf Rechnung (nicht eingerechnet): '+euro(rotaryInvoiceFoodTotal));}else lines.push('Keine Angaben erfasst.'); } else lines.push('','Tagesumsatz laut Kasse: '+euro(amount('sales')),'Übriges Bargeld: '+euro(amount('cashLeft')),'EC-/Kartenzahlungen: '+euro(amount('card')),'Offene Firmenrechnungen:');
  invoiceRows.filter(row=>row.company.trim()||row.amount.trim()).forEach(row=>lines.push('- '+row.company+': '+euro(Number(String(row.amount||0).replace(/\s/g,'').replace(/\./g,'').replace(',','.'))||0)));
  if(kind!=='rotary'){lines.push('Offene Firmenrechnungen (nur dokumentiert, nicht verrechnet): '+euro(invoiceTotal),'Eingelöste Gutscheine: '+euro(amount('vouchers')));} payoutRows.filter(row=>row.name.trim()||row.amount.trim()).forEach(row=>lines.push('Auszahlung – '+(row.name.trim()||'Name nicht angegeben')+': '+euro(Number(String(row.amount||0).replace(/\s/g,'').replace(/\./g,'').replace(',','.'))||0))); lines.push('Summe aller Auszahlungen: '+euro(payoutTotal)); lines.push('Quittungen: '+euro(amount('receipts')),'','Trinkgeld / Differenz: '+euro(result));
  let y=18; lines.forEach(line=>{const wrapped=doc.splitTextToSize(line,180);if(y+wrapped.length*7>280){doc.addPage();y=18;}doc.text(wrapped,15,y);y+=wrapped.length*7;});
  return doc.output('datauristring').split(',')[1];
 };
 const loadArchive = async () => { setArchiveError(''); try { const r=await fetch('/api/archive'); const d=await r.json(); if(!r.ok)throw new Error(d.error||'Archivzugriff fehlgeschlagen.');setArchiveItems(d.records||[]); } catch(e){setArchiveError(e.message||'Archivzugriff fehlgeschlagen.');} };
 const saveArchiveRecord = async () => { if(archiveSaved||archiveSaving)return;setArchiveSaving(true);setArchiveError('');try{const pdfBase64=makePdfBase64();const r=await fetch('/api/archive',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date:answers.date,abschlussnummer:answers.abschlussnummer||'',kind:kind==='rotary'?'Montags Rotary':'Abendkasse',employee:answers.employee||'',amount:euro(kind==='rotary'?rotaryItemsTotal:result),items:kind==='rotary'?rotaryLineItems:[],invoiceFoodItems:kind==='rotary'?rotaryInvoiceFoodItems:[],invoiceFoodTotal:kind==='rotary'?euro(rotaryInvoiceFoodTotal):'',amountResult:euro(result),pdfBase64})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Speichern fehlgeschlagen.');setArchiveNumber(d.record.number);setArchiveSaved(true);}catch(e){setArchiveError(e.message||'Speichern fehlgeschlagen.');}finally{setArchiveSaving(false);} };
 const deleteArchivedPdf = async item => {
  if (!window.confirm('Möchtest du die Abrechnung '+item.number+' vom '+item.date+' wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) return;
  setArchiveError('');
  try {
   const response = await fetch('/api/archive', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ number: item.number, createdAt: item.createdAt }) });
   const data = await response.json();
   if (!response.ok) throw new Error(data.error || 'Löschen fehlgeschlagen.');
   setArchiveItems(items => items.filter(entry => !(entry.number === item.number && entry.createdAt === item.createdAt)));
  } catch (error) {
   setArchiveError(error.message || 'Abrechnung konnte nicht gelöscht werden.');
  }
 };
 const downloadArchivedPdf = item => {
  try {
   if (!item?.pdfBase64) throw new Error('Für diesen Archiv-Eintrag ist keine PDF-Datei gespeichert.');
   const binary = atob(item.pdfBase64.replace(/^data:application\/pdf;base64,/, '').replace(/\s/g, ''));
   const bytes = new Uint8Array(binary.length);
   for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
   const blob = new Blob([bytes], { type: 'application/pdf' });
   const url = URL.createObjectURL(blob);
   const opened = window.open(url, '_blank', 'noopener,noreferrer');
   if (!opened) {
    const a = document.createElement('a');
    a.href = url;
    a.download = item.filename || ('Abrechnung-' + item.number + '.pdf');
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
   }
   window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) {
   setArchiveError('PDF konnte nicht geöffnet werden. Bitte die Abrechnung erneut speichern oder herunterladen. ' + (e?.message || ''));
  }
 };

 const pdf = () => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const lines = [
   'GO RESTAURANT – ABRECHNUNG',
   'Art: '+(kind==='rotary'?'Montags Rotary':'Abendkasse'),
   'Datum: '+answers.date,
   'Abschlussnummer laut Z-Abschlag: '+(answers.abschlussnummer||'—'),
   'Mitarbeiter/in: '+(answers.employee||'—'),
   ...(kind==='rotary'?['','ESSEN AM ABEND AUF RECHNUNG ROTARY (nur dokumentiert, nicht mitberechnet)',...(rotaryInvoiceFoodItems.length?rotaryInvoiceFoodItems.map(item=>item.name+' | Menge: '+item.quantity+' | Einzelpreis: '+euro(item.unitPrice)+' | Gesamt: '+euro(item.total)).concat(['Dokumentationssumme Essen auf Rechnung (nicht eingerechnet): '+euro(rotaryInvoiceFoodTotal)]):['Keine Angaben erfasst.'])]:[]),
   '',
   'KELLNERPORTEMONNAIE',
   '120,00 € wurden zuerst beiseitegelegt: '+(answers.floatConfirmed?'Ja':'Nicht bestätigt'),
   '',
   'UMSATZ UND ABZÜGE',
   'Tagesumsatz laut Kasse: '+euro(amount('sales')),
   'Übriges Bargeld / Barzahlungen: '+euro(amount('cashLeft')),
   'EC-/Kartenzahlungen: '+euro(amount('card')),
   'Offene Firmenrechnungen:'
  ];
  invoiceRows.filter(row=>row.company.trim()||row.amount.trim()).forEach(row=>{
   const parsed = Number(String(row.amount||0).replace(/\s/g,'').replace(/\./g,'').replace(',','.'))||0;
   lines.push('- '+(row.company.trim()||'Firma nicht angegeben')+(row.costCenter.trim()?' | Kostenstelle: '+row.costCenter.trim():'')+': '+euro(parsed));
  });
  if(!invoiceRows.some(row=>row.company.trim()||row.amount.trim())) lines.push('- Keine');
  payoutRows.filter(row=>row.name.trim()||row.amount.trim()).forEach(row=>lines.push('Auszahlung – '+(row.name.trim()||'Name nicht angegeben')+': '+euro(Number(String(row.amount||0).replace(/\s/g,'').replace(/\./g,'').replace(',','.'))||0)));
  lines.push(
   'Summe offene Firmenrechnungen: '+euro(invoiceTotal),
   'Aushilfen / Auszahlungen: '+euro(payoutTotal),
   'Eingelöste Gutscheine: '+euro(amount('vouchers')),
   'Sonstige Beträge: '+euro(amount('other')),
   'Quittungen: '+euro(amount('receipts')),
   '',
   'ERGEBNIS',
   'Trinkgeld / Differenz: '+euro(result)+' | Trinkgeld in % vom Tagesumsatz: '+(amount('sales')>0?((result/amount('sales'))*100).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})+' %':'—'),
   '',
   'Rechenweg: Bargeld + EC/Kartenzahlungen + Auszahlungen (einzeln nach Name) + eingelöste Gutscheine + sonstige Beträge + Quittungen minus Tagesumsatz laut Kasse. Offene Rechnungen werden separat dokumentiert und nicht verrechnet.',
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
 const rotarySteps=[...steps.filter(x=>x.key==='date'||x.key==='employee'||x.key==='payouts'||x.key==='receipts'),{key:'rotaryItems',title:'Speisen und Getränke – Rotary',help:'Mengen eintragen. Die einzelnen Artikel werden in PDF und Archiv gespeichert.',type:'rotaryItems'},{key:'rotaryInvoiceFood',title:'Essen am Abend auf Rechnung Rotary',help:'Diese Speisen werden separat dokumentiert und auf dem PDF aufgeführt. Sie fließen ausdrücklich nicht in den berechneten Artikelumsatz oder das Abrechnungsergebnis ein.',type:'rotaryInvoiceFood'}]; const activeSteps=kind==='rotary'?rotarySteps:steps; const current=activeSteps[step];
 if (archiveOpen) return <main><header><button className="back-home secondary" onClick={()=>setArchiveOpen(false)}>Zurück zur Auswahl</button><h1>{archiveRotaryOnly?'Rotary-Abrechnungsarchiv':'Abrechnungsarchiv'}</h1><p className="muted">Gespeicherte Monats-PDFs</p></header><section className="panel">{archiveItems.length===0?<p>Noch keine Abrechnungen gespeichert.</p>:Object.entries(archiveItems.filter(x=>!archiveRotaryOnly||x.kind==='Montags Rotary').reduce((g,x)=>{(g[x.month||'Ohne Datum']??=[]).push(x);return g;},{})).sort(([a],[b])=>b.localeCompare(a)).map(([m,items])=><div className="invoice-row" key={m}><h3>{m}</h3>{items.map(x=><div className="known-company" key={x.number+'-'+x.createdAt}><span><b>{x.number}</b> · {x.date} · {x.kind} · {x.amount}</span><div className="archive-actions"><button className="small secondary" onClick={()=>downloadArchivedPdf(x)}>PDF öffnen</button><button className="small danger" onClick={()=>deleteArchivedPdf(x)}>Löschen</button></div></div>)}</div>)}{archiveError&&<p className="help">{archiveError}</p>}</section></main>;

 if (!kind) return <main><header><span className="logo">GO</span><span className="eyebrow">RESTAURANT</span><h1>Abrechnung auswählen</h1><p className="muted">Wähle aus, welche Abrechnung du durchführen möchtest.</p></header><section className="panel picker"><button className="choice" onClick={()=>{setKind('evening');setStep(0);setDone(false)}}><strong>Abendkasse</strong><span>Normale Tages- und Kassenabrechnung</span></button><button className="choice rotary" onClick={()=>{setKind('rotary');setStep(0);setDone(false)}}><strong>Montags Rotary</strong><span>Separate Abrechnung für Montags Rotary</span></button><button className="choice" onClick={()=>{setArchiveItems([]);setArchiveRotaryOnly(false);setArchiveOpen(true);loadArchive()}}><strong>Abrechnungsarchiv</strong><span>Alle Monats-PDFs aufrufen</span></button><button className="choice rotary" onClick={()=>{setArchiveItems([]);setArchiveRotaryOnly(true);setArchiveOpen(true);loadArchive()}}><strong>Rotary-Abrechnungsarchiv</strong><span>Nur Rotary-Abrechnungen anzeigen</span></button></section></main>;
 return <main><header><button className="back-home secondary" onClick={()=>{setKind(null);setStep(0);setDone(false)}}>Zurück zur Auswahl</button><span className="logo">GO</span><span className="eyebrow">RESTAURANT</span><h1>{kind==='rotary'?'Montags Rotary':'Abendkasse'}</h1><p className="muted">Schritt {done?activeSteps.length:step+1} von {activeSteps.length} · Die Angaben werden beim Abschluss im Archiv gespeichert.</p><div className="progress"><i style={{width:done?'100%':((step+1)/activeSteps.length*100)+'%'}}/></div></header>
 {!done ? <section className="panel"><h2>{current.title}</h2>{current.help&&<p className="help">{current.help}</p>}
 {current.type==='date'&&<label>Datum<input type="date" value={answers.date} onChange={e=>set('date',e.target.value)}/></label>}
 {current.type==='text'&&<label>{current.label}<input value={answers[current.key]||''} placeholder={current.placeholder} onChange={e=>set(current.key,e.target.value)}/></label>}
 {current.type==='confirm'&&<label className="check"><input type="checkbox" checked={answers.floatConfirmed} onChange={e=>set('floatConfirmed',e.target.checked)}/>120,00 € liegen im Kellnerportemonnaie</label>}
 {current.type==='money'&&current.key!=='receipts'&&current.key!=='payouts'&&current.key!=='vouchers'&&<label>Betrag in Euro<input inputMode="decimal" value={answers[current.key]} onChange={e=>set(current.key,e.target.value)} placeholder="0,00"/></label>}{current.key==='vouchers'&&<div className="invoice-list">{voucherRows.map((voucher,i)=><div className="invoice-row" key={'voucher-'+i}><label>Gutschein {i+1} – Betrag in Euro<input inputMode="decimal" value={voucher} onChange={e=>{const next=voucherRows.map((v,index)=>index===i?e.target.value:v);setVoucherRows(next);set('vouchers',String(next.reduce((sum,v)=>sum+(Number(String(v||0).replace(/\s/g,'').replace(/\./g,'').replace(',','.'))||0),0)).replace('.',','));}} placeholder="0,00"/></label></div>)}<p className="invoice-total">Summe aller Gutscheine: <strong>{euro(voucherRows.reduce((sum,v)=>sum+(Number(String(v||0).replace(/\s/g,'').replace(/\./g,'').replace(',','.'))||0),0))}</strong></p><button type="button" className="wide secondary" onClick={()=>setVoucherRows(rows=>[...rows,'0,00'])}>+ Noch einen Gutschein hinzufügen</button></div>}{current.key==='payouts'&&<div className="invoice-list">{payoutRows.map((row,i)=><div className="invoice-row" key={'payout-'+i}><h3>Auszahlung {i+1}</h3><label>Name<input value={row.name} onChange={e=>setPayoutRows(rows=>rows.map((v,index)=>index===i?({...v,name:e.target.value}):v))} placeholder="z. B. Michael"/></label><label>Betrag in Euro<input inputMode="decimal" value={row.amount} onChange={e=>setPayoutRows(rows=>rows.map((v,index)=>index===i?({...v,amount:e.target.value}):v))} placeholder="z. B. 120,00"/></label></div>)}<p className="invoice-total">Summe aller Auszahlungen: <strong>{euro(payoutTotal)}</strong></p><button type="button" className="wide secondary" onClick={()=>setPayoutRows(rows=>[...rows,{name:'',amount:'0,00'}])}>+ Noch eine Auszahlung</button></div>}{current.key==='receipts'&&<div className="invoice-list">{receiptRows.map((receipt,i)=><div className="invoice-row" key={'receipt-'+i}><label>Quittung {i+1} – Betrag in Euro<input inputMode="decimal" value={receipt} onChange={e=>{const next=receiptRows.map((v,index)=>index===i?e.target.value:v);setReceiptRows(next);set('receipts',String(next.reduce((sum,v)=>sum+(Number(String(v||0).replace(/\s/g,'').replace(/\./g,'').replace(',','.'))||0),0)).replace('.',','));}} placeholder="0,00"/></label></div>)}<p className="invoice-total">Summe aller Quittungen: <strong>{euro(receiptRows.reduce((sum,v)=>sum+(Number(String(v||0).replace(/\s/g,'').replace(/\./g,'').replace(',','.'))||0),0))}</strong></p><button type="button" className="wide secondary" onClick={()=>setReceiptRows(rows=>[...rows,'0,00'])}>+ Noch eine Quittung</button></div>}
 {current.type==='items'&&<div className="invoice-list">{menuItems.map((item,i)=><div className="invoice-row" key={item.name}><label>{item.name} · {euro(item.price)}<input type="number" min="0" step="1" inputMode="numeric" value={itemQty[i]} onChange={e=>setItemQty(q=>q.map((n,index)=>index===i?Math.max(0,Number(e.target.value)||0):n))} placeholder="Menge"/></label><p>Zwischensumme: <strong>{euro(item.price*(Number(itemQty[i])||0))}</strong></p></div>)}<p className="invoice-total">Artikelumsatz gesamt: <strong>{euro(itemSalesTotal)}</strong></p></div>}
 {current.type==='rotaryInvoiceFood'&&<div className="invoice-list"><p className="help">Nur Essen, das am Abend auf Rechnung Rotary geht. Die Angaben werden auf der Abrechnung aufgeführt, aber nicht mit dem Artikelumsatz verrechnet.</p>{rotaryMenuItems.slice(0,6).map((item,i)=><div className="invoice-row" key={'rotary-invoice-food-'+item.name}><label>{item.name} · {euro(item.price)}<input type="number" min="0" step="1" inputMode="numeric" value={rotaryInvoiceQty[i]} onChange={e=>setRotaryInvoiceQty(q=>q.map((n,index)=>index===i?Math.max(0,Number(e.target.value)||0):n))} placeholder="Menge"/></label><p>Dokumentationsbetrag (nicht mitberechnet): <strong>{euro(item.price*(Number(rotaryInvoiceQty[i])||0))}</strong></p></div>)}<p className="invoice-total">Summe Essen auf Rechnung – nur zur Dokumentation: <strong>{euro(rotaryInvoiceFoodTotal)}</strong></p></div>}{current.type==='rotaryItems'&&<div className="invoice-list">{rotaryMenuItems.map((item,i)=><div className="invoice-row" key={'rotary-'+item.name}><label>{item.name} · {euro(item.price)}<input type="number" min="0" step="1" inputMode="numeric" value={rotaryQty[i]} onChange={e=>setRotaryQty(q=>q.map((n,index)=>index===i?Math.max(0,Number(e.target.value)||0):n))} placeholder="Menge"/></label><p>Zwischensumme: <strong>{euro(item.price*(Number(rotaryQty[i])||0))}</strong></p></div>)}<div className="invoice-row"><label>Getränke divers – Preis in Euro<input type="text" inputMode="decimal" value={rotaryDiversePrice} onChange={e=>setRotaryDiversePrice(e.target.value)} placeholder="0,00 €"/></label></div><p className="invoice-total">Artikelumsatz gesamt: <strong>{euro(rotaryItemsTotal)}</strong></p></div>}{current.type==='invoices'&&<div className="invoice-list">{invoiceRows.map((row,i)=><div className="invoice-row" key={i}><h3>Firma {i+1}</h3><label>Firmenname<input list="known-company-options" value={row.company} onChange={e=>setInvoice(i,'company',e.target.value)} onBlur={e=>rememberCompany(e.target.value)} placeholder="z. B. Vaillant"/><datalist id="known-company-options">{knownCompanies.map(name=><option key={name} value={name}/>)}</datalist></label>{row.showCostCenter&&<label>Kostenstelle<input value={row.costCenter} onChange={e=>setInvoice(i,'costCenter',e.target.value)} placeholder="Kostenstelle eingeben"/></label>}<button type="button" className="small secondary" onClick={()=>setInvoiceRows(rows=>rows.map((r,index)=>index===i?({...r,showCostCenter:!r.showCostCenter}):r))}>{row.showCostCenter?'Kostenstelle entfernen':'+ Kostenstelle hinzufügen'}</button><label>Betrag der Rechnung in Euro<input inputMode="decimal" value={row.amount} onChange={e=>setInvoice(i,'amount',e.target.value)} placeholder="z. B. 100,00"/></label></div>)}<p className="invoice-total">Summe der eingetragenen Rechnungen: <strong>{euro(invoiceTotal)}</strong></p><button type="button" className="wide secondary" onClick={()=>setInvoiceRows(rows=>[...rows,{company:'',costCenter:'',amount:'',showCostCenter:false}])}>+ Weitere Firma hinzufügen</button></div>}
 <nav><button className="secondary" onClick={()=>step===0?location.reload():setStep(s=>s-1)}>Zurück</button>{current.type==='invoices'?<button onClick={()=>{const incomplete=invoiceRows.some(row=>(row.company.trim()&&!row.amount.trim())||(!row.company.trim()&&row.amount.trim()));if(incomplete){alert('Bitte gib für jede Rechnung sowohl den Firmennamen als auch den Betrag ein.');return;}set('openInvoices',String(invoiceTotal).replace('.',','));setStep(s=>s+1)}}>Keine weitere Firma – weiter</button>:<button onClick={()=>{if(current.type==='confirm'&&!answers.floatConfirmed){alert('Bitte bestätige zuerst, dass die 120,00 € im Kellnerportemonnaie liegen.');return;} if(step===activeSteps.length-1){setDone(true);saveArchiveRecord()}else setStep(s=>s+1)}}>Weiter</button>}</nav>
 <p className="privacy">Die Abrechnung wird beim Abschluss automatisch als PDF im Archiv gespeichert.</p></section>
 : <section className="panel"><h2>Abrechnung fertig</h2><p className="help">{archiveSaved?("Gespeichert als "+archiveNumber+".pdf"):archiveSaving?"PDF wird gespeichert …":"Abrechnung als PDF im Archiv speichern."}</p>{archiveError&&<p className="help">{archiveError}</p>}{!archiveSaved&&<button className="wide" disabled={archiveSaving} onClick={saveArchiveRecord}>{archiveSaving?"Wird gespeichert …":"Abrechnung abschließen und archivieren"}</button>}<div className="result"><b>Ergebnis der Abrechnung</b><p>Trinkgeld / Differenz: <strong>{euro(result)}</strong> · Prozentsatz vom Tagesumsatz: <strong>{amount('sales')>0?((result/amount('sales'))*100).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})+' %':'—'}</strong></p><p>Auszahlbares Trinkgeld: <strong>{euro(Math.max(0,result))}</strong></p><button className="wide" onClick={pdf}>Abrechnung als Datei herunterladen</button><button className="wide secondary" onClick={()=>{if(navigator.share)navigator.share({title:'Abendkasse',text:'Abendkasse '+answers.date+' – '+euro(result)}).catch(()=>{});else alert('Bitte zuerst die Abrechnung als Datei herunterladen und anschließend über WhatsApp teilen.')}}>Abschicken / Teilen</button></div><nav><button className="secondary" onClick={()=>{setDone(false);setStep(0)}}>Neue Abrechnung</button><button onClick={()=>{setDone(false);setStep(activeSteps.length-1)}}>Zurück zu den Angaben</button></nav><p className="privacy">Die Abrechnung wurde automatisch archiviert.</p></section>}
 </main>
}
createRoot(document.getElementById('root')).render(<App/>);
