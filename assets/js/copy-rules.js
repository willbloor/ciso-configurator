// Structured copy rules layer for on-brand generation across landing page and email surfaces.
(function(){
  'use strict';

  function asText(value){
    return String(value == null ? '' : value).trim();
  }

  function asList(value){
    return Array.isArray(value) ? value.map((item)=> asText(item)).filter(Boolean) : [];
  }

  function naturalList(items, conjunction){
    const rows = asList(items);
    if(!rows.length) return '';
    if(rows.length === 1) return rows[0];
    if(rows.length === 2) return `${rows[0]} ${conjunction || 'and'} ${rows[1]}`;
    const tail = rows[rows.length - 1];
    return `${rows.slice(0, -1).join(', ')}, ${conjunction || 'and'} ${tail}`;
  }

  function normalizeWhitespace(text){
    return asText(text)
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.;:!?])/g, '$1')
      .trim();
  }

  function normalizeTerminology(raw){
    let text = asText(raw);
    if(!text) return '';
    const replacements = [
      [/\bImmersive Labs\b/g, 'Immersive'],
      [/\bcyber security\b/gi, 'cybersecurity'],
      [/\bEbook\b/g, 'E-book'],
      [/\beBook\b/g, 'E-book'],
      [/\bbusinesses\b/gi, 'organizations'],
      [/\bbusiness\b/gi, 'organization'],
      [/\bstaff\b/gi, 'workforce'],
      [/\bwe might\b/gi, 'we will'],
      [/\bMore than\b/g, 'More than']
    ];
    replacements.forEach(([pattern, next])=> {
      text = text.replace(pattern, next);
    });
    text = text.replace(/!{2,}/g, '!');
    return normalizeWhitespace(text);
  }

  function inferAudience(input){
    const explicit = asText(input && input.audience).toLowerCase();
    if(explicit && ['executive', 'manager', 'practitioner', 'sdr'].includes(explicit)){
      return explicit;
    }
    const mode = asText(input && input.mode).toLowerCase();
    if(mode === 'sdr-lite' || mode === 'sdr'){
      return 'sdr';
    }
    const role = asText(input && input.role).toLowerCase();
    if(!role) return 'manager';
    if(/ciso|chief|vp|vice president|director|executive|board/.test(role)) return 'executive';
    if(/manager|head|lead/.test(role)) return 'manager';
    if(/soc|analyst|engineer|developer|architect|incident|dfir|offensive|grc|compliance/.test(role)) return 'practitioner';
    return 'manager';
  }

  function audienceLens(audience){
    if(audience === 'executive'){
      return {
        need: 'turn cyber readiness into board-ready evidence',
        prove: 'pressure-test decision-making and operational readiness',
        improve: 'close capability gaps with measurable improvement',
        report: 'benchmark progress and report outcomes with confidence',
        close: 'If useful, reply with your board reporting priorities and we will tailor this to your stakeholder language.'
      };
    }
    if(audience === 'practitioner'){
      return {
        need: 'strengthen detection, response, and collaboration under pressure',
        prove: 'validate playbooks against realistic attack paths',
        improve: 'target role-specific skill gaps and improve response quality',
        report: 'track performance deltas and evidence by team and workflow',
        close: 'If useful, reply with your team focus and we will tailor this for your technical audience.'
      };
    }
    if(audience === 'sdr'){
      return {
        need: 'align the right package and next-step conversation quickly',
        prove: 'show current readiness and where confidence is strongest',
        improve: 'prioritize the first skills and process improvements',
        report: 'share a clean evidence narrative with key stakeholders',
        close: 'If useful, reply with your target audience and we will provide a send-ready version.'
      };
    }
    return {
      need: 'align leadership and teams around measurable readiness outcomes',
      prove: 'prove readiness in realistic, high-pressure scenarios',
      improve: 'improve capability where risk is concentrated',
      report: 'benchmark and report progress in an evidence-led way',
      close: 'If useful, reply with your target audience and we will tailor this into a send-ready version.'
    };
  }

  function buildLandingCopy(input){
    const company = asText(input && input.company) || 'This organization';
    const audience = inferAudience(input);
    const lens = audienceLens(audience);
    const outcomes = asList(input && input.topOutcomes);
    const coverage = asList(input && input.coverageGroups);
    const pressure = asList(input && input.pressureSignals);
    const outcomeText = outcomes.length ? naturalList(outcomes.slice(0, 3), 'and') : 'your priority readiness outcomes';
    const coverageText = coverage.length ? naturalList(coverage.slice(0, 3), 'and') : 'your priority teams';
    const pressureText = pressure.length ? naturalList(pressure.slice(0, 2), 'and') : 'stakeholder pressure';

    const subtitle = normalizeTerminology([
      `Prove, improve, benchmark, and report cyber resilience with Immersive One.`,
      `${company} can ${lens.need} across ${coverageText}.`,
      `Based on what you shared, this plan focuses on ${outcomeText}.`
    ].join(' '));

    const needsSummary = normalizeTerminology([
      `Your current priorities are ${outcomeText}.`,
      `Coverage is centered on ${coverageText}.`,
      `Current pressure is coming from ${pressureText}.`
    ].join(' '));

    return {
      audience,
      heroEyebrow: 'Be Ready with Immersive',
      heroTitle: `${company} cyber readiness dashboard`,
      heroSubtitle: subtitle,
      needsSummary,
      demoCardText: normalizeTerminology('See how Immersive One brings realistic exercises, hands-on labs, and stakeholder-ready reporting into one workflow.'),
      valueCards: {
        prove: {
          title: 'Prove cyber resilience under pressure',
          text: normalizeTerminology(`Use realistic scenarios to ${lens.prove} and map performance to outcomes that matter.`),
          bullets: [
            normalizeTerminology('Run realistic exercises across technical and leadership roles'),
            normalizeTerminology('Measure speed, accuracy, and decision quality in context'),
            normalizeTerminology('Capture evidence suitable for leadership and external review')
          ]
        },
        improve: {
          title: 'Improve capability where risk is highest',
          text: normalizeTerminology(`Use role-specific, hands-on exercises to ${lens.improve} across ${coverageText}.`),
          bullets: [
            normalizeTerminology('Prioritize the highest-impact skills and workflows first'),
            normalizeTerminology('Build repeatable capability through continuous practice'),
            normalizeTerminology('Track individual and team improvement over time')
          ]
        },
        report: {
          title: 'Benchmark and report with confidence',
          text: normalizeTerminology(`Turn performance data into evidence that helps you ${lens.report}.`),
          bullets: [
            normalizeTerminology('Benchmark progress against expected standards and peers'),
            normalizeTerminology('Create stakeholder-ready reporting grounded in performance data'),
            normalizeTerminology('Prioritize next actions with clear ownership')
          ]
        }
      }
    };
  }

  function buildContentEmail(input){
    const company = asText(input && input.company) || 'your organization';
    const tier = asText(input && input.tier) || 'Core';
    const completion = asText(input && input.completion) || '0/22 (0%)';
    const audience = inferAudience(input);
    const lens = audienceLens(audience);
    const outcomes = asList(input && input.topOutcomes);
    const outcomesText = outcomes.length ? naturalList(outcomes.slice(0, 3), 'and') : 'your selected priorities';

    return {
      audience,
      subject: normalizeTerminology(`Immersive content plan for ${company} (${tier})`),
      greeting: 'Hi {{First Name}},',
      intro: normalizeTerminology(`Based on your current ${company} profile (${completion}, ${tier} package), here is a curated content plan aligned to ${outcomesText}.`),
      profileHeading: 'Profile summary',
      signalsHeading: 'Signals captured',
      recommendationsHeading: 'Recommended content blocks',
      close: normalizeTerminology(lens.close),
      signature: 'Immersive team'
    };
  }

  function buildFollowupEmail(input){
    const company = asText(input && input.company) || 'your organization';
    const firstName = asText(input && input.firstName);
    const greeting = firstName ? `Hi ${firstName},` : 'Hi,';
    const link = asText(input && input.link);
    const focusLine = asText(input && input.focusLine) || 'We have a few follow-up questions to complete your recommendation.';
    const questionLines = asList(input && input.questionLines);
    const audience = inferAudience(input);
    const lens = audienceLens(audience);
    const subject = normalizeTerminology(`Quick follow-up on your configurator submission (${company})`);
    const bodyLines = [
      greeting,
      '',
      'Thanks again for your configurator submission.',
      normalizeTerminology(focusLine),
      ...questionLines.map((line)=> normalizeTerminology(line)),
      '',
      'Please use this short follow-up form:',
      link || '(follow-up link unavailable in this environment)',
      '',
      normalizeTerminology(lens.close.replace(/^If useful, /, '')),
      '',
      'Thanks,',
      'Immersive team'
    ];

    return {
      audience,
      subject,
      bodyLines
    };
  }

  window.immersiveCopyRules = {
    version: '2026-02-26.v1',
    source: {
      toneOfVoice: 'Immersive Tone of Voice Guidelines (Approved Copy)',
      masterMessaging: 'Immersive Master Messaging (Last Updated: 30 Oct 2025)'
    },
    inferAudience: inferAudience,
    normalizeTerminology: normalizeTerminology,
    buildLandingCopy: buildLandingCopy,
    buildContentEmail: buildContentEmail,
    buildFollowupEmail: buildFollowupEmail
  };
})();
