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
    const multiline = window.ResumeImport.extract([
      'Alex Example','alex@example.com','08012345678','Abuja, Nigeria',
      'WORK EXPERIENCE',
      'Senior Product Designer','Example Co','Jan 2021 - Mar 2023',
      '• Led product discovery and prototyping.',
      '• Improved onboarding completion by 24%.',
      'Product Designer | Another Co | 09/2020 - 11/2022',
      '• Designed payment flows.',
      'EDUCATION',
      'BSc Computer Science, Example University, 2018'
    ].join('\n'));
    assert(multiline.profile.experience.length === 2, 'Multi-line roles are separated into two jobs');
    assert(multiline.profile.experience[0].title === 'Senior Product Designer', 'Multi-line job title stays in title field');
    assert(multiline.profile.experience[0].company === 'Example Co', 'Date-only line does not overwrite company field');
    assert(multiline.profile.experience[0].startDate === 'Jan 2021' && multiline.profile.experience[0].endDate === 'Mar 2023', 'Date-only line maps dates correctly');
    assert(!multiline.profile.experience[0].bullets.some(b => /Jan 2021/.test(b.text)), 'Date metadata is not imported as a bullet');
    assert(multiline.profile.education[0].degree.includes('BSc'), 'Education qualification is mapped to degree');
    assert(multiline.profile.education[0].institution.includes('Example University'), 'Education institution is mapped separately');
    assert(result.stats.aiEntries === 0, 'Code-only import uses zero AI calls');
    return { ok: failures.length === 0, failures, stats: result.stats, linkLabels: result.profile.contact.links.map(x=>x.label) };
  };
  window.runResumeImportTests = runResumeImportTests;
})();