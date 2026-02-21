/* global window */
(function(){
  const schema = {
    accountRoleOptions: [
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
    ],
    companySizeOptions: [
      { value:'lt500', label:'< 500 employees' },
      { value:'500-2k', label:'500–2,000' },
      { value:'2k-10k', label:'2,000–10,000' },
      { value:'10k-50k', label:'10,000–50,000' },
      { value:'50kplus', label:'50,000+' }
    ],
    operatingCountryOptions: [
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
    ],
    industryOptions: [
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
    ],
    regionOptions: [
      { value:'NA', label:'North America' },
      { value:'UKI', label:'UK & Ireland' },
      { value:'EU', label:'Europe (EU)' },
      { value:'APAC', label:'APAC' },
      { value:'Other', label:'Other / Global' }
    ]
  };

  window.immersiveUiSchema = Object.freeze(schema);
})();
