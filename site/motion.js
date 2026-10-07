/* Anika — motion layer (GSAP + ScrollTrigger, optional Lenis)
   Animates only transform, opacity, stroke-dashoffset and clip-path.
   ------------------------------------------------------------------ */
(() => {
  const root = document.documentElement;
  const ready = () => root.classList.add('ready');
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const isMobile = () => innerWidth < 768;

  // ---- Non-motion behaviour (works without GSAP) -------------------------
  initNavState();
  initRegionMenu();

  if (!window.gsap || !window.ScrollTrigger) { ready(); initPricingStatic(); return; }
  gsap.registerPlugin(ScrollTrigger);

  /* ====================== 1. Motion tokens & helpers ====================== */
  const EASE = { in: 'power3.out', state: 'power2.inOut', hover: 'power2.out' };
  const DUR = { micro: .2, std: .6, section: .8, hero: 1.1 };
  const STAG = () => (isMobile() ? .05 : .08);
  const DIST = () => (isMobile() ? 24 : 32);
  const loops = [];                       // idle loops, paused offscreen / when tab hidden

  const uiFrom = () => ({ opacity: 0, y: DIST(), scale: .97 });
  const uiTo = (extra = {}) => ({ opacity: 1, y: 0, scale: 1, duration: DUR.std + .1, ease: EASE.in, ...extra });

  const fmtNum = (n, o) => (o.prefix || '') + Math.round(n).toLocaleString('en-US') + (o.suffix || '');
  const numOpts = (el) => ({ value: +el.dataset.count, prefix: el.dataset.prefix || '', suffix: el.dataset.suffix || '' });

  // Count-up that always lands on the exact value; assistive tech reads the final value.
  function prepCount(el) {
    const o = numOpts(el);
    el.setAttribute('role', 'text');
    el.setAttribute('aria-label', fmtNum(o.value, o));
    if (!reduced) el.textContent = fmtNum(0, o);
  }
  function countUp(el, vars = {}) {
    const o = numOpts(el), s = { v: 0 };
    return gsap.to(s, {
      v: o.value, duration: 1.2, ease: 'power2.out', ...vars,
      onUpdate: () => { el.textContent = fmtNum(s.v, o); },
      onComplete: () => { el.textContent = fmtNum(o.value, o); },
    });
  }

  function prepDraw(path) { path.setAttribute('pathLength', 1); gsap.set(path, { strokeDasharray: 1, strokeDashoffset: 1 }); }

  // Heading → masked words + accent colour wipe
  function splitHeading(h) {
    if (h._split) return h._split;
    const words = [], accents = [];
    const wrap = (node) => {
      const w = document.createElement('span'); w.className = 'w';
      const i = document.createElement('span'); i.className = 'wi';
      w.appendChild(i); i.appendChild(node); words.push(i); return w;
    };
    [...h.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((t) => {
          if (!t) return;
          if (/^\s+$/.test(t)) frag.appendChild(document.createTextNode(' '));
          else frag.appendChild(wrap(document.createTextNode(t)));
        });
        n.replaceWith(frag);
      } else if (n.classList && n.classList.contains('accent')) {
        const txt = n.textContent;
        n.classList.add('wiped');
        n.innerHTML = `<span class="acc-base">${txt}</span><span class="acc-fill" aria-hidden="true">${txt}</span>`;
        const ph = document.createComment('');
        n.replaceWith(ph);
        ph.replaceWith(wrap(n));
        accents.push($('.acc-fill', n));
      }
    });
    return (h._split = { words, accents });
  }
  function headingIn(h, vars = {}) {
    const { words, accents } = splitHeading(h);
    const tl = gsap.timeline(vars);
    tl.fromTo(words, { yPercent: 115 }, { yPercent: 0, duration: vars.hero ? DUR.hero : DUR.section, ease: EASE.in, stagger: STAG() }, 0);
    if (accents.length) tl.fromTo(accents, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: .7, ease: EASE.state }, '>-0.25');
    return tl;
  }
  function prepHeading(h) { const { words, accents } = splitHeading(h); gsap.set(words, { yPercent: 115 }); if (accents.length) gsap.set(accents, { clipPath: 'inset(0 100% 0 0)' }); }

  const onceAt = (trigger, fn, start = 'top 80%') =>
    ScrollTrigger.create({ trigger, start, once: true, onEnter: fn });

  // Pause idle loops when offscreen or the tab is hidden
  function addLoop(tween, el) {
    loops.push(tween); tween.pause();
    ScrollTrigger.create({ trigger: el, start: 'top bottom', end: 'bottom top', onToggle: (s) => (s.isActive && !document.hidden ? tween.resume() : tween.pause()) });
  }
  document.addEventListener('visibilitychange', () => loops.forEach((t) => (document.hidden ? t.pause() : t.resume())));

  /* ====================== Reduced motion: simple fades ====================== */
  if (reduced) {
    initPricingStatic(true);
    $$('.m-head, .sub, .lede, .cta, .showcase, .why-copy, .why-card, .feat, .step, .billing, .plans, .cta-panel, .footer-grid').forEach((el) => {
      gsap.set(el, { opacity: 0 });
      onceAt(el, () => gsap.to(el, { opacity: 1, duration: .4, ease: 'power1.out' }), 'top 90%');
    });
    initScrollSpy(false);
    ready();
    return;
  }

  /* ====================== Lenis (gentle) ====================== */
  let lenis = null;
  if (fine && window.Lenis && !/[?&]nolenis/.test(location.search)) {
    lenis = new Lenis({ lerp: .1, wheelMultiplier: .9, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    root.classList.add('lenis');
    $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
      const id = a.getAttribute('href'); const t = id.length > 1 && $(id);
      if (t) { e.preventDefault(); lenis.scrollTo(t, { offset: -80, duration: 1.2 }); }
    }));
  }

  /* ====================== 2. Navigation ====================== */
  gsap.fromTo('#nav', { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: DUR.std, ease: EASE.in, clearProps: 'transform' });
  initScrollSpy(true);

  /* ====================== 3. Hero ====================== */
  const hero = $('.hero');
  const h1 = $('.hero h1');
  prepHeading(h1);
  gsap.set(['.lede', '.hero .cta .btn'], { opacity: 0, y: DIST() });
  gsap.set('.rise', { opacity: 0, y: 70 });

  const dash = $('#dash');
  const budget = $('.c-budget', dash), team = $('.c-team', dash), chart = $('.c-chart', dash);
  const stats = $$('.stat', dash), analysis = $('.c-analysis', dash), donut = $('.c-donut', dash);
  const orderedCards = [budget, team, chart, ...stats, analysis, donut];
  gsap.set(orderedCards, uiFrom());
  $$('[data-count]', dash).forEach(prepCount);
  $$('.bar', dash).forEach((b) => gsap.set(b, { scaleY: 0 }));
  prepDraw($('.curve', dash)); gsap.set($$('.dot-s, .dot-e', dash), { scale: 0, transformOrigin: '50% 50%' });
  gsap.set(dash, { '--mx': 0, '--my': 0 });
  gsap.set($('.dmask', dash), { strokeDashoffset: 100 });
  gsap.set($$('.av', dash), { scale: .8, opacity: 0 });
  gsap.set($('.dn-center small', dash), { opacity: 0 });

  const heroTl = gsap.timeline({ delay: .15 });
  heroTl
    .add(headingIn(h1, { hero: true }), 0)
    .to('.lede', { opacity: 1, y: 0, duration: .8, ease: EASE.in, clearProps: 'transform' }, '>-0.55')
    .to('.hero .cta .btn', { opacity: 1, y: 0, duration: .7, ease: EASE.in, stagger: STAG(), clearProps: 'transform' }, '>-0.5');

  const dashTl = gsap.timeline({ paused: true });
  dashTl
    .to('.rise', { opacity: 1, y: 0, duration: DUR.hero, ease: EASE.in }, 0)
    .to(budget, uiTo(), .35).to(team, uiTo(), .47).to(chart, uiTo(), .59)
    .to(stats, uiTo({ stagger: .08 }), .71).to(analysis, uiTo(), .83).to(donut, uiTo(), .95)
    // internals
    .add(() => countUp($('.b-amt', dash)), .5)
    .to($('.curve', dash), { strokeDashoffset: 0, duration: 1.1, ease: EASE.state }, .6)
    .to($$('.dot-s, .dot-e', dash), { scale: 1, duration: .4, ease: EASE.in, stagger: .9 }, .6)
    .to($$('.av', dash), { scale: 1, opacity: 1, duration: .45, ease: EASE.in, stagger: .14 }, .75)
    .to($$('.bar', dash), { scaleY: 1, duration: .8, ease: EASE.in, stagger: .05 }, .85)
    .add(() => countUp($('.ch-amt', dash)), .85)
    .add(() => $$('.stat-t b', dash).forEach((b) => countUp(b)), .9)
    .to($('.dmask', dash), { strokeDashoffset: 0, duration: 1.4, ease: EASE.state }, 1.1)
    .add(() => { countUp($('.dn-center b', dash), { duration: 1.4 }); countUp($('.dn-val', dash)); }, 1.1)
    .to($('.dn-center small', dash), { opacity: 1, duration: .5, ease: EASE.in }, 1.8)
    .add(startHeroIdle, '>');

  ScrollTrigger.create({ trigger: '#showcase', start: 'top 92%', once: true, onEnter: () => dashTl.play() });

  function startHeroIdle() {
    const floatT = gsap.to('.float', { y: -6, duration: 3, ease: 'power1.inOut', yoyo: true, repeat: -1 });
    addLoop(floatT, '#showcase'); floatT.resume();
    const pulse = gsap.timeline({ repeat: -1, repeatDelay: 3.2 });
    pulse.to($$('.pill', dash), { scale: 1.07, duration: .45, ease: 'power2.inOut', yoyo: true, repeat: 1, stagger: .25 });
    addLoop(pulse, '#showcase'); pulse.resume();
  }

  // scroll parallax: dashboard slightly slower than the page, frame eases to .97
  gsap.to('#showcase', { y: () => (innerHeight + $('#showcase').offsetHeight) * .1, ease: 'none',
    scrollTrigger: { trigger: '#showcase', start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true } });
  gsap.fromTo(dash, { scale: 1 }, { scale: .97, ease: 'none',
    scrollTrigger: { trigger: '#showcase', start: 'top 55%', end: 'bottom 15%', scrub: true } });

  // mouse tilt + depth parallax (fine pointers only)
  if (fine) {
    gsap.set(dash, { transformPerspective: 1400 });
    const rx = gsap.quickTo(dash, 'rotationX', { duration: .8, ease: EASE.in });
    const ry = gsap.quickTo(dash, 'rotationY', { duration: .8, ease: EASE.in });
    const mx = gsap.quickTo(dash, '--mx', { duration: .9, ease: EASE.in });
    const my = gsap.quickTo(dash, '--my', { duration: .9, ease: EASE.in });
    const area = $('#showcase');
    area.addEventListener('pointermove', (e) => {
      const r = area.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - .5, ny = (e.clientY - r.top) / r.height - .5;
      ry(nx * 6); rx(-ny * 6); mx(nx * 2); my(ny * 2);   // ±3° ; cards shift ±(depth) px
    });
    area.addEventListener('pointerleave', () => { ry(0); rx(0); mx(0); my(0); });
  }

  /* ====================== 4. Why use Anika ====================== */
  const why = $('.why');
  sectionHead(why);
  const whyCopy = $('.why-copy');
  const whyWords = wordSplit($$('p', whyCopy));
  if (!isMobile()) {
    gsap.fromTo(whyWords, { opacity: .3 }, { opacity: 1, ease: 'none', stagger: .06,
      scrollTrigger: { trigger: whyCopy, start: 'top 82%', end: 'bottom 48%', scrub: .4 } });
  } else {
    gsap.set($$('p', whyCopy), { opacity: 0, y: DIST() });
    onceAt(whyCopy, () => gsap.to($$('p', whyCopy), { opacity: 1, y: 0, duration: DUR.section, ease: EASE.in, stagger: .15 }));
  }
  const whyCard = $('.why-card'), whyRows = $$('.why-card li'), whyNote = $('.why-note');
  const whyPaths = $$('.why-card li svg path');
  whyPaths.forEach(prepDraw);
  gsap.set(whyCard, { opacity: 0, x: isMobile() ? 0 : 60, y: isMobile() ? DIST() : 0, scale: .97 });
  gsap.set(whyRows, { opacity: 0, y: 20 });
  gsap.set(whyNote, { opacity: 0, y: 14 });
  onceAt(whyCard, () => {
    const tl = gsap.timeline();
    tl.to(whyCard, { opacity: 1, x: 0, y: 0, scale: 1, duration: DUR.section, ease: EASE.in }, 0)
      .to(whyRows, { opacity: 1, y: 0, duration: .6, ease: EASE.in, stagger: .12 }, .4);
    whyRows.forEach((row, i) => tl.to($$('path', row), { strokeDashoffset: 0, duration: .55, ease: EASE.state, stagger: .1 }, .7 + i * .12));
    tl.to(whyNote, { opacity: 1, y: 0, duration: .6, ease: EASE.in }, 1.5);
  });

  /* ====================== 5. Core features ====================== */
  const feat = $('.features');
  sectionHead(feat);
  const cards = $$('.feat');
  const miniIn = {};
  cards.forEach((c, i) => {
    gsap.set(c, uiFrom());
    onceAt(c, () => {
      gsap.to(c, uiTo({ delay: (i % 2) * .12, onComplete: () => miniIn[c.id] && miniIn[c.id]() }));
    });
    if (fine) featHover(c);
  });

  // Data Integration Hub
  {
    const card = $('#feat-int'), rows = $$('.int-row', card).slice(0, 2), ghost = $('.int-ghost', card), btn = $('.int-btn', card), link = $('.int-link path', card);
    gsap.set(rows, { opacity: 0, x: -24 }); gsap.set(btn, { opacity: 0, y: 12 }); gsap.set(ghost, { opacity: 0, y: -10, pointerEvents: 'none' });
    gsap.set(link, { strokeDashoffset: 1 });
    miniIn['feat-int'] = () => {
      gsap.timeline()
        .to(rows, { opacity: 1, x: 0, duration: .6, ease: EASE.in, stagger: .12 })
        .to(link, { strokeDashoffset: 0, duration: .5, ease: EASE.state }, '-=.2')
        .to(btn, { opacity: 1, y: 0, duration: .5, ease: EASE.in }, '-=.3')
        .to(btn, { scale: 1.04, duration: .22, ease: 'power2.inOut', yoyo: true, repeat: 1 }, '+=.1');
    };
    const mini = $('.mini-int', card);
    mini.addEventListener('pointerenter', () => gsap.to(ghost, { opacity: 1, y: 0, duration: .35, ease: EASE.in, overwrite: 'auto' }));
    mini.addEventListener('pointerleave', () => gsap.to(ghost, { opacity: 0, y: -10, duration: .25, ease: EASE.hover, overwrite: 'auto' }));
  }

  // Financial Health Monitoring
  {
    const card = $('#feat-fin'), bars = $$('.bar', card), amt = $('[data-count]', card);
    prepCount(amt); gsap.set(bars, { scaleY: 0 });
    miniIn['feat-fin'] = () => {
      gsap.to(bars, { scaleY: 1, duration: .8, ease: EASE.in, stagger: .05 });
      countUp(amt, { duration: 1.2 });
    };
  }

  // Operational Excellence
  {
    const card = $('#feat-ops'), tRows = $$('.t-row', card), plus = $('.plus', card), ring = $('.plus-ring', card);
    gsap.set(tRows, { opacity: 0, y: 16 }); gsap.set(plus, { scale: 0 }); gsap.set($$('.av', card), { scale: .85 });
    miniIn['feat-ops'] = () => {
      gsap.timeline()
        .to(tRows, { opacity: 1, y: 0, duration: .55, ease: EASE.in, stagger: .12 })
        .to($$('.av', card), { scale: 1, duration: .4, ease: EASE.in, stagger: .12 }, 0)
        .to(plus, { scale: 1, duration: .5, ease: EASE.in }, '-=.1')
        .fromTo(ring, { scale: 1, opacity: .55 }, { scale: 1.9, opacity: 0, duration: .8, ease: EASE.hover, clearProps: 'transform,opacity' }, '<+.1');
    };
  }

  // Market Intelligence — chat sequence (plays once)
  {
    const card = $('#feat-mkt'), user = $('.msg-user', card), ai = $('.msg-ai', card), input = $('.chat-in', card);
    const aiText = $('.ai-text', card), typing = $('.typing', card), send = $('.chat-in button', card), field = $('.chat-in input', card);
    const words = wordSplit([aiText], 'ai-w');
    gsap.set(user, { opacity: 0, y: 16 }); gsap.set(ai, { opacity: 0, y: 16 }); gsap.set(words, { opacity: 0 }); gsap.set(input, { opacity: 0, y: 12 });
    miniIn['feat-mkt'] = () => {
      const tl = gsap.timeline();
      tl.to(user, { opacity: 1, y: 0, duration: .6, ease: EASE.in })
        .to(ai, { opacity: 1, y: 0, duration: .6, ease: EASE.in }, '+=.2')
        .to(typing, { opacity: 1, duration: .2 }, '<+.2')
        .to($$('i', typing), { opacity: 1, duration: .2, ease: 'power1.inOut', stagger: .13, repeat: 2, yoyo: true }, '<')
        .to(typing, { opacity: 0, duration: .2 }, '>')
        .to(words, { opacity: 1, duration: .3, ease: 'power1.out', stagger: .055 }, '>')
        .to(input, { opacity: 1, y: 0, duration: .5, ease: EASE.in }, '-=.3');
    };
    let pulse;
    field.addEventListener('focus', () => { pulse = gsap.to(send, { scale: 1.1, duration: .5, ease: 'power2.inOut', yoyo: true, repeat: -1 }); });
    field.addEventListener('blur', () => { pulse && pulse.kill(); gsap.to(send, { scale: 1, duration: .2, ease: EASE.hover }); });
  }

  /* ====================== 6. How it works ====================== */
  const how = $('.how');
  sectionHead(how);
  const steps = $$('.step');
  const desktopLine = innerWidth >= 900;
  if (desktopLine) {
    gsap.fromTo('.line-fill', { scaleX: 0 }, { scaleX: 1, ease: 'none',
      scrollTrigger: { trigger: '.steps-wrap', start: 'top 72%', end: 'bottom 62%', scrub: .4 } });
  }
  steps.forEach((s, i) => {
    const orb = $('.orb', s), shot = $('.shot', s), badge = $('.badge', s), txt = $$('h3, p', s), loop = $('.loop', s);
    gsap.set(orb, { scale: .6, opacity: 0 }); gsap.set(shot, { opacity: 0, y: 24 }); gsap.set(badge, { scale: 0 }); gsap.set(txt, { opacity: 0, y: DIST() });
    const prep = [
      () => { gsap.set($$('.chip-a', loop), { x: -14, y: -10, opacity: 0 }); gsap.set($$('.chip-b', loop), { x: 20, y: 14, opacity: 0 }); prepDraw($('.lk', loop)); },
      () => gsap.set($$('.mb', loop), { scaleY: 0, transformOrigin: '50% 100%' }),
      () => { const r = $('.ring', loop); gsap.set(r, { strokeDasharray: 1, strokeDashoffset: 1 }); },
    ][i];
    prep();
    onceAt(s, () => {
      const tl = gsap.timeline();
      tl.to(orb, { scale: 1, opacity: 1, duration: DUR.section, ease: EASE.in, transformOrigin: '50% 50%' })
        .to(shot, { opacity: 1, y: 0, duration: .7, ease: EASE.in }, '-=.55')
        .to(badge, { scale: 1, duration: .5, ease: EASE.in }, '-=.35')
        .to(txt, { opacity: 1, y: 0, duration: .7, ease: EASE.in, stagger: STAG() * 1.5 }, '-=.25');
      // small one-shot loop inside the illustration
      if (i === 0) tl.to($$('.chip-a, .chip-b', loop), { x: 0, y: 0, opacity: .92, duration: .7, ease: EASE.state }, '-=.2').to($('.lk', loop), { strokeDashoffset: 0, duration: .35, ease: EASE.state }, '>-0.1');
      if (i === 1) tl.to($$('.mb', loop), { scaleY: 1, duration: .7, ease: EASE.in, stagger: .08 }, '-=.2');
      if (i === 2) tl.to($('.ring', loop), { strokeDashoffset: 0, duration: 1.2, ease: EASE.state }, '-=.2');
    }, isMobile() ? 'top 88%' : 'top 80%');
  });

  /* ====================== 7. Pricing ====================== */
  const pricing = $('.pricing');
  sectionHead(pricing);
  const billing = $('.billing'), plans = $$('.plan'), amounts = $$('.amount'), pers = $$('.per');
  injectChecks($$('.plan li'));
  const featured = $('.plan-featured'), glow = $('.plan-glow');
  gsap.set(billing, { opacity: 0, y: 20 });
  plans.forEach((p, i) => gsap.set(p, i === 2 ? { opacity: 0, y: 40, scale: .94 } : uiFrom()));
  plans.forEach((p) => { $$('li', p).forEach((li) => gsap.set(li, { opacity: 0, y: 14 })); $$('li path', p).forEach(prepDraw); });
  amounts.forEach((a) => odo(a, +a.dataset.monthly, { animate: false, zero: true }));
  onceAt(billing, () => gsap.to(billing, { opacity: 1, y: 0, duration: .6, ease: EASE.in }));
  onceAt($('.plans'), () => {
    const tl = gsap.timeline();
    plans.forEach((p, i) => {
      const t = i * .14;
      tl.to(p, i === 2 ? { opacity: 1, y: 0, scale: 1, duration: .9, ease: EASE.in } : uiTo(), t);
      tl.add(() => odo($('.amount', p), +$('.amount', p).dataset.monthly, { animate: true, zero: true, duration: 1.1 }), t + .25);
      tl.to($$('li', p), { opacity: 1, y: 0, duration: .45, ease: EASE.in, stagger: .07 }, t + .4);
      tl.to($$('li path', p), { strokeDashoffset: 0, duration: .5, ease: EASE.state, stagger: .035 }, t + .5);
    });
    tl.to(glow, { opacity: 1, duration: .9, ease: EASE.state, yoyo: true, repeat: 1 }, .7);
  });
  setupBilling(true);
  if (fine) {
    featured.addEventListener('pointermove', (e) => {
      const r = featured.getBoundingClientRect();
      featured.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      featured.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  }

  /* ====================== 8. CTA ====================== */
  const panel = $('#cta-panel'), ctaH = $('#cta-title'), ctaP = $('.cta-p'), ctaBtn = $('.cta-btn'), dev = $('.cta-device'), devWrap = $('.cta-device-wrap');
  prepHeading(ctaH);
  gsap.set(panel, { opacity: 0, y: 40 }); gsap.set([ctaP, ctaBtn], { opacity: 0, y: DIST() });
  gsap.set(dev, { opacity: 0, x: isMobile() ? 0 : 140, y: isMobile() ? 40 : 0 });
  onceAt(panel, () => {
    const tl = gsap.timeline();
    tl.to(panel, { opacity: 1, y: 0, duration: DUR.section, ease: EASE.in })
      .add(headingIn(ctaH), '-=.5')
      .to(ctaP, { opacity: 1, y: 0, duration: .7, ease: EASE.in }, '-=.5')
      .to(ctaBtn, { opacity: 1, y: 0, duration: .7, ease: EASE.in }, '-=.45')
      .to(dev, { opacity: 1, x: 0, y: 0, duration: 1.1, ease: EASE.in }, 0.25)
      .add(() => { const f = gsap.to(dev, { y: 4, duration: 3.2, ease: 'power1.inOut', yoyo: true, repeat: -1 }); addLoop(f, panel); f.resume(); });
  }, 'top 78%');
  if (!isMobile()) {
    gsap.fromTo(devWrap, { y: 50 }, { y: -50, ease: 'none', scrollTrigger: { trigger: panel, start: 'top bottom', end: 'bottom top', scrub: true } });
  }
  { // slow shifting gradient
    const bgT = gsap.to('.cta-bg', { x: '4%', y: '-3%', scale: 1.06, opacity: .5, duration: 12, ease: 'power1.inOut', yoyo: true, repeat: -1 });
    addLoop(bgT, panel); bgT.resume();
  }
  if (fine) { // magnetic Demo button
    const qx = gsap.quickTo(ctaBtn, 'x', { duration: .5, ease: EASE.in }), qy = gsap.quickTo(ctaBtn, 'y', { duration: .5, ease: EASE.in });
    panel.addEventListener('pointermove', (e) => {
      const r = ctaBtn.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dx = e.clientX - cx, dy = e.clientY - cy;
      const near = Math.abs(dx) < r.width / 2 + 40 && Math.abs(dy) < r.height / 2 + 40;
      qx(near ? dx * .3 : 0); qy(near ? dy * .3 : 0);
    });
    panel.addEventListener('pointerleave', () => { qx(0); qy(0); });
  }

  /* ====================== 9. Footer ====================== */
  const fcols = $$('.footer-grid > *');
  gsap.set(fcols, { opacity: 0, y: DIST() }); gsap.set('.copyright', { opacity: 0 });
  onceAt('.footer', () => {
    gsap.to(fcols, { opacity: 1, y: 0, duration: DUR.std + .1, ease: EASE.in, stagger: STAG() * 1.5 });
    gsap.to('.copyright', { opacity: 1, duration: .8, ease: EASE.in, delay: .5 });
  }, 'top 88%');

  /* ====================== 10. Section-to-section tints ====================== */
  $$('.tint').forEach((t) => gsap.to(t, { keyframes: { opacity: [0, 1, 0], easeEach: 'none' }, ease: 'none', scrollTrigger: { trigger: t.parentElement, start: 'top 85%', end: 'bottom 15%', scrub: true } }));

  /* ====================== 11. Refresh hooks ====================== */
  const refresh = () => ScrollTrigger.refresh();
  document.fonts && document.fonts.ready.then(refresh);
  addEventListener('load', refresh);
  $$('img').forEach((img) => { if (!img.complete) img.addEventListener('load', refresh, { once: true }); });
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(refresh, 200); });

  ready();

  /* ========================================================================
     Shared functions (hoisted)
     ======================================================================== */
  function sectionHead(section) {
    const h = $('.m-head', section), sub = $('.sub', section);
    prepHeading(h); if (sub) gsap.set(sub, { opacity: 0, y: 24 });
    onceAt(h, () => {
      const tl = gsap.timeline();
      tl.add(headingIn(h), 0);
      if (sub) tl.to(sub, { opacity: 1, y: 0, duration: .7, ease: EASE.in }, .15);
    });
  }

  // Wrap each word in .ww / custom class spans (keeps <br>)
  function wordSplit(blocks, cls = 'ww') {
    const out = [];
    blocks.forEach((b) => {
      [...b.childNodes].forEach((n) => {
        if (n.nodeType !== 3) return;
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((t) => {
          if (!t) return;
          if (/^\s+$/.test(t)) frag.appendChild(document.createTextNode(' '));
          else { const s = document.createElement('span'); s.className = cls; s.textContent = t; frag.appendChild(s); out.push(s); }
        });
        n.replaceWith(frag);
      });
    });
    return out;
  }

  function featHover(card) {
    const rx = gsap.quickTo(card, 'rotationX', { duration: .5, ease: EASE.hover }), ry = gsap.quickTo(card, 'rotationY', { duration: .5, ease: EASE.hover });
    gsap.set(card, { transformPerspective: 1200 });
    card.addEventListener('pointerenter', () => gsap.to(card, { y: -6, duration: DUR.micro + .1, ease: EASE.hover, overwrite: 'auto' }));
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      ry(((e.clientX - r.left) / r.width - .5) * 6); rx(-((e.clientY - r.top) / r.height - .5) * 6);
    });
    card.addEventListener('pointerleave', () => { ry(0); rx(0); gsap.to(card, { y: 0, duration: .3, ease: EASE.hover, overwrite: 'auto' }); });
  }

  /* ---- Pricing toggle with slot-style counters ---- */
  function setupBilling(animated) {
    const wrap = $('.billing'), btns = $$('button', wrap), badge = $('.save-badge', wrap);
    btns.forEach((b) => b.addEventListener('click', () => {
      const period = b.dataset.period; if (wrap.dataset.period === period) return;
      wrap.dataset.period = period;
      btns.forEach((x) => { const on = x === b; x.classList.toggle('is-active', on); x.setAttribute('aria-pressed', on); });
      $$('.amount').forEach((a, i) => odo(a, +a.dataset[period], { animate: animated, duration: .8, delay: i * .06 }));
      $$('.per').forEach((p) => { p.textContent = period === 'annual' ? '/year' : '/month'; });
      if (animated) {
        if (period === 'annual') gsap.to(badge, { opacity: 1, scale: 1, duration: .45, ease: EASE.in, delay: .15 });
        else gsap.to(badge, { opacity: 0, scale: .6, duration: .25, ease: EASE.hover });
      } else badge.style.opacity = period === 'annual' ? 1 : 0;
    }));
  }
})();

