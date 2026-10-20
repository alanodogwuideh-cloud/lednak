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
      'Product Designer','Another Co','09/2020 - 11/2022',
      '• Designed payment flows.',
      'Brand & Visual Designer','Lednak Designs','08/2015 - 11/2023',
      '• Produced digital and print campaign assets.',
      'EDUCATION',
      'Bachelor of Science, Computer Science',
      'Michael Okpara University of Agriculture Umudike',
      '2009 - 2013'
    ].join('\n'));
    assert(multiline.profile.experience.length === 3, 'Three multi-line roles are separated into three jobs');
    assert(multiline.profile.experience[0].title === 'Senior Product Designer', 'First job title stays in title field');
    assert(multiline.profile.experience[0].company === 'Example Co', 'First employer stays in company field');
    assert(multiline.profile.experience[0].startDate === 'Jan 2021' && multiline.profile.experience[0].endDate === 'Mar 2023', 'First role dates map correctly');
    assert(multiline.profile.experience[1].title === 'Product Designer' && multiline.profile.experience[1].company === 'Another Co', 'Second role title and employer map separately');
    assert(multiline.profile.experience[2].title === 'Brand & Visual Designer' && multiline.profile.experience[2].company === 'Lednak Designs', 'Third role title and employer map separately');
    assert(multiline.profile.experience.every(x => !x.location), 'General contact location is not copied into each job location');
    assert(!multiline.profile.experience[0].bullets.some(b => /Jan 2021/.test(b.text)), 'Date metadata is not imported as a bullet');
    assert(multiline.profile.education[0].degree.includes('Bachelor of Science'), 'Education qualification is mapped to degree');
    assert(multiline.profile.education[0].field.includes('Computer Science'), 'Education field of study is extracted');
    assert(multiline.profile.education[0].institution.includes('Michael Okpara University'), 'Education institution is mapped separately');
    assert(multiline.profile.education[0].startDate === '2009' && multiline.profile.education[0].endDate === '2013', 'Education dates are mapped separately');
    assert(result.stats.aiEntries === 0, 'Code-only import uses zero AI calls');
    return { ok: failures.length === 0, failures, stats: result.stats, linkLabels: result.profile.contact.links.map(x=>x.label) };
  };
  window.runResumeImportTests = runResumeImportTests;
})();