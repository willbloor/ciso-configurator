/* Auto-generated from assets/data/readiness-pyramid-model.v1.csv on 2026-02-27T16:48:06.006Z. */
/* eslint-disable */
(function(){
  const rows = [
  {
    "id": "pain_decision_speed",
    "type": "pain",
    "layerOrder": 1,
    "title": "Decision speed under pressure",
    "description": "Incident decisions and cross-team coordination are too slow when pressure spikes.",
    "questionKeys": [
      "pressureSources",
      "urgentWin",
      "riskEnvs",
      "measuredOn",
      "orgPain"
    ],
    "optionIds": [
      "board",
      "regulator",
      "insurer",
      "fasterDecisions",
      "socir",
      "mttd",
      "coordination"
    ],
    "painIds": [],
    "outcomeIds": [
      "fasterResponse",
      "complianceEvidence"
    ],
    "capabilityIds": [
      "cyber-drills",
      "crisis-sim",
      "dynamic-threat-range",
      "benchmark-reporting"
    ],
    "pibrTrack": "Prove",
    "contentTags": [
      "incident-response",
      "crisis",
      "board-reporting"
    ],
    "enabled": true,
    "order": 0
  },
  {
    "id": "pain_evidence_gap",
    "type": "pain",
    "layerOrder": 1,
    "title": "Evidence confidence gap",
    "description": "Security activity exists but evidence is not yet board-ready or audit-defensible.",
    "questionKeys": [
      "pressureSources",
      "urgentWin",
      "measuredOn",
      "orgPain",
      "regs"
    ],
    "optionIds": [
      "board",
      "regulator",
      "insurer",
      "boardEvidence",
      "audit",
      "notMeasured",
      "externalProof"
    ],
    "painIds": [],
    "outcomeIds": [
      "complianceEvidence",
      "fasterResponse"
    ],
    "capabilityIds": [
      "benchmark-reporting",
      "programs",
      "integrated-readiness"
    ],
    "pibrTrack": "Benchmark & Report",
    "contentTags": [
      "audit",
      "benchmark",
      "governance"
    ],
    "enabled": true,
    "order": 1
  },
  {
    "id": "pain_attack_surface",
    "type": "pain",
    "layerOrder": 1,
    "title": "Attack surface and remediation drag",
    "description": "Code, cloud, and identity risk closes too slowly and creates avoidable exposure.",
    "questionKeys": [
      "urgentWin",
      "riskEnvs",
      "groups",
      "stack"
    ],
    "optionIds": [
      "attackSurface",
      "code",
      "cloud",
      "identity",
      "enterpriseApps",
      "appsec",
      "cloud",
      "identity",
      "github"
    ],
    "painIds": [],
    "outcomeIds": [
      "secureEnterprise"
    ],
    "capabilityIds": [
      "appsec-range-exercises",
      "hands-on-labs",
      "integrated-readiness"
    ],
    "pibrTrack": "Improve",
    "contentTags": [
      "appsec",
      "cloud",
      "identity",
      "devsecops"
    ],
    "enabled": true,
    "order": 2
  },
  {
    "id": "pain_workforce_readiness",
    "type": "pain",
    "layerOrder": 1,
    "title": "Workforce readiness visibility",
    "description": "Role readiness is inconsistent and progression is hard to prove across teams.",
    "questionKeys": [
      "urgentWin",
      "orgPain",
      "measuredOn",
      "groups",
      "stack"
    ],
    "optionIds": [
      "workforce",
      "skillsCoverage",
      "training",
      "workforce",
      "workday",
      "successfactors",
      "cornerstone",
      "msteams"
    ],
    "painIds": [],
    "outcomeIds": [
      "cyberWorkforce",
      "complianceEvidence"
    ],
    "capabilityIds": [
      "workforce-exercising",
      "hands-on-labs",
      "programs",
      "integrated-readiness"
    ],
    "pibrTrack": "Improve",
    "contentTags": [
      "workforce",
      "lms",
      "readiness"
    ],
    "enabled": true,
    "order": 3
  },
  {
    "id": "pain_ai_risk",
    "type": "pain",
    "layerOrder": 1,
    "title": "AI adoption risk and uncertainty",
    "description": "AI use is moving faster than governance, controls, and practical testing.",
    "questionKeys": [
      "urgentWin",
      "orgPain",
      "riskEnvs",
      "stack",
      "regs"
    ],
    "optionIds": [
      "safeAI",
      "aiRisk",
      "code",
      "cloud",
      "ai",
      "euaiact",
      "iso42001",
      "nistairmf"
    ],
    "painIds": [],
    "outcomeIds": [
      "secureAI",
      "secureEnterprise"
    ],
    "capabilityIds": [
      "secure-ai-readiness",
      "hands-on-labs",
      "benchmark-reporting"
    ],
    "pibrTrack": "Improve",
    "contentTags": [
      "secure-ai",
      "governance",
      "controls"
    ],
    "enabled": true,
    "order": 4
  },
  {
    "id": "pain_third_party",
    "type": "pain",
    "layerOrder": 1,
    "title": "Third-party and supply-chain exposure",
    "description": "Vendor dependency and partner risk create uncertainty in detection and containment.",
    "questionKeys": [
      "urgentWin",
      "orgPain",
      "pressureSources",
      "groups",
      "regs"
    ],
    "optionIds": [
      "thirdParty",
      "vendorRisk",
      "customers",
      "third",
      "nist800161",
      "dfars7012",
      "cmmc"
    ],
    "painIds": [],
    "outcomeIds": [
      "supplyChain",
      "complianceEvidence"
    ],
    "capabilityIds": [
      "cyber-drills",
      "benchmark-reporting",
      "programs"
    ],
    "pibrTrack": "Prove",
    "contentTags": [
      "supply-chain",
      "vendor-risk",
      "resilience"
    ],
    "enabled": true,
    "order": 5
  },
  {
    "id": "outcome_fasterResponse",
    "type": "outcome",
    "layerOrder": 2,
    "title": "Prove faster detection, response, and decision-making",
    "description": "Cut MTTD/MTTR and improve response quality in realistic pressure scenarios.",
    "questionKeys": [],
    "optionIds": [],
    "painIds": [
      "pain_decision_speed",
      "pain_evidence_gap",
      "pain_third_party"
    ],
    "outcomeIds": [
      "fasterResponse"
    ],
    "capabilityIds": [
      "cyber-drills",
      "crisis-sim",
      "dynamic-threat-range"
    ],
    "pibrTrack": "Prove",
    "contentTags": [
      "mttd",
      "mttr",
      "incident-response"
    ],
    "enabled": true,
    "order": 6
  },
  {
    "id": "outcome_secureEnterprise",
    "type": "outcome",
    "layerOrder": 2,
    "title": "Secure the modern enterprise",
    "description": "Reduce exploitable risk across code, cloud, identity, and operational workflows.",
    "questionKeys": [],
    "optionIds": [],
    "painIds": [
      "pain_attack_surface",
      "pain_ai_risk"
    ],
    "outcomeIds": [
      "secureEnterprise"
    ],
    "capabilityIds": [
      "hands-on-labs",
      "appsec-range-exercises",
      "integrated-readiness"
    ],
    "pibrTrack": "Improve",
    "contentTags": [
      "appsec",
      "cloud",
      "identity"
    ],
    "enabled": true,
    "order": 7
  },
  {
    "id": "outcome_secureAI",
    "type": "outcome",
    "layerOrder": 2,
    "title": "Enable secure AI adoption and governance",
    "description": "Adopt AI with tested controls, measurable readiness, and accountable governance.",
    "questionKeys": [],
    "optionIds": [],
    "painIds": [
      "pain_ai_risk"
    ],
    "outcomeIds": [
      "secureAI"
    ],
    "capabilityIds": [
      "secure-ai-readiness",
      "hands-on-labs",
      "benchmark-reporting"
    ],
    "pibrTrack": "Improve",
    "contentTags": [
      "ai-governance",
      "prompt-injection"
    ],
    "enabled": true,
    "order": 8
  },
  {
    "id": "outcome_complianceEvidence",
    "type": "outcome",
    "layerOrder": 2,
    "title": "Transform compliance into evidence and benchmarks",
    "description": "Translate readiness into auditable proof mapped to board and regulatory expectations.",
    "questionKeys": [],
    "optionIds": [],
    "painIds": [
      "pain_evidence_gap",
      "pain_decision_speed",
      "pain_third_party"
    ],
    "outcomeIds": [
      "complianceEvidence"
    ],
    "capabilityIds": [
      "benchmark-reporting",
      "integrated-readiness",
      "programs"
    ],
    "pibrTrack": "Benchmark & Report",
    "contentTags": [
      "evidence",
      "benchmark",
      "audit"
    ],
    "enabled": true,
    "order": 9
  },
  {
    "id": "outcome_cyberWorkforce",
    "type": "outcome",
    "layerOrder": 2,
    "title": "Build and retain a cyber-ready workforce",
    "description": "Improve role readiness and progression visibility across technical and non-technical teams.",
    "questionKeys": [],
    "optionIds": [],
    "painIds": [
      "pain_workforce_readiness"
    ],
    "outcomeIds": [
      "cyberWorkforce"
    ],
    "capabilityIds": [
      "workforce-exercising",
      "hands-on-labs",
      "programs"
    ],
    "pibrTrack": "Improve",
    "contentTags": [
      "workforce",
      "skills"
    ],
    "enabled": true,
    "order": 10
  },
  {
    "id": "outcome_supplyChain",
    "type": "outcome",
    "layerOrder": 2,
    "title": "Strengthen supply-chain resilience",
    "description": "Improve preparedness for vendor-origin incidents and third-party disruption scenarios.",
    "questionKeys": [],
    "optionIds": [],
    "painIds": [
      "pain_third_party"
    ],
    "outcomeIds": [
      "supplyChain"
    ],
    "capabilityIds": [
      "cyber-drills",
      "programs",
      "benchmark-reporting"
    ],
    "pibrTrack": "Prove",
    "contentTags": [
      "supply-chain",
      "third-party"
    ],
    "enabled": true,
    "order": 11
  },
  {
    "id": "cap_integrated_readiness",
    "type": "capability",
    "layerOrder": 3,
    "title": "Integrated readiness automations",
    "description": "Embed readiness into collaboration, development, LMS, and API workflows to operationalize resilience.",
    "questionKeys": [],
    "optionIds": [
      "msteams",
      "github",
      "restapi",
      "workday",
      "successfactors",
      "cornerstone"
    ],
    "painIds": [],
    "outcomeIds": [
      "cyberWorkforce",
      "complianceEvidence",
      "secureEnterprise"
    ],
    "capabilityIds": [
      "integrated-readiness"
    ],
    "pibrTrack": "Cross-PIBR",
    "contentTags": [
      "integrations",
      "automation"
    ],
    "enabled": true,
    "order": 12
  },
  {
    "id": "cap_cyber_drills",
    "type": "capability",
    "layerOrder": 3,
    "title": "Cyber Drills",
    "description": "Run cross-functional attack simulations to measure response speed, coordination, and outcomes.",
    "questionKeys": [],
    "optionIds": [
      "socir",
      "board",
      "regulator",
      "investor"
    ],
    "painIds": [],
    "outcomeIds": [
      "fasterResponse",
      "complianceEvidence"
    ],
    "capabilityIds": [
      "cyber-drills"
    ],
    "pibrTrack": "Prove",
    "contentTags": [
      "drills",
      "simulation"
    ],
    "enabled": true,
    "order": 13
  },
  {
    "id": "cap_crisis_sim",
    "type": "capability",
    "layerOrder": 3,
    "title": "Cyber Crisis Simulation",
    "description": "Exercise executives and crisis stakeholders with measurable decision analytics under pressure.",
    "questionKeys": [],
    "optionIds": [
      "executive",
      "legal",
      "communications",
      "crisis"
    ],
    "painIds": [],
    "outcomeIds": [
      "fasterResponse",
      "complianceEvidence"
    ],
    "capabilityIds": [
      "crisis-sim"
    ],
    "pibrTrack": "Prove",
    "contentTags": [
      "crisis",
      "executive"
    ],
    "enabled": true,
    "order": 14
  },
  {
    "id": "cap_dynamic_threat_range",
    "type": "capability",
    "layerOrder": 3,
    "title": "Dynamic Threat Range",
    "description": "Validate SOC capability in live-fire enterprise simulations aligned to real tool stacks.",
    "questionKeys": [],
    "optionIds": [
      "splunk",
      "elastic",
      "sentinel",
      "crowdstrike",
      "soc"
    ],
    "painIds": [],
    "outcomeIds": [
      "fasterResponse",
      "secureEnterprise"
    ],
    "capabilityIds": [
      "dynamic-threat-range"
    ],
    "pibrTrack": "Prove",
    "contentTags": [
      "soc",
      "siem",
      "threat-hunting"
    ],
    "enabled": true,
    "order": 15
  },
  {
    "id": "cap_hands_on_labs",
    "type": "capability",
    "layerOrder": 3,
    "title": "Hands-On Labs",
    "description": "Close role-specific skill gaps with realistic labs across AppSec, cloud, identity, OT, and AI.",
    "questionKeys": [],
    "optionIds": [
      "appsec",
      "cloud",
      "identity",
      "ot",
      "ai"
    ],
    "painIds": [],
    "outcomeIds": [
      "secureEnterprise",
      "secureAI",
      "cyberWorkforce"
    ],
    "capabilityIds": [
      "hands-on-labs"
    ],
    "pibrTrack": "Improve",
    "contentTags": [
      "labs",
      "upskilling"
    ],
    "enabled": true,
    "order": 16
  },
  {
    "id": "cap_appsec_range",
    "type": "capability",
    "layerOrder": 3,
    "title": "AppSec Range Exercises",
    "description": "Strengthen secure development behavior through collaborative remediation workflows.",
    "questionKeys": [],
    "optionIds": [
      "github",
      "branch protection",
      "sdlc",
      "devsecops"
    ],
    "painIds": [],
    "outcomeIds": [
      "secureEnterprise"
    ],
    "capabilityIds": [
      "appsec-range-exercises"
    ],
    "pibrTrack": "Improve",
    "contentTags": [
      "appsec",
      "sdlc"
    ],
    "enabled": true,
    "order": 17
  },
  {
    "id": "cap_workforce_exercising",
    "type": "capability",
    "layerOrder": 3,
    "title": "Workforce Exercising",
    "description": "Drive measurable behavior change across non-technical and mixed teams.",
    "questionKeys": [],
    "optionIds": [
      "workforce",
      "lms",
      "workday",
      "successfactors",
      "cornerstone"
    ],
    "painIds": [],
    "outcomeIds": [
      "cyberWorkforce",
      "complianceEvidence"
    ],
    "capabilityIds": [
      "workforce-exercising"
    ],
    "pibrTrack": "Improve",
    "contentTags": [
      "workforce",
      "behavior"
    ],
    "enabled": true,
    "order": 18
  },
  {
    "id": "cap_benchmark_reporting",
    "type": "capability",
    "layerOrder": 3,
    "title": "Resilience Score and reporting",
    "description": "Convert exercise and lab outcomes into board-ready benchmark views and audit-facing evidence.",
    "questionKeys": [],
    "optionIds": [
      "audit",
      "evidence",
      "benchmark",
      "board",
      "regulator"
    ],
    "painIds": [],
    "outcomeIds": [
      "complianceEvidence",
      "fasterResponse"
    ],
    "capabilityIds": [
      "benchmark-reporting"
    ],
    "pibrTrack": "Benchmark & Report",
    "contentTags": [
      "reporting",
      "benchmark"
    ],
    "enabled": true,
    "order": 19
  },
  {
    "id": "cap_programs",
    "type": "capability",
    "layerOrder": 3,
    "title": "Programs orchestration",
    "description": "Operationalize readiness as a continuous system with managed journeys and intervention controls.",
    "questionKeys": [],
    "optionIds": [
      "programmatic",
      "cadence",
      "journey",
      "cohort"
    ],
    "painIds": [],
    "outcomeIds": [
      "cyberWorkforce",
      "fasterResponse",
      "complianceEvidence"
    ],
    "capabilityIds": [
      "programs"
    ],
    "pibrTrack": "Cross-PIBR",
    "contentTags": [
      "programs",
      "operations"
    ],
    "enabled": true,
    "order": 20
  },
  {
    "id": "cap_secure_ai",
    "type": "capability",
    "layerOrder": 3,
    "title": "Secure AI readiness",
    "description": "Build safe AI adoption with scenario-driven controls testing and practical guardrails.",
    "questionKeys": [],
    "optionIds": [
      "ai",
      "llm",
      "prompt injection",
      "model",
      "genai"
    ],
    "painIds": [],
    "outcomeIds": [
      "secureAI",
      "secureEnterprise"
    ],
    "capabilityIds": [
      "secure-ai-readiness"
    ],
    "pibrTrack": "Improve",
    "contentTags": [
      "secure-ai",
      "controls"
    ],
    "enabled": true,
    "order": 21
  },
  {
    "id": "platform_immersive_one",
    "type": "platform",
    "layerOrder": 4,
    "title": "Immersive One",
    "description": "A unified cyber readiness platform that operationalizes prove, improve, benchmark, and report across your organization.",
    "questionKeys": [],
    "optionIds": [],
    "painIds": [],
    "outcomeIds": [
      "fasterResponse",
      "secureEnterprise",
      "secureAI",
      "complianceEvidence",
      "cyberWorkforce",
      "supplyChain"
    ],
    "capabilityIds": [
      "integrated-readiness",
      "cyber-drills",
      "crisis-sim",
      "dynamic-threat-range",
      "hands-on-labs",
      "appsec-range-exercises",
      "workforce-exercising",
      "benchmark-reporting",
      "programs",
      "secure-ai-readiness"
    ],
    "pibrTrack": "Cross-PIBR",
    "contentTags": [
      "immersive-one",
      "platform"
    ],
    "enabled": true,
    "order": 22
  },
  {
    "id": "brand_be_ready",
    "type": "brand",
    "layerOrder": 5,
    "title": "Immersive: Be Ready",
    "description": "Be Ready is the brand promise: turn cyber readiness into measurable, defensible confidence.",
    "questionKeys": [],
    "optionIds": [],
    "painIds": [],
    "outcomeIds": [],
    "capabilityIds": [],
    "pibrTrack": "",
    "contentTags": [
      "be-ready",
      "brand"
    ],
    "enabled": true,
    "order": 23
  }
];
  const byType = {
  "pain": [
    {
      "id": "pain_decision_speed",
      "type": "pain",
      "layerOrder": 1,
      "title": "Decision speed under pressure",
      "description": "Incident decisions and cross-team coordination are too slow when pressure spikes.",
      "questionKeys": [
        "pressureSources",
        "urgentWin",
        "riskEnvs",
        "measuredOn",
        "orgPain"
      ],
      "optionIds": [
        "board",
        "regulator",
        "insurer",
        "fasterDecisions",
        "socir",
        "mttd",
        "coordination"
      ],
      "painIds": [],
      "outcomeIds": [
        "fasterResponse",
        "complianceEvidence"
      ],
      "capabilityIds": [
        "cyber-drills",
        "crisis-sim",
        "dynamic-threat-range",
        "benchmark-reporting"
      ],
      "pibrTrack": "Prove",
      "contentTags": [
        "incident-response",
        "crisis",
        "board-reporting"
      ],
      "enabled": true,
      "order": 0
    },
    {
      "id": "pain_evidence_gap",
      "type": "pain",
      "layerOrder": 1,
      "title": "Evidence confidence gap",
      "description": "Security activity exists but evidence is not yet board-ready or audit-defensible.",
      "questionKeys": [
        "pressureSources",
        "urgentWin",
        "measuredOn",
        "orgPain",
        "regs"
      ],
      "optionIds": [
        "board",
        "regulator",
        "insurer",
        "boardEvidence",
        "audit",
        "notMeasured",
        "externalProof"
      ],
      "painIds": [],
      "outcomeIds": [
        "complianceEvidence",
        "fasterResponse"
      ],
      "capabilityIds": [
        "benchmark-reporting",
        "programs",
        "integrated-readiness"
      ],
      "pibrTrack": "Benchmark & Report",
      "contentTags": [
        "audit",
        "benchmark",
        "governance"
      ],
      "enabled": true,
      "order": 1
    },
    {
      "id": "pain_attack_surface",
      "type": "pain",
      "layerOrder": 1,
      "title": "Attack surface and remediation drag",
      "description": "Code, cloud, and identity risk closes too slowly and creates avoidable exposure.",
      "questionKeys": [
        "urgentWin",
        "riskEnvs",
        "groups",
        "stack"
      ],
      "optionIds": [
        "attackSurface",
        "code",
        "cloud",
        "identity",
        "enterpriseApps",
        "appsec",
        "cloud",
        "identity",
        "github"
      ],
      "painIds": [],
      "outcomeIds": [
        "secureEnterprise"
      ],
      "capabilityIds": [
        "appsec-range-exercises",
        "hands-on-labs",
        "integrated-readiness"
      ],
      "pibrTrack": "Improve",
      "contentTags": [
        "appsec",
        "cloud",
        "identity",
        "devsecops"
      ],
      "enabled": true,
      "order": 2
    },
    {
      "id": "pain_workforce_readiness",
      "type": "pain",
      "layerOrder": 1,
      "title": "Workforce readiness visibility",
      "description": "Role readiness is inconsistent and progression is hard to prove across teams.",
      "questionKeys": [
        "urgentWin",
        "orgPain",
        "measuredOn",
        "groups",
        "stack"
      ],
      "optionIds": [
        "workforce",
        "skillsCoverage",
        "training",
        "workforce",
        "workday",
        "successfactors",
        "cornerstone",
        "msteams"
      ],
      "painIds": [],
      "outcomeIds": [
        "cyberWorkforce",
        "complianceEvidence"
      ],
      "capabilityIds": [
        "workforce-exercising",
        "hands-on-labs",
        "programs",
        "integrated-readiness"
      ],
      "pibrTrack": "Improve",
      "contentTags": [
        "workforce",
        "lms",
        "readiness"
      ],
      "enabled": true,
      "order": 3
    },
    {
      "id": "pain_ai_risk",
      "type": "pain",
      "layerOrder": 1,
      "title": "AI adoption risk and uncertainty",
      "description": "AI use is moving faster than governance, controls, and practical testing.",
      "questionKeys": [
        "urgentWin",
        "orgPain",
        "riskEnvs",
        "stack",
        "regs"
      ],
      "optionIds": [
        "safeAI",
        "aiRisk",
        "code",
        "cloud",
        "ai",
        "euaiact",
        "iso42001",
        "nistairmf"
      ],
      "painIds": [],
      "outcomeIds": [
        "secureAI",
        "secureEnterprise"
      ],
      "capabilityIds": [
        "secure-ai-readiness",
        "hands-on-labs",
        "benchmark-reporting"
      ],
      "pibrTrack": "Improve",
      "contentTags": [
        "secure-ai",
        "governance",
        "controls"
      ],
      "enabled": true,
      "order": 4
    },
    {
      "id": "pain_third_party",
      "type": "pain",
      "layerOrder": 1,
      "title": "Third-party and supply-chain exposure",
      "description": "Vendor dependency and partner risk create uncertainty in detection and containment.",
      "questionKeys": [
        "urgentWin",
        "orgPain",
        "pressureSources",
        "groups",
        "regs"
      ],
      "optionIds": [
        "thirdParty",
        "vendorRisk",
        "customers",
        "third",
        "nist800161",
        "dfars7012",
        "cmmc"
      ],
      "painIds": [],
      "outcomeIds": [
        "supplyChain",
        "complianceEvidence"
      ],
      "capabilityIds": [
        "cyber-drills",
        "benchmark-reporting",
        "programs"
      ],
      "pibrTrack": "Prove",
      "contentTags": [
        "supply-chain",
        "vendor-risk",
        "resilience"
      ],
      "enabled": true,
      "order": 5
    }
  ],
  "outcome": [
    {
      "id": "outcome_fasterResponse",
      "type": "outcome",
      "layerOrder": 2,
      "title": "Prove faster detection, response, and decision-making",
      "description": "Cut MTTD/MTTR and improve response quality in realistic pressure scenarios.",
      "questionKeys": [],
      "optionIds": [],
      "painIds": [
        "pain_decision_speed",
        "pain_evidence_gap",
        "pain_third_party"
      ],
      "outcomeIds": [
        "fasterResponse"
      ],
      "capabilityIds": [
        "cyber-drills",
        "crisis-sim",
        "dynamic-threat-range"
      ],
      "pibrTrack": "Prove",
      "contentTags": [
        "mttd",
        "mttr",
        "incident-response"
      ],
      "enabled": true,
      "order": 6
    },
    {
      "id": "outcome_secureEnterprise",
      "type": "outcome",
      "layerOrder": 2,
      "title": "Secure the modern enterprise",
      "description": "Reduce exploitable risk across code, cloud, identity, and operational workflows.",
      "questionKeys": [],
      "optionIds": [],
      "painIds": [
        "pain_attack_surface",
        "pain_ai_risk"
      ],
      "outcomeIds": [
        "secureEnterprise"
      ],
      "capabilityIds": [
        "hands-on-labs",
        "appsec-range-exercises",
        "integrated-readiness"
      ],
      "pibrTrack": "Improve",
      "contentTags": [
        "appsec",
        "cloud",
        "identity"
      ],
      "enabled": true,
      "order": 7
    },
    {
      "id": "outcome_secureAI",
      "type": "outcome",
      "layerOrder": 2,
      "title": "Enable secure AI adoption and governance",
      "description": "Adopt AI with tested controls, measurable readiness, and accountable governance.",
      "questionKeys": [],
      "optionIds": [],
      "painIds": [
        "pain_ai_risk"
      ],
      "outcomeIds": [
        "secureAI"
      ],
      "capabilityIds": [
        "secure-ai-readiness",
        "hands-on-labs",
        "benchmark-reporting"
      ],
      "pibrTrack": "Improve",
      "contentTags": [
        "ai-governance",
        "prompt-injection"
      ],
      "enabled": true,
      "order": 8
    },
    {
      "id": "outcome_complianceEvidence",
      "type": "outcome",
      "layerOrder": 2,
      "title": "Transform compliance into evidence and benchmarks",
      "description": "Translate readiness into auditable proof mapped to board and regulatory expectations.",
      "questionKeys": [],
      "optionIds": [],
      "painIds": [
        "pain_evidence_gap",
        "pain_decision_speed",
        "pain_third_party"
      ],
      "outcomeIds": [
        "complianceEvidence"
      ],
      "capabilityIds": [
        "benchmark-reporting",
        "integrated-readiness",
        "programs"
      ],
      "pibrTrack": "Benchmark & Report",
      "contentTags": [
        "evidence",
        "benchmark",
        "audit"
      ],
      "enabled": true,
      "order": 9
    },
    {
      "id": "outcome_cyberWorkforce",
      "type": "outcome",
      "layerOrder": 2,
      "title": "Build and retain a cyber-ready workforce",
      "description": "Improve role readiness and progression visibility across technical and non-technical teams.",
      "questionKeys": [],
      "optionIds": [],
      "painIds": [
        "pain_workforce_readiness"
      ],
      "outcomeIds": [
        "cyberWorkforce"
      ],
      "capabilityIds": [
        "workforce-exercising",
        "hands-on-labs",
        "programs"
      ],
      "pibrTrack": "Improve",
      "contentTags": [
        "workforce",
        "skills"
      ],
      "enabled": true,
      "order": 10
    },
    {
      "id": "outcome_supplyChain",
      "type": "outcome",
      "layerOrder": 2,
      "title": "Strengthen supply-chain resilience",
      "description": "Improve preparedness for vendor-origin incidents and third-party disruption scenarios.",
      "questionKeys": [],
      "optionIds": [],
      "painIds": [
        "pain_third_party"
      ],
      "outcomeIds": [
        "supplyChain"
      ],
      "capabilityIds": [
        "cyber-drills",
        "programs",
        "benchmark-reporting"
      ],
      "pibrTrack": "Prove",
      "contentTags": [
        "supply-chain",
        "third-party"
      ],
      "enabled": true,
      "order": 11
    }
  ],
  "capability": [
    {
      "id": "cap_integrated_readiness",
      "type": "capability",
      "layerOrder": 3,
      "title": "Integrated readiness automations",
      "description": "Embed readiness into collaboration, development, LMS, and API workflows to operationalize resilience.",
      "questionKeys": [],
      "optionIds": [
        "msteams",
        "github",
        "restapi",
        "workday",
        "successfactors",
        "cornerstone"
      ],
      "painIds": [],
      "outcomeIds": [
        "cyberWorkforce",
        "complianceEvidence",
        "secureEnterprise"
      ],
      "capabilityIds": [
        "integrated-readiness"
      ],
      "pibrTrack": "Cross-PIBR",
      "contentTags": [
        "integrations",
        "automation"
      ],
      "enabled": true,
      "order": 12
    },
    {
      "id": "cap_cyber_drills",
      "type": "capability",
      "layerOrder": 3,
      "title": "Cyber Drills",
      "description": "Run cross-functional attack simulations to measure response speed, coordination, and outcomes.",
      "questionKeys": [],
      "optionIds": [
        "socir",
        "board",
        "regulator",
        "investor"
      ],
      "painIds": [],
      "outcomeIds": [
        "fasterResponse",
        "complianceEvidence"
      ],
      "capabilityIds": [
        "cyber-drills"
      ],
      "pibrTrack": "Prove",
      "contentTags": [
        "drills",
        "simulation"
      ],
      "enabled": true,
      "order": 13
    },
    {
      "id": "cap_crisis_sim",
      "type": "capability",
      "layerOrder": 3,
      "title": "Cyber Crisis Simulation",
      "description": "Exercise executives and crisis stakeholders with measurable decision analytics under pressure.",
      "questionKeys": [],
      "optionIds": [
        "executive",
        "legal",
        "communications",
        "crisis"
      ],
      "painIds": [],
      "outcomeIds": [
        "fasterResponse",
        "complianceEvidence"
      ],
      "capabilityIds": [
        "crisis-sim"
      ],
      "pibrTrack": "Prove",
      "contentTags": [
        "crisis",
        "executive"
      ],
      "enabled": true,
      "order": 14
    },
    {
      "id": "cap_dynamic_threat_range",
      "type": "capability",
      "layerOrder": 3,
      "title": "Dynamic Threat Range",
      "description": "Validate SOC capability in live-fire enterprise simulations aligned to real tool stacks.",
      "questionKeys": [],
      "optionIds": [
        "splunk",
        "elastic",
        "sentinel",
        "crowdstrike",
        "soc"
      ],
      "painIds": [],
      "outcomeIds": [
        "fasterResponse",
        "secureEnterprise"
      ],
      "capabilityIds": [
        "dynamic-threat-range"
      ],
      "pibrTrack": "Prove",
      "contentTags": [
        "soc",
        "siem",
        "threat-hunting"
      ],
      "enabled": true,
      "order": 15
    },
    {
      "id": "cap_hands_on_labs",
      "type": "capability",
      "layerOrder": 3,
      "title": "Hands-On Labs",
      "description": "Close role-specific skill gaps with realistic labs across AppSec, cloud, identity, OT, and AI.",
      "questionKeys": [],
      "optionIds": [
        "appsec",
        "cloud",
        "identity",
        "ot",
        "ai"
      ],
      "painIds": [],
      "outcomeIds": [
        "secureEnterprise",
        "secureAI",
        "cyberWorkforce"
      ],
      "capabilityIds": [
        "hands-on-labs"
      ],
      "pibrTrack": "Improve",
      "contentTags": [
        "labs",
        "upskilling"
      ],
      "enabled": true,
      "order": 16
    },
    {
      "id": "cap_appsec_range",
      "type": "capability",
      "layerOrder": 3,
      "title": "AppSec Range Exercises",
      "description": "Strengthen secure development behavior through collaborative remediation workflows.",
      "questionKeys": [],
      "optionIds": [
        "github",
        "branch protection",
        "sdlc",
        "devsecops"
      ],
      "painIds": [],
      "outcomeIds": [
        "secureEnterprise"
      ],
      "capabilityIds": [
        "appsec-range-exercises"
      ],
      "pibrTrack": "Improve",
      "contentTags": [
        "appsec",
        "sdlc"
      ],
      "enabled": true,
      "order": 17
    },
    {
      "id": "cap_workforce_exercising",
      "type": "capability",
      "layerOrder": 3,
      "title": "Workforce Exercising",
      "description": "Drive measurable behavior change across non-technical and mixed teams.",
      "questionKeys": [],
      "optionIds": [
        "workforce",
        "lms",
        "workday",
        "successfactors",
        "cornerstone"
      ],
      "painIds": [],
      "outcomeIds": [
        "cyberWorkforce",
        "complianceEvidence"
      ],
      "capabilityIds": [
        "workforce-exercising"
      ],
      "pibrTrack": "Improve",
      "contentTags": [
        "workforce",
        "behavior"
      ],
      "enabled": true,
      "order": 18
    },
    {
      "id": "cap_benchmark_reporting",
      "type": "capability",
      "layerOrder": 3,
      "title": "Resilience Score and reporting",
      "description": "Convert exercise and lab outcomes into board-ready benchmark views and audit-facing evidence.",
      "questionKeys": [],
      "optionIds": [
        "audit",
        "evidence",
        "benchmark",
        "board",
        "regulator"
      ],
      "painIds": [],
      "outcomeIds": [
        "complianceEvidence",
        "fasterResponse"
      ],
      "capabilityIds": [
        "benchmark-reporting"
      ],
      "pibrTrack": "Benchmark & Report",
      "contentTags": [
        "reporting",
        "benchmark"
      ],
      "enabled": true,
      "order": 19
    },
    {
      "id": "cap_programs",
      "type": "capability",
      "layerOrder": 3,
      "title": "Programs orchestration",
      "description": "Operationalize readiness as a continuous system with managed journeys and intervention controls.",
      "questionKeys": [],
      "optionIds": [
        "programmatic",
        "cadence",
        "journey",
        "cohort"
      ],
      "painIds": [],
      "outcomeIds": [
        "cyberWorkforce",
        "fasterResponse",
        "complianceEvidence"
      ],
      "capabilityIds": [
        "programs"
      ],
      "pibrTrack": "Cross-PIBR",
      "contentTags": [
        "programs",
        "operations"
      ],
      "enabled": true,
      "order": 20
    },
    {
      "id": "cap_secure_ai",
      "type": "capability",
      "layerOrder": 3,
      "title": "Secure AI readiness",
      "description": "Build safe AI adoption with scenario-driven controls testing and practical guardrails.",
      "questionKeys": [],
      "optionIds": [
        "ai",
        "llm",
        "prompt injection",
        "model",
        "genai"
      ],
      "painIds": [],
      "outcomeIds": [
        "secureAI",
        "secureEnterprise"
      ],
      "capabilityIds": [
        "secure-ai-readiness"
      ],
      "pibrTrack": "Improve",
      "contentTags": [
        "secure-ai",
        "controls"
      ],
      "enabled": true,
      "order": 21
    }
  ],
  "platform": [
    {
      "id": "platform_immersive_one",
      "type": "platform",
      "layerOrder": 4,
      "title": "Immersive One",
      "description": "A unified cyber readiness platform that operationalizes prove, improve, benchmark, and report across your organization.",
      "questionKeys": [],
      "optionIds": [],
      "painIds": [],
      "outcomeIds": [
        "fasterResponse",
        "secureEnterprise",
        "secureAI",
        "complianceEvidence",
        "cyberWorkforce",
        "supplyChain"
      ],
      "capabilityIds": [
        "integrated-readiness",
        "cyber-drills",
        "crisis-sim",
        "dynamic-threat-range",
        "hands-on-labs",
        "appsec-range-exercises",
        "workforce-exercising",
        "benchmark-reporting",
        "programs",
        "secure-ai-readiness"
      ],
      "pibrTrack": "Cross-PIBR",
      "contentTags": [
        "immersive-one",
        "platform"
      ],
      "enabled": true,
      "order": 22
    }
  ],
  "brand": [
    {
      "id": "brand_be_ready",
      "type": "brand",
      "layerOrder": 5,
      "title": "Immersive: Be Ready",
      "description": "Be Ready is the brand promise: turn cyber readiness into measurable, defensible confidence.",
      "questionKeys": [],
      "optionIds": [],
      "painIds": [],
      "outcomeIds": [],
      "capabilityIds": [],
      "pibrTrack": "",
      "contentTags": [
        "be-ready",
        "brand"
      ],
      "enabled": true,
      "order": 23
    }
  ]
};
  window.immersiveReadinessPyramidModel = Object.freeze({
    version: 'readiness-pyramid-model.v1',
    rows: Object.freeze(rows.map((row)=> Object.freeze(row))),
    byType: Object.freeze(Object.keys(byType).reduce((acc, key)=> {
      acc[key] = Object.freeze((byType[key] || []).map((row)=> Object.freeze(row)));
      return acc;
    }, Object.create(null)))
  });
})();
