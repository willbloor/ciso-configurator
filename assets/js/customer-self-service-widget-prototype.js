    (function(){
      const STORAGE_KEY = 'immersive.customer.widget.draft.v1';
      const LAUNCHPAD_THREAD_KEY = 'immersive.launchpad.savedThreads.v1';
      const LAUNCHPAD_WORKSPACE_ID = 'workspace-local';
      const LAUNCHPAD_SCHEMA_VERSION = 'workspace-record.v2';
      const state = {
        recordId: `rec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        status: 'draft_customer',
        recommendationSeen: false,
        generatedRecommendation: null,
        followupSelectedKeys: [],
        followupModeKeys: []
      };

      const requiredStageAKeys = [
        'role',
        'fullName',
        'company',
        'operatingCountry',
        'pressureSources',
        'urgentWin',
        'groups',
        'fitScope'
      ];

      const labelMaps = {
        role: {
          ciso: 'CISO',
          secMgr: 'Security manager',
          practitioner: 'Security practitioner',
          executive: 'Executive sponsor',
          other: 'Other'
        },
        urgentWin: {
          boardEvidence: 'Board-ready evidence',
          fasterDecisions: 'Faster response decisions',
          attackSurface: 'Shrink attack surface',
          workforce: 'Workforce readiness'
        },
        fitScope: {
          single: 'Single team',
          multi: 'Multi-team',
          enterprise: 'Enterprise'
        },
        pressureSources: {
          board: 'Board',
          regulator: 'Regulator',
          insurer: 'Insurer',
          customers: 'Customers',
          internal: 'Internal only'
        },
        groups: {
          soc: 'SOC / IR',
          secops: 'Security operations',
          dev: 'Engineering / DevSecOps',
          leaders: 'Security leadership',
          it: 'IT / platform'
        },
        riskEnvs: {
          code: 'Code / app',
          cloud: 'Cloud',
          identity: 'Identity',
          socir: 'SOC / IR'
        }
      };

      const followupCatalog = [
        { key:'role', label:'Which best describes your role?', stage:'Stage A', kind:'select', sourceId:'role' },
        { key:'fullName', label:'Your name', stage:'Stage A', kind:'text', sourceId:'fullName' },
        { key:'company', label:'Company', stage:'Stage A', kind:'text', sourceId:'company' },
        { key:'operatingCountry', label:'Operating country', stage:'Stage A', kind:'select', sourceId:'operatingCountry' },
        { key:'pressureSources', label:'Where is pressure coming from? (pick up to 3)', stage:'Stage A', kind:'checkbox', sourceName:'pressureSources', max:3 },
        { key:'urgentWin', label:'Most urgent 90-day win', stage:'Stage A', kind:'radio', sourceName:'urgentWin' },
        { key:'groups', label:'Teams in scope', stage:'Stage A', kind:'checkbox', sourceName:'groups' },
        { key:'fitScope', label:'Scope requirement', stage:'Stage A', kind:'radio', sourceName:'fitScope' },
        { key:'companySize', label:'Company size', stage:'Stage B', kind:'select', sourceId:'companySize' },
        { key:'rhythm', label:'Cadence today', stage:'Stage B', kind:'select', sourceId:'rhythm' },
        { key:'riskEnvs', label:'Risk environments (pick up to 2)', stage:'Stage B', kind:'checkbox', sourceName:'riskEnvs', max:2 },
        { key:'measuredOn', label:'Measured on today', stage:'Stage B', kind:'select', sourceId:'measuredOn' },
        { key:'orgPain', label:'Biggest pain point', stage:'Stage B', kind:'select', sourceId:'orgPain' },
        { key:'fitRealism', label:'Realism requirement', stage:'Stage C', kind:'select', sourceId:'fitRealism' },
        { key:'fitToday', label:'Current state', stage:'Stage C', kind:'select', sourceId:'fitToday' },
        { key:'fitServices', label:'Delivery support', stage:'Stage C', kind:'select', sourceId:'fitServices' },
        { key:'fitRiskFrame', label:'Risk framing', stage:'Stage C', kind:'select', sourceId:'fitRiskFrame' },
        { key:'industry', label:'Industry', stage:'Stage C', kind:'text', sourceId:'industry' },
        { key:'region', label:'Region / footprint', stage:'Stage C', kind:'select', sourceId:'region' },
        { key:'regs', label:'Regulatory references', stage:'Stage C', kind:'text', sourceId:'regs' },
        { key:'email', label:'Business email', stage:'Stage D', kind:'email', sourceId:'email' },
        { key:'phone', label:'Phone', stage:'Stage D', kind:'tel', sourceId:'phone' }
      ];

      const followupCatalogMap = followupCatalog.reduce((acc, item)=> {
        acc[item.key] = item;
        return acc;
      }, {});

      const el = {
        aeReadyText: document.getElementById('aeReadyText'),
        intentScoreText: document.getElementById('intentScoreText'),
        intentBandText: document.getElementById('intentBandText'),
        aeProgressBar: document.getElementById('aeProgressBar'),
        statusMessage: document.getElementById('statusMessage'),
        recordPreview: document.getElementById('recordPreview'),
        pressureCount: document.getElementById('pressureCount'),
        pillRow: document.getElementById('pillRow'),
        recPanel: document.getElementById('initialRecommendationPanel'),
        recConfidenceTag: document.getElementById('recConfidenceTag'),
        recTierName: document.getElementById('recTierName'),
        recSummary: document.getElementById('recSummary'),
        recReasons: document.getElementById('recReasons'),
        recNextSteps: document.getElementById('recNextSteps'),
        customerFollowupPanel: document.getElementById('customerFollowupPanel'),
        customerFollowupCount: document.getElementById('customerFollowupCount'),
        customerFollowupIntro: document.getElementById('customerFollowupIntro'),
        customerFollowupForm: document.getElementById('customerFollowupForm'),
        selContact: document.getElementById('selContact'),
        selRole: document.getElementById('selRole'),
        selCountry: document.getElementById('selCountry'),
        selUrgentWin: document.getElementById('selUrgentWin'),
        selCompany: document.getElementById('selCompany'),
        selScope: document.getElementById('selScope'),
        selIntentBand: document.getElementById('selIntentBand'),
        selAeReady: document.getElementById('selAeReady'),
        selPressurePills: document.getElementById('selPressurePills'),
        selGroupPills: document.getElementById('selGroupPills'),
        selRiskPills: document.getElementById('selRiskPills'),
        selRegs: document.getElementById('selRegs'),
        followupGapTag: document.getElementById('followupGapTag'),
        followupMissingChecklist: document.getElementById('followupMissingChecklist'),
        followupOutput: document.getElementById('followupOutput'),
        followupSubject: document.getElementById('followupSubject'),
        followupBody: document.getElementById('followupBody'),
        followupLink: document.getElementById('followupLink'),
        followupMailto: document.getElementById('followupMailto')
      };

      const dom = {
        role: document.getElementById('role'),
        fullName: document.getElementById('fullName'),
        company: document.getElementById('company'),
        operatingCountry: document.getElementById('operatingCountry'),
        companySize: document.getElementById('companySize'),
        rhythm: document.getElementById('rhythm'),
        measuredOn: document.getElementById('measuredOn'),
        orgPain: document.getElementById('orgPain'),
        fitRealism: document.getElementById('fitRealism'),
        fitToday: document.getElementById('fitToday'),
        fitServices: document.getElementById('fitServices'),
        fitRiskFrame: document.getElementById('fitRiskFrame'),
        fitScopeFieldset: document.getElementById('fitScopeFieldset'),
        groupsFieldset: document.getElementById('groupsFieldset'),
        pressureSourcesFieldset: document.getElementById('pressureSourcesFieldset'),
        urgentWinFieldset: document.getElementById('urgentWinFieldset'),
        industry: document.getElementById('industry'),
        region: document.getElementById('region'),
        regs: document.getElementById('regs'),
        email: document.getElementById('email'),
        phone: document.getElementById('phone'),
        notes: document.getElementById('notes'),
        optin: document.getElementById('optin')
      };

      const controls = {
        btnRecommend: document.getElementById('btnRecommend'),
        btnSaveDraft: document.getElementById('btnSaveDraft'),
        btnLoadDraft: document.getElementById('btnLoadDraft'),
        btnClear: document.getElementById('btnClear'),
        btnSubmit: document.getElementById('btnSubmit'),
        btnCopyJson: document.getElementById('btnCopyJson'),
        btnDownloadJson: document.getElementById('btnDownloadJson'),
        btnOpenDashboard: document.getElementById('btnOpenDashboard'),
        btnFollowupSelectAll: document.getElementById('btnFollowupSelectAll'),
        btnFollowupClear: document.getElementById('btnFollowupClear'),
        btnGenerateFollowup: document.getElementById('btnGenerateFollowup'),
        btnCopyFollowupEmail: document.getElementById('btnCopyFollowupEmail'),
        btnApplyFollowupAnswers: document.getElementById('btnApplyFollowupAnswers')
      };

      function getCheckedValues(name){
        return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map((item)=> item.value);
      }

      function getRadioValue(name){
        const checked = document.querySelector(`input[name="${name}"]:checked`);
        return checked ? checked.value : '';
      }

      function setRadioValue(name, value){
        Array.from(document.querySelectorAll(`input[name="${name}"]`)).forEach((item)=> {
          item.checked = item.value === value;
        });
      }

      function setCheckedValues(name, values){
        const list = Array.isArray(values) ? values : [];
        const set = new Set(list.map((v)=> String(v)));
        Array.from(document.querySelectorAll(`input[name="${name}"]`)).forEach((item)=> {
          item.checked = set.has(item.value);
        });
      }

      function groupOptionLabel(name, value){
        const node = document.querySelector(`input[name="${name}"][value="${CSS.escape(value)}"]`);
        if(!node) return optionLabel(name, value);
        const textNode = node.closest('.choice') && node.closest('.choice').querySelector('.choice-row span:last-child');
        return textNode ? String(textNode.textContent || '').trim() : optionLabel(name, value);
      }

      function groupOptions(name){
        return Array.from(document.querySelectorAll(`input[name="${name}"]`)).map((node)=> ({
          value: node.value,
          label: groupOptionLabel(name, node.value)
        }));
      }

      function enforceMaxChecks(name, max, target){
        const all = Array.from(document.querySelectorAll(`input[name="${name}"]`));
        const selected = all.filter((item)=> item.checked);
        if(selected.length <= max) return;
        target.checked = false;
        showMessage(`You can select up to ${max} options here.`, 'error');
      }

      function showMessage(text, tone){
        el.statusMessage.textContent = text;
        el.statusMessage.className = `alert${tone ? ` ${tone}` : ''}`;
      }

      function clearFieldHighlights(){
        [
          dom.role,
          dom.fullName,
          dom.company,
          dom.operatingCountry,
          dom.pressureSourcesFieldset,
          dom.urgentWinFieldset,
          dom.groupsFieldset,
          dom.fitScopeFieldset,
          dom.email
        ].forEach((node)=> node && node.classList.remove('missing'));
      }

      function snapshot(){
        const pressureSources = getCheckedValues('pressureSources');
        const groups = getCheckedValues('groups');
        const riskEnvs = getCheckedValues('riskEnvs');
        const urgentWin = getRadioValue('urgentWin');
        const fitScope = getRadioValue('fitScope');

        return {
          role: dom.role.value.trim(),
          fullName: dom.fullName.value.trim(),
          company: dom.company.value.trim(),
          operatingCountry: dom.operatingCountry.value.trim(),
          pressureSources,
          urgentWin,
          groups,
          fitScope,
          companySize: dom.companySize.value.trim(),
          riskEnvs,
          measuredOn: dom.measuredOn.value.trim(),
          orgPain: dom.orgPain.value.trim(),
          rhythm: dom.rhythm.value.trim(),
          fitRealism: dom.fitRealism.value.trim(),
          fitToday: dom.fitToday.value.trim(),
          fitServices: dom.fitServices.value.trim(),
          fitRiskFrame: dom.fitRiskFrame.value.trim(),
          industry: dom.industry.value.trim(),
          region: dom.region.value.trim(),
          regs: dom.regs.value
            .split(',')
            .map((item)=> item.trim())
            .filter(Boolean),
          email: dom.email.value.trim(),
          phone: dom.phone.value.trim(),
          notes: dom.notes.value.trim(),
          optin: !!dom.optin.checked
        };
      }

      function isFilled(value){
        if(Array.isArray(value)) return value.length > 0;
        return String(value || '').trim().length > 0;
      }

      function aeReadyCount(snap){
        let count = 0;
        requiredStageAKeys.forEach((key)=> {
          if(isFilled(snap[key])) count += 1;
        });
        return count;
      }

      function intentScore(snap){
        const ready = aeReadyCount(snap);
        const completionScore = Math.round((ready / requiredStageAKeys.length) * 40);

        const pressure = new Set(snap.pressureSources || []);
        const heavyPressure = ['board', 'regulator', 'insurer'].filter((key)=> pressure.has(key)).length;
        const urgencyScore = Math.min(30, heavyPressure * 10 + (snap.urgentWin ? 10 : 0));

        const scopeMap = { single: 5, multi: 12, enterprise: 20 };
        const scopeScore = scopeMap[snap.fitScope] || 0;

        let engagementScore = 0;
        const stageBDepth = [snap.companySize, snap.measuredOn, snap.orgPain, snap.rhythm].filter(Boolean).length + (snap.riskEnvs || []).length;
        const stageCDepth = [snap.fitRealism, snap.fitToday, snap.fitServices, snap.fitRiskFrame, snap.industry, snap.region].filter(Boolean).length + (snap.regs || []).length;
        if(stageBDepth >= 2) engagementScore += 4;
        if(stageCDepth >= 2) engagementScore += 3;
        if(snap.notes || snap.phone || snap.optin) engagementScore += 3;
        if(state.recommendationSeen) engagementScore = Math.min(10, engagementScore + 2);

        const score = Math.min(100, completionScore + urgencyScore + scopeScore + engagementScore);
        const band = score >= 75 ? 'high' : (score >= 50 ? 'medium' : 'low');
        return { score, band };
      }

      function recLabelFromScope(scope){
        const labels = {
          single: 'single-team scope',
          multi: 'multi-team scope',
          enterprise: 'enterprise-wide scope'
        };
        return labels[String(scope || '').trim()] || 'scope not fully confirmed yet';
      }

      function recLabelFromUrgentWin(urgentWin){
        const labels = {
          boardEvidence: 'board-ready evidence',
          fasterDecisions: 'faster response decisions',
          attackSurface: 'attack-surface reduction',
          workforce: 'workforce readiness'
        };
        return labels[String(urgentWin || '').trim()] || 'an immediate readiness outcome';
      }

      function buildInitialRecommendation(snap){
        const pressure = new Set(snap.pressureSources || []);
        const highScrutinyPressureCount = ['board', 'regulator', 'insurer'].filter((key)=> pressure.has(key)).length;

        let rank = 0; // 0 Core, 1 Advanced, 2 Ultimate
        if(snap.fitScope === 'multi') rank = 1;
        if(snap.fitScope === 'enterprise') rank = 2;
        if(highScrutinyPressureCount >= 2) rank = Math.max(rank, 1);
        if(snap.fitRealism === 'bespoke') rank = Math.min(2, rank + 1);
        if(snap.fitServices === 'whiteglove') rank = Math.min(2, rank + 1);
        if(snap.urgentWin === 'boardEvidence' && snap.fitScope !== 'single') rank = Math.min(2, rank + 1);

        const packages = [
          { key:'core', name:'Core package', summary:'Fastest path to establish baseline readiness coverage and proof.' },
          { key:'advanced', name:'Advanced package', summary:'Balanced path for broader team coverage and stronger evidence outcomes.' },
          { key:'ultimate', name:'Ultimate package', summary:'Best fit for enterprise scale and high-scrutiny, board-level readiness proof.' }
        ];
        const chosen = packages[rank];
        const ready = aeReadyCount(snap);
        const optionalDepth = [
          snap.companySize, snap.rhythm, snap.measuredOn, snap.orgPain,
          snap.fitRealism, snap.fitToday, snap.fitServices, snap.fitRiskFrame,
          snap.industry, snap.region
        ].filter(Boolean).length + (snap.riskEnvs || []).length + (snap.regs || []).length;
        const confidencePct = Math.min(96, Math.max(45, Math.round(((ready / requiredStageAKeys.length) * 70) + Math.min(26, optionalDepth * 2))));

        const reasons = [
          `Primary outcome points to ${recLabelFromUrgentWin(snap.urgentWin)}.`,
          `Current selection indicates ${recLabelFromScope(snap.fitScope)}.`,
          highScrutinyPressureCount
            ? `External scrutiny signals detected (${highScrutinyPressureCount} high-pressure source${highScrutinyPressureCount === 1 ? '' : 's'}).`
            : 'Pressure mix is currently internal-first, so this recommendation stays conservative.'
        ];
        if(snap.fitRealism){
          reasons.push(`Realism requirement (${snap.fitRealism}) influences delivery depth.`);
        }

        const nextSteps = [
          'Validate this package with all decision-makers in your first AE follow-up.',
          'Confirm success metrics and operating cadence for the first 90 days.',
          'Lock rollout scope (teams + timeline) and agree the first implementation milestone.'
        ];

        return {
          packageKey: chosen.key,
          packageName: chosen.name,
          summary: chosen.summary,
          confidencePct,
          reasons: reasons.slice(0, 4),
          nextSteps
        };
      }

      function renderInitialRecommendation(recommendation){
        const panel = el.recPanel;
        if(!panel) return;
        const rec = (recommendation && typeof recommendation === 'object') ? recommendation : null;
        panel.hidden = !rec;
        if(!rec) return;

        if(el.recConfidenceTag) el.recConfidenceTag.textContent = `Confidence: ${Math.max(0, Number(rec.confidencePct) || 0)}%`;
        if(el.recTierName) el.recTierName.textContent = String(rec.packageName || 'Core package');
        if(el.recSummary) el.recSummary.textContent = String(rec.summary || '');
        if(el.recReasons){
          el.recReasons.innerHTML = '';
          (Array.isArray(rec.reasons) ? rec.reasons : []).forEach((text)=>{
            const li = document.createElement('li');
            li.textContent = String(text || '').trim();
            if(li.textContent) el.recReasons.appendChild(li);
          });
        }
        if(el.recNextSteps){
          el.recNextSteps.innerHTML = '';
          (Array.isArray(rec.nextSteps) ? rec.nextSteps : []).forEach((text)=>{
            const li = document.createElement('li');
            li.textContent = String(text || '').trim();
            if(li.textContent) el.recNextSteps.appendChild(li);
          });
        }
      }

      function optionLabel(mapName, value){
        const key = String(value || '').trim();
        if(!key) return '';
        const map = labelMaps[mapName] || {};
        return map[key] || key;
      }

      function setSelectionText(node, value, fallback){
        if(!node) return;
        const text = String(value || '').trim();
        node.textContent = text || fallback;
        node.classList.toggle('muted', !text);
      }

      function renderPills(node, values, mapName, fallback){
        if(!node) return;
        node.innerHTML = '';
        const list = Array.isArray(values) ? values.filter(Boolean) : [];
        if(!list.length){
          const empty = document.createElement('span');
          empty.className = 'pill muted';
          empty.textContent = fallback;
          node.appendChild(empty);
          return;
        }
        list.forEach((value)=> {
          const span = document.createElement('span');
          span.className = 'pill';
          span.textContent = optionLabel(mapName, value);
          node.appendChild(span);
        });
      }

      function renderSelectionSummary(snap, scoring){
        if(!snap || !scoring) return;
        const contactBits = [snap.fullName, snap.email].filter((item)=> String(item || '').trim());
        setSelectionText(el.selContact, contactBits.join(' · '), 'Not entered yet');
        setSelectionText(el.selRole, optionLabel('role', snap.role), 'Not selected');
        setSelectionText(el.selCountry, snap.operatingCountry, 'Not selected');
        setSelectionText(el.selUrgentWin, optionLabel('urgentWin', snap.urgentWin), 'Not selected');
        setSelectionText(el.selCompany, snap.company, 'Not entered');
        setSelectionText(el.selScope, optionLabel('fitScope', snap.fitScope), 'Not selected');
        setSelectionText(el.selRegs, Array.isArray(snap.regs) ? snap.regs.join(', ') : '', 'Optional');
        renderPills(el.selPressurePills, snap.pressureSources, 'pressureSources', 'None yet');
        renderPills(el.selGroupPills, snap.groups, 'groups', 'None yet');
        renderPills(el.selRiskPills, snap.riskEnvs, 'riskEnvs', 'Optional');

        if(el.selIntentBand){
          const band = String(scoring.intentBand || 'low');
          el.selIntentBand.textContent = band.charAt(0).toUpperCase() + band.slice(1);
        }
        if(el.selAeReady){
          el.selAeReady.textContent = `${Number(scoring.aeReadyCount) || 0} / ${Number(scoring.aeReadyRequired) || requiredStageAKeys.length}`;
        }
      }

      function missingFollowupQuestions(snap){
        return followupCatalog.filter((item)=> !isFilled(snap[item.key]));
      }

      function setFollowupSelection(keys){
        const set = new Set((Array.isArray(keys) ? keys : []).filter((key)=> followupCatalogMap[key]));
        state.followupSelectedKeys = Array.from(set);
      }

      function renderFollowupChecklist(snap){
        const container = el.followupMissingChecklist;
        if(!container) return;
        const missing = missingFollowupQuestions(snap);
        const missingKeys = missing.map((item)=> item.key);
        const missingSet = new Set(missingKeys);
        const existing = new Set(state.followupSelectedKeys);
        if(!existing.size){
          setFollowupSelection(missingKeys);
        }else{
          setFollowupSelection(state.followupSelectedKeys.filter((key)=> missingSet.has(key)));
        }

        container.innerHTML = '';
        if(el.followupGapTag){
          el.followupGapTag.textContent = `${missing.length} gap${missing.length === 1 ? '' : 's'}`;
        }
        if(!missing.length){
          const p = document.createElement('p');
          p.className = 'help';
          p.textContent = 'No unanswered discovery fields. This record is complete enough for AE handoff.';
          container.appendChild(p);
          return;
        }

        const selectedSet = new Set(state.followupSelectedKeys);
        missing.forEach((item)=> {
          const label = document.createElement('label');
          label.className = 'choice gap-item';

          const row = document.createElement('span');
          row.className = 'choice-row';
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.name = 'followupGaps';
          input.value = item.key;
          input.checked = selectedSet.has(item.key);
          input.addEventListener('change', ()=> {
            const active = new Set(state.followupSelectedKeys);
            if(input.checked) active.add(item.key);
            else active.delete(item.key);
            state.followupSelectedKeys = Array.from(active);
          });
          const textWrap = document.createElement('span');
          const title = document.createElement('span');
          title.className = 'gap-title';
          title.textContent = item.label;
          const meta = document.createElement('small');
          meta.className = 'gap-meta';
          meta.textContent = item.stage;
          textWrap.appendChild(title);
          textWrap.appendChild(document.createElement('br'));
          textWrap.appendChild(meta);
          row.appendChild(input);
          row.appendChild(textWrap);
          label.appendChild(row);
          container.appendChild(label);
        });
      }

      function setChecklistSelection(all){
        const nodes = Array.from(document.querySelectorAll('input[name="followupGaps"]'));
        nodes.forEach((node)=> {
          node.checked = !!all;
        });
        setFollowupSelection(all ? nodes.map((node)=> node.value) : []);
      }

      function buildFollowupFormUrl(recordId, selectedKeys){
        const url = new URL(window.location.href);
        url.search = '';
        url.hash = '';
        url.searchParams.set('followup', selectedKeys.join(','));
        url.searchParams.set('recordId', recordId);
        return url.toString();
      }

      function parseFollowupKeysFromUrl(){
        try{
          const params = new URLSearchParams(window.location.search);
          const raw = String(params.get('followup') || '').trim();
          if(!raw) return [];
          const keys = raw.split(',').map((item)=> item.trim()).filter((key)=> followupCatalogMap[key]);
          return Array.from(new Set(keys));
        }catch(err){
          return [];
        }
      }

      function ensureStageVisibilityForKeys(keys){
        const set = new Set(Array.isArray(keys) ? keys : []);
        if(['companySize', 'rhythm', 'riskEnvs', 'measuredOn', 'orgPain'].some((key)=> set.has(key))){
          const node = document.getElementById('stageB');
          if(node) node.open = true;
        }
        if(['fitRealism', 'fitToday', 'fitServices', 'fitRiskFrame', 'industry', 'region', 'regs'].some((key)=> set.has(key))){
          const node = document.getElementById('stageC');
          if(node) node.open = true;
        }
        if(['email', 'phone'].some((key)=> set.has(key))){
          const node = document.getElementById('stageD');
          if(node) node.open = true;
        }
      }

      function createFollowupControl(item, snap){
        const wrap = document.createElement('article');
        wrap.className = 'followup-item';
        wrap.dataset.followupKey = item.key;

        const head = document.createElement('div');
        head.className = 'followup-item-head';
        const label = document.createElement('label');
        label.textContent = item.label;
        const stage = document.createElement('span');
        stage.className = 'followup-stage';
        stage.textContent = item.stage;
        head.appendChild(label);
        head.appendChild(stage);
        wrap.appendChild(head);

        const sourceValue = snap[item.key];
        if(item.kind === 'select'){
          const source = document.getElementById(item.sourceId);
          if(!source) return null;
          const control = document.createElement('select');
          Array.from(source.options).forEach((opt)=> {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.textContent;
            control.appendChild(option);
          });
          control.value = String(sourceValue || '');
          control.addEventListener('change', ()=> {
            source.value = control.value;
            source.dispatchEvent(new Event('change', { bubbles:true }));
            updatePreview();
          });
          wrap.appendChild(control);
          return wrap;
        }

        if(item.kind === 'text' || item.kind === 'email' || item.kind === 'tel'){
          const source = document.getElementById(item.sourceId);
          if(!source) return null;
          const control = document.createElement('input');
          control.type = item.kind;
          control.value = String(sourceValue || '');
          control.addEventListener('input', ()=> {
            source.value = control.value;
            source.dispatchEvent(new Event('input', { bubbles:true }));
            updatePreview();
          });
          wrap.appendChild(control);
          return wrap;
        }

        if(item.kind === 'radio'){
          const grid = document.createElement('div');
          grid.className = 'choice-grid two';
          const selected = String(sourceValue || '');
          groupOptions(item.sourceName).forEach((opt)=> {
            const labelNode = document.createElement('label');
            labelNode.className = 'choice';
            const row = document.createElement('span');
            row.className = 'choice-row';
            const input = document.createElement('input');
            input.type = 'radio';
            input.name = `fu_${item.key}`;
            input.value = opt.value;
            input.checked = selected === opt.value;
            input.addEventListener('change', ()=> {
              if(!input.checked) return;
              setRadioValue(item.sourceName, input.value);
              updatePreview();
            });
            const text = document.createElement('span');
            text.textContent = opt.label;
            row.appendChild(input);
            row.appendChild(text);
            labelNode.appendChild(row);
            grid.appendChild(labelNode);
          });
          wrap.appendChild(grid);
          return wrap;
        }

        if(item.kind === 'checkbox'){
          const grid = document.createElement('div');
          grid.className = 'choice-grid two';
          const selected = new Set(Array.isArray(sourceValue) ? sourceValue : []);
          groupOptions(item.sourceName).forEach((opt)=> {
            const labelNode = document.createElement('label');
            labelNode.className = 'choice';
            const row = document.createElement('span');
            row.className = 'choice-row';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.name = `fu_${item.key}`;
            input.value = opt.value;
            input.checked = selected.has(opt.value);
            input.addEventListener('change', ()=> {
              const list = Array.from(grid.querySelectorAll(`input[name="fu_${item.key}"]:checked`)).map((n)=> n.value);
              if(item.max && list.length > item.max){
                input.checked = false;
                showMessage(`You can select up to ${item.max} options here.`, 'error');
                return;
              }
              setCheckedValues(item.sourceName, list);
              updatePreview();
            });
            const text = document.createElement('span');
            text.textContent = opt.label;
            row.appendChild(input);
            row.appendChild(text);
            labelNode.appendChild(row);
            grid.appendChild(labelNode);
          });
          wrap.appendChild(grid);
          return wrap;
        }

        return null;
      }

      function renderCustomerFollowupForm(keys){
        const form = el.customerFollowupForm;
        if(!form) return;
        const snap = snapshot();
        form.innerHTML = '';
        keys.forEach((key)=> {
          const item = followupCatalogMap[key];
          if(!item) return;
          const control = createFollowupControl(item, snap);
          if(control) form.appendChild(control);
        });
      }

      function activateFollowupModeFromUrl(){
        const keys = parseFollowupKeysFromUrl();
        if(!keys.length) return;
        state.followupModeKeys = keys;
        if(el.customerFollowupPanel){
          el.customerFollowupPanel.hidden = false;
        }
        if(el.customerFollowupCount){
          el.customerFollowupCount.textContent = `${keys.length} question${keys.length === 1 ? '' : 's'}`;
        }
        if(el.customerFollowupIntro){
          el.customerFollowupIntro.textContent = `Please complete these ${keys.length} follow-up question${keys.length === 1 ? '' : 's'} so we can finalize your recommendation.`;
        }
        ensureStageVisibilityForKeys(keys);
        renderCustomerFollowupForm(keys);
      }

      function generateFollowupEmail(){
        const selected = (Array.isArray(state.followupSelectedKeys) ? state.followupSelectedKeys : []).filter((key)=> followupCatalogMap[key]);
        if(!selected.length){
          showMessage('Select at least one unanswered field before generating the follow-up email.', 'error');
          return;
        }
        const snap = snapshot();
        const record = buildRecord(false);
        const firstName = String((snap.fullName || '').trim().split(/\s+/)[0] || 'there');
        const focusBits = [];
        if(snap.urgentWin) focusBits.push(optionLabel('urgentWin', snap.urgentWin).toLowerCase());
        if(snap.fitScope) focusBits.push(`${optionLabel('fitScope', snap.fitScope).toLowerCase()} scope`);
        const focusLine = focusBits.length
          ? `Based on your focus on ${focusBits.join(' and ')},`
          : 'Based on your initial configurator submission,';
        const link = buildFollowupFormUrl(record.recordId, selected);
        const questionLines = selected.map((key)=> `- ${followupCatalogMap[key].label}`);
        const subject = `Quick follow-up on your configurator submission`;
        const body = [
          `Hi ${firstName},`,
          '',
          'Thank you for completing the configurator.',
          `${focusLine} we just need a few extra details to tailor the recommendation:`,
          ...questionLines,
          '',
          'Please use this short follow-up form:',
          link,
          '',
          'Once complete, we will confirm next steps and propose the right attendees for a short discovery call.',
          '',
          'Thanks,',
          'Immersive One team'
        ].join('\n');
        if(el.followupSubject) el.followupSubject.value = subject;
        if(el.followupBody) el.followupBody.value = body;
        if(el.followupLink){
          el.followupLink.href = link;
          el.followupLink.textContent = link;
        }
        if(el.followupMailto){
          const to = String(snap.email || '').trim();
          el.followupMailto.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        }
        if(el.followupOutput){
          el.followupOutput.hidden = false;
        }
        showMessage('Follow-up email draft and dynamic form link generated.', 'good');
      }

      async function copyFollowupEmail(){
        const subject = el.followupSubject ? String(el.followupSubject.value || '').trim() : '';
        const body = el.followupBody ? String(el.followupBody.value || '').trim() : '';
        const link = el.followupLink ? String(el.followupLink.textContent || '').trim() : '';
        if(!subject && !body){
          showMessage('Generate the follow-up email first, then copy it.', 'error');
          return;
        }
        const text = [
          subject ? `Subject: ${subject}` : '',
          '',
          body,
          '',
          link ? `Follow-up form: ${link}` : ''
        ].join('\n').trim();
        try{
          await navigator.clipboard.writeText(text);
          showMessage('Follow-up email copied.', 'good');
        }catch(err){
          showMessage('Clipboard not available in this browser context.', 'error');
        }
      }

      function buildRecord(submitted){
        const snap = snapshot();
        const ready = aeReadyCount(snap);
        const scoring = intentScore(snap);
        const nowIso = new Date().toISOString();
        const status = submitted ? 'submitted_customer' : state.status;
        const recommendation = state.generatedRecommendation && state.recommendationSeen
          ? state.generatedRecommendation
          : null;

        return {
          schemaVersion: 'customer-self-serve.v1',
          source: 'website_widget',
          recordId: state.recordId,
          submissionStatus: status,
          submittedAt: submitted ? nowIso : null,
          updatedAt: nowIso,
          ownerQueue: 'ae_queue',
          scoring: {
            aeReadyCount: ready,
            aeReadyRequired: requiredStageAKeys.length,
            intentScore: scoring.score,
            intentBand: scoring.band
          },
          recommendation,
          profile: {
            role: snap.role,
            fullName: snap.fullName,
            company: snap.company,
            operatingCountry: snap.operatingCountry,
            companySize: snap.companySize,
            industry: snap.industry,
            region: snap.region
          },
          selections: {
            pressureSources: snap.pressureSources,
            urgentWin: snap.urgentWin,
            groups: snap.groups,
            fitScope: snap.fitScope,
            riskEnvs: snap.riskEnvs,
            measuredOn: snap.measuredOn,
            orgPain: snap.orgPain,
            rhythm: snap.rhythm,
            fitRealism: snap.fitRealism,
            fitToday: snap.fitToday,
            fitServices: snap.fitServices,
            fitRiskFrame: snap.fitRiskFrame,
            regs: snap.regs
          },
          lead: {
            email: snap.email,
            phone: snap.phone,
            notes: snap.notes,
            optin: snap.optin
          }
        };
      }

      function readStorageArray(key){
        try{
          const raw = window.localStorage.getItem(key);
          if(!raw) return [];
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed : [];
        }catch(err){
          return [];
        }
      }

      function writeStorageArray(key, rows){
        const safe = Array.isArray(rows) ? rows : [];
        window.localStorage.setItem(key, JSON.stringify(safe));
      }

      function launchpadSnapshotFromPayload(payload){
        const profile = (payload && payload.profile) || {};
        const selections = (payload && payload.selections) || {};
        const lead = (payload && payload.lead) || {};
        return {
          fieldMode: 'sdr-lite',
          role: String(profile.role || '').trim(),
          fullName: String(profile.fullName || '').trim(),
          company: String(profile.company || '').trim(),
          companySize: String(profile.companySize || '').trim(),
          operatingCountry: String(profile.operatingCountry || '').trim(),
          industry: String(profile.industry || '').trim(),
          region: String(profile.region || '').trim(),
          pressureSources: Array.isArray(selections.pressureSources) ? selections.pressureSources : [],
          urgentWin: String(selections.urgentWin || '').trim(),
          riskEnvs: Array.isArray(selections.riskEnvs) ? selections.riskEnvs : [],
          measuredOn: String(selections.measuredOn || '').trim(),
          orgPain: String(selections.orgPain || '').trim(),
          groups: Array.isArray(selections.groups) ? selections.groups : [],
          rhythm: String(selections.rhythm || '').trim(),
          measure: '',
          fitRealism: String(selections.fitRealism || '').trim(),
          fitScope: String(selections.fitScope || '').trim(),
          fitToday: String(selections.fitToday || '').trim(),
          fitServices: String(selections.fitServices || '').trim(),
          fitRiskFrame: String(selections.fitRiskFrame || '').trim(),
          regs: Array.isArray(selections.regs) ? selections.regs : [],
          regsTouched: Array.isArray(selections.regs) && selections.regs.length > 0,
          regMode: 'suggested',
          regModeTouched: false,
          regSearch: '',
          stack: [],
          stackOther: '',
          currency: 'USD',
          fx: { USD: 1, GBP: 0.8, EUR: 0.9 },
          revenueB: 10,
          investUSD: 250000,
          investManual: false,
          teamCyber: 200,
          teamDev: 1000,
          teamWf: 3000,
          teamManual: false,
          realization: 'conservative',
          paybackDelayMonths: 3,
          cyberSalaryUSD: 180000,
          devSalaryUSD: 160000,
          email: String(lead.email || '').trim(),
          phone: String(lead.phone || '').trim(),
          notes: String(lead.notes || '').trim(),
          optin: !!lead.optin,
          activeStep: 1,
          visited: [1]
        };
      }

      function launchpadRecordFromPayload(payload){
        const nowMs = Date.now();
        const recordId = String((payload && payload.recordId) || '').trim();
        const profile = (payload && payload.profile) || {};
        const score = (payload && payload.scoring) || {};
        const launchpadSnapshot = launchpadSnapshotFromPayload(payload);
        return {
          id: recordId,
          recordId,
          workspaceId: LAUNCHPAD_WORKSPACE_ID,
          schemaVersion: LAUNCHPAD_SCHEMA_VERSION,
          version: 1,
          updatedBy: String(profile.fullName || '').trim() || 'Website self-serve',
          updatedById: '',
          updatedByEmail: String((payload && payload.lead && payload.lead.email) || '').trim(),
          company: String(profile.company || '').trim() || 'Record',
          stage: 'Discovery',
          tier: 'Core',
          outcomes: [],
          outcomesText: 'Awaiting outcome signals',
          gapSummary: '',
          gaps: [],
          modules: [],
          viz: {},
          snapshot: launchpadSnapshot,
          createdAt: nowMs,
          updatedAt: nowMs,
          priority: String(score.intentBand || '').toLowerCase() === 'high',
          archived: false,
          archivedAt: 0,
          collaborators: [],
          shareAccess: 'workspace-viewer',
          lockOwner: null,
          lockExpiresAt: 0,
          source: 'website_widget',
          submissionStatus: String(payload && payload.submissionStatus || '').trim() || 'draft_customer',
          submittedAt: payload && payload.submittedAt ? payload.submittedAt : null,
          intentScore: Number(score.intentScore) || 0,
          intentBand: String(score.intentBand || '').trim() || 'low',
          ownerQueue: 'ae_queue'
        };
      }

      function syncToLaunchpadDashboard(payload){
        try{
          const rows = readStorageArray(LAUNCHPAD_THREAD_KEY);
          const record = launchpadRecordFromPayload(payload);
          const idx = rows.findIndex((row)=> {
            const rowId = String((row && (row.recordId || row.id)) || '').trim();
            return rowId === record.recordId;
          });
          if(idx >= 0){
            const existing = (rows[idx] && typeof rows[idx] === 'object') ? rows[idx] : {};
            rows[idx] = Object.assign({}, existing, record, {
              createdAt: Number(existing.createdAt) || record.createdAt
            });
          }else{
            rows.unshift(record);
          }
          writeStorageArray(LAUNCHPAD_THREAD_KEY, rows);
          return { ok:true, created: idx < 0, count: rows.length };
        }catch(err){
          return { ok:false, error: String(err && err.message ? err.message : err) };
        }
      }

      function launchpadDashboardUrl(){
        return new URL('../index.html#/dashboard', window.location.href).toString();
      }

      function updatePreview(){
        const snap = snapshot();
        const rec = buildRecord(false);
        const { aeReadyCount: ready, aeReadyRequired, intentScore: score, intentBand: band } = rec.scoring;
        const pct = Math.round((ready / aeReadyRequired) * 100);

        el.aeReadyText.textContent = `${ready} / ${aeReadyRequired}`;
        el.intentScoreText.textContent = `${score} / 100`;
        el.intentBandText.textContent = band.charAt(0).toUpperCase() + band.slice(1);
        el.aeProgressBar.style.width = `${pct}%`;

        const pressureCount = (rec.selections.pressureSources || []).length;
        el.pressureCount.textContent = String(pressureCount);

        el.pillRow.innerHTML = '';
        [
          `Status: ${rec.submissionStatus}`,
          `Band: ${rec.scoring.intentBand}`,
          `AE-ready: ${ready}/${aeReadyRequired}`
        ].forEach((text)=> {
          const span = document.createElement('span');
          span.className = 'pill';
          span.textContent = text;
          el.pillRow.appendChild(span);
        });

        el.recordPreview.textContent = JSON.stringify(rec, null, 2);
        renderSelectionSummary(snap, rec.scoring);
        renderInitialRecommendation(rec.recommendation || null);
      }

      function validateBeforeSubmit(requireEmail){
        clearFieldHighlights();
        const snap = snapshot();
        const missing = [];

        if(!snap.role){ missing.push('role'); dom.role.classList.add('missing'); }
        if(!snap.fullName){ missing.push('fullName'); dom.fullName.classList.add('missing'); }
        if(!snap.company){ missing.push('company'); dom.company.classList.add('missing'); }
        if(!snap.operatingCountry){ missing.push('operatingCountry'); dom.operatingCountry.classList.add('missing'); }
        if(!snap.pressureSources.length){ missing.push('pressureSources'); dom.pressureSourcesFieldset.classList.add('missing'); }
        if(!snap.urgentWin){ missing.push('urgentWin'); dom.urgentWinFieldset.classList.add('missing'); }
        if(!snap.groups.length){ missing.push('groups'); dom.groupsFieldset.classList.add('missing'); }
        if(!snap.fitScope){ missing.push('fitScope'); dom.fitScopeFieldset.classList.add('missing'); }
        if(requireEmail && !snap.email){ missing.push('email'); dom.email.classList.add('missing'); }

        return { missing, snap };
      }

      async function submitRecord(){
        const check = validateBeforeSubmit(true);
        if(check.missing.length){
          showMessage(`Please complete required discovery fields${check.missing.includes('email') ? ' and add business email' : ''}.`, 'error');
          return;
        }

        const payload = buildRecord(true);
        state.status = 'submitted_customer';

        let endpointError = '';
        const endpoint = String(window.CONFIGURATOR_WIDGET_ENDPOINT || '').trim();
        if(endpoint){
          try{
            const response = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            if(!response.ok){
              throw new Error(`Endpoint responded ${response.status}`);
            }
          }catch(err){
            endpointError = String(err && err.message ? err.message : err);
          }
        }

        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        const syncResult = syncToLaunchpadDashboard(payload);

        const notes = ['Submitted for AE review.'];
        if(syncResult.ok){
          notes.push(`Dashboard record ${syncResult.created ? 'created' : 'updated'}.`);
        }else{
          notes.push(`Dashboard sync failed (${syncResult.error}).`);
        }
        if(endpoint){
          notes.push(endpointError ? `Endpoint push failed (${endpointError}).` : 'Endpoint push sent.');
        }
        if(window.location.protocol === 'file:'){
          notes.push('If dashboard does not show it, run both pages via the same local web server origin.');
        }
        showMessage(notes.join(' '), (!syncResult.ok || !!endpointError) ? 'error' : 'good');

        updatePreview();
      }

      function saveDraft(){
        const payload = buildRecord(false);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        showMessage('Draft saved in this browser.', 'good');
        updatePreview();
      }

      function applyPayload(data){
        const profile = data && data.profile ? data.profile : {};
        const selections = data && data.selections ? data.selections : {};
        const lead = data && data.lead ? data.lead : {};

        dom.role.value = profile.role || '';
        dom.fullName.value = profile.fullName || '';
        dom.company.value = profile.company || '';
        dom.operatingCountry.value = profile.operatingCountry || '';
        dom.companySize.value = profile.companySize || '';
        dom.industry.value = profile.industry || '';
        dom.region.value = profile.region || '';

        setCheckedValues('pressureSources', selections.pressureSources || []);
        setRadioValue('urgentWin', selections.urgentWin || '');
        setCheckedValues('groups', selections.groups || []);
        setRadioValue('fitScope', selections.fitScope || '');

        setCheckedValues('riskEnvs', selections.riskEnvs || []);
        dom.measuredOn.value = selections.measuredOn || '';
        dom.orgPain.value = selections.orgPain || '';
        dom.rhythm.value = selections.rhythm || '';

        dom.fitRealism.value = selections.fitRealism || '';
        dom.fitToday.value = selections.fitToday || '';
        dom.fitServices.value = selections.fitServices || '';
        dom.fitRiskFrame.value = selections.fitRiskFrame || '';
        dom.regs.value = Array.isArray(selections.regs) ? selections.regs.join(', ') : '';

        dom.email.value = lead.email || '';
        dom.phone.value = lead.phone || '';
        dom.notes.value = lead.notes || '';
        dom.optin.checked = !!lead.optin;

        state.status = data && data.submissionStatus ? data.submissionStatus : 'draft_customer';
        state.generatedRecommendation = (data && data.recommendation && typeof data.recommendation === 'object')
          ? data.recommendation
          : null;
        state.recommendationSeen = !!state.generatedRecommendation;
      }

      function loadDraft(){
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if(!raw){
          showMessage('No saved draft found in this browser.', 'error');
          return;
        }

        try{
          const data = JSON.parse(raw);
          state.recordId = data.recordId || state.recordId;
          applyPayload(data);
          showMessage('Draft loaded.', 'good');
          updatePreview();
        }catch(err){
          showMessage(`Could not parse saved draft: ${String(err.message || err)}`, 'error');
        }
      }

      function clearAll(){
        if(!window.confirm('Clear all fields in this prototype?')) return;
        state.recordId = `rec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
        state.status = 'draft_customer';
        state.recommendationSeen = false;
        state.generatedRecommendation = null;

        [
          dom.role,
          dom.fullName,
          dom.company,
          dom.operatingCountry,
          dom.companySize,
          dom.measuredOn,
          dom.orgPain,
          dom.rhythm,
          dom.fitRealism,
          dom.fitToday,
          dom.fitServices,
          dom.fitRiskFrame,
          dom.industry,
          dom.region,
          dom.regs,
          dom.email,
          dom.phone,
          dom.notes
        ].forEach((node)=> {
          if(node) node.value = '';
        });

        dom.optin.checked = false;
        setCheckedValues('pressureSources', []);
        setCheckedValues('groups', []);
        setCheckedValues('riskEnvs', []);
        setRadioValue('urgentWin', '');
        setRadioValue('fitScope', '');

        clearFieldHighlights();
        showMessage('All fields cleared.', '');
        updatePreview();
      }

      async function copyJson(){
        try{
          await navigator.clipboard.writeText(el.recordPreview.textContent || '{}');
          showMessage('Record JSON copied.', 'good');
        }catch(err){
          showMessage('Clipboard not available in this browser context.', 'error');
        }
      }

      function downloadJson(){
        const payload = buildRecord(state.status === 'submitted_customer');
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
        const href = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = href;
        a.download = `self-service-record-${payload.recordId}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(href);
        showMessage('JSON downloaded.', 'good');
      }

      function openDashboard(){
        const href = launchpadDashboardUrl();
        window.open(href, '_blank', 'noopener');
      }

      function attachInputListeners(){
        const inputs = Array.from(document.querySelectorAll('input, select, textarea'));
        inputs.forEach((node)=> {
          node.addEventListener('input', ()=> {
            clearFieldHighlights();
            updatePreview();
          });
          node.addEventListener('change', ()=> {
            clearFieldHighlights();
            updatePreview();
          });
        });

        Array.from(document.querySelectorAll('input[name="pressureSources"]')).forEach((node)=> {
          node.addEventListener('change', ()=> enforceMaxChecks('pressureSources', 3, node));
        });

        Array.from(document.querySelectorAll('input[name="riskEnvs"]')).forEach((node)=> {
          node.addEventListener('change', ()=> enforceMaxChecks('riskEnvs', 2, node));
        });
      }

      controls.btnRecommend.addEventListener('click', ()=> {
        const check = validateBeforeSubmit(false);
        if(check.missing.length){
          showMessage('Complete the required Stage A fields to generate an initial recommendation.', 'error');
          return;
        }
        state.generatedRecommendation = buildInitialRecommendation(check.snap);
        state.recommendationSeen = true;
        showMessage('Initial recommendation generated on the right. You can now submit or add optional depth.', 'good');
        updatePreview();
        if(el.recPanel){
          el.recPanel.scrollIntoView({ behavior:'smooth', block:'start' });
        }
      });

      controls.btnSaveDraft.addEventListener('click', saveDraft);
      controls.btnLoadDraft.addEventListener('click', loadDraft);
      controls.btnClear.addEventListener('click', clearAll);
      controls.btnSubmit.addEventListener('click', submitRecord);
      controls.btnCopyJson.addEventListener('click', copyJson);
      controls.btnDownloadJson.addEventListener('click', downloadJson);
      controls.btnOpenDashboard.addEventListener('click', openDashboard);
      if(controls.btnApplyFollowupAnswers){
        controls.btnApplyFollowupAnswers.addEventListener('click', ()=> {
          const payload = buildRecord(false);
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
          showMessage('Follow-up answers saved. Submit when ready.', 'good');
          updatePreview();
        });
      }

      activateFollowupModeFromUrl();
      attachInputListeners();
      updatePreview();
    })();
