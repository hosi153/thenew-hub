import asyncio, json
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as pw:
    b=await pw.chromium.launch()
    ctx=await b.new_context(viewport={'width':390,'height':844})
    page=await ctx.new_page(); errs=[]
    page.on('pageerror',lambda e:errs.append('PAGEERR '+str(e)[:200]))
    await page.route('**/fonts.googleapis.com/**',lambda r:r.abort())
    await page.goto('http://localhost:4173/'); await page.wait_for_timeout(1500)
    await page.screenshot(path='/tmp/home.png')
    r={}
    # partners filter
    await page.click('nav.bottom button[data-page=partners]'); await page.wait_for_timeout(300)
    r['chips']=await page.evaluate('[...document.querySelectorAll("#partnerChips .chip")].map(c=>c.textContent).slice(0,6)')
    await page.click('#partnerChips .chip:nth-child(2)')
    r['visible_after_chip']=await page.evaluate('[...document.querySelectorAll("#partners-menu tr[data-partner]")].filter(t=>t.style.display!=="none").length')
    await page.screenshot(path='/tmp/partners.png')
    await page.fill('#partnerSearch','zzzz'); r['empty_shown']=await page.evaluate('getComputedStyle(document.getElementById("partnerEmpty")).display')
    await page.fill('#partnerSearch','')
    await page.click('#partnerChips .chip:nth-child(1)')
    # open partner then back
    await page.click('tr[data-partner=dailyclean]'); await page.wait_for_timeout(200)
    r['hash_open']=await page.evaluate('location.hash')
    r['detail_active']=await page.evaluate('document.getElementById("partner-dailyclean").classList.contains("active")')
    await page.go_back(); await page.wait_for_timeout(300)
    r['hash_back']=await page.evaluate('location.hash')
    r['detail_after_back']=await page.evaluate('document.getElementById("partner-dailyclean").classList.contains("active")')
    r['menu_visible']=await page.evaluate('getComputedStyle(document.getElementById("partners-menu")).display')
    # home quick -> parking
    await page.click('nav.bottom button[data-page=home]'); await page.click('.quick-btn >> text=주차 안내'); await page.wait_for_timeout(200)
    r['parking_hash']=await page.evaluate('location.hash'); r['parking_active']=await page.evaluate('document.getElementById("sub-parking").classList.contains("active")')
    await page.screenshot(path='/tmp/parking.png')
    await page.go_back(); await page.wait_for_timeout(300)
    r['after_back_page']=await page.evaluate('document.querySelector(".page.active").id')
    await page.goto('http://localhost:4173/#more'); await page.wait_for_timeout(600)
    await page.screenshot(path='/tmp/more.png')
    # zoom allowed
    r['viewport']=await page.evaluate('document.querySelector("meta[name=viewport]").content')
    r['overflow']=await page.evaluate('document.documentElement.scrollWidth>innerWidth')
    r['errs']=errs
    print(json.dumps(r,ensure_ascii=False,indent=1))
    d=await b.new_context(viewport={'width':1280,'height':800}); p2=await d.new_page()
    await p2.route('**/fonts.googleapis.com/**',lambda r:r.abort())
    await p2.goto('http://localhost:4173/'); await p2.wait_for_timeout(1200); await p2.screenshot(path='/tmp/desk.png')
    await b.close()
asyncio.run(main())
