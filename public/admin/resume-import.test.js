(() => {
  'use strict';
  const runResumeImportTests = () => {
    const failures = [];
    const assert = (condition, message) => { if (!condition) failures.push(message); };
    const source = [
      'Alan Example',
      '08012345678',
      'alan@example.com',
      'Abuja, Nigeria',
      'Portfolio: alanexample.dev',
      'LinkedIn: https://www.linkedin.com/in/alanexample',
      '',
      'PROFESSIONAL SUMMARY',
      'Product designer focused on clear, accessible digital products.',
      '',
      'WORK EXPERIENCE',
      'Product Designer | Example Co | Jan 2021 - Mar 2023',
      '• Designed a dashboard used by 120 customers.',
      '• Reduced task time by 30%.',
      '',
      'SKILLS',
      'Design: Figma, Prototyping; Research',
      '',
      'EDUCATION',
      'BSc Computer Science, 2018'
    ].join('\n');
    const result = window.ResumeImport.extract(source);
    assert(result.profile.contact.email === 'alan@example.com', 'Email extraction');
    assert(result.profile.contact.phone.replace(/\D/g,'') === '08012345678', 'Nigerian local phone extraction');
    assert(result.profile.contact.location.includes('Abuja'), 'Location extraction');
    assert(result.profile.contact.links.some(x => x.label === 'LinkedIn' && x.url.includes('linkedin.com')), 'LinkedIn domain label');
    assert(result.profile.contact.links.some(x => x.label === 'Website or Portfolio' && x.url.includes('alanexample.dev')), 'Portfolio URL must not be labeled LinkedIn');
    assert(result.profile.experience.length > 0, 'Experience section extraction');
    assert(result.profile.experience.reduce((n,x)=>n+x.bullets.length,0) === 2, 'Bullet count preserved');
    assert(result.profile.experience.some(x=>x.bullets.some(b=>b.text === 'Designed a dashboard used by 120 customers.')), 'Bullet source text preserved');
    assert(result.profile.skills.some(x=>x.items.includes('Figma') && x.items.includes('Prototyping') && x.items.includes('Research')), 'Skill tokens preserved');
    assert(result.stats.aiEntries === 0, 'Code-only import uses zero AI calls');
    return { ok: failures.length === 0, failures, stats: result.stats, linkLabels: result.profile.contact.links.map(x=>x.label) };
  };
  window.runResumeImportTests = runResumeImportTests;
})();