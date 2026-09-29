"""DOM structure + layout QA: verify every game builds the right elements,
nothing overflows the viewport, and screenshots contain real rendered content."""
import pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path('/home/user/gamebox')
errors = []
def check(name, cond):
    print(('  OK  ' if cond else '  FAIL') + ' ' + name)
    if not cond: errors.append(name)

with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=1)
    pg.on('pageerror', lambda e: errors.append('PAGEERROR: ' + str(e)))
    pg.goto('file://' + str(ROOT / 'index.html'))
    pg.wait_for_timeout(600)

    print('— home')
    check('5 game cards', len(pg.query_selector_all('.gcard')) == 5)
    check('no horizontal overflow', pg.evaluate('document.documentElement.scrollWidth') <= 392)

    print('— UNO')
    pg.evaluate("__qb.startGame('uno', {n:4})")
    pg.wait_for_timeout(1500)
    hand_n = pg.evaluate('window.__qb.ui().game ? 0 : 0')  # game object is private; count DOM
    cards = len(pg.query_selector_all('#u-hand .ucard'))
    check('hand has 7 cards', cards == 7)
    check('discard shows a card', len(pg.query_selector_all('#u-disc .ucard')) == 1)
    check('4 player chips', len(pg.query_selector_all('.pl-chip')) == 4)
    check('draw pile visible', pg.query_selector('#u-pile') is not None)
    # play a card
    ok_card = pg.query_selector('.hand .ucard.ok')
    if ok_card:
        ok_card.click(); pg.wait_for_timeout(700)
        cp = pg.query_selector('.colorpick button')
        if cp: cp.click()
    pg.wait_for_timeout(1200)
    check('no overflow after play', pg.evaluate('document.documentElement.scrollWidth') <= 392)
    check('still 4 chips after play', len(pg.query_selector_all('.pl-chip')) == 4)

    print('— Ludo')
    pg.evaluate("__qb.startGame('ludo', {n:4})")
    pg.wait_for_timeout(1500)
    check('52 track cells', len(pg.query_selector_all('.lcell:not(.hcell)')) == 52)
    check('20 home-column cells', len(pg.query_selector_all('.lcell.hcell')) == 20)
    check('4 bases', len(pg.query_selector_all('.lbase')) == 4)
    check('16 tokens', len(pg.query_selector_all('.ltok')) == 16)
    board = pg.query_selector('.lboard')
    bb = board.bounding_box()
    check('board is square-ish', abs(bb['width'] - bb['height']) < 3)
    check('board fits width', bb['x'] >= -1 and bb['x'] + bb['width'] <= 391)
    toks = pg.query_selector_all('.ltok')
    inb = all(bb['x'] - 2 <= t.bounding_box()['x'] <= bb['x'] + bb['width'] for t in toks)
    check('tokens inside board', inb)
    # roll for human
    pg.wait_for_timeout(500)
    dice = pg.query_selector('#l-dice')
    if dice and 'dim' not in (dice.get_attribute('class') or ''):
        dice.click(); pg.wait_for_timeout(2500)
    check('no overflow in ludo', pg.evaluate('document.documentElement.scrollWidth') <= 392)

    print('— Tic Tac Toe')
    pg.evaluate("__qb.startGame('ttt', {n:2})")
    pg.wait_for_timeout(600)
    check('9 cells', len(pg.query_selector_all('.tcell')) == 9)

    print('— Connect Four')
    pg.evaluate("__qb.startGame('c4', {n:2})")
    pg.wait_for_timeout(600)
    check('7 columns', len(pg.query_selector_all('.c4-col')) == 7)
    check('42 cells', len(pg.query_selector_all('.c4-cell')) == 42)
    pg.query_selector_all('.c4-col')[3].click()
    pg.wait_for_timeout(1500)
    check('disc rendered after drop', len(pg.query_selector_all('.disc')) >= 1)

    print('— Snakes & Ladders')
    pg.evaluate("__qb.startGame('sl', {n:4})")
    pg.wait_for_timeout(800)
    check('100 cells', len(pg.query_selector_all('.slcell')) == 100)
    check('4 pieces', len(pg.query_selector_all('.spiece')) == 4)
    check('svg overlay present', pg.query_selector('.slsvg') is not None)
    sb = pg.query_selector('.slboard').bounding_box()
    check('board square', abs(sb['width'] - sb['height']) < 3)
    pg.wait_for_timeout(600)
    check('no overflow in SL', pg.evaluate('document.documentElement.scrollWidth') <= 392)

    b.close()

# pixel sanity via PIL
from PIL import Image
import statistics
for f in sorted((ROOT / 'test' / 'shots').glob('*.png')):
    im = Image.open(f).convert('L').resize((80, 160))
    px = list(im.getdata())
    mean = sum(px) / len(px)
    stdev = statistics.pstdev(px)
    ok = 8 < mean < 240 and stdev > 6
    if not ok:
        errors.append('screenshot looks wrong: %s (mean=%.1f stdev=%.1f)' % (f.name, mean, stdev))
    print(('  OK  ' if ok else '  FAIL') + ' pixels: ' + f.name + ' (mean %.0f, stdev %.0f)' % (mean, stdev))

print('\nERRORS: ' + str(len(errors)))
for e in errors: print(' -', e)
