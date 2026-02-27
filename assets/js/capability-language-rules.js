/* Auto-generated from assets/data/capability-language-rules.v1.csv on 2026-02-27T09:22:25.853Z. */
/* eslint-disable */
(function(){
  const rows = [
  {
    "ruleId": "dtr_faster_response",
    "capabilityId": "dynamic-threat-range",
    "outcomeId": "fasterResponse",
    "signalToken": "*",
    "priority": 100,
    "bulletTemplate": "Gives your SOC a controlled way to improve time-to-detect and time-to-respond against realistic attack paths.",
    "enabled": true,
    "order": 25
  },
  {
    "ruleId": "benchmark_compliance",
    "capabilityId": "benchmark-reporting",
    "outcomeId": "complianceEvidence",
    "signalToken": "*",
    "priority": 100,
    "bulletTemplate": "Creates reporting views that make compliance progress easier to communicate externally.",
    "enabled": true,
    "order": 26
  },
  {
    "ruleId": "appsec_enterprise",
    "capabilityId": "appsec-range-exercises",
    "outcomeId": "secureEnterprise",
    "signalToken": "github",
    "priority": 100,
    "bulletTemplate": "Strengthens secure SDLC behavior by linking remediation quality to real development workflows.",
    "enabled": true,
    "order": 27
  },
  {
    "ruleId": "workforce_uplift",
    "capabilityId": "workforce-exercising",
    "outcomeId": "cyberWorkforce",
    "signalToken": "*",
    "priority": 100,
    "bulletTemplate": "Improves workforce behavior where human risk concentrates and tracks uplift by cohort.",
    "enabled": true,
    "order": 28
  },
  {
    "ruleId": "secure_ai_focus",
    "capabilityId": "secure-ai-readiness",
    "outcomeId": "secureAI",
    "signalToken": "*",
    "priority": 100,
    "bulletTemplate": "Focuses teams on practical AI risks such as prompt injection, unsafe output, and data leakage.",
    "enabled": true,
    "order": 29
  },
  {
    "ruleId": "integrated_evidence",
    "capabilityId": "integrated-readiness",
    "outcomeId": "complianceEvidence",
    "signalToken": "*",
    "priority": 100,
    "bulletTemplate": "Makes readiness evidence easier to collect continuously across collaboration, code, and LMS systems.",
    "enabled": true,
    "order": 30
  },
  {
    "ruleId": "outcome_faster_response",
    "capabilityId": "*",
    "outcomeId": "fasterResponse",
    "signalToken": "*",
    "priority": 90,
    "bulletTemplate": "Helps your teams detect, decide, and respond faster when pressure is highest.",
    "enabled": true,
    "order": 0
  },
  {
    "ruleId": "outcome_secure_enterprise",
    "capabilityId": "*",
    "outcomeId": "secureEnterprise",
    "signalToken": "*",
    "priority": 90,
    "bulletTemplate": "Reduces exploitable risk across code, cloud, and identity with practical, repeatable workflows.",
    "enabled": true,
    "order": 1
  },
  {
    "ruleId": "outcome_compliance",
    "capabilityId": "*",
    "outcomeId": "complianceEvidence",
    "signalToken": "*",
    "priority": 90,
    "bulletTemplate": "Turns readiness activity into defensible evidence for board, audit, and regulator conversations.",
    "enabled": true,
    "order": 2
  },
  {
    "ruleId": "outcome_workforce",
    "capabilityId": "*",
    "outcomeId": "cyberWorkforce",
    "signalToken": "*",
    "priority": 90,
    "bulletTemplate": "Builds role-based capability and gives leaders clearer visibility of readiness across teams.",
    "enabled": true,
    "order": 3
  },
  {
    "ruleId": "outcome_secure_ai",
    "capabilityId": "*",
    "outcomeId": "secureAI",
    "signalToken": "*",
    "priority": 90,
    "bulletTemplate": "Supports secure AI adoption with tested controls and accountable governance practices.",
    "enabled": true,
    "order": 4
  },
  {
    "ruleId": "outcome_supply_chain",
    "capabilityId": "*",
    "outcomeId": "supplyChain",
    "signalToken": "*",
    "priority": 90,
    "bulletTemplate": "Improves confidence in third-party resilience with measurable exercises and follow-through.",
    "enabled": true,
    "order": 5
  },
  {
    "ruleId": "signal_teams",
    "capabilityId": "*",
    "outcomeId": "*",
    "signalToken": "microsoft teams",
    "priority": 75,
    "bulletTemplate": "Keeps assignments and nudges in Microsoft Teams so adoption is easier for operational teams.",
    "enabled": true,
    "order": 16
  },
  {
    "ruleId": "signal_github",
    "capabilityId": "*",
    "outcomeId": "*",
    "signalToken": "github",
    "priority": 75,
    "bulletTemplate": "Aligns to your GitHub workflow and helps make secure development behavior measurable.",
    "enabled": true,
    "order": 17
  },
  {
    "ruleId": "signal_rest_api",
    "capabilityId": "*",
    "outcomeId": "*",
    "signalToken": "rest api",
    "priority": 75,
    "bulletTemplate": "Supports automation and provisioning through API-first workflows already used by your teams.",
    "enabled": true,
    "order": 18
  },
  {
    "ruleId": "signal_workday",
    "capabilityId": "*",
    "outcomeId": "*",
    "signalToken": "workday",
    "priority": 75,
    "bulletTemplate": "Fits your Workday ecosystem so readiness progress can be tracked in existing HR and L&D workflows.",
    "enabled": true,
    "order": 19
  },
  {
    "ruleId": "signal_successfactors",
    "capabilityId": "*",
    "outcomeId": "*",
    "signalToken": "successfactors",
    "priority": 75,
    "bulletTemplate": "Fits SAP SuccessFactors workflows so readiness records stay aligned with talent operations.",
    "enabled": true,
    "order": 20
  },
  {
    "ruleId": "signal_cornerstone",
    "capabilityId": "*",
    "outcomeId": "*",
    "signalToken": "cornerstone",
    "priority": 75,
    "bulletTemplate": "Fits Cornerstone workflows to keep workforce readiness evidence connected to existing learning systems.",
    "enabled": true,
    "order": 21
  },
  {
    "ruleId": "signal_splunk",
    "capabilityId": "*",
    "outcomeId": "*",
    "signalToken": "splunk",
    "priority": 75,
    "bulletTemplate": "Maps to Splunk-led SOC workflows so detection and response capability is tested in realistic conditions.",
    "enabled": true,
    "order": 22
  },
  {
    "ruleId": "signal_elastic",
    "capabilityId": "*",
    "outcomeId": "*",
    "signalToken": "elastic",
    "priority": 75,
    "bulletTemplate": "Maps to Elastic workflows so threat detection and investigation readiness can be measured more directly.",
    "enabled": true,
    "order": 23
  },
  {
    "ruleId": "signal_crowdstrike",
    "capabilityId": "*",
    "outcomeId": "*",
    "signalToken": "crowdstrike",
    "priority": 75,
    "bulletTemplate": "Reinforces CrowdStrike-centered response workflows with measurable execution under pressure.",
    "enabled": true,
    "order": 24
  },
  {
    "ruleId": "capability_integrated",
    "capabilityId": "integrated-readiness",
    "outcomeId": "*",
    "signalToken": "*",
    "priority": 70,
    "bulletTemplate": "Connects readiness into daily systems so capability is built in, not bolted on.",
    "enabled": true,
    "order": 6
  },
  {
    "ruleId": "capability_drills",
    "capabilityId": "cyber-drills",
    "outcomeId": "*",
    "signalToken": "*",
    "priority": 70,
    "bulletTemplate": "Runs cross-functional cyber simulations that show how teams perform when decisions matter most.",
    "enabled": true,
    "order": 7
  },
  {
    "ruleId": "capability_crisis",
    "capabilityId": "crisis-sim",
    "outcomeId": "*",
    "signalToken": "*",
    "priority": 70,
    "bulletTemplate": "Tests leadership judgment and crisis coordination under realistic pressure.",
    "enabled": true,
    "order": 8
  },
  {
    "ruleId": "capability_dtr",
    "capabilityId": "dynamic-threat-range",
    "outcomeId": "*",
    "signalToken": "*",
    "priority": 70,
    "bulletTemplate": "Places SOC teams in high-fidelity enterprise scenarios to prove operational readiness.",
    "enabled": true,
    "order": 9
  },
  {
    "ruleId": "capability_labs",
    "capabilityId": "hands-on-labs",
    "outcomeId": "*",
    "signalToken": "*",
    "priority": 70,
    "bulletTemplate": "Targets practical skill gaps with role-based labs that are tied to real threat patterns.",
    "enabled": true,
    "order": 10
  },
  {
    "ruleId": "capability_appsec_range",
    "capabilityId": "appsec-range-exercises",
    "outcomeId": "*",
    "signalToken": "*",
    "priority": 70,
    "bulletTemplate": "Builds secure development behavior through collaborative remediation and verification loops.",
    "enabled": true,
    "order": 11
  },
  {
    "ruleId": "capability_workforce",
    "capabilityId": "workforce-exercising",
    "outcomeId": "*",
    "signalToken": "*",
    "priority": 70,
    "bulletTemplate": "Drives measurable behavior change across non-technical and mixed teams.",
    "enabled": true,
    "order": 12
  },
  {
    "ruleId": "capability_benchmark",
    "capabilityId": "benchmark-reporting",
    "outcomeId": "*",
    "signalToken": "*",
    "priority": 70,
    "bulletTemplate": "Converts performance data into benchmark and evidence views leaders can act on.",
    "enabled": true,
    "order": 13
  },
  {
    "ruleId": "capability_programs",
    "capabilityId": "programs",
    "outcomeId": "*",
    "signalToken": "*",
    "priority": 70,
    "bulletTemplate": "Establishes a governed cadence so readiness improves continuously, not sporadically.",
    "enabled": true,
    "order": 14
  },
  {
    "ruleId": "capability_secure_ai",
    "capabilityId": "secure-ai-readiness",
    "outcomeId": "*",
    "signalToken": "*",
    "priority": 70,
    "bulletTemplate": "Improves AI risk readiness with scenario-based controls testing and practical guardrails.",
    "enabled": true,
    "order": 15
  }
];
  window.immersiveCapabilityLanguageRules = Object.freeze({
    version: 'capability-language-rules.v1',
    rows: Object.freeze(rows.map((row)=> Object.freeze(row)))
  });
})();
