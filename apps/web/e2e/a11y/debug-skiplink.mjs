// Measure BOTH skip links in their real FOCUSED (visible) state, per route, per menu mode.
// The default scan skips them because they are clipped to 1x1 until focus.
import { chromium, webkit } from "@playwright/test";
import { readFileSync } from "node:fs";
const S = JSON.parse(readFileSync(new URL("./states.json", import.meta.url), "utf8"));

const ROUTES = [["/", "home"], ["/login", "login"], ["/privacy", "privacy"], ["/terms", "terms"],
                [`/l/${S.active}`, "l-active"], [`/join?token=${S.joinToken}`, "join-real"],
                [`/auth/consume?token=${S.invalid}`, "consume-invalid"]];

const MEASURE = `(() => {
  const parse=(c)=>{const m=String(c).match(/rgba?\\(([^)]+)\\)/);if(!m)return null;const p=m[1].split(',').map(Number);return{r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1};};
  const over=(f,b)=>({r:f.r*f.a+b.r*(1-f.a),g:f.g*f.a+b.g*(1-f.a),b:f.b*f.a+b.b*(1-f.a),a:1});
  const lum=(c)=>{const f=(v)=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b);};
  const ratio=(a,b)=>{const L1=lum(a),L2=lum(b),hi=Math.max(L1,L2),lo=Math.min(L1,L2);return (hi+0.05)/(lo+0.05);};
  const hex=(c)=>'#'+[c.r,c.g,c.b].map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
  const bgOf=(el)=>{const st=[];let n=el;while(n){const c=parse(getComputedStyle(n).backgroundColor);if(c&&c.a>0)st.push(c);n=n.parentElement;}
    let b={r:255,g:255,b:255,a:1};for(let i=st.length-1;i>=0;i--)b=over(st[i],b);return b;};
  const el=document.activeElement;
  if(!el||!el.classList.contains('skip-link')) return {error:'focus is not on a skip link', active: el&&el.className};
  const cs=getComputedStyle(el); const r=el.getBoundingClientRect();
  const fg=parse(cs.color), bg=bgOf(el);
  return { text:(el.textContent||'').trim(), inPtRoot: Boolean(el.closest('.pt-root')),
           colorDeclared: cs.color, onColorVar: getComputedStyle(el).getPropertyValue('--on-color').trim() || '(unset)',
           fg:hex(fg), bg:hex(bg), fontPx: parseFloat(cs.fontSize), weight: cs.fontWeight,
           rect:{w:Math.round(r.width),h:Math.round(r.height)},
           ratio: Math.round(ratio(over(fg,bg),bg)*100)/100 };
})()`;

for (const [name, engine] of [["chromium", chromium], ["webkit", webkit]]) {
  const browser = await engine.launch();
  console.log(`\n########## ${name} ##########`);
  for (const [path, id] of ROUTES) {
    const page = await browser.newPage();
    await page.goto(`http://localhost:3000${path}`, { waitUntil: "load" });
    await page.waitForTimeout(700);
    let found = 0;
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      const m = await page.evaluate(MEASURE);
      if (m.error) continue;
      found++;
      const verdict = m.ratio >= 4.5 ? "PASS" : "**FAIL**";
      console.log(`${id.padEnd(16)} skip#${found} "${m.text}" ptRoot=${String(m.inPtRoot).padEnd(5)} --on-color=${String(m.onColorVar).padEnd(9)} color=${m.colorDeclared.padEnd(18)} ${m.fg} on ${m.bg} ${String(m.rect.w)}x${m.rect.h}px = ${m.ratio}:1  ${verdict}`);
    }
    if (!found) console.log(`${id.padEnd(16)} (no skip link reached by Tab in this engine)`);
    await page.close();
  }
  await browser.close();
}
