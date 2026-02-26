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
        followupModeKeys: [],
        companyHint: ''
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

      const legacyValueAliases = {
        rhythm: {
          ad_hoc: 'adhoc',
          continuous: 'program'
        },
        measuredOn: {
          completion: 'training',
          mix: 'notMeasured',
          performance: 'mttd'
        },
        orgPain: {
          proof: 'externalProof',
          speed: 'coordination',
          skills: 'skillsCoverage',
          reg: 'externalProof'
        },
        fitToday: {
          starting: 'training',
          developing: 'adhoc',
          mature: 'scrutiny'
        },
        fitRiskFrame: {
          compliance: 'governance',
          operational: 'readiness',
          business: 'governance'
        },
        groups: {
          secops: 'soc',
          dev: 'appsec',
          leaders: 'exec',
          it: 'itops'
        }
      };

      const labelMaps = {
        role: {
          ciso: 'CISO',
          secMgr: 'Security Manager',
          practitioner: 'Practitioner',
          executive: 'Executive',
          other: 'Other'
        },
        urgentWin: {
          boardEvidence: 'Board-ready evidence & benchmarks',
          fasterDecisions: 'Faster detection/response decisions',
          attackSurface: 'Shrink attack surface & remediation time',
          safeAI: 'Safe AI adoption & governance',
          workforce: 'Workforce readiness & retention',
          thirdParty: 'Third-party resilience'
        },
        fitScope: {
          single: 'Single team / single function',
          multi: 'Multiple teams within a function',
          enterprise: 'Enterprise / multi-region / exec plus technical'
        },
        pressureSources: {
          board: 'Board',
          regulator: 'Regulator',
          insurer: 'Insurer',
          customers: 'Customers',
          internal: 'Internal only'
        },
        groups: {
          soc: 'SOC / Incident Response',
          appsec: 'AppSec / Developers',
          cloud: 'Cloud security',
          itops: 'IT ops / infrastructure',
          identity: 'Identity & access (IAM)',
          grc: 'GRC / compliance',
          data: 'Data / privacy',
          product: 'Product / platform security',
          exec: 'Executive Crisis Team (CMT)',
          workforce: 'Wider workforce',
          third: 'Third-party / supplier readiness'
        },
        riskEnvs: {
          code: 'Code',
          cloud: 'Cloud',
          identity: 'Identity',
          ot: 'OT',
          enterpriseApps: 'Enterprise apps',
          socir: 'Mostly SOC / IR'
        }
      };

      const followupCatalog = [
        { key:'role', label:'Which best describes your role?', stage:'Stage A', kind:'select', sourceId:'role' },
        { key:'fullName', label:'Your name', stage:'Stage A', kind:'text', sourceId:'fullName' },
        { key:'company', label:'Company', stage:'Stage A', kind:'text', sourceId:'company' },
        { key:'operatingCountry', label:'Operating country', stage:'Stage A', kind:'select', sourceId:'operatingCountry' },
        { key:'pressureSources', label:'Where\'s the pressure coming from? (pick up to 3)', stage:'Stage A', kind:'checkbox', sourceName:'pressureSources', max:3 },
        { key:'urgentWin', label:'What\'s the most urgent 90-day win?', stage:'Stage A', kind:'radio', sourceName:'urgentWin' },
        { key:'groups', label:'Teams who need to be ready (select any)', stage:'Stage A', kind:'checkbox', sourceName:'groups' },
        { key:'fitScope', label:'Scope of the program', stage:'Stage A', kind:'radio', sourceName:'fitScope' },
        { key:'companySize', label:'Company size', stage:'Stage B', kind:'select', sourceId:'companySize' },
        { key:'rhythm', label:'Cyber resilience cadence today (best fit)', stage:'Stage B', kind:'select', sourceId:'rhythm' },
        { key:'riskEnvs', label:'Risk environments (pick up to 2)', stage:'Stage B', kind:'checkbox', sourceName:'riskEnvs', max:2 },
        { key:'measuredOn', label:'What are you being measured on today?', stage:'Stage B', kind:'select', sourceId:'measuredOn' },
        { key:'orgPain', label:'Where are your biggest pain points?', stage:'Stage B', kind:'select', sourceId:'orgPain' },
        { key:'fitRealism', label:'How realistic do exercises need to be?', stage:'Stage C', kind:'select', sourceId:'fitRealism' },
        { key:'fitToday', label:'Current state (closest match)', stage:'Stage C', kind:'select', sourceId:'fitToday' },
        { key:'fitServices', label:'Delivery style they need', stage:'Stage C', kind:'select', sourceId:'fitServices' },
        { key:'fitRiskFrame', label:'How they describe the problem', stage:'Stage C', kind:'select', sourceId:'fitRiskFrame' },
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

      function copyRulesCall(methodName, payload){
        const api = (window && window.immersiveCopyRules && typeof window.immersiveCopyRules === 'object')
          ? window.immersiveCopyRules
          : null;
        if(!api || typeof api[methodName] !== 'function') return null;
        try{
          return api[methodName](payload || {});
        }catch(err){
          console.warn('[CopyRules:widget] Failed call:', methodName, err);
          return null;
        }
      }

      function followupAudienceHint(snapshotObj){
        const snap = (snapshotObj && typeof snapshotObj === 'object') ? snapshotObj : {};
        return copyRulesCall('inferAudience', {
          audience: String(snap.messageAudience || '').trim().toLowerCase(),
          role: String(snap.role || '').trim(),
          mode: String(snap.fieldMode || '').trim().toLowerCase()
        }) || 'manager';
      }

      const widgetSelectCardConfig = {
        role: {
          columns: 5,
          variant: 'chips',
          options: {
            ciso: { label:'CISO' },
            secMgr: { label:'Security Manager' },
            practitioner: { label:'Practitioner' },
            executive: { label:'Executive' },
            other: { label:'Other' }
          }
        },
        companySize: { columns: 2 },
        rhythm: {
          columns: 2,
          options: {
            adhoc: {
              label: 'Ad hoc',
              hint: 'Infrequent / event-driven exercises.'
            },
            quarterly: {
              label: 'Quarterly',
              hint: 'Some structure, limited cadence.'
            },
            monthly: {
              label: 'Monthly',
              hint: 'Higher cadence, increasing realism.'
            },
            program: {
              label: 'Programmatic',
              hint: 'Continuous rhythm + governance + reporting.'
            }
          }
        },
        measuredOn: {
          columns: 2,
          options: {
            mttd: {
              label: 'MTTD / MTTR',
              hint: 'Speed to detect, escalate, and contain is tracked.'
            },
            audit: {
              label: 'Audit evidence',
              hint: 'Readiness proof and governance evidence are key measures.'
            },
            vuln: {
              label: 'Vulnerability backlog',
              hint: 'Backlog, fix velocity, and closure cadence are central metrics.'
            },
            training: {
              label: 'Training completion',
              hint: 'Readiness is mostly tracked as completion today.'
            },
            notMeasured: {
              label: 'Not measured well',
              hint: 'Metrics are fragmented or not trusted by stakeholders.'
            }
          }
        },
        orgPain: {
          columns: 2,
          options: {
            skillsCoverage: {
              label: 'Skills coverage & onboarding',
              hint: 'Readiness gaps and onboarding speed are hurting execution.'
            },
            coordination: {
              label: 'Cross-team coordination',
              hint: 'Decision and response handoffs break down under pressure.'
            },
            externalProof: {
              label: 'Proving to external stakeholders',
              hint: 'Board/regulator/insurer/customer evidence is hard to package.'
            },
            vendorRisk: {
              label: 'Vendor risk',
              hint: 'Third-party dependency and resilience are primary pain points.'
            },
            aiRisk: {
              label: 'AI risk',
              hint: 'AI adoption risk exists without clear controls and governance.'
            }
          }
        },
        fitRealism: {
          columns: 2,
          options: {
            generic: {
              label: 'Best-practice / generic scenarios are fine',
              hint: 'Value quickly without mirroring the exact environment.'
            },
            tooling: {
              label: 'Needs to reflect our tooling and processes',
              hint: 'Bring your own tooling and dynamic realism matters.'
            },
            bespoke: {
              label: 'Must mirror our environment and threat landscape',
              hint: 'They will not trust results unless it matches their reality.'
            }
          }
        },
        fitToday: {
          columns: 2,
          options: {
            training: {
              label: 'Mainly training completion today',
              hint: 'They lack proof of capability and want to escape checkbox learning.'
            },
            adhoc: {
              label: 'Exercises exist, but they are ad hoc and do not close gaps',
              hint: 'They want a loop that drives improvement.'
            },
            scrutiny: {
              label: 'Already under scrutiny (audits, board, regulators)',
              hint: 'They need a repeatable evidence layer.'
            }
          }
        },
        fitServices: {
          columns: 2,
          options: {
            diy: {
              label: 'Self-serve / light enablement',
              hint: 'They can run most of it internally with minimal support.'
            },
            guided: {
              label: 'Guided program support',
              hint: 'Help building cadence and linking outcomes to improvement.'
            },
            whiteglove: {
              label: 'Dedicated program team + evidence packaging + bespoke realism',
              hint: 'Managed partnership for custom realism, facilitation, and evidence delivery.'
            }
          }
        },
        fitRiskFrame: {
          columns: 2,
          options: {
            skills: {
              label: 'We need stronger skills',
              hint: 'They frame the issue as practitioner proficiency.'
            },
            readiness: {
              label: 'We need better response outcomes and coordination',
              hint: 'They care about speed, accuracy, and teamwork under pressure.'
            },
            governance: {
              label: 'We need proof for governance',
              hint: 'They talk in board and regulatory evidence terms.'
            }
          }
        },
        region: { columns: 2 }
      };
      const widgetSelectCardRenderers = new Map();

      const el = {
        heroEyebrow: document.getElementById('heroEyebrow'),
        heroTitle: document.getElementById('heroTitle'),
        heroSubtitle: document.getElementById('heroSubtitle'),
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
        customerFollowupCompletion: document.getElementById('customerFollowupCompletion'),
        customerFollowupProgressLabel: document.getElementById('customerFollowupProgressLabel'),
        customerFollowupProgressBar: document.getElementById('customerFollowupProgressBar'),
        customerFollowupSummary: document.getElementById('customerFollowupSummary'),
        customerFollowupIntro: document.getElementById('customerFollowupIntro'),
        customerFollowupGateAlert: document.getElementById('customerFollowupGateAlert'),
        customerFollowupForm: document.getElementById('customerFollowupForm'),
        fullQuestionnaireAccordion: document.getElementById('fullQuestionnaireAccordion'),
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

      function readSearchParam(name){
        try{
          const params = new URLSearchParams(window.location.search);
          return String(params.get(name) || '').trim();
        }catch(err){
          return '';
        }
      }

      function parseRecordIdFromUrl(){
        return readSearchParam('recordId');
      }

      function parseCompanyFromUrl(){
        return readSearchParam('company');
      }

      function launchpadRecordById(recordId){
        const target = String(recordId || '').trim();
        if(!target) return null;
        const rows = readStorageArray(LAUNCHPAD_THREAD_KEY);
        const match = rows.find((row)=> {
          const rowId = String((row && (row.recordId || row.id)) || '').trim();
          return rowId === target;
        });
        return (match && typeof match === 'object') ? match : null;
      }

      function applyLaunchpadSnapshot(snapshot){
        const snap = (snapshot && typeof snapshot === 'object') ? snapshot : null;
        if(!snap) return;
        dom.role.value = String(snap.role || dom.role.value || '').trim();
        dom.fullName.value = String(snap.fullName || dom.fullName.value || '').trim();
        dom.company.value = String(snap.company || dom.company.value || '').trim();
        dom.operatingCountry.value = String(snap.operatingCountry || dom.operatingCountry.value || '').trim();
        dom.companySize.value = String(snap.companySize || dom.companySize.value || '').trim();
        dom.rhythm.value = normalizeOptionValue('rhythm', String(snap.rhythm || dom.rhythm.value || '').trim());
        dom.measuredOn.value = normalizeOptionValue('measuredOn', String(snap.measuredOn || dom.measuredOn.value || '').trim());
        dom.orgPain.value = normalizeOptionValue('orgPain', String(snap.orgPain || dom.orgPain.value || '').trim());
        dom.fitRealism.value = String(snap.fitRealism || dom.fitRealism.value || '').trim();
        dom.fitToday.value = normalizeOptionValue('fitToday', String(snap.fitToday || dom.fitToday.value || '').trim());
        dom.fitServices.value = String(snap.fitServices || dom.fitServices.value || '').trim();
        dom.fitRiskFrame.value = normalizeOptionValue('fitRiskFrame', String(snap.fitRiskFrame || dom.fitRiskFrame.value || '').trim());
        dom.industry.value = String(snap.industry || dom.industry.value || '').trim();
        dom.region.value = String(snap.region || dom.region.value || '').trim();
        dom.regs.value = Array.isArray(snap.regs) ? snap.regs.join(', ') : String(dom.regs.value || '').trim();
        dom.email.value = String(snap.email || dom.email.value || '').trim();
        dom.phone.value = String(snap.phone || dom.phone.value || '').trim();
        dom.notes.value = String(snap.notes || dom.notes.value || '').trim();
        dom.optin.checked = !!snap.optin;
        setCheckedValues('pressureSources', Array.isArray(snap.pressureSources) ? snap.pressureSources : []);
        setCheckedValues('groups', Array.isArray(snap.groups) ? snap.groups : []);
        setCheckedValues('riskEnvs', Array.isArray(snap.riskEnvs) ? snap.riskEnvs : []);
        setRadioValue('urgentWin', String(snap.urgentWin || '').trim());
        setRadioValue('fitScope', String(snap.fitScope || '').trim());
      }

      function followupCompanyLabel(){
        const fromForm = String((dom.company && dom.company.value) || '').trim();
        if(fromForm) return fromForm;
        const fromHint = String(state.companyHint || '').trim();
        if(fromHint) return fromHint;
        return '';
      }

      function applyHeroCopy(){
        const company = followupCompanyLabel();
        const followupCount = Array.isArray(state.followupModeKeys) ? state.followupModeKeys.length : 0;
        const followupMode = followupCount > 0;
        if(el.heroEyebrow){
          el.heroEyebrow.textContent = company || 'Immersive One';
        }
        if(el.heroTitle){
          el.heroTitle.textContent = followupMode
            ? (company ? `Outstanding questions for ${company}` : 'Outstanding questions')
            : 'Discovery follow-up form';
        }
        if(el.heroSubtitle){
          el.heroSubtitle.textContent = followupMode
            ? `Please complete the ${followupCount} requested question${followupCount === 1 ? '' : 's'}. This helps us align the platform recommendation to your needs.`
            : 'Please complete the requested questions. This helps us align the platform recommendation to your needs.';
        }
        if(el.heroTitle && String(el.heroTitle.textContent || '').trim()){
          document.title = `${String(el.heroTitle.textContent || '').trim()} | Immersive One`;
        }
      }

      function hydrateContextFromUrl(){
        const recordId = parseRecordIdFromUrl();
        const companyHint = parseCompanyFromUrl();
        if(recordId){
          state.recordId = recordId;
        }
        if(companyHint){
          state.companyHint = companyHint;
        }
        const linked = launchpadRecordById(state.recordId);
        if(linked){
          const linkedSnapshot = (linked.snapshot && typeof linked.snapshot === 'object') ? linked.snapshot : null;
          if(linkedSnapshot){
            applyLaunchpadSnapshot(linkedSnapshot);
          }
          state.status = String(linked.submissionStatus || state.status || 'draft_customer').trim() || 'draft_customer';
          if(!state.companyHint){
            state.companyHint = String((linkedSnapshot && linkedSnapshot.company) || linked.company || '').trim();
          }
        }
        if(!String((dom.company && dom.company.value) || '').trim() && state.companyHint){
          dom.company.value = state.companyHint;
        }
        applyHeroCopy();
      }

      function getCheckedValues(name){
        return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map((item)=> item.value);
      }

      function getRadioValue(name){
        const checked = document.querySelector(`input[name="${name}"]:checked`);
        return checked ? checked.value : '';
      }

      function normalizeOptionValue(name, value){
        const key = String(name || '').trim();
        const raw = String(value || '').trim();
        if(!raw) return '';
        const aliases = legacyValueAliases[key] || null;
        if(!aliases) return raw;
        return String(aliases[raw] || raw);
      }

      function normalizeOptionList(name, values){
        const list = Array.isArray(values) ? values : [];
        const seen = new Set();
        const out = [];
        list.forEach((value)=> {
          const mapped = normalizeOptionValue(name, value);
          if(!mapped || seen.has(mapped)) return;
          seen.add(mapped);
          out.push(mapped);
        });
        return out;
      }

      function setRadioValue(name, value){
        const target = normalizeOptionValue(name, value);
        Array.from(document.querySelectorAll(`input[name="${name}"]`)).forEach((item)=> {
          item.checked = item.value === target;
        });
      }

      function setCheckedValues(name, values){
        const set = new Set(normalizeOptionList(name, values));
        Array.from(document.querySelectorAll(`input[name="${name}"]`)).forEach((item)=> {
          item.checked = set.has(item.value);
        });
      }

      function groupOptionMeta(name, value){
        const node = document.querySelector(`input[name="${name}"][value="${CSS.escape(value)}"]`);
        if(!node){
          return {
            label: optionLabel(name, value),
            hint: ''
          };
        }
        const choiceNode = node.closest('.choice');
        const textNode = choiceNode && choiceNode.querySelector('.choice-row span:last-child');
        const hintNode = choiceNode && choiceNode.querySelector('small');
        return {
          label: textNode ? String(textNode.textContent || '').trim() : optionLabel(name, value),
          hint: hintNode ? String(hintNode.textContent || '').trim() : ''
        };
      }

      function groupOptionLabel(name, value){
        return groupOptionMeta(name, value).label;
      }

      function groupOptions(name){
        return Array.from(document.querySelectorAll(`input[name="${name}"]`)).map((node)=> {
          const meta = groupOptionMeta(name, node.value);
          return {
            value: node.value,
            label: meta.label,
            hint: meta.hint
          };
        });
      }

      function widgetSelectCardConfigFor(sourceId){
        const key = String(sourceId || '').trim();
        if(!key) return null;
        return widgetSelectCardConfig[key] || null;
      }

      function createSelectChoiceGrid(source, cfg, opts){
        if(!source || !(source instanceof HTMLSelectElement) || !cfg) return null;
        const options = Array.from(source.options || []).map((opt)=> ({
          value: String(opt.value || ''),
          label: String(opt.textContent || '').trim()
        }));
        const rows = options.filter((opt)=> String(opt.value || '').trim());
        if(!rows.length) return null;

        const grid = document.createElement('div');
        const cols = Number(cfg.columns) || 2;
        const variant = String(cfg.variant || 'cards').trim().toLowerCase();
        const isChipVariant = variant === 'chips';
        const useTwoColumns = !isChipVariant && rows.length > 3;
        grid.className = `choice-grid select-card-grid is-${Math.max(2, Math.min(5, cols))}${isChipVariant ? ' chips' : ''}${useTwoColumns ? ' two' : ''}`;
        const selectedValue = String((opts && opts.selectedValue) || '').trim();
        const nameKey = String((opts && opts.inputName) || `card_${source.id || source.name || 'select'}`).trim();
        const onSelect = (opts && typeof opts.onSelect === 'function') ? opts.onSelect : ()=> {};

        rows.forEach((row)=> {
          const meta = (cfg.options && cfg.options[row.value]) || null;
          const labelText = String((meta && meta.label) || row.label || row.value).trim();
          const hintText = String((meta && meta.hint) || '').trim();

          const labelNode = document.createElement('label');
          labelNode.className = `choice${isChipVariant ? ' chip-choice' : ''}`;

          const rowNode = document.createElement('span');
          rowNode.className = 'choice-row';

          const input = document.createElement('input');
          input.type = 'radio';
          input.name = nameKey;
          input.value = row.value;
          input.checked = selectedValue === row.value;
          input.addEventListener('change', ()=> {
            if(!input.checked) return;
            onSelect(row.value);
          });

          const text = document.createElement('span');
          text.textContent = labelText;
          rowNode.appendChild(input);
          rowNode.appendChild(text);
          labelNode.appendChild(rowNode);

          if(hintText){
            const hint = document.createElement('small');
            hint.textContent = hintText;
            labelNode.appendChild(hint);
          }

          grid.appendChild(labelNode);
        });

        return grid;
      }

      function applyWidgetSelectCardModes(){
        Object.keys(widgetSelectCardConfig).forEach((sourceId)=> {
          const source = document.getElementById(sourceId);
          if(!source || !(source instanceof HTMLSelectElement)) return;
          const cfg = widgetSelectCardConfigFor(sourceId);
          if(!cfg) return;

          let host = source.nextElementSibling;
          if(!(host && host.classList && host.classList.contains('select-card-host'))){
            host = document.createElement('div');
            host.className = 'select-card-host';
            source.insertAdjacentElement('afterend', host);
          }

          source.classList.add('select-card-source');
          source.setAttribute('aria-hidden', 'true');
          source.tabIndex = -1;

          const render = ()=> {
            host.innerHTML = '';
            const grid = createSelectChoiceGrid(source, cfg, {
              selectedValue: source.value,
              inputName: `widget_${sourceId}`,
              onSelect: (value)=> {
                if(String(source.value || '') === String(value || '')) return;
                source.value = value;
                source.dispatchEvent(new Event('change', { bubbles:true }));
                source.dispatchEvent(new Event('input', { bubbles:true }));
              }
            });
            if(grid) host.appendChild(grid);
          };

          if(!widgetSelectCardRenderers.has(sourceId)){
            source.addEventListener('change', render);
          }
          widgetSelectCardRenderers.set(sourceId, render);
          render();
        });
      }

      function syncWidgetSelectCardModes(){
        widgetSelectCardRenderers.forEach((render)=> {
          if(typeof render === 'function') render();
        });
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

      function hasFollowupContact(snapInput){
        const snap = (snapInput && typeof snapInput === 'object') ? snapInput : snapshot();
        const fullName = String((snap && snap.fullName) || '').trim();
        const email = String((snap && snap.email) || '').trim();
        const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        return !!fullName && emailOk;
      }

      function applyFollowupContactGate(snapInput){
        const keys = (Array.isArray(state.followupModeKeys) ? state.followupModeKeys : [])
          .filter((key)=> followupCatalogMap[key]);
        if(!keys.length){
          if(controls.btnApplyFollowupAnswers) controls.btnApplyFollowupAnswers.disabled = false;
          return;
        }
        if(el.customerFollowupPanel){
          el.customerFollowupPanel.classList.remove('is-locked');
        }
        if(el.customerFollowupGateAlert){
          el.customerFollowupGateAlert.hidden = true;
        }
        if(el.customerFollowupForm){
          Array.from(el.customerFollowupForm.querySelectorAll('input, select, textarea, button')).forEach((node)=> {
            node.disabled = false;
          });
        }
        if(controls.btnApplyFollowupAnswers){
          controls.btnApplyFollowupAnswers.disabled = false;
        }
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
          boardEvidence: 'board-ready evidence and benchmarks',
          fasterDecisions: 'faster detection and response decisions',
          attackSurface: 'attack-surface reduction',
          safeAI: 'safe AI adoption and governance',
          workforce: 'workforce readiness and retention',
          thirdParty: 'third-party resilience'
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
        const key = normalizeOptionValue(mapName, value);
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

      function renderSelectionSummary(snap, metrics){
        if(!snap || !metrics) return;
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
          el.selIntentBand.textContent = `${Math.max(0, Number(metrics.completionPct) || 0)}%`;
        }
        if(el.selAeReady){
          el.selAeReady.textContent = `${Math.max(0, Number(metrics.answeredCount) || 0)} / ${Math.max(1, Number(metrics.totalQuestions) || followupCatalog.length)}`;
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
        const company = String((dom.company && dom.company.value) || '').trim();
        if(company){
          url.searchParams.set('company', company);
        }
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
        wrap.dataset.followupStage = item.stage;

        const head = document.createElement('div');
        head.className = 'followup-item-head';
        const label = document.createElement('label');
        label.textContent = item.label;
        const metaWrap = document.createElement('div');
        metaWrap.className = 'followup-item-meta';
        const status = document.createElement('span');
        status.className = 'followup-state';
        status.textContent = 'Missing';
        head.appendChild(label);
        metaWrap.appendChild(status);
        head.appendChild(metaWrap);
        wrap.appendChild(head);

        const sourceValue = snap[item.key];
        if(item.kind === 'select'){
          const source = document.getElementById(item.sourceId);
          if(!source) return null;
          const cfg = widgetSelectCardConfigFor(item.sourceId);
          if(cfg){
            const cfgVariant = String(cfg.variant || 'cards').trim().toLowerCase();
            wrap.setAttribute('data-layout', cfgVariant === 'chips' ? 'chips' : 'cards');
            const grid = createSelectChoiceGrid(source, cfg, {
              selectedValue: sourceValue,
              inputName: `fu_${item.key}`,
              onSelect: (value)=> {
                source.value = value;
                source.dispatchEvent(new Event('change', { bubbles:true }));
                updatePreview();
              }
            });
            if(grid){
              wrap.appendChild(grid);
              return wrap;
            }
          }
          const options = Array.from(source.options || []).map((opt)=> ({
            value: String(opt.value || ''),
            label: String(opt.textContent || '').trim()
          }));
          const control = document.createElement('select');
          options.forEach((opt)=> {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
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
          const options = groupOptions(item.sourceName);
          const useTwoColumns = options.length > 3;
          const grid = document.createElement('div');
          grid.className = useTwoColumns ? 'choice-grid two' : 'choice-grid';
          const selected = String(sourceValue || '');
          if(options.some((opt)=> String(opt.hint || '').trim())){
            wrap.setAttribute('data-layout', 'cards');
          }
          options.forEach((opt)=> {
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
            if(opt.hint){
              const hint = document.createElement('small');
              hint.textContent = opt.hint;
              labelNode.appendChild(hint);
            }
            grid.appendChild(labelNode);
          });
          wrap.appendChild(grid);
          return wrap;
        }

        if(item.kind === 'checkbox'){
          const options = groupOptions(item.sourceName);
          const useTwoColumns = options.length > 3;
          const grid = document.createElement('div');
          grid.className = useTwoColumns ? 'choice-grid two' : 'choice-grid';
          const selected = new Set(Array.isArray(sourceValue) ? sourceValue : []);
          const useChipLayout = item.sourceName === 'groups' && !options.some((opt)=> String(opt.hint || '').trim());
          if(useChipLayout){
            grid.className = 'choice-grid chips';
            wrap.setAttribute('data-layout', 'chips');
          }
          if(options.some((opt)=> String(opt.hint || '').trim())){
            wrap.setAttribute('data-layout', 'cards');
          }
          options.forEach((opt)=> {
            const labelNode = document.createElement('label');
            labelNode.className = `choice${useChipLayout ? ' chip-choice' : ''}`;
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
            if(opt.hint){
              const hint = document.createElement('small');
              hint.textContent = opt.hint;
              labelNode.appendChild(hint);
            }
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

      function updateFollowupModeProgress(snapInput){
        const keys = (Array.isArray(state.followupModeKeys) ? state.followupModeKeys : [])
          .filter((key)=> followupCatalogMap[key]);
        if(!keys.length) return;
        const snap = (snapInput && typeof snapInput === 'object') ? snapInput : snapshot();
        let complete = 0;
        keys.forEach((key)=> {
          if(isFilled(snap[key])) complete += 1;
        });
        const pct = Math.round((complete / Math.max(1, keys.length)) * 100);

        if(el.customerFollowupCompletion){
          el.customerFollowupCompletion.textContent = `${complete}/${keys.length} complete`;
        }
        if(el.customerFollowupProgressLabel){
          el.customerFollowupProgressLabel.textContent = `Completion: ${pct}%`;
        }
        if(el.customerFollowupProgressBar){
          el.customerFollowupProgressBar.style.width = `${pct}%`;
        }
        if(el.customerFollowupSummary){
          el.customerFollowupSummary.hidden = false;
        }
        if(el.customerFollowupForm){
          Array.from(el.customerFollowupForm.querySelectorAll('.followup-item[data-followup-key]')).forEach((node)=> {
            const key = String(node.getAttribute('data-followup-key') || '').trim();
            if(!key) return;
            const filled = isFilled(snap[key]);
            node.setAttribute('data-complete', filled ? 'true' : 'false');
            const stateChip = node.querySelector('.followup-state');
            if(stateChip){
              stateChip.textContent = filled ? 'Complete' : 'Missing';
            }
          });
        }
      }

      function activateFollowupModeFromUrl(){
        const keys = parseFollowupKeysFromUrl();
        if(!keys.length) return;
        state.followupModeKeys = keys;
        document.body.setAttribute('data-followup-mode', 'true');
        if(el.customerFollowupPanel){
          el.customerFollowupPanel.hidden = false;
        }
        if(el.customerFollowupCount){
          el.customerFollowupCount.textContent = `${keys.length} outstanding question${keys.length === 1 ? '' : 's'}`;
        }
        if(el.customerFollowupIntro){
          el.customerFollowupIntro.textContent = `Please complete these ${keys.length} outstanding question${keys.length === 1 ? '' : 's'} so we can tailor your recommendation.`;
        }
        ensureStageVisibilityForKeys(keys);
        if(el.fullQuestionnaireAccordion){
          el.fullQuestionnaireAccordion.open = false;
        }
        renderCustomerFollowupForm(keys);
        const snap = snapshot();
        updateFollowupModeProgress(snap);
        applyFollowupContactGate(snap);
        if(el.customerFollowupForm){
          const firstControl = el.customerFollowupForm.querySelector('select, input, textarea');
          if(firstControl){
            window.requestAnimationFrame(()=> {
              firstControl.focus({ preventScroll: true });
            });
          }
        }
        applyHeroCopy();
      }

      function generateFollowupEmail(){
        const selected = (Array.isArray(state.followupSelectedKeys) ? state.followupSelectedKeys : []).filter((key)=> followupCatalogMap[key]);
        if(!selected.length){
          showMessage('Select at least one unanswered field before generating the follow-up email.', 'error');
          return;
        }
        const snap = snapshot();
        const record = buildRecord(false);
        const firstName = String((snap.fullName || '').trim().split(/\s+/)[0] || '');
        const greeting = firstName ? `Hi ${firstName},` : 'Hi,';
        const focusBits = [];
        if(snap.urgentWin) focusBits.push(optionLabel('urgentWin', snap.urgentWin).toLowerCase());
        if(snap.fitScope) focusBits.push(`${optionLabel('fitScope', snap.fitScope).toLowerCase()} scope`);
        const focusLine = focusBits.length
          ? `Based on your focus on ${focusBits.join(' and ')},`
          : 'Based on your initial configurator submission,';
        const link = buildFollowupFormUrl(record.recordId, selected);
        const questionLines = selected.map((key)=> `- ${followupCatalogMap[key].label}`);
        const followupCopy = copyRulesCall('buildFollowupEmail', {
          audience: followupAudienceHint(snap),
          role: String(snap.role || '').trim(),
          mode: String(snap.fieldMode || '').trim().toLowerCase(),
          company: String(snap.company || state.companyHint || '').trim() || 'your organization',
          firstName,
          focusLine: `${focusLine} we just need a few extra details to tailor the recommendation:`,
          questionLines,
          link
        });
        const subject = (followupCopy && String(followupCopy.subject || '').trim()) || 'Quick follow-up on your configurator submission';
        const body = (followupCopy && Array.isArray(followupCopy.bodyLines) && followupCopy.bodyLines.length)
          ? followupCopy.bodyLines.join('\n')
          : [
              greeting,
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
              'Immersive team'
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
        syncWidgetSelectCardModes();
        const snap = snapshot();
        const rec = buildRecord(false);
        const totalQuestions = followupCatalog.length;
        const answeredCount = followupCatalog.reduce((count, item)=> count + (isFilled(snap[item.key]) ? 1 : 0), 0);
        const outstandingCount = Math.max(0, totalQuestions - answeredCount);
        const completionPct = Math.round((answeredCount / Math.max(1, totalQuestions)) * 100);

        if(el.aeReadyText) el.aeReadyText.textContent = `${answeredCount} / ${totalQuestions}`;
        if(el.intentScoreText) el.intentScoreText.textContent = `${outstandingCount}`;
        if(el.intentBandText) el.intentBandText.textContent = `${completionPct}%`;
        if(el.aeProgressBar) el.aeProgressBar.style.width = `${completionPct}%`;

        const pressureCount = (rec.selections.pressureSources || []).length;
        if(el.pressureCount) el.pressureCount.textContent = String(pressureCount);

        if(el.pillRow){
          el.pillRow.innerHTML = '';
          [
            `Status: ${rec.submissionStatus}`,
            `Outstanding: ${outstandingCount}`,
            `Completed: ${answeredCount}/${totalQuestions}`
          ].forEach((text)=> {
            const span = document.createElement('span');
            span.className = 'pill';
            span.textContent = text;
            el.pillRow.appendChild(span);
          });
        }

        if(el.recordPreview){
          el.recordPreview.textContent = JSON.stringify(rec, null, 2);
        }
        renderSelectionSummary(snap, { completionPct, answeredCount, totalQuestions });
        applyHeroCopy();
        renderInitialRecommendation(rec.recommendation || null);
        updateFollowupModeProgress(snap);
        applyFollowupContactGate(snap);
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
          showMessage(`Please complete the required questions${check.missing.includes('email') ? ' and add your business email' : ''}.`, 'error');
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

        const notes = ['Responses submitted successfully.'];
        if(syncResult.ok){
          notes.push(`Your record was ${syncResult.created ? 'created' : 'updated'}.`);
        }else{
          notes.push(`Record sync failed (${syncResult.error}).`);
        }
        if(endpoint){
          notes.push(endpointError ? `Submission service failed (${endpointError}).` : 'Submission sent.');
        }
        if(window.location.protocol === 'file:'){
          notes.push('If this page does not update, run both pages from the same local web server origin.');
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
        dom.measuredOn.value = normalizeOptionValue('measuredOn', selections.measuredOn || '');
        dom.orgPain.value = normalizeOptionValue('orgPain', selections.orgPain || '');
        dom.rhythm.value = normalizeOptionValue('rhythm', selections.rhythm || '');

        dom.fitRealism.value = selections.fitRealism || '';
        dom.fitToday.value = normalizeOptionValue('fitToday', selections.fitToday || '');
        dom.fitServices.value = selections.fitServices || '';
        dom.fitRiskFrame.value = normalizeOptionValue('fitRiskFrame', selections.fitRiskFrame || '');
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
          showMessage('Complete the required Stage A questions to preview a recommendation.', 'error');
          return;
        }
        state.generatedRecommendation = buildInitialRecommendation(check.snap);
        state.recommendationSeen = true;
        showMessage('Recommendation preview generated. You can now submit or add optional details.', 'good');
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

      applyWidgetSelectCardModes();
      hydrateContextFromUrl();
      activateFollowupModeFromUrl();
      attachInputListeners();
      updatePreview();
    })();