/* =========================================================================
   Helpers shared with the no-GSAP / reduced-motion paths (function-hoisted)
   ========================================================================= */
function checkSvg() {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'ck'); s.setAttribute('aria-hidden', 'true');
  s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.8');
  s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
  ['M21 12.5A9 9 0 1 1 15.5 4.2', 'm8 12 3 3 8-8'].forEach((d) => { const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', d); s.appendChild(p); });
  return s;
}
function injectChecks(lis) { lis.forEach((li) => { if (!li.querySelector('.ck')) li.prepend(checkSvg()); }); }

// Slot-counter: each digit is a vertical strip of 0–9 that rolls to its target
function odo(el, value, { animate = true, duration = .9, delay = 0, zero = false } = {}) {
  const str = '$' + Math.round(value).toLocaleString('en-US');
  const prev = el._d || [];
  const chars = [...str];
  const rightIdx = []; let r = 0;
  for (let i = chars.length - 1; i >= 0; i--) rightIdx[i] = /\d/.test(chars[i]) ? r++ : -1;
  el.textContent = '';
  el.setAttribute('role', 'text'); el.setAttribute('aria-label', str);
  const next = [], strips = [];
  chars.forEach((c, i) => {
    if (rightIdx[i] < 0) { const s = document.createElement('span'); s.className = 'od-s'; s.setAttribute('aria-hidden', 'true'); s.textContent = c; el.appendChild(s); return; }
    const col = document.createElement('span'); col.className = 'od'; col.setAttribute('aria-hidden', 'true');
    const strip = document.createElement('span'); strip.className = 'od-strip';
    for (let d = 0; d < 10; d++) { const n = document.createElement('span'); n.textContent = d; strip.appendChild(n); }
    col.appendChild(strip); el.appendChild(col);
    col._to = +c;
    next[rightIdx[i]] = +c;
    strips.push({ strip, to: +c, from: zero ? 0 : (prev[rightIdx[i]] ?? 0), k: rightIdx[i] });
  });
  el._d = next;
  fitOdo(el);
  strips.forEach(({ strip, to, from, k }) => {
    if (!animate) {
      const at = zero ? 0 : to;
      if (window.gsap) gsap.set(strip, { yPercent: -at * 10 }); else strip.style.transform = `translateY(${-at * 10}%)`;
      return;
    }
    if (!window.gsap) { strip.style.transform = `translateY(${-to * 10}%)`; return; }
    gsap.fromTo(strip, { yPercent: -from * 10 }, { yPercent: -to * 10, duration, delay: delay + k * .07, ease: 'power3.out' });
  });
}

// Size each digit column to its target glyph so proportional digits ("1") don't leave gaps
function fitOdo(el) {
  el.querySelectorAll('.od').forEach((col) => {
    const cell = col.firstChild.children[col._to]; if (!cell) return;
    const r = document.createRange(); r.selectNodeContents(cell);
    const w = r.getBoundingClientRect().width;
    if (w) col.style.width = w + 'px';
  });
}
if (document.fonts) document.fonts.ready.then(() => document.querySelectorAll('.amount').forEach(fitOdo));

function initPricingStatic(withBadge) {
  injectChecks($$all('.plan li'));
  $$all('.amount').forEach((a) => odo(a, +a.dataset.monthly, { animate: false }));
  const wrap = document.querySelector('.billing'); if (!wrap) return;
  const btns = [...wrap.querySelectorAll('button')], badge = wrap.querySelector('.save-badge');
  btns.forEach((b) => b.addEventListener('click', () => {
    const period = b.dataset.period; wrap.dataset.period = period;
    btns.forEach((x) => { const on = x === b; x.classList.toggle('is-active', on); x.setAttribute('aria-pressed', on); });
    $$all('.amount').forEach((a) => odo(a, +a.dataset[period], { animate: false }));
    $$all('.per').forEach((p) => { p.textContent = period === 'annual' ? '/year' : '/month'; });
    if (badge) { badge.style.opacity = period === 'annual' ? 1 : 0; badge.style.transform = 'scale(1)'; }
  }));
}
function $$all(s) { return [...document.querySelectorAll(s)]; }

/* ---- Nav: scrolled state ---- */
function initNavState() {
  const nav = document.getElementById('nav'); if (!nav) return;
  const on = () => nav.classList.toggle('is-scrolled', window.scrollY > 40);
  on(); addEventListener('scroll', on, { passive: true });
}

/* ---- Nav: country dropdown (scale + fade from its origin, 0.2s) ---- */
function initRegionMenu() {
  const btn = document.querySelector('.btn-region'), menu = document.getElementById('region-menu'); if (!btn || !menu) return;
  const label = btn.querySelector('.region-label');
  const anim = (open) => {
    if (open) { menu.hidden = false; }
    if (!window.gsap || matchMedia('(prefers-reduced-motion: reduce)').matches) { menu.hidden = !open; return; }
    if (open) gsap.fromTo(menu, { opacity: 0, scale: .92 }, { opacity: 1, scale: 1, duration: .2, ease: 'power2.out', overwrite: true });
    else gsap.to(menu, { opacity: 0, scale: .94, duration: .15, ease: 'power2.out', overwrite: true, onComplete: () => { menu.hidden = true; } });
  };
  const set = (open) => { btn.setAttribute('aria-expanded', open); anim(open); };
  btn.addEventListener('click', (e) => { e.stopPropagation(); set(menu.hidden); });
  menu.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    menu.querySelectorAll('button').forEach((x) => x.setAttribute('aria-checked', x === b));
    label.textContent = b.textContent; set(false); btn.focus();
  });
  document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target)) set(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { set(false); btn.focus(); } });
}

