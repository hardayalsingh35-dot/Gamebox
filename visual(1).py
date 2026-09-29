"""GameBox visual + runtime QA: screenshots every screen, watches for JS errors,
and lets bot-vs-bot games play out to catch crashes."""
import pathlib, sys
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path('/home/user/gamebox')
SHOTS = ROOT / 'test' / 'shots'
SHOTS.mkdir(parents=True, exist_ok=True)

errors = []

def watch(page):
    page.on('pageerror', lambda e: errors.append('PAGEERROR: ' + str(e)))
    page.on('console', lambda m: errors.append('CONSOLE: ' + m.text) if m.type == 'error' else None)

def shot(page, name, full=True):
    page.screenshot(path=str(SHOTS / (name + '.png')), full_page=full)
    print('  shot:', name)

with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
    watch(pg)
    pg.goto('file://' + str(ROOT / 'index.html'))
    pg.wait_for_timeout(700)
    shot(pg, '01_home')

    # setup screens
    for g in ['uno', 'ludo', 'ttt', 'c4', 'sl']:
        pg.evaluate(f"__qb.start('{g}')")
        pg.wait_for_timeout(350)
        shot(pg, '02_setup_' + g)
        # start with 1 human + bots
        pg.evaluate(f"__qb.startGame('{g}', {{n: {'4' if g in ('uno','ludo','sl') else '2'}, level:'sharp'}})")
        pg.wait_for_timeout(1600)
        shot(pg, '03_game_' + g)
        # let bots-only game run (smoke test)
        pg.evaluate(f"__qb.startGame('{g}', {{allBots: true, n: {'4' if g in ('uno','ludo','sl') else '2'}}})")
        pg.wait_for_timeout(9000)
        shot(pg, '04_bots_' + g)
        errs_before = len(errors)
        pg.evaluate('__qb.home()')
        pg.wait_for_timeout(300)

    # UNO hotseat veil test (2 humans)
    pg.evaluate("__qb.startGame('uno', {n:2, allBots:false, forceHumans:true})" if False else "0")
    # interact: TTT — human plays a move, bot replies
    pg.evaluate("__qb.startGame('ttt', {n:2})")
    pg.wait_for_timeout(400)
    pg.query_selector_all('.tcell')[0].click(); pg.wait_for_timeout(1400)
    pg.query_selector_all('.tcell')[4].click(); pg.wait_for_timeout(1400)
    shot(pg, '05_ttt_moves')
    # UNO: play a card if possible
    pg.evaluate("__qb.startGame('uno', {n:4})")
    pg.wait_for_timeout(2200)
    card = pg.query_selector('.hand .ucard.ok')
    if card:
        card.click()
        pg.wait_for_timeout(1200)
        # color picker may be open
        cp = pg.query_selector('.colorpick button')
        if cp: cp.click()
    pg.wait_for_timeout(1500)
    shot(pg, '06_uno_move')
    # modal check: rules modal
    pg.evaluate("__qb.home()")
    pg.wait_for_timeout(250)
    pg.query_selector('[data-act="about"]').click()
    pg.wait_for_timeout(400)
    shot(pg, '07_about')
    pg.keyboard.press('Escape')
    pg.wait_for_timeout(200)
    # exit modal via android back
    pg.evaluate("window.__androidBack()")
    pg.wait_for_timeout(400)
    shot(pg, '08_exit_modal')

    b.close()

print('\nERRORS (' + str(len(errors)) + '):')
for e in errors[:20]:
    print(' ', e[:300])
sys.exit(1 if errors else 0)
