    (function(){
      // ---------- utilities ----------
      const $ = (sel, ctx=document) => ctx.querySelector(sel);
      const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));
      const clamp = (n,a,b)=> Math.max(a, Math.min(b,n));

      function toast(msg){
        const el = $('#toast');
        if(!el) return;
        el.textContent = msg;
        el.classList.add('show');
        window.clearTimeout(el._t);
        el._t = window.setTimeout(()=> el.classList.remove('show'), 2600);
      }

      function setSelectionPill(selector, count, required){
        const el = $(selector);
        if(!el) return;
        const next = Number.isFinite(Number(count)) ? Math.max(0, Number(count)) : 0;
        const prev = Number(el.dataset.count || '0');
        const target = Number(required);
        const hasTarget = Number.isFinite(target) && target > 0;
        const wasComplete = el.dataset.complete === 'true';
        const isComplete = hasTarget ? next >= target : next > 0;
        el.textContent = hasTarget ? `${next} of ${target} selected` : `${next} selected`;
        el.dataset.complete = isComplete ? 'true' : 'false';
        if(!wasComplete && isComplete){
          el.classList.remove('is-bump');
          void el.offsetWidth;
          el.classList.add('is-bump');
        }else if(!isComplete){
          el.classList.remove('is-bump');
        }
        el.dataset.count = String(next);
      }

      function prefersReducedMotion(){
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      }

      function replayMotionClass(el, className, durationMs=320){
        if(!el || !className || prefersReducedMotion()) return;
        el.classList.remove(className);
        void el.offsetWidth;
        el.classList.add(className);
        window.clearTimeout(el._motionTimer);
        el._motionTimer = window.setTimeout(()=> el.classList.remove(className), durationMs);
      }

      let outcomeTopObserver = null;
      let globalActionBtnsEl = null;

      function isElementInViewport(el, visibilityThreshold = 0.3){
        if(!el) return false;
        const rect = el.getBoundingClientRect();
        const vh = window.innerHeight || document.documentElement.clientHeight || 0;
        if(vh <= 0) return false;
        const visiblePx = Math.min(rect.bottom, vh) - Math.max(rect.top, 0);
        const requiredPx = Math.min(rect.height, vh) * visibilityThreshold;
        return visiblePx >= Math.max(24, requiredPx);
      }

      function animatePercentValue(el, target, durationMs = 620){
        if(!el || !Number.isFinite(target)) return;
        const goal = Math.max(0, Math.round(target));
        const startTs = performance.now();
        const tick = (now)=>{
          const t = Math.min(1, (now - startTs) / durationMs);
          const eased = 1 - Math.pow(1 - t, 3);
          el.textContent = `${Math.round(goal * eased)}%`;
          if(t < 1) window.requestAnimationFrame(tick);
        };
        el.textContent = '0%';
        window.requestAnimationFrame(tick);
      }

      function animateOutcomeTopPercentages(container){
        if(!container || container.dataset.pctAnimated === 'true' || prefersReducedMotion()) return;
        const pcts = $$('.outcomeTopPct', container);
        if(!pcts.length) return;
        container.dataset.pctAnimated = 'true';
        pcts.forEach((el, idx)=>{
          const target = Number(el.dataset.targetPct || el.textContent.replace(/[^\d.-]/g, ''));
          if(!Number.isFinite(target)) return;
          window.setTimeout(()=> animatePercentValue(el, target), idx * 90);
        });
      }

      function ensureOutcomeTopObserver(container){
        if(!container || prefersReducedMotion()) return;
        if(!('IntersectionObserver' in window)){
          if(isElementInViewport(container, 0.28)) animateOutcomeTopPercentages(container);
          return;
        }
        if(!outcomeTopObserver){
          outcomeTopObserver = new IntersectionObserver((entries)=>{
            entries.forEach((entry)=>{
              if(entry.isIntersecting) animateOutcomeTopPercentages(entry.target);
            });
          }, { threshold: [0.25, 0.45] });
        }
        if(container.dataset.pctObserved !== 'true'){
          outcomeTopObserver.observe(container);
          container.dataset.pctObserved = 'true';
        }
      }

      function animateDashboardCompletionRings(scope){
        if(!scope) return;
        const rings = $$('.dashCompletionRing[data-animate="true"]', scope);
        if(!rings.length) return;
        if(!(state.completionRingAnimatedIds instanceof Set)){
          state.completionRingAnimatedIds = new Set();
        }
        rings.forEach((ring, idx)=>{
          const target = clamp(Number(ring.dataset.targetPct) || 0, 0, 100);
          const ringId = String(ring.dataset.ringId || '').trim();
          const label = $('span', ring);
          if(prefersReducedMotion()){
            ring.style.setProperty('--pct', String(target));
            if(label) label.textContent = `${Math.round(target)}%`;
            ring.dataset.animate = 'false';
            if(ringId) state.completionRingAnimatedIds.add(ringId);
            return;
          }
          ring.style.setProperty('--pct', '0');
          if(label) label.textContent = '0%';
          window.setTimeout(()=>{
            ring.classList.add('is-animate');
            window.requestAnimationFrame(()=>{
              ring.style.setProperty('--pct', String(target));
            });
            if(label) animatePercentValue(label, target, 620);
            ring.dataset.animate = 'false';
            if(ringId) state.completionRingAnimatedIds.add(ringId);
          }, idx * 52);
        });
      }

      function tweenMetricText(el, target, formatter, opts){
        if(!el || typeof formatter !== 'function') return;
        const cfg = Object.assign({ duration: 340, formatSig: '' }, opts || {});
        const fmtSig = String(cfg.formatSig || '');
        const fmtChanged = (el.dataset.metricFmtSig || '') !== fmtSig;
        el.dataset.metricFmtSig = fmtSig;

        if(!Number.isFinite(target)){
          if(el._metricRaf) window.cancelAnimationFrame(el._metricRaf);
          el._metricRaf = 0;
          el._metricNow = NaN;
          el.textContent = formatter(target);
          return;
        }

        if(prefersReducedMotion()){
          el.textContent = formatter(target);
          el._metricNow = target;
          return;
        }

        const from = (!fmtChanged && Number.isFinite(el._metricNow)) ? el._metricNow : target;
        if(!fmtChanged && Math.abs(from - target) < 0.01){
          el.textContent = formatter(target);
          el._metricNow = target;
          return;
        }

        if(el._metricRaf) window.cancelAnimationFrame(el._metricRaf);
        const start = performance.now();
        const duration = Math.max(140, Number(cfg.duration) || 340);
        const token = Number(el.dataset.metricTweenToken || '0') + 1;
        el.dataset.metricTweenToken = String(token);

        const step = (now)=>{
          if(Number(el.dataset.metricTweenToken || '0') !== token) return;
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          const value = from + ((target - from) * eased);
          el._metricNow = value;
          el.textContent = formatter(value);
          if(t < 1){
            el._metricRaf = window.requestAnimationFrame(step);
          }else{
            el._metricRaf = 0;
            el._metricNow = target;
            el.textContent = formatter(target);
          }
        };

        el._metricRaf = window.requestAnimationFrame(step);
      }

      function isSnapshotValueSelector(sel){
        return typeof sel === 'string' && /^#snap[A-Z]/.test(sel);
      }

      let snapshotMotionReady = false;

      // ---------- currency ----------
      const state = {
        // business
        fullName: '',
        company: '',
        companySize: '',
        operatingCountry: '',
        role: '',

        // mandate
        evidence: new Set(),
        drivers: [],                 // max 3 (no ranking)
        milestone: '',
        pressureSources: [],         // max 3
        urgentWin: '',
        riskEnvs: [],                // max 2
        measuredOn: '',
        orgPain: '',
        outcomeDrilldowns: {},

        // coverage
        groups: new Set(),
        rhythm: '',
        measure: '',

        // package fit
        fitRealism: '',
        fitScope: '',
        fitToday: '',
        fitServices: '',
        fitRiskFrame: '',

        // context
        industry: '',
        region: '',
        regs: new Set(),
        regsTouched: false,
        regMode: 'suggested',     // suggested | all
        regModeTouched: false,
        regSearch: '',

        // tech stack
        stack: new Set(),
        stackOther: '',

        // value preview state (stored in USD internally)
        currency: 'USD',
        fx: { USD: 1, GBP: 0.80, EUR: 0.90 },

        revenueB: 10,                // USD billions (internal)
        investUSD: 250000,           // annual USD spend (internal)
        investManual: false,

        teamCyber: 200,
        teamDev: 1000,
        teamWf: 3000,
        teamManual: false,

        realization: 'conservative', // conservative | expected | immersive
        paybackDelayMonths: 3,

        cyberSalaryUSD: 180000,
        devSalaryUSD: 160000,

        // lead capture
        email: '',
        phone: '',
        notes: '',
        optin: false,

        // nav
        currentView: 'dashboard',
        activeThread: 'current',
        activeStep: 1,
        visited: new Set([1]),
        dashboardSelectedIds: new Set(),
        archivedSelectedIds: new Set(),
        starPulseQueue: new Set(),
        completionRingAnimatedIds: new Set(),
        dashboardRowAnimatedIds: new Set(),
        workspaceCompanyAnimatedIds: new Set(),
        interstitialAnimatedThreadIds: new Set(),
        navPreviewThreadId: null,
        consultationOpen: false,
        consultationThreadId: 'current',

        // record persistence
        savedThreads: [],
        savedThreadsLoaded: false,
        savePulseUntil: 0,
        saveIsThinking: false,
        autoSaveDueAt: 0
      };
      const THREAD_STORAGE_KEY = 'immersive.launchpad.savedThreads.v1';
      const WORKSPACE_PROFILE_KEY = 'immersive.launchpad.workspaceProfile.v1';
      const AUTO_SAVE_FAST_MS = 30000;
      const AUTO_SAVE_BASE_MS = 60000;
      let autoSaveTimerId = 0;
      let archivePromptMode = 'archive';
      let archivePromptIds = [];
      const DASHBOARD_COL_STORAGE_KEY = 'cfg_dashboard_col_widths_v1';
      const DASHBOARD_COLS = {
        company: { css:'--dash-col-company', min:12, max:34, fallback:17 },
        completion: { css:'--dash-col-completion', min:9, max:24, fallback:13 },
        tier: { css:'--dash-col-tier', min:8, max:18, fallback:10 },
        outcomes: { css:'--dash-col-outcomes', min:16, max:42, fallback:26 },
        gaps: { css:'--dash-col-gaps', min:12, max:34, fallback:15 },
        actions: { css:'--dash-col-actions', min:8, max:20, fallback:11 }
      };
      let dashboardColWidths = Object.create(null);

      function loadDashboardColWidths(){
        try{
          const raw = window.localStorage.getItem(DASHBOARD_COL_STORAGE_KEY);
          if(!raw) return {};
          const parsed = JSON.parse(raw);
          return (parsed && typeof parsed === 'object') ? parsed : {};
        }catch(err){
          return {};
        }
      }

      function persistDashboardColWidths(){
        try{
          window.localStorage.setItem(DASHBOARD_COL_STORAGE_KEY, JSON.stringify(dashboardColWidths || {}));
        }catch(err){
          // ignore storage failures
        }
      }

      function setDashboardColWidth(key, value, opts){
        const cfg = DASHBOARD_COLS[key];
        const table = $('#dashboardTable');
        if(!cfg || !table) return;
        const next = clamp(Number(value), cfg.min, cfg.max);
        const resolved = Number.isFinite(next) ? next : cfg.fallback;
        dashboardColWidths[key] = resolved;
        table.style.setProperty(cfg.css, `${resolved}%`);
        if(!opts || opts.persist !== false) persistDashboardColWidths();
      }

      function resetDashboardColumnWidths(opts){
        Object.keys(DASHBOARD_COLS).forEach((key)=>{
          setDashboardColWidth(key, DASHBOARD_COLS[key].fallback, { persist:false });
        });
        if(!opts || opts.persist !== false) persistDashboardColWidths();
      }

      function initDashboardColumnResizing(){
        const table = $('#dashboardTable');
        if(!table || table.dataset.colResizeReady === 'true') return;
        table.dataset.colResizeReady = 'true';

        const stored = loadDashboardColWidths();
        Object.keys(DASHBOARD_COLS).forEach((key)=>{
          const hasStored = Object.prototype.hasOwnProperty.call(stored, key);
          setDashboardColWidth(key, hasStored ? stored[key] : DASHBOARD_COLS[key].fallback, { persist:false });
        });

        let drag = null;
        const clearDragState = ()=>{
          if(drag && drag.th) drag.th.classList.remove('is-col-resizing');
          document.body.classList.remove('is-dash-col-resizing');
        };
        const onMove = (ev)=>{
          if(!drag) return;
          const deltaPct = ((ev.clientX - drag.startX) / drag.baseWidth) * 100;
          setDashboardColWidth(drag.key, drag.startWidth + deltaPct, { persist:false });
        };
        const onUp = ()=>{
          if(!drag) return;
          clearDragState();
          drag = null;
          persistDashboardColWidths();
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          window.removeEventListener('pointercancel', onUp);
        };

        $$('[data-dash-col-resize]', table).forEach((handle)=>{
          handle.addEventListener('dblclick', (ev)=>{
            const key = handle.getAttribute('data-dash-col-resize') || '';
            const cfg = DASHBOARD_COLS[key];
            if(!cfg) return;
            ev.preventDefault();
            setDashboardColWidth(key, cfg.fallback);
          });

          handle.addEventListener('pointerdown', (ev)=>{
            if(ev.button !== 0) return;
            const key = handle.getAttribute('data-dash-col-resize') || '';
            const cfg = DASHBOARD_COLS[key];
            if(!cfg) return;
            const th = handle.closest('th');
            drag = {
              key,
              startX: ev.clientX,
              startWidth: Number(dashboardColWidths[key]) || cfg.fallback,
              baseWidth: Math.max(1, table.getBoundingClientRect().width),
              th
            };
            document.body.classList.add('is-dash-col-resizing');
            if(th) th.classList.add('is-col-resizing');
            if(handle.setPointerCapture) handle.setPointerCapture(ev.pointerId);
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
            window.addEventListener('pointercancel', onUp);
            ev.preventDefault();
          });
        });
      }

      function fxRate(){
        const v = Number(state.fx[state.currency]);
        return (Number.isFinite(v) && v > 0) ? v : 1;
      }
      function toCur(usd){ return (Number(usd)||0) * fxRate(); }
      function fromCur(cur){ return (Number(cur)||0) / fxRate(); }

      function fmtMoneyUSD(usd){
        const curVal = toCur(usd);
        try{
          return curVal.toLocaleString(undefined, { style:'currency', currency: state.currency, maximumFractionDigits:0 });
        }catch(e){
          // fallback
          const sym = state.currency === 'GBP' ? '£' : state.currency === 'EUR' ? '€' : '$';
          return sym + Math.round(curVal).toLocaleString();
        }
      }

      function currencyPrefix(){
        if(state.currency === 'GBP') return '£';
        if(state.currency === 'EUR') return '€';
        if(state.currency === 'USD') return 'US$';
        return state.currency + ' ';
      }

      function roundToSigFigures(n, sig){
        const num = Number(n);
        if(!Number.isFinite(num) || num === 0) return 0;
        const s = Math.max(1, Number(sig) || 3);
        const power = Math.floor(Math.log10(Math.abs(num)));
        const factor = Math.pow(10, s - power - 1);
        return Math.round(num * factor) / factor;
      }

      function fmtMoneyCompactUSD(usd, opts){
        const cfg = Object.assign({ signed:false, sig:3 }, opts || {});
        const curVal = toCur(usd);
        if(!Number.isFinite(curVal)) return '—';

        const abs = Math.abs(curVal);
        const sign = curVal < 0 ? '-' : ((cfg.signed && curVal > 0) ? '+' : '');
        const prefix = currencyPrefix();

        if(abs < 1000){
          const whole = Math.round(abs);
          return `${sign}${prefix}${whole.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
        }

        const units = [
          { value: 1e9, suffix: 'b' },
          { value: 1e6, suffix: 'm' },
          { value: 1e3, suffix: 'k' }
        ];

        let unit = units.find(u => abs >= u.value) || units[units.length - 1];
        let scaled = abs / unit.value;
        let rounded = roundToSigFigures(scaled, cfg.sig);

        if(rounded >= 1000){
          const idx = units.indexOf(unit);
          if(idx > 0){
            unit = units[idx - 1];
            scaled = abs / unit.value;
            rounded = roundToSigFigures(scaled, cfg.sig);
          }
        }

        const decimals = rounded >= 100 ? 0 : (rounded >= 10 ? 1 : 2);
        const numTxt = rounded.toFixed(decimals).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
        return `${sign}${prefix}${numTxt}${unit.suffix}`;
      }

      function fmtRevenueFromUSDB(usdB){
        const curB = (Number(usdB)||0) * fxRate();
        const sym = (state.currency === 'GBP') ? '£' : (state.currency === 'EUR') ? '€' : '$';
        if(curB < 1){
          const m = Math.max(0, Math.round(curB * 1000));
          return `${sym}${m}M`;
        }
        if(curB >= 100) return `${sym}${Math.round(curB)}B`;
        const show1 = curB < 10 && (Math.round(curB*10)/10 !== Math.round(curB));
        return `${sym}${curB.toFixed(show1 ? 1 : 0).replace(/\.0$/,'')}B`;
      }

      function fmtNum(n){
        return (Number(n)||0).toLocaleString(undefined, { maximumFractionDigits:0 });
      }

      // ---------- options ----------
            const roleOpts = [
        { id:'ciso', label:'CISO' },
        { id:'secMgr', label:'Security Manager' },
        { id:'practitioner', label:'Practitioner' },
        { id:'executive', label:'Executive' },
        { id:'other', label:'Other' }
      ];

      const accountRoleOpts = [
        { id:'vp_sales', label:'VP Sales' },
        { id:'vp_customer_success', label:'VP, Customer Success' },
        { id:'director_regional_sales', label:'Director, Regional Sales' },
        { id:'senior_manager_customer_success', label:'Senior Manager, Customer Success' },
        { id:'senior_enterprise_account_manager', label:'Senior Enterprise Account Manager' },
        { id:'lead_customer_success_manager', label:'Lead Customer Success Manager' },
        { id:'enterprise_account_manager', label:'Enterprise Account Manager' },
        { id:'customer_success_manager', label:'Customer Success Manager' },
        { id:'senior_sales_development_representative', label:'Senior Sales Development Representative' },
        { id:'sales_development_representative', label:'Sales Development Representative' },
        { id:'senior_cyber_resilience_advisor', label:'Senior Cyber Resilience Advisor' },
        { id:'cyber_resilience_advisor', label:'Cyber Resilience Advisor' },
        { id:'associate_enterprise_account_manager', label:'Associate Enterprise Account Manager' },
        { id:'associate_customer_success_manager', label:'Associate Customer Success Manager' },
        { id:'associate_sales_development_representative', label:'Associate Sales Development Representative' },
        { id:'associate_cyber_resilience_advisor', label:'Associate Cyber Resilience Advisor' }
      ];
      const accountRoleLegacyMap = Object.freeze({
        cyber_resilience_advisor_senior_to_associate: 'cyber_resilience_advisor'
      });

const evidenceOpts = [
        { id:'board', label:'Board reporting' },
        { id:'reg', label:'Regulators / auditors' },
        { id:'insurer', label:'Insurers' },
        { id:'customer', label:'Customer due diligence' },
        { id:'internal', label:'Internal investment case' }
      ];

      const pressureOpts = [
        { id:'board', title:'Board', desc:'Board-level pressure for defensible readiness and decisions.' },
        { id:'regulator', title:'Regulator', desc:'Regulatory or audit expectations are driving urgency.' },
        { id:'insurer', title:'Insurer', desc:'Insurance evidence requirements are shaping priorities.' },
        { id:'customers', title:'Customers', desc:'Customer assurance and due diligence are forcing pace.' },
        { id:'internal', title:'Internal only', desc:'Pressure is internal, not yet externally driven.' }
      ];

      const urgentWinOpts = [
        { id:'boardEvidence', title:'Board-ready evidence & benchmarks', desc:'Translate readiness into board-defensible proof and clear benchmark position.' },
        { id:'fasterDecisions', title:'Faster detection/response decisions', desc:'Improve MTTD/MTTR and crisis decision quality under pressure.' },
        { id:'attackSurface', title:'Shrink attack surface & remediation time', desc:'Cut exploitable risk in code, cloud, identity, and network faster.' },
        { id:'safeAI', title:'Safe AI adoption & governance', desc:'Adopt AI with tested controls, clear guardrails, and accountable governance.' },
        { id:'workforce', title:'Workforce readiness & retention', desc:'Increase role readiness, accelerate onboarding, and retain key talent.' },
        { id:'thirdParty', title:'Third-party resilience', desc:'Improve supplier resilience and vendor incident containment confidence.' }
      ];

      const riskEnvOpts = [
        { id:'code', title:'Code', desc:'Application and SDLC risk is driving urgency.' },
        { id:'cloud', title:'Cloud', desc:'Cloud exposure and misconfiguration are core concerns.' },
        { id:'identity', title:'Identity', desc:'Credential abuse and IAM weaknesses are driving risk.' },
        { id:'ot', title:'OT', desc:'Operational technology / ICS risk needs coverage.' },
        { id:'enterpriseApps', title:'Enterprise apps', desc:'Business-critical app estate is increasing risk.' },
        { id:'socir', title:'Mostly SOC / IR', desc:'The pressure is mainly in detection, response, and coordination.' }
      ];

      const measuredOnOpts = [
        { id:'mttd', title:'MTTD / MTTR', desc:'Speed to detect, escalate, and contain is tracked.' },
        { id:'audit', title:'Audit evidence', desc:'Readiness proof and governance evidence are key measures.' },
        { id:'vuln', title:'Vulnerability backlog', desc:'Backlog, fix velocity, and closure cadence are central metrics.' },
        { id:'training', title:'Training completion', desc:'Readiness is mostly tracked as completion today.' },
        { id:'notMeasured', title:'Not measured well', desc:'Metrics are fragmented or not trusted by stakeholders.' }
      ];

      const orgPainOpts = [
        { id:'skillsCoverage', title:'Skills coverage & onboarding', desc:'Readiness gaps and onboarding speed are hurting execution.' },
        { id:'coordination', title:'Cross-team coordination', desc:'Decision and response handoffs break down under pressure.' },
        { id:'externalProof', title:'Proving to external stakeholders', desc:'Board/regulator/insurer/customer evidence is hard to package.' },
        { id:'vendorRisk', title:'Vendor risk', desc:'Third-party dependency and resilience are primary pain points.' },
        { id:'aiRisk', title:'AI risk', desc:'AI adoption risk exists without clear controls and governance.' }
      ];

      const driverOpts = [
        {
          id:'nearMiss',
          title:'After an incident / near miss',
          desc:'You want to test and harden decision-making and response.',
          maps:'Typically relates to: Faster Decisions + Secure Enterprise'
        },
        {
          id:'sectorPeer',
          title:'Sector peer incident / competitor hit',
          desc:'A peer was hit and it could have been you — you want to harden readiness before it happens.',
          maps:'Typically relates to: Faster Decisions + Supply Chain'
        },
        {
          id:'skills',
          title:'Skills gap / capability build',
          desc:'You need measurable improvement across teams.',
          maps:'Typically relates to: Cyber Workforce + Secure Enterprise'
        },
        {
          id:'insurance',
          title:'Insurance renewal',
          desc:'You need proof and a credible plan for underwriters.',
          maps:'Typically relates to: Compliance Evidence + Supply Chain'
        },
        {
          id:'change',
          title:'New tech adoption / transformation',
          desc:'Cloud, app modernization, or tooling change is increasing risk.',
          maps:'Typically relates to: Secure Enterprise + Secure AI'
        }
      ];

      const milestoneOpts = [
        { id:'baseline', title:'Baseline + visibility', desc:'Establish a defensible starting point and identify priority gaps.' },
        { id:'operational', title:'Operational improvement rhythm', desc:'Create a cadence to improve response performance over time.' },
        { id:'evidence', title:'Evidence + governance', desc:'Build stakeholder-grade evidence and repeatable reporting.' },
        { id:'explore', title:'Exploring', desc:'You want a direction, a roadmap, and examples.' }
      ];

      const groupOpts = [
        { id:'soc', label:'SOC / Incident Response' },
        { id:'appsec', label:'AppSec / Developers' },
        { id:'cloud', label:'Cloud security' },
        { id:'itops', label:'IT ops / infrastructure' },
        { id:'identity', label:'Identity & access (IAM)' },
        { id:'grc', label:'GRC / compliance' },
        { id:'data', label:'Data / privacy' },
        { id:'product', label:'Product / platform security' },
        { id:'exec', label:'Executive Crisis Team (CMT)' },
        { id:'workforce', label:'Wider workforce' },
        { id:'third', label:'Third-party / supplier readiness' }
      ];

      const rhythmOpts = [
        { id:'adhoc', title:'Ad hoc', desc:'Infrequent / event-driven exercises.' },
        { id:'quarterly', title:'Quarterly', desc:'Some structure, limited cadence.' },
        { id:'monthly', title:'Monthly', desc:'Higher cadence, increasing realism.' },
        { id:'program', title:'Programmatic', desc:'Continuous rhythm + governance + reporting.' }
      ];

      const measureOpts = [
        { id:'completion', title:'Completion-centric', desc:'Primarily tracking training completion.' },
        { id:'performance', title:'Performance-centric', desc:'Measuring outcomes under pressure (speed, accuracy, decisions).' }
      ];

      const primaryOutcomeOpts = [
        {
          id:'fasterResponse',
          label:'Prove Faster Detection, Response & Decision-Making',
          short:'Faster detection, response & decision-making',
          oneLiner:'Cut MTTD/MTTR and make better business decisions under pressure.',
          why:'Breach impact is time plus decision quality. Board scrutiny is highest here.',
          desc:'Cut MTTD/MTTR and make better business decisions under pressure.',
          kpis:'MTTD, MTTR, time-to-escalate, decision latency, playbook execution quality'
        },
        {
          id:'secureEnterprise',
          label:'Secure the Next-Gen Modern Enterprise',
          short:'Secure the next-gen modern enterprise',
          oneLiner:'Shrink attack surface and cut remediation time across code, cloud, identity, and network.',
          why:'Fewer exploitable issues means fewer incidents. Remediation speed is board-visible.',
          desc:'Shrink attack surface and cut remediation time across code, cloud, identity, and network.',
          kpis:'Critical vulnerability MTTR, misconfiguration closure time, exploitability trend'
        },
        {
          id:'secureAI',
          label:'Enable Secure AI Adoption, Innovation & Governance',
          short:'Enable secure AI adoption and governance',
          oneLiner:'Adopt AI and build it safely with trained people, tested controls, and governed operations.',
          why:'AI is a board agenda item. Risk and innovation must be balanced with proof.',
          desc:'Adopt AI and build it safely with trained people, tested controls, and governed operations.',
          kpis:'AI incident playbook readiness, AI control test pass rate, AI governance adherence'
        },
        {
          id:'complianceEvidence',
          label:'Transform Compliance into Evidence & Benchmarks',
          short:'Compliance translated into evidence & benchmarks',
          oneLiner:'Move from checkbox compliance to evidence-based capability mapped to NIST, MITRE, and DORA.',
          why:'Boards and regulators require auditable proof mapped to recognized frameworks.',
          desc:'Move from checkbox compliance to evidence-based capability mapped to NIST, MITRE, and DORA.',
          kpis:'Framework control coverage, resilience score deltas, peer benchmark percentile'
        },
        {
          id:'cyberWorkforce',
          label:'Build & Retain a Verifiable Cyber-Ready Workforce',
          short:'Build and retain a cyber-ready workforce',
          oneLiner:'Accelerate onboarding, upskill continuously, and retain talent with visible progression.',
          why:'Talent shortage persists; readiness must be measurable across the organization.',
          desc:'Accelerate onboarding, upskill continuously, and retain talent with visible progression.',
          kpis:'Role readiness scores, proficiency coverage, retention and progression trend'
        },
        {
          id:'supplyChain',
          label:'Enhance Supply Chain and Third-Party Cyber Resilience',
          short:'Strengthen supply-chain and third-party resilience',
          oneLiner:'Elevate supply-chain resilience with third-party simulations and benchmarking.',
          why:'Vendor breaches are systemic risk and regulators increasingly ask for proof.',
          desc:'Elevate supply-chain resilience with third-party simulations and benchmarking.',
          kpis:'Time to detect vendor-origin incidents, containment success rate, supplier segment resilience'
        }
      ];

      const outcomeDrilldownBank = {
        fasterResponse: {
          prompt:'What’s missing most today?',
          options: [
            { id:'speed', title:'Speed (MTTD/MTTR)', desc:'Detection and containment speed is the biggest gap.' },
            { id:'coordination', title:'Cross-team coordination', desc:'Handoffs and decisions slow down response quality.' },
            { id:'boardReporting', title:'Board-ready reporting', desc:'Performance data is hard to translate for leadership.' }
          ]
        },
        secureEnterprise: {
          prompt:'Where is the backlog?',
          options: [
            { id:'cloudIdentity', title:'Cloud misconfig & identity', desc:'Cloud and IAM hygiene are the primary risk drivers.' },
            { id:'appsec', title:'AppSec / SDLC', desc:'Code and release pipeline exposure are creating delay and risk.' },
            { id:'ot', title:'OT exposure / segmentation', desc:'OT visibility and segmentation need stronger resilience.' }
          ]
        },
        secureAI: {
          prompt:'What’s the AI reality?',
          options: [
            { id:'prod', title:'Already deploying AI in production', desc:'Controls need to catch up with active deployment.' },
            { id:'pilot', title:'Piloting / exploring', desc:'Early AI use cases exist and guardrails are emerging.' },
            { id:'guardrails', title:'Need governance and guardrails first', desc:'Policy and risk frameworks must be set before scale.' }
          ]
        },
        complianceEvidence: {
          prompt:'What kind of proof is required?',
          options: [
            { id:'audit', title:'Internal audit readiness', desc:'Audit evidence quality is a near-term requirement.' },
            { id:'regInsurer', title:'Regulator / insurer defensible evidence', desc:'External validation drives urgency.' },
            { id:'benchmark', title:'Peer benchmarks / board narrative', desc:'Leadership needs comparison and narrative clarity.' }
          ]
        },
        cyberWorkforce: {
          prompt:'What’s the workforce pain?',
          options: [
            { id:'onboarding', title:'Onboarding speed', desc:'Time-to-readiness for new hires is too slow.' },
            { id:'visibility', title:'Skills visibility / analytics', desc:'Current capability data is incomplete or stale.' },
            { id:'retention', title:'Retention / progression', desc:'Retaining and growing key talent is the bottleneck.' }
          ]
        },
        supplyChain: {
          prompt:'What’s driving third-party focus?',
          options: [
            { id:'incidents', title:'Vendor incidents', desc:'Recent events or near-misses raised urgency.' },
            { id:'regs', title:'New regulations / contractual obligations', desc:'External obligations now demand stronger proof.' },
            { id:'critical', title:'Critical suppliers / OT ecosystem', desc:'Supplier dependency and OT exposure require resilience testing.' }
          ]
        }
      };

      // Package fit questions (mirrors master configurator fit signals)
      const fitRealismOpts = [
        { id:'generic', title:'Best-practice / generic scenarios are fine', desc:'Value quickly without mirroring the exact environment.', scores:{ core:4, adv:2, ult:0 } },
        { id:'tooling', title:'Needs to reflect our tooling and processes', desc:'Bring your own tooling and dynamic realism matters.', scores:{ core:1, adv:5, ult:2 } },
        { id:'bespoke', title:'Must mirror our environment and threat landscape', desc:'They will not trust results unless it matches their reality.', scores:{ core:0, adv:2, ult:6 } }
      ];

      const fitScopeOpts = [
        { id:'single', title:'Single team / single function', desc:'Contained rollout focused on one benefitting group.', scores:{ core:4, adv:2, ult:0 } },
        { id:'multi', title:'Multiple teams within a function', desc:'Needs coordination across squads or sub-teams.', scores:{ core:1, adv:5, ult:2 } },
        { id:'enterprise', title:'Enterprise / multi-region / exec plus technical', desc:'Coverage expands across functions, regions, and leaders.', scores:{ core:0, adv:3, ult:5 } }
      ];

      const fitTodayOpts = [
        { id:'training', title:'Mainly training completion today', desc:'They lack proof of capability and want to escape checkbox learning.', scores:{ core:5, adv:1, ult:0 } },
        { id:'adhoc', title:'Exercises exist, but they are ad hoc and do not close gaps', desc:'They want a loop that drives improvement.', scores:{ core:1, adv:5, ult:1 } },
        { id:'scrutiny', title:'Already under scrutiny (audits, board, regulators)', desc:'They need a repeatable evidence layer.', scores:{ core:0, adv:2, ult:6 } }
      ];

      const fitServicesOpts = [
        { id:'diy', title:'Self-serve / light enablement', desc:'They can run most of it internally with minimal support.', scores:{ core:4, adv:2, ult:0 } },
        { id:'guided', title:'Guided program support', desc:'Help building cadence and linking outcomes to improvement.', scores:{ core:1, adv:5, ult:2 } },
        { id:'whiteglove', title:'Dedicated program team + evidence packaging + bespoke realism', desc:'Managed partnership for custom realism, facilitation, and evidence delivery.', scores:{ core:0, adv:2, ult:6 } }
      ];

      const fitRiskFrameOpts = [
        { id:'skills', title:'We need stronger skills', desc:'They frame the issue as practitioner proficiency.', scores:{ core:4, adv:2, ult:0 } },
        { id:'readiness', title:'We need better response outcomes and coordination', desc:'They care about speed, accuracy, and teamwork under pressure.', scores:{ core:1, adv:5, ult:2 } },
        { id:'governance', title:'We need proof for governance', desc:'They talk in board and regulatory evidence terms.', scores:{ core:0, adv:2, ult:6 } }
      ];

      const fitSnapLabels = {
        fitRealism: { generic:'Generic', tooling:'Tooling-aware', bespoke:'Mirror environment' },
        fitScope: { single:'Single team', multi:'Multi-team', enterprise:'Enterprise' },
        fitToday: { training:'Training completion', adhoc:'Ad hoc exercises', scrutiny:'Under scrutiny' },
        fitServices: { diy:'Self-serve', guided:'Guided support', whiteglove:'Managed partnership' },
        fitRiskFrame: { skills:'Skills', readiness:'Readiness outcomes', governance:'Governance proof' }
      };

      // ---------------- Regulations library (enriched) ----------------
      // Note: This is a usability-oriented library for tailoring onboarding language.
      // It is not legal advice and not an exhaustive compliance checklist.
      const regMaster = [
        /* Global standards & frameworks */
        { id:'iso27001', label:'ISO/IEC 27001' },
        { id:'iso27002', label:'ISO/IEC 27002' },
        { id:'iso27005', label:'ISO/IEC 27005 (risk)' },
        { id:'iso27017', label:'ISO/IEC 27017 (cloud security)' },
        { id:'iso27018', label:'ISO/IEC 27018 (cloud privacy)' },
        { id:'iso27035', label:'ISO/IEC 27035 (incident management)' },
        { id:'iso27701', label:'ISO/IEC 27701 (privacy)' },
        { id:'iso22301', label:'ISO 22301 (business continuity)' },
        { id:'iso31000', label:'ISO 31000 (risk management)' },
        { id:'iso42001', label:'ISO/IEC 42001 (AI management)' },

        { id:'nistscf', label:'NIST CSF' },
        { id:'nist80053', label:'NIST SP 800-53' },
        { id:'nist800171', label:'NIST SP 800-171' },
        { id:'nist80061', label:'NIST SP 800-61 (incident response)' },
        { id:'nist800218', label:'NIST SP 800-218 (SSDF)' },
        { id:'nist800207', label:'NIST SP 800-207 (Zero Trust)' },
        { id:'nist800161', label:'NIST SP 800-161 (supply chain)' },
        { id:'nistairmf', label:'NIST AI RMF' },

        { id:'ciscontrols', label:'CIS Controls v8' },
        { id:'cobit', label:'COBIT (governance)' },

        { id:'soc2', label:'SOC 2' },
        { id:'soc1', label:'SOC 1 / ISAE 3402' },
        { id:'pcidss', label:'PCI DSS' },
        { id:'csastar', label:'CSA STAR' },

        { id:'mitreattack', label:'MITRE ATT&CK (mapping)' },
        { id:'owasptop10', label:'OWASP Top 10 (mapping)' },

        /* EU + UK (cyber, privacy, resilience) */
        { id:'dora', label:'DORA' },
        { id:'nis2', label:'NIS2' },
        { id:'gdpr', label:'GDPR' },
        { id:'cer', label:'EU CER Directive (Critical Entities Resilience)' },
        { id:'euaiact', label:'EU AI Act' },
        { id:'ebaict', label:'EBA ICT & security risk guidelines' },

        { id:'ukgdpr', label:'UK GDPR / Data Protection Act 2018' },
        { id:'uknis', label:'UK NIS Regulations' },
        { id:'ukfca', label:'UK FCA/PRA Operational Resilience' },
        { id:'cyberessentials', label:'UK Cyber Essentials' },
        { id:'caf', label:'NCSC CAF (Cyber Assessment Framework)' },
        { id:'cafEnhanced', label:'NCSC CAF Enhanced' },
        { id:'ofcom', label:'Ofcom security & resilience requirements (UK telecoms)' },
        { id:'ofgem', label:'Ofgem cyber & operational resilience requirements (UK energy)' },

        /* North America (US + Canada) */
        { id:'sec', label:'SEC cybersecurity disclosure (US)' },
        { id:'nydfs', label:'NYDFS 23 NYCRR 500' },
        { id:'sox', label:'SOX (Sarbanes‑Oxley)' },

        { id:'hipaa', label:'HIPAA (US)' },
        { id:'hitech', label:'HITECH (US)' },
        { id:'glba', label:'GLBA (US)' },
        { id:'ftcsafeguards', label:'FTC Safeguards Rule (US)' },
        { id:'ccpa', label:'CCPA/CPRA (California)' },
        { id:'ferpa', label:'FERPA (US education)' },

        { id:'fedramp', label:'FedRAMP (US)' },
        { id:'fisma', label:'FISMA (US)' },
        { id:'cmmc', label:'CMMC (US DoD contractors)' },
        { id:'dfars7012', label:'DFARS 252.204‑7012 (US DoD)' },
        { id:'cjiss', label:'CJIS Security Policy (US)' },

        { id:'pipeda', label:'PIPEDA (Canada)' },
        { id:'osfiB13', label:'OSFI B‑13 (Canada)' },

        /* APAC */
        { id:'apra234', label:'APRA CPS 234 (Australia)' },
        { id:'sociact', label:'SOCI Act (Australia)' },
        { id:'essential8', label:'ASD Essential Eight (Australia)' },
        { id:'privacyau', label:'Privacy Act 1988 (Australia)' },

        { id:'mastrm', label:'MAS TRM (Singapore)' },
        { id:'pdpasg', label:'PDPA (Singapore)' },

        { id:'hkmaCraf', label:'HKMA C‑RAF (Hong Kong)' },
        { id:'japanFisc', label:'FISC Security Guidelines (Japan)' },
        { id:'nzism', label:'NZISM (New Zealand)' },

        { id:'indiaDpdp', label:'DPDP Act (India)' },
        { id:'certin', label:'CERT‑In Directions (India)' },

        { id:'pipl', label:'PIPL (China)' },

        /* LATAM + Africa (privacy) */
        { id:'lgpd', label:'LGPD (Brazil)' },
        { id:'popia', label:'POPIA (South Africa)' },

        /* Sector / critical infrastructure / OT */
        { id:'swiftcscf', label:'SWIFT CSCF' },
        { id:'ffiec', label:'FFIEC (US) cyber guidance' },
        { id:'hitrust', label:'HITRUST CSF' },

        { id:'iec62443', label:'IEC 62443 (OT/IACS)' },
        { id:'nercCip', label:'NERC CIP (North America)' },

        /* Automotive / product security */
        { id:'tisax', label:'TISAX (automotive)' },
        { id:'iso21434', label:'ISO/SAE 21434 (vehicle cybersecurity)' },
        { id:'uneceR155', label:'UNECE R155 (vehicle cybersecurity)' },
        { id:'uneceR156', label:'UNECE R156 (software updates)' }
      ];

      const frameworkRegIds = new Set([
        'iso27001','iso27002','iso27005','iso27017','iso27018','iso27035','iso27701','iso22301','iso31000','iso42001',
        'nistscf','nist80053','nist800171','nist80061','nist800218','nist800207','nist800161','nistairmf',
        'ciscontrols','cobit','mitreattack','owasptop10','caf','cafEnhanced','essential8','ffiec'
      ]);
      const assuranceRegIds = new Set([
        'soc2','soc1','pcidss','csastar','cyberessentials','hitrust','fedramp','tisax','swiftcscf'
      ]);

      function regulationType(id){
        if(frameworkRegIds.has(id)) return 'Framework';
        if(assuranceRegIds.has(id)) return 'Assurance';
        return 'Regulation';
      }

      const commonProofSetIds = [
        'nistscf',
        'iso27001',
        'mitreattack',
        'dora',
        'sec',
        'soc2'
      ];

      const regByIndustry = {
        "Financial Services": ['dora','ebaict','gdpr','nistscf','ciscontrols','iso27001','soc2','pcidss','sec','nydfs','glba','sox','swiftcscf','ffiec'],
        "Banking": ['dora','ebaict','gdpr','nistscf','ciscontrols','iso27001','soc2','pcidss','sec','nydfs','glba','sox','swiftcscf','ffiec'],
        "Insurance": ['dora','ebaict','gdpr','nistscf','ciscontrols','iso27001','soc2','sec','nydfs','glba','sox','swiftcscf'],
        "Payments / FinTech": ['pcidss','soc2','iso27001','nistscf','ciscontrols','sec','nydfs','gdpr','ccpa'],
        "Healthcare / Life Sciences": ['hipaa','hitech','hitrust','gdpr','iso27701','iso27001','nistscf','ciscontrols'],
        "Retail / eCommerce": ['pcidss','soc2','iso27001','nistscf','ciscontrols','gdpr','ccpa'],
        "Technology / SaaS": ['soc2','iso27001','nistscf','ciscontrols','sec','gdpr','ccpa','nist800218','owasptop10'],
        "Telecommunications": ['nis2','uknis','gdpr','iso27001','nistscf','ciscontrols','caf','cafEnhanced','ofcom'],
        "Government / Public Sector": ['nist80053','fisma','fedramp','iso27001','nistscf','ciscontrols'],
        "Defense / Aerospace": ['cmmc','dfars7012','nist800171','iso27001','nistscf','ciscontrols'],
        "Energy / Utilities": ['nercCip','iec62443','nis2','gdpr','iso27001','nistscf','ciscontrols','caf','cafEnhanced','ofgem'],
        "Manufacturing / Industrial": ['iec62443','tisax','iso21434','uneceR155','uneceR156','iso27001','nistscf','ciscontrols'],
        "Transportation / Logistics": ['nis2','cer','gdpr','iso27001','nistscf','ciscontrols'],
        "Education": ['ferpa','gdpr','ccpa','iso27001','nistscf','ciscontrols'],
        "Managed Services (MSP/MSSP)": ['soc2','iso27001','nistscf','ciscontrols','gdpr','dora'],
        "Professional Services": ['soc2','iso27001','nistscf','ciscontrols','gdpr','dora'],
        "Other": [] // "Other" defaults to the full library via view mode
      };

      // Region-aware *suggestions* (not hard gating).
      // We avoid auto-suggesting blatantly out-of-region items (e.g., HIPAA for EU),
      // but users can still choose anything from the full library if they operate globally.
      const regByRegion = {
        NA:   ['nistscf','ciscontrols','iso27001','soc2','soc1','pcidss','gdpr','sec','nydfs','sox','hipaa','hitech','glba','ftcsafeguards','ccpa','fedramp','fisma','cmmc','dfars7012','cjiss','pipeda','osfiB13','nercCip','iec62443'],
        UKI:  ['iso27001','nistscf','ciscontrols','soc2','pcidss','ukgdpr','uknis','ukfca','cyberessentials','gdpr','dora','caf','cafEnhanced','ofcom','ofgem','iec62443'],
        EU:   ['iso27001','nistscf','ciscontrols','soc2','pcidss','dora','nis2','gdpr','cer','euaiact','ebaict','iec62443','tisax','iso21434','uneceR155','uneceR156'],
        APAC: ['iso27001','nistscf','ciscontrols','soc2','pcidss','gdpr','apra234','sociact','essential8','privacyau','mastrm','pdpasg','hkmaCraf','japanFisc','nzism','indiaDpdp','certin','pipl','iec62443'],
        Other: [] // Other / Global shows the full library
      };

      // Region-level "core" suggestions used to avoid sector leakage when both
      // industry and region are provided (e.g., automotive rules in EU finance).
      const regByRegionCore = {
        NA:   ['iso27001','nistscf','ciscontrols','soc2','soc1','pcidss','ccpa','pipeda'],
        UKI:  ['iso27001','nistscf','ciscontrols','soc2','pcidss','ukgdpr','gdpr','cyberessentials'],
        EU:   ['iso27001','nistscf','ciscontrols','soc2','pcidss','gdpr','nis2'],
        APAC: ['iso27001','nistscf','ciscontrols','soc2','pcidss'],
        Other: []
      };

      const uniq = (arr)=> Array.from(new Set((arr||[]).filter(Boolean)));

      function regSuggestedIds(industry, region){
        const base = ['iso27001','nistscf','ciscontrols'];

        const ind = industry ? (regByIndustry[industry] || []) : [];
        const reg = region ? (regByRegion[region] || []) : [];
        const regCore = region ? (regByRegionCore[region] || []) : [];

        let out = [...base];

        if(industry && region){
          // Bias suggestions toward true overlap between sector and region.
          // Region "core" keeps a small compliance baseline.
          const inter = ind.filter(id => reg.includes(id));
          out = uniq([...base, ...inter, ...regCore]);
        }else if(industry){
          out = uniq([...base, ...ind]);
        }else if(region){
          out = uniq([...base, ...regCore]);
        }

        // Extra nudge for common patterns
        if(industry && industry.includes('Technology')) out = uniq([...out, 'nist800218']);
        if(industry && industry.includes('Financial')) out = uniq([...out, 'swiftcscf']);
        if(industry && industry.includes('Healthcare')) out = uniq([...out, 'iso27701']);

        // Region-aware filtering: keep “suggested” relevant to the chosen footprint
        if(region && region !== 'Other'){
          const allow = new Set(uniq([...base, ...(regByRegion[region] || [])]));
          out = out.filter(id => allow.has(id));
        }

        return out;
      }

      function regOptionsForUI(){
        const search = (state.regSearch || '').trim().toLowerCase();

        const forceAll = (state.industry === 'Other' || state.region === 'Other');
        const allMode = forceAll || state.regMode === 'all';

        // Base ids: suggested (rich) OR full library (A–Z)
        let ids = [];
        if(allMode){
          ids = regMaster.map(r => r.id);
        }else{
          const suggested = regSuggestedIds(state.industry, state.region);
          // Keep suggested list rich, but avoid turning the step into a wall of pills.
          // (Users can switch to “All” for the full library.)
          const MAX_SUGGESTED = 22;
          ids = suggested.slice(0, MAX_SUGGESTED);
        }

        // Always keep selected visible
        const selected = Array.from(state.regs || []);
        ids = uniq([...ids, ...selected]);

        let items = ids
          .map(id => regMaster.find(r => r.id === id))
          .filter(Boolean);

        if(search){
          items = items.filter(it => {
            // Keep selected regs visible even while searching
            if(state.regs && state.regs.has(it.id)) return true;
            const hay = (it.label || '').toLowerCase();
            const hayId = (it.id || '').toLowerCase();
            return hay.includes(search) || hayId.includes(search);
          });
        }

        if(allMode){
          items.sort((a,b)=> (a.label||'').localeCompare(b.label||''));
        }

        return items.map(it => Object.assign({}, it, { typeTag: regulationType(it.id) }));
      }

      function syncContextRegSignals(){
        const ctxChanged = !!(state._industryChanged || state._regionChanged);
        if(!ctxChanged) return;

        state._industryChanged = false;
        state._regionChanged = false;

        // "Other / Global" should default to the full library (unless the user explicitly chose a mode)
        if(!state.regModeTouched){
          state.regMode = (state.industry === 'Other' || state.region === 'Other') ? 'all' : 'suggested';
        }

        // Keep recommendations visible in Suggested mode, but require explicit user selection.
        if(!state.regsTouched){
          state.regs.clear();
        }
      }

      function syncRegModeUI(){
        const forceAll = (state.industry === 'Other' || state.region === 'Other');
        const mode = forceAll ? 'all' : state.regMode;
        const regionLabels = { NA:'North America', UKI:'UK & Ireland', EU:'Europe (EU)', APAC:'APAC', Other:'Other / Global' };

        // Segmented control state
        const seg = $('#regMode');
        if(seg){
          seg.querySelectorAll('.segBtn').forEach(btn=>{
            const m = btn.dataset.mode;
            const active = (m === mode);
            btn.dataset.active = active ? 'true' : 'false';
            btn.setAttribute('aria-selected', active ? 'true' : 'false');
          });
        }

        // Hint copy (tiny nudge)
        const hint = $('#regModeHint');
        if(hint){
          if(forceAll){
            hint.textContent = '“Other / Global” shows the full library. Use search to find specific regs (nothing is auto-selected).';
          }else{
            hint.textContent = 'Suggested list is tailored by industry and region. “All” shows the full library A–Z. Tags show Regulation / Framework / Assurance.';
          }
        }

        const suggestedFor = $('#regSuggestedFor');
        if(suggestedFor){
          const bits = [];
          if(state.industry) bits.push(state.industry);
          if(state.region) bits.push(regionLabels[state.region] || state.region);
          suggestedFor.textContent = bits.length
            ? `Suggested for: ${bits.join(' · ')}`
            : 'Suggested for: your selected context';
        }
      }

      function applyCommonProofSet(){
        const available = new Set(regMaster.map(r => r.id));
        commonProofSetIds.forEach(id=>{
          if(available.has(id)) state.regs.add(id);
        });
        state.regsTouched = true;
      }

      // Tech stack pick-list (expanded but still digestible)
      const stackSocOpts = [
        { id:'crowdstrike', label:'CrowdStrike Falcon®' },
        { id:'falconxdr', label:'Falcon Insight XDR' },
        { id:'falconsiem', label:'Falcon Next‑Gen SIEM' },
        { id:'sentinelone', label:'SentinelOne Singularity' },
        { id:'defender', label:'Microsoft Defender' },
        { id:'sentinel', label:'Microsoft Sentinel' },
        { id:'splunk', label:'Splunk' },
        { id:'qradar', label:'IBM QRadar' },
        { id:'elastic', label:'Elastic' },
        { id:'sumologic', label:'Sumo Logic' },
        { id:'exabeam', label:'Exabeam' },
        { id:'logrhythm', label:'LogRhythm' },
        { id:'rapid7', label:'Rapid7 InsightIDR' },
        { id:'cortexxdr', label:'Palo Alto Cortex XDR' },
        { id:'cortexxsoar', label:'Palo Alto Cortex XSOAR' },
        { id:'googlesecops', label:'Google Security Operations' }
      ];

      const stackCloudOpts = [
        { id:'aws', label:'Amazon Web Services (AWS)' },
        { id:'azure', label:'Microsoft Azure' },
        { id:'gcp', label:'Google Cloud Platform (GCP)' },
        { id:'awsGuardduty', label:'AWS GuardDuty / Security Hub' },
        { id:'azureDefenderCloud', label:'Defender for Cloud (Azure)' },
        { id:'gcpScc', label:'Security Command Center (GCP)' }
      ];

      const stackDevopsOpts = [
        { id:'kubernetes', label:'Kubernetes' },
        { id:'docker', label:'Docker' },
        { id:'terraform', label:'Terraform' },
        { id:'github', label:'GitHub' },
        { id:'gitlab', label:'GitLab' },
        { id:'azuredevops', label:'Azure DevOps' },
        { id:'jenkins', label:'Jenkins' },
        { id:'nginx', label:'NGINX' },
        { id:'vault', label:'Vault' }
      ];

      const stackDomainOpts = [
        { id:'appsec', label:'Application Security / OWASP' },
        { id:'identity', label:'Identity & access (Okta / Entra ID)' },
        { id:'grc', label:'GRC / risk (ServiceNow / Archer)' },
        { id:'vuln', label:'Vulnerability mgmt (Tenable / Qualys)' },
        { id:'email', label:'Email security (Proofpoint / MDO)' },
        { id:'network', label:'Network security (Palo Alto / Fortinet)' },
        { id:'ot', label:'OT/ICS' },
        { id:'ai', label:'AI security' },
        { id:'threat', label:'Threat intel & malware' },
        { id:'range', label:'Cyber range & workforce drills' }
      ];

      const stackMaster = [
        ...stackSocOpts,
        ...stackCloudOpts,
        ...stackDevopsOpts,
        ...stackDomainOpts
      ];

      // ---------- DOM render ----------
      function renderOptionButtons(container, items, setRef, onChange){
        if(!container) return;
        container.innerHTML = '';
        items.forEach(it=>{
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'opt';
          if(it.typeTag){
            b.classList.add('optReg');
            b.innerHTML = `<span>${escapeHtml(it.label)}</span><span class="regType">${escapeHtml(it.typeTag)}</span>`;
          }else{
            b.textContent = it.label;
          }
          b.setAttribute('data-id', it.id);
          b.setAttribute('aria-pressed', setRef.has(it.id) ? 'true' : 'false');
          b.addEventListener('click', ()=>{
            const id = it.id;
            if(setRef.has(id)){ setRef.delete(id); b.setAttribute('aria-pressed','false'); }
            else { setRef.add(id); b.setAttribute('aria-pressed','true'); }
            if(typeof onChange === 'function') onChange(id, setRef);
            update();
          });
          container.appendChild(b);
        });
      }



      function renderSingleOptionButtons(container, items, key){
        if(!container) return;
        container.innerHTML = '';
        items.forEach(it=>{
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'opt';
          b.textContent = it.label;
          b.setAttribute('data-id', it.id);
          b.setAttribute('aria-pressed', (state[key] === it.id) ? 'true' : 'false');
          b.addEventListener('click', ()=>{
            state[key] = (state[key] === it.id) ? '' : it.id;
            // sync pressed state within this container only
            container.querySelectorAll('.opt').forEach(btn=>{
              btn.setAttribute('aria-pressed', (btn.getAttribute('data-id') === state[key]) ? 'true' : 'false');
            });
            update();
          });
          container.appendChild(b);
        });
      }

      function renderRadios(container, name, items, onPick){
        if(!container) return;
        container.innerHTML = '';
        const drillKey = (name && name.indexOf('drill_') === 0) ? name.replace('drill_','') : '';
        const currentValue = drillKey ? (state.outcomeDrilldowns[drillKey] || '') : (state[name] || '');
        items.forEach(it=>{
          const row = document.createElement('label');
          row.className = 'radio';
          row.innerHTML = `
            <input type="radio" name="${name}" value="${it.id}">
            <div><strong>${escapeHtml(it.title)}</strong><span>${escapeHtml(it.desc)}</span></div>
          `;
          const input = row.querySelector('input');
          input.checked = (currentValue === it.id);
          input.addEventListener('change', (e)=>{
            if(e.target.checked){ onPick(it.id); update(); }
          });
          container.appendChild(row);
        });
      }

      function renderLimitedChecks(container, listKey, metaSelector, items, limit, onPick){
        if(!container) return;
        container.innerHTML = '';
        const current = Array.isArray(state[listKey]) ? state[listKey] : [];
        items.forEach(it=>{
          const row = document.createElement('label');
          row.className = 'radio';
          row.innerHTML = `
            <input type="checkbox" value="${it.id}">
            <div><strong>${escapeHtml(it.title)}</strong><span>${escapeHtml(it.desc)}</span></div>
          `;
          const cb = row.querySelector('input');
          cb.checked = current.includes(it.id);
          cb.addEventListener('change', ()=>{
            const selected = Array.isArray(state[listKey]) ? state[listKey] : [];
            let next = selected.slice();
            if(cb.checked){
              if(selected.length >= limit){
                cb.checked = false;
                toast(`Select up to ${limit}.`);
                return;
              }
              next.push(it.id);
            }else{
              next = next.filter(x => x !== it.id);
            }
            state[listKey] = next.filter((v, i, arr)=> arr.indexOf(v) === i);
            if(typeof onPick === 'function') onPick(state[listKey]);
            setSelectionPill(metaSelector, state[listKey].length, limit);
            update();
          });
          container.appendChild(row);
        });
      }

      function renderDriverCards(){
        const container = $('#driverCards');
        if(!container) return;
        container.innerHTML = '';
        driverOpts.forEach(it=>{
          const row = document.createElement('label');
          row.className = 'radio';
          row.innerHTML = `
            <input type="checkbox" value="${it.id}">
            <div>
              <strong>${escapeHtml(it.title)}</strong>
              <span>${escapeHtml(it.desc)}</span>
              <span class="mapHint">${escapeHtml(it.maps || '')}</span>
            </div>
          `;
          const cb = row.querySelector('input');
          cb.checked = state.drivers.includes(it.id);

          cb.addEventListener('change', ()=>{
            if(cb.checked){
              if(state.drivers.length >= 3){
                cb.checked = false;
                toast('Select up to 3 drivers.');
                return;
              }
              state.drivers.push(it.id);
              state.drivers = Array.from(new Set(state.drivers));
            }else{
              state.drivers = state.drivers.filter(d => d !== it.id);
            }
            update();
          });

          container.appendChild(row);
        });
      }

      function renderOutcomeCards(topOutcomes){
        const container = $('#outcomeCards');
        if(!container) return;
        const rank = {};
        (topOutcomes || []).forEach((o, i)=>{ rank[o.id] = i + 1; });
        const topIds = new Set((topOutcomes || []).map(o => o.id));
        const ordered = [
          ...(topOutcomes || []).map(o => outcomeById(o.id) || o),
          ...primaryOutcomeOpts.filter(o => !topIds.has(o.id))
        ];
        container.innerHTML = '';
        ordered.forEach(o=>{
          const card = document.createElement('article');
          card.className = 'outcomeCard';
          card.dataset.top = rank[o.id] ? 'true' : 'false';
          card.innerHTML = `
            <h4>${rank[o.id] ? `<span class="outcomeBadge">${rank[o.id]}</span>` : ''}<span class="outcomeTitle">${escapeHtml(o.label)}</span></h4>
            <div class="oneLiner">${escapeHtml(o.oneLiner || o.desc)}</div>
            ${o.why ? `<div class="whyTitle">Why CISOs care</div><p class="whyBody">${escapeHtml(o.why)}</p>` : ''}
          `;
          container.appendChild(card);
        });
      }

      function renderOutcomeDrilldowns(topOutcomes){
        const container = $('#outcomeDrilldowns');
        if(!container) return;
        const keepIds = new Set((topOutcomes || []).map(o => o.id));
        Object.keys(state.outcomeDrilldowns || {}).forEach(id=>{
          if(!keepIds.has(id)) delete state.outcomeDrilldowns[id];
        });

        container.innerHTML = '';
        (topOutcomes || []).forEach(outcome=>{
          const bank = outcomeDrilldownBank[outcome.id];
          if(!bank || !bank.options || !bank.options.length) return;

          const card = document.createElement('div');
          card.className = 'drillCard';
          const qName = `drill_${outcome.id}`;
          card.innerHTML = `
            <p class="drillTitle">${escapeHtml(outcome.label)}</p>
            <p class="drillQ">${escapeHtml(bank.prompt)}</p>
            <div class="radioGrid twoCol" id="${qName}"></div>
          `;
          container.appendChild(card);

          const target = card.querySelector(`#${qName}`);
          if(!target) return;
          renderRadios(target, `drill_${outcome.id}`, bank.options, (id)=>{
            state.outcomeDrilldowns[outcome.id] = id;
          });
        });
      }

      // ---------- navigation ----------
      function setView(view, opts){
        const cfg = Object.assign({ render: true }, opts || {});
        const prev = state.currentView || 'dashboard';
        const next = (view === 'dashboard' || view === 'archived' || view === 'interstitial' || view === 'account') ? view : 'configurator';
        state.currentView = next;
        if(prev !== next && state.consultationOpen){
          toggleConsultation(false);
        }
        document.body.classList.toggle('is-configurator-view', next === 'configurator');
        document.body.classList.toggle('is-dashboard-view', next === 'dashboard');
        document.body.classList.toggle('is-archived-view', next === 'archived');
        document.body.classList.toggle('is-interstitial-view', next === 'interstitial');
        document.body.classList.toggle('is-account-view', next === 'account');
        if(next === 'dashboard' || next === 'archived' || next === 'account'){
          state.navPreviewThreadId = null;
        }
        if(next !== 'configurator'){
          clearScheduledAutoSave();
        }else{
          requestAutoSave(AUTO_SAVE_BASE_MS);
        }

        const workspaceArchive = $('#workspaceArchive');
        const workspaceAccount = $('#workspaceAccount');
        if(workspaceArchive){
          workspaceArchive.dataset.active = (next === 'archived') ? 'true' : 'false';
        }
        if(workspaceAccount){
          workspaceAccount.dataset.active = (next === 'account') ? 'true' : 'false';
        }
        const recordContextName = $('#recordContextName');
        if(recordContextName){
          const thread = activeThreadModel();
          const editingCompany = String(state.company || '').trim();
          recordContextName.textContent = editingCompany || ((thread && thread.company) ? thread.company : 'Record');
        }

        if(cfg.render) update();
      }

      function syncGlobalActionBar(){
        const actionBtns = globalActionBtnsEl || $('#globalActionBtns');
        if(!actionBtns) return;
        globalActionBtnsEl = actionBtns;
        const parking = $('#globalActionParking');
        const dashboardSlot = $('#dashboardActionSlot');
        const interstitialSlot = $('#interstitialActionSlot');
        const createBtn = $('#globalCreateRecord');
        const deleteBtn = $('#globalDeleteRecord');
        const editBtn = $('#globalEditConfigurator');
        const bookBtn = $('#globalBookConsultation');
        const view = state.currentView || 'configurator';
        const interThread = (view === 'interstitial') ? activeThreadModel() : null;
        const canDeleteThread = !!(interThread && interThread.id && interThread.id !== 'current' && findSavedThread(interThread.id));

        const setActionBtnVisible = (el, visible)=>{
          if(!el) return;
          const on = !!visible;
          el.hidden = !on;
          el.style.display = on ? '' : 'none';
        };
        setActionBtnVisible(createBtn, view === 'dashboard');
        setActionBtnVisible(deleteBtn, view === 'interstitial' && canDeleteThread);
        setActionBtnVisible(editBtn, view === 'interstitial');
        setActionBtnVisible(bookBtn, view === 'interstitial');
        let targetSlot = null;
        if(view === 'dashboard') targetSlot = dashboardSlot;
        if(view === 'interstitial') targetSlot = interstitialSlot;

        if(targetSlot){
          if(actionBtns.parentElement !== targetSlot){
            targetSlot.appendChild(actionBtns);
          }
          actionBtns.style.display = 'flex';
        }else if(parking){
          if(actionBtns.parentElement !== parking){
            parking.appendChild(actionBtns);
          }
          actionBtns.style.display = 'none';
        }else{
          actionBtns.style.display = 'none';
        }
      }

      function setActiveStep(n){
        const nn = clamp(Number(n)||1, 1, 6);
        setView('configurator', { render:false });
        state.activeStep = nn;
        state.visited.add(nn);

        $$('.step').forEach(s => s.dataset.active = (s.dataset.step === String(nn)) ? 'true' : 'false');
        $$('.chip').forEach(c => c.dataset.active = (c.dataset.chip === String(nn)) ? 'true' : 'false');

        window.scrollTo({ top: 0, behavior: 'smooth' });
        update();
      }

      function optionLabel(list, id){
        if(!id) return '—';
        const it = (list || []).find((x)=> x.id === id);
        if(!it) return String(id);
        return String(it.label || it.title || id);
      }

      function optionIdFromAny(list, raw){
        const value = String(raw || '').trim();
        if(!value) return '';
        const direct = (list || []).find((it)=> String(it && it.id || '').toLowerCase() === value.toLowerCase());
        if(direct) return String(direct.id);
        const normalize = (input)=> String(input || '')
          .toLowerCase()
          .replace(/[\u2018\u2019]/g, "'")
          .replace(/[^a-z0-9]+/g, ' ')
          .trim();
        const target = normalize(value);
        const byLabel = (list || []).find((it)=>{
          const label = String((it && (it.label || it.title || it.id)) || '');
          return normalize(label) === target;
        });
        return byLabel ? String(byLabel.id) : '';
      }

      const REQUIRED_FIELD_SELECTORS = Object.freeze({
        role: '#optRole',
        fullName: '#fullName',
        company: '#company',
        companySize: '#companySize',
        operatingCountry: '#operatingCountry',
        pressureSources: '#pressureCards',
        urgentWin: '#radUrgentWin',
        riskEnvs: '#riskEnvCards',
        measuredOn: '#radMeasuredOn',
        orgPain: '#radOrgPain',
        groups: '#optGroups',
        rhythm: '#radRhythm',
        measure: '#radMeasure',
        fitRealism: '#radFitRealism',
        fitScope: '#radFitScope',
        fitToday: '#radFitToday',
        fitServices: '#radFitServices',
        fitRiskFrame: '#radFitRisk',
        industry: '#industry',
        region: '#region',
        regs: '#optRegs',
        roiVisited: '#qValue'
      });

      function ensureQBlockStatusPill(block){
        const labelRow = $('.labelRow', block);
        if(!labelRow) return null;

        let meta = $('.labelRowMeta', labelRow);
        if(!meta){
          meta = document.createElement('div');
          meta.className = 'labelRowMeta';
          const directInfo = Array.from(labelRow.children).find((child)=> child && child.classList && child.classList.contains('info'));
          if(directInfo){
            meta.appendChild(directInfo);
          }
          labelRow.appendChild(meta);
        }

        let pill = $('.qBlockStatusPill', meta);
        if(!pill){
          pill = document.createElement('span');
          pill.className = 'qBlockStatusPill';
          pill.hidden = true;
          meta.insertBefore(pill, meta.firstChild || null);
        }
        return pill;
      }

      function applyRequiredFieldHighlights(missingKeys){
        const missing = (missingKeys instanceof Set) ? missingKeys : new Set();
        const requiredTargets = Object.entries(REQUIRED_FIELD_SELECTORS)
          .map(([key, selector])=> ({ key, el: $(selector) }))
          .filter((row)=> !!row.el);

        requiredTargets.forEach(({ key, el })=>{
          const isMissing = missing.has(key);
          el.classList.toggle('is-field-incomplete', isMissing);
          if(el.matches('input, select, textarea')){
            if(isMissing){
              el.setAttribute('aria-invalid', 'true');
            }else{
              el.removeAttribute('aria-invalid');
            }
          }
        });

        $$('.qBlock').forEach((block)=>{
          let missingCount = 0;
          requiredTargets.forEach(({ key, el })=>{
            if(!missing.has(key)) return;
            if(block.contains(el)) missingCount += 1;
          });
          block.classList.toggle('is-incomplete', missingCount > 0);
          const pill = ensureQBlockStatusPill(block);
          if(!pill) return;
          if(missingCount > 0){
            pill.hidden = false;
            pill.textContent = missingCount === 1 ? '1 required' : `${missingCount} required`;
          }else{
            pill.hidden = true;
            pill.textContent = '';
          }
        });
      }

      function listOrDash(values){
        const arr = (values || []).map((v)=> String(v || '').trim()).filter(Boolean);
        return arr.length ? arr.join(' · ') : '—';
      }

      function naturalList(values, opts){
        const arr = (values || []).map((v)=> String(v || '').trim()).filter(Boolean);
        if(!arr.length) return '';
        const cfg = Object.assign({ conjunction:'and' }, opts || {});
        if(arr.length === 1) return arr[0];
        if(arr.length === 2) return `${arr[0]} ${cfg.conjunction} ${arr[1]}`;
        return `${arr.slice(0, -1).join(', ')}, ${cfg.conjunction} ${arr[arr.length - 1]}`;
      }

      function dashLabelsFromIds(ids, list){
        return Array.from(ids || [])
          .map((id)=> optionLabel(list, id))
          .filter((v)=> v && v !== '—');
      }

      function dashboardFirstGapStep(thread){
        const progress = threadReadinessProgress(thread);
        const gapStep = Number(progress && progress.gaps && progress.gaps[0] && progress.gaps[0].step);
        if(Number.isFinite(gapStep)) return clamp(gapStep, 1, 6);
        const snapStep = Number(thread && thread.snapshot && thread.snapshot.activeStep);
        if(Number.isFinite(snapStep)) return clamp(snapStep, 1, 6);
        return 1;
      }

      function incompleteStepsFromState(){
        const steps = Array.from(new Set(
          dashboardCurrentGaps()
            .map((gap)=> clamp(Number(gap && gap.step) || 1, 1, 6))
        )).sort((a,b)=> a - b);
        return steps;
      }

      function nextIncompleteStepFrom(currentStep){
        const steps = incompleteStepsFromState();
        if(!steps.length) return null;
        const cur = clamp(Number(currentStep) || 1, 1, 6);
        return steps.find((step)=> step > cur) || steps[0];
      }

      function jumpToNextIncomplete(){
        const nextStep = nextIncompleteStepFrom(state.activeStep);
        if(nextStep === null){
          toast('All sections are complete.');
          return;
        }
        setActiveStep(nextStep);
        requestAutoSave(AUTO_SAVE_FAST_MS);
      }

      function clearAutoSaveTimer(){
        if(!autoSaveTimerId) return;
        window.clearTimeout(autoSaveTimerId);
        autoSaveTimerId = 0;
      }

      function clearScheduledAutoSave(){
        clearAutoSaveTimer();
        state.autoSaveDueAt = 0;
      }

      function armAutoSaveTimer(){
        if(state.currentView !== 'configurator'){
          clearScheduledAutoSave();
          return;
        }
        const dueAt = Number(state.autoSaveDueAt) || 0;
        if(!dueAt) return;
        clearAutoSaveTimer();
        const waitMs = Math.max(140, dueAt - Date.now());
        autoSaveTimerId = window.setTimeout(()=>{
          autoSaveTimerId = 0;
          if(state.currentView !== 'configurator'){
            state.autoSaveDueAt = 0;
            return;
          }
          if(Date.now() < (Number(state.autoSaveDueAt) || 0)){
            armAutoSaveTimer();
            return;
          }
          state.autoSaveDueAt = 0;
          const didSave = saveActiveRecord({ quiet:true, auto:true, thinkMs:420 });
          if(didSave === false){
            requestAutoSave(10000);
          }
        }, waitMs);
      }

      function requestAutoSave(delayMs){
        if(state.currentView !== 'configurator') return;
        const ms = Math.max(1000, Number(delayMs) || AUTO_SAVE_BASE_MS);
        const nextDue = Date.now() + ms;
        const currentDue = Number(state.autoSaveDueAt) || 0;
        if(!currentDue || nextDue < currentDue){
          state.autoSaveDueAt = nextDue;
          armAutoSaveTimer();
          return;
        }
        if(!autoSaveTimerId) armAutoSaveTimer();
      }

      function dashboardStage(){
        if(state.activeStep >= 6) return 'Review';
        if(state.activeStep >= 5) return 'ROI estimate';
        if(state.activeStep >= 4) return 'Context';
        if(state.activeStep >= 3) return 'Package fit';
        if(state.activeStep >= 2) return 'Coverage';
        return 'About';
      }

      function dashboardCompletionSummary(){
        return readinessProgressFromContext(state).completion;
      }

      function dashboardTierName(){
        const rec = score();
        if(rec.best === 'adv') return 'Advanced';
        if(rec.best === 'ult') return 'Ultimate';
        return 'Core';
      }

      function dashboardCurrentGaps(){
        return readinessProgressFromContext(state).gaps;
      }

      function listFromCollection(value){
        if(value instanceof Set) return Array.from(value);
        if(Array.isArray(value)) return value.slice();
        return [];
      }

      function setFromCollection(value){
        return new Set(listFromCollection(value));
      }

      function buildReadinessContext(source){
        const src = (source && typeof source === 'object') ? source : {};
        const regsRaw = listFromCollection(src.regs);
        const hasRegsTouchedFlag = Object.prototype.hasOwnProperty.call(src, 'regsTouched');
        const ctx = {
          role: String(src.role || '').trim(),
          fullName: String(src.fullName || '').trim(),
          company: String(src.company || '').trim(),
          companySize: String(src.companySize || '').trim(),
          operatingCountry: String(src.operatingCountry || '').trim(),
          pressureSources: listFromCollection(src.pressureSources).filter(Boolean),
          urgentWin: String(src.urgentWin || '').trim(),
          riskEnvs: listFromCollection(src.riskEnvs).filter(Boolean),
          measuredOn: String(src.measuredOn || '').trim(),
          orgPain: String(src.orgPain || '').trim(),
          groups: setFromCollection(src.groups),
          rhythm: String(src.rhythm || '').trim(),
          measure: String(src.measure || '').trim(),
          fitRealism: String(src.fitRealism || '').trim(),
          fitScope: String(src.fitScope || '').trim(),
          fitToday: String(src.fitToday || '').trim(),
          fitServices: String(src.fitServices || '').trim(),
          fitRiskFrame: String(src.fitRiskFrame || '').trim(),
          industry: String(src.industry || '').trim(),
          region: String(src.region || '').trim(),
          regsTouched: hasRegsTouchedFlag ? !!src.regsTouched : regsRaw.length > 0,
          regs: new Set(regsRaw),
          visited: setFromCollection(src.visited)
        };
        if(!ctx.visited.size) ctx.visited.add(1);
        return ctx;
      }

      function readinessRequirements(source){
        const ctx = buildReadinessContext(source);
        return [
          { key:'role', step:1, done: !!ctx.role, title:'Role not confirmed', why:'Role anchors ownership for outcomes and follow-up.' },
          { key:'fullName', step:1, done: !!ctx.fullName, title:'Name not captured', why:'Contact ownership is required for follow-up and handoff.' },
          { key:'company', step:1, done: !!ctx.company, title:'Company not captured', why:'Company context is needed before sharing a recommendation.' },
          { key:'companySize', step:1, done: !!ctx.companySize, title:'Company size missing', why:'Size influences cadence and recommendation confidence.' },
          { key:'operatingCountry', step:1, done: !!ctx.operatingCountry, title:'Operating country missing', why:'Country informs the likely regulatory evidence path.' },
          { key:'pressureSources', step:1, done: ctx.pressureSources.length > 0, title:'Pressure sources not selected', why:'Pressure signals help prioritize the right outcomes.' },
          { key:'urgentWin', step:1, done: !!ctx.urgentWin, title:'Urgent 90-day win not set', why:'Urgency clarifies what success must look like first.' },
          { key:'riskEnvs', step:1, done: ctx.riskEnvs.length > 0, title:'Risk environment not selected', why:'Risk environment helps focus the right simulation scope.' },
          { key:'measuredOn', step:1, done: !!ctx.measuredOn, title:'Current measurement baseline missing', why:'Baseline metrics are required to quantify uplift.' },
          { key:'orgPain', step:1, done: !!ctx.orgPain, title:'Current organisation challenge unclear', why:'Current challenge shapes where value shows up fastest.' },

          { key:'groups', step:2, done: ctx.groups.size > 0, title:'Coverage groups not selected', why:'Coverage determines program scope and rollout design.' },
          { key:'rhythm', step:2, done: !!ctx.rhythm, title:'Cadence not selected', why:'Cadence impacts operating model and package fit.' },
          { key:'measure', step:2, done: !!ctx.measure, title:'Measurement model not selected', why:'Measurement model drives reporting and evidence quality.' },

          { key:'fitRealism', step:3, done: !!ctx.fitRealism, title:'Realism requirement unanswered', why:'Realism changes effort and content structure.' },
          { key:'fitScope', step:3, done: !!ctx.fitScope, title:'Scope requirement unanswered', why:'Scope alters expected delivery footprint.' },
          { key:'fitToday', step:3, done: !!ctx.fitToday, title:'Current state unanswered', why:'Current state helps calibrate the starting package.' },
          { key:'fitServices', step:3, done: !!ctx.fitServices, title:'Delivery support unanswered', why:'Support model affects implementation recommendations.' },
          { key:'fitRiskFrame', step:3, done: !!ctx.fitRiskFrame, title:'Risk frame unanswered', why:'Risk framing helps position the narrative for stakeholders.' },

          { key:'industry', step:4, done: !!ctx.industry, title:'Industry not selected', why:'Industry context changes suggested standards and language.' },
          { key:'region', step:4, done: !!ctx.region, title:'Region not selected', why:'Region influences evidence and audit expectations.' },
          { key:'regs', step:4, done: ctx.regs.size > 0 && !!ctx.regsTouched, title:'Regulatory references not selected', why:'References improve the evidence narrative for stakeholders.' },

          { key:'roiVisited', step:5, done: ctx.visited.has(5), title:'ROI estimate not reviewed', why:'ROI inputs are needed for investment and timing decisions.' }
        ];
      }

      function readinessProgressFromContext(source){
        const requirements = readinessRequirements(source);
        const gaps = requirements
          .filter((req)=> !req.done)
          .map((req)=> ({ title:req.title, why:req.why, step:req.step }));
        const total = requirements.length;
        const done = total - gaps.length;
        const pct = total ? Math.round((done / total) * 100) : 0;
        return {
          completion: `${done}/${total} (${pct}%)`,
          gaps,
          gapSummary: gaps.length ? gaps.slice(0, 2).map((gap)=> gap.title).join(' · ') : 'No open gaps'
        };
      }

      function threadReadinessProgress(thread){
        if(!thread || thread.id === 'current'){
          return readinessProgressFromContext(state);
        }
        const snapshot = (thread.snapshot && typeof thread.snapshot === 'object') ? thread.snapshot : {};
        const computed = readinessProgressFromContext(snapshot);
        const storedCompletion = String(thread.completion || '').trim();
        const hasStoredCompletion = /\(\s*\d+\s*%\s*\)/.test(storedCompletion);
        return {
          completion: hasStoredCompletion ? storedCompletion : computed.completion,
          gaps: computed.gaps,
          gapSummary: computed.gapSummary
        };
      }

      function currentThreadModel(){
        const regionLabels = { NA:'North America', UKI:'UK & Ireland', EU:'Europe (EU)', APAC:'APAC', Other:'Other / Global' };
        const sizeMap = {
          lt500:'< 500 employees',
          '500-2k':'500–2,000 employees',
          '2k-10k':'2,000–10,000 employees',
          '10k-50k':'10,000–50,000 employees',
          '50kplus':'50,000+ employees'
        };

        const outcomes = inferredPrimaryOutcomes(3).map((o)=> o.short || o.label).filter(Boolean);
        const progress = readinessProgressFromContext(state);
        const gaps = progress.gaps;
        const gapSummary = progress.gapSummary;
        const stackLabels = dashLabelsFromIds(state.stack, stackMaster);
        if(String(state.stackOther || '').trim()) stackLabels.push(String(state.stackOther).trim());

        return {
          id: 'current',
          company: (state.company && String(state.company).trim()) ? state.company.trim() : 'Untitled company',
          stage: dashboardStage(),
          completion: progress.completion,
          tier: dashboardTierName(),
          outcomes,
          outcomesText: outcomes.length ? outcomes.join(' · ') : 'Awaiting outcome signals',
          gapSummary,
          gaps,
          modules: {
            organisation: [
              { label:'Name', value: state.fullName || '—' },
              { label:'Company', value: (state.company && String(state.company).trim()) ? state.company.trim() : 'Untitled company' },
              { label:'Role', value: optionLabel(roleOpts, state.role) },
              { label:'Company size', value: state.companySize ? (sizeMap[state.companySize] || state.companySize) : '—' },
              { label:'Operating country', value: state.operatingCountry || '—' }
            ],
            discovery: [
              { label:'Pressure sources', value: listOrDash(dashLabelsFromIds(state.pressureSources, pressureOpts.map((p)=> ({ id:p.id, label:p.title })))) },
              { label:'Urgent win', value: optionLabel(urgentWinOpts, state.urgentWin) },
              { label:'Risk environment', value: listOrDash(dashLabelsFromIds(state.riskEnvs, riskEnvOpts.map((r)=> ({ id:r.id, label:r.title })))) },
              { label:'Measured on today', value: optionLabel(measuredOnOpts, state.measuredOn) },
              { label:'Organisation challenge', value: optionLabel(orgPainOpts, state.orgPain) },
              { label:'Conversation triggers', value: listOrDash(dashLabelsFromIds(state.drivers, driverOpts.map((d)=> ({ id:d.id, label:d.title })))) },
              { label:'Evidence audience', value: listOrDash(dashLabelsFromIds(state.evidence, evidenceOpts)) },
              { label:'Primary outcomes', value: outcomes.length ? outcomes.join(' · ') : '—' }
            ],
            coverage: [
              { label:'Coverage groups', value: listOrDash(dashLabelsFromIds(state.groups, groupOpts)) },
              { label:'Cadence', value: optionLabel(rhythmOpts, state.rhythm) },
              { label:'Measurement', value: optionLabel(measureOpts, state.measure) }
            ],
            packageFit: [
              { label:'Realism', value: optionLabel(fitRealismOpts, state.fitRealism) },
              { label:'Scope', value: optionLabel(fitScopeOpts, state.fitScope) },
              { label:'Current state', value: optionLabel(fitTodayOpts, state.fitToday) },
              { label:'Delivery model', value: optionLabel(fitServicesOpts, state.fitServices) },
              { label:'Risk frame', value: optionLabel(fitRiskFrameOpts, state.fitRiskFrame) }
            ],
            context: [
              { label:'Industry', value: state.industry || '—' },
              { label:'Region', value: state.region ? (regionLabels[state.region] || state.region) : '—' },
              { label:'Regulatory references', value: listOrDash(dashLabelsFromIds(state.regs, regMaster)) },
              { label:'Tools / stack', value: listOrDash(stackLabels) }
            ]
          }
        };
      }

      function staticThreadModels(){
        return [
          {
            id: 'northbridge',
            company: 'Northbridge Bank',
            stage: 'Validation',
            completion: '14/22 (64%)',
            tier: 'Core',
            priority: true,
            outcomes: ['Regulator readiness evidence', 'Board confidence'],
            outcomesText: 'Regulator readiness evidence · Board confidence',
            gapSummary: 'Evidence audience not confirmed · Delivery model unanswered',
            gaps: [
              { title:'Evidence audience not confirmed', why:'Audience determines the proof format and sign-off path.', step:1 },
              { title:'Delivery model unanswered', why:'Delivery model changes implementation effort and pace.', step:3 },
              { title:'Regulatory context incomplete', why:'Regulation context impacts evidence depth and urgency.', step:4 }
            ],
            modules: {
              organisation: [
                { label:'Name', value:'Will Bloor' },
                { label:'Company', value:'Northbridge Bank' },
                { label:'Role', value:'CISO' },
                { label:'Company size', value:'2,000–10,000 employees' },
                { label:'Operating country', value:'United Kingdom' }
              ],
              discovery: [
                { label:'Pressure sources', value:'Board · Regulator · Insurer' },
                { label:'Urgent win', value:'Executive evidence pack before quarter close' },
                { label:'Risk environment', value:'Cloud workloads · Identity' },
                { label:'Measured on today', value:'Audit and control findings' },
                { label:'Organisation challenge', value:'Proof for external stakeholders is fragmented' },
                { label:'Conversation triggers', value:'Near miss · Insurance renewal' },
                { label:'Evidence audience', value:'Board · Regulator' },
                { label:'Primary outcomes', value:'Regulator readiness evidence · Board confidence' }
              ],
              coverage: [
                { label:'Coverage groups', value:'SOC · Executive leadership · GRC' },
                { label:'Cadence', value:'Quarterly' },
                { label:'Measurement', value:'Outcome metrics + trend' }
              ],
              packageFit: [
                { label:'Realism', value:'High realism required for sign-off confidence' },
                { label:'Scope', value:'Cross-functional, multi-team scope' },
                { label:'Current state', value:'Ad hoc exercising, inconsistent closure loop' },
                { label:'Delivery model', value:'TBC' },
                { label:'Risk frame', value:'Governance and evidence confidence' }
              ],
              context: [
                { label:'Industry', value:'Financial Services' },
                { label:'Region', value:'UK & Ireland' },
                { label:'Regulatory references', value:'NIST CSF · ISO 27001 · SOC 2' },
                { label:'Tools / stack', value:'Sentinel · ServiceNow GRC · Microsoft Defender' }
              ]
            }
            ,
            viz: {
              roiPct: 168,
              npv: 2450000,
              spend: 820000,
              paybackMonths: 13,
              outcomeBreakdown: [
                { label:'Regulator readiness evidence', pct: 54 },
                { label:'Board confidence', pct: 31 },
                { label:'Evidence-led follow-up planning', pct: 15 }
              ]
            }
          },
          {
            id: 'aster',
            company: 'Aster Mobility',
            stage: 'Discovery',
            completion: '18/22 (82%)',
            tier: 'Advanced',
            priority: true,
            outcomes: ['Evidence-led follow-up planning', 'Coverage roadmap'],
            outcomesText: 'Evidence-led follow-up planning · Coverage roadmap',
            gapSummary: 'Cadence baseline still needed',
            gaps: [
              { title:'Cadence baseline still needed', why:'Cadence determines review rhythm and value realization timing.', step:2 }
            ],
            modules: {
              organisation: [
                { label:'Name', value:'Will Bloor' },
                { label:'Company', value:'Aster Mobility' },
                { label:'Role', value:'Security program lead' },
                { label:'Company size', value:'10,000–50,000 employees' },
                { label:'Operating country', value:'United States' }
              ],
              discovery: [
                { label:'Pressure sources', value:'Board · Customer assurance' },
                { label:'Urgent win', value:'Quarterly readiness narrative' },
                { label:'Risk environment', value:'Cloud workloads · Third-party risk' },
                { label:'Measured on today', value:'Mixed metrics' },
                { label:'Organisation challenge', value:'Inconsistent closure and follow-through' },
                { label:'Conversation triggers', value:'Growth + regional expansion' },
                { label:'Evidence audience', value:'Board · Customers' },
                { label:'Primary outcomes', value:'Evidence-led follow-up planning · Coverage roadmap' }
              ],
              coverage: [
                { label:'Coverage groups', value:'SOC · Cloud · Third-party' },
                { label:'Cadence', value:'Not confirmed' },
                { label:'Measurement', value:'Completion and follow-up trend' }
              ],
              packageFit: [
                { label:'Realism', value:'Scenario realism required for exec confidence' },
                { label:'Scope', value:'Multi-team pilot scope' },
                { label:'Current state', value:'Exercises in place, no standard operating loop' },
                { label:'Delivery model', value:'Guided rollout support requested' },
                { label:'Risk frame', value:'Readiness outcomes' }
              ],
              context: [
                { label:'Industry', value:'Transport / Mobility' },
                { label:'Region', value:'North America' },
                { label:'Regulatory references', value:'NIST CSF · ISO 27001' },
                { label:'Tools / stack', value:'CrowdStrike · AWS · Jira Service Management' }
              ]
            }
            ,
	            viz: {
	              roiPct: 214,
	              npv: 3180000,
	              spend: 1040000,
	              paybackMonths: 11,
	              outcomeBreakdown: [
	                { label:'Evidence-led follow-up planning', pct: 42 },
	                { label:'Coverage roadmap', pct: 33 },
	                { label:'Regulator readiness evidence', pct: 25 }
	              ]
	            }
	          },
	          {
	            id: 'pioneer',
	            company: 'Pioneer Cloud',
	            stage: 'Closed',
	            completion: '22/22 (100%)',
	            tier: 'Ultimate',
	            outcomes: ['Regulator readiness evidence', 'Operational decision quality'],
	            outcomesText: 'Regulator readiness evidence · Operational decision quality',
	            gapSummary: 'No open gaps',
	            gaps: [],
	            modules: {
	              organisation: [
	                { label:'Name', value:'Will Bloor' },
	                { label:'Company', value:'Pioneer Cloud' },
	                { label:'Role', value:'CISO' },
	                { label:'Company size', value:'10,000–50,000 employees' },
	                { label:'Operating country', value:'United States' }
	              ],
	              discovery: [
	                { label:'Pressure sources', value:'Board · Regulator · Customers' },
	                { label:'Primary outcomes', value:'Regulator readiness evidence · Operational decision quality' }
	              ],
	              coverage: [
	                { label:'Coverage groups', value:'SOC · Cloud security · Executive Crisis Team (CMT)' },
	                { label:'Cadence', value:'Programmatic' }
	              ],
	              packageFit: [
	                { label:'Delivery model', value:'Guided program support' },
	                { label:'Risk frame', value:'Governance and evidence confidence' }
	              ],
	              context: [
	                { label:'Industry', value:'Technology / SaaS' },
	                { label:'Region', value:'North America' }
	              ]
	            },
	            viz: {
	              roiPct: 241,
	              npv: 3920000,
	              spend: 1180000,
	              paybackMonths: 10,
	              outcomeBreakdown: [
	                { label:'Regulator readiness evidence', pct: 49 },
	                { label:'Operational decision quality', pct: 30 },
	                { label:'Evidence-led follow-up planning', pct: 21 }
	              ]
	            },
	            snapshot: {
	              fullName: 'Will Bloor',
	              company: 'Pioneer Cloud',
	              role: 'ciso',
	              activeStep: 6,
	              visited: [1,2,3,4,5,6]
	            }
	          },
	          {
	            id: 'cedar',
	            company: 'Cedar Health',
	            stage: 'Closed',
	            completion: '22/22 (100%)',
	            tier: 'Advanced',
	            outcomes: ['Evidence-led follow-up planning', 'Compliance translated into evidence & benchmarks'],
	            outcomesText: 'Evidence-led follow-up planning · Compliance translated into evidence & benchmarks',
	            gapSummary: 'No open gaps',
	            gaps: [],
	            modules: {
	              organisation: [
	                { label:'Name', value:'Will Bloor' },
	                { label:'Company', value:'Cedar Health' },
	                { label:'Role', value:'Security Manager' },
	                { label:'Company size', value:'2,000–10,000 employees' },
	                { label:'Operating country', value:'United States' }
	              ],
	              discovery: [
	                { label:'Pressure sources', value:'Board · Internal only' },
	                { label:'Primary outcomes', value:'Evidence-led follow-up planning · Compliance translated into evidence & benchmarks' }
	              ],
	              coverage: [
	                { label:'Coverage groups', value:'SOC · GRC / compliance · Workforce' },
	                { label:'Cadence', value:'Monthly' }
	              ],
	              packageFit: [
	                { label:'Delivery model', value:'Guided program support' },
	                { label:'Risk frame', value:'Readiness outcomes' }
	              ],
	              context: [
	                { label:'Industry', value:'Healthcare / Life Sciences' },
	                { label:'Region', value:'North America' }
	              ]
	            },
	            viz: {
	              roiPct: 188,
	              npv: 2760000,
	              spend: 990000,
	              paybackMonths: 12,
	              outcomeBreakdown: [
	                { label:'Evidence-led follow-up planning', pct: 45 },
	                { label:'Compliance translated into evidence & benchmarks', pct: 37 },
	                { label:'Board confidence', pct: 18 }
	              ]
	            },
	            snapshot: {
	              fullName: 'Will Bloor',
	              company: 'Cedar Health',
	              role: 'secMgr',
	              activeStep: 6,
	              visited: [1,2,3,4,5,6]
	            }
	          },
	          {
	            id: 'arclight',
	            company: 'Arclight Retail',
	            stage: 'Discovery',
	            completion: '8/22 (36%)',
	            tier: 'Core',
	            outcomes: ['Build and retain a cyber-ready workforce', 'Secure the next-gen modern enterprise'],
	            outcomesText: 'Build and retain a cyber-ready workforce · Secure the next-gen modern enterprise',
	            gapSummary: 'Coverage groups not selected · Package fit unanswered',
	            gaps: [
	              { title:'Coverage groups not selected', why:'Coverage determines who the readiness plan includes.', step:2 },
	              { title:'Package fit unanswered', why:'Package fit decisions are needed before recommendation.', step:3 }
	            ],
	            modules: {
	              organisation: [
	                { label:'Name', value:'Will Bloor' },
	                { label:'Company', value:'Arclight Retail' },
	                { label:'Role', value:'Practitioner' }
	              ],
	              discovery: [
	                { label:'Pressure sources', value:'Internal only' },
	                { label:'Primary outcomes', value:'Build and retain a cyber-ready workforce · Secure the next-gen modern enterprise' }
	              ],
	              coverage: [
	                { label:'Coverage groups', value:'—' }
	              ],
	              packageFit: [
	                { label:'Current state', value:'Not yet captured' }
	              ],
	              context: [
	                { label:'Industry', value:'Retail / eCommerce' },
	                { label:'Region', value:'North America' }
	              ]
	            },
	            viz: {
	              roiPct: 94,
	              npv: 840000,
	              spend: 470000,
	              paybackMonths: 18,
	              outcomeBreakdown: [
	                { label:'Build and retain a cyber-ready workforce', pct: 52 },
	                { label:'Secure the next-gen modern enterprise', pct: 48 }
	              ]
	            },
	            snapshot: {
	              fullName: 'Will Bloor',
	              company: 'Arclight Retail',
	              role: 'practitioner',
	              activeStep: 2,
	              visited: [1]
	            }
	          },
	          {
	            id: 'blueharbor',
	            company: 'Blueharbor Logistics',
	            stage: 'Discovery',
	            completion: '9/22 (41%)',
	            tier: 'Core',
	            outcomes: ['Faster detection, response & decision-making', 'Coverage roadmap'],
	            outcomesText: 'Faster detection, response & decision-making · Coverage roadmap',
	            gapSummary: 'Cadence not selected · Context unanswered',
	            gaps: [
	              { title:'Cadence not selected', why:'Cadence drives operating rhythm and follow-up design.', step:2 },
	              { title:'Industry not selected', why:'Industry helps tailor relevant regulatory language.', step:4 }
	            ],
	            modules: {
	              organisation: [
	                { label:'Name', value:'Will Bloor' },
	                { label:'Company', value:'Blueharbor Logistics' },
	                { label:'Role', value:'Security Manager' }
	              ],
	              discovery: [
	                { label:'Pressure sources', value:'Board · Customers' },
	                { label:'Primary outcomes', value:'Faster detection, response & decision-making · Coverage roadmap' }
	              ],
	              coverage: [
	                { label:'Cadence', value:'Not selected' }
	              ],
	              packageFit: [
	                { label:'Delivery model', value:'Not selected' }
	              ],
	              context: [
	                { label:'Region', value:'North America' }
	              ]
	            },
	            viz: {
	              roiPct: 103,
	              npv: 980000,
	              spend: 520000,
	              paybackMonths: 17,
	              outcomeBreakdown: [
	                { label:'Faster detection, response & decision-making', pct: 55 },
	                { label:'Coverage roadmap', pct: 45 }
	              ]
	            },
	            snapshot: {
	              fullName: 'Will Bloor',
	              company: 'Blueharbor Logistics',
	              role: 'secMgr',
	              activeStep: 2,
	              visited: [1,2]
	            }
	          },
	          {
	            id: 'nexus',
	            company: 'Nexus Utilities',
	            stage: 'Validation',
	            completion: '13/22 (59%)',
	            tier: 'Core',
	            outcomes: ['Regulator readiness evidence', 'Evidence-led follow-up planning'],
	            outcomesText: 'Regulator readiness evidence · Evidence-led follow-up planning',
	            gapSummary: 'Delivery support unanswered · ROI estimate not reviewed',
	            gaps: [
	              { title:'Delivery support unanswered', why:'Support model changes rollout confidence and timing.', step:3 },
	              { title:'ROI estimate not reviewed', why:'Commercial confidence needs quantified value signals.', step:5 }
	            ],
	            modules: {
	              organisation: [
	                { label:'Name', value:'Will Bloor' },
	                { label:'Company', value:'Nexus Utilities' },
	                { label:'Role', value:'CISO' }
	              ],
	              discovery: [
	                { label:'Pressure sources', value:'Regulator · Internal only' },
	                { label:'Primary outcomes', value:'Regulator readiness evidence · Evidence-led follow-up planning' }
	              ],
	              coverage: [
	                { label:'Coverage groups', value:'SOC · GRC / compliance' },
	                { label:'Cadence', value:'Quarterly' }
	              ],
	              packageFit: [
	                { label:'Current state', value:'Exercises are ad hoc today' }
	              ],
	              context: [
	                { label:'Industry', value:'Energy / Utilities' },
	                { label:'Region', value:'North America' }
	              ]
	            },
	            viz: {
	              roiPct: 141,
	              npv: 1890000,
	              spend: 760000,
	              paybackMonths: 14,
	              outcomeBreakdown: [
	                { label:'Regulator readiness evidence', pct: 46 },
	                { label:'Evidence-led follow-up planning', pct: 34 },
	                { label:'Board confidence', pct: 20 }
	              ]
	            },
	            snapshot: {
	              fullName: 'Will Bloor',
	              company: 'Nexus Utilities',
	              role: 'ciso',
	              activeStep: 3,
	              visited: [1,2,3,4]
	            }
	          },
	          {
	            id: 'lunar',
	            company: 'Lunar Systems',
	            stage: 'Validation',
	            completion: '19/22 (86%)',
	            tier: 'Advanced',
	            outcomes: ['Secure the next-gen modern enterprise', 'Faster detection, response & decision-making'],
	            outcomesText: 'Secure the next-gen modern enterprise · Faster detection, response & decision-making',
	            gapSummary: 'Regulatory references not selected',
	            gaps: [
	              { title:'Regulatory references not selected', why:'References improve the evidence narrative for stakeholders.', step:4 }
	            ],
	            modules: {
	              organisation: [
	                { label:'Name', value:'Will Bloor' },
	                { label:'Company', value:'Lunar Systems' },
	                { label:'Role', value:'CISO' }
	              ],
	              discovery: [
	                { label:'Pressure sources', value:'Board · Customers · Insurer' },
	                { label:'Primary outcomes', value:'Secure the next-gen modern enterprise · Faster detection, response & decision-making' }
	              ],
	              coverage: [
	                { label:'Coverage groups', value:'SOC · Cloud security · Identity & access (IAM)' },
	                { label:'Cadence', value:'Monthly' }
	              ],
	              packageFit: [
	                { label:'Delivery model', value:'Guided program support' },
	                { label:'Risk frame', value:'Readiness outcomes' }
	              ],
	              context: [
	                { label:'Industry', value:'Technology / SaaS' },
	                { label:'Region', value:'North America' }
	              ]
	            },
	            viz: {
	              roiPct: 209,
	              npv: 3340000,
	              spend: 1120000,
	              paybackMonths: 11,
	              outcomeBreakdown: [
	                { label:'Secure the next-gen modern enterprise', pct: 44 },
	                { label:'Faster detection, response & decision-making', pct: 36 },
	                { label:'Compliance translated into evidence & benchmarks', pct: 20 }
	              ]
	            },
	            snapshot: {
	              fullName: 'Will Bloor',
	              company: 'Lunar Systems',
	              role: 'ciso',
	              activeStep: 5,
	              visited: [1,2,3,4,5]
	            }
          }
        ];
      }

      function replaceThreadCompany(rawThread, nextCompany){
        const thread = jsonClone(rawThread) || {};
        const company = String(nextCompany || '').trim() || 'Untitled company';
        thread.company = company;

        if(thread.snapshot && typeof thread.snapshot === 'object'){
          thread.snapshot.company = company;
        }

        if(thread.modules && typeof thread.modules === 'object' && Array.isArray(thread.modules.organisation)){
          let updated = false;
          thread.modules.organisation = thread.modules.organisation.map((row)=>{
            const label = String((row && row.label) || '').trim().toLowerCase();
            if(label !== 'company') return row;
            updated = true;
            return Object.assign({}, row, { value: company });
          });
          if(!updated){
            thread.modules.organisation.unshift({ label:'Company', value: company });
          }
        }

        return thread;
      }

      function workspaceProfileLibrary(){
        const now = Date.now();
        const base = staticThreadModels();
        const aeThreads = base.map((thread, idx)=> normalizeThreadModel(Object.assign({}, thread, {
          id: `ae-${idx + 1}`,
          priority: idx < 2 ? true : !!thread.priority,
          archived: false,
          archivedAt: 0,
          updatedAt: now - (idx * 3600 * 1000)
        }), idx));

        const csNames = [
          'Summit Manufacturing',
          'HarborGrid Energy',
          'Nova Retail Group',
          'Westfield Health',
          'Atlas Payments',
          'Meridian Logistics'
        ];
        const csThreads = base.slice(0, 6).map((thread, idx)=> {
          const renamed = replaceThreadCompany(thread, csNames[idx] || thread.company);
          return normalizeThreadModel(Object.assign({}, renamed, {
            id: `cs-${idx + 1}`,
            priority: idx < 2,
            archived: idx === 5,
            archivedAt: idx === 5 ? (now - (4 * 24 * 3600 * 1000)) : 0,
            updatedAt: now - ((idx + 1) * 5400 * 1000)
          }), idx);
        });

        return [
          {
            id: 'ae_demo',
            name: 'AE demo profile',
            account: {
              fullName: 'Will Bloor',
              email: 'will.bloor@immersivelabs.com',
              phone: '+1 555 123 4567',
              defaultRole: 'senior_enterprise_account_manager',
              defaultCountry: 'United States',
              defaultRegion: 'NA',
              fieldMode: 'guided',
              prefillMode: 'on'
            },
            threads: aeThreads
          },
          {
            id: 'cs_demo',
            name: 'Customer success demo profile',
            account: {
              fullName: 'Alex Morgan',
              email: 'alex.morgan@immersivelabs.com',
              phone: '+1 555 987 6543',
              defaultRole: 'lead_customer_success_manager',
              defaultCountry: 'United States',
              defaultRegion: 'NA',
              fieldMode: 'guided',
              prefillMode: 'on'
            },
            threads: csThreads
          }
        ];
      }

      function resetWorkspaceUiStateCaches(){
        state.navPreviewThreadId = null;
        state.dashboardSelectedIds = new Set();
        state.archivedSelectedIds = new Set();
        state.starPulseQueue = new Set();
        state.completionRingAnimatedIds = new Set();
        state.dashboardRowAnimatedIds = new Set();
        state.workspaceCompanyAnimatedIds = new Set();
        state.interstitialAnimatedThreadIds = new Set();
      }

      function applyWorkspaceThreadPortfolio(rows, opts){
        const cfg = Object.assign({
          profileStorageValue: undefined,
          accountProfile: null,
          toastMessage: ''
        }, opts || {});

        const sourceRows = Array.isArray(rows) ? rows : [];
        const normalized = sourceRows.map((thread, idx)=> normalizeThreadModel(thread, idx));
        const used = new Set();
        normalized.forEach((thread, idx)=>{
          let nextId = String((thread && thread.id) || `record-${idx + 1}`).trim();
          if(!nextId) nextId = `record-${idx + 1}`;
          if(used.has(nextId)){
            const base = nextId;
            let seq = 2;
            while(used.has(`${base}-${seq}`)) seq += 1;
            nextId = `${base}-${seq}`;
          }
          thread.id = nextId;
          used.add(nextId);
        });

        state.savedThreads = normalized;
        state.savedThreadsLoaded = true;
        const firstActive = normalized.find((thread)=> !thread.archived) || normalized[0] || null;
        state.activeThread = firstActive ? firstActive.id : 'current';
        resetWorkspaceUiStateCaches();
        persistSavedThreads();

        try{
          if(cfg.profileStorageValue === null){
            window.localStorage.removeItem(WORKSPACE_PROFILE_KEY);
          }else if(cfg.profileStorageValue !== undefined){
            window.localStorage.setItem(WORKSPACE_PROFILE_KEY, String(cfg.profileStorageValue));
          }
        }catch(err){
          // ignore storage failures
        }

        if(cfg.accountProfile && typeof cfg.accountProfile === 'object'){
          applyAccountProfile(cfg.accountProfile, true);
        }
        setView('dashboard', { render:false });
        update();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if(String(cfg.toastMessage || '').trim()){
          toast(String(cfg.toastMessage).trim());
        }
      }

      function loadWorkspaceProfile(profileId){
        const profiles = workspaceProfileLibrary();
        const profile = profiles.find((p)=> p.id === profileId);
        if(!profile) return;

        const rows = Array.isArray(profile.threads) ? profile.threads : [];
        applyWorkspaceThreadPortfolio(rows, {
          profileStorageValue: profile.id,
          accountProfile: profile.account || {},
          toastMessage: `Loaded ${profile.name}.`
        });
      }

      function buildThreadsCsv(rows){
        const join = (items)=> (items && items.length) ? items.join('; ') : '';
        const val = (v)=> (v === null || v === undefined) ? '' : String(v);
        const bool = (v)=> v ? 'true' : 'false';
        const toJson = (v)=>{
          try{
            return JSON.stringify(v === undefined ? null : v);
          }catch(err){
            return '';
          }
        };
        const roleLabels = roleOpts.map((opt)=> ({ id:opt.id, label:opt.label }));
        const pressureLabels = pressureOpts.map((opt)=> ({ id:opt.id, label:opt.title }));
        const riskLabels = riskEnvOpts.map((opt)=> ({ id:opt.id, label:opt.title }));
        const driverLabels = driverOpts.map((opt)=> ({ id:opt.id, label:opt.title }));
        const stackLabels = stackMaster.map((opt)=> ({ id:opt.id, label:opt.label }));
        const regionLabels = { NA:'North America', UKI:'UK & Ireland', EU:'Europe (EU)', APAC:'APAC', Other:'Other / Global' };

        const table = (rows || []).map((thread)=>{
          const snapshot = (thread && thread.snapshot && typeof thread.snapshot === 'object') ? thread.snapshot : {};
          const progress = threadReadinessProgress(thread);
          const stackList = dashLabelsFromIds(snapshot.stack, stackLabels);
          if(String(snapshot.stackOther || '').trim()) stackList.push(String(snapshot.stackOther).trim());
          return {
            record_id: thread.id,
            company: thread.company,
            stage: thread.stage,
            completion: progress.completion,
            tier: thread.tier,
            open_gaps: (progress.gaps || []).length,
            gap_summary: progress.gapSummary,
            priority: bool(thread.priority),
            archived: bool(thread.archived),
            outcomes: join(thread.outcomes || []),
            updated_at: thread.updatedAt ? new Date(thread.updatedAt).toISOString() : '',

            full_name: snapshot.fullName || '',
            role: optionLabel(roleLabels, snapshot.role),
            company_size: snapshot.companySize || '',
            operating_country: snapshot.operatingCountry || '',
            industry: snapshot.industry || '',
            region: snapshot.region ? (regionLabels[snapshot.region] || snapshot.region) : '',

            pressure_sources: join(dashLabelsFromIds(snapshot.pressureSources, pressureLabels)),
            urgent_win: optionLabel(urgentWinOpts, snapshot.urgentWin),
            risk_environments: join(dashLabelsFromIds(snapshot.riskEnvs, riskLabels)),
            measured_on_today: optionLabel(measuredOnOpts, snapshot.measuredOn),
            organisation_pain: optionLabel(orgPainOpts, snapshot.orgPain),
            drivers: join(dashLabelsFromIds(snapshot.drivers, driverLabels)),
            evidence_audience: join(dashLabelsFromIds(snapshot.evidence, evidenceOpts)),

            coverage_groups: join(dashLabelsFromIds(snapshot.groups, groupOpts)),
            cadence: optionLabel(rhythmOpts, snapshot.rhythm),
            measurement: optionLabel(measureOpts, snapshot.measure),
            fit_realism: optionLabel(fitRealismOpts, snapshot.fitRealism),
            fit_scope: optionLabel(fitScopeOpts, snapshot.fitScope),
            fit_today: optionLabel(fitTodayOpts, snapshot.fitToday),
            fit_services: optionLabel(fitServicesOpts, snapshot.fitServices),
            fit_risk_frame: optionLabel(fitRiskFrameOpts, snapshot.fitRiskFrame),
            regulations: join(dashLabelsFromIds(snapshot.regs, regMaster)),
            stack: join(stackList),

            currency: snapshot.currency || '',
            revenue_b_usd: val(snapshot.revenueB),
            spend_usd_annual: val(snapshot.investUSD),
            team_cyber: val(snapshot.teamCyber),
            team_dev: val(snapshot.teamDev),
            team_workforce: val(snapshot.teamWf),
            roi_pct_3yr: val(thread && thread.viz && thread.viz.roiPct),
            npv_usd_3yr: val(thread && thread.viz && thread.viz.npv),
            payback_months: val(thread && thread.viz && thread.viz.paybackMonths),

            outcomes_json: toJson(thread && thread.outcomes),
            gaps_json: toJson(progress && progress.gaps),
            modules_json: toJson(thread && thread.modules),
            snapshot_json: toJson(snapshot),
            viz_json: toJson(thread && thread.viz),
            record_json: toJson(thread)
          };
        });

        const cols = table.length ? Object.keys(table[0]) : [];
        if(!cols.length) return '';

        const esc = (s)=>{
          const str = String(s ?? '');
          if(/[",\n]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
          return str;
        };
        const header = cols.map(esc).join(',');
        const lines = table.map((row)=> cols.map((col)=> esc(row[col])).join(','));
        return [header].concat(lines).join('\n') + '\n';
      }

      function exportAllRecordsCsv(){
        const rows = threadModels();
        if(!rows.length){
          toast('No records available to export.');
          return;
        }
        const csv = buildThreadsCsv(rows);
        if(!csv){
          toast('No records available to export.');
          return;
        }
        const day = new Date().toISOString().slice(0, 10);
        const filename = `immersive-records-high-fidelity-${day}.csv`;
        downloadText(csv, filename, 'text/csv;charset=utf-8;');
        toast(`Exported ${rows.length} records (high fidelity CSV).`);
      }

      function csvCanonicalKey(raw){
        return String(raw || '')
          .replace(/^\uFEFF/, '')
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '');
      }

      function parseCsvMatrix(text){
        const src = String(text || '');
        if(!src.trim()) return [];
        const rows = [];
        let row = [];
        let cell = '';
        let inQuotes = false;
        let idx = 0;

        while(idx < src.length){
          const ch = src[idx];
          if(inQuotes){
            if(ch === '"'){
              if(src[idx + 1] === '"'){
                cell += '"';
                idx += 2;
                continue;
              }
              inQuotes = false;
              idx += 1;
              continue;
            }
            cell += ch;
            idx += 1;
            continue;
          }

          if(ch === '"'){
            inQuotes = true;
            idx += 1;
            continue;
          }
          if(ch === ','){
            row.push(cell);
            cell = '';
            idx += 1;
            continue;
          }
          if(ch === '\n'){
            row.push(cell);
            rows.push(row);
            row = [];
            cell = '';
            idx += 1;
            continue;
          }
          if(ch === '\r'){
            idx += 1;
            continue;
          }
          cell += ch;
          idx += 1;
        }

        row.push(cell);
        if(row.length > 1 || row[0] !== '' || rows.length === 0){
          rows.push(row);
        }
        if(rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === ''){
          rows.pop();
        }
        return rows;
      }

      function csvObjectsFromText(text){
        const matrix = parseCsvMatrix(text);
        if(matrix.length < 2) return [];
        const headers = matrix[0].map((header)=> csvCanonicalKey(header));
        if(!headers.some(Boolean)) return [];
        const out = [];
        matrix.slice(1).forEach((cells)=>{
          const row = {};
          let hasValue = false;
          headers.forEach((header, idx)=>{
            if(!header) return;
            const value = String((cells && cells[idx]) ?? '');
            row[header] = value;
            if(value.trim()) hasValue = true;
          });
          if(hasValue) out.push(row);
        });
        return out;
      }

      function csvRowValue(row, keys){
        const source = (row && typeof row === 'object') ? row : {};
        const list = Array.isArray(keys) ? keys : [keys];
        for(const key of list){
          const canon = csvCanonicalKey(key);
          if(!canon) continue;
          if(Object.prototype.hasOwnProperty.call(source, canon)){
            return String(source[canon] ?? '');
          }
        }
        return '';
      }

      function csvListValues(raw){
        const src = String(raw || '').replace(/\u2022/g, '·').trim();
        if(!src) return [];
        let parts = src.split(/[;|]/);
        if(parts.length === 1 && src.includes('·')){
          parts = src.split('·');
        }
        if(parts.length === 1 && src.includes(',')){
          const commaParts = src.split(',').map((part)=> part.trim()).filter(Boolean);
          parts = commaParts.some((part)=> part.length > 36) ? [src] : commaParts;
        }
        return parts.map((part)=> part.trim().replace(/\s+/g, ' ')).filter(Boolean);
      }

      function csvBoolValue(raw){
        const val = String(raw || '').trim().toLowerCase();
        return val === 'true' || val === '1' || val === 'yes' || val === 'y';
      }

      function csvPercentValue(raw){
        const m = String(raw || '').match(/-?\d+(?:\.\d+)?/);
        if(!m) return null;
        return clamp(Math.round(Number(m[0]) || 0), 0, 100);
      }

      function csvCompletionSummary(completionRaw, pctRaw){
        const completion = String(completionRaw || '').trim();
        if(completion){
          const slash = completion.match(/(\d+)\s*\/\s*(\d+)/);
          const pctFromCompletion = csvPercentValue(completion);
          if(slash){
            const done = Math.max(0, Number(slash[1]) || 0);
            const total = Math.max(1, Number(slash[2]) || 22);
            const pct = (pctFromCompletion === null)
              ? clamp(Math.round((done / total) * 100), 0, 100)
              : pctFromCompletion;
            return `${done}/${total} (${pct}%)`;
          }
          if(pctFromCompletion !== null){
            const done = Math.round((pctFromCompletion / 100) * 22);
            return `${done}/22 (${pctFromCompletion}%)`;
          }
        }
        const pct = csvPercentValue(pctRaw);
        if(pct !== null){
          const done = Math.round((pct / 100) * 22);
          return `${done}/22 (${pct}%)`;
        }
        return '0/22 (0%)';
      }

      function csvTryJson(raw){
        const value = String(raw || '').trim();
        if(!value) return null;
        try{
          return JSON.parse(value);
        }catch(err){
          return null;
        }
      }

      function csvRegionCode(raw){
        const value = String(raw || '').trim();
        if(!value) return '';
        const upper = value.toUpperCase();
        if(upper === 'NA' || upper === 'UKI' || upper === 'EU' || upper === 'APAC') return upper;
        if(upper === 'OTHER') return 'Other';
        const norm = value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        const map = {
          'north america': 'NA',
          'uk ireland': 'UKI',
          'uk and ireland': 'UKI',
          'europe': 'EU',
          'europe eu': 'EU',
          'apac': 'APAC',
          'asia pacific': 'APAC',
          'other': 'Other',
          'other global': 'Other',
          'global': 'Other'
        };
        return map[norm] || '';
      }

      function csvGapsFromRow(row){
        const fromJson = csvTryJson(csvRowValue(row, ['gaps_json']));
        if(Array.isArray(fromJson)){
          return fromJson.map((gap)=> ({
            title: String((gap && gap.title) || 'Gap'),
            why: String((gap && gap.why) || ''),
            step: clamp(Number(gap && gap.step) || 1, 1, 6)
          }));
        }

        const summary = csvRowValue(row, ['gap_summary', 'remaining_gaps', 'gaps']);
        const parts = csvListValues(summary);
        if(parts.length){
          return parts.map((title)=> ({
            title,
            why: 'This input is still needed to complete the readiness profile.',
            step: 1
          }));
        }

        const openGaps = Math.max(0, Number(csvRowValue(row, ['open_gaps'])) || 0);
        if(!openGaps) return [];
        return Array.from({ length: openGaps }, (_, idx)=> ({
          title: `Gap ${idx + 1}`,
          why: 'This input is still needed to complete the readiness profile.',
          step: 1
        }));
      }

      function csvThreadFromRow(row, idx){
        const recordJson = csvTryJson(csvRowValue(row, ['record_json']));
        if(recordJson && typeof recordJson === 'object' && !Array.isArray(recordJson)){
          return recordJson;
        }

        const company = String(csvRowValue(row, ['company', 'company_name', 'account_company']) || '').trim();
        if(!company) return null;

        const outcomes = csvListValues(csvRowValue(row, ['outcomes', 'key_outcomes', 'outcomes_text']));
        const gaps = csvGapsFromRow(row);
        const gapSummary = String(csvRowValue(row, ['gap_summary', 'remaining_gaps']) || '').trim()
          || (gaps.length ? gaps.slice(0, 2).map((gap)=> gap.title).join(' · ') : 'No open gaps');

        const snapshotJson = csvTryJson(csvRowValue(row, ['snapshot_json']));
        const modulesJson = csvTryJson(csvRowValue(row, ['modules_json']));
        const vizJson = csvTryJson(csvRowValue(row, ['viz_json']));

        const snapshot = (snapshotJson && typeof snapshotJson === 'object' && !Array.isArray(snapshotJson))
          ? snapshotJson
          : {
              fullName: String(csvRowValue(row, ['full_name', 'name']) || '').trim(),
              company,
              role: optionIdFromAny(roleOpts, csvRowValue(row, ['role'])),
              companySize: String(csvRowValue(row, ['company_size']) || '').trim(),
              operatingCountry: String(csvRowValue(row, ['operating_country', 'country']) || '').trim(),
              industry: String(csvRowValue(row, ['industry']) || '').trim(),
              region: csvRegionCode(csvRowValue(row, ['region'])),
              activeStep: 1,
              visited: [1]
            };

        const fallbackRoiPct = csvPercentValue(csvRowValue(row, ['roi_pct_3yr', 'roi_3yr_pct']));
        const fallbackNpv = Number(String(csvRowValue(row, ['npv_usd_3yr', 'npv_3yr']) || '').replace(/[^0-9.-]/g, ''));
        const fallbackPayback = Number(String(csvRowValue(row, ['payback_months']) || '').replace(/[^0-9.-]/g, ''));
        const fallbackSpend = Number(String(csvRowValue(row, ['spend_usd_annual', 'indicative_spend']) || '').replace(/[^0-9.-]/g, ''));
        const viz = (vizJson && typeof vizJson === 'object' && !Array.isArray(vizJson))
          ? vizJson
          : {
              roiPct: fallbackRoiPct === null ? undefined : fallbackRoiPct,
              npv: Number.isFinite(fallbackNpv) ? fallbackNpv : undefined,
              spend: Number.isFinite(fallbackSpend) ? fallbackSpend : undefined,
              paybackMonths: Number.isFinite(fallbackPayback) ? fallbackPayback : null
            };

        const updatedRaw = csvRowValue(row, ['updated_at', 'last_updated']);
        const updatedAt = Number(new Date(updatedRaw).getTime()) || Date.now() - (idx * 60000);
        const idFromCsv = String(csvRowValue(row, ['record_id', 'id']) || `imported-${idx + 1}`).trim();

        return {
          id: idFromCsv || `imported-${idx + 1}`,
          company,
          stage: String(csvRowValue(row, ['stage']) || '').trim() || 'Discovery',
          completion: csvCompletionSummary(csvRowValue(row, ['completion']), csvRowValue(row, ['completion_pct', 'completion_percent'])),
          tier: String(csvRowValue(row, ['tier', 'recommended_tier']) || '').trim() || 'Core',
          outcomes,
          outcomesText: outcomes.length ? outcomes.join(' · ') : 'Awaiting outcome signals',
          gapSummary,
          gaps,
          modules: (modulesJson && typeof modulesJson === 'object' && !Array.isArray(modulesJson)) ? modulesJson : undefined,
          snapshot,
          viz,
          updatedAt,
          priority: csvBoolValue(csvRowValue(row, ['priority', 'starred'])),
          archived: csvBoolValue(csvRowValue(row, ['archived'])),
          archivedAt: 0
        };
      }

      function importWorkspaceCsvText(csvText, sourceName){
        const rows = csvObjectsFromText(csvText);
        if(!rows.length){
          throw new Error('No CSV rows found.');
        }
        const imported = rows
          .map((row, idx)=> csvThreadFromRow(row, idx))
          .filter(Boolean);
        if(!imported.length){
          throw new Error('No valid records found. Include a company column or record_json payload.');
        }
        const label = String(sourceName || 'CSV').trim() || 'CSV';
        applyWorkspaceThreadPortfolio(imported, {
          profileStorageValue: 'uploaded_csv',
          toastMessage: `Imported ${imported.length} records from ${label}.`
        });
      }

      function importWorkspaceCsvFile(file){
        const src = file;
        if(!src) return;
        const reader = new FileReader();
        reader.onload = ()=>{
          try{
            importWorkspaceCsvText(String(reader.result || ''), src.name || 'CSV');
          }catch(err){
            toast(err && err.message ? err.message : 'Unable to import CSV.');
          }
        };
        reader.onerror = ()=>{
          toast('Could not read the selected CSV file.');
        };
        reader.readAsText(src);
      }

      function jsonClone(value){
        try{
          return JSON.parse(JSON.stringify(value));
        }catch(err){
          return null;
        }
      }

      function completionPctFromSummary(completion){
        const m = String(completion || '').match(/\((\d+)\s*%\)/);
        return m ? clamp(Number(m[1]) || 0, 0, 100) : 0;
      }

      function defaultSnapshotForThread(thread){
        const pct = completionPctFromSummary(thread && thread.completion);
        let visitedMax = 1;
        if(pct >= 100) visitedMax = 6;
        else if(pct >= 80) visitedMax = 5;
        else if(pct >= 60) visitedMax = 4;
        else if(pct >= 40) visitedMax = 2;
        const firstGap = Number(thread && thread.gaps && thread.gaps[0] && thread.gaps[0].step);
        return {
          fullName: 'Will Bloor',
          company: (thread && thread.company) ? String(thread.company) : 'Record',
          role: 'ciso',
          activeStep: clamp(Number.isFinite(firstGap) ? firstGap : visitedMax, 1, 6),
          visited: Array.from({ length: visitedMax }, (_, idx)=> idx + 1)
        };
      }

      function normalizeThreadModel(raw, idx){
        const source = (raw && typeof raw === 'object') ? raw : {};
        const outcomes = Array.isArray(source.outcomes)
          ? source.outcomes.map((it)=> String(it || '').trim()).filter(Boolean)
          : [];
        const gaps = Array.isArray(source.gaps)
          ? source.gaps.map((gap)=> ({
              title: String((gap && gap.title) || 'Gap'),
              why: String((gap && gap.why) || ''),
              step: clamp(Number(gap && gap.step) || 1, 1, 6)
            }))
          : [];
        const modulesIn = (source.modules && typeof source.modules === 'object') ? source.modules : {};
        const modules = {
          organisation: Array.isArray(modulesIn.organisation) ? modulesIn.organisation : [{ label:'Company', value: source.company || 'Record' }],
          discovery: Array.isArray(modulesIn.discovery) ? modulesIn.discovery : [{ label:'Primary outcomes', value: outcomes.join(' · ') || '—' }],
          coverage: Array.isArray(modulesIn.coverage) ? modulesIn.coverage : [{ label:'Coverage groups', value:'—' }],
          packageFit: Array.isArray(modulesIn.packageFit) ? modulesIn.packageFit : [{ label:'Delivery model', value:'—' }],
          context: Array.isArray(modulesIn.context) ? modulesIn.context : [{ label:'Region', value:'—' }]
        };
        const vizIn = (source.viz && typeof source.viz === 'object') ? source.viz : {};
        const snapshot = (source.snapshot && typeof source.snapshot === 'object')
          ? source.snapshot
          : defaultSnapshotForThread({ company: source.company, completion: source.completion, gaps });

        return {
          id: String(source.id || `record-${idx + 1}`),
          company: String(source.company || 'Record'),
          stage: String(source.stage || 'Discovery'),
          completion: String(source.completion || '0/22 (0%)'),
          tier: String(source.tier || 'Core'),
          outcomes,
          outcomesText: String(source.outcomesText || (outcomes.length ? outcomes.join(' · ') : 'Awaiting outcome signals')),
          gapSummary: String(source.gapSummary || (gaps.length ? gaps.slice(0,2).map((g)=> g.title).join(' · ') : 'No open gaps')),
          gaps,
          modules: jsonClone(modules) || modules,
          viz: {
            roiPct: Number(vizIn.roiPct),
            npv: Number(vizIn.npv),
            spend: Number(vizIn.spend),
            paybackMonths: (vizIn.paybackMonths === null || vizIn.paybackMonths === undefined) ? null : Number(vizIn.paybackMonths),
            outcomeBreakdown: Array.isArray(vizIn.outcomeBreakdown)
              ? vizIn.outcomeBreakdown
                  .map((row)=> ({
                    label: String((row && row.label) || '').trim(),
                    pct: clamp(Number(row && row.pct) || 0, 0, 100)
                  }))
                  .filter((row)=> row.label)
              : []
          },
          snapshot: jsonClone(snapshot) || defaultSnapshotForThread(source),
          updatedAt: Number(source.updatedAt) || 0,
          priority: !!source.priority,
          archived: !!source.archived,
          archivedAt: Number(source.archivedAt) || 0
        };
      }

      function loadSavedThreadsFromStorage(){
        try{
          const raw = window.localStorage.getItem(THREAD_STORAGE_KEY);
          if(!raw) return [];
          const parsed = JSON.parse(raw);
          if(!Array.isArray(parsed)) return [];
          return parsed.map((thread, idx)=> normalizeThreadModel(thread, idx));
        }catch(err){
          return [];
        }
      }

      function persistSavedThreads(){
        try{
          window.localStorage.setItem(THREAD_STORAGE_KEY, JSON.stringify(state.savedThreads || []));
        }catch(err){
          // Ignore storage failures (private mode / blocked storage).
        }
      }

      function ensureSavedThreadsLoaded(){
        if(state.savedThreadsLoaded) return;
        const stored = loadSavedThreadsFromStorage();
        if(stored.length){
          state.savedThreads = stored;
        }else{
          state.savedThreads = staticThreadModels().map((thread, idx)=> normalizeThreadModel(thread, idx));
          persistSavedThreads();
        }
        state.savedThreadsLoaded = true;
      }

      function findSavedThread(threadId){
        ensureSavedThreadsLoaded();
        return (state.savedThreads || []).find((thread)=> thread.id === threadId) || null;
      }

      function nextSavedThreadId(){
        const stamp = Date.now().toString(36);
        const rand = Math.random().toString(36).slice(2, 7);
        return `record-${stamp}-${rand}`;
      }

      function buildThreadSnapshotFromState(){
        return {
          role: state.role,
          fullName: state.fullName,
          company: state.company,
          companySize: state.companySize,
          operatingCountry: state.operatingCountry,
          industry: state.industry,
          region: state.region,
          pressureSources: Array.from(state.pressureSources || []),
          urgentWin: state.urgentWin,
          riskEnvs: Array.from(state.riskEnvs || []),
          measuredOn: state.measuredOn,
          orgPain: state.orgPain,
          drivers: Array.from(state.drivers || []),
          milestone: state.milestone,
          evidence: Array.from(state.evidence || []),
          outcomeDrilldowns: jsonClone(state.outcomeDrilldowns || {}) || {},
          groups: Array.from(state.groups || []),
          rhythm: state.rhythm,
          measure: state.measure,
          fitRealism: state.fitRealism,
          fitScope: state.fitScope,
          fitToday: state.fitToday,
          fitServices: state.fitServices,
          fitRiskFrame: state.fitRiskFrame,
          regMode: state.regMode,
          regModeTouched: !!state.regModeTouched,
          regSearch: state.regSearch,
          regsTouched: !!state.regsTouched,
          regs: Array.from(state.regs || []),
          stack: Array.from(state.stack || []),
          stackOther: state.stackOther,
          currency: state.currency,
          fx: { USD: 1, GBP: Number(state.fx.GBP) || 0.80, EUR: Number(state.fx.EUR) || 0.90 },
          revenueB: Number(state.revenueB) || IMMERSIVE_MODEL.baselineRevenueB,
          investUSD: Number(state.investUSD) || IMMERSIVE_MODEL.baselineInvestment,
          investManual: !!state.investManual,
          teamCyber: Number(state.teamCyber) || IMMERSIVE_MODEL.baselineCyber,
          teamDev: Number(state.teamDev) || IMMERSIVE_MODEL.baselineDev,
          teamWf: Number(state.teamWf) || IMMERSIVE_MODEL.baselineWorkforce,
          teamManual: !!state.teamManual,
          realization: state.realization,
          paybackDelayMonths: Number(state.paybackDelayMonths) || 0,
          cyberSalaryUSD: Number(state.cyberSalaryUSD) || 180000,
          devSalaryUSD: Number(state.devSalaryUSD) || 160000,
          email: state.email,
          phone: state.phone,
          notes: state.notes,
          optin: !!state.optin,
          activeStep: clamp(Number(state.activeStep) || 1, 1, 6),
          visited: Array.from(state.visited || [1])
        };
      }

      function buildSavedVizFromState(){
        const viz = interVizModel({ id:'current' });
        return {
          roiPct: Number(viz && viz.roiPct),
          npv: Number(viz && viz.npv),
          spend: Number(viz && viz.spend),
          paybackMonths: (viz && (viz.paybackMonths === null || viz.paybackMonths === undefined)) ? null : Number(viz && viz.paybackMonths),
          outcomeBreakdown: Array.isArray(viz && viz.outcomeBreakdown)
            ? viz.outcomeBreakdown
                .map((row)=> ({
                  label: String((row && row.label) || '').trim(),
                  pct: clamp(Number(row && row.pct) || 0, 0, 100)
                }))
                .filter((row)=> row.label)
            : []
        };
      }

      function buildSavedThreadFromState(threadId, meta){
        const summary = currentThreadModel();
        const metaIn = (meta && typeof meta === 'object') ? meta : {};
        return normalizeThreadModel({
          id: threadId || nextSavedThreadId(),
          company: summary.company,
          stage: summary.stage,
          completion: summary.completion,
          tier: summary.tier,
          outcomes: summary.outcomes,
          outcomesText: summary.outcomesText,
          gapSummary: summary.gapSummary,
          gaps: summary.gaps,
          modules: summary.modules,
          viz: buildSavedVizFromState(),
          snapshot: buildThreadSnapshotFromState(),
          updatedAt: Date.now(),
          priority: !!metaIn.priority,
          archived: !!metaIn.archived,
          archivedAt: Number(metaIn.archivedAt) || 0
        }, 0);
      }

      function applyThreadSnapshot(snapshot, opts){
        const snap = (snapshot && typeof snapshot === 'object') ? snapshot : {};
        const cfg = opts || {};
        state.savePulseUntil = 0;
        state.saveIsThinking = false;
        clearScheduledAutoSave();

        state.role = snap.role || '';
        state.fullName = snap.fullName || '';
        state.company = (snap.company && String(snap.company).trim()) ? String(snap.company).trim() : '';
        state.companySize = snap.companySize || '';
        state.operatingCountry = snap.operatingCountry || '';
        state.industry = snap.industry || '';
        state.region = snap.region || '';
        state._industryChanged = false;
        state._regionChanged = false;

        state.pressureSources = Array.from(new Set(Array.isArray(snap.pressureSources) ? snap.pressureSources : [])).slice(0,3);
        state.urgentWin = snap.urgentWin || '';
        state.riskEnvs = Array.from(new Set(Array.isArray(snap.riskEnvs) ? snap.riskEnvs : [])).slice(0,2);
        state.measuredOn = snap.measuredOn || '';
        state.orgPain = snap.orgPain || '';
        state.drivers = Array.from(new Set(Array.isArray(snap.drivers) ? snap.drivers : [])).slice(0,3);
        state.milestone = snap.milestone || '';
        state.evidence = new Set(Array.isArray(snap.evidence) ? snap.evidence : []);
        state.outcomeDrilldowns = (snap.outcomeDrilldowns && typeof snap.outcomeDrilldowns === 'object')
          ? jsonClone(snap.outcomeDrilldowns) || {}
          : {};

        state.groups = new Set(Array.isArray(snap.groups) ? snap.groups : []);
        state.rhythm = snap.rhythm || '';
        state.measure = snap.measure || '';
        state.fitRealism = snap.fitRealism || '';
        state.fitScope = snap.fitScope || '';
        state.fitToday = snap.fitToday || '';
        state.fitServices = snap.fitServices || '';
        state.fitRiskFrame = snap.fitRiskFrame || '';

        state.regMode = (snap.regMode === 'all') ? 'all' : 'suggested';
        state.regModeTouched = !!snap.regModeTouched;
        state.regSearch = snap.regSearch || '';
        state.regsTouched = (typeof snap.regsTouched === 'boolean')
          ? snap.regsTouched
          : (Array.isArray(snap.regs) && snap.regs.length > 0);
        state.regs = new Set(Array.isArray(snap.regs) ? snap.regs : []);
        state.stack = new Set(Array.isArray(snap.stack) ? snap.stack : []);
        state.stackOther = snap.stackOther || '';

        state.currency = (snap.currency === 'GBP' || snap.currency === 'EUR') ? snap.currency : 'USD';
        const fx = (snap.fx && typeof snap.fx === 'object') ? snap.fx : {};
        state.fx.GBP = (Number.isFinite(Number(fx.GBP)) && Number(fx.GBP) > 0) ? Number(fx.GBP) : 0.80;
        state.fx.EUR = (Number.isFinite(Number(fx.EUR)) && Number(fx.EUR) > 0) ? Number(fx.EUR) : 0.90;
        state.revenueB = Number.isFinite(Number(snap.revenueB)) ? Number(snap.revenueB) : IMMERSIVE_MODEL.baselineRevenueB;
        state.investUSD = Number.isFinite(Number(snap.investUSD)) ? Number(snap.investUSD) : IMMERSIVE_MODEL.baselineInvestment;
        state.investManual = !!snap.investManual;
        state.teamCyber = Number.isFinite(Number(snap.teamCyber)) ? Number(snap.teamCyber) : IMMERSIVE_MODEL.baselineCyber;
        state.teamDev = Number.isFinite(Number(snap.teamDev)) ? Number(snap.teamDev) : IMMERSIVE_MODEL.baselineDev;
        state.teamWf = Number.isFinite(Number(snap.teamWf)) ? Number(snap.teamWf) : IMMERSIVE_MODEL.baselineWorkforce;
        state.teamManual = !!snap.teamManual;
        state.realization = (snap.realization === 'expected' || snap.realization === 'immersive') ? snap.realization : 'conservative';
        state.paybackDelayMonths = Number.isFinite(Number(snap.paybackDelayMonths)) ? Number(snap.paybackDelayMonths) : 3;
        state.cyberSalaryUSD = Number.isFinite(Number(snap.cyberSalaryUSD)) ? Number(snap.cyberSalaryUSD) : 180000;
        state.devSalaryUSD = Number.isFinite(Number(snap.devSalaryUSD)) ? Number(snap.devSalaryUSD) : 160000;

        state.email = snap.email || '';
        state.phone = snap.phone || '';
        state.notes = snap.notes || '';
        state.optin = !!snap.optin;

        const visitedRaw = Array.isArray(snap.visited) ? snap.visited : [1];
        state.visited = new Set(
          visitedRaw
            .map((v)=> clamp(Number(v) || 1, 1, 6))
        );
        if(!state.visited.size) state.visited.add(1);

        const nextStep = clamp(Number(cfg.step || snap.activeStep) || 1, 1, 6);
        state.activeStep = nextStep;

        syncFormControlsFromState();
        setActiveStep(nextStep);
      }

      function saveActiveRecord(opts){
        const cfg = Object.assign({ quiet:false, auto:false, thinkMs:560 }, opts || {});
        if(state.saveIsThinking) return false;
        clearScheduledAutoSave();

        const commitSave = ()=>{
          ensureSavedThreadsLoaded();
          const existing = (state.activeThread && state.activeThread !== 'current') ? findSavedThread(state.activeThread) : null;
          const recordId = existing ? existing.id : nextSavedThreadId();
          const nextThread = buildSavedThreadFromState(recordId, existing ? {
            priority: !!existing.priority,
            archived: !!existing.archived,
            archivedAt: Number(existing.archivedAt) || 0
          } : null);
          const idx = state.savedThreads.findIndex((thread)=> thread.id === nextThread.id);
          if(idx >= 0){
            state.savedThreads[idx] = nextThread;
          }else{
            state.savedThreads.unshift(nextThread);
          }
          state.activeThread = nextThread.id;
          state.saveIsThinking = false;
          state.savePulseUntil = Date.now() + 1600;
          persistSavedThreads();
          update();
          window.setTimeout(()=>{
            if(Date.now() >= state.savePulseUntil) update();
          }, 1650);
          if(!cfg.quiet){
            toast('Record saved.');
          }
          if(state.currentView === 'configurator'){
            requestAutoSave(AUTO_SAVE_BASE_MS);
          }
        };

        const thinkMs = Math.max(0, Number(cfg.thinkMs) || 0);
        if(thinkMs > 0){
          state.saveIsThinking = true;
          state.savePulseUntil = 0;
          update();
          window.setTimeout(commitSave, thinkMs);
        }else{
          commitSave();
        }
        return true;
      }

      function threadModels(){
        ensureSavedThreadsLoaded();
        return (state.savedThreads || []).slice();
      }

      function activeThreadModel(){
        ensureSavedThreadsLoaded();
        if(state.activeThread && state.activeThread !== 'current'){
          const saved = findSavedThread(state.activeThread);
          if(saved) return saved;
        }
        return currentThreadModel();
      }

      function dashboardSortThreads(rows){
        return (rows || []).slice().sort((a, b)=>{
          const byPriority = Number(!!b.priority) - Number(!!a.priority);
          if(byPriority) return byPriority;
          const byUpdated = Number(b.updatedAt || 0) - Number(a.updatedAt || 0);
          if(byUpdated) return byUpdated;
          return String(a.company || '').localeCompare(String(b.company || ''));
        });
      }

      function dashboardRowsModel(){
        const filtered = threadModels().filter((thread)=> !thread.archived);
        return dashboardSortThreads(filtered).map((thread)=> {
          const progress = threadReadinessProgress(thread);
          return ({
          id: thread.id,
          company: thread.company,
          completion: progress.completion,
          tier: thread.tier,
          outcomes: thread.outcomesText,
          gaps: progress.gapSummary,
          priority: !!thread.priority,
          openLabel: 'Open overview'
        });
        });
      }

      function archivedRowsModel(){
        const filtered = threadModels().filter((thread)=> !!thread.archived);
        return dashboardSortThreads(filtered).map((thread)=> {
          const progress = threadReadinessProgress(thread);
          return ({
          id: thread.id,
          company: thread.company,
          completion: progress.completion,
          tier: thread.tier,
          outcomes: thread.outcomesText,
          gaps: progress.gapSummary,
          openLabel: 'Open overview'
        });
        });
      }

      function renderWorkspaceCompanies(){
        const host = $('#workspaceCompaniesList');
        const countEl = $('#workspaceCompaniesCount');
        if(!host) return;
        if(!(state.workspaceCompanyAnimatedIds instanceof Set)){
          state.workspaceCompanyAnimatedIds = new Set();
        }

        const starredRows = dashboardSortThreads(
          threadModels().filter((thread)=> !thread.archived && !!thread.priority)
        );
        const rows = starredRows.slice();
        const previewId = String(state.navPreviewThreadId || '').trim();
        if(previewId){
          const previewThread = findSavedThread(previewId);
          const alreadyVisible = rows.some((thread)=> thread.id === previewId);
          if(previewThread && !previewThread.archived && !previewThread.priority && !alreadyVisible){
            rows.unshift(previewThread);
          }
        }
        const visibleNavIds = new Set(rows.map((thread)=> thread.id));
        state.workspaceCompanyAnimatedIds = new Set(
          Array.from(state.workspaceCompanyAnimatedIds || []).filter((id)=> visibleNavIds.has(id))
        );
        if(countEl) countEl.textContent = String(starredRows.length);

        if(!rows.length){
          host.innerHTML = '<p class="workspaceCompaniesEmpty">No starred companies yet. Star a record to pin it here.</p>';
          return;
        }

        const newAnimatedIds = [];
        host.innerHTML = rows.map((thread, idx)=>{
          const progress = threadReadinessProgress(thread);
          const pct = completionPctFromSummary(progress.completion);
          const active = (state.activeThread === thread.id && (state.currentView === 'interstitial' || state.currentView === 'configurator'));
          const isStarred = !!thread.priority;
          const animateStar = isStarred && !!state.starPulseQueue && state.starPulseQueue.has(thread.id);
          const shouldAnimateEntry = !state.workspaceCompanyAnimatedIds.has(thread.id);
          if(shouldAnimateEntry) newAnimatedIds.push(thread.id);
          const star = isStarred
            ? `<span class="workspacePriorityStar${animateStar ? ' is-animate' : ''}" aria-hidden="true">★</span>`
            : '';
          return `
            <button type="button" class="workspaceCompanyBtn${shouldAnimateEntry ? ' is-enter' : ''}" style="--nav-enter-delay:${Math.min(idx, 10) * 34}ms;" data-company-open="${escapeHtml(thread.id)}" data-active="${active ? 'true' : 'false'}" title="Open ${escapeHtml(thread.company)} overview">
              <span class="workspaceCompanyName">${star}<span class="workspaceCompanyNameLabel">${escapeHtml(thread.company)}</span></span>
              <span class="workspaceCompanyMeta">${pct}% complete · ${escapeHtml(thread.tier)}</span>
            </button>
          `;
        }).join('');
        newAnimatedIds.forEach((id)=> state.workspaceCompanyAnimatedIds.add(id));
      }

      function renderArchiveNavMeta(){
        const sub = $('#workspaceArchiveSub');
        if(!sub) return;
        const archivedCount = threadModels().filter((thread)=> !!thread.archived).length;
        sub.textContent = archivedCount > 0 ? `Archived accounts · ${archivedCount}` : 'Archived accounts';
      }

      function toggleThreadPriority(threadId){
        const thread = findSavedThread(threadId);
        if(!thread) return;
        thread.priority = !thread.priority;
        if(thread.priority){
          if(!(state.starPulseQueue instanceof Set)) state.starPulseQueue = new Set();
          state.starPulseQueue.add(threadId);
          if(state.navPreviewThreadId === threadId) state.navPreviewThreadId = null;
        }else if(state.starPulseQueue instanceof Set){
          state.starPulseQueue.delete(threadId);
          if(state.navPreviewThreadId === threadId) state.navPreviewThreadId = null;
        }
        thread.updatedAt = Date.now();
        persistSavedThreads();
        update();
      }

      function renameThreadCompany(threadId, rawName){
        const nextName = String(rawName || '').trim();
        const resolved = nextName || 'Untitled company';
        let changed = false;

        if(threadId && threadId !== 'current'){
          ensureSavedThreadsLoaded();
          const idx = (state.savedThreads || []).findIndex((thread)=> thread.id === threadId);
          if(idx >= 0){
            const existing = state.savedThreads[idx];
            const existingCompany = String((existing && existing.company) || '').trim();
            const existingSnapshotCompany = String((existing && existing.snapshot && existing.snapshot.company) || '').trim();
            const replaced = replaceThreadCompany(existing, resolved);
            const normalized = normalizeThreadModel(Object.assign({}, replaced, {
              updatedAt: Date.now()
            }), idx);
            state.savedThreads[idx] = normalized;
            changed = existingCompany !== resolved || existingSnapshotCompany !== resolved;
            if(state.activeThread === normalized.id){
              state.company = resolved;
            }
          }
        }else if(state.company !== resolved){
          state.company = resolved;
          changed = true;
        }else{
          state.company = resolved;
        }

        if(changed && threadId && threadId !== 'current'){
          persistSavedThreads();
        }
        return { changed, name: resolved };
      }

      function closeArchivePrompt(){
        archivePromptMode = 'archive';
        archivePromptIds = [];
        $('#archiveModal')?.classList.remove('show');
      }

      function openArchivePrompt(ids, mode){
        const uniq = Array.from(new Set((ids || []).map((id)=> String(id || '').trim()).filter(Boolean)));
        const validIds = uniq.filter((id)=> !!findSavedThread(id));
        if(!validIds.length) return;

        archivePromptMode = (mode === 'restore' || mode === 'delete') ? mode : 'archive';
        archivePromptIds = validIds;
        const count = validIds.length;
        const verb = archivePromptMode === 'restore'
          ? 'Restore'
          : (archivePromptMode === 'delete' ? 'Delete' : 'Archive');
        const titleEl = $('#archiveModalTitle');
        const bodyEl = $('#archiveModalBody');
        const confirmBtn = $('#archiveModalConfirm');
        if(titleEl) titleEl.textContent = `${verb} ${count === 1 ? 'this record' : `${count} records`}?`;
        if(bodyEl){
          if(archivePromptMode === 'restore'){
            bodyEl.textContent = 'Restored records return to the active dashboard and company list.';
          }else if(archivePromptMode === 'delete'){
            bodyEl.textContent = 'Deleted records are permanently removed from this prototype and cannot be restored.';
          }else{
            bodyEl.textContent = 'Archived records are removed from active lists and can be restored later.';
          }
        }
        if(confirmBtn){
          confirmBtn.textContent = `${verb} ${count === 1 ? 'record' : 'records'}`;
          confirmBtn.classList.toggle('danger', archivePromptMode === 'delete');
          confirmBtn.classList.toggle('primary', archivePromptMode !== 'delete');
        }
        const modal = $('#archiveModal');
        if(modal) modal.classList.add('show');
      }

      function applyArchivePrompt(){
        const ids = Array.from(new Set((archivePromptIds || []).map((id)=> String(id || '').trim()).filter(Boolean)));
        if(!ids.length){
          closeArchivePrompt();
          return;
        }
        const promptMode = archivePromptMode;
        if(promptMode === 'delete'){
          ensureSavedThreadsLoaded();
          const deletedIds = new Set(ids);
          const hadActiveDeleted = deletedIds.has(String(state.activeThread || ''));
          const beforeCount = Array.isArray(state.savedThreads) ? state.savedThreads.length : 0;
          state.savedThreads = (state.savedThreads || []).filter((thread)=> !deletedIds.has(String((thread && thread.id) || '')));
          const touched = Math.max(0, beforeCount - (state.savedThreads || []).length);
          if(hadActiveDeleted){
            state.activeThread = 'current';
            state.navPreviewThreadId = null;
          }
          state.dashboardSelectedIds = new Set();
          state.archivedSelectedIds = new Set();
          persistSavedThreads();
          closeArchivePrompt();
          if(hadActiveDeleted && state.currentView !== 'dashboard'){
            setView('dashboard', { render:false });
          }
          update();
          if(touched > 0){
            toast(`${touched} record${touched === 1 ? '' : 's'} deleted.`);
          }
          return;
        }

        const restoreMode = promptMode === 'restore';
        let touched = 0;
        ids.forEach((id)=>{
          const thread = findSavedThread(id);
          if(!thread) return;
          touched += 1;
          thread.archived = !restoreMode;
          thread.archivedAt = restoreMode ? 0 : Date.now();
          if(!restoreMode) thread.priority = false;
          thread.updatedAt = Date.now();
          if(!restoreMode && state.activeThread === thread.id){
            state.activeThread = 'current';
          }
        });
        if(!restoreMode && state.currentView !== 'dashboard' && state.activeThread === 'current'){
          setView('dashboard', { render:false });
        }
        state.dashboardSelectedIds = new Set();
        state.archivedSelectedIds = new Set();
        persistSavedThreads();
        closeArchivePrompt();
        update();
        if(touched > 0){
          toast(
            restoreMode
              ? `${touched} record${touched === 1 ? '' : 's'} restored.`
              : `${touched} record${touched === 1 ? '' : 's'} archived.`
          );
        }
      }

      function openThreadOverview(threadId){
        const target = threadId || 'current';
        state.activeThread = (target !== 'current' && !findSavedThread(target)) ? 'current' : target;
        if(state.activeThread !== 'current'){
          const thread = findSavedThread(state.activeThread);
          state.navPreviewThreadId = (thread && !thread.archived && !thread.priority) ? thread.id : null;
        }else{
          state.navPreviewThreadId = null;
        }
        setView('interstitial');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      function openThreadConfigurator(threadId, step){
        const target = threadId || state.activeThread || 'current';
        if(target !== 'current'){
          const thread = findSavedThread(target);
          if(thread){
            const threadCompany = String((thread && thread.company) || '').trim();
            const snapshotSource = (thread.snapshot && typeof thread.snapshot === 'object')
              ? thread.snapshot
              : defaultSnapshotForThread(thread);
            const nextSnapshot = jsonClone(snapshotSource) || {};
            const snapshotCompany = String((nextSnapshot && nextSnapshot.company) || '').trim();
            if(threadCompany && threadCompany !== snapshotCompany){
              nextSnapshot.company = threadCompany;
              thread.snapshot = nextSnapshot;
              thread.updatedAt = Date.now();
              persistSavedThreads();
            }
            state.activeThread = target;
            applyThreadSnapshot(nextSnapshot, {
              step: Number(step) || dashboardFirstGapStep(thread)
            });
            return;
          }
        }
        state.activeThread = 'current';
        syncFormControlsFromState();
        setActiveStep(Number(step) || dashboardFirstGapStep(currentThreadModel()));
      }

      function normalizeMatchKey(value){
        return String(value || '')
          .toLowerCase()
          .replace(/&/g, ' and ')
          .replace(/[\u2018\u2019]/g, "'")
          .replace(/[^a-z0-9]+/g, ' ')
          .trim();
      }

      function inferredConsultationOutcomes(thread){
        const source = (thread && typeof thread === 'object') ? thread : {};
        const parts = [];
        if(Array.isArray(source.outcomes)) parts.push(...source.outcomes);
        if(String(source.outcomesText || '').trim()){
          parts.push(...String(source.outcomesText).split('·'));
        }
        if(Array.isArray(source.viz && source.viz.outcomeBreakdown)){
          parts.push(...source.viz.outcomeBreakdown.map((row)=> row && row.label));
        }

        const found = [];
        const used = new Set();
        const tryAdd = (opt)=>{
          if(!opt || used.has(opt.id)) return;
          used.add(opt.id);
          found.push(opt);
        };

        parts
          .map((part)=> normalizeMatchKey(part))
          .filter(Boolean)
          .forEach((needle)=>{
            const match = primaryOutcomeOpts.find((opt)=>{
              const keys = [
                normalizeMatchKey(opt.id),
                normalizeMatchKey(opt.short),
                normalizeMatchKey(opt.label),
                normalizeMatchKey(opt.oneLiner)
              ].filter(Boolean);
              return keys.some((key)=> needle.includes(key) || key.includes(needle));
            });
            if(match) tryAdd(match);
          });

        if(found.length) return found.slice(0, 3);
        return inferredPrimaryOutcomes(3);
      }

      function consultationModelForThread(threadId){
        const target = threadId || state.activeThread || 'current';
        let thread = null;
        const shouldUseLiveState = state.currentView === 'configurator' && (target === 'current' || target === state.activeThread);
        if(shouldUseLiveState){
          thread = currentThreadModel();
        }else if(target !== 'current'){
          thread = findSavedThread(target);
        }
        if(!thread){
          thread = currentThreadModel();
        }
        const resolvedId = (thread && thread.id) ? thread.id : 'current';
        const progress = threadReadinessProgress(thread);
        const completion = String(progress.completion || thread.completion || '0/22 (0%)');
        const outcomes = inferredConsultationOutcomes(thread);
        const agenda = buildNextMeetingAgenda(outcomes);
        const attendees = buildWhoToBring(outcomes);
        const resources = buildRecommendedResources(outcomes);

        const roiPct = Number(thread && thread.viz && thread.viz.roiPct);
        const npv = Number(thread && thread.viz && thread.viz.npv);
        const paybackMonths = Number(thread && thread.viz && thread.viz.paybackMonths);

        const payload = [];
        payload.push(`Recommended package: ${thread.tier || 'Core'}`);
        payload.push(`Current status: ${(thread.stage || 'Discovery')} · ${completion}`);
        if(String(thread.outcomesText || '').trim() && String(thread.outcomesText || '').trim() !== 'Awaiting outcome signals'){
          payload.push(`Primary outcomes: ${String(thread.outcomesText).trim()}`);
        }else if(outcomes.length){
          payload.push(`Primary outcomes: ${outcomes.map((row)=> row.short || row.label).filter(Boolean).join(' · ')}`);
        }else{
          payload.push('Primary outcomes: Outcome confidence pending');
        }
        payload.push(`Open gaps: ${progress.gapSummary || 'No open gaps'}`);
        if(Number.isFinite(roiPct)){
          const roiParts = [`Indicative ROI: ${Math.round(roiPct)}%`];
          if(Number.isFinite(npv)) roiParts.push(`3-year NPV ${fmtMoneyUSD(npv)}`);
          if(Number.isFinite(paybackMonths)) roiParts.push(`payback ${fmtPayback(paybackMonths)}`);
          payload.push(roiParts.join(' · '));
        }

        let topics = (progress.gaps || [])
          .map((gap)=> String((gap && gap.title) || '').trim())
          .filter(Boolean);
        if(!topics.length){
          topics = ['No critical gaps open. Focus on rollout sequencing and stakeholder alignment.'];
        }
        topics = topics.slice(0, 6);

        return {
          threadId: resolvedId,
          company: thread.company || 'Untitled company',
          tier: thread.tier || 'Core',
          stage: thread.stage || 'Discovery',
          completion,
          payload,
          attendees,
          topics,
          agenda,
          resources
        };
      }

      function consultationBriefText(model){
        const rows = (model && typeof model === 'object') ? model : consultationModelForThread(state.consultationThreadId || state.activeThread || 'current');
        const lines = [];
        lines.push(`Consultation Brief — ${rows.company}`);
        lines.push('');
        lines.push(`Tier: ${rows.tier}`);
        lines.push(`Stage: ${rows.stage}`);
        lines.push(`Completion: ${rows.completion}`);
        lines.push('');
        lines.push('Payload for customer:');
        (rows.payload || []).forEach((item)=> lines.push(`- ${item}`));
        lines.push('');
        lines.push('People to invite:');
        (rows.attendees || []).forEach((item)=> lines.push(`- ${item}`));
        lines.push('');
        lines.push('Topics to cover:');
        (rows.topics || []).forEach((item)=> lines.push(`- ${item}`));
        lines.push('');
        lines.push('Proposed agenda:');
        (rows.agenda || []).forEach((item, idx)=> lines.push(`${idx + 1}. ${item}`));
        lines.push('');
        lines.push('Recommended resources:');
        (rows.resources || []).forEach((item)=> lines.push(`- ${item}`));
        return lines.join('\n');
      }

      function renderConsultationPanel(threadId){
        const model = consultationModelForThread(threadId);
        state.consultationThreadId = model.threadId;

        const setText = (sel, val)=>{
          const el = $(sel);
          if(el) el.textContent = String(val || '');
        };
        const setList = (sel, items)=>{
          const el = $(sel);
          if(!el) return;
          const rows = Array.isArray(items) && items.length ? items : ['—'];
          el.innerHTML = rows.map((row)=> `<li>${escapeHtml(String(row || '—'))}</li>`).join('');
        };

        setText('#consultationCompany', model.company);
        setText('#consultationSub', `Prepare the consultation handoff for ${model.company}.`);
        setText('#consultTierPill', `Tier: ${model.tier}`);
        setText('#consultStagePill', `Stage: ${model.stage}`);
        setText('#consultCompletionPill', `Completion: ${model.completion}`);
        setList('#consultPayload', model.payload);
        setList('#consultAttendees', model.attendees);
        setList('#consultTopics', model.topics);
        setList('#consultAgenda', model.agenda);
        setList('#consultResources', model.resources);
      }

      function toggleConsultation(open, opts){
        const panel = $('#consultationPanel');
        if(!panel) return;
        const cfg = opts || {};
        const on = !!open;
        state.consultationOpen = on;

        if(on){
          const target = (cfg.threadId || state.consultationThreadId || state.activeThread || 'current');
          renderConsultationPanel(target);
          syncFormControlsFromState();
          panel.classList.add('open');
          panel.setAttribute('aria-hidden', 'false');
        }else{
          panel.classList.remove('open');
          panel.setAttribute('aria-hidden', 'true');
        }
        document.body.classList.toggle('is-consultation-open', on);
      }

      function openThreadBooking(threadId){
        const target = threadId || state.activeThread || 'current';
        const preferLive = state.currentView === 'configurator';
        const resolved = preferLive
          ? 'current'
          : ((target !== 'current' && findSavedThread(target)) ? target : 'current');
        toggleConsultation(true, { threadId: resolved });
        window.setTimeout(()=>{
          const emailField = $('#email');
          if(emailField && !String(emailField.value || '').trim()){
            emailField.focus();
          }
        }, 120);
      }

      function packageOverviewForTier(tier){
        const name = String(tier || '').trim().toLowerCase();
        if(name.startsWith('adv')){
          return {
            key: 'adv',
            title: 'Advanced package',
            body: 'Operational performance, measurable over time. Higher cadence exercising, more realism, benchmarking, and repeatable improvement.'
          };
        }
        if(name.startsWith('ult')){
          return {
            key: 'ult',
            title: 'Ultimate package',
            body: 'Evidence you can defend. High cadence proving with executive readiness outputs and scalable governance.'
          };
        }
        return {
          key: 'core',
          title: 'Core package',
          body: 'Baseline capability, quickly. Role-based labs plus a small, controlled amount of team-level proving.'
        };
      }

      function splitOverviewList(value){
        return String(value || '')
          .split(/\s*·\s*|\s*;\s*|\s*,\s*/g)
          .map((item)=> item.trim())
          .filter((item)=> item && item !== '—');
      }

      function interCoverageGroups(thread){
        if(!thread) return [];
        if(thread.id === 'current'){
          return dashLabelsFromIds(state.groups, groupOpts);
        }

        const snapGroups = Array.isArray(thread.snapshot && thread.snapshot.groups) ? thread.snapshot.groups : [];
        if(snapGroups.length){
          return dashLabelsFromIds(snapGroups, groupOpts);
        }

        const coverageRows = Array.isArray(thread.modules && thread.modules.coverage) ? thread.modules.coverage : [];
        const coverageRow = coverageRows.find((row)=> String((row && row.label) || '').toLowerCase().includes('coverage'));
        if(!coverageRow) return [];
        return splitOverviewList(coverageRow.value);
      }

      function interPressureSignals(thread){
        if(!thread) return [];
        if(thread.id === 'current'){
          return dashLabelsFromIds(state.pressureSources, pressureOpts.map((opt)=> ({ id:opt.id, label:opt.title })));
        }

        const snapPressure = Array.isArray(thread.snapshot && thread.snapshot.pressureSources) ? thread.snapshot.pressureSources : [];
        if(snapPressure.length){
          return dashLabelsFromIds(snapPressure, pressureOpts.map((opt)=> ({ id:opt.id, label:opt.title })));
        }

        const discoveryRows = Array.isArray(thread.modules && thread.modules.discovery) ? thread.modules.discovery : [];
        const pressureRow = discoveryRows.find((row)=> String((row && row.label) || '').toLowerCase().includes('pressure'));
        if(!pressureRow) return [];
        return splitOverviewList(pressureRow.value);
      }

      function interTierModeLine(tierName){
        const key = String(tierName || '').trim().toLowerCase();
        if(key.includes('ult')){
          return 'Assurance gives you board- and regulator-ready evidence with executive reporting.';
        }
        if(key.includes('adv')){
          return 'Performance Readiness gives you repeatable proving, benchmarking, and a multi-team operating rhythm.';
        }
        return 'Foundation gives you a fast baseline, controlled proving, and a clear path to improve.';
      }

      function interTierModeShort(tierName){
        const key = String(tierName || '').trim().toLowerCase();
        if(key.includes('ult')) return 'Assurance';
        if(key.includes('adv')) return 'Performance Readiness';
        return 'Foundation';
      }

      function buildInterstitialPitchModel(thread, progress, viz){
        const modelThread = thread || {};
        const modelProgress = progress || { completion:'0/22 (0%)', gaps:[], gapSummary:'No open gaps' };
        const modelViz = viz || {};

        const completion = String(modelProgress.completion || modelThread.completion || '0/22 (0%)');
        const completionPct = completionPctFromSummary(completion);
        const gaps = Array.isArray(modelProgress.gaps) ? modelProgress.gaps : [];
        const openGapCount = gaps.length;
        const isFinal = completionPct >= 100 && openGapCount === 0;

        const company = String(modelThread.company || 'This organisation').trim() || 'This organisation';
        const tier = String(modelThread.tier || 'Core').trim() || 'Core';
        const coverageGroups = interCoverageGroups(modelThread);
        const coverageCore = coverageGroups.length ? naturalList(coverageGroups.slice(0, 3)) : 'your priority teams';
        const groupText = coverageGroups.length > 3 ? `${coverageCore}, and other adjacent teams` : coverageCore;
        const pressureSignals = interPressureSignals(modelThread);
        const pressureLead = pressureSignals.length ? pressureSignals[0] : 'stakeholder pressure';
        const topGap = String((gaps[0] && gaps[0].title) || 'priority readiness blockers').trim();
        const secondGap = String((gaps[1] && gaps[1].title) || '').trim();
        const gapLabel = openGapCount === 1 ? 'open gap' : 'open gaps';

        const outcomeRows = Array.isArray(modelViz.outcomeBreakdown) ? modelViz.outcomeBreakdown : [];
        const weightedOutcomes = outcomeRows
          .map((row)=> ({
            label: String((row && row.label) || '').trim(),
            pct: clamp(Number(row && row.pct) || 0, 0, 100)
          }))
          .filter((row)=> row.label)
          .sort((a, b)=> b.pct - a.pct)
          .slice(0, 3);
        const weightedOutcomeLabels = weightedOutcomes.map((row)=> row.label);
        const fallbackOutcomeLabels = splitOverviewList(modelThread.outcomesText);
        const outcomeLabels = weightedOutcomeLabels.length ? weightedOutcomeLabels : fallbackOutcomeLabels;
        const outcomeShort = naturalList(outcomeLabels.slice(0, 2)) || 'core readiness outcomes';
        const outcomeLong = naturalList(outcomeLabels.slice(0, 3)) || outcomeShort;

        const roiPct = Number(modelViz.roiPct);
        const paybackMonths = Number(modelViz.paybackMonths);
        const hasRoi = Number.isFinite(roiPct);
        const roiLine = hasRoi
          ? `The model currently indicates ${Math.round(roiPct)}% 3-year ROI${Number.isFinite(paybackMonths) ? ` with payback in ${fmtPayback(paybackMonths)}` : ''}.`
          : 'ROI will be quantified once remaining inputs are confirmed.';

        const tierModeLine = interTierModeLine(tier);
        const tierModeShort = interTierModeShort(tier);

        const pitch15 = isFinal
          ? `${company} is focused on ${outcomeShort} across ${groupText}. ${tierModeShort} helps prove readiness under pressure and keep progress measurable.`
          : `${company} still has key inputs missing. Start by resolving ${topGap}, then complete the remaining required fields so the pitch can be finalized.`;

        const pitch30 = isFinal
          ? `${company} needs resilience coverage across ${groupText}, not just activity metrics. The priority outcomes are ${outcomeLong}. ${tierModeLine} ${roiLine}`
          : `${company} is ${completionPct}% complete with ${openGapCount} ${gapLabel}. Prioritize ${topGap}${secondGap ? ` and ${secondGap}` : ''}, then complete the remaining required fields to finalize the pitch.`;

        const pitch60 = isFinal
          ? `For ${company}, ${pressureLead.toLowerCase()} pressure means confidence has to be demonstrated, not assumed. The priority outcomes are ${outcomeLong}. ${tierModeLine} This lets the team prove readiness in the scenarios that matter most, close weak points through a repeatable rhythm, and align evidence with stakeholder expectations. ${roiLine} Next step: agree the first checkpoint agenda and assign owners for each benefiting group.`
          : `This is a working draft based on partial inputs. ${company} is ${completionPct}% complete with ${openGapCount} ${gapLabel}, and the first blocker is ${topGap}. Resolve the missing inputs, confirm the operating mode, and validate outcome priorities. Then we can output final 15, 30, and 60-second versions with stronger evidence and ROI framing.`;

        return {
          isFinal,
          completionPct,
          openGapCount,
          pitch15,
          pitch30,
          pitch60
        };
      }

      function renderInterstitialKvs(rows){
        return (rows || [])
          .map((row)=> `
            <div class="interKv">
              <span class="interKvLabel">${escapeHtml(row.label)}</span>
              <span class="interKvVal">${escapeHtml(row.value || '—')}</span>
            </div>
          `)
          .join('');
      }

      function interVizModel(thread){
        if(thread && thread.id === 'current'){
          const topOutcomes = inferredPrimaryOutcomes(3);
          const pctById = topOutcomePercentages(topOutcomes);
          let outcomeBreakdown = topOutcomes
            .map((o)=> ({
              label: String(o.short || o.label || '').trim(),
              pct: Number(pctById[o.id] || 0)
            }))
            .filter((o)=> o.label && Number.isFinite(o.pct));

          if(!outcomeBreakdown.length){
            outcomeBreakdown = [{ label:'Outcome confidence pending', pct:100 }];
          }

          const roi = computeRoi();
          const paybackMonths = computePaybackMonths(roi);
          return {
            roiPct: Number(roi.roi * 100),
            npv: Number(roi.npv),
            spend: Number(state.investUSD),
            paybackMonths,
            outcomeBreakdown
          };
        }

        const viz = (thread && thread.viz) ? thread.viz : {};
        let outcomeBreakdown = Array.isArray(viz.outcomeBreakdown)
          ? viz.outcomeBreakdown
              .map((row)=> ({
                label: String((row && row.label) || '').trim(),
                pct: Number(row && row.pct)
              }))
              .filter((row)=> row.label && Number.isFinite(row.pct))
          : [];

        if(!outcomeBreakdown.length){
          const outcomes = Array.isArray(thread && thread.outcomes) ? thread.outcomes : [];
          if(outcomes.length){
            const share = Math.floor(100 / outcomes.length);
            const carry = 100 - (share * (outcomes.length - 1));
            outcomeBreakdown = outcomes.map((label, idx)=> ({
              label: String(label),
              pct: idx === outcomes.length - 1 ? carry : share
            }));
          }else{
            outcomeBreakdown = [{ label:'Outcome confidence pending', pct:100 }];
          }
        }

        return {
          roiPct: Number(viz.roiPct),
          npv: Number(viz.npv),
          spend: Number(viz.spend),
          paybackMonths: (viz.paybackMonths === null || viz.paybackMonths === undefined) ? null : Number(viz.paybackMonths),
          outcomeBreakdown
        };
      }

      function renderInterstitialView(){
        const host = $('#interstitialContent');
        if(!host) return;

        const thread = activeThreadModel();
        if(!(state.interstitialAnimatedThreadIds instanceof Set)){
          state.interstitialAnimatedThreadIds = new Set();
        }
        const interAnimKey = String((thread && thread.id) || 'current');
        const shouldAnimateInter = !state.interstitialAnimatedThreadIds.has(interAnimKey);
        const progress = threadReadinessProgress(thread);
        const viz = interVizModel(thread);
        const pitch = buildInterstitialPitchModel(thread, progress, viz);
        const gaps = progress.gaps || [];
        const pkg = packageOverviewForTier(thread.tier);
        const companyDisplay = String((thread && thread.company) || '').trim() || 'Untitled company';
        const canTogglePriority = !!(thread && thread.id && thread.id !== 'current' && !!findSavedThread(thread.id));
        const animateInterStar = canTogglePriority && !!state.starPulseQueue && state.starPulseQueue.has(thread.id);
        const interTitleStar = canTogglePriority
          ? `<button type="button" class="interTitleStarBtn${animateInterStar ? ' is-animate' : ''}" data-inter-star-id="${escapeHtml(thread.id)}" data-active="${thread.priority ? 'true' : 'false'}" aria-pressed="${thread.priority ? 'true' : 'false'}" title="${thread.priority ? 'Unstar company' : 'Star company'}">★</button>`
          : '';
        const outcomeRows = (viz.outcomeBreakdown || []).slice(0, 4).map((row, idx)=> {
          const pct = clamp(Number(row.pct) || 0, 0, 100);
          return `
            <div class="interOutcomeRow">
              <div class="interOutcomeTop">
                <span class="interOutcomeLabel">${escapeHtml(row.label)}</span>
                <span class="interOutcomePct">${pct}%</span>
              </div>
              <div class="interOutcomeTrack">
                <span class="interOutcomeFill" data-target="${pct}" style="--delay:${idx * 90}ms;"></span>
              </div>
            </div>
          `;
        }).join('');

        const gapItems = gaps.length
          ? gaps.map((gap, idx)=> `
              <div class="interGapItem${shouldAnimateInter ? ' is-enter' : ''}"${shouldAnimateInter ? ` style="--inter-enter-delay:${170 + (idx * 46)}ms;"` : ''}>
                <p class="interGapTitle">${escapeHtml(gap.title)}</p>
                <p class="interGapWhy">Why it matters: ${escapeHtml(gap.why || 'Required for confidence in recommendation and plan.')}</p>
                <div class="interGapActions">
                  <button type="button" class="interEditLink" data-inter-edit-step="${Number(gap.step) || 1}">Edit this section</button>
                </div>
              </div>
            `).join('')
          : '<div class="interEmpty">No open gaps. This thread is ready for package confirmation.</div>';

        host.innerHTML = `
          <header class="interHead">
            <div class="interCrumbs">
              <button type="button" class="interCrumbHome" data-inter-crumb="dashboard" aria-label="Go to dashboard">Dashboard</button>
              <span aria-hidden="true">/</span>
              <span>${escapeHtml(companyDisplay)}</span>
            </div>
            <div class="interTitleRow">
              <div>
                <div class="interTitleMain" id="interTitleMain">
                  ${interTitleStar}
                  <h2 id="interCompanyTitleText">${escapeHtml(companyDisplay)}</h2>
                  <input
                    id="interCompanyTitleInput"
                    class="interTitleInlineInput"
                    type="text"
                    value="${escapeHtml(companyDisplay)}"
                    maxlength="120"
                    aria-label="Rename company"
                  />
                  <button type="button" class="interTitleIconBtn interTitleEditBtn" data-inter-rename-btn title="Rename company" aria-label="Rename company">&#9998;</button>
                  <button type="button" class="interTitleIconBtn interTitleSaveBtn" data-inter-rename-save title="Save company name" aria-label="Save company name">&#10003;</button>
                  <button type="button" class="interTitleIconBtn interTitleCancelBtn" data-inter-rename-cancel title="Cancel rename" aria-label="Cancel rename">&times;</button>
                </div>
                <p class="interSub">Our understanding of your business. Use Edit to jump directly to incomplete sections.</p>
              </div>
              <div class="interActions viewActionSlot" id="interstitialActionSlot"></div>
            </div>
            <div class="interMeta">
              <span class="interPill">Stage: ${escapeHtml(thread.stage || 'Discovery')}</span>
              <span class="interPill">Completion: ${escapeHtml(progress.completion)}</span>
              <span class="interPill">Tier: ${escapeHtml(thread.tier)}</span>
              <span class="interPill">Open gaps: ${gaps.length}</span>
            </div>
          </header>

          <section class="interPackageHero${shouldAnimateInter ? ' is-enter' : ''}"${shouldAnimateInter ? ' style="--inter-enter-delay:26ms;"' : ''} data-tier-key="${escapeHtml(pkg.key)}">
            <p class="interPackageKicker">Package</p>
            <h3 class="interPackageTitle">${escapeHtml(pkg.title)}</h3>
            <p class="interPackageBody">${escapeHtml(pkg.body)}</p>
          </section>

          <section class="interViz">
            <article class="interVizCard${shouldAnimateInter ? ' is-enter' : ''}"${shouldAnimateInter ? ' style="--inter-enter-delay:70ms;"' : ''}>
              <h3 class="interVizTitle">ROI snapshot</h3>
              <p class="interVizSub">Directional signal for commercial confidence, based on the current record profile.</p>
              <div class="interRoiGrid">
                <div class="interRoiMetric">
                  <p class="interRoiMetricLabel">3-year ROI</p>
                  <p class="interRoiMetricValue" id="interRoiPctValue">—</p>
                </div>
                <div class="interRoiMetric">
                  <p class="interRoiMetricLabel">3-year NPV</p>
                  <p class="interRoiMetricValue" id="interNpvValue">—</p>
                </div>
                <div class="interRoiMetric">
                  <p class="interRoiMetricLabel">Payback</p>
                  <p class="interRoiMetricValue" id="interPaybackValue">—</p>
                </div>
                <div class="interRoiMetric">
                  <p class="interRoiMetricLabel">Indicative spend</p>
                  <p class="interRoiMetricValue" id="interSpendValue">—</p>
                </div>
              </div>
            </article>

            <article class="interVizCard${shouldAnimateInter ? ' is-enter' : ''}"${shouldAnimateInter ? ' style="--inter-enter-delay:108ms;"' : ''}>
              <h3 class="interVizTitle">Outcome weighting</h3>
              <p class="interVizSub">Relative confidence split across the leading outcomes for this record.</p>
              <div class="interOutcomeList">
                ${outcomeRows}
              </div>
            </article>
          </section>

          <section class="interGrid">
            <article class="interCard interCardWide${shouldAnimateInter ? ' is-enter' : ''}"${shouldAnimateInter ? ' style="--inter-enter-delay:146ms;"' : ''}>
              <h3>Gaps: what we still need</h3>
              <div class="interGapList">${gapItems}</div>
            </article>

            <article class="interCard interCardWide${shouldAnimateInter ? ' is-enter' : ''}"${shouldAnimateInter ? ' style="--inter-enter-delay:186ms;"' : ''}>
              <h3>Snapshot</h3>
              <div class="interKvs">
                <div class="interKv">
                  <span class="interKvLabel">Primary outcomes</span>
                  <span class="interKvVal">${escapeHtml(thread.outcomesText || '—')}</span>
                </div>
                <div class="interKv">
                  <span class="interKvLabel">Current status</span>
                  <span class="interKvVal">${escapeHtml(progress.gapSummary || 'No open gaps')}</span>
                </div>
              </div>
            </article>

            <article class="interCard${shouldAnimateInter ? ' is-enter' : ''}"${shouldAnimateInter ? ' style="--inter-enter-delay:224ms;"' : ''}>
              <h3>Organisation</h3>
              <div class="interKvs">${renderInterstitialKvs((thread.modules && thread.modules.organisation) || [])}</div>
            </article>

            <article class="interCard${shouldAnimateInter ? ' is-enter' : ''}"${shouldAnimateInter ? ' style="--inter-enter-delay:262ms;"' : ''}>
              <h3>Discovery & outcomes</h3>
              <div class="interKvs">${renderInterstitialKvs((thread.modules && thread.modules.discovery) || [])}</div>
            </article>

            <article class="interCard${shouldAnimateInter ? ' is-enter' : ''}"${shouldAnimateInter ? ' style="--inter-enter-delay:300ms;"' : ''}>
              <h3>Coverage & package fit</h3>
              <div class="interKvs">${renderInterstitialKvs([...(thread.modules?.coverage || []), ...(thread.modules?.packageFit || [])])}</div>
            </article>

            <article class="interCard${shouldAnimateInter ? ' is-enter' : ''}"${shouldAnimateInter ? ' style="--inter-enter-delay:338ms;"' : ''}>
              <h3>Context</h3>
              <div class="interKvs">${renderInterstitialKvs((thread.modules && thread.modules.context) || [])}</div>
            </article>

            <article class="interCard interCardWide${shouldAnimateInter ? ' is-enter' : ''}"${shouldAnimateInter ? ' style="--inter-enter-delay:376ms;"' : ''}>
              <div class="interPitchHead">
                <h3>Elevator pitch</h3>
                <span class="interPitchStatus" data-final="${pitch.isFinal ? 'true' : 'false'}">${pitch.isFinal ? 'Final (ready)' : `Draft (${pitch.completionPct}% complete)`}</span>
              </div>
              <p class="interPitchSub">${pitch.isFinal ? 'Generated from current package fit, outcome weighting, and ROI signals.' : `Working draft while inputs are incomplete (${pitch.openGapCount} open gaps).`}</p>
              <div class="interPitchGrid">
                <section class="interPitchItem">
                  <p class="interPitchLabel">15s</p>
                  <p class="interPitchText">${escapeHtml(pitch.pitch15)}</p>
                </section>
                <section class="interPitchItem">
                  <p class="interPitchLabel">30s</p>
                  <p class="interPitchText">${escapeHtml(pitch.pitch30)}</p>
                </section>
                <section class="interPitchItem">
                  <p class="interPitchLabel">60s</p>
                  <p class="interPitchText">${escapeHtml(pitch.pitch60)}</p>
                </section>
              </div>
            </article>
          </section>
        `;
        if(shouldAnimateInter){
          state.interstitialAnimatedThreadIds.add(interAnimKey);
        }

        $$('#interstitialContent .interGapList [data-inter-edit-step]').forEach((btn)=>{
          btn.addEventListener('click', ()=>{
            const step = Number(btn.getAttribute('data-inter-edit-step') || dashboardFirstGapStep(thread));
            openThreadConfigurator(thread.id, step);
          });
        });
        const interDashboardCrumb = $('#interstitialContent [data-inter-crumb="dashboard"]');
        if(interDashboardCrumb){
          interDashboardCrumb.addEventListener('click', ()=>{
            setView('dashboard');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          });
        }
        const interStarBtn = $('#interstitialContent [data-inter-star-id]');
        if(interStarBtn){
          interStarBtn.addEventListener('click', ()=>{
            const id = interStarBtn.getAttribute('data-inter-star-id') || '';
            if(id) toggleThreadPriority(id);
          });
        }
        const titleMain = $('#interTitleMain');
        const renameBtn = $('#interstitialContent [data-inter-rename-btn]');
        const renameSaveBtn = $('#interstitialContent [data-inter-rename-save]');
        const renameCancelBtn = $('#interstitialContent [data-inter-rename-cancel]');
        const renameInput = $('#interCompanyTitleInput');
        const commitRename = ()=>{
          if(!renameInput) return;
          const result = renameThreadCompany(thread.id, renameInput.value);
          if(result.changed){
            toast(`Renamed to ${result.name}.`);
          }
          update();
        };
        const openRename = ()=>{
          if(!titleMain || !renameInput) return;
          titleMain.classList.add('is-editing');
          renameInput.focus();
          renameInput.select();
        };
        const cancelRename = ()=>{
          if(!titleMain || !renameInput) return;
          renameInput.value = companyDisplay;
          titleMain.classList.remove('is-editing');
        };
        if(renameBtn){
          renameBtn.addEventListener('click', openRename);
        }
        if(renameSaveBtn){
          renameSaveBtn.addEventListener('click', commitRename);
        }
        if(renameCancelBtn){
          renameCancelBtn.addEventListener('click', cancelRename);
        }
        if(renameInput){
          renameInput.addEventListener('keydown', (event)=>{
            if(event.key === 'Enter'){
              event.preventDefault();
              commitRename();
            }else if(event.key === 'Escape'){
              event.preventDefault();
              cancelRename();
            }
          });
        }

        tweenMetricText(
          $('#interRoiPctValue'),
          viz.roiPct,
          (v)=> Number.isFinite(v) ? `${Math.round(v)}%` : '—',
          { duration: 420, formatSig: 'inter-roi-pct' }
        );
        tweenMetricText(
          $('#interNpvValue'),
          viz.npv,
          (v)=> Number.isFinite(v) ? fmtMoneyCompactUSD(v, { signed:true, sig:3 }) : '—',
          { duration: 520, formatSig: `inter-npv-${state.currency}` }
        );
        tweenMetricText(
          $('#interPaybackValue'),
          viz.paybackMonths,
          (v)=> fmtPayback(v),
          { duration: 420, formatSig: 'inter-payback' }
        );
        tweenMetricText(
          $('#interSpendValue'),
          viz.spend,
          (v)=> Number.isFinite(v) ? `${fmtMoneyCompactUSD(v, { sig:3 })}/yr` : '—',
          { duration: 520, formatSig: `inter-spend-${state.currency}` }
        );

        $$('#interstitialContent .interOutcomeFill').forEach((fill)=>{
          const pct = clamp(Number(fill.dataset.target) || 0, 0, 100);
          fill.style.width = '0%';
          window.requestAnimationFrame(()=>{ fill.style.width = `${pct}%`; });
        });
      }

      function renderDashboardRows(){
        const body = $('#dashboardRows');
        if(!body) return;
        if(!(state.completionRingAnimatedIds instanceof Set)){
          state.completionRingAnimatedIds = new Set();
        }
        if(!(state.dashboardRowAnimatedIds instanceof Set)){
          state.dashboardRowAnimatedIds = new Set();
        }

        const rows = dashboardRowsModel();
        const visibleIds = new Set(rows.map((row)=> row.id));
        const visibleAnimIds = new Set(rows.map((row)=> `active:${row.id}`));
        state.dashboardRowAnimatedIds = new Set(
          Array.from(state.dashboardRowAnimatedIds || []).filter((id)=> {
            const key = String(id || '');
            return !key.startsWith('active:') || visibleAnimIds.has(key);
          })
        );
        state.dashboardSelectedIds = new Set(
          Array.from(state.dashboardSelectedIds || []).filter((id)=> visibleIds.has(id))
        );
        const selectedCount = state.dashboardSelectedIds.size;

        if(!rows.length){
          body.innerHTML = `
            <tr>
              <td colspan="7" style="padding:16px 12px; color: var(--muted);">
                No active records yet. Create a new record to get started.
              </td>
            </tr>
          `;
        }else{
          const newlyAnimatedRows = [];
          body.innerHTML = rows.map((row, idx)=> {
            const pct = completionPctFromSummary(row.completion);
            const checked = state.dashboardSelectedIds.has(row.id) ? 'checked' : '';
            const animateStar = !!state.starPulseQueue && state.starPulseQueue.has(row.id);
            const shouldAnimateRing = !state.completionRingAnimatedIds.has(row.id);
            const rowAnimId = `active:${row.id}`;
            const shouldAnimateRow = !state.dashboardRowAnimatedIds.has(rowAnimId);
            if(shouldAnimateRow) newlyAnimatedRows.push(rowAnimId);
            const rowClasses = [
              animateStar ? 'is-star-pulse' : '',
              shouldAnimateRow ? 'is-enter' : ''
            ].filter(Boolean).join(' ');
            return `
              <tr class="${rowClasses}" style="--row-i:${idx}; --row-enter-delay:${Math.min(idx, 14) * 34}ms;" data-dashboard-row-id="${escapeHtml(row.id)}" data-selected="${checked ? 'true' : 'false'}">
                <td class="dashSelectCol">
                  <input class="dashRowCheck" type="checkbox" data-dashboard-select-id="${escapeHtml(row.id)}" aria-label="Select ${escapeHtml(row.company)}" ${checked} />
                </td>
                <td>
                  <div class="dashCompanyCell">
                    <button class="dashStarBtn${animateStar ? ' is-animate' : ''}" type="button" data-dashboard-star-id="${escapeHtml(row.id)}" data-active="${row.priority ? 'true' : 'false'}" title="Toggle priority for ${escapeHtml(row.company)}">★</button>
                    <span class="dash-company">${escapeHtml(row.company)}</span>
                  </div>
                </td>
                <td>
                  <div class="dashCompletion" title="${escapeHtml(row.completion)}">
                    <span class="dashCompletionRing${shouldAnimateRing ? ' is-enter' : ''}" data-ring-id="${escapeHtml(row.id)}" data-target-pct="${pct}" data-animate="${shouldAnimateRing ? 'true' : 'false'}" style="--pct:${shouldAnimateRing ? 0 : pct};"><span>${shouldAnimateRing ? '0%' : `${pct}%`}</span></span>
                  </div>
                </td>
                <td><span class="dash-tier">${escapeHtml(row.tier)}</span></td>
                <td><span class="dash-outcomes">${escapeHtml(row.outcomes)}</span></td>
                <td><span class="dash-gaps">${escapeHtml(row.gaps)}</span></td>
                <td>
                  <span class="dashActions">
                    <button class="dashActionBtn open" type="button" data-dashboard-open-btn="${escapeHtml(row.id)}">${escapeHtml(row.openLabel)}</button>
                  </span>
                </td>
              </tr>
            `;
          }).join('');
          newlyAnimatedRows.forEach((id)=> state.dashboardRowAnimatedIds.add(id));
          animateDashboardCompletionRings(body);
        }

        const count = $('#dashThreadsCount');
        if(count) count.textContent = `${rows.length} threads`;
        const overall = $('#dashOverallScore');
        if(overall){
          const avg = rows.length
            ? Math.round(rows.reduce((sum, row)=> sum + completionPctFromSummary(row.completion), 0) / rows.length)
            : 0;
          overall.textContent = rows.length ? `Average completion: ${avg}%` : 'Average completion: —';
        }
        const last = $('#dashLastUpdated');
        if(last){
          last.textContent = rows.length ? 'Saved records' : 'No saved records yet';
        }

        const selectCount = $('#dashSelectCount');
        if(selectCount) selectCount.textContent = `${selectedCount} selected`;

        const selectAll = $('#dashSelectAll');
        if(selectAll){
          const allChecked = rows.length > 0 && selectedCount === rows.length;
          selectAll.checked = allChecked;
          selectAll.indeterminate = !allChecked && selectedCount > 0;
        }

        const archiveBtn = $('#dashArchiveSelected');
        if(archiveBtn){
          archiveBtn.disabled = selectedCount === 0;
          archiveBtn.textContent = 'Archive selected';
        }
      }

      function renderArchivedRows(){
        const body = $('#archivedRows');
        if(!body) return;
        if(!(state.completionRingAnimatedIds instanceof Set)){
          state.completionRingAnimatedIds = new Set();
        }
        if(!(state.dashboardRowAnimatedIds instanceof Set)){
          state.dashboardRowAnimatedIds = new Set();
        }

        const rows = archivedRowsModel();
        const visibleIds = new Set(rows.map((row)=> row.id));
        const visibleAnimIds = new Set(rows.map((row)=> `archived-row:${row.id}`));
        state.dashboardRowAnimatedIds = new Set(
          Array.from(state.dashboardRowAnimatedIds || []).filter((id)=> {
            const key = String(id || '');
            return !key.startsWith('archived-row:') || visibleAnimIds.has(key);
          })
        );
        state.archivedSelectedIds = new Set(
          Array.from(state.archivedSelectedIds || []).filter((id)=> visibleIds.has(id))
        );
        const selectedCount = state.archivedSelectedIds.size;

        if(!rows.length){
          body.innerHTML = `
            <tr>
              <td colspan="7" style="padding:16px 12px; color: var(--muted);">
                No archived accounts yet.
              </td>
            </tr>
          `;
        }else{
          const newlyAnimatedRows = [];
          body.innerHTML = rows.map((row, idx)=> {
            const pct = completionPctFromSummary(row.completion);
            const checked = state.archivedSelectedIds.has(row.id) ? 'checked' : '';
            const ringId = `archived:${row.id}`;
            const shouldAnimateRing = !state.completionRingAnimatedIds.has(ringId);
            const rowAnimId = `archived-row:${row.id}`;
            const shouldAnimateRow = !state.dashboardRowAnimatedIds.has(rowAnimId);
            if(shouldAnimateRow) newlyAnimatedRows.push(rowAnimId);
            return `
              <tr class="${shouldAnimateRow ? 'is-enter' : ''}" style="--row-enter-delay:${Math.min(idx, 14) * 34}ms;" data-archived-row-id="${escapeHtml(row.id)}" data-selected="${checked ? 'true' : 'false'}">
                <td class="dashSelectCol">
                  <input class="dashRowCheck" type="checkbox" data-archived-select-id="${escapeHtml(row.id)}" aria-label="Select ${escapeHtml(row.company)}" ${checked} />
                </td>
                <td><span class="dash-company">${escapeHtml(row.company)}</span></td>
                <td>
                  <div class="dashCompletion" title="${escapeHtml(row.completion)}">
                    <span class="dashCompletionRing${shouldAnimateRing ? ' is-enter' : ''}" data-ring-id="${escapeHtml(ringId)}" data-target-pct="${pct}" data-animate="${shouldAnimateRing ? 'true' : 'false'}" style="--pct:${shouldAnimateRing ? 0 : pct};"><span>${shouldAnimateRing ? '0%' : `${pct}%`}</span></span>
                  </div>
                </td>
                <td><span class="dash-tier">${escapeHtml(row.tier)}</span></td>
                <td><span class="dash-outcomes">${escapeHtml(row.outcomes)}</span></td>
                <td><span class="dash-gaps">${escapeHtml(row.gaps)}</span></td>
                <td>
                  <span class="dashActions">
                    <button class="dashActionBtn open" type="button" data-archived-unarchive-id="${escapeHtml(row.id)}">Unarchive</button>
                  </span>
                </td>
              </tr>
            `;
          }).join('');
          newlyAnimatedRows.forEach((id)=> state.dashboardRowAnimatedIds.add(id));
          animateDashboardCompletionRings(body);
        }

        const count = $('#archivedThreadsCount');
        if(count) count.textContent = `${rows.length} archived`;

        const last = $('#archivedLastUpdated');
        if(last) last.textContent = rows.length ? 'Archived records' : 'No archived records';

        const selectCount = $('#archivedSelectCount');
        if(selectCount) selectCount.textContent = `${selectedCount} selected`;

        const selectAll = $('#archivedSelectAll');
        if(selectAll){
          const allChecked = rows.length > 0 && selectedCount === rows.length;
          selectAll.checked = allChecked;
          selectAll.indeterminate = !allChecked && selectedCount > 0;
        }

        const restoreBtn = $('#archivedRestoreSelected');
        if(restoreBtn){
          restoreBtn.disabled = selectedCount === 0;
          restoreBtn.textContent = 'Unarchive selected';
        }
      }

      // ---------- recommendation logic ----------
      const packages = {
        core: {
          key:'core',
          name:'Core',
          tagline:'Baseline capability, quickly.',
          desc:'Role-based labs plus a small, controlled amount of team-level proving.'
        },
        adv: {
          key:'adv',
          name:'Advanced',
          tagline:'Operational performance, measurable over time.',
          desc:'Higher cadence exercising, more realism, benchmarking, and repeatable improvement.'
        },
        ult: {
          key:'ult',
          name:'Ultimate',
          tagline:'Evidence you can defend.',
          desc:'High cadence proving with executive readiness outputs and scalable governance.'
        }
      };

      function fitCompute(){
        const totals = { core: 0, adv: 0, ult: 0 };
        let answered = 0;

        const add = (opts, id) => {
          if(!id) return;
          const it = (opts || []).find(x => x.id === id);
          if(!it || !it.scores) return;
          totals.core += (it.scores.core || 0);
          totals.adv += (it.scores.adv || 0);
          totals.ult += (it.scores.ult || 0);
          answered += 1;
        };

        add(fitRealismOpts, state.fitRealism);
        add(fitScopeOpts, state.fitScope);
        add(fitTodayOpts, state.fitToday);
        add(fitServicesOpts, state.fitServices);
        add(fitRiskFrameOpts, state.fitRiskFrame);

        // Light persona nudge based on role (mirrors master configurator behavior)
        if(answered > 0){
          if(state.role === 'practitioner') totals.core += 1;
          if(state.role === 'secMgr') totals.adv += 1;
          if(state.role === 'ciso' || state.role === 'executive') totals.ult += 1;

          // Light benefitting-group nudges (from master configurator)
          const groupWeights = {
            soc:      { core: 0, adv: 2, ult: 1 },
            appsec:   { core: 2, adv: 1, ult: 0 },
            exec:     { core: 0, adv: 1, ult: 2 },
            workforce:{ core: 1, adv: 1, ult: 1 },
            cloud:    { core: 0, adv: 2, ult: 1 },
            third:    { core: 0, adv: 0, ult: 2 }
          };
          Array.from(state.groups || []).forEach(id=>{
            const w = groupWeights[id];
            if(!w) return;
            totals.core += (w.core || 0);
            totals.adv += (w.adv || 0);
            totals.ult += (w.ult || 0);
          });
        }

        const sum = Math.max(1, totals.core + totals.adv + totals.ult);
        const entries = [
          ['core', totals.core],
          ['adv', totals.adv],
          ['ult', totals.ult]
        ].sort((a,b)=>{
          if(b[1] !== a[1]) return b[1] - a[1];
          const order = { ult:3, adv:2, core:1 };
          return order[b[0]] - order[a[0]];
        });

        const winner = answered ? entries[0][0] : null;
        const runner = answered ? entries[1][0] : null;

        const winnerScore = entries[0][1];
        const runnerScore = entries[1][1];
        const share = winnerScore / sum;
        const gap = (winnerScore - runnerScore) / sum;
        const conf = answered ? Math.round(100 * Math.min(1, (0.75*share + 0.25*(share + gap)))) : 0;

        // Pressure hint (used by primary outcome + Ultimate guardrails)
        let pressureHint = 0;
        if(state.fitToday === 'scrutiny') pressureHint += 3;
        if(state.fitRiskFrame === 'governance') pressureHint += 2;
        if(state.fitRealism === 'bespoke') pressureHint += 1;

        return { totals, answeredCount: answered, winner, runner, conf, pressureHint };
      }

      function score(){
        let core=1, adv=0, ult=0;
        let pressure = 0;

        const largeBands = new Set(['10k-50k','50kplus']);
        const scaleBands = new Set(['2k-10k','10k-50k','50kplus']);

        // Early scale signals (company size moved earlier in decisioning)
        switch(state.companySize){
          case 'lt500': core += 1.5; break;
          case '500-2k': core += 1.0; adv += 0.5; break;
          case '2k-10k': adv += 1.5; ult += 0.5; pressure += 0.5; break;
          case '10k-50k': adv += 2.0; ult += 1.5; pressure += 1.0; break;
          case '50kplus': adv += 2.5; ult += 2.5; pressure += 1.5; break;
        }

        // Discovery signal: pressure source
        if(hasPressure('board')){ adv += 2.0; ult += 1.2; pressure += 2.0; }
        if(hasPressure('regulator')){ adv += 2.0; ult += 1.2; pressure += 2.2; }
        if(hasPressure('insurer')){ adv += 1.6; ult += 1.0; pressure += 1.7; }
        if(hasPressure('customers')){ adv += 1.4; ult += 0.8; pressure += 1.4; }
        if(hasPressure('internal')){ core += 1.0; adv += 0.6; pressure += 0.5; }

        // Evidence outputs
        if(state.evidence.has('board')){ adv+=1.5; ult+=1.0; pressure += 1.8; }
        if(state.evidence.has('reg')){ adv+=1.8; ult+=1.0; pressure += 2.0; }
        if(state.evidence.has('insurer')){ adv+=1.2; ult+=0.8; pressure += 1.4; }
        if(state.evidence.has('customer')){ adv+=1.0; ult+=0.8; pressure += 1.1; }
        if(state.evidence.has('internal')){ adv+=0.8; core+=0.8; pressure += 0.6; }

        // Discovery signal: urgent 90-day win
        switch(state.urgentWin){
          case 'boardEvidence': adv += 1.2; ult += 1.6; pressure += 1.6; break;
          case 'fasterDecisions': adv += 1.8; ult += 0.8; pressure += 0.9; break;
          case 'attackSurface': core += 0.6; adv += 1.2; break;
          case 'safeAI': adv += 1.2; ult += 0.8; pressure += 0.7; break;
          case 'workforce': core += 1.2; adv += 0.7; break;
          case 'thirdParty': adv += 1.0; ult += 0.9; pressure += 0.7; break;
        }

        // Discovery signal: current measurement
        switch(state.measuredOn){
          case 'mttd': adv += 1.4; ult += 0.5; pressure += 0.6; break;
          case 'audit': adv += 1.4; ult += 1.0; pressure += 1.0; break;
          case 'vuln': core += 0.5; adv += 1.2; break;
          case 'training': core += 1.0; adv += 0.5; break;
          case 'notMeasured': adv += 0.8; pressure += 0.5; break;
        }

        // Discovery signal: organization pain
        switch(state.orgPain){
          case 'skillsCoverage': core += 1.3; adv += 0.6; break;
          case 'coordination': adv += 1.2; ult += 0.5; pressure += 0.6; break;
          case 'externalProof': adv += 1.4; ult += 1.0; pressure += 1.2; break;
          case 'vendorRisk': adv += 1.0; ult += 0.8; pressure += 0.8; break;
          case 'aiRisk': adv += 1.0; ult += 0.7; pressure += 0.7; break;
        }

        // Discovery signal: risk environments
        (state.riskEnvs || []).forEach((env)=>{
          switch(env){
            case 'code': core += 0.5; adv += 0.9; break;
            case 'cloud': adv += 1.0; ult += 0.3; break;
            case 'identity': adv += 0.9; ult += 0.3; break;
            case 'ot': adv += 0.8; ult += 0.5; pressure += 0.5; break;
            case 'enterpriseApps': adv += 0.7; break;
            case 'socir': adv += 1.3; ult += 0.5; pressure += 0.8; break;
          }
        });
        if((state.riskEnvs || []).length >= 2) adv += 0.5;

        // Drivers (top 3, no ranking)
        state.drivers.forEach((d)=>{
          switch(d){
            case 'nearMiss': adv+=1.3; ult+=0.7; pressure += 1.2; break;
            case 'sectorPeer': adv+=1.2; ult+=0.6; pressure += 1.0; break;
            case 'skills': core+=1.4; adv+=0.7; break;
            case 'insurance': adv+=1.2; ult+=0.8; pressure += 1.2; break;
            case 'change': adv+=1.2; ult+=0.4; pressure += 0.8; break;
          }
        });

        // Milestone focus (derived from discovery if not explicitly selected)
        switch(state.milestone){
          case 'baseline': core += 1; adv += 0.8; break;
          case 'operational': adv += 1.4; ult += 0.5; break;
          case 'evidence': adv += 1.0; ult += 1.4; pressure += 0.8; break;
          case 'explore': core += 0.8; break;
        }

        // Groups
        if(state.groups.has('soc')){ adv+=1.5; ult+=0.5; }
        if(state.groups.has('appsec')){ core+=1.2; adv+=1.0; }
        if(state.groups.has('exec')){ ult+=1.8; adv+=0.8; pressure += 1.2; }
        if(state.groups.has('workforce')){ core+=0.8; adv+=0.8; ult+=0.6; }
        if(state.groups.has('cloud')){ adv+=1.2; ult+=0.4; }
        if(state.groups.has('third')){ adv+=1.0; ult+=0.8; pressure += 0.8; }

        const gCount = state.groups.size;
        if(gCount >= 3){ adv += 0.9; }
        if(gCount >= 5){ ult += 0.8; pressure += 0.7; }

        // Rhythm
        switch(state.rhythm){
          case 'adhoc': core+=1.5; break;
          case 'quarterly': adv+=1.4; break;
          case 'monthly': adv+=1.8; ult+=0.5; break;
          case 'program': ult+=2.2; adv+=1.5; pressure += 1.2; break;
        }

        // Measurement
        switch(state.measure){
          case 'completion': core+=0.8; break;
          case 'performance': adv+=1.5; ult+=0.8; pressure += 0.6; break;
        }

        // Regs: small bias to evidence-grade tiers
        const regBias = ['dora','nis2','sec','nydfs','cmmc'];
        regBias.forEach(r=>{
          if(state.regs.has(r)){ adv += 0.25; ult += 0.35; pressure += 0.25; }
        });

        // Scale by revenue (secondary only)
        const revScale = Math.max(0.02, state.revenueB / 10);
        if(revScale < 0.5) core += 0.6;
        else if(revScale >= 2.5){ adv += 0.7; ult += 0.5; }
        else core += 0.2;

        // Package fit contribution
        const fit = fitCompute();
        if(fit.answeredCount){
          const w = 0.22;
          core += fit.totals.core * w;
          adv += fit.totals.adv * w;
          ult += fit.totals.ult * w;
          pressure += fit.pressureHint;
        }

        // Inferred outcomes nudge package logic
        const inferredOutcomeSet = new Set(inferredPrimaryOutcomes(3).map(o => o.id));
        if(inferredOutcomeSet.has('fasterResponse')){ adv += 0.9; ult += 0.5; pressure += 0.4; }
        if(inferredOutcomeSet.has('complianceEvidence')){ adv += 0.9; ult += 1.0; pressure += 0.9; }
        if(inferredOutcomeSet.has('secureEnterprise')){ core += 0.4; adv += 0.8; }
        if(inferredOutcomeSet.has('cyberWorkforce')){ core += 0.9; adv += 0.4; }
        if(inferredOutcomeSet.has('secureAI')){ adv += 0.9; ult += 0.6; pressure += 0.4; }
        if(inferredOutcomeSet.has('supplyChain')){ adv += 0.7; ult += 0.8; pressure += 0.5; }

        // Ultimate gate: external accountability + strategic framing + large scale.
        const externalAccountability =
          hasPressure('board') || hasPressure('regulator') || hasPressure('insurer') || hasPressure('customers') ||
          state.evidence.has('board') || state.evidence.has('reg') || state.evidence.has('insurer') || state.evidence.has('customer') ||
          state.drivers.includes('insurance');

        const strategicFraming =
          state.fitScope === 'enterprise' ||
          state.fitRealism === 'bespoke' ||
          state.fitRiskFrame === 'governance';

        const scaleSignal =
          (largeBands.has(state.companySize) ? 2 : (scaleBands.has(state.companySize) ? 1 : 0)) +
          (state.fitScope === 'enterprise' ? 1 : 0) +
          (state.groups.size >= 4 ? 1 : 0) +
          (state.region === 'Other' ? 1 : 0);

        const scaleLarge = scaleSignal >= 2;
        const strategicOrService = strategicFraming || state.fitServices === 'whiteglove';
        const ultObvious = externalAccountability && strategicOrService && scaleLarge;

        if(ultObvious){
          ult += 2.3;
          pressure += 1.0;
          if(state.fitServices === 'whiteglove') ult += 1.2; // accelerator, not requirement
          else ult += 0.4;
        }else{
          ult -= 1.0;
          if(!externalAccountability) ult -= 0.8;
          if(!strategicOrService) ult -= 0.6;
          if(!scaleLarge) ult -= 0.6;
        }

        if(state.fitServices === 'whiteglove') adv += 0.6;
        if(state.fitServices === 'guided') adv += 0.4;
        if(state.fitServices === 'diy') core += 0.4;

        if(pressure < 5 && !ultObvious) ult -= 0.8;

        core = Math.max(0, core);
        adv = Math.max(0, adv);
        ult = Math.max(0, ult);
        pressure = clamp(pressure, 0, 10);

        const pref = { core: 0, adv: 1, ult: 2 };
        const arr = [
          {k:'core', v:core},
          {k:'adv', v:adv},
          {k:'ult', v:ult}
        ].sort((a,b)=> (b.v - a.v) || (pref[a.k] - pref[b.k]));

        let best = arr[0].k;
        let gap = arr[0].v - arr[1].v;

        if(best === 'ult' && (!ultObvious && gap < 1.2)){
          best = 'adv';
          gap = 0;
        }else if(best === 'ult' && gap < 1.2){
          best = 'adv';
          gap = 0;
        }

        const conf = gap >= 3 ? 'strong' : gap >= 1.5 ? 'moderate' : 'directional';
        return { best, conf, scores: { core, adv, ult, pressure, scaleLarge: scaleLarge ? 1 : 0, ultObvious: ultObvious ? 1 : 0 } };
      }

      function driverTitle(id){
        const d = driverOpts.find(x => x.id === id);
        return d ? d.title : id;
      }
      function hasPressure(id){
        return Array.isArray(state.pressureSources) && state.pressureSources.includes(id);
      }
      function hasOutcomeDiscoveryInputs(){
        return (
          (state.pressureSources || []).length > 0 &&
          !!state.urgentWin &&
          (state.riskEnvs || []).length > 0 &&
          !!state.measuredOn &&
          !!state.orgPain
        );
      }

      function syncEvidenceFromPressure(){
        const mapped = new Set();
        if(hasPressure('board')) mapped.add('board');
        if(hasPressure('regulator')) mapped.add('reg');
        if(hasPressure('insurer')) mapped.add('insurer');
        if(hasPressure('customers')) mapped.add('customer');
        if(hasPressure('internal')) mapped.add('internal');
        state.evidence = mapped;
      }

      function outcomeLabel(id){
        const it = primaryOutcomeOpts.find(x => x.id === id);
        return it ? it.label : id;
      }

      function computePrimaryOutcomeScores(){
        const scores = {};
        primaryOutcomeOpts.forEach(o => { scores[o.id] = 0; });
        if(!hasOutcomeDiscoveryInputs()) return scores;

        const add = (id, n = 1)=>{
          if(typeof scores[id] !== 'number') return;
          scores[id] += n;
        };
        const addWhen = (cond, id, n = 1)=>{ if(cond) add(id, n); };
        const hasReg = (id)=> state.regs && state.regs.has(id);
        const hasGroup = (id)=> state.groups && state.groups.has(id);
        const hasStack = (id)=> state.stack && state.stack.has(id);

        // Discovery-first signals (primary)
        addWhen(hasPressure('board'), 'complianceEvidence', 2.2);
        addWhen(hasPressure('board'), 'fasterResponse', 1.0);
        addWhen(hasPressure('regulator'), 'complianceEvidence', 2.4);
        addWhen(hasPressure('insurer'), 'complianceEvidence', 1.6);
        addWhen(hasPressure('insurer'), 'supplyChain', 1.0);
        addWhen(hasPressure('customers'), 'supplyChain', 2.1);
        addWhen(hasPressure('customers'), 'complianceEvidence', 0.9);
        addWhen(hasPressure('internal'), 'secureEnterprise', 1.0);
        addWhen(hasPressure('internal'), 'cyberWorkforce', 1.0);

        switch(state.urgentWin){
          case 'boardEvidence':
            add('complianceEvidence', 4.0);
            add('fasterResponse', 0.4);
            break;
          case 'fasterDecisions':
            add('fasterResponse', 4.0);
            break;
          case 'attackSurface':
            add('secureEnterprise', 4.0);
            break;
          case 'safeAI':
            add('secureAI', 4.0);
            break;
          case 'workforce':
            add('cyberWorkforce', 4.0);
            break;
          case 'thirdParty':
            add('supplyChain', 4.0);
            break;
        }

        (state.riskEnvs || []).forEach((env)=>{
          switch(env){
            case 'code': add('secureEnterprise', 1.4); break;
            case 'cloud': add('secureEnterprise', 1.4); break;
            case 'identity': add('secureEnterprise', 1.3); break;
            case 'ot': add('secureEnterprise', 0.9); add('supplyChain', 1.2); break;
            case 'enterpriseApps': add('secureEnterprise', 1.0); break;
            case 'socir': add('fasterResponse', 2.1); break;
          }
        });

        switch(state.measuredOn){
          case 'mttd': add('fasterResponse', 2.0); break;
          case 'audit': add('complianceEvidence', 2.2); break;
          case 'vuln': add('secureEnterprise', 2.0); break;
          case 'training': add('cyberWorkforce', 2.0); break;
          case 'notMeasured': add('complianceEvidence', 1.0); add('cyberWorkforce', 0.8); add('fasterResponse', 0.4); break;
        }

        switch(state.orgPain){
          case 'skillsCoverage': add('cyberWorkforce', 2.4); break;
          case 'coordination': add('fasterResponse', 2.2); break;
          case 'externalProof': add('complianceEvidence', 2.4); break;
          case 'vendorRisk': add('supplyChain', 2.4); break;
          case 'aiRisk': add('secureAI', 3.2); break;
        }

        // Drivers (optional refiners)
        addWhen(state.drivers.includes('nearMiss'), 'fasterResponse', 1.2);
        addWhen(state.drivers.includes('sectorPeer'), 'fasterResponse', 0.8);
        addWhen(state.drivers.includes('sectorPeer'), 'supplyChain', 1.0);
        addWhen(state.drivers.includes('insurance'), 'complianceEvidence', 1.2);
        addWhen(state.drivers.includes('insurance'), 'supplyChain', 0.6);
        addWhen(state.drivers.includes('change'), 'secureEnterprise', 1.2);
        addWhen(state.drivers.includes('change'), 'secureAI', 1.1);
        addWhen(state.drivers.includes('skills'), 'cyberWorkforce', 1.6);

        // Secondary refiners (low weight so discovery remains decisive)
        addWhen(hasGroup('soc'), 'fasterResponse', 0.8);
        addWhen(hasGroup('exec'), 'fasterResponse', 0.4);
        addWhen(hasGroup('exec'), 'complianceEvidence', 0.6);
        addWhen(hasGroup('workforce'), 'cyberWorkforce', 1.0);
        addWhen(hasGroup('third'), 'supplyChain', 1.2);
        addWhen(hasGroup('appsec'), 'secureEnterprise', 0.5);
        addWhen(hasGroup('cloud'), 'secureEnterprise', 0.5);
        addWhen(hasGroup('identity'), 'secureEnterprise', 0.5);
        addWhen(hasGroup('itops'), 'secureEnterprise', 0.4);
        addWhen(hasGroup('product'), 'secureEnterprise', 0.5);
        addWhen(hasGroup('data'), 'complianceEvidence', 0.5);
        addWhen(hasGroup('grc'), 'complianceEvidence', 0.7);

        addWhen(state.fitRiskFrame === 'readiness', 'fasterResponse', 0.6);
        addWhen(state.fitRiskFrame === 'governance', 'complianceEvidence', 0.8);
        addWhen(state.fitRiskFrame === 'skills', 'cyberWorkforce', 0.8);
        addWhen(state.fitScope === 'enterprise', 'supplyChain', 0.4);
        addWhen(state.fitScope === 'enterprise', 'secureEnterprise', 0.4);

        addWhen(state.industry === 'Financial Services' || state.industry === 'Banking' || state.industry === 'Insurance', 'complianceEvidence', 0.5);
        addWhen(state.industry === 'Technology / SaaS', 'secureEnterprise', 0.4);
        addWhen(state.industry === 'Technology / SaaS', 'secureAI', 0.4);
        addWhen(state.industry === 'Manufacturing / Industrial', 'secureEnterprise', 0.5);
        addWhen(state.industry === 'Manufacturing / Industrial', 'supplyChain', 0.5);
        addWhen(state.industry === 'Transportation / Logistics', 'supplyChain', 0.6);

        ['dora','nis2','gdpr','sec','nydfs','soc2','cmmc'].forEach(id => addWhen(hasReg(id), 'complianceEvidence', 0.35));
        ['euaiact','iso42001','nistairmf'].forEach(id => addWhen(hasReg(id), 'secureAI', 0.6));
        ['nist800161','dfars7012','cmmc'].forEach(id => addWhen(hasReg(id), 'supplyChain', 0.5));
        ['iec62443','nist800218','nist800207','owasptop10'].forEach(id => addWhen(hasReg(id), 'secureEnterprise', 0.35));

        ['appsec','cloud','identity','network','ot'].forEach(id => addWhen(hasStack(id), 'secureEnterprise', 0.45));
        addWhen(hasStack('threat'), 'fasterResponse', 0.45);
        addWhen(hasStack('range'), 'cyberWorkforce', 0.55);
        addWhen(hasStack('ai'), 'secureAI', 0.7);

        const stackOtherTxt = String(state.stackOther || '').toLowerCase();
        addWhen(stackOtherTxt.includes('ai'), 'secureAI', 0.4);
        addWhen(stackOtherTxt.includes('supplier') || stackOtherTxt.includes('third'), 'supplyChain', 0.4);

        // Outcome drill-down answers: light confidence boost
        Object.entries(state.outcomeDrilldowns || {}).forEach(([outcomeId, answerId])=>{
          if(!answerId) return;
          add(outcomeId, 0.5);
        });

        return scores;
      }

      function inferredPrimaryOutcomes(max = 3){
        if(!hasOutcomeDiscoveryInputs()) return [];
        const scores = computePrimaryOutcomeScores();
        const rank = {};
        primaryOutcomeOpts.forEach((o, idx)=>{ rank[o.id] = idx; });
        const rows = primaryOutcomeOpts.map(o => ({
          id: o.id,
          label: o.label,
          short: o.short,
          desc: o.desc,
          score: Number(scores[o.id] || 0)
        })).sort((a,b)=> (b.score - a.score) || (rank[a.id] - rank[b.id]));

        const top = rows.length ? rows[0].score : 0;
        if(top <= 0) return [];
        const n = clamp(Number(max) || 3, 1, 3);
        return rows.slice(0, n);
      }

      function topOutcomePercentages(topOutcomes){
        const rows = Array.isArray(topOutcomes) ? topOutcomes : [];
        if(!rows.length) return {};
        const scores = computePrimaryOutcomeScores();
        const total = rows.reduce((sum, o)=> sum + Math.max(0, Number(scores[o.id] || o.score || 0)), 0);
        if(total <= 0) return {};

        const pctById = {};
        let used = 0;
        rows.forEach((o, idx)=>{
          const raw = Math.max(0, Number(scores[o.id] || o.score || 0));
          let pct = Math.round((raw / total) * 100);
          if(idx === rows.length - 1){
            pct = Math.max(0, 100 - used);
          }else{
            used += pct;
          }
          pctById[o.id] = pct;
        });
        return pctById;
      }

      function primaryOutcomesText(max = 3){
        const xs = inferredPrimaryOutcomes(max).map(o => o.short);
        if(!xs.length) return '—';
        return xs.join(' · ');
      }

      function syncMilestoneFromSignals(){
        const map = {
          boardEvidence: 'evidence',
          fasterDecisions: 'operational',
          attackSurface: 'baseline',
          safeAI: 'operational',
          workforce: 'baseline',
          thirdParty: 'evidence'
        };
        const inferred = map[state.urgentWin] || '';
        if(inferred){
          state.milestone = inferred;
          return;
        }
        if(!state.milestone && (state.drivers.length || (state.pressureSources || []).length || state.orgPain)) state.milestone = 'explore';
      }

      function outcomeById(id){
        return primaryOutcomeOpts.find(o => o.id === id) || null;
      }

      function tierWhyBullets(best, max = 3){
        return reasons(best)
          .filter(r => !String(r).startsWith('ROI estimate is based on Immersive assumptions'))
          .slice(0, max);
      }

      function buildNextMeetingAgenda(topOutcomes){
        const agenda = [];
        (topOutcomes || []).forEach(o=>{
          switch(o.id){
            case 'fasterResponse':
              agenda.push('Agree scenario scope, response KPIs (MTTD/MTTR/decision latency), and reporting cadence.');
              break;
            case 'secureEnterprise':
              agenda.push('Prioritize code/cloud/identity/OT backlog and define remediation SLA targets.');
              break;
            case 'secureAI':
              agenda.push('Confirm AI deployment posture, guardrails, and control testing plan.');
              break;
            case 'complianceEvidence':
              agenda.push('Lock framework mapping and define the evidence pack for board/regulator/insurer.');
              break;
            case 'cyberWorkforce':
              agenda.push('Set role-readiness baseline and the first upskilling/progression sprint.');
              break;
            case 'supplyChain':
              agenda.push('Prioritize critical suppliers and define third-party exercise cadence.');
              break;
          }
        });
        if(!agenda.length){
          agenda.push('Confirm top outcomes and baseline metrics.');
          agenda.push('Agree scope, cadence, and evidence audience.');
          agenda.push('Align pilot plan and stakeholder owners.');
        }
        return agenda.slice(0, 3);
      }

      function buildWhoToBring(topOutcomes){
        const who = ['Account Executive + Solutions Engineer'];
        const add = (txt)=>{ if(!who.includes(txt)) who.push(txt); };
        (topOutcomes || []).forEach(o=>{
          switch(o.id){
            case 'fasterResponse': add('SOC / Incident Response lead'); break;
            case 'secureEnterprise': add('AppSec / Cloud / IAM owner'); break;
            case 'secureAI': add('AI security or governance lead'); break;
            case 'complianceEvidence': add('GRC / Compliance lead'); break;
            case 'cyberWorkforce': add('Security enablement / L&D owner'); break;
            case 'supplyChain': add('Third-party risk / procurement lead'); break;
          }
        });
        return who.slice(0, 5);
      }

      function buildRecommendedResources(topOutcomes){
        const res = [];
        const add = (txt)=>{ if(!res.includes(txt)) res.push(txt); };
        (topOutcomes || []).forEach(o=>{
          switch(o.id){
            case 'fasterResponse': add('Crisis decision and IR benchmarking examples'); break;
            case 'secureEnterprise': add('Code/cloud/identity remediation benchmark pack'); break;
            case 'secureAI': add('AI governance + control validation starter pack'); break;
            case 'complianceEvidence': add('Framework-to-evidence mapping template (NIST / MITRE / DORA)'); break;
            case 'cyberWorkforce': add('Role-readiness and progression reporting template'); break;
            case 'supplyChain': add('Third-party resilience simulation playbook'); break;
          }
        });
        return res.slice(0, 3);
      }

      function reasons(best){
        const bullets = [];

        const lbl = (list, id) => {
          const it = (list || []).find(x => x.id === id);
          return it ? (it.label || it.title || id) : id;
        };

        const shorten = (arr, max=3) => {
          const xs = (arr || []).filter(Boolean);
          if(xs.length <= max) return xs.join(' · ');
          return xs.slice(0, max).join(' · ') + ` · +${xs.length - max} more`;
        };

        const topOutcomes = inferredPrimaryOutcomes(3);

        // 1) Primary outcomes (always first)
        if(topOutcomes.length){
          bullets.push(`Primary outcomes in focus: ${topOutcomes.map(o => o.short).join(' · ')}.`);
          bullets.push(topOutcomes[0].desc);
        }else{
          const outcome = primaryOutcome(best);
          bullets.push(`Primary outcome: ${outcome}.`);
        }

        // 2) Coverage (turn the selection into a sentence)
        const groups = Array.from(state.groups || []).map(id => lbl(groupOpts, id));
        if(groups.length){
          bullets.push(`Coverage: ${shorten(groups, 3)}.`);
        }else{
          bullets.push('Coverage: select who needs to be ready (SOC/IR, executives, developers, workforce, suppliers).');
        }

        // 3) Cadence + measurement (constructive sentence)
        const cadenceTitle = state.rhythm ? lbl(rhythmOpts, state.rhythm) : '';
        if(state.measure === 'performance'){
          bullets.push(`You’re aiming for ${cadenceTitle ? cadenceTitle.toLowerCase() : 'repeatable'} cyber resilience exercising, measured on performance (speed, accuracy, decision quality).`);
        }else if(state.measure === 'completion'){
          bullets.push(`You’re running ${cadenceTitle ? cadenceTitle.toLowerCase() : 'repeatable'} exercises and tracking completion — shifting to performance data strengthens proof and confidence.`);
        }else if(cadenceTitle){
          bullets.push(`Cadence today: ${cadenceTitle}.`);
        }

        // 4) Package fit signals (realism, scope, delivery)
        const fitBits = [];
        const fitRealismShort = { generic:'generic scenarios', tooling:'tooling-aware', bespoke:'mirror environment' };
        const fitScopeShort = { single:'single team', multi:'multi-team', enterprise:'enterprise / multi-region' };
        const fitTodayShort = { training:'training completion', adhoc:'ad hoc exercises', scrutiny:'under scrutiny' };
        const fitServicesShort = { diy:'self-serve', guided:'guided support', whiteglove:'managed partnership' };
        const fitRiskShort = { skills:'skills gap', readiness:'response outcomes', governance:'governance proof' };

        if(state.fitRealism) fitBits.push('realism: ' + (fitRealismShort[state.fitRealism] || state.fitRealism));
        if(state.fitScope) fitBits.push('scope: ' + (fitScopeShort[state.fitScope] || state.fitScope));
        if(state.fitToday) fitBits.push('today: ' + (fitTodayShort[state.fitToday] || state.fitToday));
        if(state.fitServices) fitBits.push('delivery: ' + (fitServicesShort[state.fitServices] || state.fitServices));
        if(state.fitRiskFrame) fitBits.push('framing: ' + (fitRiskShort[state.fitRiskFrame] || state.fitRiskFrame));

        if(fitBits.length){
          bullets.push(`Package fit: ${shorten(fitBits, 3)}.`);
        }

        // 4) Context (industry/region + frameworks) as a single, readable line
        const regionLabels = { NA:'North America', UKI:'UK & Ireland', EU:'Europe (EU)', APAC:'APAC', Other:'Other / Global' };

        const ctxBits = [];
        if(state.industry) ctxBits.push(state.industry);
        if(state.region) ctxBits.push(regionLabels[state.region] || state.region);
        const regs = Array.from(state.regs || []).map(id => lbl(regMaster, id));

        if(ctxBits.length && regs.length){
          bullets.push(`Context: ${ctxBits.join(' · ')} mapped to ${shorten(regs, 4)}.`);
        }else if(ctxBits.length){
          bullets.push(`Context: ${ctxBits.join(' · ')}.`);
        }else if(regs.length){
          bullets.push(`Framework / regulation mapping: ${shorten(regs, 4)}.`);
        }

        // 5) Why now (keep short)
        const whyNow = [];
        if(state.drivers.includes('nearMiss')) whyNow.push('incident / near miss');
        if(state.drivers.includes('sectorPeer')) whyNow.push('sector peer incident');
        if(hasPressure('board') || state.evidence.has('board')) whyNow.push('board scrutiny');
        if(hasPressure('regulator') || state.evidence.has('reg')) whyNow.push('regulator / audit');
        if(state.drivers.includes('insurance') || state.evidence.has('insurer')) whyNow.push('insurance renewal');
        if(state.drivers.includes('change')) whyNow.push('transformation risk');

        if(whyNow.length){
          bullets.push(`Why now: ${shorten(whyNow, 2)}.`);
        }else if(state.milestone){
          bullets.push(`First milestone: ${lbl(milestoneOpts, state.milestone)}.`);
        }

        // Keep at most 5 bullets + add the always-on disclaimer.
        const out = bullets.filter(Boolean).slice(0, 6);
        out.push('ROI estimate is based on Immersive assumptions and comparable organizations, and is intended for planning guidance.');
        return out;
      }

      function primaryOutcome(best){
        const inferred = inferredPrimaryOutcomes(1);
        if(inferred.length) return outcomeLabel(inferred[0].id);
        const pressure = score().scores.pressure;
        if(pressure >= 7) return 'Transform Compliance into Evidence & Benchmarks';
        if(best === 'adv') return 'Prove Faster Detection, Response & Decision-Making';
        return 'Baseline capability + gaps';
      }

      function phasePlan(best){
        const prove = [];
        if(state.groups.has('exec')) prove.push('Run a Crisis Simulation to test decision-making, comms, and accountability.');
        if(state.groups.has('soc')) prove.push('Run a team cyber range exercise to measure detection, investigation, and response coordination.');
        if(state.groups.has('workforce')) prove.push('Launch a workforce exercise to quantify human risk and target upskilling.');
        if(!prove.length) prove.push('Run a targeted drill to establish a defensible baseline for readiness.');

        const improve = [];
        if(state.groups.has('appsec')) improve.push('Assign secure coding labs to close gaps and reduce vulnerability flow to production.');
        if(state.groups.has('cloud')) improve.push('Assign cloud security labs to reduce misconfiguration risk and speed response.');
        if(state.groups.has('soc')) improve.push('Assign DFIR / threat hunting labs aligned to the techniques you want to cover.');
        if(!improve.length) improve.push('Assign targeted labs based on baseline results to close the biggest gaps fast.');

        const br = [];
        if(best === 'ult') br.push('Stand up executive evidence mapping and reporting for board / regulator conversations.');
        else br.push('Establish a benchmark cadence and track deltas over time.');
        br.push('Produce a stakeholder-ready summary: “what improved, what’s still at risk, and what we’re doing next.”');

        return [
          'Prove: ' + prove.join(' '),
          'Improve: ' + improve.join(' '),
          'Benchmark & Report: ' + br.join(' ')
        ].join(' ');
      }

      function evidenceLine(){
        const list = [];
        if(state.evidence.has('board')) list.push('Board pack with trends + “so what” recommendations');
        if(state.evidence.has('reg')) list.push('Framework-aligned evidence map (audit / regulator)');
        if(state.evidence.has('insurer')) list.push('Insurer-ready narrative + controls / readiness proof points');
        if(state.evidence.has('customer')) list.push('Customer assurance support (due diligence responses)');
        if(state.evidence.has('internal')) list.push('Internal investment case backed by measurable outcomes');
        if(!list.length) return 'Evidence outputs tailored to your stakeholders (board, audit, insurer, customers).';
        return list.join(' · ');
      }

      // ---------- ROI estimate maths ----------
      // Baseline assumptions are derived from Immersive delivery experience with similar organizations.
      const IMMERSIVE_MODEL = {
        baselineRevenueB: 10,
        baselineInvestment: 250000,
        baselineCyber: 200,
        baselineDev: 1000,
        baselineWorkforce: 3000,
        benefitsPVBreak: {
          attrition: 1341322,
          hires: 747262,
          devProd: 257837,
          training: 275742,
          posture: 257717
        },
        costsPVBreak: { internal: 52033 },
        yearBenefits: [765067, 1328817, 1445692],
        initialCost: 11000,
        internalAnnual: 16500
      };

      const PV_FACTOR_3YR_10 = 2.48685;

      function inferProgramScale(revB){
        const revScale = Math.max(0.02, (Number(revB)||0) / IMMERSIVE_MODEL.baselineRevenueB);

        let cyber = IMMERSIVE_MODEL.baselineCyber * Math.pow(revScale, 0.60);
        let dev   = IMMERSIVE_MODEL.baselineDev   * Math.pow(revScale, 0.70);
        let wf    = IMMERSIVE_MODEL.baselineWorkforce * Math.pow(revScale, 0.70);

        cyber = clamp(Math.round(cyber / 5) * 5, 10, 1500);
        dev   = clamp(Math.round(dev / 50) * 50, 50, 8000);
        wf    = clamp(Math.round(wf / 250) * 250, 200, 200000);

        return { cyber, dev, wf, revScale };
      }

      // Pricing is driven primarily by how many people are exercised (and their roles),
      // plus configuration / cadence. We approximate that here with weighted "seat units" so footprint
      // changes visibly move the estimated spend.
      const COST_MODEL = {
  // Pricing is driven primarily by who is exercised (and their roles), plus cadence / scope.
  // We approximate that with weighted "seat units" and a volume-discount curve.
  // Tuned so most mid/large enterprises land around ~$500k–$1M/yr, with multi-million
  // edge cases supported for strategic enterprise deals.
  wCyber: 2.50,   // cyber / IR roles are range-heavy (highest unit weight)
  wDev:   1.00,   // devs are lab-heavy (mid unit weight)
  wWf:    0.02,   // wider workforce has a *very* light influence (directional only)
  alpha:  0.90    // modest volume discount (keeps outputs sane, can reach higher enterprise ranges)
};

      function weightedSeatUnits(cyber, dev, wf){
        return (Number(cyber)||0) * COST_MODEL.wCyber +
               (Number(dev)||0)   * COST_MODEL.wDev +
               (Number(wf)||0)    * COST_MODEL.wWf;
      }

      const BASE_WEIGHTED_SEATS = weightedSeatUnits(IMMERSIVE_MODEL.baselineCyber, IMMERSIVE_MODEL.baselineDev, IMMERSIVE_MODEL.baselineWorkforce);

      function typicalInvestment(revB, footprint = {}){
        const suggested = footprint.suggested || inferProgramScale(revB);
        const cyber = Number(footprint.cyber) || suggested.cyber;
        const dev   = Number(footprint.dev)   || suggested.dev;
        const wf    = Number(footprint.wf)    || suggested.wf;

        const weighted = weightedSeatUnits(cyber, dev, wf);
        const seatScale = (BASE_WEIGHTED_SEATS > 0) ? (weighted / BASE_WEIGHTED_SEATS) : 1;

        // Keep the model stable at extremes:
        // - floor prevents spend collapsing to near-zero for small orgs
        // - ceiling avoids absurd outputs for very large / mismatched inputs
        let invUSD = IMMERSIVE_MODEL.baselineInvestment * Math.pow(clamp(seatScale, 0.08, 25), COST_MODEL.alpha);

        invUSD = clamp(invUSD, 25000, 9000000);
        invUSD = Math.round(invUSD / 5000) * 5000;
        return invUSD;
      }


      function realizationFactor(){
        if(state.realization === 'conservative') return 0.60;
        if(state.realization === 'expected') return 0.80;
        return 1.00; // Immersive base
      }

      function computeRoi(){
        const invest = Number(state.investUSD)||0;
        const revB = Number(state.revenueB)||0;

        const suggested = inferProgramScale(revB);

        const cyber = Number(state.teamCyber)||suggested.cyber;
        const dev   = Number(state.teamDev)||suggested.dev;
        const wf    = Number(state.teamWf)||suggested.wf;

        const typInvest = typicalInvestment(revB, { cyber, dev, wf, suggested });


        const cyberScale = cyber / IMMERSIVE_MODEL.baselineCyber;
        const devScale = dev / IMMERSIVE_MODEL.baselineDev;
        const postureScale = Math.pow(suggested.revScale, 0.70);

        // Salary sensitivity (directional)
        const BASE_CYBER_SAL = 180000;
        const BASE_DEV_SAL = 160000;
        const salaryCyberScale = clamp((Number(state.cyberSalaryUSD)||BASE_CYBER_SAL) / BASE_CYBER_SAL, 0.5, 2.0);
        const salaryDevScale = clamp((Number(state.devSalaryUSD)||BASE_DEV_SAL) / BASE_DEV_SAL, 0.5, 2.0);

        let benefitsPV =
          (IMMERSIVE_MODEL.benefitsPVBreak.attrition * cyberScale * salaryCyberScale) +
          (IMMERSIVE_MODEL.benefitsPVBreak.hires * cyberScale * salaryCyberScale) +
          (IMMERSIVE_MODEL.benefitsPVBreak.devProd * devScale * salaryDevScale) +
          (IMMERSIVE_MODEL.benefitsPVBreak.training * cyberScale * salaryCyberScale) +
          (IMMERSIVE_MODEL.benefitsPVBreak.posture * postureScale);

        // Diminishing returns if investment deviates from suggested (keeps maths sensible)
        const invRatio = typInvest > 0 ? invest / typInvest : 1;
        const invScale = Math.pow(clamp(invRatio, 0.4, 1.6), 0.85);

        benefitsPV = benefitsPV * invScale * realizationFactor();

        const subscriptionPV = invest * PV_FACTOR_3YR_10;
        const internalPV = IMMERSIVE_MODEL.costsPVBreak.internal * Math.pow(suggested.revScale, 0.25);
        const costsPV = subscriptionPV + internalPV;

        const npv = benefitsPV - costsPV;
        const roi = costsPV > 0 ? (npv / costsPV) : 0;

        return { benefitsPV, costsPV, npv, roi, suggested, typInvest };
      }

      const MODEL_BENEFITS_PV = Object.values(IMMERSIVE_MODEL.benefitsPVBreak).reduce((a,b)=>a+b,0);

      function computePaybackMonths(roi){
        const delay = clamp(Number(state.paybackDelayMonths)||0, 0, 12);

        const benefitScale = MODEL_BENEFITS_PV > 0 ? (roi.benefitsPV / MODEL_BENEFITS_PV) : 1;
        const yearBenefits = (IMMERSIVE_MODEL.yearBenefits || [0,0,0]).map(v => v * benefitScale);

        const internalScale = Math.pow(roi.suggested.revScale, 0.25);
        const initial = (IMMERSIVE_MODEL.initialCost || 0) * internalScale;
        const internalAnnual = (IMMERSIVE_MODEL.internalAnnual || 0) * internalScale;

        const annualCost = (Number(state.investUSD)||0) + internalAnnual;

        let cum = -initial;

        for(let m=1; m<=36; m++){
          const y = Math.floor((m-1)/12);
          const monthlyCost = annualCost / 12;
          const monthlyBenefit = (m <= delay) ? 0 : (yearBenefits[y] / 12);
          cum += (monthlyBenefit - monthlyCost);
          if(cum >= 0) return m;
        }
        return null;
      }

      function fmtPayback(months){
        if(months === null || months === undefined) return '—';
        if(months <= 0) return 'Immediate';
        if(months < 12) return `~${Math.round(months)} mo`;
        const yrs = months / 12;
        return `~${yrs.toFixed(1).replace(/\.0$/,'')} yrs`;
      }

      // ---------- Update UI ----------
      function update(){
        const setText = (sel, val) => {
          const el = $(sel);
          if(!el) return;
          const next = String(val ?? '');
          if(el.textContent === next) return;
          el.textContent = next;
          if(snapshotMotionReady && isSnapshotValueSelector(sel)){
            replayMotionClass(el, 'is-refresh', 260);
          }
        };
        const setHTML = (sel, val) => {
          const el = $(sel);
          if(!el) return;
          const next = String(val ?? '');
          if(el.innerHTML === next) return;
          el.innerHTML = next;
          if(snapshotMotionReady && isSnapshotValueSelector(sel)){
            replayMotionClass(el, 'is-refresh', 260);
          }
        };

        setView(state.currentView, { render:false });
        renderDashboardRows();
        renderArchivedRows();
        renderWorkspaceCompanies();
        renderArchiveNavMeta();
        renderInterstitialView();
        syncGlobalActionBar();
        const jumpBtns = $$('[data-jump-next-incomplete]');
        const jumpLabels = $$('.jumpNextIncompleteBtnLabel');
        if(jumpBtns.length){
          const nextIncomplete = nextIncompleteStepFrom(state.activeStep);
          if(nextIncomplete === null){
            jumpBtns.forEach((jumpBtn)=>{
              jumpBtn.disabled = true;
              jumpBtn.title = 'All sections complete';
            });
            jumpLabels.forEach((jumpLabel)=>{ jumpLabel.textContent = 'All complete'; });
          }else{
            jumpBtns.forEach((jumpBtn)=>{
              jumpBtn.disabled = false;
              jumpBtn.title = `Jump to next incomplete section (Step ${nextIncomplete})`;
            });
            jumpLabels.forEach((jumpLabel)=>{ jumpLabel.textContent = 'Next incomplete'; });
          }
        }
        const saveBtn = $('#saveRecordBtn');
        const saveLabel = $('#saveRecordBtnLabel');
        if(saveBtn){
          const isThinking = !!state.saveIsThinking;
          const justSaved = !isThinking && Date.now() < (state.savePulseUntil || 0);
          saveBtn.dataset.saved = justSaved ? 'true' : 'false';
          saveBtn.dataset.thinking = isThinking ? 'true' : 'false';
          saveBtn.setAttribute('aria-busy', isThinking ? 'true' : 'false');
          if(saveLabel){
            saveLabel.textContent = isThinking ? 'Saving...' : (justSaved ? 'Saved' : 'Save record');
          }
        }

        const labelFrom = (list, id) => {
          const it = (list||[]).find(x => x.id === id);
          if(!it) return id;
          return it.label || it.title || id;
        };

        const regionLabels = { NA:'North America', UKI:'UK & Ireland', EU:'Europe (EU)', APAC:'APAC', Other:'Other / Global' };
        const liveGaps = dashboardCurrentGaps();
        const liveRequirements = readinessRequirements(state);
        const missingRequirementKeys = new Set(
          liveRequirements
            .filter((req)=> !req.done && req.key)
            .map((req)=> req.key)
        );
        const gapSteps = new Set(
          liveGaps.map((gap)=> clamp(Number(gap && gap.step) || 1, 1, 6))
        );

        syncMilestoneFromSignals();
        syncEvidenceFromPressure();

        // Context-driven regulatory suggestions (industry + region)
        syncContextRegSignals();
        syncRegModeUI();

        // Render the (dynamic) regulatory options list
        renderOptionButtons($('#optRegs'), regOptionsForUI(), state.regs, ()=>{
          state.regsTouched = true;
        });

        const topOutcomes = inferredPrimaryOutcomes(3);
        const topOutcomePct = topOutcomePercentages(topOutcomes);
        const top3 = $('#outcomeTop3');
        if(top3){
          const topOutcomeSig = topOutcomes.length
            ? topOutcomes.map(o => `${o.id}:${Number(topOutcomePct[o.id] || 0)}`).join('|')
            : 'empty';
          if(!topOutcomes.length){
            if(top3.dataset.sig !== topOutcomeSig){
              top3.textContent = 'Complete the discovery questions above to see your top outcomes.';
              top3.classList.remove('is-stagger');
              top3.dataset.sig = topOutcomeSig;
              top3.dataset.pctAnimated = 'true';
            }
          }else{
            if(top3.dataset.sig !== topOutcomeSig){
              top3.innerHTML = topOutcomes.map((o, i)=>
                `<div class="outcomeTopItem" style="--row-i:${i};"><span class="outcomeBadge">${i+1}</span><span class="outcomeTopLabel">${escapeHtml(o.label)}</span><span class="outcomeTopPct" data-target-pct="${Number(topOutcomePct[o.id] || 0)}">${Number(topOutcomePct[o.id] || 0)}%</span></div>`
              ).join('');
              top3.dataset.sig = topOutcomeSig;
              top3.dataset.pctAnimated = 'false';
              if(!prefersReducedMotion()){
                replayMotionClass(top3, 'is-stagger', 520);
              }else{
                top3.classList.remove('is-stagger');
              }
            }
            ensureOutcomeTopObserver(top3);
            if(isElementInViewport(top3, 0.28)) animateOutcomeTopPercentages(top3);
          }
        }
        setText('#outcomePlaybackConfirm',
          topOutcomes.length
            ? 'Ordered by weighted fit from your selections. Percentages show the relative weighting across these top outcomes.'
            : 'These outcomes are derived from your previous answers.'
        );
        renderOutcomeCards(topOutcomes);
        renderOutcomeDrilldowns(topOutcomes);
        setSelectionPill('#riskEnvMeta', (state.riskEnvs || []).length, 2);


        const joinFromSet = (setRef, list) => {
          const ids = Array.from(setRef || []);
          if(!ids.length) return '—';
          return ids.map(id => labelFrom(list, id)).join(' · ');
        };

        const joinArray = (arr, list) => {
          const ids = Array.from(arr || []);
          if(!ids.length) return '—';
          return ids.map(id => labelFrom(list, id)).join(' · ');
        };
        const lbl = labelFrom;

        // Driver meta
        setSelectionPill('#driverMeta', state.drivers.length, 3);
        setSelectionPill('#pressureMeta', (state.pressureSources || []).length, 3);

        // Recommendation
        const rec = score();
        const tier = (rec.best === 'core') ? packages.core : (rec.best === 'adv') ? packages.adv : packages.ult;

        setText('#recTitle', `${tier.name} package`);
        setText('#recDesc', `${tier.tagline} · ${tier.desc}`);

        const rs = reasons(rec.best);
        const reasonsHtml = rs.map(r => `<li><span class="dot"></span><div>${escapeHtml(r)}</div></li>`).join('');
        const reasonsEl = $('#reasons');
        if(reasonsEl) reasonsEl.innerHTML = reasonsHtml;
        setText('#sideWhySummary', `Why this package · ${rs.length} reason${rs.length === 1 ? '' : 's'}`);

        const sideWhy = $('#sideWhyBlock');
        const sideRoi = $('#sideRoiBlock');
        const sideAnswers = $('#sideAnswersBlock');
        const autoOpen = (el, open)=>{
          if(!el) return;
          if(el.dataset.userSet === 'true') return;
          const want = !!open;
          if(el.open !== want){
            el.dataset.autoToggle = 'true';
            el.open = want;
          }
        };
        autoOpen(sideWhy, false);
        autoOpen(sideRoi, state.activeStep >= 5 || state.visited.has(5));
        autoOpen(sideAnswers, true);

        const sideAnswersBody = sideAnswers ? sideAnswers.querySelector('.sideAnswersBody') : null;
        if(sideAnswers && sideAnswersBody){
          if(sideAnswers.open){
            const sideAnswersSummary = sideAnswers.querySelector('summary');
            const summaryH = sideAnswersSummary ? sideAnswersSummary.offsetHeight : 0;
            const availableH = Math.max(120, sideAnswers.clientHeight - summaryH);
            sideAnswersBody.style.maxHeight = `${availableH}px`;
          }else{
            sideAnswersBody.style.maxHeight = '';
          }
        }

        const inputAccByStep = {
          1: ['inputAccAbout'],
          2: ['inputAccCoverage'],
          3: ['inputAccFit'],
          4: ['inputAccContext'],
          5: ['inputAccRoi'],
          6: ['inputAccReview']
        };
        const openAccordions = new Set(inputAccByStep[state.activeStep] || []);
        const inputsCol = $('#inputsCol');
        if(inputsCol){
          $$('.inputAccordion', inputsCol).forEach((acc)=>{
            acc.open = openAccordions.has(acc.id);
            const stepForAcc = Number(Object.keys(inputAccByStep).find((stepNo)=>{
              return (inputAccByStep[stepNo] || []).includes(acc.id);
            })) || null;
            const hasGap = stepForAcc ? gapSteps.has(stepForAcc) : false;
            acc.dataset.incomplete = hasGap ? 'true' : 'false';
          });
        }

        const sidePrimaryOutcome = $('#sidePrimaryOutcome');
        if(sidePrimaryOutcome){
          const sideOutcomeSig = topOutcomes.length
            ? topOutcomes.map(o => o.id).join('|')
            : 'empty';
          if(topOutcomes.length){
            if(sidePrimaryOutcome.dataset.sig !== sideOutcomeSig){
              const staggerClass = prefersReducedMotion() ? '' : ' is-stagger';
              sidePrimaryOutcome.innerHTML = `<div class="sideOutcomeList${staggerClass}" data-count="${topOutcomes.length}">${topOutcomes.map((o, i)=>{
                const meta = outcomeById(o.id) || o;
                const text = meta.short || meta.label || '';
                return `<div class="sideOutcomeItem" style="--item-i:${i};"><span class="sideOutcomeRank">${i + 1}</span><span class="sideOutcomeText">${escapeHtml(text)}</span></div>`;
              }).join('')}</div>`;
              sidePrimaryOutcome.dataset.sig = sideOutcomeSig;
            }
          }else{
            if(sidePrimaryOutcome.dataset.sig !== sideOutcomeSig){
              sidePrimaryOutcome.textContent = 'Complete Step 0 to infer your top outcomes.';
              sidePrimaryOutcome.dataset.sig = sideOutcomeSig;
            }
          }
        }
// ROI estimate
        const revLabel = $('#revenueLabel');
        if(revLabel) revLabel.textContent = fmtRevenueFromUSDB(state.revenueB);

        const roi = computeRoi();
        const paybackMonths = computePaybackMonths(roi);

        const roiPctVal = roi.roi * 100;
        const npvVal = roi.npv;
        const spendVal = state.investUSD;
        const roiTxt = Math.round(roiPctVal) + '%';
        const npvTxt = fmtMoneyCompactUSD(npvVal, { signed:true, sig:3 });
        const paybackTxt = fmtPayback(paybackMonths);
        const spendTxt = fmtMoneyCompactUSD(spendVal, { sig:3 }) + '/yr';
        const showROI = state.visited.has(5);

        const moneyFmtSig = `cur:${state.currency}`;
        tweenMetricText($('#roiOut'), roiPctVal, (v)=> `${Math.round(v)}%`, { duration: 320, formatSig: 'pct' });
        tweenMetricText($('#npvOut'), npvVal, (v)=> fmtMoneyCompactUSD(v, { signed:true, sig:3 }), { duration: 380, formatSig: moneyFmtSig });
        tweenMetricText($('#paybackOut'), paybackMonths, (v)=> fmtPayback(v), { duration: 320, formatSig: 'payback' });
        tweenMetricText($('#valueInputsOut'), spendVal, (v)=> `${fmtMoneyCompactUSD(v, { sig:3 })}/yr`, { duration: 380, formatSig: moneyFmtSig });

        // Snapshot ROI estimate (hide until ROI step is visited)
        const roiGrid = $('#roiSnapGrid');
        const roiNote = $('#roiSnapNote');
        if(roiGrid) roiGrid.classList.toggle('hide', !showROI);
        if(roiNote) roiNote.classList.toggle('hide', showROI);

        if(showROI){
          tweenMetricText($('#roiSnap'), roiPctVal, (v)=> `${Math.round(v)}%`, { duration: 320, formatSig: 'pct' });
          tweenMetricText($('#npvSnap'), npvVal, (v)=> fmtMoneyCompactUSD(v, { signed:true, sig:3 }), { duration: 380, formatSig: moneyFmtSig });
          tweenMetricText($('#paybackSnap'), paybackMonths, (v)=> fmtPayback(v), { duration: 320, formatSig: 'payback' });
          tweenMetricText($('#valueInputs'), spendVal, (v)=> `${fmtMoneyCompactUSD(v, { sig:3 })}/yr`, { duration: 380, formatSig: moneyFmtSig });
        }else{
          setText('#roiSnap', '—');
          setText('#npvSnap', '—');
          setText('#paybackSnap', '—');
          setText('#valueInputs', '—');
        }
        setText('#snapRoiPct', showROI ? roiTxt : 'Complete Step 4');
        setText('#snapRoiNpv', showROI ? npvTxt : '—');
        setText('#snapRoiPayback', showROI ? paybackTxt : '—');
        setText('#snapRoiSpend', showROI ? spendTxt : '—');
// Key selections (snapshot)
        const milestoneTitle = state.milestone ? labelFrom(milestoneOpts, state.milestone) : '—';
        const urgentWinTitle = state.urgentWin ? labelFrom(urgentWinOpts, state.urgentWin) : '—';
        const measuredOnTitle = state.measuredOn ? labelFrom(measuredOnOpts, state.measuredOn) : '—';
        const orgPainTitle = state.orgPain ? labelFrom(orgPainOpts, state.orgPain) : '—';
        const rhythmTitle = state.rhythm ? labelFrom(rhythmOpts, state.rhythm) : '—';
        const measureTitle = state.measure ? labelFrom(measureOpts, state.measure) : '—';
        const outcomesTxt = primaryOutcomesText(3);

        const toLabels = (ids, list) => (Array.from(ids || [])).map(id => labelFrom(list, id)).filter(Boolean);
        const pressureLabels = toLabels(state.pressureSources || [], pressureOpts.map(p => ({ id:p.id, label:p.title })));
        const riskEnvLabels = toLabels(state.riskEnvs || [], riskEnvOpts.map(r => ({ id:r.id, label:r.title })));
        const driverLabels = toLabels(state.drivers || [], driverOpts.map(d => ({ id:d.id, label:d.title })));
        const evidenceLabels = toLabels(Array.from(state.evidence || []), evidenceOpts);
        const groupLabels = toLabels(Array.from(state.groups || []), groupOpts);
        const regsLabels = toLabels(Array.from(state.regs || []), regMaster);
        const stackLabels = toLabels(Array.from(state.stack || []), stackMaster);
        if(state.stackOther && String(state.stackOther).trim()){
          stackLabels.push(String(state.stackOther).trim());
        }

        const pressureTitle = pressureLabels.length ? pressureLabels.join(' · ') : '—';
        const riskEnvTxt = riskEnvLabels.length ? riskEnvLabels.join(' · ') : '—';
        const driversTxt = driverLabels.length ? driverLabels.join(' · ') : '—';
        const evidenceTxt = evidenceLabels.length ? evidenceLabels.join(' · ') : '—';
        const groupsTxt = groupLabels.length ? groupLabels.join(' · ') : '—';
        const regsTxt = regsLabels.length ? regsLabels.join(' · ') : '—';
        const stackTxt = stackLabels.length ? stackLabels.join(' · ') : '—';

        const chipsHTML = (items, maxVisible=3) => {
          const vals = (items || []).map(v => String(v || '').trim()).filter(Boolean);
          if(!vals.length) return '<span class="kvEmpty">—</span>';
          const shown = vals.slice(0, maxVisible);
          const hidden = vals.slice(maxVisible);
          const shownHtml = shown.map(v => `<span class="valueChip">${escapeHtml(v)}</span>`).join('');
          if(!hidden.length) return `<div class="chipsInline">${shownHtml}</div>`;
          const hiddenHtml = hidden.map(v => `<span class="valueChip">${escapeHtml(v)}</span>`).join('');
          return `<div class="chipsInline">${shownHtml}</div><details class="chipsMore"><summary>+${hidden.length} more</summary><div class="chipsInline">${hiddenHtml}</div></details>`;
        };
        const short = (v, max=26) => {
          const s = String(v || '').trim();
          if(!s) return '—';
          return s.length > max ? (s.slice(0, max - 1) + '…') : s;
        };

        const ctxBits = [];
        if(state.industry) ctxBits.push(state.industry);
        if(state.region) ctxBits.push(regionLabels[state.region] || state.region);
        const ctxTxt = ctxBits.length ? ctxBits.join(' · ') : '—';
        const contextNote = $('#contextFromStep0');
        if(contextNote){
          contextNote.textContent = (ctxTxt === '—')
            ? 'Complete Step 0 to personalize regulation suggestions.'
            : `Using ${ctxTxt} to tailor suggested regulations.`;
        }

        // Side snapshot (decision + selections)
        setHTML('#snapPressure', chipsHTML(pressureLabels, 99));
        setHTML('#snapDrivers', chipsHTML(driverLabels, 99));
        setText('#snapMilestone', urgentWinTitle !== '—' ? urgentWinTitle : milestoneTitle);
        setHTML('#snapRiskEnv', chipsHTML(riskEnvLabels, 99));
        setText('#snapMeasuredOn', measuredOnTitle);
        setText('#snapOrgPain', orgPainTitle);
        setHTML('#snapEvidence', chipsHTML(evidenceLabels, 99));
        setHTML('#snapOutcomes', chipsHTML(topOutcomes.map(o => o.short || o.label), 99));
        setHTML('#snapGroups', chipsHTML(groupLabels, 99));

        // Package fit snapshot
        const fitRealismSnap = state.fitRealism ? ((fitSnapLabels.fitRealism && fitSnapLabels.fitRealism[state.fitRealism]) || lbl(fitRealismOpts, state.fitRealism)) : '—';
        const fitScopeSnap = state.fitScope ? ((fitSnapLabels.fitScope && fitSnapLabels.fitScope[state.fitScope]) || lbl(fitScopeOpts, state.fitScope)) : '—';
        const fitTodaySnap = state.fitToday ? ((fitSnapLabels.fitToday && fitSnapLabels.fitToday[state.fitToday]) || lbl(fitTodayOpts, state.fitToday)) : '—';
        const fitServicesSnap = state.fitServices ? ((fitSnapLabels.fitServices && fitSnapLabels.fitServices[state.fitServices]) || lbl(fitServicesOpts, state.fitServices)) : '—';
        const fitRiskSnap = state.fitRiskFrame ? ((fitSnapLabels.fitRiskFrame && fitSnapLabels.fitRiskFrame[state.fitRiskFrame]) || lbl(fitRiskFrameOpts, state.fitRiskFrame)) : '—';

        setText('#snapFitRealism', fitRealismSnap);
        setText('#snapFitScope', fitScopeSnap);
        setText('#snapFitToday', fitTodaySnap);
        setText('#snapFitServices', fitServicesSnap);
        setText('#snapFitRisk', fitRiskSnap);

        setText('#snapCadence', rhythmTitle);
        setText('#snapMeasurement', measureTitle);

        setText('#snapIndustry', state.industry ? state.industry : '—');
        setText('#snapRegion', state.region ? (regionLabels[state.region] || state.region) : '—');
        setHTML('#snapRegulatory', chipsHTML(regsLabels, 99));

        setHTML('#snapStack', chipsHTML(stackLabels, 99));

        const stackOtherLower = String(state.stackOther || '').toLowerCase();
        let grcLabel = '—';
        if(stackOtherLower.includes('servicenow')) grcLabel = 'ServiceNow';
        else if(stackOtherLower.includes('archer')) grcLabel = 'Archer';
        else if(state.stack.has('grc')) grcLabel = 'ServiceNow / Archer';
        setText('#snapGrc', grcLabel);

        const sizeMapInline = {
          'lt500':'< 500',
          '500-2k':'500–2,000',
          '2k-10k':'2,000–10,000',
          '10k-50k':'10,000–50,000',
          '50kplus':'50,000+'
        };
        const roleLabelInline = state.role ? labelFrom(roleOpts, state.role) : '—';
        const companySizeInline = state.companySize ? (sizeMapInline[state.companySize] || state.companySize) : '—';
        setText('#snapOrgRole', roleLabelInline);
        setText('#snapOrgName', state.fullName || '—');
        setText('#snapOrgCompany', state.company || '—');
        setText('#snapOrgCountry', state.operatingCountry || '—');
        setText('#snapOrgSize', companySizeInline);
        setText('#snapReviewPackage', `${tier.name} package`);
        setHTML('#snapReviewOutcomes', chipsHTML(topOutcomes.map(o => o.short || o.label), 99));

        // captured count
        const selTotal = 14;
        const fitAnsweredCount = ['fitRealism','fitScope','fitToday','fitServices','fitRiskFrame'].filter(k => !!state[k]).length;
        const discoveryDone =
          (state.pressureSources || []).length > 0 &&
          !!state.urgentWin &&
          !!state.measuredOn &&
          !!state.orgPain &&
          (state.riskEnvs || []).length > 0;

        const selDone =
          ((state.role || state.fullName || state.company || state.companySize || state.operatingCountry) ? 1 : 0) +
          (discoveryDone ? 1 : 0) +
          (state.drivers.length ? 1 : 0) +
          (state.evidence.size ? 1 : 0) +
          (state.groups.size ? 1 : 0) +
          (state.rhythm ? 1 : 0) +
          (state.measure ? 1 : 0) +
          (fitAnsweredCount ? 1 : 0) +
          ((state.industry || state.region) ? 1 : 0) +
          (state.regs.size ? 1 : 0) +
          ((state.stack.size || state.stackOther) ? 1 : 0) +
          (state.visited.has(5) ? 1 : 0) +
          (topOutcomes.length ? 1 : 0) +
          (Object.keys(state.outcomeDrilldowns || {}).length ? 1 : 0);

        setText('#selPill', `${selDone}/${selTotal} captured`);

        // Step completion + incomplete highlighting
        const done1 = !gapSteps.has(1);
        const done2 = !gapSteps.has(2);
        const done3 = !gapSteps.has(3);
        const done4 = !gapSteps.has(4);
        const done5 = !gapSteps.has(5);
        const done6 = false;
        const chipLabel = { 1:'0', 2:'1', 3:'2', 4:'3', 5:'4', 6:'5' };

        $$('.chip').forEach(ch=>{
          const step = Number(ch.dataset.chip);
          const strong = ch.querySelector('strong');
          const wasDone = ch.dataset.done === 'true';
          const isDone =
            (step===1 && done1) ||
            (step===2 && done2) ||
            (step===3 && done3) ||
            (step===4 && done4) ||
            (step===5 && done5) ||
            (step===6 && done6);

          ch.dataset.done = isDone ? 'true' : 'false';
          ch.dataset.incomplete = (!isDone && gapSteps.has(step)) ? 'true' : 'false';
          if(strong){
            strong.textContent = isDone ? '✔' : (chipLabel[step] || String(step));
            if(!wasDone && isDone){
              replayMotionClass(strong, 'tick-pop', 300);
            }
          }
        });
        $$('.step').forEach((stepEl)=>{
          const stepNo = clamp(Number(stepEl.dataset.step) || 1, 1, 6);
          const hasGap = gapSteps.has(stepNo);
          stepEl.dataset.incomplete = hasGap ? 'true' : 'false';
        });
        applyRequiredFieldHighlights(missingRequirementKeys);

        // Your plan view
        setText('#planTitle', `${tier.name} is the best starting point`);
        setText('#planDesc', `${tier.tagline} ${tier.desc}`);
setText('#primaryOutcome', primaryOutcome(rec.best));
        setText('#coverageKpi', groupsTxt);

        const planReasons = $('#planReasons');
        if(planReasons) planReasons.innerHTML = reasonsHtml;

        setText('#plan90', phasePlan(rec.best));
        setText('#planEvidence', evidenceLine());

        // Review: our understanding (Step 5)
        const sizeMap = {
          'lt500':'< 500 employees',
          '500-2k':'500–2,000 employees',
          '2k-10k':'2,000–10,000 employees',
          '10k-50k':'10,000–50,000 employees',
          '50kplus':'50,000+ employees'
        };

        const line = (k, v) => {
          const key = escapeHtml(k);
          const val = escapeHtml((v && String(v).trim()) ? v : '—');
          return `<div class="sumLine"><span class="sumK">${key}</span><span class="sumV">${val}</span></div>`;
        };

        // Organisation (who you are)
        const orgBits = [];
        if(state.role){
          const r = roleOpts.find(x => x.id === state.role);
          orgBits.push(`Role: ${r ? r.label : state.role}`);
        }
        if(state.company) orgBits.push(state.company);
        if(state.companySize) orgBits.push(sizeMap[state.companySize] || state.companySize);
        if(state.operatingCountry) orgBits.push(`Country: ${state.operatingCountry}`);
        if(state.fullName) orgBits.push(`Contact: ${state.fullName}`);
        const orgTxt = orgBits.length ? orgBits.join(' · ') : '—';
        setHTML('#sumOrg', escapeHtml(orgTxt));

        // ROI inputs (how you sized)
        if(showROI){
          const valueBits = [];
          valueBits.push(`Revenue/budget: ${fmtRevenueFromUSDB(state.revenueB)}`);
          valueBits.push(`Spend: ${fmtMoneyUSD(state.investUSD)}/yr`);
          valueBits.push(`Footprint: ~${fmtNum(state.teamCyber)} cyber · ~${fmtNum(state.teamDev)} dev · ~${fmtNum(state.teamWf)} workforce`);
          const valueTxt = valueBits.join(' · ');
          setHTML('#sumValue', escapeHtml(valueTxt));
        } else {
          setHTML('#sumValue', escapeHtml('Complete Step 4 to generate an Immersive estimate based on comparable organizations.'));
        }

        // Mandate
        setHTML('#sumMandate', [
          line('Pressure sources', pressureTitle),
          line('Urgent 90-day win', urgentWinTitle),
          line('Risk environment', riskEnvTxt),
          line('Measured on today', measuredOnTitle),
          line('Org pain', orgPainTitle),
          line('Evidence audience', evidenceTxt),
          line('Primary outcomes', outcomesTxt)
        ].join(''));

        const outcomesDetailHtml = topOutcomes.length
          ? topOutcomes.map((o, idx)=>{
              const meta = outcomeById(o.id) || o;
              return line(`${idx + 1}) ${meta.label}`, meta.oneLiner || meta.desc || '—');
            }).join('')
          : line('Top outcomes', 'Complete the outcome discovery questions in Step 0.');
        setHTML('#sumOutcomes', outcomesDetailHtml);

        const tierBullets = tierWhyBullets(rec.best, 3);
        const tierHtml = [
          line('Recommended tier', `${tier.name} (${rec.conf})`),
          tierBullets.length
            ? `<ul>${tierBullets.map(b => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`
            : `<div class="sumLine"><span class="sumV">—</span></div>`
        ].join('');
        setHTML('#sumTier', tierHtml);

        const agenda = buildNextMeetingAgenda(topOutcomes);
        setHTML('#sumAgenda', agenda.length ? `<ul>${agenda.map(a => `<li>${escapeHtml(a)}</li>`).join('')}</ul>` : '—');
        setText('#snapReviewAgenda', agenda.length ? agenda.slice(0, 2).join(' · ') : '—');

        const who = buildWhoToBring(topOutcomes);
        setHTML('#sumWho', who.length ? `<ul>${who.map(w => `<li>${escapeHtml(w)}</li>`).join('')}</ul>` : '—');

        const resources = buildRecommendedResources(topOutcomes);
        setHTML('#sumResources', resources.length ? `<ul>${resources.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul>` : '—');

        // Coverage
        setHTML('#sumCoverage', [
          line('Groups', groupsTxt),
          line('Cadence', rhythmTitle),
          line('Measurement', measureTitle),
          line('Advanced triggers', driversTxt)
        ].join(''));

        // Package fit
        setHTML('#sumFit', [
          line('Exercise realism', fitRealismSnap),
          line('Program scope', fitScopeSnap),
          line('Current state', fitTodaySnap),
          line('Delivery style', fitServicesSnap),
          line('Problem framing', fitRiskSnap)
        ].join(''));

        // Context
        const industryTitle = state.industry ? state.industry : '—';
        const regionTitle = state.region ? (regionLabels[state.region] || state.region) : '—';
        setHTML('#sumContext', [
          line('Industry', industryTitle),
          line('Region', regionTitle),
          line('Regulatory', regsTxt)
        ].join(''));

        // Tools & platforms
        setHTML('#sumStack', escapeHtml(stackTxt));

        if(state.starPulseQueue && state.starPulseQueue.size){
          state.starPulseQueue.clear();
        }
        if(state.consultationOpen){
          renderConsultationPanel(state.consultationThreadId || state.activeThread || 'current');
        }

        snapshotMotionReady = true;
      }

      function escapeHtml(str){
        return String(str)
          .replace(/&/g,'&amp;')
          .replace(/</g,'&lt;')
          .replace(/>/g,'&gt;')
          .replace(/"/g,'&quot;')
          .replace(/'/g,'&#039;');
      }

      function buildSummaryText(tier, rs, roi, paybackTxt){
        const lines = [];
        const sizeMap = {
          'lt500':'< 500 employees',
          '500-2k':'500–2,000 employees',
          '2k-10k':'2,000–10,000 employees',
          '10k-50k':'10,000–50,000 employees',
          '50kplus':'50,000+ employees'
        };
        const lbl = (list, id) => {
          const it = (list || []).find(x => x.id === id);
          return it ? (it.label || it.title || id) : id;
        };

        lines.push('Immersive One — Cyber Readiness Configurator (Prototype v27)');
        lines.push('');

        if(state.company || state.fullName || state.companySize || state.operatingCountry || state.role){
          const sizeTxt = state.companySize ? (sizeMap[state.companySize] || state.companySize) : '';
          const roleTxt = state.role ? ((roleOpts.find(x => x.id === state.role) || {}).label || state.role) : '';
          lines.push('Business: ' + [
            state.company,
            sizeTxt,
            state.operatingCountry ? ('Country: ' + state.operatingCountry) : '',
            roleTxt ? ('Role: ' + roleTxt) : '',
            state.fullName ? ('Contact: ' + state.fullName) : ''
          ].filter(Boolean).join(' | '));
          lines.push('');
        }

        lines.push('Recommended package: ' + tier.name);
        lines.push('');

        const topOutcomes = inferredPrimaryOutcomes(3);
        const outcomesTxt = topOutcomes.length ? topOutcomes.map(o => o.short).join(', ') : '—';
        if(outcomesTxt !== '—') lines.push('Primary outcomes: ' + outcomesTxt);

        if((state.pressureSources || []).length){
          const p = (state.pressureSources || []).map(id => lbl(pressureOpts.map(x=>({ id:x.id, label:x.title })), id));
          lines.push('Pressure sources: ' + p.join(', '));
        }
        if(state.urgentWin) lines.push('Urgent 90-day win: ' + lbl(urgentWinOpts, state.urgentWin));
        if((state.riskEnvs || []).length){
          const envs = (state.riskEnvs || []).map(id => lbl(riskEnvOpts, id));
          lines.push('Risk environment: ' + envs.join(', '));
        }
        if(state.measuredOn) lines.push('Measured on today: ' + lbl(measuredOnOpts, state.measuredOn));
        if(state.orgPain) lines.push('Org pain: ' + lbl(orgPainOpts, state.orgPain));
        if(state.drivers.length) lines.push('Conversation triggers: ' + state.drivers.map(d => driverTitle(d)).join(', '));
        if(state.milestone){
          const m = milestoneOpts.find(x => x.id === state.milestone);
          lines.push('First milestone: ' + (m ? m.title : state.milestone));
        }
        if(state.evidence.size){
          const ev = Array.from(state.evidence).map(id=>{
            const it = evidenceOpts.find(x => x.id === id);
            return it ? it.label : id;
          });
          lines.push('Evidence audience: ' + ev.join(', '));
        }
        if(state.groups.size){
          const gs = Array.from(state.groups).map(id=>{
            const it = groupOpts.find(x => x.id === id);
            return it ? it.label : id;
          });
          lines.push('Groups in scope: ' + gs.join(', '));
        }
        if(state.rhythm){
          const r = rhythmOpts.find(x => x.id === state.rhythm);
          lines.push('Exercise cadence: ' + (r ? r.title : state.rhythm));
        }
        if(state.measure){
          const m2 = measureOpts.find(x => x.id === state.measure);
          lines.push('Readiness measurement: ' + (m2 ? m2.title : state.measure));
        }

        // Package fit (optional)
        const fitBits = [];
        if(state.fitRealism) fitBits.push('Realism: ' + ((fitSnapLabels.fitRealism && fitSnapLabels.fitRealism[state.fitRealism]) || lbl(fitRealismOpts, state.fitRealism)));
        if(state.fitScope) fitBits.push('Scope: ' + ((fitSnapLabels.fitScope && fitSnapLabels.fitScope[state.fitScope]) || lbl(fitScopeOpts, state.fitScope)));
        if(state.fitToday) fitBits.push('Current state: ' + ((fitSnapLabels.fitToday && fitSnapLabels.fitToday[state.fitToday]) || lbl(fitTodayOpts, state.fitToday)));
        if(state.fitServices) fitBits.push('Delivery: ' + ((fitSnapLabels.fitServices && fitSnapLabels.fitServices[state.fitServices]) || lbl(fitServicesOpts, state.fitServices)));
        if(state.fitRiskFrame) fitBits.push('Problem framing: ' + ((fitSnapLabels.fitRiskFrame && fitSnapLabels.fitRiskFrame[state.fitRiskFrame]) || lbl(fitRiskFrameOpts, state.fitRiskFrame)));
        if(fitBits.length) lines.push('Package fit: ' + fitBits.join(' | '));

        if(state.industry) lines.push('Industry: ' + state.industry);
        if(state.region) lines.push('Region: ' + state.region);

        if(state.stack.size || state.stackOther){
          const st = Array.from(state.stack).map(id=>{
            const it = stackMaster.find(x => x.id === id);
            return it ? it.label : id;
          });
          if(state.stackOther) st.push(state.stackOther);
          lines.push('Tech stack focus: ' + st.join(', '));
        }
        if(state.regs.size){
          const rg = Array.from(state.regs).map(id=>{
            const it = regMaster.find(x => x.id === id);
            return it ? it.label : id;
          });
          lines.push('Regulatory context: ' + rg.join(', '));
        }

        if(topOutcomes.length){
          lines.push('');
          lines.push('Top outcomes + one-liners:');
          topOutcomes.forEach((o, idx)=>{
            const meta = outcomeById(o.id) || o;
            lines.push(`${idx + 1}. ${meta.label} — ${meta.oneLiner || meta.desc}`);
          });
        }

        lines.push('');
        lines.push('Why this starting point (top 3):');
        tierWhyBullets(score().best, 3).forEach(r => lines.push('- ' + r));
        lines.push('');

        lines.push('Recommended next meeting agenda:');
        buildNextMeetingAgenda(topOutcomes).forEach(a => lines.push('- ' + a));
        lines.push('');

        lines.push('Who to bring:');
        buildWhoToBring(topOutcomes).forEach(w => lines.push('- ' + w));
        lines.push('');

        lines.push('Recommended resources:');
        buildRecommendedResources(topOutcomes).forEach(r => lines.push('- ' + r));
        lines.push('');

        lines.push('ROI estimate:');
        lines.push('Annual revenue: ' + fmtRevenueFromUSDB(state.revenueB));
        lines.push('Team sizes: ' + `~${state.teamCyber} cyber | ~${state.teamDev} dev | ~${state.teamWf} workforce`);
        lines.push('Salary sensitivity: ' + `Cyber ${fmtMoneyUSD(state.cyberSalaryUSD)} | Dev ${fmtMoneyUSD(state.devSalaryUSD)}`);
        lines.push('Indicative spend: ' + fmtMoneyUSD(state.investUSD) + '/yr');
        lines.push('Scenario: ' + (state.realization === 'immersive' ? 'Immersive base' : (state.realization === 'expected' ? 'Expected' : 'Conservative')));
        lines.push('3-year ROI: ' + (roi.roi*100).toFixed(0) + '%');
        lines.push('3-year NPV: ' + fmtMoneyUSD(roi.npv));
        if(paybackTxt) lines.push('Payback (est.): ' + paybackTxt);

        lines.push('');
        if(state.notes) lines.push('Notes: ' + state.notes);
        return lines.join('\n');
      }

      function buildMailto(tier, rs, roi, paybackTxt){
        const subject = encodeURIComponent('Immersive — readiness summary (prototype)');
        const body = encodeURIComponent(buildSummaryText(tier, rs, roi, paybackTxt));
        return `mailto:?subject=${subject}&body=${body}`;
      }

      function copyToClipboard(text){
        if(navigator.clipboard && navigator.clipboard.writeText){
          navigator.clipboard.writeText(text)
            .then(()=> toast('Copied summary to clipboard.'))
            .catch(()=> fallbackCopy(text));
        }else{
          fallbackCopy(text);
        }
      }

      function fallbackCopy(text){
        try{
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position='fixed';
          ta.style.left='-9999px';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          toast('Copied summary (fallback).');
        }catch(e){
          toast('Clipboard copy blocked in this browser.');
        }
      }

      
      // ---------- export (PoC): structured data + CSV + print ----------
      function syncLeadFromDOM(){
        const emailEl = $('#email');
        const phoneEl = $('#phone');
        const notesEl = $('#notes');
        const optinEl = $('#optin');

        if(emailEl) state.email = (emailEl.value || '').trim();
        if(phoneEl) state.phone = (phoneEl.value || '').trim();
        if(notesEl) state.notes = (notesEl.value || '').trim();
        if(optinEl) state.optin = !!optinEl.checked;
      }

      function makeReportId(){
        try{
          if(window.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
        }catch(e){}
        // fallback (prototype only)
        const s4 = ()=> Math.floor((1+Math.random())*0x10000).toString(16).substring(1);
        return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
      }

      function labelsFromIds(ids, list){
        return Array.from(ids || []).map(id=>{
          const it = (list || []).find(x => x.id === id);
          return it ? (it.label || it.title || id) : id;
        }).filter(Boolean);
      }
      function labelsFromSet(setRef, list){
        return labelsFromIds(Array.from(setRef || []), list);
      }

      function safeFilePart(v){
        return String(v || '')
          .trim()
          .replace(/\s+/g,'-')
          .replace(/[^a-zA-Z0-9\-_]/g,'')
          .slice(0, 60) || 'report';
      }

      function downloadBlob(blob, filename){
        const a = document.createElement('a');
        const url = URL.createObjectURL(blob);
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(()=> URL.revokeObjectURL(url), 1200);
      }

      function downloadText(text, filename, mime){
        const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8;' });
        downloadBlob(blob, filename);
      }

      function buildReportModelV1(){
        syncLeadFromDOM();

        const rec = score();
        const tierKey = rec.best;
        const tier = (tierKey === 'core') ? packages.core : (tierKey === 'adv') ? packages.adv : packages.ult;
        const serviceTier = (tierKey === 'core') ? 'Good' : (tierKey === 'adv') ? 'Better' : 'Best';

        const rs = reasons(tierKey);

        const roi = computeRoi();
        const paybackMonths = computePaybackMonths(roi);
        const paybackDisplay = fmtPayback(paybackMonths);

        const now = new Date();
        const reportId = makeReportId();

        const regionLabels = { NA:'North America', UKI:'UK & Ireland', EU:'Europe (EU)', APAC:'APAC', Other:'Other / Global' };
        const sizeMap = {
          'lt500':'< 500 employees',
          '500-2k':'500–2,000 employees',
          '2k-10k':'2,000–10,000 employees',
          '10k-50k':'10,000–50,000 employees',
          '50kplus':'50,000+ employees'
        };

        // Labels
        const roleLabel = state.role ? (labelsFromIds([state.role], roleOpts)[0] || state.role) : '';
        const milestoneLabel = state.milestone ? (labelsFromIds([state.milestone], milestoneOpts)[0] || state.milestone) : '';
        const rhythmLabel = state.rhythm ? (labelsFromIds([state.rhythm], rhythmOpts)[0] || state.rhythm) : '';
        const measureLabel = state.measure ? (labelsFromIds([state.measure], measureOpts)[0] || state.measure) : '';
        const pressureSourceLabels = labelsFromIds(state.pressureSources || [], pressureOpts.map(x => ({ id:x.id, title:x.title })));
        const urgentWinLabel = state.urgentWin ? (labelsFromIds([state.urgentWin], urgentWinOpts)[0] || state.urgentWin) : '';
        const measuredOnLabel = state.measuredOn ? (labelsFromIds([state.measuredOn], measuredOnOpts)[0] || state.measuredOn) : '';
        const orgPainLabel = state.orgPain ? (labelsFromIds([state.orgPain], orgPainOpts)[0] || state.orgPain) : '';
        const riskEnvLabels = labelsFromIds(state.riskEnvs || [], riskEnvOpts.map(x => ({ id:x.id, title:x.title })));

        const driverLabels = labelsFromIds(state.drivers || [], driverOpts.map(d => ({ id:d.id, title:d.title })));
        const evidenceLabels = labelsFromSet(state.evidence, evidenceOpts);
        const primaryOutcomes = inferredPrimaryOutcomes(3);
        const primaryOutcomeScores = computePrimaryOutcomeScores();
        const groupLabels = labelsFromSet(state.groups, groupOpts);
        const regLabels = labelsFromSet(state.regs, regMaster);
        const stackLabels = labelsFromSet(state.stack, stackMaster);

        const stackLabelFull = (state.stackOther && String(state.stackOther).trim())
          ? [...stackLabels, String(state.stackOther).trim()]
          : stackLabels;

        // ROI display strings
        const roiPercent = (roi.roi * 100).toFixed(0) + '%';
        const npvDisplay = fmtMoneyUSD(roi.npv);
        const investDisplay = fmtMoneyUSD(state.investUSD);

        const report = {
          schemaVersion: '1.0',
          reportId,
          createdAt: now.toISOString(),
          locale: (navigator.language || 'en'),
          currency: state.currency,

          app: {
            name: 'Immersive One — Cyber readiness configurator',
            build: 'v27-outcomes-first'
          },

          lead: {
            email: state.email || '',
            phone: state.phone || '',
            optin: !!state.optin,
            notes: state.notes || ''
          },

          organisation: {
            role: state.role || '',
            roleLabel,
            fullName: state.fullName || '',
            company: state.company || '',
            companySize: state.companySize || '',
            companySizeLabel: state.companySize ? (sizeMap[state.companySize] || state.companySize) : '',
            operatingCountry: state.operatingCountry || ''
          },

          selections: {
            pressureSources: state.pressureSources || [],
            pressureSourceLabels,
            urgentWin: state.urgentWin || '',
            urgentWinLabel,
            riskEnvs: state.riskEnvs || [],
            riskEnvLabels,
            measuredOn: state.measuredOn || '',
            measuredOnLabel,
            orgPain: state.orgPain || '',
            orgPainLabel,

            drivers: state.drivers || [],
            driverLabels,
            milestone: state.milestone || '',
            milestoneLabel,
            evidence: Array.from(state.evidence || []),
            evidenceLabels,
            outcomeDrilldowns: Object.assign({}, state.outcomeDrilldowns || {}),
            primaryOutcomes: primaryOutcomes.map(o => o.id),
            primaryOutcomeLabels: primaryOutcomes.map(o => o.short),
            primaryOutcomeOneLiners: primaryOutcomes.map(o => {
              const meta = outcomeById(o.id) || o;
              return meta.oneLiner || meta.desc || '';
            }),
            primaryOutcomeScores,
            groups: Array.from(state.groups || []),
            groupLabels,
            rhythm: state.rhythm || '',
            rhythmLabel,
            measure: state.measure || '',
            measureLabel,

            fitRealism: state.fitRealism || '',
            fitScope: state.fitScope || '',
            fitToday: state.fitToday || '',
            fitServices: state.fitServices || '',
            fitRiskFrame: state.fitRiskFrame || '',

            industry: state.industry || '',
            region: state.region || '',
            regionLabel: state.region ? (regionLabels[state.region] || state.region) : '',
            regulations: Array.from(state.regs || []),
            regulationLabels: regLabels,

            techStack: Array.from(state.stack || []),
            techStackLabels: stackLabelFull
          },

          recommendation: {
            packageKey: tierKey,
            packageName: tier.name,
            serviceTier,
            confidence: rec.conf,
            pressureScore: rec.scores && typeof rec.scores.pressure === 'number' ? rec.scores.pressure : null,
            scaleLargeSignal: rec.scores && typeof rec.scores.scaleLarge === 'number' ? rec.scores.scaleLarge : null,
            ultimateGateMatched: rec.scores && typeof rec.scores.ultObvious === 'number' ? rec.scores.ultObvious : null,
            tagline: tier.tagline,
            description: tier.desc,
            reasons: rs
          },

          followup: {
            tierWhy: tierWhyBullets(tierKey, 3),
            agenda: buildNextMeetingAgenda(primaryOutcomes),
            recommendedAttendees: buildWhoToBring(primaryOutcomes),
            recommendedResources: buildRecommendedResources(primaryOutcomes)
          },

          roi: {
            visited: !!state.visited.has(5),
            scenario: (state.realization === 'expected')
              ? 'Expected'
              : (state.realization === 'conservative')
                ? 'Conservative'
                : 'Immersive base',
            revenueB_USD: Number(state.revenueB) || 0,
            revenueDisplay: fmtRevenueFromUSDB(state.revenueB),
            teamCyber: Number(state.teamCyber) || 0,
            teamDev: Number(state.teamDev) || 0,
            teamWorkforce: Number(state.teamWf) || 0,
            investUSD_Annual: Number(state.investUSD) || 0,
            investDisplay_Annual: investDisplay,
            roiPercent,
            npvUSD_3yr: Number(roi.npv) || 0,
            npvDisplay_3yr: npvDisplay,
            paybackMonths: (paybackMonths === null || paybackMonths === undefined) ? null : Number(paybackMonths),
            paybackDisplay,
            assumptions: {
              paybackDelayMonths: Number(state.paybackDelayMonths) || 0,
              cyberSalaryUSD: Number(state.cyberSalaryUSD) || 0,
              devSalaryUSD: Number(state.devSalaryUSD) || 0,
              fx: Object.assign({}, state.fx || {})
            }
          }
        };

        return report;
      }

      function reportToCSV(report){
        // One-row CSV (flattened). Arrays are semicolon-separated.
        const join = (arr)=> (arr && arr.length) ? arr.join('; ') : '';
        const val = (v)=> (v === null || v === undefined) ? '' : String(v);

        const row = {
          report_id: report.reportId,
          created_at: report.createdAt,
          locale: report.locale,
          currency: report.currency,

          lead_email: report.lead.email,
          lead_phone: report.lead.phone,
          lead_optin: report.lead.optin ? 'true' : 'false',

          full_name: report.organisation.fullName,
          company: report.organisation.company,
          company_size: report.organisation.companySizeLabel || report.organisation.companySize,
          operating_country: report.organisation.operatingCountry,
          role: report.organisation.roleLabel || report.organisation.role,

          pressure_sources: join(report.selections.pressureSourceLabels),
          urgent_win: report.selections.urgentWinLabel,
          risk_environments: join(report.selections.riskEnvLabels),
          measured_on_today: report.selections.measuredOnLabel,
          org_pain: report.selections.orgPainLabel,

          drivers: join(report.selections.driverLabels),
          milestone: report.selections.milestoneLabel,
          evidence: join(report.selections.evidenceLabels),
          primary_outcomes: join(report.selections.primaryOutcomeLabels),
          groups: join(report.selections.groupLabels),
          cadence: report.selections.rhythmLabel,
          measurement: report.selections.measureLabel,

          fit_realism: report.selections.fitRealism,
          fit_scope: report.selections.fitScope,
          fit_today: report.selections.fitToday,
          fit_services: report.selections.fitServices,
          fit_risk_frame: report.selections.fitRiskFrame,

          industry: report.selections.industry,
          region: report.selections.regionLabel,
          regulations: join(report.selections.regulationLabels),
          tech_stack: join(report.selections.techStackLabels),

          roi_scenario: report.roi.scenario,
          revenue_display: report.roi.revenueDisplay,
          revenueB_usd: val(report.roi.revenueB_USD),
          invest_display_annual: report.roi.investDisplay_Annual,
          invest_usd_annual: val(report.roi.investUSD_Annual),

          team_cyber: val(report.roi.teamCyber),
          team_dev: val(report.roi.teamDev),
          team_workforce: val(report.roi.teamWorkforce),

          roi_percent_3yr: report.roi.roiPercent,
          npv_display_3yr: report.roi.npvDisplay_3yr,
          npv_usd_3yr: val(report.roi.npvUSD_3yr),
          payback_display: report.roi.paybackDisplay,
          payback_months: val(report.roi.paybackMonths),

          recommended_package: report.recommendation.packageName,
          service_tier: report.recommendation.serviceTier,
          confidence: report.recommendation.confidence,
          pressure_score: val(report.recommendation.pressureScore),
          scale_large_signal: val(report.recommendation.scaleLargeSignal),
          ultimate_gate_matched: val(report.recommendation.ultimateGateMatched),

          reasons: join(report.recommendation.reasons),
          followup_tier_why: join(report.followup.tierWhy),
          followup_agenda: join(report.followup.agenda),
          followup_attendees: join(report.followup.recommendedAttendees),
          followup_resources: join(report.followup.recommendedResources)
        };

        const cols = Object.keys(row);

        const esc = (s)=>{
          const str = String(s ?? '');
          if(/[",\n]/.test(str)) return '"' + str.replace(/"/g,'""') + '"';
          return str;
        };

        const header = cols.map(esc).join(',');
        const line = cols.map(c => esc(row[c])).join(',');
        return header + '\n' + line + '\n';
      }

      function buildPrintHTML(report){
        const dt = new Date(report.createdAt);
        const dateStr = dt.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
        const logoSrc = 'https://cdn.prod.website-files.com/6735fba9a631272fb4513263/6762d3c19105162149b9f1dc_Immersive%20Logo.svg';

        const pill = (t)=> `<span class="pillTag">${escapeHtml(t)}</span>`;

        const pillBits = [];
        if(report.organisation.company) pillBits.push(pill(report.organisation.company));
        if(report.organisation.companySizeLabel) pillBits.push(pill(report.organisation.companySizeLabel));
        if(report.selections.industry) pillBits.push(pill(report.selections.industry));
        if(report.selections.regionLabel) pillBits.push(pill(report.selections.regionLabel));
        pillBits.push(pill('Currency: ' + report.currency));

        const list = (items)=> {
          const xs = (items || []).filter(Boolean);
          if(!xs.length) return '<div class="small">—</div>';
          return '<ul>' + xs.map(x => `<li>${escapeHtml(x)}</li>`).join('') + '</ul>';
        };

        const line = (k,v)=> `<p class="k">${escapeHtml(k)}</p><p class="v">${escapeHtml(v || '—')}</p>`;

        const orgLines = [
          report.organisation.fullName ? (`Contact: ${report.organisation.fullName}`) : '',
          report.organisation.roleLabel ? (`Role: ${report.organisation.roleLabel}`) : '',
          report.organisation.operatingCountry ? (`Country: ${report.organisation.operatingCountry}`) : ''
        ].filter(Boolean).join(' · ');
        const metaBits = [
          report.organisation.company || '',
          orgLines || ''
        ].filter(Boolean);
        const metaLine = metaBits.length ? metaBits.join(' · ') : 'Prepared for internal planning and scoping.';

        const roiMini = report.roi.visited
          ? `${report.roi.npvDisplay_3yr} NPV · ${report.roi.paybackDisplay} payback · ${report.roi.investDisplay_Annual}/yr spend`
          : `Complete Step 4 for the Immersive ROI estimate · Spend model shows ${report.roi.investDisplay_Annual}/yr`;

        const fitBits = [
          report.selections.fitRealism ? ('Realism: ' + report.selections.fitRealism) : '',
          report.selections.fitScope ? ('Scope: ' + report.selections.fitScope) : '',
          report.selections.fitToday ? ('Current state: ' + report.selections.fitToday) : '',
          report.selections.fitServices ? ('Delivery: ' + report.selections.fitServices) : '',
          report.selections.fitRiskFrame ? ('Framing: ' + report.selections.fitRiskFrame) : ''
        ].filter(Boolean);

        return `
          <div>
            <div class="brandHeader">
              <div class="brandMark">
                <img class="brandLogo" src="${logoSrc}" alt="Immersive" />
                <div class="brandKicker">Cyber readiness configurator</div>
              </div>
              <div class="reportStamp">
                <p class="stampLabel">Report ID</p>
                <p class="stampValue">${escapeHtml(report.reportId)}</p>
                <p class="stampLabel">Generated</p>
                <p class="stampValue">${escapeHtml(dateStr)}</p>
              </div>
            </div>
            <h1>Cyber readiness snapshot</h1>
            <div class="meta">
              ${escapeHtml(metaLine)}
            </div>

            <div class="pillRow">${pillBits.join('')}</div>

            <div class="grid2">
              <div class="box">
                ${line('Recommended package', `${report.recommendation.packageName}`)}
                <div class="small">${escapeHtml(report.recommendation.tagline)} · ${escapeHtml(report.recommendation.description)}</div>
              </div>
              <div class="box">
                ${line('Directional ROI (3‑year)', report.roi.roiPercent)}
                <div class="small">${escapeHtml(roiMini)}</div>
              </div>
            </div>

            <h2>Why this starting point</h2>
            ${list((report.followup && report.followup.tierWhy) ? report.followup.tierWhy : report.recommendation.reasons)}

            <div class="grid2" style="margin-top:6mm;">
              <div class="box">
                ${line('Top outcomes', (report.selections.primaryOutcomeLabels || []).join(' · ') || '—')}
              </div>
              <div class="box">
                ${line('Recommended next meeting agenda', (report.followup && report.followup.agenda) ? report.followup.agenda.join(' · ') : '—')}
                <div class="small"><strong>Who to bring:</strong> ${escapeHtml((report.followup && report.followup.recommendedAttendees) ? report.followup.recommendedAttendees.join(' · ') : '—')}</div>
                <div class="small"><strong>Resources:</strong> ${escapeHtml((report.followup && report.followup.recommendedResources) ? report.followup.recommendedResources.join(' · ') : '—')}</div>
              </div>
            </div>

            <div class="divider"></div>

            <h2>Your selections</h2>
            <div class="grid2">
              <div class="box">
                ${line('Pressure sources', (report.selections.pressureSourceLabels || []).join(' · ') || '—')}
                <div class="small"><strong>Urgent 90-day win:</strong> ${escapeHtml(report.selections.urgentWinLabel || '—')}</div>
                <div class="small"><strong>Risk environment:</strong> ${escapeHtml((report.selections.riskEnvLabels || []).join(' · ') || '—')}</div>
                <div class="small"><strong>Conversation triggers:</strong> ${escapeHtml((report.selections.driverLabels || []).join(' · ') || '—')}</div>
                <div class="small"><strong>Evidence audience:</strong> ${escapeHtml((report.selections.evidenceLabels || []).join(' · ') || '—')}</div>
                <div class="small"><strong>Primary outcomes:</strong> ${escapeHtml((report.selections.primaryOutcomeLabels || []).join(' · ') || '—')}</div>
              </div>
              <div class="box">
                ${line('Coverage', (report.selections.groupLabels || []).join(' · ') || '—')}
                <div class="small"><strong>Cadence:</strong> ${escapeHtml(report.selections.rhythmLabel || '—')}</div>
                <div class="small"><strong>Measurement:</strong> ${escapeHtml(report.selections.measureLabel || '—')}</div>
              </div>
            </div>

            <div class="grid2" style="margin-top:6mm;">
              <div class="box">
                ${line('Package fit', fitBits.length ? fitBits.join(' · ') : '—')}
                <div class="small">Fit signals refine whether Core / Advanced / Ultimate is justified.</div>
              </div>
              <div class="box">
                ${line('Regulatory context', (report.selections.regulationLabels || []).length ? report.selections.regulationLabels.slice(0,10).join(' · ') : '—')}
                <div class="small">Not legal advice. Select “All” in Step 3 to choose from the full library.</div>
              </div>
            </div>

            <div class="grid2" style="margin-top:6mm;">
              <div class="box">
                ${line('Tools & platforms', (report.selections.techStackLabels || []).length ? report.selections.techStackLabels.slice(0,12).join(' · ') : '—')}
              </div>
              <div class="box">
                ${line('ROI inputs (Immersive estimate)', `${report.roi.revenueDisplay} revenue/budget · ${report.roi.investDisplay_Annual}/yr spend`)}
                <div class="small">Footprint: ~${escapeHtml(String(report.roi.teamCyber))} cyber · ~${escapeHtml(String(report.roi.teamDev))} dev · ~${escapeHtml(String(report.roi.teamWorkforce))} workforce</div>
                <div class="small">Scenario: ${escapeHtml(report.roi.scenario)} · Payback delay: ${escapeHtml(String(report.roi.assumptions.paybackDelayMonths || 0))} mo</div>
              </div>
            </div>

            <h2>Notes</h2>
            <div class="box">
              <div class="small">${escapeHtml(report.lead.notes || '—')}</div>
            </div>

            <div class="divider"></div>
            <div class="small">
              This report is a prototype snapshot. ROI figures are Immersive estimates based on Immersive assumptions and comparable organizations. Framework/regulation references are for tailoring language only and are not legal advice.
            </div>
          </div>
        `;
      }

      function printReport(report){
        const root = $('#printReportRoot');
        if(!root){
          toast('Print view is unavailable in this build.');
          return;
        }
        root.innerHTML = buildPrintHTML(report);
        root.setAttribute('aria-hidden', 'false');
        document.body.classList.add('is-print-report');

        const cleanup = ()=>{
          document.body.classList.remove('is-print-report');
          root.setAttribute('aria-hidden','true');
          root.innerHTML = '';
          window.removeEventListener('afterprint', cleanup);
        };

        window.addEventListener('afterprint', cleanup, { once: true });

        toast('Opening print dialog…');
        window.print();
      }
// ---------- init UI ----------
      // progress chip click
      $$('.chip').forEach(ch=>{
        ch.addEventListener('click', ()=> setActiveStep(Number(ch.dataset.step)));
      });
      const brandHome = $('#brandHome');
      const workspaceArchive = $('#workspaceArchive');
      const workspaceAccount = $('#workspaceAccount');
      const recordOverviewBtn = $('#recordOverviewBtn');
      const workspaceCreateRecord = $('#workspaceCreateRecord');
      const globalCreateRecord = $('#globalCreateRecord');
      const globalDeleteRecord = $('#globalDeleteRecord');
      const globalEditConfigurator = $('#globalEditConfigurator');
      const globalBookConsultation = $('#globalBookConsultation');
      const consultationPanel = $('#consultationPanel');
      const closeConsultationBtn = $('#closeConsultation');
      const accountOpenSettings = $('#accountOpenSettings');
      const jumpNextIncompleteBtns = $$('[data-jump-next-incomplete]');
      const saveRecordBtn = $('#saveRecordBtn');
      const workspaceCompaniesList = $('#workspaceCompaniesList');
      const dashboardRowsBody = $('#dashboardRows');
      const dashSelectAll = $('#dashSelectAll');
      const dashArchiveSelected = $('#dashArchiveSelected');
      const archivedRowsBody = $('#archivedRows');
      const archivedSelectAll = $('#archivedSelectAll');
      const archivedRestoreSelected = $('#archivedRestoreSelected');
      const brandLogo = $('.logo');
      if(brandHome){
        brandHome.addEventListener('click', (e)=>{
          e.preventDefault();
          setView('dashboard');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      }
      if(workspaceArchive){
        workspaceArchive.addEventListener('click', ()=>{
          setView('archived');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      }
      if(workspaceAccount){
        workspaceAccount.addEventListener('click', ()=>{
          setView('account');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      }
      if(recordOverviewBtn){
        recordOverviewBtn.addEventListener('click', ()=>{
          openThreadOverview(state.activeThread || 'current');
        });
      }
      if(workspaceCreateRecord){
        workspaceCreateRecord.addEventListener('click', ()=>{
          createNewRecord();
        });
      }
      if(globalCreateRecord){
        globalCreateRecord.addEventListener('click', ()=>{
          createNewRecord();
        });
      }
      if(globalEditConfigurator){
        globalEditConfigurator.addEventListener('click', ()=>{
          const thread = activeThreadModel();
          const step = dashboardFirstGapStep(thread);
          openThreadConfigurator((thread && thread.id) ? thread.id : (state.activeThread || 'current'), step);
        });
      }
      if(globalDeleteRecord){
        globalDeleteRecord.addEventListener('click', ()=>{
          const thread = activeThreadModel();
          if(!thread || !thread.id || thread.id === 'current'){
            toast('Save the record first, then you can delete it from here.');
            return;
          }
          openArchivePrompt([thread.id], 'delete');
        });
      }
      if(globalBookConsultation){
        globalBookConsultation.addEventListener('click', ()=>{
          const thread = activeThreadModel();
          openThreadBooking((thread && thread.id) ? thread.id : (state.activeThread || 'current'));
        });
      }
      if(closeConsultationBtn){
        closeConsultationBtn.addEventListener('click', ()=>{
          toggleConsultation(false);
        });
      }
      if(consultationPanel){
        consultationPanel.addEventListener('click', (e)=>{
          if(e.target === consultationPanel){
            toggleConsultation(false);
          }
        });
      }
      if(workspaceCompaniesList){
        workspaceCompaniesList.addEventListener('click', (e)=>{
          const openBtn = e.target.closest('[data-company-open]');
          if(openBtn){
            const id = openBtn.getAttribute('data-company-open') || '';
            if(id) openThreadOverview(id);
          }
        });
      }
      if(dashboardRowsBody){
        dashboardRowsBody.addEventListener('change', (e)=>{
          const sel = e.target.closest('[data-dashboard-select-id]');
          if(!sel) return;
          const id = sel.getAttribute('data-dashboard-select-id') || '';
          if(!id) return;
          if(sel.checked) state.dashboardSelectedIds.add(id);
          else state.dashboardSelectedIds.delete(id);
          update();
        });
        dashboardRowsBody.addEventListener('click', (e)=>{
          const starBtn = e.target.closest('[data-dashboard-star-id]');
          if(starBtn){
            const id = starBtn.getAttribute('data-dashboard-star-id') || '';
            if(id) toggleThreadPriority(id);
            return;
          }
          const openBtn = e.target.closest('[data-dashboard-open-btn]');
          if(openBtn){
            const id = openBtn.getAttribute('data-dashboard-open-btn') || '';
            if(id) openThreadOverview(id);
            return;
          }
          if(e.target.closest('input,button,a,select,textarea,label')) return;
          const row = e.target.closest('[data-dashboard-row-id]');
          if(!row) return;
          const id = row.getAttribute('data-dashboard-row-id') || '';
          if(id) openThreadOverview(id);
        });
      }
      if(dashSelectAll){
        dashSelectAll.addEventListener('change', ()=>{
          if(!dashSelectAll.checked){
            state.dashboardSelectedIds = new Set();
            update();
            return;
          }
          const ids = dashboardRowsModel().map((row)=> row.id);
          state.dashboardSelectedIds = new Set(ids);
          update();
        });
      }
      if(dashArchiveSelected){
        dashArchiveSelected.addEventListener('click', ()=>{
          const ids = Array.from(state.dashboardSelectedIds || []);
          if(!ids.length) return;
          openArchivePrompt(ids, 'archive');
        });
      }
      if(archivedRowsBody){
        archivedRowsBody.addEventListener('change', (e)=>{
          const sel = e.target.closest('[data-archived-select-id]');
          if(!sel) return;
          const id = sel.getAttribute('data-archived-select-id') || '';
          if(!id) return;
          if(sel.checked) state.archivedSelectedIds.add(id);
          else state.archivedSelectedIds.delete(id);
          update();
        });
        archivedRowsBody.addEventListener('click', (e)=>{
          const restoreBtn = e.target.closest('[data-archived-unarchive-id]');
          if(restoreBtn){
            const id = restoreBtn.getAttribute('data-archived-unarchive-id') || '';
            if(id) openArchivePrompt([id], 'restore');
            return;
          }
          if(e.target.closest('input,button,a,select,textarea,label')) return;
          const row = e.target.closest('[data-archived-row-id]');
          if(!row) return;
          const id = row.getAttribute('data-archived-row-id') || '';
          if(id) openThreadOverview(id);
        });
      }
      if(archivedSelectAll){
        archivedSelectAll.addEventListener('change', ()=>{
          if(!archivedSelectAll.checked){
            state.archivedSelectedIds = new Set();
            update();
            return;
          }
          const ids = archivedRowsModel().map((row)=> row.id);
          state.archivedSelectedIds = new Set(ids);
          update();
        });
      }
      if(archivedRestoreSelected){
        archivedRestoreSelected.addEventListener('click', ()=>{
          const ids = Array.from(state.archivedSelectedIds || []);
          if(!ids.length) return;
          openArchivePrompt(ids, 'restore');
        });
      }
      jumpNextIncompleteBtns.forEach((btn)=>{
        btn.addEventListener('click', ()=>{
          jumpToNextIncomplete();
        });
      });
      if(saveRecordBtn){
        saveRecordBtn.addEventListener('click', ()=>{
          saveActiveRecord();
        });
      }
      if(accountOpenSettings){
        accountOpenSettings.addEventListener('click', ()=>{
          toggleSettings(true);
        });
      }

      const settings = $('#settings');
      const openSettingsPanelNav = $('#openSettingsNav');
      const closeSettings = $('#closeSettings');
      const accountFullNameInput = $('#accountFullName');
      const accountEmailInput = $('#accountEmail');
      const accountPhoneInput = $('#accountPhone');
      const accountRoleSelect = $('#accountRole');
      const accountCountrySelect = $('#accountCountry');
      const accountRegionSelect = $('#accountRegion');
      const accountFieldModeSelect = $('#accountFieldMode');
      const accountPrefillOptions = $$('#accountPrefillOptions [data-prefill]');
      const accountApplyNowBtn = $('#accountApplyNow');
      const accountResetBtn = $('#accountReset');
      const accountLoadProfileAeBtn = $('#accountLoadProfileAe');
      const accountLoadProfileCsBtn = $('#accountLoadProfileCs');
      const accountUploadProfileCsvBtn = $('#accountUploadProfileCsv');
      const accountUploadProfileFileInput = $('#accountUploadProfileFile');
      const accountExportAllCsvBtn = $('#accountExportAllCsv');
      const toneOptions = $$('#toneOptions [data-tone]');
      const densityOptions = $$('#densityOptions [data-density]');
      const fontScaleOptions = $$('#fontScaleOptions [data-font-scale]');
      const dummyOptions = $$('#dummyOptions [data-dummy]');
      const resetLayoutWidthsBtn = $('#resetLayoutWidths');
      const ACCOUNT_PROFILE_STORAGE_KEY = 'cfg_shell_account_profile_v1';

      const settingsState = {
        tone: 'default',
        density: 'comfortable',
        fontScale: 1,
        dummyMode: 'off',
        account: {
          fullName: '',
          email: '',
          phone: '',
          defaultRole: '',
          defaultCountry: '',
          defaultRegion: '',
          fieldMode: 'guided',
          prefillMode: 'on'
        }
      };

      function resolveFontScale(next){
        const allowed = [0.9, 1, 1.1];
        const n = Number(next);
        if(!Number.isFinite(n)) return 1;
        return allowed.reduce((best, val)=> Math.abs(val - n) < Math.abs(best - n) ? val : best, 1);
      }

      function resolveDummyMode(next){
        return String(next || '').toLowerCase() === 'on' ? 'on' : 'off';
      }

      function resolveAccountFieldMode(next){
        return String(next || '').toLowerCase() === 'advanced' ? 'advanced' : 'guided';
      }

      function resolveAccountPrefillMode(next){
        if(next === false) return 'off';
        if(next === true) return 'on';
        return String(next || '').toLowerCase() === 'off' ? 'off' : 'on';
      }

      function pickSelectValue(raw, sourceSel){
        const source = $(sourceSel);
        const wanted = String(raw || '').trim();
        if(!source || !wanted) return '';
        return Array.from(source.options || []).some((opt)=> opt.value === wanted) ? wanted : '';
      }

      function normalizeAccountProfile(raw){
        const src = (raw && typeof raw === 'object') ? raw : {};
        const roleRaw = String(src.defaultRole || '').trim();
        const roleId = accountRoleLegacyMap[roleRaw] || roleRaw;
        const roleOk = accountRoleOpts.some((opt)=> opt.id === roleId);
        return {
          // Preserve spaces while typing (e.g. first + last name).
          fullName: String(src.fullName || ''),
          email: String(src.email || '').trim(),
          phone: String(src.phone || ''),
          defaultRole: roleOk ? roleId : '',
          defaultCountry: pickSelectValue(src.defaultCountry, '#operatingCountry'),
          defaultRegion: pickSelectValue(src.defaultRegion, '#region'),
          fieldMode: resolveAccountFieldMode(src.fieldMode),
          prefillMode: resolveAccountPrefillMode(src.prefillMode)
        };
      }

      function readAccountProfileFromSettingsUI(){
        return normalizeAccountProfile({
          fullName: accountFullNameInput ? accountFullNameInput.value : '',
          email: accountEmailInput ? accountEmailInput.value : '',
          phone: accountPhoneInput ? accountPhoneInput.value : '',
          defaultRole: accountRoleSelect ? accountRoleSelect.value : '',
          defaultCountry: accountCountrySelect ? accountCountrySelect.value : '',
          defaultRegion: accountRegionSelect ? accountRegionSelect.value : '',
          fieldMode: accountFieldModeSelect ? accountFieldModeSelect.value : '',
          prefillMode: (settingsState.account && settingsState.account.prefillMode) || 'on'
        });
      }

      function syncAccountSettingsUI(){
        const acc = settingsState.account || {};
        if(accountFullNameInput) accountFullNameInput.value = acc.fullName || '';
        if(accountEmailInput) accountEmailInput.value = acc.email || '';
        if(accountPhoneInput) accountPhoneInput.value = acc.phone || '';
        if(accountRoleSelect) accountRoleSelect.value = acc.defaultRole || '';
        if(accountCountrySelect) accountCountrySelect.value = acc.defaultCountry || '';
        if(accountRegionSelect) accountRegionSelect.value = acc.defaultRegion || '';
        if(accountFieldModeSelect) accountFieldModeSelect.value = resolveAccountFieldMode(acc.fieldMode);
        const prefill = resolveAccountPrefillMode(acc.prefillMode);
        accountPrefillOptions.forEach((btn)=>{
          btn.setAttribute('aria-pressed', btn.getAttribute('data-prefill') === prefill ? 'true' : 'false');
        });
        document.documentElement.setAttribute('data-config-profile-depth', resolveAccountFieldMode(acc.fieldMode));
      }

      function persistAccountProfile(){
        try{
          window.localStorage.setItem(ACCOUNT_PROFILE_STORAGE_KEY, JSON.stringify(settingsState.account || {}));
        }catch(err){
          // Ignore storage failures.
        }
      }

      function applyAccountProfile(next, persist){
        settingsState.account = normalizeAccountProfile(next);
        if(persist !== false) persistAccountProfile();
        syncAccountSettingsUI();
      }

      function copySelectOptions(sourceSel, targetEl){
        if(!targetEl) return;
        const source = $(sourceSel);
        if(!source) return;
        const prev = targetEl.value;
        const opts = Array.from(source.options || []);
        targetEl.innerHTML = '';
        const none = document.createElement('option');
        none.value = '';
        none.textContent = 'No default';
        targetEl.appendChild(none);
        opts.forEach((opt)=>{
          const value = String(opt.value || '');
          if(!value) return;
          const clone = document.createElement('option');
          clone.value = value;
          clone.textContent = opt.textContent || value;
          targetEl.appendChild(clone);
        });
        targetEl.value = Array.from(targetEl.options).some((opt)=> opt.value === prev) ? prev : '';
      }

      function syncAccountChoiceSources(){
        copySelectOptions('#operatingCountry', accountCountrySelect);
        copySelectOptions('#region', accountRegionSelect);
        settingsState.account = normalizeAccountProfile(settingsState.account);
        syncAccountSettingsUI();
      }

      function applyAccountDefaultsToState(opts){
        const cfg = Object.assign({ emptyOnly:true }, opts || {});
        const acc = settingsState.account || {};
        const applyText = (key, val)=>{
          const next = String(val || '').trim();
          if(!next) return;
          const cur = String(state[key] || '').trim();
          if(cfg.emptyOnly && cur) return;
          state[key] = next;
        };
        applyText('fullName', acc.fullName);
        applyText('email', acc.email);
        applyText('phone', acc.phone);
        applyText('operatingCountry', acc.defaultCountry);
        applyText('region', acc.defaultRegion);
      }

      function applyRootFontSize(){
        const basePx = settingsState.density === 'compact' ? 12 : 13;
        const scale = Number(settingsState.fontScale) || 1;
        const px = basePx * scale;
        document.documentElement.style.fontSize = `${px.toFixed(2).replace(/\.00$/,'')}px`;
      }

      function syncSettingsUI(){
        toneOptions.forEach((btn)=>{
          btn.setAttribute('aria-pressed', btn.getAttribute('data-tone') === settingsState.tone ? 'true' : 'false');
        });
        densityOptions.forEach((btn)=>{
          btn.setAttribute('aria-pressed', btn.getAttribute('data-density') === settingsState.density ? 'true' : 'false');
        });
        fontScaleOptions.forEach((btn)=>{
          const btnScale = resolveFontScale(btn.getAttribute('data-font-scale'));
          btn.setAttribute('aria-pressed', btnScale === settingsState.fontScale ? 'true' : 'false');
        });
        dummyOptions.forEach((btn)=>{
          btn.setAttribute('aria-pressed', btn.getAttribute('data-dummy') === settingsState.dummyMode ? 'true' : 'false');
        });
        syncAccountSettingsUI();
      }

      function syncBrandLogoForTone(tone){
        if(!brandLogo) return;
        const lightSrc = brandLogo.getAttribute('data-light') || brandLogo.getAttribute('src');
        const darkSrc = brandLogo.getAttribute('data-dark') || lightSrc;
        const current = String(tone || '').toLowerCase();
        const isDark = (current === 'dark' || current === 'comfort');
        brandLogo.setAttribute('src', isDark ? darkSrc : lightSrc);
      }

      function applyShellTone(next, persist){
        const raw0 = String(next || '').toLowerCase();
        const raw = (raw0 === 'onyx' || raw0 === 'onyx1' || raw0 === 'onyx-1') ? 'dark' : raw0;
        const val = (raw === 'soft' || raw === 'dark' || raw === 'comfort') ? raw : 'default';
        settingsState.tone = val;
        if(val === 'default') document.documentElement.removeAttribute('data-shell-tone');
        else document.documentElement.setAttribute('data-shell-tone', val);
        syncBrandLogoForTone(val);
        if(persist !== false) window.localStorage.setItem('cfg_shell_tone', val);
        syncSettingsUI();
      }

      function applyShellDensity(next, persist){
        const val = (String(next).toLowerCase() === 'compact') ? 'compact' : 'comfortable';
        settingsState.density = val;
        document.documentElement.setAttribute('data-shell-density', val);
        applyRootFontSize();
        if(persist !== false) window.localStorage.setItem('cfg_shell_density', val);
        syncSettingsUI();
      }

      function applyShellFontScale(next, persist){
        const val = resolveFontScale(next);
        settingsState.fontScale = val;
        applyRootFontSize();
        if(persist !== false) window.localStorage.setItem('cfg_shell_font_scale', String(val));
        syncSettingsUI();
      }

      function applyDummyMode(next, persist, opts){
        const mode = resolveDummyMode(next);
        const prev = settingsState.dummyMode;
        settingsState.dummyMode = mode;
        if(persist !== false) window.localStorage.setItem('cfg_shell_dummy_mode', mode);
        syncSettingsUI();

        const cfg = opts || {};
        if(mode !== 'on'){
          if(prev === 'on' && cfg.silent !== true){
            toast('Dummy account mode off.');
          }
          return;
        }
        applyDummyAccountProfile({
          preserveActiveStep: cfg.preserveActiveStep !== false,
          silent: cfg.silent === true
        });
      }

      function toggleSettings(force){
        if(!settings) return;
        const open = (typeof force === 'boolean') ? force : !settings.classList.contains('open');
        settings.classList.toggle('open', open);
        settings.setAttribute('aria-hidden', open ? 'false' : 'true');
        if(open){
          syncAccountChoiceSources();
        }
      }

      (function initSettingsPrefs(){
        const storedTone = window.localStorage.getItem('cfg_shell_tone');
        const storedDensity = window.localStorage.getItem('cfg_shell_density');
        const storedFontScale = window.localStorage.getItem('cfg_shell_font_scale');
        const storedDummyMode = window.localStorage.getItem('cfg_shell_dummy_mode');
        const storedAccountRaw = window.localStorage.getItem(ACCOUNT_PROFILE_STORAGE_KEY);
        let storedAccount = null;
        if(storedAccountRaw){
          try{
            const parsed = JSON.parse(storedAccountRaw);
            storedAccount = (parsed && typeof parsed === 'object') ? parsed : null;
          }catch(err){
            storedAccount = null;
          }
        }
        settingsState.dummyMode = resolveDummyMode(storedDummyMode || 'off');
        syncAccountChoiceSources();
        applyAccountProfile(storedAccount || settingsState.account, false);
        applyAccountDefaultsToState({ emptyOnly:true });
        applyShellTone(storedTone || 'default', false);
        applyShellDensity(storedDensity || 'comfortable', false);
        applyShellFontScale(storedFontScale || 1, false);
        syncSettingsUI();
      })();

      // Desktop app-shell column sizing (bounded, persisted)
      const shellDesktopMQ = window.matchMedia('(min-width: 1200px)');
      const rootStyle = document.documentElement.style;
      const shellBounds = {
        lhn: { key:'cfg_shell_lhn_w', css:'--app-lhn-w', min:220, max:320, fallback:236 },
        right: { key:'cfg_shell_right_w', css:'--app-right-w', min:520, max:860, fallback:620 }
      };
      const getStoredPx = (cfg)=>{
        const raw = window.localStorage.getItem(cfg.key);
        const n = Number(raw);
        return Number.isFinite(n) ? clamp(n, cfg.min, cfg.max) : null;
      };
      const setSizePx = (cfg, px)=>{
        const next = clamp(px, cfg.min, cfg.max);
        rootStyle.setProperty(cfg.css, `${next}px`);
        window.localStorage.setItem(cfg.key, String(next));
      };
      const resetShellLayoutWidths = ()=>{
        rootStyle.setProperty(shellBounds.lhn.css, `${shellBounds.lhn.fallback}px`);
        rootStyle.setProperty(shellBounds.right.css, `${shellBounds.right.fallback}px`);
        window.localStorage.setItem(shellBounds.lhn.key, String(shellBounds.lhn.fallback));
        window.localStorage.setItem(shellBounds.right.key, String(shellBounds.right.fallback));
        resetDashboardColumnWidths({ persist:true });
      };
      const initShellSizes = ()=>{
        const lhnSaved = getStoredPx(shellBounds.lhn);
        const rightSaved = getStoredPx(shellBounds.right);
        if(lhnSaved !== null) rootStyle.setProperty(shellBounds.lhn.css, `${lhnSaved}px`);
        if(rightSaved !== null) rootStyle.setProperty(shellBounds.right.css, `${rightSaved}px`);
      };
      const wireShellHandle = (el, cfg, invertDelta=false)=>{
        if(!el) return;
        let dragging = false;
        let startX = 0;
        let startW = cfg.fallback;
        const onMove = (ev)=>{
          if(!dragging) return;
          const dx = ev.clientX - startX;
          const delta = invertDelta ? -dx : dx;
          setSizePx(cfg, startW + delta);
        };
        const onUp = ()=>{
          if(!dragging) return;
          dragging = false;
          document.body.classList.remove('is-col-resizing');
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          window.removeEventListener('pointercancel', onUp);
        };
        el.addEventListener('pointerdown', (ev)=>{
          if(!shellDesktopMQ.matches) return;
          dragging = true;
          startX = ev.clientX;
          startW = getStoredPx(cfg) ?? cfg.fallback;
          document.body.classList.add('is-col-resizing');
          window.addEventListener('pointermove', onMove);
          window.addEventListener('pointerup', onUp);
          window.addEventListener('pointercancel', onUp);
        });
      };
      initShellSizes();
      wireShellHandle($('#lhnResizeHandle'), shellBounds.lhn, false);
      wireShellHandle($('#rightResizeHandle'), shellBounds.right, true);
      initDashboardColumnResizing();

      if(openSettingsPanelNav){
        openSettingsPanelNav.addEventListener('click', ()=> toggleSettings(true));
      }
      if(closeSettings){
        closeSettings.addEventListener('click', ()=> toggleSettings(false));
      }
      if(settings){
        settings.addEventListener('click', (e)=>{
          if(e.target === settings) toggleSettings(false);
        });
      }
      let shellResizeTimer = null;
      window.addEventListener('resize', ()=>{
        window.clearTimeout(shellResizeTimer);
        shellResizeTimer = window.setTimeout(()=> update(), 80);
      });
      document.addEventListener('keydown', (e)=>{
        if(e.key !== 'Escape') return;
        if(settings && settings.classList.contains('open')){
          toggleSettings(false);
        }
        if(state.consultationOpen){
          toggleConsultation(false);
        }
        if($('#archiveModal')?.classList.contains('show')) closeArchivePrompt();
        if($('#modal')?.classList.contains('show')) $('#modal').classList.remove('show');
      });
      const persistAccountFromInputs = ()=>{
        applyAccountProfile(readAccountProfileFromSettingsUI(), true);
      };
      [accountFullNameInput, accountEmailInput, accountPhoneInput].forEach((el)=>{
        if(!el) return;
        el.addEventListener('input', persistAccountFromInputs);
      });
      [accountRoleSelect, accountCountrySelect, accountRegionSelect, accountFieldModeSelect].forEach((el)=>{
        if(!el) return;
        el.addEventListener('change', persistAccountFromInputs);
      });
      accountPrefillOptions.forEach((btn)=>{
        btn.addEventListener('click', ()=>{
          const next = resolveAccountPrefillMode(btn.getAttribute('data-prefill') || 'on');
          const profile = Object.assign({}, settingsState.account || {}, { prefillMode: next });
          applyAccountProfile(profile, true);
        });
      });
      if(accountApplyNowBtn){
        accountApplyNowBtn.addEventListener('click', ()=>{
          persistAccountFromInputs();
          applyAccountDefaultsToState({ emptyOnly:false });
          syncFormControlsFromState();
          update();
          toast('Applied account defaults to this record.');
        });
      }
      if(accountResetBtn){
        accountResetBtn.addEventListener('click', ()=>{
          applyAccountProfile({
            fullName: '',
            email: '',
            phone: '',
            defaultRole: '',
            defaultCountry: '',
            defaultRegion: '',
            fieldMode: 'guided',
            prefillMode: 'on'
          }, true);
          toast('Account defaults reset.');
        });
      }
      if(accountLoadProfileAeBtn){
        accountLoadProfileAeBtn.addEventListener('click', ()=>{
          loadWorkspaceProfile('ae_demo');
        });
      }
      if(accountLoadProfileCsBtn){
        accountLoadProfileCsBtn.addEventListener('click', ()=>{
          loadWorkspaceProfile('cs_demo');
        });
      }
      if(accountUploadProfileCsvBtn && accountUploadProfileFileInput){
        accountUploadProfileCsvBtn.addEventListener('click', ()=>{
          accountUploadProfileFileInput.click();
        });
        accountUploadProfileFileInput.addEventListener('change', ()=>{
          const file = accountUploadProfileFileInput.files && accountUploadProfileFileInput.files[0];
          if(!file) return;
          importWorkspaceCsvFile(file);
          accountUploadProfileFileInput.value = '';
        });
      }
      if(accountExportAllCsvBtn){
        accountExportAllCsvBtn.addEventListener('click', ()=>{
          exportAllRecordsCsv();
        });
      }
      toneOptions.forEach((btn)=>{
        btn.addEventListener('click', ()=>{
          applyShellTone(btn.getAttribute('data-tone') || 'default');
        });
      });
      densityOptions.forEach((btn)=>{
        btn.addEventListener('click', ()=>{
          applyShellDensity(btn.getAttribute('data-density') || 'comfortable');
        });
      });
      fontScaleOptions.forEach((btn)=>{
        btn.addEventListener('click', ()=>{
          applyShellFontScale(btn.getAttribute('data-font-scale') || 1);
        });
      });
      dummyOptions.forEach((btn)=>{
        btn.addEventListener('click', ()=>{
          applyDummyMode(btn.getAttribute('data-dummy') || 'off');
        });
      });
      if(resetLayoutWidthsBtn){
        resetLayoutWidthsBtn.addEventListener('click', ()=>{
          resetShellLayoutWidths();
          toggleSettings(false);
          toast('Layout widths reset.');
        });
      }

      // Side panel collapsibles: respect manual toggles once the user interacts.
      ['#sideWhyBlock', '#sideRoiBlock', '#sideAnswersBlock'].forEach(sel=>{
        const el = $(sel);
        if(!el) return;
        el.addEventListener('toggle', ()=>{
          if(el.dataset.autoToggle === 'true'){
            delete el.dataset.autoToggle;
            return;
          }
          el.dataset.userSet = 'true';
        });
      });

      // "Edit" links in the Review summary (jump back to a step + question)
      document.addEventListener('click', (e)=>{
        const btn = e.target.closest('[data-jump]');
        if(!btn) return;
        e.preventDefault();
        const step = Number(btn.dataset.jump || 0);
        const sel = btn.dataset.target;
        if(step) setActiveStep(step);

        if(sel){
          window.setTimeout(()=>{
            const el = document.querySelector(sel);
            if(!el) return;
            el.classList.add('flash');
            el.scrollIntoView({ behavior:'smooth', block:'start' });
            window.setTimeout(()=> el.classList.remove('flash'), 1200);
          }, 260);
        }
      });


      // business inputs
      const fullNameEl = $('#fullName');
      if(fullNameEl) fullNameEl.addEventListener('input', (e)=>{ state.fullName = e.target.value; update(); });

      const companyEl = $('#company');
      if(companyEl) companyEl.addEventListener('input', (e)=>{ state.company = e.target.value; update(); });

      const companySizeEl = $('#companySize');
      if(companySizeEl) companySizeEl.addEventListener('change', (e)=>{ state.companySize = e.target.value; update(); });

      const operatingCountryEl = $('#operatingCountry');
      if(operatingCountryEl) operatingCountryEl.addEventListener('change', (e)=>{ state.operatingCountry = e.target.value; update(); });

      renderSingleOptionButtons($('#optRole'), roleOpts, 'role');
      renderLimitedChecks($('#pressureCards'), 'pressureSources', '#pressureMeta', pressureOpts, 3);
      renderRadios($('#radUrgentWin'), 'urgentWin', urgentWinOpts, (id)=> state.urgentWin = id);
      renderLimitedChecks($('#riskEnvCards'), 'riskEnvs', '#riskEnvMeta', riskEnvOpts, 2);
      renderRadios($('#radMeasuredOn'), 'measuredOn', measuredOnOpts, (id)=> state.measuredOn = id);
      renderRadios($('#radOrgPain'), 'orgPain', orgPainOpts, (id)=> state.orgPain = id);

      renderDriverCards();

      renderOptionButtons($('#optGroups'), groupOpts, state.groups);
      renderRadios($('#radRhythm'), 'rhythm', rhythmOpts, (id)=> state.rhythm = id);
      renderRadios($('#radMeasure'), 'measure', measureOpts, (id)=> state.measure = id);

      // Package fit
      renderRadios($('#radFitRealism'), 'fitRealism', fitRealismOpts, (id)=> state.fitRealism = id);
      renderRadios($('#radFitScope'), 'fitScope', fitScopeOpts, (id)=> state.fitScope = id);
      renderRadios($('#radFitToday'), 'fitToday', fitTodayOpts, (id)=> state.fitToday = id);
      renderRadios($('#radFitServices'), 'fitServices', fitServicesOpts, (id)=> state.fitServices = id);
      renderRadios($('#radFitRisk'), 'fitRiskFrame', fitRiskFrameOpts, (id)=> state.fitRiskFrame = id);

      // Tech stack pick-list
      renderOptionButtons($('#optStackSoc'), stackSocOpts, state.stack);
      renderOptionButtons($('#optStackCloud'), stackCloudOpts, state.stack);
      renderOptionButtons($('#optStackDevops'), stackDevopsOpts, state.stack);
      renderOptionButtons($('#optStackDomains'), stackDomainOpts, state.stack);

      const stackOtherEl = $('#stackOther');
      if(stackOtherEl){
        stackOtherEl.addEventListener('input', (e)=>{
          state.stackOther = e.target.value;
          update();
        });
      }


      // Context dropdowns
      $('#industry').addEventListener('change', (e)=>{
        state.industry = e.target.value;
        state._industryChanged = true;
        update();
      });
      $('#region').addEventListener('change', (e)=>{
        state.region = e.target.value;
        state._regionChanged = true;
        update();
      });

      // Regulation picker controls
      const regSearchEl = $('#regSearch');
      if(regSearchEl){
        regSearchEl.addEventListener('input', (e)=>{
          state.regSearch = e.target.value;
          update();
        });
      }

      $$('#regMode .segBtn').forEach(btn=>{
        btn.addEventListener('click', ()=>{
          const mode = btn.dataset.mode;
          if(!mode) return;
          state.regModeTouched = true;
          state.regMode = mode;
          update();
        });
      });

      const proofSetBtn = $('#applyProofSet');
      if(proofSetBtn){
        proofSetBtn.addEventListener('click', ()=>{
          applyCommonProofSet();
          toast('Applied recommended set.');
          update();
        });
      }

      // Currency toggle
      $$('.curBtn').forEach(btn=>{
        btn.addEventListener('click', ()=>{
          const cur = btn.dataset.cur;
          if(!cur) return;
          state.currency = cur;

          // reflect pressed state
          $$('.curBtn').forEach(b=> b.setAttribute('aria-pressed','false'));
          btn.setAttribute('aria-pressed','true');

          // resync sliders into the selected currency
          syncCurrencyUI();
          update();
        });
      });

      // FX inputs
      const fxGBP = $('#fxGBP');
      if(fxGBP){
        fxGBP.addEventListener('input', (e)=>{
          const v = Number(e.target.value);
          if(Number.isFinite(v) && v > 0) state.fx.GBP = v;
          syncCurrencyUI();
          update();
        });
      }
      const fxEUR = $('#fxEUR');
      if(fxEUR){
        fxEUR.addEventListener('input', (e)=>{
          const v = Number(e.target.value);
          if(Number.isFinite(v) && v > 0) state.fx.EUR = v;
          syncCurrencyUI();
          update();
        });
      }

      // ROI estimate controls
      const revenueEl = $('#revenue');
      const investEl = $('#invest');
      const cyberEl = $('#teamCyber');
      const devEl = $('#teamDev');
      const wfEl = $('#teamWf');

      function syncCurrencyUI(){
        const fx = fxRate();

        // Revenue slider is expressed in "selected currency billions" for UX.
        // Internal state stays in USD billions.
        if(revenueEl){
          revenueEl.min = String((0.2 * fx).toFixed(2));
          revenueEl.max = String((200 * fx).toFixed(0));
          revenueEl.step = String((0.1 * fx).toFixed(2));
          revenueEl.value = String((state.revenueB * fx).toFixed(2));
        }

        // Spend slider is expressed in selected currency.
        if(investEl){
          investEl.min = String(Math.round(25000 * fx));
          investEl.max = String(Math.round(9000000 * fx));
          investEl.step = String(Math.max(1000, Math.round(5000 * fx)));
          investEl.value = String(Math.round(state.investUSD * fx));
        }

        // Salary inputs are expressed in selected currency (internal state stays USD)
        const cyberSal = $('#cyberSalary');
        if(cyberSal) cyberSal.value = String(Math.round(state.cyberSalaryUSD * fx));
        const devSal = $('#devSalary');
        if(devSal) devSal.value = String(Math.round(state.devSalaryUSD * fx));
      }

      function syncFormControlsFromState(){
        const setVal = (sel, val)=>{
          const el = $(sel);
          if(el) el.value = val;
        };
        setVal('#fullName', state.fullName);
        setVal('#company', state.company);
        setVal('#companySize', state.companySize);
        setVal('#operatingCountry', state.operatingCountry);
        setVal('#industry', state.industry);
        setVal('#region', state.region);
        setVal('#regSearch', state.regSearch);
        setVal('#stackOther', state.stackOther);
        setVal('#email', state.email);
        setVal('#phone', state.phone);
        setVal('#notes', state.notes);

        const optinEl = $('#optin');
        if(optinEl) optinEl.checked = !!state.optin;

        const fxGBPEl = $('#fxGBP');
        if(fxGBPEl) fxGBPEl.value = String(state.fx.GBP);
        const fxEUREl = $('#fxEUR');
        if(fxEUREl) fxEUREl.value = String(state.fx.EUR);
        const payEl = $('#paybackDelay');
        if(payEl) payEl.value = String(state.paybackDelayMonths);

        if(cyberEl) cyberEl.value = String(state.teamCyber);
        if(devEl) devEl.value = String(state.teamDev);
        if(wfEl) wfEl.value = String(state.teamWf);

        $$('.curBtn').forEach((btn)=>{
          btn.setAttribute('aria-pressed', (btn.dataset.cur === state.currency) ? 'true' : 'false');
        });
        $$('.segBtn[data-real]').forEach((btn)=>{
          btn.setAttribute('aria-pressed', (btn.dataset.real === state.realization) ? 'true' : 'false');
        });

        renderSingleOptionButtons($('#optRole'), roleOpts, 'role');
        renderLimitedChecks($('#pressureCards'), 'pressureSources', '#pressureMeta', pressureOpts, 3);
        renderRadios($('#radUrgentWin'), 'urgentWin', urgentWinOpts, (id)=> state.urgentWin = id);
        renderLimitedChecks($('#riskEnvCards'), 'riskEnvs', '#riskEnvMeta', riskEnvOpts, 2);
        renderRadios($('#radMeasuredOn'), 'measuredOn', measuredOnOpts, (id)=> state.measuredOn = id);
        renderRadios($('#radOrgPain'), 'orgPain', orgPainOpts, (id)=> state.orgPain = id);
        renderDriverCards();
        renderOptionButtons($('#optGroups'), groupOpts, state.groups);
        renderRadios($('#radRhythm'), 'rhythm', rhythmOpts, (id)=> state.rhythm = id);
        renderRadios($('#radMeasure'), 'measure', measureOpts, (id)=> state.measure = id);
        renderRadios($('#radFitRealism'), 'fitRealism', fitRealismOpts, (id)=> state.fitRealism = id);
        renderRadios($('#radFitScope'), 'fitScope', fitScopeOpts, (id)=> state.fitScope = id);
        renderRadios($('#radFitToday'), 'fitToday', fitTodayOpts, (id)=> state.fitToday = id);
        renderRadios($('#radFitServices'), 'fitServices', fitServicesOpts, (id)=> state.fitServices = id);
        renderRadios($('#radFitRisk'), 'fitRiskFrame', fitRiskFrameOpts, (id)=> state.fitRiskFrame = id);
        renderOptionButtons($('#optStackSoc'), stackSocOpts, state.stack);
        renderOptionButtons($('#optStackCloud'), stackCloudOpts, state.stack);
        renderOptionButtons($('#optStackDevops'), stackDevopsOpts, state.stack);
        renderOptionButtons($('#optStackDomains'), stackDomainOpts, state.stack);

        $$('.step').forEach((s)=> s.dataset.active = (s.dataset.step === String(state.activeStep)) ? 'true' : 'false');
        $$('.chip').forEach((c)=> c.dataset.active = (c.dataset.chip === String(state.activeStep)) ? 'true' : 'false');

        syncCurrencyUI();
      }

      function createNewRecord(){
        const account = settingsState.account || {};
        const useAccountDefaults = resolveAccountPrefillMode(account.prefillMode) !== 'off';
        state.activeThread = 'current';
        state.savePulseUntil = 0;
        state.saveIsThinking = false;
        clearScheduledAutoSave();

        // Identity + context
        state.role = '';
        state.fullName = useAccountDefaults ? (account.fullName || '') : '';
        state.company = '';
        state.companySize = '';
        state.operatingCountry = useAccountDefaults ? (account.defaultCountry || '') : '';
        state.industry = '';
        state.region = useAccountDefaults ? (account.defaultRegion || '') : '';
        state._industryChanged = false;
        state._regionChanged = false;

        // Outcome discovery
        state.pressureSources = [];
        state.urgentWin = '';
        state.riskEnvs = [];
        state.measuredOn = '';
        state.orgPain = '';
        state.drivers = [];
        state.milestone = '';
        state.evidence = new Set();
        state.outcomeDrilldowns = {};

        // Coverage + package fit
        state.groups = new Set();
        state.rhythm = '';
        state.measure = '';
        state.fitRealism = '';
        state.fitScope = '';
        state.fitToday = '';
        state.fitServices = '';
        state.fitRiskFrame = '';

        // Context + stack
        state.regMode = 'suggested';
        state.regModeTouched = false;
        state.regSearch = '';
        state.regsTouched = false;
        state.regs = new Set();
        state.stack = new Set();
        state.stackOther = '';

        // ROI assumptions
        state.currency = 'USD';
        state.fx.GBP = 0.80;
        state.fx.EUR = 0.90;
        state.revenueB = IMMERSIVE_MODEL.baselineRevenueB;
        state.teamCyber = IMMERSIVE_MODEL.baselineCyber;
        state.teamDev = IMMERSIVE_MODEL.baselineDev;
        state.teamWf = IMMERSIVE_MODEL.baselineWorkforce;
        state.teamManual = false;
        state.investManual = false;
        state.investUSD = IMMERSIVE_MODEL.baselineInvestment;
        state.realization = 'conservative';
        state.paybackDelayMonths = 3;
        state.cyberSalaryUSD = 180000;
        state.devSalaryUSD = 160000;

        // Lead capture
        state.email = useAccountDefaults ? (account.email || '') : '';
        state.phone = useAccountDefaults ? (account.phone || '') : '';
        state.notes = '';
        state.optin = false;

        // Nav state
        state.activeStep = 1;
        state.visited = new Set([1]);

        syncFormControlsFromState();
        setView('interstitial', { render:false });
        update();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        toast('New record created.');
      }

      function applyDummyAccountProfile(opts){
        const cfg = opts || {};
        const keepStep = clamp(Number(state.activeStep) || 1, 1, 6);

        // Identity + context
        state.role = 'ciso';
        state.fullName = 'Jane Doe';
        state.company = 'Orchid Corp';
        state.companySize = '10k-50k';
        state.operatingCountry = 'United States';
        state.industry = 'Financial Services';
        state.region = 'NA';
        state._industryChanged = false;
        state._regionChanged = false;

        // Outcome discovery
        state.pressureSources = ['board', 'regulator', 'insurer'];
        state.urgentWin = 'boardEvidence';
        state.riskEnvs = ['cloud', 'identity'];
        state.measuredOn = 'audit';
        state.orgPain = 'externalProof';
        state.drivers = ['insurance', 'nearMiss', 'change'];
        state.milestone = 'evidence';
        state.evidence = new Set(['board', 'reg', 'insurer']);
        state.outcomeDrilldowns = {
          complianceEvidence: 'regInsurer',
          fasterResponse: 'coordination',
          secureEnterprise: 'cloudIdentity',
          supplyChain: 'regs'
        };

        // Coverage + package fit
        state.groups = new Set(['soc', 'cloud', 'grc', 'exec', 'third']);
        state.rhythm = 'monthly';
        state.measure = 'performance';
        state.fitRealism = 'tooling';
        state.fitScope = 'multi';
        state.fitToday = 'adhoc';
        state.fitServices = 'guided';
        state.fitRiskFrame = 'governance';

        // Context + stack
        state.regMode = 'suggested';
        state.regModeTouched = false;
        state.regSearch = '';
        state.regsTouched = true;
        state.regs = new Set(['nistscf', 'iso27001', 'soc2', 'sec', 'nydfs']);
        state.stack = new Set(['crowdstrike', 'sentinel', 'aws', 'azure', 'kubernetes', 'github', 'identity', 'grc', 'vuln']);
        state.stackOther = 'ServiceNow GRC';

        // ROI assumptions
        state.currency = 'USD';
        state.fx.GBP = 0.80;
        state.fx.EUR = 0.90;
        state.revenueB = 12;
        state.teamCyber = 240;
        state.teamDev = 1200;
        state.teamWf = 5200;
        state.teamManual = true;
        state.investUSD = 850000;
        state.investManual = true;
        state.realization = 'expected';
        state.paybackDelayMonths = 2;
        state.cyberSalaryUSD = 185000;
        state.devSalaryUSD = 165000;

        // Lead capture
        state.email = 'jane.doe@orchidcorp.com';
        state.phone = '+1 415 555 0147';
        state.notes = 'Dummy account for visual QA and layout checks.';
        state.optin = true;

        // Mark all steps visited so snapshot/review/ROI render fully.
        state.visited = new Set([1, 2, 3, 4, 5, 6]);
        state.activeStep = cfg.preserveActiveStep === false ? 6 : keepStep;

        syncFormControlsFromState();
        update();

        if(cfg.silent !== true){
          toast('Dummy account populated.');
        }
      }

      function applySuggested(){
        const suggested = inferProgramScale(state.revenueB);
        state.teamCyber = suggested.cyber;
        state.teamDev = suggested.dev;
        state.teamWf = suggested.wf;
        state.teamManual = false;

        if(!state.investManual){
          state.investUSD = typicalInvestment(state.revenueB, { cyber: state.teamCyber, dev: state.teamDev, wf: state.teamWf });
        }

        // sync sliders
        if(cyberEl) cyberEl.value = String(state.teamCyber);
        if(devEl) devEl.value = String(state.teamDev);
        if(wfEl) wfEl.value = String(state.teamWf);

        syncCurrencyUI();
        update();
      }

      if(revenueEl){
        revenueEl.addEventListener('input', (e)=>{
          // slider value is in selected currency billions
          const curB = Number(e.target.value)||0;
          state.revenueB = curB / fxRate();

          if(!state.teamManual){
            const suggested = inferProgramScale(state.revenueB);
            state.teamCyber = suggested.cyber;
            state.teamDev = suggested.dev;
            state.teamWf = suggested.wf;

            if(cyberEl) cyberEl.value = String(state.teamCyber);
            if(devEl) devEl.value = String(state.teamDev);
            if(wfEl) wfEl.value = String(state.teamWf);
          }

          if(!state.investManual){
            state.investUSD = typicalInvestment(state.revenueB, { cyber: state.teamCyber, dev: state.teamDev, wf: state.teamWf });
            syncCurrencyUI();
          }else{
            syncCurrencyUI();
          }
          update();
        });
      }

      if(investEl){
        investEl.addEventListener('input', (e)=>{
          const curVal = Number(e.target.value)||0;
          state.investUSD = fromCur(curVal);
          state.investManual = true;
          update();
        });
      }

      if(cyberEl){
        cyberEl.addEventListener('input', (e)=>{
          state.teamCyber = Number(e.target.value)||0;
          state.teamManual = true;

          // If spend hasn't been manually overridden, keep it in sync with footprint changes.
          if(!state.investManual){
            state.investUSD = typicalInvestment(state.revenueB, { cyber: state.teamCyber, dev: state.teamDev, wf: state.teamWf });
            syncCurrencyUI();
          }

          update();
        });
      }
      if(devEl){
        devEl.addEventListener('input', (e)=>{
          state.teamDev = Number(e.target.value)||0;
          state.teamManual = true;

          if(!state.investManual){
            state.investUSD = typicalInvestment(state.revenueB, { cyber: state.teamCyber, dev: state.teamDev, wf: state.teamWf });
            syncCurrencyUI();
          }

          update();
        });
      }
      if(wfEl){
        wfEl.addEventListener('input', (e)=>{
          state.teamWf = Number(e.target.value)||0;
          state.teamManual = true;

          if(!state.investManual){
            state.investUSD = typicalInvestment(state.revenueB, { cyber: state.teamCyber, dev: state.teamDev, wf: state.teamWf });
            syncCurrencyUI();
          }

          update();
        });
      }

      // labels for team sliders
      function syncTeamLabels(){
        const a = $('#teamCyberLabel'); if(a) a.textContent = fmtNum(state.teamCyber);
        const b = $('#teamDevLabel'); if(b) b.textContent = fmtNum(state.teamDev);
        const c = $('#teamWfLabel'); if(c) c.textContent = fmtNum(state.teamWf);
        const d = $('#investLabel'); if(d) d.textContent = fmtMoneyUSD(state.investUSD);
      }

      // show reset if needed
      function syncReset(){
        const btn = $('#resetValue');
        if(!btn) return;
        btn.style.display = 'inline-flex';
      }


      function resetValuePreview(){
        // Reset Step 4 inputs to the baseline model.
        state.currency = 'USD';
        state.fx.GBP = 0.80;
        state.fx.EUR = 0.90;

        state.revenueB = IMMERSIVE_MODEL.baselineRevenueB;

        state.teamCyber = IMMERSIVE_MODEL.baselineCyber;
        state.teamDev = IMMERSIVE_MODEL.baselineDev;
        state.teamWf = IMMERSIVE_MODEL.baselineWorkforce;
        state.teamManual = false;

        state.investManual = false;
        state.investUSD = IMMERSIVE_MODEL.baselineInvestment;

        state.realization = 'conservative';
        state.paybackDelayMonths = 3;
        state.cyberSalaryUSD = 180000;
        state.devSalaryUSD = 160000;

        // UI: currency buttons
        $$('.curBtn').forEach(b=> b.setAttribute('aria-pressed', (b.dataset.cur === state.currency) ? 'true' : 'false'));

        // UI: scenario buttons
        $$('.segBtn[data-real]').forEach(b=> b.setAttribute('aria-pressed', (b.dataset.real === state.realization) ? 'true' : 'false'));

        // Inputs (FX / payback delay)
        const fxGBPEl = $('#fxGBP'); if(fxGBPEl) fxGBPEl.value = String(state.fx.GBP);
        const fxEUREl = $('#fxEUR'); if(fxEUREl) fxEUREl.value = String(state.fx.EUR);
        const payEl = $('#paybackDelay'); if(payEl) payEl.value = String(state.paybackDelayMonths);

        // Sliders
        if(cyberEl) cyberEl.value = String(state.teamCyber);
        if(devEl) devEl.value = String(state.teamDev);
        if(wfEl) wfEl.value = String(state.teamWf);

        // Ensure spend matches the baseline model
        state.investUSD = typicalInvestment(state.revenueB, { cyber: state.teamCyber, dev: state.teamDev, wf: state.teamWf });

        syncCurrencyUI();
        update();
      }

      const resetBtn = $('#resetValue');
      if(resetBtn){
        resetBtn.addEventListener('click', ()=>{
          resetValuePreview();
          toast('Reset to baseline.');
        });
      }

      // Scenario toggle
      $$('.segBtn[data-real]').forEach(btn=>{
        btn.addEventListener('click', ()=>{
          state.realization = btn.dataset.real;
          $$('.segBtn[data-real]').forEach(b=> b.setAttribute('aria-pressed','false'));
          btn.setAttribute('aria-pressed','true');
          update();
        });
      });

      // Payback delay
      const paybackDelayEl = $('#paybackDelay');
      if(paybackDelayEl){
        paybackDelayEl.addEventListener('input', (e)=>{
          state.paybackDelayMonths = Number(e.target.value)||0;
          update();
        });
      }

      const cyberSalaryEl = $('#cyberSalary');
      if(cyberSalaryEl){
        cyberSalaryEl.addEventListener('input', (e)=>{
          const curVal = Number(e.target.value)||0;
          state.cyberSalaryUSD = fromCur(curVal);
          update();
        });
      }

      const devSalaryEl = $('#devSalary');
      if(devSalaryEl){
        devSalaryEl.addEventListener('input', (e)=>{
          const curVal = Number(e.target.value)||0;
          state.devSalaryUSD = fromCur(curVal);
          update();
        });
      }

      // Step nav actions
      document.addEventListener('click', (e)=>{
        const btn = e.target.closest('[data-action]');
        if(!btn) return;
        const action = btn.dataset.action;

        if(action === 'next'){
          setActiveStep(state.activeStep + 1);
          requestAutoSave(AUTO_SAVE_FAST_MS);
        }
        if(action === 'save'){
          saveActiveRecord();
        }
        if(action === 'back'){
          setActiveStep(state.activeStep - 1);
        }
        if(action === 'copy'){
          const rec = score();
          const tier = (rec.best === 'core') ? packages.core : (rec.best === 'adv') ? packages.adv : packages.ult;
          const rs = reasons(rec.best);
          const roi = computeRoi();
          const paybackTxt = fmtPayback(computePaybackMonths(roi));
          copyToClipboard(buildSummaryText(tier, rs, roi, paybackTxt));
        }
        if(action === 'downloadCSV'){
          const report = buildReportModelV1();
          const csv = reportToCSV(report);
          const fname = `immersive-readiness-${safeFilePart(report.organisation.company || 'report')}-${report.createdAt.slice(0,10)}.csv`;
          downloadText(csv, fname, 'text/csv;charset=utf-8;');
          toast('Downloaded CSV.');
        }
        if(action === 'printReport'){
          const report = buildReportModelV1();
          printReport(report);
        }
        if(action === 'openConsultation'){
          openThreadBooking(state.activeThread || 'current');
        }
        if(action === 'copyConsultationBrief'){
          const model = consultationModelForThread(state.consultationThreadId || state.activeThread || 'current');
          copyToClipboard(consultationBriefText(model));
        }
        if(action === 'downloadConsultationBrief'){
          const model = consultationModelForThread(state.consultationThreadId || state.activeThread || 'current');
          const datePart = new Date().toISOString().slice(0, 10);
          const filename = `consultation-brief-${safeFilePart(model.company || 'record')}-${datePart}.txt`;
          downloadText(consultationBriefText(model), filename, 'text/plain;charset=utf-8;');
          toast('Downloaded consultation brief.');
        }
        if(action === 'book'){
          const emailField = $('#email');
          const phoneField = $('#phone');
          const notesField = $('#notes');
          const optinField = $('#optin');
          state.email = emailField ? emailField.value.trim() : '';
          state.phone = phoneField ? phoneField.value.trim() : '';
          state.notes = notesField ? notesField.value.trim() : '';
          state.optin = !!(optinField && optinField.checked);

          if(!state.email){
            toast('Add a business email to book a consultation.');
            if(emailField) emailField.focus();
            return;
          }

          const model = consultationModelForThread(state.consultationThreadId || state.activeThread || 'current');
          const modalBody = $('#modalBody');
          if(modalBody){
            modalBody.textContent = `In production, this would create a consultation request for ${model.company}, attach the payload + agenda, and hand off attendees to scheduling + CRM.`;
          }
          toggleConsultation(false);
          $('#modal').classList.add('show');
        }
        if(action === 'closeModal'){
          $('#modal').classList.remove('show');
        }
        if(action === 'closeArchiveModal'){
          closeArchivePrompt();
        }
        if(action === 'confirmArchiveModal'){
          applyArchivePrompt();
        }
      });

      // Close modal on backdrop click
      $('#modal').addEventListener('click', (e)=>{
        if(e.target.id === 'modal') $('#modal').classList.remove('show');
      });
      $('#archiveModal')?.addEventListener('click', (e)=>{
        if(e.target.id === 'archiveModal') closeArchivePrompt();
      });

      // Boot: align suggested sizing
      applySuggested();
      syncFormControlsFromState();

      // keep slider labels in sync on each update
      const _update = update;
      update = function(){
        syncTeamLabels();
        syncReset();
        _update();
      }

      if(settingsState.dummyMode === 'on'){
        applyDummyAccountProfile({ preserveActiveStep:true, silent:true });
      }else{
        update();
      }
    })();
  
