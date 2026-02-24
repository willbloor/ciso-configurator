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

      function firebaseWebConfigIsValid(input){
        const cfg = (input && typeof input === 'object') ? input : null;
        if(!cfg) return false;
        const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
        return requiredKeys.every((key)=> String(cfg[key] || '').trim().length > 0);
      }

      function sanitizeFirebaseWebConfig(input){
        const cfg = (input && typeof input === 'object') ? input : null;
        if(!cfg) return null;
        const next = {
          apiKey: String(cfg.apiKey || '').trim(),
          authDomain: String(cfg.authDomain || '').trim(),
          projectId: String(cfg.projectId || '').trim(),
          storageBucket: String(cfg.storageBucket || '').trim(),
          messagingSenderId: String(cfg.messagingSenderId || '').trim(),
          appId: String(cfg.appId || '').trim()
        };
        return firebaseWebConfigIsValid(next) ? next : null;
      }

      function parseFirebaseWebConfigText(text){
        const src = String(text || '').trim();
        if(!src) return null;
        try{
          const parsed = JSON.parse(src);
          return sanitizeFirebaseWebConfig(parsed);
        }catch(err){
          // Fall through to object literal extraction.
        }
        const matched = src.match(/firebaseConfig\s*=\s*(\{[\s\S]*?\})\s*;?/i);
        const objectLiteral = matched ? matched[1] : src;
        const normalizedLiteral = objectLiteral
          .replace(/^[^{]*\{/, '{')
          .replace(/\}[^}]*$/, '}')
          .replace(/([,{]\s*)([A-Za-z_$][A-Za-z0-9_$]*)\s*:/g, '$1"$2":')
          .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, inner)=> `"${String(inner).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)
          .replace(/,\s*([}\]])/g, '$1');
        try{
          const parsed = JSON.parse(normalizedLiteral);
          return sanitizeFirebaseWebConfig(parsed);
        }catch(err){
          return null;
        }
      }

      function resolveBackendConnectionMode(raw){
        return String(raw || '').trim().toLowerCase() === 'on' ? 'on' : 'off';
      }

      function readBackendConnectionModeFromStorage(){
        try{
          const raw = window.localStorage.getItem(BACKEND_CONNECTION_MODE_STORAGE_KEY);
          return resolveBackendConnectionMode(raw || 'off');
        }catch(err){
          return 'off';
        }
      }

      function saveBackendConnectionModeToStorage(mode){
        const next = resolveBackendConnectionMode(mode);
        try{
          window.localStorage.setItem(BACKEND_CONNECTION_MODE_STORAGE_KEY, next);
        }catch(err){
          // Ignore storage errors.
        }
        return next;
      }

      function backendConnectionEnabled(){
        return resolveBackendConnectionMode(firebaseRuntime.connectionMode) === 'on';
      }

      function readFirebaseWebConfigFromStorage(){
        try{
          const raw = window.localStorage.getItem(FIREBASE_WEB_CONFIG_STORAGE_KEY);
          if(!raw) return null;
          const parsed = JSON.parse(raw);
          return sanitizeFirebaseWebConfig(parsed);
        }catch(err){
          return null;
        }
      }

      function readFirebaseWebConfigFromWindow(){
        const raw = window.__FIREBASE_CONFIG__;
        if(!raw) return null;
        if(typeof raw === 'string'){
          return parseFirebaseWebConfigText(raw);
        }
        return sanitizeFirebaseWebConfig(raw);
      }

      function resolvedFirebaseWebConfig(){
        const fromWindow = readFirebaseWebConfigFromWindow();
        if(fromWindow){
          firebaseRuntime.source = 'window';
          return fromWindow;
        }
        const fromStorage = readFirebaseWebConfigFromStorage();
        if(fromStorage){
          firebaseRuntime.source = 'storage';
          return fromStorage;
        }
        firebaseRuntime.source = 'none';
        return null;
      }

      function saveFirebaseWebConfigToStorage(config){
        const safe = sanitizeFirebaseWebConfig(config);
        if(!safe) return false;
        try{
          window.localStorage.setItem(FIREBASE_WEB_CONFIG_STORAGE_KEY, JSON.stringify(safe));
          return true;
        }catch(err){
          return false;
        }
      }

      function clearFirebaseWebConfigFromStorage(){
        try{
          window.localStorage.removeItem(FIREBASE_WEB_CONFIG_STORAGE_KEY);
        }catch(err){
          // Ignore storage errors.
        }
      }

      function firebaseErrorMessage(err, fallback){
        if(err && typeof err === 'object'){
          const code = String(err.code || '').trim();
          const message = String(err.message || '').trim();
          if(code && message) return `${code}: ${message}`;
          if(message) return message;
        }
        return String(fallback || 'Firebase operation failed.');
      }

      function renderFirebaseConnectionUi(){
        const configInput = $('#firebaseConfigJson');
        const modeOptions = $$('#backendConnectionToggle [data-backend-connection]');
        const connectionPill = $('#firebaseConnectionPill');
        const userPill = $('#firebaseUserPill');
        const healthStatus = $('#firebaseHealthcheckStatus');
        const signInBtn = $('#firebaseSignInGoogleBtn');
        const signOutBtn = $('#firebaseSignOutBtn');
        const healthBtn = $('#firebaseHealthcheckBtn');
        const saveConfigBtn = $('#firebaseSaveConfigBtn');
        const clearConfigBtn = $('#firebaseClearConfigBtn');
        syncPermissionTestModeOptionsUi();

        const cfg = resolvedFirebaseWebConfig();
        const connectionMode = resolveBackendConnectionMode(firebaseRuntime.connectionMode || readBackendConnectionModeFromStorage());
        firebaseRuntime.connectionMode = connectionMode;
        const isEnabled = connectionMode === 'on';
        firebaseRuntime.configured = !!cfg;
        modeOptions.forEach((btn)=>{
          if(!(btn instanceof HTMLElement)) return;
          const mode = resolveBackendConnectionMode(btn.getAttribute('data-backend-connection') || 'off');
          btn.setAttribute('aria-pressed', mode === connectionMode ? 'true' : 'false');
        });
        if(configInput){
          if(cfg){
            configInput.value = JSON.stringify(cfg, null, 2);
          }else if(!String(configInput.value || '').trim()){
            configInput.value = '';
          }
          configInput.disabled = !isEnabled;
        }

        if(connectionPill){
          let label = 'Backend: Off';
          if(isEnabled){
            label = 'Firebase: Not configured';
            if(cfg && firebaseRuntime.connected){
              label = `Firebase: Connected (${firebaseRuntime.source})`;
            }else if(cfg){
              label = `Firebase: Configured (${firebaseRuntime.source})`;
            }else if(firebaseRuntime.lastError){
              label = 'Firebase: Error';
            }
          }
          connectionPill.textContent = label;
        }

        if(userPill){
          const user = firebaseRuntime.user;
          const email = user && typeof user.email === 'string' ? user.email.trim() : '';
          const name = user && typeof user.displayName === 'string' ? user.displayName.trim() : '';
          userPill.textContent = user
            ? `User: ${name || email || 'Signed in'}`
            : 'User: Signed out';
        }

        if(healthStatus){
          const note = String(firebaseRuntime.lastHealthcheckStatus || '').trim();
          healthStatus.textContent = isEnabled
            ? (note || 'Healthcheck: not run.')
            : 'Backend connection is off. Current app behavior remains local-only.';
        }

        if(signInBtn){
          signInBtn.disabled = !(isEnabled && cfg && firebaseRuntime.connected && firebaseAuthRef);
        }
        if(signOutBtn){
          signOutBtn.disabled = !(isEnabled && firebaseRuntime.connected && firebaseAuthRef && firebaseRuntime.user);
        }
        if(healthBtn){
          healthBtn.disabled = !(isEnabled && firebaseRuntime.connected && firebaseDbRef && firebaseRuntime.user);
        }
        if(saveConfigBtn){
          saveConfigBtn.disabled = !isEnabled;
        }
        if(clearConfigBtn){
          clearConfigBtn.disabled = !isEnabled;
        }
      }

      function initFirebaseRuntime(){
        const connectionMode = resolveBackendConnectionMode(firebaseRuntime.connectionMode || readBackendConnectionModeFromStorage());
        firebaseRuntime.connectionMode = connectionMode;
        const firebaseSdk = window.firebase;
        const cfg = resolvedFirebaseWebConfig();
        firebaseRuntime.configured = !!cfg;
        firebaseRuntime.connected = false;
        firebaseRuntime.user = null;
        firebaseRuntime.lastError = '';
        firebaseAppRef = null;
        firebaseAuthRef = null;
        firebaseDbRef = null;
        if(firebaseAuthUnsub){
          firebaseAuthUnsub();
          firebaseAuthUnsub = null;
        }

        if(connectionMode !== 'on'){
          firebaseRuntime.lastError = '';
          firebaseRuntime.lastHealthcheckStatus = '';
          renderFirebaseConnectionUi();
          return false;
        }
        if(!cfg){
          renderFirebaseConnectionUi();
          return false;
        }
        if(!firebaseSdk || typeof firebaseSdk.initializeApp !== 'function'){
          firebaseRuntime.lastError = 'Firebase SDK unavailable in this build.';
          renderFirebaseConnectionUi();
          return false;
        }

        try{
          firebaseAppRef = (firebaseSdk.apps && firebaseSdk.apps.length)
            ? firebaseSdk.app()
            : firebaseSdk.initializeApp(cfg);
          firebaseAuthRef = firebaseSdk.auth();
          firebaseDbRef = firebaseSdk.firestore();
          firebaseRuntime.connected = true;
          firebaseAuthUnsub = firebaseAuthRef.onAuthStateChanged((user)=>{
            firebaseRuntime.user = user || null;
            renderFirebaseConnectionUi();
          });
          renderFirebaseConnectionUi();
          return true;
        }catch(err){
          firebaseRuntime.lastError = firebaseErrorMessage(err, 'Failed to initialize Firebase.');
          renderFirebaseConnectionUi();
          return false;
        }
      }

      async function signInWithGoogleFirebase(){
        if(!backendConnectionEnabled()){
          toast('Turn backend connection on first.');
          return false;
        }
        if(!firebaseAuthRef || !window.firebase){
          toast('Firebase auth is not configured yet.');
          return false;
        }
        try{
          const provider = new window.firebase.auth.GoogleAuthProvider();
          await firebaseAuthRef.signInWithPopup(provider);
          firebaseRuntime.lastError = '';
          firebaseRuntime.lastHealthcheckStatus = '';
          renderFirebaseConnectionUi();
          toast('Signed in with Google.');
          return true;
        }catch(err){
          const message = firebaseErrorMessage(err, 'Google sign-in failed.');
          firebaseRuntime.lastError = message;
          renderFirebaseConnectionUi();
          toast(message);
          return false;
        }
      }

      async function signOutFirebaseUser(){
        if(!backendConnectionEnabled()){
          toast('Backend connection is off.');
          return false;
        }
        if(!firebaseAuthRef){
          toast('Firebase auth is not configured yet.');
          return false;
        }
        try{
          await firebaseAuthRef.signOut();
          firebaseRuntime.lastError = '';
          firebaseRuntime.lastHealthcheckStatus = '';
          renderFirebaseConnectionUi();
          toast('Signed out.');
          return true;
        }catch(err){
          const message = firebaseErrorMessage(err, 'Sign-out failed.');
          firebaseRuntime.lastError = message;
          renderFirebaseConnectionUi();
          toast(message);
          return false;
        }
      }

      async function runFirestoreHealthcheck(){
        if(!backendConnectionEnabled()){
          toast('Turn backend connection on first.');
          return false;
        }
        if(!firebaseRuntime.user || !firebaseDbRef){
          toast('Sign in first to run Firestore healthcheck.');
          return false;
        }
        try{
          const uid = String(firebaseRuntime.user.uid || 'unknown');
          const docRef = firebaseDbRef.collection('healthchecks').doc(uid);
          const nowIso = new Date().toISOString();
          await docRef.set({
            uid,
            email: String(firebaseRuntime.user.email || '').trim(),
            source: 'io-configurator-sandbox',
            checkedAt: nowIso
          }, { merge:true });
          const snap = await docRef.get();
          const exists = !!(snap && snap.exists);
          firebaseRuntime.lastHealthcheckAt = Date.now();
          firebaseRuntime.lastHealthcheckStatus = exists
            ? `Healthcheck: write/read OK (${nowIso})`
            : 'Healthcheck: write OK, read returned no document.';
          firebaseRuntime.lastError = '';
          renderFirebaseConnectionUi();
          toast('Firestore healthcheck passed.');
          return true;
        }catch(err){
          const message = firebaseErrorMessage(err, 'Firestore healthcheck failed.');
          firebaseRuntime.lastError = message;
          firebaseRuntime.lastHealthcheckStatus = `Healthcheck failed: ${message}`;
          renderFirebaseConnectionUi();
          toast(message);
          return false;
        }
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
        fieldMode: 'guided',

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
        dashboardSort: 'name-asc',
        dashboardDateMode: 'modified',
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
        emailBuilderOpen: false,
        emailBuilderThreadId: 'current',
        customerTemplateDraft: null,
        customerTemplateEditorOpen: false,
        customerTemplateEditorTarget: null,
        customerTemplateBuildTheatrePending: false,
        recommendationsThreadId: 'current',
        recommendationsReturnView: 'configurator',
        crmExportScope: 'active',
        crmExportRecordId: 'current',
        recordSeenVersions: Object.create(null),
        collaborationNoticeTitle: '',
        collaborationNoticeBody: '',
        collaborationNoticeTone: 'info',
        collaborationNoticeRecordId: '',
        collaborationNoticeUntil: 0,
        recordReadOnly: false,
        lockReacquirePending: false,

        // record persistence
        savedThreads: [],
        savedThreadsLoaded: false,
        savePulseUntil: 0,
        saveIsThinking: false,
        autoSaveDueAt: 0
      };
      const THREAD_STORAGE_KEY = 'immersive.launchpad.savedThreads.v1';
      const WORKSPACE_PROFILE_KEY = 'immersive.launchpad.workspaceProfile.v1';
      const ACCESS_REQUESTS_STORAGE_KEY = 'cfg_record_access_requests_v1';
      const BACKEND_CONNECTION_MODE_STORAGE_KEY = 'cfg_backend_connection_mode_v1';
      const FIREBASE_WEB_CONFIG_STORAGE_KEY = 'cfg_firebase_web_config_v1';
      const DEFAULT_WORKSPACE_ID = 'workspace-local';
      const RECORD_SCHEMA_VERSION = 'workspace-record.v2';
      const ROUTE_HASH_PREFIX = '#/';
      const AUTO_SAVE_FAST_MS = 30000;
      const AUTO_SAVE_BASE_MS = 60000;
      const MAX_IMPORT_CSV_BYTES = 5 * 1024 * 1024;
      const MAX_IMPORT_CSV_ROWS = 5000;
      const MAX_IMPORT_CSV_COLUMNS = 300;
      const MAX_IMPORT_CSV_CELL_CHARS = 20000;
      const DEFAULT_UNREAD_TEST_RECORD_COUNT = 2;
      const RECORD_LOCK_TTL_MS = 45000;
      const RECORD_LOCK_HEARTBEAT_MS = 15000;
      const LOCAL_TAB_SESSION_ID = (()=> {
        try{
          if(window.crypto && typeof window.crypto.randomUUID === 'function'){
            return window.crypto.randomUUID();
          }
        }catch(err){
          // Ignore and fallback.
        }
        return `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      })();
      let autoSaveTimerId = 0;
      let recordLockHeartbeatTimerId = 0;
      let routeSyncIsApplying = false;
      let routeSyncListenersBound = false;
      let firebaseAppRef = null;
      let firebaseAuthRef = null;
      let firebaseDbRef = null;
      let firebaseAuthUnsub = null;
      const firebaseRuntime = {
        connectionMode: 'off',
        configured: false,
        connected: false,
        source: 'none',
        user: null,
        lastError: '',
        lastHealthcheckAt: 0,
        lastHealthcheckStatus: ''
      };
      let shareModalRecordId = '';
      let archivePromptMode = 'archive';
      let archivePromptIds = [];
      const DASHBOARD_COL_STORAGE_KEY = 'cfg_dashboard_col_widths_v2';
      const DASHBOARD_SORT_STORAGE_KEY = 'cfg_dashboard_sort_v1';
      const DASHBOARD_DATE_MODE_STORAGE_KEY = 'cfg_dashboard_date_mode_v1';
      const DASHBOARD_SORT_MODES = Object.freeze(new Set([
        'name-asc',
        'name-desc',
        'completion-desc',
        'completion-asc',
        'tier-desc',
        'tier-asc',
        'outcomes-desc',
        'outcomes-asc',
        'gaps-desc',
        'gaps-asc',
        'created-desc',
        'created-asc',
        'modified-desc',
        'modified-asc',
        'status-asc',
        'status-desc'
      ]));
      const DASHBOARD_SORT_COLUMN_TO_MODES = Object.freeze({
        company: Object.freeze({ asc:'name-asc', desc:'name-desc' }),
        completion: Object.freeze({ asc:'completion-asc', desc:'completion-desc' }),
        tier: Object.freeze({ asc:'tier-asc', desc:'tier-desc' }),
        status: Object.freeze({ asc:'status-asc', desc:'status-desc' })
      });
      const DASHBOARD_SORT_MODE_TO_COLUMN = Object.freeze({
        'name-asc': Object.freeze({ column:'company', direction:'asc' }),
        'name-desc': Object.freeze({ column:'company', direction:'desc' }),
        'completion-asc': Object.freeze({ column:'completion', direction:'asc' }),
        'completion-desc': Object.freeze({ column:'completion', direction:'desc' }),
        'tier-asc': Object.freeze({ column:'tier', direction:'asc' }),
        'tier-desc': Object.freeze({ column:'tier', direction:'desc' }),
        'status-asc': Object.freeze({ column:'status', direction:'asc' }),
        'status-desc': Object.freeze({ column:'status', direction:'desc' })
      });
      const DASHBOARD_COLS = {
        company: { css:'--dash-col-company', min:12, max:34, fallback:17 },
        completion: { css:'--dash-col-completion', min:7, max:22, fallback:10 },
        tier: { css:'--dash-col-tier', min:5, max:12, fallback:6 },
        status: { css:'--dash-col-status', min:8, max:18, fallback:10 },
        outcomes: { css:'--dash-col-outcomes', min:14, max:42, fallback:25 },
        gaps: { css:'--dash-col-gaps', min:10, max:34, fallback:17 },
        actions: { css:'--dash-col-actions', min:8, max:20, fallback:11 }
      };
      const DASHBOARD_COL_RESIZE_ORDER = Object.freeze([
        'company',
        'completion',
        'tier',
        'status',
        'outcomes',
        'gaps',
        'actions'
      ]);
      let dashboardColWidths = Object.create(null);
      let dashboardColResizeSuppressUntil = 0;
      let dashboardColResizeActive = false;

      function dashboardInteractionsSuppressed(){
        return dashboardColResizeActive || Date.now() < dashboardColResizeSuppressUntil;
      }

      const recordStore = {
        list(){
          try{
            const raw = window.localStorage.getItem(THREAD_STORAGE_KEY);
            if(!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
          }catch(err){
            return [];
          }
        },
        get(recordId){
          const target = String(recordId || '').trim();
          if(!target) return null;
          const rows = this.list();
          return rows.find((row)=> {
            if(!row || typeof row !== 'object') return false;
            const id = String((row.recordId || row.id) || '').trim();
            return id === target;
          }) || null;
        },
        save(record){
          if(!record || typeof record !== 'object') return null;
          const rows = this.list();
          const incomingId = String((record.recordId || record.id) || '').trim();
          if(!incomingId) return null;
          const idx = rows.findIndex((row)=> {
            const id = String((row && (row.recordId || row.id)) || '').trim();
            return id === incomingId;
          });
          if(idx >= 0){
            rows[idx] = record;
          }else{
            rows.unshift(record);
          }
          this.saveAll(rows);
          return record;
        },
        saveAll(rows){
          try{
            const safeRows = Array.isArray(rows) ? rows : [];
            window.localStorage.setItem(THREAD_STORAGE_KEY, JSON.stringify(safeRows));
          }catch(err){
            // Ignore storage failures.
          }
        }
      };

      function activeCollaboratorIdentity(){
        const account = (typeof settingsState !== 'undefined' && settingsState && settingsState.account)
          ? settingsState.account
          : {};
        const rawName = String(
          account.fullName
          || state.fullName
          || ''
        ).trim();
        const email = String(
          account.email
          || state.email
          || ''
        ).trim().toLowerCase();
        const fallbackName = rawName || (email ? email : 'Local collaborator');
        const workspaceRole = resolveCollaboratorRole(account.workspaceRole, 'owner');
        const permissionTestMode = resolvePermissionTestMode(account.permissionTestMode);
        const firebaseUser = backendConnectionEnabled() && firebaseRuntime && firebaseRuntime.user
          ? firebaseRuntime.user
          : null;
        const firebaseUid = String((firebaseUser && firebaseUser.uid) || '').trim();
        if(firebaseUid){
          const firebaseEmail = String((firebaseUser && firebaseUser.email) || '').trim().toLowerCase();
          const firebaseName = String((firebaseUser && firebaseUser.displayName) || '').trim();
          const displayName = firebaseName || rawName || firebaseEmail || 'Authenticated user';
          return {
            userId: `uid:${firebaseUid}`,
            email: firebaseEmail,
            displayName,
            sessionId: LOCAL_TAB_SESSION_ID,
            workspaceRole,
            // Force test role overrides off for authenticated backend sessions.
            permissionTestMode: 'live'
          };
        }
        const userId = email
          ? `email:${email}`
          : `name:${fallbackName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'local-collaborator'}`;
        return {
          userId,
          email,
          displayName: fallbackName,
          sessionId: LOCAL_TAB_SESSION_ID,
          workspaceRole,
          permissionTestMode
        };
      }

      function setCollaborationNotice(tone, title, body, recordId, durationMs){
        state.collaborationNoticeTone = (tone === 'warning' || tone === 'success') ? tone : 'info';
        state.collaborationNoticeTitle = String(title || '').trim();
        state.collaborationNoticeBody = String(body || '').trim();
        state.collaborationNoticeRecordId = String(recordId || '').trim();
        state.collaborationNoticeUntil = Date.now() + Math.max(1200, Number(durationMs) || 0);
      }

      const COLLABORATOR_COLOR_POOL = Object.freeze([
        '#1a73e8',
        '#188038',
        '#d93025',
        '#f9ab00',
        '#9334e6',
        '#00796b',
        '#ad1457',
        '#5f6368'
      ]);
      const COLLAB_ROLE_ORDER = Object.freeze({
        viewer: 0,
        sdr: 1,
        editor: 2,
        owner: 3,
        admin: 4
      });
      const COLLAB_ROLE_LABELS = Object.freeze({
        admin: 'Admin',
        owner: 'Owner',
        editor: 'Editor',
        sdr: 'SDR',
        viewer: 'Viewer'
      });
      const WORKSPACE_OWNER_FALLBACK = Object.freeze({
        userId: 'system:workspace-owner',
        name: 'Workspace Owner',
        email: 'workspace.owner@immersive.local',
        role: 'owner'
      });
      const PERMISSION_TEST_MODES = Object.freeze(new Set([
        'live',
        'force-admin',
        'force-owner',
        'force-editor',
        'force-sdr',
        'force-viewer'
      ]));
      function permissionTestOverridesEnabled(){
        return true;
      }
      const COLLAB_PERMISSION_MATRIX = Object.freeze({
        admin: Object.freeze({
          canViewRecord: true,
          canEditRecord: true,
          canAddCollaborators: true,
          canRemoveCollaborators: true,
          canSetCollaboratorRole: true,
          canSetGeneralAccess: true,
          canManageWorkspaceUsers: true,
          assignableRoles: Object.freeze(['admin', 'owner', 'editor', 'sdr', 'viewer'])
        }),
        owner: Object.freeze({
          canViewRecord: true,
          canEditRecord: true,
          canAddCollaborators: true,
          canRemoveCollaborators: true,
          canSetCollaboratorRole: true,
          canSetGeneralAccess: true,
          canManageWorkspaceUsers: false,
          assignableRoles: Object.freeze(['owner', 'editor', 'sdr', 'viewer'])
        }),
        editor: Object.freeze({
          canViewRecord: true,
          canEditRecord: true,
          canAddCollaborators: true,
          canRemoveCollaborators: false,
          canSetCollaboratorRole: false,
          canSetGeneralAccess: false,
          canManageWorkspaceUsers: false,
          assignableRoles: Object.freeze(['viewer'])
        }),
        sdr: Object.freeze({
          canViewRecord: true,
          canEditRecord: true,
          canAddCollaborators: true,
          canRemoveCollaborators: false,
          canSetCollaboratorRole: false,
          canSetGeneralAccess: false,
          canManageWorkspaceUsers: false,
          assignableRoles: Object.freeze(['viewer'])
        }),
        viewer: Object.freeze({
          canViewRecord: true,
          canEditRecord: false,
          canAddCollaborators: true,
          canRemoveCollaborators: false,
          canSetCollaboratorRole: false,
          canSetGeneralAccess: false,
          canManageWorkspaceUsers: false,
          assignableRoles: Object.freeze(['viewer'])
        })
      });

      function resolveCollaboratorRole(value, fallback){
        const raw = String(value || '').trim().toLowerCase();
        if(raw === 'admin') return 'admin';
        if(raw === 'owner') return 'owner';
        if(raw === 'editor' || raw === 'collaborator') return 'editor';
        if(raw === 'sdr') return 'sdr';
        if(raw === 'viewer') return 'viewer';
        return resolveCollaboratorRole(fallback || 'editor', 'editor');
      }

      function collaborationRoleLabel(role){
        const resolved = resolveCollaboratorRole(role, 'viewer');
        return COLLAB_ROLE_LABELS[resolved] || 'Viewer';
      }

      function resolvePermissionTestMode(value){
        const raw = String(value || '').trim().toLowerCase();
        if(raw === 'live') return 'live';
        if(!permissionTestOverridesEnabled()) return 'live';
        return PERMISSION_TEST_MODES.has(raw) ? raw : 'live';
      }

      function forcedRoleFromTestMode(mode){
        if(backendConnectionEnabled()){
          return '';
        }
        const resolved = resolvePermissionTestMode(mode);
        if(!resolved.startsWith('force-')) return '';
        return resolveCollaboratorRole(resolved.slice(6), '');
      }

      function collaborationRoleRank(role){
        return Number(COLLAB_ROLE_ORDER[resolveCollaboratorRole(role, 'viewer')]) || 0;
      }

      function roleAtLeast(role, minimumRole){
        return collaborationRoleRank(role) >= collaborationRoleRank(minimumRole);
      }

      function normalizeEmail(value){
        return String(value || '').trim().toLowerCase();
      }

      function collaboratorInitials(nameOrEmail){
        const source = String(nameOrEmail || '').trim();
        if(!source) return '??';
        const emailLocal = source.includes('@') ? source.split('@')[0] : source;
        const parts = emailLocal
          .replace(/[_\.]+/g, ' ')
          .replace(/[^a-z0-9 ]/gi, ' ')
          .trim()
          .split(/\s+/)
          .filter(Boolean);
        if(!parts.length){
          return source.slice(0, 2).toUpperCase();
        }
        if(parts.length === 1){
          return parts[0].slice(0, 2).toUpperCase();
        }
        return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
      }

      function collaboratorColor(seed){
        const token = String(seed || '').trim().toLowerCase();
        if(!token) return COLLABORATOR_COLOR_POOL[0];
        let hash = 0;
        for(let i = 0; i < token.length; i += 1){
          hash = ((hash << 5) - hash) + token.charCodeAt(i);
          hash |= 0;
        }
        const idx = Math.abs(hash) % COLLABORATOR_COLOR_POOL.length;
        return COLLABORATOR_COLOR_POOL[idx];
      }

      function sanitizeCollaboratorColor(raw, fallbackSeed){
        const value = String(raw || '').trim();
        if(!value) return collaboratorColor(fallbackSeed);
        const hex = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
        const rgb = /^rgba?\(\s*(?:\d{1,3}\s*,\s*){2}\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i.test(value);
        const hsl = /^hsla?\(\s*\d{1,3}(?:\.\d+)?\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i.test(value);
        return (hex || rgb || hsl) ? value : collaboratorColor(fallbackSeed);
      }

      function normalizeCollaboratorEntry(raw, idx){
        const source = (raw && typeof raw === 'object') ? raw : {};
        const email = normalizeEmail(source.email);
        const userIdFromName = `name:${String(source.name || source.displayName || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `collaborator-${idx + 1}`}`;
        const userId = String(source.userId || (email ? `email:${email}` : userIdFromName)).trim();
        const name = String(source.name || source.displayName || email || userId || `Collaborator ${idx + 1}`).trim();
        const colorSeed = userId || email || name;
        return {
          userId,
          name: name || `Collaborator ${idx + 1}`,
          email,
          role: resolveCollaboratorRole(source.role, idx === 0 ? 'owner' : 'editor'),
          color: sanitizeCollaboratorColor(source.color, colorSeed),
          initials: collaboratorInitials(name || email)
        };
      }

      function ensureCollaboratorOwner(rows){
        const list = Array.isArray(rows) ? rows.slice() : [];
        if(!list.length) return list;
        const hasPrivileged = list.some((row)=> {
          const role = resolveCollaboratorRole(row && row.role, 'viewer');
          return role === 'owner' || role === 'admin';
        });
        if(hasPrivileged) return list;
        list[0] = Object.assign({}, list[0], { role:'owner' });
        return list;
      }

      function normalizeCollaboratorList(raw){
        const rows = Array.isArray(raw) ? raw : [];
        const out = [];
        const seen = new Set();
        rows.forEach((row, idx)=>{
          const normalized = normalizeCollaboratorEntry(row, idx);
          const key = String(normalized.userId || normalized.email || normalized.name).trim().toLowerCase();
          if(!key || seen.has(key)) return;
          seen.add(key);
          out.push(normalized);
        });
        return ensureCollaboratorOwner(out);
      }

      function collaboratorsWithActor(collaborators, actor, opts){
        const cfg = Object.assign({ desiredRole:'editor', promote:false }, opts || {});
        const base = normalizeCollaboratorList(collaborators);
        const next = base.slice();
        const actorEmail = normalizeEmail(actor && actor.email);
        const actorId = String((actor && actor.userId) || '').trim();
        const actorName = String((actor && actor.displayName) || actorEmail || 'Local collaborator').trim();
        const desiredRole = resolveCollaboratorRole(cfg.desiredRole, 'editor');
        const actorEntry = normalizeCollaboratorEntry({
          userId: actorId || (actorEmail ? `email:${actorEmail}` : ''),
          email: actorEmail,
          name: actorName,
          role: desiredRole
        }, next.length);
        const matchIdx = next.findIndex((row)=> {
          if(!row) return false;
          if(actorId && String(row.userId || '').trim() === actorId) return true;
          if(actorEmail && normalizeEmail(row.email) === actorEmail) return true;
          return false;
        });
        if(matchIdx >= 0){
          const currentRole = resolveCollaboratorRole(next[matchIdx].role, 'viewer');
          const role = cfg.promote ? (roleAtLeast(currentRole, desiredRole) ? currentRole : desiredRole) : currentRole;
          next[matchIdx] = Object.assign({}, next[matchIdx], actorEntry, { role });
        }else{
          next.push(actorEntry);
        }
        return normalizeCollaboratorList(next);
      }

      function threadCollaborators(thread){
        const source = (thread && typeof thread === 'object') ? thread : {};
        let rows = normalizeCollaboratorList(source.collaborators);
        if(!rows.length){
          const fallback = [];
          const updatedByName = String(source.updatedBy || '').trim();
          const updatedByEmail = normalizeEmail(source.updatedByEmail);
          if(updatedByName || updatedByEmail){
            fallback.push({
              userId: String(source.updatedById || (updatedByEmail ? `email:${updatedByEmail}` : '')).trim(),
              name: updatedByName || updatedByEmail,
              email: updatedByEmail
            });
          }
          rows = normalizeCollaboratorList(fallback);
        }
        return rows;
      }

      function collaboratorStackRows(thread, opts){
        const cfg = Object.assign({ includeActor:true }, opts || {});
        const actor = cfg.actor || activeCollaboratorIdentity();
        const baseRows = threadCollaborators(thread);
        let rows = baseRows.slice();
        let actorInjected = false;

        if(cfg.includeActor && actor){
          const perms = actorPermissionsForThread(thread, { actor });
          if(perms.canViewRecord){
            const actorIdx = rows.findIndex((row)=> collaboratorMatchesActor(row, actor));
            if(actorIdx < 0){
              const actorEmail = normalizeEmail(actor.email);
              const actorId = String(actor.userId || (actorEmail ? `email:${actorEmail}` : '')).trim();
              const actorName = String(actor.displayName || actorEmail || actorId || 'You').trim();
              const actorRole = effectiveActorRoleForThread(thread, { actor });
              const actorRow = normalizeCollaboratorEntry({
                userId: actorId,
                email: actorEmail,
                name: actorName,
                role: actorRole
              }, rows.length);
              rows.unshift(Object.assign({}, actorRow, { _inferredActor:true }));
              actorInjected = true;
            }else if(actorIdx > 0){
              const [actorRow] = rows.splice(actorIdx, 1);
              rows.unshift(actorRow);
            }
          }
        }

        return { rows, actor, actorInjected };
      }

      function collaboratorStackHtml(thread, opts){
        const cfg = Object.assign({ maxVisible:3, size:'sm', showSingle:false }, opts || {});
        const stack = collaboratorStackRows(thread, cfg);
        const rows = stack.rows;
        if(!rows.length) return '';
        if(!cfg.showSingle && rows.length < 2) return '';
        const visible = rows.slice(0, Math.max(1, Number(cfg.maxVisible) || 3));
        const remaining = Math.max(0, rows.length - visible.length);
        const lockOwner = threadLockOwner(thread);
        const lockActive = !!(lockOwner && Number(thread && thread.lockExpiresAt) > Date.now());
        const lockOwnerId = String(lockOwner && lockOwner.userId || '').trim();
        const lockOwnerName = String(lockOwner && lockOwner.name || '').trim().toLowerCase();
        const itemHtml = visible.map((row)=> {
          const key = String(row.userId || row.email || row.name || '').trim();
          const isActor = stack.actor && collaboratorMatchesActor(row, stack.actor);
          const rowName = String(row.name || '').trim();
          const isLockedOwner = lockActive && (
            (lockOwnerId && key && key === lockOwnerId)
            || (!lockOwnerId && lockOwnerName && String(row.name || '').trim().toLowerCase() === lockOwnerName)
          );
          const titleParts = [];
          if(isActor){
            titleParts.push('You');
            if(stack.actorInjected && row._inferredActor) titleParts.push('workspace access');
          }
          if(rowName) titleParts.push(rowName);
          if(row.email) titleParts.push(row.email);
          if(isLockedOwner) titleParts.push('editing now');
          return `<span class="collabAvatar" style="background:${escapeHtml(row.color)};" title="${escapeHtml(titleParts.filter(Boolean).join(' · '))}" data-locked="${isLockedOwner ? 'true' : 'false'}">${escapeHtml(row.initials)}</span>`;
        }).join('');
        const moreHtml = remaining > 0
          ? `<span class="collabAvatar collabAvatarMore" title="${remaining} more collaborator${remaining === 1 ? '' : 's'}">+${remaining}</span>`
          : '';
        return `<span class="collabAvatarStack collabAvatarStack--${escapeHtml(cfg.size)}">${itemHtml}${moreHtml}</span>`;
      }

      function resolveShareAccess(value){
        const raw = String(value || '').trim().toLowerCase();
        if(raw === 'workspace-editor') return 'workspace-editor';
        if(raw === 'restricted') return 'restricted';
        return 'workspace-viewer';
      }

      function collaboratorMatchesActor(row, actor){
        if(!row || !actor) return false;
        const actorId = String(actor.userId || '').trim();
        const actorEmail = normalizeEmail(actor.email);
        const rowId = String(row.userId || '').trim();
        const rowEmail = normalizeEmail(row.email);
        if(actorId && rowId && actorId === rowId) return true;
        if(actorEmail && rowEmail && actorEmail === rowEmail) return true;
        return false;
      }

      function roleMixTargets(total){
        const count = Math.max(0, Math.floor(Number(total) || 0));
        if(count <= 0) return { owner:0, editor:0, viewer:0 };
        if(count === 1) return { owner:1, editor:0, viewer:0 };
        if(count === 2) return { owner:1, editor:0, viewer:1 };
        if(count === 3) return { owner:2, editor:0, viewer:1 };

        const editor = count >= 6 ? 2 : 1;
        let owner = Math.max(2, Math.floor(count * 0.6));
        if(owner + editor > count - 1){
          owner = Math.max(1, count - editor - 1);
        }
        const viewer = Math.max(0, count - owner - editor);
        return { owner, editor, viewer };
      }

      function applyActorRoleToCollaborators(collaborators, actor, desiredRole){
        const normalized = normalizeCollaboratorList(collaborators);
        const actorId = String((actor && actor.userId) || '').trim();
        const actorEmail = normalizeEmail(actor && actor.email);
        const actorName = String((actor && actor.displayName) || actorEmail || 'Local collaborator').trim();
        const role = resolveCollaboratorRole(desiredRole, 'viewer');

        let next = normalized.slice();
        if(role !== 'owner' && role !== 'admin'){
          const hasOtherPrivileged = next.some((row)=> {
            if(collaboratorMatchesActor(row, actor)) return false;
            const rowRole = resolveCollaboratorRole(row && row.role, 'viewer');
            return rowRole === 'owner' || rowRole === 'admin';
          });
          if(!hasOtherPrivileged){
            next.unshift(normalizeCollaboratorEntry(WORKSPACE_OWNER_FALLBACK, next.length));
          }
        }

        const actorEntry = normalizeCollaboratorEntry({
          userId: actorId || (actorEmail ? `email:${actorEmail}` : ''),
          email: actorEmail,
          name: actorName,
          role
        }, next.length);
        const actorIdx = next.findIndex((row)=> collaboratorMatchesActor(row, actor));
        if(actorIdx >= 0){
          next[actorIdx] = Object.assign({}, next[actorIdx], actorEntry, { role });
        }else{
          next.push(actorEntry);
        }
        return normalizeCollaboratorList(next);
      }

      function applyDefaultActorRoleMix(rows, opts){
        const cfg = Object.assign({ force:false }, opts || {});
        const list = Array.isArray(rows) ? rows : [];
        const activeRows = list.filter((thread)=> thread && !thread.archived);
        if(!activeRows.length) return false;
        const actor = Object.assign({}, activeCollaboratorIdentity(), { permissionTestMode:'live' });

        const currentCounts = activeRows.reduce((acc, thread)=> {
          const role = effectiveActorRoleForThread(thread, { actor });
          if(role === 'owner' || role === 'admin') acc.owner += 1;
          else if(role === 'editor') acc.editor += 1;
          else acc.viewer += 1;
          return acc;
        }, { owner:0, editor:0, viewer:0 });

        const alreadyMixed = (
          currentCounts.owner > currentCounts.viewer
          && currentCounts.owner > currentCounts.editor
          && currentCounts.editor >= 1
          && currentCounts.viewer >= 1
        );
        if(!cfg.force && alreadyMixed) return false;

        const targets = roleMixTargets(activeRows.length);
        const ordered = activeRows.slice().sort((left, right)=> {
          const byUpdated = Number(right && right.updatedAt || 0) - Number(left && left.updatedAt || 0);
          if(byUpdated) return byUpdated;
          return String((left && left.id) || '').localeCompare(String((right && right.id) || ''));
        });

        let changed = false;
        ordered.forEach((thread, idx)=> {
          let desired = 'viewer';
          if(idx < targets.owner){
            desired = 'owner';
          }else if(idx < (targets.owner + targets.editor)){
            desired = 'editor';
          }
          const before = normalizeCollaboratorList(thread.collaborators);
          const next = applyActorRoleToCollaborators(before, actor, desired);
          if(JSON.stringify(before) !== JSON.stringify(next)){
            thread.collaborators = next;
            changed = true;
          }
        });
        return changed;
      }

      function actorWorkspaceRole(){
        const account = (typeof settingsState !== 'undefined' && settingsState && settingsState.account)
          ? settingsState.account
          : {};
        return resolveCollaboratorRole(account.workspaceRole, 'owner');
      }

      function actorPermissionTestMode(){
        const account = (typeof settingsState !== 'undefined' && settingsState && settingsState.account)
          ? settingsState.account
          : {};
        return resolvePermissionTestMode(account.permissionTestMode);
      }

      function effectiveActorRoleForThread(thread, opts){
        const cfg = opts || {};
        const actor = cfg.actor || activeCollaboratorIdentity();
        const forced = forcedRoleFromTestMode(actor.permissionTestMode || actorPermissionTestMode());
        if(forced) return forced;

        const workspaceRole = resolveCollaboratorRole(actor.workspaceRole || actorWorkspaceRole(), 'owner');
        if(workspaceRole === 'admin') return 'admin';
        const sourceThread = (thread && typeof thread === 'object') ? thread : null;
        if(!sourceThread) return workspaceRole;

        const rows = threadCollaborators(sourceThread);
        const membership = rows.find((row)=> collaboratorMatchesActor(row, actor));
        if(membership){
          return resolveCollaboratorRole(membership.role, 'viewer');
        }

        const threadUpdatedById = String(sourceThread.updatedById || '').trim();
        const actorId = String(actor.userId || '').trim();
        if(threadUpdatedById && actorId && threadUpdatedById === actorId){
          return 'owner';
        }

        const shareAccess = resolveShareAccess(sourceThread.shareAccess);
        if(shareAccess === 'workspace-editor' && workspaceRole !== 'viewer'){
          return 'editor';
        }
        if(shareAccess === 'restricted'){
          return 'viewer';
        }
        if(shareAccess === 'workspace-viewer'){
          return 'viewer';
        }
        return resolveCollaboratorRole(workspaceRole, 'viewer');
      }

      function actorPermissionsForThread(thread, opts){
        const role = effectiveActorRoleForThread(thread, opts);
        const template = COLLAB_PERMISSION_MATRIX[role] || COLLAB_PERMISSION_MATRIX.viewer;
        return {
          role,
          roleLabel: collaborationRoleLabel(role),
          canViewRecord: !!template.canViewRecord,
          canEditRecord: !!template.canEditRecord,
          canAddCollaborators: !!template.canAddCollaborators,
          canRemoveCollaborators: !!template.canRemoveCollaborators,
          canSetCollaboratorRole: !!template.canSetCollaboratorRole,
          canSetGeneralAccess: !!template.canSetGeneralAccess,
          canManageWorkspaceUsers: !!template.canManageWorkspaceUsers,
          assignableRoles: Array.from(template.assignableRoles || ['viewer']),
          canShareRecord: true
        };
      }

      function canActorEditThread(thread, opts){
        return !!actorPermissionsForThread(thread, opts).canEditRecord;
      }

      function activeRecordPermissionSnapshot(){
        const thread = activeCollaborationThreadModel();
        return actorPermissionsForThread(thread);
      }

      function currentEditableRecordId(){
        if((state.currentView || '') !== 'configurator') return '';
        const id = String(state.activeThread || '').trim();
        if(!id || id === 'current') return '';
        return id;
      }

      function syncSavedThreadInMemory(thread){
        if(!thread || typeof thread !== 'object') return;
        ensureSavedThreadsLoaded();
        const idx = (state.savedThreads || []).findIndex((row)=> row && row.id === thread.id);
        if(idx >= 0){
          state.savedThreads[idx] = thread;
        }else{
          state.savedThreads.unshift(thread);
        }
      }

      function actorOwnsLock(owner, actor){
        if(!owner || !actor) return false;
        const actorId = String(actor.userId || '').trim();
        const ownerId = String(owner.userId || '').trim();
        const ownerSessionId = String(owner.sessionId || '').trim();
        if(ownerSessionId && ownerSessionId === LOCAL_TAB_SESSION_ID) return true;
        if(ownerId && actorId && ownerId === actorId) return true;
        return false;
      }

      function clearRecordLockHeartbeat(){
        if(recordLockHeartbeatTimerId){
          window.clearInterval(recordLockHeartbeatTimerId);
          recordLockHeartbeatTimerId = 0;
        }
      }

      function acquireRecordLock(recordId, opts){
        const cfg = Object.assign({ quiet:false }, opts || {});
        const targetId = String(recordId || '').trim();
        if(!targetId || targetId === 'current'){
          return { ok:false, reason:'draft' };
        }

        const actor = activeCollaboratorIdentity();
        const storedRaw = recordStore.get(targetId);
        const latest = storedRaw ? normalizeThreadModel(storedRaw, 0) : findSavedThread(targetId);
        if(!latest){
          return { ok:false, reason:'missing' };
        }

        const owner = threadLockOwner(latest);
        const lockExpiresAt = Number(latest.lockExpiresAt) || 0;
        const lockActive = !!(owner && lockExpiresAt > Date.now());
        if(lockActive && !actorOwnsLock(owner, actor)){
          syncSavedThreadInMemory(latest);
          state.lockReacquirePending = true;
          if(!cfg.quiet){
            setCollaborationNotice(
              'warning',
              'Read-only mode',
              `${owner.name} is editing this record. You can edit after they save.`,
              targetId,
              14000
            );
          }
          return { ok:false, reason:'held', thread:latest, holder:owner };
        }

        const nextThread = normalizeThreadModel(Object.assign({}, latest, {
          lockOwner: {
            userId: actor.userId,
            name: actor.displayName,
            email: actor.email,
            sessionId: actor.sessionId
          },
          lockExpiresAt: Date.now() + RECORD_LOCK_TTL_MS
        }), 0);

        recordStore.save(nextThread);
        syncSavedThreadInMemory(nextThread);
        state.lockReacquirePending = false;
        return { ok:true, reason:'acquired', thread:nextThread };
      }

      function renewRecordLock(recordId, opts){
        const cfg = Object.assign({ quiet:true }, opts || {});
        const targetId = String(recordId || '').trim();
        if(!targetId || targetId === 'current') return false;

        const actor = activeCollaboratorIdentity();
        const storedRaw = recordStore.get(targetId);
        const latest = storedRaw ? normalizeThreadModel(storedRaw, 0) : findSavedThread(targetId);
        if(!latest) return false;

        const owner = threadLockOwner(latest);
        const lockExpiresAt = Number(latest.lockExpiresAt) || 0;
        const lockActive = !!(owner && lockExpiresAt > Date.now());
        if(lockActive && !actorOwnsLock(owner, actor)){
          syncSavedThreadInMemory(latest);
          state.lockReacquirePending = true;
          if(!cfg.quiet){
            setCollaborationNotice(
              'warning',
              'Read-only mode',
              `${owner.name} is editing this record. You can edit after they save.`,
              targetId,
              12000
            );
          }
          return false;
        }

        const nextThread = normalizeThreadModel(Object.assign({}, latest, {
          lockOwner: {
            userId: actor.userId,
            name: actor.displayName,
            email: actor.email,
            sessionId: actor.sessionId
          },
          lockExpiresAt: Date.now() + RECORD_LOCK_TTL_MS
        }), 0);

        recordStore.save(nextThread);
        syncSavedThreadInMemory(nextThread);
        return true;
      }

      function releaseRecordLock(recordId, opts){
        const cfg = Object.assign({ force:false }, opts || {});
        const targetId = String(recordId || '').trim();
        if(!targetId || targetId === 'current') return false;

        const actor = activeCollaboratorIdentity();
        const storedRaw = recordStore.get(targetId);
        const latest = storedRaw ? normalizeThreadModel(storedRaw, 0) : findSavedThread(targetId);
        if(!latest) return false;

        const owner = threadLockOwner(latest);
        const lockExpiresAt = Number(latest.lockExpiresAt) || 0;
        const lockPresent = !!(owner || lockExpiresAt > 0);
        if(!lockPresent) return false;
        if(owner && !cfg.force && !actorOwnsLock(owner, actor)){
          return false;
        }

        const nextThread = normalizeThreadModel(Object.assign({}, latest, {
          lockOwner: null,
          lockExpiresAt: 0
        }), 0);

        recordStore.save(nextThread);
        syncSavedThreadInMemory(nextThread);
        return true;
      }

      function ensureRecordLockHeartbeat(){
        const targetId = currentEditableRecordId();
        if(!targetId || state.recordReadOnly || state.lockReacquirePending){
          clearRecordLockHeartbeat();
          return;
        }
        const thread = findSavedThread(targetId);
        if(thread && !canActorEditThread(thread)){
          clearRecordLockHeartbeat();
          return;
        }

        const renewed = renewRecordLock(targetId, { quiet:true });
        if(!renewed){
          clearRecordLockHeartbeat();
          return;
        }

        if(recordLockHeartbeatTimerId) return;
        recordLockHeartbeatTimerId = window.setInterval(()=>{
          const activeId = currentEditableRecordId();
          if(!activeId || state.recordReadOnly || state.lockReacquirePending){
            clearRecordLockHeartbeat();
            return;
          }
          const activeThread = findSavedThread(activeId);
          if(activeThread && !canActorEditThread(activeThread)){
            clearRecordLockHeartbeat();
            return;
          }
          const ok = renewRecordLock(activeId, { quiet:true });
          if(!ok){
            clearRecordLockHeartbeat();
            update();
          }
        }, RECORD_LOCK_HEARTBEAT_MS);
      }

      function attemptPendingRecordLock(opts){
        const cfg = Object.assign({ showNotice:false, render:false }, opts || {});
        if(!state.lockReacquirePending || state.recordReadOnly) return false;
        const targetId = currentEditableRecordId();
        if(!targetId) return false;
        const thread = findSavedThread(targetId);
        if(thread && !canActorEditThread(thread)){
          state.lockReacquirePending = false;
          clearRecordLockHeartbeat();
          return false;
        }
        const acquired = acquireRecordLock(targetId, { quiet:true });
        if(!acquired.ok) return false;

        ensureRecordLockHeartbeat();
        if(cfg.showNotice){
          setCollaborationNotice(
            'info',
            'Editing lock active',
            'You can now edit this shared record.',
            targetId,
            5000
          );
        }
        if(cfg.render){
          update();
        }
        return true;
      }

      function sanitizeDashboardSortMode(raw){
        const value = String(raw || '').trim().toLowerCase();
        if(DASHBOARD_SORT_MODES.has(value)) return value;
        return 'name-asc';
      }

      function loadDashboardSortMode(){
        try{
          const stored = window.localStorage.getItem(DASHBOARD_SORT_STORAGE_KEY);
          const sanitized = sanitizeDashboardSortMode(stored);
          return sanitized;
        }catch(err){
          return 'name-asc';
        }
      }

      function persistDashboardSortMode(){
        try{
          window.localStorage.setItem(DASHBOARD_SORT_STORAGE_KEY, sanitizeDashboardSortMode(state.dashboardSort));
        }catch(err){
          // ignore storage failures
        }
      }
      state.dashboardSort = loadDashboardSortMode();

      function sanitizeDashboardDateMode(raw){
        const value = String(raw || '').trim().toLowerCase();
        return value === 'created' ? 'created' : 'modified';
      }

      function loadDashboardDateMode(){
        try{
          const stored = window.localStorage.getItem(DASHBOARD_DATE_MODE_STORAGE_KEY);
          return sanitizeDashboardDateMode(stored);
        }catch(err){
          return 'modified';
        }
      }

      function persistDashboardDateMode(){
        try{
          window.localStorage.setItem(DASHBOARD_DATE_MODE_STORAGE_KEY, sanitizeDashboardDateMode(state.dashboardDateMode));
        }catch(err){
          // ignore storage failures
        }
      }
      state.dashboardDateMode = loadDashboardDateMode();

      function dashboardSortDescriptor(mode){
        const normalized = sanitizeDashboardSortMode(mode || state.dashboardSort);
        return DASHBOARD_SORT_MODE_TO_COLUMN[normalized] || null;
      }

      function dashboardSortNextModeForColumn(column){
        const key = String(column || '').trim().toLowerCase();
        const pair = DASHBOARD_SORT_COLUMN_TO_MODES[key];
        if(!pair) return sanitizeDashboardSortMode(state.dashboardSort);
        const current = dashboardSortDescriptor(state.dashboardSort);
        if(current && current.column === key){
          return current.direction === 'asc' ? pair.desc : pair.asc;
        }
        return pair.asc;
      }

      function updateDashboardSortControls(){
        const normalizedMode = sanitizeDashboardSortMode(state.dashboardSort);
        if(normalizedMode !== state.dashboardSort){
          state.dashboardSort = normalizedMode;
          persistDashboardSortMode();
        }
        const active = dashboardSortDescriptor(normalizedMode);
        $$('[data-dash-sort]').forEach((btn)=>{
          const column = String(btn.getAttribute('data-dash-sort') || '').trim().toLowerCase();
          const isActive = !!active && active.column === column;
          const direction = isActive ? active.direction : 'asc';
          const nextDir = (isActive && direction === 'asc') ? 'descending' : 'ascending';
          const label = String(btn.getAttribute('data-dash-sort-label') || btn.textContent || column || 'column').trim();
          btn.dataset.active = isActive ? 'true' : 'false';
          btn.dataset.direction = direction;
          btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
          btn.setAttribute('aria-label', `Sort by ${label} (${nextDir})`);
          const th = btn.closest('th');
          if(th){
            th.setAttribute('aria-sort', isActive ? (direction === 'asc' ? 'ascending' : 'descending') : 'none');
          }
        });
      }

      function updateDashboardDateControls(){
        const mode = sanitizeDashboardDateMode(state.dashboardDateMode);
        if(mode !== state.dashboardDateMode){
          state.dashboardDateMode = mode;
          persistDashboardDateMode();
        }
        const sortMode = sanitizeDashboardSortMode(state.dashboardSort);
        const isModified = mode === 'modified';
        const label = isModified ? 'Date modified' : 'Date created';
        const nextLabel = isModified ? 'Date created' : 'Date modified';
        const isDateSort = sortMode === `${mode}-asc` || sortMode === `${mode}-desc`;
        const direction = (sortMode === `${mode}-asc`) ? 'asc' : 'desc';
        $$('[data-dashboard-date-toggle]').forEach((btn)=>{
          const labelEl = btn.querySelector('.dashDateToggleLabel');
          if(labelEl) labelEl.textContent = label;
          else btn.textContent = label;
          btn.setAttribute('title', `Click to switch to ${nextLabel}`);
          btn.setAttribute('aria-label', `${label}. Click to switch to ${nextLabel}.`);
        });
        $$('[data-dashboard-date-sort]').forEach((btn)=>{
          const nextDir = direction === 'asc' ? 'descending' : 'ascending';
          btn.dataset.direction = direction;
          btn.dataset.active = isDateSort ? 'true' : 'false';
          btn.setAttribute('title', `Sort ${label} ${nextDir}`);
          btn.setAttribute('aria-label', `Sort ${label} ${nextDir}`);
          const th = btn.closest('th');
          if(th){
            th.setAttribute('aria-sort', isDateSort ? (direction === 'asc' ? 'ascending' : 'descending') : 'none');
          }
        });
      }

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

      function dashboardResizePartnerKey(key){
        const normalizedKey = String(key || '').trim().toLowerCase();
        const idx = DASHBOARD_COL_RESIZE_ORDER.indexOf(normalizedKey);
        if(idx < 0) return '';
        const next = DASHBOARD_COL_RESIZE_ORDER[idx + 1];
        if(next && DASHBOARD_COLS[next]) return next;
        const prev = DASHBOARD_COL_RESIZE_ORDER[idx - 1];
        return (prev && DASHBOARD_COLS[prev]) ? prev : '';
      }

      function dashboardResizeDeltaBounds(primaryKey, partnerKey, startPrimary, startPartner){
        const primaryCfg = DASHBOARD_COLS[primaryKey];
        if(!primaryCfg){
          return { min:0, max:0 };
        }
        let minDelta = primaryCfg.min - startPrimary;
        let maxDelta = primaryCfg.max - startPrimary;
        const partnerCfg = DASHBOARD_COLS[partnerKey];
        if(partnerCfg){
          // partner width = startPartner - delta
          minDelta = Math.max(minDelta, startPartner - partnerCfg.max);
          maxDelta = Math.min(maxDelta, startPartner - partnerCfg.min);
        }
        if(minDelta > maxDelta){
          return { min:0, max:0 };
        }
        return { min:minDelta, max:maxDelta };
      }

      function applyDashboardResizeDelta(primaryKey, startPrimary, rawDelta, partnerKey, startPartner, opts){
        const cfg = DASHBOARD_COLS[primaryKey];
        const partnerCfg = DASHBOARD_COLS[partnerKey];
        if(!cfg) return 0;
        const bounds = dashboardResizeDeltaBounds(primaryKey, partnerKey, startPrimary, startPartner);
        const delta = clamp(Number(rawDelta) || 0, bounds.min, bounds.max);
        setDashboardColWidth(primaryKey, startPrimary + delta, { persist:false });
        if(partnerCfg){
          setDashboardColWidth(partnerKey, startPartner - delta, { persist:false });
        }
        if(!opts || opts.persist !== false){
          persistDashboardColWidths();
        }
        return delta;
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
          applyDashboardResizeDelta(
            drag.key,
            drag.startWidth,
            deltaPct,
            drag.partnerKey,
            drag.startPartnerWidth,
            { persist:false }
          );
        };
        const onUp = ()=>{
          if(!drag) return;
          clearDragState();
          drag = null;
          dashboardColResizeActive = false;
          dashboardColResizeSuppressUntil = Date.now() + 240;
          persistDashboardColWidths();
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          window.removeEventListener('pointercancel', onUp);
        };

        $$('[data-dash-col-resize]', table).forEach((handle)=>{
          handle.addEventListener('click', (ev)=>{
            ev.preventDefault();
            ev.stopPropagation();
          });

          handle.addEventListener('dblclick', (ev)=>{
            const key = handle.getAttribute('data-dash-col-resize') || '';
            const cfg = DASHBOARD_COLS[key];
            if(!cfg) return;
            const partnerKey = dashboardResizePartnerKey(key);
            const partnerCfg = DASHBOARD_COLS[partnerKey];
            const startWidth = Number(dashboardColWidths[key]) || cfg.fallback;
            const startPartnerWidth = partnerCfg
              ? (Number(dashboardColWidths[partnerKey]) || partnerCfg.fallback)
              : 0;
            ev.preventDefault();
            ev.stopPropagation();
            applyDashboardResizeDelta(
              key,
              startWidth,
              cfg.fallback - startWidth,
              partnerKey,
              startPartnerWidth,
              { persist:true }
            );
          });

          handle.addEventListener('pointerdown', (ev)=>{
            if(ev.button !== 0) return;
            const key = handle.getAttribute('data-dash-col-resize') || '';
            const cfg = DASHBOARD_COLS[key];
            if(!cfg) return;
            const partnerKey = dashboardResizePartnerKey(key);
            const partnerCfg = DASHBOARD_COLS[partnerKey];
            const th = handle.closest('th');
            dashboardColResizeActive = true;
            drag = {
              key,
              partnerKey,
              startX: ev.clientX,
              startWidth: Number(dashboardColWidths[key]) || cfg.fallback,
              startPartnerWidth: partnerCfg
                ? (Number(dashboardColWidths[partnerKey]) || partnerCfg.fallback)
                : 0,
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
            ev.stopPropagation();
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
      const uiSchema = (window && window.immersiveUiSchema && typeof window.immersiveUiSchema === 'object')
        ? window.immersiveUiSchema
        : {};

      function normalizeSchemaSelectRows(rows){
        return (Array.isArray(rows) ? rows : [])
          .map((row)=>{
            if(!row || typeof row !== 'object') return null;
            const value = String((row.value == null ? '' : row.value)).trim();
            const label = String((row.label == null ? '' : row.label)).trim() || value;
            if(!value || !label) return null;
            return { value, label };
          })
          .filter(Boolean);
      }

      const fallbackAccountRoleOptions = [
        { value:'vp_sales', label:'VP Sales' },
        { value:'vp_customer_success', label:'VP, Customer Success' },
        { value:'director_regional_sales', label:'Director, Regional Sales' },
        { value:'senior_manager_customer_success', label:'Senior Manager, Customer Success' },
        { value:'senior_enterprise_account_manager', label:'Senior Enterprise Account Manager' },
        { value:'lead_customer_success_manager', label:'Lead Customer Success Manager' },
        { value:'enterprise_account_manager', label:'Enterprise Account Manager' },
        { value:'customer_success_manager', label:'Customer Success Manager' },
        { value:'senior_sales_development_representative', label:'Senior Sales Development Representative' },
        { value:'sales_development_representative', label:'Sales Development Representative' },
        { value:'senior_cyber_resilience_advisor', label:'Senior Cyber Resilience Advisor' },
        { value:'cyber_resilience_advisor', label:'Cyber Resilience Advisor' },
        { value:'associate_enterprise_account_manager', label:'Associate Enterprise Account Manager' },
        { value:'associate_customer_success_manager', label:'Associate Customer Success Manager' },
        { value:'associate_sales_development_representative', label:'Associate Sales Development Representative' },
        { value:'associate_cyber_resilience_advisor', label:'Associate Cyber Resilience Advisor' }
      ];
      const fallbackCompanySizeOptions = [
        { value:'lt500', label:'< 500 employees' },
        { value:'500-2k', label:'500–2,000' },
        { value:'2k-10k', label:'2,000–10,000' },
        { value:'10k-50k', label:'10,000–50,000' },
        { value:'50kplus', label:'50,000+' }
      ];
      const fallbackOperatingCountryOptions = [
        { value:'United States', label:'United States' },
        { value:'United Kingdom', label:'United Kingdom' },
        { value:'Ireland', label:'Ireland' },
        { value:'Canada', label:'Canada' },
        { value:'Germany', label:'Germany' },
        { value:'France', label:'France' },
        { value:'Netherlands', label:'Netherlands' },
        { value:'Spain', label:'Spain' },
        { value:'Italy', label:'Italy' },
        { value:'Sweden', label:'Sweden' },
        { value:'Norway', label:'Norway' },
        { value:'Denmark', label:'Denmark' },
        { value:'Switzerland', label:'Switzerland' },
        { value:'Australia', label:'Australia' },
        { value:'Singapore', label:'Singapore' },
        { value:'Japan', label:'Japan' },
        { value:'India', label:'India' },
        { value:'Other', label:'Other / multiple' }
      ];
      const fallbackIndustryOptions = [
        { value:'Financial Services', label:'Financial Services' },
        { value:'Banking', label:'Banking' },
        { value:'Insurance', label:'Insurance' },
        { value:'Payments / FinTech', label:'Payments / FinTech' },
        { value:'Healthcare / Life Sciences', label:'Healthcare / Life Sciences' },
        { value:'Retail / eCommerce', label:'Retail / eCommerce' },
        { value:'Technology / SaaS', label:'Technology / SaaS' },
        { value:'Telecommunications', label:'Telecommunications' },
        { value:'Government / Public Sector', label:'Government / Public Sector' },
        { value:'Defense / Aerospace', label:'Defense / Aerospace' },
        { value:'Energy / Utilities', label:'Energy / Utilities' },
        { value:'Manufacturing / Industrial', label:'Manufacturing / Industrial' },
        { value:'Transportation / Logistics', label:'Transportation / Logistics' },
        { value:'Education', label:'Education' },
        { value:'Managed Services (MSP/MSSP)', label:'Managed Services (MSP/MSSP)' },
        { value:'Professional Services', label:'Professional Services' },
        { value:'Other', label:'Other' }
      ];
      const fallbackRegionOptions = [
        { value:'NA', label:'North America' },
        { value:'UKI', label:'UK & Ireland' },
        { value:'EU', label:'Europe (EU)' },
        { value:'APAC', label:'APAC' },
        { value:'Other', label:'Other / Global' }
      ];

      const selectSchema = {
        accountRoleOptions: (()=> {
          const rows = normalizeSchemaSelectRows(uiSchema.accountRoleOptions);
          return rows.length ? rows : fallbackAccountRoleOptions;
        })(),
        companySizeOptions: (()=> {
          const rows = normalizeSchemaSelectRows(uiSchema.companySizeOptions);
          return rows.length ? rows : fallbackCompanySizeOptions;
        })(),
        operatingCountryOptions: (()=> {
          const rows = normalizeSchemaSelectRows(uiSchema.operatingCountryOptions);
          return rows.length ? rows : fallbackOperatingCountryOptions;
        })(),
        industryOptions: (()=> {
          const rows = normalizeSchemaSelectRows(uiSchema.industryOptions);
          return rows.length ? rows : fallbackIndustryOptions;
        })(),
        regionOptions: (()=> {
          const rows = normalizeSchemaSelectRows(uiSchema.regionOptions);
          return rows.length ? rows : fallbackRegionOptions;
        })()
      };

      function populateSelectFromSchema(selectEl, rows, emptyLabel){
        if(!selectEl) return;
        const current = String(selectEl.value || '').trim();
        const frag = document.createDocumentFragment();
        const first = document.createElement('option');
        first.value = '';
        first.textContent = String(emptyLabel || 'Select…');
        frag.appendChild(first);
        (Array.isArray(rows) ? rows : []).forEach((row)=>{
          if(!row || typeof row !== 'object') return;
          const value = String(row.value || '').trim();
          const label = String(row.label || '').trim();
          if(!value || !label) return;
          const opt = document.createElement('option');
          opt.value = value;
          opt.textContent = label;
          frag.appendChild(opt);
        });
        selectEl.innerHTML = '';
        selectEl.appendChild(frag);
        if(current && Array.from(selectEl.options || []).some((opt)=> opt.value === current)){
          selectEl.value = current;
        }else{
          selectEl.value = '';
        }
      }

      function hydrateStaticSelectSchemas(){
        populateSelectFromSchema($('#companySize'), selectSchema.companySizeOptions, 'Select…');
        populateSelectFromSchema($('#operatingCountry'), selectSchema.operatingCountryOptions, 'Select…');
        populateSelectFromSchema($('#industry'), selectSchema.industryOptions, 'Select…');
        populateSelectFromSchema($('#region'), selectSchema.regionOptions, 'Select…');
        populateSelectFromSchema($('#accountRole'), selectSchema.accountRoleOptions, 'No default');
      }

      const roleOpts = [
        { id:'ciso', label:'CISO' },
        { id:'secMgr', label:'Security Manager' },
        { id:'practitioner', label:'Practitioner' },
        { id:'executive', label:'Executive' },
        { id:'other', label:'Other' }
      ];

      const accountRoleOpts = selectSchema.accountRoleOptions.map((row)=> ({
        id: row.value,
        label: row.label
      }));
      const accountRoleLegacyMap = Object.freeze({
        cyber_resilience_advisor_senior_to_associate: 'cyber_resilience_advisor'
      });

      const CONFIGURATOR_FIELD_MODES = Object.freeze(new Set([
        'sdr-lite',
        'guided',
        'advanced'
      ]));
      const CONFIGURATOR_CONTENT_STEP_ORDER = Object.freeze([1, 2, 3, 4, 5]);
      const CONFIGURATOR_STEP_LABEL_DEFAULTS = Object.freeze({
        1: 'About',
        2: 'Coverage',
        3: 'Package fit',
        4: 'Context',
        5: 'ROI estimate',
        6: 'Review'
      });
      const FALLBACK_QUESTION_REQUIREMENT_ROWS = Object.freeze([
        { id:'rq_role', key:'role', step:1, group:'about_identity', groupLabel:'About identity', title:'Role not confirmed', why:'Role anchors ownership for outcomes and follow-up.', order:10, requiredGuided:true, requiredAdvanced:true, requiredSdrLite:true, enabled:true },
        { id:'rq_full_name', key:'fullName', step:1, group:'about_identity', groupLabel:'About identity', title:'Name not captured', why:'Contact ownership is required for follow-up and handoff.', order:20, requiredGuided:true, requiredAdvanced:true, requiredSdrLite:true, enabled:true },
        { id:'rq_company', key:'company', step:1, group:'about_identity', groupLabel:'About identity', title:'Company not captured', why:'Company context is needed before sharing a recommendation.', order:30, requiredGuided:true, requiredAdvanced:true, requiredSdrLite:true, enabled:true },
        { id:'rq_company_size', key:'companySize', step:1, group:'about_identity', groupLabel:'About identity', title:'Company size missing', why:'Size influences cadence and recommendation confidence.', order:40, requiredGuided:true, requiredAdvanced:true, requiredSdrLite:false, enabled:true },
        { id:'rq_operating_country', key:'operatingCountry', step:1, group:'about_identity', groupLabel:'About identity', title:'Operating country missing', why:'Country informs the likely regulatory evidence path.', order:50, requiredGuided:true, requiredAdvanced:true, requiredSdrLite:true, enabled:true },
        { id:'rq_pressure_sources', key:'pressureSources', step:1, group:'trigger_urgency', groupLabel:'Trigger and urgency', title:'Pressure sources not selected', why:'Pressure signals help prioritize the right outcomes.', order:60, requiredGuided:true, requiredAdvanced:true, requiredSdrLite:true, enabled:true },
        { id:'rq_urgent_win', key:'urgentWin', step:1, group:'trigger_urgency', groupLabel:'Trigger and urgency', title:'Urgent 90-day win not set', why:'Urgency clarifies what success must look like first.', order:70, requiredGuided:true, requiredAdvanced:true, requiredSdrLite:true, enabled:true },
        { id:'rq_risk_envs', key:'riskEnvs', step:1, group:'risk_environment', groupLabel:'Risk environment', title:'Risk environment not selected', why:'Risk environment helps focus the right simulation scope.', order:80, requiredGuided:true, requiredAdvanced:true, requiredSdrLite:false, enabled:true },
        { id:'rq_measured_on', key:'measuredOn', step:1, group:'baseline_measurement', groupLabel:'Baseline and measurement', title:'Current measurement baseline missing', why:'Baseline metrics are required to quantify uplift.', order:90, requiredGuided:true, requiredAdvanced:true, requiredSdrLite:false, enabled:true },
        { id:'rq_org_pain', key:'orgPain', step:1, group:'trigger_urgency', groupLabel:'Trigger and urgency', title:'Current organisation challenge unclear', why:'Current challenge shapes where value shows up fastest.', order:100, requiredGuided:true, requiredAdvanced:true, requiredSdrLite:false, enabled:true },
        { id:'rq_groups', key:'groups', step:2, group:'coverage_scope', groupLabel:'Coverage and scope', title:'Coverage groups not selected', why:'Coverage determines program scope and rollout design.', order:110, requiredGuided:true, requiredAdvanced:true, requiredSdrLite:true, enabled:true },
        { id:'rq_rhythm', key:'rhythm', step:2, group:'baseline_measurement', groupLabel:'Baseline and measurement', title:'Cadence not selected', why:'Cadence impacts operating model and package fit.', order:120, requiredGuided:true, requiredAdvanced:true, requiredSdrLite:false, enabled:true },
        { id:'rq_measure', key:'measure', step:2, group:'baseline_measurement', groupLabel:'Baseline and measurement', title:'Measurement model not selected', why:'Measurement model drives reporting and evidence quality.', order:130, requiredGuided:true, requiredAdvanced:true, requiredSdrLite:false, enabled:true },
        { id:'rq_fit_realism', key:'fitRealism', step:3, group:'package_fit', groupLabel:'Package fit', title:'Realism requirement unanswered', why:'Realism changes effort and content structure.', order:140, requiredGuided:true, requiredAdvanced:true, requiredSdrLite:false, enabled:true },
        { id:'rq_fit_scope', key:'fitScope', step:3, group:'package_fit', groupLabel:'Package fit', title:'Scope requirement unanswered', why:'Scope alters expected delivery footprint.', order:150, requiredGuided:true, requiredAdvanced:true, requiredSdrLite:true, enabled:true },
        { id:'rq_fit_today', key:'fitToday', step:3, group:'package_fit', groupLabel:'Package fit', title:'Current state unanswered', why:'Current state helps calibrate the starting package.', order:160, requiredGuided:true, requiredAdvanced:true, requiredSdrLite:false, enabled:true },
        { id:'rq_fit_services', key:'fitServices', step:3, group:'package_fit', groupLabel:'Package fit', title:'Delivery support unanswered', why:'Support model affects implementation recommendations.', order:170, requiredGuided:true, requiredAdvanced:true, requiredSdrLite:false, enabled:true },
        { id:'rq_fit_risk_frame', key:'fitRiskFrame', step:3, group:'package_fit', groupLabel:'Package fit', title:'Risk frame unanswered', why:'Risk framing helps position the narrative for stakeholders.', order:180, requiredGuided:true, requiredAdvanced:true, requiredSdrLite:false, enabled:true },
        { id:'rq_industry', key:'industry', step:4, group:'context_regulatory', groupLabel:'Context and regulatory', title:'Industry not selected', why:'Industry context changes suggested standards and language.', order:190, requiredGuided:true, requiredAdvanced:true, requiredSdrLite:false, enabled:true },
        { id:'rq_region', key:'region', step:4, group:'context_regulatory', groupLabel:'Context and regulatory', title:'Region not selected', why:'Region influences evidence and audit expectations.', order:200, requiredGuided:true, requiredAdvanced:true, requiredSdrLite:false, enabled:true },
        { id:'rq_regs', key:'regs', step:4, group:'context_regulatory', groupLabel:'Context and regulatory', title:'Regulatory references not selected', why:'References improve the evidence narrative for stakeholders.', order:210, requiredGuided:true, requiredAdvanced:true, requiredSdrLite:false, enabled:true },
        { id:'rq_roi_visited', key:'roiVisited', step:5, group:'roi_business_case', groupLabel:'ROI and business case', title:'ROI estimate not reviewed', why:'ROI inputs are needed for investment and timing decisions.', order:220, requiredGuided:true, requiredAdvanced:true, requiredSdrLite:false, enabled:true }
      ]);

      function resolveConfiguratorFieldMode(value){
        const raw = String(value || '').trim().toLowerCase();
        if(CONFIGURATOR_FIELD_MODES.has(raw)) return raw;
        if(raw === 'sdr-lite' || raw === 'sdr_lite' || raw === 'sdr') return 'sdr-lite';
        if(raw === 'advanced') return 'advanced';
        return 'guided';
      }

      function effectiveConfiguratorFieldMode(recordMode){
        const accountMode = accountFieldModeValue();
        if(accountMode === 'sdr-lite'){
          return 'sdr-lite';
        }
        return resolveConfiguratorFieldMode(recordMode || accountMode);
      }

      function accountFieldModeValue(){
        const account = (typeof settingsState !== 'undefined' && settingsState && settingsState.account)
          ? settingsState.account
          : {};
        return resolveConfiguratorFieldMode(account.fieldMode);
      }

      function accountRoiEstimateEnabled(){
        const account = (typeof settingsState !== 'undefined' && settingsState && settingsState.account)
          ? settingsState.account
          : {};
        const raw = String(account.roiEstimateMode || 'on').trim().toLowerCase();
        return raw !== 'off';
      }

      function questionRequirementRows(){
        const bankRows = (window.immersiveQuestionBank && Array.isArray(window.immersiveQuestionBank.rows))
          ? window.immersiveQuestionBank.rows
          : [];
        const sourceRows = bankRows.length ? bankRows : FALLBACK_QUESTION_REQUIREMENT_ROWS;
        return sourceRows
          .filter((row)=> row && row.enabled !== false && String(row.key || '').trim())
          .slice()
          .sort((a, b)=> {
            const byOrder = Number(a.order || 0) - Number(b.order || 0);
            if(byOrder) return byOrder;
            const byStep = Number(a.step || 0) - Number(b.step || 0);
            if(byStep) return byStep;
            return String(a.id || '').localeCompare(String(b.id || ''));
          });
      }

      function maxQuestionStep(){
        return CONFIGURATOR_CONTENT_STEP_ORDER[CONFIGURATOR_CONTENT_STEP_ORDER.length - 1] || 5;
      }

      function reviewStepNumber(){
        return maxQuestionStep() + 1;
      }

      function maxConfiguratorStep(){
        return reviewStepNumber();
      }

      function clampQuestionStep(value){
        return clamp(Number(value) || 1, CONFIGURATOR_CONTENT_STEP_ORDER[0] || 1, maxQuestionStep());
      }

      function clampConfiguratorStep(value){
        return clamp(Number(value) || 1, CONFIGURATOR_CONTENT_STEP_ORDER[0] || 1, maxConfiguratorStep());
      }

      function questionStepLabel(step){
        const targetStep = clampQuestionStep(step);
        const row = questionRequirementRows().find((item)=>{
          if(!item || typeof item !== 'object') return false;
          if(clampQuestionStep(item.step) !== targetStep) return false;
          return String(item.stepLabel || item.step_label || '').trim().length > 0;
        });
        if(row){
          const explicit = String(row.stepLabel || row.step_label || '').trim();
          if(explicit) return explicit;
        }
        return CONFIGURATOR_STEP_LABEL_DEFAULTS[targetStep] || `Step ${targetStep}`;
      }

      function configuratorQuestionSteps(){
        return CONFIGURATOR_CONTENT_STEP_ORDER.map((step)=> ({
          step,
          label: questionStepLabel(step),
          review: false
        }));
      }

      function configuratorStepModel(){
        const steps = configuratorQuestionSteps();
        steps.push({
          step: reviewStepNumber(),
          label: CONFIGURATOR_STEP_LABEL_DEFAULTS[reviewStepNumber()] || 'Review',
          review: true
        });
        return steps;
      }

      function configuratorStepLabel(step){
        const target = clampConfiguratorStep(step);
        const match = configuratorStepModel().find((item)=> item.step === target);
        if(match && String(match.label || '').trim()){
          return String(match.label).trim();
        }
        return CONFIGURATOR_STEP_LABEL_DEFAULTS[target] || `Step ${target}`;
      }

      function configuratorStepDisplayIndex(step){
        const target = clampConfiguratorStep(step);
        const model = configuratorStepModel();
        const idx = model.findIndex((item)=> item.step === target);
        return idx >= 0 ? idx : Math.max(0, target - 1);
      }

      function allConfiguratorStepNumbers(){
        return configuratorStepModel().map((item)=> item.step);
      }

      function requiredQuestionStepSetForMode(mode){
        const targetMode = resolveConfiguratorFieldMode(mode);
        const steps = new Set();
        questionRequirementRows().forEach((requirement)=>{
          if(!requirementEnabledForMode(requirement, targetMode)) return;
          steps.add(clampQuestionStep(requirement.step));
        });
        return steps;
      }

      function renderConfiguratorProgressRail(){
        const nav = $('#configProgressNav') || $('.progress');
        if(!nav) return;
        const mode = effectiveConfiguratorFieldMode(state.fieldMode);
        const questionSteps = configuratorQuestionSteps();
        const requiredSteps = requiredQuestionStepSetForMode(mode);
        const requiredQuestionSteps = questionSteps.filter((item)=> requiredSteps.has(item.step));
        const optionalQuestionSteps = questionSteps.filter((item)=> !requiredSteps.has(item.step));
        const review = {
          step: reviewStepNumber(),
          label: CONFIGURATOR_STEP_LABEL_DEFAULTS[reviewStepNumber()] || 'Review'
        };

        const buildChip = (item, optional)=>{
          const isOptional = !!optional;
          return `<button type="button" class="chip" data-chip="${item.step}" data-step="${item.step}" data-optional="${isOptional ? 'true' : 'false'}" data-active="false"><strong>${isOptional ? '' : configuratorStepDisplayIndex(item.step)}</strong> ${escapeHtml(item.label)}</button>`;
        };

        const parts = [];
        requiredQuestionSteps.forEach((item)=>{ parts.push(buildChip(item, false)); });
        if(mode === 'sdr-lite' && optionalQuestionSteps.length){
          parts.push('<div class="progressSectionLabel" data-progress-section="optional">Optional</div>');
          optionalQuestionSteps.forEach((item)=>{ parts.push(buildChip(item, true)); });
        }else{
          optionalQuestionSteps.forEach((item)=>{ parts.push(buildChip(item, false)); });
        }
        parts.push(buildChip(review, false));

        const sig = `${mode}|${requiredQuestionSteps.map((item)=> item.step).join(',')}|${optionalQuestionSteps.map((item)=> item.step).join(',')}|${parts.length}`;
        if(nav.dataset.modelSig !== sig){
          nav.innerHTML = parts.join('');
          nav.dataset.modelSig = sig;
        }
        const activeStep = clampConfiguratorStep(state.activeStep);
        $$('.chip', nav).forEach((chip)=>{
          chip.dataset.active = (Number(chip.dataset.step) === activeStep) ? 'true' : 'false';
        });
      }

      function requirementEnabledForMode(requirement, mode){
        const targetMode = resolveConfiguratorFieldMode(mode);
        if(targetMode === 'advanced'){
          return requirement.requiredAdvanced !== false;
        }
        if(targetMode === 'sdr-lite'){
          return requirement.requiredSdrLite === true;
        }
        return requirement.requiredGuided !== false;
      }

      function requirementDoneForContext(requirementKey, ctx){
        switch(String(requirementKey || '').trim()){
          case 'role': return !!ctx.role;
          case 'fullName': return !!ctx.fullName;
          case 'company': return !!ctx.company;
          case 'companySize': return !!ctx.companySize;
          case 'operatingCountry': return !!ctx.operatingCountry;
          case 'pressureSources': return ctx.pressureSources.length > 0;
          case 'urgentWin': return !!ctx.urgentWin;
          case 'riskEnvs': return ctx.riskEnvs.length > 0;
          case 'measuredOn': return !!ctx.measuredOn;
          case 'orgPain': return !!ctx.orgPain;
          case 'groups': return ctx.groups.size > 0;
          case 'rhythm': return !!ctx.rhythm;
          case 'measure': return !!ctx.measure;
          case 'fitRealism': return !!ctx.fitRealism;
          case 'fitScope': return !!ctx.fitScope;
          case 'fitToday': return !!ctx.fitToday;
          case 'fitServices': return !!ctx.fitServices;
          case 'fitRiskFrame': return !!ctx.fitRiskFrame;
          case 'industry': return !!ctx.industry;
          case 'region': return !!ctx.region;
          case 'regs': return ctx.regs.size > 0 && !!ctx.regsTouched;
          case 'roiVisited': return !accountRoiEstimateEnabled() || ctx.visited.has(maxQuestionStep());
          default: return false;
        }
      }

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
        const safeName = escapeHtml(String(name || 'choice'));
        const drillKey = (name && name.indexOf('drill_') === 0) ? name.replace('drill_','') : '';
        const currentValue = drillKey ? (state.outcomeDrilldowns[drillKey] || '') : (state[name] || '');
        items.forEach(it=>{
          const row = document.createElement('label');
          row.className = 'radio';
          row.innerHTML = `
            <input type="radio" name="${safeName}" value="${escapeHtml(it.id)}">
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
            <input type="checkbox" value="${escapeHtml(it.id)}">
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
            <input type="checkbox" value="${escapeHtml(it.id)}">
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

      function encodeRouteSegment(value){
        return encodeURIComponent(String(value || 'current').trim() || 'current');
      }

      function decodeRouteSegment(value){
        try{
          return decodeURIComponent(String(value || '').trim());
        }catch(err){
          return String(value || '').trim();
        }
      }

      function routeHashFromState(){
        const view = state.currentView || 'dashboard';
        const recordId = String(state.activeThread || 'current').trim() || 'current';
        if(view === 'dashboard') return `${ROUTE_HASH_PREFIX}dashboard`;
        if(view === 'archived') return `${ROUTE_HASH_PREFIX}archived`;
        if(view === 'account') return `${ROUTE_HASH_PREFIX}account`;
        if(view === 'backend') return `${ROUTE_HASH_PREFIX}account/backend-configurations`;
        if(view === 'export'){
          if(recordId && recordId !== 'current'){
            return `${ROUTE_HASH_PREFIX}records/${encodeRouteSegment(recordId)}/export`;
          }
          return `${ROUTE_HASH_PREFIX}export`;
        }
        if(view === 'interstitial'){
          return `${ROUTE_HASH_PREFIX}records/${encodeRouteSegment(recordId)}/overview`;
        }
        if(view === 'recommendations'){
          const recThreadId = String(state.recommendationsThreadId || recordId).trim() || recordId;
          return `${ROUTE_HASH_PREFIX}records/${encodeRouteSegment(recThreadId)}/recommendations`;
        }
        return `${ROUTE_HASH_PREFIX}records/${encodeRouteSegment(recordId)}/configure?step=${clampConfiguratorStep(state.activeStep)}`;
      }

      function syncRouteWithState(opts){
        if(routeSyncIsApplying) return;
        const cfg = Object.assign({ replace:true }, opts || {});
        const nextHash = routeHashFromState();
        const currentHash = String(window.location.hash || '');
        if(nextHash === currentHash) return;
        const base = `${window.location.pathname}${window.location.search}`;
        if(cfg.replace){
          window.history.replaceState(null, '', `${base}${nextHash}`);
        }else{
          window.history.pushState(null, '', `${base}${nextHash}`);
        }
      }

      function parseRouteFromHash(hashValue){
        const raw = String(hashValue || '').trim().replace(/^#/, '');
        if(!raw || raw === '/') return { view:'dashboard' };
        const parts = raw.split('?');
        const pathPart = String(parts[0] || '').replace(/^\/+/, '');
        const query = new URLSearchParams(parts[1] || '');
        const segs = pathPart.split('/').filter(Boolean);
        if(!segs.length) return { view:'dashboard' };

        if(segs[0] === 'dashboard') return { view:'dashboard' };
        if(segs[0] === 'archived') return { view:'archived' };
        if(segs[0] === 'account'){
          const subView = String(segs[1] || '').trim().toLowerCase();
          if(subView === 'backend-configurations') return { view:'backend' };
          return { view:'account' };
        }
        if(segs[0] === 'export') return { view:'export' };
        if(segs[0] !== 'records' || segs.length < 2) return null;

        const recordId = decodeRouteSegment(segs[1]) || 'current';
        const mode = String(segs[2] || '').toLowerCase();
        if(mode === 'overview') return { view:'interstitial', recordId };
        if(mode === 'recommendations') return { view:'recommendations', recordId };
        if(mode === 'export') return { view:'export', recordId };
        if(mode === 'configure'){
          const step = clampConfiguratorStep(Number(query.get('step')) || 1);
          return { view:'configurator', recordId, step };
        }
        return null;
      }

      function applyRoute(route){
        if(!route || typeof route !== 'object') return false;
        routeSyncIsApplying = true;
        try{
          if(route.view === 'dashboard'){
            setView('dashboard');
            return true;
          }
          if(route.view === 'archived'){
            setView('archived');
            return true;
          }
          if(route.view === 'account'){
            setView('account');
            return true;
          }
          if(route.view === 'backend'){
            setView('backend');
            return true;
          }
          if(route.view === 'export'){
            openCrmExportView(route.recordId || state.activeThread || 'current');
            return true;
          }
          if(route.view === 'interstitial'){
            openThreadOverview(route.recordId || 'current');
            return true;
          }
          if(route.view === 'recommendations'){
            openRecommendationsForThread(route.recordId || 'current', { returnView:'interstitial' });
            return true;
          }
          if(route.view === 'configurator'){
            openThreadConfigurator(route.recordId || 'current', clampConfiguratorStep(Number(route.step) || 1));
            return true;
          }
          return false;
        }finally{
          routeSyncIsApplying = false;
        }
      }

      function applyRouteFromLocation(){
        const parsed = parseRouteFromHash(window.location.hash || '');
        if(!parsed) return false;
        return applyRoute(parsed);
      }

      function ensureRouteSyncListeners(){
        if(routeSyncListenersBound) return;
        routeSyncListenersBound = true;
        window.addEventListener('hashchange', ()=>{
          applyRouteFromLocation();
        });
      }

      // ---------- navigation ----------
      function setView(view, opts){
        const cfg = Object.assign({ render: true, syncRoute: true }, opts || {});
        const prev = state.currentView || 'dashboard';
        const next = (view === 'dashboard' || view === 'archived' || view === 'interstitial' || view === 'account' || view === 'backend' || view === 'recommendations' || view === 'export') ? view : 'configurator';
        if(prev === 'configurator' && next !== 'configurator'){
          const prevRecordId = String(state.activeThread || '').trim();
          if(prevRecordId && prevRecordId !== 'current'){
            releaseRecordLock(prevRecordId, { force:false });
          }
          clearRecordLockHeartbeat();
          state.lockReacquirePending = false;
          state.recordReadOnly = false;
        }
        state.currentView = next;
        if(prev !== next && state.consultationOpen){
          toggleConsultation(false);
        }
        if(prev !== next && state.emailBuilderOpen){
          toggleEmailBuilder(false);
        }
        document.body.classList.toggle('is-configurator-view', next === 'configurator');
        document.body.classList.toggle('is-dashboard-view', next === 'dashboard');
        document.body.classList.toggle('is-archived-view', next === 'archived');
        document.body.classList.toggle('is-interstitial-view', next === 'interstitial');
        document.body.classList.toggle('is-account-view', next === 'account');
        document.body.classList.toggle('is-backend-view', next === 'backend');
        document.body.classList.toggle('is-recommendations-view', next === 'recommendations');
        document.body.classList.toggle('is-export-view', next === 'export');
        if(next === 'dashboard' || next === 'archived' || next === 'account' || next === 'backend' || next === 'recommendations' || next === 'export'){
          state.navPreviewThreadId = null;
        }
        if(next !== 'configurator'){
          clearScheduledAutoSave();
        }else{
          requestAutoSave(AUTO_SAVE_BASE_MS);
          if(!state.recordReadOnly){
            ensureRecordLockHeartbeat();
          }
        }

        const workspaceArchive = $('#workspaceArchive');
        const workspaceAccount = $('#workspaceAccount');
        const workspaceBackend = $('#workspaceBackend');
        if(workspaceArchive){
          workspaceArchive.dataset.active = (next === 'archived') ? 'true' : 'false';
        }
        if(workspaceAccount){
          workspaceAccount.dataset.active = (next === 'account') ? 'true' : 'false';
        }
        if(workspaceBackend){
          workspaceBackend.dataset.active = (next === 'backend') ? 'true' : 'false';
        }
        const recordContextName = $('#recordContextName');
        if(recordContextName){
          const thread = activeThreadModel();
          const editingCompany = String(state.company || '').trim();
          recordContextName.textContent = editingCompany || ((thread && thread.company) ? thread.company : 'Record');
        }

        if(cfg.syncRoute !== false){
          syncRouteWithState({ replace:true });
        }
        if(cfg.render){
          update();
        }else{
          syncGlobalActionBar();
          renderWorkspaceBreadcrumb();
        }
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
        const shareBtn = $('#globalShareRecord');
        const recsBtn = $('#globalViewRecommendations');
        const bookBtn = $('#globalBookConsultation');
        const view = state.currentView || 'configurator';
        const interThread = (view === 'interstitial') ? activeThreadModel() : null;
        const interPerms = interThread ? actorPermissionsForThread(interThread) : actorPermissionsForThread(null);
        const canManageThread = !!(
          interThread
          && interThread.id
          && interThread.id !== 'current'
          && findSavedThread(interThread.id)
          && (interPerms.role === 'admin' || interPerms.role === 'owner')
        );
        const canShareThread = !!(interThread && interThread.id && interThread.id !== 'current');
        const interArchived = !!(interThread && interThread.archived);
        const interArchiveOnly = view === 'interstitial' && interArchived;
        const interRecsGate = (view === 'interstitial' && interThread)
          ? recommendationsGateFromThread(interThread)
          : null;

        const setActionBtnVisible = (el, visible)=>{
          if(!el) return;
          const on = !!visible;
          el.hidden = !on;
          el.style.display = on ? '' : 'none';
        };
        setActionBtnVisible(createBtn, view === 'dashboard');
        setActionBtnVisible(deleteBtn, view === 'interstitial' && canManageThread && !interArchiveOnly);
        setActionBtnVisible(editBtn, view === 'interstitial' && (!interArchiveOnly || canManageThread));
        setActionBtnVisible(shareBtn, view === 'interstitial' && canShareThread && !interArchiveOnly);
        setActionBtnVisible(recsBtn, view === 'interstitial' && !interArchiveOnly);
        setActionBtnVisible(bookBtn, view === 'interstitial' && !interArchiveOnly);
        if(recsBtn){
          const unlocked = !!(interRecsGate && interRecsGate.eligible);
          recsBtn.disabled = false;
          recsBtn.setAttribute('aria-disabled', unlocked ? 'false' : 'true');
          recsBtn.dataset.locked = unlocked ? 'false' : 'true';
          recsBtn.title = unlocked
            ? 'Open recommended resources'
            : `Locked until completion reaches 90% (current: ${(interRecsGate && interRecsGate.completion) || '0/22 (0%)'})`;
        }
        if(editBtn){
          if(interArchiveOnly){
            editBtn.textContent = 'Unarchive';
            editBtn.title = 'Restore this record to active workspace';
            editBtn.disabled = !canManageThread;
            editBtn.setAttribute('aria-disabled', editBtn.disabled ? 'true' : 'false');
          }else{
            editBtn.textContent = interPerms.canEditRecord ? 'Edit record' : 'View record';
            editBtn.title = interPerms.canEditRecord ? 'Edit this record' : 'Open this record in read-only mode';
            editBtn.disabled = false;
            editBtn.setAttribute('aria-disabled', 'false');
          }
        }
        if(shareBtn){
          shareBtn.disabled = !interPerms.canShareRecord;
          shareBtn.setAttribute('aria-disabled', shareBtn.disabled ? 'true' : 'false');
          shareBtn.title = interPerms.canShareRecord ? 'Open sharing controls' : 'Sharing is not available for this role';
        }
        if(deleteBtn){
          const actionLabel = interArchived ? 'Unarchive record' : 'Archive record';
          deleteBtn.dataset.archiveMode = interArchived ? 'restore' : 'archive';
          deleteBtn.setAttribute('aria-label', actionLabel);
          deleteBtn.title = actionLabel;
        }
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

      function renderWorkspaceBreadcrumb(){
        const nav = $('#workspaceBreadcrumb');
        const list = $('#workspaceBreadcrumbList');
        if(!nav || !list) return;

        const view = state.currentView || 'configurator';
        const isWorkspaceView = (
          view === 'interstitial'
          || view === 'archived'
          || view === 'account'
          || view === 'backend'
          || view === 'recommendations'
          || view === 'export'
        );
        nav.hidden = !isWorkspaceView;
        if(!isWorkspaceView){
          list.innerHTML = '';
          return;
        }

        const items = [
          { label:'Dashboard', action:'dashboard', current:false }
        ];

        if(view === 'archived'){
          items.push({ label:'My archive', action:'archived', current:true });
        }else if(view === 'account'){
          items.push({ label:'My account', action:'account', current:true });
        }else if(view === 'backend'){
          items.push({ label:'My account', action:'account', current:false });
          items.push({ label:'Backend configurations', action:'account-backend', current:true });
        }else if(view === 'interstitial'){
          const thread = activeThreadModel();
          const company = String((thread && thread.company) || '').trim() || 'Record';
          const threadId = String((thread && thread.id) || state.activeThread || 'current');
          items.push({ label:company, action:'interstitial-thread', threadId, current:true });
        }else if(view === 'recommendations'){
          const thread = resolveRecommendationThread(state.recommendationsThreadId || state.activeThread || 'current');
          const company = String((thread && thread.company) || '').trim() || 'Record';
          const threadId = String((thread && thread.id) || state.recommendationsThreadId || 'current');
          items.push({ label:company, action:'interstitial-thread', threadId, current:false });
          items.push({ label:'Resources', action:'recommendations', current:true });
        }else if(view === 'export'){
          const activeId = String(state.activeThread || '').trim();
          const thread = activeId && activeId !== 'current'
            ? findSavedThread(activeId)
            : currentThreadModel();
          const company = String((thread && thread.company) || '').trim();
          const threadId = String((thread && thread.id) || 'current').trim() || 'current';
          if(company){
            items.push({ label:company, action:'interstitial-thread', threadId, current:false });
          }
          items.push({ label:'CRM export', action:'export', current:true });
        }

        list.innerHTML = items.map((item)=>{
          if(item.current){
            return `<li class="workspaceBreadcrumbItem"><span class="workspaceBreadcrumbCurrent" aria-current="page">${escapeHtml(item.label)}</span></li>`;
          }
          const threadAttr = item.threadId ? ` data-thread-id="${escapeHtml(item.threadId)}"` : '';
          return `<li class="workspaceBreadcrumbItem"><button type="button" class="workspaceBreadcrumbLink" data-workspace-crumb="${escapeHtml(item.action)}"${threadAttr}>${escapeHtml(item.label)}</button></li>`;
        }).join('');
      }

      function setActiveStep(n){
        const nn = clampConfiguratorStep(Number(n) || 1);
        setView('configurator', { render:false, syncRoute:false });
        state.activeStep = nn;
        state.visited.add(nn);
        renderConfiguratorProgressRail();

        $$('.step').forEach(s => s.dataset.active = (s.dataset.step === String(nn)) ? 'true' : 'false');
        $$('.chip').forEach(c => c.dataset.active = (c.dataset.chip === String(nn)) ? 'true' : 'false');

        window.scrollTo({ top: 0, behavior: 'smooth' });
        syncRouteWithState({ replace:true });
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
        if(Number.isFinite(gapStep)) return clampQuestionStep(gapStep);
        const snapStep = Number(thread && thread.snapshot && thread.snapshot.activeStep);
        if(Number.isFinite(snapStep)) return clampConfiguratorStep(snapStep);
        return 1;
      }

      function incompleteStepsFromState(){
        const steps = Array.from(new Set(
          dashboardCurrentGaps()
            .map((gap)=> clampQuestionStep(Number(gap && gap.step) || 1))
        )).sort((a,b)=> a - b);
        return steps;
      }

      function nextIncompleteStepFrom(currentStep){
        const steps = incompleteStepsFromState();
        if(!steps.length) return null;
        const cur = clampQuestionStep(Number(currentStep) || 1);
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
        return configuratorStepLabel(state.activeStep);
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
        const sourceFieldMode = (
          Object.prototype.hasOwnProperty.call(src, 'fieldMode')
          ? src.fieldMode
          : state.fieldMode
        );
        const ctx = {
          fieldMode: effectiveConfiguratorFieldMode(sourceFieldMode),
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
        const mode = effectiveConfiguratorFieldMode(ctx.fieldMode || state.fieldMode);
        return questionRequirementRows()
          .filter((requirement)=> requirementEnabledForMode(requirement, mode))
          .map((requirement)=> ({
            id: String(requirement.id || '').trim(),
            key: String(requirement.key || '').trim(),
            step: clampQuestionStep(Number(requirement.step) || 1),
            group: String(requirement.group || '').trim(),
            groupLabel: String(requirement.groupLabel || '').trim(),
            done: requirementDoneForContext(requirement.key, ctx),
            title: String(requirement.title || 'Required question unanswered').trim(),
            why: String(requirement.why || 'This field is required to maintain recommendation confidence.').trim()
          }))
          .filter((requirement)=> requirement.key);
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
          return Object.assign({}, readinessProgressFromContext(state), { source:'computed' });
        }
        const snapshot = (thread.snapshot && typeof thread.snapshot === 'object') ? thread.snapshot : {};
        const computed = readinessProgressFromContext(snapshot);
        return {
          completion: computed.completion,
          gaps: computed.gaps,
          gapSummary: computed.gapSummary,
          source: 'computed'
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

      const STATIC_THREAD_SNAPSHOT_SEEDS = Object.freeze({
        northbridge: {
          role: 'ciso',
          fullName: 'Will Bloor',
          company: 'Northbridge Bank',
          companySize: '2k-10k',
          operatingCountry: 'United Kingdom',
          pressureSources: ['board', 'regulator', 'insurer'],
          urgentWin: 'boardEvidence',
          riskEnvs: ['cloud', 'identity'],
          measuredOn: 'audit',
          orgPain: '',
          groups: ['soc', 'exec', 'grc'],
          rhythm: 'quarterly',
          measure: '',
          fitRealism: 'tooling',
          fitScope: '',
          fitToday: '',
          fitServices: '',
          fitRiskFrame: 'governance',
          industry: 'Financial Services',
          region: 'UKI',
          regs: [],
          regsTouched: false,
          activeStep: 3,
          visited: [1, 2, 3, 4]
        },
        aster: {
          role: 'secMgr',
          fullName: 'Will Bloor',
          company: 'Aster Mobility',
          companySize: '2k-10k',
          operatingCountry: 'Ireland',
          pressureSources: ['board', 'customers'],
          urgentWin: 'attackSurface',
          riskEnvs: ['enterpriseApps', 'cloud'],
          measuredOn: 'training',
          orgPain: 'skillsCoverage',
          drivers: ['nearMiss', 'skills', 'change'],
          groups: ['soc', 'product'],
          rhythm: '',
          measure: 'completion',
          fitRealism: 'generic',
          fitScope: 'single',
          fitToday: 'training',
          fitServices: '',
          fitRiskFrame: 'skills',
          industry: 'Payments / FinTech',
          region: 'APAC',
          regs: [],
          regsTouched: false,
          activeStep: 2,
          visited: [1, 2, 3, 4]
        },
        pioneer: {
          role: 'ciso',
          fullName: 'Will Bloor',
          company: 'Pioneer Cloud',
          companySize: '10k-50k',
          operatingCountry: 'United States',
          pressureSources: ['board', 'regulator', 'customers'],
          urgentWin: 'boardEvidence',
          riskEnvs: ['cloud', 'identity'],
          measuredOn: 'mttd',
          orgPain: 'externalProof',
          groups: ['soc', 'cloud', 'exec'],
          rhythm: 'program',
          measure: 'performance',
          fitRealism: 'bespoke',
          fitScope: 'enterprise',
          fitToday: 'scrutiny',
          fitServices: 'whiteglove',
          fitRiskFrame: 'governance',
          industry: 'Technology / SaaS',
          region: 'NA',
          regs: ['nistscf', 'iso27001', 'soc2'],
          regsTouched: true,
          activeStep: reviewStepNumber(),
          visited: allConfiguratorStepNumbers()
        },
        cedar: {
          role: 'secMgr',
          fullName: 'Will Bloor',
          company: 'Cedar Health',
          companySize: '2k-10k',
          operatingCountry: 'United States',
          pressureSources: ['board', 'internal'],
          urgentWin: 'boardEvidence',
          riskEnvs: ['enterpriseApps', 'socir'],
          measuredOn: 'audit',
          orgPain: 'externalProof',
          groups: ['soc', 'grc', 'workforce'],
          rhythm: 'monthly',
          measure: 'performance',
          fitRealism: 'tooling',
          fitScope: 'multi',
          fitToday: 'adhoc',
          fitServices: 'guided',
          fitRiskFrame: 'governance',
          industry: 'Healthcare / Life Sciences',
          region: 'NA',
          regs: ['hipaa', 'hitrust', 'iso27001'],
          regsTouched: true,
          activeStep: reviewStepNumber(),
          visited: allConfiguratorStepNumbers()
        },
        arclight: {
          role: 'practitioner',
          fullName: 'Will Bloor',
          company: 'Arclight Retail',
          companySize: '500-2k',
          operatingCountry: 'United States',
          pressureSources: ['internal'],
          urgentWin: '',
          riskEnvs: [],
          measuredOn: '',
          orgPain: '',
          groups: ['soc'],
          rhythm: '',
          measure: '',
          fitRealism: '',
          fitScope: '',
          fitToday: '',
          fitServices: '',
          fitRiskFrame: '',
          industry: 'Retail / eCommerce',
          region: '',
          regs: [],
          regsTouched: false,
          activeStep: 2,
          visited: [1, 2]
        },
        blueharbor: {
          role: 'secMgr',
          fullName: 'Will Bloor',
          company: 'Blueharbor Logistics',
          companySize: '2k-10k',
          operatingCountry: 'United States',
          pressureSources: ['board', 'customers'],
          urgentWin: '',
          riskEnvs: [],
          measuredOn: '',
          orgPain: '',
          groups: ['soc'],
          rhythm: '',
          measure: '',
          fitRealism: '',
          fitScope: '',
          fitToday: '',
          fitServices: '',
          fitRiskFrame: '',
          industry: 'Transportation / Logistics',
          region: 'NA',
          regs: [],
          regsTouched: false,
          activeStep: 2,
          visited: [1, 2]
        },
        nexus: {
          role: 'ciso',
          fullName: 'Will Bloor',
          company: 'Nexus Utilities',
          companySize: '2k-10k',
          operatingCountry: 'United States',
          pressureSources: ['regulator', 'internal'],
          urgentWin: 'boardEvidence',
          riskEnvs: ['ot', 'socir'],
          measuredOn: 'audit',
          orgPain: 'externalProof',
          groups: ['soc', 'grc'],
          rhythm: 'quarterly',
          measure: '',
          fitRealism: '',
          fitScope: '',
          fitToday: 'adhoc',
          fitServices: '',
          fitRiskFrame: '',
          industry: 'Energy / Utilities',
          region: '',
          regs: [],
          regsTouched: false,
          activeStep: 3,
          visited: [1, 2, 3, 4]
        },
        lunar: {
          role: 'ciso',
          fullName: 'Will Bloor',
          company: 'Lunar Systems',
          companySize: '10k-50k',
          operatingCountry: 'United States',
          pressureSources: ['board', 'customers', 'insurer'],
          urgentWin: 'fasterDecisions',
          riskEnvs: ['cloud', 'identity'],
          measuredOn: 'mttd',
          orgPain: 'coordination',
          groups: ['soc', 'cloud', 'identity'],
          rhythm: 'monthly',
          measure: 'performance',
          fitRealism: 'tooling',
          fitScope: 'multi',
          fitToday: 'adhoc',
          fitServices: 'guided',
          fitRiskFrame: 'readiness',
          industry: 'Technology / SaaS',
          region: '',
          regs: [],
          regsTouched: false,
          activeStep: 4,
          visited: [1, 2, 3, 4]
        }
      });

      function staticThreadSnapshotSeed(threadId, companyName){
        const key = String(threadId || '').trim();
        if(!key) return null;
        const seed = STATIC_THREAD_SNAPSHOT_SEEDS[key];
        if(!seed) return null;
        const seedCompany = String((seed && seed.company) || '').trim().toLowerCase();
        const company = String(companyName || '').trim().toLowerCase();
        if(company && seedCompany && company !== seedCompany) return null;
        return jsonClone(seed) || null;
      }

      function mergeSnapshotWithSeed(snapshotInput, seedInput, companyFallback){
        const snapshot = (snapshotInput && typeof snapshotInput === 'object')
          ? (jsonClone(snapshotInput) || {})
          : {};
        const seed = (seedInput && typeof seedInput === 'object') ? seedInput : null;
        const fallbackCompany = String(companyFallback || '').trim();
        const hasText = (value)=> String(value || '').trim().length > 0;
        const looksLikeLegacyAutoSnapshot = !!(
          seed
          && !hasText(snapshot.companySize)
          && !hasText(snapshot.operatingCountry)
          && !Array.isArray(snapshot.pressureSources)
          && !Array.isArray(snapshot.riskEnvs)
          && !hasText(snapshot.urgentWin)
          && !hasText(snapshot.measuredOn)
          && !hasText(snapshot.orgPain)
          && !Array.isArray(snapshot.groups)
          && !hasText(snapshot.rhythm)
          && !hasText(snapshot.measure)
          && !hasText(snapshot.fitRealism)
          && !hasText(snapshot.fitScope)
          && !hasText(snapshot.fitToday)
          && !hasText(snapshot.fitServices)
          && !hasText(snapshot.fitRiskFrame)
          && !hasText(snapshot.industry)
          && !hasText(snapshot.region)
          && !Array.isArray(snapshot.regs)
        );

        if(looksLikeLegacyAutoSnapshot){
          const migrated = jsonClone(seed) || {};
          if(!hasText(migrated.company) && hasText(snapshot.company)){
            migrated.company = String(snapshot.company).trim();
          }
          if(!Array.isArray(migrated.visited) || !migrated.visited.length){
            migrated.visited = [1];
          }
          return migrated;
        }

        const scalarKeys = [
          'fieldMode', 'role', 'fullName', 'company', 'companySize', 'operatingCountry',
          'industry', 'region', 'urgentWin', 'measuredOn', 'orgPain',
          'rhythm', 'measure', 'fitRealism', 'fitScope', 'fitToday',
          'fitServices', 'fitRiskFrame', 'milestone', 'regMode', 'regSearch',
          'stackOther', 'currency', 'realization', 'email', 'phone', 'notes'
        ];
        const listKeys = [
          'pressureSources', 'riskEnvs', 'drivers', 'evidence',
          'groups', 'regs', 'stack', 'visited'
        ];

        if(seed){
          scalarKeys.forEach((key)=>{
            if(!hasText(snapshot[key]) && hasText(seed[key])){
              snapshot[key] = seed[key];
            }
          });
          listKeys.forEach((key)=>{
            if((!Array.isArray(snapshot[key]) || !snapshot[key].length) && Array.isArray(seed[key]) && seed[key].length){
              snapshot[key] = seed[key].slice();
            }
          });
          if(!Number.isFinite(Number(snapshot.activeStep)) && Number.isFinite(Number(seed.activeStep))){
            snapshot.activeStep = clampConfiguratorStep(Number(seed.activeStep) || 1);
          }
          if(typeof snapshot.regsTouched !== 'boolean' && typeof seed.regsTouched === 'boolean'){
            snapshot.regsTouched = seed.regsTouched;
          }
          if(typeof snapshot.regModeTouched !== 'boolean' && typeof seed.regModeTouched === 'boolean'){
            snapshot.regModeTouched = seed.regModeTouched;
          }
        }

        if(!hasText(snapshot.company) && fallbackCompany){
          snapshot.company = fallbackCompany;
        }
        if(!Array.isArray(snapshot.visited) || !snapshot.visited.length){
          snapshot.visited = [1];
        }
        return snapshot;
      }

      function threadModulesFromSnapshot(snapshot, opts){
        const snap = (snapshot && typeof snapshot === 'object') ? snapshot : {};
        const cfg = (opts && typeof opts === 'object') ? opts : {};
        const outcomes = Array.isArray(cfg.outcomes)
          ? cfg.outcomes.map((item)=> String(item || '').trim()).filter(Boolean)
          : [];
        const outcomesText = String(cfg.outcomesText || (outcomes.length ? outcomes.join(' · ') : '')).trim();
        const sizeMap = {
          lt500:'< 500 employees',
          '500-2k':'500–2,000 employees',
          '2k-10k':'2,000–10,000 employees',
          '10k-50k':'10,000–50,000 employees',
          '50kplus':'50,000+ employees'
        };
        const regionLabels = { NA:'North America', UKI:'UK & Ireland', EU:'Europe (EU)', APAC:'APAC', Other:'Other / Global' };
        const pressureLabels = dashLabelsFromIds(snap.pressureSources, pressureOpts.map((p)=> ({ id:p.id, label:p.title })));
        const riskLabels = dashLabelsFromIds(snap.riskEnvs, riskEnvOpts.map((r)=> ({ id:r.id, label:r.title })));
        const driverLabels = dashLabelsFromIds(snap.drivers, driverOpts.map((d)=> ({ id:d.id, label:d.title })));
        const evidenceLabels = dashLabelsFromIds(snap.evidence, evidenceOpts);
        const groupLabels = dashLabelsFromIds(snap.groups, groupOpts);
        const regLabels = dashLabelsFromIds(snap.regs, regMaster);
        const stackLabels = dashLabelsFromIds(snap.stack, stackMaster);
        if(String(snap.stackOther || '').trim()) stackLabels.push(String(snap.stackOther).trim());

        return {
          organisation: [
            { label:'Name', value: String(snap.fullName || '').trim() || '—' },
            { label:'Company', value: String(snap.company || '').trim() || '—' },
            { label:'Role', value: optionLabel(roleOpts, snap.role) },
            { label:'Company size', value: snap.companySize ? (sizeMap[snap.companySize] || snap.companySize) : '—' },
            { label:'Operating country', value: String(snap.operatingCountry || '').trim() || '—' }
          ],
          discovery: [
            { label:'Pressure sources', value: listOrDash(pressureLabels) },
            { label:'Urgent win', value: optionLabel(urgentWinOpts, snap.urgentWin) },
            { label:'Risk environment', value: listOrDash(riskLabels) },
            { label:'Measured on today', value: optionLabel(measuredOnOpts, snap.measuredOn) },
            { label:'Organisation challenge', value: optionLabel(orgPainOpts, snap.orgPain) },
            { label:'Conversation triggers', value: listOrDash(driverLabels) },
            { label:'Evidence audience', value: listOrDash(evidenceLabels) },
            { label:'Primary outcomes', value: outcomesText || '—' }
          ],
          coverage: [
            { label:'Coverage groups', value: listOrDash(groupLabels) },
            { label:'Cadence', value: optionLabel(rhythmOpts, snap.rhythm) },
            { label:'Measurement', value: optionLabel(measureOpts, snap.measure) }
          ],
          packageFit: [
            { label:'Realism', value: optionLabel(fitRealismOpts, snap.fitRealism) },
            { label:'Scope', value: optionLabel(fitScopeOpts, snap.fitScope) },
            { label:'Current state', value: optionLabel(fitTodayOpts, snap.fitToday) },
            { label:'Delivery model', value: optionLabel(fitServicesOpts, snap.fitServices) },
            { label:'Risk frame', value: optionLabel(fitRiskFrameOpts, snap.fitRiskFrame) }
          ],
          context: [
            { label:'Industry', value: String(snap.industry || '').trim() || '—' },
            { label:'Region', value: snap.region ? (regionLabels[snap.region] || snap.region) : '—' },
            { label:'Regulatory references', value: listOrDash(regLabels) },
            { label:'Tools / stack', value: listOrDash(stackLabels) }
          ]
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
            collaborators: [
              { userId:'email:will.bloor@immersivelabs.com', name:'Will Bloor', email:'will.bloor@immersivelabs.com' },
              { userId:'email:alex.morgan@immersivelabs.com', name:'Alex Morgan', email:'alex.morgan@immersivelabs.com' }
            ],
            shareAccess: 'workspace-editor',
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
	              activeStep: reviewStepNumber(),
	              visited: allConfiguratorStepNumbers()
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
	              activeStep: reviewStepNumber(),
	              visited: allConfiguratorStepNumbers()
	            }
	          },
	          {
	            id: 'arclight',
	            company: 'Arclight Retail',
	            stage: 'Discovery',
	            completion: '8/22 (36%)',
	            tier: 'Core',
	            collaborators: [
	              { userId:'email:will.bloor@immersivelabs.com', name:'Will Bloor', email:'will.bloor@immersivelabs.com' },
	              { userId:'email:jordan.lee@immersivelabs.com', name:'Jordan Lee', email:'jordan.lee@immersivelabs.com' },
	              { userId:'email:wendy.barker@immersivelabs.com', name:'Wendy Barker', email:'wendy.barker@immersivelabs.com' }
	            ],
	            shareAccess: 'workspace-viewer',
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
	            collaborators: [
	              { userId:'email:will.bloor@immersivelabs.com', name:'Will Bloor', email:'will.bloor@immersivelabs.com' },
	              { userId:'email:jess.lawson@immersivelabs.com', name:'Jess Lawson', email:'jess.lawson@immersivelabs.com' }
	            ],
	            shareAccess: 'workspace-editor',
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
        const base = staticThreadModels().map((thread)=> {
          const snapshotSeed = staticThreadSnapshotSeed(thread && thread.id, thread && thread.company);
          const snapshot = mergeSnapshotWithSeed(
            (thread && thread.snapshot && typeof thread.snapshot === 'object')
              ? thread.snapshot
              : defaultSnapshotForThread(thread),
            snapshotSeed,
            thread && thread.company
          );
          return Object.assign({}, thread, { snapshot });
        });
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
              workspaceRole: 'owner',
              permissionTestMode: 'live',
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
              workspaceRole: 'owner',
              permissionTestMode: 'live',
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
        state.recordSeenVersions = Object.create(null);
        state.collaborationNoticeTitle = '';
        state.collaborationNoticeBody = '';
        state.collaborationNoticeTone = 'info';
        state.collaborationNoticeRecordId = '';
        state.collaborationNoticeUntil = 0;
        state.recordReadOnly = false;
        state.lockReacquirePending = false;
      }

      function initializeRecordSeenVersions(rows, opts){
        const cfg = Object.assign({
          seedUnreadTest: false,
          unreadCount: DEFAULT_UNREAD_TEST_RECORD_COUNT
        }, opts || {});
        const list = Array.isArray(rows) ? rows : [];
        if(!list.length) return;
        if(!state.recordSeenVersions || typeof state.recordSeenVersions !== 'object'){
          state.recordSeenVersions = Object.create(null);
        }
        const seenMap = state.recordSeenVersions;
        const hasSeenEntries = Object.keys(seenMap).length > 0;
        list.forEach((thread)=>{
          const threadId = String((thread && thread.id) || '').trim();
          if(!threadId) return;
          const version = Math.max(1, Number(thread && thread.version) || 1);
          if(!Object.prototype.hasOwnProperty.call(seenMap, threadId)){
            seenMap[threadId] = version;
          }
        });
        if(!cfg.seedUnreadTest || hasSeenEntries) return;
        const unreadCount = Math.max(0, Math.floor(Number(cfg.unreadCount) || 0));
        if(!unreadCount) return;
        const ranked = list
          .filter((thread)=> thread && !thread.archived)
          .slice()
          .sort((left, right)=> {
            const byUpdated = Number(right && right.updatedAt || 0) - Number(left && left.updatedAt || 0);
            if(byUpdated !== 0) return byUpdated;
            return String((left && left.id) || '').localeCompare(String((right && right.id) || ''));
          });
        ranked.slice(0, unreadCount).forEach((thread)=> {
          const threadId = String((thread && thread.id) || '').trim();
          if(!threadId) return;
          const version = Math.max(1, Number(thread && thread.version) || 1);
          seenMap[threadId] = Math.max(0, version - 1);
        });
      }

      function refreshSavedThreadsFromStore(opts){
        const cfg = Object.assign({ external:false, render:false }, opts || {});
        const prevById = new Map((state.savedThreads || []).map((thread)=> [String((thread && thread.id) || ''), thread]));
        const nextRows = recordStore.list().map((thread, idx)=> normalizeThreadModel(thread, idx));
        state.savedThreads = nextRows;
        state.savedThreadsLoaded = true;
        initializeRecordSeenVersions(nextRows, { seedUnreadTest:false });

        if(cfg.external){
          const activeId = String(state.activeThread || '').trim();
          if(activeId && activeId !== 'current'){
            const prevThread = prevById.get(activeId) || null;
            const nextThread = nextRows.find((thread)=> thread.id === activeId) || null;
            if(nextThread){
              const prevVersion = Math.max(0, Number(prevThread && prevThread.version) || 0);
              const nextVersion = Math.max(0, Number(nextThread.version) || 0);
              const actor = activeCollaboratorIdentity();
              const nextById = String(nextThread.updatedById || '').trim();
              const nextByName = String(nextThread.updatedBy || '').trim();
              const fromOther = nextById
                ? (nextById !== String(actor.userId || '').trim())
                : (nextByName && nextByName !== String(actor.displayName || '').trim());
              if(nextVersion > prevVersion && fromOther){
                setCollaborationNotice(
                  'info',
                  'New update available',
                  `Saved by ${nextThread.updatedBy || 'another collaborator'} at ${formatDashboardDate(nextThread.updatedAt)}.`,
                  activeId,
                  18000
                );
              }
            }
          }
        }
        if(cfg.render){
          update();
        }
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
          thread.recordId = nextId;
          used.add(nextId);
        });

        state.savedThreads = normalized;
        applyDefaultActorRoleMix(state.savedThreads, { force:false });
        state.savedThreadsLoaded = true;
        const firstActive = normalized.find((thread)=> !thread.archived) || normalized[0] || null;
        state.activeThread = firstActive ? firstActive.id : 'current';
        resetWorkspaceUiStateCaches();
        initializeRecordSeenVersions(normalized, { seedUnreadTest:true });
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

      function csvSafeCellValue(value){
        const text = String(value ?? '')
          .replace(/\r\n/g, '\n')
          .replace(/\r/g, '\n');
        const leftTrimmed = text.replace(/^[\u0000-\u0020]+/, '');
        const looksLikeFormula = (
          /^[=+@]/.test(leftTrimmed)
          || (/^-/.test(leftTrimmed) && !/^-?\d+(\.\d+)?$/.test(leftTrimmed))
        );
        return looksLikeFormula ? `'${text}` : text;
      }

      function csvEscapedCell(value){
        const safe = csvSafeCellValue(value);
        if(/[",\n]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
        return safe;
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
          const lockOwner = (thread && thread.lockOwner && typeof thread.lockOwner === 'object')
            ? thread.lockOwner
            : null;
          const collaborators = threadCollaborators(thread);
          return {
            record_id: thread.id,
            workspace_id: thread.workspaceId || DEFAULT_WORKSPACE_ID,
            schema_version: thread.schemaVersion || RECORD_SCHEMA_VERSION,
            version: Number(thread.version) || 1,
            updated_by: thread.updatedBy || '',
            updated_by_id: thread.updatedById || '',
            updated_by_email: thread.updatedByEmail || '',
            share_access: resolveShareAccess(thread.shareAccess),
            collaborators_count: collaborators.length,
            collaborators_json: toJson(collaborators),
            collaborators_emails: join(collaborators.map((row)=> row && row.email).filter(Boolean)),
            lock_owner_name: lockOwner ? String(lockOwner.name || '') : '',
            lock_owner_user_id: lockOwner ? String(lockOwner.userId || '') : '',
            lock_expires_at: Number(thread.lockExpiresAt) ? new Date(Number(thread.lockExpiresAt)).toISOString() : '',
            company: thread.company,
            stage: thread.stage,
            completion: progress.completion,
            tier: thread.tier,
            open_gaps: (progress.gaps || []).length,
            gap_summary: progress.gapSummary,
            priority: bool(thread.priority),
            archived: bool(thread.archived),
            outcomes: join(thread.outcomes || []),
            created_at: thread.createdAt ? new Date(thread.createdAt).toISOString() : '',
            updated_at: thread.updatedAt ? new Date(thread.updatedAt).toISOString() : '',

            full_name: snapshot.fullName || '',
            config_mode: resolveConfiguratorFieldMode(snapshot.fieldMode || 'guided'),
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

        const header = cols.map((col)=> csvEscapedCell(col)).join(',');
        const lines = table.map((row)=> cols.map((col)=> csvEscapedCell(row[col])).join(','));
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

      function normalizeCrmExportScope(raw){
        const value = String(raw || '').trim().toLowerCase();
        if(value === 'selected') return 'selected';
        if(value === 'all') return 'all';
        return 'active';
      }

      function splitDisplayName(fullName){
        const normalized = String(fullName || '').trim().replace(/\s+/g, ' ');
        if(!normalized) return { firstName:'', lastName:'Unknown' };
        const parts = normalized.split(' ');
        if(parts.length <= 1){
          return { firstName: normalized, lastName:'Unknown' };
        }
        return {
          firstName: parts.slice(0, -1).join(' '),
          lastName: parts[parts.length - 1]
        };
      }

      function csvFromRowObjects(rows, cols){
        const list = Array.isArray(rows) ? rows : [];
        if(!list.length) return '';
        const columns = (Array.isArray(cols) && cols.length)
          ? cols.slice()
          : Array.from(new Set(list.flatMap((row)=> Object.keys(row || {}))));
        if(!columns.length) return '';
        const header = columns.map((col)=> csvEscapedCell(col)).join(',');
        const body = list.map((row)=> columns.map((col)=> csvEscapedCell(row && row[col])).join(',')).join('\n');
        return `${header}\n${body}\n`;
      }

      function crmPreviewFromRows(rows){
        const first = (Array.isArray(rows) && rows.length) ? rows[0] : null;
        if(!first) return 'No record selected.';
        try{
          return JSON.stringify(first, null, 2);
        }catch(err){
          return 'Preview unavailable.';
        }
      }

      function hasMeaningfulCurrentSnapshot(snapshot){
        const snap = (snapshot && typeof snapshot === 'object') ? snapshot : {};
        return !!(
          String(snap.fullName || '').trim()
          || String(snap.company || '').trim()
          || String(snap.email || '').trim()
          || String(snap.phone || '').trim()
          || String(snap.role || '').trim()
          || (Array.isArray(snap.pressureSources) && snap.pressureSources.length)
          || (Array.isArray(snap.drivers) && snap.drivers.length)
          || (Array.isArray(snap.groups) && snap.groups.length)
          || (Array.isArray(snap.regs) && snap.regs.length)
        );
      }

      function crmExportThreadCandidates(){
        const out = [];
        const seen = new Set();
        const pushThread = (thread)=>{
          if(!thread || typeof thread !== 'object') return;
          const id = String((thread.recordId || thread.id) || '').trim() || 'current';
          if(seen.has(id)) return;
          seen.add(id);
          out.push(thread);
        };

        const activeId = String(state.activeThread || '').trim();
        if(activeId === 'current'){
          pushThread(currentThreadModel());
        }else if(activeId){
          const saved = findSavedThread(activeId);
          if(saved) pushThread(saved);
        }

        const currentSnapshot = buildThreadSnapshotFromState();
        if(hasMeaningfulCurrentSnapshot(currentSnapshot)){
          pushThread(currentThreadModel());
        }

        threadModels().forEach((thread)=> pushThread(thread));
        return out;
      }

      function resolveCrmExportThreadById(threadId){
        const target = String(threadId || '').trim() || 'current';
        if(target === 'current') return currentThreadModel();
        return findSavedThread(target);
      }

      function crmExportScopeThreads(){
        const scope = normalizeCrmExportScope(state.crmExportScope);
        const selectedId = String(state.crmExportRecordId || '').trim() || 'current';
        if(scope === 'all'){
          const rows = threadModels();
          if(rows.length) return rows;
          const currentSnapshot = buildThreadSnapshotFromState();
          return hasMeaningfulCurrentSnapshot(currentSnapshot) ? [currentThreadModel()] : [];
        }
        if(scope === 'selected'){
          const target = resolveCrmExportThreadById(selectedId);
          if(target) return [target];
          return [];
        }
        const activeId = String(state.activeThread || '').trim() || 'current';
        const target = resolveCrmExportThreadById(activeId);
        return target ? [target] : [];
      }

      function crmExportThreadLabel(thread){
        const target = (thread && typeof thread === 'object') ? thread : {};
        const id = String((target.recordId || target.id) || 'current').trim() || 'current';
        const company = String(target.company || '').trim() || (id === 'current' ? 'Current draft' : 'Untitled company');
        const completion = String(threadReadinessProgress(target).completion || '').trim() || '0/0 (0%)';
        const tier = String(target.tier || '').trim() || 'Core';
        return `${company} · ${completion} · ${tier}`;
      }

      function crmExportCanonicalRows(threads){
        const list = Array.isArray(threads) ? threads : [];
        const regionLabels = { NA:'North America', UKI:'UK & Ireland', EU:'Europe (EU)', APAC:'APAC', Other:'Other / Global' };
        const join = (items)=> (Array.isArray(items) ? items : []).map((item)=> String(item || '').trim()).filter(Boolean).join(' | ');
        const nowIso = new Date().toISOString();

        return list.map((thread)=>{
          const target = (thread && typeof thread === 'object') ? thread : {};
          const id = String((target.recordId || target.id) || 'current').trim() || 'current';
          const snapshot = id === 'current'
            ? buildThreadSnapshotFromState()
            : ((target.snapshot && typeof target.snapshot === 'object') ? target.snapshot : defaultSnapshotForThread(target));
          const progress = threadReadinessProgress(target);
          const completion = String(progress.completion || '').trim() || '0/0 (0%)';
          const completionPct = completionPctFromSummary(completion);
          const viz = id === 'current'
            ? buildSavedVizFromState()
            : ((target.viz && typeof target.viz === 'object') ? target.viz : {});
          const outcomes = inferredConsultationOutcomes(target)
            .map((row)=> String((row && (row.short || row.label)) || '').trim())
            .filter(Boolean)
            .slice(0, 3);
          const pressureSourceLabels = dashLabelsFromIds(snapshot.pressureSources, pressureOpts.map((opt)=> ({ id:opt.id, label:opt.title })));
          const driverLabels = dashLabelsFromIds(snapshot.drivers, driverOpts.map((opt)=> ({ id:opt.id, label:opt.title })));
          const evidenceLabels = dashLabelsFromIds(snapshot.evidence, evidenceOpts);
          const groupLabels = dashLabelsFromIds(snapshot.groups, groupOpts);
          const names = splitDisplayName(snapshot.fullName || '');
          const roleLabel = optionLabel(roleOpts, snapshot.role);
          const urgentWinLabel = optionLabel(urgentWinOpts, snapshot.urgentWin);
          const cadenceLabel = optionLabel(rhythmOpts, snapshot.rhythm);
          const measureLabel = optionLabel(measureOpts, snapshot.measure);

          return {
            record_id: id,
            workspace_id: String(target.workspaceId || DEFAULT_WORKSPACE_ID).trim() || DEFAULT_WORKSPACE_ID,
            schema_version: String(target.schemaVersion || RECORD_SCHEMA_VERSION).trim() || RECORD_SCHEMA_VERSION,
            exported_at: nowIso,
            updated_at: Number(target.updatedAt) ? new Date(Number(target.updatedAt)).toISOString() : '',
            company: String((snapshot.company || target.company || '')).trim(),
            full_name: String(snapshot.fullName || '').trim(),
            first_name: names.firstName,
            last_name: names.lastName,
            email: String(snapshot.email || '').trim(),
            phone: String(snapshot.phone || '').trim(),
            role: String(roleLabel || snapshot.role || '').trim(),
            company_size: String(snapshot.companySize || '').trim(),
            operating_country: String(snapshot.operatingCountry || '').trim(),
            industry: String(snapshot.industry || '').trim(),
            region: String(snapshot.region ? (regionLabels[snapshot.region] || snapshot.region) : '').trim(),
            package_tier: String(target.tier || dashboardTierName()).trim() || 'Core',
            completion_summary: completion,
            completion_pct: completionPct,
            primary_outcomes: join(outcomes.length ? outcomes : (Array.isArray(target.outcomes) ? target.outcomes : [])),
            pressure_sources: join(pressureSourceLabels),
            urgent_win: String(urgentWinLabel || '').trim(),
            drivers: join(driverLabels),
            evidence_audience: join(evidenceLabels),
            coverage_groups: join(groupLabels),
            cadence: String(cadenceLabel || '').trim(),
            measurement: String(measureLabel || '').trim(),
            fit_scope: String(optionLabel(fitScopeOpts, snapshot.fitScope) || snapshot.fitScope || '').trim(),
            fit_realism: String(optionLabel(fitRealismOpts, snapshot.fitRealism) || snapshot.fitRealism || '').trim(),
            fit_services: String(optionLabel(fitServicesOpts, snapshot.fitServices) || snapshot.fitServices || '').trim(),
            fit_risk_frame: String(optionLabel(fitRiskFrameOpts, snapshot.fitRiskFrame) || snapshot.fitRiskFrame || '').trim(),
            roi_pct_3yr: Number(viz.roiPct) || 0,
            npv_usd_3yr: Number(viz.npv) || 0,
            payback_months: (viz.paybackMonths === null || viz.paybackMonths === undefined) ? '' : Number(viz.paybackMonths),
            share_access: String(resolveShareAccess(target.shareAccess || 'workspace-viewer')).trim(),
            collaborators_count: Array.isArray(target.collaborators) ? target.collaborators.length : 0
          };
        });
      }

      const HUBSPOT_EXPORT_COLUMNS = Object.freeze([
        'Email',
        'First Name',
        'Last Name',
        'Phone Number',
        'Company Name',
        'Job Title',
        'Country/Region',
        'Readiness Record ID',
        'Readiness Package',
        'Readiness Completion',
        'Readiness Primary Outcomes',
        'Readiness Urgent Win',
        'Readiness Drivers',
        'Readiness Evidence Audience',
        'Readiness ROI 3Y',
        'Readiness NPV 3Y USD',
        'Readiness Payback Months',
        'Readiness Exported At'
      ]);

      function hubspotRowsFromCanonical(rows){
        return (Array.isArray(rows) ? rows : []).map((row)=> ({
          'Email': row.email || '',
          'First Name': row.first_name || '',
          'Last Name': row.last_name || 'Unknown',
          'Phone Number': row.phone || '',
          'Company Name': row.company || '',
          'Job Title': row.role || '',
          'Country/Region': row.operating_country || row.region || '',
          'Readiness Record ID': row.record_id || '',
          'Readiness Package': row.package_tier || '',
          'Readiness Completion': row.completion_summary || '',
          'Readiness Primary Outcomes': row.primary_outcomes || '',
          'Readiness Urgent Win': row.urgent_win || '',
          'Readiness Drivers': row.drivers || '',
          'Readiness Evidence Audience': row.evidence_audience || '',
          'Readiness ROI 3Y': row.roi_pct_3yr,
          'Readiness NPV 3Y USD': row.npv_usd_3yr,
          'Readiness Payback Months': row.payback_months,
          'Readiness Exported At': row.exported_at || ''
        }));
      }

      const SALESFORCE_EXPORT_COLUMNS = Object.freeze([
        'External_Record_Id__c',
        'Workspace_Id__c',
        'FirstName',
        'LastName',
        'Email',
        'Phone',
        'Company',
        'Title',
        'Country',
        'Industry',
        'Immersive_Package__c',
        'Immersive_Completion__c',
        'Immersive_Primary_Outcomes__c',
        'Immersive_Urgent_Win__c',
        'Immersive_Drivers__c',
        'Immersive_Evidence_Audience__c',
        'Immersive_ROI_3Y__c',
        'Immersive_NPV_3Y_USD__c',
        'Immersive_Payback_Months__c',
        'Immersive_Exported_At__c'
      ]);

      function salesforceRowsFromCanonical(rows){
        return (Array.isArray(rows) ? rows : []).map((row)=> ({
          'External_Record_Id__c': row.record_id || '',
          'Workspace_Id__c': row.workspace_id || '',
          'FirstName': row.first_name || '',
          'LastName': row.last_name || 'Unknown',
          'Email': row.email || '',
          'Phone': row.phone || '',
          'Company': row.company || '',
          'Title': row.role || '',
          'Country': row.operating_country || row.region || '',
          'Industry': row.industry || '',
          'Immersive_Package__c': row.package_tier || '',
          'Immersive_Completion__c': row.completion_summary || '',
          'Immersive_Primary_Outcomes__c': row.primary_outcomes || '',
          'Immersive_Urgent_Win__c': row.urgent_win || '',
          'Immersive_Drivers__c': row.drivers || '',
          'Immersive_Evidence_Audience__c': row.evidence_audience || '',
          'Immersive_ROI_3Y__c': row.roi_pct_3yr,
          'Immersive_NPV_3Y_USD__c': row.npv_usd_3yr,
          'Immersive_Payback_Months__c': row.payback_months,
          'Immersive_Exported_At__c': row.exported_at || ''
        }));
      }

      function renderCrmExportView(){
        const shell = $('#crmExportView');
        if(!shell) return;
        const scopeSelect = $('#crmExportScope');
        const recordSelect = $('#crmExportRecord');
        const recordField = $('#crmExportRecordField');
        const countPill = $('#crmExportCount');
        const targetPill = $('#crmExportTarget');
        const previewHubspot = $('#crmExportPreviewHubspot');
        const previewSalesforce = $('#crmExportPreviewSalesforce');
        const hint = $('#crmExportHint');

        const scope = normalizeCrmExportScope(state.crmExportScope);
        state.crmExportScope = scope;
        const candidates = crmExportThreadCandidates();
        if(!state.crmExportRecordId || !resolveCrmExportThreadById(state.crmExportRecordId)){
          const activeId = String(state.activeThread || '').trim() || 'current';
          state.crmExportRecordId = activeId;
        }

        if(scopeSelect){
          scopeSelect.value = scope;
        }
        if(recordSelect){
          const options = candidates.map((thread)=>{
            const id = String((thread && (thread.recordId || thread.id)) || 'current').trim() || 'current';
            return `<option value="${escapeHtml(id)}">${escapeHtml(crmExportThreadLabel(thread))}</option>`;
          });
          recordSelect.innerHTML = options.join('');
          const fallbackId = options.length ? String(candidates[0].recordId || candidates[0].id || 'current') : 'current';
          const selectedId = String(state.crmExportRecordId || fallbackId || 'current').trim() || 'current';
          recordSelect.value = selectedId;
          if(recordSelect.value !== selectedId){
            recordSelect.value = fallbackId;
            state.crmExportRecordId = fallbackId;
          }
          recordSelect.disabled = scope !== 'selected';
        }
        if(recordField){
          recordField.style.opacity = scope === 'selected' ? '1' : '.6';
        }

        const selectedThreads = crmExportScopeThreads();
        const canonicalRows = crmExportCanonicalRows(selectedThreads);
        const hubspotRows = hubspotRowsFromCanonical(canonicalRows);
        const salesforceRows = salesforceRowsFromCanonical(canonicalRows);
        const targetText = selectedThreads.length === 1
          ? crmExportThreadLabel(selectedThreads[0])
          : `${selectedThreads.length} records`;

        if(countPill){
          countPill.textContent = `Records: ${selectedThreads.length}`;
        }
        if(targetPill){
          targetPill.textContent = `Target: ${targetText || '—'}`;
        }
        if(previewHubspot){
          previewHubspot.textContent = crmPreviewFromRows(hubspotRows);
        }
        if(previewSalesforce){
          previewSalesforce.textContent = crmPreviewFromRows(salesforceRows);
        }
        if(hint){
          hint.textContent = selectedThreads.length
            ? 'HubSpot is the default export path (contact/company mapping). Salesforce remains available in Advanced when you need lead/object template output.'
            : 'No records available yet. Save a record first, then export.';
        }
      }

      function openCrmExportView(preferredThreadId){
        const incomingId = String(preferredThreadId || '').trim();
        const nextId = incomingId || String(state.activeThread || '').trim() || 'current';
        if(nextId === 'current'){
          state.activeThread = 'current';
          state.crmExportRecordId = 'current';
        }else{
          const found = findSavedThread(nextId);
          if(found){
            state.activeThread = nextId;
            state.crmExportRecordId = nextId;
          }
        }
        state.crmExportScope = normalizeCrmExportScope(state.crmExportScope || 'active');
        renderCrmExportView();
        setView('export');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      function downloadHubspotCrmCsv(){
        const rows = crmExportCanonicalRows(crmExportScopeThreads());
        if(!rows.length){
          toast('No records available to export.');
          return;
        }
        const mapped = hubspotRowsFromCanonical(rows);
        const csv = csvFromRowObjects(mapped, HUBSPOT_EXPORT_COLUMNS);
        if(!csv){
          toast('No records available to export.');
          return;
        }
        const day = new Date().toISOString().slice(0, 10);
        const filename = `hubspot-readiness-export-${day}.csv`;
        downloadText(csv, filename, 'text/csv;charset=utf-8;');
        toast(`Exported HubSpot CSV (${rows.length} record${rows.length === 1 ? '' : 's'}).`);
      }

      function downloadSalesforceCrmCsv(){
        const rows = crmExportCanonicalRows(crmExportScopeThreads());
        if(!rows.length){
          toast('No records available to export.');
          return;
        }
        const mapped = salesforceRowsFromCanonical(rows);
        const csv = csvFromRowObjects(mapped, SALESFORCE_EXPORT_COLUMNS);
        if(!csv){
          toast('No records available to export.');
          return;
        }
        const day = new Date().toISOString().slice(0, 10);
        const filename = `salesforce-readiness-export-${day}.csv`;
        downloadText(csv, filename, 'text/csv;charset=utf-8;');
        toast(`Exported Salesforce CSV (${rows.length} record${rows.length === 1 ? '' : 's'}).`);
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

        const fail = (message)=> {
          throw new Error(message);
        };
        const pushCell = ()=>{
          if(cell.length > MAX_IMPORT_CSV_CELL_CHARS){
            fail(`CSV cell exceeds ${MAX_IMPORT_CSV_CELL_CHARS} characters.`);
          }
          row.push(cell);
          cell = '';
          if(row.length > MAX_IMPORT_CSV_COLUMNS){
            fail(`CSV row exceeds ${MAX_IMPORT_CSV_COLUMNS} columns.`);
          }
        };
        const pushRow = ()=>{
          rows.push(row);
          row = [];
          if(rows.length > MAX_IMPORT_CSV_ROWS){
            fail(`CSV has more than ${MAX_IMPORT_CSV_ROWS} rows.`);
          }
        };

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
            if(cell.length > MAX_IMPORT_CSV_CELL_CHARS){
              fail(`CSV cell exceeds ${MAX_IMPORT_CSV_CELL_CHARS} characters.`);
            }
            idx += 1;
            continue;
          }

          if(ch === '"'){
            inQuotes = true;
            idx += 1;
            continue;
          }
          if(ch === ','){
            pushCell();
            idx += 1;
            continue;
          }
          if(ch === '\n'){
            pushCell();
            pushRow();
            idx += 1;
            continue;
          }
          if(ch === '\r'){
            idx += 1;
            continue;
          }
          cell += ch;
          if(cell.length > MAX_IMPORT_CSV_CELL_CHARS){
            fail(`CSV cell exceeds ${MAX_IMPORT_CSV_CELL_CHARS} characters.`);
          }
          idx += 1;
        }

        if(inQuotes){
          fail('CSV appears malformed (unterminated quoted value).');
        }

        pushCell();
        if(row.length > 1 || row[0] !== '' || rows.length === 0){
          pushRow();
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
            step: clampQuestionStep(Number(gap && gap.step) || 1)
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

      function sanitizeImportedThreadAuthority(rawThread, idx){
        const source = (rawThread && typeof rawThread === 'object' && !Array.isArray(rawThread))
          ? rawThread
          : {};
        const snapshot = (source.snapshot && typeof source.snapshot === 'object' && !Array.isArray(source.snapshot))
          ? source.snapshot
          : {};
        const fallbackUpdatedBy = String(
          source.updatedBy
          || snapshot.fullName
          || snapshot.email
          || `Imported record ${idx + 1}`
        ).trim() || `Imported record ${idx + 1}`;
        return Object.assign({}, source, {
          workspaceId: DEFAULT_WORKSPACE_ID,
          updatedBy: fallbackUpdatedBy,
          updatedById: '',
          updatedByEmail: '',
          shareAccess: 'workspace-viewer',
          collaborators: [],
          lockOwner: null,
          lockExpiresAt: 0
        });
      }

      function csvThreadFromRow(row, idx){
        const recordJson = csvTryJson(csvRowValue(row, ['record_json']));
        if(recordJson && typeof recordJson === 'object' && !Array.isArray(recordJson)){
          return sanitizeImportedThreadAuthority(recordJson, idx);
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
              fieldMode: resolveConfiguratorFieldMode(csvRowValue(row, ['config_mode', 'field_mode', 'mode'])),
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
        snapshot.fieldMode = resolveConfiguratorFieldMode(snapshot.fieldMode || csvRowValue(row, ['config_mode', 'field_mode', 'mode']));

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

        const createdRaw = csvRowValue(row, ['created_at', 'date_created', 'created']);
        const updatedRaw = csvRowValue(row, ['updated_at', 'last_updated', 'date_modified', 'modified']);
        const createdAt = coerceTimestamp(createdRaw);
        const updatedAt = coerceTimestamp(updatedRaw) || Date.now() - (idx * 60000);
        const idFromCsv = String(csvRowValue(row, ['record_id', 'id']) || `imported-${idx + 1}`).trim();
        const workspaceId = String(csvRowValue(row, ['workspace_id']) || DEFAULT_WORKSPACE_ID).trim() || DEFAULT_WORKSPACE_ID;
        const version = Math.max(1, Math.floor(Number(csvRowValue(row, ['version'])) || 1));
        const updatedBy = String(csvRowValue(row, ['updated_by']) || snapshot.fullName || '').trim() || 'Unknown collaborator';
        const importedThread = {
          id: idFromCsv || `imported-${idx + 1}`,
          recordId: idFromCsv || `imported-${idx + 1}`,
          workspaceId: workspaceId || DEFAULT_WORKSPACE_ID,
          schemaVersion: String(csvRowValue(row, ['schema_version']) || RECORD_SCHEMA_VERSION).trim() || RECORD_SCHEMA_VERSION,
          version,
          updatedBy,
          updatedById: '',
          updatedByEmail: '',
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
          createdAt,
          updatedAt,
          priority: csvBoolValue(csvRowValue(row, ['priority', 'starred'])),
          archived: csvBoolValue(csvRowValue(row, ['archived'])),
          archivedAt: 0,
          shareAccess: 'workspace-viewer',
          collaborators: [],
          lockOwner: null,
          lockExpiresAt: 0
        };
        return sanitizeImportedThreadAuthority(importedThread, idx);
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
        if(Number(src.size || 0) > MAX_IMPORT_CSV_BYTES){
          toast('CSV is too large. Use a file under 5 MB.');
          return;
        }
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

      const DEMO_RECORD_ANCHOR_TS = Number(new Date('2026-02-21T12:00:00Z').getTime()) || Date.now();

      function coerceTimestamp(value){
        const numeric = Number(value);
        if(Number.isFinite(numeric) && numeric > 0) return numeric;
        const parsed = Number(new Date(String(value || '')).getTime());
        if(Number.isFinite(parsed) && parsed > 0) return parsed;
        return 0;
      }

      function seededThreadUpdatedAt(idx){
        const i = Math.max(0, Number(idx) || 0);
        return DEMO_RECORD_ANCHOR_TS - ((i + 1) * 8 * 3600 * 1000);
      }

      function seededThreadCreatedAt(updatedAt, idx){
        const i = Math.max(0, Number(idx) || 0);
        const lifespanDays = 2 + (i % 6);
        return Math.max(0, Number(updatedAt || 0) - (lifespanDays * 24 * 3600 * 1000));
      }

      function defaultSnapshotForThread(thread){
        const firstGap = Number(thread && thread.gaps && thread.gaps[0] && thread.gaps[0].step);
        return {
          fieldMode: resolveConfiguratorFieldMode((thread && thread.fieldMode) || state.fieldMode || accountFieldModeValue()),
          fullName: '',
          company: (thread && thread.company) ? String(thread.company) : 'Record',
          role: '',
          activeStep: clampQuestionStep(Number.isFinite(firstGap) ? firstGap : 1),
          visited: [1]
        };
      }

      function normalizeThreadModel(raw, idx){
        const source = (raw && typeof raw === 'object') ? raw : {};
        const sourceCompany = String(source.company || (source.snapshot && source.snapshot.company) || 'Record');
        const normalizedId = String(source.recordId || source.id || `record-${idx + 1}`).trim() || `record-${idx + 1}`;
        const outcomes = Array.isArray(source.outcomes)
          ? source.outcomes.map((it)=> String(it || '').trim()).filter(Boolean)
          : [];
        const outcomesText = String(source.outcomesText || (outcomes.length ? outcomes.join(' · ') : 'Awaiting outcome signals'));
        const gaps = Array.isArray(source.gaps)
          ? source.gaps.map((gap)=> ({
              title: String((gap && gap.title) || 'Gap'),
              why: String((gap && gap.why) || ''),
              step: clampQuestionStep(Number(gap && gap.step) || 1)
            }))
          : [];
        const vizIn = (source.viz && typeof source.viz === 'object') ? source.viz : {};
        const snapshotSeed = staticThreadSnapshotSeed(source.recordId || source.id || normalizedId, sourceCompany);
        const snapshot = mergeSnapshotWithSeed(
          (source.snapshot && typeof source.snapshot === 'object')
            ? source.snapshot
            : defaultSnapshotForThread({ company: sourceCompany, completion: source.completion, gaps }),
          snapshotSeed,
          sourceCompany
        );
        snapshot.fieldMode = resolveConfiguratorFieldMode(snapshot.fieldMode || 'guided');
        const progress = readinessProgressFromContext(snapshot);
        const modules = threadModulesFromSnapshot(snapshot, { outcomes, outcomesText });
        const company = String(snapshot.company || sourceCompany || 'Record');
        const sourceUpdatedAt = coerceTimestamp(source.updatedAt);
        const sourceCreatedAt = coerceTimestamp(source.createdAt);
        const updatedAt = sourceUpdatedAt || seededThreadUpdatedAt(idx);
        const createdAt = sourceCreatedAt || seededThreadCreatedAt(updatedAt, idx);
        const normalizedCreatedAt = Math.min(createdAt, updatedAt);
        const workspaceId = String(source.workspaceId || DEFAULT_WORKSPACE_ID).trim() || DEFAULT_WORKSPACE_ID;
        const version = Math.max(1, Math.floor(Number(source.version) || 1));
        const updatedBy = String(source.updatedBy || snapshot.fullName || 'Unknown collaborator').trim() || 'Unknown collaborator';
        const updatedById = String(source.updatedById || '').trim();
        const updatedByEmail = String(source.updatedByEmail || '').trim();
        const lockOwnerRaw = (source.lockOwner && typeof source.lockOwner === 'object' && !Array.isArray(source.lockOwner))
          ? source.lockOwner
          : null;
        const lockOwner = lockOwnerRaw
          ? {
              userId: String(lockOwnerRaw.userId || '').trim(),
              name: String(lockOwnerRaw.name || '').trim(),
              email: String(lockOwnerRaw.email || '').trim(),
              sessionId: String(lockOwnerRaw.sessionId || '').trim()
            }
          : null;
        const lockExpiresAt = Math.max(0, coerceTimestamp(source.lockExpiresAt));
        const collaborators = normalizeCollaboratorList(source.collaborators);
        const shareAccess = resolveShareAccess(source.shareAccess);

        return {
          id: normalizedId,
          recordId: normalizedId,
          workspaceId,
          schemaVersion: RECORD_SCHEMA_VERSION,
          version,
          updatedBy,
          updatedById,
          updatedByEmail,
          company,
          stage: String(source.stage || 'Discovery'),
          completion: progress.completion,
          tier: String(source.tier || 'Core'),
          outcomes,
          outcomesText,
          gapSummary: progress.gapSummary,
          gaps: progress.gaps,
          modules,
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
          createdAt: normalizedCreatedAt,
          updatedAt,
          priority: !!source.priority,
          archived: !!source.archived,
          archivedAt: Number(source.archivedAt) || 0,
          collaborators,
          shareAccess,
          lockOwner,
          lockExpiresAt
        };
      }

      function loadSavedThreadsFromStorage(){
        const storedRows = recordStore.list();
        return storedRows.map((thread, idx)=> normalizeThreadModel(thread, idx));
      }

      function persistSavedThreads(){
        recordStore.saveAll(state.savedThreads || []);
      }

      function ensureSavedThreadsLoaded(){
        if(state.savedThreadsLoaded) return;
        const stored = loadSavedThreadsFromStorage();
        if(stored.length){
          state.savedThreads = stored;
        }else{
          state.savedThreads = staticThreadModels().map((thread, idx)=> normalizeThreadModel(thread, idx));
        }
        applyDefaultActorRoleMix(state.savedThreads, { force:false });
        persistSavedThreads();
        initializeRecordSeenVersions(state.savedThreads, { seedUnreadTest:true });
        state.savedThreadsLoaded = true;
      }

      function findSavedThread(threadId){
        ensureSavedThreadsLoaded();
        const targetId = String(threadId || '').trim();
        if(!targetId) return null;
        const inMemory = (state.savedThreads || []).find((thread)=> thread.id === targetId);
        if(inMemory) return inMemory;
        const stored = recordStore.get(targetId);
        return stored ? normalizeThreadModel(stored, 0) : null;
      }

      function nextSavedThreadId(){
        const stamp = Date.now().toString(36);
        const rand = Math.random().toString(36).slice(2, 7);
        return `record-${stamp}-${rand}`;
      }

      function buildThreadSnapshotFromState(){
        return {
          fieldMode: resolveConfiguratorFieldMode(state.fieldMode || accountFieldModeValue()),
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
          activeStep: clampConfiguratorStep(state.activeStep),
          visited: Array.from(state.visited || [1])
        };
      }

      function normalizeSnapshotForDiff(source){
        const src = (source && typeof source === 'object') ? source : {};
        const toSortedStrList = (value)=> (
          Array.isArray(value)
            ? value.map((item)=> String(item || '').trim()).filter(Boolean).sort()
            : []
        );
        const toSortedNumList = (value)=> (
          Array.isArray(value)
            ? value
                .map((item)=> clampConfiguratorStep(item))
                .sort((a, b)=> a - b)
            : []
        );
        return {
          fieldMode: resolveConfiguratorFieldMode(src.fieldMode || accountFieldModeValue()),
          role: String(src.role || '').trim(),
          fullName: String(src.fullName || '').trim(),
          company: String(src.company || '').trim(),
          companySize: String(src.companySize || '').trim(),
          operatingCountry: String(src.operatingCountry || '').trim(),
          industry: String(src.industry || '').trim(),
          region: String(src.region || '').trim(),
          pressureSources: toSortedStrList(src.pressureSources),
          urgentWin: String(src.urgentWin || '').trim(),
          riskEnvs: toSortedStrList(src.riskEnvs),
          measuredOn: String(src.measuredOn || '').trim(),
          orgPain: String(src.orgPain || '').trim(),
          drivers: toSortedStrList(src.drivers),
          milestone: String(src.milestone || '').trim(),
          evidence: toSortedStrList(src.evidence),
          outcomeDrilldowns: jsonClone(src.outcomeDrilldowns || {}) || {},
          groups: toSortedStrList(src.groups),
          rhythm: String(src.rhythm || '').trim(),
          measure: String(src.measure || '').trim(),
          fitRealism: String(src.fitRealism || '').trim(),
          fitScope: String(src.fitScope || '').trim(),
          fitToday: String(src.fitToday || '').trim(),
          fitServices: String(src.fitServices || '').trim(),
          fitRiskFrame: String(src.fitRiskFrame || '').trim(),
          regMode: String(src.regMode || '').trim() || 'suggested',
          regModeTouched: !!src.regModeTouched,
          regSearch: String(src.regSearch || '').trim(),
          regsTouched: !!src.regsTouched,
          regs: toSortedStrList(src.regs),
          stack: toSortedStrList(src.stack),
          stackOther: String(src.stackOther || '').trim(),
          currency: String(src.currency || '').trim() || 'USD',
          fx: {
            USD: 1,
            GBP: Number(src.fx && src.fx.GBP) || 0.80,
            EUR: Number(src.fx && src.fx.EUR) || 0.90
          },
          revenueB: Number(src.revenueB) || IMMERSIVE_MODEL.baselineRevenueB,
          investUSD: Number(src.investUSD) || IMMERSIVE_MODEL.baselineInvestment,
          investManual: !!src.investManual,
          teamCyber: Number(src.teamCyber) || IMMERSIVE_MODEL.baselineCyber,
          teamDev: Number(src.teamDev) || IMMERSIVE_MODEL.baselineDev,
          teamWf: Number(src.teamWf) || IMMERSIVE_MODEL.baselineWorkforce,
          teamManual: !!src.teamManual,
          realization: String(src.realization || '').trim() || 'conservative',
          paybackDelayMonths: Number(src.paybackDelayMonths) || 3,
          cyberSalaryUSD: Number(src.cyberSalaryUSD) || 180000,
          devSalaryUSD: Number(src.devSalaryUSD) || 160000,
          email: String(src.email || '').trim(),
          phone: String(src.phone || '').trim(),
          notes: String(src.notes || '').trim(),
          optin: !!src.optin,
          visited: (()=> {
            const list = toSortedNumList(src.visited);
            return list.length ? list : [1];
          })()
        };
      }

      function snapshotsEquivalentForData(left, right){
        const a = normalizeSnapshotForDiff(left);
        const b = normalizeSnapshotForDiff(right);
        return JSON.stringify(a) === JSON.stringify(b);
      }

      function activeSavedThreadHasUnsavedState(){
        if(state.currentView !== 'configurator') return false;
        const activeId = String(state.activeThread || '').trim();
        if(!activeId || activeId === 'current') return false;
        const saved = findSavedThread(activeId);
        if(!saved) return false;
        const savedSnapshot = (saved.snapshot && typeof saved.snapshot === 'object')
          ? saved.snapshot
          : defaultSnapshotForThread(saved);
        return !snapshotsEquivalentForData(buildThreadSnapshotFromState(), savedSnapshot);
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
        const now = Date.now();
        const existingCreatedAt = coerceTimestamp(metaIn.createdAt);
        const actor = activeCollaboratorIdentity();
        const resolvedId = String(threadId || nextSavedThreadId()).trim() || nextSavedThreadId();
        const workspaceId = String(metaIn.workspaceId || DEFAULT_WORKSPACE_ID).trim() || DEFAULT_WORKSPACE_ID;
        const version = Math.max(1, Math.floor(Number(metaIn.version) || 1));
        const updatedBy = String(metaIn.updatedBy || actor.displayName || 'Unknown collaborator').trim() || 'Unknown collaborator';
        const updatedById = String(metaIn.updatedById || actor.userId || '').trim();
        const updatedByEmail = String(metaIn.updatedByEmail || actor.email || '').trim();
        const lockOwnerRaw = (metaIn.lockOwner && typeof metaIn.lockOwner === 'object') ? metaIn.lockOwner : null;
        const lockOwner = lockOwnerRaw
          ? {
              userId: String(lockOwnerRaw.userId || '').trim(),
              name: String(lockOwnerRaw.name || '').trim(),
              email: String(lockOwnerRaw.email || '').trim(),
              sessionId: String(lockOwnerRaw.sessionId || '').trim()
            }
          : null;
        const lockExpiresAt = Math.max(0, coerceTimestamp(metaIn.lockExpiresAt));
        const collaborators = normalizeCollaboratorList(metaIn.collaborators);
        const shareAccess = resolveShareAccess(metaIn.shareAccess);
        return normalizeThreadModel({
          id: resolvedId,
          recordId: resolvedId,
          workspaceId,
          schemaVersion: RECORD_SCHEMA_VERSION,
          version,
          updatedBy,
          updatedById,
          updatedByEmail,
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
          createdAt: existingCreatedAt || now,
          updatedAt: now,
          priority: !!metaIn.priority,
          archived: !!metaIn.archived,
          archivedAt: Number(metaIn.archivedAt) || 0,
          collaborators,
          shareAccess,
          lockOwner,
          lockExpiresAt
        }, 0);
      }

      function applyThreadSnapshot(snapshot, opts){
        const snap = (snapshot && typeof snapshot === 'object') ? snapshot : {};
        const cfg = opts || {};
        state.savePulseUntil = 0;
        state.saveIsThinking = false;
        clearScheduledAutoSave();

        state.fieldMode = resolveConfiguratorFieldMode(snap.fieldMode || accountFieldModeValue());
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
            .map((v)=> clampConfiguratorStep(v))
        );
        if(!state.visited.size) state.visited.add(1);

        const nextStep = clampConfiguratorStep(Number(cfg.step || snap.activeStep) || 1);
        state.activeStep = nextStep;

        syncFormControlsFromState();
        setActiveStep(nextStep);
      }

      function saveActiveRecord(opts){
        const cfg = Object.assign({ quiet:false, auto:false, thinkMs:560, returnToOverview:false }, opts || {});
        const permissionThread = (state.activeThread && state.activeThread !== 'current')
          ? findSavedThread(state.activeThread)
          : null;
        const permissions = actorPermissionsForThread(permissionThread);
        if(!permissions.canEditRecord){
          if(!cfg.quiet){
            toast(`Your ${permissions.roleLabel.toLowerCase()} role cannot edit this record.`);
          }
          return false;
        }
        if(state.recordReadOnly){
          if(!cfg.quiet){
            toast('This record is read-only while another collaborator is editing.');
          }
          return false;
        }
        if(state.saveIsThinking) return false;
        clearScheduledAutoSave();

        const commitSave = ()=>{
          ensureSavedThreadsLoaded();
          const existing = (state.activeThread && state.activeThread !== 'current') ? findSavedThread(state.activeThread) : null;
          const isNewRecord = !existing;
          const recordId = existing ? existing.id : nextSavedThreadId();
          const actor = activeCollaboratorIdentity();
          const actorRoleForThread = existing
            ? effectiveActorRoleForThread(existing, { actor })
            : resolveCollaboratorRole(actor.workspaceRole, 'owner');
          const desiredActorRole = (actorRoleForThread === 'admin')
            ? 'owner'
            : resolveCollaboratorRole(actorRoleForThread, 'owner');
          const collaborators = collaboratorsWithActor(existing && existing.collaborators, actor, {
            desiredRole: desiredActorRole,
            promote: false
          });
          const nextVersion = existing ? (Math.max(1, Number(existing.version) || 1) + 1) : 1;
          const nextThread = buildSavedThreadFromState(recordId, existing ? {
            createdAt: Number(existing.createdAt) || 0,
            priority: !!existing.priority,
            archived: !!existing.archived,
            archivedAt: Number(existing.archivedAt) || 0,
            workspaceId: existing.workspaceId || DEFAULT_WORKSPACE_ID,
            version: nextVersion,
            updatedBy: actor.displayName,
            updatedById: actor.userId,
            updatedByEmail: actor.email,
            collaborators,
            shareAccess: resolveShareAccess(existing.shareAccess),
            lockOwner: null,
            lockExpiresAt: 0
          } : {
            workspaceId: DEFAULT_WORKSPACE_ID,
            version: 1,
            updatedBy: actor.displayName,
            updatedById: actor.userId,
            updatedByEmail: actor.email,
            collaborators,
            shareAccess: 'workspace-viewer',
            lockOwner: null,
            lockExpiresAt: 0
          });
          const idx = state.savedThreads.findIndex((thread)=> thread.id === nextThread.id);
          if(idx >= 0){
            state.savedThreads[idx] = nextThread;
          }else{
            state.savedThreads.unshift(nextThread);
          }
          recordStore.save(nextThread);
          state.activeThread = nextThread.id;
          state.saveIsThinking = false;
          state.savePulseUntil = Date.now() + 1600;
          persistSavedThreads();
          clearRecordLockHeartbeat();
          state.lockReacquirePending = !isNewRecord;
          state.recordReadOnly = false;
          state.recordSeenVersions[nextThread.id] = Math.max(1, Number(nextThread.version) || 1);
          setCollaborationNotice(
            'success',
            'Changes saved',
            `v${Math.max(1, Number(nextThread.version) || 1)} saved by ${nextThread.updatedBy || 'Unknown collaborator'} at ${formatDashboardDate(nextThread.updatedAt)}. ${isNewRecord ? 'New records stay unlocked by default.' : 'Lock released until you continue editing.'}`,
            nextThread.id,
            7000
          );
          update();
          window.setTimeout(()=>{
            if(Date.now() >= state.savePulseUntil) update();
          }, 1650);
          if(!cfg.quiet){
            toast('Record saved.');
          }
          if(cfg.returnToOverview){
            openThreadOverview(nextThread.id);
          }else if(state.currentView === 'configurator'){
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

      function dashboardTierRank(tierRaw){
        const tier = String(tierRaw || '').trim().toLowerCase();
        if(tier === 'core') return 1;
        if(tier === 'advanced') return 2;
        if(tier === 'ultimate') return 3;
        return 4;
      }

      function dashboardTierBadge(tierRaw){
        const tier = String(tierRaw || '').trim();
        const lower = tier.toLowerCase();
        if(lower === 'core') return { short:'C', label:'Core' };
        if(lower === 'advanced') return { short:'A', label:'Advanced' };
        if(lower === 'ultimate') return { short:'U', label:'Ultimate' };
        if(!tier) return { short:'—', label:'Unknown' };
        return {
          short: tier.charAt(0).toUpperCase(),
          label: tier
        };
      }

      function dashboardStatusMeta(thread){
        const source = (thread && typeof thread === 'object') ? thread : {};
        const perms = actorPermissionsForThread(source);
        const role = resolveCollaboratorRole(perms.role, 'viewer');
        const lockReadOnly = isThreadReadOnlyForActor(source);
        const permissionReadOnly = !perms.canEditRecord;
        if(lockReadOnly){
          return {
            key: 'read-only',
            label: 'Read-only',
            tone: 'readonly',
            sortRank: 1
          };
        }
        if(permissionReadOnly || role === 'viewer'){
          return {
            key: 'viewer',
            label: 'Viewer',
            tone: 'viewer',
            sortRank: 2
          };
        }
        if(role === 'sdr'){
          return {
            key: 'sdr',
            label: 'SDR',
            tone: 'sdr',
            sortRank: 3
          };
        }
        if(role === 'editor'){
          return {
            key: 'editor',
            label: 'Editor',
            tone: 'editor',
            sortRank: 4
          };
        }
        if(role === 'owner'){
          return {
            key: 'owner',
            label: 'Owner',
            tone: 'owner',
            sortRank: 5
          };
        }
        return {
          key: 'admin',
          label: 'Admin',
          tone: 'admin',
          sortRank: 6
        };
      }

      function sortThreadsByPriorityRecency(rows){
        return (rows || []).slice().sort((a, b)=>{
          const byPriority = Number(!!b.priority) - Number(!!a.priority);
          if(byPriority) return byPriority;
          const byUpdated = Number(b.updatedAt || 0) - Number(a.updatedAt || 0);
          if(byUpdated) return byUpdated;
          return String(a.company || '').localeCompare(String(b.company || ''), undefined, { sensitivity:'base' });
        });
      }

      function dashboardSortThreads(rows, mode){
        const sortMode = sanitizeDashboardSortMode(mode || state.dashboardSort);
        const compareName = (left, right)=> String(left || '').localeCompare(String(right || ''), undefined, { sensitivity:'base' });
        const cache = new WeakMap();
        const snapshot = (thread)=>{
          if(cache.has(thread)) return cache.get(thread);
          const progress = threadReadinessProgress(thread);
          const status = dashboardStatusMeta(thread);
          const result = {
            company: String(thread && thread.company || ''),
            tierRank: dashboardTierRank(thread && thread.tier),
            outcomes: String(thread && thread.outcomesText || ''),
            completionPct: completionPctFromSummary(progress && progress.completion),
            gapsCount: Array.isArray(progress && progress.gaps) ? progress.gaps.length : 0,
            gapSummary: String(progress && progress.gapSummary || ''),
            statusRank: Number(status.sortRank || 0),
            createdAt: Number(thread && thread.createdAt || 0),
            updatedAt: Number(thread && thread.updatedAt || 0)
          };
          cache.set(thread, result);
          return result;
        };

        return (rows || []).slice().sort((a, b)=>{
          const left = snapshot(a);
          const right = snapshot(b);

          if(sortMode === 'name-desc'){
            const byName = compareName(right.company, left.company);
            if(byName) return byName;
          }else if(sortMode === 'name-asc'){
            const byName = compareName(left.company, right.company);
            if(byName) return byName;
          }else if(sortMode === 'completion-desc'){
            const byCompletion = right.completionPct - left.completionPct;
            if(byCompletion) return byCompletion;
            const byGaps = left.gapsCount - right.gapsCount;
            if(byGaps) return byGaps;
          }else if(sortMode === 'completion-asc'){
            const byCompletion = left.completionPct - right.completionPct;
            if(byCompletion) return byCompletion;
            const byGaps = right.gapsCount - left.gapsCount;
            if(byGaps) return byGaps;
          }else if(sortMode === 'tier-desc'){
            const byTier = right.tierRank - left.tierRank;
            if(byTier) return byTier;
          }else if(sortMode === 'tier-asc'){
            const byTier = left.tierRank - right.tierRank;
            if(byTier) return byTier;
          }else if(sortMode === 'outcomes-desc'){
            const byOutcomes = compareName(right.outcomes, left.outcomes);
            if(byOutcomes) return byOutcomes;
          }else if(sortMode === 'outcomes-asc'){
            const byOutcomes = compareName(left.outcomes, right.outcomes);
            if(byOutcomes) return byOutcomes;
          }else if(sortMode === 'gaps-desc'){
            const byGaps = right.gapsCount - left.gapsCount;
            if(byGaps) return byGaps;
            const byGapSummary = compareName(right.gapSummary, left.gapSummary);
            if(byGapSummary) return byGapSummary;
          }else if(sortMode === 'gaps-asc'){
            const byGaps = left.gapsCount - right.gapsCount;
            if(byGaps) return byGaps;
            const byGapSummary = compareName(left.gapSummary, right.gapSummary);
            if(byGapSummary) return byGapSummary;
          }else if(sortMode === 'created-desc'){
            const byCreated = right.createdAt - left.createdAt;
            if(byCreated) return byCreated;
          }else if(sortMode === 'created-asc'){
            const byCreated = left.createdAt - right.createdAt;
            if(byCreated) return byCreated;
          }else if(sortMode === 'modified-desc'){
            const byUpdated = right.updatedAt - left.updatedAt;
            if(byUpdated) return byUpdated;
          }else if(sortMode === 'modified-asc'){
            const byUpdated = left.updatedAt - right.updatedAt;
            if(byUpdated) return byUpdated;
          }else if(sortMode === 'status-desc'){
            const byStatus = right.statusRank - left.statusRank;
            if(byStatus) return byStatus;
          }else if(sortMode === 'status-asc'){
            const byStatus = left.statusRank - right.statusRank;
            if(byStatus) return byStatus;
          }

          const byUpdatedFallback = right.updatedAt - left.updatedAt;
          if(byUpdatedFallback) return byUpdatedFallback;
          return compareName(left.company, right.company);
        });
      }

      function formatDashboardDate(ts){
        const value = Number(ts || 0);
        if(!Number.isFinite(value) || value <= 0) return '—';
        try{
          return new Date(value).toLocaleString(undefined, { dateStyle:'medium', timeStyle:'short' });
        }catch(err){
          return new Date(value).toISOString();
        }
      }

      function formatDashboardDateCreated(ts){
        const value = Number(ts || 0);
        if(!Number.isFinite(value) || value <= 0) return '—';
        try{
          return new Date(value).toLocaleDateString(undefined, { dateStyle:'medium' });
        }catch(err){
          return new Date(value).toISOString().slice(0, 10);
        }
      }

      function formatTitleSavedMeta(ts){
        const value = Number(ts || 0);
        if(!Number.isFinite(value) || value <= 0) return 'Not saved yet';
        try{
          const date = new Date(value);
          const dd = String(date.getDate()).padStart(2, '0');
          const mm = String(date.getMonth() + 1).padStart(2, '0');
          const yy = String(date.getFullYear()).slice(-2);
          const hh = String(date.getHours()).padStart(2, '0');
          const mi = String(date.getMinutes()).padStart(2, '0');
          return `last saved ${dd} ${mm} ${yy} ${hh}:${mi}`;
        }catch(err){
          return 'Not saved yet';
        }
      }

      function dashboardDateValueForMode(row){
        const mode = sanitizeDashboardDateMode(state.dashboardDateMode);
        if(mode === 'created') return Number(row && row.createdAt || 0);
        return Number(row && row.updatedAt || 0);
      }

      function threadHasUnseenUpdate(thread){
        const source = (thread && typeof thread === 'object') ? thread : {};
        const threadId = String((source.id || source.recordId) || '').trim();
        if(!threadId) return false;
        const hasSeenVersion = Object.prototype.hasOwnProperty.call(state.recordSeenVersions || {}, threadId);
        if(!hasSeenVersion) return false;
        const currentVersion = Math.max(1, Number(source.version) || 1);
        const seenVersion = Math.max(0, Number(state.recordSeenVersions[threadId]) || 0);
        return currentVersion > seenVersion;
      }

      function dashboardRowsModel(){
        const filtered = threadModels().filter((thread)=> !thread.archived);
        return dashboardSortThreads(filtered, state.dashboardSort).map((thread)=> {
          const progress = threadReadinessProgress(thread);
          const tierBadge = dashboardTierBadge(thread.tier);
          const status = dashboardStatusMeta(thread);
          return ({
          id: thread.id,
          company: thread.company,
          stage: thread.stage,
          createdAt: Number(thread.createdAt || 0),
          updatedAt: Number(thread.updatedAt || 0),
          completion: progress.completion,
          tier: thread.tier,
          tierShort: tierBadge.short,
          tierLabel: tierBadge.label,
          statusLabel: status.label,
          statusTone: status.tone,
          outcomes: thread.outcomesText,
          gaps: progress.gapSummary,
          collaborators: normalizeCollaboratorList(thread.collaborators),
          shareAccess: resolveShareAccess(thread.shareAccess),
          lockOwner: thread.lockOwner || null,
          lockExpiresAt: Number(thread.lockExpiresAt) || 0,
          priority: !!thread.priority,
          hasUnseenUpdate: threadHasUnseenUpdate(thread),
          openLabel: 'Open overview'
        });
        });
      }

      function archivedRowsModel(){
        const filtered = threadModels().filter((thread)=> !!thread.archived);
        return dashboardSortThreads(filtered, state.dashboardSort).map((thread)=> {
          const progress = threadReadinessProgress(thread);
          const tierBadge = dashboardTierBadge(thread.tier);
          const status = dashboardStatusMeta(thread);
          return ({
          id: thread.id,
          company: thread.company,
          stage: thread.stage,
          createdAt: Number(thread.createdAt || 0),
          updatedAt: Number(thread.updatedAt || 0),
          completion: progress.completion,
          tier: thread.tier,
          tierShort: tierBadge.short,
          tierLabel: tierBadge.label,
          statusLabel: status.label,
          statusTone: status.tone,
          outcomes: thread.outcomesText,
          gaps: progress.gapSummary,
          collaborators: normalizeCollaboratorList(thread.collaborators),
          shareAccess: resolveShareAccess(thread.shareAccess),
          lockOwner: thread.lockOwner || null,
          lockExpiresAt: Number(thread.lockExpiresAt) || 0,
          hasUnseenUpdate: threadHasUnseenUpdate(thread),
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

        const starredRows = sortThreadsByPriorityRecency(
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
        const perms = actorPermissionsForThread(thread);
        if(!perms.canEditRecord){
          toast(`Your ${perms.roleLabel.toLowerCase()} role cannot change record priority.`);
          return;
        }
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
        const requestedMode = (mode === 'restore' || mode === 'delete') ? mode : 'archive';
        let validIds = uniq.filter((id)=> !!findSavedThread(id));
        if(requestedMode === 'delete'){
          const archivedOnlyIds = validIds.filter((id)=> {
            const thread = findSavedThread(id);
            return !!(thread && thread.archived);
          });
          if(!archivedOnlyIds.length){
            toast('Only archived records can be permanently deleted.');
            return;
          }
          if(archivedOnlyIds.length !== validIds.length){
            toast('Only archived records were kept for permanent delete.');
          }
          validIds = archivedOnlyIds;
        }
        if(!validIds.length) return;
        const manageableIds = validIds.filter((id)=>{
          const thread = findSavedThread(id);
          if(!thread) return false;
          const perms = actorPermissionsForThread(thread);
          return perms.role === 'admin' || perms.role === 'owner';
        });
        if(!manageableIds.length){
          toast(requestedMode === 'delete'
            ? 'Only owner or admin can permanently delete archived records.'
            : 'Only owner or admin can archive or restore records.');
          return;
        }
        if(manageableIds.length !== validIds.length){
          toast('Some selected records were skipped because your role does not allow this action.');
        }

        archivePromptMode = requestedMode;
        archivePromptIds = manageableIds;
        const count = manageableIds.length;
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

      function shareRecordIdFromContext(preferredThreadId){
        const preferred = String(preferredThreadId || '').trim();
        if(preferred && preferred !== 'current'){
          const thread = findSavedThread(preferred);
          if(thread && !thread.archived) return thread.id;
        }
        const view = state.currentView || 'dashboard';
        if(view === 'recommendations'){
          const thread = resolveRecommendationThread(state.recommendationsThreadId || state.activeThread || 'current');
          if(thread && thread.id && thread.id !== 'current' && !thread.archived) return thread.id;
        }
        const activeId = String(state.activeThread || '').trim();
        if((view === 'configurator' || view === 'interstitial') && activeId && activeId !== 'current'){
          const thread = findSavedThread(activeId);
          if(thread && !thread.archived) return thread.id;
        }
        return '';
      }

      function shareRecordUrl(recordId){
        const targetId = String(recordId || '').trim();
        if(!targetId) return '';
        const hash = `${ROUTE_HASH_PREFIX}records/${encodeRouteSegment(targetId)}/overview`;
        return `${window.location.origin}${window.location.pathname}${window.location.search}${hash}`;
      }

      function shareDisplayNameFromEmail(email){
        const source = String(email || '').trim().toLowerCase();
        if(!source.includes('@')) return source;
        const local = source.split('@')[0];
        const parts = local.replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
        if(!parts.length) return source;
        return parts.slice(0, 2).map((part)=> part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
      }

      function loadAccessRequests(){
        try{
          const raw = window.localStorage.getItem(ACCESS_REQUESTS_STORAGE_KEY);
          if(!raw) return [];
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed : [];
        }catch(err){
          return [];
        }
      }

      function persistAccessRequests(rows){
        try{
          const safeRows = Array.isArray(rows) ? rows : [];
          window.localStorage.setItem(ACCESS_REQUESTS_STORAGE_KEY, JSON.stringify(safeRows));
        }catch(err){
          // Ignore storage failures.
        }
      }

      function appendAccessRequest(entry){
        const rows = loadAccessRequests();
        rows.unshift(entry);
        if(rows.length > 250){
          rows.length = 250;
        }
        persistAccessRequests(rows);
      }

      function persistThreadCollaborationState(thread){
        if(!thread || !thread.id || thread.id === 'current') return null;
        const actor = activeCollaboratorIdentity();
        const normalized = normalizeThreadModel(Object.assign({}, thread, {
          updatedAt: Date.now(),
          updatedBy: actor.displayName,
          updatedById: actor.userId,
          updatedByEmail: actor.email,
          collaborators: normalizeCollaboratorList(thread.collaborators),
          shareAccess: resolveShareAccess(thread.shareAccess)
        }), 0);
        syncSavedThreadInMemory(normalized);
        recordStore.save(normalized);
        persistSavedThreads();
        return normalized;
      }

      function shareModalThreadModel(){
        const targetId = String(shareModalRecordId || '').trim();
        if(!targetId || targetId === 'current') return null;
        return findSavedThread(targetId);
      }

      function collaboratorKey(row){
        return String((row && (row.userId || row.email || row.name)) || '').trim();
      }

      function countPrivilegedCollaborators(rows){
        return (Array.isArray(rows) ? rows : []).filter((row)=> {
          const role = resolveCollaboratorRole(row && row.role, 'viewer');
          return role === 'owner' || role === 'admin';
        }).length;
      }

      function shareRoleHintByPermissions(perms){
        if(!perms) return 'Add collaborators, set general access, and copy the link.';
        if(perms.role === 'admin'){
          return 'Admin mode: full sharing control (add/remove users, set any role, and change access).';
        }
        if(perms.role === 'owner'){
          return 'Owner mode: full record sharing control (set roles/access and manage collaborators).';
        }
        if(perms.role === 'editor'){
          return 'Editor mode: can edit the record and add viewers. Use Request access if you need owner/admin changes.';
        }
        if(perms.role === 'sdr'){
          return 'SDR mode: can edit the record and add viewers. Use Request access if you need owner/admin changes.';
        }
        return 'Viewer mode: read-only record access with ability to add viewers only. Use Request access to ask for edit rights.';
      }

      function syncShareModalGuardControls(thread){
        const perms = actorPermissionsForThread(thread);
        const inviteRoleSelect = $('#shareInviteRole');
        const addBtn = $('#shareAddCollaboratorBtn');
        const generalAccess = $('#shareGeneralAccess');
        const saveBtn = $('#shareSaveBtn');
        const requestBtn = $('#shareRequestAccessBtn');
        const body = $('#shareModalBody');
        if(body){
          body.textContent = shareRoleHintByPermissions(perms);
        }
        if(inviteRoleSelect){
          const allowed = Array.from(perms.assignableRoles || ['viewer']);
          const current = resolveCollaboratorRole(inviteRoleSelect.value || allowed[0], allowed[0]);
          inviteRoleSelect.innerHTML = allowed.map((role)=> (
            `<option value="${escapeHtml(role)}">${escapeHtml(collaborationRoleLabel(role))}</option>`
          )).join('');
          inviteRoleSelect.value = allowed.includes(current) ? current : allowed[0];
          inviteRoleSelect.disabled = allowed.length <= 1;
          inviteRoleSelect.setAttribute('aria-disabled', inviteRoleSelect.disabled ? 'true' : 'false');
        }
        if(addBtn){
          addBtn.disabled = !perms.canAddCollaborators;
          addBtn.setAttribute('aria-disabled', addBtn.disabled ? 'true' : 'false');
        }
        if(generalAccess){
          generalAccess.disabled = !perms.canSetGeneralAccess;
          generalAccess.setAttribute('aria-disabled', generalAccess.disabled ? 'true' : 'false');
        }
        if(saveBtn){
          saveBtn.disabled = !perms.canSetGeneralAccess;
          saveBtn.setAttribute('aria-disabled', saveBtn.disabled ? 'true' : 'false');
          saveBtn.title = perms.canSetGeneralAccess
            ? 'Save sharing settings'
            : 'Only owner or admin can change general access';
        }
        if(requestBtn){
          const showRequest = !perms.canSetGeneralAccess;
          requestBtn.hidden = !showRequest;
          requestBtn.disabled = !showRequest;
          requestBtn.setAttribute('aria-disabled', requestBtn.disabled ? 'true' : 'false');
          requestBtn.title = showRequest
            ? 'Request elevated access from an owner/admin'
            : '';
        }
      }

      function renderShareCollaboratorRows(thread){
        const list = $('#shareCollaboratorList');
        if(!list) return;
        const collaborators = threadCollaborators(thread);
        const perms = actorPermissionsForThread(thread);
        const actor = activeCollaboratorIdentity();
        const privilegedCount = countPrivilegedCollaborators(collaborators);
        if(!collaborators.length){
          list.innerHTML = '<p class="shareCollaboratorEmpty">No collaborators yet.</p>';
          syncShareModalGuardControls(thread);
          return;
        }
        list.innerHTML = collaborators.map((row)=>{
          const key = collaboratorKey(row);
          const rowRole = resolveCollaboratorRole(row && row.role, 'viewer');
          const isActorRow = collaboratorMatchesActor(row, actor);
          const canEditRole = (
            perms.canSetCollaboratorRole
            && !isActorRow
            && !(rowRole === 'admin' && perms.role !== 'admin')
          );
          const allowedRoleChoices = canEditRole
            ? Array.from(new Set([rowRole].concat(perms.assignableRoles || [])))
            : [];
          const roleControl = canEditRole
            ? `<select class="shareCollaboratorRoleSelect" data-share-role="${escapeHtml(key)}">${allowedRoleChoices.map((role)=> `<option value="${escapeHtml(role)}"${role === rowRole ? ' selected' : ''}>${escapeHtml(collaborationRoleLabel(role))}</option>`).join('')}</select>`
            : `<span class="shareCollaboratorRole">${escapeHtml(collaborationRoleLabel(rowRole))}</span>`;
          const protectedOwner = (privilegedCount <= 1) && (rowRole === 'owner' || rowRole === 'admin');
          const removeLocked = (
            !perms.canRemoveCollaborators
            || collaborators.length <= 1
            || (isActorRow && perms.role !== 'admin')
            || protectedOwner
          );
          let removeLabel = 'Locked';
          if(!perms.canRemoveCollaborators) removeLabel = 'No access';
          else if(protectedOwner || collaborators.length <= 1) removeLabel = 'Owner';
          else if(isActorRow) removeLabel = 'You';
          const removeBtn = removeLocked
            ? `<span class="shareCollaboratorRemove" aria-hidden="true" style="opacity:.45; pointer-events:none;">${escapeHtml(removeLabel)}</span>`
            : `<button type="button" class="shareCollaboratorRemove" data-share-remove="${escapeHtml(key)}" title="Remove collaborator">Remove</button>`;
          return `
            <div class="shareCollaboratorRow">
              <span class="collabAvatar" style="background:${escapeHtml(row.color)};" title="${escapeHtml(row.name)}">${escapeHtml(row.initials)}</span>
              <div class="shareCollaboratorMeta">
                <span class="shareCollaboratorName">${escapeHtml(row.name)}</span>
                <span class="shareCollaboratorEmail">${escapeHtml(row.email || row.userId || '')}</span>
              </div>
              ${roleControl}
              ${removeBtn}
            </div>
          `;
        }).join('');
        syncShareModalGuardControls(thread);
      }

      function closeShareModal(){
        shareModalRecordId = '';
        const modal = $('#shareModal');
        if(modal) modal.classList.remove('show');
        const inviteInput = $('#shareInviteInput');
        const messageInput = $('#shareInviteMessage');
        if(inviteInput) inviteInput.value = '';
        if(messageInput) messageInput.value = '';
      }

      function openShareModal(recordId, opts){
        const cfg = Object.assign({ focusInvite:false }, opts || {});
        const targetId = shareRecordIdFromContext(recordId);
        if(!targetId){
          toast('Save the record first, then share it.');
          return false;
        }
        const thread = findSavedThread(targetId);
        if(!thread){
          toast('Record not found.');
          return false;
        }
        if(thread.archived){
          toast('Unarchive this record before sharing.');
          return false;
        }
        const actor = activeCollaboratorIdentity();
        const perms = actorPermissionsForThread(thread, { actor });
        const ensuredCollaborators = collaboratorsWithActor(thread.collaborators, actor, {
          desiredRole: perms.role === 'admin' ? 'owner' : perms.role,
          promote: false
        });
        thread.collaborators = ensuredCollaborators;
        thread.shareAccess = resolveShareAccess(thread.shareAccess);
        const persisted = persistThreadCollaborationState(thread) || thread;
        shareModalRecordId = targetId;
        const title = $('#shareModalTitle');
        const body = $('#shareModalBody');
        const inviteInput = $('#shareInviteInput');
        const messageInput = $('#shareInviteMessage');
        const generalAccess = $('#shareGeneralAccess');
        if(title) title.textContent = `Share “${persisted.company || targetId}”`;
        if(body) body.textContent = shareRoleHintByPermissions(actorPermissionsForThread(persisted));
        if(inviteInput) inviteInput.value = '';
        if(messageInput) messageInput.value = '';
        if(generalAccess) generalAccess.value = resolveShareAccess(persisted.shareAccess);
        renderShareCollaboratorRows(persisted);
        const modal = $('#shareModal');
        if(modal) modal.classList.add('show');
        if(cfg.focusInvite && inviteInput && !inviteInput.disabled){
          window.setTimeout(()=>{
            try{
              inviteInput.focus();
              inviteInput.select();
            }catch(err){
              // Ignore focus errors.
            }
          }, 0);
        }
        update();
        return true;
      }

      function addShareCollaboratorsFromInput(){
        const thread = shareModalThreadModel();
        const input = $('#shareInviteInput');
        if(!thread || !input) return;
        const perms = actorPermissionsForThread(thread);
        if(!perms.canAddCollaborators){
          toast('Your role cannot add collaborators.');
          return;
        }
        const raw = String(input.value || '').trim();
        if(!raw){
          toast('Add at least one email address.');
          return;
        }
        const tokens = raw.split(/[,\n;]+/).map((value)=> normalizeEmail(value)).filter(Boolean);
        const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
        const validEmails = Array.from(new Set(tokens.filter((email)=> emailRe.test(email))));
        if(!validEmails.length){
          toast('Enter valid collaborator email addresses.');
          return;
        }
        const inviteRoleSelect = $('#shareInviteRole');
        let requestedRole = resolveCollaboratorRole(inviteRoleSelect ? inviteRoleSelect.value : 'viewer', 'viewer');
        if(!(perms.assignableRoles || []).includes(requestedRole)){
          requestedRole = 'viewer';
        }
        const existing = threadCollaborators(thread);
        const existingKeys = new Set(existing.map((row)=> collaboratorKey(row).toLowerCase()));
        const existingEmails = new Set(existing.map((row)=> normalizeEmail(row.email)).filter(Boolean));
        const additions = [];
        validEmails.forEach((email)=>{
          const key = `email:${email}`.toLowerCase();
          if(existingKeys.has(key) || existingEmails.has(email)) return;
          additions.push({
            userId: `email:${email}`,
            email,
            name: shareDisplayNameFromEmail(email),
            role: requestedRole
          });
        });
        if(!additions.length){
          toast('Those collaborators already have access.');
          return;
        }
        const next = existing.concat(additions);
        thread.collaborators = normalizeCollaboratorList(next);
        const saved = persistThreadCollaborationState(thread);
        input.value = '';
        renderShareCollaboratorRows(saved || thread);
        update();
        toast(`${additions.length} ${collaborationRoleLabel(requestedRole).toLowerCase()} collaborator${additions.length === 1 ? '' : 's'} added.`);
      }

      function removeShareCollaborator(collaboratorKey){
        const key = String(collaboratorKey || '').trim().toLowerCase();
        if(!key) return;
        const thread = shareModalThreadModel();
        if(!thread) return;
        const perms = actorPermissionsForThread(thread);
        if(!perms.canRemoveCollaborators){
          toast('Only owner or admin can remove collaborators.');
          return;
        }
        const actor = activeCollaboratorIdentity();
        const rows = threadCollaborators(thread);
        if(rows.length <= 1){
          toast('At least one collaborator is required.');
          return;
        }
        const target = rows.find((row)=> collaboratorKey(row).toLowerCase() === key);
        if(!target) return;
        if(collaboratorMatchesActor(target, actor) && perms.role !== 'admin'){
          toast('You cannot remove yourself from this record.');
          return;
        }
        const next = rows.filter((row)=> {
          const rowKey = collaboratorKey(row).toLowerCase();
          return rowKey !== key;
        });
        if(!next.length){
          toast('At least one collaborator is required.');
          return;
        }
        if(countPrivilegedCollaborators(next) < 1){
          toast('At least one owner or admin is required.');
          return;
        }
        thread.collaborators = normalizeCollaboratorList(next);
        const saved = persistThreadCollaborationState(thread);
        renderShareCollaboratorRows(saved || thread);
        update();
      }

      function updateShareCollaboratorRole(collaboratorRowKey, roleValue){
        const key = String(collaboratorRowKey || '').trim().toLowerCase();
        if(!key) return;
        const thread = shareModalThreadModel();
        if(!thread) return;
        const perms = actorPermissionsForThread(thread);
        if(!perms.canSetCollaboratorRole){
          toast('Only owner or admin can change collaborator roles.');
          return;
        }
        const actor = activeCollaboratorIdentity();
        const rows = threadCollaborators(thread);
        const idx = rows.findIndex((row)=> collaboratorKey(row).toLowerCase() === key);
        if(idx < 0) return;
        const currentRole = resolveCollaboratorRole(rows[idx].role, 'viewer');
        const nextRole = resolveCollaboratorRole(roleValue, currentRole);
        if(nextRole === currentRole) return;
        if(collaboratorMatchesActor(rows[idx], actor) && perms.role !== 'admin'){
          toast('You cannot change your own role.');
          return;
        }
        if(currentRole === 'admin' && perms.role !== 'admin'){
          toast('Only admin can change admin role assignments.');
          return;
        }
        if(!(perms.assignableRoles || []).includes(nextRole)){
          toast('Your role cannot assign that permission level.');
          return;
        }
        const next = rows.slice();
        next[idx] = Object.assign({}, next[idx], { role: nextRole });
        if(countPrivilegedCollaborators(next) < 1){
          toast('At least one owner or admin is required.');
          return;
        }
        thread.collaborators = normalizeCollaboratorList(next);
        const saved = persistThreadCollaborationState(thread);
        renderShareCollaboratorRows(saved || thread);
        update();
      }

      function saveShareSettings(){
        const thread = shareModalThreadModel();
        if(!thread){
          closeShareModal();
          return;
        }
        const perms = actorPermissionsForThread(thread);
        if(!perms.canSetGeneralAccess){
          toast('Only owner or admin can change general access.');
          return;
        }
        const generalAccess = $('#shareGeneralAccess');
        thread.shareAccess = resolveShareAccess(generalAccess ? generalAccess.value : thread.shareAccess);
        persistThreadCollaborationState(thread);
        update();
        closeShareModal();
        toast('Sharing settings saved.');
      }

      function requestShareAccess(){
        const thread = shareModalThreadModel();
        if(!thread){
          closeShareModal();
          return;
        }
        const perms = actorPermissionsForThread(thread);
        if(perms.canSetGeneralAccess){
          toast('You already have owner/admin access on this record.');
          return;
        }
        const actor = activeCollaboratorIdentity();
        const noteInput = $('#shareInviteMessage');
        const note = String(noteInput ? noteInput.value : '').trim();
        const targets = threadCollaborators(thread).filter((row)=> {
          const role = resolveCollaboratorRole(row && row.role, 'viewer');
          return role === 'owner' || role === 'admin';
        });
        const request = {
          id: `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          createdAt: Date.now(),
          recordId: String(thread.id || '').trim(),
          company: String(thread.company || '').trim(),
          requestedRole: 'editor',
          message: note,
          requestedBy: {
            userId: actor.userId,
            name: actor.displayName,
            email: actor.email
          },
          targets: targets.map((row)=> ({
            userId: row.userId,
            name: row.name,
            email: row.email,
            role: resolveCollaboratorRole(row.role, 'owner')
          }))
        };
        appendAccessRequest(request);
        const targetNames = targets
          .map((row)=> String(row.name || row.email || '').trim())
          .filter(Boolean);
        const targetLabel = targetNames.length
          ? targetNames.slice(0, 2).join(', ') + (targetNames.length > 2 ? ` +${targetNames.length - 2} more` : '')
          : 'record owner';
        closeShareModal();
        toast(`Access request sent to ${targetLabel}.`);
      }

      function openThreadOverview(threadId){
        const currentRecordId = currentEditableRecordId();
        if(currentRecordId){
          releaseRecordLock(currentRecordId, { force:false });
          clearRecordLockHeartbeat();
        }
        const target = threadId || 'current';
        state.activeThread = (target !== 'current' && !findSavedThread(target)) ? 'current' : target;
        if(state.activeThread !== 'current'){
          const thread = findSavedThread(state.activeThread);
          state.navPreviewThreadId = (thread && !thread.archived && !thread.priority) ? thread.id : null;
          if(thread){
            state.recordSeenVersions[thread.id] = Math.max(1, Number(thread.version) || 1);
          }
        }else{
          state.navPreviewThreadId = null;
        }
        setView('interstitial');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      function openThreadConfigurator(threadId, step){
        const target = threadId || state.activeThread || 'current';
        const currentRecordId = currentEditableRecordId();
        if(currentRecordId && currentRecordId !== String(target || '').trim()){
          releaseRecordLock(currentRecordId, { force:false });
          clearRecordLockHeartbeat();
        }
        if(target !== 'current'){
          const thread = findSavedThread(target);
          if(thread){
            if(thread.archived){
              toast('Unarchive this record before editing.');
              openThreadOverview(target);
              return;
            }
            const perms = actorPermissionsForThread(thread);
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
            let lockResult = { ok:false, reason:'permission', thread };
            const recordVersion = Math.max(1, Number(thread.version) || 1);
            const keepUnlockedByDefault = (recordVersion <= 1) && !isThreadReadOnlyForActor(thread);
            if(perms.canEditRecord){
              if(keepUnlockedByDefault){
                lockResult = { ok:false, reason:'new-unlocked', thread };
              }else{
                lockResult = acquireRecordLock(target, { quiet:false });
              }
            }
            const liveThread = (lockResult && lockResult.thread) ? lockResult.thread : thread;
            state.recordSeenVersions[target] = Math.max(1, Number(liveThread.version) || 1);
            if(perms.canEditRecord && lockResult && lockResult.ok){
              state.recordReadOnly = false;
              ensureRecordLockHeartbeat();
            }else{
              state.recordReadOnly = !perms.canEditRecord || !!(lockResult && lockResult.reason === 'held');
              state.lockReacquirePending = !!(perms.canEditRecord && lockResult && lockResult.reason === 'held');
              clearRecordLockHeartbeat();
            }
            applyThreadSnapshot(nextSnapshot, {
              step: Number(step) || dashboardFirstGapStep(liveThread)
            });
            return;
          }
        }
        clearRecordLockHeartbeat();
        state.lockReacquirePending = false;
        state.recordReadOnly = false;
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

      function syncOverlayBodyLock(){
        document.body.classList.toggle('is-consultation-open', !!(state.consultationOpen || state.emailBuilderOpen || state.customerTemplateEditorOpen));
      }

      function toggleConsultation(open, opts){
        const panel = $('#consultationPanel');
        if(!panel) return;
        const cfg = opts || {};
        const on = !!open;
        if(on && state.emailBuilderOpen){
          toggleEmailBuilder(false);
        }
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
        syncOverlayBodyLock();
      }

      function toggleEmailBuilder(open, opts){
        const panel = $('#emailBuilderPanel');
        if(!panel) return;
        const cfg = opts || {};
        const on = !!open;
        if(on && state.consultationOpen){
          toggleConsultation(false);
        }
        state.emailBuilderOpen = on;

        if(on){
          const target = (cfg.threadId || state.emailBuilderThreadId || state.recommendationsThreadId || state.activeThread || 'current');
          renderRecommendationEmailBuilder(target);
          panel.classList.add('open');
          panel.setAttribute('aria-hidden', 'false');
        }else{
          panel.classList.remove('open');
          panel.setAttribute('aria-hidden', 'true');
        }
        syncOverlayBodyLock();
      }

      function openThreadBooking(threadId){
        const target = threadId || state.activeThread || 'current';
        if(target !== 'current'){
          const thread = findSavedThread(target);
          if(thread && thread.archived){
            toast('Unarchive this record before booking a consultation.');
            return false;
          }
        }
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
        const interPerms = actorPermissionsForThread(thread);
        const companyDisplay = String((thread && thread.company) || '').trim() || 'Untitled company';
        const canTogglePriority = !!(thread && thread.id && thread.id !== 'current' && !!findSavedThread(thread.id));
        const animateInterStar = canTogglePriority && !!state.starPulseQueue && state.starPulseQueue.has(thread.id);
        const interTitleStar = canTogglePriority
          ? `<button type="button" class="interTitleStarBtn${animateInterStar ? ' is-animate' : ''}" data-inter-star-id="${escapeHtml(thread.id)}" data-active="${thread.priority ? 'true' : 'false'}" aria-pressed="${thread.priority ? 'true' : 'false'}" title="${thread.priority ? 'Unstar company' : 'Star company'}">★</button>`
          : '';
        const interCollabStack = collaboratorStackHtml(thread, { maxVisible:4, size:'md', showSingle:false });
        const canShareRecord = !!(thread && thread.id && thread.id !== 'current' && interPerms.canShareRecord);
        const interCollabTools = (interCollabStack || canShareRecord)
          ? `
              <span class="interTitleCollabTools">
                <button
                  type="button"
                  class="titleAddUserIconBtn interTitleAddUserBtn"
                  data-action="openShareRecord"
                  data-record-id="${escapeHtml(thread && thread.id || '')}"
                  data-collab-add-trigger="true"
                  aria-label="Add collaborator"
                  title="${canShareRecord ? 'Add collaborator' : 'Save the record first, then share'}"
                  ${canShareRecord ? '' : 'disabled aria-disabled="true"'}
                >+</button>
                ${interCollabStack ? `<span class="interTitleCollab">${interCollabStack}</span>` : ''}
              </span>
            `
          : '';
        const renameActions = interPerms.canEditRecord
          ? `
                  <button type="button" class="interTitleIconBtn interTitleEditBtn" data-inter-rename-btn title="Rename company" aria-label="Rename company">&#9998;</button>
                  <button type="button" class="interTitleIconBtn interTitleSaveBtn" data-inter-rename-save title="Save company name" aria-label="Save company name">&#10003;</button>
                  <button type="button" class="interTitleIconBtn interTitleCancelBtn" data-inter-rename-cancel title="Cancel rename" aria-label="Cancel rename">&times;</button>
            `
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
                  <button type="button" class="interEditLink" data-inter-edit-step="${Number(gap.step) || 1}">${interPerms.canEditRecord ? 'Edit this section' : 'View this section'}</button>
                </div>
              </div>
            `).join('')
          : '<div class="interEmpty">No open gaps. This thread is ready for package confirmation.</div>';

        host.innerHTML = `
          <header class="interHead">
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
                  ${renameActions}
                  ${interCollabTools}
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
        const canRenameThread = !!interPerms.canEditRecord;
        const commitRename = ()=>{
          if(!canRenameThread){
            toast('Your role cannot rename this record.');
            return;
          }
          if(!renameInput) return;
          const result = renameThreadCompany(thread.id, renameInput.value);
          if(result.changed){
            toast(`Renamed to ${result.name}.`);
          }
          update();
        };
        const openRename = ()=>{
          if(!canRenameThread){
            toast('Your role cannot rename this record.');
            return;
          }
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
              <td colspan="8" style="padding:16px 12px; color: var(--muted);">
                No active records yet. Create a new record to get started.
              </td>
            </tr>
          `;
        }else{
          const newlyAnimatedRows = [];
          body.innerHTML = rows.map((row, idx)=> {
            const pct = completionPctFromSummary(row.completion);
            const dateValue = dashboardDateValueForMode(row);
            const createdLabel = formatDashboardDateCreated(dateValue);
            const createdTitle = formatDashboardDate(dateValue);
            const hasUnseenUpdate = !!row.hasUnseenUpdate;
            const showUnseenDot = hasUnseenUpdate && sanitizeDashboardDateMode(state.dashboardDateMode) === 'modified';
            const createdTitleFull = showUnseenDot
              ? `Updated since your last view • ${createdTitle}`
              : createdTitle;
            const checked = state.dashboardSelectedIds.has(row.id) ? 'checked' : '';
            const animateStar = !!state.starPulseQueue && state.starPulseQueue.has(row.id);
            const shouldAnimateRing = !state.completionRingAnimatedIds.has(row.id);
            const rowAnimId = `active:${row.id}`;
            const shouldAnimateRow = !state.dashboardRowAnimatedIds.has(rowAnimId);
            const collabHtml = collaboratorStackHtml({
              collaborators: row.collaborators,
              lockOwner: row.lockOwner,
              lockExpiresAt: row.lockExpiresAt
            }, { maxVisible:3, size:'sm', showSingle:false });
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
                    ${collabHtml ? `<span class="dashCollabWrap">${collabHtml}</span>` : ''}
                  </div>
                </td>
                <td>
                  <div class="dashCompletion" title="${escapeHtml(row.completion)}">
                    <span class="dashCompletionRing${shouldAnimateRing ? ' is-enter' : ''}" data-ring-id="${escapeHtml(row.id)}" data-target-pct="${pct}" data-animate="${shouldAnimateRing ? 'true' : 'false'}" style="--pct:${shouldAnimateRing ? 0 : pct};"><span>${shouldAnimateRing ? '0%' : `${pct}%`}</span></span>
                  </div>
                </td>
                <td><span class="dash-tier" title="${escapeHtml(row.tierLabel || row.tier || 'Tier')}">${escapeHtml(row.tierShort || '—')}</span></td>
                <td><span class="dash-status" data-tone="${escapeHtml(row.statusTone || 'viewer')}">${escapeHtml(row.statusLabel || 'Viewer')}</span></td>
                <td><span class="dash-outcomes">${escapeHtml(row.outcomes)}</span></td>
                <td><span class="dash-gaps">${escapeHtml(row.gaps)}</span></td>
                <td>
                  <span class="dash-created" data-unseen="${showUnseenDot ? 'true' : 'false'}" title="${escapeHtml(createdTitleFull)}">
                    <span class="dash-createdDot" aria-hidden="true"></span>
                    <span class="dash-createdLabel">${escapeHtml(createdLabel)}</span>
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
          const newestUpdate = rows.reduce((max, row)=> Math.max(max, Number(row.updatedAt || 0)), 0);
          last.textContent = rows.length
            ? `Last modified: ${formatDashboardDate(newestUpdate)}`
            : 'No saved records yet';
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
          const selectedManageable = rows.filter((row)=> {
            if(!state.dashboardSelectedIds.has(row.id)) return false;
            const thread = findSavedThread(row.id);
            if(!thread) return false;
            const perms = actorPermissionsForThread(thread);
            return perms.role === 'admin' || perms.role === 'owner';
          }).length;
          archiveBtn.disabled = selectedManageable === 0;
          archiveBtn.dataset.active = selectedManageable > 0 ? 'true' : 'false';
          archiveBtn.classList.toggle('primary', selectedManageable > 0);
          archiveBtn.textContent = selectedManageable === selectedCount
            ? 'Archive selected'
            : 'Archive selected (owner/admin only)';
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
              <td colspan="8" style="padding:16px 12px; color: var(--muted);">
                No archived accounts yet.
              </td>
            </tr>
          `;
        }else{
          const newlyAnimatedRows = [];
          body.innerHTML = rows.map((row, idx)=> {
            const pct = completionPctFromSummary(row.completion);
            const dateValue = dashboardDateValueForMode(row);
            const createdLabel = formatDashboardDateCreated(dateValue);
            const createdTitle = formatDashboardDate(dateValue);
            const hasUnseenUpdate = !!row.hasUnseenUpdate;
            const showUnseenDot = hasUnseenUpdate && sanitizeDashboardDateMode(state.dashboardDateMode) === 'modified';
            const createdTitleFull = showUnseenDot
              ? `Updated since your last view • ${createdTitle}`
              : createdTitle;
            const checked = state.archivedSelectedIds.has(row.id) ? 'checked' : '';
            const ringId = `archived:${row.id}`;
            const shouldAnimateRing = !state.completionRingAnimatedIds.has(ringId);
            const rowAnimId = `archived-row:${row.id}`;
            const shouldAnimateRow = !state.dashboardRowAnimatedIds.has(rowAnimId);
            const collabHtml = collaboratorStackHtml({
              collaborators: row.collaborators,
              lockOwner: row.lockOwner,
              lockExpiresAt: row.lockExpiresAt
            }, { maxVisible:3, size:'sm', showSingle:false });
            if(shouldAnimateRow) newlyAnimatedRows.push(rowAnimId);
            return `
              <tr class="${shouldAnimateRow ? 'is-enter' : ''}" style="--row-enter-delay:${Math.min(idx, 14) * 34}ms;" data-archived-row-id="${escapeHtml(row.id)}" data-selected="${checked ? 'true' : 'false'}">
                <td class="dashSelectCol">
                  <input class="dashRowCheck" type="checkbox" data-archived-select-id="${escapeHtml(row.id)}" aria-label="Select ${escapeHtml(row.company)}" ${checked} />
                </td>
                <td><div class="dashCompanyCell"><span class="dash-company">${escapeHtml(row.company)}</span>${collabHtml ? `<span class="dashCollabWrap">${collabHtml}</span>` : ''}</div></td>
                <td>
                  <div class="dashCompletion" title="${escapeHtml(row.completion)}">
                    <span class="dashCompletionRing${shouldAnimateRing ? ' is-enter' : ''}" data-ring-id="${escapeHtml(ringId)}" data-target-pct="${pct}" data-animate="${shouldAnimateRing ? 'true' : 'false'}" style="--pct:${shouldAnimateRing ? 0 : pct};"><span>${shouldAnimateRing ? '0%' : `${pct}%`}</span></span>
                  </div>
                </td>
                <td><span class="dash-tier" title="${escapeHtml(row.tierLabel || row.tier || 'Tier')}">${escapeHtml(row.tierShort || '—')}</span></td>
                <td><span class="dash-status" data-tone="${escapeHtml(row.statusTone || 'viewer')}">${escapeHtml(row.statusLabel || 'Viewer')}</span></td>
                <td><span class="dash-outcomes">${escapeHtml(row.outcomes)}</span></td>
                <td><span class="dash-gaps">${escapeHtml(row.gaps)}</span></td>
                <td>
                  <span class="dash-created" data-unseen="${showUnseenDot ? 'true' : 'false'}" title="${escapeHtml(createdTitleFull)}">
                    <span class="dash-createdDot" aria-hidden="true"></span>
                    <span class="dash-createdLabel">${escapeHtml(createdLabel)}</span>
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

        const selectedManageable = rows.filter((row)=> {
          if(!state.archivedSelectedIds.has(row.id)) return false;
          const thread = findSavedThread(row.id);
          if(!thread) return false;
          const perms = actorPermissionsForThread(thread);
          return perms.role === 'admin' || perms.role === 'owner';
        }).length;
        const restoreBtn = $('#archivedRestoreSelected');
        if(restoreBtn){
          restoreBtn.disabled = selectedManageable === 0;
          restoreBtn.textContent = selectedManageable === selectedCount
            ? 'Unarchive selected'
            : 'Unarchive selected (owner/admin only)';
        }
        const deleteBtn = $('#archivedDeleteSelected');
        if(deleteBtn){
          deleteBtn.disabled = selectedManageable === 0;
          deleteBtn.textContent = selectedManageable === selectedCount
            ? 'Delete selected'
            : 'Delete selected (owner/admin only)';
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

      const contentFormatLabels = {
        webinar: 'Webinar',
        'case-study': 'Case study',
        ebook: 'Ebook',
        'media-coverage': 'Media coverage',
        'c7-blog': 'C7 blog',
        'blog-post': 'Blog post'
      };
      const outcomeContentKeywordMap = {
        fasterResponse: ['incident response', 'response', 'detection', 'soc', 'threat', 'exercise', 'simulation', 'mttr', 'mttd'],
        secureEnterprise: ['appsec', 'secure development', 'cloud', 'identity', 'vulnerability', 'devsecops', 'enterprise', 'security stack'],
        secureAI: ['ai', 'artificial intelligence', 'llm', 'model', 'genai', 'safe ai'],
        complianceEvidence: ['compliance', 'regulatory', 'audit', 'framework', 'nist', 'dora', 'evidence', 'board', 'benchmark'],
        cyberWorkforce: ['workforce', 'skills', 'upskill', 'training', 'certification', 'readiness', 'resilience'],
        supplyChain: ['third-party', 'third party', 'supplier', 'supply chain', 'vendor', 'procurement']
      };
      const outcomePreferredFormats = {
        fasterResponse: ['case-study', 'webinar', 'blog-post', 'c7-blog', 'ebook'],
        secureEnterprise: ['case-study', 'blog-post', 'c7-blog', 'webinar', 'ebook'],
        secureAI: ['blog-post', 'c7-blog', 'webinar', 'ebook', 'case-study'],
        complianceEvidence: ['ebook', 'case-study', 'webinar', 'blog-post', 'c7-blog'],
        cyberWorkforce: ['ebook', 'case-study', 'webinar', 'blog-post', 'c7-blog'],
        supplyChain: ['case-study', 'ebook', 'blog-post', 'webinar', 'c7-blog']
      };
      let cachedContentCatalogRows = null;
      let cachedRssCatalogRows = [];
      let rssCatalogHydrated = false;
      let rssCatalogHydratePromise = null;
      let rssFailureToastShown = false;
      const CONTENT_MAX_AGE_DAYS = 365 * 3;
      const CONTENT_FRESH_PRIORITY_DAYS = 365;
      const CONTENT_RECENT_PRIORITY_DAYS = 365 * 2;
      const RSS_FETCH_TIMEOUT_MS = 12000;
      const OFFICIAL_BLOG_RSS_URL = 'https://www.immersivelabs.com/resources/blog/rss.xml';
      const OFFICIAL_BLOG_RSS_PROXY_URL = `https://api.allorigins.win/raw?url=${encodeURIComponent(OFFICIAL_BLOG_RSS_URL)}`;
      const IMMERSIVE_DEFAULT_IMAGE_URL = 'https://cdn.prod.website-files.com/6735fba9a631272fb4513263/679228e2e5f16602a4b0c480_Why%20Immersive-cta-image.webp';
      const defaultRssFeedSources = Object.freeze([
        { key:'blog-post', label:'Blog (official RSS via proxy)', url: OFFICIAL_BLOG_RSS_PROXY_URL },
        { key:'blog-post', label:'Blog (official RSS direct)', url: OFFICIAL_BLOG_RSS_URL }
      ]);
      let rssCatalogFetchReport = {
        loading: false,
        attempted: 0,
        succeeded: 0,
        failed: 0,
        errors: []
      };

      function rewriteLegacyImmersiveBlogUrl(rawUrl){
        const value = String(rawUrl || '').trim();
        if(!value) return '';
        let parsed = null;
        try{
          parsed = new URL(value);
        }catch(err){
          return value;
        }
        const host = String(parsed.hostname || '').toLowerCase();
        if(!host.endsWith('immersivelabs.com')) return value;
        const currentPath = String(parsed.pathname || '');
        if(currentPath === '/blog' || currentPath.startsWith('/blog/')){
          parsed.pathname = currentPath.replace(/^\/blog(\/|$)/, '/resources/blog$1');
          return parsed.toString();
        }
        return value;
      }

      function normalizeContentToken(value){
        return String(value || '')
          .toLowerCase()
          .replace(/&/g, ' and ')
          .replace(/[^a-z0-9]+/g, ' ')
          .trim();
      }

      function normalizedHttpUrl(raw){
        const value = String(raw || '').trim();
        if(!value) return '';
        if(/^https?:\/\//i.test(value)) return rewriteLegacyImmersiveBlogUrl(value);
        if(value.startsWith('//')) return rewriteLegacyImmersiveBlogUrl(`https:${value}`);
        if(value.startsWith('/')) return rewriteLegacyImmersiveBlogUrl(`https://www.immersivelabs.com${value}`);
        return '';
      }

      function safeLinkHref(raw, opts){
        const cfg = Object.assign({ allowHash:false }, opts || {});
        const value = String(raw || '').trim();
        if(!value) return '';
        if(cfg.allowHash && /^#[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(value)){
          return value;
        }
        return normalizedHttpUrl(value);
      }

      function safeMailtoHref(raw){
        const value = String(raw || '').trim();
        if(!value) return '';
        const email = value.replace(/^mailto:/i, '').split('?')[0].trim().toLowerCase();
        if(!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)){
          return '';
        }
        return `mailto:${email}`;
      }

      function publishedTimestamp(value){
        const text = String(value || '').trim();
        if(!text) return 0;
        const ts = Date.parse(text);
        return Number.isFinite(ts) ? ts : 0;
      }

      function ageDaysFromPublished(value){
        const ts = publishedTimestamp(value);
        if(!ts) return null;
        const diffMs = Date.now() - ts;
        if(!Number.isFinite(diffMs)) return null;
        if(diffMs < 0) return 0;
        return Math.floor(diffMs / 86400000);
      }

      function isWithinContentAgeLimit(value){
        const ageDays = ageDaysFromPublished(value);
        if(ageDays == null) return true;
        return ageDays <= CONTENT_MAX_AGE_DAYS;
      }

      function recencyScoreBonus(value){
        const ageDays = ageDaysFromPublished(value);
        if(ageDays == null) return 0;
        if(ageDays <= CONTENT_FRESH_PRIORITY_DAYS) return 16;
        if(ageDays <= CONTENT_RECENT_PRIORITY_DAYS) return 8;
        if(ageDays <= CONTENT_MAX_AGE_DAYS) return 2;
        return -40;
      }

      function isRssCatalogSource(source){
        return /^rss\s*:/i.test(String(source || '').trim());
      }

      function formatPublishedDate(value){
        const ts = publishedTimestamp(value);
        if(!ts) return '';
        try{
          return new Intl.DateTimeFormat(undefined, { year:'numeric', month:'short', day:'numeric' }).format(new Date(ts));
        }catch(err){
          return '';
        }
      }

      function recommendationSourceLabel(card){
        const source = String(card && card.source || '').trim();
        if(source){
          return isRssCatalogSource(source) ? source : `Catalog: ${source}`;
        }
        return 'Catalog: Webflow export';
      }

      function recommendationRssStatusText(cards){
        const loaded = Array.isArray(cachedRssCatalogRows) ? cachedRssCatalogRows.length : 0;
        const shown = Array.isArray(cards)
          ? cards.reduce((sum, card)=> sum + (isRssCatalogSource(card && card.source) ? 1 : 0), 0)
          : 0;
        if(rssCatalogFetchReport.loading) return 'RSS: loading feeds…';
        if(!rssCatalogHydrated) return 'RSS: waiting to load';
        if(loaded > 0){
          return shown > 0
            ? `RSS: ${loaded} items loaded · ${shown} shown`
            : `RSS: ${loaded} items loaded`;
        }
        if((rssCatalogFetchReport.failed || 0) > 0){
          return 'RSS: unavailable, using catalog only';
        }
        return 'RSS: no items loaded';
      }

      function safeSlugForContent(value){
        const token = normalizeContentToken(value).replace(/\s+/g, '-').slice(0, 80);
        return token || `item-${Date.now()}`;
      }

      let cachedContentImageLookup = null;

      function buildContentImageLookup(){
        if(cachedContentImageLookup) return cachedContentImageLookup;
        const map = new Map();
        const ingestRow = (row)=>{
          if(!row || typeof row !== 'object') return;
          const imageUrl = normalizedHttpUrl(
            row.imageUrl
            || row.image
            || row.thumbnail
            || row.thumbnailUrl
            || row.heroImage
            || row.coverImage
          );
          if(!imageUrl) return;
          const slugKey = safeSlugForContent(row.slug || '');
          const titleKey = normalizeContentToken(row.title || '');
          const urlKey = safeSlugForContent((()=>{
            const directUrl = normalizedHttpUrl(row.url || '');
            if(!directUrl) return '';
            try{
              const parsed = new URL(directUrl);
              const bits = String(parsed.pathname || '').split('/').filter(Boolean);
              return bits.length ? bits[bits.length - 1] : '';
            }catch(err){
              return '';
            }
          })());
          if(slugKey && !map.has(`slug:${slugKey}`)) map.set(`slug:${slugKey}`, imageUrl);
          if(titleKey && !map.has(`title:${titleKey}`)) map.set(`title:${titleKey}`, imageUrl);
          if(urlKey && !map.has(`url:${urlKey}`)) map.set(`url:${urlKey}`, imageUrl);
        };
        (Array.isArray(window && window.immersiveContentCatalog) ? window.immersiveContentCatalog : []).forEach(ingestRow);
        (Array.isArray(cachedRssCatalogRows) ? cachedRssCatalogRows : []).forEach(ingestRow);
        cachedContentImageLookup = map;
        return cachedContentImageLookup;
      }

      function matchedContentImageForItem(item){
        const row = (item && typeof item === 'object') ? item : {};
        const map = buildContentImageLookup();
        const candidates = [];
        const slug = safeSlugForContent(row.slug || '');
        const title = normalizeContentToken(row.title || '');
        if(slug) candidates.push(`slug:${slug}`);
        if(title) candidates.push(`title:${title}`);
        const directUrl = normalizedHttpUrl(row.url || '');
        if(directUrl){
          try{
            const parsed = new URL(directUrl);
            const parts = String(parsed.pathname || '').split('/').filter(Boolean);
            const tail = parts.length ? safeSlugForContent(parts[parts.length - 1]) : '';
            if(tail) candidates.push(`url:${tail}`);
          }catch(err){
            // ignore parse issues
          }
        }
        for(let i = 0; i < candidates.length; i += 1){
          const imageUrl = map.get(candidates[i]);
          if(imageUrl) return imageUrl;
        }
        return '';
      }

      function cardImageUrlForItem(item){
        const direct = normalizedHttpUrl(
          (item && (item.imageUrl || item.image || item.thumbnail || item.thumbnailUrl || item.heroImage || item.coverImage)) || ''
        );
        if(direct) return direct;
        const matched = matchedContentImageForItem(item);
        if(matched) return matched;
        return IMMERSIVE_DEFAULT_IMAGE_URL;
      }

      function firstImageFromHtmlString(html){
        const source = String(html || '');
        if(!source) return '';
        const match = source.match(/<img[^>]+src=["']([^"']+)["']/i);
        if(!match || !match[1]) return '';
        return normalizedHttpUrl(match[1]);
      }

      function plainTextFromHtml(raw){
        const source = String(raw || '');
        if(!source) return '';
        if(window && window.DOMParser){
          try{
            const doc = new window.DOMParser().parseFromString(source, 'text/html');
            const text = doc && doc.body ? String(doc.body.textContent || '').trim() : '';
            if(text) return text;
          }catch(err){
            // fall through to regex fallback
          }
        }
        return source.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      }

      function cleanFeedMetadataLabel(raw){
        return String(raw || '')
          .replace(/![^!\s]{1,80}!/g, ' ')
          .replace(/^[\s:;\-|]+/, '')
          .replace(/[\s:;\-|]+$/, '')
          .replace(/\s+/g, ' ')
          .trim();
      }

      function rssSummaryFromRaw(rawText, maxLen){
        const limit = Math.max(80, Number(maxLen) || 180);
        let text = plainTextFromHtml(rawText);
        if(!text) return '';
        text = text
          .replace(/\s*:[^:]{2,80}:\s*![^!]{2,120}!/gi, ' ')
          .replace(/![^!\s]{1,80}!/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if(!text) return '';
        if(text.length <= limit) return text;
        const cutoff = text.lastIndexOf(' ', limit - 1);
        if(cutoff > 80){
          return `${text.slice(0, cutoff).trim()}…`;
        }
        return `${text.slice(0, limit - 1).trim()}…`;
      }

      function imageUrlFromRssNodeXml(nodeXml){
        const xml = String(nodeXml || '');
        if(!xml) return '';
        const mediaMatch = xml.match(/<(?:media:content|media:thumbnail|enclosure)\b[^>]*\burl=["']([^"']+)["']/i);
        if(mediaMatch && mediaMatch[1]){
          const direct = normalizedHttpUrl(mediaMatch[1]);
          if(direct) return direct;
        }
        return firstImageFromHtmlString(xml);
      }

      function parseRssRows(feed, xmlText){
        if(!(window && window.DOMParser) || !feed || !xmlText) return [];
        let doc = null;
        try{
          doc = new window.DOMParser().parseFromString(String(xmlText), 'text/xml');
        }catch(err){
          return [];
        }
        if(!doc || doc.querySelector('parsererror')) return [];
        const items = Array.from(doc.querySelectorAll('item'));
        if(!items.length) return [];
        return items.slice(0, 24).map((node, idx)=>{
          const textBySelectors = (selectors)=>{
            for(let i = 0; i < selectors.length; i += 1){
              const el = node.querySelector(selectors[i]);
              if(el){
                const text = String(el.textContent || '').trim();
                if(text) return text;
              }
            }
            return '';
          };
          const title = textBySelectors(['title']);
          const link = normalizedHttpUrl(textBySelectors(['link']));
          if(!title || !link) return null;
          const pubDate = textBySelectors(['pubDate', 'dc\\:date']);
          if(!isWithinContentAgeLimit(pubDate)) return null;
          const category = cleanFeedMetadataLabel(textBySelectors(['category']) || feed.label);
          const rawDescription = textBySelectors(['content\\:encoded', 'description']) || textBySelectors(['description', 'content\\:encoded']);
          const summary = rssSummaryFromRaw(rawDescription, 190);
          const slug = safeSlugForContent(title);
          const id = `${feed.key}:rss:${slug}:${idx}`;
          const nodeXml = (window && window.XMLSerializer) ? new window.XMLSerializer().serializeToString(node) : '';
          const mediaNode = node.querySelector('enclosure[url], media\\:content[url], media\\:thumbnail[url]');
          const imageUrl = normalizedHttpUrl(mediaNode ? mediaNode.getAttribute('url') : '')
            || imageUrlFromRssNodeXml(nodeXml)
            || firstImageFromHtmlString(rawDescription || textBySelectors(['content\\:encoded', 'description']))
            || firstImageFromHtmlString(nodeXml);
          return {
            id,
            title,
            slug,
            format: feed.key,
            category,
            topicTags: [],
            contributors: [],
            url: link,
            linkLabel: 'Read more',
            publishedOn: pubDate,
            sourceCsv: `RSS: ${feed.label}`,
            summary,
            imageUrl
          };
        }).filter(Boolean);
      }

      async function hydrateRssCatalogRows(){
        if(rssCatalogHydrated) return cachedRssCatalogRows;
        if(rssCatalogHydratePromise) return rssCatalogHydratePromise;
        rssCatalogFetchReport = {
          loading: true,
          attempted: defaultRssFeedSources.length,
          succeeded: 0,
          failed: 0,
          errors: []
        };
        if(!(window && typeof window.fetch === 'function')){
          rssCatalogHydrated = true;
          rssCatalogFetchReport.loading = false;
          rssCatalogFetchReport.failed = defaultRssFeedSources.length;
          rssCatalogFetchReport.errors = ['Fetch API unavailable in this browser'];
          return cachedRssCatalogRows;
        }
        rssCatalogHydratePromise = (async ()=>{
          const rows = [];
          await Promise.all(defaultRssFeedSources.map(async (feed)=>{
            const controller = (window && typeof window.AbortController === 'function')
              ? new window.AbortController()
              : null;
            const timeoutId = controller
              ? window.setTimeout(()=> controller.abort(), RSS_FETCH_TIMEOUT_MS)
              : 0;
            try{
              const response = await window.fetch(feed.url, {
                method:'GET',
                mode:'cors',
                credentials:'omit',
                signal: controller ? controller.signal : undefined
              });
              if(!response || !response.ok){
                rssCatalogFetchReport.failed += 1;
                rssCatalogFetchReport.errors.push(`${feed.label}: HTTP ${response ? response.status : 'request failed'}`);
                return;
              }
              const xmlText = await response.text();
              rows.push(...parseRssRows(feed, xmlText));
              rssCatalogFetchReport.succeeded += 1;
            }catch(err){
              rssCatalogFetchReport.failed += 1;
              const msg = (err && err.name === 'AbortError')
                ? `request timed out after ${Math.round(RSS_FETCH_TIMEOUT_MS / 1000)}s`
                : ((err && err.message) ? err.message : 'request failed');
              rssCatalogFetchReport.errors.push(`${feed.label}: ${msg}`);
              // Best effort only; existing content catalog remains the default source.
            }finally{
              if(timeoutId){
                window.clearTimeout(timeoutId);
              }
            }
          }));
          const deduped = [];
          const seen = new Set();
          rows.sort((a, b)=> publishedTimestamp(b.publishedOn) - publishedTimestamp(a.publishedOn));
          rows.forEach((row)=>{
            const key = `${String(row.url || '').trim()}|${normalizeContentToken(row.title)}`;
            if(!key || seen.has(key)) return;
            seen.add(key);
            deduped.push(row);
          });
          cachedRssCatalogRows = deduped.slice(0, 30);
          if(!cachedRssCatalogRows.length){
            const fallbackRows = (Array.isArray(window && window.immersiveOfficialBlogRssFallback) ? window.immersiveOfficialBlogRssFallback : [])
              .filter((row)=> row && typeof row === 'object' && String(row.title || '').trim())
              .map((row, idx)=> ({
                id: String(row.id || `blog-post:fallback:${safeSlugForContent(row.title || idx)}`),
                title: String(row.title || '').trim(),
                slug: String(row.slug || '').trim(),
                format: String(row.format || 'blog-post').trim().toLowerCase(),
                category: cleanFeedMetadataLabel(String(row.category || 'blog')),
                topicTags: [],
                contributors: [],
                url: normalizedHttpUrl(row.url),
                linkLabel: 'Read more',
                publishedOn: String(row.publishedOn || '').trim(),
                sourceCsv: String(row.sourceCsv || 'RSS: Blog fallback').trim(),
                summary: rssSummaryFromRaw(row.summary || '', 190),
                imageUrl: normalizedHttpUrl(row.imageUrl || row.thumbnailUrl || '')
              }))
              .filter((row)=> !!row.url && isWithinContentAgeLimit(row.publishedOn))
              .sort((a, b)=> publishedTimestamp(b.publishedOn) - publishedTimestamp(a.publishedOn));
            if(fallbackRows.length){
              cachedRssCatalogRows = fallbackRows.slice(0, 30);
            }
          }
          rssCatalogHydrated = true;
          rssCatalogFetchReport.loading = false;
          if(cachedRssCatalogRows.length === 0 && rssCatalogFetchReport.failed > 0){
            console.warn('[RSS] Feed hydration failed; using catalog fallback.', rssCatalogFetchReport.errors);
            if(!rssFailureToastShown && state.currentView === 'recommendations'){
              toast('RSS feeds are unavailable right now. Showing catalog content only.');
              rssFailureToastShown = true;
            }
          }
          cachedContentCatalogRows = null;
          cachedContentImageLookup = null;
          if(state.currentView === 'recommendations'){
            const thread = resolveRecommendationThread(state.recommendationsThreadId || state.activeThread || 'current');
            renderContentRecommendationsView(recommendationsGateFromThread(thread));
          }
          return cachedRssCatalogRows;
        })().finally(()=>{
          rssCatalogHydratePromise = null;
        });
        return rssCatalogHydratePromise;
      }

      function inferredContentUrl(format, slug){
        const cleanSlug = String(slug || '').trim();
        if(!cleanSlug) return '';
        const fmt = String(format || '').trim().toLowerCase();
        if(fmt === 'blog-post'){
          return `https://www.immersivelabs.com/resources/blog/${encodeURIComponent(cleanSlug)}/`;
        }
        if(fmt === 'c7-blog'){
          return `https://www.immersivelabs.com/resources/c7-blog/${encodeURIComponent(cleanSlug)}/`;
        }
        if(fmt === 'case-study'){
          return `https://www.immersivelabs.com/resources/case-study/${encodeURIComponent(cleanSlug)}/`;
        }
        if(fmt === 'ebook'){
          return `https://www.immersivelabs.com/resources/ebook/${encodeURIComponent(cleanSlug)}/`;
        }
        if(fmt === 'webinar'){
          return `https://www.immersivelabs.com/resources/webinars/${encodeURIComponent(cleanSlug)}/`;
        }
        return '';
      }

      function inferredContentSlug(row){
        const directSlug = String(row && row.slug || '').trim();
        if(directSlug) return directSlug;
        const fromTitle = safeSlugForContent(row && row.title || '');
        return String(fromTitle || '').trim();
      }

      function canonicalizeContentUrlByFormat(url, format, slug){
        const direct = normalizedHttpUrl(url);
        if(!direct) return '';
        const formatKey = String(format || '').trim().toLowerCase();
        if(formatKey !== 'blog-post') return direct;
        let parsed = null;
        try{
          parsed = new URL(direct);
        }catch(err){
          return direct;
        }
        const host = String(parsed.hostname || '').toLowerCase();
        if(!host.endsWith('immersivelabs.com')) return direct;
        const currentPath = String(parsed.pathname || '');
        if(currentPath === '/resources/c7-blog' || currentPath.startsWith('/resources/c7-blog/')){
          parsed.pathname = currentPath.replace(/^\/resources\/c7-blog(\/|$)/, '/resources/blog$1');
          return parsed.toString();
        }
        if(currentPath === '/c7-blog' || currentPath.startsWith('/c7-blog/')){
          parsed.pathname = currentPath.replace(/^\/c7-blog(\/|$)/, '/resources/blog$1');
          return parsed.toString();
        }
        if(currentPath === '/blog' || currentPath.startsWith('/blog/')){
          parsed.pathname = currentPath.replace(/^\/blog(\/|$)/, '/resources/blog$1');
          return parsed.toString();
        }
        if((currentPath === '/' || !currentPath) && String(slug || '').trim()){
          parsed.pathname = `/resources/blog/${encodeURIComponent(String(slug).trim())}/`;
          return parsed.toString();
        }
        return direct;
      }

      function catalogItems(){
        if(Array.isArray(cachedContentCatalogRows)) return cachedContentCatalogRows;
        const baseRows = (window && Array.isArray(window.immersiveContentCatalog))
          ? window.immersiveContentCatalog
          : [];
        const rows = baseRows.concat(Array.isArray(cachedRssCatalogRows) ? cachedRssCatalogRows : []);
        const seenIds = new Set();
        cachedContentCatalogRows = rows
          .filter((row)=> row && typeof row === 'object' && String(row.title || '').trim())
          .map((row)=>{
            const id = String(row.id || '').trim() || `content:${normalizeContentToken(row.title)}`;
            if(!id || seenIds.has(id)) return null;
            seenIds.add(id);
            const publishedOn = String(row.publishedOn || '').trim();
            const publishedTs = publishedTimestamp(publishedOn);
            const ageDays = ageDaysFromPublished(publishedOn);
            const formatKey = String(row.format || '').trim().toLowerCase();
            const contentSlug = inferredContentSlug(row);
            return {
              id,
              title: String(row.title || '').trim(),
              slug: contentSlug,
              format: formatKey,
              category: String(row.category || '').trim(),
              topicTags: Array.isArray(row.topicTags) ? row.topicTags.map((tag)=> String(tag || '').trim()).filter(Boolean) : [],
              contributors: Array.isArray(row.contributors) ? row.contributors.map((name)=> String(name || '').trim()).filter(Boolean) : [],
              url: (() => {
                const direct = canonicalizeContentUrlByFormat(row.url, formatKey, contentSlug);
                if(direct) return direct;
                const inferred = inferredContentUrl(formatKey, contentSlug);
                if(inferred) return inferred;
                return '';
              })(),
              linkLabel: 'Read more',
              imageUrl: normalizedHttpUrl(
                row.imageUrl
                || row.image
                || row.thumbnail
                || row.thumbnailUrl
                || row.heroImage
                || row.coverImage
              ),
              publishedOn,
              publishedTs,
              ageDays,
              sourceCsv: String(row.sourceCsv || '').trim()
            };
          })
          .filter((row)=> !!row && (row.ageDays == null || row.ageDays <= CONTENT_MAX_AGE_DAYS));
        return cachedContentCatalogRows;
      }

      function keywordsForOutcome(meta){
        const id = String((meta && meta.id) || '').trim();
        if(id && Array.isArray(outcomeContentKeywordMap[id])) return outcomeContentKeywordMap[id];
        const raw = `${String((meta && meta.label) || '')} ${String((meta && meta.short) || '')}`.trim();
        return normalizeContentToken(raw)
          .split(' ')
          .filter((token)=> token && token.length > 3);
      }

      function preferredFormatsForOutcome(meta){
        const id = String((meta && meta.id) || '').trim();
        if(id && Array.isArray(outcomePreferredFormats[id])) return outcomePreferredFormats[id];
        return ['case-study', 'ebook', 'webinar', 'blog-post', 'c7-blog', 'media-coverage'];
      }

      function contentSearchText(item){
        const bits = [
          item.title,
          item.slug,
          item.format,
          item.category,
          ...(Array.isArray(item.topicTags) ? item.topicTags : []),
          ...(Array.isArray(item.contributors) ? item.contributors : [])
        ];
        return normalizeContentToken(bits.join(' '));
      }

      function scoreCatalogItem(item, keywords, preferredFormats){
        const fmt = String(item.format || '').toLowerCase();
        let score = 0;
        const fmtIndex = preferredFormats.indexOf(fmt);
        if(fmtIndex >= 0){
          score += Math.max(14, 34 - (fmtIndex * 4));
        }else{
          score += 10;
        }
        const haystack = contentSearchText(item);
        let keywordHits = 0;
        let partialHits = 0;
        (keywords || []).forEach((kw, idx)=>{
          const needle = normalizeContentToken(kw);
          if(!needle) return;
          if(haystack.includes(needle)){
            keywordHits += 1;
            score += idx < 3 ? 12 : 8;
            return;
          }
          const tokens = needle.split(' ').filter((token)=> token.length > 3);
          if(tokens.some((token)=> haystack.includes(token))){
            partialHits += 1;
            score += idx < 3 ? 6 : 4;
          }
        });
        if(keywordHits === 0 && partialHits === 0 && (keywords || []).length){
          score -= 8;
        }
        if(item.url) score += 3;
        score += recencyScoreBonus(item.publishedOn);
        if(isRssCatalogSource(item && item.sourceCsv)) score += 4;
        if(normalizedHttpUrl(item && item.imageUrl) || matchedContentImageForItem(item)) score += 2;
        return score;
      }

      function formatLabelForContent(format){
        const key = String(format || '').trim().toLowerCase();
        return contentFormatLabels[key] || 'Content';
      }

      function pickCatalogItemsForOutcome(meta, usedIds, limit){
        const rows = catalogItems();
        if(!rows.length) return [];
        const keywords = keywordsForOutcome(meta);
        const preferredFormats = preferredFormatsForOutcome(meta);
        const available = rows.filter((row)=> !usedIds.has(row.id));
        if(!available.length) return [];

        const scored = available
          .map((row)=> ({ row, score: scoreCatalogItem(row, keywords, preferredFormats) }))
          .sort((a, b)=> (b.score - a.score));
        if(!scored.length) return [];
        const maxItems = Math.max(1, Number(limit) || 1);
        const bestScore = scored[0].score;
        const toleranceFloor = bestScore - 20;
        let picks = scored.filter((entry)=> entry.score >= toleranceFloor);
        if(!picks.length) picks = scored;
        picks = picks.slice(0, maxItems).map((entry)=> entry.row);
        picks.forEach((row)=> usedIds.add(row.id));
        return picks;
      }

      function pickLatestCatalogItemsByFormats(formats, usedIds, limit){
        const formatSet = new Set(
          (Array.isArray(formats) ? formats : [])
            .map((format)=> String(format || '').trim().toLowerCase())
            .filter(Boolean)
        );
        if(!formatSet.size) return [];
        const rssWeight = (row)=> isRssCatalogSource(row && row.sourceCsv) ? 1 : 0;
        const available = catalogItems()
          .filter((row)=>
            row
            && formatSet.has(String(row.format || '').toLowerCase())
            && !usedIds.has(row.id)
            && isWithinContentAgeLimit(row.publishedOn)
          )
          .sort((left, right)=>{
            const rssDelta = rssWeight(right) - rssWeight(left);
            if(rssDelta) return rssDelta;
            const freshnessDelta = recencyScoreBonus(right.publishedOn) - recencyScoreBonus(left.publishedOn);
            if(freshnessDelta) return freshnessDelta;
            return publishedTimestamp(right.publishedOn) - publishedTimestamp(left.publishedOn);
          });
        const picks = available.slice(0, Math.max(1, Number(limit) || 1));
        picks.forEach((row)=> usedIds.add(row.id));
        return picks;
      }

      function recommendationCardBlueprint(outcome, matched, options){
        const meta = outcomeById(outcome && outcome.id) || outcome || {};
        if(!matched) return null;
        const opts = (options && typeof options === 'object') ? options : {};
        const topicLine = (matched.topicTags || [])
          .map((tag)=> cleanFeedMetadataLabel(tag))
          .filter(Boolean)
          .slice(0, 3)
          .join(' · ');
        const itemSummary = rssSummaryFromRaw(matched.summary || '', 180);
        const categoryLabel = cleanFeedMetadataLabel(matched.category || '');
        const summary = itemSummary
          || (topicLine ? `Topics: ${topicLine}` : '')
          || (categoryLabel ? `Category: ${categoryLabel}` : 'Catalog item from current Webflow export.');
        const outcomeLabel = String(opts.outcomeLabel || meta.short || meta.label || 'Priority outcome');
        const formatKey = String(matched.format || '').trim().toLowerCase();
        const whyOverride = String(opts.why || '').trim();
        return {
          format: formatLabelForContent(formatKey),
          formatKey,
          outcomeLabel,
          title: matched.title,
          summary,
          why: whyOverride || `Selected because it supports your ${outcomeLabel.toLowerCase()} priority.`,
          url: safeLinkHref(matched.url) || '',
          linkLabel: matched.linkLabel || 'Read more',
          source: matched.sourceCsv || '',
          publishedOn: matched.publishedOn || '',
          imageUrl: cardImageUrlForItem(matched)
        };
      }

      function recommendationCardsForGate(gate){
        const outcomes = Array.isArray(gate && gate.topOutcomes) ? gate.topOutcomes : [];
        const activeOutcomes = outcomes.length
          ? outcomes
          : [{ id:'', label:'Priority outcome', short:'Priority outcome' }];
        const usedContentIds = new Set();
        const maxCards = 6;
        const minCards = 3;
        const desiredCards = Math.min(maxCards, Math.max(minCards, activeOutcomes.length * 2));
        const perOutcomeLimit = activeOutcomes.length === 1 ? desiredCards : 2;
        const cards = [];

        activeOutcomes.forEach((outcome)=>{
          if(cards.length >= desiredCards) return;
          const meta = outcomeById(outcome && outcome.id) || outcome || {};
          const remaining = desiredCards - cards.length;
          const picks = pickCatalogItemsForOutcome(meta, usedContentIds, Math.min(perOutcomeLimit, remaining));
          picks.forEach((item)=>{
            const card = recommendationCardBlueprint(outcome, item);
            if(card) cards.push(card);
          });
        });

        if(cards.length < desiredCards){
          const fallbackOutcome = activeOutcomes[0] || {};
          const remaining = desiredCards - cards.length;
          const extras = pickCatalogItemsForOutcome(
            { id: '', label: 'Priority outcome', short: 'Priority outcome' },
            usedContentIds,
            remaining
          );
          extras.forEach((item)=>{
            const card = recommendationCardBlueprint(fallbackOutcome, item);
            if(card) cards.push(card);
          });
        }

        const primaryOutcome = activeOutcomes[0] || {};
        const ensureNewsFormat = (formatKey, outcomeLabel, whyLine)=>{
          const hasFormat = cards.some((card)=> String(card && card.formatKey || '').toLowerCase() === formatKey);
          if(hasFormat) return;
          const latest = pickLatestCatalogItemsByFormats([formatKey], usedContentIds, 1)[0];
          if(!latest) return;
          const card = recommendationCardBlueprint(primaryOutcome, latest, {
            outcomeLabel,
            why: whyLine
          });
          if(!card) return;
          if(cards.length >= maxCards) cards.pop();
          cards.push(card);
        };
        ensureNewsFormat('blog-post', "What's new", 'Default blog content so this page always includes the latest platform updates.');

        return cards.slice(0, maxCards);
      }

      function moduleRowsWithValues(rows){
        return (Array.isArray(rows) ? rows : []).filter((row)=>{
          if(!row || typeof row !== 'object') return false;
          const value = String(row.value || '').trim();
          return !!value && value !== '—';
        });
      }

      function completeCustomerCandidateForThread(thread, preferredId){
        if(!thread || typeof thread !== 'object' || thread.archived) return null;
        const progress = threadReadinessProgress(thread);
        const completion = String(progress.completion || thread.completion || '0/22 (0%)');
        const completionPct = completionPctFromSummary(completion);
        const gaps = Array.isArray(progress.gaps) ? progress.gaps : [];
        if(completionPct < 100 || gaps.length){
          return null;
        }

        const gate = recommendationsGateFromThread(thread);
        const cards = recommendationCardsForGate(gate);
        const modules = (thread.modules && typeof thread.modules === 'object') ? thread.modules : {};
        const moduleCount = Object.keys(modules).reduce((sum, key)=>{
          return sum + moduleRowsWithValues(modules[key]).length;
        }, 0);
        const outcomesCount = Array.isArray(gate.topOutcomes) ? gate.topOutcomes.length : 0;
        const viz = (thread.viz && typeof thread.viz === 'object') ? thread.viz : {};
        const vizSignals = [
          Number(viz.roiPct),
          Number(viz.npv),
          Number(viz.paybackMonths)
        ].filter((n)=> Number.isFinite(n)).length;
        const preferredBonus = (String(thread.id || '') === String(preferredId || '').trim()) ? 25 : 0;

        return {
          thread,
          gate,
          cards,
          score: (cards.length * 100) + (moduleCount * 3) + (outcomesCount * 8) + (vizSignals * 5) + preferredBonus
        };
      }

      function completeCustomerCandidateForThreadId(threadId){
        const targetId = String(threadId || '').trim();
        if(!targetId) return null;
        if(targetId === 'current'){
          return completeCustomerCandidateForThread(currentThreadModel(), 'current');
        }
        const saved = findSavedThread(targetId);
        if(saved){
          return completeCustomerCandidateForThread(saved, targetId);
        }
        if(state.currentView === 'configurator' && targetId === String(state.activeThread || '').trim()){
          return completeCustomerCandidateForThread(currentThreadModel(), targetId);
        }
        return null;
      }

      function bestCompleteCustomerTemplateCandidate(preferredThreadId){
        const preferredId = String(preferredThreadId || '').trim();
        const priorityThreadIds = [];
        const pushThreadId = (value)=>{
          const id = String(value || '').trim();
          if(!id) return;
          if(priorityThreadIds.includes(id)) return;
          priorityThreadIds.push(id);
        };
        pushThreadId(preferredId);
        pushThreadId(state.activeThread || '');
        pushThreadId('current');
        for(let i = 0; i < priorityThreadIds.length; i += 1){
          const candidate = completeCustomerCandidateForThreadId(priorityThreadIds[i]);
          if(candidate) return candidate;
        }
        const rows = threadModels().filter((thread)=> !!thread && !thread.archived);
        const candidates = rows
          .map((thread)=> completeCustomerCandidateForThread(thread, preferredId))
          .filter(Boolean);
        if(!candidates.length) return null;
        candidates.sort((left, right)=>{
          const scoreDelta = right.score - left.score;
          if(scoreDelta) return scoreDelta;
          return Number(right.thread.updatedAt || 0) - Number(left.thread.updatedAt || 0);
        });
        return candidates[0];
      }

      function customerTemplateModelFromCandidate(candidate){
        const record = candidate && candidate.thread ? candidate.thread : null;
        if(!record) return null;
        const gate = candidate.gate || recommendationsGateFromThread(record);
        const cards = Array.isArray(candidate.cards) ? candidate.cards : recommendationCardsForGate(gate);
        const modules = (record.modules && typeof record.modules === 'object') ? record.modules : {};
        const organizationRows = moduleRowsWithValues(modules.organisation || []);
        const discoveryRows = moduleRowsWithValues(modules.discovery || []);
        const coverageRows = moduleRowsWithValues(modules.coverage || []);
        const packageFitRows = moduleRowsWithValues(modules.packageFit || []);
        const contextRows = moduleRowsWithValues(modules.context || []);
        const profileName = moduleValueByLabel(organizationRows, 'Name')
          || String(record.snapshot && record.snapshot.fullName || '').trim()
          || 'Customer team';
        const roleLabel = moduleValueByLabel(organizationRows, 'Role') || 'Security leader';
        const viz = (record.viz && typeof record.viz === 'object') ? record.viz : {};
        const roiPct = Number(viz.roiPct);
        const npv = Number(viz.npv);
        const paybackMonths = Number(viz.paybackMonths);
        const progress = threadReadinessProgress(record);
        const vizModel = interVizModel(record);
        const pitch = buildInterstitialPitchModel(record, progress, vizModel);
        const topOutcomes = Array.isArray(gate.topOutcomes) ? gate.topOutcomes : [];
        const fallbackOutcomeLabels = splitOverviewList(record.outcomesText || '').slice(0, 3);
        const outcomeRows = (topOutcomes.length
          ? topOutcomes
          : fallbackOutcomeLabels.map((label)=> ({
              id: '',
              label,
              short: label,
              desc: 'Priority outcome captured in the profile.'
            }))
        ).slice(0, 3);
        const outcomePctByKey = new Map(
          (Array.isArray(vizModel && vizModel.outcomeBreakdown) ? vizModel.outcomeBreakdown : [])
            .map((row)=> [normalizeContentToken(row && row.label), clamp(Number(row && row.pct) || 0, 0, 100)])
            .filter((entry)=> entry[0])
        );
        const outcomeBlocks = outcomeRows.map((outcome, idx)=>{
          const title = String((outcome && (outcome.short || outcome.label)) || `Priority outcome ${idx + 1}`).trim() || `Priority outcome ${idx + 1}`;
          const desc = String((outcome && outcome.desc) || '').trim();
          const pct = outcomePctByKey.get(normalizeContentToken(title));
          return {
            title,
            detail: desc || `Outcome priority ${idx + 1} from this complete customer profile.`,
            metric: Number.isFinite(pct) ? `${Math.round(pct)}% weighting` : (idx === 0 ? 'Primary focus' : 'Priority focus')
          };
        });
        const packageInfo = packageOverviewForTier(gate.tier);
        const outcomeTitles = outcomeBlocks.map((row)=> String(row && row.title || '').trim()).filter(Boolean);
        const coverageFocus = interCoverageGroups(record).slice(0, 3);
        const pressureFocus = interPressureSignals(record).slice(0, 2);
        const summaryParts = [];
        if(outcomeTitles.length){
          summaryParts.push(`You told us your top priorities are ${naturalList(outcomeTitles)}.`);
        }
        if(coverageFocus.length){
          summaryParts.push(`The focus teams are ${naturalList(coverageFocus)}.`);
        }
        if(pressureFocus.length){
          summaryParts.push(`Current pressure is coming from ${naturalList(pressureFocus)}.`);
        }
        const needsSummary = summaryParts.length
          ? summaryParts.join(' ')
          : 'You are focused on improving measurable cyber readiness across your priority teams.';
        const improveTarget = outcomeTitles[0] || 'your highest-priority outcome';
        const proveTarget = outcomeTitles[1] || improveTarget;
        const reportTarget = outcomeTitles[2] || outcomeTitles[0] || 'readiness performance';
        const coverageLabel = coverageFocus.length ? naturalList(coverageFocus) : 'security, IT, and engineering teams';
        const pressureLabel = pressureFocus.length ? naturalList(pressureFocus) : 'board, investor, and regulator scrutiny';
        const companyLabel = String(record.company || 'your organisation').trim() || 'your organisation';
        const valueCards = [
          {
            id: 'prove',
            kicker: 'PROVE',
            title: 'Produce evidence of readiness under pressure',
            text: `Run realistic simulations mapped to ${String(proveTarget).toLowerCase()}, then capture performance evidence that stands up to ${pressureLabel}.`,
            bullets: [
              'Pressure-test incident response, leadership, and cross-team coordination.',
              'Validate playbooks across core teams and repeatable operating patterns.',
              'Generate post-exercise evidence for investor, auditor, and regulator review.'
            ],
            reverse: true
          },
          {
            id: 'improve',
            kicker: 'IMPROVE',
            title: 'Improve skills where risk concentrates',
            text: `Where gaps surface around ${String(improveTarget).toLowerCase()}, use hands-on, role-specific labs to build repeatable capability in ${coverageLabel}.`,
            bullets: [
              `Target upskilling for the workflows behind ${String(improveTarget).toLowerCase()}.`,
              `Focus enablement across ${coverageLabel}.`,
              'Track improvement trends by role, team, and programme over time.'
            ],
            reverse: false
          },
          {
            id: 'report',
            kicker: 'REPORT',
            title: 'Produce defensible evidence and reporting',
            text: `Turn exercise and lab performance around ${String(reportTarget).toLowerCase()} into stakeholder-ready outputs ${companyLabel} can use with leadership and external reviewers.`,
            bullets: [
              'Stakeholder-ready dashboards and after-action reporting.',
              'Evidence that supports privacy, safeguarding, and operational resilience expectations.',
              'Clear prioritisation: what to fix, who needs support, and what improved.'
            ],
            reverse: true
          }
        ];
        const demoCard = {
          kicker: 'PRODUCT TOUR',
          title: 'Take a guided tour of the platform',
          text: 'See how you can run scenario-based exercises, capture after-action evidence, and export summaries for stakeholders.',
          ctaLabel: 'Take a Product Tour',
          ctaUrl: 'https://www.immersivelabs.com/demo',
          videoPoster: 'https://cdn.prod.website-files.com/6735fba9a631272fb4513263%2F69848bd313059d7ecc7021f9_immersive-home-hero_poster.0000000.jpg',
          videoMp4: 'https://cdn.prod.website-files.com/6735fba9a631272fb4513263%2F69848bd313059d7ecc7021f9_immersive-home-hero_mp4.mp4',
          videoWebm: 'https://cdn.prod.website-files.com/6735fba9a631272fb4513263%2F69848bd313059d7ecc7021f9_immersive-home-hero_webm.webm'
        };
        const commercialSignals = [
          Number.isFinite(roiPct) ? { label:'ROI (3yr)', value:`${Math.round(roiPct)}%` } : null,
          Number.isFinite(npv) ? { label:'NPV (3yr)', value:fmtMoneyUSD(npv) } : null,
          Number.isFinite(paybackMonths) ? { label:'Payback', value:fmtPayback(paybackMonths) } : null
        ].filter(Boolean);
        const agenda = buildNextMeetingAgenda(topOutcomes).slice(0, 4);
        const resources = buildRecommendedResources(topOutcomes).slice(0, 5);
        const curatedContentCards = cards.length
          ? cards
            .filter((card)=> !isRssCatalogSource(card && card.source))
            .slice(0, 9)
          : [];
        const newsItems = pickLatestCatalogItemsByFormats(['c7-blog', 'blog-post'], new Set(), 3);
        const whatsNewCards = (newsItems.length
          ? newsItems.map((item)=> ({
              format: 'RSS post',
              formatKey: String(item.format || '').trim().toLowerCase() || 'rss-post',
              title: String(item.title || '').trim() || 'Latest update',
              summary: rssSummaryFromRaw(item.summary || '', 190) || 'Latest update from the Immersive Labs blog.',
              url: safeLinkHref(item.url),
              linkLabel: 'Read post',
              publishedOn: String(item.publishedOn || '').trim(),
              imageUrl: cardImageUrlForItem(item)
            }))
          : cards
            .filter((card)=> isRssCatalogSource(card && card.source) || /(?:c7-blog|blog-post)/i.test(String(card && card.formatKey || '')))
            .slice(0, 3)
            .map((card)=> ({
              format: 'RSS post',
              formatKey: String(card && card.formatKey || '').trim().toLowerCase() || 'rss-post',
              title: String(card && card.title || '').trim() || 'Latest update',
              summary: rssSummaryFromRaw(card && card.summary || '', 190) || 'Latest update from the Immersive Labs blog.',
              url: safeLinkHref(card && card.url),
              linkLabel: 'Read post',
              publishedOn: String(card && card.publishedOn || '').trim(),
              imageUrl: cardImageUrlForItem(card)
            }))
        ).slice(0, 3);
        const detailSections = [
          { title:'Your team', rows: organizationRows.slice(0, 5) },
          { title:'What we heard', rows: discoveryRows.slice(0, 5) },
          { title:'Who we need to support', rows: coverageRows.slice(0, 5) },
          { title:'Preferred delivery model', rows: packageFitRows.slice(0, 5) },
          { title:'Operating context', rows: contextRows.slice(0, 5) }
        ].filter((section)=> section.rows.length);
        const contactTeam = [
          {
            name: 'Customer Success Lead',
            role: 'Programme owner',
            email: 'customer.success@immersivelabs.com'
          },
          {
            name: 'Solutions Consultant',
            role: 'Technical advisor',
            email: 'solutions@immersivelabs.com'
          },
          {
            name: 'Support Team',
            role: 'Platform support',
            email: 'support@immersivelabs.com'
          }
        ];
        const generatedOn = new Date().toISOString().slice(0, 10);
        return {
          sourceThreadId: String(record.id || 'current'),
          company: String(record.company || '').trim() || 'Customer',
          tier: String(gate.tier || 'Core').trim() || 'Core',
          completion: String(gate.completion || '22/22 (100%)'),
          stage: String(record.stage || 'Closed'),
          generatedOn,
          hero: {
            eyebrow: 'Customer dashboard',
            title: `${String(record.company || 'Customer')} readiness dashboard`,
            subtitle: `Built from what ${profileName} shared, with recommendations focused on your top priorities and delivery outcomes.`,
            imageUrl: 'https://cdn.prod.website-files.com/6735fba9a631272fb4513263/678646ce52898299cc1134be_HERO%20IMAGE%20LABS.webp',
            primaryCtaLabel: 'Recommended resources',
            primaryCtaHref: '#recommended-for-you',
            secondaryCtaLabel: 'Contact your team',
            secondaryCtaHref: '#contact-your-team',
            stats: [
              { label:'Primary outcome', value: (outcomeBlocks[0] && outcomeBlocks[0].title) || 'Priority outcome' },
              { label:'Package', value: String(gate.tier || 'Core') },
              { label:'Operational focus', value: (outcomeBlocks[0] && outcomeBlocks[0].metric) || 'Primary focus' },
              { label:'Role', value: roleLabel }
            ]
          },
          packageRecommendation: {
            tier: String(gate.tier || 'Core'),
            title: packageInfo.title || `${String(gate.tier || 'Core')} package`,
            rationale: packageInfo.body || ''
          },
          needsSummary,
          valueCards,
          demoCard,
          outcomeBlocks,
          commercialSignals,
          actions: agenda.length ? agenda : ['Align owners and convert the profile into a timed execution plan.'],
          resources: resources.length ? resources : ['Customer briefing pack', 'Outcome mapping workshop'],
          elevatorPitch: {
            isFinal: !!pitch.isFinal,
            completionPct: Number(pitch.completionPct) || 0,
            pitch15: String(pitch.pitch15 || ''),
            pitch30: String(pitch.pitch30 || ''),
            pitch60: String(pitch.pitch60 || '')
          },
          contentCards: (curatedContentCards.length ? curatedContentCards : cards).length
              ? (curatedContentCards.length ? curatedContentCards : cards).map((card)=> Object.assign({}, card, {
                  url: safeLinkHref(canonicalizeContentUrlByFormat(
                    card && card.url,
                    (card && (card.formatKey || card.format)) || '',
                    (card && card.slug) || ''
                  )),
                  imageUrl: cardImageUrlForItem(card)
                }))
              : [{
                  format:'Content',
                  formatKey:'content',
                  outcomeLabel:'Priority outcome',
                  title:'No mapped content found',
                  summary:'No curated recommendations are available yet for this profile.',
                  why:'We could not find a strong content match for your selected priorities yet.',
                  url:'https://www.immersivelabs.com/resources/blog',
                  linkLabel:'Read more',
                  imageUrl:IMMERSIVE_DEFAULT_IMAGE_URL
                }],
          whatsNewCards,
          detailSections,
          contactTeam
        };
      }

      function customerTemplateHtmlFromModel(modelInput){
        const model = (modelInput && typeof modelInput === 'object') ? modelInput : null;
        if(!model) return '';

        const esc = (value)=> String(value == null ? '' : value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');

        const hero = (model.hero && typeof model.hero === 'object') ? model.hero : {};
        const outcomeBlocks = Array.isArray(model.outcomeBlocks) ? model.outcomeBlocks.filter(Boolean).slice(0, 3) : [];
        const actions = Array.isArray(model.actions) ? model.actions.filter(Boolean).slice(0, 6) : [];
        const cards = Array.isArray(model.contentCards) ? model.contentCards.filter(Boolean).slice(0, 9) : [];
        const whatsNewCardsInput = Array.isArray(model.whatsNewCards) ? model.whatsNewCards.filter(Boolean).slice(0, 3) : [];
        const details = Array.isArray(model.detailSections) ? model.detailSections.filter(Boolean).slice(0, 6) : [];
        const packageRecommendation = (model.packageRecommendation && typeof model.packageRecommendation === 'object')
          ? model.packageRecommendation
          : { tier: String(model.tier || 'Core'), title: `${String(model.tier || 'Core')} package`, rationale: '' };
        const valueCardsRaw = Array.isArray(model.valueCards) ? model.valueCards.filter(Boolean).slice(0, 6) : [];
        const demoCard = (model.demoCard && typeof model.demoCard === 'object')
          ? model.demoCard
          : {
              kicker: 'PRODUCT TOUR',
              title: 'Take a guided tour of the platform',
              text: 'See how you can run scenario-based exercises, capture after-action evidence, and export summaries for stakeholders.',
              ctaLabel: 'Take a Product Tour',
              ctaUrl: 'https://www.immersivelabs.com/demo',
              videoPoster: 'https://cdn.prod.website-files.com/6735fba9a631272fb4513263%2F69848bd313059d7ecc7021f9_immersive-home-hero_poster.0000000.jpg',
              videoMp4: 'https://cdn.prod.website-files.com/6735fba9a631272fb4513263%2F69848bd313059d7ecc7021f9_immersive-home-hero_mp4.mp4',
              videoWebm: 'https://cdn.prod.website-files.com/6735fba9a631272fb4513263%2F69848bd313059d7ecc7021f9_immersive-home-hero_webm.webm'
            };
        const heroImageDefault = 'https://cdn.prod.website-files.com/6735fba9a631272fb4513263/678646ce52898299cc1134be_HERO%20IMAGE%20LABS.webp';
        const heroImageUrl = safeLinkHref(hero.imageUrl) || heroImageDefault;
        const heroPrimaryCtaLabel = String(hero.primaryCtaLabel || '').trim() || 'Recommended resources';
        const heroPrimaryCtaHref = safeLinkHref(hero.primaryCtaHref, { allowHash:true }) || '#recommended-for-you';
        const heroSecondaryCtaLabel = String(hero.secondaryCtaLabel || '').trim() || 'Contact your team';
        const heroSecondaryCtaHref = safeLinkHref(hero.secondaryCtaHref, { allowHash:true }) || '#contact-your-team';
        const demoCardCtaHref = safeLinkHref(demoCard && demoCard.ctaUrl);
        const demoCardPosterHref = safeLinkHref(demoCard && demoCard.videoPoster);
        const demoCardVideoMp4Href = safeLinkHref(demoCard && demoCard.videoMp4);
        const demoCardVideoWebmHref = safeLinkHref(demoCard && demoCard.videoWebm);
        const initialsFromName = (value)=> {
          const tokens = String(value || '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
          if(!tokens.length) return 'IL';
          return tokens.map((token)=> token.charAt(0).toUpperCase()).join('').slice(0, 2);
        };
        const contactTeamRaw = Array.isArray(model.contactTeam) ? model.contactTeam.filter(Boolean).slice(0, 4) : [];
        const contactTeam = (contactTeamRaw.length ? contactTeamRaw : [{
          name: 'Customer Success Lead',
          role: 'Programme owner',
          email: 'customer.success@immersivelabs.com'
        }]).map((contact)=> {
          const entry = (contact && typeof contact === 'object') ? contact : {};
          const normalizedEmail = String(entry.email || '').trim() || 'customer.success@immersivelabs.com';
          return {
            name: String(entry.name || 'Customer Success Lead').trim() || 'Customer Success Lead',
            role: String(entry.role || 'Programme owner').trim() || 'Programme owner',
            email: normalizedEmail,
            emailHref: safeMailtoHref(normalizedEmail),
            imageUrl: safeLinkHref(entry.imageUrl),
            initials: initialsFromName(entry.name || 'Customer Success Lead')
          };
        });
        const primaryContactEmail = String((contactTeam[0] && contactTeam[0].email) || 'customer.success@immersivelabs.com').trim();
        const primaryContactMailto = safeMailtoHref(primaryContactEmail) || 'mailto:customer.success@immersivelabs.com';
        const primaryContactRecipient = primaryContactMailto.replace(/^mailto:/i, '');

        const normalizedId = (value)=> String(value || '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '');

        const metricPercent = (metric, fallbackIdx)=>{
          const match = String(metric || '').match(/(\d{1,3})/);
          if(match){
            return clamp(Number(match[1]) || 0, 0, 100);
          }
          const fallback = [61, 27, 12][Number(fallbackIdx) || 0];
          return clamp(Number(fallback) || 0, 0, 100);
        };

        const formatPublishedLabel = (value)=>{
          const text = String(value || '').trim();
          if(!text) return '';
          const ts = Date.parse(text);
          if(!Number.isFinite(ts)) return '';
          try{
            return new Intl.DateTimeFormat(undefined, { year:'numeric', month:'short', day:'numeric' }).format(new Date(ts));
          }catch(err){
            return '';
          }
        };

        const defaultStoryCards = {
          prove: {
            id: 'prove',
            kicker: 'PROVE',
            title: 'Produce evidence of readiness under pressure',
            text: 'Run realistic simulations that mirror scenarios that matter in your environment, capture performance signals across technical and leadership teams, and export an after-action report.',
            bullets: [
              'Pressure-test incident response, crisis leadership, and cross-team coordination',
              'Validate playbooks across corporate teams and repeatable operating patterns',
              'Generate post-exercise evidence that stands up to investor, auditor, and regulator scrutiny'
            ],
            reverse: true
          },
          improve: {
            id: 'improve',
            kicker: 'IMPROVE',
            title: 'Improve skills where risk concentrates',
            text: 'Where gaps surface in exercises, use hands-on, role-specific labs for security teams, IT, developers, and high-impact business roles.',
            bullets: [
              'Target upskilling for cloud, identity, phishing/BEC, AppSec, and IR workflows',
              'Support secure engineering for modern enterprise and data platforms',
              'Track improvement trends by role, team, and programme over time'
            ],
            reverse: false
          },
          report: {
            id: 'report',
            kicker: 'REPORT',
            title: 'Produce defensible evidence and reporting',
            text: 'Turn scenario performance into evidence showing accuracy, speed, and decision quality, and export it in an executive-, investor-, and audit-ready format.',
            bullets: [
              'Stakeholder-ready dashboards and after-action reporting',
              'Evidence that supports privacy, safeguarding, and operational resilience expectations',
              'Clear prioritisation: what to fix, who needs support, and what improved'
            ],
            reverse: true
          }
        };

        const storyCardMap = new Map();
        valueCardsRaw.forEach((card)=>{
          const id = normalizedId((card && card.id) || (card && card.kicker) || (card && card.title));
          if(!id) return;
          storyCardMap.set(id, card);
        });

        const pickStoryCard = (token, fallback)=>{
          const key = normalizedId(token);
          const aliases = {
            prove: ['prove'],
            improve: ['improve'],
            report: ['report', 'benchmarkreport']
          };
          const keys = aliases[key] || [key];
          for(let i = 0; i < keys.length; i += 1){
            if(storyCardMap.has(keys[i])){
              return Object.assign({}, fallback, storyCardMap.get(keys[i]));
            }
          }
          return Object.assign({}, fallback);
        };

        const proveCard = pickStoryCard('prove', defaultStoryCards.prove);
        const improveCard = pickStoryCard('improve', defaultStoryCards.improve);
        const reportCard = pickStoryCard('report', defaultStoryCards.report);

        const renderStoryList = (items)=>{
          const rows = Array.isArray(items)
            ? items.map((item)=> String(item || '').trim()).filter(Boolean).slice(0, 4)
            : [];
          if(!rows.length) return '';
          return `<ul class="storyList">${rows.map((row)=> `<li>${esc(row)}</li>`).join('')}</ul>`;
        };

        const renderRecommendedCard = (card, idx)=>{
          const item = (card && typeof card === 'object') ? card : {};
          const formatLabel = String(item.format || 'Content').trim() || 'Content';
          const focusArea = String(item.outcomeLabel || 'Priority outcome').trim() || 'Priority outcome';
          const summary = String(item.summary || '').trim();
          const why = String(item.why || '').trim();
          const title = String(item.title || 'Content block').trim() || 'Content block';
          const linkHref = safeLinkHref(item.url);
          const imageUrl = safeLinkHref(item.imageUrl);
          const titleHtml = linkHref
            ? `<h3><a class="contentTitleLink" href="${esc(linkHref)}" target="_blank" rel="noopener noreferrer">${esc(title)}</a></h3>`
            : `<h3>${esc(title)}</h3>`;
          return `<article class="contentCard">${imageUrl ? `<div class="contentImageWrap"><img class="contentImage" src="${esc(imageUrl)}" alt="${esc(item.title || 'Recommended content image')}" loading="lazy" /></div>` : ''}<p class="contentEyebrow">Recommendation ${idx + 1} | ${esc(formatLabel)}</p>${titleHtml}<p class="contentText"><strong>Focus area:</strong> ${esc(focusArea)}</p>${summary ? `<p class="contentText">${esc(summary)}</p>` : ''}${why ? `<p class="contentText"><strong>Why this is relevant:</strong> ${esc(why)}</p>` : ''}${linkHref ? `<a class="contentLink" href="${esc(linkHref)}" target="_blank" rel="noopener noreferrer">${esc(item.linkLabel || 'Read more')}</a>` : ''}</article>`;
        };

        const newsCards = (whatsNewCardsInput.length
          ? whatsNewCardsInput
          : cards.filter((card)=> /(?:c7-blog|blog-post|rss)/i.test(String(card && (card.formatKey || card.format || '') || ''))).slice(0, 3)
        ).slice(0, 3);
        const finalNewsCards = newsCards.length
          ? newsCards
          : cards.slice(0, 3).map((card)=> ({
              title: String(card && card.title || '').trim() || 'Latest update',
              summary: String(card && card.summary || '').trim() || 'Latest update from Immersive Labs.',
              url: safeLinkHref(card && card.url),
              linkLabel: String(card && card.linkLabel || '').trim() || 'Read post',
              publishedOn: String(card && card.publishedOn || '').trim(),
              imageUrl: safeLinkHref(card && card.imageUrl)
            }));

        const renderNewsCard = (card)=>{
          const item = (card && typeof card === 'object') ? card : {};
          const publishedLabel = formatPublishedLabel(item.publishedOn);
          const eyebrow = publishedLabel ? `${publishedLabel} | RSS post` : 'RSS post';
          const summary = String(item.summary || '').trim() || 'Latest update from the Immersive Labs blog.';
          const linkLabel = String(item.linkLabel || '').trim() || 'Read post';
          const title = String(item.title || 'Latest post').trim() || 'Latest post';
          const linkHref = safeLinkHref(item.url);
          const imageUrl = safeLinkHref(item.imageUrl);
          const titleHtml = linkHref
            ? `<h3><a class="contentTitleLink" href="${esc(linkHref)}" target="_blank" rel="noopener noreferrer">${esc(title)}</a></h3>`
            : `<h3>${esc(title)}</h3>`;
          return `<article class="contentCard">${imageUrl ? `<div class="contentImageWrap"><img class="contentImage" loading="lazy" src="${esc(imageUrl)}" alt="${esc(item.title || 'Latest post image')}" /></div>` : ''}<p class="contentEyebrow">${esc(eyebrow)}</p>${titleHtml}<p class="contentText">${esc(summary)}</p>${linkHref ? `<a class="contentLink" href="${esc(linkHref)}" target="_blank" rel="noopener noreferrer">${esc(linkLabel)}</a>` : ''}</article>`;
        };

        const logoSrc = 'https://cdn.prod.website-files.com/6735fba9a631272fb4513263/6762d3c19105162149b9f1dc_Immersive%20Logo.svg';
        const companyLabel = String(model.company || 'your organisation').trim() || 'your organisation';
        const readinessParagraph = `For ${companyLabel}, this means defensible evidence you can use with leadership and external stakeholders: clear baselines, visible movement over time, and proof aligned to board and regulatory expectations.`;

        return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(model.company || 'Customer')} | Immersive customer dashboard template</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Geologica:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    :root { --primary-colours--black: #17181c; --primary-colours--azure: #3c64ff; --primary-colours--white: #ffffff; --background-color--alternate-25: #f5f5f9; --background-color--alternate-60: #d7d7e7; --text-color--primary: var(--primary-colours--black); --text-color--secondary: rgba(23,24,28,.80); --text-color--subtle: rgba(23,24,28,.40); --bg: var(--background-color--alternate-25); --surface: #fff; --ink: var(--text-color--primary); --muted: var(--text-color--secondary); --line: rgba(23,24,28,.14); --surface-dark: #0f1116; --surface-dark-2: #111d34; --ink-inverse: #eef4ff; --container: 1680px; --radius-card: 8px; --radius-btn: 4px; --font: "Geologica","Segoe UI",Roboto,Arial,sans-serif; --focus: 0 0 0 3px rgba(60,100,255,.22); --shadow-soft: 0 10px 28px rgba(7,18,44,.08); }
    * { box-sizing: border-box; }
    body { margin: 0px; background: var(--bg); color: var(--ink); font-family: var(--font); font-weight: 300; font-size: 18px; line-height: 1.2; }
    h1, h2, h3 { margin: 0px; color: var(--text-color--primary); font-weight: 500; letter-spacing: -0.02em; }
    .wrap { max-width: var(--container); width: 100%; margin: 0px auto; padding: 0px 64px; }
    .topbar { position: sticky; top: 0px; z-index: 10; background: rgba(255, 255, 255, 0.96); border-bottom: 1px solid var(--background-color--alternate-60); }
    .topbarInner { max-width: var(--container); width: 100%; margin: 0px auto; padding: 0px 64px; height: 76px; display: flex; align-items: center; justify-content: space-between; gap: 0.9rem; }
    .brand { display: inline-flex; align-items: center; }
    .brand img { display: block; height: 28px; width: auto; }
    .topContactBtn { display: inline-flex; align-items: center; justify-content: center; min-height: 46px; padding: 10px 16px; border-radius: var(--radius-btn); border: 1px solid var(--primary-colours--azure); background: var(--primary-colours--azure); color: rgb(255, 255, 255); font-size: 16px; line-height: 20px; font-weight: 400; text-decoration: none; }
    .topContactBtn:hover { background: rgb(86, 119, 248); border-color: rgb(86, 119, 248); color: rgb(255, 255, 255); }
    .hero { margin-top: 20px; }
    .padding-global.padding-24 { padding: 0px; }
    .container-large { max-width: 100%; margin: 0px auto; }
    .padding-section-24.platform-hero { padding: 0px; }
    .header90_component { width: 100%; }
    .header90_card.platform { position: relative; display: block; min-height: 430px; background: #07122d; border: 1px solid var(--line); border-radius: var(--radius-card); overflow: hidden; isolation: isolate; }
    .header90_card.platform::before { content: ""; position: absolute; inset: 0px; z-index: 2; background: linear-gradient(90deg, rgba(4, 10, 26, 0.82) 0%, rgba(4, 10, 26, 0.64) 40%, rgba(4, 10, 26, 0.3) 66%, rgba(4, 10, 26, 0.18) 100%); pointer-events: none; }
    .header90_background-image-wrapper.platform-2.improve-2 { display: none; }
    .header90_card-content { position: relative; z-index: 3; padding: 44px 44px 42px; display: flex; flex-direction: column; justify-content: center; max-width: min(780px, 62%); background: transparent; }
    .max-width-medium--lp { max-width: 62ch; }
    .margin-bottom.margin-small { margin-bottom: 14px; }
    .margin-bottom-16.margin-small { margin-bottom: 16px; }
    .tag-17.is-text { display: inline-flex; align-items: center; min-height: 26px; padding: 6px 10px; border: 1px solid rgba(255, 255, 255, 0.4); border-radius: 999px; background: rgba(9, 17, 40, 0.26); color: rgba(236, 244, 255, 0.94); font-size: 12px; line-height: 1; text-transform: uppercase; letter-spacing: 0.14em; font-weight: 400; }
    .heading-style-h1.landing-page { margin: 0px; font-size: clamp(40px, 4.8vw, 62px); line-height: 1.03; max-width: 14ch; letter-spacing: -0.02em; color: rgb(255, 255, 255); font-weight: 500; text-shadow: rgba(0, 0, 0, 0.22) 0px 2px 10px; }
    .text-size-regular.text-color-secondary.max-width-prove { margin: 0px; max-width: 54ch; color: rgba(236, 244, 255, 0.92); font-size: 18px; line-height: 1.35; text-shadow: rgba(0, 0, 0, 0.2) 0px 1px 6px; }
    .margin-top.margin-medium { margin-top: 22px; }
    .button-group { display: flex; flex-wrap: wrap; gap: 10px; }
    .button.w-button { display: inline-flex; align-items: center; justify-content: center; min-height: 46px; padding: 12px 22px; border-radius: var(--radius-btn); border: 1px solid var(--primary-colours--azure); background: var(--primary-colours--azure); color: rgb(255, 255, 255); font-size: 16px; line-height: 20px; font-weight: 400; text-decoration: none; }
    .button.w-button:hover { background: rgb(86, 119, 248); border-color: rgb(86, 119, 248); }
    .button.is-secondary.is-lightmode.w-button { background: rgb(255, 255, 255); border-color: rgba(23, 24, 28, 0.18); color: rgb(31, 47, 82); }
    .button.is-secondary.is-lightmode.w-button:hover { background: rgb(245, 247, 252); }
    .header90_background-image-wrapper-platform.improve { position: absolute; inset: 0px; z-index: 1; overflow: hidden; background: transparent; pointer-events: none; }
    .improve-lp-hero-image { position: absolute; inset: 0px; width: 100%; height: 100%; object-fit: cover; object-position: center center; transform: none; z-index: 1; filter: none; }
    .improve-ui-popup.prove { display: none; }
    .layout { margin: 20px 0px 42px; display: grid; gap: 16px; }
    .panel { border: 1px solid var(--line); border-radius: var(--radius-card); background: var(--surface); box-shadow: var(--shadow-soft); padding: 24px; }
    .panel h2 { font-size: 34px; line-height: 1.05; }
    .panelSub { margin: 10px 0px 0px; color: var(--muted); font-size: 18px; line-height: 1.25; }
    .sectionHead { display: flex; justify-content: space-between; gap: 22px; align-items: flex-end; margin-bottom: 32px; }
    .sectionHead h2 { margin: 0px; font-size: clamp(1.7rem, 2.3vw, 2.2rem); line-height: 1.18; letter-spacing: -0.01em; }
    .sectionHead p { margin: 0px; color: var(--muted); font-size: 18px; line-height: 1.5; }
    .sectionHead--center { justify-content: center; align-items: center; text-align: center; padding: 50px 0px; }
    .sectionHead--center > div { margin: 0px auto; }
    .sectionHead--center h2 { font-size: clamp(2.55rem, 3.45vw, 3.3rem); }
    .sectionHead--center p { font-size: 27px; }
    .sectionHeadSub { margin-top: 10px !important; font-size: clamp(1.6rem, 2.2vw, 2rem) !important; line-height: 1.2 !important; color: rgb(27, 46, 86) !important; }
    .sectionHeadLead { margin: 14px auto 0px !important; font-size: 18px !important; line-height: 1.35 !important; max-width: 68ch; color: rgb(62, 79, 111) !important; }
    .panel--support { border: none; background: transparent; box-shadow: none; padding: 0px; }
    .panel--outcomes h2 { font-size: 34px; }
    .storyStack { --story-top: 96px; --story-gap: 20px; max-width: 1360px; margin: 20px auto 56px; padding-bottom: 120px; }
    .storyCard { position: relative; z-index: 1; border: 1px solid var(--line); border-radius: var(--radius-card); background: rgb(255, 255, 255); box-shadow: rgba(7, 18, 44, 0.12) 0px 16px 52px, rgba(7, 18, 44, 0.06) 0px 2px 10px; overflow: hidden; }
    .storyStack .storyCard { --story-i: 0; --story-scale: 1; position: sticky; top: calc(var(--story-top) + (var(--story-i) * var(--story-gap))); transform: scale(var(--story-scale)); transform-origin: center top; will-change: transform; opacity: 1; transition: opacity 0.5s; }
    .storyStack .storyCard.is-in { opacity: 1; }
    .storyStack .storyCard:not(:first-child) { margin-top: var(--story-gap); }
    .storyStack .storyCard:nth-child(1) { z-index: 1; --story-i: 0; }
    .storyStack .storyCard:nth-child(2) { z-index: 2; --story-i: 1; }
    .storyStack .storyCard:nth-child(3) { z-index: 3; --story-i: 2; }
    .storyInner { --story-min-h: 0; display: grid; grid-template-columns: minmax(0px, 1fr) minmax(0px, 1fr); min-height: var(--story-min-h); height: auto; transform: translateY(18px); transition: transform 0.5s; }
    .storyCard.is-in .storyInner { transform: translateY(0px); }
    .storyInner > .storyMedia, .storyInner > .storyContent { min-height: var(--story-min-h); }
    .storyCard.reverse .storyMedia { order: 2; }
    .storyCard.reverse .storyContent { order: 1; }
    .storyMedia { position: relative; isolation: isolate; aspect-ratio: 1 / 1; background: var(--background-color--alternate-25); overflow: hidden; }
    .storyMedia:not(.storyMedia--layered)::after { content: ""; position: absolute; inset: 0px; background: radial-gradient(80% 120% at 88% 86%, rgba(95, 163, 255, 0.28), transparent 68%); }
    .storyMedia > img, .storyMedia > video { position: relative; z-index: 1; display: block; width: 100%; height: 100%; object-fit: cover; }
    .storyMedia--layered { background: var(--story-media-bg,var(--background-color--alternate-25)); overflow: hidden; border-radius: 0px; isolation: isolate; }
    .storyMedia--layered .layout408_image-wrapper { position: absolute; inset: 0px; overflow: hidden; }
    .storyMedia--layered .layout408_image { position: absolute; inset: 0px; width: 100%; height: 100%; display: block; object-fit: cover; object-position: var(--story-bg-pos,center); z-index: 0; pointer-events: none; }
    .storyMedia--layered .layout408_ui_screen, .storyMedia--layered .layout408_ui_popup { position: absolute; height: auto; max-width: none; width: auto; display: block; object-fit: contain; pointer-events: none; }
    .storyMedia--layered .layout408_ui_screen { z-index: var(--story-screen-z,1); left: var(--story-screen-left,auto); right: var(--story-screen-right,auto); top: var(--story-screen-top,auto); bottom: var(--story-screen-bottom,auto); width: var(--story-screen-width,100%); height: var(--story-screen-height,auto); transform: var(--story-screen-transform,none); border-radius: var(--story-screen-radius,0); overflow: var(--story-screen-overflow,visible); background: var(--story-screen-bg,transparent); box-shadow: var(--story-screen-shadow,none); filter: var(--story-screen-filter,none); }
    .storyMedia--layered .layout408_ui_popup { z-index: var(--story-popup-z,2); left: var(--story-popup-left,auto); right: var(--story-popup-right,auto); top: var(--story-popup-top,auto); bottom: var(--story-popup-bottom,auto); width: var(--story-popup-width,28%); opacity: var(--story-popup-opacity,1); mix-blend-mode: var(--story-popup-blend,normal); background: var(--story-popup-bg,transparent); border-radius: var(--story-popup-radius,0); filter: var(--story-popup-filter,none); }
    .storyMedia--mitre { --story-media-bg: #05080f; --story-bg-pos: right center; --story-screen-z: 2; --story-screen-right: 0; --story-screen-top: 12%; --story-screen-width: 88%; --story-screen-height: 72%; --story-screen-radius: 10px 0 0 10px; --story-screen-overflow: hidden; --story-screen-shadow: 0 14px 34px rgba(7,18,44,.18); }
    .storyMedia--mitre .layout408_ui_screen { mask-image: -webkit-radial-gradient(center, white, black); }
    .storyMedia--mitre .layout408_ui_screen video { position: absolute; object-fit: cover; object-position: left top; display: block; border-radius: 0px; background: transparent; inset: 0px auto auto -2.5% !important; width: 202.5% !important; height: 100% !important; min-width: 0px !important; min-height: 0px !important; max-width: none !important; max-height: none !important; margin: 0px !important; transform: none !important; }
    .storyMedia--prove { --story-media-bg: #f5f6fb; --story-bg-pos: center; --story-screen-z: 1; --story-screen-right: -47%; --story-screen-top: 50%; --story-screen-bottom: auto; --story-screen-width: 132%; --story-screen-transform: translateY(-50%); --story-screen-filter: drop-shadow(0 18px 36px rgba(7,18,44,.22)); --story-popup-z: 2; --story-popup-top: calc(11% - 20px); --story-popup-left: calc(8% + 130px); --story-popup-width: 45.36%; --story-popup-filter: drop-shadow(0 12px 24px rgba(7,18,44,.18)); }
    .storyMedia--report { --story-media-bg: #f7eee3; --story-bg-pos: center; --story-screen-z: 1; --story-screen-right: -55.68%; --story-screen-top: 50%; --story-screen-bottom: auto; --story-screen-width: 142.68%; --story-screen-transform: translateY(-50%); --story-screen-filter: drop-shadow(0 18px 36px rgba(7,18,44,.22)); --story-popup-z: 3; --story-popup-left: 16%; --story-popup-bottom: 6%; --story-popup-width: 21.6%; --story-popup-opacity: 1; --story-popup-blend: normal; --story-popup-bg: #fff; --story-popup-radius: 14px; --story-popup-filter: drop-shadow(0 12px 24px rgba(7,18,44,.18)); }
    .storyMedia--report .layout408_ui_popup.reporting { opacity: 1 !important; }
    .storyCard--tour { position: relative; top: auto; will-change: auto; z-index: 1; transform: none !important; }
    .storyCard--tour .storyInner { display: block; position: relative; aspect-ratio: 2 / 1; min-height: 0px; height: auto; background: rgb(3, 7, 18); }
    .storyCard--tour .storyInner::before { content: ""; position: absolute; inset: 0px; z-index: 1; background: linear-gradient(rgba(5, 10, 24, 0.6) 0%, rgba(5, 10, 24, 0.72) 100%); pointer-events: none; }
    .storyCard--tour .storyMedia--tour { position: absolute; inset: 0px; min-height: 100%; height: 100%; aspect-ratio: auto; background: rgb(3, 7, 18); z-index: 0; }
    .storyCard--tour .storyMedia--tour video { position: absolute; inset: 0px; width: 100%; height: 100%; object-fit: cover; object-position: center center; display: block; }
    .storyCard--tour .storyMedia--tour::after { display: none; }
    .storyContent--tour { position: absolute; inset: 0px; z-index: 2; max-width: 760px; margin: 0px auto; padding: 44px 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; text-align: center; }
    .storyContent { padding: 52px 50px; display: flex; flex-direction: column; justify-content: center; gap: 14px; background: rgb(255, 255, 255); }
    .storyCard--tour .storyContent--tour { background: transparent; }
    .storyKicker { margin: 0px 0px 4px; font-size: 14px; line-height: 18px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--text-color--primary); font-weight: 300; opacity: 0.78; }
    .storyCard--tour .storyKicker { color: rgba(255, 255, 255, 0.84); opacity: 1; }
    .storyContent h3 { margin: 0px; font-size: 34px; line-height: 1.05; letter-spacing: -0.02em; color: rgb(18, 27, 47); font-weight: 500; }
    .storyCard--tour .storyContent h3 { color: rgb(255, 255, 255); font-size: 34px; line-height: 1.08; }
    .storyContent p { margin: 0px; color: rgb(63, 78, 105); font-size: 18px; line-height: 1.25; }
    .storyCard--tour .storyContent p { color: rgba(255, 255, 255, 0.88); max-width: 64ch; font-size: 16px; line-height: 1.35; }
    .storyBullets, .storyList { margin: 14px 0px 0px; padding: 0px; list-style: none; display: grid; gap: 10px; }
    .storyBullets li, .storyList li { position: relative; padding-left: 18px; color: rgb(47, 63, 92); font-size: 18px; line-height: 1.25; }
    .storyBullets li::before, .storyList li::before { content: ""; position: absolute; left: 0px; top: 0.62em; width: 6px; height: 6px; border-radius: 999px; background: var(--primary-colours--azure); }
    .storyTourCta { margin-top: 8px; }
    .storyTourBtn { display: inline-flex; align-items: center; justify-content: center; min-height: 46px; padding: 12px 24px; border-radius: var(--radius-btn); border: 1px solid rgba(60, 100, 255, 0.35); background: var(--primary-colours--azure); color: rgb(255, 255, 255); font-size: 16px; line-height: 20.8px; font-weight: 400; text-decoration: none; }
    .storyTourBtn:hover { background: rgb(86, 119, 248); color: rgb(255, 255, 255); }
    .outcomeGrid { margin-top: 16px; display: grid; gap: 12px; grid-template-columns: repeat(3, minmax(0px, 1fr)); }
    .outcomeCard { border: 1px solid color-mix(in srgb,var(--primary-colours--azure) 15%, var(--line)); border-radius: var(--radius-card); background: rgb(255, 255, 255); padding: 16px; display: grid; gap: 10px; }
    .outcomeHead { display: grid; grid-template-columns: 54px minmax(0px, 1fr); gap: 12px; align-items: center; }
    .outcomeRing { --pct: 0; position: relative; width: 54px; height: 54px; border-radius: 50%; background: conic-gradient(var(--primary-colours--azure) calc(var(--pct)*1%), #dfe4ef 0); display: grid; place-items: center; }
    .outcomeRing::before { content: ""; position: absolute; inset: 6px; border-radius: 50%; background: rgb(255, 255, 255); border: 1px solid rgba(23, 24, 28, 0.08); }
    .outcomeRing span { position: relative; z-index: 1; font-size: 12px; line-height: 1; font-weight: 600; color: rgb(37, 58, 100); }
    .outcomeCard h3 { margin: 0px; font-size: 24px; line-height: 1.15; color: rgb(26, 44, 79); }
    .outcomeCard p { margin: 0px; color: rgb(75, 95, 131); font-size: 16px; line-height: 1.3; }
    .actionsList { margin: 12px 0px 0px; padding-left: 1.2rem; display: grid; gap: 8px; font-size: 18px; line-height: 1.25; }
    .contentGrid { margin-top: 16px; display: grid; gap: 12px; grid-template-columns: repeat(3, minmax(0px, 1fr)); }
    .contentCard { border: 1px solid var(--line); border-radius: var(--radius-card); background: rgb(255, 255, 255); padding: 16px; display: grid; gap: 8px; }
    .contentImageWrap { margin: -16px -16px 8px; border-radius: var(--radius-card) var(--radius-card) 0 0; overflow: hidden; aspect-ratio: 16 / 9; background: rgb(220, 231, 255); }
    .contentImage { display: block; width: 100%; height: 100%; object-fit: cover; }
    .contentEyebrow { margin: 0px; font-size: 13px; line-height: 16px; letter-spacing: 0.1em; text-transform: uppercase; color: rgb(101, 119, 155); }
    .contentCard h3 { margin: 0px; font-size: 24px; line-height: 1.15; }
    .contentTitleLink { color: inherit; text-decoration: none; text-decoration-thickness: 1.5px; text-underline-offset: 3px; border-radius: 4px; transition: color 0.18s, text-decoration-color 0.18s; }
    .contentTitleLink:hover, .contentTitleLink:focus-visible { color: var(--primary-colours--azure); text-decoration: underline; text-decoration-color: rgba(60, 100, 255, 0.7); outline: none; }
    .contentText { margin: 0px; color: rgb(76, 93, 124); font-size: 16px; line-height: 1.3; }
    .contentLink { display: inline-flex; width: max-content; color: rgb(18, 56, 213); font-size: 16px; line-height: 20px; font-weight: 400; text-decoration: none; border-bottom: 1px solid rgba(18, 56, 213, 0.22); padding-bottom: 1px; }
    .panel--contact { background: rgb(255, 255, 255); }
    .contactGrid { margin-top: 16px; display: grid; gap: 16px; grid-template-columns: minmax(0px, 1fr) minmax(0px, 1.2fr); }
    .contactTeamGrid { display: grid; gap: 12px; }
    .contactPerson { border: 1px solid var(--line); border-radius: var(--radius-card); background: rgb(255, 255, 255); padding: 14px; display: grid; grid-template-columns: 56px minmax(0px, 1fr); gap: 10px; align-items: center; }
    .contactAvatar, .contactAvatarImg { width: 56px; height: 56px; border-radius: 999px; display: block; }
    .contactAvatar { border: 1px solid rgba(60, 100, 255, 0.22); background: rgba(60, 100, 255, 0.08); color: rgb(35, 66, 147); font-size: 18px; line-height: 56px; font-weight: 600; text-align: center; }
    .contactAvatarImg { object-fit: cover; border: 1px solid rgba(60, 100, 255, 0.22); }
    .contactPersonName { margin: 0px; font-size: 18px; line-height: 1.2; color: rgb(23, 39, 66); }
    .contactPersonRole { margin: 4px 0px 0px; font-size: 14px; line-height: 1.35; color: rgb(82, 99, 130); }
    .contactPersonEmail { margin: 6px 0px 0px; font-size: 14px; line-height: 1.35; color: rgb(23, 76, 180); text-decoration: none; }
    .contactPersonEmail:hover, .contactPersonEmail:focus-visible { text-decoration: underline; outline: none; }
    .contactForm { border: 1px solid var(--line); border-radius: var(--radius-card); padding: 16px; background: linear-gradient(180deg, #ffffff 0%, #f8faff 100%); }
    .contactFormGrid { display: grid; gap: 10px; grid-template-columns: repeat(2, minmax(0px, 1fr)); }
    .contactFormField { display: grid; gap: 6px; }
    .contactFormField--full { grid-column: 1 / -1; }
    .contactForm label { font-size: 14px; line-height: 1.3; color: rgb(70, 89, 122); }
    .contactForm input, .contactForm textarea { width: 100%; border: 1px solid rgba(23, 24, 28, 0.18); border-radius: 4px; padding: 10px 12px; font: inherit; font-size: 16px; line-height: 1.35; color: var(--ink); background: rgb(255, 255, 255); }
    .contactForm textarea { min-height: 116px; resize: vertical; }
    .contactForm input:focus-visible, .contactForm textarea:focus-visible { outline: none; box-shadow: var(--focus); border-color: rgba(60, 100, 255, 0.55); }
    .contactFormFoot { margin-top: 10px; display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
    .contactFormHint { margin: 0px; font-size: 13px; line-height: 1.35; color: rgb(82, 99, 130); }
    .detailsGrid { margin-top: 16px; display: grid; gap: 12px; grid-template-columns: repeat(3, minmax(0px, 1fr)); }
    .detailCard { border: 1px solid color-mix(in srgb,var(--primary-colours--azure) 12%, var(--line)); border-radius: var(--radius-card); background: linear-gradient(rgb(255, 255, 255), rgb(248, 250, 255)); padding: 16px; box-shadow: rgba(7, 18, 44, 0.04) 0px 2px 10px; }
    .detailCard h3 { margin: 0px 0px 10px; font-size: 24px; line-height: 1.1; color: rgb(36, 60, 104); }
    .kvRow { display: grid; grid-template-columns: 140px minmax(0px, 1fr); gap: 8px; font-size: 14px; line-height: 18px; padding: 6px 0px; border-bottom: 1px dashed rgba(15, 23, 42, 0.08); }
    .kvRow:last-child { border-bottom: none; }
    .kvLabel { color: rgb(96, 113, 143); }
    .kvValue { color: rgb(23, 39, 66); }
    footer { margin: 10px 0px 40px; color: rgb(107, 118, 144); font-size: 14px; line-height: 18px; text-align: right; }
    @media (max-width: 1280px) {
      .wrap { padding: 0px 40px; }
      .topbarInner { padding: 0px 40px; }
      .header90_card-content { padding: 38px 36px; max-width: min(700px, 68%); }
    }
    @media (max-width: 1080px) {
      .wrap { padding: 0px 24px; }
      .topbarInner { padding: 0px 24px; height: 68px; }
      .header90_card.platform { min-height: 0px; }
      .header90_card.platform::before { background: linear-gradient(180deg, rgba(4, 10, 26, 0.82) 0%, rgba(4, 10, 26, 0.56) 72%, rgba(4, 10, 26, 0.34) 100%); }
      .header90_card-content { padding: 32px 26px; max-width: none; }
      .storyStack { --story-top: 0; --story-gap: 20px; padding-bottom: 48px; }
      .storyStack .storyCard { position: relative; top: auto; transition: none; opacity: 1; will-change: auto; transform: none !important; }
      .storyStack .storyCard:not(:first-child) { margin-top: 20px; }
      .storyInner { grid-template-columns: 1fr; min-height: 0px; height: auto; transform: none; transition: none; }
      .storyInner > .storyMedia, .storyInner > .storyContent { min-height: 0px; }
      .storyCard.reverse .storyMedia, .storyCard.reverse .storyContent { order: initial; }
      .storyMedia { aspect-ratio: 16 / 11; }
      .storyMedia--mitre { --story-screen-top: 14%; --story-screen-height: 68%; }
      .storyMedia--prove { --story-screen-width: 137.5%; --story-screen-right: -47.5%; --story-popup-width: 48.72%; --story-popup-left: calc(6% + 130px); }
      .storyMedia--report { --story-screen-width: 152.52%; --story-screen-right: -59.52%; --story-popup-width: 24.6%; --story-popup-left: 10%; --story-popup-bottom: 8%; }
      .storyCard--tour .storyInner { aspect-ratio: 16 / 10; min-height: 420px; }
      .storyContent--tour { max-width: none; padding: 30px 26px; }
      .storyCard--tour .storyContent h3 { font-size: 30px; }
      .storyCard--tour .storyInner::before { background: linear-gradient(rgba(5, 10, 24, 0.66) 0%, rgba(5, 10, 24, 0.8) 100%); }
      .storyContent { padding: 30px 26px; }
      .contactGrid { grid-template-columns: 1fr; }
      .outcomeGrid, .contentGrid, .detailsGrid { grid-template-columns: repeat(2, minmax(0px, 1fr)); }
      .kvRow { grid-template-columns: 1fr; gap: 0.2rem; }
    }
    @media (max-width: 760px) {
      .outcomeGrid, .contentGrid, .detailsGrid { grid-template-columns: 1fr; }
      .header90_card-content { padding: 26px 20px; }
      .panel { padding: 16px; }
      .panel h2 { font-size: 28px; }
      .sectionHead h2 { font-size: 28px; }
      .storyContent h3 { font-size: 30px; }
      .storyContent p, .storyBullets li, .storyList li, .actionsList { font-size: 16px; }
      .topContactBtn { font-size: 14px; line-height: 18px; padding: 8px 12px; min-height: 40px; }
      .contactFormGrid { grid-template-columns: 1fr; }
    }
    @media (max-width: 479px) {
      .wrap { padding: 0px 16px; }
      .topbarInner { padding: 0px 16px; }
      .tag-17.is-text { font-size: 11px; }
      .heading-style-h1.landing-page { font-size: 34px; }
      .text-size-regular.text-color-secondary.max-width-prove { font-size: 17px; }
      .button-group { gap: 8px; }
      .button.w-button { width: 100%; }
      .sectionHead h2 { font-size: 24px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .storyCard, .storyInner { transition: none !important; transform: none !important; opacity: 1 !important; }
    }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="topbarInner">
      <a class="brand" href="https://www.immersivelabs.com/" target="_blank" rel="noopener noreferrer" aria-label="Immersive">
        <img src="${esc(logoSrc)}" alt="Immersive" />
      </a>
      <a class="topContactBtn" href="#contact-your-team">Contact us</a>
    </div>
  </header>
  <main class="wrap">
    <section class="hero">
      <div class="padding-global padding-24">
        <div class="container-large">
          <div class="padding-section-24 platform-hero">
            <div class="header90_component">
              <div class="header90_card platform">
                <div class="header90_card-content">
                  <div class="max-width-medium--lp">
                    <div class="margin-bottom margin-small">
                      <div class="max-width-large-4">
                        <div class="tag-17 is-text">${esc(hero.eyebrow || 'Customer dashboard')}</div>
                      </div>
                    </div>
                    <div class="margin-bottom-16 margin-small">
                      <h1 class="heading-style-h1 landing-page">${esc(hero.title || `${model.company || 'Customer'} readiness dashboard`)}</h1>
                    </div>
                    <p class="text-size-regular text-color-secondary max-width-prove">${esc(hero.subtitle || '')}</p>
                  </div>
                  <div class="margin-top margin-medium">
                    <div class="button-group">
                      <a href="${esc(heroPrimaryCtaHref)}" class="button w-button">${esc(heroPrimaryCtaLabel)}</a>
                      <a href="${esc(heroSecondaryCtaHref)}" class="button is-secondary is-lightmode w-button">${esc(heroSecondaryCtaLabel)}</a>
                    </div>
                  </div>
                </div>
                <div class="header90_background-image-wrapper-platform improve" aria-hidden="true">
                  <img src="${esc(heroImageUrl)}" loading="eager" alt="" class="improve-lp-hero-image" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
    <section class="layout">
      ${outcomeBlocks.length ? `<article class="panel panel--outcomes"><h2>Your top outcomes</h2><p class="panelSub">The three priorities we recommend focusing on first.</p><div class="outcomeGrid">${outcomeBlocks.map((outcome, idx)=> `<article class="outcomeCard"><div class="outcomeHead"><div class="outcomeRing" style="--pct:${metricPercent(outcome.metric, idx)}"><span>${metricPercent(outcome.metric, idx)}%</span></div><h3>${esc(outcome.title || `Priority outcome ${idx + 1}`)}</h3></div><p>${esc(outcome.detail || '')}</p></article>`).join('')}</div></article>` : ''}
      ${details.length ? `<article class="panel"><h2>What you told us in the meeting</h2><p class="panelSub">Your context, constraints, and operating priorities as we captured them.</p><div class="detailsGrid">${details.map((section)=> `<article class="detailCard"><h3>${esc(section.title || 'Section')}</h3>${(Array.isArray(section.rows) ? section.rows : []).map((row)=> `<div class="kvRow"><span class="kvLabel">${esc((row && row.label) || 'Field')}</span><span class="kvValue">${esc((row && row.value) || '—')}</span></div>`).join('')}</article>`).join('')}</div></article>` : ''}
      <div class="sectionHead sectionHead--center"><div><h2>Our understanding of your needs</h2><p class="sectionHeadSub">Measuring cyber readiness with Immersive</p><p class="sectionHeadLead">${esc(readinessParagraph)}</p></div></div>
      <article class="panel panel--support">
        <div class="storyStack">
          <article class="storyCard reverse">
            <div class="storyInner">
              <div class="storyMedia storyMedia--layered storyMedia--mitre" data-story-media="mitre" aria-hidden="true">
                <img class="layout408_image align-right" src="https://cdn.prod.website-files.com/6735fba9a631272fb4513263/6914a13624dc6e2c54be0c0a_platform-hero-bg.webp" alt="" loading="lazy" width="679" height="679" />
                <div class="layout408_ui_screen" aria-hidden="true">
                  <video autoplay loop muted playsinline preload="metadata" style="background-image:url('https://cdn.prod.website-files.com/6735fba9a631272fb4513263%2F69032ce5fea96c334f5e5f2d_Mitre-Attack-video-1_poster.0000000.jpg')">
                    <source src="https://cdn.prod.website-files.com/6735fba9a631272fb4513263%2F69032ce5fea96c334f5e5f2d_Mitre-Attack-video-1_mp4.mp4" type="video/mp4" />
                    <source src="https://cdn.prod.website-files.com/6735fba9a631272fb4513263%2F69032ce5fea96c334f5e5f2d_Mitre-Attack-video-1_webm.webm" type="video/webm" />
                  </video>
                </div>
              </div>
              <div class="storyContent">
                <div class="storyKicker">${esc(proveCard.kicker || 'PROVE')}</div>
                <h3>${esc(proveCard.title || defaultStoryCards.prove.title)}</h3>
                <p>${esc(proveCard.text || defaultStoryCards.prove.text)}</p>
                ${renderStoryList(proveCard.bullets || defaultStoryCards.prove.bullets)}
              </div>
            </div>
          </article>
          <article class="storyCard">
            <div class="storyInner">
              <div class="storyMedia storyMedia--layered storyMedia--prove" data-story-media="prove" aria-hidden="true">
                <div class="layout408_image-wrapper">
                  <img alt="" src="https://cdn.prod.website-files.com/6735fba9a631272fb4513263/6914a136dbf76d35c55ba7f5_platform-prove-square-bg.webp" loading="lazy" class="layout408_image" width="679" height="679" />
                  <img src="https://cdn.prod.website-files.com/6735fba9a631272fb4513263/6914a1365ac7c6f3dab67864_platform-prove-square-ui_screen.webp" loading="lazy" alt="" class="layout408_ui_screen" />
                  <img src="https://cdn.prod.website-files.com/6735fba9a631272fb4513263/6914a13604a36b3c5d7a73c1_platform-prove-square-ui_pop_up.webp" loading="lazy" alt="" class="layout408_ui_popup" />
                </div>
              </div>
              <div class="storyContent">
                <div class="storyKicker">${esc(improveCard.kicker || 'IMPROVE')}</div>
                <h3>${esc(improveCard.title || defaultStoryCards.improve.title)}</h3>
                <p>${esc(improveCard.text || defaultStoryCards.improve.text)}</p>
                ${renderStoryList(improveCard.bullets || defaultStoryCards.improve.bullets)}
              </div>
            </div>
          </article>
          <article class="storyCard reverse">
            <div class="storyInner">
              <div class="storyMedia storyMedia--layered storyMedia--report" data-story-media="report" aria-hidden="true">
                <div class="layout408_image-wrapper">
                  <img alt="" src="https://cdn.prod.website-files.com/6735fba9a631272fb4513263/6914a1360925ed60f5365dd5_platform-report-square-bg.webp" loading="lazy" class="layout408_image" width="679" height="679" />
                  <img src="https://cdn.prod.website-files.com/6735fba9a631272fb4513263/6914a136bdbaadae3861c5a8_platform-report-square-ui_screen.webp" loading="lazy" alt="" class="layout408_ui_screen" />
                  <img src="https://cdn.prod.website-files.com/6735fba9a631272fb4513263/690e14b11097d2dc702df512_report-ui-pop.webp" loading="lazy" alt="" class="layout408_ui_popup reporting" />
                </div>
              </div>
              <div class="storyContent">
                <div class="storyKicker">${esc(reportCard.kicker || 'REPORT')}</div>
                <h3>${esc(reportCard.title || defaultStoryCards.report.title)}</h3>
                <p>${esc(reportCard.text || defaultStoryCards.report.text)}</p>
                ${renderStoryList(reportCard.bullets || defaultStoryCards.report.bullets)}
              </div>
            </div>
          </article>
        </div>
      </article>
      <article class="storyCard storyCard--tour">
        <div class="storyInner">
          <div class="storyMedia storyMedia--tour" aria-hidden="true">
            <video autoplay loop muted playsinline preload="metadata"${demoCardPosterHref ? ` poster="${esc(demoCardPosterHref)}"` : ''}>
              ${demoCardVideoMp4Href ? `<source src="${esc(demoCardVideoMp4Href)}" type="video/mp4" />` : ''}
              ${demoCardVideoWebmHref ? `<source src="${esc(demoCardVideoWebmHref)}" type="video/webm" />` : ''}
            </video>
          </div>
          <div class="storyContent storyContent--tour">
            <div class="storyKicker">${esc(demoCard.kicker || 'PRODUCT TOUR')}</div>
            <h3>${esc(demoCard.title || 'Take a guided tour of the platform')}</h3>
            <p>${esc(demoCard.text || 'See how you can run scenario-based exercises, capture after-action evidence, and export summaries for stakeholders.')}</p>
            ${demoCardCtaHref ? `<div class="storyTourCta"><a class="storyTourBtn" href="${esc(demoCardCtaHref)}" target="_blank" rel="noopener noreferrer">${esc(demoCard.ctaLabel || 'Take a Product Tour')}</a></div>` : ''}
          </div>
        </div>
      </article>
      <article class="panel">
        <h2>Recommended next actions</h2>
        <p class="panelSub">Suggested next steps for your team over the next 30 days.</p>
        <ol class="actionsList">${actions.map((line)=> `<li>${esc(line)}</li>`).join('')}</ol>
      </article>
      <article class="panel" id="recommended-for-you">
        <h2>Recommended for you</h2>
        <p class="panelSub">A short list of articles, webinars, and case studies selected for your team.</p>
        <div class="contentGrid">
          ${cards.map((card, idx)=> renderRecommendedCard(card, idx)).join('')}
        </div>
      </article>
      <article class="panel" id="whats-new">
        <h2>What's new</h2>
        <div class="contentGrid" id="whatsNewGrid">
          ${finalNewsCards.map((card)=> renderNewsCard(card)).join('')}
        </div>
      </article>
      <article class="panel panel--contact" id="contact-your-team">
        <h2>Get in touch with your team</h2>
        <p class="panelSub">Use this form to contact your Immersive customer team and align next steps.</p>
        <div class="contactGrid">
          <div class="contactTeamGrid">
            ${contactTeam.map((contact)=> `<article class="contactPerson">${contact.imageUrl ? `<img class="contactAvatarImg" src="${esc(contact.imageUrl)}" alt="${esc(contact.name)}" loading="lazy" />` : `<span class="contactAvatar">${esc(contact.initials)}</span>`}<div><h3 class="contactPersonName">${esc(contact.name)}</h3><p class="contactPersonRole">${esc(contact.role)}</p>${contact.emailHref ? `<a class="contactPersonEmail" href="${esc(contact.emailHref)}">${esc(contact.email)}</a>` : `<span class="contactPersonEmail">${esc(contact.email)}</span>`}</div></article>`).join('')}
          </div>
          <form class="contactForm" data-contact-form>
            <div class="contactFormGrid">
              <div class="contactFormField">
                <label for="contactName">Your name</label>
                <input id="contactName" name="name" type="text" autocomplete="name" required />
              </div>
              <div class="contactFormField">
                <label for="contactEmail">Work email</label>
                <input id="contactEmail" name="email" type="email" autocomplete="email" required />
              </div>
              <div class="contactFormField contactFormField--full">
                <label for="contactMessage">Message</label>
                <textarea id="contactMessage" name="message" required placeholder="How can we help your team next?"></textarea>
              </div>
            </div>
            <div class="contactFormFoot">
              <p class="contactFormHint">Messages are routed to ${esc(primaryContactRecipient)}.</p>
              <button type="submit" class="button w-button">Send message</button>
            </div>
          </form>
        </div>
      </article>
    </section>
    <footer>Prepared for ${esc(model.company || 'your team')} by Immersive Labs.</footer>
  </main>
  <script>
    (function(){
      var desktopQuery = window.matchMedia ? window.matchMedia('(min-width: 1081px)') : { matches:true };
      var reduceMotionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches:false };
      var maxShrink = 0.15;
      var rafSync = 0;
      var rafScale = 0;
      var inViewObserver = null;
      var contentObserver = null;

      function clamp(value, min, max){
        return Math.min(max, Math.max(min, value));
      }

      function allStoryCards(){
        return Array.prototype.slice.call(document.querySelectorAll('.storyStack .storyCard'));
      }

      function storyGapPx(cards){
        var first = (cards && cards.length) ? cards[0] : null;
        if(!first) return 20;
        var raw = window.getComputedStyle(first).getPropertyValue('--story-gap');
        var parsed = parseFloat(raw);
        return Number.isFinite(parsed) ? parsed : 20;
      }

      function syncStoryBlockHeights(){
        var cards = allStoryCards();
        if(!cards.length) return;
        var isDesktop = !!desktopQuery.matches;
        cards.forEach(function(card){
          var row = card.querySelector('.storyInner');
          var media = card.querySelector('.storyMedia');
          var content = card.querySelector('.storyContent');
          if(!row || !media || !content) return;
          row.style.removeProperty('--story-min-h');
          media.style.minHeight = '';
          content.style.minHeight = '';
          if(!isDesktop) return;
          var mediaHeight = media.offsetHeight || 0;
          var contentHeight = Math.max(content.offsetHeight || 0, content.scrollHeight || 0);
          var nextHeight = Math.max(360, mediaHeight, contentHeight);
          row.style.setProperty('--story-min-h', String(nextHeight) + 'px');
          media.style.minHeight = String(nextHeight) + 'px';
          content.style.minHeight = String(nextHeight) + 'px';
        });
      }

      function updateStoryScales(){
        var cards = allStoryCards();
        if(!cards.length) return;
        var disableTransitions = reduceMotionQuery.matches || !desktopQuery.matches;
        if(disableTransitions){
          cards.forEach(function(card){
            card.style.setProperty('--story-scale', '1');
          });
          return;
        }
        var gap = storyGapPx(cards);
        cards.forEach(function(card, idx){
          var next = cards[idx + 1];
          if(!next){
            card.style.setProperty('--story-scale', '1');
            return;
          }
          var rect = card.getBoundingClientRect();
          var nextRect = next.getBoundingClientRect();
          var full = card.offsetHeight || rect.height || 1;
          var denom = Math.max(1, full - gap);
          var overlap = (rect.top + full) - nextRect.top;
          var progress = clamp(overlap / denom, 0, 1);
          var scale = 1 - (maxShrink * progress);
          card.style.setProperty('--story-scale', scale.toFixed(3));
        });
      }

      function queueSync(){
        window.cancelAnimationFrame(rafSync);
        rafSync = window.requestAnimationFrame(syncStoryBlockHeights);
      }

      function queueScale(){
        window.cancelAnimationFrame(rafScale);
        rafScale = window.requestAnimationFrame(updateStoryScales);
      }

      function refreshStoryLayout(){
        queueSync();
        queueScale();
      }

      function markCardsInView(){
        var cards = allStoryCards();
        if(!cards.length) return;
        var disable = reduceMotionQuery.matches || !desktopQuery.matches || !('IntersectionObserver' in window);
        if(disable){
          cards.forEach(function(card){
            card.classList.add('is-in');
          });
          return;
        }
        if(inViewObserver){
          inViewObserver.disconnect();
        }
        inViewObserver = new IntersectionObserver(function(entries){
          entries.forEach(function(entry){
            if(entry.isIntersecting) entry.target.classList.add('is-in');
          });
        }, { threshold:0.15 });
        cards.forEach(function(card){
          inViewObserver.observe(card);
        });
      }

      window.addEventListener('resize', function(){
        markCardsInView();
        refreshStoryLayout();
      }, { passive:true });
      window.addEventListener('orientationchange', refreshStoryLayout, { passive:true });
      window.addEventListener('scroll', queueScale, { passive:true });
      window.addEventListener('load', function(){
        markCardsInView();
        refreshStoryLayout();
      });
      document.addEventListener('DOMContentLoaded', function(){
        markCardsInView();
        refreshStoryLayout();
        if('ResizeObserver' in window){
          contentObserver = new ResizeObserver(refreshStoryLayout);
          document.querySelectorAll('.storyCard .storyContent').forEach(function(el){
            contentObserver.observe(el);
          });
        }
        document.querySelectorAll('.storyCard img, .storyCard video').forEach(function(asset){
          asset.addEventListener('load', refreshStoryLayout, { once:true });
          asset.addEventListener('loadedmetadata', refreshStoryLayout, { once:true });
        });
        var contactForm = document.querySelector('[data-contact-form]');
        if(contactForm){
          contactForm.addEventListener('submit', function(event){
            event.preventDefault();
            var recipient = '${esc(primaryContactRecipient)}';
            if(!recipient) return;
            var nameEl = contactForm.querySelector('input[name="name"]');
            var emailEl = contactForm.querySelector('input[name="email"]');
            var messageEl = contactForm.querySelector('textarea[name="message"]');
            var senderName = String(nameEl && nameEl.value || '').trim();
            var senderEmail = String(emailEl && emailEl.value || '').trim();
            var senderMessage = String(messageEl && messageEl.value || '').trim();
            if(!senderName || !senderEmail || !senderMessage) return;
            var subject = 'Customer dashboard follow-up';
            var body = [
              'Name: ' + senderName,
              'Email: ' + senderEmail,
              '',
              senderMessage
            ].join('\n');
            window.location.href = 'mailto:' + recipient + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
          });
        }
      });
    })();
  </script>
</body>
</html>`;
      }


      function customerTemplateHtmlFromCandidate(candidate){
        const model = customerTemplateModelFromCandidate(candidate);
        if(!model) return '';
        return customerTemplateHtmlFromModel(model);
      }

      function clearCustomerTemplatePreview(){
        clearCustomerPreviewBuildTheatre();
        teardownCustomerPreviewStoryLayout();
        state.customerTemplateDraft = null;
        state.customerTemplateEditorTarget = null;
        if(state.customerTemplateEditorOpen){
          toggleCustomerTemplateEditor(false);
        }
        if(state.currentView === 'recommendations'){
          renderContentRecommendationsView(recommendationsGateFromThread(resolveRecommendationThread(state.recommendationsThreadId || 'current')));
        }else{
          renderCustomerTemplatePreview();
        }
      }

      let customerPreviewStoryRuntime = null;
      let customerPreviewBuildTimers = [];
      let customerPreviewBuildSession = 0;

      function clearCustomerPreviewBuildTheatre(scope){
        customerPreviewBuildSession += 1;
        customerPreviewBuildTimers.forEach((timer)=> window.clearTimeout(timer));
        customerPreviewBuildTimers = [];
        const host = scope || $('#customerTemplatePreviewCanvas');
        if(!host) return;
        host.classList.remove('is-build-loading');
        const overlay = host.querySelector('.customerPreviewBuildOverlay');
        if(overlay){
          overlay.classList.remove('is-active');
          overlay.hidden = true;
          overlay.style.opacity = '';
          overlay.style.pointerEvents = '';
        }
      }

      function ensureCustomerPreviewBuildOverlay(scope){
        if(!scope) return null;
        let overlay = scope.querySelector('.customerPreviewBuildOverlay');
        if(overlay) return overlay;
        overlay = document.createElement('div');
        overlay.className = 'customerPreviewBuildOverlay';
        overlay.setAttribute('aria-hidden', 'true');
        overlay.hidden = true;
        overlay.innerHTML = `
          <div class="customerPreviewBuildSpinner"></div>
          <p class="customerPreviewBuildLabel">Building your customer page</p>
          <div class="customerPreviewBuildTrack"><span></span></div>
        `;
        scope.prepend(overlay);
        return overlay;
      }

      function stageCustomerPreviewBuildBlocks(scope){
        if(!scope) return [];
        const blocks = Array.prototype.slice.call(scope.children).filter((node)=>
          !!node
          && node.nodeType === 1
          && !node.classList.contains('customerPreviewBuildOverlay')
        );
        blocks.forEach((block, idx)=>{
          block.classList.add('customerPreviewBuildBlock');
          block.style.setProperty('--build-order', String(idx));
        });
        return blocks;
      }

      function runCustomerPreviewBuildTheatre(scope, opts){
        const host = scope || $('#customerTemplatePreviewCanvas');
        if(!host) return;
        const options = (opts && typeof opts === 'object') ? opts : {};
        const play = !!options.play;
        const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        clearCustomerPreviewBuildTheatre(host);
        const overlay = ensureCustomerPreviewBuildOverlay(host);
        const blocks = stageCustomerPreviewBuildBlocks(host);
        if(!overlay || !blocks.length){
          return;
        }
        if(!play || reduceMotion){
          host.classList.remove('is-build-loading');
          overlay.classList.remove('is-active');
          overlay.hidden = true;
          overlay.style.opacity = '';
          overlay.style.pointerEvents = '';
          blocks.forEach((block)=>{
            block.classList.remove('is-pending');
            block.classList.add('is-visible');
          });
          return;
        }
        const session = customerPreviewBuildSession;
        const totalMs = 5600;
        const loaderMs = 2200;
        const revealWindowMs = Math.max(2600, totalMs - loaderMs);
        const stepMs = Math.max(150, Math.floor(revealWindowMs / Math.max(1, blocks.length)));

        host.classList.add('is-build-loading');
        overlay.hidden = false;
        overlay.classList.add('is-active');
        overlay.style.opacity = '1';
        overlay.style.pointerEvents = 'auto';
        blocks.forEach((block)=>{
          block.classList.remove('is-visible');
          block.classList.add('is-pending');
        });

        customerPreviewBuildTimers.push(window.setTimeout(()=>{
          if(session !== customerPreviewBuildSession) return;
          host.classList.remove('is-build-loading');
        }, loaderMs));

        blocks.forEach((block, idx)=>{
          const delayMs = loaderMs + (idx * stepMs);
          customerPreviewBuildTimers.push(window.setTimeout(()=>{
            if(session !== customerPreviewBuildSession) return;
            block.classList.remove('is-pending');
            block.classList.add('is-visible');
          }, delayMs));
        });

        customerPreviewBuildTimers.push(window.setTimeout(()=>{
          if(session !== customerPreviewBuildSession) return;
          overlay.classList.remove('is-active');
          overlay.hidden = true;
          overlay.style.opacity = '';
          overlay.style.pointerEvents = '';
          host.classList.remove('is-build-loading');
        }, loaderMs + (stepMs * blocks.length) + 280));
      }

      function clampPreviewNumber(value, min, max){
        return Math.min(max, Math.max(min, value));
      }

      function syncCustomerPreviewStoryLayout(scope){
        const host = scope || $('#customerTemplatePreviewCanvas');
        if(!host) return;
        const rows = $$('.customerPreviewStoryStack .customerPreviewStoryInner', host);
        if(!rows.length) return;
        const desktop = !!(window.matchMedia && window.matchMedia('(min-width: 981px)').matches);
        rows.forEach((row)=>{
          const media = $('.customerPreviewStoryMedia', row);
          const content = $('.customerPreviewStoryContent', row);
          if(!media || !content) return;
          row.style.removeProperty('--preview-story-min-h');
          media.style.minHeight = '';
          content.style.minHeight = '';
          if(!desktop) return;
          const nextHeight = Math.max(
            180,
            media.offsetHeight || 0,
            content.offsetHeight || 0,
            content.scrollHeight || 0
          );
          row.style.setProperty('--preview-story-min-h', `${nextHeight}px`);
          media.style.minHeight = `${nextHeight}px`;
          content.style.minHeight = `${nextHeight}px`;
        });
      }

      function scaleCustomerPreviewStoryLayout(scope){
        const host = scope || $('#customerTemplatePreviewCanvas');
        if(!host) return;
        const cards = $$('.customerPreviewStoryStack .customerPreviewStoryCard', host);
        if(!cards.length) return;
        const desktop = !!(window.matchMedia && window.matchMedia('(min-width: 981px)').matches);
        const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        if(!desktop || reduceMotion){
          cards.forEach((card)=> card.style.setProperty('--preview-story-scale', '1'));
          return;
        }
        const rawGap = parseFloat(window.getComputedStyle(cards[0]).getPropertyValue('--preview-story-gap') || '');
        const gap = Number.isFinite(rawGap) ? rawGap : 12;
        const maxShrink = 0.12;
        cards.forEach((card, idx)=>{
          const next = cards[idx + 1];
          if(!next){
            card.style.setProperty('--preview-story-scale', '1');
            return;
          }
          const rect = card.getBoundingClientRect();
          const nextRect = next.getBoundingClientRect();
          const full = card.offsetHeight || rect.height || 1;
          const denom = Math.max(1, full - gap);
          const overlap = (rect.top + full) - nextRect.top;
          const progress = clampPreviewNumber(overlap / denom, 0, 1);
          const scale = 1 - (maxShrink * progress);
          card.style.setProperty('--preview-story-scale', scale.toFixed(3));
        });
      }

      function teardownCustomerPreviewStoryLayout(){
        if(!customerPreviewStoryRuntime) return;
        try{
          window.removeEventListener('resize', customerPreviewStoryRuntime.onResize);
          window.removeEventListener('orientationchange', customerPreviewStoryRuntime.onResize);
          window.removeEventListener('scroll', customerPreviewStoryRuntime.onScroll);
          if(customerPreviewStoryRuntime.inViewObserver && typeof customerPreviewStoryRuntime.inViewObserver.disconnect === 'function'){
            customerPreviewStoryRuntime.inViewObserver.disconnect();
          }
          if(customerPreviewStoryRuntime.contentObserver && typeof customerPreviewStoryRuntime.contentObserver.disconnect === 'function'){
            customerPreviewStoryRuntime.contentObserver.disconnect();
          }
        }catch(err){
          // no-op
        }
        customerPreviewStoryRuntime = null;
      }

      function initCustomerPreviewStoryLayout(scope){
        const host = scope || $('#customerTemplatePreviewCanvas');
        if(!host) return;
        teardownCustomerPreviewStoryLayout();
        const cards = $$('.customerPreviewStoryStack .customerPreviewStoryCard', host);
        if(!cards.length) return;

        const queueLayoutSync = ()=>{
          if(!(window && typeof window.requestAnimationFrame === 'function')){
            syncCustomerPreviewStoryLayout(host);
            scaleCustomerPreviewStoryLayout(host);
            return;
          }
          window.requestAnimationFrame(()=>{
            syncCustomerPreviewStoryLayout(host);
            scaleCustomerPreviewStoryLayout(host);
          });
        };

        const desktop = !!(window.matchMedia && window.matchMedia('(min-width: 981px)').matches);
        const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        if(reduceMotion || !desktop || !('IntersectionObserver' in window)){
          cards.forEach((card)=> card.classList.add('is-in'));
        }

        let inViewObserver = null;
        if(!reduceMotion && desktop && 'IntersectionObserver' in window){
          inViewObserver = new IntersectionObserver((entries)=>{
            entries.forEach((entry)=>{
              if(entry.isIntersecting){
                entry.target.classList.add('is-in');
              }
            });
          }, { threshold: 0.15 });
          cards.forEach((card)=> inViewObserver.observe(card));
        }

        let contentObserver = null;
        if('ResizeObserver' in window){
          contentObserver = new ResizeObserver(queueLayoutSync);
          $$('.customerPreviewStoryCard .customerPreviewStoryContent', host).forEach((el)=>{
            contentObserver.observe(el);
          });
        }

        const onResize = ()=>{
          queueLayoutSync();
          const isDesktop = !!(window.matchMedia && window.matchMedia('(min-width: 981px)').matches);
          if(!isDesktop){
            cards.forEach((card)=> card.classList.add('is-in'));
          }
        };
        const onScroll = ()=> scaleCustomerPreviewStoryLayout(host);

        window.addEventListener('resize', onResize, { passive:true });
        window.addEventListener('orientationchange', onResize, { passive:true });
        window.addEventListener('scroll', onScroll, { passive:true });

        customerPreviewStoryRuntime = {
          onResize,
          onScroll,
          inViewObserver,
          contentObserver
        };

        queueLayoutSync();

        $$('.customerPreviewStoryCard img, .customerPreviewStoryCard video', host).forEach((asset)=>{
          asset.addEventListener('load', queueLayoutSync, { once:true });
          asset.addEventListener('loadedmetadata', queueLayoutSync, { once:true });
        });
      }

      function renderCustomerTemplatePreview(opts){
        const options = (opts && typeof opts === 'object') ? opts : {};
        const wrap = $('#customerTemplatePreviewWrap');
        const meta = $('#customerTemplatePreviewMeta');
        const canvas = $('#customerTemplatePreviewCanvas');
        if(!wrap || !meta || !canvas) return;
        const draft = (state.customerTemplateDraft && typeof state.customerTemplateDraft === 'object')
          ? state.customerTemplateDraft
          : null;
        if(!draft){
          clearCustomerPreviewBuildTheatre(canvas);
          teardownCustomerPreviewStoryLayout();
          wrap.hidden = true;
          meta.textContent = 'Preview not generated yet.';
          canvas.innerHTML = '';
          return;
        }
        wrap.hidden = false;
        const hero = (draft.hero && typeof draft.hero === 'object') ? draft.hero : {};
        const heroStats = Array.isArray(hero.stats) ? hero.stats.filter(Boolean).slice(0, 4) : [];
        const packageRecommendation = (draft.packageRecommendation && typeof draft.packageRecommendation === 'object')
          ? draft.packageRecommendation
          : { title: `${String(draft.tier || 'Core')} package`, rationale:'' };
        const outcomeBlocks = Array.isArray(draft.outcomeBlocks) ? draft.outcomeBlocks.filter(Boolean).slice(0, 3) : [];
        const valueCards = Array.isArray(draft.valueCards) ? draft.valueCards.filter(Boolean).slice(0, 3) : [];
        const commercialSignals = Array.isArray(draft.commercialSignals) ? draft.commercialSignals.filter((row)=> row && (row.label || row.value)).slice(0, 3) : [];
        const cards = Array.isArray(draft.contentCards) ? draft.contentCards.filter(Boolean).slice(0, 8) : [];
        const whatsNewCards = Array.isArray(draft.whatsNewCards) ? draft.whatsNewCards.filter(Boolean).slice(0, 3) : [];
        const actions = Array.isArray(draft.actions) ? draft.actions.filter(Boolean).slice(0, 5) : [];
        const details = Array.isArray(draft.detailSections) ? draft.detailSections.filter(Boolean).slice(0, 6) : [];
        const playBuildTheatre = !!(options.playBuildTheatre || state.customerTemplateBuildTheatrePending);
        state.customerTemplateBuildTheatrePending = false;
        const pitch = (draft.elevatorPitch && typeof draft.elevatorPitch === 'object') ? draft.elevatorPitch : null;
        const understandingLead = `For ${String(draft.company || 'your organisation').trim() || 'your organisation'}, this means defensible evidence you can use with leadership and external stakeholders: clear baselines, visible movement over time, and proof aligned to board and regulatory expectations.`;
        const esc = (value)=> escapeHtml(String(value == null ? '' : value));
        const demoCard = (draft.demoCard && typeof draft.demoCard === 'object') ? draft.demoCard : null;
        const demoCardCtaHref = safeLinkHref(demoCard && demoCard.ctaUrl);
        const demoCardPosterHref = safeLinkHref(demoCard && demoCard.videoPoster);
        const demoCardVideoMp4Href = safeLinkHref(demoCard && demoCard.videoMp4);
        const demoCardVideoWebmHref = safeLinkHref(demoCard && demoCard.videoWebm);
        const safeToken = (value)=> String(value || '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
        const renderPreviewStoryCard = (card, idx)=>{
          const entry = (card && typeof card === 'object') ? card : {};
          const token = safeToken(entry.id || entry.kicker || entry.title || `focus-${idx + 1}`) || `focus-${idx + 1}`;
          const reverseClass = entry.reverse ? ' reverse' : '';
          const bullets = Array.isArray(entry.bullets) ? entry.bullets.map((line)=> String(line || '').trim()).filter(Boolean).slice(0, 4) : [];
          const mediaType = String(entry.mediaType || 'image').toLowerCase();
          const posterHref = safeLinkHref(entry.videoPoster);
          const videoMp4Href = safeLinkHref(entry.videoMp4);
          const videoWebmHref = safeLinkHref(entry.videoWebm);
          const mediaImageHref = safeLinkHref(entry.mediaUrl);
          const media = mediaType === 'video'
            ? `<video autoplay loop muted playsinline preload="metadata"${posterHref ? ` poster="${esc(posterHref)}"` : ''}>${videoMp4Href ? `<source src="${esc(videoMp4Href)}" type="video/mp4" />` : ''}${videoWebmHref ? `<source src="${esc(videoWebmHref)}" type="video/webm" />` : ''}</video>`
            : (mediaImageHref ? `<img src="${esc(mediaImageHref)}" alt="${esc(entry.mediaAlt || entry.title || 'Story visual')}" loading="lazy" />` : '');
          return `<article class="customerPreviewStoryCard${reverseClass}"><div class="customerPreviewStoryInner"><div class="customerPreviewStoryMedia customerPreviewStoryMedia--${esc(token)}" aria-hidden="true">${media}</div><div class="customerPreviewStoryContent"><div class="customerPreviewStoryKicker">${esc(entry.kicker || 'FOCUS')}</div><h6>${esc(entry.title || 'Focus area')}</h6><p>${esc(entry.text || '')}</p>${bullets.length ? `<ul class="customerPreviewStoryBullets">${bullets.map((line)=> `<li>${esc(line)}</li>`).join('')}</ul>` : ''}</div></div></article>`;
        };
        const logoSrc = 'https://cdn.prod.website-files.com/6735fba9a631272fb4513263/6762d3c19105162149b9f1dc_Immersive%20Logo.svg';
        meta.textContent = `Source: ${draft.company} · ${draft.tier} package`;
        canvas.innerHTML = `
          <article class="customerPreviewTopbar">
            <a class="customerPreviewBrand" href="https://www.immersivelabs.com/" target="_blank" rel="noopener noreferrer" aria-label="Immersive">
              <img src="${esc(logoSrc)}" alt="Immersive" />
            </a>
            <span class="customerPreviewTopPackage">Recommended package: ${esc(packageRecommendation.title || `${draft.tier || 'Core'} package`)}</span>
          </article>
          <article class="customerPreviewHero">
            <div>
              <p class="customerPreviewHeroEyebrow">${esc(hero.eyebrow || 'Customer dashboard')}</p>
              <h4>${esc(hero.title || `${draft.company || 'Customer'} readiness dashboard`)}</h4>
              <p class="customerPreviewHeroSub">${esc(hero.subtitle || '')}</p>
              <div class="customerPreviewHeroActions">
                <button class="btn small" type="button" data-action="editCustomerTemplateHero">Edit hero</button>
              </div>
            </div>
            <aside class="customerPreviewStats">
              ${heroStats.map((row)=> `
                <article class="customerPreviewStat">
                  <p class="customerPreviewStatLabel">${esc(row.label || '')}</p>
                  <p class="customerPreviewStatValue">${esc(row.value || '—')}</p>
                </article>
              `).join('')}
            </aside>
          </article>
          ${outcomeBlocks.length ? `
            <article class="customerPreviewSection">
              <h5>Your top outcomes</h5>
              <p>The three priorities we recommend focusing on first.</p>
              <div class="customerPreviewOutcomeGrid">
                ${outcomeBlocks.map((outcome)=> `
                  <article class="customerPreviewOutcomeCard">
                    <span>${esc(outcome.metric || 'Priority focus')}</span>
                    <h6>${esc(outcome.title || 'Priority outcome')}</h6>
                    <p>${esc(outcome.detail || '')}</p>
                  </article>
                `).join('')}
              </div>
              ${commercialSignals.length ? `<div class="customerPreviewCommercial">${commercialSignals.map((signal)=> `<span>${esc(signal.label || 'Signal')}: ${esc(signal.value || '—')}</span>`).join('')}</div>` : ''}
            </article>
          ` : ''}
          ${details.length ? `
            <article class="customerPreviewSection">
              <h5>What you told us in the meeting</h5>
              <p>Your context, constraints, and operating priorities as we captured them.</p>
              <div class="customerPreviewDetailsGrid">
                ${details.map((section)=> `
                  <article class="customerPreviewDetailCard">
                    <h6>${esc(section.title || 'Section')}</h6>
                    ${(Array.isArray(section.rows) ? section.rows : []).map((row)=> `<p><strong>${esc((row && row.label) || 'Field')}:</strong> ${esc((row && row.value) || '—')}</p>`).join('')}
                  </article>
                `).join('')}
              </div>
            </article>
          ` : ''}
          <article class="customerPreviewSection">
            <h5>Our understanding of your needs</h5>
            <p>Measuring cyber readiness with Immersive.</p>
            <p>${esc(understandingLead)}</p>
          </article>
          ${valueCards.length ? `
            <article class="customerPreviewSection customerPreviewSection--support">
              <div class="customerPreviewStoryStack">
                ${valueCards.map((card, idx)=> renderPreviewStoryCard(card, idx)).join('')}
              </div>
            </article>
          ` : ''}
          ${demoCard ? `
            <article class="customerPreviewSection">
              <article class="customerPreviewStoryCard customerPreviewStoryCard--tour">
                <div class="customerPreviewStoryInner">
                  <div class="customerPreviewStoryMedia customerPreviewStoryMedia--tour" aria-hidden="true">
                    <video autoplay loop muted playsinline preload="metadata"${demoCardPosterHref ? ` poster="${esc(demoCardPosterHref)}"` : ''}>
                      ${demoCardVideoMp4Href ? `<source src="${esc(demoCardVideoMp4Href)}" type="video/mp4" />` : ''}
                      ${demoCardVideoWebmHref ? `<source src="${esc(demoCardVideoWebmHref)}" type="video/webm" />` : ''}
                    </video>
                  </div>
                  <div class="customerPreviewStoryContent customerPreviewStoryContent--tour">
                    <h6>${esc(demoCard.title || 'Take a guided tour')}</h6>
                    <p>${esc(demoCard.text || '')}</p>
                    ${demoCardCtaHref ? `<div class="customerPreviewStoryCta"><a class="btn small primary" href="${esc(demoCardCtaHref)}" target="_blank" rel="noopener noreferrer">${esc(demoCard.ctaLabel || 'Take a Product Tour')}</a></div>` : ''}
                  </div>
                </div>
              </article>
            </article>
          ` : ''}
          <article class="customerPreviewSection">
            <h5>Recommended next actions</h5>
            <p>Suggested next steps for your team over the next 30 days.</p>
            <ol class="customerPreviewList">
              ${actions.map((line)=> `<li>${esc(line)}</li>`).join('')}
            </ol>
          </article>
          <article class="customerPreviewSection">
            <h5>Recommended for you</h5>
            <p>A short list of articles, webinars, and case studies selected for your team.</p>
            <div class="customerPreviewContentGrid">
              ${cards.map((card, idx)=> {
                const imageHref = safeLinkHref(card && card.imageUrl);
                return `
                <article class="customerPreviewContentCard">
                  ${imageHref ? `<div class="customerPreviewImageWrap"><img class="customerPreviewContentImage" src="${esc(imageHref)}" alt="${esc(card.title || 'Recommended content image')}" loading="lazy" /></div>` : ''}
                  <p>${esc(card.format || 'Content')} · Focus area: ${esc(card.outcomeLabel || 'Priority outcome')}</p>
                  <h6>${esc(card.title || 'Content block')}</h6>
                  <p>${esc(card.summary || '')}</p>
                  <p><strong>Why this is relevant:</strong> ${esc(card.why || '')}</p>
                  <div class="customerPreviewCardActions">
                    <button class="btn small" type="button" data-action="editCustomerTemplateCard" data-card-index="${idx}">Edit card</button>
                  </div>
                </article>
              `;
              }).join('')}
            </div>
          </article>
          ${whatsNewCards.length ? `
            <article class="customerPreviewSection">
              <h5>What's new</h5>
              <div class="customerPreviewContentGrid">
                ${whatsNewCards.map((card)=> {
                  const linkHref = safeLinkHref(card && card.url);
                  const imageHref = safeLinkHref(card && card.imageUrl);
                  return `
                  <article class="customerPreviewContentCard">
                    ${imageHref ? `<div class="customerPreviewImageWrap"><img class="customerPreviewContentImage" src="${esc(imageHref)}" alt="${esc(card.title || 'Latest post image')}" loading="lazy" /></div>` : ''}
                    <p>${esc(card.publishedOn || 'RSS post')}</p>
                    <h6>${esc(card.title || 'Latest post')}</h6>
                    <p>${esc(card.summary || '')}</p>
                    ${linkHref ? `<a class="contentLink" href="${esc(linkHref)}" target="_blank" rel="noopener noreferrer">${esc(card.linkLabel || 'Read post')}</a>` : ''}
                  </article>
                `;
                }).join('')}
              </div>
            </article>
          ` : ''}
        `;
        initCustomerPreviewStoryLayout(canvas);
        runCustomerPreviewBuildTheatre(canvas, { play: playBuildTheatre });
      }

      function openCustomerTemplatePreview(preferredThreadId){
        const candidate = bestCompleteCustomerTemplateCandidate(preferredThreadId || state.recommendationsThreadId || state.activeThread || 'current');
        if(!candidate){
          toast('No complete (100%) profile with mapped content is available yet.');
          return;
        }
        const model = customerTemplateModelFromCandidate(candidate);
        if(!model){
          toast('Could not build customer page preview.');
          return;
        }
        if(state.customerTemplateEditorOpen){
          toggleCustomerTemplateEditor(false);
        }
        state.customerTemplateDraft = model;
        state.customerTemplateEditorTarget = null;
        state.customerTemplateBuildTheatrePending = true;
        if(state.currentView === 'recommendations'){
          renderContentRecommendationsView(recommendationsGateFromThread(resolveRecommendationThread(state.recommendationsThreadId || 'current')));
        }else{
          renderCustomerTemplatePreview({ playBuildTheatre: true });
        }
        const wrap = $('#customerTemplatePreviewWrap');
        if(wrap){
          wrap.scrollIntoView({ behavior:'smooth', block:'start' });
        }
      }

      function populateCustomerTemplateEditor(){
        const targetLabel = $('#customerTemplateEditorTarget');
        const heroBlock = $('#customerTemplateHeroFields');
        const cardBlock = $('#customerTemplateCardFields');
        const draft = (state.customerTemplateDraft && typeof state.customerTemplateDraft === 'object')
          ? state.customerTemplateDraft
          : null;
        const target = (state.customerTemplateEditorTarget && typeof state.customerTemplateEditorTarget === 'object')
          ? state.customerTemplateEditorTarget
          : null;
        if(!draft || !target){
          if(targetLabel) targetLabel.textContent = 'Edit section';
          if(heroBlock) heroBlock.hidden = true;
          if(cardBlock) cardBlock.hidden = true;
          return;
        }
        if(target.type === 'hero'){
          if(targetLabel) targetLabel.textContent = 'Edit hero';
          if(heroBlock) heroBlock.hidden = false;
          if(cardBlock) cardBlock.hidden = true;
          const hero = (draft.hero && typeof draft.hero === 'object') ? draft.hero : {};
          const setValue = (sel, value)=>{
            const el = $(sel);
            if(el) el.value = String(value || '');
          };
          setValue('#customerTemplateFieldEyebrow', hero.eyebrow || '');
          setValue('#customerTemplateFieldTitle', hero.title || '');
          setValue('#customerTemplateFieldSubtitle', hero.subtitle || '');
          return;
        }
        if(target.type === 'card'){
          if(targetLabel) targetLabel.textContent = `Edit content card ${Number(target.cardIndex) + 1}`;
          if(heroBlock) heroBlock.hidden = true;
          if(cardBlock) cardBlock.hidden = false;
          const cards = Array.isArray(draft.contentCards) ? draft.contentCards : [];
          const card = cards[Number(target.cardIndex)] || {};
          const setValue = (sel, value)=>{
            const el = $(sel);
            if(el) el.value = String(value || '');
          };
          setValue('#customerTemplateFieldCardFormat', card.format || '');
          setValue('#customerTemplateFieldOutcome', card.outcomeLabel || '');
          setValue('#customerTemplateFieldCardTitle', card.title || '');
          setValue('#customerTemplateFieldSummary', card.summary || '');
          setValue('#customerTemplateFieldWhy', card.why || '');
          setValue('#customerTemplateFieldUrl', card.url || '');
          setValue('#customerTemplateFieldLinkLabel', card.linkLabel || '');
          setValue('#customerTemplateFieldImageUrl', card.imageUrl || '');
        }
      }

      function toggleCustomerTemplateEditor(open, opts){
        const panel = $('#customerTemplateEditorPanel');
        if(!panel) return;
        const on = !!open;
        state.customerTemplateEditorOpen = on;
        if(on){
          const cfg = opts || {};
          state.customerTemplateEditorTarget = (cfg.target && typeof cfg.target === 'object') ? cfg.target : state.customerTemplateEditorTarget;
          populateCustomerTemplateEditor();
          panel.classList.add('open');
          panel.setAttribute('aria-hidden', 'false');
        }else{
          panel.classList.remove('open');
          panel.setAttribute('aria-hidden', 'true');
        }
        syncOverlayBodyLock();
      }

      function applyCustomerTemplateEditorChanges(){
        const draft = (state.customerTemplateDraft && typeof state.customerTemplateDraft === 'object')
          ? state.customerTemplateDraft
          : null;
        const target = (state.customerTemplateEditorTarget && typeof state.customerTemplateEditorTarget === 'object')
          ? state.customerTemplateEditorTarget
          : null;
        if(!draft || !target) return false;
        const readValue = (sel)=> {
          const el = $(sel);
          return el ? String(el.value || '').trim() : '';
        };
        if(target.type === 'hero'){
          if(!(draft.hero && typeof draft.hero === 'object')) draft.hero = {};
          draft.hero.eyebrow = readValue('#customerTemplateFieldEyebrow') || draft.hero.eyebrow || '';
          draft.hero.title = readValue('#customerTemplateFieldTitle') || draft.hero.title || '';
          draft.hero.subtitle = readValue('#customerTemplateFieldSubtitle') || draft.hero.subtitle || '';
          return true;
        }
        if(target.type === 'card'){
          const cards = Array.isArray(draft.contentCards) ? draft.contentCards : [];
          const idx = Number(target.cardIndex);
          if(!Number.isFinite(idx) || idx < 0 || idx >= cards.length) return false;
          const card = cards[idx];
          if(!card || typeof card !== 'object') return false;
          const urlInput = $('#customerTemplateFieldUrl');
          const imageUrlInput = $('#customerTemplateFieldImageUrl');
          const contentUrlRaw = readValue('#customerTemplateFieldUrl');
          const imageUrlRaw = readValue('#customerTemplateFieldImageUrl');
          if(!contentUrlRaw){
            toast('Card URL is required.');
            if(urlInput) urlInput.focus();
            return false;
          }
          if(!imageUrlRaw){
            toast('Image URL is required.');
            if(imageUrlInput) imageUrlInput.focus();
            return false;
          }
          const contentUrl = normalizedHttpUrl(contentUrlRaw);
          const imageUrl = normalizedHttpUrl(imageUrlRaw);
          if(!contentUrl){
            toast('Enter a valid card URL starting with https://');
            if(urlInput) urlInput.focus();
            return false;
          }
          if(!imageUrl){
            toast('Enter a valid image URL starting with https://');
            if(imageUrlInput) imageUrlInput.focus();
            return false;
          }
          card.format = readValue('#customerTemplateFieldCardFormat') || card.format || '';
          card.outcomeLabel = readValue('#customerTemplateFieldOutcome') || card.outcomeLabel || '';
          card.title = readValue('#customerTemplateFieldCardTitle') || card.title || '';
          card.summary = readValue('#customerTemplateFieldSummary') || card.summary || '';
          card.why = readValue('#customerTemplateFieldWhy') || card.why || '';
          card.url = contentUrl;
          card.linkLabel = readValue('#customerTemplateFieldLinkLabel') || card.linkLabel || 'Read more';
          card.imageUrl = imageUrl;
          return true;
        }
        return false;
      }

      function openCustomerTemplateCardEditor(index){
        const draft = (state.customerTemplateDraft && typeof state.customerTemplateDraft === 'object')
          ? state.customerTemplateDraft
          : null;
        const cards = Array.isArray(draft && draft.contentCards) ? draft.contentCards : [];
        const idx = Number(index);
        if(!draft || !Number.isFinite(idx) || idx < 0 || idx >= cards.length){
          toast('Select a preview card first.');
          return;
        }
        toggleCustomerTemplateEditor(true, { target:{ type:'card', cardIndex: idx } });
      }

      function openCustomerTemplateHeroEditor(){
        const draft = (state.customerTemplateDraft && typeof state.customerTemplateDraft === 'object')
          ? state.customerTemplateDraft
          : null;
        if(!draft){
          toast('Generate preview first.');
          return;
        }
        toggleCustomerTemplateEditor(true, { target:{ type:'hero' } });
      }

      function downloadCustomerPageTemplate(preferredThreadId){
        const requestedThreadId = String(
          preferredThreadId
          || state.recommendationsThreadId
          || state.activeThread
          || 'current'
        ).trim() || 'current';
        let model = (state.customerTemplateDraft && typeof state.customerTemplateDraft === 'object')
          ? state.customerTemplateDraft
          : null;
        if(model){
          const modelThreadId = String(model.sourceThreadId || 'current').trim() || 'current';
          if(requestedThreadId === 'current' || modelThreadId !== requestedThreadId){
            model = null;
          }
        }
        if(!model){
          const candidate = bestCompleteCustomerTemplateCandidate(requestedThreadId);
          if(!candidate){
            toast('No complete (100%) profile with mapped content is available yet.');
            return;
          }
          model = customerTemplateModelFromCandidate(candidate);
          if(model){
            state.customerTemplateDraft = model;
            renderCustomerTemplatePreview();
          }
        }
        const html = customerTemplateHtmlFromModel(model);
        if(!html){
          toast('Could not generate customer page template.');
          return;
        }
        const day = new Date().toISOString().slice(0, 10);
        const filename = `customer-dashboard-template-${safeFilePart((model && model.company) || 'customer')}-${day}.html`;
        downloadText(html, filename, 'text/html;charset=utf-8;');
        toast(`Downloaded customer page template for ${(model && model.company) || 'customer'}.`);
      }

      function resolveRecommendationThread(threadId){
        const target = String(threadId || '').trim();
        if(target && target !== 'current'){
          const saved = findSavedThread(target);
          if(saved) return saved;
        }
        return currentThreadModel();
      }

      function recommendationsGateFromThread(thread){
        const target = (thread && typeof thread === 'object') ? thread : currentThreadModel();
        const progress = threadReadinessProgress(target);
        const completion = String(progress.completion || target.completion || '0/22 (0%)');
        const completionPct = completionPctFromSummary(completion);
        let topOutcomes = inferredConsultationOutcomes(target);
        if(!topOutcomes.length){
          const fallbackOutcomeLabels = Array.from(new Set(
            [
              ...(Array.isArray(target.outcomes) ? target.outcomes : []),
              ...splitOverviewList(target.outcomesText || '')
            ]
              .map((label)=> String(label || '').trim())
              .filter(Boolean)
          )).slice(0, 3);
          topOutcomes = fallbackOutcomeLabels.map((label)=> ({
            id: '',
            label,
            short: label,
            desc: 'Content aligned to this selected outcome.'
          }));
        }
        return {
          threadId: String(target.id || 'current'),
          company: String(target.company || '').trim() || 'Untitled company',
          tier: String(target.tier || 'Core').trim() || 'Core',
          completion,
          completionPct,
          eligible: completionPct >= 90,
          topOutcomes
        };
      }

      function recommendationsGateFromState(){
        if(state.activeThread && state.activeThread !== 'current'){
          if(state.currentView === 'configurator' && activeSavedThreadHasUnsavedState()){
            return recommendationsGateFromThread(currentThreadModel());
          }
          const saved = findSavedThread(state.activeThread);
          if(saved) return recommendationsGateFromThread(saved);
        }
        return recommendationsGateFromThread(currentThreadModel());
      }

      function syncRecommendationAccessCta(gateInput){
        const btn = $('#viewContentRecommendationsBtn');
        const hint = $('#viewContentRecommendationsHint');
        const gate = (gateInput && typeof gateInput === 'object') ? gateInput : recommendationsGateFromState();
        if(btn){
          btn.disabled = false;
          btn.setAttribute('aria-disabled', gate.eligible ? 'false' : 'true');
          btn.dataset.locked = gate.eligible ? 'false' : 'true';
        }
        if(hint){
          hint.textContent = gate.eligible
            ? `Unlocked at ${gate.completion}. Open recommendations for this package and profile.`
            : `Complete at least 90% to unlock recommendations (current: ${gate.completion}).`;
        }
      }

      function renderContentRecommendationsView(gateInput){
        const shell = $('#contentRecommendationsView');
        if(!shell) return;
        const gate = (gateInput && typeof gateInput === 'object')
          ? gateInput
          : recommendationsGateFromThread(resolveRecommendationThread(state.recommendationsThreadId || 'current'));

        const setText = (sel, value)=>{
          const el = $(sel);
          if(!el) return;
          el.textContent = String(value || '');
        };

        const backBtn = $('#contentRecommendationsBackBtn');
        if(backBtn){
          backBtn.textContent = (state.recommendationsReturnView === 'interstitial') ? 'Back to overview' : 'Back to review';
        }
        const emailBtn = $('#generateRecommendationEmailBtn');
        if(emailBtn){
          emailBtn.disabled = !gate.eligible;
          emailBtn.dataset.locked = gate.eligible ? 'false' : 'true';
          emailBtn.title = gate.eligible
            ? 'Generate recommendation email draft'
            : `Locked until completion reaches 90% (current: ${gate.completion})`;
        }
        const customerPageBtn = $('#generateCustomerPageTemplateBtn');
        const previewPageBtn = $('#previewCustomerPageTemplateBtn');
        if(customerPageBtn){
          const preferredThreadId = String((state.recommendationsThreadId || state.activeThread || 'current') || 'current');
          const candidate = bestCompleteCustomerTemplateCandidate(preferredThreadId);
          const hasDraft = !!(state.customerTemplateDraft && typeof state.customerTemplateDraft === 'object');
          customerPageBtn.disabled = !(candidate || hasDraft);
          customerPageBtn.title = hasDraft
            ? `Download current preview for ${state.customerTemplateDraft.company || 'customer'}`
            : (candidate
                ? `Generate page from ${candidate.thread.company} (${candidate.gate.completion})`
                : 'No complete (100%) profile is available yet.');
          if(previewPageBtn){
            previewPageBtn.disabled = !candidate;
            previewPageBtn.title = candidate
              ? `Preview page from ${candidate.thread.company} (${candidate.gate.completion})`
              : 'No complete (100%) profile is available yet.';
          }
        }

        const tierName = gate.tier || 'Core';
        const companyName = gate.company || 'Untitled company';
        const topOutcomeText = gate.topOutcomes.length
          ? gate.topOutcomes.map((row)=> (row && (row.short || row.label)) || '').filter(Boolean).join(' · ')
          : 'Outcome signals still forming';

        setText('#contentRecommendationsCompletion', `Completion: ${gate.completion}`);
        setText('#contentRecommendationsTier', `Package: ${tierName}`);
        setText('#contentRecommendationsOutcomes', `Outcomes: ${topOutcomeText}`);
        setText('#contentRecommendationsAudience', `Company: ${companyName}`);
        setText('#contentRecommendationsTitle', `Resources for ${companyName}`);
        setText('#contentRecommendationsRss', recommendationRssStatusText());
        setText(
          '#contentRecommendationsSub',
          gate.eligible
            ? `A curated mix of resources tailored for ${companyName}.`
            : 'Resources unlock once profile completion reaches at least 90%.'
        );

        const gateEl = $('#contentRecommendationsGate');
        const gridEl = $('#contentRecommendationsGrid');
        if(!gridEl || !gateEl) return;

        if(!gate.eligible){
          gateEl.hidden = false;
          gateEl.innerHTML = `
            <strong>Recommendations are locked.</strong>
            <p>Current completion is ${escapeHtml(gate.completion)}. Reach at least 90% to unlock this page.</p>
          `;
          gridEl.innerHTML = '';
          if(emailBtn){
            emailBtn.disabled = true;
            emailBtn.dataset.locked = 'true';
          }
          renderCustomerTemplatePreview();
          return;
        }

        gateEl.hidden = true;
        gateEl.innerHTML = '';

        const cards = recommendationCardsForGate(gate);
        setText('#contentRecommendationsRss', recommendationRssStatusText(cards));

        if(!cards.length){
          gridEl.innerHTML = `
            <article class="contentRecCard">
              <p class="contentRecEyebrow">No mapped content found</p>
              <h3>No existing assets matched this profile yet</h3>
              <p class="contentRecSummary">No strong recommendations are available for this profile yet. Add or refresh source content and try again.</p>
            </article>
          `;
          if(emailBtn){
            emailBtn.disabled = true;
            emailBtn.dataset.locked = 'true';
            emailBtn.title = 'No mapped recommendations available to build an email yet.';
          }
          renderCustomerTemplatePreview();
          return;
        }
        if(emailBtn){
          emailBtn.disabled = false;
          emailBtn.dataset.locked = 'false';
          emailBtn.title = 'Generate recommendation email draft';
        }

        gridEl.innerHTML = cards.map((card, idx)=>{
          const sourceLabel = recommendationSourceLabel(card);
          const publishedLabel = formatPublishedDate(card.publishedOn);
          const cardHref = safeLinkHref(card && card.url);
          return `
            <article class="contentRecCard">
              <p class="contentRecEyebrow">Recommendation ${idx + 1} · ${escapeHtml(card.format)}</p>
              <h3>${escapeHtml(card.title)}</h3>
              <p class="contentRecOutcome"><strong>Outcome:</strong> ${escapeHtml(card.outcomeLabel)}</p>
              <p class="contentRecSummary">${escapeHtml(card.summary)}</p>
              <p class="contentRecWhy"><strong>Why this match:</strong> ${escapeHtml(card.why)}</p>
              ${cardHref
                ? `<a class="contentRecLink" href="${escapeHtml(cardHref)}" target="_blank" rel="noopener noreferrer">${escapeHtml(card.linkLabel || 'Read more')}</a>`
                : ''
              }
              ${publishedLabel ? `<p class="contentRecMeta"><strong>Published:</strong> ${escapeHtml(publishedLabel)}</p>` : ''}
              <p class="contentRecSource"><strong>Source:</strong> ${escapeHtml(sourceLabel)}</p>
            </article>
          `;
        }).join('');
        renderCustomerTemplatePreview();
      }

      function moduleValueByLabel(rows, label){
        const target = normalizeContentToken(label);
        const found = (rows || []).find((row)=> normalizeContentToken(row && row.label) === target);
        return String((found && found.value) || '').trim();
      }

      function recommendationEmailModelForThread(threadId){
        const thread = resolveRecommendationThread(threadId || state.recommendationsThreadId || state.activeThread || 'current');
        const gate = recommendationsGateFromThread(thread);
        const cards = gate.eligible ? recommendationCardsForGate(gate) : [];
        const progress = threadReadinessProgress(thread);
        const snapshot = (thread && thread.snapshot && typeof thread.snapshot === 'object') ? thread.snapshot : {};
        const modules = (thread && thread.modules && typeof thread.modules === 'object')
          ? thread.modules
          : threadModulesFromSnapshot(snapshot, {
              outcomes: Array.isArray(thread && thread.outcomes) ? thread.outcomes : [],
              outcomesText: String((thread && thread.outcomesText) || '').trim()
            });

        const orgRows = Array.isArray(modules.organisation) ? modules.organisation : [];
        const discoveryRows = Array.isArray(modules.discovery) ? modules.discovery : [];
        const coverageRows = Array.isArray(modules.coverage) ? modules.coverage : [];
        const contextRows = Array.isArray(modules.context) ? modules.context : [];

        const profileSignals = [
          `Role: ${moduleValueByLabel(orgRows, 'Role')}`,
          `Company size: ${moduleValueByLabel(orgRows, 'Company size')}`,
          `Operating country: ${moduleValueByLabel(orgRows, 'Operating country')}`,
          `Pressure sources: ${moduleValueByLabel(discoveryRows, 'Pressure sources')}`,
          `Urgent win: ${moduleValueByLabel(discoveryRows, 'Urgent win')}`,
          `Risk environment: ${moduleValueByLabel(discoveryRows, 'Risk environment')}`,
          `Cadence: ${moduleValueByLabel(coverageRows, 'Cadence')}`,
          `Measurement: ${moduleValueByLabel(coverageRows, 'Measurement')}`,
          `Industry: ${moduleValueByLabel(contextRows, 'Industry')}`,
          `Region: ${moduleValueByLabel(contextRows, 'Region')}`,
          `Regulatory references: ${moduleValueByLabel(contextRows, 'Regulatory references')}`
        ].filter((line)=>{
          const value = line.split(':').slice(1).join(':').trim();
          return !!value && value !== '—' && value !== 'No open gaps';
        });

        const topOutcomes = (gate.topOutcomes || [])
          .map((row)=> String((row && (row.short || row.label)) || '').trim())
          .filter(Boolean);
        const topOutcomeText = topOutcomes.length
          ? naturalList(topOutcomes, { conjunction:'and' })
          : 'your selected priorities';
        const gapTitles = (progress.gaps || [])
          .map((gap)=> String((gap && gap.title) || '').trim())
          .filter(Boolean)
          .slice(0, 5);

        const subject = `Immersive content recommendations for ${gate.company} (${gate.tier})`;
        const lines = [];
        lines.push('Hi {{First Name}},');
        lines.push('');
        lines.push(`Based on your current ${gate.company} profile (${gate.completion}, ${gate.tier} package), here are the recommended content blocks for ${topOutcomeText}.`);
        lines.push('');
        lines.push('Profile summary');
        lines.push(`- Package: ${gate.tier}`);
        lines.push(`- Completion: ${gate.completion}`);
        lines.push(`- Priority outcomes: ${topOutcomes.length ? topOutcomes.join(' · ') : 'Outcome signals still forming'}`);
        lines.push(`- Open gaps: ${gapTitles.length ? gapTitles.join(' · ') : 'No open gaps'}`);
        if(profileSignals.length){
          lines.push('');
          lines.push('Signals captured');
          profileSignals.forEach((line)=> lines.push(`- ${line}`));
        }
        lines.push('');
        lines.push('Recommended content blocks');
        if(cards.length){
          cards.forEach((card, idx)=>{
            const safeCardHref = safeLinkHref(card && card.url);
            lines.push(`${idx + 1}) ${card.title}`);
            lines.push(`   Format: ${card.format}`);
            lines.push(`   Outcome: ${card.outcomeLabel}`);
            lines.push(`   Why this match: ${card.why}`);
            if(safeCardHref) lines.push(`   Link: ${safeCardHref}`);
          });
        }else{
          lines.push('- No mapped content available from the current Webflow export for this profile yet.');
        }
        lines.push('');
        lines.push('If useful, reply with your target audience and I can tailor this into a send-ready version.');

        return {
          threadId: gate.threadId,
          company: gate.company,
          tier: gate.tier,
          completion: gate.completion,
          outcomes: topOutcomes,
          subject,
          body: lines.join('\n'),
          fullText: [`Subject: ${subject}`, '', lines.join('\n')].join('\n'),
          cards
        };
      }

      function renderRecommendationEmailBuilder(threadId){
        const model = recommendationEmailModelForThread(threadId);
        state.emailBuilderThreadId = model.threadId;

        const setText = (sel, value)=>{
          const el = $(sel);
          if(el) el.textContent = String(value || '');
        };

        setText('#emailBuilderCompany', model.company);
        setText('#emailBuilderSub', `Structured email draft assembled from package, profile selections, and mapped content for ${model.company}.`);
        setText('#emailBuilderTierPill', `Tier: ${model.tier}`);
        setText('#emailBuilderCompletionPill', `Completion: ${model.completion}`);
        setText('#emailBuilderOutcomePill', `Outcomes: ${model.outcomes.length ? model.outcomes.join(' · ') : '—'}`);
        setText('#emailBuilderSubject', model.subject);
        setText('#emailBuilderDraft', model.body);

        const resourcesEl = $('#emailBuilderResources');
        if(resourcesEl){
          if(model.cards.length){
            resourcesEl.innerHTML = model.cards.map((card, idx)=> {
              const linkHref = safeLinkHref(card && card.url);
              return `
              <li>
                <strong>${idx + 1}. ${escapeHtml(card.title)}</strong>
                ${linkHref
                  ? ` <a href="${escapeHtml(linkHref)}" target="_blank" rel="noopener noreferrer">${escapeHtml(card.linkLabel || 'Read more')}</a>`
                  : ''
                }
                <div class="emailBuilderResourceMeta">${escapeHtml(`${card.format} · ${card.outcomeLabel}`)}</div>
              </li>
            `;
            }).join('');
          }else{
            resourcesEl.innerHTML = '<li>No mapped content blocks available for this profile yet.</li>';
          }
        }

        return model;
      }

      function openRecommendationsForThread(threadId, opts){
        const cfg = opts || {};
        const resolvedThreadId = String(threadId || '').trim();
        const thread = resolveRecommendationThread(resolvedThreadId || 'current');
        if(thread && thread.id && thread.id !== 'current' && thread.archived){
          toast('Unarchive this record to view recommendations.');
          return false;
        }
        const gate = recommendationsGateFromThread(thread);
        state.recommendationsThreadId = gate.threadId;
        state.recommendationsReturnView = String(cfg.returnView || ((state.currentView === 'interstitial') ? 'interstitial' : 'configurator'));
        renderContentRecommendationsView(gate);
        setView('recommendations');
        if(!gate.eligible){
          toast(`Recommendations are locked until 90% completion (current: ${gate.completion}).`);
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return gate.eligible;
      }

      function openRecommendationEmailBuilder(threadId){
        const resolvedThreadId = String(threadId || '').trim();
        const thread = resolveRecommendationThread(resolvedThreadId || state.recommendationsThreadId || state.activeThread || 'current');
        if(thread && thread.id && thread.id !== 'current' && thread.archived){
          toast('Unarchive this record to generate a recommendation email.');
          return false;
        }
        const gate = recommendationsGateFromThread(thread);
        if(!gate.eligible){
          toast(`Recommendations are locked until 90% completion (current: ${gate.completion}).`);
          return false;
        }
        state.recommendationsThreadId = gate.threadId;
        toggleEmailBuilder(true, { threadId: gate.threadId });
        return true;
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

      function activeCollaborationThreadModel(){
        const view = state.currentView || 'configurator';
        if(view === 'recommendations'){
          const target = resolveRecommendationThread(state.recommendationsThreadId || state.activeThread || 'current');
          return (target && target.id !== 'current') ? target : null;
        }
        if(state.activeThread && state.activeThread !== 'current'){
          return findSavedThread(state.activeThread);
        }
        return null;
      }

      function threadLockOwner(thread){
        const owner = (thread && thread.lockOwner && typeof thread.lockOwner === 'object') ? thread.lockOwner : null;
        if(!owner) return null;
        const userId = String(owner.userId || '').trim();
        const name = String(owner.name || owner.email || userId || '').trim();
        const sessionId = String(owner.sessionId || '').trim();
        if(!name && !userId && !sessionId) return null;
        return {
          userId,
          name: name || 'another collaborator',
          sessionId
        };
      }

      function isThreadReadOnlyForActor(thread){
        const owner = threadLockOwner(thread);
        if(!owner) return false;
        const lockExpiresAt = Number(thread && thread.lockExpiresAt) || 0;
        if(lockExpiresAt <= Date.now()) return false;
        const actor = activeCollaboratorIdentity();
        const actorId = String(actor.userId || '').trim();
        if(owner.sessionId && owner.sessionId === LOCAL_TAB_SESSION_ID) return false;
        if(owner.userId && actorId && owner.userId === actorId) return false;
        return true;
      }

      function setReadOnlyControls(readOnly){
        const next = !!readOnly;
        state.recordReadOnly = next;
        document.body.classList.toggle('is-record-readonly', next);
        const host = $('#configuratorEditor');
        if(!host) return;
        const controls = $$(
          '.step button, .step input, .step select, .step textarea, #saveRecordBtn, [data-jump-next-incomplete]',
          host
        );
        controls.forEach((el)=>{
          if(!(el instanceof HTMLElement)) return;
          if(next){
            if(!el.hasAttribute('data-readonly-orig-disabled')){
              el.setAttribute('data-readonly-orig-disabled', el.disabled ? 'true' : 'false');
            }
            el.disabled = true;
            el.setAttribute('aria-disabled', 'true');
          }else{
            const orig = el.getAttribute('data-readonly-orig-disabled');
            if(orig !== null){
              el.disabled = orig === 'true';
              el.removeAttribute('data-readonly-orig-disabled');
            }
            el.removeAttribute('aria-disabled');
          }
        });
      }

      function renderCollaborationStatus(){
        const wrap = $('#collabStatus');
        const titleEl = $('#collabStatusTitle');
        const bodyEl = $('#collabStatusBody');
        const hasStatusUi = !!(wrap && titleEl && bodyEl);

        const view = state.currentView || 'dashboard';
        const targetThread = activeCollaborationThreadModel();
        const unsupportedView = (view === 'dashboard' || view === 'archived' || view === 'account' || view === 'backend' || view === 'export');
        if(unsupportedView){
          if(hasStatusUi) wrap.hidden = true;
          setReadOnlyControls(false);
          return;
        }
        if(!targetThread){
          const draftPerms = actorPermissionsForThread(null);
          if(hasStatusUi) wrap.hidden = true;
          setReadOnlyControls(!draftPerms.canEditRecord);
          return;
        }

        const threadId = String((targetThread.recordId || targetThread.id) || '').trim();
        const version = Math.max(1, Number(targetThread.version) || 1);
        const updatedBy = String(targetThread.updatedBy || 'Unknown collaborator').trim() || 'Unknown collaborator';
        const updatedAtText = formatDashboardDate(targetThread.updatedAt);
        const permissions = actorPermissionsForThread(targetThread);
        let tone = 'info';
        let title = '';
        let body = '';
        const lockReadOnly = isThreadReadOnlyForActor(targetThread);
        const permissionReadOnly = !permissions.canEditRecord;
        const readOnly = permissionReadOnly || lockReadOnly;
        let showStatus = false;
        if(permissionReadOnly){
          state.lockReacquirePending = false;
          if(threadId){
            releaseRecordLock(threadId, { force:false });
          }
          clearRecordLockHeartbeat();
        }else if(lockReadOnly){
          const owner = threadLockOwner(targetThread);
          tone = 'warning';
          title = 'Read-only mode';
          body = `${owner ? owner.name : 'Another collaborator'} is editing this record. Editing is locked until they save or release the lock.`;
          state.lockReacquirePending = true;
          showStatus = true;
        }else{
          state.lockReacquirePending = false;
        }

        const hasNotice = (
          state.collaborationNoticeUntil > Date.now()
          && threadId
          && threadId === String(state.collaborationNoticeRecordId || '').trim()
          && String(state.collaborationNoticeTitle || '').trim()
        );
        if(hasNotice){
          tone = state.collaborationNoticeTone || tone;
          title = state.collaborationNoticeTitle;
          body = state.collaborationNoticeBody || `Role: ${permissions.roleLabel} • v${version} • Updated by ${updatedBy} • ${updatedAtText}`;
          showStatus = true;
        }

        if(threadId){
          state.recordSeenVersions[threadId] = version;
        }
        if(showStatus && hasStatusUi){
          wrap.dataset.tone = tone;
          titleEl.textContent = title || 'Shared record';
          bodyEl.textContent = body || `Role: ${permissions.roleLabel} • v${version} • Updated by ${updatedBy} • ${updatedAtText}`;
          wrap.hidden = false;
        }else if(hasStatusUi){
          wrap.hidden = true;
        }
        setReadOnlyControls(readOnly);
      }

      function renderConfiguratorCollaboratorAvatars(){
        const hosts = [
          $('#configuratorCollabAvatars'),
          $('#snapshotCollabAvatars')
        ].filter(Boolean);
        const collabTools = [
          $('#configuratorCollabTools'),
          $('#snapshotCollabTools')
        ].filter(Boolean);
        const shareBtns = collabTools.length
          ? collabTools.flatMap((tools)=> $$('[data-action="openShareRecord"]', tools))
          : [$('#configuratorShareRecordBtn'), $('#snapshotShareRecordBtn')].filter(Boolean);
        const applyShareEnabled = (enabled, title)=>{
          shareBtns.forEach((btn)=>{
            if(!(btn instanceof HTMLElement)) return;
            const on = !!enabled;
            btn.disabled = !on;
            btn.setAttribute('aria-disabled', on ? 'false' : 'true');
            if(typeof title === 'string'){
              btn.title = title;
            }
          });
        };
        if(!hosts.length){
          applyShareEnabled(false, 'Save the record before adding collaborators');
          return;
        }
        const isConfigurator = (state.currentView || '') === 'configurator';
        const thread = isConfigurator ? activeCollaborationThreadModel() : null;
        if(!thread || thread.id === 'current'){
          hosts.forEach((host)=>{
            host.hidden = true;
            host.innerHTML = '';
          });
          applyShareEnabled(false, 'Save the record before adding collaborators');
          return;
        }
        const perms = actorPermissionsForThread(thread);
        const html = collaboratorStackHtml(thread, { maxVisible:4, size:'md', showSingle:false });
        hosts.forEach((host)=>{
          host.innerHTML = html;
          host.hidden = !html;
        });
        applyShareEnabled(
          perms.canShareRecord,
          perms.canShareRecord
            ? 'Manage sharing for this record'
            : 'Sharing is not available for this role'
        );
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
        renderConfiguratorProgressRail();
        renderDashboardRows();
        renderArchivedRows();
        updateDashboardSortControls();
        updateDashboardDateControls();
        renderWorkspaceCompanies();
        renderArchiveNavMeta();
        renderInterstitialView();
        syncGlobalActionBar();
        renderWorkspaceBreadcrumb();
        if((state.currentView || '') === 'export'){
          renderCrmExportView();
        }
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
            const nextLabel = configuratorStepLabel(nextIncomplete);
            jumpBtns.forEach((jumpBtn)=>{
              jumpBtn.disabled = false;
              jumpBtn.title = `Jump to next incomplete section (${nextLabel})`;
            });
            jumpLabels.forEach((jumpLabel)=>{ jumpLabel.textContent = 'Next incomplete'; });
          }
        }
        const activeConfiguratorStep = clampConfiguratorStep(state.activeStep);
        const saveReturnsToOverview = activeConfiguratorStep === reviewStepNumber();
        const saveIdleLabel = saveReturnsToOverview ? 'Save & return' : 'Save';
        $$('[data-action="save"]').forEach((btn)=>{
          if(btn.textContent !== saveIdleLabel){
            btn.textContent = saveIdleLabel;
          }
        });
        const saveBtn = $('#saveRecordBtn');
        const saveLabel = $('#saveRecordBtnLabel');
        if(saveBtn){
          const canSaveByRole = !!activeRecordPermissionSnapshot().canEditRecord;
          const isReadOnly = state.recordReadOnly || !canSaveByRole;
          const isThinking = !!state.saveIsThinking;
          const justSaved = !isThinking && Date.now() < (state.savePulseUntil || 0);
          saveBtn.dataset.saved = justSaved ? 'true' : 'false';
          saveBtn.dataset.thinking = isThinking ? 'true' : 'false';
          saveBtn.dataset.readonly = isReadOnly ? 'true' : 'false';
          saveBtn.setAttribute('aria-busy', isThinking ? 'true' : 'false');
          if(saveLabel){
            saveLabel.textContent = isThinking
              ? 'Saving...'
              : (isReadOnly ? 'Read-only' : (justSaved ? 'Saved' : saveIdleLabel));
          }
          if(isReadOnly && !isThinking){
            saveBtn.title = 'Your role cannot save edits on this record.';
          }else{
            saveBtn.title = '';
          }
        }

        const labelFrom = (list, id) => {
          const it = (list||[]).find(x => x.id === id);
          if(!it) return id;
          return it.label || it.title || id;
        };

        const regionLabels = { NA:'North America', UKI:'UK & Ireland', EU:'Europe (EU)', APAC:'APAC', Other:'Other / Global' };
        const hasUnsavedEditsOnSavedThread = activeSavedThreadHasUnsavedState();
        const savedMetaEl = $('#recordSavedMeta');
        if(savedMetaEl){
          const activeId = String(state.activeThread || '').trim();
          const activeSavedThread = (activeId && activeId !== 'current') ? findSavedThread(activeId) : null;
          const hasSavedTs = !!(activeSavedThread && Number(activeSavedThread.updatedAt) > 0);
          let savedMetaText = hasSavedTs
            ? formatTitleSavedMeta(activeSavedThread.updatedAt)
            : 'Not saved yet';
          if(hasUnsavedEditsOnSavedThread){
            savedMetaText = 'Unsaved changes';
          }
          savedMetaEl.textContent = savedMetaText;
        }
        const savedProgressForConfigurator = (
          state.currentView === 'configurator'
          && state.activeThread
          && state.activeThread !== 'current'
          && !hasUnsavedEditsOnSavedThread
        )
          ? threadReadinessProgress(findSavedThread(state.activeThread))
          : null;
        const liveGaps = (savedProgressForConfigurator && Array.isArray(savedProgressForConfigurator.gaps))
          ? savedProgressForConfigurator.gaps
          : dashboardCurrentGaps();
        const liveRequirements = readinessRequirements(state);
        const missingRequirementKeys = new Set(
          liveRequirements
            .filter((req)=> !req.done && req.key)
            .map((req)=> req.key)
        );
        const gapSteps = new Set(
          liveGaps.map((gap)=> clampQuestionStep(Number(gap && gap.step) || 1))
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
        autoOpen(sideRoi, state.activeStep >= maxQuestionStep() || state.visited.has(maxQuestionStep()));
        autoOpen(sideAnswers, true);

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
        const roiEstimateEnabled = accountRoiEstimateEnabled();
        const showROI = roiEstimateEnabled && state.visited.has(maxQuestionStep());
        const sideRoiBlock = $('#sideRoiBlock');
        if(sideRoiBlock){
          sideRoiBlock.hidden = !roiEstimateEnabled;
          if(!roiEstimateEnabled){
            sideRoiBlock.open = false;
          }
        }
        const inputAccRoi = $('#inputAccRoi');
        if(inputAccRoi){
          inputAccRoi.hidden = !roiEstimateEnabled;
          if(!roiEstimateEnabled){
            inputAccRoi.open = false;
          }
        }

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

        setText('#snapReviewPackage', `${tier.name} package`);
        setHTML('#snapReviewOutcomes', chipsHTML(topOutcomes.map(o => o.short || o.label), 99));

        // captured count
        const selTotal = roiEstimateEnabled ? 14 : 13;
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
          ((roiEstimateEnabled && state.visited.has(maxQuestionStep())) ? 1 : 0) +
          (topOutcomes.length ? 1 : 0) +
          (Object.keys(state.outcomeDrilldowns || {}).length ? 1 : 0);

        setText('#selPill', `${selDone}/${selTotal} captured`);

        // Step completion + incomplete highlighting
        const activeMode = effectiveConfiguratorFieldMode(state.fieldMode);
        const requiredQuestionSteps = requiredQuestionStepSetForMode(activeMode);
        const questionSteps = new Set(configuratorQuestionSteps().map((row)=> row.step));
        const liveCtx = buildReadinessContext(state);
        const stepCompletionByAllQuestions = new Map();
        const requirementsByStep = new Map();
        questionRequirementRows().forEach((requirement)=>{
          const stepNo = clampQuestionStep(Number(requirement.step) || 1);
          if(!requirementsByStep.has(stepNo)){
            requirementsByStep.set(stepNo, []);
          }
          requirementsByStep.get(stepNo).push(requirement);
        });
        questionSteps.forEach((stepNo)=>{
          const rows = requirementsByStep.get(stepNo) || [];
          const done = rows.length > 0 && rows.every((requirement)=> requirementDoneForContext(requirement.key, liveCtx));
          stepCompletionByAllQuestions.set(stepNo, done);
        });

        $$('.chip').forEach(ch=>{
          const step = Number(ch.dataset.chip);
          const strong = ch.querySelector('strong');
          const wasDone = ch.dataset.done === 'true';
          const isQuestionStep = questionSteps.has(step);
          const isOptionalStep = isQuestionStep && !requiredQuestionSteps.has(step);
          const isDone = !isQuestionStep
            ? false
            : (isOptionalStep ? !!stepCompletionByAllQuestions.get(step) : !gapSteps.has(step));

          ch.dataset.done = isDone ? 'true' : 'false';
          ch.dataset.optional = isOptionalStep ? 'true' : 'false';
          ch.dataset.incomplete = (!isOptionalStep && isQuestionStep && !isDone && gapSteps.has(step)) ? 'true' : 'false';
          if(strong){
            strong.textContent = isDone ? '✔' : (isOptionalStep ? '' : String(configuratorStepDisplayIndex(step)));
            if(!wasDone && isDone){
              replayMotionClass(strong, 'tick-pop', 300);
            }
          }
        });
        $$('.step').forEach((stepEl)=>{
          const stepNo = clampConfiguratorStep(Number(stepEl.dataset.step) || 1);
          const hasGap = questionSteps.has(stepNo) && requiredQuestionSteps.has(stepNo) && gapSteps.has(stepNo);
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

        const recommendationGate = recommendationsGateFromState();
        syncRecommendationAccessCta(recommendationGate);
        const recThread = (state.currentView === 'recommendations')
          ? resolveRecommendationThread(state.recommendationsThreadId || 'current')
          : currentThreadModel();
        renderContentRecommendationsView(recommendationsGateFromThread(recThread));

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
        if(state.emailBuilderOpen){
          renderRecommendationEmailBuilder(state.emailBuilderThreadId || state.recommendationsThreadId || state.activeThread || 'current');
        }

        renderConfiguratorCollaboratorAvatars();
        renderCollaborationStatus();

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

      function copyToClipboard(text, successMsg){
        const okMessage = String(successMsg || 'Copied summary to clipboard.');
        if(navigator.clipboard && navigator.clipboard.writeText){
          navigator.clipboard.writeText(text)
            .then(()=> toast(okMessage))
            .catch(()=> fallbackCopy(text, okMessage));
        }else{
          fallbackCopy(text, okMessage);
        }
      }

      function fallbackCopy(text, successMsg){
        try{
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position='fixed';
          ta.style.left='-9999px';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          toast(String(successMsg || 'Copied summary (fallback).'));
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
            visited: !!state.visited.has(maxQuestionStep()),
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
        const header = cols.map((col)=> csvEscapedCell(col)).join(',');
        const line = cols.map((c)=> csvEscapedCell(row[c])).join(',');
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
      const configProgressNav = $('#configProgressNav') || $('.progress');
      if(configProgressNav){
        configProgressNav.addEventListener('click', (e)=>{
          const chip = e.target.closest('.chip[data-step]');
          if(!chip) return;
          setActiveStep(Number(chip.dataset.step) || 1);
        });
      }
      const brandHome = $('#brandHome');
      const workspaceArchive = $('#workspaceArchive');
      const workspaceAccount = $('#workspaceAccount');
      const workspaceBackend = $('#workspaceBackend');
      const recordOverviewBtn = $('#recordOverviewBtn');
      const workspaceCreateRecord = $('#workspaceCreateRecord');
      const globalCreateRecord = $('#globalCreateRecord');
      const globalDeleteRecord = $('#globalDeleteRecord');
      const globalEditConfigurator = $('#globalEditConfigurator');
      const globalViewRecommendations = $('#globalViewRecommendations');
      const globalBookConsultation = $('#globalBookConsultation');
      const consultationPanel = $('#consultationPanel');
      const closeConsultationBtn = $('#closeConsultation');
      const emailBuilderPanel = $('#emailBuilderPanel');
      const closeEmailBuilderBtn = $('#closeEmailBuilder');
      const customerTemplateEditorPanel = $('#customerTemplateEditorPanel');
      const closeCustomerTemplateEditorBtn = $('#closeCustomerTemplateEditor');
      const workspaceBreadcrumb = $('#workspaceBreadcrumb');
      const jumpNextIncompleteBtns = $$('[data-jump-next-incomplete]');
      const saveRecordBtn = $('#saveRecordBtn');
      const workspaceCompaniesList = $('#workspaceCompaniesList');
      const dashboardRowsBody = $('#dashboardRows');
      const dashSortButtons = $$('[data-dash-sort]');
      const dashDateToggles = $$('[data-dashboard-date-toggle]');
      const dashDateSortButtons = $$('[data-dashboard-date-sort]');
      const dashSelectAll = $('#dashSelectAll');
      const dashArchiveSelected = $('#dashArchiveSelected');
      const archivedRowsBody = $('#archivedRows');
      const archivedSelectAll = $('#archivedSelectAll');
      const archivedRestoreSelected = $('#archivedRestoreSelected');
      const archivedDeleteSelected = $('#archivedDeleteSelected');
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
      if(workspaceBackend){
        workspaceBackend.addEventListener('click', ()=>{
          setView('backend');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      }
      if(recordOverviewBtn){
        recordOverviewBtn.addEventListener('click', ()=>{
          openThreadOverview(state.activeThread || 'current');
        });
      }
      if(workspaceBreadcrumb){
        workspaceBreadcrumb.addEventListener('click', (e)=>{
          const btn = e.target.closest('[data-workspace-crumb]');
          if(!btn) return;
          const action = btn.getAttribute('data-workspace-crumb') || '';
          const threadId = btn.getAttribute('data-thread-id') || '';
          if(action === 'dashboard'){
            setView('dashboard');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
          }
          if(action === 'archived'){
            setView('archived');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
          }
          if(action === 'account'){
            setView('account');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
          }
          if(action === 'account-backend'){
            setView('backend');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
          }
          if(action === 'interstitial-thread'){
            openThreadOverview(threadId || state.activeThread || 'current');
            return;
          }
          if(action === 'recommendations'){
            setView('recommendations');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
          }
          if(action === 'export'){
            openCrmExportView(state.activeThread || 'current');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
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
          if(thread && thread.id && thread.id !== 'current' && thread.archived){
            const perms = actorPermissionsForThread(thread);
            const canRestore = perms.role === 'admin' || perms.role === 'owner';
            if(!canRestore){
              toast('Only owners or admins can unarchive this record.');
              return;
            }
            openArchivePrompt([thread.id], 'restore');
            return;
          }
          const step = dashboardFirstGapStep(thread);
          openThreadConfigurator((thread && thread.id) ? thread.id : (state.activeThread || 'current'), step);
        });
      }
      if(globalDeleteRecord){
        globalDeleteRecord.addEventListener('click', ()=>{
          const thread = activeThreadModel();
          if(!thread || !thread.id || thread.id === 'current'){
            toast('Save the record first, then you can archive it from here.');
            return;
          }
          const nextMode = thread.archived ? 'restore' : 'archive';
          openArchivePrompt([thread.id], nextMode);
        });
      }
      if(globalBookConsultation){
        globalBookConsultation.addEventListener('click', ()=>{
          const thread = activeThreadModel();
          openThreadBooking((thread && thread.id) ? thread.id : (state.activeThread || 'current'));
        });
      }
      if(globalViewRecommendations){
        globalViewRecommendations.addEventListener('click', ()=>{
          const thread = activeThreadModel();
          openRecommendationsForThread((thread && thread.id) ? thread.id : 'current', { returnView:'interstitial' });
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
      if(closeEmailBuilderBtn){
        closeEmailBuilderBtn.addEventListener('click', ()=>{
          toggleEmailBuilder(false);
        });
      }
      if(emailBuilderPanel){
        emailBuilderPanel.addEventListener('click', (e)=>{
          if(e.target === emailBuilderPanel){
            toggleEmailBuilder(false);
          }
        });
      }
      if(closeCustomerTemplateEditorBtn){
        closeCustomerTemplateEditorBtn.addEventListener('click', ()=>{
          toggleCustomerTemplateEditor(false);
        });
      }
      if(customerTemplateEditorPanel){
        customerTemplateEditorPanel.addEventListener('click', (e)=>{
          if(e.target === customerTemplateEditorPanel){
            toggleCustomerTemplateEditor(false);
          }
        });
      }
      if(workspaceCompaniesList){
        workspaceCompaniesList.addEventListener('click', (e)=>{
          if(dashboardInteractionsSuppressed()) return;
          const openBtn = e.target.closest('[data-company-open]');
          if(openBtn){
            const id = openBtn.getAttribute('data-company-open') || '';
            if(id) openThreadOverview(id);
          }
        });
      }
      if(dashboardRowsBody){
        dashboardRowsBody.addEventListener('change', (e)=>{
          if(dashboardInteractionsSuppressed()) return;
          const sel = e.target.closest('[data-dashboard-select-id]');
          if(!sel) return;
          const id = sel.getAttribute('data-dashboard-select-id') || '';
          if(!id) return;
          if(sel.checked) state.dashboardSelectedIds.add(id);
          else state.dashboardSelectedIds.delete(id);
          update();
        });
        dashboardRowsBody.addEventListener('click', (e)=>{
          if(dashboardInteractionsSuppressed()) return;
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
      dashSortButtons.forEach((btn)=>{
        btn.addEventListener('click', ()=>{
          if(dashboardInteractionsSuppressed()) return;
          const column = btn.getAttribute('data-dash-sort') || '';
          const nextMode = dashboardSortNextModeForColumn(column);
          state.dashboardSort = sanitizeDashboardSortMode(nextMode);
          persistDashboardSortMode();
          state.dashboardSelectedIds = new Set();
          state.archivedSelectedIds = new Set();
          update();
        });
      });
      dashDateToggles.forEach((btn)=>{
        btn.addEventListener('click', ()=>{
          if(dashboardInteractionsSuppressed()) return;
          const currentMode = sanitizeDashboardDateMode(state.dashboardDateMode);
          const nextMode = currentMode === 'modified' ? 'created' : 'modified';
          const currentSort = sanitizeDashboardSortMode(state.dashboardSort);
          let nextDir = 'desc';
          if(currentSort === `${currentMode}-asc`) nextDir = 'asc';
          else if(currentSort === `${currentMode}-desc`) nextDir = 'desc';
          else if(currentSort === `${nextMode}-asc`) nextDir = 'asc';
          else if(currentSort === `${nextMode}-desc`) nextDir = 'desc';
          state.dashboardDateMode = nextMode;
          state.dashboardSort = sanitizeDashboardSortMode(`${nextMode}-${nextDir}`);
          persistDashboardSortMode();
          persistDashboardDateMode();
          state.dashboardSelectedIds = new Set();
          state.archivedSelectedIds = new Set();
          update();
        });
      });
      dashDateSortButtons.forEach((btn)=>{
        btn.addEventListener('click', ()=>{
          if(dashboardInteractionsSuppressed()) return;
          const mode = sanitizeDashboardDateMode(state.dashboardDateMode);
          const currentSort = sanitizeDashboardSortMode(state.dashboardSort);
          let nextSort = `${mode}-desc`;
          if(currentSort === `${mode}-desc`) nextSort = `${mode}-asc`;
          else if(currentSort === `${mode}-asc`) nextSort = `${mode}-desc`;
          state.dashboardSort = sanitizeDashboardSortMode(nextSort);
          persistDashboardSortMode();
          state.dashboardSelectedIds = new Set();
          state.archivedSelectedIds = new Set();
          update();
        });
      });
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
      if(archivedDeleteSelected){
        archivedDeleteSelected.addEventListener('click', ()=>{
          const ids = Array.from(state.archivedSelectedIds || []);
          if(!ids.length) return;
          openArchivePrompt(ids, 'delete');
        });
      }
      jumpNextIncompleteBtns.forEach((btn)=>{
        btn.addEventListener('click', ()=>{
          jumpToNextIncomplete();
        });
      });
      if(saveRecordBtn){
        saveRecordBtn.addEventListener('click', ()=>{
          const returnToOverview = clampConfiguratorStep(state.activeStep) === reviewStepNumber();
          saveActiveRecord({ returnToOverview });
        });
      }
      const accountFullNameInput = $('#accountFullName');
      const accountEmailInput = $('#accountEmail');
      const accountPhoneInput = $('#accountPhone');
      const accountRoleSelect = $('#accountRole');
      const accountWorkspaceRoleSelect = $('#accountWorkspaceRole');
      const accountPermissionTestModeSelect = $('#accountPermissionTestMode');
      const accountPermissionSummary = $('#accountPermissionSummary');
      const accountCountrySelect = $('#accountCountry');
      const accountRegionSelect = $('#accountRegion');
      const accountFieldModeSelect = $('#accountFieldMode');
      const accountSdrModeToggleOptions = $$('#accountSdrModeToggle [data-sdr-toggle]');
      const accountLandingViewSelect = $('#accountLandingView');
      const accountDashboardDateModeSelect = $('#accountDashboardDateMode');
      const accountPrefillOptions = $$('#accountPrefillOptions [data-prefill]');
      const accountRoiEstimateOptions = $$('#accountRoiEstimateOptions [data-roi-estimate]');
      const accountNotificationOptions = $$('#accountNotificationOptions [data-account-notify]');
      const accountLhnButtons = $$('#accountLhn [data-account-nav-target]');
      const accountLhnMode = $('#accountLhnMode');
      const accountLhnPrefill = $('#accountLhnPrefill');
      const accountLhnNotifications = $('#accountLhnNotifications');
      const accountSaveChangesBtn = $('#accountSaveChanges');
      const accountSaveChangesLabel = $('#accountSaveChangesLabel');
      const accountSaveState = $('#accountSaveState');
      const accountApplyNowBtn = $('#accountApplyNow');
      const accountResetBtn = $('#accountReset');
      const accountLoadProfileAeBtn = $('#accountLoadProfileAe');
      const accountLoadProfileCsBtn = $('#accountLoadProfileCs');
      const accountUploadProfileCsvBtn = $('#accountUploadProfileCsv');
      const accountUploadProfileFileInput = $('#accountUploadProfileFile');
      const accountExportAllCsvBtn = $('#accountExportAllCsv');
      const backendConnectionToggleOptions = $$('#backendConnectionToggle [data-backend-connection]');
      const firebaseConfigJsonInput = $('#firebaseConfigJson');
      const firebaseSaveConfigBtn = $('#firebaseSaveConfigBtn');
      const firebaseClearConfigBtn = $('#firebaseClearConfigBtn');
      const firebaseSignInGoogleBtn = $('#firebaseSignInGoogleBtn');
      const firebaseSignOutBtn = $('#firebaseSignOutBtn');
      const firebaseHealthcheckBtn = $('#firebaseHealthcheckBtn');
      const crmExportScopeSelect = $('#crmExportScope');
      const crmExportRecordSelect = $('#crmExportRecord');
      const toneOptions = $$('#toneOptions [data-tone]');
      const densityOptions = $$('#densityOptions [data-density]');
      const fontScaleOptions = $$('#fontScaleOptions [data-font-scale]');
      const dummyOptions = $$('#dummyOptions [data-dummy]');
      const resetLayoutWidthsBtn = $('#resetLayoutWidths');
      const ACCOUNT_PROFILE_STORAGE_KEY = 'cfg_shell_account_profile_v1';

      accountLhnButtons.forEach((btn)=>{
        btn.addEventListener('click', ()=>{
          const targetId = String(btn.getAttribute('data-account-nav-target') || '').trim();
          if(!targetId) return;
          const target = document.getElementById(targetId);
          if(!target) return;
          setActiveAccountNavTarget(targetId);
          if(state.currentView !== 'account'){
            setView('account');
          }
          target.scrollIntoView({ behavior:'smooth', block:'start' });
        });
      });

      hydrateStaticSelectSchemas();

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
          workspaceRole: 'owner',
          permissionTestMode: 'live',
          defaultCountry: '',
          defaultRegion: '',
          fieldMode: 'guided',
          prefillMode: 'on',
          roiEstimateMode: 'on',
          landingView: 'dashboard',
          dashboardDateMode: 'modified',
          notifyRecordUpdates: true,
          notifyLockAvailability: true,
          notifyDailyDigest: false
        }
      };
      let accountChangesDirty = false;
      let accountLastSavedAt = 0;
      let accountSaveIsThinking = false;
      let accountSavePulseUntil = 0;

      function resolveFontScale(next){
        const allowed = [0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5];
        const n = Number(next);
        if(!Number.isFinite(n)) return 1;
        return allowed.reduce((best, val)=> Math.abs(val - n) < Math.abs(best - n) ? val : best, 1);
      }

      function resolveDummyMode(next){
        return String(next || '').toLowerCase() === 'on' ? 'on' : 'off';
      }

      function resolveAccountFieldMode(next){
        return resolveConfiguratorFieldMode(next);
      }

      function resolveAccountSdrToggleState(mode){
        return resolveAccountFieldMode(mode) === 'sdr-lite' ? 'on' : 'off';
      }

      function syncAccountSdrToggleUI(mode){
        const active = resolveAccountSdrToggleState(mode);
        accountSdrModeToggleOptions.forEach((btn)=>{
          btn.setAttribute('aria-pressed', btn.getAttribute('data-sdr-toggle') === active ? 'true' : 'false');
        });
      }

      function resolveAccountWorkspaceRole(next){
        return resolveCollaboratorRole(next, 'owner');
      }

      function resolveAccountPermissionTestMode(next){
        return resolvePermissionTestMode(next);
      }

      function syncPermissionTestModeOptionsUi(){
        if(!accountPermissionTestModeSelect) return;
        const allowTestOverrides = permissionTestOverridesEnabled() && !backendConnectionEnabled();
        Array.from(accountPermissionTestModeSelect.options || []).forEach((opt)=>{
          if(!(opt instanceof HTMLOptionElement)) return;
          const value = String(opt.value || '').trim().toLowerCase();
          const isForceMode = value.startsWith('force-');
          opt.hidden = isForceMode && !allowTestOverrides;
          opt.disabled = isForceMode && !allowTestOverrides;
        });
        if(!allowTestOverrides){
          const current = String(accountPermissionTestModeSelect.value || '').trim().toLowerCase();
          if(current.startsWith('force-')){
            accountPermissionTestModeSelect.value = 'live';
          }
        }
      }

      function resolveAccountPrefillMode(next){
        if(next === false) return 'off';
        if(next === true) return 'on';
        return String(next || '').toLowerCase() === 'off' ? 'off' : 'on';
      }

      function resolveAccountRoiEstimateMode(next){
        if(next === false) return 'off';
        if(next === true) return 'on';
        return String(next || '').toLowerCase() === 'off' ? 'off' : 'on';
      }

      function resolveAccountLandingView(next){
        const value = String(next || '').trim().toLowerCase();
        if(value === 'account') return 'account';
        return 'dashboard';
      }

      function resolveAccountNotifyFlag(next, fallback){
        if(next === false) return false;
        if(next === true) return true;
        const value = String(next || '').trim().toLowerCase();
        if(value === 'false' || value === 'off' || value === '0') return false;
        if(value === 'true' || value === 'on' || value === '1') return true;
        return !!fallback;
      }

      function formatShortTime(ts){
        const value = Number(ts || 0);
        if(!Number.isFinite(value) || value <= 0) return '';
        try{
          return new Date(value).toLocaleTimeString(undefined, { hour:'numeric', minute:'2-digit' });
        }catch(err){
          return '';
        }
      }

      function syncAccountSaveButtonUI(){
        if(!accountSaveChangesBtn) return;
        const justSaved = !accountSaveIsThinking && Date.now() < (accountSavePulseUntil || 0);
        accountSaveChangesBtn.disabled = accountSaveIsThinking || !accountChangesDirty;
        accountSaveChangesBtn.dataset.saved = justSaved ? 'true' : 'false';
        accountSaveChangesBtn.dataset.thinking = accountSaveIsThinking ? 'true' : 'false';
        accountSaveChangesBtn.setAttribute('aria-busy', accountSaveIsThinking ? 'true' : 'false');
        const label = accountSaveIsThinking
          ? 'Saving...'
          : (justSaved ? 'Saved' : 'Save changes');
        if(accountSaveChangesLabel){
          accountSaveChangesLabel.textContent = label;
        }else{
          accountSaveChangesBtn.textContent = label;
        }
      }

      function accountPermissionSummaryText(profile){
        const acc = normalizeAccountProfile(profile || settingsState.account || {});
        const workspaceRole = resolveAccountWorkspaceRole(acc.workspaceRole);
        const mode = resolveAccountPermissionTestMode(acc.permissionTestMode);
        const forcedRole = forcedRoleFromTestMode(mode);
        const effectiveRole = forcedRole || workspaceRole;
        const matrix = COLLAB_PERMISSION_MATRIX[effectiveRole] || COLLAB_PERMISSION_MATRIX.viewer;
        const addMode = (matrix.assignableRoles || ['viewer']).map((role)=> collaborationRoleLabel(role)).join(', ');
        const modeLabel = forcedRole
          ? `Testing as ${collaborationRoleLabel(forcedRole)}`
          : `Live role: ${collaborationRoleLabel(workspaceRole)}`;
        const scopeLabel = matrix.canSetGeneralAccess ? 'Can set record access levels.' : 'Cannot set record access levels.';
        return `${modeLabel}. Can add: ${addMode}. ${scopeLabel}`;
      }

      function readAccountPrefillModeFromUI(){
        const onBtn = accountPrefillOptions.find((btn)=> btn && btn.getAttribute('data-prefill') === 'on');
        if(onBtn){
          return onBtn.getAttribute('aria-pressed') === 'true' ? 'on' : 'off';
        }
        return resolveAccountPrefillMode(settingsState.account && settingsState.account.prefillMode);
      }

      function readAccountRoiEstimateModeFromUI(){
        const onBtn = accountRoiEstimateOptions.find((btn)=> btn && btn.getAttribute('data-roi-estimate') === 'on');
        if(onBtn){
          return onBtn.getAttribute('aria-pressed') === 'true' ? 'on' : 'off';
        }
        return resolveAccountRoiEstimateMode(settingsState.account && settingsState.account.roiEstimateMode);
      }

      function readAccountNotifyFlagFromUI(key, fallback){
        const btn = accountNotificationOptions.find((row)=> row && row.getAttribute('data-account-notify') === key);
        if(btn){
          return btn.getAttribute('aria-pressed') === 'true';
        }
        return resolveAccountNotifyFlag(fallback, fallback);
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
          workspaceRole: resolveAccountWorkspaceRole(src.workspaceRole),
          permissionTestMode: resolveAccountPermissionTestMode(src.permissionTestMode),
          defaultCountry: pickSelectValue(src.defaultCountry, '#operatingCountry'),
          defaultRegion: pickSelectValue(src.defaultRegion, '#region'),
          fieldMode: resolveAccountFieldMode(src.fieldMode),
          prefillMode: resolveAccountPrefillMode(src.prefillMode),
          roiEstimateMode: resolveAccountRoiEstimateMode(src.roiEstimateMode),
          landingView: resolveAccountLandingView(src.landingView),
          dashboardDateMode: sanitizeDashboardDateMode(src.dashboardDateMode),
          notifyRecordUpdates: resolveAccountNotifyFlag(src.notifyRecordUpdates, true),
          notifyLockAvailability: resolveAccountNotifyFlag(src.notifyLockAvailability, true),
          notifyDailyDigest: resolveAccountNotifyFlag(src.notifyDailyDigest, false)
        };
      }

      function accountProfilesEqual(left, right){
        const a = normalizeAccountProfile(left || {});
        const b = normalizeAccountProfile(right || {});
        return (
          a.fullName === b.fullName
          && a.email === b.email
          && a.phone === b.phone
          && a.defaultRole === b.defaultRole
          && a.workspaceRole === b.workspaceRole
          && a.permissionTestMode === b.permissionTestMode
          && a.defaultCountry === b.defaultCountry
          && a.defaultRegion === b.defaultRegion
          && a.fieldMode === b.fieldMode
          && a.prefillMode === b.prefillMode
          && a.roiEstimateMode === b.roiEstimateMode
          && a.landingView === b.landingView
          && a.dashboardDateMode === b.dashboardDateMode
          && a.notifyRecordUpdates === b.notifyRecordUpdates
          && a.notifyLockAvailability === b.notifyLockAvailability
          && a.notifyDailyDigest === b.notifyDailyDigest
        );
      }

      function setAccountDirtyState(isDirty, opts){
        const cfg = Object.assign({ saved:false }, opts || {});
        accountChangesDirty = !!isDirty;
        if(accountChangesDirty){
          accountSavePulseUntil = 0;
        }
        if(cfg.saved){
          accountLastSavedAt = Date.now();
          accountSavePulseUntil = Date.now() + 1600;
        }
        syncAccountSaveButtonUI();
        if(accountSaveState){
          if(accountSaveIsThinking){
            accountSaveState.dataset.state = 'saving';
            accountSaveState.textContent = 'Saving...';
          }else if(accountChangesDirty){
            accountSaveState.dataset.state = 'dirty';
            accountSaveState.textContent = 'Unsaved changes';
          }else{
            accountSaveState.dataset.state = 'saved';
            const savedLabel = formatShortTime(accountLastSavedAt);
            accountSaveState.textContent = savedLabel ? `Saved ${savedLabel}` : 'Saved';
          }
        }
      }

      function readAccountProfileFromSettingsUI(){
        const existing = settingsState.account || {};
        return normalizeAccountProfile({
          fullName: accountFullNameInput ? accountFullNameInput.value : '',
          email: accountEmailInput ? accountEmailInput.value : '',
          phone: accountPhoneInput ? accountPhoneInput.value : '',
          defaultRole: accountRoleSelect ? accountRoleSelect.value : '',
          workspaceRole: accountWorkspaceRoleSelect ? accountWorkspaceRoleSelect.value : existing.workspaceRole,
          permissionTestMode: accountPermissionTestModeSelect ? accountPermissionTestModeSelect.value : existing.permissionTestMode,
          defaultCountry: accountCountrySelect ? accountCountrySelect.value : '',
          defaultRegion: accountRegionSelect ? accountRegionSelect.value : '',
          fieldMode: accountFieldModeSelect ? accountFieldModeSelect.value : '',
          prefillMode: readAccountPrefillModeFromUI(),
          roiEstimateMode: readAccountRoiEstimateModeFromUI(),
          landingView: accountLandingViewSelect ? accountLandingViewSelect.value : existing.landingView,
          dashboardDateMode: accountDashboardDateModeSelect ? accountDashboardDateModeSelect.value : existing.dashboardDateMode,
          notifyRecordUpdates: readAccountNotifyFlagFromUI('recordUpdates', existing.notifyRecordUpdates),
          notifyLockAvailability: readAccountNotifyFlagFromUI('lockAvailability', existing.notifyLockAvailability),
          notifyDailyDigest: readAccountNotifyFlagFromUI('dailyDigest', existing.notifyDailyDigest)
        });
      }

      function updateAccountLeftNavSummary(profile){
        const acc = normalizeAccountProfile(profile || settingsState.account || {});
        if(accountLhnMode){
          const mode = resolveAccountFieldMode(acc.fieldMode);
          const modeLabel = mode === 'advanced' ? 'Advanced' : (mode === 'sdr-lite' ? 'SDR' : 'Guided');
          accountLhnMode.textContent = `Mode: ${modeLabel}`;
        }
        if(accountLhnPrefill){
          accountLhnPrefill.textContent = `Prefill: ${resolveAccountPrefillMode(acc.prefillMode) === 'off' ? 'Off' : 'On'}`;
        }
        if(accountLhnNotifications){
          const enabled = [
            resolveAccountNotifyFlag(acc.notifyRecordUpdates, true),
            resolveAccountNotifyFlag(acc.notifyLockAvailability, true),
            resolveAccountNotifyFlag(acc.notifyDailyDigest, false)
          ].filter(Boolean).length;
          accountLhnNotifications.textContent = `Alerts: ${enabled} enabled`;
        }
      }

      function markAccountChangesDirty(){
        const draft = readAccountProfileFromSettingsUI();
        const dirty = !accountProfilesEqual(draft, settingsState.account || {});
        setAccountDirtyState(dirty, { saved:false });
        updateAccountLeftNavSummary(draft);
        if(accountPermissionSummary){
          accountPermissionSummary.textContent = accountPermissionSummaryText(draft);
        }
        syncAccountSdrToggleUI(draft.fieldMode);
        document.documentElement.setAttribute('data-config-profile-depth', resolveAccountFieldMode(draft.fieldMode));
      }

      function setActiveAccountNavTarget(targetId){
        const next = String(targetId || 'accountProfileDefaults').trim() || 'accountProfileDefaults';
        accountLhnButtons.forEach((btn)=>{
          const btnTarget = String(btn.getAttribute('data-account-nav-target') || '').trim();
          btn.dataset.active = btnTarget === next ? 'true' : 'false';
        });
      }

      function applyAccountPreferencesToWorkspace(){
        const acc = settingsState.account || {};
        const preferredDateMode = sanitizeDashboardDateMode(acc.dashboardDateMode);
        if(preferredDateMode !== sanitizeDashboardDateMode(state.dashboardDateMode)){
          state.dashboardDateMode = preferredDateMode;
          persistDashboardDateMode();
        }
      }

      function syncAccountSettingsUI(){
        const acc = settingsState.account || {};
        syncPermissionTestModeOptionsUi();
        if(accountFullNameInput) accountFullNameInput.value = acc.fullName || '';
        if(accountEmailInput) accountEmailInput.value = acc.email || '';
        if(accountPhoneInput) accountPhoneInput.value = acc.phone || '';
        if(accountRoleSelect) accountRoleSelect.value = acc.defaultRole || '';
        if(accountWorkspaceRoleSelect) accountWorkspaceRoleSelect.value = resolveAccountWorkspaceRole(acc.workspaceRole);
        if(accountPermissionTestModeSelect) accountPermissionTestModeSelect.value = resolveAccountPermissionTestMode(acc.permissionTestMode);
        if(accountPermissionSummary) accountPermissionSummary.textContent = accountPermissionSummaryText(acc);
        if(accountCountrySelect) accountCountrySelect.value = acc.defaultCountry || '';
        if(accountRegionSelect) accountRegionSelect.value = acc.defaultRegion || '';
        if(accountFieldModeSelect) accountFieldModeSelect.value = resolveAccountFieldMode(acc.fieldMode);
        syncAccountSdrToggleUI(acc.fieldMode);
        if(accountLandingViewSelect) accountLandingViewSelect.value = resolveAccountLandingView(acc.landingView);
        if(accountDashboardDateModeSelect) accountDashboardDateModeSelect.value = sanitizeDashboardDateMode(acc.dashboardDateMode);
        const prefill = resolveAccountPrefillMode(acc.prefillMode);
        accountPrefillOptions.forEach((btn)=>{
          btn.setAttribute('aria-pressed', btn.getAttribute('data-prefill') === prefill ? 'true' : 'false');
        });
        const roiMode = resolveAccountRoiEstimateMode(acc.roiEstimateMode);
        accountRoiEstimateOptions.forEach((btn)=>{
          btn.setAttribute('aria-pressed', btn.getAttribute('data-roi-estimate') === roiMode ? 'true' : 'false');
        });
        accountNotificationOptions.forEach((btn)=>{
          const key = btn.getAttribute('data-account-notify') || '';
          let enabled = false;
          if(key === 'recordUpdates'){
            enabled = resolveAccountNotifyFlag(acc.notifyRecordUpdates, true);
          }else if(key === 'lockAvailability'){
            enabled = resolveAccountNotifyFlag(acc.notifyLockAvailability, true);
          }else if(key === 'dailyDigest'){
            enabled = resolveAccountNotifyFlag(acc.notifyDailyDigest, false);
          }
          btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
        });
        document.documentElement.setAttribute('data-config-profile-depth', resolveAccountFieldMode(acc.fieldMode));
        updateAccountLeftNavSummary();
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
        const shouldPersist = persist !== false;
        if(shouldPersist) persistAccountProfile();
        syncAccountSettingsUI();
        applyAccountPreferencesToWorkspace();
        setAccountDirtyState(false, { saved: shouldPersist });
      }

      function commitAccountChanges(opts){
        const cfg = Object.assign({ toastMessage:'Account changes saved.' }, opts || {});
        const nextProfile = readAccountProfileFromSettingsUI();
        applyAccountProfile(nextProfile, true);
        update();
        if(cfg.toastMessage){
          toast(cfg.toastMessage);
        }
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
        const mode = resolveAccountFieldMode(acc.fieldMode);
        const applyText = (key, val)=>{
          const next = String(val || '').trim();
          if(!next) return;
          const cur = String(state[key] || '').trim();
          if(cfg.emptyOnly && cur) return;
          state[key] = next;
        };
        if(!cfg.emptyOnly || String(state.activeThread || 'current').trim() === 'current'){
          state.fieldMode = mode;
        }
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

      let shellResizeTimer = null;
      window.addEventListener('resize', ()=>{
        window.clearTimeout(shellResizeTimer);
        shellResizeTimer = window.setTimeout(()=>{
          update();
          syncCustomerPreviewStoryLayout();
        }, 80);
      });
      document.addEventListener('keydown', (e)=>{
        if(e.key !== 'Escape') return;
        if(state.consultationOpen){
          toggleConsultation(false);
        }
        if(state.emailBuilderOpen){
          toggleEmailBuilder(false);
        }
        if(state.customerTemplateEditorOpen){
          toggleCustomerTemplateEditor(false);
        }
        if($('#shareModal')?.classList.contains('show')) closeShareModal();
        if($('#archiveModal')?.classList.contains('show')) closeArchivePrompt();
        if($('#modal')?.classList.contains('show')) $('#modal').classList.remove('show');
      });
      const persistAccountFromInputs = ()=>{
        markAccountChangesDirty();
      };
      [accountFullNameInput, accountEmailInput, accountPhoneInput].forEach((el)=>{
        if(!el) return;
        el.addEventListener('input', persistAccountFromInputs);
      });
      [accountRoleSelect, accountWorkspaceRoleSelect, accountPermissionTestModeSelect, accountCountrySelect, accountRegionSelect, accountFieldModeSelect, accountLandingViewSelect, accountDashboardDateModeSelect].forEach((el)=>{
        if(!el) return;
        el.addEventListener('change', persistAccountFromInputs);
      });
      accountPrefillOptions.forEach((btn)=>{
        btn.addEventListener('click', ()=>{
          const next = resolveAccountPrefillMode(btn.getAttribute('data-prefill') || 'on');
          accountPrefillOptions.forEach((row)=>{
            row.setAttribute('aria-pressed', row.getAttribute('data-prefill') === next ? 'true' : 'false');
          });
          markAccountChangesDirty();
        });
      });
      accountRoiEstimateOptions.forEach((btn)=>{
        btn.addEventListener('click', ()=>{
          const next = resolveAccountRoiEstimateMode(btn.getAttribute('data-roi-estimate') || 'on');
          accountRoiEstimateOptions.forEach((row)=>{
            row.setAttribute('aria-pressed', row.getAttribute('data-roi-estimate') === next ? 'true' : 'false');
          });
          markAccountChangesDirty();
        });
      });
      accountSdrModeToggleOptions.forEach((btn)=>{
        btn.addEventListener('click', ()=>{
          const next = btn.getAttribute('data-sdr-toggle') === 'on' ? 'on' : 'off';
          if(accountFieldModeSelect){
            const current = resolveAccountFieldMode(accountFieldModeSelect.value);
            if(next === 'on'){
              accountFieldModeSelect.value = 'sdr-lite';
            }else if(current === 'sdr-lite'){
              accountFieldModeSelect.value = 'guided';
            }
          }
          markAccountChangesDirty();
        });
      });
      accountNotificationOptions.forEach((btn)=>{
        btn.addEventListener('click', ()=>{
          btn.setAttribute('aria-pressed', btn.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
          markAccountChangesDirty();
        });
      });
      if(accountSaveChangesBtn){
        accountSaveChangesBtn.addEventListener('click', ()=>{
          if(accountSaveIsThinking || !accountChangesDirty){
            return;
          }
          accountSaveIsThinking = true;
          accountSavePulseUntil = 0;
          syncAccountSaveButtonUI();
          if(accountSaveState){
            accountSaveState.dataset.state = 'saving';
            accountSaveState.textContent = 'Saving...';
          }
          window.setTimeout(()=>{
            accountSaveIsThinking = false;
            commitAccountChanges();
            syncAccountSaveButtonUI();
            window.setTimeout(()=>{
              if(Date.now() >= (accountSavePulseUntil || 0)){
                syncAccountSaveButtonUI();
              }
            }, 1700);
          }, 560);
        });
      }
      if(accountApplyNowBtn){
        accountApplyNowBtn.addEventListener('click', ()=>{
          const nextProfile = readAccountProfileFromSettingsUI();
          applyAccountProfile(nextProfile, true);
          applyAccountDefaultsToState({ emptyOnly:false });
          syncFormControlsFromState();
          update();
          toast('Saved and applied account defaults to this record.');
        });
      }
      if(accountResetBtn){
        accountResetBtn.addEventListener('click', ()=>{
          applyAccountProfile({
            fullName: '',
            email: '',
            phone: '',
            defaultRole: '',
            workspaceRole: 'owner',
            permissionTestMode: 'live',
            defaultCountry: '',
            defaultRegion: '',
            fieldMode: 'guided',
            prefillMode: 'on',
            roiEstimateMode: 'on',
            landingView: 'dashboard',
            dashboardDateMode: 'modified',
            notifyRecordUpdates: true,
            notifyLockAvailability: true,
            notifyDailyDigest: false
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
      if(backendConnectionToggleOptions.length){
        backendConnectionToggleOptions.forEach((btn)=>{
          btn.addEventListener('click', ()=>{
            const nextMode = resolveBackendConnectionMode(btn.getAttribute('data-backend-connection') || 'off');
            const currentMode = resolveBackendConnectionMode(firebaseRuntime.connectionMode || readBackendConnectionModeFromStorage());
            if(nextMode === currentMode){
              renderFirebaseConnectionUi();
              return;
            }
            saveBackendConnectionModeToStorage(nextMode);
            firebaseRuntime.connectionMode = nextMode;
            initFirebaseRuntime();
            if(nextMode === 'on'){
              toast('Backend connection enabled for this browser.');
            }else{
              toast('Backend connection disabled. App remains local-only.');
            }
          });
        });
      }
      if(firebaseSaveConfigBtn && firebaseConfigJsonInput){
        firebaseSaveConfigBtn.addEventListener('click', ()=>{
          const parsed = parseFirebaseWebConfigText(firebaseConfigJsonInput.value || '');
          if(!parsed){
            toast('Firebase config is invalid. Paste JSON or firebaseConfig object.');
            return;
          }
          if(!saveFirebaseWebConfigToStorage(parsed)){
            toast('Could not save Firebase config in browser storage.');
            return;
          }
          initFirebaseRuntime();
          toast('Firebase config saved.');
        });
      }
      if(firebaseClearConfigBtn && firebaseConfigJsonInput){
        firebaseClearConfigBtn.addEventListener('click', ()=>{
          clearFirebaseWebConfigFromStorage();
          firebaseConfigJsonInput.value = '';
          initFirebaseRuntime();
          toast('Cleared Firebase config.');
        });
      }
      if(firebaseSignInGoogleBtn){
        firebaseSignInGoogleBtn.addEventListener('click', ()=>{
          signInWithGoogleFirebase();
        });
      }
      if(firebaseSignOutBtn){
        firebaseSignOutBtn.addEventListener('click', ()=>{
          signOutFirebaseUser();
        });
      }
      if(firebaseHealthcheckBtn){
        firebaseHealthcheckBtn.addEventListener('click', ()=>{
          runFirestoreHealthcheck();
        });
      }
      if(crmExportScopeSelect){
        crmExportScopeSelect.addEventListener('change', ()=>{
          state.crmExportScope = normalizeCrmExportScope(crmExportScopeSelect.value);
          renderCrmExportView();
        });
      }
      if(crmExportRecordSelect){
        crmExportRecordSelect.addEventListener('change', ()=>{
          state.crmExportRecordId = String(crmExportRecordSelect.value || '').trim() || 'current';
          renderCrmExportView();
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

        renderConfiguratorProgressRail();
        $$('.step').forEach((s)=> s.dataset.active = (s.dataset.step === String(state.activeStep)) ? 'true' : 'false');
        $$('.chip').forEach((c)=> c.dataset.active = (c.dataset.chip === String(state.activeStep)) ? 'true' : 'false');

        syncCurrencyUI();
      }

      function createNewRecord(){
        const currentRecordId = currentEditableRecordId();
        if(currentRecordId){
          releaseRecordLock(currentRecordId, { force:false });
          clearRecordLockHeartbeat();
        }
        const account = settingsState.account || {};
        const useAccountDefaults = resolveAccountPrefillMode(account.prefillMode) !== 'off';
        state.activeThread = 'current';
        state.savePulseUntil = 0;
        state.saveIsThinking = false;
        state.collaborationNoticeTitle = '';
        state.collaborationNoticeBody = '';
        state.collaborationNoticeTone = 'info';
        state.collaborationNoticeRecordId = '';
        state.collaborationNoticeUntil = 0;
        state.recordReadOnly = false;
        state.lockReacquirePending = false;
        clearScheduledAutoSave();

        // Identity + context
        state.fieldMode = resolveConfiguratorFieldMode(account.fieldMode || 'guided');
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
        setActiveStep(1);
        toast('New record started.');
      }

      function applyDummyAccountProfile(opts){
        const cfg = opts || {};
        const keepStep = clampConfiguratorStep(Number(state.activeStep) || 1);

        // Identity + context
        state.fieldMode = 'guided';
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
        state.visited = new Set(allConfiguratorStepNumbers());
        state.activeStep = cfg.preserveActiveStep === false ? reviewStepNumber() : keepStep;

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
        if(state.lockReacquirePending && !state.recordReadOnly){
          attemptPendingRecordLock({ showNotice:true, render:true });
        }
        const action = btn.dataset.action;

        if(action === 'next'){
          setActiveStep(state.activeStep + 1);
          requestAutoSave(AUTO_SAVE_FAST_MS);
        }
        if(action === 'save'){
          const returnToOverview = clampConfiguratorStep(state.activeStep) === reviewStepNumber();
          saveActiveRecord({ returnToOverview });
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
        if(action === 'openRecommendations'){
          const targetThread = (state.currentView === 'interstitial')
            ? activeThreadModel()
            : ((state.activeThread && state.activeThread !== 'current')
                ? (findSavedThread(state.activeThread) || currentThreadModel())
                : currentThreadModel());
          openRecommendationsForThread(
            (targetThread && targetThread.id) ? targetThread.id : 'current',
            { returnView: state.currentView === 'interstitial' ? 'interstitial' : 'configurator' }
          );
        }
        if(action === 'openCrmExport'){
          const preferredThreadId = (state.currentView === 'recommendations')
            ? (state.recommendationsThreadId || state.activeThread || 'current')
            : (state.activeThread || 'current');
          openCrmExportView(preferredThreadId);
        }
        if(action === 'downloadHubspotCsv'){
          downloadHubspotCrmCsv();
        }
        if(action === 'downloadSalesforceCsv'){
          downloadSalesforceCrmCsv();
        }
        if(action === 'backToDashboard'){
          setView('dashboard');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        if(action === 'openRecommendationEmail'){
          const targetThread = (state.currentView === 'recommendations')
            ? resolveRecommendationThread(state.recommendationsThreadId || state.activeThread || 'current')
            : ((state.currentView === 'interstitial')
                ? activeThreadModel()
                : currentThreadModel());
          openRecommendationEmailBuilder((targetThread && targetThread.id) ? targetThread.id : 'current');
        }
        if(action === 'generateCustomerPageTemplate'){
          const preferredThreadId = (state.currentView === 'recommendations')
            ? (state.recommendationsThreadId || state.activeThread || 'current')
            : (state.activeThread || 'current');
          downloadCustomerPageTemplate(preferredThreadId);
        }
        if(action === 'previewCustomerPageTemplate'){
          const preferredThreadId = (state.currentView === 'recommendations')
            ? (state.recommendationsThreadId || state.activeThread || 'current')
            : (state.activeThread || 'current');
          openCustomerTemplatePreview(preferredThreadId);
        }
        if(action === 'clearCustomerPagePreview'){
          clearCustomerTemplatePreview();
        }
        if(action === 'editCustomerTemplateHero'){
          openCustomerTemplateHeroEditor();
        }
        if(action === 'editCustomerTemplateCard'){
          openCustomerTemplateCardEditor(btn.getAttribute('data-card-index'));
        }
        if(action === 'cancelCustomerTemplateEditor'){
          toggleCustomerTemplateEditor(false);
        }
        if(action === 'saveCustomerTemplateEditor'){
          const saved = applyCustomerTemplateEditorChanges();
          if(saved){
            toggleCustomerTemplateEditor(false);
            if(state.currentView === 'recommendations'){
              renderContentRecommendationsView(recommendationsGateFromThread(resolveRecommendationThread(state.recommendationsThreadId || 'current')));
            }else{
              renderCustomerTemplatePreview();
            }
            toast('Saved preview changes.');
          }
        }
        if(action === 'backToReview'){
          if(state.recommendationsReturnView === 'interstitial'){
            openThreadOverview(state.recommendationsThreadId || state.activeThread || 'current');
          }else{
            setActiveStep(reviewStepNumber());
          }
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
        if(action === 'copyRecommendationEmail'){
          const model = recommendationEmailModelForThread(state.emailBuilderThreadId || state.recommendationsThreadId || state.activeThread || 'current');
          copyToClipboard(model.fullText, 'Copied recommendation email.');
        }
        if(action === 'copyRecommendationSubject'){
          const model = recommendationEmailModelForThread(state.emailBuilderThreadId || state.recommendationsThreadId || state.activeThread || 'current');
          copyToClipboard(model.subject, 'Copied email subject.');
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
        if(action === 'openShareRecord'){
          const focusInvite = (
            String(btn.getAttribute('data-collab-add-trigger') || '').trim().toLowerCase() === 'true'
            || String(btn.getAttribute('data-share-focus') || '').trim().toLowerCase() === 'invite'
          );
          openShareModal(btn.getAttribute('data-record-id'), { focusInvite });
        }
        if(action === 'closeShareModal'){
          closeShareModal();
        }
      });

      // Close modal on backdrop click
      $('#modal').addEventListener('click', (e)=>{
        if(e.target.id === 'modal') $('#modal').classList.remove('show');
      });
      $('#archiveModal')?.addEventListener('click', (e)=>{
        if(e.target.id === 'archiveModal') closeArchivePrompt();
      });
      $('#shareModal')?.addEventListener('click', (e)=>{
        if(e.target.id === 'shareModal') closeShareModal();
      });
      $('#shareAddCollaboratorBtn')?.addEventListener('click', ()=>{
        addShareCollaboratorsFromInput();
      });
      $('#shareSaveBtn')?.addEventListener('click', ()=>{
        saveShareSettings();
      });
      $('#shareRequestAccessBtn')?.addEventListener('click', ()=>{
        requestShareAccess();
      });
      $('#shareCopyLinkBtn')?.addEventListener('click', ()=>{
        const recordId = shareRecordIdFromContext(shareModalRecordId || state.activeThread || '');
        const url = shareRecordUrl(recordId);
        if(!url){
          toast('Save the record first, then copy the link.');
          return;
        }
        copyToClipboard(url, 'Share link copied.');
      });
      $('#shareInviteInput')?.addEventListener('keydown', (e)=>{
        if(e.key !== 'Enter' || e.shiftKey) return;
        e.preventDefault();
        addShareCollaboratorsFromInput();
      });
      $('#shareCollaboratorList')?.addEventListener('click', (e)=>{
        const target = (e.target instanceof Element) ? e.target : null;
        const removeBtn = target ? target.closest('[data-share-remove]') : null;
        if(!removeBtn) return;
        removeShareCollaborator(removeBtn.getAttribute('data-share-remove'));
      });
      $('#shareCollaboratorList')?.addEventListener('change', (e)=>{
        const target = (e.target instanceof Element) ? e.target : null;
        const roleSelect = target ? target.closest('[data-share-role]') : null;
        if(!roleSelect) return;
        updateShareCollaboratorRole(
          roleSelect.getAttribute('data-share-role'),
          roleSelect.value
        );
      });

      const configuratorEditor = $('#configuratorEditor');
      if(configuratorEditor){
        const maybeReacquireLock = ()=>{
          if(!state.lockReacquirePending || state.recordReadOnly) return;
          attemptPendingRecordLock({ showNotice:true, render:true });
        };
        configuratorEditor.addEventListener('pointerdown', maybeReacquireLock, true);
        configuratorEditor.addEventListener('input', maybeReacquireLock, true);
        configuratorEditor.addEventListener('change', maybeReacquireLock, true);
      }

      const releaseLockOnPageExit = ()=>{
        const currentRecordId = currentEditableRecordId();
        if(currentRecordId){
          releaseRecordLock(currentRecordId, { force:false });
        }
        clearRecordLockHeartbeat();
      };
      window.addEventListener('beforeunload', releaseLockOnPageExit);
      window.addEventListener('pagehide', releaseLockOnPageExit);

      window.addEventListener('storage', (e)=>{
        if(!e || e.key !== THREAD_STORAGE_KEY) return;
        refreshSavedThreadsFromStore({ external:true, render:true });
      });

      // Boot: align suggested sizing
      hydrateRssCatalogRows().catch(()=>{});
      applySuggested();
      syncFormControlsFromState();
      initFirebaseRuntime();
      renderFirebaseConnectionUi();

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

      ensureRouteSyncListeners();
      const routeApplied = applyRouteFromLocation();
      if(!routeApplied){
        const preferredLanding = resolveAccountLandingView((settingsState.account && settingsState.account.landingView) || 'dashboard');
        if(preferredLanding === 'account'){
          setView('account', { render:false, syncRoute:false });
        }else{
          setView('dashboard', { render:false, syncRoute:false });
        }
        syncRouteWithState({ replace:true });
      }
      if(document.body && document.body.classList.contains('is-booting')){
        const revealUi = ()=> document.body.classList.remove('is-booting');
        if(window && typeof window.requestAnimationFrame === 'function'){
          window.requestAnimationFrame(revealUi);
        }else{
          window.setTimeout(revealUi, 0);
        }
      }
    })();
  