/* ---- Nav: scroll-spy with a single underline that slides between links ---- */
function initScrollSpy(animated) {
  const links = [...document.querySelectorAll('.links a[data-spy]')], ind = document.querySelector('.link-ind');
  if (!links.length || !ind || !window.ScrollTrigger) return;
  const move = (link) => {
    if (!link) { gsap.to(ind, { scaleX: 0, duration: animated ? .3 : 0, ease: 'power2.inOut' }); return; }
    gsap.to(ind, { x: link.offsetLeft, scaleX: link.offsetWidth / 100, duration: animated ? .4 : 0, ease: 'power2.inOut' });
    links.forEach((l) => l.classList.toggle('is-active', l === link));
  };
  let current = null;
  [['about', '#about'], ['features', '#features'], ['pricing', '#pricing']].forEach(([key, sel]) => {
    const link = links.find((l) => l.dataset.spy === key), el = document.querySelector(sel);
    if (!link || !el) return;
    ScrollTrigger.create({ trigger: el, start: 'top 55%', end: 'bottom 55%', onToggle: (s) => {
      if (s.isActive) { current = link; move(link); }
      else if (current === link) { current = null; links.forEach((l) => l.classList.remove('is-active')); move(null); }
    } });
  });
  addEventListener('resize', () => { const a = links.find((l) => l.classList.contains('is-active')); if (a) gsap.set(ind, { x: a.offsetLeft, scaleX: a.offsetWidth / 100 }); });
}
